import { describe, expect, it } from "vitest";
import { COURT_LENGTH, NET_Y } from "../geometry";
import {
  hasValidSpatialCoords,
  isFarEnd,
  isValidHitY,
  normalizeHit,
  normalizeShot,
  normalizeShotRecord,
  normalizeToHalfCourt,
} from "../normalize";

describe("normalizeToHalfCourt", () => {
  it("keeps far-end shots as-is", () => {
    const x = [1.0, -2.0];
    const y = [20.0, 18.0];
    const hitY = [22.0, 21.0]; // far end
    const [xNorm, yNorm] = normalizeToHalfCourt(x, y, hitY);
    expect(xNorm[0]).toBe(1.0);
    expect(yNorm[0]).toBe(20.0);
    expect(xNorm[1]).toBe(-2.0);
    expect(yNorm[1]).toBe(18.0);
  });

  it("mirrors near-end shots to far half", () => {
    const x = [1.0, -2.0];
    const y = [5.0, 3.0];
    const hitY = [2.0, 1.0]; // near end
    const [xNorm, yNorm] = normalizeToHalfCourt(x, y, hitY);
    expect(xNorm[0]).toBe(-1.0);
    expect(yNorm[0]).toBe(COURT_LENGTH - 5.0);
    expect(xNorm[1]).toBe(2.0);
    expect(yNorm[1]).toBe(COURT_LENGTH - 3.0);
  });

  it("defaults to far end when hitY not provided", () => {
    const x = [1.0];
    const y = [20.0];
    const [xNorm, yNorm] = normalizeToHalfCourt(x, y);
    expect(xNorm[0]).toBe(1.0);
    expect(yNorm[0]).toBe(20.0);
  });
});

describe("normalizeShot", () => {
  it("mirrors near-end shot", () => {
    const [x, y] = normalizeShot(1.5, 4.0, 2.0);
    expect(x).toBe(-1.5);
    expect(y).toBe(COURT_LENGTH - 4.0);
  });

  it("keeps far-end shot", () => {
    const [x, y] = normalizeShot(1.5, 20.0, 22.0);
    expect(x).toBe(1.5);
    expect(y).toBe(20.0);
  });
});

describe("normalizeHit", () => {
  it("mirrors near-end hit", () => {
    const [x, y] = normalizeHit(1.0, 3.0);
    expect(x).toBe(-1.0);
    expect(y).toBe(COURT_LENGTH - 3.0);
  });

  it("keeps far-end hit", () => {
    const [x, y] = normalizeHit(1.0, 20.0);
    expect(x).toBe(1.0);
    expect(y).toBe(20.0);
  });
});

describe("isFarEnd", () => {
  it("returns true for far end", () => {
    expect(isFarEnd(20.0)).toBe(true);
    expect(isFarEnd(NET_Y + 0.1)).toBe(true);
  });

  it("returns false for near end", () => {
    expect(isFarEnd(5.0)).toBe(false);
    expect(isFarEnd(NET_Y)).toBe(false);
  });
});

describe("normalizeShotRecord", () => {
  it("normalizes far-end shot record", () => {
    const record = {
      bounceX: 1.5,
      bounceY: 20.0,
      hitX: 0.5,
      hitY: 22.0,
    };
    const result = normalizeShotRecord(record);
    expect(result.isFar).toBe(true);
    expect(result.bounceXNorm).toBe(1.5);
    expect(result.bounceYNorm).toBe(20.0);
    expect(result.hitXNorm).toBe(0.5);
    expect(result.hitYNorm).toBe(22.0);
  });

  it("normalizes near-end shot record", () => {
    const record = {
      bounceX: 1.5,
      bounceY: 4.0,
      hitX: 0.5,
      hitY: 2.0,
    };
    const result = normalizeShotRecord(record);
    expect(result.isFar).toBe(false);
    expect(result.bounceXNorm).toBe(-1.5);
    expect(result.bounceYNorm).toBe(COURT_LENGTH - 4.0);
    expect(result.hitXNorm).toBe(-0.5);
    expect(result.hitYNorm).toBe(COURT_LENGTH - 2.0);
  });

  it("handles null coordinates", () => {
    const record = {
      bounceX: null,
      bounceY: null,
      hitX: null,
      hitY: null,
    };
    const result = normalizeShotRecord(record);
    expect(result.isFar).toBe(true); // defaults to far
    expect(result.bounceXNorm).toBe(0);
    expect(result.bounceYNorm).toBe(0);
  });
});

describe("isValidHitY", () => {
  it("rejects negative and out-of-bounds values", () => {
    expect(isValidHitY(-2)).toBe(false);
    expect(isValidHitY(COURT_LENGTH + 1)).toBe(false);
    expect(isValidHitY(null)).toBe(false);
    expect(isValidHitY(5)).toBe(true);
  });
});

describe("hasValidSpatialCoords", () => {
  it("requires valid bounce and hit coordinates", () => {
    expect(
      hasValidSpatialCoords({
        bounceX: 1,
        bounceY: 5,
        hitY: -1,
      }),
    ).toBe(false);
    expect(
      hasValidSpatialCoords({
        bounceX: 1,
        bounceY: 5,
        hitY: 20,
      }),
    ).toBe(true);
  });
});

describe("invalid hitY normalization", () => {
  it("defaults invalid hitY to far end", () => {
    const [x, y] = normalizeShot(1.5, 20.0, -2.0);
    expect(x).toBe(1.5);
    expect(y).toBe(20.0);
    expect(isFarEnd(-2.0)).toBe(true);
  });
});
