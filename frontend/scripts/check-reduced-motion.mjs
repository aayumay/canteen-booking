// Confirms prefers-reduced-motion actually disables the new ambient loops and
// that nothing collapses or disappears as a result. Reduced-motion is a real
// accessibility contract, not a nice-to-have.
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

const fails = [];
const check = (label, cond, extra = "") => {
  if (!cond) fails.push(label);
  console.log("  " + (cond ? "PASS" : "FAIL  <-- PROBLEM") + "  " + label + (extra ? "   " + extra : ""));
};

const PROBE = `(() => {
  const anim = (sel) => {
    const el = document.querySelector(sel);
    return el ? getComputedStyle(el).animationName : 'MISSING';
  };
  const drift = [...document.querySelectorAll('.lp-drift')].map((d) => getComputedStyle(d).animationName);
  const reveals = [...document.querySelectorAll('.lp-reveal')];
  const hiddenReveals = reveals.filter((r) => getComputedStyle(r).opacity === '0').length;
  const faqPanel = document.querySelector('.lp-faq-a');
  return {
    drift,
    eyebrowDot: anim('.lp-eyebrow-dot'),
    collageFloats: ['.lp-collage-float-a', '.lp-collage-float-b', '.lp-collage-float-c'].map(anim),
    badgeSpin: anim('.lp-badge-svg'),
    ctaDoodles: [1,2,3].map((n) => anim('.lp-cta-doodle-' + n)),
    scrollCue: anim('.lp-scroll-cue-line'),
    revealCount: reveals.length,
    revealsStillHidden: hiddenReveals,
bentoCards: document.querySelectorAll('.lp-bento-card').length,
    faqOpenHeight: faqPanel ? Math.round(faqPanel.getBoundingClientRect().height) : null,
    collageVisible: (() => { const c = document.querySelector('.lp-collage');
      const b = c.getBoundingClientRect(); return b.width > 100 && b.height > 100; })(),
    footerHeight: Math.round((document.querySelector('.lp-footer') || document.body).getBoundingClientRect().height),
  };
})()`;

for (const reduced of [false, true]) {
  await cdp(ws, "Emulation.setDeviceMetricsOverride", { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });
  await cdp(ws, "Emulation.setEmulatedMedia", {
    features: [{ name: "prefers-reduced-motion", value: reduced ? "reduce" : "no-preference" }],
  });
  await ev(ws, "location.reload()");
  await sleep(3500);

  const m = await ev(ws, PROBE);
  console.log(`\nprefers-reduced-motion: ${reduced ? "REDUCE" : "no-preference"}`);

  if (reduced) {
    check("ambient drift orbs stopped", m.drift.every((a) => a === "none"), m.drift.join(","));
    check("eyebrow pulse stopped", m.eyebrowDot === "none", m.eyebrowDot);
    check("collage float loops stopped", m.collageFloats.every((a) => a === "none"), m.collageFloats.join(","));
    check("badge spin stopped", m.badgeSpin === "none", m.badgeSpin);
    check("CTA doodle loops stopped", m.ctaDoodles.every((a) => a === "none"), m.ctaDoodles.join(","));
    check("scroll cue animation stopped", m.scrollCue === "none", m.scrollCue);
    check("no content left invisible by reveals", m.revealsStillHidden === 0,
      `${m.revealsStillHidden}/${m.revealCount} still at opacity 0`);
    check("FAQ panel still open", m.faqOpenHeight > 40, "h=" + m.faqOpenHeight);
    check("bento cards intact", m.bentoCards === 6);
    check("collage intact", m.collageVisible);
    check("footer still rendered", m.footerHeight > 100, "h=" + m.footerHeight);
  } else {
    check("ambient drift orbs running", m.drift.every((a) => a !== "none"), m.drift.join(","));
    check("collage float loops running", m.collageFloats.every((a) => a !== "none"), m.collageFloats.join(","));
    check("CTA doodle loops running", m.ctaDoodles.every((a) => a !== "none"), m.ctaDoodles.join(","));
    check("layout identical either way", m.bentoCards === 6 && m.footerHeight > 100);
  }
}

console.log("\n" + (fails.length ? "FAILURES: " + fails.length + "\n  - " + fails.join("\n  - ") : "REDUCED-MOTION CONTRACT HELD"));
ws.close();
process.exit(0);
