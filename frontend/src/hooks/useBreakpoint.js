import { useEffect, useState } from "react";

/**
 * Shared breakpoint scale.
 *
 * These MUST stay in sync with the custom properties documented at the top of
 * `src/index.css`:
 *
 *   mobile   <=  639px
 *   tablet   640 - 1023px
 *   desktop  >= 1024px
 *
 * Prefer CSS. This hook exists only for the cases CSS cannot express:
 * swapping a slide-up sheet for a right-docked panel, choosing which
 * animation axis to animate on, and mounting one navigation instead of two
 * without rendering both and hiding one with CSS.
 */
export const BREAKPOINTS = {
  mobileMax: 639,
  tabletMin: 640,
  tabletMax: 1023,
  desktopMin: 1024,
};

function readTier() {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
    return "mobile";
  }
  if (window.matchMedia(`(min-width: ${BREAKPOINTS.desktopMin}px)`).matches) {
    return "desktop";
  }
  if (window.matchMedia(`(min-width: ${BREAKPOINTS.tabletMin}px)`).matches) {
    return "tablet";
  }
  return "mobile";
}

/**
 * Returns "mobile" | "tablet" | "desktop" and re-renders on tier changes.
 * Defaults to "mobile" during SSR / no matchMedia so the mobile layout is the
 * safe first paint.
 */
export function useBreakpoint() {
  const [tier, setTier] = useState(readTier);

  useEffect(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
      return;
    }
    const mqDesktop = window.matchMedia(`(min-width: ${BREAKPOINTS.desktopMin}px)`);
    const mqTablet = window.matchMedia(`(min-width: ${BREAKPOINTS.tabletMin}px)`);

    const sync = () => setTier(readTier());
    sync();

    mqDesktop.addEventListener("change", sync);
    mqTablet.addEventListener("change", sync);
    return () => {
      mqDesktop.removeEventListener("change", sync);
      mqTablet.removeEventListener("change", sync);
    };
  }, []);

  return tier;
}

/** True on tablet and desktop, i.e. wherever the left rail replaces the tab bar. */
export function useHasSidebar() {
  return useBreakpoint() !== "mobile";
}
