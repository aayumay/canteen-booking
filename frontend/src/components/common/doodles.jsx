/**
 * Hand-drawn doodle art library.
 *
 * Every mark here is an original inline SVG drawn with a wobbly, single-weight
 * stroke so the whole set feels sketched in one hand. All of them inherit
 * `currentColor`, so they work on sage, cream or forest without a second asset.
 *
 * Shared conventions
 *  - `size` is the rendered box in px; the viewBox is always square-ish
 *  - strokes are `vector-effect="non-scaling-stroke"` free but use
 *    strokeWidth relative to the viewBox, so they never look hairline-thin
 *  - every component is memo-friendly and takes a plain `style` for positioning
 */

import React from "react";

const base = {
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 3.2,
  strokeLinecap: "round",
  strokeLinejoin: "round",
};

function Svg({ size = 48, viewBox = "0 0 64 64", children, style, className = "", ...rest }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox={viewBox}
      style={style}
      className={className}
      aria-hidden="true"
      focusable="false"
      shapeRendering="geometricPrecision"
      {...rest}
    >
      {children}
    </svg>
  );
}

/* ------------------------------------------------------------------ *
 * Botanical
 * ------------------------------------------------------------------ */

/** A single leaf with a centre vein, slightly asymmetric like a real sketch. */
export function DoodleLeaf({ size = 48, style, className, ...rest }) {
  return (
    <Svg size={size} style={style} className={className} {...rest}>
      <g {...base}>
        <path d="M32 58 C 30 42 30 26 32 8" />
        <path d="M32 14 C 44 14 52 22 52 30 C 42 33 34 27 32 14 Z" />
        <path d="M31 34 C 20 34 12 41 12 49 C 21 51 29 45 31 34 Z" />
      </g>
    </Svg>
  );
}

/** Three leaves fanning off one stem. */
export function DoodleSprig({ size = 48, style, className, ...rest }) {
  return (
    <Svg size={size} style={style} className={className} {...rest}>
      <g {...base}>
        <path d="M14 56 C 26 46 38 34 50 12" />
        <path d="M50 12 C 58 18 58 28 52 33 C 45 29 43 20 50 12 Z" />
        <path d="M36 32 C 42 38 40 47 33 50 C 27 44 28 36 36 32 Z" />
        <path d="M23 45 C 28 51 25 58 18 59 C 14 53 16 47 23 45 Z" />
      </g>
    </Svg>
  );
}

/** A loose, hand-wobbled circle — the classic "look at this" ring. */
export function DoodleCircle({ size = 120, style, className, children, ...rest }) {
  return (
    <Svg size={size} viewBox="0 0 200 120" style={style} className={className} {...rest}>
      <path
        {...base}
        strokeWidth="2.6"
        d="M186 62 C 184 24 150 6 100 6 C 48 6 12 26 12 60 C 12 96 50 114 104 112 C 156 110 190 92 186 62 Z"
      />
      {children}
    </Svg>
  );
}

/**
 * A hand-drawn ring that stretches to hug any element.
 * The stroke stays an even weight because it is non-scaling, so the wobble
 * reads as a circle even when the box is 3:1.
 */
export function DoodleRing({ style, className, ...rest }) {
  return (
    <svg
      viewBox="0 0 300 120"
      preserveAspectRatio="none"
      style={{ position: "absolute", inset: 0, width: "100%", height: "100%", ...style }}
      className={className}
      aria-hidden="true"
      focusable="false"
      {...rest}
    >
      <path
        {...base}
        strokeWidth="2.4"
        vectorEffect="non-scaling-stroke"
        d="M292 58 C 290 24 250 8 150 8 C 60 8 8 26 8 62 C 8 98 56 116 152 112 C 244 108 296 92 292 58 Z"
      />
    </svg>
  );
}

