import type { DailySnapshot } from "./types";

/**
 * Compute a readiness composite (0–100) from available metrics.
 * Uses sleep, HRV, RHR, and load — never invents values.
 * Falls back to recovery_score if available, then to partial composite.
 *
 * This mirrors the readiness-snapshot philosophy: no fake ~50 defaults.
 */
export function computeReadiness(snapshot: DailySnapshot): number | null {
  if (snapshot.recovery.score !== null) {
    return snapshot.recovery.score;
  }

  if (snapshot.recovery.readiness !== null) {
    return snapshot.recovery.readiness;
  }

  const components: { weight: number; value: number }[] = [];

  if (snapshot.sleep.efficiency !== null) {
    components.push({ weight: 0.3, value: snapshot.sleep.efficiency });
  }

  if (snapshot.hrv.rmssdMs !== null) {
    const hrvScore = Math.min(100, (snapshot.hrv.rmssdMs / 80) * 100);
    components.push({ weight: 0.3, value: hrvScore });
  }

  if (snapshot.rhr.bpm !== null) {
    const rhrScore = Math.max(0, Math.min(100, ((70 - snapshot.rhr.bpm) / 20) * 100 + 50));
    components.push({ weight: 0.2, value: rhrScore });
  }

  if (snapshot.load.trainingLoad !== null) {
    const loadScore = Math.max(0, 100 - snapshot.load.trainingLoad);
    components.push({ weight: 0.2, value: loadScore });
  }

  if (components.length === 0) return null;

  const totalWeight = components.reduce((sum, c) => sum + c.weight, 0);
  const weightedSum = components.reduce(
    (sum, c) => sum + c.value * c.weight,
    0,
  );

  return Math.round((weightedSum / totalWeight) * 10) / 10;
}
