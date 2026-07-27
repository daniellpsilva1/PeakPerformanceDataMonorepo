/**
 * PPD brand color primitives — mirrored from @ppd/tokens (courtviz).
 * Single source of truth for BodyViz brand palette.
 */

export const colorPrimitives = {
  navy950: "#0A0E1A",
  navy900: "#0F172A",
  navy800: "#141D33",
  navy700: "#1C2842",
  navy600: "#243352",
  ink: "#F2F5FA",
  inkMuted: "#9AA7BD",
  inkSubtle: "#64748B",
  primary: "#2563EB",
  primaryBright: "#3B82F6",
  primaryDark: "#1D4ED8",
  marketing: "#0047FF",
  accent: "#10B981",
  accentDark: "#059669",
  violet: "#A855F7",
  amber: "#F59E0B",
  cyan: "#06B6D4",
  pink: "#EC4899",
  positive: "#10B981",
  negative: "#EF4444",
  warning: "#F59E0B",
  border: "#2A3550",
  white: "#FFFFFF",
  black: "#000000",
} as const;

export const semanticColors = {
  dark: {
    background: colorPrimitives.navy900,
    surface: colorPrimitives.navy800,
    surfaceRaised: colorPrimitives.navy700,
    ink: colorPrimitives.ink,
    inkMuted: colorPrimitives.inkMuted,
    border: colorPrimitives.border,
    primary: colorPrimitives.primaryBright,
    accent: colorPrimitives.accent,
    positive: colorPrimitives.positive,
    negative: colorPrimitives.negative,
    warning: colorPrimitives.warning,
  },
  light: {
    background: colorPrimitives.white,
    surface: "#F8FAFC",
    surfaceRaised: "#F1F5F9",
    ink: colorPrimitives.navy900,
    inkMuted: colorPrimitives.inkSubtle,
    border: "#E2E8F0",
    primary: colorPrimitives.primary,
    accent: colorPrimitives.accentDark,
    positive: colorPrimitives.accentDark,
    negative: colorPrimitives.negative,
    warning: colorPrimitives.amber,
  },
} as const;
