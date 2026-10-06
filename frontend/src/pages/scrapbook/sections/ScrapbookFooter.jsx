import React from "react";
import { motion, useReducedMotion } from "framer-motion";
import { Barcode, Halftone, Stamp, Tape } from "../kit.jsx";
import { FOOTER_CHIPS } from "../data.js";

/** One floating chip, notched on the trailing edge like a torn stub. */
function Chip({ label, className }) {
  const reduced = useReducedMotion();

  return (
    <motion.div
      initial={reduced ? false : { opacity: 0, scale: 0.7 }}
      whileInView={{ opacity: 1, scale: 1 }}
      viewport={{ once: true, amount: 0.5 }}
      transition={reduced ? undefined : { type: "spring", stiffness: 170, damping: 14 }}
      className={`absolute ${className}`}
    >
      <span className="notched block border-[6px] border-white bg-white px-3 py-2 font-mono-stack text-xs font-bold tracking-[0.12em] text-ink uppercase hard-shadow-sm">
        {label}
      </span>
    </motion.div>
  );
}

/**
 * Section 7 — The tear-off footer.
 *
 * The wordmark is set far wider than the viewport and pulled back with a
 * negative margin, so the letters are cropped by the section's own
 * overflow rather than scaled to fit. That crop is the point: it reads as
 * something printed too large for the paper.
 */
export default function ScrapbookFooter() {
  return (
    <footer className="relative isolate overflow-hidden bg-sage pt-28 pb-0">
      <Halftone className="-left-6 top-[30%] h-40 w-40 text-pine opacity-20" />

      {/* A torn edge where the footer is separated from the page above. */}
      <div
        aria-hidden="true"
        className="torn-x pointer-events-none absolute inset-x-0 -top-4 h-8 bg-white"
      />

      <div className="relative h-64">
        {FOOTER_CHIPS.map((chip) => (
          <Chip key={chip.label} {...chip} />
        ))}

        <div className="absolute left-[8%] top-[8%]">
          <Stamp rotate={-9} size="text-xs">
            Est. lunch
          </Stamp>
        </div>
        <div className="absolute right-[10%] top-[44%]">
          <Stamp rotate={8} size="text-xs">
            No queue
          </Stamp>
        </div>
      </div>

      <Tape
        className="left-1/2 top-[38%] z-10 -translate-x-1/2"
        rotate={-3}
        width="w-32"
      />

      <div className="relative w-full bg-white py-8">
        <div className="mx-auto mb-6 w-40">
          <Barcode digits="CANTEEN-BOOKING" height="h-8" />
        </div>

        <motion.h2
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.3 }}
          transition={{ type: "spring", stiffness: 90, damping: 18 }}
          aria-label="Canteen Booking"
          className="-ml-[14vw] w-[128vw] text-center text-[19vw] leading-[0.8] font-black tracking-[-0.03em] whitespace-nowrap text-pine"
        >
          canteen
          <br />
          booking
        </motion.h2>

        <p className="mt-8 text-center font-mono-stack text-[10px] uppercase tracking-[0.24em] text-moss">
          Design study · placeholder content · not a real order flow
        </p>
      </div>
    </footer>
  );
}
