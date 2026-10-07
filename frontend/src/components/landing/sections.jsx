import React, { useId } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import SmartImage from "../common/SmartImage.jsx";
import {
  DoodleArrow,
  DoodleArrowRight,
  DoodleDotGrid,
  DoodleHatch,
  DoodleLeaf,
  DoodleSparkle,
  DoodleSprig,
  DoodleSteam,
} from "../common/doodles.jsx";
import { HERO_IMAGES } from "../../lib/landingImages.js";
import {
  Reveal,
  useMagnetic,
  usePointerParallax,
  useScrollFloat,
} from "./motion.jsx";
import { Wordmark, hashLinkHandler } from "./shared.jsx";

/* ================================================================== *
 * Navigation
 * ================================================================== */

const NAV_LINKS = [
  { href: "#how", label: "How it works" },
  { href: "#features", label: "Features" },
  { href: "#counter", label: "The counter" },
  { href: "#faq", label: "FAQ" },
];

export function LandingNav({ primaryHref, signedIn, isPast, progress = 0 }) {
  const [open, setOpen] = React.useState(false);
  const drawerId = useId();
  const go = hashLinkHandler(setOpen);

  // Lock the page behind the mobile drawer without a layout jump.
  React.useEffect(() => {
    if (!open) return undefined;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <>
      <header className={`lp-nav ${isPast ? "is-scrolled" : ""}`}>
        <div className="lp-nav-inner">
          <Link to="/landing" className="lp-nav-brand" aria-label="Canteen Booking home">
            <Wordmark />
          </Link>

          <nav className="lp-nav-links" aria-label="Sections">
            {NAV_LINKS.map((l) => (
              <a key={l.href} href={l.href} className="lp-nav-link" onClick={go}>
                {l.label}
              </a>
            ))}
          </nav>

          <div className="lp-nav-actions">
            {!signedIn && (
              <Link to="/login" className="lp-btn lp-btn-ghost lp-btn-sm">
                Sign in
              </Link>
            )}
            <Link to={primaryHref} className="lp-btn lp-btn-primary lp-btn-sm">
              {signedIn ? "Open app" : "Order now"}
              <DoodleArrowRight size={34} className="lp-btn-arrow" />
            </Link>
            <button
              type="button"
              className="lp-burger"
              onClick={() => setOpen((v) => !v)}
              aria-expanded={open}
              aria-controls={drawerId}
              aria-label={open ? "Close menu" : "Open menu"}
            >
              <span className={open ? "is-x" : ""} />
              <span className={open ? "is-x" : ""} />
            </button>
          </div>
        </div>
        <div className="lp-nav-progress" aria-hidden="true">
          <span style={{ transform: `scaleX(${progress})` }} />
        </div>
      </header>

      {/* Mobile drawer */}
      <div
        id={drawerId}
        className={`lp-drawer ${open ? "is-open" : ""}`}
        hidden={!open}
        role="dialog"
        aria-modal="true"
        aria-label="Menu"
      >
        <div className="lp-drawer-art" aria-hidden="true">
          <DoodleSprig className="lp-drawer-doodle lp-drawer-doodle-1" />
          <DoodleSteam className="lp-drawer-doodle lp-drawer-doodle-2" />
          <DoodleSparkle className="lp-drawer-doodle lp-drawer-doodle-3" />
        </div>
        <nav className="lp-drawer-links">
          {NAV_LINKS.map((l, i) => (
            <a
              key={l.href}
              href={l.href}
              className="lp-drawer-link"
              style={{ "--lp-stagger": `${i * 55}ms` }}
              onClick={go}
            >
              <span className="lp-drawer-num mono">0{i + 1}</span>
              {l.label}
            </a>
          ))}
        </nav>
        <div className="lp-drawer-actions">
          <Link
            to={primaryHref}
            className="lp-btn lp-btn-cream lp-btn-block"
            onClick={() => setOpen(false)}
          >
            {signedIn ? "Open app" : "Order now"}
          </Link>
          {!signedIn && (
            <Link
              to="/login"
              className="lp-btn lp-btn-outline-cream lp-btn-block"
              onClick={() => setOpen(false)}
            >
              Sign in
            </Link>
          )}
        </div>
      </div>
    </>
  );
}

/* ================================================================== *
 * Hero
 * ================================================================== */

function HeroCollage() {
  const pointerRef = usePointerParallax(14);
  const badgePathId = `lp-badge-path-${useId().replace(/[^a-zA-Z0-9]/g, "")}`;

  return (
    <div className="lp-collage" ref={pointerRef}>
      <div className="lp-collage-halo" aria-hidden="true" />
      <DoodleDotGrid className="lp-collage-dots" size={220} />

      <figure className="lp-collage-main lp-collage-float-a">
        <SmartImage
          src={HERO_IMAGES.main}
          alt="A freshly plated vegetarian thali on a steel tray"
          width={900}
          height={1125}
          sizes="(max-width: 900px) 62vw, 320px"
          quality={78}
          priority
          className="lp-img"
        />
        <figcaption className="lp-collage-tag mono">Ready in 10 min</figcaption>
      </figure>

      <figure className="lp-collage-side lp-collage-float-b">
        <SmartImage
          src={HERO_IMAGES.greens}
          alt="A fresh salad bowl of greens"
          width={600}
          height={600}
          sizes="(max-width: 900px) 30vw, 175px"
          quality={74}
          className="lp-img"
        />
      </figure>

      <figure className="lp-collage-wide lp-collage-float-c">
        <SmartImage
          src={HERO_IMAGES.counter}
          alt="A warm canteen counter being served"
          width={760}
          height={480}
          sizes="(max-width: 900px) 50vw, 230px"
          quality={74}
          className="lp-img"
        />
      </figure>

      {/* Rotating circular badge — the signature editorial detail */}
      <div className="lp-badge" aria-hidden="true">
        <svg viewBox="0 0 120 120" className="lp-badge-svg">
          <defs>
            <path id={badgePathId} d="M60,60 m-42,0 a42,42 0 1,1 84,0 a42,42 0 1,1 -84,0" />
          </defs>
          <text className="lp-badge-text">
            <textPath href={`#${badgePathId}`} startOffset="0">
              ORDER AHEAD · SKIP THE LINE · PICK UP HOT ·
            </textPath>
          </text>
        </svg>
        <span className="lp-badge-core">
          <DoodleLeaf size={30} />
        </span>
      </div>

      <DoodleSparkle className="lp-collage-spark lp-collage-spark-1" size={30} />
      <DoodleSparkle className="lp-collage-spark lp-collage-spark-2" size={22} />
      <DoodleSteam className="lp-collage-steam" size={40} />
    </div>
  );
}

export function Hero({ primaryHref, signedIn }) {
  const ctaRef = useMagnetic({ strength: 0.2 });
  // Scroll-linked drift for the collage. The collage already has slow ambient
  // float keyframes; this layers an actual scroll response on top, driven by
  // Framer's useScroll rather than a scroll listener. Collapses to {} under
  // prefers-reduced-motion, where the ambient loop is already switched off.
  const artRef = React.useRef(null);
  const artFloat = useScrollFloat(artRef, { distance: 40, rotate: 2.5 });
  const go = hashLinkHandler();

  return (
    <section className="lp-hero" aria-labelledby="lp-hero-title">
      <div className="lp-hero-bg" aria-hidden="true">
        <span className="lp-hero-glow" />
        <span className="lp-drift lp-drift-1" />
        <span className="lp-drift lp-drift-2" />
        <span className="lp-drift lp-drift-3" />
        <DoodleDotGrid className="lp-hero-grid" size={200} />
        <DoodleHatch className="lp-hero-hatch" size={340} />
      </div>

      <div className="lp-hero-inner">
        <div className="lp-hero-copy">

          <h1 id="lp-hero-title" className="hero-heading">
            <span className="hero-line hero-script">
              Hot food.
              <span className="accent-rays" aria-hidden="true">〰</span>
            </span>

            <span className="hero-line hero-zero">
              <span className="zero-highlight">Zero</span>
              <span className="queue-highlight"> queue.</span>
              <span className="highlight-oval" aria-hidden="true" />
            </span>

            <span className="hero-line hero-editorial">
              Ready when class
              <br />
              ends.
            </span>
          </h1>

          <Reveal delay={470} distance={18}>
            <p className="lp-hero-lede">
              Reserve a pickup window, pay from your campus wallet, and walk past the queue
              entirely. Your order is plated the minute you step out of class.
            </p>
          </Reveal>

          <Reveal delay={560} distance={18} className="lp-hero-cta-wrap">
            <div className="lp-hero-cta" ref={ctaRef}>
              <Link to={primaryHref} className="lp-btn lp-btn-primary lp-btn-lg">
                {signedIn ? "Open your app" : "Start pre-ordering"}
                <DoodleArrowRight size={38} className="lp-btn-arrow" />
              </Link>
              <a href="#how" className="lp-btn lp-btn-quiet lp-btn-lg" onClick={go}>
                See how it works
              </a>
            </div>
            <DoodleArrow className="lp-hero-arrow" size={78} />
          </Reveal>

          {/* Sits here rather than pinned to the hero's bottom edge: in the
              flow of the copy it can never land below the fold, and it needs
              no breakpoint to decide whether there is room for it. */}
          <a className="lp-scroll-cue" href="#how" onClick={go} aria-label="Scroll down">
            <span className="lp-scroll-cue-line" aria-hidden="true" />
            <span className="lp-scroll-cue-text">Scroll</span>
          </a>
        </div>

        <Reveal className="lp-hero-art-wrap" delay={220} distance={30} direction="left">
          <motion.div ref={artRef} className="lp-hero-art" style={artFloat}>
            <HeroCollage />
          </motion.div>
        </Reveal>
      </div>
    </section>
  );
}

/* ================================================================== *
 * How it works lives in sectionsBelow.jsx
 * ================================================================== */

/*
 * The animated "in numbers" band that used to sit here was deleted. Its four
 * figures - 10 min average plate time, 0 min queue, 100% nutrition coverage,
 * Rs 5 off - were hardcoded and unmeasured: there is no analytics table
 * behind them, and "100% nutrition and allergen data on every dish" was
 * actively false, since every nutrition column is optional and unset on the
 * seeded menu. A count-up animation makes a number feel measured, which is
 * exactly why the numbers could not stay.
 *
 * Nothing replaces it in this slot. The page already runs Hero -> HowItWorks,
 * so the story continues without a filler section, and there is no real
 * "N orders / N vendors" figure worth printing yet.
 *
 * The feature ticker that followed the footer was removed as well. It read as
 * a slogan strip rather than information, and its 35s infinite translateX on a
 * track several thousand pixels wide was the single most expensive thing on
 * the page for the compositor. The specific claims it carried ("zero queues",
 * "live order tracking") were also the same unmeasured-flavour problem.
 *
 * The pickup-window picker was removed from the hero for the same reason the
 * numbers were: it looked like a working booking control but reserved nothing.
 * A student could tap a fifteen-minute window there and leave with the
 * impression that a slot was held, which is a promise the page cannot keep.
 * Until picking a window actually reserves one, the honest version of this
 * screen is the primary CTA and nothing beside it.
 *
 * Removing it also retired the page's only layout instability. The chips were
 * set in the mono face, which loads from Google Fonts and is not preloaded;
 * with flex-wrap, the late swap re-measured the row and the hero gained 44px,
 * shoving everything below it down the page (0.10 CLS on a cold cache).
 */


/* ================================================================== *
 * Footer
 * ================================================================== */

export function LandingFooter() {
  return (
    <footer className="lp-footer">
      <div className="lp-footer-inner">
        <div className="lp-footer-brand">
          <Wordmark tone="cream" />
          <p className="lp-footer-tag">
            Skip the queue, keep the wallet, waste less. Built for campus canteens.
          </p>
          <DoodleSprig className="lp-footer-doodle" size={54} />
        </div>

        <nav className="lp-footer-cols" aria-label="Footer">
          <div className="lp-footer-col">
            <h4>Product</h4>
            <a href="#how">How it works</a>
            <a href="#features">Features</a>
            <a href="#counter">The counter</a>
            <a href="#faq">FAQ</a>
          </div>
          <div className="lp-footer-col">
            <h4>For students</h4>
            <Link to="/login">Sign in</Link>
            <Link to="/login">Campus wallet</Link>
            <Link to="/login">Meal passes</Link>
            <Link to="/login">Timetable</Link>
          </div>
          <div className="lp-footer-col">
            <h4>For canteens</h4>
            <Link to="/login">Register a stall</Link>
            <Link to="/login">Vendor portal</Link>
            <Link to="/login">Admin dashboard</Link>
          </div>
        </nav>
      </div>

      <div className="lp-footer-base">
        <span className="mono">© {new Date().getFullYear()} Canteen Booking</span>
        <span className="lp-footer-base-note">
          Real photographs, real hand-drawn doodles, no emoji.
        </span>
      </div>
    </footer>
  );
}
