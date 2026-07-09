/**
 * Derived metrics for tennis match visualization.
 *
 * Computes zone win rates, serve placement distributions, momentum series,
 * and rally-length bucketed stats — all using true point-winner attribution
 * from the shots↔points join (replacing the old is_terminal approximation).
 */

import { NET_Y } from "./geometry";

/**
 * Zone definitions for the tennis court (near half, normalized).
 */
export const COURT_ZONES = [
  "deuce_deep",
  "deuce_short",
  "ad_deep",
  "ad_short",
  "center_deep",
  "center_short",
] as const;

export type CourtZone = (typeof COURT_ZONES)[number];

/**
 * Rally length buckets per Tennis Abstract / Match Charting Project taxonomy.
 */
export const RALLY_BUCKETS = [
  { label: "1-3", min: 1, max: 3 },
  { label: "4-6", min: 4, max: 6 },
  { label: "7+", min: 7, max: Infinity },
] as const;

/**
 * A shot record with enriched point data (from the shots↔points join).
 */
export interface EnrichedShot {
  player: string;
  stroke: string;
  type: string | null;
  result: string;
  spin: string | null;
  speedKmh: number | null;
  bounceX: number | null;
  bounceY: number | null;
  hitX: number | null;
  hitY: number | null;
  hitZ: number | null;
  bounceZone: string | null;
  direction: string | null;
  isTerminal: boolean;
  setNumber: number;
  gameNumber: number;
  pointNumber: number;
  shotNumber?: number;
  // Enriched from points table
  pointWinner: string | null;
  rallyLength: number | null;
  endedBy: string | null;
  isBreakPoint: boolean;
  isSetPoint: boolean;
  isMatchPoint: boolean;
}

/**
 * Composite key for deduplicating shots to unique points.
 */
export function pointKeyFromShot(shot: {
  setNumber: number;
  gameNumber: number;
  pointNumber: number;
}): string {
  return `${shot.setNumber}-${shot.gameNumber}-${shot.pointNumber}`;
}

/**
 * Whether a shot's player won the point.
 */
export function shotPlayerWonPoint(shot: EnrichedShot): boolean {
  return shot.pointWinner === shot.player;
}

export interface RateStat {
  won: number;
  total: number;
  rate: number;
}

/**
 * Point-level win rate — one vote per point, not per shot.
 */
export function computePointsWonRate(
  points: Array<{ pointWinner: string | null }>,
  player: string,
): RateStat {
  const valid = points.filter((p) => p.pointWinner);
  const total = valid.length;
  const won = valid.filter((p) => p.pointWinner === player).length;
  return {
    rate: total > 0 ? won / total : 0,
    total,
    won,
  };
}

/**
 * First-serve in percentage from serve shot records.
 */
export function computeFirstServeInRate(
  shots: EnrichedShot[],
  player: string,
): RateStat {
  const firstServes = shots.filter(
    (s) =>
      s.player === player &&
      s.stroke === "Serve" &&
      (s.type === "first_serve" || s.type === "First Serve"),
  );
  const total = firstServes.length;
  const won = firstServes.filter((s) => s.result === "In").length;
  return {
    rate: total > 0 ? won / total : 0,
    total,
    won,
  };
}

/**
 * Infer server from the first serve shot in a point.
 */
function inferPointServer(
  shots: EnrichedShot[],
  key: string,
): string | null {
  const serve = shots.find(
    (s) =>
      pointKeyFromShot(s) === key &&
      s.stroke === "Serve" &&
      (s.type === "first_serve" ||
        s.type === "First Serve" ||
        s.shotNumber === 1),
  );
  return serve?.player ?? null;
}

/**
 * Break-point conversion for the returner (opportunities where player was returner).
 */
export function computeBreakPointConversion(
  shots: EnrichedShot[],
  player: string,
): RateStat {
  const breakPointMap = new Map<string, EnrichedShot>();

  for (const shot of shots) {
    if (!shot.isBreakPoint || !shot.pointWinner) continue;
    const key = pointKeyFromShot(shot);
    if (!breakPointMap.has(key)) breakPointMap.set(key, shot);
  }

  let total = 0;
  let won = 0;

  for (const [key, shot] of breakPointMap) {
    const server = inferPointServer(shots, key);
    if (!server) continue;
    const returner = server === "host" ? "guest" : "host";
    if (returner !== player) continue;
    total++;
    if (shot.pointWinner === player) won++;
  }

  return {
    rate: total > 0 ? won / total : 0,
    total,
    won,
  };
}

/**
 * Zone win-rate computation per bounce zone.
 *
 * Replaces the Python compute_zone_win_rates which approximated from is_terminal.
 * Uses true pointWinner from the enriched shots.
 */
export interface ZoneWinRate {
  zone: string;
  total: number;
  won: number;
  errors: number;
  winRate: number;
}

export function computeZoneWinRates(
  shots: EnrichedShot[],
  player: string,
  zoneCol: keyof EnrichedShot = "bounceZone",
): ZoneWinRate[] {
  const playerShots = shots.filter((s) => s.player === player);
  const zoneMap = new Map<string, { total: number; won: number; errors: number }>();

  for (const shot of playerShots) {
    const zone = (shot[zoneCol] as string) ?? "unknown";
    const entry = zoneMap.get(zone) ?? { total: 0, won: 0, errors: 0 };
    entry.total++;
    if (shotPlayerWonPoint(shot)) {
      entry.won++;
    }
    if (shot.result === "Out" || shot.result === "Net") {
      entry.errors++;
    }
    zoneMap.set(zone, entry);
  }

  return Array.from(zoneMap.entries())
    .map(([zone, stats]) => ({
      zone,
      total: stats.total,
      won: stats.won,
      errors: stats.errors,
      winRate: stats.total > 0 ? stats.won / stats.total : 0,
    }))
    .sort((a, b) => b.total - a.total);
}

