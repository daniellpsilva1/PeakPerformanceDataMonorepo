import type { BodySystemId } from "@bodyviz/tokens";
import { bodySystemColors, colorPrimitives } from "@bodyviz/tokens";
import type { DailySnapshot } from "@bodyviz/core";

export interface MetricValue {
  label: string;
  unit: string;
  value: number | null;
  display: string;
}

export function getMetricForSystem(
  system: BodySystemId,
  snapshot: DailySnapshot,
): MetricValue {
  switch (system) {
    case "sleep":
      return {
        label: "Sleep Score",
        unit: "/100",
        value: snapshot.sleep.score,
        display: snapshot.sleep.score !== null
          ? `${snapshot.sleep.score}/100`
          : "—",
      };
    case "recovery":
      return {
        label: "Recovery",
        unit: "/100",
        value: snapshot.recovery.score,
        display: snapshot.recovery.score !== null
          ? `${snapshot.recovery.score}/100`
          : "—",
      };
    case "hrv":
      return {
        label: "HRV (RMSSD)",
        unit: "ms",
        value: snapshot.hrv.rmssdMs,
        display: snapshot.hrv.rmssdMs !== null
          ? `${snapshot.hrv.rmssdMs} ms`
          : "—",
      };
    case "rhr":
      return {
        label: "Resting HR",
        unit: "bpm",
        value: snapshot.rhr.bpm,
        display: snapshot.rhr.bpm !== null
          ? `${snapshot.rhr.bpm} bpm`
          : "—",
      };
    case "load":
      return {
        label: "Training Load",
        unit: "",
        value: snapshot.load.trainingLoad,
        display: snapshot.load.trainingLoad !== null
          ? `${snapshot.load.trainingLoad}`
          : "—",
      };
    case "stress":
      return {
        label: "Stress Avg",
        unit: "/100",
        value: snapshot.stress.avg,
        display: snapshot.stress.avg !== null
          ? `${snapshot.stress.avg}/100`
          : "—",
      };
    default:
      return { label: "—", unit: "", value: null, display: "—" };
  }
}

export function getSystemColor(system: BodySystemId): string {
  return bodySystemColors[system]?.glow ?? colorPrimitives.primaryBright;
}

/**
 * Compute a 7-day spark array for a given system.
 * Returns array of numbers (null → 0 for charting purposes).
 */
export function getSparkData(
  system: BodySystemId,
  snapshots: DailySnapshot[],
): number[] {
  return snapshots.map((snap) => {
    const metric = getMetricForSystem(system, snap);
    return metric.value ?? 0;
  });
}
