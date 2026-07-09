import { describe, expect, it } from "vitest";
import {
  BASELINE_FAR,
  BASELINE_NEAR,
  COURT_LENGTH,
  DOUBLES_HALF,
  DOUBLES_WIDTH,
  NET_Y,
  SERVICE_LINE_FAR,
  SERVICE_LINE_NEAR,
  SINGLES_HALF,
  SINGLES_WIDTH,
  courtFillRect,
  courtLines,
  courtYBounds,
} from "../geometry";

describe("court dimensions", () => {
  it("matches ITF regulation values", () => {
    expect(SINGLES_WIDTH).toBe(8.23);
    expect(DOUBLES_WIDTH).toBe(10.97);
    expect(COURT_LENGTH).toBe(23.77);
    expect(NET_Y).toBeCloseTo(11.885, 3);
    expect(SERVICE_LINE_NEAR).toBeCloseTo(6.40, 2);
    expect(SERVICE_LINE_FAR).toBeCloseTo(17.37, 2);
    expect(BASELINE_NEAR).toBe(0);
    expect(BASELINE_FAR).toBe(23.77);
    expect(SINGLES_HALF).toBeCloseTo(4.115, 3);
    expect(DOUBLES_HALF).toBeCloseTo(5.485, 3);
  });

  it("y bounds for full court", () => {
    const [min, max] = courtYBounds("full");
    expect(min).toBe(0);
    expect(max).toBe(23.77);
  });

  it("y bounds for near half", () => {
    const [min, max] = courtYBounds("near");
    expect(min).toBe(0);
    expect(max).toBe(NET_Y);
  });

  it("y bounds for far half", () => {
    const [min, max] = courtYBounds("far");
    expect(min).toBe(NET_Y);
    expect(max).toBe(COURT_LENGTH);
  });
});

describe("courtLines", () => {
  it("generates lines for full court", () => {
    const lines = courtLines("full");
    // Should have: 2 doubles sidelines, 2 singles sidelines,
    // 2 baselines, 1 net, 2 service lines, 1 center service line,
    // 2 center marks = 12
    expect(lines.length).toBe(12);
  });

  it("generates fewer lines for near half", () => {
    const lines = courtLines("near");
    // Should skip far baseline, far service line, far center mark, center service line
    // 2 doubles + 2 singles + 1 near baseline + 1 net + 1 near service + 1 near center mark = 8
    expect(lines.length).toBe(8);
  });

  it("net extends beyond doubles sidelines", () => {
    const lines = courtLines("full");
    const netLine = lines.find(
      ([, y1, , y2]) => y1 === NET_Y && y2 === NET_Y,
    );
    expect(netLine).toBeDefined();
    expect(netLine![0]).toBeLessThan(-DOUBLES_HALF);
    expect(netLine![2]).toBeGreaterThan(DOUBLES_HALF);
  });
});

describe("courtFillRect", () => {
  it("returns correct rect for full court", () => {
    const [x, y, w, h] = courtFillRect("full");
    expect(x).toBe(-DOUBLES_HALF);
    expect(y).toBe(0);
    expect(w).toBe(DOUBLES_WIDTH);
    expect(h).toBe(COURT_LENGTH);
  });

  it("returns correct rect for near half", () => {
    const [x, y, w, h] = courtFillRect("near");
    expect(x).toBe(-DOUBLES_HALF);
    expect(y).toBe(0);
    expect(w).toBe(DOUBLES_WIDTH);
    expect(h).toBe(NET_Y);
  });
});
