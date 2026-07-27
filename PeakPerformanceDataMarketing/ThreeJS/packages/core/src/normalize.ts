import type { DailySnapshot, HrvStatus, Provider } from "./types";

/**
 * Raw metric input shape from PPC graph API or ClickHouse fixtures.
 * All fields optional — normalize() fills nulls for missing data.
 */
export interface RawMetrics {
  date: string;
  provider?: Provider;
  sleepScore?: number | null;
  sleepDurationHours?: number | null;
  sleepDeepPct?: number | null;
  sleepRemPct?: number | null;
  sleepEfficiency?: number | null;
  recoveryScore?: number | null;
  readiness?: number | null;
  hrvRmssdMs?: number | null;
  hrvStatus?: HrvStatus | null;
  rhrBpm?: number | null;
  trainingLoad?: number | null;
  strainProxy?: number | null;
  stressAvg?: number | null;
  bodyBatteryHigh?: number | null;
  bodyBatteryLow?: number | null;
  bodyBatteryCurrent?: number | null;
}

/**
 * Normalize raw metrics into a DailySnapshot.
 * Missing fields become null — never invent values.
 */
export function normalize(raw: RawMetrics): DailySnapshot {
  return {
    date: raw.date,
    provider: raw.provider ?? "demo",
    sleep: {
      score: raw.sleepScore ?? null,
      durationHours: raw.sleepDurationHours ?? null,
      deepPct: raw.sleepDeepPct ?? null,
      remPct: raw.sleepRemPct ?? null,
      efficiency: raw.sleepEfficiency ?? null,
    },
    recovery: {
      score: raw.recoveryScore ?? null,
      readiness: raw.readiness ?? null,
    },
    hrv: {
      rmssdMs: raw.hrvRmssdMs ?? null,
      status: raw.hrvStatus ?? "unknown",
    },
    rhr: {
      bpm: raw.rhrBpm ?? null,
    },
    load: {
      trainingLoad: raw.trainingLoad ?? null,
      strainProxy: raw.strainProxy ?? null,
    },
    stress: {
      avg: raw.stressAvg ?? null,
    },
    bodyBattery: {
      high: raw.bodyBatteryHigh ?? null,
      low: raw.bodyBatteryLow ?? null,
      current: raw.bodyBatteryCurrent ?? null,
    },
  };
}

/**
 * Derive HRV status from RMSSD value when not explicitly provided.
 * Healthy band: ~20–80 ms.
 */
export function deriveHrvStatus(rmssdMs: number | null): HrvStatus {
  if (rmssdMs === null) return "unknown";
  if (rmssdMs < 20) return "low";
  if (rmssdMs > 80) return "high";
  return "balanced";
}
