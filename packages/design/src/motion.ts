// Animation tokens. Durations are in milliseconds. Easings are cubic-bezier
// control points [x1, y1, x2, y2] — consumable by both web (motion /
// Framer) and mobile (Reanimated's Easing.bezier). Cards dealing at the same
// speed and curve on both platforms is the single biggest factor in the two
// apps feeling like one product.

export type Bezier = readonly [number, number, number, number];

export const easing = {
  standard: [0.4, 0, 0.2, 1] as Bezier,
  decelerate: [0, 0, 0.2, 1] as Bezier,
  accelerate: [0.4, 0, 1, 1] as Bezier,
  emphasized: [0.22, 1, 0.36, 1] as Bezier,
} as const;

export const duration = {
  instant: 0,
  fast: 150,
  normal: 250,
  slow: 400,
} as const;

export type MotionSpec = { duration: number; easing: Bezier };

// Named animations for the key table moments.
export const motion = {
  dealCard: { duration: 300, easing: easing.emphasized },
  slideChip: { duration: 250, easing: easing.decelerate },
  flipCard: { duration: 400, easing: easing.standard },
  foldCards: { duration: 250, easing: easing.accelerate },
  revealHole: { duration: 200, easing: easing.decelerate },
} as const satisfies Record<string, MotionSpec>;
