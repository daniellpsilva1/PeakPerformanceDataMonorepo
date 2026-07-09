/**
 * <Court> — the foundational courtviz React SVG component.
 *
 * Renders a tennis court with surface fill, lines, and optional orientation.
 * Supports full/half court, 3 surfaces, portrait/landscape orientation.
 *
 * Uses @courtviz/core for geometry + scales, @courtviz/themes for styling.
 */

import { memo, useMemo } from "react";
import {
  type CourtHalf,
  type Orientation,
  type Surface,
  courtFillRect,
  courtLines,
} from "@courtviz/core";
import {
  type CourtvizTheme,
  getSurfaceColor,
  getSurfaceColorLight,
  getSurroundColor,
  sprawlball,
} from "@courtviz/themes";
import { createCourtScales, type CourtScales } from "@courtviz/core";

export interface CourtProps {
  /** Which half of the court to render */
  half?: CourtHalf;
  /** Court surface type */
  surface?: Surface;
  /** Orientation: portrait (standard) or landscape (rotated 90°) */
  orientation?: Orientation;
  /** Pixel width of the SVG */
  width?: number;
  /** Pixel height of the SVG */
  height?: number;
  /** Theme to use for styling */
  theme?: CourtvizTheme;
  /** Margin around court in meters */
  margin?: number;
  /** Show service box fill (lighter shade) */
  showServiceBox?: boolean;
  /** Line stroke width in pixels */
  lineWidth?: number;
  /** Additional className */
  className?: string;
  /** Children rendered inside the SVG (for overlaying shots, hexbins, etc.) */
  children?: React.ReactNode;
}

/**
 * Tennis court SVG component.
 *
 * @example
 * ```tsx
 * <Court surface="clay" half="full" width={1080} height={1080}>
 *   <HexbinLayer shots={enrichedShots} player="host" />
 * </Court>
 * ```
 */
