/**
 * Organ glow vertex shader.
 * Used for highlighted body regions during the tour.
 */
export const organGlowVertexShader = /* glsl */ `
  varying vec3 vNormal;
  varying vec3 vPosition;

  void main() {
    vNormal = normalize(normalMatrix * normal);
    vPosition = position;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

/**
 * Organ glow fragment shader.
 * Produces a soft pulsing glow for highlighted body systems.
 * Uniforms:
 * - uGlowColor: system-specific glow color
 * - uGlowDim: dimmer variant for falloff
 * - uPulseSpeed: pulse frequency (driven by RHR or metric value)
 * - uPulseIntensity: overall intensity (0 = neutral, 1 = full glow)
 * - uTime: elapsed time
 */
export const organGlowFragmentShader = /* glsl */ `
  uniform vec3 uGlowColor;
  uniform vec3 uGlowDim;
  uniform float uPulseSpeed;
  uniform float uPulseIntensity;
  uniform float uTime;

  varying vec3 vNormal;
  varying vec3 vPosition;

  void main() {
    float pulse = 0.5 + 0.5 * sin(uTime * uPulseSpeed);
    float intensity = mix(0.15, 1.0, uPulseIntensity);

    vec3 color = mix(uGlowDim, uGlowColor, pulse * intensity);
    float alpha = 0.4 + 0.4 * pulse * intensity;

    gl_FragColor = vec4(color, alpha);
  }
`;
