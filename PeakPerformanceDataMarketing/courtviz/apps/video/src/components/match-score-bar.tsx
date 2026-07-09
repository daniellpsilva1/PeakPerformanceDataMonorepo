import { interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { bodyFont, condensedFont } from "../fonts";
import { formatSetScore } from "../match-stats";
import { PPD, theme } from "../ppd-tokens";

type MatchScoreBarProps = {
  guestName: string;
  hostName: string;
};

export function MatchScoreBar({ guestName, hostName }: MatchScoreBarProps) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const slideIn = spring({
    config: { damping: 200 },
    delay: 10,
    fps,
    frame,
  });

  return (
    <div
      style={{
        bottom: 40,
        left: "50%",
        opacity: interpolate(slideIn, [0, 1], [0, 1]),
        position: "absolute",
        transform: `translateX(-50%) translateY(${(1 - slideIn) * 20}px)`,
        zIndex: 30,
      }}
    >
      <div
        style={{
          alignItems: "center",
          backgroundColor: PPD.surface,
          border: `1px solid ${PPD.border}`,
          borderRadius: PPD.radius.md,
          boxShadow: "0 8px 24px rgba(0,0,0,0.25)",
          display: "flex",
          gap: 24,
          padding: "14px 28px",
        }}
      >
        <span
          style={{
            color: theme.playerHost,
            fontFamily: condensedFont,
            fontSize: 18,
            fontWeight: 700,
            textTransform: "uppercase",
          }}
        >
          {hostName}
        </span>
        <span
          style={{
            color: theme.ink,
            fontFamily: condensedFont,
            fontSize: 24,
            fontWeight: 700,
            letterSpacing: "0.04em",
          }}
        >
          {formatSetScore()}
        </span>
        <span
          style={{
            color: theme.playerGuest,
            fontFamily: condensedFont,
            fontSize: 18,
            fontWeight: 700,
            textTransform: "uppercase",
          }}
        >
          {guestName}
        </span>
        <div
          style={{
            backgroundColor: PPD.border,
            height: 28,
            width: 1,
          }}
        />
        <span
          style={{
            color: PPD.textMuted,
            fontFamily: bodyFont,
            fontSize: 11,
            fontWeight: 500,
            letterSpacing: "0.08em",
            textTransform: "uppercase",
          }}
        >
          Peak Performance Data
        </span>
      </div>
    </div>
  );
}