/** A single continuous squiggle, great as a divider or underline. */export function DoodleSquiggle({ size = 120, style, className, ...rest }) {
  return (
    <Svg size={size} viewBox="0 0 200 40" style={style} className={className} {...rest}>
      <path
        {...base}
        strokeWidth="4"
        d="M6 24 C 22 6 38 6 50 22 C 62 38 78 38 90 22 C 102 6 118 6 130 22 C 142 38 158 38 170 22 C 180 10 190 8 196 14"
      />
    </Svg>
  );
}

/** Hand-drawn underline stroke that can sit beneath a word. */
export function DoodleUnderline({ size = 160, style, className, ...rest }) {
  return (
    <Svg size={size} viewBox="0 0 200 18" style={style} className={className} {...rest}>
      <path {...base} strokeWidth="5" d="M4 12 C 44 5 92 4 132 8 C 160 11 182 12 196 9" />
    </Svg>
  );
}

/* ------------------------------------------------------------------ *
 * Emphasis marks
 * ------------------------------------------------------------------ */

/** Four-point sparkle / hand-drawn star. */
export function DoodleSparkle({ size = 32, style, className, ...rest }) {
  return (
    <Svg size={size} viewBox="0 0 40 40" style={style} className={className} {...rest}>
      <g {...base} strokeWidth="2.4">
        <path d="M20 3 C 21 13 27 19 37 20 C 27 21 21 27 20 37 C 19 27 13 21 3 20 C 13 19 19 13 20 3 Z" />
      </g>
    </Svg>
  );
}

/** A three-line shine burst used next to prices and "fresh" claims. */
export function DoodleBurst({ size = 40, style, className, ...rest }) {
  return (
    <Svg size={size} viewBox="0 0 48 48" style={style} className={className} {...rest}>
      <g {...base} strokeWidth="3">
        <path d="M24 2 L 24 12" />
        <path d="M24 36 L 24 46" />
        <path d="M2 24 L 12 24" />
        <path d="M36 24 L 46 24" />
        <path d="M8 8 L 15 15" />
        <path d="M33 33 L 40 40" />
        <path d="M40 8 L 33 15" />
        <path d="M15 33 L 8 40" />
      </g>
    </Svg>
  );
}

/** A hand-drawn arrow that curves, for pointing at the primary CTA. */
export function DoodleArrow({ size = 72, style, className, ...rest }) {
  return (
    <Svg size={size} viewBox="0 0 80 80" style={style} className={className} {...rest}>
      <g {...base} strokeWidth="3.4">
        <path d="M8 14 C 26 22 44 40 58 62" />
        <path d="M40 58 C 48 58 56 60 60 66" />
        <path d="M58 62 C 58 54 58 46 62 40" />
      </g>
    </Svg>
  );
}

/** A short straight scribble arrow pointing right. */
export function DoodleArrowRight({ size = 48, style, className, ...rest }) {
  return (
    <Svg size={size} viewBox="0 0 64 32" style={style} className={className} {...rest}>
      <g {...base} strokeWidth="3.2">
        <path d="M4 20 C 16 14 30 12 46 14" />
        <path d="M40 6 C 46 10 50 12 52 16" />
        <path d="M52 16 C 50 20 47 23 42 25" />
      </g>
    </Svg>
  );
}

/** Two short parallel accent strokes, like manga speed lines. */
export function DoodleActionLines({ size = 28, style, className, ...rest }) {
  return (
    <Svg size={size} viewBox="0 0 32 32" style={style} className={className} {...rest}>
      <g {...base} strokeWidth="4">
        <path d="M10 22 L 20 6" />
        <path d="M20 26 L 30 10" />
      </g>
    </Svg>
  );
}

/** A hand-drawn dotted path, used to connect steps. */
export function DoodleDottedPath({ size = 200, style, className, ...rest }) {
  return (
    <Svg size={size} viewBox="0 0 200 40" style={style} className={className} {...rest}>
      <path
        {...base}
        strokeWidth="3"
        strokeDasharray="1 11"
        strokeLinecap="round"
        d="M4 26 C 50 8 90 34 138 16 C 162 8 180 14 196 22"
      />
    </Svg>
  );
}

