import type { BodySystemId } from "@bodyviz/tokens";
import type { DailySnapshot, Provider } from "./types";

export interface TourStop {
  id: BodySystemId;
  title: string;
  description: string;
  /** Regions to highlight on the body model */
  regions: string[];
}

export const TOUR_STOPS: readonly TourStop[] = [
  {
    id: "sleep",
    title: "Sleep",
    description:
      "Cranial rest glow with deep, REM, and light sleep stages as soft layered pulses.",
    regions: ["brain", "head", "cranial"],
  },
  {
    id: "recovery",
    title: "Recovery & Readiness",
    description:
      "Whole-body vitality wash reflecting recovery score and readiness composite.",
    regions: ["torso", "chest", "fullBody"],
  },
  {
    id: "hrv",
    title: "Heart Rate Variability",
    description:
      "Autonomic nervous system signal — nightly RMSSD with healthy band 20–80 ms.",
    regions: ["autonomic", "nervous", "spine"],
  },
  {
    id: "rhr",
    title: "Resting Heart Rate",
    description: "Cardiac pulse rate at rest — healthy range 50–70 bpm.",
    regions: ["heart", "cardiac"],
  },
  {
    id: "load",
    title: "Strain & Training Load",
    description:
      "Musculature heat map from training load and workout volume.",
    regions: ["muscles", "arms", "legs", "limbs"],
  },
  {
    id: "stress",
    title: "Stress & Body Battery",
    description:
      "Nervous-system energy sheath — Garmin-only, unavailable on Whoop/Polar.",
    regions: ["skin", "fullBody"],
  },
] as const;

export const TOUR_STOP_COUNT = TOUR_STOPS.length;

export interface TourState {
  currentStop: number;
  isPlaying: boolean;
}

export function createTourState(): TourState {
  return { currentStop: 0, isPlaying: false };
}

export function nextStop(state: TourState): TourState {
  return {
    ...state,
    currentStop: (state.currentStop + 1) % TOUR_STOP_COUNT,
  };
}

export function prevStop(state: TourState): TourState {
  return {
    ...state,
    currentStop: (state.currentStop - 1 + TOUR_STOP_COUNT) % TOUR_STOP_COUNT,
  };
}

export function goToStop(state: TourState, stop: number): TourState {
  const clamped = Math.max(0, Math.min(stop, TOUR_STOP_COUNT - 1));
  return { ...state, currentStop: clamped };
}

export function getCurrentStop(state: TourState): TourStop {
  return TOUR_STOPS[state.currentStop]!;
}

/**
 * Determine if a tour stop is available for a given provider.
 * Garmin-only stops: stress/body battery.
 * Whoop-only metric: recovery_score (but recovery stop can use composite).
 */
export function isStopAvailable(
  stopId: BodySystemId,
  provider: Provider,
): boolean {
  if (stopId === "stress") {
    return provider === "garmin" || provider === "mixed" || provider === "demo";
  }
  return true;
}

/**
 * Check if a tour stop has data for a given snapshot.
 * Returns false if all relevant metrics are null.
 */
export function stopHasData(
  stopId: BodySystemId,
  snapshot: DailySnapshot,
): boolean {
  switch (stopId) {
    case "sleep":
      return (
        snapshot.sleep.score !== null ||
        snapshot.sleep.durationHours !== null ||
        snapshot.sleep.efficiency !== null
      );
    case "recovery":
      return (
        snapshot.recovery.score !== null ||
        snapshot.recovery.readiness !== null
      );
    case "hrv":
      return snapshot.hrv.rmssdMs !== null;
    case "rhr":
      return snapshot.rhr.bpm !== null;
    case "load":
      return (
        snapshot.load.trainingLoad !== null ||
        snapshot.load.strainProxy !== null
      );
    case "stress":
      return (
        snapshot.stress.avg !== null ||
        snapshot.bodyBattery.current !== null
      );
    default:
      return false;
  }
}
