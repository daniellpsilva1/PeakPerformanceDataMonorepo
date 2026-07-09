/**
 * <DensityLayer> — KDE density contour overlay for the Court component.
 *
 * Renders filled contour polygons from computeDensity, showing shot
 * concentration areas. Uses perceptual color stops from the theme.
 */

import { memo, useMemo } from "react";
import {
  type CourtHalf,
  type CourtScales,
  type EnrichedShot,
  computeDensity,
  type DensityContour,
} from "@courtviz/core";
import { type CourtvizTheme, efficiencyColorStops } from "@courtviz/themes";
import { interpolateRgb } from "d3-interpolate";

export interface DensityLayerProps {
  shots: EnrichedShot[];
  scales: CourtScales;
  theme: CourtvizTheme;
  player?: string;
  half?: CourtHalf;
  /** KDE bandwidth in court meters (default 1.5) */
  bandwidth?: number;
  /** Grid resolution (default 200) */
  resolution?: number;
  /** Number of contour levels (default 8) */
  thresholds?: number;
  /** Base color for low density (defaults to theme diverging low) */
  lowColor?: string;
  /** Peak color for high density (defaults to theme diverging peak) */
  highColor?: string;
  /** Opacity of contour fills (default 0.4) */
  alpha?: number;
  /** Show contour outlines (default true) */
  showOutlines?: boolean;
}

export const DensityLayer = memo(function DensityLayer({
  alpha = 0.4,
  bandwidth = 1.5,
  half = "full",
  highColor,
  lowColor,
  player,
  resolution = 200,
  scales,
  shots,
  showOutlines = true,
  theme,
  thresholds = 8,
}: DensityLayerProps) {
  const contours = useMemo(() => {
    const filtered = shots.filter(
      (s) =>
        (!player || s.player === player) &&
        s.bounceX != null &&
        s.bounceY != null &&
        s.result === "In",
    );

    const xs = filtered.map((s) => s.bounceX!);
    const ys = filtered.map((s) => s.bounceY!);

    return computeDensity(
      { x: xs, y: ys },
      { bandwidth, half, resolution, thresholds },
    );
  }, [shots, player, half, bandwidth, resolution, thresholds]);

  const stops = useMemo(() => efficiencyColorStops(theme), [theme]);
  const low = lowColor ?? stops[0]![1];
  const high = highColor ?? stops[stops.length - 1]![1];

  const colorForContour = useMemo(() => {
    if (contours.length === 0) return () => low;
    const values = contours.map((c) => c.value);
    const vmin = Math.min(...values);
    const vmax = Math.max(...values);
    const interpolator = interpolateRgb(low, high);
    return (value: number) => {
      const t = vmax > vmin ? (value - vmin) / (vmax - vmin) : 0.5;
      return interpolator(t);
    };
  }, [contours, low, high]);

  const pathForContour = (contour: DensityContour): string => {
    const parts: string[] = [];
    for (const polygon of contour.coordinates) {
      for (const ring of polygon) {
        if (ring.length === 0) continue;
        const [startX, startY] = ring[0]!;
        parts.push(`M${scales.x(startX!)},${scales.y(startY!)}`);
        for (let i = 1; i < ring.length; i++) {
          const [px, py] = ring[i]!;
          parts.push(`L${scales.x(px!)},${scales.y(py!)}`);
        }
        parts.push("Z");
      }
    }
    return parts.join("");
  };

  return (
    <g>
      {contours.map((contour, i) => {
        const color = colorForContour(contour.value);
        const d = pathForContour(contour);
        return (
          <g key={i}>
            <path
              d={d}
              fill={color}
              opacity={alpha}
            />
            {showOutlines && (
              <path
                d={d}
                fill="none"
                opacity={alpha * 0.8}
                stroke={color}
                strokeWidth={0.75}
              />
            )}
          </g>
        );
      })}
    </g>
  );
});
