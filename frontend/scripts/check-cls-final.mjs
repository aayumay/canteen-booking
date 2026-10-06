// Both earlier CLS probes disagreed (0.014 vs 0.1021) because they installed the
// observer after load and raced the async below-fold chunk. CDP can inject the
// observer before any page script runs, which removes the race entirely and
// makes the number deterministic.
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

// Runs before the app boots, so every shift is caught from first paint.
const INIT = `
  window.__cls = 0;
  window.__byNode = {};
  window.__entries = [];
  (function () {
    var R = function (r) {
      if (!r) return null;
      return { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) };
    };
    var po = new PerformanceObserver(function (list) {
      for (var e of list.getEntries()) {
        if (e.hadRecentInput) continue;
        window.__cls += e.value;
        (e.sources || []).forEach(function (s) {
          var n = s.node;
          var key;
          if (!n) key = "detached";
          else {
            var cls = (n.className && (n.className.baseVal !== undefined ? n.className.baseVal : n.className)) || "";
            key = (n.tagName || "?").toLowerCase() +
              (cls ? "." + String(cls).split(" ").filter(Boolean).slice(0, 2).join(".") : "");
          }
          window.__byNode[key] = (window.__byNode[key] || 0) + e.value;
        });
        if (window.__entries.length < 12) {
          window.__entries.push({
            value: +e.value.toFixed(4),
            at: Math.round(e.startTime),
            srcs: (e.sources || []).map(function (s) {
              var n = s.node;
              var key = "detached";
              if (n) {
                var cls = (n.className && (n.className.baseVal !== undefined ? n.className.baseVal : n.className)) || "";
                key = (n.tagName || "?").toLowerCase() +
                  (cls ? "." + String(cls).split(" ").filter(Boolean).slice(0, 2).join(".") : "");
              }
              return { node: key, before: R(s.previousRect), after: R(s.currentRect) };
            }),
          });
        }
      }
    });
    po.observe({ type: "layout-shift", buffered: true });
    window.__po = po;
  })();
`;

async function measure(label, extra, throttle, clearCache = true) {
  const tab = await (await fetch(`${CDP}/json/new?${encodeURIComponent(URL)}`, { method: "PUT" })).json();
  const ws = new WebSocket(tab.webSocketDebuggerUrl);
  await new Promise((r, j) => { ws.addEventListener("open", r); ws.addEventListener("error", j); });
  await ev(ws, "1");
  await cdp(ws, "Emulation.setDeviceMetricsOverride", { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });
  await cdp(ws, "Network.enable");
  if (clearCache) await cdp(ws, "Network.clearBrowserCache");
  if (throttle) {
    // Slow-link profile: the real-world case where an async chunk lands late.
    await cdp(ws, "Network.emulateNetworkConditions", {
      offline: false, latency: 150,
      downloadThroughput: 1.6 * 1024 * 1024 / 8,
      uploadThroughput: 750 * 1024 / 8,
    });
  }
  await cdp(ws, "Page.enable");
  await cdp(ws, "Page.addScriptToEvaluateOnNewDocument", { source: INIT });
  if (extra) await cdp(ws, "Page.addScriptToEvaluateOnNewDocument", { source: extra });
  await ev(ws, "location.reload()");
  await sleep(throttle ? 9000 : 5000);
  await ev(ws, `(async () => {
    const max = document.documentElement.scrollHeight - window.innerHeight;
    for (let i = 0; i <= 90; i++) {
      window.scrollTo(0, Math.round((max * i) / 90));
      await new Promise(r => requestAnimationFrame(r));
    }
    await new Promise(r => setTimeout(r, 500));
    return true;
  })()`);
  const cls = await ev(ws, "window.__cls");
  const byNode = await ev(ws, "window.__byNode");
  const entries = await ev(ws, "window.__entries");
  console.log("  " + label.padEnd(34) + "CLS " + cls.toFixed(4) +
    "   " + (cls < 0.1 ? "(good)" : cls < 0.25 ? "(needs work)" : "(bad)"));
  ws.close();
  return { cls, byNode, entries };
}

console.log("CLS, observer injected before app boot (deterministic)\n");
const normal = await measure("fast connection", null, false);
const slow = await measure("throttled, COLD cache", null, true, true);
// Same throttle, but fonts already cached: no swap, so any drop in CLS proves
// the shift is font-driven reflow rather than chunk arrival.
const slowWarm = await measure("throttled, WARM cache", null, true, false);

console.log("\nSHIFT DETAIL (THROTTLED run - the one that matters)");
for (const e of (slow.entries || []).slice(0, 6)) {
  console.log("  t=" + String(e.at).padStart(6) + "ms  value=" + e.value);
  for (const s of e.srcs) {
    const b = s.before || {};
    const a = s.after || {};
    console.log("      " + s.node.slice(0, 40).padEnd(41) +
      "before y=" + String(b.y).padStart(6) + " h=" + String(b.h).padStart(5) +
      "   ->   after y=" + String(a.y).padStart(6) + " h=" + String(a.h).padStart(5) +
      (b.y !== a.y ? "   MOVED " + (a.y - b.y) + "px" : "") +
      (b.h !== a.h ? "   RESIZED " + (a.h - b.h) + "px" : ""));
  }
}

console.log("\nATTRIBUTION (throttled)");
const ranked = Object.entries(slow.byNode).sort((a, b) => b[1] - a[1]);
for (const [node, v] of ranked.slice(0, 8)) console.log("  " + node.slice(0, 44).padEnd(45) + v.toFixed(4));

console.log("\nVERDICT");
console.log("  fast, cold cache        : " + normal.cls.toFixed(4));
console.log("  throttled, COLD cache   : " + slow.cls.toFixed(4));
console.log("  throttled, WARM cache   : " + slowWarm.cls.toFixed(4));
const drop = slow.cls - slowWarm.cls;
console.log("  warm cache removes      : " + drop.toFixed(4) + " of CLS" +
  (drop > slow.cls * 0.6 ? "  <- font swap was the cause" : "  <- NOT primarily fonts"));
console.log("\nSHIFT DETAIL (throttled, WARM cache)");
for (const e of (slowWarm.entries || []).slice(0, 4)) {
  console.log("  t=" + String(e.at).padStart(6) + "ms  value=" + e.value);
  for (const s of e.srcs) {
    const b = s.before || {};
    const a = s.after || {};
    console.log("      " + s.node.slice(0, 40).padEnd(41) +
      "before h=" + String(b.h).padStart(5) + "   ->   after h=" + String(a.h).padStart(5) +
      (b.y !== a.y ? "   MOVED " + (a.y - b.y) + "px" : "") +
      (b.h !== a.h ? "   RESIZED " + (a.h - b.h) + "px" : ""));
  }
}
process.exit(0);