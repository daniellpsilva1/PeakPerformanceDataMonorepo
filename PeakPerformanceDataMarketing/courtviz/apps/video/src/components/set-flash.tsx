import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { condensedFont } from "../fonts";
import { PPD, theme } from "../ppd-tokens";

type SetFlashProps = {
  setNumber: number;
  triggerFrame: number;
};

export function SetFlash({ setNumber, triggerFrame }: SetFlashProps) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const localFrame = frame - triggerFrame;
  if (localFrame < 0 || localFrame > 35) return null;

  const flash = interpolate(localFrame, [0, 6, 28, 35], [0, 0.25, 0.08, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const scale = spring({
    config: { damping: 14, stiffness: 120 },
    fps,
    frame: localFrame,
  });

  const textOpacity = interpolate(localFrame, [4, 12, 28, 35], [0, 1, 1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill style={{ pointerEvents: "none" }}>
      <AbsoluteFill style={{ backgroundColor: PPD.surface, opacity: flash * 0.6 }} />
      <AbsoluteFill
        style={{
          alignItems: "center",
          display: "flex",
          justifyContent: "center",
        }}
      >
        <div
          style={{
            backgroundColor: PPD.surface,
            border: `1px solid ${PPD.border}`,
            borderRadius: PPD.radius.md,
            color: theme.ink,
            fontFamily: condensedFont,
            fontSize: 80,
            fontWeight: 700,
            letterSpacing: "0.06em",
            opacity: textOpacity,
            padding: "24px 48px",
            transform: `scale(${interpolate(scale, [0, 1], [1.2, 1])})`,
          }}
        >
          SET {setNumber}
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
}
