import { describe, expect, it } from "vitest";
import { computeServeZones } from "../serve-zones";
import type { EnrichedShot } from "../stats";

function makeServe(overrides: Partial<EnrichedShot> = {}): EnrichedShot {
  return {
    player: "host",
    stroke: "Serve",
    type: "first_serve",
    result: "In",
    spin: null,
    speedKmh: 180,
    bounceX: 2.0,
    bounceY: 6.0,
    hitX: 1.0,
    hitY: 11.0,
    hitZ: 2.8,
    bounceZone: "deuce",
    direction: null,
    isTerminal: false,
    setNumber: 1,
    gameNumber: 1,
    pointNumber: 1,
    pointWinner: "host",
    rallyLength: 1,
    endedBy: null,
    isBreakPoint: false,
    isSetPoint: false,
    isMatchPoint: false,
    ...overrides,
  };
}

describe("computeServeZones", () => {
  it("returns empty array for no serves", () => {
    const result = computeServeZones([], "host");
    expect(result).toEqual([]);
  });

  it("classifies serves into zones", () => {
    const serves = [
      makeServe({ bounceX: -3, bounceY: 7, pointWinner: "host" }),
      makeServe({ bounceX: -3, bounceY: 7, pointWinner: "guest" }),
      makeServe({ bounceX: 3, bounceY: 7, pointWinner: "host" }),
      makeServe({ bounceX: 0, bounceY: 7, pointWinner: "host" }),
    ];
    const result = computeServeZones(serves, "host");
    expect(result.length).toBeGreaterThan(0);
    for (const zone of result) {
      expect(zone.zone).toMatch(/wide|body|T/);
      expect(zone.count).toBeGreaterThan(0);
      expect(zone.winRate).toBeGreaterThanOrEqual(0);
      expect(zone.winRate).toBeLessThanOrEqual(1);
    }
  });

  it("filters by player", () => {
    const serves = [
      makeServe({ player: "host", bounceX: -3, bounceY: 7 }),
      makeServe({ player: "guest", bounceX: -3, bounceY: 7 }),
    ];
    const result = computeServeZones(serves, "host");
    const totalServes = result.reduce((sum, z) => sum + z.count, 0);
    expect(totalServes).toBe(1);
  });
});