/* ------------------------------------------------------------------ *
 * Food & canteen line art
 * ------------------------------------------------------------------ */

/** A plate seen from above with food mounds on it. */
export function DoodlePlate({ size = 96, style, className, ...rest }) {
  return (
    <Svg size={size} viewBox="0 0 100 100" style={style} className={className} {...rest}>
      <g {...base} strokeWidth="2.6">
        <circle cx="50" cy="50" r="42" />
        <circle cx="50" cy="50" r="32" />
        <circle cx="38" cy="42" r="11" />
        <circle cx="62" cy="38" r="10" />
        <circle cx="54" cy="62" r="12" />
        <circle cx="74" cy="58" r="7" />
        <path d="M14 20 L 22 26" />
        <path d="M78 80 L 86 86" />
      </g>
    </Svg>
  );
}

/** Idli on a leaf — a recognisable South-Asian canteen staple. */
export function DoodleIdli({ size = 80, style, className, ...rest }) {
  return (
    <Svg size={size} viewBox="0 0 100 80" style={style} className={className} {...rest}>
      <g {...base} strokeWidth="2.8">
        <ellipse cx="50" cy="62" rx="42" ry="10" />
        <ellipse cx="32" cy="46" rx="14" ry="11" />
        <ellipse cx="60" cy="46" rx="14" ry="11" />
        <ellipse cx="46" cy="30" rx="13" ry="10" />
        <path d="M26 44 C 30 41 34 41 38 44" />
        <path d="M54 44 C 58 41 62 41 66 44" />
      </g>
    </Svg>
  );
}

/** A samosa triangle. */
export function DoodleSamosa({ size = 64, style, className, ...rest }) {
  return (
    <Svg size={size} viewBox="0 0 64 64" style={style} className={className} {...rest}>
      <g {...base} strokeWidth="3">
        <path d="M32 8 L 56 52 L 8 52 Z" />
        <path d="M32 8 C 24 24 16 40 8 52" />
        <path d="M56 52 C 40 48 24 48 8 52" />
      </g>
    </Svg>
  );
}

/** A kulhad-style tea cup with steam. */
export function DoodleChai({ size = 64, style, className, ...rest }) {
  return (
    <Svg size={size} viewBox="0 0 64 64" style={style} className={className} {...rest}>
      <g {...base} strokeWidth="3">
        <path d="M14 28 L 50 28 L 44 56 L 20 56 Z" />
        <path d="M10 60 C 20 64 44 64 54 60" />
        <path d="M26 20 C 22 16 30 12 26 6" />
        <path d="M38 20 C 34 16 42 12 38 6" />
      </g>
    </Svg>
  );
}

/** A takeaway food box with a folded lid. */
export function DoodleFoodBox({ size = 72, style, className, ...rest }) {
  return (
    <Svg size={size} viewBox="0 0 72 64" style={style} className={className} {...rest}>
      <g {...base} strokeWidth="3">
        <path d="M10 22 L 62 22 L 57 60 L 15 60 Z" />
        <path d="M6 12 L 66 12 L 62 22 L 10 22 Z" />
        <path d="M28 12 L 28 4 L 44 4 L 44 12" />
        <path d="M26 34 C 32 30 40 30 46 34" />
      </g>
    </Svg>
  );
}

/** A rolling pin. */
export function DoodleRollingPin({ size = 72, style, className, ...rest }) {
  return (
    <Svg size={size} viewBox="0 0 72 40" style={style} className={className} {...rest}>
      <g {...base} strokeWidth="3">
        <rect x="14" y="12" width="44" height="16" rx="8" />
        <path d="M14 20 L 4 20" />
        <path d="M58 20 L 68 20" />
        <path d="M24 16 C 28 20 28 20 24 24" />
        <path d="M40 16 C 44 20 44 20 40 24" />
      </g>
    </Svg>
  );
}

