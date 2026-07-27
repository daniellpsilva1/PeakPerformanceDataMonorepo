"use client";

import type { BodySystemId } from "@bodyviz/tokens";
import { bodySystemColors } from "@bodyviz/tokens";
import type { DailySnapshot } from "@bodyviz/core";
import type { TourStop } from "@bodyviz/core";
import { getMetricForSystem } from "./metrics";

export interface FallbackSilhouetteProps {
  activeSystem: BodySystemId | null;
  snapshot: DailySnapshot;
  tourStop: TourStop | null;
}

/**
 * 2D SVG silhouette fallback for non-WebGL / prefers-reduced-motion.
 * Reuses the same metric mapping as the 3D body twin.
 */
export function FallbackSilhouette({
  activeSystem,
  snapshot,
  tourStop,
}: FallbackSilhouetteProps) {
  const glowColor = activeSystem
    ? bodySystemColors[activeSystem].glow
    : "#3B82F6";
  const regions = tourStop?.regions ?? [];
  const metric = activeSystem
    ? getMetricForSystem(activeSystem, snapshot)
    : null;

  const highlightHead = regions.includes("brain") || regions.includes("head");
  const highlightTorso = regions.includes("torso") || regions.includes("chest");
  const highlightHeart = regions.includes("heart");
  const highlightLimbs =
    regions.includes("muscles") ||
    regions.includes("arms") ||
    regions.includes("legs");
  const highlightFull = regions.includes("fullBody") || regions.includes("skin");

  return (
    <svg
      style={{ height: "100%", width: "100%" }}
      viewBox="0 0 100 200"
    >
      <defs>
        <filter id="glow">
          <feGaussianBlur stdDeviation="2" />
        </filter>
      </defs>

      {/* Full body glow for recovery/stress */}
      {highlightFull && (
        <ellipse
          cx="50"
          cy="100"
          fill={glowColor}
          opacity="0.08"
          rx="28"
          ry="90"
        />
      )}

      {/* Head */}
      <circle
        cx="50"
        cy="22"
        fill={highlightHead ? glowColor : "#1E293B"}
        opacity={highlightHead ? 0.6 : 0.3}
        r="12"
        stroke={highlightHead ? glowColor : "#2A3550"}
        strokeWidth="0.5"
      />

      {/* Torso */}
      <rect
        fill={highlightTorso ? glowColor : "#1E293B"}
        height="50"
        opacity={highlightTorso ? 0.4 : 0.3}
        rx="8"
        width="28"
        x="36"
        y="36"
      />

      {/* Heart */}
      {highlightHeart && (
        <circle
          cx="54"
          cy="50"
          fill={glowColor}
          opacity="0.5"
          r="4"
        />
      )}

      {/* Arms */}
      <rect
        fill={highlightLimbs ? glowColor : "#1E293B"}
        height="45"
        opacity={highlightLimbs ? 0.3 : 0.25}
        rx="3"
        width="6"
        x="28"
        y="38"
      />
      <rect
        fill={highlightLimbs ? glowColor : "#1E293B"}
        height="45"
        opacity={highlightLimbs ? 0.3 : 0.25}
        rx="3"
        width="6"
        x="66"
        y="38"
      />

      {/* Legs */}
      <rect
        fill={highlightLimbs ? glowColor : "#1E293B"}
        height="55"
        opacity={highlightLimbs ? 0.3 : 0.25}
        rx="3"
        width="8"
        x="40"
        y="88"
      />
      <rect
        fill={highlightLimbs ? glowColor : "#1E293B"}
        height="55"
        opacity={highlightLimbs ? 0.3 : 0.25}
        rx="3"
        width="8"
        x="52"
        y="88"
      />

      {/* Metric label */}
      {metric && metric.value !== null && (
        <text
          fill={glowColor}
          fontFamily="Barlow Condensed, Arial Narrow, sans-serif"
          fontSize="10"
          fontWeight="700"
          textAnchor="middle"
          x="50"
          y="170"
        >
          {metric.display}
        </text>
      )}
    </svg>
  );
}
