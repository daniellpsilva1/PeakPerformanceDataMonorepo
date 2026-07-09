/**
 * ITF tennis court dimensions in meters.
 *
 * Coordinate system (matches SwingVision data):
 * - x: lateral, negative = ad side (left), positive = deuce side (right)
 * - y: along court length, 0 = near baseline, 11.885 = net, 23.77 = far baseline
 * - Host plays from far end (y≈23.77), Guest from near end (y≈0)
 *
 * Ported from DataViz/tennisviz/style.py with identical values.
 */

export const SINGLES_WIDTH = 8.23;
export const DOUBLES_WIDTH = 10.97;
export const COURT_LENGTH = 23.77;
export const NET_Y = COURT_LENGTH / 2; // 11.885
export const SERVICE_LINE_NEAR = NET_Y - 5.485; // 6.40
export const SERVICE_LINE_FAR = NET_Y + 5.485; // 17.37
export const BASELINE_NEAR = 0.0;
export const BASELINE_FAR = COURT_LENGTH;
export const SINGLES_HALF = SINGLES_WIDTH / 2; // 4.115
export const DOUBLES_HALF = DOUBLES_WIDTH / 2; // 5.485
export const CENTER_MARK = 0.6; // small marks on baseline & center service line
export const NET_OVERHANG = 0.3; // how far the net extends beyond doubles sideline

/**
 * Court surface types supported by the library.
 */
export type Surface = "clay" | "hard" | "grass";

/**
 * Court orientation for rendering.
 * - "portrait": baseline at top/bottom, standard TV view
 * - "landscape": baseline at left/right, rotated 90°
 */
export type Orientation = "portrait" | "landscape";

/**
 * Which half of the court to render.
 */
export type CourtHalf = "full" | "near" | "far";

/**
 * A 2D point in court coordinates (meters).
 */
export interface Point {
  x: number;
  y: number;
}

/**
 * A shot's spatial data with coordinates in court meters.
 */
export interface ShotCoords {
  bounceX: number | null;
  bounceY: number | null;
  hitX: number | null;
  hitY: number | null;
  hitZ?: number | null;
}

/**
 * Y-axis bounds for a given court half.
 */
export function courtYBounds(half: CourtHalf): [number, number] {
  switch (half) {
    case "near":
      return [BASELINE_NEAR, NET_Y];
    case "far":
      return [NET_Y, BASELINE_FAR];
    case "full":
      return [BASELINE_NEAR, BASELINE_FAR];
  }
}

/**
 * X-axis bounds (always full doubles width plus margin).
 */
export function courtXBounds(margin = 0): [number, number] {
  return [-DOUBLES_HALF - margin, DOUBLES_HALF + margin];
}

/**
 * All court line segments for drawing.
 * Each segment is [x1, y1, x2, y2].
 */
export function courtLines(half: CourtHalf = "full"): Array<[number, number, number, number]> {
  const lines: Array<[number, number, number, number]> = [];
  const [yMin, yMax] = courtYBounds(half);

  // Doubles sidelines
  lines.push([-DOUBLES_HALF, yMin, -DOUBLES_HALF, yMax]);
  lines.push([DOUBLES_HALF, yMin, DOUBLES_HALF, yMax]);

  // Singles sidelines
  lines.push([-SINGLES_HALF, yMin, -SINGLES_HALF, yMax]);
  lines.push([SINGLES_HALF, yMin, SINGLES_HALF, yMax]);

  // Baselines
  lines.push([-DOUBLES_HALF, yMin, DOUBLES_HALF, yMin]);
  if (half === "full") {
    lines.push([-DOUBLES_HALF, yMax, DOUBLES_HALF, yMax]);
  }

  // Net
  lines.push([-DOUBLES_HALF - NET_OVERHANG, NET_Y, DOUBLES_HALF + NET_OVERHANG, NET_Y]);

  // Service lines (near and far)
  for (const ySl of [SERVICE_LINE_NEAR, SERVICE_LINE_FAR]) {
    if (half === "near" && ySl > yMax) continue;
    if (half === "far" && ySl < yMin) continue;
    lines.push([-SINGLES_HALF, ySl, SINGLES_HALF, ySl]);
  }

  // Center service line (clamped to visible half)
  const clStart = Math.max(yMin, SERVICE_LINE_NEAR);
  const clEnd = Math.min(yMax, SERVICE_LINE_FAR);
  if (clEnd > clStart) {
    lines.push([0, clStart, 0, clEnd]);
  }

  // Center marks on baselines
  for (const yBl of [BASELINE_NEAR, BASELINE_FAR]) {
    if (half === "near" && yBl > yMax) continue;
    if (half === "far" && yBl < yMin) continue;
    lines.push([-CENTER_MARK / 2, yBl, CENTER_MARK / 2, yBl]);
  }

  return lines;
}

/**
 * Court fill rectangle [x, y, width, height] for the given half.
 */
export function courtFillRect(half: CourtHalf = "full"): [number, number, number, number] {
  const [yMin, yMax] = courtYBounds(half);
  return [-DOUBLES_HALF, yMin, DOUBLES_WIDTH, yMax - yMin];
}
