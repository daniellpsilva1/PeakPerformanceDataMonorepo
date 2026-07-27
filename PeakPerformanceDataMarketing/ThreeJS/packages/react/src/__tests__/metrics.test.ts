import { describe, expect, it } from "vitest";
import { getMetricForSystem, getSparkData } from "../metrics";
import { demoSnapshots } from "@bodyviz/data";

describe("getMetricForSystem", () => {
  it("returns sleep score for sleep system", () => {
    const snap = demoSnapshots[0]!;
    const metric = getMetricForSystem("sleep", snap);
    expect(metric.label).toBe("Sleep Score");
    expect(metric.value).toBe(88);
    expect(metric.display).toBe("88/100");
  });

  it("returns RHR for rhr system", () => {
    const snap = demoSnapshots[0]!;
    const metric = getMetricForSystem("rhr", snap);
    expect(metric.label).toBe("Resting HR");
    expect(metric.value).toBe(55);
    expect(metric.display).toBe("55 bpm");
  });

  it("returns null display for missing data", () => {
    const snap = demoSnapshots[4]!;
    const metric = getMetricForSystem("sleep", snap);
    expect(metric.value).toBeNull();
    expect(metric.display).toBe("—");
  });
});

describe("getSparkData", () => {
  it("returns 7 values for 7 snapshots", () => {
    const spark = getSparkData("sleep", demoSnapshots);
    expect(spark).toHaveLength(7);
  });

  it("returns 0 for null values", () => {
    const spark = getSparkData("sleep", demoSnapshots);
    expect(spark[4]).toBe(0);
  });

  it("returns actual values for non-null days", () => {
    const spark = getSparkData("rhr", demoSnapshots);
    expect(spark[0]).toBe(55);
    expect(spark[4]).toBe(0);
  });
});
