import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  motion,
  useReducedMotion as useFramerReducedMotion,
  useScroll,
  useTransform,
} from "framer-motion";

/* ------------------------------------------------------------------ *
 * Shared: reduced-motion + a single shared IntersectionObserver
 * ------------------------------------------------------------------ */

let reducedMotionQuery = null;

function getReducedMotionQuery() {
  if (typeof window === "undefined" || !window.matchMedia) return null;
  if (!reducedMotionQuery) {
    reducedMotionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
  }
  return reducedMotionQuery;
}

export function prefersReducedMotion() {
  return Boolean(getReducedMotionQuery()?.matches);
}

/** Re-render subscribers when the OS motion preference flips. */
export function useReducedMotion() {
  const [reduced, setReduced] = useState(prefersReducedMotion);
  useEffect(() => {
    const mq = getReducedMotionQuery();
    if (!mq) return undefined;
    const onChange = (e) => setReduced(e.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);
  return reduced;
}

/* Every decorative loop on this page is `infinite`, which means the compositor
   keeps producing frames for it for the entire time the tab is open — even
   when the element is eight screens away. On a long page that stacks up, and
   the compositor has less headroom left for scrolling, which reads to the user
   as sluggish scrolling.

   CSS cannot pause an animation based on visibility, so gate the known looping
   elements on an IntersectionObserver and flip animation-play-state. Paused
   animations drop out of the compositor entirely, so an off-screen loop costs
   nothing while an on-screen one is untouched. */
const LOOPING_SELECTORS = [
  ".lp-eyebrow-dot",
  ".lp-hero-arrow",
  ".lp-drift",
  ".lp-collage-float-a",
  ".lp-collage-float-b",
  ".lp-collage-float-c",
  ".lp-collage-spark-1",
  ".lp-collage-spark-2",
  ".lp-collage-steam",
  ".lp-badge-svg",
  ".lp-scroll-cue-line",
  ".lp-faq-sprig",
  ".lp-cta-doodle-1",
  ".lp-cta-doodle-2",
  ".lp-cta-doodle-3",
];

export function usePauseLoopsOffscreen() {
  useEffect(() => {
    if (typeof IntersectionObserver === "undefined") return undefined;

    const targets = [];
    for (const selector of LOOPING_SELECTORS) {
      targets.push(...document.querySelectorAll(selector));
    }
    if (!targets.length) return undefined;

    // A small margin means a loop is already running by the time it scrolls
    // into view, so entering never looks like it starts from a dead frame.
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          entry.target.style.animationPlayState = entry.isIntersecting ? "running" : "paused";
        }
      },
      { rootMargin: "150px 0px" }
    );

    for (const el of targets) observer.observe(el);
    return () => {
      observer.disconnect();
      for (const el of targets) el.style.animationPlayState = "";
    };
  }, []);
}

/**
 * One observer for every reveal on the page. A single IO instance avoids the
 * per-element observer churn that makes scroll pages jank.
 */
const observerRegistry = new WeakMap();

function getSharedObserver() {
  if (typeof window === "undefined" || !window.IntersectionObserver) return null;
  if (!observerRegistry.has(document.documentElement)) {
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          entry.target.dispatchEvent(new CustomEvent("lp:reveal", { detail: entry }));
          io.unobserve(entry.target);
        });
      },
      { rootMargin: "0px 0px -12% 0px", threshold: 0.12 }
    );
    observerRegistry.set(document.documentElement, io);
  }
  return observerRegistry.get(document.documentElement);
}

/**
 * The shared observer carries a single rootMargin/threshold for the whole page
 * so all reveals feel consistent; callers can only opt out via `disabled`.
 */
function useInViewOnce({ disabled = false } = {}) {
  const ref = useRef(null);
  const [inView, setInView] = useState(false);

  useEffect(() => {
    if (disabled) {
      setInView(true);
      return undefined;
    }
    const el = ref.current;
    if (!el) return undefined;

    if (!window.IntersectionObserver) {
      setInView(true);
      return undefined;
    }

    // If the element is already on screen at mount, reveal without waiting.
    const rect = el.getBoundingClientRect();
    if (rect.top < window.innerHeight && rect.bottom > 0) {
      setInView(true);
      return undefined;
    }

    const io = getSharedObserver();
    if (!io) {
      setInView(true);
      return undefined;
    }

    const onReveal = () => setInView(true);
    el.addEventListener("lp:reveal", onReveal);
    io.observe(el);

    return () => {
      el.removeEventListener("lp:reveal", onReveal);
      io.unobserve(el);
    };
  }, [disabled]);

  return [ref, inView];
}

