import React from "react";
import { motion, useReducedMotion } from "framer-motion";
import { NAV_PILLS } from "../data.js";

/**
 * Section 1 — Floating navigation.
 *
 * Deliberately not a full-width header: there is no bar, no background and no
 * border across the top. Each item is a detached pill that floats directly on
 * the page colour, with the CTA set apart in a heavier, rounder shape.
 */
export default function FloatingNav() {
  const reduced = useReducedMotion();
  const spring = reduced
    ? undefined
    : { type: "spring", stiffness: 150, damping: 18 };

  return (
    <motion.header
      initial={reduced ? false : { y: -28, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={spring}
      className="sticky top-0 z-50 w-full px-4 pt-4 sm:pt-6"
    >
      <nav
        aria-label="Scrapbook sections"
        className="mx-auto flex max-w-5xl flex-wrap items-center justify-center gap-2 sm:gap-3"
      >
        {NAV_PILLS.map((pill, i) => (
          <motion.a
            key={pill.label}
            href={pill.href}
            initial={reduced ? false : { y: -14, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={
              spring ? { ...spring, delay: 0.05 + i * 0.05 } : undefined
            }
            className="rounded-full border-[3px] border-white bg-white/75 px-4 py-2 text-sm font-semibold text-ink backdrop-blur-[2px] transition-transform hover:-translate-y-0.5 sm:px-5"
          >
            {pill.label}
          </motion.a>
        ))}

        {/* Distinct, heavier CTA — visually separate from the pills. */}
        <motion.a
          href="#compare"
          initial={reduced ? false : { y: -14, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={spring ? { ...spring, delay: 0.28 } : undefined}
          className="ml-1 rounded-full bg-pine px-6 py-3 text-sm font-bold tracking-wide text-white transition-transform hover:-translate-y-0.5 sm:px-8 sm:py-3.5"
        >
          Start eating
        </motion.a>
      </nav>
    </motion.header>
  );
}
