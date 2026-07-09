import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import React from "react";
import { RayLayer } from "../ray-layer";
import { createCourtScales, type EnrichedShot } from "@courtviz/core";
import { sprawlball } from "@courtviz/themes";

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

const scales = createCourtScales({ half: "full", height: 800, margin: 1.5, width: 600 });

describe("RayLayer", () => {
  it("renders line elements for shots with hit and bounce coords", () => {
    const shots = [
      makeShot({ bounceX: 2, bounceY: 6, hitX: 1, hitY: 5 }),
      makeShot({ bounceX: 3, bounceY: 8, hitX: 1.5, hitY: 4 }),
    ];
    const markup = renderToStaticMarkup(
      React.createElement(RayLayer, {
        scales,
        shots,
        theme: sprawlball,
      }),
    );
    expect(markup).toContain("line");
    const lineCount = (markup.match(/<line/g) || []).length;
    expect(lineCount).toBeGreaterThanOrEqual(2);
  });

  it("renders no lines for empty shots", () => {
    const markup = renderToStaticMarkup(
      React.createElement(RayLayer, {
        scales,
        shots: [],
        theme: sprawlball,
      }),
    );
    expect(markup).not.toContain("line");
  });

  it("skips shots with null hit or bounce coordinates", () => {
    const shots = [
      makeShot({ bounceX: 2, bounceY: 6, hitX: 1, hitY: 5 }),
      makeShot({ bounceX: null, bounceY: null, hitX: 1, hitY: 5 }),
      makeShot({ bounceX: 2, bounceY: 6, hitX: null, hitY: null }),
    ];
    const markup = renderToStaticMarkup(
      React.createElement(RayLayer, {
        scales,
        shots,
        theme: sprawlball,
      }),
    );
    const lineCount = (markup.match(/<line[^r]/g) || []).length;
    expect(lineCount).toBe(1);
  });

  it("filters by stroke type when strokeFilter is provided", () => {
    const shots = [
      makeShot({ stroke: "Forehand", bounceX: 2, bounceY: 6, hitX: 1, hitY: 5 }),
      makeShot({ stroke: "Backhand", bounceX: 3, bounceY: 8, hitX: 1.5, hitY: 4 }),
    ];
    const markup = renderToStaticMarkup(
      React.createElement(RayLayer, {
        scales,
        shots,
        strokeFilter: ["Forehand"],
        theme: sprawlball,
      }),
    );
    // Should contain Forehand stroke color on lines
    expect(markup).toContain("#E8742C");
    // Should only have 1 line element (Backhand filtered out)
    const lineCount = (markup.match(/<line[^r]/g) || []).length;
    expect(lineCount).toBe(1);
  });

  it("renders arrowhead marker definitions", () => {
    const shots = [makeShot({ bounceX: 2, bounceY: 6, hitX: 1, hitY: 5 })];
    const markup = renderToStaticMarkup(
      React.createElement(RayLayer, {
        scales,
        shots,
        theme: sprawlball,
      }),
    );
    expect(markup).toContain("marker");
  });
});
