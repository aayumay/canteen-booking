import { useRef, useCallback } from "react";

/**
 * Hook for subtle tactile magnetic/tilt physics on cards and buttons
 * Creates a micro-interaction that feels physical and tactile.
 */
export function useTactileHover({ maxTilt = 1.5, maxTranslate = 3 } = {}) {
  const ref = useRef(null);

  const handleMouseMove = useCallback(
    (e) => {
      const el = ref.current;
      if (!el) return;

      const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      if (prefersReducedMotion) return;

      const rect = el.getBoundingClientRect();
      const x = e.clientX - rect.left - rect.width / 2;
      const y = e.clientY - rect.top - rect.height / 2;

      const normX = x / (rect.width / 2);
      const normY = y / (rect.height / 2);

      const tiltX = -normY * maxTilt;
      const tiltY = normX * maxTilt;
      const transX = normX * maxTranslate;
      const transY = normY * maxTranslate;

      el.style.transform = `perspective(800px) translate3d(${transX}px, ${transY - 4}px, 0) rotateX(${tiltX}deg) rotateY(${tiltY}deg) scale(1.012)`;
      el.style.transition = "transform 0.12s ease-out";
    },
    [maxTilt, maxTranslate]
  );

  const handleMouseLeave = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    el.style.transform = "perspective(800px) translate3d(0, 0, 0) rotateX(0deg) rotateY(0deg) scale(1)";
    el.style.transition = "transform 0.4s cubic-bezier(0.16, 1, 0.3, 1)";
  }, []);

  return { ref, onMouseMove: handleMouseMove, onMouseLeave: handleMouseLeave };
}
