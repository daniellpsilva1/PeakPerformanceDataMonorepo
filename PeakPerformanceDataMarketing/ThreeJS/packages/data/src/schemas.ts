import { z } from "zod";

export const providerSchema = z.enum([
  "garmin",
  "whoop",
  "polar",
  "mixed",
  "demo",
]);

export const hrvStatusSchema = z.enum([
  "balanced",
  "low",
  "high",
  "unknown",
]);

export const dailySnapshotSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  provider: providerSchema,
  sleep: z.object({
    score: z.number().nullable(),
    durationHours: z.number().nullable(),
    deepPct: z.number().nullable(),
    remPct: z.number().nullable(),
    efficiency: z.number().nullable(),
  }),
  recovery: z.object({
    score: z.number().nullable(),
    readiness: z.number().nullable(),
  }),
  hrv: z.object({
    rmssdMs: z.number().nullable(),
    status: hrvStatusSchema,
  }),
  rhr: z.object({
    bpm: z.number().nullable(),
  }),
  load: z.object({
    trainingLoad: z.number().nullable(),
    strainProxy: z.number().nullable(),
  }),
  stress: z.object({
    avg: z.number().nullable(),
  }),
  bodyBattery: z.object({
    high: z.number().nullable(),
    low: z.number().nullable(),
    current: z.number().nullable(),
  }),
});

export const athleteProfileSchema = z.object({
  id: z.string(),
  firstName: z.string(),
  provider: providerSchema,
  isDemo: z.boolean(),
});

export const fixtureDataSchema = z.object({
  athlete: athleteProfileSchema,
  snapshots: z.array(dailySnapshotSchema),
});

export type FixtureData = z.infer<typeof fixtureDataSchema>;
