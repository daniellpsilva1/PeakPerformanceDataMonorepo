/**
 * Boluda match fixture — Kaitlin Quevedo vs Ángela Boluda, clay, 2025-04-09.
 *
 * Pre-transformed JSON data imported directly, validated with Zod schemas,
 * and enriched with point-level data via the shots↔points join.
 */

import { enrichShots, extractPointsForMomentum } from "../enrich";
import {
  MatchSchema,
  PointSchema,
  SetSummarySchema,
  ShotSchema,
  type MatchData,
  type Point,
  type SetSummary,
  type Shot,
} from "../schema";

import matchJson from "./match_boluda.json";
import pointsJson from "./points_boluda.json";
import setsJson from "./sets_boluda.json";
import shotsJson from "./shots_boluda.json";

// ---------------------------------------------------------------------------
// Validate with Zod
// ---------------------------------------------------------------------------

const match = MatchSchema.parse(matchJson);

const sets: SetSummary[] = setsJson.map((s: Record<string, unknown>) =>
  SetSummarySchema.parse(s),
);

const shots: Shot[] = shotsJson.map((s: Record<string, unknown>) =>
  ShotSchema.parse(s),
);

const points: Point[] = pointsJson.map((p: Record<string, unknown>) =>
  PointSchema.parse(p),
);

const matchData: MatchData = {
  games: [],
  match,
  points,
  sets,
  shots,
  stats: [],
};

// ---------------------------------------------------------------------------
// Enriched shots (pre-computed for convenience)
// ---------------------------------------------------------------------------

const enrichedShots = enrichShots(shots, points);

// ---------------------------------------------------------------------------
// Metadata
// ---------------------------------------------------------------------------

const guestName = (match.guestPlayerNames?.[0] as string) ?? "Guest";
const hostName = (match.hostPlayerNames?.[0] as string) ?? "Host";
const matchDate = match.matchDate ?? "";
const surface = (match.surface as "clay" | "hard" | "grass") ?? "hard";

// ---------------------------------------------------------------------------
// Momentum-ready points (mapped to computeMomentum's expected shape)
// ---------------------------------------------------------------------------

const momentumPoints = extractPointsForMomentum(points);

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------

export {
  enrichedShots,
  guestName,
  hostName,
  match,
  matchData,
  matchDate,
  momentumPoints,
  points,
  sets,
  shots,
  surface,
};
