import { guestName, hostName, momentumPoints } from "@courtviz/data/fixtures";
import { MomentumChart } from "@courtviz/react";
import { getPlayerColor } from "@courtviz/themes";
import { interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { BroadcastShell } from "../components/broadcast-shell";
import { InsightCallout } from "../components/insight-callout";
import { MatchScoreBar } from "../components/match-score-bar";
import { SceneHeader } from "../components/scene-header";
import { theme } from "../court-viz-utils";
import { bodyFont, condensedFont } from "../fonts";
import { formatMatchResult, guestWinRate, hostWinRate, sceneInsight } from "../match-stats";

const CHART_WIDTH = 1640;
const CHART_HEIGHT = 540;
const CHART_LEFT = (1920 - CHART_WIDTH) / 2;
const CHART_TOP = 210;

const hostColor = getPlayerColor("host", theme);
const guestColor = getPlayerColor("guest", theme);

export function MomentumScene() {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const revealWidth = interpolate(frame, [15, 220], [0, CHART_WIDTH], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const labelOpacity = spring({ config: { damping: 200 }, delay: 25, fps, frame });
  const resultOpacity = spring({ config: { damping: 200 }, delay: 210, fps, frame });

  return (
    <BroadcastShell>
      <SceneHeader
        subtitle={`${hostName} ${Math.round(hostWinRate.rate * 100)}% · ${guestName} ${Math.round(guestWinRate.rate * 100)}%`}
        title="Match Momentum"
      />

      <div
        style={{
          left: CHART_LEFT,
          overflow: "hidden",
          position: "absolute",
          top: CHART_TOP,
          width: revealWidth,
        }}
      >
        <MomentumChart
          height={CHART_HEIGHT}
          hostPlayer="host"
          points={momentumPoints}
          showBreakPoints
          showSetBoundaries
          showSetLabels
          theme={theme}
          width={CHART_WIDTH}
        />
      </div>

      {revealWidth >= CHART_WIDTH - 2 ? (
        <div
          style={{
            left: CHART_LEFT + CHART_WIDTH - 300,
            opacity: resultOpacity,
            position: "absolute",
            top: CHART_TOP + 16,
          }}
        >
          <div
            style={{
              backdropFilter: "blur(8px)",
              backgroundColor: "rgba(0,0,0,0.7)",
              border: `1px solid ${theme.inkMuted}44`,
              borderRadius: 6,
              color: theme.ink,
              fontFamily: condensedFont,
              fontSize: 15,
              fontWeight: 700,
              padding: "10px 16px",
            }}
          >
            {formatMatchResult()}
          </div>
        </div>
      ) : null}

      <div
        style={{
          bottom: 200,
          display: "flex",
          gap: 40,
          left: CHART_LEFT,
          opacity: labelOpacity,
          position: "absolute",
        }}
      >
        <PlayerLabel color={hostColor} name={hostName} />
        <PlayerLabel color={guestColor} name={guestName} />
        <span style={{ color: theme.inkMuted, fontFamily: bodyFont, fontSize: 16 }}>
          ● Break points
        </span>
      </div>

      <InsightCallout delay={80} text={sceneInsight("momentum")} />
      <MatchScoreBar guestName={guestName} hostName={hostName} />
    </BroadcastShell>
  );
}

function PlayerLabel({ color, name }: { color: string; name: string }) {
  return (
    <div style={{ alignItems: "center", display: "flex", gap: 10 }}>
      <div style={{ backgroundColor: color, borderRadius: 2, height: 14, width: 14 }} />
      <span style={{ color: theme.ink, fontFamily: bodyFont, fontSize: 18 }}>{name}</span>
    </div>
  );
}
