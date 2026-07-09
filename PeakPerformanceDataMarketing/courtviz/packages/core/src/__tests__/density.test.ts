import { describe, expect, it } from "vitest";
import { computeDensity } from "../density";

describe("computeDensity", () => {
  it("returns empty array for empty input", () => {
    const result = computeDensity({ x: [], y: [] }, { bandwidth: 1.5, half: "full", resolution: 100, thresholds: 5 });
    expect(result).toEqual([]);
  });

  it("returns contours for a cluster of points", () => {
    const xs = [2, 2.1, 1.9, 2.2, 1.8, 3, 3.1, 2.9];
    const ys = [5, 5.1, 4.9, 5.2, 4.8, 7, 7.1, 6.9];
    const result = computeDensity({ x: xs, y: ys }, { bandwidth: 1.0, half: "full", resolution: 100, thresholds: 4 });
    expect(result.length).toBeGreaterThan(0);
    expect(result.length).toBeLessThanOrEqual(4);
  });

  it("each contour has coordinates and value", () => {
    const xs = [2, 2.1, 1.9, 2.2];
    const ys = [5, 5.1, 4.9, 5.2];
    const result = computeDensity({ x: xs, y: ys }, { bandwidth: 1.0, half: "full", resolution: 80, thresholds: 3 });
    for (const contour of result) {
      expect(contour.coordinates).toBeDefined();
      expect(contour.coordinates.length).toBeGreaterThan(0);
      expect(typeof contour.value).toBe("number");
    }
  });
});
