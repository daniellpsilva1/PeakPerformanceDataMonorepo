/**
 * Zod schemas for SwingVision tennis match data.
 *
 * Maps to the Supabase tables: tennis_matches, tennis_match_sets,
 * tennis_match_games, tennis_match_points, tennis_match_shots, tennis_match_stats.
 */

import { z } from "zod";

export const MatchSchema = z.object({
  id: z.string().uuid(),
  hostPlayerNames: z.array(z.string()).nullable().optional(),
  guestPlayerNames: z.array(z.string()).nullable().optional(),
  surface: z.string().default("hard"),
  matchDate: z.string().optional(),
  // Additional fields from tennis_matches table
  createdAt: z.string().optional(),
});

export const SetSummarySchema = z.object({
  matchId: z.string().uuid(),
  setNumber: z.number(),
  hostScore: z.number(),
  guestScore: z.number(),
  hostTiebreakScore: z.number().nullable().optional(),
  guestTiebreakScore: z.number().nullable().optional(),
});

export const GameSchema = z.object({
  matchId: z.string().uuid(),
  setNumber: z.number(),
  gameNumber: z.number(),
  hostGameScore: z.string().nullable().optional(),
  guestGameScore: z.string().nullable().optional(),
  matchServer: z.string().nullable().optional(),
});

export const PointSchema = z.object({
  id: z.string().uuid().optional(),
  matchId: z.string().uuid(),
  setNumber: z.number(),
  gameNumber: z.number(),
  pointNumber: z.number(),
  pointWinner: z.string().nullable(),
  rallyLength: z.number().nullable().optional(),
  endedBy: z.string().nullable().optional(),
  breakPoint: z.boolean().default(false),
  setPoint: z.boolean().default(false),
  matchPoint: z.boolean().default(false),
  deuce: z.boolean().default(false),
  tiebreak: z.boolean().default(false),
  superTiebreak: z.boolean().default(false),
  serverSide: z.string().nullable().optional(),
  serveAttempt: z.number().nullable().optional(),
  durationSec: z.number().nullable().optional(),
  videoTimeSec: z.number().nullable().optional(),
});

export const ShotSchema = z.object({
  id: z.string().uuid().optional(),
  matchId: z.string().uuid(),
  setNumber: z.number(),
  gameNumber: z.number(),
  pointNumber: z.number(),
  shotNumber: z.number(),
  player: z.string(),
  stroke: z.string(),
  type: z.string().nullable().optional(),
  spin: z.string().nullable().optional(),
  result: z.string(),
  speedKmh: z.number().nullable().optional(),
  bounceX: z.number().nullable().optional(),
  bounceY: z.number().nullable().optional(),
  hitX: z.number().nullable().optional(),
  hitY: z.number().nullable().optional(),
  hitZ: z.number().nullable().optional(),
  bounceZone: z.string().nullable().optional(),
  bounceSide: z.string().nullable().optional(),
  bounceDepth: z.string().nullable().optional(),
  hitZone: z.string().nullable().optional(),
  hitSide: z.string().nullable().optional(),
  hitDepth: z.string().nullable().optional(),
  direction: z.string().nullable().optional(),
  isTerminal: z.boolean().default(false),
  placementZone: z.string().nullable().optional(),
  shotAttribution: z.string().nullable().optional(),
  startTime: z.string().nullable().optional(),
  videoTimeSec: z.number().nullable().optional(),
});

export const PlayerStatSchema = z.object({
  matchId: z.string().uuid(),
  player: z.string(),
  setNumber: z.number(),
  statName: z.string(),
  statValue: z.number(),
});

export const MatchDataSchema = z.object({
  match: MatchSchema,
  sets: z.array(SetSummarySchema),
  games: z.array(GameSchema).optional(),
  points: z.array(PointSchema),
  shots: z.array(ShotSchema),
  stats: z.array(PlayerStatSchema).optional(),
});

// Inferred types
export type Match = z.infer<typeof MatchSchema>;
export type SetSummary = z.infer<typeof SetSummarySchema>;
export type Game = z.infer<typeof GameSchema>;
export type Point = z.infer<typeof PointSchema>;
export type Shot = z.infer<typeof ShotSchema>;
export type PlayerStat = z.infer<typeof PlayerStatSchema>;
export type MatchData = z.infer<typeof MatchDataSchema>;
