import { describe, expect, it } from "vitest";
import { computeShotFlows } from "../shot-flows";
import type { EnrichedShot } from "../stats";

function makeShot(overrides: Partial<EnrichedShot> = {}): EnrichedShot {
  return {
    player: "host",
    stroke: "Forehand",
    type: null,
    result: "In",
    spin: null,
    speedKmh: 80,
    bounceX: 2.0,
    bounceY: 6.0,
    hitX: 1.0,
    hitY: 5.0,
    hitZ: 1.5,
    bounceZone: "deuce",
    direction: null,
    isTerminal: false,
    setNumber: 1,
    gameNumber: 1,
    pointNumber: 1,
    pointWinner: "host",
    rallyLength: 4,
    endedBy: null,
    isBreakPoint: false,
    isSetPoint: false,
    isMatchPoint: false,
    ...overrides,
  };
}

describe("computeShotFlows", () => {
  it("returns empty array for empty shots", () => {
    const result = computeShotFlows([], { minCount: 2 });
    expect(result).toEqual([]);
  });

  it("aggregates shots into flows with count >= minCount", () => {
    const shots = [
      makeShot({ hitX: 1, hitY: 5, bounceX: 2, bounceY: 6 }),
      makeShot({ hitX: 1, hitY: 5, bounceX: 2, bounceY: 6 }),
      makeShot({ hitX: 1, hitY: 5, bounceX: 2, bounceY: 6 }),
      makeShot({ hitX: 3, hitY: 8, bounceX: 4, bounceY: 9 }),
    ];
    const result = computeShotFlows(shots, { minCount: 2 });
    expect(result.length).toBeGreaterThan(0);
    for (const flow of result) {
      expect(flow.count).toBeGreaterThanOrEqual(2);
      expect(typeof flow.fromX).toBe("number");
      expect(typeof flow.fromY).toBe("number");
      expect(typeof flow.toX).toBe("number");
      expect(typeof flow.toY).toBe("number");
    }
  });

  it("filters by player when specified", () => {
    const shots = [
      makeShot({ player: "host", hitX: 1, hitY: 5, bounceX: 2, bounceY: 6 }),
      makeShot({ player: "host", hitX: 1, hitY: 5, bounceX: 2, bounceY: 6 }),
      makeShot({ player: "guest", hitX: 1, hitY: 5, bounceX: 2, bounceY: 6 }),
      makeShot({ player: "guest", hitX: 1, hitY: 5, bounceX: 2, bounceY: 6 }),
    ];
    const result = computeShotFlows(shots, { minCount: 2, player: "host" });
    const totalCount = result.reduce((sum, f) => sum + f.count, 0);
    expect(totalCount).toBe(2);
  });
});