export const Court = memo(function Court({
  className,
  children,
  half = "full",
  height = 1080,
  lineWidth = 2,
  margin = 1.5,
  orientation = "portrait",
  showServiceBox = true,
  surface = "hard",
  theme = sprawlball,
  width = 1080,
}: CourtProps) {
  // Swap dimensions for landscape
  const [svgWidth, svgHeight] = orientation === "landscape"
    ? [height, width]
    : [width, height];

  const scales = useMemo<CourtScales>(
    () => createCourtScales({ width: svgWidth, height: svgHeight, half, margin }),
    [svgWidth, svgHeight, half, margin],
  );

  const lines = useMemo(() => courtLines(half), [half]);
  const fillRect = useMemo(() => courtFillRect(half), [half]);

  const surfaceColor = getSurfaceColor(surface, theme);
  const surfaceColorLight = getSurfaceColorLight(surface, theme);
  const surroundColor = getSurroundColor(surface, theme);
  const lineColor = theme.courtLine;
  const lineColorDark = theme.courtLineDark;

  // Apply rotation for landscape
  const transform = orientation === "landscape"
    ? `rotate(90 ${svgWidth / 2} ${svgHeight / 2})`
    : undefined;

  // Clip path ID for overlay clipping to court bounds
  const clipId = useMemo(
    () => `court-clip-${Math.random().toString(36).slice(2, 9)}`,
    [],
  );

  const courtX = scales.x(fillRect[0]);
  const courtY = scales.y(fillRect[1] + fillRect[3]);
  const courtW = scales.x(fillRect[0] + fillRect[2]) - courtX;
  const courtH = scales.y(fillRect[1]) - courtY;

  // Separate lines by type for hierarchy
  const baselineIndices = new Set<number>();
  const netIndices = new Set<number>();
  lines.forEach((line, i) => {
    const [, y1, , y2] = line;
    // Baselines: horizontal lines at y=0 or y=COURT_LENGTH
    if ((y1 === 0 && y2 === 0) || (y1 === 23.77 && y2 === 23.77)) {
      baselineIndices.add(i);
    }
    // Net: horizontal line at y=11.885
    if (y1 === 11.885 && y2 === 11.885) {
      netIndices.add(i);
    }
  });

  return (
    <svg
      className={className}
      height={svgHeight}
      style={{ display: "block" }}
      viewBox={`0 0 ${svgWidth} ${svgHeight}`}
      width={svgWidth}
    >
      <defs>
        <clipPath id={clipId}>
          <rect height={courtH} width={courtW} x={courtX} y={courtY} />
        </clipPath>
        <filter id="court-shadow" x="-5%" y="-5%" width="110%" height="110%">
          <feDropShadow dx={0} dy={2} floodColor="#000000" floodOpacity={0.15} stdDeviation={3} />
        </filter>
      </defs>

      {/* Background */}
      <rect
        fill={theme.background}
        height={svgHeight}
        width={svgWidth}
        x={0}
        y={0}
      />

      <g transform={transform}>
        {/* Surround (out-of-bounds tint, slightly darker than surface) */}
        <rect
          fill={surroundColor}
          height={courtH + margin * scales.meterWidth * 2}
          width={courtW + margin * scales.meterWidth * 2}
          x={courtX - margin * scales.meterWidth}
          y={courtY - margin * scales.meterWidth}
        />

        {/* Court surface fill with subtle shadow */}
        <rect
          fill={surfaceColor}
          filter="url(#court-shadow)"
          height={courtH}
          width={courtW}
          x={courtX}
          y={courtY}
        />

        {/* Service box lighter fill */}
        {showServiceBox && (
          <ServiceBoxFill
            half={half}
            lineColorDark={lineColorDark}
            scales={scales}
            surfaceColorLight={surfaceColorLight}
          />
        )}

        {/* Court lines — regular (sidelines, service lines, center marks) */}
        <g
          fill="none"
          stroke={lineColor}
          strokeWidth={lineWidth}
        >
          {lines.map((line, i) => {
            if (baselineIndices.has(i) || netIndices.has(i)) return null;
            return (
              <line
                key={i}
                x1={scales.x(line[0])}
                x2={scales.x(line[2])}
                y1={scales.y(line[1])}
                y2={scales.y(line[3])}
              />
            );
          })}
        </g>

        {/* Baselines — thicker for hierarchy */}
        <g
          fill="none"
          stroke={lineColor}
          strokeWidth={lineWidth * 1.5}
        >
          {lines.map((line, i) => {
            if (!baselineIndices.has(i)) return null;
            return (
              <line
                key={i}
                x1={scales.x(line[0])}
                x2={scales.x(line[2])}
                y1={scales.y(line[1])}
                y2={scales.y(line[3])}
              />
            );
          })}
        </g>

        {/* Net — dashed and slightly thicker */}
        <g
          fill="none"
          stroke={lineColor}
          strokeDasharray={`${lineWidth * 3} ${lineWidth * 2}`}
          strokeWidth={lineWidth * 1.25}
        >
          {lines.map((line, i) => {
            if (!netIndices.has(i)) return null;
            return (
              <line
                key={i}
                x1={scales.x(line[0])}
                x2={scales.x(line[2])}
                y1={scales.y(line[1])}
                y2={scales.y(line[3])}
              />
            );
          })}
        </g>

        {/* Children (shots, hexbins, annotations, etc.) — clipped to court */}
        <g clipPath={`url(#${clipId})`}>
          {children}
        </g>
      </g>
    </svg>
  );
});

// ---------------------------------------------------------------------------
// Service box fill sub-component
// ---------------------------------------------------------------------------

interface ServiceBoxFillProps {
  half: CourtHalf;
  lineColorDark: string;
  scales: CourtScales;
  surfaceColorLight: string;
}

import { NET_Y, SERVICE_LINE_FAR, SERVICE_LINE_NEAR, SINGLES_HALF } from "@courtviz/core";

function ServiceBoxFill({ half, scales, surfaceColorLight }: ServiceBoxFillProps) {
  const boxes: Array<[number, number, number, number]> = [];

  if (half === "full" || half === "far") {
    boxes.push([-SINGLES_HALF, SERVICE_LINE_NEAR, SINGLES_HALF * 2, NET_Y - SERVICE_LINE_NEAR]);
    boxes.push([-SINGLES_HALF, NET_Y, SINGLES_HALF * 2, SERVICE_LINE_FAR - NET_Y]);
  }

  if (half === "near") {
    boxes.push([-SINGLES_HALF, SERVICE_LINE_NEAR, SINGLES_HALF * 2, NET_Y - SERVICE_LINE_NEAR]);
  }

  return (
    <g>
      {boxes.map((box, i) => (
        <rect
          fill={surfaceColorLight}
          height={Math.abs(scales.y(box[1]) - scales.y(box[1] + box[3]))}
          key={i}
          width={scales.x(box[0] + box[2]) - scales.x(box[0])}
          x={scales.x(box[0])}
          y={scales.y(box[1] + box[3])}
        />
      ))}
    </g>
  );
}
