/**
 * Active-nav-item resolution.
 *
 * Deliberately a plain .js module with no JSX and no React imports: it is pure
 * logic, and keeping it free of the icon JSX means the match rules can be
 * exercised directly against a list of route paths.
 *
 * Why this exists at all: every student route is nested under "/student", so
 * the nav items are *siblings*, not parent/child. That is precisely the case
 * React Router's `NavLink` prefix matching gets wrong — with no `end` prop, the
 * Home item ("/student") also prefix-matches "/student/orders" and
 * "/student/profile", so two items light up at the same time.
 *
 * The fix is to stop asking every item an independent yes/no question and
 * instead pick the single most specific owner of the current path. One path in,
 * one key out, so two highlights are impossible by construction.
 */

/** Shown when a path belongs to no nav item, so a screen in the student area
 *  never renders a nav with nothing highlighted. */
const FALLBACK_NAV_KEY = "home";

/** Strip a trailing slash so "/student/" and "/student" are one route. */
function normalise(path) {
  if (!path) return "";
  return path.length > 1 ? path.replace(/\/+$/, "") : path;
}

/** True when `path` is one of the item's routes, or nested beneath one. */
function itemOwnsPath(item, path) {
  return [item.to, ...(item.owns ?? [])]
    .map(normalise)
    .filter(Boolean)
    .some((route) => path === route || path.startsWith(`${route}/`));
}

/**
 * @param {string} pathname current location, e.g. "/student/orders"
 * @param {Array<{key: string, to: string|null, kind: string, owns?: string[]}>} navItems
 * @returns {string|null} the single winning nav key, or null when `navItems` is empty
 */
export function resolveActiveNavKey(pathname, navItems) {
  const path = normalise(pathname) || "/";
  const links = (navItems ?? []).filter((item) => item.kind === "link" && item.to);
  if (links.length === 0) return null;

  const best = links.reduce((winner, item) => {
    if (!itemOwnsPath(item, path)) return winner;
    if (!winner) return item;
    // "/student/orders" beats "/student" as the more specific route. Without
    // this comparison, both would be active on a nested page.
    return item.to.length > winner.to.length ? item : winner;
  }, null);

  if (best) return best.key;

  // Screens reachable from the profile page but with no tab of their own
  // (wallet, meal plans, schedule, leaderboard) fall back to Home rather than
  // leaving the whole nav unhighlighted.
  return links.some((item) => item.key === FALLBACK_NAV_KEY)
    ? FALLBACK_NAV_KEY
    : links[0].key;
}
