import React from "react";
import { Link } from "react-router-dom";
import { motion, useTransform } from "framer-motion";
import SmartImage from "../common/SmartImage.jsx";
import {
  DoodleArrowRight,
  DoodleBurst,
  DoodleCheck,
  DoodleDotGrid,
  DoodleHills,
  DoodleLeaf,
  DoodleRing,
  DoodleSparkle,
  DoodleSprig,
  DoodleSquiggle,
  DoodleSteam,
  DoodleSun,
  DOODLE_ART,
} from "../common/doodles.jsx";
import { BAND_IMAGE, FAQS, FEATURES, GALLERY, STEPS } from "../../lib/landingImages.js";
import {
  ParallaxLayer,
  Reveal,
  RevealGroup,
  SpringReveal,
  useAccordion,
  useDrawProgress,
  useMagnetic,
  useReducedMotion,
  useScrollFloat,
} from "./motion.jsx";
import { FEATURE_ICONS, hashLinkHandler } from "./shared.jsx";

/* ================================================================== *
 * How it works
 * ================================================================== */

const CONNECTOR_D = "M60 40 C 240 200 420 200 600 60 C 720 -30 800 40 860 90";

/**
 * The winding route behind the numbered steps. A faint solid track is always
 * drawn so the path reads as a route, and the dotted overlay marches into
 * existence as the section scrolls past: pathLength is normalised to 1, so the
 * dash offset is just the same 0..1 progress and no pixel measurement is
 * needed. Under prefers-reduced-motion useDrawProgress returns 1, which parks
 * the offset at 0 and leaves the line fully drawn.
 */
function WindingConnector() {
  const ref = React.useRef(null);
  const progress = useDrawProgress(ref, { start: 0.15, end: 0.8 });
  const dashOffset = useTransform(progress, [0, 1], [1, 0]);

  return (
    <svg
      ref={ref}
      className="lp-steps-connector"
      viewBox="0 0 900 200"
      preserveAspectRatio="none"
      aria-hidden="true"
    >
      <path
        d={CONNECTOR_D}
        fill="none"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
        className="lp-steps-connector-track"
      />
      <path
        d={CONNECTOR_D}
        fill="none"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
        pathLength="1"
        strokeDasharray="0.003 0.022"
        style={{ strokeDashoffset: dashOffset }}
        className="lp-steps-connector-draw"
      />
    </svg>
  );
}

