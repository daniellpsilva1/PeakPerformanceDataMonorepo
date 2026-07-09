import { guestName, hostName, matchDate, sets, surface } from "@courtviz/data/fixtures";
import { Court } from "@courtviz/react";
import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { bodyFont, condensedFont } from "../fonts";
import { formatMatchResult, formatSetScoreDetailed } from "../match-stats";
import { PPD, theme } from "../ppd-tokens";

function formatDate(dateStr: string): string {
  if (!dateStr) return "April 2025";
  const date = new Date(dateStr);
  if (Number.isNaN(date.getTime())) return dateStr;
  return date.toLocaleDateString("en-US", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

export function SocialTitleScene() {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const courtOpacity = interpolate(frame, [0, 30], [0, 0.12], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const eyebrowOpacity = spring({ config: { damping: 200 }, fps, frame });
  const hostSlide = spring({ config: { damping: 200 }, delay: 8, fps, frame });
  const guestSlide = spring({ config: { damping: 200 }, delay: 16, fps, frame });
  const scoreOpacity = spring({ config: { damping: 200 }, delay: 28, fps, frame });
  const metaOpacity = interpolate(frame, [40, 60], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const hostSetsWon = sets.filter((s) => s.hostScore > s.guestScore).length;
  const surfaceLabel = surface.charAt(0).toUpperCase() + surface.slice(1);

  return (
    <AbsoluteFill style={{ backgroundColor: theme.background, overflow: "hidden" }}>
      <AbsoluteFill
        style={{
          alignItems: "center",
          display: "flex",
          justifyContent: "center",
          opacity: courtOpacity,
          transform: "scale(1.05)",
        }}
      >
        <Court half="full" height={640} surface={surface} theme={theme} width={480} />
      </AbsoluteFill>

      <AbsoluteFill
        style={{
          background: `radial-gradient(ellipse 80% 50% at center, transparent 0%, ${theme.background} 72%)`,
        }}
      />

      <AbsoluteFill
        style={{
          alignItems: "center",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          padding: "0 48px",
        }}
      >
        <div
          style={{
            color: PPD.textMuted,
            fontFamily: bodyFont,
            fontSize: 12,
            fontWeight: 500,
            letterSpacing: "0.3em",
            marginBottom: 20,
            opacity: eyebrowOpacity,
            textTransform: "uppercase",
          }}
        >
          Match Recap
        </div>

        <div
          style={{
            color: theme.playerHost,
            fontFamily: condensedFont,
            fontSize: 44,
            fontWeight: 700,
            letterSpacing: "0.03em",
            lineHeight: 1,
            opacity: hostSlide,
            textAlign: "center",
            textTransform: "uppercase",
            transform: `translateY(${(1 - hostSlide) * -20}px)`,
          }}
        >
          {hostName}
        </div>

        <div
          style={{
            color: PPD.textMuted,
            fontFamily: condensedFont,
            fontSize: 18,
            fontWeight: 600,
            letterSpacing: "0.3em",
            margin: "16px 0",
            opacity: interpolate(frame, [14, 28], [0, 1], {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
            }),
          }}
        >
          VS
        </div>

        <div
          style={{
            color: theme.playerGuest,
            fontFamily: condensedFont,
            fontSize: 44,
            fontWeight: 700,
            letterSpacing: "0.03em",
            lineHeight: 1,
            opacity: guestSlide,
            textAlign: "center",
            textTransform: "uppercase",
            transform: `translateY(${(1 - guestSlide) * 20}px)`,
          }}
        >
          {guestName}
        </div>

        <div
          style={{
            backgroundColor: PPD.surface,
            border: `1px solid ${PPD.border}`,
            borderRadius: PPD.radius.md,
            marginTop: 32,
            opacity: scoreOpacity,
            padding: "16px 36px",
            textAlign: "center",
          }}
        >
          <div
            style={{
              color: theme.ink,
              fontFamily: condensedFont,
              fontSize: 32,
              fontWeight: 700,
              letterSpacing: "0.04em",
            }}
          >
            {formatSetScoreDetailed()}
          </div>
          <div
            style={{
              color: hostSetsWon === sets.length ? theme.playerHost : theme.playerGuest,
              fontFamily: bodyFont,
              fontSize: 15,
              marginTop: 6,
            }}
          >
            {formatMatchResult()}
          </div>
        </div>

        <div
          style={{
            color: PPD.textMuted,
            fontFamily: bodyFont,
            fontSize: 12,
            letterSpacing: "0.1em",
            marginTop: 24,
            opacity: metaOpacity,
            textTransform: "uppercase",
          }}
        >
          {surfaceLabel} · {formatDate(matchDate)}
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
}
