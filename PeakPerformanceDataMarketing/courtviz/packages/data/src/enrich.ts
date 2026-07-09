/**
 * The shots↔points join — the critical data enrichment that replaces
 * the old is_terminal approximation with true point-winner attribution.
 *
 * Joins on (matchId, setNumber, gameNumber, pointNumber).
 */

import type { EnrichedShot } from "@courtviz/core";
import type { Point, Shot } from "./schema";

/**
 * Build a lookup map from point key → Point.
 */
function buildPointMap(points: Point[]): Map<string, Point> {
  const map = new Map<string, Point>();
  for (const p of points) {
    const key = pointKey(p);
    map.set(key, p);
  }
  return map;
}

/**
 * Create a composite key for a point/shot.
 */
export function pointKey(p: {
  setNumber: number;
  gameNumber: number;
  pointNumber: number;
}): string {
  return `${p.setNumber}-${p.gameNumber}-${p.pointNumber}`;
}

/**
 * Derive rally length as max shotNumber per point when source data is missing.
 */
function buildDerivedRallyLengthMap(shots: Shot[]): Map<string, number> {
  const rallyMap = new Map<string, number>();
  for (const shot of shots) {
    const key = pointKey(shot);
    const current = rallyMap.get(key) ?? 0;
    rallyMap.set(key, Math.max(current, shot.shotNumber));
  }
  return rallyMap;
}

/**
 * Enrich shots with point-level data (winner, rally length, break point flags).
 *
 * This is the core join that enables true win-rate computation instead of
 * the old is_terminal approximation.
 */
export function enrichShots(shots: Shot[], points: Point[]): EnrichedShot[] {
  const pointMap = buildPointMap(points);
  const derivedRallyLengths = buildDerivedRallyLengthMap(shots);

  return shots.map((shot) => {
    const key = pointKey(shot);
    const point = pointMap.get(key);
    const rallyLength =
      point?.rallyLength ?? derivedRallyLengths.get(key) ?? null;

    return {
      player: shot.player,
      stroke: shot.stroke,
      type: shot.type ?? null,
      result: shot.result,
      spin: shot.spin ?? null,
      speedKmh: shot.speedKmh ?? null,
      bounceX: shot.bounceX ?? null,
      bounceY: shot.bounceY ?? null,
      hitX: shot.hitX ?? null,
      hitY: shot.hitY ?? null,
      hitZ: shot.hitZ ?? null,
      bounceZone: shot.bounceZone ?? null,
      direction: shot.direction ?? null,
      isTerminal: shot.isTerminal,
      setNumber: shot.setNumber,
      gameNumber: shot.gameNumber,
      pointNumber: shot.pointNumber,
      shotNumber: shot.shotNumber,
      // Enriched from points table
      pointWinner: point?.pointWinner ?? null,
      rallyLength,
      endedBy: point?.endedBy ?? null,
      isBreakPoint: point?.breakPoint ?? false,
      isSetPoint: point?.setPoint ?? false,
      isMatchPoint: point?.matchPoint ?? false,
    };
  });
}

/**
 * Extract point-level data for momentum computation.
 */
export function extractPointsForMomentum(points: Point[]) {
  return points
    .filter((p) => p.pointWinner)
    .map((p) => ({
      setNumber: p.setNumber,
      gameNumber: p.gameNumber,
      pointNumber: p.pointNumber,
      pointWinner: p.pointWinner!,
      isBreakPoint: p.breakPoint,
      isSetPoint: p.setPoint,
      isMatchPoint: p.matchPoint,
    }))
    .sort((a, b) => {
      if (a.setNumber !== b.setNumber) return a.setNumber - b.setNumber;
      if (a.gameNumber !== b.gameNumber) return a.gameNumber - b.gameNumber;
      return a.pointNumber - b.pointNumber;
    });
}
