import { describe, expect, it } from "vitest";
import {
  dailySnapshotSchema,
  demoAthlete,
  demoFixtureData,
  demoSnapshots,
  fixtureDataSchema,
  getAvailableStops,
  providerCapabilities,
} from "../index";

describe("schemas", () => {
  it("validates a well-formed DailySnapshot", () => {
    const result = dailySnapshotSchema.safeParse(demoSnapshots[0]);
    expect(result.success).toBe(true);
  });

  it("validates all 7 demo snapshots", () => {
    for (const snap of demoSnapshots) {
      const result = dailySnapshotSchema.safeParse(snap);
      expect(result.success).toBe(true);
    }
  });

  it("validates the full fixture data", () => {
    const result = fixtureDataSchema.safeParse(demoFixtureData);
    expect(result.success).toBe(true);
  });

  it("rejects invalid date format", () => {
    const bad = { ...demoSnapshots[0]!, date: "invalid" };
    const result = dailySnapshotSchema.safeParse(bad);
    expect(result.success).toBe(false);
  });
});

describe("demo fixtures", () => {
  it("has a demo athlete with isDemo=true", () => {
    expect(demoAthlete.isDemo).toBe(true);
    expect(demoAthlete.id).toBe("demo-user");
  });

  it("has exactly 7 snapshots", () => {
    expect(demoSnapshots).toHaveLength(7);
  });

  it("includes a null-heavy day (day 5) for degradation testing", () => {
    const nullDay = demoSnapshots[4]!;
    expect(nullDay.sleep.score).toBeNull();
    expect(nullDay.hrv.rmssdMs).toBeNull();
    expect(nullDay.rhr.bpm).toBeNull();
  });

  it("has dates in chronological order", () => {
    for (let i = 1; i < demoSnapshots.length; i++) {
      expect(demoSnapshots[i]!.date > demoSnapshots[i - 1]!.date).toBe(true);
    }
  });
});

describe("provider capabilities", () => {
  it("garmin has stress and body battery", () => {
    expect(providerCapabilities.garmin.stress).toBe(true);
    expect(providerCapabilities.garmin.bodyBattery).toBe(true);
  });

  it("whoop has recovery score but not stress", () => {
    expect(providerCapabilities.whoop.recoveryScore).toBe(true);
    expect(providerCapabilities.whoop.stress).toBe(false);
    expect(providerCapabilities.whoop.bodyBattery).toBe(false);
  });

  it("polar has no sleep stages", () => {
    expect(providerCapabilities.polar.sleepStages).toBe(false);
    expect(providerCapabilities.polar.sleepDuration).toBe(true);
  });

  it("demo has all capabilities", () => {
    const caps = providerCapabilities.demo;
    expect(Object.values(caps).every(Boolean)).toBe(true);
  });
});

describe("getAvailableStops", () => {
  it("returns all 6 stops for demo provider", () => {
    const stops = getAvailableStops("demo");
    expect(stops).toHaveLength(6);
  });

  it("excludes stress for whoop", () => {
    const stops = getAvailableStops("whoop");
    expect(stops).not.toContain("stress");
    expect(stops).toContain("recovery");
  });

  it("excludes stress for polar", () => {
    const stops = getAvailableStops("polar");
    expect(stops).not.toContain("stress");
  });

  it("includes stress for garmin", () => {
    const stops = getAvailableStops("garmin");
    expect(stops).toContain("stress");
  });
});
