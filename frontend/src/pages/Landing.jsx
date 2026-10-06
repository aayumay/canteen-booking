import { useAuth } from "../hooks/useAuth.js";
import { Hero, LandingFooter, LandingNav } from "../components/landing/sections.jsx";
import BelowFold from "../components/landing/BelowFold.jsx";
import { usePauseLoopsOffscreen, useScrolledPast, useScrollProgress } from "../components/landing/motion.jsx";
import "../landing.css";

export default function Landing() {
  const { isAuthenticated, user, isSessionReady } = useAuth();
  const isPast = useScrolledPast(24);
  const progress = useScrollProgress();
  // Infinite decorative loops stop consuming compositor time while off-screen.
  usePauseLoopsOffscreen();

  // Signed-in visitors get a direct line into the portal they belong to.
  const signedIn = isAuthenticated && Boolean(user);
  const primaryHref =
    !isSessionReady || !signedIn
      ? "/login"
      : user.role === "vendor"
        ? "/vendor"
        : user.role === "admin"
          ? "/admin"
          : "/student";

  return (
    <div className="lp-root">
      <a className="lp-skip" href="#lp-hero-title">
        Skip to content
      </a>

      <LandingNav
        primaryHref={primaryHref}
        signedIn={signedIn}
        isPast={isPast}
        progress={progress}
      />

      <main className="lp-main">
        <Hero primaryHref={primaryHref} signedIn={signedIn} />
        <BelowFold primaryHref={primaryHref} signedIn={signedIn} />
      </main>

      <LandingFooter />
    </div>
  );
}
