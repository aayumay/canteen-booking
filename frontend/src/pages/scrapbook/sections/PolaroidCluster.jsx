import React, { useRef } from "react";
import {
  motion,
  useReducedMotion,
  useScroll,
  useTransform,
} from "framer-motion";
import SmartImage from "../../../components/common/SmartImage.jsx";
import { DoodleSparkle, DoodleBurst } from "../../../components/common/doodles.jsx";
import { Chip, ScribbleHeading, Stamp, Tape } from "../kit.jsx";
import { POLAROIDS } from "../data.js";

/** One pinned photo scrap, captioned by hand. */
function Polaroid({ entry, index, progress }) {
  const reduced = useReducedMotion();
  const distance = 22 + index * 12;
  const y = useTransform(progress, [0, 1], [distance, -distance]);

  return (
    <motion.div
      style={reduced ? undefined : { y }}
      className={`relative sm:absolute ${entry.className}`}
    >
      <motion.div
        initial={
          reduced
            ? false
            : { opacity: 0, y: 30, rotate: (index % 2 ? 1 : -1) * 12 }
        }
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, amount: 0.3 }}
        transition={
          reduced
            ? undefined
            : { type: "spring", stiffness: 95, damping: 15, delay: index * 0.07 }
        }
        className="border-[9px] border-white bg-white pb-3 hard-shadow-sm"
      >
        {/* Two strips of tape, so each photo reads as deliberately pinned. */}
        <Tape
          className="-left-3 -top-3 z-10"
          rotate={index % 2 ? 12 : -9}
          width="w-14"
        />
        <Tape
          className="-right-3 -top-3 z-10"
          rotate={index % 2 ? -8 : 7}
          width="w-10"
        />

        <SmartImage
          src={entry.image}
          alt={entry.alt}
          width={700}
          height={700}
          sizes="(max-width: 640px) 72vw, 300px"
          quality={75}
          className="block aspect-square w-full object-cover"
        />

        <p className="px-1 pt-3 text-center font-hand text-xl leading-tight text-pine">
          {entry.caption}
        </p>
        {entry.placeholder ? (
          <div className="mt-1 flex justify-center">
            <Chip>placeholder</Chip>
          </div>
        ) : null}
      </motion.div>
    </motion.div>
  );
}

/**
 * Section 3 — Photos as pinned scraps.
 *
 * Absolute on desktop so the pile can overlap itself; stacked on mobile, where
 * a pile would just push content off screen.
 */
export default function PolaroidCluster() {
  const ref = useRef(null);
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start end", "end start"],
  });

  return (
    <section
      ref={ref}
      aria-labelledby="sb-polaroid-title"
      className="relative overflow-hidden px-5 py-24"
    >
      <ScribbleHeading
        id="sb-polaroid-title"
        sub="Pinned to the wall outside the canteen"
      />

      <div className="relative mx-auto mt-16 min-h-[520px] max-w-5xl sm:mt-24 sm:min-h-[560px]">
        {POLAROIDS.map((entry, i) => (
          <Polaroid
            key={entry.caption}
            entry={entry}
            index={i}
            progress={scrollYProgress}
          />
        ))}

        <DoodleBurst
          size={40}
          className="absolute left-[4%] bottom-[6%] text-stamp"
        />
        <DoodleSparkle
          size={32}
          className="absolute right-[6%] bottom-[10%] text-forest"
        />

        <div className="absolute right-[2%] top-[4%]">
          <Stamp rotate={7} size="text-xs">
            Wall 2B
          </Stamp>
        </div>
      </div>
    </section>
  );
}