/* ------------------------------------------------------------------ *
 * Reveal — the workhorse scroll animation
 * ------------------------------------------------------------------ */

const REVEAL_EASE = "cubic-bezier(0.16, 1, 0.3, 1)";

/**
 * Fade + rise a block of content the first time it enters the viewport.
 * Driven by a class toggle so the browser owns the animation on the
 * compositor — no per-frame React work.
 */
export function Reveal({
  children,
  as: Tag = "div",
  delay = 0,
  distance = 26,
  scale = 1,
  direction = "up",
  className = "",
  style,
  once = true,
}) {
  const reduced = useReducedMotion();
  const [ref, inView] = useInViewOnce({ disabled: reduced });

  const offset = () => {
    if (direction === "up") return `translate3d(0, ${distance}px, 0)`;
    if (direction === "down") return `translate3d(0, -${distance}px, 0)`;
    if (direction === "left") return `translate3d(${distance}px, 0, 0)`;
    if (direction === "right") return `translate3d(-${distance}px, 0, 0)`;
    return "translate3d(0, 0, 0)";
  };

  const active = reduced || inView;

  return (
    <Tag
      ref={ref}
      className={`lp-reveal ${active ? "is-in" : ""} ${className}`.trim()}
      style={{
        "--lp-reveal-delay": `${delay}ms`,
        "--lp-reveal-from": offset(),
        "--lp-reveal-scale": scale !== 1 ? String(scale) : undefined,
        ...style,
      }}
    >
      {children}
    </Tag>
  );
}

/** Staggered container: direct children animate in sequence. */
export function RevealGroup({
  children,
  as: Tag = "div",
  stagger = 70,
  delay = 0,
  className = "",
  style,
}) {
  const reduced = useReducedMotion();
  const [ref, inView] = useInViewOnce({ disabled: reduced });
  const active = reduced || inView;

  // Children.toArray flattens fragments and nested arrays and drops nullish
  // entries, so the index each child receives always matches its visual
  // position. A bare React.isValidElement check here would silently pass
  // multi-child arrays straight through and every child would animate together.
  const items = React.Children.toArray(children).map((child, i) => {
    if (!React.isValidElement(child)) return child;
    return React.cloneElement(child, {
      key: child.key ?? i,
      // Set as an inline custom property so the cascade works regardless of how
      // the child composes its own style prop.
      style: { ...child.props.style, "--lp-index": i },
    });
  });

  return (
    <Tag
      ref={ref}
      className={`lp-reveal-group ${active ? "is-in" : ""} ${className}`.trim()}
      style={{ "--lp-stagger": `${stagger}ms`, "--lp-group-delay": `${delay}ms`, ...style }}
    >
      {items}
    </Tag>
  );
}

/* ------------------------------------------------------------------ *
 * CountUp — statistics that count to their value
 * ------------------------------------------------------------------ */

export function CountUp({
  to,
  from = 0,
  duration = 1400,
  prefix = "",
  suffix = "",
  decimals = 0,
  className = "",
}) {
  const reduced = useReducedMotion();
  const [ref, inView] = useInViewOnce({ disabled: reduced });
  const [value, setValue] = useState(reduced ? to : from);
  const frameRef = useRef(0);

  useEffect(() => {
    if (!inView) return undefined;
    if (reduced) {
      setValue(to);
      return undefined;
    }

    const start = performance.now();
    const tick = (now) => {
      const t = Math.min(1, (now - start) / duration);
      // Matches the editorial ease-out so numbers settle with the layout.
      const eased = 1 - Math.pow(1 - t, 3);
      setValue(from + (to - from) * eased);
      if (t < 1) frameRef.current = requestAnimationFrame(tick);
    };
    frameRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frameRef.current);
  }, [inView, reduced, from, to, duration]);

  const shown = Number(value).toFixed(decimals);

  return (
    <span ref={ref} className={className}>
      {prefix}
      {shown}
      {suffix}
    </span>
  );
}

