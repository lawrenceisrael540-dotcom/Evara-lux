import { a11y, easing } from "./tokens.js";
import type { MotionTempo } from "./aura.js";

export interface MotionPreset {
  tempo: MotionTempo;
  /** Durations in ms. */
  duration: { micro: number; short: number; medium: number; long: number };
  easing: string;
  /** Delay between siblings in a staggered reveal, ms. */
  staggerMs: number;
  /** What the motion is allowed to express; used in review. */
  purpose: string;
}

export const MOTION: Record<MotionTempo, MotionPreset> = {
  slow: {
    tempo: "slow",
    duration: { micro: 160, short: 320, medium: 640, long: 1100 },
    easing: easing.emphasized,
    staggerMs: 90,
    purpose: "Weight and certainty. Change arrives deliberately.",
  },
  measured: {
    tempo: "measured",
    duration: { micro: 120, short: 220, medium: 420, long: 720 },
    easing: easing.standard,
    staggerMs: 60,
    purpose: "Clarity. Motion explains what changed and stops.",
  },
  brisk: {
    tempo: "brisk",
    duration: { micro: 90, short: 160, medium: 280, long: 480 },
    easing: easing.snap,
    staggerMs: 35,
    purpose: "Responsiveness. The system keeps up with the operator.",
  },
  kinetic: {
    tempo: "kinetic",
    duration: { micro: 80, short: 140, medium: 240, long: 400 },
    easing: easing.snap,
    staggerMs: 24,
    purpose: "Momentum. Energy that leads the eye toward an action.",
  },
};

export interface ResolvedMotion {
  durations: MotionPreset["duration"];
  easing: string;
  staggerMs: number;
  /** Only these CSS properties may animate. Undefined means unrestricted. */
  allowedProperties?: readonly string[];
}

/** Reduced motion collapses every tempo to a short opacity fade. */
export function motionFor(tempo: MotionTempo, prefersReducedMotion: boolean): ResolvedMotion {
  if (prefersReducedMotion) {
    const d = a11y.reducedMotion.maxDurationMs;
    return {
      durations: { micro: 0, short: d, medium: d, long: d },
      easing: easing.linear,
      staggerMs: 0,
      allowedProperties: a11y.reducedMotion.allowedProperties,
    };
  }
  const m = MOTION[tempo];
  return { durations: m.duration, easing: m.easing, staggerMs: m.staggerMs };
}
