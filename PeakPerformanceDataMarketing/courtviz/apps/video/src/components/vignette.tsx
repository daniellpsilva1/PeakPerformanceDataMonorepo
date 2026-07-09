import { broadcast } from "@courtviz/themes";
import { AbsoluteFill } from "remotion";

export function VignetteOverlay() {
  const theme = broadcast;

  return (
    <AbsoluteFill
      style={{
        background: `radial-gradient(ellipse 85% 75% at center, transparent 50%, ${theme.background}dd 100%)`,
        pointerEvents: "none",
      }}
    />
  );
}
