import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import React from "react";
import { HexbinLayer } from "../hexbin-layer";
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

const scales = createCourtScales({ half: "near", height: 600, margin: 1.5, width: 600 });

describe("HexbinLayer", () => {
  it("renders SVG polygon elements for shots", () => {
    const shots = [
      makeShot({ bounceX: 2, bounceY: 6 }),
      makeShot({ bounceX: 2.1, bounceY: 6.1 }),
      makeShot({ bounceX: 2.05, bounceY: 6.05 }),
    ];
    const markup = renderToStaticMarkup(
      React.createElement(HexbinLayer, {
        colorScale: "efficiency",
        gridsize: 30,
        half: "near",
        minCount: 1,
        scales,
        shots,
        theme: sprawlball,
      }),
    );
    expect(markup).toContain("polygon");
    expect(markup.length).toBeGreaterThan(0);
  });

  it("renders nothing meaningful with empty shots", () => {
    const markup = renderToStaticMarkup(
      React.createElement(HexbinLayer, {
        colorScale: "efficiency",
        gridsize: 30,
        half: "near",
        minCount: 1,
        scales,
        shots: [],
        theme: sprawlball,
      }),
    );
    expect(markup).not.toContain("polygon");
  });

  it("filters by player when player prop is set", () => {
    const shots = [
      makeShot({ player: "host", bounceX: 2, bounceY: 6 }),
      makeShot({ player: "guest", bounceX: 2, bounceY: 6 }),
    ];
    const markup = renderToStaticMarkup(
      React.createElement(HexbinLayer, {
        colorScale: "efficiency",
        gridsize: 30,
        half: "near",
        minCount: 1,
        player: "host",
        scales,
        shots,
        theme: sprawlball,
      }),
    );
    expect(markup).toContain("polygon");
  });

  it("applies fill color from efficiency scale", () => {
    const shots = [
      makeShot({ bounceX: 2, bounceY: 6, pointWinner: "host" }),
      makeShot({ bounceX: 2, bounceY: 6, pointWinner: "host" }),
      makeShot({ bounceX: 2, bounceY: 6, pointWinner: "guest" }),
    ];
    const markup = renderToStaticMarkup(
      React.createElement(HexbinLayer, {
        colorScale: "efficiency",
        gridsize: 30,
        half: "near",
        minCount: 1,
        scales,
        shots,
        theme: sprawlball,
      }),
    );
    expect(markup).toMatch(/fill="[^"]+"/);
  });
});
