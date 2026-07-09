/**
 * Courtviz design tokens — SprawlBall-inspired editorial visual language.
 *
 * Ported from DataViz/tennisviz/style.py with identical color values.
 * Three themes: sprawlball (warm paper), ppd-dark (app), broadcast (TV).
 */

import type { Surface } from "@courtviz/core";

// ---------------------------------------------------------------------------
// Shared color constants (identical to style.py)
// ---------------------------------------------------------------------------

export const BG_COLOR = "#F5F0E8";       // warm off-white page
export const COURT_CLAY = "#C97B4E";     // clay orange
export const COURT_CLAY_LIGHT = "#E0A87E";
export const COURT_HARD = "#2E5A88";     // hard court blue
export const COURT_GRASS = "#6B9E5A";    // grass green
export const COURT_LINE = "#FFFFFF";
export const COURT_LINE_DARK = "#2B2B2B";
export const INK = "#1A1A1A";            // near-black for text
export const ACCENT_ORANGE = "#E8742C";
export const ACCENT_BLUE = "#2B6CB0";

// Surround (out-of-bounds court tint — slightly darker than the surface)
export const SURROUND_CLAY = "#B0663C";
export const SURROUND_HARD = "#244A72";
export const SURROUND_GRASS = "#5A8A4A";

// Halo color for marks (warm white that pops on any surface)
export const HALO_COLOR = "#FAF6EE";

// Diverging palette for efficiency encoding (blue = below avg, red = above)
// Tuned for perceptual uniformity — more stops for smoother gradients
export const DIV_LOW = "#2B4D8C";        // deep blue (bad)
export const DIV_LOW_MID = "#6B8FCB";   // steel blue
export const DIV_MID = "#F5F0E8";        // neutral (average)
export const DIV_MID_LIGHT = "#E8DCC8";  // warm neutral
export const DIV_HIGH = "#E8742C";       // orange (good)
export const DIV_PEAK = "#8B1A1A";       // dark red (elite)

// Categorical colors for two players
export const PLAYER_HOST = "#E8742C";    // orange
export const PLAYER_GUEST = "#2B6CB0";   // blue

// Speed colormap reference (for dot density)
export const SPEED_CMAP = "turbo";

// ---------------------------------------------------------------------------
// Typography
// ---------------------------------------------------------------------------

export interface TypographyTokens {
  condensedFont: string;
  bodyFont: string;
  condensedFontFallback: string;
  bodyFontFallback: string;
}

export const FONTS: TypographyTokens = {
  condensedFont: "Oswald",
  bodyFont: "Inter",
  condensedFontFallback: "Arial Narrow, sans-serif",
  bodyFontFallback: "Helvetica Neue, Arial, sans-serif",
};

// ---------------------------------------------------------------------------
// Theme interface
// ---------------------------------------------------------------------------

export interface CourtvizTheme {
  name: string;
  background: string;
  ink: string;
  inkMuted: string;
  courtLine: string;
  courtLineDark: string;
  surfaceColors: Record<Surface, string>;
  surfaceColorsLight: Record<Surface, string>;
  surroundColors: Record<Surface, string>;
  haloColor: string;
  playerHost: string;
  playerGuest: string;
  diverging: {
    low: string;
    lowMid: string;
    mid: string;
    midLight: string;
    high: string;
    peak: string;
  };
  fonts: TypographyTokens;
  fontSize: {
    figureTitle: number;
    figureSubtitle: number;
    title: number;
    subtitle: number;
    body: number;
    small: number;
    label: number;
    source: number;
  };
  headerPadding: { x: number; y: number };
  annotation: {
    leaderColor: string;
    leaderWidth: number;
    calloutFill: string;
    calloutTextColor: string;
  };
}

// ---------------------------------------------------------------------------
// SprawlBall theme (default — warm paper, editorial)
// ---------------------------------------------------------------------------

export const sprawlball: CourtvizTheme = {
  name: "sprawlball",
  background: BG_COLOR,
  ink: INK,
  inkMuted: "#555555",
  courtLine: COURT_LINE,
  courtLineDark: COURT_LINE_DARK,
  surfaceColors: {
    clay: COURT_CLAY,
    grass: COURT_GRASS,
    hard: COURT_HARD,
  },
  surfaceColorsLight: {
    clay: COURT_CLAY_LIGHT,
    grass: "#8BB87A",
    hard: "#4A7AB8",
  },
  surroundColors: {
    clay: SURROUND_CLAY,
    grass: SURROUND_GRASS,
    hard: SURROUND_HARD,
  },
  haloColor: HALO_COLOR,
  playerHost: PLAYER_HOST,
  playerGuest: PLAYER_GUEST,
  diverging: {
    high: DIV_HIGH,
    low: DIV_LOW,
    lowMid: DIV_LOW_MID,
    mid: DIV_MID,
    midLight: DIV_MID_LIGHT,
    peak: DIV_PEAK,
  },
  fonts: FONTS,
  fontSize: {
    body: 11,
    figureSubtitle: 14,
    figureTitle: 34,
    label: 10,
    small: 9,
    source: 8,
    subtitle: 11,
    title: 22,
  },
  headerPadding: { x: 0.06, y: 0.96 },
  annotation: {
    calloutFill: BG_COLOR,
    calloutTextColor: INK,
    leaderColor: INK,
    leaderWidth: 1,
  },
};

