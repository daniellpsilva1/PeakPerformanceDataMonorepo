/**
 * KDE density contours for shot bounce locations.
 *
 * Uses d3-contour to compute contour polygons from a 2D KDE grid,
 * producing the "atlas" look from Hoop Atlas / SprawlBall.
 */

import { contourDensity, type ContourMultiPolygon } from "d3-contour";
import { DOUBLES_HALF, type CourtHalf, courtYBounds } from "./geometry";

export interface DensityInput {
  x: number[];
  y: number[];
}

export interface DensityOptions {
  /** Bandwidth for the KDE (in court meters, default 1.5) */
  bandwidth?: number;
  /** Grid resolution (pixels per side, default 200) */
  resolution?: number;
  /** Number of contour thresholds/levels (default 8) */
  thresholds?: number;
  /** Which half of the court */
  half?: CourtHalf;
  /** Extent [xmin, xmax, ymin, ymax] override */
  extent?: [number, number, number, number];
}

export interface DensityContour {
  /** GeoJSON MultiPolygon coordinates (array of polygons, each array of rings, each array of [x, y] points) */
  coordinates: number[][][][];
  /** Density value at this contour level */
  value: number;
}

/**
 * Compute KDE density contours from shot coordinates.
 *
 * @returns Array of contour polygons sorted by density value (lowest first).
 */
export function computeDensity(
  input: DensityInput,
  options: DensityOptions = {},
): DensityContour[] {
  const {
    bandwidth = 1.5,
    resolution = 200,
    thresholds = 8,
    half = "full",
    extent,
  } = options;

  const [yMin, yMax] = courtYBounds(half);
  const ext: [number, number, number, number] = extent ?? [
    -DOUBLES_HALF, DOUBLES_HALF, yMin, yMax,
  ];

  const [xmin, xmax, ymin, ymax] = ext;
  const courtW = xmax - xmin;
  const courtH = ymax - ymin;

  // Scale court meters to pixel grid space
  const scaleX = resolution / courtW;
  const scaleY = resolution / courtH;

  const points = input.x.map((x, i) => [
    (x - xmin) * scaleX,
    (input.y[i]! - ymin) * scaleY,
  ] as [number, number]);

  const contours = contourDensity<[number, number]>()
    .x((d) => d[0])
    .y((d) => d[1])
    .size([resolution, resolution])
    .bandwidth(bandwidth * scaleX)
    .thresholds(thresholds);

  const geojson = contours(points) as ContourMultiPolygon[];

  // Transform contour coordinates back from pixel space to court meters
  return geojson
    .map((multiPoly) => ({
      coordinates: multiPoly.coordinates.map((polygon) =>
        polygon.map((ring) =>
          ring.map((coord) => {
            const px = coord[0] ?? 0;
            const py = coord[1] ?? 0;
            return [
              px / scaleX + xmin,
              py / scaleY + ymin,
            ] as number[];
          }),
        ),
      ),
      value: multiPoly.value,
    }))
    .sort((a, b) => a.value - b.value);
}
