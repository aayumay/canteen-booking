import React from "react";
import { motion, useReducedMotion } from "framer-motion";
import { Stamp } from "../kit.jsx";
import { COMPARE, COMPARE_ROWS } from "../data.js";

/** One cell. Wins get an inverted block, which is the only emphasis allowed. */
function Cell({ value, win, mono }) {
  if (win) {
    return (
      <th
        scope="row"
        className="border-2 border-black bg-black px-3 py-3 text-left font-mono-stack text-xs font-bold tracking-wide text-white uppercase sm:px-4 sm:text-sm"
      >
        {value}
      </th>
    );
  }

  return (
    <th
      scope="row"
      className={`border-2 border-black px-3 py-3 text-left text-sm text-black sm:px-4 ${
        mono ? "font-mono-stack text-xs uppercase" : "font-bold"
      }`}
    >
      {value}
    </th>
  );
}

function Outcome({ value, win }) {
  return (
    <td
      className={`border-2 border-black px-3 py-3 text-center text-xs sm:px-4 sm:text-sm ${
        win
          ? "bg-black font-mono-stack font-bold tracking-wide text-white uppercase"
          : "font-semibold text-black"
      }`}
    >
      {value}
    </td>
  );
}

/**
 * Section 6 — The comparison, kept deliberately brutal.
 *
 * Strictly black and white, no fills, no rounded corners. The harshness is
 * the point: it is the only place on the page that is not scrapbook.
 */
export default function ComparisonTable() {
  const reduced = useReducedMotion();

  return (
    <section
      aria-labelledby="sb-compare-title"
      className="relative overflow-hidden bg-white px-5 py-24"
    >
      <div className="mx-auto max-w-3xl">
        <h2
          id="sb-compare-title"
          className="text-center text-3xl font-black tracking-tight text-black uppercase sm:text-4xl"
        >
          Before / after
        </h2>
        <p className="mt-3 text-center font-mono-stack text-xs uppercase tracking-[0.2em] text-black/60">
          {COMPARE.sub}
        </p>

        <motion.div
          initial={reduced ? false : { opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.25 }}
          transition={reduced ? undefined : { duration: 0.45 }}
          className="mt-12 overflow-x-auto"
        >
          <table className="w-full min-w-[520px] border-collapse">
            <caption className="sr-only">
              Comparing queueing at the canteen with pre-booking
            </caption>
            <thead>
              <tr>
                <th
                  scope="col"
                  className="border-2 border-black bg-white px-3 py-3 text-left font-mono-stack text-xs uppercase tracking-[0.15em] text-black sm:px-4 sm:text-sm"
                >
                  {COMPARE.head.left}
                </th>
                <th
                  scope="col"
                  className="w-4 border-2 border-black bg-white"
                >
                  <span className="sr-only">versus</span>
                </th>
                <th
                  scope="col"
                  className="border-2 border-black bg-black px-3 py-3 text-left font-mono-stack text-xs uppercase tracking-[0.15em] text-white sm:px-4 sm:text-sm"
                >
                  {COMPARE.head.right}
                </th>
              </tr>
            </thead>
            <tbody>
              {COMPARE_ROWS.map((row) => (
                <tr key={row.label}>
                  <Cell value={row.label} />
                  <td className="border-2 border-black bg-white" />
                  <Cell value={row.us} win />
                </tr>
              ))}
              <tr>
                <Outcome value={COMPARE.outcome.left} />
                <td className="border-2 border-black bg-white" />
                <Outcome value={COMPARE.outcome.right} win />
              </tr>
            </tbody>
          </table>
        </motion.div>

        <div className="mt-10 flex justify-center">
          <Stamp rotate={3} size="text-sm">
            {COMPARE.stamp}
          </Stamp>
        </div>

        <p className="mt-6 text-center font-mono-stack text-[10px] uppercase tracking-[0.18em] text-black/50">
          {COMPARE.placeholderNote}
        </p>
      </div>
    </section>
  );
}
