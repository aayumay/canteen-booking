// Verifies the section heads sit on one shared left axis. For each section it
// records the left edge of the kicker, title, squiggle and note, then reports the
// spread. Anything above a couple of pixels means the axis is broken.
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

const PROBE = `(() => {
  const left = (el) => el ? Math.round(el.getBoundingClientRect().left) : null;
  const rows = [];
  for (const head of document.querySelectorAll('.lp-section-head, .lp-faq-intro')) {
    const section = head.closest('section');
    const id = section?.className.match(/lp-([a-z-]+)/)?.[1] || 'unknown';
    const parts = {
      kicker:  left(head.querySelector('.lp-kicker, .lp-eyebrow')),
      title:   left(head.querySelector('.lp-section-title')),
      squiggle:left(head.querySelector('.lp-section-squiggle')),
      note:    left(head.querySelector('.lp-section-note')),
    };
    const values = Object.values(parts).filter((v) => v !== null);
    const row = { section: id, ...parts };
    row.spread = values.length ? Math.max(...values) - Math.min(...values) : 0;
    rows.push(row);
  }
  // All sections should also start from the same container gutter.
  const gutters = [...document.querySelectorAll('.lp-section-inner')]
    .map(el => Math.round(el.getBoundingClientRect().left));
  return {
    rows,
    gutterMin: gutters.length ? Math.min(...gutters) : null,
    gutterMax: gutters.length ? Math.max(...gutters) : null,
    containerSpread: gutters.length ? Math.max(...gutters) - Math.min(...gutters) : 0,
    docHeight: document.documentElement.scrollHeight,
  };
})()`;

let failures = 0;
const ok = (c) => { if (!c) failures++; return c ? "PASS" : "FAIL"; };

for (const vp of [
  { name: "1920x1080", w: 1920, h: 1080 },
  { name: "1440x900",  w: 1440, h: 900 },
  { name: "1024x768",  w: 1024, h: 768 },
  { name: "768x1024",  w: 768,  h: 1024 },
  { name: "390x844",   w: 390,  h: 844 },
]) {
  await cdp(ws, "Emulation.setDeviceMetricsOverride", { width: vp.w, height: vp.h, deviceScaleFactor: 1, mobile: false });
  await ev(ws, "location.reload()");
  await sleep(3600);
  const m = await ev(ws, PROBE);

  console.log("\n=== " + vp.name + " === page " + m.docHeight + "px");
  for (const r of m.rows) {
    const bad = r.spread > 2;
    if (bad) failures++;
    console.log("  " + r.section.padEnd(16) +
      "kicker=" + String(r.kicker).padStart(5) +
      "  title=" + String(r.title).padStart(5) +
      "  squiggle=" + String(r.squiggle).padStart(5) +
      "  note=" + String(r.note).padStart(5) +
      "   spread=" + String(r.spread).padStart(3) + "px  " + ok(!bad));
  }
  console.log("  container left gutter spread: " + m.containerSpread + "px  " + ok(m.containerSpread <= 1));
}

console.log("\n" + (failures === 0 ? "ALL SECTION HEADS SHARE ONE LEFT AXIS" : failures + " MISALIGNED ITEM(S)"));
ws.close();
process.exit(failures === 0 ? 0 : 1);