/**
 * Scales for mapping court coordinates (meters) to SVG pixel space.
 *
 * Uses d3-scale for the math, but exposes a simple typed API.
 */

import { scaleLinear } from "d3-scale";
import {
  COURT_LENGTH,
  DOUBLES_HALF,
  type CourtHalf,
  courtYBounds,
} from "./geometry";
import { NET_Y } from "./geometry";

export interface ScaleConfig {
  /** Pixel width of the SVG viewport */
  width: number;
  /** Pixel height of the SVG viewport */
  height: number;
  /** Which half of the court to map */
  half?: CourtHalf;
  /** Margin around the court in meters */
  margin?: number;
}

export interface CourtScales {
  /** Maps court x (meters) → SVG x (pixels) */
  x: (meters: number) => number;
  /** Maps court y (meters) → SVG y (pixels) */
  y: (meters: number) => number;
  /** Inverse: SVG x → court x */
  xInvert: (pixels: number) => number;
  /** Inverse: SVG y → court y */
  yInvert: (pixels: number) => number;
  /** Pixel size of 1 meter in x */
  meterWidth: number;
  /** Pixel size of 1 meter in y */
  meterHeight: number;
}

/**
 * Create linear scales mapping court meters to SVG pixels.
 *
 * The court is centered horizontally and positioned to fill the viewport
 * while maintaining equal aspect ratio (1 meter x = 1 meter y in pixels).
 */
export function createCourtScales(config: ScaleConfig): CourtScales {
  const { width, height, half = "full", margin = 1.5 } = config;
  const [yMin, yMax] = courtYBounds(half);

  const xMin = -DOUBLES_HALF - margin;
  const xMax = DOUBLES_HALF + margin;
  const yMinWithMargin = yMin - margin;
  const yMaxWithMargin = yMax + margin;

  const courtWidthM = xMax - xMin;
  const courtHeightM = yMaxWithMargin - yMinWithMargin;

  // Maintain equal aspect ratio
  const scaleX = width / courtWidthM;
  const scaleY = height / courtHeightM;
  const scale = Math.min(scaleX, scaleY);

  // Center the court in the viewport
  const offsetX = (width - courtWidthM * scale) / 2;
  const offsetY = (height - courtHeightM * scale) / 2;

  const xScale = scaleLinear()
    .domain([xMin, xMax])
    .range([offsetX, offsetX + courtWidthM * scale]);

  const yScale = scaleLinear()
    .domain([yMinWithMargin, yMaxWithMargin])
    .range([offsetY + courtHeightM * scale, offsetY]); // flip y: SVG y goes down

  return {
    x: (m: number) => xScale(m),
    y: (m: number) => yScale(m),
    xInvert: (px: number) => xScale.invert(px),
    yInvert: (px: number) => yScale.invert(px),
    meterWidth: scale,
    meterHeight: scale,
  };
}

/**
 * Default scale for a standard 1080×1080 social poster (full court).
 */
export function defaultSocialScale(): CourtScales {
  return createCourtScales({ width: 1080, height: 1080, half: "full" });
}

/**
 * Default scale for a half-court social poster (1080×720).
 */
export function defaultHalfCourtScale(): CourtScales {
  return createCourtScales({ width: 1080, height: 720, half: "near" });
}

export { COURT_LENGTH, NET_Y };
