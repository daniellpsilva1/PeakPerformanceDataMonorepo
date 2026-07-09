import {
  COURT_LENGTH,
  SINGLES_HALF,
  computeHexbins,
  computeShotFlows,
  createCourtScales,
  shotPlayerWonPoint,
  type EnrichedShot,
  type ShotFlow,
} from "@courtviz/core";
import { ppdDark, efficiencyColorStops, type CourtvizTheme } from "@courtviz/themes";
import { interpolateRgb } from "d3-interpolate";

const theme = ppdDark;
const stops = efficiencyColorStops(theme);

/** Court theme for data scenes — matches PPD / courtviz demo */
export const darkCourt: CourtvizTheme = ppdDark;

const darkStops = efficiencyColorStops(darkCourt);

export function getEfficiencyColor(value: number, useDark = false): string {
  const colorStops = useDark ? darkStops : stops;
  const t = Math.max(0, Math.min(1, value));
  for (let i = 0; i < colorStops.length - 1; i++) {
    const [offset1, color1] = colorStops[i]!;
    const [offset2, color2] = colorStops[i + 1]!;
    if (t >= offset1 && t <= offset2) {
      const localT = (t - offset1) / (offset2 - offset1);
      return interpolateRgb(color1, color2)(localT);
    }
  }
  return colorStops[colorStops.length - 1]![1];
}

export function buildPlayerHexbins(
  shots: EnrichedShot[],
  player: string,
  half: "near" | "full" = "near",
) {
  const playerShots = shots.filter(
    (s) =>
      s.player === player &&
      s.stroke !== "Serve" &&
      s.bounceX != null &&
      s.bounceY != null &&
      s.result === "In",
  );

  return computeHexbins(
    {
      x: playerShots.map((s) => s.bounceX!),
      y: playerShots.map((s) => s.bounceY!),
      values: playerShots.map((s) => (shotPlayerWonPoint(s) ? 1 : 0)),
    },
    { gridsize: 8, half, minCount: 2, sizeRange: [0.25, 0.95] },
  ).sort((a, b) => b.count - a.count);
}

export function buildPlayerFlows(shots: EnrichedShot[], player: string): ShotFlow[] {
  const inShots = shots.filter(
    (s) =>
      s.player === player &&
      s.stroke !== "Serve" &&
      s.result === "In" &&
      s.bounceX != null &&
      s.bounceY != null &&
      s.hitX != null &&
      s.hitY != null,
  );

  return computeShotFlows(inShots, { minCount: 3, player })
    .sort((a, b) => b.count - a.count)
    .slice(0, 8)
    .map((flow) => ({
      ...flow,
      fromX: clamp(flow.fromX, -SINGLES_HALF, SINGLES_HALF),
      fromY: clamp(flow.fromY, 0, COURT_LENGTH),
      toX: clamp(flow.toX, -SINGLES_HALF, SINGLES_HALF),
      toY: clamp(flow.toY, 0, COURT_LENGTH),
    }));
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

/**
 * Curved path with reduced curvature and control point clamped inside court bounds.
 */
export function curvedPath(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  curvature = 0.07,
  courtBounds?: { xMin: number; xMax: number; yMin: number; yMax: number },
): string {
  const mx = (x1 + x2) / 2;
  const my = (y1 + y2) / 2;
  const dx = x2 - x1;
  const dy = y2 - y1;
  const len = Math.sqrt(dx * dx + dy * dy);
  if (len === 0) return `M${x1},${y1}L${x2},${y2}`;

  const offset = curvature * len;
  let cx = mx - (dy / len) * offset;
  let cy = my + (dx / len) * offset;

  if (courtBounds) {
    cx = clamp(cx, courtBounds.xMin, courtBounds.xMax);
    cy = clamp(cy, courtBounds.yMin, courtBounds.yMax);
  }

  return `M${x1},${y1}Q${cx},${cy}${x2},${y2}`;
}

export function defaultCourtScales(
  width: number,
  height: number,
  half: "near" | "full" = "near",
) {
  return createCourtScales({ half, height, margin: 1.5, width });
}

export function courtPixelBounds(
  scales: ReturnType<typeof createCourtScales>,
  half: "near" | "full" = "near",
) {
  const xMin = scales.x(-SINGLES_HALF);
  const xMax = scales.x(SINGLES_HALF);
  const yMin = half === "full" ? scales.y(COURT_LENGTH) : scales.y(COURT_LENGTH / 2);
  const yMax = scales.y(0);
  return { xMin, xMax, yMin, yMax };
}

export { darkStops, stops, theme };
