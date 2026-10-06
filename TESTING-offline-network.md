# Offline / Throttled Network Test — Canteen Booking

**Status: NOT YET RUN.** This is the procedure to execute; it has not been
performed, because no browser or device automation is available in the
environment where this code was written. Everything below is what to check and
what "passing" looks like — record actual results, don't assume them.

Automated coverage that *has* run: `75 passed` (pytest) and a green production
`vite build`. Neither of those exercises a real network transition, which is
exactly what this script is for.

## Setup

```bash
# terminal 1 — API
.\venv\Scripts\python.exe -m uvicorn app.main:app --reload --port 8000

# terminal 2 — frontend
cd frontend
npm run dev
```

Sign in as a **vendor** and open the vendor dashboard (it polls every 4s and
exercises the most code). Keep DevTools open on the **Network** tab.

---

## Test 1 — Single dropped poll must stay silent

1. Stay online. Note the order board.
2. DevTools → Network → throttling → **Custom** → add a profile with
   `latency: 2000ms` (slow enough that a 4s poll overlaps, fast enough that
   requests still complete).
3. Wait ~30s.

**Pass:** no banner, no error panel, no stale strip. The board keeps updating,
just a little behind. One slow request is not an outage.

---

## Test 2 — Sustained failure raises the banner after 3 failures

1. Throttling → **Offline**.
2. Wait ~15s (three 4s polls).

**Pass, in this order:**
- Nothing appears for the first two failures.
- On the third, a dark-green bar slides in at the very top reading
  *"You're offline — showing the last known data…"* with a **Refresh now**
  button.
- The app bar sits **below** the bar, not under it.
- The last-known order board is still readable — not replaced by an error page.
- The browser tab title reads `Offline — Canteen Booking`.
- Polling continues (visible as repeated failed requests in the Network tab);
  it must not stop after the first error.

---

## Test 3 — Reconnect refetches immediately

With the banner showing:

1. Set throttling back to **No throttling**.

**Pass:** within about one poll interval the banner disappears on its own, the
tab title reverts, and the order board shows current data. No manual reload, no
"Refresh now" click needed.

---

## Test 4 — Reconnect must not wait for a poll

The critical honesty check, because it is the whole reason the banner waits for
a *successful request* instead of trusting `navigator.onLine`:

1. Go **Offline** and wait for the banner.
2. In DevTools, go offline **and** leave the tab idle until several polls have
   failed. (This is the captive-portal / flaky-tunnel case.)
3. Restore the network.

**Pass:** the banner stays up until a request genuinely succeeds, then clears.
It must **not** vanish the instant the interface comes back. Watch the Network
tab: the banner should clear on the first *successful* response, not on the
`online` event.

---

## Test 5 — Manual "Refresh now"

1. Go offline, wait for the banner.
2. Restore the network but **stay offline in DevTools' "Offline" toggle for
   the API host only** — easier alternative: keep throttling at
   `Very slow (offline-ish)` long enough that a manual refresh fails.
3. Click **Refresh now**.

**Pass:** the button shows a busy label and does not throw; the banner stays
(because nothing succeeded). No crash, no unhandled rejection in the console.

---

## Test 6 — Polling views show stale data, not error screens

Check each screen while offline **after it has already loaded once**:

| Screen | Expected |
|---|---|
| Vendor dashboard | Inline *"Live board may be out of date"* strip; board still visible |
| Student menu | *"Menu may be out of date"* strip; menu still visible |
| Student wallet | *"Balance may be out of date"* strip; **balance still shown** |
| Admin dashboard | *"Dashboard figures may be out of date"* strip |
| Vendor scan | *"Ready list may be out of date"* strip above the list |
| Student order (live) | *"Order status may be out of date — last checked HH:MM"* after 3 failed polls |

**Pass:** stale data stays on screen with a quiet inline marker. No screen is
replaced by a full-page error.

---

## Test 7 — First load while offline must NOT lie

1. Open a **new tab** to a protected route (e.g. `/student/wallet`) while
   offline.

**Pass:** a real error state with a **Try again** button — explicitly *not* a
`₹0.00` balance. (A failed wallet load previously rendered a confident zero,
which is indistinguishable from an empty wallet.) The top banner shows too.

---

## Test 8 — Session survives a network blip

1. Sign in. Note the URL (`/student/...`).
2. Go offline for ~20s.
3. Restore the network.

**Pass:** you are **not** bounced to `/login?expired=1`, and there is no
endless *"Restoring session"* spinner. Either you stay signed in, or you get a
retryable *"Couldn't verify your session"* card — never a silent logout.

---

## Test 9 — Reduced motion

1. OS Settings → Accessibility → Visual Effects → Reduce Motion (Windows:
   Settings → Accessibility → Visual effects → Animation effects **off**).
   Or in DevTools: `⋮` → More tools → Rendering → **Emulate CSS media feature
   prefers-reduced-motion**.

**Pass:**
- Landing reveals appear without the rise/fade travel.
- No card/list entrance animation anywhere (menu items, order tickets, wallet).
- Pressing a button still gives feedback, but no large scale jump.
- **Completing a checkout shows no confetti burst** (it is canvas-based and
  outside the CSS reduced-motion net — it is guarded in JS).
- The mascot in an empty state does not pulse/bounce.

---

## Test 10 — Empty states with no data

1. Stop the API, or use an account with no orders/announcements.
2. Visit: student menu with zero vendors, wallet with no transactions, admin
   dashboard with no vendors / no pending applications / no matching orders,
   notifications with nothing pending, an empty checkout tray.

**Pass:**
- Each shows the mascot empty state (or the compact, no-mascot variant on dense
  admin tables) with specific copy and a dashed container.
- The student menu with **zero vendors** says *"No stalls open yet"* and shows
  **no invented stalls**. (It previously rendered five fake kitchens —
  "Fish & Wine", "Sea Food Bistro" — as if they were real and openable.)
- The item-detail sheet shows **no** "Ingredients" heading when there are no
  ingredients. (It previously rendered a permanent empty heading on every dish,
  because the API has no `ingredients` field.)

---

## Console cleanliness

Throughout, DevTools Console must show **no** unhandled promise rejections and
no React key/`undefined` component warnings. A `ERR_NETWORK` message logged by
the browser is expected while offline; an uncaught exception is not.

## Recording results

Fill this in honestly — unrun is a valid answer, a guessed pass is not.

| # | Test | Result | Notes |
|---|---|---|---|
| 1 | Single blip silent | ☐ | |
| 2 | Banner after 3 failures | ☐ | |
| 3 | Reconnect auto-refetch | ☐ | |
| 4 | Banner waits for real success | ☐ | |
| 5 | Manual refresh safe | ☐ | |
| 6 | Stale strips, not error screens | ☐ | |
| 7 | Offline first load doesn't lie | ☐ | |
| 8 | Session survives blip | ☐ | |
| 9 | Reduced motion | ☐ | |
| 10 | Empty states | ☐ | |
