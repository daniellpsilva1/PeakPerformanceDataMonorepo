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

export function TitleScene() {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const courtOpacity = interpolate(frame, [0, 40], [0, 0.14], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const courtScale = interpolate(frame, [0, 150], [1.08, 1.14], {
    extrapolateRight: "clamp",
  });

  const eyebrowOpacity = spring({ config: { damping: 200 }, fps, frame });
  const hostSlide = spring({ config: { damping: 200 }, delay: 10, fps, frame });
  const guestSlide = spring({ config: { damping: 200 }, delay: 18, fps, frame });
  const scoreOpacity = spring({ config: { damping: 200 }, delay: 35, fps, frame });
  const metaOpacity = interpolate(frame, [55, 80], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const hostSetsWon = sets.filter((s) => s.hostScore > s.guestScore).length;
  const surfaceLabel = surface.charAt(0).toUpperCase() + surface.slice(1);

  return (
    <AbsoluteFill style={{ backgroundColor: theme.background, overflow: "hidden" }}>
      <AbsoluteFill
        style={{
          background: `radial-gradient(circle at 20% 30%, ${theme.playerGuest}10 0%, transparent 45%)`,
          height: "100%",
          position: "absolute",
          width: "100%",
        }}
      />
      <AbsoluteFill
        style={{
          background: `radial-gradient(circle at 80% 70%, ${theme.playerHost}0c 0%, transparent 45%)`,
          height: "100%",
          position: "absolute",
          width: "100%",
        }}
      />

      <AbsoluteFill
        style={{
          alignItems: "center",
          display: "flex",
          justifyContent: "center",
          opacity: courtOpacity,
          transform: `scale(${courtScale})`,
        }}
      >
        <Court half="full" height={900} surface={surface} theme={theme} width={720} />
      </AbsoluteFill>

      <AbsoluteFill
        style={{
          background: `radial-gradient(ellipse 70% 60% at center, transparent 0%, ${theme.background} 78%)`,
        }}
      />

      <AbsoluteFill
        style={{
          alignItems: "center",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
        }}
      >
        <div
          style={{
            color: PPD.textMuted,
            fontFamily: bodyFont,
            fontSize: 13,
            fontWeight: 500,
            letterSpacing: "0.35em",
            marginBottom: 24,
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
            fontSize: 72,
            fontWeight: 700,
            letterSpacing: "0.04em",
            lineHeight: 0.95,
            opacity: hostSlide,
            textTransform: "uppercase",
            transform: `translateX(${(1 - hostSlide) * -40}px)`,
          }}
        >
          {hostName}
        </div>

        <div
          style={{
            color: PPD.textMuted,
            fontFamily: condensedFont,
            fontSize: 22,
            fontWeight: 600,
            letterSpacing: "0.35em",
            margin: "20px 0",
            opacity: interpolate(frame, [20, 35], [0, 1], {
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
            fontSize: 72,
            fontWeight: 700,
            letterSpacing: "0.04em",
            lineHeight: 0.95,
            opacity: guestSlide,
            textTransform: "uppercase",
            transform: `translateX(${(1 - guestSlide) * 40}px)`,
          }}
        >
          {guestName}
        </div>

        <div
          style={{
            backgroundColor: PPD.surface,
            border: `1px solid ${PPD.border}`,
            borderRadius: PPD.radius.md,
            marginTop: 44,
            opacity: scoreOpacity,
            padding: "20px 48px",
            textAlign: "center",
          }}
        >
          <div
            style={{
              color: theme.ink,
              fontFamily: condensedFont,
              fontSize: 48,
              fontWeight: 700,
              letterSpacing: "0.06em",
            }}
          >
            {formatSetScoreDetailed()}
          </div>
          <div
            style={{
              color: hostSetsWon === sets.length ? theme.playerHost : theme.playerGuest,
              fontFamily: bodyFont,
              fontSize: 18,
              marginTop: 8,
            }}
          >
            {formatMatchResult()}
          </div>
        </div>

        <div
          style={{
            color: PPD.textMuted,
            fontFamily: bodyFont,
            fontSize: 14,
            letterSpacing: "0.12em",
            marginTop: 28,
            opacity: metaOpacity,
            textTransform: "uppercase",
          }}
        >
          {surfaceLabel} · {formatDate(matchDate)}
        </div>

        <div
          style={{
            color: PPD.textMuted,
            fontFamily: bodyFont,
            fontSize: 11,
            letterSpacing: "0.1em",
            marginTop: 16,
            opacity: metaOpacity,
            textTransform: "uppercase",
          }}
        >
          Peak Performance Data
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
}
