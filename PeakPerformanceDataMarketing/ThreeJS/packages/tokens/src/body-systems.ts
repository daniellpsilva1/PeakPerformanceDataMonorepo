import { colorPrimitives } from "./colors";

/**
 * Body-system semantic colors for the digital twin tour.
 * Each system has a glow color (for spotlight highlights) and
 * a neutral color (for the un-highlighted state).
 */
export type BodySystemId =
  | "sleep"
  | "recovery"
  | "hrv"
  | "rhr"
  | "load"
  | "stress";

export interface BodySystemColors {
  glow: string;
  glowDim: string;
  neutral: string;
}

export const bodySystemColors: Record<BodySystemId, BodySystemColors> = {
  sleep: {
    glow: "#818CF8",
    glowDim: "#4F46E5",
    neutral: "#1E293B",
  },
  recovery: {
    glow: colorPrimitives.accent,
    glowDim: colorPrimitives.accentDark,
    neutral: "#1E293B",
  },
  hrv: {
    glow: colorPrimitives.cyan,
    glowDim: "#0891B2",
    neutral: "#1E293B",
  },
  rhr: {
    glow: colorPrimitives.primaryBright,
    glowDim: colorPrimitives.primary,
    neutral: "#1E293B",
  },
  load: {
    glow: colorPrimitives.amber,
    glowDim: "#D97706",
    neutral: "#1E293B",
  },
  stress: {
    glow: colorPrimitives.violet,
    glowDim: "#7C3AED",
    neutral: "#1E293B",
  },
} as const;

/**
 * Body region → system mapping for GLB node highlighting.
 * Maps named mesh regions to the body system they represent.
 */
export const regionSystemMap: Record<string, BodySystemId> = {
  brain: "sleep",
  head: "sleep",
  cranial: "sleep",
  heart: "rhr",
  cardiac: "rhr",
  torso: "recovery",
  chest: "recovery",
  autonomic: "hrv",
  nervous: "hrv",
  spine: "hrv",
  muscles: "load",
  arms: "load",
  legs: "load",
  limbs: "load",
  fullBody: "stress",
  skin: "stress",
} as const;
