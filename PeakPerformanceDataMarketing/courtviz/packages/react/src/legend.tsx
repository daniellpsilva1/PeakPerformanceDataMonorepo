/**
 * <ColorBar> and <Legend> — reusable SVG legend components.
 */

import { memo } from "react";
import { type CourtvizTheme, efficiencyColorStops } from "@courtviz/themes";

// ---------------------------------------------------------------------------
// ColorBar — horizontal gradient for hexbin color scales
// ---------------------------------------------------------------------------

export interface ColorBarProps {
  theme: CourtvizTheme;
  label?: string;
  min: number | string;
  max: number | string;
  width?: number;
  height?: number;
}

export const ColorBar = memo(function ColorBar({
  height = 16,
  label,
  max,
  min,
  theme,
  width = 200,
}: ColorBarProps) {
  const stops = efficiencyColorStops(theme);
  const gradientId = `colorbar-${Math.random().toString(36).slice(2, 8)}`;

  return (
    <g>
      <defs>
        <linearGradient id={gradientId} x1="0%" x2="100%" y1="0%" y2="0%">
          {stops.map(([offset, color], i) => (
            <stop
              key={i}
              offset={`${offset * 100}%`}
              stopColor={color}
            />
          ))}
        </linearGradient>
      </defs>
      <rect
        fill={`url(#${gradientId})`}
        height={height}
        rx={2}
        width={width}
        x={0}
        y={0}
      />
      <text
        fill={theme.inkMuted}
        fontFamily={theme.fonts.bodyFont}
        fontSize={theme.fontSize.small}
        textAnchor="start"
        x={0}
        y={height + 12}
      >
        {min}
      </text>
      <text
        fill={theme.inkMuted}
        fontFamily={theme.fonts.bodyFont}
        fontSize={theme.fontSize.small}
        textAnchor="end"
        x={width}
        y={height + 12}
      >
        {max}
      </text>
      {label && (
        <text
          fill={theme.ink}
          fontFamily={theme.fonts.condensedFont}
          fontSize={theme.fontSize.body}
          fontWeight="bold"
          textAnchor="middle"
          x={width / 2}
          y={-4}
        >
          {label}
        </text>
      )}
    </g>
  );
});

// ---------------------------------------------------------------------------
// Legend — categorical swatches with labels
// ---------------------------------------------------------------------------

export interface LegendItem {
  color: string;
  label: string;
}

export interface LegendProps {
  items: LegendItem[];
  theme: CourtvizTheme;
  x?: number;
  y?: number;
  orientation?: "horizontal" | "vertical";
  swatchSize?: number;
}

export const Legend = memo(function Legend({
  items,
  orientation = "vertical",
  swatchSize = 12,
  theme,
  x = 0,
  y = 0,
}: LegendProps) {
  const gap = 4;
  const lineHeight = swatchSize + gap;

  return (
    <g transform={`translate(${x}, ${y})`}>
      {items.map((item, i) => {
        const itemY = orientation === "vertical" ? i * lineHeight : 0;
        const itemX = orientation === "horizontal" ? i * (swatchSize + gap + item.label.length * 6) : 0;
        return (
          <g key={i} transform={`translate(${itemX}, ${itemY})`}>
            <rect
              fill={item.color}
              height={swatchSize}
              rx={2}
              width={swatchSize}
              x={0}
              y={0}
            />
            <text
              dominantBaseline="middle"
              fill={theme.ink}
              fontFamily={theme.fonts.bodyFont}
              fontSize={theme.fontSize.small}
              x={swatchSize + gap}
              y={swatchSize / 2}
            >
              {item.label}
            </text>
          </g>
        );
      })}
    </g>
  );
});
