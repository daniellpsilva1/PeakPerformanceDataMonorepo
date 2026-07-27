import { describe, expect, it } from "vitest";
import {
  computeReadiness,
  createTourState,
  deriveHrvStatus,
  getCurrentStop,
  goToStop,
  isStopAvailable,
  nextStop,
  normalize,
  prevStop,
  stopHasData,
  TOUR_STOPS,
  TOUR_STOP_COUNT,
} from "../index";
import type { DailySnapshot } from "../index";

function makeSnapshot(overrides: Partial<DailySnapshot> = {}): DailySnapshot {
  return {
    date: "2025-01-15",
    provider: "demo",
    sleep: {
      score: 85,
      durationHours: 7.5,
      deepPct: 22,
      remPct: 18,
      efficiency: 92,
    },
    recovery: { score: 78, readiness: null },
    hrv: { rmssdMs: 55, status: "balanced" },
    rhr: { bpm: 58 },
    load: { trainingLoad: 120, strainProxy: null },
    stress: { avg: 25 },
    bodyBattery: { high: 95, low: 35, current: 72 },
    ...overrides,
  };
}

describe("normalize", () => {
  it("converts raw metrics to DailySnapshot with nulls for missing fields", () => {
    const snap = normalize({ date: "2025-01-15" });
    expect(snap.date).toBe("2025-01-15");
    expect(snap.provider).toBe("demo");
    expect(snap.sleep.score).toBeNull();
    expect(snap.hrv.status).toBe("unknown");
    expect(snap.rhr.bpm).toBeNull();
  });

  it("preserves provided values", () => {
    const snap = normalize({
      date: "2025-01-15",
      provider: "garmin",
      sleepScore: 90,
      rhrBpm: 55,
      hrvRmssdMs: 60,
    });
    expect(snap.provider).toBe("garmin");
    expect(snap.sleep.score).toBe(90);
    expect(snap.rhr.bpm).toBe(55);
    expect(snap.hrv.rmssdMs).toBe(60);
  });
});

describe("deriveHrvStatus", () => {
  it("returns unknown for null", () => {
    expect(deriveHrvStatus(null)).toBe("unknown");
  });
  it("returns low below 20ms", () => {
    expect(deriveHrvStatus(15)).toBe("low");
  });
  it("returns high above 80ms", () => {
    expect(deriveHrvStatus(90)).toBe("high");
  });
  it("returns balanced in 20-80 range", () => {
    expect(deriveHrvStatus(50)).toBe("balanced");
  });
});

describe("computeReadiness", () => {
  it("returns recovery score when available", () => {
    const snap = makeSnapshot();
    expect(computeReadiness(snap)).toBe(78);
  });

  it("returns readiness when score is null", () => {
    const snap = makeSnapshot({
      recovery: { score: null, readiness: 65 },
    });
    expect(computeReadiness(snap)).toBe(65);
  });

  it("returns null when no relevant metrics exist", () => {
    const snap: DailySnapshot = {
      date: "2025-01-15",
      provider: "demo",
      sleep: { score: null, durationHours: null, deepPct: null, remPct: null, efficiency: null },
      recovery: { score: null, readiness: null },
      hrv: { rmssdMs: null, status: "unknown" },
      rhr: { bpm: null },
      load: { trainingLoad: null, strainProxy: null },
      stress: { avg: null },
      bodyBattery: { high: null, low: null, current: null },
    };
    expect(computeReadiness(snap)).toBeNull();
  });

  it("computes composite from partial metrics", () => {
    const snap = makeSnapshot({
      recovery: { score: null, readiness: null },
    });
    const result = computeReadiness(snap);
    expect(result).not.toBeNull();
    expect(result).toBeGreaterThan(0);
    expect(result).toBeLessThanOrEqual(100);
  });
});

describe("tour state machine", () => {
  it("creates initial state at stop 0", () => {
    const state = createTourState();
    expect(state.currentStop).toBe(0);
    expect(state.isPlaying).toBe(false);
  });

  it("advances to next stop with wraparound", () => {
    let state = createTourState();
    for (let i = 0; i < TOUR_STOP_COUNT - 1; i++) {
      state = nextStop(state);
    }
    expect(state.currentStop).toBe(TOUR_STOP_COUNT - 1);
    state = nextStop(state);
    expect(state.currentStop).toBe(0);
  });

  it("goes to previous stop with wraparound", () => {
    const state = prevStop(createTourState());
    expect(state.currentStop).toBe(TOUR_STOP_COUNT - 1);
  });

  it("clamps goToStop to valid range", () => {
    const state = goToStop(createTourState(), 99);
    expect(state.currentStop).toBe(TOUR_STOP_COUNT - 1);
    const state2 = goToStop(createTourState(), -5);
    expect(state2.currentStop).toBe(0);
  });

  it("getCurrentStop returns the tour stop at current index", () => {
    const state = createTourState();
    const stop = getCurrentStop(state);
    expect(stop.id).toBe("sleep");
  });

  it("has exactly 6 tour stops", () => {
    expect(TOUR_STOP_COUNT).toBe(6);
    expect(TOUR_STOPS).toHaveLength(6);
  });
});

describe("isStopAvailable", () => {
  it("stress stop is available for garmin", () => {
    expect(isStopAvailable("stress", "garmin")).toBe(true);
  });

  it("stress stop is available for demo", () => {
    expect(isStopAvailable("stress", "demo")).toBe(true);
  });

  it("stress stop is unavailable for whoop", () => {
    expect(isStopAvailable("stress", "whoop")).toBe(false);
  });

  it("stress stop is unavailable for polar", () => {
    expect(isStopAvailable("stress", "polar")).toBe(false);
  });

  it("all other stops are available for all providers", () => {
    for (const provider of ["garmin", "whoop", "polar"] as const) {
      expect(isStopAvailable("sleep", provider)).toBe(true);
      expect(isStopAvailable("recovery", provider)).toBe(true);
      expect(isStopAvailable("hrv", provider)).toBe(true);
      expect(isStopAvailable("rhr", provider)).toBe(true);
      expect(isStopAvailable("load", provider)).toBe(true);
    }
  });
});

describe("stopHasData", () => {
  it("returns true when sleep metrics exist", () => {
    expect(stopHasData("sleep", makeSnapshot())).toBe(true);
  });

  it("returns false when all metrics are null", () => {
    const snap: DailySnapshot = {
      date: "2025-01-15",
      provider: "demo",
      sleep: { score: null, durationHours: null, deepPct: null, remPct: null, efficiency: null },
      recovery: { score: null, readiness: null },
      hrv: { rmssdMs: null, status: "unknown" },
      rhr: { bpm: null },
      load: { trainingLoad: null, strainProxy: null },
      stress: { avg: null },
      bodyBattery: { high: null, low: null, current: null },
    };
    expect(stopHasData("sleep", snap)).toBe(false);
    expect(stopHasData("recovery", snap)).toBe(false);
    expect(stopHasData("hrv", snap)).toBe(false);
    expect(stopHasData("rhr", snap)).toBe(false);
    expect(stopHasData("load", snap)).toBe(false);
    expect(stopHasData("stress", snap)).toBe(false);
  });
});
