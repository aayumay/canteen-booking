import React from "react";
import { motion, useReducedMotion } from "framer-motion";

/* ============================================================================
 * Scrapbook primitives.

   The visual idea is a canteen till docket: torn perforations, rubber stamps,
   a barcode, washi tape, printed halftone. Every section is built from these
   so the page has one system rather than seven unrelated card treatments.
   ========================================================================== */

/**
 * Rubber stamp. Presses down with a spring, overshoots slightly and settles,
 * and blends with multiply so two stamps crossing each other darken like ink.
 */
export function Stamp({ children, rotate = -8, className = "", delay = 0, size = "text-sm" }) {
  const reduced = useReducedMotion();

  return (
    <motion.span
      initial={reduced ? false : { scale: 1.9, opacity: 0, rotate: rotate - 14 }}
      whileInView={{ scale: 1, opacity: 0.88, rotate }}
      viewport={{ once: true, amount: 0.6 }}
      transition={
        reduced
          ? undefined
          : { type: "spring", stiffness: 420, damping: 12, delay, mass: 0.7 }
      }
      className={`stamp inline-block ${size} ${className}`}
    >
      {children}
    </motion.span>
  );
}

/** A strip of washi tape, holding something down. */
export function Tape({ className = "", rotate = -4, width = "w-24" }) {
  return (
    <span
      aria-hidden="true"
      style={{ rotate: `${rotate}deg` }}
      className={`tape pointer-events-none absolute block h-7 ${width} ${className}`}
    />
  );
}

/*
 * Barcode. Widths are a fixed pattern rather than random so the "code" is
 * stable between renders and the bars stay crisp.
 */
const BAR_WIDTHS = [
  3, 1, 1, 2, 4, 1, 2, 1, 1, 3, 1, 2, 4, 1, 1, 2, 1, 3, 2, 1, 4, 1, 2, 1, 1, 3, 2, 1, 2, 1, 4,
  1, 1, 3, 2, 1, 2, 4, 1, 1, 2, 1, 3, 2, 1, 4, 1, 2, 1, 1, 3,
];

/**
 * A barcode that prints itself: the bars scale up from nothing, and a shine
 * sweeps across once it has "printed". The sweep is a CSS animation that only
 * runs under prefers-reduced-motion: no-preference.
 */
export function Barcode({ className = "", digits = "TKT-4471-1415", height = "h-9" }) {
  const reduced = useReducedMotion();

  return (
    <div className={className}>
      <motion.div
        initial={reduced ? false : { scaleX: 0 }}
        whileInView={{ scaleX: 1 }}
        viewport={{ once: true, amount: 0.6 }}
        transition={reduced ? undefined : { type: "spring", stiffness: 90, damping: 20 }}
        style={{ originX: 0 }}
        className={`barcode-scan relative flex items-stretch gap-[2px] overflow-hidden bg-ink ${height}`}
      >
        {BAR_WIDTHS.map((w, i) => (
          <span
            key={i}
            style={{ width: `${w}px` }}
            className="block h-full bg-white"
          />
        ))}
      </motion.div>
      <div className="mt-1 text-center font-mono-stack text-[9px] tracking-[0.3em] text-moss">
        {digits}
      </div>
    </div>
  );
}

/**
 * Hand-drawn underline: two overlapping strokes at slightly different heights,
 * which is what makes it read as a pen mark rather than a border. The second
 * stroke is shorter and fainter, the way a real pen doubles back.
 */
export function Scribble({ className = "" }) {
  const reduced = useReducedMotion();

  return (
    <svg
      viewBox="0 0 240 14"
      preserveAspectRatio="none"
      aria-hidden="true"
      className={className}
    >
      <motion.path
        d="M3 9 C 45 3, 78 11, 120 6 S 205 4, 237 8"
        fill="none"
        stroke="currentColor"
        strokeWidth="3.2"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
        initial={reduced ? false : { pathLength: 0 }}
        whileInView={{ pathLength: 1 }}
        viewport={{ once: true, amount: 0.5 }}
        transition={reduced ? undefined : { duration: 0.7, ease: "easeOut" }}
      />
      <motion.path
        d="M10 12 C 55 8, 96 13, 150 9"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        opacity="0.45"
        vectorEffect="non-scaling-stroke"
        initial={reduced ? false : { pathLength: 0 }}
        whileInView={{ pathLength: 1 }}
        viewport={{ once: true, amount: 0.5 }}
        transition={reduced ? undefined : { duration: 0.6, delay: 0.12, ease: "easeOut" }}
      />
    </svg>
  );
}

/** Printed-dot field standing in for a drop shadow. */
export function Halftone({ className = "" }) {
  return <span aria-hidden="true" className={`halftone pointer-events-none absolute ${className}`} />;
}

/**
 * A docket panel: torn top and bottom, mono header, a metadata row and a
 * barcode. The signature element — it is the thing the whole app hands you.
 */
export function Docket({ serial = "TKT-4471", window = "14:15 – 14:30", stall = "Chai & Snacks", className = "", children }) {
  return (
    <div className={`torn-x relative bg-white px-5 pb-6 pt-4 sm:px-6 ${className}`}>
      {/* Punched holes read as the roll's sprocket line. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute left-3 top-0 h-full w-1 bg-[radial-gradient(circle_at_50%_9px,rgba(0,0,0,0.10)_0_3px,transparent_3.5px)] bg-[length:10px_18px]"
      />
      <div className="font-mono-stack text-[10px] uppercase tracking-[0.22em] text-moss">
        {serial}
      </div>
      <div className="mt-2 flex items-baseline justify-between gap-3 border-b-2 border-dashed border-ink/25 pb-2">
        <span className="font-mono-stack text-[11px] uppercase tracking-[0.18em] text-ink">
          Pickup {window}
        </span>
        <span className="truncate text-xs font-bold text-ink">{stall}</span>
      </div>
      {children}
    </div>
  );
}

/** A mono chip, the small repeated label used around the page. */
export function Chip({ children, className = "" }) {
  return (
    <span
      className={`inline-block border-2 border-ink bg-white px-2 py-0.5 font-mono-stack text-[9px] uppercase tracking-[0.18em] text-ink ${className}`}
    >
      {children}
    </span>
  );
}

/** Section heading with the hand-drawn mark under it. */
export function ScribbleHeading({ id, children, sub, className = "" }) {
  const reduced = useReducedMotion();

  return (
    <motion.div
      initial={reduced ? false : { opacity: 0, y: 18 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.4 }}
      transition={reduced ? undefined : { type: "spring", stiffness: 120, damping: 18 }}
      className={`text-center ${className}`}
    >
      <h2
        id={id}
        className="relative mx-auto inline-block text-3xl font-black leading-tight text-ink sm:text-4xl"
      >
        {children}
        <Scribble className="absolute -bottom-3 left-0 h-3 w-full text-stamp" />
      </h2>
      {sub ? (
        <p className="mt-6 font-hand text-xl text-moss sm:text-2xl">{sub}</p>
      ) : null}
    </motion.div>
  );
}
