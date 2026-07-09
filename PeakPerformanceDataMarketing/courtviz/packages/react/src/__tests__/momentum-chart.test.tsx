import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import React from "react";
import { MomentumChart } from "../momentum-chart";
import { sprawlball, ppdDark } from "@courtviz/themes";

function makePoint(overrides: Partial<{ gameNumber: number; isBreakPoint: boolean; isMatchPoint: boolean; isSetPoint: boolean; pointWinner: string; setNumber: number }> = {}) {
  return {
    gameNumber: 1,
    isBreakPoint: false,
    isMatchPoint: false,
    isSetPoint: false,
    pointWinner: "host",
    setNumber: 1,
    ...overrides,
  };
}

describe("MomentumChart", () => {
  it("renders an SVG element with path for momentum line", () => {
    const points = [
      makePoint({ pointWinner: "host" }),
      makePoint({ pointWinner: "guest" }),
      makePoint({ pointWinner: "host" }),
    ];
    const markup = renderToStaticMarkup(
      React.createElement(MomentumChart, {
        height: 200,
        hostPlayer: "host",
        points,
        theme: sprawlball,
        width: 800,
      }),
    );
    expect(markup).toContain("svg");
    expect(markup).toContain("path");
  });

  it("renders zero line at center", () => {
    const points = [makePoint({ pointWinner: "host" })];
    const markup = renderToStaticMarkup(
      React.createElement(MomentumChart, {
        height: 200,
        hostPlayer: "host",
        points,
        theme: sprawlball,
        width: 800,
      }),
    );
    expect(markup).toContain("line");
  });

  it("renders break point markers when showBreakPoints is true", () => {
    const points = [
      makePoint({ pointWinner: "host", isBreakPoint: true }),
      makePoint({ pointWinner: "guest" }),
    ];
    const markup = renderToStaticMarkup(
      React.createElement(MomentumChart, {
        height: 200,
        hostPlayer: "host",
        points,
        showBreakPoints: true,
        theme: sprawlball,
        width: 800,
      }),
    );
    expect(markup).toContain("circle");
  });

  it("hides break point markers when showBreakPoints is false", () => {
    const points = [
      makePoint({ pointWinner: "host", isBreakPoint: true }),
      makePoint({ pointWinner: "guest" }),
    ];
    const markup = renderToStaticMarkup(
      React.createElement(MomentumChart, {
        height: 200,
        hostPlayer: "host",
        points,
        showBreakPoints: false,
        theme: sprawlball,
        width: 800,
      }),
    );
    expect(markup).not.toContain("circle");
  });

  it("renders set boundary lines when showSetBoundaries is true", () => {
    const points = [
      makePoint({ setNumber: 1, pointWinner: "host" }),
      makePoint({ setNumber: 1, pointWinner: "guest" }),
      makePoint({ setNumber: 2, pointWinner: "host" }),
    ];
    const markup = renderToStaticMarkup(
      React.createElement(MomentumChart, {
        height: 200,
        hostPlayer: "host",
        points,
        showSetBoundaries: true,
        theme: sprawlball,
        width: 800,
      }),
    );
    const lineCount = (markup.match(/<line/g) || []).length;
    expect(lineCount).toBeGreaterThanOrEqual(2); // zero line + set boundary
  });

  it("renders with ppdDark theme", () => {
    const points = [makePoint({ pointWinner: "host" })];
    const markup = renderToStaticMarkup(
      React.createElement(MomentumChart, {
        height: 200,
        hostPlayer: "host",
        points,
        theme: ppdDark,
        width: 800,
      }),
    );
    expect(markup).toContain(ppdDark.background);
  });

  it("handles empty points array gracefully", () => {
    const markup = renderToStaticMarkup(
      React.createElement(MomentumChart, {
        height: 200,
        hostPlayer: "host",
        points: [],
        theme: sprawlball,
        width: 800,
      }),
    );
    expect(markup).toContain("svg");
  });
});
