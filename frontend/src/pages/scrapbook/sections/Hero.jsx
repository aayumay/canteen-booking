import React, { useRef } from "react";
import {
  motion,
  useReducedMotion,
  useScroll,
  useTransform,
} from "framer-motion";
import SmartImage from "../../../components/common/SmartImage.jsx";
import {
  DoodleBrandMark,
  DoodleChai,
  DoodleLeaf,
  DoodleSamosa,
  DoodleSparkle,
  DoodleSteam,
} from "../../../components/common/doodles.jsx";
import { HERO_IMAGES } from "../../../lib/landingImages.js";
import { Barcode, Docket, Halftone, Scribble, Stamp, Tape } from "../kit.jsx";
import {
  HERO_DOCKET,
  HERO_NOTES,
  HERO_STAMPS,
  SATELLITES,
} from "../data.js";

/**
 * A layer that drifts against the scroll. Driven by Framer's useScroll against
 * the hero's own ref, so the values never touch the main thread the way a
 * scroll listener would. Collapses to no transform under reduced motion.
 */
function Drifter({ progress, distance = 30, className = "", children }) {
  const reduced = useReducedMotion();
  const y = useTransform(progress, [0, 1], [distance, -distance]);

  return (
    <motion.div className={className} style={reduced ? undefined : { y }}>
      {children}
    </motion.div>
  );
}