/* ------------------------------------------------------------------ *
 * Parallax — transform-only scroll response
 * ------------------------------------------------------------------ */

export function useParallax(strength = 0.18) {
  const ref = useRef(null);
  const reduced = useReducedMotion();

  useEffect(() => {
    const el = ref.current;
    if (!el || reduced) return undefined;

    let frame = 0;
    const update = () => {
      frame = 0;
      const rect = el.getBoundingClientRect();
      const vh = window.innerHeight || 1;
      // -1 (below fold) .. 1 (above fold)
      const progress = (rect.top + rect.height / 2 - vh / 2) / (vh / 2 + rect.height / 2);
      el.style.transform = `translate3d(0, ${(progress * strength * 100).toFixed(2)}px, 0)`;
    };
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };

    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll, { passive: true });
    return () => {
      if (frame) cancelAnimationFrame(frame);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, [strength, reduced]);

  return ref;
}

/** Wraps a layer so it drifts against the scroll direction. */
export function ParallaxLayer({ children, strength = 0.18, className = "", style }) {
  const ref = useParallax(strength);
  return (
    <div
      ref={ref}
      className={`lp-parallax-layer ${className}`.trim()}
      style={style}
      aria-hidden="true"
    >
      {children}
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * Magnetic / tilt — pointer-driven, rAF-throttled, pointer-fine only
 * ------------------------------------------------------------------ */

export function useMagnetic({ strength = 0.28, radius = 0 } = {}) {
  const ref = useRef(null);
  const reduced = useReducedMotion();

  useEffect(() => {
    const el = ref.current;
    if (!el || reduced) return undefined;
    // Never run on touch — it is pure cost with no perceived benefit.
    if (!window.matchMedia("(hover: hover) and (pointer: fine)").matches) return undefined;

    let frame = 0;
    let tx = 0;
    let ty = 0;

    const apply = () => {
      frame = 0;
      el.style.transform = `translate3d(${tx.toFixed(2)}px, ${ty.toFixed(2)}px, 0)`;
    };

    const onMove = (e) => {
      const rect = el.getBoundingClientRect();
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;
      const dx = e.clientX - cx;
      const dy = e.clientY - cy;
      const reach = radius || Math.max(rect.width, rect.height) / 2 + 40;
      const dist = Math.hypot(dx, dy);
      if (dist > reach) {
        tx = 0;
        ty = 0;
      } else {
        const falloff = 1 - dist / reach;
        tx = dx * strength * falloff;
        ty = dy * strength * falloff;
      }
      if (!frame) frame = requestAnimationFrame(apply);
    };

    const onLeave = () => {
      tx = 0;
      ty = 0;
      if (!frame) frame = requestAnimationFrame(apply);
    };

    window.addEventListener("pointermove", onMove, { passive: true });
    window.addEventListener("pointerleave", onLeave, { passive: true });
    return () => {
      if (frame) cancelAnimationFrame(frame);
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerleave", onLeave);
    };
  }, [strength, radius, reduced]);

  return ref;
}

/* ------------------------------------------------------------------ *
 * Scroll progress + nav state
 * ------------------------------------------------------------------ */

/** Normalised page scroll progress (0..1), rAF-throttled. */
export function useScrollProgress() {
  const [progress, setProgress] = useState(0);
  useEffect(() => {
    let frame = 0;
    const update = () => {
      frame = 0;
      const max = document.documentElement.scrollHeight - window.innerHeight;
      setProgress(max > 0 ? Math.min(1, Math.max(0, window.scrollY / max)) : 0);
    };
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };
    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll, { passive: true });
    return () => {
      if (frame) cancelAnimationFrame(frame);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, []);
  return progress;
}

/** True once the page has scrolled past `offset` px. */
export function useScrolledPast(offset = 24) {
  const [past, setPast] = useState(false);
  useEffect(() => {
    let frame = 0;
    const update = () => {
      frame = 0;
      setPast(window.scrollY > offset);
    };
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };
    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      if (frame) cancelAnimationFrame(frame);
      window.removeEventListener("scroll", onScroll);
    };
  }, [offset]);
  return past;
}

/* ------------------------------------------------------------------ *
 * Pointer-driven hero parallax (desktop only)
 * ------------------------------------------------------------------ */

