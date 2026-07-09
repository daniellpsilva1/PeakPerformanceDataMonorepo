/**
 * <DotLayer> — scatter plot overlay for shot bounce locations.
 *
 * Colors dots by stroke type, player, speed, or result.
 */

import { memo, useMemo } from "react";
import { type CourtScales, type EnrichedShot, hasValidSpatialCoords, normalizeShot } from "@courtviz/core";
import { type CourtvizTheme, getPlayerColor } from "@courtviz/themes";

export type DotColorBy = "stroke" | "player" | "speed" | "result";

const STROKE_COLORS: Record<string, string> = {
  Backhand: "#2B6CB0",
  Feed: "#718096",
  Forehand: "#E8742C",
  Overhead: "#D53F8C",
  Serve: "#805AD5",
  Volley: "#38A169",
};

const RESULT_COLORS: Record<string, string> = {
  In: "#38A169",
  Net: "#3182CE",
  Out: "#E53E3E",
};

export interface DotLayerProps {
  shots: EnrichedShot[];
  scales: CourtScales;
  theme: CourtvizTheme;
  player?: string;
  colorBy?: DotColorBy;
  size?: number;
  alpha?: number;
  strokeFilter?: string[];
  resultFilter?: string;
  useHalfCourtNormalization?: boolean;
  /** Halo stroke width (default 0.5, set 0 to disable) */
  haloWidth?: number;
}

export const DotLayer = memo(function DotLayer({
  alpha = 0.6,
  colorBy = "stroke",
  haloWidth = 0.5,
  player,
  resultFilter,
  scales,
  shots,
  size = 5,
  strokeFilter,
  theme,
  useHalfCourtNormalization = false,
}: DotLayerProps) {
  const dots = useMemo(() => {
    return shots
      .filter((s) => {
        if (player && s.player !== player) return false;
        if (strokeFilter && !strokeFilter.includes(s.stroke)) return false;
        if (resultFilter && s.result !== resultFilter) return false;
        if (!hasValidSpatialCoords(s)) return false;
        return true;
      })
      .map((s) => {
        let x = s.bounceX!;
        let y = s.bounceY!;
        if (useHalfCourtNormalization) {
          [x, y] = normalizeShot(s.bounceX!, s.bounceY!, s.hitY!);
        }
        return { shot: s, x, y };
      });
  }, [shots, player, strokeFilter, resultFilter, useHalfCourtNormalization]);

  function getColor(stroke: string, plyr: string, speed: number | null, result: string): string {
    if (colorBy === "stroke") return STROKE_COLORS[stroke] ?? "#999999";
    if (colorBy === "player") return getPlayerColor(plyr, theme);
    if (colorBy === "speed") {
      if (speed == null) return "#999999";
      const t = Math.max(0, Math.min(1, (speed - 40) / 80));
      const r = Math.round(40 + (255 - 40) * t);
      const g = Math.round(100 * (1 - t));
      const b = Math.round(200 * (1 - t));
      return `rgb(${r},${g},${b})`;
    }
    if (colorBy === "result") return RESULT_COLORS[result] ?? "#999999";
    return "#999999";
  }

  return (
    <g>
      {dots.map(({ shot, x, y }, i) => (
        <g key={i}>
          {haloWidth > 0 && (
            <circle
              cx={scales.x(x)}
              cy={scales.y(y)}
              fill="none"
              opacity={alpha * 0.5}
              r={size + haloWidth}
              stroke={theme.haloColor}
              strokeWidth={haloWidth}
            />
          )}
          <circle
            cx={scales.x(x)}
            cy={scales.y(y)}
            fill={getColor(shot.stroke, shot.player, shot.speedKmh, shot.result)}
            opacity={alpha}
            r={size}
          />
        </g>
      ))}
    </g>
  );
});
