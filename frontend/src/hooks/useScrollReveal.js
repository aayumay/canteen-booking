import { useEffect, useRef } from "react";

/**
 * Scroll reveal hook — dependency-free.
 *
 * The previous implementation pulled in GSAP + ScrollTrigger (~70 KB gzipped)
 * for a single fade-and-rise, and its cleanup loop killed *every* ScrollTrigger
 * on the page, not just its own. A single native IntersectionObserver does the
 * same job for free and leaves the bundle alone.
 *
 * @param {object}  options
 * @param {number}  options.y         start offset in px
 * @param {number}  options.opacity   start opacity
 * @param {number}  options.scale     start scale
 * @param {string}  options.direction "up" | "down" | "left" | "right"
 * @param {number}  options.duration   transition ms
 * @param {number}  options.delay      transition delay ms
 * @param {number}  options.stagger    ms between direct children
 * @param {boolean} options.children   stagger the element's direct children
 * @param {string}  options.className  class toggled to "is-revealed"
 */
export function useScrollReveal(options = {}) {
  const ref = useRef(null);

  const {
    y = 26,
    opacity = 0,
    scale = 1,
    direction = "up",
    duration = 700,
    delay = 0,
    stagger = 70,
    children = false,
    className = "is-revealed",
  } = options;

  useEffect(() => {
    const el = ref.current;
    if (!el) return undefined;

    const targets = children ? Array.from(el.children) : [el];

    const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (prefersReducedMotion || typeof window.IntersectionObserver === "undefined") {
      targets.forEach((t) => t.classList.add(className));
      return undefined;
    }

    const from = { opacity, transform: "" };
    if (scale !== 1) from.transform += `scale(${scale}) `;
    if (direction === "up") from.transform = `translate3d(0, ${y}px, 0) ${from.transform}`.trim();
    else if (direction === "down") from.transform = `translate3d(0, -${y}px, 0) ${from.transform}`.trim();
    else if (direction === "left") from.transform = `translate3d(${y}px, 0, 0) ${from.transform}`.trim();
    else if (direction === "right") from.transform = `translate3d(-${y}px, 0, 0) ${from.transform}`.trim();
    else from.transform = from.transform || "none";

    targets.forEach((t, i) => {
      t.style.opacity = String(opacity);
      t.style.transform = from.transform || "none";
      t.style.transition = `opacity ${duration}ms cubic-bezier(0.16,1,0.3,1) ${
        delay + (children ? i * stagger : 0)
      }ms, transform ${duration}ms cubic-bezier(0.16,1,0.3,1) ${
        delay + (children ? i * stagger : 0)
      }ms`;
    });

    const io = new IntersectionObserver(
      (entries, observer) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          const node = entry.target;
          node.style.opacity = "1";
          node.style.transform = "none";
          node.classList.add(className);
          observer.unobserve(node);
        });
      },
      { rootMargin: "0px 0px -10% 0px", threshold: 0.1 }
    );

    targets.forEach((t) => io.observe(t));
    return () => io.disconnect();
  }, [y, opacity, scale, direction, duration, delay, stagger, children, className]);

  return ref;
}

export default useScrollReveal;
