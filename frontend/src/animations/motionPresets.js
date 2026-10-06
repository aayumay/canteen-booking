/**
 * Motion & Interaction Presets
 * Inspired by More Nutrition interaction principles:
 * Heavy, intentional, organic easing curves without bouncy overshoot.
 */

// Premium organic easing
export const EASING = {
  smoothOut: [0.16, 1, 0.3, 1],       // custom cubic-bezier for snappy yet smooth motion
  editorial: [0.25, 1, 0.5, 1],       // slightly heavier deceleration for large headlines
  tactileSpring: { type: "spring", stiffness: 420, damping: 28 },
  gentleSpring: { type: "spring", stiffness: 260, damping: 24 },
  cardSpring: { type: "spring", stiffness: 350, damping: 25 },
};

// Page entrance & transition variants
export const pageVariants = {
  initial: {
    opacity: 0,
    y: 12,
  },
  animate: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.45,
      ease: EASING.smoothOut,
      staggerChildren: 0.06,
      when: "beforeChildren",
    },
  },
  exit: {
    opacity: 0,
    y: -8,
    transition: {
      duration: 0.25,
      ease: [0.4, 0, 1, 1],
    },
  },
};

// Stagger container for lists, grids, and hero rows
export const staggerContainer = (staggerTime = 0.06, delayChildren = 0.05) => ({
  initial: {},
  animate: {
    transition: {
      staggerChildren: staggerTime,
      delayChildren: delayChildren,
    },
  },
});

// Stagger item reveal (fade + subtle translate)
export const staggerItem = {
  initial: {
    opacity: 0,
    y: 18,
    scale: 0.98,
  },
  animate: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: {
      duration: 0.55,
      ease: EASING.smoothOut,
    },
  },
};

// Masked text reveal (for headings and titles)
export const textMaskReveal = {
  initial: {
    y: "100%",
    opacity: 0,
  },
  animate: {
    y: 0,
    opacity: 1,
    transition: {
      duration: 0.65,
      ease: EASING.editorial,
    },
  },
};

// Tactile card hover motion props
export const cardHoverMotion = {
  whileHover: {
    y: -4,
    scale: 1.012,
    transition: {
      duration: 0.28,
      ease: EASING.smoothOut,
    },
  },
  whileTap: {
    scale: 0.985,
    transition: {
      duration: 0.12,
    },
  },
};

// Tactile button micro-interaction props
export const buttonTapMotion = {
  whileHover: {
    scale: 1.02,
    transition: {
      duration: 0.2,
      ease: EASING.smoothOut,
    },
  },
  whileTap: {
    scale: 0.96,
    transition: {
      duration: 0.1,
    },
  },
};