/**
 * Momentum series: rolling point-win differential.
 *
 * Positive = host winning, negative = guest winning.
 * Each point in the series represents one completed point.
 */
export interface MomentumPoint {
  pointIndex: number;
  setNumber: number;
  gameNumber: number;
  cumulativeDiff: number; // host points won - guest points won
  isBreakPoint: boolean;
  isSetPoint: boolean;
  isMatchPoint: boolean;
  pointWinner: string;
}

export function computeMomentum(
  points: Array<{
    setNumber: number;
    gameNumber: number;
    pointWinner: string;
    isBreakPoint: boolean;
    isSetPoint: boolean;
    isMatchPoint: boolean;
  }>,
  hostPlayer: string,
): MomentumPoint[] {
  const result: MomentumPoint[] = [];
  let cumulative = 0;

  for (let i = 0; i < points.length; i++) {
    const p = points[i]!;
    const wonByHost = p.pointWinner === hostPlayer;
    cumulative += wonByHost ? 1 : -1;

    result.push({
      pointIndex: i,
      setNumber: p.setNumber,
      gameNumber: p.gameNumber,
      cumulativeDiff: cumulative,
      isBreakPoint: p.isBreakPoint,
      isSetPoint: p.isSetPoint,
      isMatchPoint: p.isMatchPoint,
      pointWinner: p.pointWinner,
    });
  }

  return result;
}

/**
 * Rally-length bucketed win rates per player.
 */
export interface RallyBucketStat {
  bucket: string;
  total: number;
  won: number;
  winRate: number;
}

export function computeRallyBucketStats(
  shots: EnrichedShot[],
  player: string,
): RallyBucketStat[] {
  const playerShots = shots.filter(
    (s) => s.player === player && s.rallyLength != null,
  );

  return RALLY_BUCKETS.map((bucket) => {
    const bucketShots = playerShots.filter(
      (s) => s.rallyLength! >= bucket.min && s.rallyLength! <= bucket.max,
    );
    // Count unique points (a point may have multiple shots)
    const pointKeys = new Set(
      bucketShots.map((s) => `${s.setNumber}-${s.gameNumber}-${s.pointNumber}`),
    );
    // For win rate, check if the player won each unique point
    let won = 0;
    const seenPoints = new Set<string>();
    for (const shot of bucketShots) {
      const key = `${shot.setNumber}-${shot.gameNumber}-${shot.pointNumber}`;
      if (seenPoints.has(key)) continue;
      seenPoints.add(key);
      if (shotPlayerWonPoint(shot)) won++;
    }

    return {
      bucket: bucket.label,
      total: pointKeys.size,
      won,
      winRate: pointKeys.size > 0 ? won / pointKeys.size : 0,
    };
  });
}

/**
 * Serve placement distribution per Match Charting Project taxonomy.
 */
export interface ServePlacement {
  serveType: string; // first_serve, second_serve
  side: string; // deuce, ad
  zone: string; // wide, body, T
  count: number;
  inCount: number;
  inRate: number;
}

export function computeServePlacements(
  shots: EnrichedShot[],
  player: string,
): ServePlacement[] {
  const serves = shots.filter(
    (s) => s.player === player && s.stroke === "Serve",
  );

  const groups = new Map<string, { total: number; in: number }>();

  for (const serve of serves) {
    const side = serve.bounceZone?.includes("deuce") ? "deuce" : "ad";
    const zone = serve.direction ?? "unknown";
    const key = `${serve.type}|${side}|${zone}`;
    const entry = groups.get(key) ?? { total: 0, in: 0 };
    entry.total++;
    if (serve.result === "In") entry.in++;
    groups.set(key, entry);
  }

  return Array.from(groups.entries())
    .map(([key, stats]) => {
      const [serveType, side, zone] = key.split("|");
      return {
        serveType: serveType ?? "unknown",
        side: side ?? "unknown",
        zone: zone ?? "unknown",
        count: stats.total,
        inCount: stats.in,
        inRate: stats.total > 0 ? stats.in / stats.total : 0,
      };
    })
    .sort((a, b) => b.count - a.count);
}

/**
 * Corpus baseline: average per-zone win rate across all matches.
 *
 * This is the tennis equivalent of SprawlBall's league-average diverging
 * colormap encoding. Each match's player efficiency is compared against
 * this baseline.
 */
export interface ZoneBaseline {
  zone: string;
  avgWinRate: number;
  sampleSize: number;
}

export function computeCorpusBaselines(
  allMatchesZoneStats: ZoneWinRate[][],
): ZoneBaseline[] {
  const zoneMap = new Map<string, { totalWinRate: number; totalShots: number; count: number }>();

  for (const matchStats of allMatchesZoneStats) {
    for (const stat of matchStats) {
      const entry = zoneMap.get(stat.zone) ?? {
        totalWinRate: 0,
        totalShots: 0,
        count: 0,
      };
      // Weight by sample size
      entry.totalWinRate += stat.winRate * stat.total;
      entry.totalShots += stat.total;
      entry.count++;
      zoneMap.set(stat.zone, entry);
    }
  }

  return Array.from(zoneMap.entries())
    .map(([zone, data]) => ({
      zone,
      avgWinRate: data.totalShots > 0 ? data.totalWinRate / data.totalShots : 0,
      sampleSize: data.totalShots,
    }))
    .sort((a, b) => b.sampleSize - a.sampleSize);
}

export { NET_Y };
