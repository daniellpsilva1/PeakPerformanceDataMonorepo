import { describe, expect, it } from "vitest";
import { enrichShots, pointKey } from "../enrich";
import type { Point, Shot } from "../schema";

function makeShot(overrides: Partial<Shot> = {}): Shot {
  return {
    matchId: "00000000-0000-0000-0000-000000000001",
    setNumber: 1,
    gameNumber: 1,
    pointNumber: 1,
    shotNumber: 1,
    player: "host",
    stroke: "Forehand",
    result: "In",
    isTerminal: false,
    ...overrides,
  };
}

function makePoint(overrides: Partial<Point> = {}): Point {
  return {
    matchId: "00000000-0000-0000-0000-000000000001",
    setNumber: 1,
    gameNumber: 1,
    pointNumber: 1,
    pointWinner: "host",
    rallyLength: 4,
    endedBy: "forehand_winner",
    breakPoint: false,
    setPoint: false,
    matchPoint: false,
    deuce: false,
    tiebreak: false,
    superTiebreak: false,
    ...overrides,
  };
}

describe("pointKey", () => {
  it("creates composite key from set/game/point", () => {
    expect(pointKey({ setNumber: 1, gameNumber: 3, pointNumber: 2 })).toBe("1-3-2");
  });
});

describe("enrichShots", () => {
  it("joins shots with points on set/game/point", () => {
    const shots: Shot[] = [
      makeShot({ shotNumber: 1, player: "host" }),
      makeShot({ shotNumber: 2, player: "guest", pointNumber: 1 }),
    ];
    const points: Point[] = [
      makePoint({ pointWinner: "host", rallyLength: 2 }),
    ];

    const enriched = enrichShots(shots, points);
    expect(enriched).toHaveLength(2);
    expect(enriched[0]!.pointWinner).toBe("host");
    expect(enriched[0]!.rallyLength).toBe(2);
    expect(enriched[1]!.pointWinner).toBe("host");
  });

  it("handles missing point data gracefully", () => {
    const shots: Shot[] = [
      makeShot({ setNumber: 2, gameNumber: 5, pointNumber: 3 }),
    ];
    const points: Point[] = [];

    const enriched = enrichShots(shots, points);
    expect(enriched[0]!.pointWinner).toBeNull();
    expect(enriched[0]!.rallyLength).toBe(1);
    expect(enriched[0]!.isBreakPoint).toBe(false);
  });

  it("preserves shot-level data", () => {
    const shots: Shot[] = [
      makeShot({
        bounceX: 1.5,
        bounceY: 20.0,
        bounceZone: "deuce_deep",
        speedKmh: 120,
        stroke: "Backhand",
      }),
    ];
    const points: Point[] = [makePoint()];

    const enriched = enrichShots(shots, points);
    expect(enriched[0]!.bounceX).toBe(1.5);
    expect(enriched[0]!.bounceY).toBe(20.0);
    expect(enriched[0]!.bounceZone).toBe("deuce_deep");
    expect(enriched[0]!.speedKmh).toBe(120);
    expect(enriched[0]!.stroke).toBe("Backhand");
  });

  it("enriches with break/set/match point flags", () => {
    const shots: Shot[] = [
      makeShot({ setNumber: 1, gameNumber: 10, pointNumber: 1 }),
    ];
    const points: Point[] = [
      makePoint({
        setNumber: 1,
        gameNumber: 10,
        pointNumber: 1,
        breakPoint: true,
        setPoint: false,
        matchPoint: false,
      }),
    ];

    const enriched = enrichShots(shots, points);
    expect(enriched[0]!.isBreakPoint).toBe(true);
    expect(enriched[0]!.isSetPoint).toBe(false);
    expect(enriched[0]!.isMatchPoint).toBe(false);
  });

  it("derives rally length from max shotNumber when point data is missing", () => {
    const shots: Shot[] = [
      makeShot({ shotNumber: 1, pointNumber: 1 }),
      makeShot({ shotNumber: 2, player: "guest", pointNumber: 1 }),
      makeShot({ shotNumber: 3, player: "host", pointNumber: 1 }),
    ];
    const points: Point[] = [
      makePoint({ rallyLength: null, pointWinner: "host" }),
    ];

    const enriched = enrichShots(shots, points);
    expect(enriched[0]!.rallyLength).toBe(3);
    expect(enriched[1]!.rallyLength).toBe(3);
    expect(enriched[2]!.rallyLength).toBe(3);
  });
});
