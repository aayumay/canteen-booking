// Interaction + a11y probe: drives the new controls the way a person would and
// checks the state they leave behind, rather than trusting the markup.
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

const ok = (b) => (b ? "PASS" : "FAIL  <-- PROBLEM");
const fails = [];
const check = (label, cond, extra = "") => {
  if (!cond) fails.push(label);
  console.log("  " + ok(cond) + "  " + label + (extra ? "   " + extra : ""));
};

await cdp(ws, "Emulation.setDeviceMetricsOverride", { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });
await ev(ws, "location.reload()");
await sleep(3500);

/* ---------------- slot picker removed ---------------- */
console.log("SLOT PICKER (removed)");
const pickerGone = await ev(ws, `(() => ({
  slots: document.querySelectorAll(".lp-slot").length,
  group: document.querySelectorAll(".lp-slots-group, .lp-slots-wrap, .lp-slots").length,
  readout: document.querySelectorAll(".lp-slots-readout").length,
  label: document.querySelectorAll(".lp-slots-label").length,
  copy: /Try it/i.test(document.querySelector(".lp-hero-copy")?.innerText || ""),
}))()`);
check("no slot chips", pickerGone.slots === 0, "found " + pickerGone.slots);
check("no picker wrapper", pickerGone.group === 0, "found " + pickerGone.group);
check("no readout", pickerGone.readout === 0, "found " + pickerGone.readout);
check("no picker label", pickerGone.label === 0, "found " + pickerGone.label);
check('no "Try it" copy in hero', !pickerGone.copy);

/* ---------------- FAQ accordion ---------------- */
console.log("\nFAQ ACCORDION");
const faq0 = await ev(ws, `(() => {
  const items = [...document.querySelectorAll('.lp-faq-item')];
  const btns = [...document.querySelectorAll('.lp-faq-q')];
  return {
    items: items.length,
    firstOpenByDefault: items[0].classList.contains('is-open'),
    panelsOpen: document.querySelectorAll('.lp-faq-a').length,
    expanded: btns.map((b) => b.getAttribute('aria-expanded')),
    panelRole: document.querySelector('.lp-faq-a')?.getAttribute('role'),
    panelLabelled: !!document.querySelector('.lp-faq-a')?.getAttribute('aria-labelledby'),
    panelsInDom: document.querySelectorAll('.lp-faq-a').length,
    closedHidden: [...document.querySelectorAll('.lp-faq-a')].filter((p) => p.getAttribute('aria-hidden') === 'true').length,
    danglingControls: btns.filter((b) => !document.getElementById(b.getAttribute('aria-controls'))).length,
  };
})()`);
check("5 FAQ items", faq0.items === 5, "items=" + faq0.items);
check("first item open by default", faq0.firstOpenByDefault);
check("all 5 panels stay mounted (aria-controls resolves)", faq0.panelsInDom === 5, "panels=" + faq0.panelsInDom);
check("4 collapsed panels marked aria-hidden", faq0.closedHidden === 4, "hidden=" + faq0.closedHidden);
check("aria-expanded matches", faq0.expanded[0] === "true" && faq0.expanded.filter((e) => e === "true").length === 1);
check("panel is a labelled region", faq0.panelRole === "region" && faq0.panelLabelled);
check("no dangling aria-controls targets", faq0.danglingControls === 0,
  faq0.danglingControls + " broken");

const faqToggle = await ev(ws, `(async () => {
  const btns = [...document.querySelectorAll('.lp-faq-q')];
  const itemH = () => document.querySelector('.lp-faq-item').getBoundingClientRect().height;
  const startH = itemH();
  btns[0].click();
  await new Promise((r) => setTimeout(r, 120));
  const midH = itemH();
  await new Promise((r) => setTimeout(r, 600));
  const endH = itemH();
  return {
    startH: Math.round(startH), midH: Math.round(midH), endH: Math.round(endH),
    animating: Math.abs(midH - startH) > 2 && Math.abs(endH - midH) > 2,
    closed: !document.querySelector('.lp-faq-item').classList.contains('is-open'),
    expandedNow: btns[0].getAttribute('aria-expanded'),
  };
})()`);
check("closing animates height (not a snap)", faqToggle.animating,
  `${faqToggle.startH} -> ${faqToggle.midH} -> ${faqToggle.endH}`);
check("aria-expanded flips to false", faqToggle.expandedNow === "false");

/* ---------------- bento spotlight ---------------- */
console.log("\nBENTO SPOTLIGHT");
const bento = await ev(ws, `(() => {
  const card = document.querySelector('.lp-bento-card');
  const r = card.getBoundingClientRect();
  card.dispatchEvent(new PointerEvent('pointermove', {
    clientX: r.left + 40, clientY: r.top + 30, bubbles: true,
  }));
  const spot = card.querySelector('.lp-bento-spot');
  return {
    cards: document.querySelectorAll('.lp-bento-card').length,
    hasSpot: !!spot,
    spotX: card.style.getPropertyValue('--lp-spot-x'),
    spotY: card.style.getPropertyValue('--lp-spot-y'),
    spotZ: spot ? getComputedStyle(spot).zIndex : null,
    isolate: getComputedStyle(card).isolation,
  };
})()`);
check("6 bento cards", bento.cards === 6);
check("spotlight layer present", bento.hasSpot);
check("pointer tracked into CSS vars", !!bento.spotX && !!bento.spotY, `x=${bento.spotX} y=${bento.spotY}`);
check("spotlight sits behind content", bento.spotZ === "-1" && bento.isolate === "isolate");

/* ---------------- removed decorative layers ---------------- */
console.log("\nREMOVED DECORATIVE LAYERS");
const removed = await ev(ws, `(() => ({
  grain: document.querySelectorAll('.lp-grain').length,
  marquee: document.querySelectorAll('.lp-marquee, .lp-marquee-track, .lp-marquee-item').length,
}))()`);
check("grain layer gone", removed.grain === 0, "found " + removed.grain);
check("ticker gone", removed.marquee === 0, "found " + removed.marquee);

console.log("\n" + (fails.length ? "FAILURES: " + fails.length + "\n  - " + fails.join("\n  - ") : "ALL INTERACTION + A11Y CHECKS PASSED"));
ws.close();
process.exit(0);