export function HowItWorks() {
  return (
    <section className="lp-section lp-how" id="how" aria-labelledby="lp-how-title">
      <div className="lp-section-inner">
        <Reveal className="lp-section-head">
          <span className="lp-kicker">How it works</span>
          <h2 id="lp-how-title" className="lp-section-title">
            Three taps between you and a hot meal
          </h2>
          <DoodleSquiggle className="lp-section-squiggle" size={200} />
        </Reveal>

        <div className="lp-steps">
          {/* Route that draws itself as the section scrolls past */}
          <WindingConnector />

          {STEPS.map((s, i) => (
            <SpringReveal
              key={s.step}
              className="lp-step"
              delay={i * 0.09}
              distance={28}
            >
              <div className="lp-step-num">
                <span className="lp-step-num-text">{s.step}</span>
                <DoodleRing className="lp-step-ring" />
              </div>

              <figure className="lp-step-photo">
                <SmartImage
                  src={s.image}
                  alt={s.alt}
                  width={720}
                  height={540}
                  sizes="(max-width: 760px) 78vw, 280px"
                  quality={76}
                  className="lp-img"
                />
              </figure>

              <span className="lp-step-kicker">{s.kicker}</span>
              <h3 className="lp-step-title">{s.title}</h3>
              <p className="lp-step-body">{s.body}</p>
            </SpringReveal>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ================================================================== *
 * Feature bento
 * ================================================================== */

/** Pointer-tracked spotlight plus a magnetic lift. Both are inert on touch
 *  and under reduced motion — `useMagnetic` bails out on coarse pointers and
 *  `useReducedMotion` parks the transform at its resting value. The card
 *  tracks the cursor via two custom properties so the highlight itself stays a
 *  pure CSS radial-gradient rather than a repainted canvas. */
function BentoCard({ feature }) {
  const cardRef = useMagnetic({ strength: 0.09 });
  const reduced = useReducedMotion();

  const track = (e) => {
    const el = cardRef.current;
    if (!el || reduced) return;
    const r = el.getBoundingClientRect();
    el.style.setProperty("--lp-spot-x", `${(e.clientX - r.left).toFixed(1)}px`);
    el.style.setProperty("--lp-spot-y", `${(e.clientY - r.top).toFixed(1)}px`);
  };

  const Icon = FEATURE_ICONS[feature.icon] || DoodleSparkle;

  return (
    <article
      ref={cardRef}
      className={`lp-bento-card lp-bento-${feature.size}`}
      onPointerMove={track}
    >
      <span className="lp-bento-spot" aria-hidden="true" />
      <span className="lp-bento-icon" aria-hidden="true">
        <Icon size={feature.size === "tall" ? 44 : 36} />
      </span>
      <h3 className="lp-bento-title">{feature.title}</h3>
      <p className="lp-bento-body">{feature.body}</p>
      <DoodleSparkle className="lp-bento-spark" size={20} />
    </article>
  );
}

export function Features() {
  return (
    <section
      className="lp-section lp-features"
      id="features"
      aria-labelledby="lp-features-title"
    >
      <div className="lp-section-inner">
        <Reveal className="lp-section-head">
          <span className="lp-kicker">Built for a real canteen</span>
          <h2 id="lp-features-title" className="lp-section-title">
            Everything the queue never told you
          </h2>
          <DoodleBurst className="lp-section-burst" size={40} />
        </Reveal>

        <RevealGroup className="lp-bento" stagger={80}>
          {FEATURES.map((f) => (
            <BentoCard feature={f} key={f.title} />
          ))}
        </RevealGroup>
      </div>
    </section>
  );
}

/* ================================================================== *
 * Full-bleed parallax photo band
 * ================================================================== */

export function PhotoBand() {
  return (
    <section className="lp-band" aria-label="A campus canteen at lunchtime">
      <div className="lp-band-frame">
        <ParallaxLayer className="lp-band-media" strength={0.14}>
          <div className="lp-band-media-inner">
            <SmartImage
              src={BAND_IMAGE.image}
              alt={BAND_IMAGE.alt}
              width={BAND_IMAGE.width}
              height={BAND_IMAGE.height}
              sizes="100vw"
              widths={[640, 1080, 1400, 2000]}
              quality={72}
              className="lp-band-img"
            />
          </div>
        </ParallaxLayer>
        <div className="lp-band-scrim" aria-hidden="true" />
        {/*
          The pull-quote that used to sit here was invented - a made-up
          student attributed to "Final-year engineering, hostel block C",
          and the section was labelled "What students say" as if the quote
          were real feedback. The reviews table is the only honest source of
          student sentiment in this app, so nothing here claims to be a
          quote until there are real ones to draw from.
        */}
        <Reveal className="lp-band-quote-wrap" distance={24}>
          <p className="lp-band-line">
            Your order is plated the minute you step out of class.
          </p>
          <p className="lp-band-cite">
            <DoodleCheck size={26} />
            Reserve a slot, pay from your wallet, walk past the queue
          </p>
        </Reveal>
      </div>
    </section>
  );
}

/* ================================================================== *
 * Counter gallery
 * ================================================================== */

export function CounterGallery() {
  const trackRef = React.useRef(null);

  // Drag-to-scroll on pointer devices; native momentum on touch.
  const onPointerDown = (e) => {
    const el = trackRef.current;
    if (!el || e.pointerType === "touch") return;
    const startX = e.clientX;
    const startScroll = el.scrollLeft;
    el.setPointerCapture(e.pointerId);
    el.classList.add("is-dragging");

    const onMove = (ev) => {
      el.scrollLeft = startScroll - (ev.clientX - startX);
    };
    const onUp = () => {
      el.classList.remove("is-dragging");
      el.removeEventListener("pointermove", onMove);
      el.removeEventListener("pointerup", onUp);
    };
    el.addEventListener("pointermove", onMove);
    el.addEventListener("pointerup", onUp);
  };

  return (
    <section
      className="lp-section lp-counter"
      id="counter"
      aria-labelledby="lp-counter-title"
    >
      <div className="lp-section-inner">
        <Reveal className="lp-section-head">
          <span className="lp-kicker">What&rsquo;s on the counter</span>
          <h2 id="lp-counter-title" className="lp-section-title">
            Real stalls, real food, real photos
          </h2>
          <p className="lp-section-note">
            Every stall publishes a live menu with a real preparation time, so what you see
            is what lands on your tray.
          </p>
        </Reveal>
      </div>

      <RevealGroup className="lp-gallery" stagger={70}>
        {GALLERY.map((g) => (
          <figure className="lp-gallery-item" key={g.image}>
            <SmartImage
              src={g.image}
              alt={g.caption}
              width={g.width}
              height={g.height}
              sizes="(max-width: 600px) 68vw, (max-width: 1000px) 40vw, 300px"
              widths={[320, 480, 640, 800, 1200]}
              quality={74}
              className="lp-gallery-img"
            />
            <figcaption className="lp-gallery-cap">
              <span className="lp-gallery-caption">{g.caption}</span>
              <span className="lp-gallery-note mono">{g.note}</span>
            </figcaption>
          </figure>
        ))}
      </RevealGroup>

      <div
        className="lp-gallery-rail"
        ref={trackRef}
        onPointerDown={onPointerDown}
        role="presentation"
      >
        <span className="lp-gallery-rail-hint mono" aria-hidden="true">
          drag
        </span>
      </div>
    </section>
  );
}

/* ================================================================== *
 * Doodle art showcase
 * ================================================================== */

export function DoodleShowcase() {
  return (
    <section className="lp-section lp-art" aria-labelledby="lp-art-title">
      <div className="lp-section-inner">
        <Reveal className="lp-section-head">
          <span className="lp-kicker">Drawn by hand</span>
          <h2 id="lp-art-title" className="lp-section-title">
            The whole app is illustrated in one pen
          </h2>
          <p className="lp-section-note">
            Every mark you see across Canteen Booking &mdash; the leaf in the logo, the arrow
            that points at checkout, the thali on an empty state &mdash; is a single
            hand-drawn stroke in the same colour as the food it describes.
          </p>
        </Reveal>

        <RevealGroup className="lp-art-grid" stagger={45}>
          {DOODLE_ART.map(({ key, label, Icon }) => (
            <figure className="lp-art-tile" key={key}>
              <span className="lp-art-mark" aria-hidden="true">
                <Icon size={46} />
              </span>
              <figcaption className="lp-art-label">{label}</figcaption>
            </figure>
          ))}
        </RevealGroup>

        <Reveal className="lp-art-foot" delay={120}>
          <DoodleSquiggle size={260} className="lp-art-foot-squiggle" />
        </Reveal>
      </div>
    </section>
  );
}

/* ================================================================== *
 * FAQ
 * ================================================================== */

export function Faq() {
  const [open, toggle] = useAccordion(0);
  const reduced = useReducedMotion();

  return (
    <section className="lp-section lp-faq" id="faq" aria-labelledby="lp-faq-title">
      <div className="lp-section-inner lp-faq-inner">
        <Reveal className="lp-faq-intro">
          <span className="lp-kicker">Questions</span>
          <h2 id="lp-faq-title" className="lp-section-title">
            Before you hit order
          </h2>
          <DoodleSprig className="lp-faq-sprig" size={70} />
        </Reveal>

        <RevealGroup className="lp-faq-list" stagger={60} delay={80}>
          {FAQS.map((item, i) => {
            const isOpen = open === i;
            return (
              <div className={`lp-faq-item ${isOpen ? "is-open" : ""}`} key={item.q}>
                <h3>
                  <button
                    type="button"
                    id={`lp-faq-q-${i}`}
                    className="lp-faq-q"
                    aria-expanded={isOpen}
                    aria-controls={`lp-faq-panel-${i}`}
                    onClick={() => toggle(i)}
                  >
                    <span>{item.q}</span>
                    <span className="lp-faq-sign" aria-hidden="true">
                      <span className="lp-faq-sign-h" />
                      <span className="lp-faq-sign-v" />
                    </span>
                  </button>
                </h3>
                {/* The panel stays mounted whether open or not. Unmounting it
                    (AnimatePresence) breaks the button's aria-controls, which
                    would then point at an id that does not exist. Collapsing is
                    done with a framer height transition instead, and the closed
                    panel is taken out of the accessibility tree with
                    aria-hidden. It holds a single <p>, so there is nothing
                    focusable left behind when collapsed. */}
                <motion.div
                  id={`lp-faq-panel-${i}`}
                  className="lp-faq-a"
                  role="region"
                  aria-labelledby={`lp-faq-q-${i}`}
                  aria-hidden={!isOpen}
                  initial={false}
                  animate={{ height: isOpen ? "auto" : 0, opacity: isOpen ? 1 : 0 }}
                  transition={
                    reduced
                      ? { duration: 0 }
                      : { height: { duration: 0.34, ease: [0.16, 1, 0.3, 1] },
                          opacity: { duration: 0.22, ease: "linear" } }
                  }
                  style={reduced ? undefined : { overflow: "hidden" }}
                >
                  <p>{item.a}</p>
                </motion.div>
              </div>
            );
          })}
        </RevealGroup>
      </div>
    </section>
  );
}

/* ================================================================== *
 * Closing CTA
 * ================================================================== */

/**
 * A doodle in the closing band, drifting against the scroll.
 *
 * The drift and the doodle's own idle loop are deliberately split across two
 * elements. Each of these marks already carries a CSS keyframe animation
 * (spin / sway / steam) that writes `transform`, and a running CSS animation
 * outranks an inline style for the same property — so driving both from one
 * node means the scroll drift is silently dropped. The outer span takes the
 * scroll-linked transform from framer, the inner svg keeps its ambient loop,
 * and the two compose.
 */
function CtaDoodle({ children, className = "", distance = 30, rotate = 0 }) {
  const ref = React.useRef(null);
  const style = useScrollFloat(ref, { distance, rotate });
  return (
    <motion.span ref={ref} className={`lp-cta-drift ${className}`.trim()} style={style}>
      {children}
    </motion.span>
  );
}

export function ClosingCta({ primaryHref, signedIn }) {
  return (
    <section className="lp-cta" aria-labelledby="lp-cta-title">
      <div className="lp-cta-art" aria-hidden="true">
        <CtaDoodle className="lp-cta-drift-1" distance={46} rotate={9}>
          <DoodleSun className="lp-cta-doodle lp-cta-doodle-1" size={110} />
        </CtaDoodle>
        <CtaDoodle className="lp-cta-drift-2" distance={34} rotate={-14}>
          <DoodleLeaf className="lp-cta-doodle lp-cta-doodle-2" size={64} />
        </CtaDoodle>
        <CtaDoodle className="lp-cta-drift-3" distance={24} rotate={6}>
          <DoodleSteam className="lp-cta-doodle lp-cta-doodle-3" size={70} />
        </CtaDoodle>
        <DoodleHills className="lp-cta-hills" />
      </div>

      <Reveal className="lp-cta-inner" distance={24}>
        <h2 id="lp-cta-title" className="lp-cta-title">
          {signedIn ? "Your next meal is already waiting" : "Stop losing lunch to a queue"}
        </h2>
        <p className="lp-cta-lede">
          {signedIn
            ? "Pick up where you left off — your slots, wallet, and meal passes are all synced."
            : "One phone number gets you a wallet, a timetable, a set of pickup slots, and the nearest fresh stall."}
        </p>
        <Link to={primaryHref} className="lp-btn lp-btn-cream lp-btn-lg">
          {signedIn ? "Open your app" : "Get started free"}
          <DoodleArrowRight size={38} className="lp-btn-arrow" />
        </Link>
      </Reveal>
    </section>
  );
}
