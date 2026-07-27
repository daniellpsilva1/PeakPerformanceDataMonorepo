/**
 * Fresnel shell vertex shader.
 * Translucent body shell with edge glow — standard Fresnel effect.
 */
export const fresnelVertexShader = /* glsl */ `
  varying vec3 vNormal;
  varying vec3 vViewPosition;

  void main() {
    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
    vViewPosition = -mvPosition.xyz;
    vNormal = normalize(normalMatrix * normal);
    gl_Position = projectionMatrix * mvPosition;
  }
`;

/**
 * Fresnel shell fragment shader.
 * Produces a translucent body shell with edge glow in brand colors.
 * Uniforms:
 * - uGlowColor: primary glow color (brand blue/emerald)
 * - uGlowIntensity: overall glow strength (0–1)
 * - uOpacity: base shell opacity (0–1)
 * - uTime: elapsed time for subtle breathing animation
 */
export const fresnelFragmentShader = /* glsl */ `
  uniform vec3 uGlowColor;
  uniform float uGlowIntensity;
  uniform float uOpacity;
  uniform float uTime;

  varying vec3 vNormal;
  varying vec3 vViewPosition;

  void main() {
    vec3 viewDir = normalize(vViewPosition);
    float fresnel = 1.0 - abs(dot(viewDir, vNormal));
    fresnel = pow(fresnel, 2.5);

    float breath = 0.85 + 0.15 * sin(uTime * 0.8);
    float glow = fresnel * uGlowIntensity * breath;

    vec3 color = uGlowColor * glow;
    float alpha = uOpacity + fresnel * 0.3;

    gl_FragColor = vec4(color, alpha);
  }
`;
