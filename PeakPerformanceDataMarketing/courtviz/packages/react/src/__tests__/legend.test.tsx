import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import React from "react";
import { ColorBar, Legend } from "../legend";
import { sprawlball } from "@courtviz/themes";

describe("ColorBar", () => {
  it("renders a rect element with gradient fill", () => {
    const markup = renderToStaticMarkup(
      React.createElement(ColorBar, {
        min: 0,
        max: 100,
        theme: sprawlball,
        width: 200,
      }),
    );
    expect(markup).toContain("rect");
    expect(markup).toContain("url(#");
  });

  it("renders min and max labels", () => {
    const markup = renderToStaticMarkup(
      React.createElement(ColorBar, {
        min: "Cold",
        max: "Hot",
        theme: sprawlball,
        width: 200,
      }),
    );
    expect(markup).toContain("Cold");
    expect(markup).toContain("Hot");
  });

  it("renders optional label when provided", () => {
    const markup = renderToStaticMarkup(
      React.createElement(ColorBar, {
        label: "Efficiency",
        min: 0,
        max: 1,
        theme: sprawlball,
        width: 200,
      }),
    );
    expect(markup).toContain("Efficiency");
  });

  it("omits label text when not provided", () => {
    const markup = renderToStaticMarkup(
      React.createElement(ColorBar, {
        min: 0,
        max: 1,
        theme: sprawlball,
        width: 200,
      }),
    );
    expect(markup).not.toContain("bold");
  });
});

describe("Legend", () => {
  it("renders swatch rects and label text for each item", () => {
    const items = [
      { color: "#ff0000", label: "Forehand" },
      { color: "#0000ff", label: "Backhand" },
    ];
    const markup = renderToStaticMarkup(
      React.createElement(Legend, {
        items,
        theme: sprawlball,
      }),
    );
    expect(markup).toContain("Forehand");
    expect(markup).toContain("Backhand");
    expect(markup).toContain("#ff0000");
    expect(markup).toContain("#0000ff");
  });

  it("renders items vertically by default", () => {
    const items = [
      { color: "#ff0000", label: "A" },
      { color: "#0000ff", label: "B" },
    ];
    const markup = renderToStaticMarkup(
      React.createElement(Legend, {
        items,
        theme: sprawlball,
      }),
    );
    const transformCount = (markup.match(/transform="translate/g) || []).length;
    expect(transformCount).toBeGreaterThanOrEqual(2);
  });

  it("renders items horizontally when orientation is horizontal", () => {
    const items = [
      { color: "#ff0000", label: "A" },
      { color: "#0000ff", label: "B" },
    ];
    const markup = renderToStaticMarkup(
      React.createElement(Legend, {
        items,
        orientation: "horizontal",
        theme: sprawlball,
      }),
    );
    expect(markup).toContain("A");
    expect(markup).toContain("B");
  });

  it("renders empty group for no items", () => {
    const markup = renderToStaticMarkup(
      React.createElement(Legend, {
        items: [],
        theme: sprawlball,
      }),
    );
    expect(markup).toContain("<g");
    expect(markup).not.toContain("rect");
  });
});
