import type { Transition, Variants } from "motion/react";

/* =============================================================================
   MOTION SYSTEM — single source of truth for animation
   One rhythm across the app: easeOutExpo enter, faster exit, spring physics.
   Components respect prefers-reduced-motion via <MotionConfig reducedMotion>.
   ========================================================================== */

/** Easing tokens. */
export const ease = {
  out: [0.22, 1, 0.36, 1], // easeOutExpo — confident settle for entrances
  inOut: [0.65, 0, 0.35, 1],
  in: [0.55, 0, 1, 0.45],
} as const;

/** Duration tokens (seconds) — micro 0.15–0.3, transitions ≤0.4. */
export const duration = {
  fast: 0.18,
  base: 0.28,
  slow: 0.4,
} as const;

/** Shared transition presets. */
export const transition = {
  base: { duration: duration.base, ease: ease.out } as Transition,
  fast: { duration: duration.fast, ease: ease.out } as Transition,
  // Exit ~65% of enter (feels responsive).
  exit: { duration: duration.fast, ease: ease.in } as Transition,
  spring: { type: "spring", stiffness: 380, damping: 30, mass: 0.8 } as Transition,
  springSoft: { type: "spring", stiffness: 220, damping: 28 } as Transition,
} as const;

/* ---- Entrance variants --------------------------------------------------- */

export const fadeIn: Variants = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: transition.base },
};

export const fadeInUp: Variants = {
  hidden: { opacity: 0, y: 16 },
  show: { opacity: 1, y: 0, transition: transition.base },
};

export const fadeInDown: Variants = {
  hidden: { opacity: 0, y: -16 },
  show: { opacity: 1, y: 0, transition: transition.base },
};

export const scaleIn: Variants = {
  hidden: { opacity: 0, scale: 0.96 },
  show: { opacity: 1, scale: 1, transition: transition.base },
};

/* ---- Staggered groups (lists, grids) ------------------------------------- */

export const staggerContainer: Variants = {
  hidden: {},
  show: {
    transition: { staggerChildren: 0.06, delayChildren: 0.04 },
  },
};

export const staggerItem: Variants = {
  hidden: { opacity: 0, y: 14 },
  show: { opacity: 1, y: 0, transition: transition.base },
};

/* ---- Page / route transitions -------------------------------------------- */

export const pageTransition: Variants = {
  hidden: { opacity: 0, y: 8 },
  show: { opacity: 1, y: 0, transition: { duration: duration.base, ease: ease.out } },
  exit: { opacity: 0, y: -8, transition: transition.exit },
};

/* ---- Overlay + modal (animate from a centered surface) ------------------- */

export const overlayVariants: Variants = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: transition.fast },
  exit: { opacity: 0, transition: transition.exit },
};

export const modalVariants: Variants = {
  hidden: { opacity: 0, scale: 0.96, y: 8 },
  show: { opacity: 1, scale: 1, y: 0, transition: transition.spring },
  exit: { opacity: 0, scale: 0.97, y: 6, transition: transition.exit },
};

/* ---- Micro-interaction presets (spread onto motion components) ----------- */

/** Card / row hover lift + press. */
export const hoverLift = {
  whileHover: { y: -3, transition: transition.fast },
  whileTap: { y: -1, scale: 0.995 },
} as const;

/** Button / pressable press feedback. */
export const pressable = {
  whileTap: { scale: 0.97 },
  transition: transition.fast,
} as const;

/** Subtle hover scale for icon buttons / avatars. */
export const hoverScale = {
  whileHover: { scale: 1.05 },
  whileTap: { scale: 0.95 },
  transition: transition.fast,
} as const;
