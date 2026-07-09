import { AbsoluteFill } from "remotion";

export function FilmGrain() {
  return (
    <AbsoluteFill style={{ mixBlendMode: "overlay", opacity: 0.045, pointerEvents: "none" }}>
      <svg height="100%" width="100%">
        <filter id="grain">
          <feTurbulence
            baseFrequency="0.75"
            numOctaves="4"
            stitchTiles="stitch"
            type="fractalNoise"
          />
          <feColorMatrix type="saturate" values="0" />
        </filter>
        <rect filter="url(#grain)" height="100%" width="100%" />
      </svg>
    </AbsoluteFill>
  );
}
