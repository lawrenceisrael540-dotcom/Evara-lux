/**
 * Foundation tokens. These are LOCKED: pages and auras may not override them.
 * Everything that gives a page personality lives in aura.ts.
 */

/** 4px base grid. Use these names, never raw pixel values. */
export const space = {
  0: 0, 1: 4, 2: 8, 3: 12, 4: 16, 5: 24, 6: 32, 7: 48, 8: 64, 9: 96, 10: 128,
} as const;

/** Type scale: modular, ratio 1.25 from a 17px body. Aura only changes drama, not the steps. */
export const typeScale = {
  ratio: 1.25,
  basePx: 17,
  steps: { "-1": 0.8, "0": 1, "1": 1.25, "2": 1.563, "3": 1.953, "4": 2.441, "5": 3.052, "6": 3.815 },
  measureCh: { body: 64, tight: 44 },
  lineHeight: { display: 1.05, heading: 1.2, body: 1.55 },
} as const;

export const radius = { none: 0, sm: 4, md: 10, lg: 20, pill: 999 } as const;

/** Layout breakpoints (min-width, px). Each has its own composition, not just a re-stack. */
export const breakpoints = {
  compact: 0,
  medium: 720,
  expanded: 1080,
  wide: 1600,
  ultrawide: 2200,
} as const;

export type Breakpoint = keyof typeof breakpoints;

/** Accessibility floor. Enforced by validateAura and by CI. */
export const a11y = {
  minTouchTargetPx: 44,
  contrast: { bodyText: 7, secondaryText: 4.5, uiAccent: 4.5, focusRing: 3 },
  focusRing: { widthPx: 2, offsetPx: 3 },
  reducedMotion: { maxDurationMs: 120, allowedProperties: ["opacity"] as const },
} as const;

/** Performance budgets: defaults to tune per project, measured on a mid-tier phone. */
export const budgets = {
  lcpMs: 2500,
  inpMs: 200,
  cls: 0.1,
  routeJsKbGzip: 170,
  heroVideoMobileKb: 2500,
  maxConcurrentAnimations: 6,
} as const;

/** Transition primitives shared by every motion tempo. */
export const easing = {
  standard: "cubic-bezier(0.2, 0, 0, 1)",
  emphasized: "cubic-bezier(0.3, 0, 0, 1)",
  linear: "linear",
  snap: "cubic-bezier(0.4, 0, 0.6, 1)",
} as const;
