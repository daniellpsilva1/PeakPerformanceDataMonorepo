/**
 * Pulse vertex shader for cardiac rhythm visualization.
 * Drives a subtle scale modulation on the heart region.
 */
export const pulseVertexShader = /* glsl */ `
  uniform float uPulseRate;
  uniform float uPulseAmplitude;
  uniform float uTime;

  varying vec3 vNormal;

  void main() {
    vNormal = normalize(normalMatrix * normal);

    float pulse = sin(uTime * uPulseRate);
    float scale = 1.0 + uPulseAmplitude * pulse;

    vec3 scaled = position * scale;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(scaled, 1.0);
  }
`;

/**
 * Pulse fragment shader — simple emissive color for the pulse effect.
 */
export const pulseFragmentShader = /* glsl */ `
  uniform vec3 uColor;
  uniform float uIntensity;

  varying vec3 vNormal;

  void main() {
    gl_FragColor = vec4(uColor * uIntensity, 1.0);
  }
`;

/**
 * Convert a resting heart rate (bpm) to a pulse rate in radians/sec.
 * 60 bpm = 1 Hz = 2π rad/s.
 */
export function bpmToPulseRate(bpm: number): number {
  return (bpm / 60) * Math.PI * 2;
}
