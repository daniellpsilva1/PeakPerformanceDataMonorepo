import type { AthleteProfile, DailySnapshot } from "@bodyviz/core";

export const demoAthlete: AthleteProfile = {
  id: "demo-user",
  firstName: "Alex",
  provider: "demo",
  isDemo: true,
};

/**
 * 7-day demo fixtures for the public marketing demo.
 * Clearly labeled as sample data — never used for real athletes.
 * Includes realistic variation and one null-heavy day (day 4) to
 * demonstrate graceful degradation.
 */
export const demoSnapshots: DailySnapshot[] = [
  {
    date: "2025-07-21",
    provider: "demo",
    sleep: {
      score: 88,
      durationHours: 7.8,
      deepPct: 24,
      remPct: 20,
      efficiency: 94,
    },
    recovery: { score: 82, readiness: null },
    hrv: { rmssdMs: 62, status: "balanced" },
    rhr: { bpm: 55 },
    load: { trainingLoad: 95, strainProxy: null },
    stress: { avg: 22 },
    bodyBattery: { high: 98, low: 28, current: 78 },
  },
  {
    date: "2025-07-22",
    provider: "demo",
    sleep: {
      score: 72,
      durationHours: 6.2,
      deepPct: 15,
      remPct: 16,
      efficiency: 85,
    },
    recovery: { score: 58, readiness: null },
    hrv: { rmssdMs: 38, status: "low" },
    rhr: { bpm: 62 },
    load: { trainingLoad: 180, strainProxy: null },
    stress: { avg: 45 },
    bodyBattery: { high: 72, low: 15, current: 42 },
  },
  {
    date: "2025-07-23",
    provider: "demo",
    sleep: {
      score: 91,
      durationHours: 8.1,
      deepPct: 26,
      remPct: 22,
      efficiency: 96,
    },
    recovery: { score: 89, readiness: null },
    hrv: { rmssdMs: 72, status: "balanced" },
    rhr: { bpm: 53 },
    load: { trainingLoad: 40, strainProxy: null },
    stress: { avg: 18 },
    bodyBattery: { high: 100, low: 45, current: 88 },
  },
  {
    date: "2025-07-24",
    provider: "demo",
    sleep: {
      score: 65,
      durationHours: 5.5,
      deepPct: 12,
      remPct: 14,
      efficiency: 78,
    },
    recovery: { score: 45, readiness: null },
    hrv: { rmssdMs: 28, status: "low" },
    rhr: { bpm: 65 },
    load: { trainingLoad: 220, strainProxy: null },
    stress: { avg: 52 },
    bodyBattery: { high: 58, low: 10, current: 25 },
  },
  {
    date: "2025-07-25",
    provider: "demo",
    sleep: {
      score: null,
      durationHours: null,
      deepPct: null,
      remPct: null,
      efficiency: null,
    },
    recovery: { score: null, readiness: null },
    hrv: { rmssdMs: null, status: "unknown" },
    rhr: { bpm: null },
    load: { trainingLoad: null, strainProxy: null },
    stress: { avg: null },
    bodyBattery: { high: null, low: null, current: null },
  },
  {
    date: "2025-07-26",
    provider: "demo",
    sleep: {
      score: 84,
      durationHours: 7.2,
      deepPct: 21,
      remPct: 19,
      efficiency: 91,
    },
    recovery: { score: 75, readiness: null },
    hrv: { rmssdMs: 55, status: "balanced" },
    rhr: { bpm: 57 },
    load: { trainingLoad: 110, strainProxy: null },
    stress: { avg: 28 },
    bodyBattery: { high: 88, low: 30, current: 68 },
  },
  {
    date: "2025-07-27",
    provider: "demo",
    sleep: {
      score: 90,
      durationHours: 7.9,
      deepPct: 25,
      remPct: 21,
      efficiency: 95,
    },
    recovery: { score: 85, readiness: null },
    hrv: { rmssdMs: 68, status: "balanced" },
    rhr: { bpm: 54 },
    load: { trainingLoad: 60, strainProxy: null },
    stress: { avg: 20 },
    bodyBattery: { high: 95, low: 40, current: 82 },
  },
];

export const demoFixtureData = {
  athlete: demoAthlete,
  snapshots: demoSnapshots,
};
