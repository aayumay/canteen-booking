/**
 * Single source of truth for student navigation.
 *
 * The mobile bottom tab bar and the tablet/desktop left rail render from this
 * same list, so the two can never drift apart in order, label or icon. The
 * cart entry is a button (it opens a sheet/panel) rather than a route, which
 * is why `kind` is carried on each item.
 *
 * `owns` lists extra paths an item is responsible for beyond its own `to`, so
 * the active-state rules have their data here too rather than hardcoded in a
 * component. See ./activeNavKey.js for how it is used.
 */
import { resolveActiveNavKey } from "./activeNavKey.js";

export const STUDENT_NAV = [
  {
    key: "home",
    to: "/student",
    labelKey: "home",
    kind: "link",
    // Home owns the browse experience: the index route *and* the vendor
    // directory beneath it (/student/vendors/:vendorId renders the same menu
    // screen). It deliberately does not own the sibling sections, which is why
    // the resolver below exists at all — a plain prefix match on "/student"
    // would swallow /student/orders and /student/profile too.
    owns: ["/student/vendors"],
    icon: (
      <>
        <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
        <polyline points="9 22 9 12 15 12 15 22" />
      </>
    ),
  },
  {
    key: "orders",
    to: "/student/orders",
    labelKey: "orders",
    kind: "link",
    icon: (
      <>
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
        <polyline points="14 2 14 8 20 8" />
        <line x1="16" y1="13" x2="8" y2="13" />
        <line x1="16" y1="17" x2="8" y2="17" />
        <polyline points="10 9 9 9 8 9" />
      </>
    ),
  },
  {
    key: "cart",
    to: null,
    labelKey: "cart",
    kind: "action",
    icon: (
      <>
        <circle cx="9" cy="21" r="1" />
        <circle cx="20" cy="21" r="1" />
        <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6" />
      </>
    ),
  },
  {
    key: "profile",
    to: "/student/profile",
    labelKey: "profile",
    kind: "link",
    icon: (
      <>
        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
        <circle cx="12" cy="7" r="4" />
      </>
    ),
  },
];

/**
 * Resolve the active nav item for the given pathname, bound to STUDENT_NAV.
 * The match rules themselves live in ./activeNavKey.js so they stay free of JSX
 * and can be exercised on their own.
 */
export function resolveActiveNavKeyFor(pathname) {
  return resolveActiveNavKey(pathname, STUDENT_NAV);
}
