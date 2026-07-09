/**
 * <RayLayer> — shot trajectory arrows with optional curved arcs and flow mode.
 *
 * Straight lines or curved arcs from hit to bounce, colored by stroke type.
 * Flow mode aggregates shots into representative bundles with width proportional to count.
 */

import { memo, useMemo } from "react";
import {
  type CourtScales,
  type EnrichedShot,
  type ShotFlow,
  computeShotFlows,
  hasValidSpatialCoords,
  normalizeHit,
  normalizeShot,
} from "@courtviz/core";
import { interpolateRgb } from "d3-interpolate";
import { type CourtvizTheme, efficiencyColorStops } from "@courtviz/themes";

const STROKE_COLORS: Record<string, string> = {
  Backhand: "#2B6CB0",
  Feed: "#718096",
  Forehand: "#E8742C",
  Overhead: "#D53F8C",
  Serve: "#805AD5",
  Volley: "#38A169",
};

function getWinRateColor(winRate: number, theme: CourtvizTheme): string {
  const stops = efficiencyColorStops(theme);
  const t = Math.max(0, Math.min(1, winRate));
  for (let i = 0; i < stops.length - 1; i++) {
    const [offset1, color1] = stops[i]!;
    const [offset2, color2] = stops[i + 1]!;
    if (t >= offset1 && t <= offset2) {
      const localT = (t - offset1) / (offset2 - offset1);
      return interpolateRgb(color1, color2)(localT);
    }
  }
  return stops[stops.length - 1]![1];
}

export interface RayLayerProps {
  shots: EnrichedShot[];
  scales: CourtScales;
  theme: CourtvizTheme;
  player?: string;
  strokeFilter?: string[];
  alpha?: number;
  useHalfCourtNormalization?: boolean;
  showHitDots?: boolean;
  /** Draw curved arcs instead of straight lines (default false) */
  curved?: boolean;
  /** Curvature amount for arcs (default 0.3) */
  curvature?: number;
  /** Flow mode: aggregate shots into bundles (default false) */
  flowMode?: boolean;
  /** Min count per flow in flow mode (default 2) */
  flowMinCount?: number;
  /** Max flow width in pixels (default 8) */
  flowMaxWidth?: number;
}

export const RayLayer = memo(function RayLayer({
  alpha = 0.35,
  curved = false,
  curvature = 0.3,
  flowMaxWidth = 8,
  flowMinCount = 2,
  flowMode = false,
  player,
  scales,
  shots,
  showHitDots = true,
  strokeFilter,
  theme,
  useHalfCourtNormalization = false,
}: RayLayerProps) {
  const rays = useMemo(() => {
    return shots
      .filter((s) => {
        if (player && s.player !== player) return false;
        if (strokeFilter && !strokeFilter.includes(s.stroke)) return false;
        if (!hasValidSpatialCoords(s)) return false;
        if (s.hitX == null) return false;
        if (s.result !== "In") return false;
        return true;
      })
      .map((s) => {
        let bx = s.bounceX!;
        let by = s.bounceY!;
        let hx = s.hitX!;
        let hy = s.hitY!;
        if (useHalfCourtNormalization) {
          [bx, by] = normalizeShot(s.bounceX!, s.bounceY!, s.hitY!);
          [hx, hy] = normalizeHit(s.hitX!, s.hitY!);
        }
        return { bx, by, hx, hy, stroke: s.stroke };
      });
  }, [shots, player, strokeFilter, useHalfCourtNormalization]);

  const flows = useMemo<ShotFlow[]>(() => {
    if (!flowMode) return [];
    return computeShotFlows(shots, {
      minCount: flowMinCount,
      player: player ?? null,
      stroke: strokeFilter ? strokeFilter[0]! : null,
    });
  }, [shots, flowMode, player, strokeFilter, flowMinCount]);

  const markerId = useMemo(() => `ray-arrowhead-${Math.random().toString(36).slice(2, 8)}`, []);

  const maxFlowCount = useMemo(() => {
    return flows.reduce((m, f) => Math.max(m, f.count), 0);
  }, [flows]);

  // Build a curved path between two court points
  const curvedPath = (x1: number, y1: number, x2: number, y2: number): string => {
    const mx = (x1 + x2) / 2;
    const my = (y1 + y2) / 2;
    const dx = x2 - x1;
    const dy = y2 - y1;
    const len = Math.sqrt(dx * dx + dy * dy);
    if (len === 0) return `M${x1},${y1}L${x2},${y2}`;
    // Perpendicular offset for curve control point
    const offset = curvature * len;
    const cx = mx - (dy / len) * offset;
    const cy = my + (dx / len) * offset;
    return `M${x1},${y1}Q${cx},${cy}${x2},${y2}`;
  };

  return (
    <g>
      <defs>
        {Object.entries(STROKE_COLORS).map(([stroke, color]) => (
          <marker
            id={`${markerId}-${stroke}`}
            key={stroke}
            markerHeight={4}
            markerWidth={4}
            orient="auto"
            refX={3}
            refY={2}
          >
            <path d="M0,0 L4,2 L0,4 Z" fill={color} />
          </marker>
        ))}
      </defs>

      {/* Flow mode: aggregated bundles */}
      {flowMode && flows.map((flow, i) => {
        const width = maxFlowCount > 0
          ? Math.max(1, flowMaxWidth * Math.sqrt(flow.count / maxFlowCount))
          : 1;
        const d = curvedPath(
          scales.x(flow.fromX),
          scales.y(flow.fromY),
          scales.x(flow.toX),
          scales.y(flow.toY),
        );
        return (
          <path
            d={d}
            fill="none"
            key={`flow-${i}`}
            opacity={alpha + 0.25}
            stroke={getWinRateColor(flow.winRate, theme)}
            strokeWidth={width}
          />
        );
      })}

      {/* Individual rays */}
      {!flowMode && rays.map(({ bx, by, hx, hy, stroke }, i) => {
        const color = STROKE_COLORS[stroke] ?? theme.ink;
        const x1 = scales.x(hx);
        const y1 = scales.y(hy);
        const x2 = scales.x(bx);
        const y2 = scales.y(by);

        if (curved) {
          const d = curvedPath(x1, y1, x2, y2);
          return (
            <path
              d={d}
              fill="none"
              key={i}
              markerEnd={`url(#${markerId}-${stroke})`}
              opacity={alpha}
              stroke={color}
              strokeWidth={0.8}
            />
          );
        }

        return (
          <line
            key={i}
            markerEnd={`url(#${markerId}-${stroke})`}
            opacity={alpha}
            stroke={color}
            strokeWidth={0.8}
            x1={x1}
            x2={x2}
            y1={y1}
            y2={y2}
          />
        );
      })}

      {/* Hit dots */}
      {showHitDots && !flowMode &&
        rays.map(({ hx, hy, stroke }, i) => (
          <g key={`dot-${i}`}>
            <circle
              cx={scales.x(hx)}
              cy={scales.y(hy)}
              fill="none"
              opacity={alpha * 0.5}
              r={3}
              stroke={theme.haloColor}
              strokeWidth={0.5}
            />
            <circle
              cx={scales.x(hx)}
              cy={scales.y(hy)}
              fill={STROKE_COLORS[stroke] ?? theme.ink}
              opacity={alpha + 0.25}
              r={2}
            />
          </g>
        ))}
    </g>
  );
});
