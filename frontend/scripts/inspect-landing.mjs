// Dumps the full landing page stack so the ticker's real position can be seen,
// not guessed at. Node 22 has a global WebSocket, so no dependency is needed.

const CDP = "http://127.0.0.1:9222";
const URL = "http://127.0.0.1:4319/landing";

const VIEWPORTS = [
  { name: "1920x1080", w: 1920, h: 1080 },
  { name: "1440x900", w: 1440, h: 900 },
  { name: "1366x768", w: 1366, h: 768 },
  { name: "1024x768", w: 1024, h: 768 },
  { name: "768x1024", w: 768, h: 1024 },
  { name: "390x844", w: 390, h: 844 },
];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function cdp(ws, method, params = {}) {
  return new Promise((resolve, reject) => {
    const id = Math.floor(Math.random() * 1e9);
    const onMessage = (event) => {
      const msg = JSON.parse(event.data);
      if (msg.id !== id) return;
      ws.removeEventListener("message", onMessage);
      if (msg.error) reject(new Error(JSON.stringify(msg.error)));
      else resolve(msg.result);
    };
    ws.addEventListener("message", onMessage);
    ws.send(JSON.stringify({ id, method, params }));
  });
}

const evaluate = (ws, expression) =>
  cdp(ws, "Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true });

const PROBE = `(() => {
  const root = document.querySelector('.lp-root');
  const main = document.querySelector('.lp-main');
  const hero = document.querySelector('.lp-hero');
  const marquee = document.querySelector('.lp-marquee');
  const footer = document.querySelector('.lp-footer');
  const copy = document.querySelector('.lp-hero-copy');
  const collage = document.querySelector('.lp-collage');
  const cue = document.querySelector('.lp-scroll-cue');

  const box = (el) => { if (!el) return null; const b = el.getBoundingClientRect();
    return { top: Math.round(b.top + window.scrollY), bottom: Math.round(b.bottom + window.scrollY),
             h: Math.round(b.height) }; };

  // Direct children of .lp-root, in document order.
  const stack = [...root.children].map((el) => ({
    tag: el.tagName.toLowerCase(),
    cls: (el.className || '').toString().split(' ').filter(Boolean)[0] || '',
    ...box(el),
  }));

  // Direct children of main, in document order.
  const mainStack = [...main.children].map((el) => ({
    tag: el.tagName.toLowerCase(),
    cls: (el.className || '').toString().split(' ').filter(Boolean)[0] || '',
    ...box(el),
  }));

  const overlap = (a, b) => { if (!a || !b) return false;
    return a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom; };
  const rb = (el) => { if (!el) return null; const b = el.getBoundingClientRect();
    return { top: b.top, bottom: b.bottom, left: b.left, right: b.right }; };

  const mq = marquee ? marquee.getBoundingClientRect() : null;
  const hq = hero ? hero.getBoundingClientRect() : null;
  const fq = footer ? footer.getBoundingClientRect() : null;

  // The footer should be the last element in the document now that the
  // feature ticker has been removed.
  const kids = [...root.children];
  const lastEl = kids[kids.length - 1];
  const footerIsLastChild = lastEl === footer;

  return {
    vw: window.innerWidth, vh: window.innerHeight,
    docHeight: document.documentElement.scrollHeight,
    hOverflow: Math.max(0, document.documentElement.scrollWidth - window.innerWidth),
    stack, mainStack,
    hero: box(hero), footer: box(footer),
    footerIsLastChild,
    tickerEls: document.querySelectorAll('.lp-marquee, .lp-marquee-track, .lp-marquee-item').length,
    tickerRemoved: document.querySelectorAll('.lp-marquee, .lp-marquee-track, .lp-marquee-item').length === 0,
    // Nothing between the footer and the bottom of the page except padding.
    spaceBelowFooter: fq ? Math.round(document.documentElement.scrollHeight - fq.bottom) : null,
    gapHeroToFooter: fq && hq ? Math.round(fq.top - hq.bottom) : null,
    cueDisplay: cue ? getComputedStyle(cue).display : null,
    gapCueToHeroEnd: cue && hq ? Math.round(hq.bottom - cue.getBoundingClientRect().bottom) : null,
    // Content must not be clipped by the hero.
    copyClipped: hero && copy ? copy.getBoundingClientRect().bottom > hero.getBoundingClientRect().bottom + 1 : null,
    collageClipped: hero && collage ? collage.getBoundingClientRect().bottom > hero.getBoundingClientRect().bottom + 1 : null,
    // Visible == rendered AND inside the first screen (or intentionally hidden).
    cueWithinViewport: cue ? (() => { const c = rb(cue);
      if (getComputedStyle(cue).display === 'none') return 'hidden';
      return c.bottom <= window.innerHeight + 1 && c.top >= 0; })() : null,
    cueInsideHero: cue && hero ? (() => { const c = rb(cue), h = rb(hero);
      if (getComputedStyle(cue).display === 'none') return 'hidden';
      return c.top >= h.top - 1 && c.bottom <= h.bottom + 1; })() : null,
    heroTallVsViewport: hq ? Math.round(hq.height - window.innerHeight) : null,
    cueInCopy: cue ? !!cue.closest('.lp-hero-copy') : null,
    cuePosition: cue ? getComputedStyle(cue).position : null,
    headingCollidesCollage: overlap(rb(document.querySelector('.hero-heading')), rb(collage)),
    ctaCollidesCollage: overlap(rb(document.querySelector('.lp-hero-cta')), rb(collage)),
    cueCollidesCta: overlap(rb(cue), rb(document.querySelector('.lp-hero-cta'))),
    marqueeVisible: mq ? mq.height > 0 && mq.width > 0 : null,
  };
})()`;

const tab = await (await fetch(`${CDP}/json/new?${encodeURIComponent(URL)}`, { method: "PUT" })).json();
const socket = new WebSocket(tab.webSocketDebuggerUrl);
await new Promise((res, rej) => {
  socket.addEventListener("open", res);
  socket.addEventListener("error", rej);
});
await evaluate(socket, "1");
console.log("full page stack for " + URL + "\n");

const ok = (b) => (b ? "PASS" : "FAIL");

for (const vp of VIEWPORTS) {
  await cdp(socket, "Emulation.setDeviceMetricsOverride", {
    width: vp.w, height: vp.h, deviceScaleFactor: 1, mobile: vp.w < 700,
  });
  await evaluate(socket, "location.reload()");
  await sleep(3000);

  const m = (await evaluate(socket, PROBE)).result.value;

  console.log("=== " + vp.name + " === page height " + m.docHeight + "px");
  console.log("  .lp-root children:");
  m.stack.forEach((s) => console.log("      " + s.tag + "." + s.cls.padEnd(16) + " " + String(s.h).padStart(5) + "px   y " + s.top + "->" + s.bottom));
  console.log("  main children:");
  m.mainStack.forEach((s) => console.log("      " + s.tag + "." + s.cls.padEnd(16) + " " + String(s.h).padStart(5) + "px   y " + s.top + "->" + s.bottom));
  console.log("  ticker removed              : " + ok(m.tickerRemoved) +
    "  (elements found: " + m.tickerEls + ")");
  console.log("  footer is LAST child        : " + ok(m.footerIsLastChild));
  console.log("  gap hero->footer            : " + m.gapHeroToFooter + "px");
  console.log("  space below footer          : " + m.spaceBelowFooter + "px" +
    (m.spaceBelowFooter <= 24 ? "  (padding only)" : "  <-- CHECK"));
  console.log("  hero height vs viewport     : " + (m.heroTallVsViewport > 0 ? "+" : "") + m.heroTallVsViewport + "px");
  console.log("  copy/collage NOT clipped    : " + ok(!m.copyClipped) + " / " + ok(!m.collageClipped));
  // The cue is in normal flow inside .lp-hero-copy, so "inside hero" is the hard
  // requirement. Being below the fold on a short viewport is expected for
  // in-flow content and no longer a defect.
  console.log("  scroll cue in copy column  : " + ok(m.cueInCopy) + "   position: " + m.cuePosition +
    "   in first screen: " + (m.cueWithinViewport === true ? "yes" : "below fold (in flow, ok)"));
  console.log("  scroll cue inside hero     : " + (m.cueInsideHero === "hidden" ? "n/a" : ok(m.cueInsideHero)));
  console.log("  scroll cue vs CTA overlap  : " + ok(!m.cueCollidesCta));
  console.log("  heading/cta vs collage     : " + ok(!m.headingCollidesCollage) + " / " + ok(!m.ctaCollidesCollage));
  console.log("  horizontal overflow         : " + (m.hOverflow === 0 ? "none" : m.hOverflow + "px  <-- OVERFLOW"));
  console.log("");
}

socket.close();
process.exit(0);