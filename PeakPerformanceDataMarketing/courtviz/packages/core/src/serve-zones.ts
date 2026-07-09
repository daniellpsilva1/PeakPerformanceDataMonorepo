/**
 * Serve zone computation — wide/body/T zone split per service box.
 *
 * Computes per-zone counts, in-rate, and win rate for serve placement analysis.
 */

import { type EnrichedShot, shotPlayerWonPoint } from "./stats";
import { NET_Y, SERVICE_LINE_FAR, SERVICE_LINE_NEAR, SINGLES_HALF } from "./geometry";
import { isValidHitY, normalizeShot } from "./normalize";

export type ServeZone = "wide" | "body" | "T";

export interface ServeZoneStat {
  zone: ServeZone;
  side: "deuce" | "ad";
  count: number;
  inCount: number;
  inRate: number;
  winRate: number;
  /** Mean bounce x (normalized) */
  meanX: number;
  /** Mean bounce y (normalized) */
  meanY: number;
}

/**
 * Classify a serve bounce into wide/body/T zone based on normalized coordinates.
 *
 * Deuce side (x > 0): wide = outer third, body = middle third, T = inner third
 * Ad side (x < 0): wide = outer third, body = middle third, T = inner third
 */
function classifyZone(nx: number, side: "deuce" | "ad"): ServeZone {
  const absX = Math.abs(nx);
  const third = SINGLES_HALF / 3;

  if (side === "deuce") {
    // Deuce box: x from 0 to SINGLES_HALF
    if (absX < third) return "T";
    if (absX < third * 2) return "body";
    return "wide";
  } else {
    // Ad box: x from -SINGLES_HALF to 0
    if (absX < third) return "T";
    if (absX < third * 2) return "body";
    return "wide";
  }
}

function classifySide(nx: number): "deuce" | "ad" {
  return nx >= 0 ? "deuce" : "ad";
}

/**
 * Compute serve zone statistics for a player.
 *
 * All serves are normalized to the near half-court before zone classification.
 */
export function computeServeZones(
  shots: EnrichedShot[],
  player: string,
): ServeZoneStat[] {
  const serves = shots.filter(
    (s) =>
      s.player === player &&
      s.stroke === "Serve" &&
      s.bounceX != null &&
      s.bounceY != null &&
      isValidHitY(s.hitY),
  );

  const zoneMap = new Map<string, {
    count: number;
    inCount: number;
    wonCount: number;
    xs: number[];
    ys: number[];
    side: "deuce" | "ad";
    zone: ServeZone;
  }>();

  for (const serve of serves) {
    const [nx, ny] = normalizeShot(serve.bounceX!, serve.bounceY!, serve.hitY!);
    const side = classifySide(nx);
    const zone = classifyZone(nx, side);
    const key = `${side}-${zone}`;

    const entry = zoneMap.get(key) ?? {
      count: 0,
      inCount: 0,
      wonCount: 0,
      side,
      xs: [],
      ys: [],
      zone,
    };

    entry.count++;
    if (serve.result === "In") entry.inCount++;
    if (shotPlayerWonPoint(serve)) entry.wonCount++;
    entry.xs.push(nx);
    entry.ys.push(ny);
    zoneMap.set(key, entry);
  }

  return Array.from(zoneMap.values())
    .map((e) => ({
      count: e.count,
      inCount: e.inCount,
      inRate: e.count > 0 ? e.inCount / e.count : 0,
      meanX: e.xs.length > 0 ? e.xs.reduce((a, b) => a + b, 0) / e.xs.length : 0,
      meanY: e.ys.length > 0 ? e.ys.reduce((a, b) => a + b, 0) / e.ys.length : 0,
      side: e.side,
      winRate: e.count > 0 ? e.wonCount / e.count : 0,
      zone: e.zone,
    }))
    .sort((a, b) => b.count - a.count);
}

/**
 * Zone label for display (e.g. "Deuce Wide", "Ad T").
 */
export function zoneLabel(stat: ServeZoneStat): string {
  const sideLabel = stat.side === "deuce" ? "Deuce" : "Ad";
  return `${sideLabel} ${stat.zone}`;
}

export { NET_Y, SERVICE_LINE_FAR, SERVICE_LINE_NEAR, SINGLES_HALF };