/** A spoon with a dab of steam. */
export function DoodleSpoon({ size = 56, style, className, ...rest }) {
  return (
    <Svg size={size} viewBox="0 0 40 64" style={style} className={className} {...rest}>
      <g {...base} strokeWidth="3">
        <ellipse cx="20" cy="16" rx="11" ry="14" />
        <path d="M20 30 L 20 60" />
        <path d="M12 38 C 8 34 16 30 12 26" />
      </g>
    </Svg>
  );
}

/** Rising steam curls — the universal "hot food" mark. */
export function DoodleSteam({ size = 48, style, className, ...rest }) {
  return (
    <Svg size={size} viewBox="0 0 64 48" style={style} className={className} {...rest}>
      <g {...base} strokeWidth="3.2">
        <path d="M14 44 C 6 34 22 28 14 18" />
        <path d="M32 44 C 24 34 40 26 32 14" />
        <path d="M50 44 C 42 34 58 28 50 20" />
      </g>
    </Svg>
  );
}

/* ------------------------------------------------------------------ *
 * Scene & texture
 * ------------------------------------------------------------------ */

/** Rolling hills divider used between landing sections. */
export function DoodleHills({ size = 1600, style, className, ...rest }) {
  return (
    <Svg
      size={size}
      viewBox="0 0 1600 120"
      preserveAspectRatio="none"
      style={{ width: "100%", height: "100%", ...style }}
      className={className}
      {...rest}
    >
      <path
        {...base}
        strokeWidth="2.4"
        vectorEffect="non-scaling-stroke"
        d="M0 78 C 130 40 250 108 400 74 C 550 40 660 104 820 70 C 980 36 1080 100 1240 66 C 1380 36 1500 78 1600 56"
      />
    </Svg>
  );
}

/** A sparse dot grid, the classic notebook texture. */
export function DoodleDotGrid({ size = 120, style, className, ...rest }) {
  return (
    <Svg size={size} viewBox="0 0 40 40" style={style} className={className} {...rest}>
      <g fill="currentColor" stroke="none">
        <circle cx="6" cy="6" r="1.6" />
        <circle cx="20" cy="6" r="1.6" />
        <circle cx="34" cy="6" r="1.6" />
        <circle cx="6" cy="20" r="1.6" />
        <circle cx="20" cy="20" r="1.6" />
        <circle cx="34" cy="20" r="1.6" />
        <circle cx="6" cy="34" r="1.6" />
        <circle cx="20" cy="34" r="1.6" />
        <circle cx="34" cy="34" r="1.6" />
      </g>
    </Svg>
  );
}

/** A hand-drawn cross-hatch patch, for adding texture behind text. */
export function DoodleHatch({ size = 120, style, className, ...rest }) {
  return (
    <Svg size={size} viewBox="0 0 60 60" style={style} className={className} {...rest}>
      <g {...base} strokeWidth="2.2" opacity="0.75">
        <path d="M-4 14 L 14 -4" />
        <path d="M-4 30 L 30 -4" />
        <path d="M-4 46 L 46 -4" />
        <path d="M-4 62 L 62 -4" />
        <path d="M8 64 L 64 8" />
        <path d="M24 64 L 64 24" />
        <path d="M40 64 L 64 40" />
        <path d="M56 64 L 64 56" />
      </g>
    </Svg>
  );
}

/** A wobbly sun with rays. */
export function DoodleSun({ size = 64, style, className, ...rest }) {
  return (
    <Svg size={size} viewBox="0 0 64 64" style={style} className={className} {...rest}>
      <g {...base} strokeWidth="2.8">
        <circle cx="32" cy="32" r="15" />
        <path d="M32 4 L 32 12" />
        <path d="M32 52 L 32 60" />
        <path d="M4 32 L 12 32" />
        <path d="M52 32 L 60 32" />
        <path d="M12 12 L 18 18" />
        <path d="M46 46 L 52 52" />
        <path d="M52 12 L 46 18" />
        <path d="M18 46 L 12 52" />
      </g>
    </Svg>
  );
}

