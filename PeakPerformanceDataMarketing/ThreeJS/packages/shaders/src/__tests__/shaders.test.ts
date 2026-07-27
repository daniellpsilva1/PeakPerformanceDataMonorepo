import { describe, expect, it } from "vitest";
import {
  bpmToPulseRate,
  fresnelFragmentShader,
  fresnelVertexShader,
  organGlowFragmentShader,
  organGlowVertexShader,
  pulseFragmentShader,
  pulseVertexShader,
} from "../index";

describe("shaders", () => {
  it("exports non-empty fresnel shaders", () => {
    expect(fresnelVertexShader).toBeTruthy();
    expect(fresnelFragmentShader).toBeTruthy();
    expect(fresnelFragmentShader).toContain("uGlowColor");
    expect(fresnelFragmentShader).toContain("uOpacity");
  });

  it("exports non-empty organ glow shaders", () => {
    expect(organGlowVertexShader).toBeTruthy();
    expect(organGlowFragmentShader).toBeTruthy();
    expect(organGlowFragmentShader).toContain("uPulseSpeed");
    expect(organGlowFragmentShader).toContain("uPulseIntensity");
  });

  it("exports non-empty pulse shaders", () => {
    expect(pulseVertexShader).toBeTruthy();
    expect(pulseFragmentShader).toBeTruthy();
    expect(pulseVertexShader).toContain("uPulseRate");
  });

  it("bpmToPulseRate converts 60 bpm to 2π rad/s", () => {
    expect(bpmToPulseRate(60)).toBeCloseTo(Math.PI * 2);
  });

  it("bpmToPulseRate converts 0 bpm to 0", () => {
    expect(bpmToPulseRate(0)).toBe(0);
  });
});
