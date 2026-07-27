import { describe, expect, it } from "vitest";
import {
  bodySystemColors,
  colorPrimitives,
  semanticColors,
  typography,
  type BodySystemId,
} from "../index";

describe("@bodyviz/tokens", () => {
  it("exports PPD brand color primitives", () => {
    expect(colorPrimitives.navy900).toBe("#0F172A");
    expect(colorPrimitives.primaryBright).toBe("#3B82F6");
    expect(colorPrimitives.accent).toBe("#10B981");
    expect(colorPrimitives.marketing).toBe("#0047FF");
  });

  it("exports semantic dark/light color sets", () => {
    expect(semanticColors.dark.background).toBe(colorPrimitives.navy900);
    expect(semanticColors.dark.primary).toBe(colorPrimitives.primaryBright);
    expect(semanticColors.light.background).toBe(colorPrimitives.white);
  });

  it("exports typography with Barlow Condensed + Inter", () => {
    expect(typography.families.condensed).toBe("Barlow Condensed");
    expect(typography.families.body).toBe("Inter");
  });

  it("defines body-system colors for all 6 tour stops", () => {
    const systems: BodySystemId[] = [
      "sleep",
      "recovery",
      "hrv",
      "rhr",
      "load",
      "stress",
    ];
    for (const id of systems) {
      const colors = bodySystemColors[id];
      expect(colors).toBeDefined();
      expect(colors.glow).toMatch(/^#[0-9A-Fa-f]{6}$/);
      expect(colors.glowDim).toMatch(/^#[0-9A-Fa-f]{6}$/);
      expect(colors.neutral).toMatch(/^#[0-9A-Fa-f]{6}$/);
    }
  });

  it("uses brand accent for recovery system", () => {
    expect(bodySystemColors.recovery.glow).toBe(colorPrimitives.accent);
  });

  it("uses brand primary bright for rhr system", () => {
    expect(bodySystemColors.rhr.glow).toBe(colorPrimitives.primaryBright);
  });
});
