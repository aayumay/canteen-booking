import { motion } from "framer-motion";
import { useId } from "react";

/**
 * The canteen mascot: a friendly plated bite with a forest-green glaze.
 *
 * Two things worth noting:
 *  - Gradient/mask ids are generated per instance via `useId`, so several
 *    mascots on one screen no longer cross-wire and render the wrong colour.
 *  - The palette is the app palette (forest → leaf → amber). It used to carry
 *    an off-brand lime that fought the sage/forest design system.
 */
export default function Mascot({
  size = 36,
  variant = "default",
  tilt = 0,
  isBouncing = false,
  className = "",
  style = {},
}) {
  const isPulse = variant === "pulse";
  const isDetailed = variant === "detailed" || variant === "pizza";
  const uid = useId().replace(/[^a-zA-Z0-9]/g, "");
  const glazeId = `mascotGlaze-${uid}`;
  const crustId = `mascotCrust-${uid}`;
  const biteId = `mascotBite-${uid}`;

  const numSize = typeof size === "number" ? size : parseInt(size, 10) || 36;

  return (
    <motion.div
      className={`mascot-container ${className}`}
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        width: numSize,
        height: numSize,
        ...style,
      }}
      animate={{
        rotate: tilt,
        scale: isPulse ? [1, 1.08, 1] : 1,
        y: isBouncing ? [0, -10, 0] : 0,
      }}
      transition={{
        rotate: { type: "spring", stiffness: 300, damping: 20 },
        scale: isPulse ? { repeat: Infinity, duration: 1.5, ease: "easeInOut" } : {},
        y: isBouncing ? { repeat: 4, duration: 0.35, ease: "easeInOut" } : {},
      }}
    >
      <svg
        width={numSize}
        height={numSize}
        viewBox="0 0 100 100"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-label="Canteen Food Mascot"
        role="img"
      >
        <defs>
          <linearGradient id={glazeId} x1="20" y1="10" x2="80" y2="90" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#6B9B61" />
            <stop offset="58%" stopColor="#4A7D46" />
            <stop offset="100%" stopColor="#335C30" />
          </linearGradient>

          <linearGradient id={crustId} x1="10" y1="10" x2="90" y2="90" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#C9A227" />
            <stop offset="100%" stopColor="#8B6914" />
          </linearGradient>

          {/* Bite taken out of the top-right, with tooth impressions */}
          <mask id={biteId}>
            <rect width="100" height="100" fill="white" />
            <circle cx="82" cy="28" r="22" fill="black" />
            <circle cx="70" cy="18" r="7" fill="black" />
            <circle cx="76" cy="36" r="7" fill="black" />
            <circle cx="88" cy="46" r="7" fill="black" />
          </mask>
        </defs>

        {isDetailed && (
          <circle
            cx="50"
            cy="50"
            r="47"
            stroke={`url(#${crustId})`}
            strokeWidth="5"
            mask={`url(#${biteId})`}
          />
        )}

        <circle
          cx="50"
          cy="50"
          r="44"
          fill={`url(#${glazeId})`}
          mask={`url(#${biteId})`}
        />

        {isDetailed && (
          <g opacity="0.55" mask={`url(#${biteId})`}>
            <circle cx="34" cy="62" r="4.5" fill="#C9A227" />
            <circle cx="58" cy="68" r="3.5" fill="#C9A227" />
            <circle cx="28" cy="38" r="3" fill="#F5F0E8" />
            <circle cx="48" cy="40" r="4" fill="#F5F0E8" opacity="0.32" />
          </g>
        )}

        <circle cx="38" cy="42" r="5.5" fill="#1E3B1B" />
        <circle cx="36" cy="40" r="2" fill="#F5F0E8" />

        <path
          d="M 32 54 Q 44 64 56 52"
          stroke="#1E3B1B"
          strokeWidth="3.5"
          strokeLinecap="round"
          fill="none"
        />

        <ellipse cx="28" cy="52" rx="4" ry="2.5" fill="#C9A227" opacity="0.8" />
      </svg>
    </motion.div>
  );
}
