/**
 * <FigureFrame> — self-contained editorial SVG figure wrapper.
 *
 * Provides title, subtitle, source note, and a content area for court
 * visualizations. Inspired by SprawlBall/Hoop Atlas figure layouts.
 */

import { memo, type ReactNode } from "react";
import { type CourtvizTheme, sprawlball } from "@courtviz/themes";

export interface FigureFrameProps {
  /** Main figure title */
  title?: string;
  /** Subtitle below the title */
  subtitle?: string;
  /** Source / credit line at the bottom */
  source?: string;
  /** Theme for styling */
  theme?: CourtvizTheme;
  /** Total pixel width of the figure */
  width?: number;
  /** Total pixel height of the figure */
  height?: number;
  /** Padding around the content area in pixels */
  padding?: number;
  /** Background color override (defaults to theme.background) */
  background?: string;
  /** Children (court SVG, legends, annotations, etc.) */
  children?: ReactNode;
}

export const FigureFrame = memo(function FigureFrame({
  background,
  children,
  height = 1080,
  padding = 40,
  source,
  subtitle,
  theme = sprawlball,
  title,
  width = 1080,
}: FigureFrameProps) {
  const bg = background ?? theme.background;
  const fs = theme.fontSize;
  const fonts = theme.fonts;

  const titleH = title ? fs.figureTitle * 1.2 : 0;
  const subtitleH = subtitle ? fs.figureSubtitle * 1.5 : 0;
  const sourceH = source ? fs.source * 1.8 : 0;
  const headerH = titleH + subtitleH + (title || subtitle ? padding * 0.5 : 0);
  const contentY = padding + headerH;
  const contentH = height - contentY - sourceH - padding * 0.5;

  return (
    <svg
      height={height}
      style={{ display: "block" }}
      viewBox={`0 0 ${width} ${height}`}
      width={width}
    >
      {/* Background */}
      <rect fill={bg} height={height} width={width} x={0} y={0} />

      {/* Title */}
      {title && (
        <text
          fill={theme.ink}
          fontFamily={`${fonts.condensedFont}, ${fonts.condensedFontFallback}`}
          fontSize={fs.figureTitle}
          fontWeight={700}
          letterSpacing={0.5}
          textAnchor="start"
          x={padding}
          y={padding + fs.figureTitle}
        >
          {title}
        </text>
      )}

      {/* Subtitle */}
      {subtitle && (
        <text
          fill={theme.inkMuted}
          fontFamily={`${fonts.bodyFont}, ${fonts.bodyFontFallback}`}
          fontSize={fs.figureSubtitle}
          textAnchor="start"
          x={padding}
          y={padding + titleH + fs.figureSubtitle + 4}
        >
          {subtitle}
        </text>
      )}

      {/* Content area */}
      <g transform={`translate(0 ${contentY})`} data-content-height={contentH}>
        {children}
      </g>

      {/* Source note */}
      {source && (
        <text
          fill={theme.inkMuted}
          fontFamily={`${fonts.bodyFont}, ${fonts.bodyFontFallback}`}
          fontSize={fs.source}
          textAnchor="start"
          x={padding}
          y={height - padding * 0.5}
        >
          {source}
        </text>
      )}
    </svg>
  );
});
