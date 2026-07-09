import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";
import { PPD, theme } from "../ppd-tokens";

type BroadcastShellProps = {
  children: React.ReactNode;
};

export function BroadcastShell({ children }: BroadcastShellProps) {
  return (
    <AbsoluteFill style={{ backgroundColor: theme.background }}>
      <AmbientBackground />
      {children}
    </AbsoluteFill>
  );
}

function AmbientBackground() {
  const frame = useCurrentFrame();
  const drift = interpolate(frame, [0, 300], [0, 24], {
    extrapolateRight: "extend",
  });

  return (
    <AbsoluteFill style={{ overflow: "hidden", pointerEvents: "none" }}>
      <div
        style={{
          background: `radial-gradient(circle at 18% 22%, ${theme.playerGuest}12 0%, transparent 50%)`,
          height: "100%",
          left: -drift,
          position: "absolute",
          top: 0,
          width: "55%",
        }}
      />
      <div
        style={{
          background: `radial-gradient(circle at 82% 78%, ${theme.playerHost}10 0%, transparent 50%)`,
          height: "100%",
          position: "absolute",
          right: -drift * 0.5,
          top: 0,
          width: "55%",
        }}
      />
      <div
        style={{
          backgroundImage: `linear-gradient(${PPD.border}55 1px, transparent 1px), linear-gradient(90deg, ${PPD.border}55 1px, transparent 1px)`,
          backgroundSize: "72px 72px",
          height: "120%",
          left: -36,
          opacity: 0.18,
          position: "absolute",
          top: -36,
          transform: `translateY(${drift * 0.1}px)`,
          width: "120%",
        }}
      />
    </AbsoluteFill>
  );
}
