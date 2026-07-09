import {
  computeBreakPointConversion,
  computeFirstServeInRate,
  computePointsWonRate,
  computeRallyBucketStats,
  computeZoneWinRates,
  pointKeyFromShot,
} from "@courtviz/core";
import {
  enrichedShots,
  guestName,
  hostName,
  momentumPoints,
  points,
  sets,
} from "@courtviz/data/fixtures";

export function formatSetScore(): string {
  return sets
    .map((set) => `${set.hostScore}-${set.guestScore}`)
    .join(" · ");
}

export function formatSetScoreDetailed(): string {
  return sets
    .map((set) => {
      const hostTb = set.hostTiebreakScore;
      const guestTb = set.guestTiebreakScore;
      if (hostTb != null && guestTb != null) {
        return `${set.hostScore}-${set.guestScore} (${hostTb}-${guestTb})`;
      }
      return `${set.hostScore}-${set.guestScore}`;
    })
    .join(", ");
}

export function formatMatchResult(): string {
  const hostSets = sets.filter((s) => s.hostScore > s.guestScore).length;
  const guestSets = sets.length - hostSets;
  return `${hostName} wins ${hostSets}–${guestSets}`;
}

export const hostWinRate = computePointsWonRate(momentumPoints, "host");
export const guestWinRate = computePointsWonRate(momentumPoints, "guest");
export const hostFirstServe = computeFirstServeInRate(enrichedShots, "host");
export const guestFirstServe = computeFirstServeInRate(enrichedShots, "guest");
export const hostBreakConv = computeBreakPointConversion(enrichedShots, "host");
export const guestBreakConv = computeBreakPointConversion(enrichedShots, "guest");
export const hostRally7 = computeRallyBucketStats(enrichedShots, "host").find(
  (b) => b.bucket === "7+",
);
export const guestRally7 = computeRallyBucketStats(enrichedShots, "guest").find(
  (b) => b.bucket === "7+",
);

export const hostZones = computeZoneWinRates(enrichedShots, "host");
export const guestZones = computeZoneWinRates(enrichedShots, "guest");

export function topZoneInsight(player: "host" | "guest"): string {
  const zones = player === "host" ? hostZones : guestZones;
  const top = zones
    .filter((z) => z.total >= 8)
    .sort((a, b) => b.winRate - a.winRate)[0];
  if (!top) return "";
  const label = top.zone.replace(/_/g, " ");
  return `${Math.round(top.winRate * 100)}% win rate from ${label}`;
}

export const totalShots = enrichedShots.filter((s) => s.result === "In").length;

// --- Story stats (rally length derived from max shotNumber per point) ---

function deriveRallyLength(pointKey: string): number {
  const pointShots = enrichedShots.filter((s) => pointKeyFromShot(s) === pointKey);
  return Math.max(...pointShots.map((s) => s.shotNumber ?? 0), 0);
}

function inferPointServer(pointKey: string): string | null {
  const serve = enrichedShots.find(
    (s) =>
      pointKeyFromShot(s) === pointKey &&
      s.stroke === "Serve" &&
      (s.type === "first_serve" || s.type === "First Serve" || s.shotNumber === 1),
  );
  return serve?.player ?? null;
}

export interface ServiceStats {
  servicePoints: number;
  serviceWon: number;
  serviceWinRate: number;
  servePlusOne: number;
  servePlusOneWon: number;
  servePlusOneRate: number;
}

function computeServiceStats(player: "host" | "guest"): ServiceStats {
  let servicePoints = 0;
  let serviceWon = 0;
  let servePlusOne = 0;
  let servePlusOneWon = 0;

  for (const point of points) {
    if (!point.pointWinner) continue;
    const key = `${point.setNumber}-${point.gameNumber}-${point.pointNumber}`;
    const server = inferPointServer(key);
    if (server !== player) continue;

    servicePoints++;
    if (point.pointWinner === player) serviceWon++;

    const rallyLen = deriveRallyLength(key);
    if (rallyLen <= 3) {
      servePlusOne++;
      if (point.pointWinner === player) servePlusOneWon++;
    }
  }

  return {
    servicePoints,
    serviceWon,
    serviceWinRate: servicePoints > 0 ? serviceWon / servicePoints : 0,
    servePlusOne,
    servePlusOneWon,
    servePlusOneRate: servePlusOne > 0 ? servePlusOneWon / servePlusOne : 0,
  };
}

export const hostServiceStats = computeServiceStats("host");
export const guestServiceStats = computeServiceStats("guest");

export interface LongRallyStats {
  hostWon: number;
  guestWon: number;
}

function computeLongRallyBattle(): LongRallyStats {
  let hostWon = 0;
  let guestWon = 0;

  for (const point of points) {
    if (!point.pointWinner) continue;
    const key = `${point.setNumber}-${point.gameNumber}-${point.pointNumber}`;
    const rallyLen = deriveRallyLength(key);
    if (rallyLen < 7) continue;
    if (point.pointWinner === "host") hostWon++;
    else guestWon++;
  }

  return { hostWon, guestWon };
}

export const longRallyBattle = computeLongRallyBattle();

export const totalBreakPoints = points.filter((p) => p.breakPoint).length;
export const totalSetPoints = points.filter((p) => p.setPoint).length;

export interface ServeDirectionStats {
  downTheT: number;
  outWide: number;
  avgSpeedKmh: number;
}

function computeServeDirections(player: "host" | "guest"): ServeDirectionStats {
  const serves = enrichedShots.filter(
    (s) =>
      s.player === player &&
      s.stroke === "Serve" &&
      (s.type === "first_serve" || s.type === "First Serve"),
  );
  const downTheT = serves.filter((s) => s.direction?.toLowerCase().includes("t")).length;
  const outWide = serves.filter((s) => s.direction?.toLowerCase().includes("wide")).length;
  const speeds = serves.filter((s) => s.speedKmh != null).map((s) => s.speedKmh!);
  const avgSpeedKmh =
    speeds.length > 0 ? Math.round(speeds.reduce((a, b) => a + b, 0) / speeds.length) : 0;

  return { downTheT, outWide, avgSpeedKmh };
}

export const hostServeDirections = computeServeDirections("host");
export const guestServeDirections = computeServeDirections("guest");

export function sceneInsight(scene: string): string {
  switch (scene) {
    case "shotRain":
      return `${totalShots.toLocaleString()} tracked shots across ${sets.length} sets — every bounce tells the story`;
    case "hexbin":
      return `${hostName} owned the deuce side — ${topZoneInsight("host")}`;
    case "trajectories":
      return `${hostName}: ${topZoneInsight("host")}`;
    case "serve":
      return `${hostName} ${Math.round(hostFirstServe.rate * 100)}% first serve in · avg ${hostServeDirections.avgSpeedKmh} km/h`;
    case "momentum":
      return `${totalBreakPoints} break points — the return game decided this match`;
    case "stats":
      return `${hostName} won ${Math.round(hostServiceStats.serviceWinRate * 100)}% of service points vs ${Math.round(guestServiceStats.serviceWinRate * 100)}% for ${guestName}`;
    default:
      return "";
  }
}

export function closingLine(): string {
  return `${hostName} dominated on return — ${Math.round(hostServiceStats.serviceWinRate * 100)}% service points won, ${longRallyBattle.hostWon}–${longRallyBattle.guestWon} in long rallies`;
}