// ---------------------------------------------------------------------------
// PPD Dark theme (for the Next.js app)
// ---------------------------------------------------------------------------

export const ppdDark: CourtvizTheme = {
  name: "ppd-dark",
  background: "#0F1117",
  ink: "#F0F0F2",
  inkMuted: "#9CA3AF",
  courtLine: "#FFFFFF",
  courtLineDark: "#6B7280",
  surfaceColors: {
    clay: "#A65D35",
    grass: "#3D7A34",
    hard: "#1A4570",
  },
  surfaceColorsLight: {
    clay: "#C4784A",
    grass: "#5A9A4E",
    hard: "#2A5F94",
  },
  surroundColors: {
    clay: "#7A4528",
    grass: "#2D5A26",
    hard: "#123050",
  },
  haloColor: "#0F1117",
  playerHost: "#FF8C42",
  playerGuest: "#4A9EFF",
  diverging: {
    high: "#FF8C42",
    low: "#1E4A8C",
    lowMid: "#3A6AAA",
    mid: "#2A2D38",
    midLight: "#3D4250",
    peak: "#FF4444",
  },
  fonts: FONTS,
  fontSize: {
    body: 11,
    figureSubtitle: 14,
    figureTitle: 34,
    label: 10,
    small: 9,
    source: 8,
    subtitle: 11,
    title: 22,
  },
  headerPadding: { x: 0.06, y: 0.96 },
  annotation: {
    calloutFill: "#1A1D24",
    calloutTextColor: "#E8E8E8",
    leaderColor: "#888888",
    leaderWidth: 1,
  },
};

// ---------------------------------------------------------------------------
// Broadcast theme (high contrast for video overlays)
// ---------------------------------------------------------------------------

export const broadcast: CourtvizTheme = {
  name: "broadcast",
  background: "#000000",
  ink: "#FFFFFF",
  inkMuted: "#CCCCCC",
  courtLine: "#FFFFFF",
  courtLineDark: "#FFFFFF",
  surfaceColors: {
    clay: "#B86B3E",
    grass: "#5A8A4E",
    hard: "#1E4A7A",
  },
  surfaceColorsLight: {
    clay: "#D08858",
    grass: "#7AA86A",
    hard: "#3A6AAA",
  },
  surroundColors: {
    clay: "#8E5028",
    grass: "#3D6B33",
    hard: "#123656",
  },
  haloColor: "#000000",
  playerHost: "#FF7A1A",
  playerGuest: "#3A9EFF",
  diverging: {
    high: "#FF7A1A",
    low: "#1E4A8C",
    lowMid: "#3A6AAA",
    mid: "#222222",
    midLight: "#333333",
    peak: "#FF3333",
  },
  fonts: FONTS,
  fontSize: {
    body: 12,
    figureSubtitle: 16,
    figureTitle: 38,
    label: 11,
    small: 10,
    source: 9,
    subtitle: 12,
    title: 24,
  },
  headerPadding: { x: 0.06, y: 0.96 },
  annotation: {
    calloutFill: "#222222",
    calloutTextColor: "#FFFFFF",
    leaderColor: "#CCCCCC",
    leaderWidth: 1.5,
  },
};

// ---------------------------------------------------------------------------
// Theme registry
// ---------------------------------------------------------------------------

export const themes: Record<string, CourtvizTheme> = {
  broadcast,
  ppdDark,
  sprawlball,
};

export function getTheme(name: string = "sprawlball"): CourtvizTheme {
  return themes[name] ?? sprawlball;
}

// ---------------------------------------------------------------------------
// Helper functions
// ---------------------------------------------------------------------------

export function getSurfaceColor(surface: Surface, theme: CourtvizTheme = sprawlball): string {
  return theme.surfaceColors[surface] ?? theme.surfaceColors.hard!;
}

export function getSurfaceColorLight(surface: Surface, theme: CourtvizTheme = sprawlball): string {
  return theme.surfaceColorsLight[surface] ?? theme.surfaceColorsLight.hard!;
}

export function getSurroundColor(surface: Surface, theme: CourtvizTheme = sprawlball): string {
  return theme.surroundColors[surface] ?? theme.surroundColors.hard!;
}

export function getPlayerColor(player: string, theme: CourtvizTheme = sprawlball): string {
  return player === "host" ? theme.playerHost : theme.playerGuest;
}

/**
 * Diverging efficiency color stops for SVG gradients/colormaps.
 * Returns array of [offset, color] pairs.
 */
export function efficiencyColorStops(theme: CourtvizTheme = sprawlball): Array<[number, string]> {
  const d = theme.diverging;
  return [
    [0.0, d.low],
    [0.2, d.low],
    [0.35, d.lowMid],
    [0.5, d.midLight],
    [0.65, d.high],
    [0.85, d.high],
    [1.0, d.peak],
  ];
}
