import React, { useRef } from "react";
import {
  motion,
  useReducedMotion,
  useScroll,
  useTransform,
} from "framer-motion";
import { DoodleSparkle } from "../../../components/common/doodles.jsx";
import { Chip, ScribbleHeading, Stamp, Tape } from "../kit.jsx";
import { JOURNEY } from "../data.js";

/**
 * A single tear between two perforations. Repeated along the spine, this
 * reads as a till roll being torn off, which is a nicer metaphor for "your
 * turn is coming" than a plain line.
 */
function Tear({ progress, index }) {
  const reduced = useReducedMotion();
  const fill = useTransform(progress, [0, 0.55], [0, 1]);
  const draw = useTransform(progress, [0, 0.55], [0, 1]);

  return (
    <span
      className="relative block h-6 w-full"
      aria-hidden="true"
    >
      <svg
        viewBox="0 0 100 24"
        preserveAspectRatio="none"
        className="absolute inset-0 h-full w-full overflow-visible"
      >
        {/* The untraced part of the spine. */}
        <path
          d="M50 1 Q 50 12 50 23"
          fill="none"
          stroke="currentColor"
          strokeWidth="3"
          strokeLinecap="round"
          strokeDasharray="2 9"
          className="text-pine/30"
        />
        {/* The traced part, revealed by scroll. */}
        <motion.path
          d="M50 1 Q 50 12 50 23"
          fill="none"
          stroke="currentColor"
          strokeWidth="3"
          strokeLinecap="round"
          strokeDasharray="2 9"
          className="text-pine"
          style={{ pathLength: reduced ? 1 : draw }}
        />
      </svg>

      {/* Node: a punched hole that fills as the scroll reaches it. */}
      <motion.span
        className="absolute left-1/2 top-1/2 h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-[3px] border-pine bg-sage"
        style={{ backgroundColor: reduced ? undefined : fill }}
      />
    </span>
  );
}

/** One step. Numbered like a docket line item. */
function JourneyCard({ step, side, progress, index }) {
  const reduced = useReducedMotion();
  const isLeft = side === "left";
  const distance = index % 2 === 0 ? 34 : -34;
  const y = useTransform(progress, [0, 1], [distance * 0.5, distance]);

  return (
    <motion.article
      style={reduced ? undefined : { y }}
      className={`relative w-[80vw] max-w-[300px] sm:w-[300px] ${
        isLeft ? "sm:-mr-14 sm:self-start sm:text-left" : "sm:-ml-14 sm:self-end sm:text-right"
      }`}
    >
      <motion.div
        initial={reduced ? false : { opacity: 0, y: 26, rotate: isLeft ? -5 : 5 }}
        whileInView={{ opacity: 1, y: 0, rotate: isLeft ? -1.5 : 1.5 }}
        viewport={{ once: true, amount: 0.35 }}
        transition={
          reduced
            ? undefined
            : { type: "spring", stiffness: 110, damping: 17, delay: index * 0.05 }
        }
        className="relative border-[7px] border-white bg-white p-5 hard-shadow-sm"
      >
        <Tape
          className={isLeft ? "-left-5 -top-4" : "-right-5 -top-4"}
          rotate={isLeft ? -10 : 11}
          width="w-16"
        />

        <div
          className={`flex items-baseline gap-2 ${
            isLeft ? "flex-row" : "flex-row-reverse"
          }`}
        >
          <span className="font-mono-stack text-3xl font-bold leading-none text-stamp">
            {step.step}
          </span>
          <Chip>{step.kicker}</Chip>
        </div>

        <h3 className="mt-3 text-lg font-black leading-tight text-ink">
          {step.title}
        </h3>

        <p
          className={`mt-2 text-sm leading-relaxed text-moss ${
            isLeft ? "" : "text-right"
          }`}
        >
          {step.body}
        </p>

        {step.placeholder ? (
          <p className="mt-3 font-hand text-base text-stamp/80">
            (placeholder copy)
          </p>
        ) : null}

        <DoodleSparkle
          size={26}
          className={`absolute -bottom-4 text-forest ${
            isLeft ? "-right-4" : "-left-4"
          }`}
        />
      </motion.div>
    </motion.article>
  );
}

/**
 * Section 4 — Four steps on an alternating spine.
 *
 * The spine is a single absolutely positioned column, so the cards can hang
 * off both sides without the two columns ever having to agree about a
 * height. Each card drifts at its own rate, which keeps the stack from
 * moving as one flat block.
 */
export default function WavyJourney() {
  const listRef = useRef(null);
  const reduced = useReducedMotion();
  const { scrollYProgress } = useScroll({
    target: listRef,
    offset: ["start 0.8", "end 0.4"],
  });

  return (
    <section
      aria-labelledby="sb-journey-title"
      className="relative overflow-hidden bg-sage py-24"
    >
      <div className="px-5">
        <ScribbleHeading id="sb-journey-title" sub="Four steps. No queue." />

        <div className="mt-20 flex flex-col items-center gap-10 sm:mt-28 sm:gap-14">
          {/* The spine. */}
          <div
            aria-hidden="true"
            className="pointer-events-none absolute top-0 left-1/2 h-full w-8 -translate-x-1/2 sm:top-40 sm:bottom-40 sm:h-auto"
          >
            <div className="flex h-full flex-col items-center justify-center">
              {JOURNEY.map((step, i) => (
                <Tear key={step.title} index={i} progress={scrollYProgress} />
              ))}
            </div>
          </div>

          <div
            ref={listRef}
            className="relative flex w-full flex-col items-center gap-10 sm:gap-16"
          >
            {JOURNEY.map((step, i) => (
              <JourneyCard
                key={step.title}
                step={step}
                index={i}
                side={step.side}
                progress={scrollYProgress}
              />
            ))}
          </div>
        </div>

        {/* The payoff: the stamp that means it is done. */}
        <div className="mt-24 flex justify-center">
          <Stamp rotate={-4} size="text-lg">
            Ready
          </Stamp>
        </div>
      </div>
    </section>
  );
}
