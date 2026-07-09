/**
 * Dual-encoded hexbin aggregation.
 *
 * Ported from DataViz/tennisviz/hexmap.py with improved d3-hexbin integration.
 * Hexagon size = shot frequency, hexagon color = efficiency (win rate vs. average).
 */

import { hexbin as d3Hexbin } from "d3-hexbin";
import { DOUBLES_HALF, NET_Y, COURT_LENGTH, type CourtHalf, courtYBounds } from "./geometry";

export interface HexbinInput {
  x: number[];
  y: number[];
  values?: number[];
}

export interface HexbinResult {
  /** Hexagon center x in court meters */
  cx: number;
  /** Hexagon center y in court meters */
  cy: number;
  /** Number of points in this hex */
  count: number;
  /** Aggregated value (mean of values if provided, else count) */
  value: number;
  /** Hexagon vertices relative to center */
  vertices: Array<[number, number]>;
}

export interface HexbinOptions {
  /** Number of hexagons across the x range (default 8) */
  gridsize?: number;
  /** Extent [xmin, xmax, ymin, ymax] for binning (defaults to court bounds) */
  extent?: [number, number, number, number];
  /** Size scale multiplier (default 1.0) */
  sizeScale?: number;
  /** Minimum points per hex to display (default 2) */
  minCount?: number;
  /** Which half of the court */
  half?: CourtHalf;
  /** Min/max hex radius as fraction of grid radius (default [0.3, 1.0]) */
  sizeRange?: [number, number];
}

/**
 * Compute dual-encoded hexbin aggregation.
 *
 * @returns Array of hexagons with center, count, value, and vertices.
 */
export function computeHexbins(
  input: HexbinInput,
  options: HexbinOptions = {},
): HexbinResult[] {
  const {
    gridsize = 8,
    extent,
    sizeScale = 1.0,
    minCount = 2,
    half = "full",
    sizeRange = [0.3, 1.0],
  } = options;

  const [yMin, yMax] = courtYBounds(half);
  const ext: [number, number, number, number] = extent ?? [
    -DOUBLES_HALF, DOUBLES_HALF, yMin, yMax,
  ];

  const [xmin, xmax, ymin, ymax] = ext;
  const dx = (xmax - xmin) / gridsize;
  const radius = dx / 2;

  // Create d3-hexbin generator
  const hexbinGen = d3Hexbin()
    .radius(radius)
    .extent([[xmin, ymin], [xmax, ymax]]);

  // Build points array — carry the original index as a third element so we
  // can look up per-point values after binning (fixes the coordinate-matching
  // bug that corrupted win-rate colors when two shots shared an x coordinate).
  const points = input.x.map((x, i) => [x, input.y[i]!, i] as [number, number, number]);

  // Bin the points
  const bins = hexbinGen(points as unknown as Array<[number, number]>);

  // Find max count for size scaling
  let maxCount = 0;
  for (const bin of bins) {
    if (bin.length >= minCount) {
      maxCount = Math.max(maxCount, bin.length);
    }
  }

  // Build results
  const results: HexbinResult[] = [];
  for (const bin of bins) {
    const count = bin.length;
    if (count < minCount) continue;

    // Compute value — use the carried index to look up per-point values
    let value: number;
    if (input.values && bin.length > 0) {
      let sum = 0;
      for (let i = 0; i < bin.length; i++) {
        const idx = (bin[i] as unknown as [number, number, number])[2]!;
        if (idx >= 0 && idx < input.values.length) {
          sum += input.values[idx]!;
        }
      }
      value = sum / bin.length;
    } else {
      value = count;
    }

    // Size proportional to sqrt(count/maxCount), clamped to sizeRange
    const sizeT = Math.sqrt(count / Math.max(maxCount, 1));
    const sizeFraction = sizeRange[0] + (sizeRange[1] - sizeRange[0]) * sizeT;
    const r = radius * sizeScale * sizeFraction;

    // Hexagon vertices (pointy-top)
    const vertices: Array<[number, number]> = [];
    for (let j = 0; j < 6; j++) {
      const angle = (Math.PI / 3) * j + Math.PI / 2;
      vertices.push([
        bin.x + r * Math.cos(angle),
        bin.y + r * Math.sin(angle),
      ]);
    }

    results.push({
      cx: bin.x,
      cy: bin.y,
      count,
      value,
      vertices,
    });
  }

  return results;
}

export { DOUBLES_HALF, NET_Y, COURT_LENGTH };
