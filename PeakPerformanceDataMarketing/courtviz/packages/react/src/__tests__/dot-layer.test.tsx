import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import React from "react";
import { DotLayer } from "../dot-layer";
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

describe("DotLayer", () => {
  it("renders circle elements for each shot with bounce coordinates", () => {
    const shots = [
      makeShot({ bounceX: 2, bounceY: 6 }),
      makeShot({ bounceX: 3, bounceY: 8 }),
    ];
    const markup = renderToStaticMarkup(
      React.createElement(DotLayer, {
        colorBy: "stroke",
        scales,
        shots,
        size: 4,
        theme: sprawlball,
      }),
    );
    expect(markup).toContain("circle");
    const circleCount = (markup.match(/<circle/g) || []).length;
    expect(circleCount).toBe(4); // 2 shots × 2 circles (halo + main)
  });

  it("renders no circles for empty shots", () => {
    const markup = renderToStaticMarkup(
      React.createElement(DotLayer, {
        colorBy: "stroke",
        scales,
        shots: [],
        size: 4,
        theme: sprawlball,
      }),
    );
    expect(markup).not.toContain("circle");
  });

  it("colors by stroke type with correct fill colors", () => {
    const shots = [
      makeShot({ stroke: "Forehand", bounceX: 2, bounceY: 6 }),
      makeShot({ stroke: "Backhand", bounceX: 3, bounceY: 8 }),
    ];
    const markup = renderToStaticMarkup(
      React.createElement(DotLayer, {
        colorBy: "stroke",
        scales,
        shots,
        size: 4,
        theme: sprawlball,
      }),
    );
    expect(markup).toContain("#E8742C"); // Forehand
    expect(markup).toContain("#2B6CB0"); // Backhand
  });

  it("colors by player when colorBy is player", () => {
    const shots = [
      makeShot({ player: "host", bounceX: 2, bounceY: 6 }),
      makeShot({ player: "guest", bounceX: 3, bounceY: 8 }),
    ];
    const markup = renderToStaticMarkup(
      React.createElement(DotLayer, {
        colorBy: "player",
        scales,
        shots,
        size: 4,
        theme: sprawlball,
      }),
    );
    expect(markup).toContain(sprawlball.playerHost);
    expect(markup).toContain(sprawlball.playerGuest);
  });

  it("colors by result when colorBy is result", () => {
    const shots = [
      makeShot({ result: "In", bounceX: 2, bounceY: 6 }),
      makeShot({ result: "Out", bounceX: 3, bounceY: 8 }),
    ];
    const markup = renderToStaticMarkup(
      React.createElement(DotLayer, {
        colorBy: "result",
        scales,
        shots,
        size: 4,
        theme: sprawlball,
      }),
    );
    expect(markup).toContain("#38A169"); // In
    expect(markup).toContain("#E53E3E"); // Out
  });

  it("skips shots with null bounce coordinates", () => {
    const shots = [
      makeShot({ bounceX: 2, bounceY: 6 }),
      makeShot({ bounceX: null, bounceY: null }),
    ];
    const markup = renderToStaticMarkup(
      React.createElement(DotLayer, {
        colorBy: "stroke",
        scales,
        shots,
        size: 4,
        theme: sprawlball,
      }),
    );
    const circleCount = (markup.match(/<circle/g) || []).length;
    expect(circleCount).toBe(2); // 1 shot × 2 circles (halo + main)
  });
});
