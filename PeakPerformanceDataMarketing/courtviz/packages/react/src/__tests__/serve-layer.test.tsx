import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import React from "react";
import { ServeLayer } from "../serve-layer";
import { createCourtScales, type EnrichedShot } from "@courtviz/core";
import { sprawlball } from "@courtviz/themes";

function makeShot(overrides: Partial<EnrichedShot> = {}): EnrichedShot {
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

const scales = createCourtScales({ half: "near", height: 600, margin: 1.5, width: 600 });

describe("ServeLayer", () => {
  it("renders circles for serve shots", () => {
    const shots = [
      makeShot({ bounceX: 2, bounceY: 6 }),
      makeShot({ bounceX: 3, bounceY: 7, type: "second_serve" }),
    ];
    const markup = renderToStaticMarkup(
      React.createElement(ServeLayer, {
        player: "host",
        scales,
        shots,
        theme: sprawlball,
      }),
    );
    expect(markup).toContain("circle");
    const circleCount = (markup.match(/<circle/g) || []).length;
    expect(circleCount).toBe(2);
  });

  it("filters to first serves only", () => {
    const shots = [
      makeShot({ bounceX: 2, bounceY: 6, type: "first_serve" }),
      makeShot({ bounceX: 3, bounceY: 7, type: "second_serve" }),
    ];
    const markup = renderToStaticMarkup(
      React.createElement(ServeLayer, {
        player: "host",
        scales,
        serveType: "first_serve",
        shots,
        theme: sprawlball,
      }),
    );
    const circleCount = (markup.match(/<circle/g) || []).length;
    expect(circleCount).toBe(2); // 1 first serve × 2 circles (halo + main)
  });

  it("filters to second serves only", () => {
    const shots = [
      makeShot({ bounceX: 2, bounceY: 6, type: "first_serve" }),
      makeShot({ bounceX: 3, bounceY: 7, type: "second_serve" }),
    ];
    const markup = renderToStaticMarkup(
      React.createElement(ServeLayer, {
        player: "host",
        scales,
        serveType: "second_serve",
        shots,
        theme: sprawlball,
      }),
    );
    // Second serves render as triangles (paths), not circles
    const pathCount = (markup.match(/<path/g) || []).length;
    expect(pathCount).toBe(2); // 1 second serve × 2 paths (halo + main)
  });

  it("renders no circles for empty shots", () => {
    const markup = renderToStaticMarkup(
      React.createElement(ServeLayer, {
        player: "host",
        scales,
        shots: [],
        theme: sprawlball,
      }),
    );
    expect(markup).not.toContain("circle");
  });

  it("uses player color for fill", () => {
    const shots = [makeShot({ bounceX: 2, bounceY: 6, player: "host" })];
    const markup = renderToStaticMarkup(
      React.createElement(ServeLayer, {
        player: "host",
        scales,
        shots,
        theme: sprawlball,
      }),
    );
    expect(markup).toContain(sprawlball.playerHost);
  });
});
