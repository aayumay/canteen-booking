// Measures real scroll cost: frame intervals during a scripted scroll, plus
// long frames. Then A/B tests suspects by disabling them at runtime so the
// expensive layer is identified by measurement, not by guessing.
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

// Scrolls the page in steps while sampling rAF intervals.
const SCROLL_RUN = `(async () => {
  window.scrollTo(0, 0);
  await new Promise(r => setTimeout(r, 400));
  const frames = [];
  let last = performance.now();
  let running = true;
  const tick = (t) => { frames.push(t - last); last = t; if (running) requestAnimationFrame(tick); };
  requestAnimationFrame(tick);
  const start = performance.now();
  const max = document.documentElement.scrollHeight - window.innerHeight;
  for (let i = 0; i <= 90; i++) {
    window.scrollTo(0, Math.round((max * i) / 90));
    await new Promise(r => requestAnimationFrame(r));
  }
  running = false;
  const elapsed = performance.now() - start;
  frames.shift();
  const sorted = [...frames].sort((a, b) => a - b);
  const sum = frames.reduce((a, b) => a + b, 0);
  return {
    frames: frames.length,
    avg: +(sum / frames.length).toFixed(2),
    median: +sorted[Math.floor(sorted.length / 2)].toFixed(2),
    p95: +sorted[Math.floor(sorted.length * 0.95)].toFixed(2),
    worst: +sorted[sorted.length - 1].toFixed(2),
    longFrames: frames.filter((f) => f > 32).length,
    veryLong: frames.filter((f) => f > 50).length,
    elapsed: Math.round(elapsed),
  };
})()`;

async function run(label, setup) {
  await ev(ws, "location.reload()");
  await sleep(3200);
  if (setup) await ev(ws, setup);
  await sleep(600);

  // Frame intervals alone saturate at the vsync interval and hide real cost.
  // Main-thread work deltas do not, so measure those: how much script, style
  // recalc and layout the scroll actually burns.
  await cdp(ws, "Performance.enable");
  const read = async () => {
    const { metrics } = await cdp(ws, "Performance.getMetrics");
    const g = (n) => metrics.find((m) => m.name === n)?.value ?? 0;
    return { script: g("ScriptDuration"), style: g("RecalcStyleDuration"), layout: g("LayoutDuration"), tasks: g("TaskDuration") };
  };

  const a = await read();
  await ev(ws, SCROLL_RUN);
  const b = await read();

  const d = (k) => +(b[k] - a[k]).toFixed(3);
  const script = d("script"), style = d("style"), layout = d("layout"), tasks = d("tasks");
  const total = +(script + style + layout).toFixed(3);

  console.log(
    "  " + label.padEnd(32) +
    "main-thread " + String(total.toFixed(3)).padStart(7) + "s   " +
    "(script " + String(script.toFixed(3)).padStart(6) +
    " style " + String(style.toFixed(3)).padStart(6) +
    " layout " + String(layout.toFixed(3)).padStart(6) + ")"
  );
  return { script, style, layout, total, tasks };
}

console.log("SCROLL COST @1440x900 - main-thread seconds burned over one full-page scroll\n");
const base = await run("as shipped", null);
const noGrain = await run("grain removed", `(() => { document.querySelector('.lp-grain')?.remove(); })()`);
const noMarquee = await run("marquee removed", `(() => { document.querySelector('.lp-marquee')?.remove(); })()`);
const neither = await run("grain + marquee removed", `(() => {
  document.querySelector('.lp-grain')?.remove();
  document.querySelector('.lp-marquee')?.remove();
})()`);
const bare = await run("grain+marquee+drift removed", `(() => {
  document.querySelector('.lp-grain')?.remove();
  document.querySelector('.lp-marquee')?.remove();
  document.querySelectorAll('.lp-drift').forEach(d => d.remove());
})()`);

console.log("\nWHERE THE TIME GOES");
console.log("  grain layer      : " + (base.total - noGrain.total).toFixed(3) + "s");
console.log("  marquee track    : " + (base.total - noMarquee.total).toFixed(3) + "s");
console.log("  grain + marquee  : " + (base.total - neither.total).toFixed(3) + "s");
console.log("  drift orbs       : " + (neither.total - bare.total).toFixed(3) + "s");
console.log("  irreducible rest : " + bare.total.toFixed(3) + "s  (page content + scroll-linked anims)");

ws.close();
process.exit(0);