import { guestName, hostName } from "@courtviz/data/fixtures";
import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { bodyFont, condensedFont } from "../fonts";
import {
  closingLine,
  formatMatchResult,
  formatSetScoreDetailed,
  guestWinRate,
  hostWinRate,
} from "../match-stats";
import { PPD, theme } from "../ppd-tokens";

export function OutroScene() {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const logoSpring = spring({ config: { damping: 200 }, fps, frame });
  const scoreSpring = spring({ config: { damping: 200 }, delay: 14, fps, frame });
  const statsSpring = spring({ config: { damping: 200 }, delay: 28, fps, frame });
  const brandSpring = spring({ config: { damping: 200 }, delay: 42, fps, frame });

  const fadeOut = interpolate(frame, [120, 150], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill style={{ backgroundColor: theme.background, opacity: fadeOut, overflow: "hidden" }}>
      <AbsoluteFill
        style={{
          background: `radial-gradient(ellipse at center, ${theme.playerGuest}10 0%, transparent 55%)`,
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
            opacity: logoSpring,
            textAlign: "center",
            transform: `scale(${interpolate(logoSpring, [0, 1], [0.96, 1])})`,
          }}
        >
          <div
            style={{
              color: theme.ink,
              fontFamily: condensedFont,
              fontSize: 52,
              fontWeight: 700,
              letterSpacing: "0.06em",
              textTransform: "uppercase",
            }}
          >
            Peak Performance Data
          </div>
          <div
            style={{
              color: PPD.textMuted,
              fontFamily: bodyFont,
              fontSize: 14,
              letterSpacing: "0.2em",
              marginTop: 8,
              textTransform: "uppercase",
            }}
          >
            courtviz
          </div>
        </div>

        <div
          style={{
            backgroundColor: PPD.surface,
            border: `1px solid ${PPD.border}`,
            borderRadius: PPD.radius.md,
            marginTop: 40,
            opacity: scoreSpring,
            padding: "24px 56px",
            textAlign: "center",
          }}
        >
          <div
            style={{
              color: theme.ink,
              fontFamily: condensedFont,
              fontSize: 36,
              fontWeight: 700,
              letterSpacing: "0.04em",
            }}
          >
            {formatSetScoreDetailed()}
          </div>
          <div
            style={{
              color: theme.playerHost,
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
            display: "flex",
            gap: 40,
            marginTop: 32,
            opacity: statsSpring,
          }}
        >
          <MiniStat label={hostName} value={`${Math.round(hostWinRate.rate * 100)}% pts`} />
          <MiniStat label={guestName} value={`${Math.round(guestWinRate.rate * 100)}% pts`} />
        </div>

        <div
          style={{
            color: PPD.textMuted,
            fontFamily: bodyFont,
            fontSize: 14,
            marginTop: 20,
            maxWidth: 560,
            opacity: statsSpring,
            textAlign: "center",
          }}
        >
          {closingLine()}
        </div>

        <div
          style={{
            backgroundColor: PPD.accent,
            height: 2,
            margin: "28px 0",
            opacity: brandSpring,
            width: interpolate(brandSpring, [0, 1], [0, 200]),
          }}
        />

        <div
          style={{
            color: PPD.textMuted,
            fontFamily: bodyFont,
            fontSize: 13,
            letterSpacing: "0.12em",
            opacity: brandSpring,
            textTransform: "uppercase",
          }}
        >
          Analytics for competitive tennis
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ textAlign: "center" }}>
      <div style={{ color: theme.ink, fontFamily: condensedFont, fontSize: 28, fontWeight: 700 }}>
        {value}
      </div>
      <div style={{ color: PPD.textMuted, fontFamily: bodyFont, fontSize: 13, marginTop: 4 }}>
        {label}
      </div>
    </div>
  );
}
