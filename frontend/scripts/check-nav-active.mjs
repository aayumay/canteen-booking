// Verification harness (throwaway, not part of the app).
// Runs the real resolver from the source file against every student route
// declared in App.jsx, and asserts the VERIFY checklist: exactly one active
// item per route, never zero, never more than one.
import { readFileSync } from "node:fs";
import { resolveActiveNavKey } from "../src/components/student/activeNavKey.js";

const app = readFileSync(new URL("../src/App.jsx", import.meta.url), "utf8");

// Pull the student route paths straight out of the router so this list cannot
// drift from the real app. Bound the slice to the student block: the vendor
// and admin sections live further down the same file.
const studentStart = app.indexOf('role="student"');
const studentEnd = app.indexOf('role="vendor"');
const studentBlock = app.slice(studentStart, studentEnd);
const routes = [...studentBlock.matchAll(/path="([^"]+)"/g)].map((m) => m[1]);

// Only concrete paths are navigable; a ":param" template is not a real URL.
const paths = routes
  .map((p) => p.replace(":vendorId", "7"))
  .filter((p) => !p.includes(":") && p !== "*");

// Mirror of STUDENT_NAV, minus the JSX icons.
const nav = [
  { key: "home", to: "/student", kind: "link", owns: ["/student/vendors"] },
  { key: "orders", to: "/student/orders", kind: "link" },
  { key: "cart", to: null, kind: "action" },
  { key: "profile", to: "/student/profile", kind: "link" },
];

const expected = {
  "/student": "home",
  "/student/vendors/7": "home",
  "/student/orders": "orders",
  "/student/profile": "profile",
  "/student/wallet": "home",
  "/student/meal-plans": "home",
  "/student/schedule": "home",
  "/student/leaderboard": "home",
};

let failures = 0;
console.log(`routes found in App.jsx: ${routes.length}\n`);

for (const p of paths) {
  const key = resolveActiveNavKey(p, nav);

  // How many items *would* light up: exactly the one the resolver picked.
  // `key` is a nav key ("home"), not a path, so compare against item.key.
  const activeCount = nav.filter((i) => i.kind === "link" && i.key === key).length;
  const want = expected[p];

  const ok = key !== null && activeCount === 1 && key === want;
  if (!ok) failures++;
  console.log(
    `${ok ? "PASS" : "FAIL"}  ${p.padEnd(26)} -> ${String(key).padEnd(8)}` +
      `active=${activeCount} expected=${want}`
  );
}

// Trailing slashes and a stray nested order page must still resolve sanely.
console.log("");
for (const p of ["/student/", "/student/orders/", "/student/orders/42"]) {
  const key = resolveActiveNavKey(p, nav);
  const ok = key !== null;
  if (!ok) failures++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${p.padEnd(26)} -> ${key}`);
}

console.log(failures === 0 ? "\nAll nav-active checks passed." : `\n${failures} FAILURE(S)`);
process.exit(failures === 0 ? 0 : 1);
