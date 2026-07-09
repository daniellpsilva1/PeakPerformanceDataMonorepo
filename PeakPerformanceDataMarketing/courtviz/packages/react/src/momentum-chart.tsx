/**
 * <MomentumChart> — rolling point-win differential area chart.
 *
 * Standalone SVG chart (not a court overlay). Uses computeMomentum() from
 * @courtviz/core. Positive = host winning, negative = guest winning.
 * Dual fill: host color above zero, guest color below.
 */

import { memo, useMemo } from "react";
import { computeMomentum, type MomentumPoint } from "@courtviz/core";
import { type CourtvizTheme, getPlayerColor } from "@courtviz/themes";

export interface MomentumChartProps {
  points: Array<{
    setNumber: number;
    gameNumber: number;
    pointWinner: string;
    isBreakPoint: boolean;
    isSetPoint: boolean;
    isMatchPoint: boolean;
  }>;
  hostPlayer: string;
  theme: CourtvizTheme;
  width?: number;
  height?: number;
  showBreakPoints?: boolean;
  showSetBoundaries?: boolean;
  /** Show set number labels at boundaries (default true) */
  showSetLabels?: boolean;
}

export const MomentumChart = memo(function MomentumChart({
  height = 200,
  hostPlayer,
  points,
  showBreakPoints = true,
  showSetBoundaries = true,
  showSetLabels = true,
  theme,
  width = 800,
}: MomentumChartProps) {
  const momentum = useMemo(
    () => computeMomentum(points, hostPlayer),
    [points, hostPlayer],
  );

  const padding = { bottom: 30, left: 40, right: 20, top: 20 };
  const chartW = width - padding.left - padding.right;
  const chartH = height - padding.top - padding.bottom;

  const { maxAbs, setBoundaries } = useMemo(() => {
    const ma = Math.max(1, ...momentum.map((m) => Math.abs(m.cumulativeDiff)));
    const boundaries: Array<{ index: number; setNumber: number }> = [];
    let lastSet = -1;
    momentum.forEach((m) => {
      if (m.setNumber !== lastSet) {
        boundaries.push({ index: m.pointIndex, setNumber: m.setNumber });
        lastSet = m.setNumber;
      }
    });
    return { maxAbs: ma, setBoundaries: boundaries };
  }, [momentum]);

  const xScale = (i: number) => padding.left + (i / Math.max(momentum.length - 1, 1)) * chartW;
  const yScale = (v: number) => padding.top + chartH / 2 - (v / maxAbs) * (chartH / 2);

  const hostColor = getPlayerColor("host", theme);
  const guestColor = getPlayerColor("guest", theme);
  const zeroY = yScale(0);

  // Host area (positive, above zero)
  const hostAreaPath = useMemo(() => {
    if (momentum.length === 0) return "";
    let path = `M ${xScale(0)} ${zeroY}`;
    for (const m of momentum) {
      const y = m.cumulativeDiff >= 0 ? yScale(m.cumulativeDiff) : zeroY;
      path += ` L ${xScale(m.pointIndex)} ${y}`;
    }
    path += ` L ${xScale(momentum[momentum.length - 1]!.pointIndex)} ${zeroY} Z`;
    return path;
  }, [momentum, maxAbs]);

  // Guest area (negative, below zero)
  const guestAreaPath = useMemo(() => {
    if (momentum.length === 0) return "";
    let path = `M ${xScale(0)} ${zeroY}`;
    for (const m of momentum) {
      const y = m.cumulativeDiff <= 0 ? yScale(m.cumulativeDiff) : zeroY;
      path += ` L ${xScale(m.pointIndex)} ${y}`;
    }
    path += ` L ${xScale(momentum[momentum.length - 1]!.pointIndex)} ${zeroY} Z`;
    return path;
  }, [momentum, maxAbs]);

  const linePath = useMemo(() => {
    if (momentum.length === 0) return "";
    let path = `M ${xScale(0)} ${yScale(momentum[0]!.cumulativeDiff)}`;
    for (const m of momentum) {
      path += ` L ${xScale(m.pointIndex)} ${yScale(m.cumulativeDiff)}`;
    }
    return path;
  }, [momentum, maxAbs]);

  const breakPoints = useMemo(
    () => momentum.filter((m) => m.isBreakPoint),
    [momentum],
  ) as MomentumPoint[];

  const fontBody = `${theme.fonts.bodyFont}, ${theme.fonts.bodyFontFallback}`;
  const fontCondensed = `${theme.fonts.condensedFont}, ${theme.fonts.condensedFontFallback}`;
  const fs = theme.fontSize;

  return (
    <svg
      height={height}
      style={{ display: "block" }}
      viewBox={`0 0 ${width} ${height}`}
      width={width}
    >
      <rect fill={theme.background} height={height} width={width} x={0} y={0} />

      {/* Set boundary bands */}
      {showSetBoundaries && setBoundaries.map((sb, i) => {
        const nextBoundary = setBoundaries[i + 1];
        const x1 = xScale(sb.index);
        const x2 = nextBoundary ? xScale(nextBoundary.index) : (width - padding.right);
        const isEvenSet = sb.setNumber % 2 === 0;
        return (
          <g key={`set-band-${i}`}>
            <rect
              fill={isEvenSet ? theme.ink : theme.inkMuted}
              height={chartH}
              opacity={0.03}
              x={x1}
              y={padding.top}
              width={x2 - x1}
            />
            <line
              stroke={theme.inkMuted}
              strokeDasharray="2 2"
              strokeWidth={0.5}
              x1={x1}
              x2={x1}
              y1={padding.top}
              y2={height - padding.bottom}
            />
            {showSetLabels && (
              <text
                fill={theme.inkMuted}
                fontFamily={fontCondensed}
                fontSize={fs.small}
                fontWeight={600}
                textAnchor="middle"
                x={(x1 + x2) / 2}
                y={padding.top - 4}
              >
                Set {sb.setNumber}
              </text>
            )}
          </g>
        );
      })}

      {/* Zero line */}
      <line
        stroke={theme.inkMuted}
        strokeDasharray="4 4"
        strokeWidth={1}
        x1={padding.left}
        x2={width - padding.right}
        y1={zeroY}
        y2={zeroY}
      />

      {/* Host fill (positive) */}
      <path
        d={hostAreaPath}
        fill={hostColor}
        opacity={0.2}
      />

      {/* Guest fill (negative) */}
      <path
        d={guestAreaPath}
        fill={guestColor}
        opacity={0.2}
      />

      {/* Line */}
      <path
        d={linePath}
        fill="none"
        stroke={theme.ink}
        strokeWidth={1.5}
      />

      {/* Break point markers with halos */}
      {showBreakPoints &&
        breakPoints.map((bp, i) => {
          const color = bp.pointWinner === hostPlayer ? hostColor : guestColor;
          const cx = xScale(bp.pointIndex);
          const cy = yScale(bp.cumulativeDiff);
          return (
            <g key={`bp-${i}`}>
              <circle
                cx={cx}
                cy={cy}
                fill="none"
                opacity={0.5}
                r={5}
                stroke={theme.haloColor}
                strokeWidth={1}
              />
              <circle
                cx={cx}
                cy={cy}
                fill={color}
                r={3}
                stroke={theme.background}
                strokeWidth={1}
              />
            </g>
          );
        })}

      {/* Y-axis labels */}
      <text
        fill={hostColor}
        fontFamily={fontBody}
        fontSize={fs.small}
        textAnchor="end"
        x={padding.left - 6}
        y={yScale(maxAbs) + 3}
      >
        +{maxAbs}
      </text>
      <text
        fill={guestColor}
        fontFamily={fontBody}
        fontSize={fs.small}
        textAnchor="end"
        x={padding.left - 6}
        y={yScale(-maxAbs) + 3}
      >
        -{maxAbs}
      </text>
      <text
        fill={theme.inkMuted}
        fontFamily={fontBody}
        fontSize={fs.small}
        textAnchor="end"
        x={padding.left - 6}
        y={zeroY + 3}
      >
        0
      </text>
    </svg>
  );
});
