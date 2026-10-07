/**
 * Pickup-verification feedback.
 *
 * The shared `lib/sounds.js` helpers are intentionally silent (a user
 * preference), so the scanner carries its own opt-in chime rather than
 * re-enabling audio app-wide. Tones are synthesised with WebAudio so there are
 * no audio assets to ship, and the mute choice is remembered per device.
 */

const STORAGE_KEY = "prebook.pickup.sound.muted";

let audioCtx = null;

function readMuted() {
  try {
    return localStorage.getItem(STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

export function isPickupMuted() {
  return readMuted();
}

export function setPickupMuted(muted) {
  try {
    localStorage.setItem(STORAGE_KEY, muted ? "1" : "0");
  } catch {
    /* private mode — keep the in-memory choice for this session */
  }
}

/** Short two-note chime on a successful handover. */
export function playPickupChime() {
  if (readMuted()) return;
  try {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return;
    audioCtx = audioCtx || new Ctx();
    if (audioCtx.state === "suspended") audioCtx.resume();

    const now = audioCtx.currentTime;
    [880, 1320].forEach((freq, i) => {
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = "sine";
      osc.frequency.value = freq;
      const start = now + i * 0.12;
      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.exponentialRampToValueAtTime(0.18, start + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.18);
      osc.connect(gain).connect(audioCtx.destination);
      osc.start(start);
      osc.stop(start + 0.2);
    });
  } catch {
    /* audio is a nicety, never a failure path */
  }
}

/** Short buzz on a rejected scan. */
export function playPickupError() {
  if (readMuted()) return;
  try {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return;
    audioCtx = audioCtx || new Ctx();
    if (audioCtx.state === "suspended") audioCtx.resume();

    const now = audioCtx.currentTime;
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = "square";
    osc.frequency.value = 220;
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.12, now + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.22);
    osc.connect(gain).connect(audioCtx.destination);
    osc.start(now);
    osc.stop(now + 0.24);
  } catch {
    /* ignore */
  }
}

/** Haptic pulse; silently skipped on iOS and desktop browsers. */
export function vibratePickup(pattern = [18, 40, 18]) {
  if (readMuted()) return;
  try {
    navigator.vibrate?.(pattern);
  } catch {
    /* ignore */
  }
}
