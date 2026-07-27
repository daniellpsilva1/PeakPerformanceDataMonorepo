"use client";

import type { ReactNode } from "react";
import { colorPrimitives } from "@bodyviz/tokens";
import { OrbitControls, PerspectiveCamera } from "@react-three/drei";
import { Canvas } from "@react-three/fiber";

export interface BodyCanvasProps {
  children?: ReactNode;
  enableOrbit?: boolean;
  frameloop?: "always" | "demand" | "never";
  cameraPosition?: [number, number, number];
  cameraFov?: number;
  className?: string;
  style?: React.CSSProperties;
}

/**
 * R3F Canvas wrapper for the body twin scene.
 * Navy aurora atmosphere with brand-aligned lighting.
 * Mirrors CourtViz CourtStage patterns: preserveDrawingBuffer,
 * frameloop="demand" for capture, OrbitControls on desktop.
 */
export function BodyCanvas({
  children,
  enableOrbit = true,
  frameloop = "always",
  cameraPosition = [0, 1.5, 5],
  cameraFov = 38,
  className,
  style,
}: BodyCanvasProps) {
  return (
    <Canvas
      className={className}
      frameloop={frameloop}
      gl={{ antialias: true, preserveDrawingBuffer: true }}
      style={{ background: colorPrimitives.navy900, ...style }}
    >
      <color attach="background" args={[colorPrimitives.navy900]} />
      <fog attach="fog" args={[colorPrimitives.navy900, 6, 14]} />
      <PerspectiveCamera
        fov={cameraFov}
        makeDefault
        position={cameraPosition}
      />
      <ambientLight intensity={0.35} />
      <directionalLight
        intensity={0.6}
        position={[3, 6, 4]}
      />
      <pointLight
        color={colorPrimitives.primaryBright}
        intensity={0.4}
        position={[-3, 2, -2]}
      />
      <pointLight
        color={colorPrimitives.accent}
        intensity={0.3}
        position={[3, -1, -3]}
      />
      {children}
      {enableOrbit ? (
        <OrbitControls
          enablePan={false}
          maxDistance={10}
          maxPolarAngle={Math.PI / 1.8}
          minDistance={2}
          target={[0, 0.5, 0]}
        />
      ) : null}
    </Canvas>
  );
}
