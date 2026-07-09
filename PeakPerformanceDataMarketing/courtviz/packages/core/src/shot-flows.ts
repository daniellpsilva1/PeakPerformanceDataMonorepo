/**
 * Shot flow aggregation — groups individual rays into flow bundles.
 *
 * Instead of drawing every shot trajectory (which creates visual clutter),
 * we aggregate shots by origin→destination zone pairs and compute a single
 * representative curved arc per flow, with width proportional to count.
 */

import { type EnrichedShot, shotPlayerWonPoint } from "./stats";
import { NET_Y, SINGLES_HALF } from "./geometry";
import { normalizeHit, normalizeShot } from "./normalize";

export interface ShotFlow {
  /** Origin zone label */
  fromZone: string;
  /** Destination zone label */
  toZone: string;
  /** Mean origin x (normalized) */
  fromX: number;
  /** Mean origin y (normalized) */
  fromY: number;
  /** Mean destination x (normalized) */
  toX: number;
  /** Mean destination y (normalized) */
  toY: number;
  /** Number of shots in this flow */
  count: number;
  /** Win rate for points ending from this flow */
  winRate: number;
  /** Mean shot speed in km/h (if available) */
  meanSpeed: number | null;
}

/**
 * Classify a court position into a coarse zone for flow aggregation.
 *
 * Zones: deuce_deep, deuce_short, ad_deep, ad_short, center_deep, center_short
 * (based on normalized near-half coordinates where y < NET_Y is the near half).
 */
function classifyFlowZone(x: number, y: number): string {
  const isDeep = y < NET_Y / 2;
  const absX = Math.abs(x);

  if (absX > SINGLES_HALF * 0.6) {
    return x > 0 ? `deuce_${isDeep ? "deep" : "short"}` : `ad_${isDeep ? "deep" : "short"}`;
  }
  return `center_${isDeep ? "deep" : "short"}`;
}

export interface ShotFlowOptions {
  /** Minimum shots per flow to include (default 2) */
  minCount?: number;
  /** Player filter (if null, includes both players) */
  player?: string | null;
  /** Stroke filter (if null, includes all strokes) */
  stroke?: string | null;
}

/**
 * Compute shot flow bundles from enriched shots.
 *
 * Each flow represents an origin zone → destination zone pair with aggregated
 * statistics. The mean coordinates can be used to draw a single curved arc
 * instead of individual rays.
 */
export function computeShotFlows(
  shots: EnrichedShot[],
  options: ShotFlowOptions = {},
): ShotFlow[] {
  const { minCount = 2, player = null, stroke = null } = options;

  const filtered = shots.filter(
    (s) =>
      s.bounceX != null &&
      s.bounceY != null &&
      s.hitX != null &&
      s.hitY != null &&
      (player === null || s.player === player) &&
      (stroke === null || s.stroke === stroke) &&
      s.stroke !== "Serve",
  );

  const flowMap = new Map<string, {
    fromZone: string;
    toZone: string;
    fromXs: number[];
    fromYs: number[];
    toXs: number[];
    toYs: number[];
    count: number;
    wonCount: number;
    speeds: number[];
  }>();

  for (const shot of filtered) {
    const [fhx, fhy] = normalizeHit(shot.hitX!, shot.hitY!);
    const [tbx, tby] = normalizeShot(shot.bounceX!, shot.bounceY!, shot.hitY!);

    const fromZone = classifyFlowZone(fhx, fhy);
    const toZone = classifyFlowZone(tbx, tby);
    const key = `${fromZone}->${toZone}`;

    const entry = flowMap.get(key) ?? {
      fromZone,
      toZone,
      fromXs: [],
      fromYs: [],
      toXs: [],
      toYs: [],
      count: 0,
      wonCount: 0,
      speeds: [],
    };

    entry.fromXs.push(fhx);
    entry.fromYs.push(fhy);
    entry.toXs.push(tbx);
    entry.toYs.push(tby);
    entry.count++;
    if (shotPlayerWonPoint(shot)) entry.wonCount++;
    if (shot.speedKmh != null) entry.speeds.push(shot.speedKmh);
    flowMap.set(key, entry);
  }

  return Array.from(flowMap.values())
    .filter((e) => e.count >= minCount)
    .map((e) => ({
      count: e.count,
      fromX: mean(e.fromXs),
      fromY: mean(e.fromYs),
      fromZone: e.fromZone,
      meanSpeed: e.speeds.length > 0 ? mean(e.speeds) : null,
      toX: mean(e.toXs),
      toY: mean(e.toYs),
      toZone: e.toZone,
      winRate: e.count > 0 ? e.wonCount / e.count : 0,
    }))
    .sort((a, b) => b.count - a.count);
}

function mean(arr: number[]): number {
  return arr.length > 0 ? arr.reduce((a, b) => a + b, 0) / arr.length : 0;
}

export { NET_Y, SINGLES_HALF };
