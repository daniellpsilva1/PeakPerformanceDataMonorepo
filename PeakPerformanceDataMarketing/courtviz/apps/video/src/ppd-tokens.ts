import { ppdDark } from "@courtviz/themes";

/** Design tokens aligned with the courtviz demo / PPD app shell */
export const PPD = {
  bg: "#0f1117",
  surface: "#1a1d28",
  border: "#2a2d3a",
  text: "#e4e4e7",
  textMuted: "#71717a",
  accent: "#e8742c",
  radius: {
    sm: 8,
    md: 12,
    lg: 16,
  },
} as const;

export const theme = ppdDark;
