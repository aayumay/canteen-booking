// CLS was still ~0.10 after removing the ticker and grain, so neither was the
// cause. LayoutShift entries carry the node that moved, so read the sources
// instead of guessing which element is responsible.
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

await ev(ws, "location.reload()");
await sleep(5000);

// Installed after load on purpose: reload wipes the page context, but
// buffered:true still replays every shift that happened before this ran.
await ev(ws, `(() => {
  window.__shifts = [];
  window.__po = new PerformanceObserver(list => {
    for (const e of list.getEntries()) {
      if (e.hadRecentInput) continue;
      window.__shifts.push({
        value: e.value,
        time: Math.round(e.startTime),
        sources: (e.sources || []).map(s => {
          const n = s.node;
          if (!n) return 'detached';
          const cls = (n.className && (n.className.baseVal ?? n.className)) || '';
          const tag = n.tagName ? n.tagName.toLowerCase() : '?';
          const txt = (n.textContent || '').trim().slice(0, 28);
          return tag + (cls ? '.' + String(cls).split(' ').filter(Boolean).slice(0,2).join('.') : '') +
                 (txt ? ' "' + txt + '"' : '');
        }),
      });
    }
  });
  window.__po.observe({ type: 'layout-shift', buffered: true });
  return true;
})()`);

await ev(ws, `(async () => {
  const max = document.documentElement.scrollHeight - window.innerHeight;
  for (let i = 0; i <= 90; i++) {
    window.scrollTo(0, Math.round((max * i) / 90));
    await new Promise(r => requestAnimationFrame(r));
  }
  await new Promise(r => setTimeout(r, 500));
  return true;
})()`);

const shifts = await ev(ws, "window.__shifts");
const fonts = await ev(ws, `(() => {
  const info = {};
  try { const m = document.fonts; info.status = m.status; info.size = m.size; } catch (e) { info.err = String(e); }
  return {
    fonts: info,
    fontDisplaySwap: [...document.querySelectorAll('h1, h2, .lp-hero-title, .lp-marquee-item, p')].length,
  };
})()`);

const total = shifts.reduce((a, s) => a + s.value, 0);
console.log("CLS SOURCES  (total " + total.toFixed(4) + ", " + shifts.length + " shift entries)\n");

const byNode = new Map();
for (const s of shifts) {
  for (const src of s.sources) byNode.set(src, (byNode.get(src) || 0) + s.value);
}
const ranked = [...byNode.entries()].sort((a, b) => b[1] - a[1]);
console.log("  CULPRIT                                        CLS");
for (const [node, v] of ranked.slice(0, 14)) console.log("  " + node.slice(0, 45).padEnd(46) + v.toFixed(4));

console.log("\n  timeline (largest 6):");
for (const s of [...shifts].sort((a, b) => b.value - a.value).slice(0, 6)) {
  console.log("    t=" + String(s.time).padStart(6) + "ms  " + s.value.toFixed(4) + "  " + s.sources[0]);
}
console.log("\n  fonts: " + JSON.stringify(fonts));

ws.close();
process.exit(0);