/** A crescent moon, for late-night snack slots. */
export function DoodleMoon({ size = 64, style, className, ...rest }) {
  return (
    <Svg size={size} viewBox="0 0 64 64" style={style} className={className} {...rest}>
      <g {...base} strokeWidth="2.8">
        <path d="M42 8 C 22 12 12 32 22 48 C 28 57 40 60 50 56 C 34 52 26 34 32 20 C 34 14 38 10 42 8 Z" />
        <path d="M52 16 L 52 26" />
        <path d="M47 21 L 57 21" />
      </g>
    </Svg>
  );
}

/** A hand-drawn check inside a loose circle — a real "done" stamp. */
export function DoodleCheck({ size = 64, style, className, ...rest }) {
  return (
    <Svg size={size} viewBox="0 0 64 64" style={style} className={className} {...rest}>
      <g {...base} strokeWidth="3.2">
        <path d="M56 30 C 54 12 36 4 20 8 C 6 12 2 28 8 42 C 15 56 34 60 46 50" />
        <path d="M18 32 L 28 42 L 46 22" />
      </g>
    </Svg>
  );
}

/** A clipboard — used for the order-ticket metaphor. */
export function DoodleClipboard({ size = 64, style, className, ...rest }) {
  return (
    <Svg size={size} viewBox="0 0 56 64" style={style} className={className} {...rest}>
      <g {...base} strokeWidth="3">
        <rect x="8" y="8" width="40" height="50" rx="5" />
        <path d="M20 8 L 20 4 L 36 4 L 36 8" />
        <path d="M18 24 L 38 24" />
        <path d="M18 34 L 38 34" />
        <path d="M18 44 L 30 44" />
      </g>
    </Svg>
  );
}

/** A wallet with a coin dropping in. */
export function DoodleWallet({ size = 64, style, className, ...rest }) {
  return (
    <Svg size={size} viewBox="0 0 64 56" style={style} className={className} {...rest}>
      <g {...base} strokeWidth="3">
        <rect x="4" y="14" width="52" height="36" rx="7" />
        <path d="M4 24 L 40 24" />
        <circle cx="46" cy="32" r="4" />
        <circle cx="48" cy="4" r="6" />
        <path d="M48 10 L 48 14" />
      </g>
    </Svg>
  );
}

/** A clock face for pickup windows. */
export function DoodleClock({ size = 64, style, className, ...rest }) {
  return (
    <Svg size={size} viewBox="0 0 64 64" style={style} className={className} {...rest}>
      <g {...base} strokeWidth="3">
        <circle cx="32" cy="32" r="25" />
        <path d="M32 16 L 32 33 L 44 40" />
        <path d="M32 3 L 32 8" />
        <path d="M32 56 L 32 61" />
      </g>
    </Svg>
  );
}

/** A location pin, for stall discovery. */
export function DoodlePin({ size = 64, style, className, ...rest }) {
  return (
    <Svg size={size} viewBox="0 0 56 64" style={style} className={className} {...rest}>
      <g {...base} strokeWidth="3">
        <path d="M28 60 C 28 60 50 38 50 24 C 50 12 40 4 28 4 C 16 4 6 12 6 24 C 6 38 28 60 28 60 Z" />
        <circle cx="28" cy="24" r="8" />
      </g>
    </Svg>
  );
}

/** A leafy shield, for the nutrition/allergen promise. */
export function DoodleShield({ size = 64, style, className, ...rest }) {
  return (
    <Svg size={size} viewBox="0 0 56 64" style={style} className={className} {...rest}>
      <g {...base} strokeWidth="3">
        <path d="M28 4 L 50 12 L 50 32 C 50 46 40 56 28 60 C 16 56 6 46 6 32 L 6 12 Z" />
        <path d="M28 48 C 27 40 27 30 28 22" />
        <path d="M28 30 C 34 30 38 34 38 38 C 33 39 29 36 28 30 Z" />
      </g>
    </Svg>
  );
}

