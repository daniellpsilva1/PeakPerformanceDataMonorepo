/**
 * <Annotation> — editorial callout with leader line.
 *
 * Draws a leader line from a court point to a text label, with optional
 * callout box. Inspired by SprawlBall/Hoop Atlas annotation style.
 */

import { memo } from "react";
import { type CourtvizTheme, sprawlball } from "@courtviz/themes";

export interface AnnotationProps {
  /** Anchor x in SVG pixels (the point being annotated) */
  x: number;
  /** Anchor y in SVG pixels */
  y: number;
  /** Label x in SVG pixels (where the text goes) */
  labelX: number;
  /** Label y in SVG pixels */
  labelY: number;
  /** Annotation text */
  text: string;
  /** Optional second line of text */
  subtext?: string;
  /** Theme for styling */
  theme?: CourtvizTheme;
  /** Show a callout box behind the text */
  showCallout?: boolean;
  /** Dot radius at the anchor point (default 3) */
  dotRadius?: number;
}

export const Annotation = memo(function Annotation({
  dotRadius = 3,
  labelX,
  labelY,
  showCallout = false,
  subtext,
  text,
  theme = sprawlball,
  x,
  y,
}: AnnotationProps) {
  const ann = theme.annotation;
  const fs = theme.fontSize;
  const fonts = theme.fonts;

  const textW = text.length * fs.label * 0.6 + 8;
  const textH = subtext ? fs.label * 3 : fs.label * 1.8;
  const calloutX = labelX < x ? labelX - textW : labelX;
  const calloutY = labelY - fs.label;

  return (
    <g>
      {/* Leader line */}
      <line
        stroke={ann.leaderColor}
        strokeWidth={ann.leaderWidth}
        x1={x}
        x2={labelX}
        y1={y}
        y2={labelY}
      />

      {/* Anchor dot */}
      <circle
        cx={x}
        cy={y}
        fill={ann.leaderColor}
        r={dotRadius}
      />

      {/* Callout box */}
      {showCallout && (
        <rect
          fill={ann.calloutFill}
          height={textH}
          opacity={0.9}
          rx={3}
          width={textW}
          x={calloutX}
          y={calloutY}
        />
      )}

      {/* Label text */}
      <text
        dominantBaseline="middle"
        fill={ann.calloutTextColor}
        fontFamily={`${fonts.condensedFont}, ${fonts.condensedFontFallback}`}
        fontSize={fs.label}
        fontWeight={600}
        textAnchor={labelX < x ? "end" : "start"}
        x={labelX + (labelX < x ? -4 : 4)}
        y={subtext ? labelY - fs.label * 0.5 : labelY}
      >
        {text}
      </text>

      {/* Subtext */}
      {subtext && (
        <text
          dominantBaseline="middle"
          fill={theme.inkMuted}
          fontFamily={`${fonts.bodyFont}, ${fonts.bodyFontFallback}`}
          fontSize={fs.label * 0.85}
          textAnchor={labelX < x ? "end" : "start"}
          x={labelX + (labelX < x ? -4 : 4)}
          y={labelY + fs.label * 0.7}
        >
          {subtext}
        </text>
      )}
    </g>
  );
});
