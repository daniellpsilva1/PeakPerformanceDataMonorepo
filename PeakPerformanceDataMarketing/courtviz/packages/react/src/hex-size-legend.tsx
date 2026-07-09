/**
 * <HexSizeLegend> — shows the size encoding for hexbin maps.
 *
 * Displays a few sample hexagons at different sizes with count labels,
 * communicating the frequency encoding of the hexbin visualization.
 */

import { memo } from "react";
import { type CourtvizTheme, sprawlball } from "@courtviz/themes";

export interface HexSizeLegendProps {
  /** Theme for styling */
  theme?: CourtvizTheme;
  /** X position in SVG pixels */
  x?: number;
  /** Y position in SVG pixels */
  y?: number;
  /** Maximum hex radius in pixels */
  maxRadius?: number;
  /** Label for the legend */
  label?: string;
  /** Sample counts to show (default [2, 5, 10]) */
  counts?: number[];
  /** Maximum count in the data (for scaling) */
  maxCount?: number;
}

export const HexSizeLegend = memo(function HexSizeLegend({
  counts = [2, 5, 10],
  label = "Shots",
  maxCount = 10,
  maxRadius = 20,
  theme = sprawlball,
  x = 0,
  y = 0,
}: HexSizeLegendProps) {
  const fs = theme.fontSize;
  const fonts = theme.fonts;

  const hexPath = (cx: number, cy: number, r: number): string => {
    const pts: string[] = [];
    for (let j = 0; j < 6; j++) {
      const angle = (Math.PI / 3) * j + Math.PI / 2;
      pts.push(`${cx + r * Math.cos(angle)},${cy + r * Math.sin(angle)}`);
    }
    return `M${pts.join("L")}Z`;
  };

  const gap = maxRadius * 2 + 12;
  const fill = theme.inkMuted;
  const stroke = theme.ink;

  return (
    <g transform={`translate(${x} ${y})`}>
      <text
        fill={stroke}
        fontFamily={`${fonts.condensedFont}, ${fonts.condensedFontFallback}`}
        fontSize={fs.label}
        fontWeight={600}
        textAnchor="start"
        x={0}
        y={-maxRadius - 4}
      >
        {label}
      </text>

      {counts.map((count, i) => {
        const r = maxRadius * Math.sqrt(count / maxCount);
        const cx = i * gap + r;
        const cy = 0;
        return (
          <g key={i}>
            <path
              d={hexPath(cx, cy, r)}
              fill={fill}
              opacity={0.3}
              stroke={stroke}
              strokeWidth={1}
            />
            <text
              dominantBaseline="middle"
              fill={stroke}
              fontFamily={`${fonts.bodyFont}, ${fonts.bodyFontFallback}`}
              fontSize={fs.small}
              textAnchor="middle"
              x={cx}
              y={cy + maxRadius + 12}
            >
              {count}
            </text>
          </g>
        );
      })}
    </g>
  );
});