export function usePointerParallax(strength = 12) {
  const ref = useRef(null);
  const reduced = useReducedMotion();

  useEffect(() => {
    const el = ref.current;
    if (!el || reduced) return undefined;
    if (!window.matchMedia("(hover: hover) and (pointer: fine)").matches) return undefined;

    let frame = 0;
    let rx = 0;
    let ry = 0;
    const apply = () => {
      frame = 0;
      el.style.setProperty("--lp-ptr-x", `${rx.toFixed(2)}px`);
      el.style.setProperty("--lp-ptr-y", `${ry.toFixed(2)}px`);
    };
    const onMove = (e) => {
      const w = window.innerWidth || 1;
      const h = window.innerHeight || 1;
      rx = ((e.clientX / w) - 0.5) * 2 * strength;
      ry = ((e.clientY / h) - 0.5) * 2 * strength;
      if (!frame) frame = requestAnimationFrame(apply);
    };
    window.addEventListener("pointermove", onMove, { passive: true });
    return () => {
      if (frame) cancelAnimationFrame(frame);
      window.removeEventListener("pointermove", onMove);
    };
  }, [strength, reduced]);

  return ref;
}

/* ------------------------------------------------------------------ *
 * Scroll-linked motion (Framer Motion)
 *
 * These use useScroll/useTransform against a target element rather than a
 * scroll event listener. The browser keeps the values off the main thread, so
 * this stays cheap on mobile. Everything here collapses to a static result
 * when the user prefers reduced motion.
 * ------------------------------------------------------------------ */

/**
 * Drift + counter-rotate a layer as its section travels through the viewport.
 * Returns a style object to spread onto a motion component; empty under
 * reduced motion, which parks the layer in its resting position.
 */
export function useScrollFloat(ref, { distance = 46, rotate = 0 } = {}) {
  const reduced = useFramerReducedMotion();
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start end", "end start"],
  });
  const y = useTransform(scrollYProgress, [0, 1], [distance, -distance]);
  const r = useTransform(scrollYProgress, [0, 1], [rotate, -rotate]);

  if (reduced) return {};
  return { y, rotate: r };
}

/**
 * 0..1 draw progress for a path as `ref`'s section scrolls past. Always returns
 * a MotionValue, never a bare number, because callers chain this into
 * useTransform() and framer expects a MotionValue there. Under reduced motion
 * it reports a constant 1, so the path is simply drawn instead of animated.
 */
export function useDrawProgress(ref, { start = 0.2, end = 0.85 } = {}) {
  const reduced = useFramerReducedMotion();
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start end", "end start"],
  });
  const drawn = useTransform(scrollYProgress, [start, end], [0, 1]);

  return useTransform(drawn, (v) => (reduced ? 1 : v));
}

/**
 * Spring entrance for cards, as an alternative to the CSS Reveal above.
 * `direction` and `distance` mirror Reveal so the two can be swapped freely.
 * `distance` is accepted for that parity but unused: a spring has its own
 * overshoot, and the value must not reach the DOM as an unknown attribute.
 * `delay` is in seconds here, unlike Reveal's milliseconds.
 */
export function SpringReveal({
  children,
  className = "",
  delay = 0,
  direction = "up",
  distance: _distance,
  as: Tag = "div",
  ...rest
}) {
  const reduced = useFramerReducedMotion();
  const from =
    direction === "left"
      ? { opacity: 0, x: -28 }
      : direction === "right"
        ? { opacity: 0, x: 28 }
        : { opacity: 0, y: 30 };

  return (
    <Tag
      className={className}
      initial={reduced ? false : from}
      whileInView={reduced ? undefined : { opacity: 1, x: 0, y: 0 }}
      viewport={{ once: true, amount: 0.25 }}
      transition={reduced ? undefined : { type: "spring", stiffness: 120, damping: 18, delay }}
      {...rest}
    >
      {children}
    </Tag>
  );
}

/* ------------------------------------------------------------------ *
 * Accordion
 * ------------------------------------------------------------------ */

export function useAccordion(initial = 0) {
  const [open, setOpen] = useState(initial);
  const toggle = useCallback((i) => setOpen((prev) => (prev === i ? -1 : i)), []);
  return [open, toggle];
}

export { REVEAL_EASE };
