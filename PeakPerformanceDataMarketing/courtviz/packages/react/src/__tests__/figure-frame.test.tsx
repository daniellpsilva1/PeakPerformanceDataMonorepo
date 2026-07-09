import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import React from "react";
import { FigureFrame } from "../figure-frame";
import { sprawlball } from "@courtviz/themes";

describe("FigureFrame", () => {
  it("renders an svg with title and subtitle", () => {
    const markup = renderToStaticMarkup(
      React.createElement(FigureFrame, {
        height: 400,
        subtitle: "Test subtitle",
        theme: sprawlball,
        title: "Test Title",
        width: 600,
      }),
    );
    expect(markup).toContain("Test Title");
    expect(markup).toContain("Test subtitle");
    expect(markup).toContain("<svg");
  });

  it("renders source note when provided", () => {
    const markup = renderToStaticMarkup(
      React.createElement(FigureFrame, {
        height: 400,
        source: "Data source",
        theme: sprawlball,
        title: "Title",
        width: 600,
      }),
    );
    expect(markup).toContain("Data source");
  });

  it("renders children inside content area", () => {
    const markup = renderToStaticMarkup(
      React.createElement(
        FigureFrame,
        { height: 400, theme: sprawlball, title: "Title", width: 600 },
        React.createElement("rect", { height: 100, width: 100, x: 50, y: 50 }),
      ),
    );
    expect(markup).toContain("rect");
  });

  it("omits title when not provided", () => {
    const markup = renderToStaticMarkup(
      React.createElement(FigureFrame, {
        height: 400,
        theme: sprawlball,
        width: 600,
      }),
    );
    expect(markup).not.toContain("figureTitle");
  });
});