/** A re-usable dabba/tiffin, for the zero-waste promise. */
export function DoodleDabba({ size = 64, style, className, ...rest }) {
  return (
    <Svg size={size} viewBox="0 0 60 60" style={style} className={className} {...rest}>
      <g {...base} strokeWidth="3">
        <rect x="10" y="22" width="40" height="32" rx="6" />
        <path d="M8 22 L 52 22 L 46 14 L 14 14 Z" />
        <path d="M22 14 L 22 8 L 38 8 L 38 14" />
        <path d="M10 36 L 50 36" />
      </g>
    </Svg>
  );
}

/** A graduation cap — the campus framing. */
export function DoodleCap({ size = 64, style, className, ...rest }) {
  return (
    <Svg size={size} viewBox="0 0 64 48" style={style} className={className} {...rest}>
      <g {...base} strokeWidth="3">
        <path d="M32 8 L 60 22 L 32 36 L 4 22 Z" />
        <path d="M16 27 L 16 40 C 16 40 24 46 32 46 C 40 46 48 40 48 40 L 48 27" />
        <path d="M56 25 L 56 40" />
      </g>
    </Svg>
  );
}

/**
 * The brand mark: a domed thali on a stand with a leaf off the rim.
 * This is the single source of truth for the logo — the landing wordmark and
 * the in-app appbar both render it, so they can never drift apart.
 */
export function DoodleBrandMark({ size = 26, style, className, ...rest }) {
  return (
    <Svg size={size} viewBox="0 0 40 40" style={style} className={className} {...rest}>
      <g {...base} strokeWidth="3">
        <path d="M6 27c0-9 6-16 14-16s14 7 14 16" />
        <path d="M4 27h32" />
        <path d="M14 34h12" />
      </g>
      <path d="M27 8c3-2 6-1 7 2-3 1-6 0-7-2z" fill="currentColor" stroke="none" />
    </Svg>
  );
}

/**
 * The full art showcase roster, used by the landing page to lay out a
 * scattered collage of every mark in the set.
 */
export const DOODLE_ART = [
  { key: "idli", label: "Idli & Sambar", Icon: DoodleIdli },
  { key: "samosa", label: "Samosa", Icon: DoodleSamosa },
  { key: "chai", label: "Cutting Chai", Icon: DoodleChai },
  { key: "thali", label: "Thali", Icon: DoodlePlate },
  { key: "dabba", label: "Reusable Dabba", Icon: DoodleDabba },
  { key: "sprig", label: "Fresh Sprig", Icon: DoodleSprig },
  { key: "sun", label: "Lunch Rush", Icon: DoodleSun },
  { key: "moon", label: "Midnight Munch", Icon: DoodleMoon },
  { key: "clipboard", label: "Order Ticket", Icon: DoodleClipboard },
  { key: "wallet", label: "Campus Wallet", Icon: DoodleWallet },
  { key: "clock", label: "Pickup Slot", Icon: DoodleClock },
  { key: "pin", label: "Find a Stall", Icon: DoodlePin },
  { key: "shield", label: "Nutrition First", Icon: DoodleShield },
  { key: "steam", label: "Served Hot", Icon: DoodleSteam },
  { key: "rollingpin", label: "Made Fresh", Icon: DoodleRollingPin },
  { key: "spoon", label: "Every Spoonful", Icon: DoodleSpoon },
  { key: "box", label: "Pickup Box", Icon: DoodleFoodBox },
  { key: "cap", label: "Campus Life", Icon: DoodleCap },
  { key: "check", label: "All Set", Icon: DoodleCheck },
  { key: "leaf", label: "Fresh Leaf", Icon: DoodleLeaf },
];

export { Svg as DoodleSvg };
