import React, { useRef } from "react";
import {
  motion,
  useReducedMotion,
  useScroll,
  useTransform,
} from "framer-motion";
import SmartImage from "../../../components/common/SmartImage.jsx";
import { DoodleSparkle } from "../../../components/common/doodles.jsx";
import { Halftone, ScribbleHeading, Stamp, Tape } from "../kit.jsx";
import { SCATTER } from "../data.js";

/**
 * One cut-out floating away from the centre.
 *
 * Nearer pieces (higher z, larger) travel further than far ones, so the
 * cluster opens outward on scroll instead of sliding as a single block.
 * Rotation stays in className rather than a style transform, because a
 * MotionValue on `rotate` would override the class entirely.
 */
function Piece({ entry, index, progress }) {
  const reduced = useReducedMotion();
  const distance = 26 + index * 20;
  const y = useTransform(progress, [0, 1], [distance, -distance]);

  return (
    <motion.div
      style={reduced ? undefined : { y }}
      className={`absolute ${entry.className}`}
    >
      <motion.div
        initial={reduced ? false : { opacity: 0, scale: 0.7, rotate: -14 }}
        whileInView={{ opacity: 1, scale: 1, rotate: 0 }}
        viewport={{ once: true, amount: 0.4 }}
        transition={
          reduced
            ? undefined
            : { type: "spring", stiffness: 130, damping: 14, delay: index * 0.08 }
        }
        className="border-[6px] border-white bg-white p-1.5 hard-shadow-sm"
      >
        <SmartImage
          src={entry.image}
          alt={entry.alt}
          width={520}
          height={520}
          sizes="(max-width: 640px) 28vw, 190px"
          quality={74}
          className="block aspect-square w-full object-cover"
        />
      </motion.div>
    </motion.div>
  );
}

/**
 * Section 5 — The dish, with its parts pulled out around it.
 *
 * The cut-outs are stand-in dish photos: the repo has no transparent
 * ingredient PNGs, so these are the closest honest substitute. Swap
 * SCATTER.pieces[].src for real cut-outs and the layout is unchanged.
 */
export default function IngredientScatter() {
  const ref = useRef(null);
  const reduced = useReducedMotion();
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start end", "end start"],
  });
  const centreY = useTransform(scrollYProgress, [0, 1], [40, -40]);

  return (
    <section
      ref={ref}
      aria-labelledby="sb-scatter-title"
      className="relative overflow-hidden bg-sage py-24"
    >
      <Halftone className="-left-10 top-[10%] h-48 w-48 text-pine opacity-20" />
      <Halftone className="-right-8 bottom-[6%] h-40 w-40 text-forest opacity-25" />

      <div className="px-5">
        <ScribbleHeading
          id="sb-scatter-title"
          sub="Made fresh. Not reheated under a lamp."
        />

        <div className="relative mx-auto mt-20 h-[440px] max-w-4xl sm:h-[540px]">
          {SCATTER.pieces.map((piece, i) => (
            <Piece
              key={piece.alt}
              entry={piece}
              index={i}
              progress={scrollYProgress}
            />
          ))}

          {/* Centre dish. Entrance and drift are split across two nodes
              because a style MotionValue outranks `animate`. */}
          <motion.div
            style={reduced ? undefined : { y: centreY }}
            className="absolute left-1/2 top-1/2 z-30 w-[46vw] max-w-[260px] -translate-x-1/2 -translate-y-1/2 rotate-[3deg] border-[10px] border-white bg-white p-2 hard-shadow sm:w-[340px] sm:border-[14px]"
          >
            <motion.div
              initial={reduced ? false : { opacity: 0, scale: 0.88 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true, amount: 0.3 }}
              transition={
                reduced
                  ? undefined
                  : { type: "spring", stiffness: 100, damping: 16 }
              }
              className="relative"
            >
              <SmartImage
                src={SCATTER.centre.image}
                alt={SCATTER.centre.alt}
                width={680}
                height={680}
                sizes="(max-width: 640px) 46vw, 340px"
                quality={78}
                className="block aspect-square w-full object-cover"
              />
              <DoodleSparkle
                size={40}
                className="absolute -right-6 -top-6 text-forest sm:-right-9 sm:-top-8"
              />
            </motion.div>

            <Tape className="-left-4 -top-4 z-10" rotate={-8} width="w-16" />

            <div className="pt-2 text-center font-mono-stack text-[10px] uppercase tracking-[0.2em] text-moss">
              {SCATTER.centre.docket}
            </div>
          </motion.div>

          <div className="absolute bottom-[4%] left-[3%]">
            <Stamp rotate={-8} size="text-xs">
              Made today
            </Stamp>
          </div>
        </div>

        <p className="mt-6 text-center font-hand text-lg text-stamp/80">
          Stand-in photography — swap in real cut-out PNGs before launch
        </p>
      </div>
    </section>
  );
}
