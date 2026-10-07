/**
 * Global connection state.
 *
 * `navigator.onLine` only reports whether the machine has a network interface.
 * It flips back to `true` the moment a Wi-Fi link associates — long before a
 * captive portal, VPN or tunnel has actually restored reachability. Trusting it
 * alone means the UI declares victory while every request still fails, and the
 * user is left staring at a "connected" screen full of stale numbers.
 *
 * So the browser's opinion is treated as one input and the only thing that
 * clears the offline latch is a request that actually came back from the API.
 * That also makes reconnect detection honest: the refetch we fire on reconnect
 * doubles as the probe, and the banner disappears when — and only when — data
 * really flows again.
 */

/** Consecutive network-level failures before we bother the user about it. */
export const FAILURE_THRESHOLD = 3;

const listeners = new Set();

let offlineLatch = false;
let consecutiveFailures = 0;
let lastFailureAt = null;
let reconnectCount = 0;
let windowListenersAttached = false;

function browserReportsOffline() {
  return typeof navigator !== "undefined" && navigator.onLine === false;
}

function snapshot() {
  return {
    isOffline: offlineLatch,
    /**
     * Requests are failing but we are still under the threshold. Consumers stay
     * quiet — a single dropped packet is not something to announce.
     */
    isFlapping: !offlineLatch && consecutiveFailures > 0,
    consecutiveFailures,
    lastFailureAt,
    reconnectCount,
  };
}

function notify() {
  const state = snapshot();
  // Copy first: a listener may unsubscribe during dispatch.
  Array.from(listeners).forEach((fn) => fn(state));
}

function attachWindowListeners() {
  if (windowListenersAttached || typeof window === "undefined") return;
  windowListenersAttached = true;
  window.addEventListener("offline", () => {
    offlineLatch = true;
    notify();
  });
  // Deliberately does NOT clear the latch. The interface is back, but the
  // network may not be. `recordSuccess()` clears it once a request lands.
  window.addEventListener("online", notify);
}

function subscribe(fn) {
  attachWindowListeners();
  listeners.add(fn);
  fn(snapshot());
  return () => listeners.delete(fn);
}

function getState() {
  return snapshot();
}

/** Latch on. Idempotent, so repeated failures don't spam subscribers. */
function markOffline() {
  if (offlineLatch) return;
  offlineLatch = true;
  notify();
}

function markFailure() {
  const wasFlapping = consecutiveFailures > 0;
  consecutiveFailures += 1;
  lastFailureAt = Date.now();
  if (consecutiveFailures >= FAILURE_THRESHOLD) {
    markOffline();
  } else if (!wasFlapping) {
    // Notify only on the 0 -> 1 crossing. Every failed poll otherwise re-rendered
    // the whole provider subtree to flip a flag nothing is currently showing.
    notify();
  }
}

/**
 * A response — any response, including 4xx — proves the API is reachable, so it
 * clears the latch. A 422 means the server answered; the connection is healthy
 * even though the request was wrong.
 */
function markSuccess() {
  // Read the pre-reset state: these are what decide whether anyone needs telling.
  const wasOffline = offlineLatch;
  const hadFailures = consecutiveFailures > 0;

  consecutiveFailures = 0;
  lastFailureAt = null;
  offlineLatch = false;

  if (wasOffline) {
    reconnectCount += 1;
  }
  if (wasOffline || hadFailures) {
    notify();
  }
}

/**
 * Classify an axios rejection. Only transport-level failures (no response at
 * all: DNS, dropped socket, CORS, timeout) count against connectivity — a 500
 * proves the server is very much online.
 */
function markRequestResult(error) {
  if (error?.response) {
    markSuccess();
  } else {
    markFailure();
  }
}

/** Seed from the browser on boot so a page load while offline is honest. */
if (browserReportsOffline()) {
  offlineLatch = true;
}

export const connectionStatus = {
  subscribe,
  getState,
  markOffline,
  markFailure,
  markSuccess,
  markRequestResult,
  FAILURE_THRESHOLD,
};
