// Main-thread being idle rules out JS as the cause of sluggish scrolling.
// The remaining suspects are layout shift (content-visibility sections being
// skipped then resized) and compositor cost. CLS is measurable; compositor cost
// is not, from here.
const CDP = "http://127.0.0.1:9222";
const URL = "http://127.0.0.1:4319/landing";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function cdp(ws, method, params = {}) {
  return new Promise((resolve, reject) => {
    const id = Math.floor(Math.random() * 1e9);
    const onMessage = (e) => {
      const m = JSON.parse(e.data);
      if (m.id !== id) return;
      ws.removeEventListener("message", onMessage);
      m.error ? reject(new Error(JSON.stringify(m.error))) : resolve(m.result);
    };
    ws.addEventListener("message", onMessage);
    ws.send(JSON.stringify({ id, method, params }));
  });
}
const ev = (ws, expression) =>
  cdp(ws, "Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true }).then((r) => {
    if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description || "eval failed");
    return r.result.value;
  });

const tab = await (await fetch(`${CDP}/json/new?${encodeURIComponent(URL)}`, { method: "PUT" })).json();
const ws = new WebSocket(tab.webSocketDebuggerUrl);
await new Promise((r, j) => { ws.addEventListener("open", r); ws.addEventListener("error", j); });
await ev(ws, "1");
await cdp(ws, "Emulation.setDeviceMetricsOverride", { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });
await cdp(ws, "Network.enable");
await cdp(ws, "Network.emulateNetworkConditions", {
  offline: false, latency: 150, downloadThroughput: 1.6 * 1024 * 1024 / 8, uploadThroughput: 750 * 1024 / 8,
});
await cdp(ws, "Network.clearBrowserCache");
await ev(ws, "location.reload()");
await sleep(5000);

const PROBE = `(async () => {
  // Watch for content-visibility sections reporting a height that differs from
  // contain-intrinsic-size, which is what makes a scroll feel like it is
  // slipping under you.
  const cvSections = [...document.querySelectorAll('.lp-how, .lp-bento, .lp-menu, .lp-photo-band, .lp-faq, .lp-cta')]
    .map(el => ({
      cls: el.className.split(' ')[0],
      estimate: parseInt(getComputedStyle(el).containIntrinsicSize) || null,
      actual: Math.round(el.getBoundingClientRect().height),
    }));

  let cls = 0;
  const po = new PerformanceObserver(list => { for (const e of list.getEntries()) if (!e.hadRecentInput) cls += e.value; });
  po.observe({ type: 'layout-shift', buffered: true });
  // Buffered entries are dispatched asynchronously; drain them before reading
  // the total. Do NOT also add takeRecords() here - that double-counts entries
  // the callback is about to receive, which inflated this probe to 0.10 on a
  // page that has no layout shift at all.
  await new Promise(r => setTimeout(r, 400));

  const heightSamples = [];
  const max = document.documentElement.scrollHeight - window.innerHeight;
  for (let i = 0; i <= 90; i++) {
    window.scrollTo(0, Math.round((max * i) / 90));
    if (i % 10 === 0) heightSamples.push(document.documentElement.scrollHeight);
    await new Promise(r => requestAnimationFrame(r));
  }
  await new Promise(r => setTimeout(r, 400));

  const drift = Math.max(...heightSamples) - Math.min(...heightSamples);
  return {
    pageHeight: document.documentElement.scrollHeight,
    scrollablePx: Math.round(max),
    screens: +(max / window.innerHeight).toFixed(1),
    cls: +cls.toFixed(4),
    heightDriftDuringScroll: drift,
    cvSections,
  };
})()`;

const m = await ev(ws, PROBE);
console.log("PAGE SHAPE");
console.log("  page height        : " + m.pageHeight + "px");
console.log("  scrollable         : " + m.scrollablePx + "px  (" + m.screens + " screens)");
console.log("  CLS during scroll  : " + m.cls + "   " + (m.cls < 0.1 ? "(good)" : m.cls < 0.25 ? "(needs work)" : "(bad)"));
console.log("  page height drift  : " + m.heightDriftDuringScroll + "px  " +
  (m.heightDriftDuringScroll === 0 ? "(stable)" : "(page grows while scrolling)"));
console.log("\n  content-visibility sections  estimate vs actual:");
for (const s of m.cvSections) {
  const bad = s.estimate !== null && Math.abs(s.estimate - s.actual) > 60;
  console.log("    " + s.cls.padEnd(14) + "est " + String(s.estimate).padStart(5) + "  actual " +
    String(s.actual).padStart(5) + (bad ? "   <- off by " + Math.abs(s.estimate - s.actual) + "px" : ""));
}

ws.close();
process.exit(0);