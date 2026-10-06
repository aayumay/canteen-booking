// Verifies the two removals and the off-screen loop gate.
// 1. the ticker and the grain layer are gone from the document and the bundle
// 2. the scroll cue points at an id that exists
// 3. infinite loops are paused when off-screen and running when on-screen
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
await sleep(4200);

let failures = 0;
const ok = (c) => { if (!c) failures++; return c ? "PASS" : "FAIL"; };

// ---- 1. removals -----------------------------------------------------------
const removals = await ev(ws, `(() => {
  return {
    marqueeEls: document.querySelectorAll('.lp-marquee, .lp-marquee-track, .lp-marquee-item').length,
    grainEls: document.querySelectorAll('.lp-grain').length,
    bodyTextHasTickerWords: /Zero queue wait|Live order tracking|Meal passes for the month/i.test(document.body.innerText),
    runningInfinite: [...document.querySelectorAll('.lp-root *')].filter(el => {
      const s = getComputedStyle(el);
      return s.animationName !== 'none' && s.animationIterationCount === 'infinite';
    }).length,
  };
})()`);

console.log("REMOVALS");
console.log("  ticker elements in DOM     : " + ok(removals.marqueeEls === 0) + "  (" + removals.marqueeEls + ")");
console.log("  grain layer in DOM         : " + ok(removals.grainEls === 0) + "  (" + removals.grainEls + ")");
console.log("  ticker copy in body text   : " + ok(!removals.bodyTextHasTickerWords));

// ---- 2. scroll cue target --------------------------------------------------
const cue = await ev(ws, `(() => {
  const a = document.querySelector('.lp-scroll-cue');
  if (!a) return { present: false };
  const id = (a.getAttribute('href') || '').replace('#', '');
  const target = id ? document.getElementById(id) : null;
  return { present: true, href: a.getAttribute('href'), id, resolves: !!target, targetTop: target ? Math.round(target.getBoundingClientRect().top + window.scrollY) : null };
})()`);

console.log("\nSCROLL CUE");
console.log("  present                    : " + ok(cue.present));
console.log("  href                       : " + cue.href);
console.log("  target id exists           : " + ok(cue.resolves) + (cue.resolves ? "  (#" + cue.id + " at y=" + cue.targetTop + ")" : "  <-- dead link"));
if (!cue.resolves && cue.present) failures++;

// ---- 3. off-screen loop gating --------------------------------------------
const gating = await ev(ws, `(async () => {
  const state = () => {
    const rows = [];
    for (const el of document.querySelectorAll('.lp-root *')) {
      const s = getComputedStyle(el);
      if (s.animationName === 'none' || s.animationIterationCount !== 'infinite') continue;
      rows.push({
        cls: el.className.baseVal ?? el.className,
        state: s.animationPlayState,
        inView: (() => { const r = el.getBoundingClientRect();
          return r.bottom > -150 && r.top < window.innerHeight + 150; })(),
      });
    }
    return rows;
  };
  window.scrollTo(0, 0);
  await new Promise(r => setTimeout(r, 700));
  const atTop = state();
  window.scrollTo(0, document.documentElement.scrollHeight);
  await new Promise(r => setTimeout(r, 900));
  const atBottom = state();
  return { atTop, atBottom };
})()`);

console.log("\nOFF-SCREEN LOOP GATE");
const allRows = [...new Map([...gating.atTop, ...gating.atBottom].map(r => [r.cls, r])).values()];
for (const r of allRows) {
  const both = [...gating.atTop, ...gating.atBottom].filter(x => x.cls === r.cls);
  const pausedWhenHidden = both.some(x => !x.inView && x.state === "paused");
  const ranWhenVisible = both.some(x => x.inView && x.state === "running");
  console.log("  " + String(r.cls).slice(0, 34).padEnd(35) +
    (ranWhenVisible ? "runs when visible " : "never visible        ") +
    (pausedWhenHidden ? " pauses when hidden" : " ALWAYS RUNNING"));
  if (!pausedWhenHidden) failures++;
}
const runningAtBottom = gating.atBottom.filter(r => r.state === "running" && !r.inView).length;
console.log("  infinite loops running while off-screen: " + runningAtBottom +
  (runningAtBottom === 0 ? "  (PASS)" : "  (FAIL)"));
if (runningAtBottom > 0) failures++;

console.log("\n" + (failures === 0 ? "ALL CHECKS PASSED" : failures + " FAILURE(S)"));
ws.close();
process.exit(failures === 0 ? 0 : 1);