/** One circular satellite badge, pinned into a margin. */
function Satellite({ value, label, className, rotate, progress, index }) {
  const reduced = useReducedMotion();
  const distance = 18 + index * 14;

  return (
    <Drifter progress={progress} distance={distance} className={className}>
      <motion.div
        initial={reduced ? false : { scale: 0.6, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={
          reduced
            ? undefined
            : { type: "spring", stiffness: 180, damping: 14, delay: 0.3 + index * 0.08 }
        }
        style={{ rotate: reduced ? undefined : rotate }}
        className="relative grid h-[86px] w-[86px] place-items-center rounded-full border-[5px] border-white bg-white sm:h-[104px] sm:w-[104px]"
      >
        {/* Dashed inner ring, like a seal. */}
        <span
          aria-hidden="true"
          className="absolute inset-[7px] rounded-full border-2 border-dashed border-pine/25"
        />
        <div className="relative leading-none">
          <div className="font-mono-stack text-lg font-bold text-pine sm:text-xl">
            {value}
          </div>
          <div className="mt-1 px-1 text-[8px] font-semibold uppercase tracking-[0.12em] text-moss sm:text-[9px]">
            {label}
          </div>
        </div>
      </motion.div>
    </Drifter>
  );
}

/** A handwritten margin note, optionally underlined with a pen stroke. */
function Note({ text, className, rotate, underline }) {
  const reduced = useReducedMotion();

  return (
    <motion.p
      initial={reduced ? false : { opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={reduced ? undefined : { duration: 0.5, delay: 0.6 }}
      style={{ rotate: reduced ? undefined : rotate }}
      className={`font-hand absolute z-20 whitespace-nowrap text-2xl text-pine sm:text-3xl ${className}`}
    >
      {text}
      {underline ? (
        <Scribble className="absolute -bottom-1 left-0 h-2.5 w-full text-pine/60" />
      ) : null}
    </motion.p>
  );
}

/**
 * Section 2 — Hero composition, built as a stack of paper rather than a photo
 * in a box: the ticket docket sits behind and slightly off-axis, the photo
 * overlaps it, and tape, stamps and annotations hold the whole thing together.
 *
 * The docket and the photo travel at different rates on scroll, so the stack
 * separates as you scroll instead of moving as one flat card.
 */
export default function Hero() {
  const ref = useRef(null);
  const reduced = useReducedMotion();
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start start", "end start"],
  });
  const photoY = useTransform(scrollYProgress, [0, 1], [0, -70]);
  const docketY = useTransform(scrollYProgress, [0, 1], [0, -160]);
  const logoRotate = useTransform(scrollYProgress, [0, 1], [0, 14]);

  return (
    <section
      ref={ref}
      aria-labelledby="sb-hero-title"
      className="relative isolate flex flex-col items-center overflow-hidden px-4 pb-28 pt-6 sm:pt-10"
    >
      {/* Printed-dot field, standing in for a shadow the page is not allowed. */}
      <Halftone className="-left-8 top-[16%] h-44 w-44 text-forest opacity-25" />
      <Halftone className="-right-6 bottom-[8%] h-32 w-32 text-stamp opacity-20" />

      {/* Oversized, deliberately off-axis logo. */}
      <motion.div
        initial={reduced ? false : { scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={reduced ? undefined : { type: "spring", stiffness: 120, damping: 16 }}
        style={reduced ? undefined : { rotate: logoRotate }}
        className="relative z-10 text-ink"
      >
        <DoodleBrandMark size={210} className="sm:hidden" />
        <DoodleBrandMark size={300} className="hidden sm:block" />
        <DoodleLeaf
          size={54}
          className="absolute -right-6 -top-2 rotate-[18deg] text-forest sm:-right-10"
        />
        <DoodleSparkle
          size={38}
          className="absolute -left-8 top-10 text-forest sm:-left-14"
        />
      </motion.div>

      {/* Deliberately NOT "Hot food. Zero queue." — that is the landing hero's
          line (landing/sections.jsx HERO_LINES). Two heroes on one product
          saying the same thing reads as a repeat, so this one leads on the
          time promise instead, which is the part the docket motif is about. */}
      <h1
        id="sb-hero-title"
        className="relative z-10 mt-3 text-center text-4xl font-black leading-[0.9] tracking-tight text-ink sm:text-6xl"
      >
        <span className="relative inline-block">
          Plated before
          <Scribble className="absolute -bottom-3 left-0 h-3 w-full text-stamp" />
        </span>
        <br />
        you&rsquo;ve sat down.
      </h1>

      {/* Hand-drawn canteen doodles, pinned into the whitespace. */}
      <DoodleChai
        size={72}
        className="sway absolute top-[30%] left-[3%] z-10 rotate-[-10deg] text-forest/70 sm:left-[6%]"
      />
      <DoodleSamosa
        size={62}
        className="sway absolute top-[24%] right-[5%] z-10 rotate-[12deg] text-stamp/70 sm:right-[8%]"
      />
      <DoodleSteam
        size={54}
        className="absolute left-1/2 top-[46%] z-10 -translate-x-1/2 text-forest/50"
      />

      {/* The paper stack. Relative box so the docket can hang off the edge. */}
      <div className="relative z-10 mt-10 w-[80vw] max-w-[360px] sm:mt-14 sm:max-w-[440px]">
        {/* Docket, behind, offset up and to the right, torn top and bottom. */}
        <motion.div
          style={reduced ? undefined : { y: docketY }}
          className="absolute -right-3 -top-10 w-[78%] rotate-[6deg] sm:-right-8 sm:-top-14 sm:w-[70%]"
        >
          <Tape className="-left-4 -top-3 z-10" rotate={-7} width="w-20" />
          <Docket
            serial={HERO_DOCKET.serial}
            window={HERO_DOCKET.window}
            stall={HERO_DOCKET.stall}
            className="hard-shadow"
          >
            <Barcode
              digits={HERO_DOCKET.barcode}
              height="h-7"
              className="mt-4"
            />
            <p className="mt-3 font-hand text-base leading-tight text-moss">
              {HERO_DOCKET.note}
            </p>
          </Docket>
        </motion.div>

        {/* Photo in front. Entrance and scroll drift are on separate nodes:
            a style MotionValue outranks `animate`, so sharing one element
            would silently kill the entrance. */}
        <motion.div
          initial={reduced ? false : { y: 40, opacity: 0, rotate: -10 }}
          animate={{ y: 0, opacity: 1, rotate: -4 }}
          transition={reduced ? undefined : { type: "spring", stiffness: 100, damping: 15 }}
          className="relative"
        >
          <motion.div
            style={reduced ? undefined : { y: photoY }}
            className="border-[10px] border-white bg-white sm:border-[14px]"
          >
            <SmartImage
              src={HERO_IMAGES.main}
              alt="A freshly plated hot meal"
              width={1200}
              height={900}
              sizes="(max-width: 640px) 80vw, 440px"
              quality={78}
              className="block aspect-[4/3] w-full object-cover"
            />
          </motion.div>

          {/* The stamp that says this order is settled. */}
          <Stamp
            rotate={-12}
            delay={0.55}
            size="text-base"
            className="absolute -bottom-5 -left-4 sm:-left-8"
          >
            Paid
          </Stamp>
        </motion.div>
      </div>

      {SATELLITES.map((s, i) => (
        <Satellite key={s.label} {...s} index={i} progress={scrollYProgress} />
      ))}

      {HERO_STAMPS.map((s) => (
        <div key={s.text} className={`absolute z-20 ${s.className}`}>
          <Stamp rotate={s.rotate} size={s.size}>
            {s.text}
          </Stamp>
        </div>
      ))}

      {HERO_NOTES.map((n) => (
        <Note key={n.text} {...n} />
      ))}
    </section>
  );
}
