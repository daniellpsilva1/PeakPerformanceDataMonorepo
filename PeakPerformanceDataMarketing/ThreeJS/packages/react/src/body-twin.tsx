"use client";

import { useEffect, useMemo, useRef } from "react";
import type { BodySystemId } from "@bodyviz/tokens";
import { bodySystemColors, colorPrimitives } from "@bodyviz/tokens";
import type { DailySnapshot } from "@bodyviz/core";
import type { TourStop } from "@bodyviz/core";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import {
  fresnelFragmentShader,
  fresnelVertexShader,
  organGlowFragmentShader,
  organGlowVertexShader,
} from "@bodyviz/shaders";

export interface BodyTwinProps {
  activeSystem: BodySystemId | null;
  snapshot: DailySnapshot;
  tourStop: TourStop | null;
  reducedMotion?: boolean;
}

/**
 * Stylized translucent body twin.
 * Uses a capsule-based procedural body (no GLB dependency yet)
 * with fresnel shell shader + organ glow for system highlights.
 * Designed to be replaced by a GLB model later — region mapping
 * via named nodes will swap in transparently.
 */
export function BodyTwin({
  activeSystem,
  snapshot,
  tourStop,
  reducedMotion = false,
}: BodyTwinProps) {
  const groupRef = useRef<THREE.Group>(null);
  const shellMaterialRef = useRef<THREE.ShaderMaterial>(null);
  const glowMaterialRef = useRef<THREE.ShaderMaterial>(null);
  const timeRef = useRef(0);

  const shellUniforms = useMemo(
    () => ({
      uGlowColor: { value: new THREE.Color(colorPrimitives.primaryBright) },
      uGlowIntensity: { value: 0.6 },
      uOpacity: { value: 0.15 },
      uTime: { value: 0 },
    }),
    [],
  );

  const glowUniforms = useMemo(
    () => ({
      uGlowColor: { value: new THREE.Color(colorPrimitives.accent) },
      uGlowDim: { value: new THREE.Color(colorPrimitives.navy700) },
      uPulseSpeed: { value: 1.5 },
      uPulseIntensity: { value: 0 },
      uTime: { value: 0 },
    }),
    [],
  );

  const systemColors = activeSystem
    ? bodySystemColors[activeSystem]
    : null;

  const glowColor = systemColors?.glow ?? colorPrimitives.primaryBright;
  const glowDim = systemColors?.glowDim ?? colorPrimitives.navy700;
  const pulseIntensity = activeSystem ? 0.8 : 0;

  const pulseSpeed = useMemo(() => {
    if (activeSystem === "rhr" && snapshot.rhr.bpm) {
      return (snapshot.rhr.bpm / 60) * Math.PI;
    }
    return 1.5;
  }, [activeSystem, snapshot.rhr.bpm]);

  useEffect(() => {
    if (shellMaterialRef.current) {
      (shellMaterialRef.current.uniforms.uGlowColor as THREE.IUniform).value =
        new THREE.Color(glowColor);
    }
    if (glowMaterialRef.current) {
      const uniforms = glowMaterialRef.current.uniforms;
      (uniforms.uGlowColor as THREE.IUniform).value = new THREE.Color(glowColor);
      (uniforms.uGlowDim as THREE.IUniform).value = new THREE.Color(glowDim);
      (uniforms.uPulseSpeed as THREE.IUniform).value = pulseSpeed;
      (uniforms.uPulseIntensity as THREE.IUniform).value = pulseIntensity;
    }
  }, [glowColor, glowDim, pulseIntensity, pulseSpeed]);

  useFrame((_state, delta) => {
    timeRef.current += reducedMotion ? 0 : delta;
    const t = timeRef.current;

    if (shellMaterialRef.current) {
      (shellMaterialRef.current.uniforms.uTime as THREE.IUniform).value = t;
    }
    if (glowMaterialRef.current) {
      (glowMaterialRef.current.uniforms.uTime as THREE.IUniform).value = t;
    }
    if (groupRef.current && !reducedMotion) {
      groupRef.current.position.y = Math.sin(t) * 0.02;
    }
  });

  const regions = tourStop?.regions ?? [];

  return (
    <group ref={groupRef}>
      {/* Translucent body shell */}
      <mesh>
        <capsuleGeometry args={[0.5, 1.4, 8, 16]} />
        <shaderMaterial
          ref={shellMaterialRef}
          fragmentShader={fresnelFragmentShader}
          transparent
          uniforms={shellUniforms}
          vertexShader={fresnelVertexShader}
        />
      </mesh>

      {/* Head */}
      <mesh position={[0, 1.3, 0]}>
        <sphereGeometry args={[0.35, 16, 16]} />
        <shaderMaterial
          ref={glowMaterialRef}
          fragmentShader={organGlowFragmentShader}
          transparent
          uniforms={glowUniforms}
          vertexShader={organGlowVertexShader}
        />
      </mesh>

      {/* System highlight regions */}
      {activeSystem && regions.includes("brain") && (
        <mesh position={[0, 1.3, 0]}>
          <sphereGeometry args={[0.38, 16, 16]} />
          <meshBasicMaterial
            color={glowColor}
            opacity={0.15}
            transparent
          />
        </mesh>
      )}

      {activeSystem && regions.includes("heart") && (
        <mesh position={[0.12, 0.3, 0.3]}>
          <sphereGeometry args={[0.15, 12, 12]} />
          <meshBasicMaterial color={glowColor} opacity={0.4} transparent />
        </mesh>
      )}

      {activeSystem && regions.includes("torso") && (
        <mesh position={[0, 0.1, 0]}>
          <capsuleGeometry args={[0.45, 0.8, 6, 12]} />
          <meshBasicMaterial
            color={glowColor}
            opacity={0.12}
            transparent
          />
        </mesh>
      )}

      {activeSystem && (regions.includes("muscles") || regions.includes("arms") || regions.includes("legs")) && (
        <>
          <mesh position={[-0.65, 0.1, 0]}>
            <capsuleGeometry args={[0.1, 0.7, 4, 8]} />
            <meshBasicMaterial color={glowColor} opacity={0.2} transparent />
          </mesh>
          <mesh position={[0.65, 0.1, 0]}>
            <capsuleGeometry args={[0.1, 0.7, 4, 8]} />
            <meshBasicMaterial color={glowColor} opacity={0.2} transparent />
          </mesh>
          <mesh position={[-0.2, -1.0, 0]}>
            <capsuleGeometry args={[0.12, 0.6, 4, 8]} />
            <meshBasicMaterial color={glowColor} opacity={0.2} transparent />
          </mesh>
          <mesh position={[0.2, -1.0, 0]}>
            <capsuleGeometry args={[0.12, 0.6, 4, 8]} />
            <meshBasicMaterial color={glowColor} opacity={0.2} transparent />
          </mesh>
        </>
      )}

    </group>
  );
}
