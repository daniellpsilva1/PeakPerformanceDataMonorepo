import { guestName, hostName, momentumPoints } from "@courtviz/data/fixtures";
import { MomentumChart } from "@courtviz/react";
import { getPlayerColor } from "@courtviz/themes";
import { interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { BroadcastShell } from "../components/broadcast-shell";
import { InsightCallout } from "../components/insight-callout";
import { MatchScoreBar } from "../components/match-score-bar";
import { SceneHeader } from "../components/scene-header";
import { theme } from "../court-viz-utils";
import { bodyFont } from "../fonts";
import { hostWinRate, guestWinRate, sceneInsight } from "../match-stats";

const CHART_W = 980;
const CHART_H = 520;
const LEFT = (1080 - CHART_W) / 2;

export function SocialMomentumScene() {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const reveal = interpolate(frame, [12, 200], [0, CHART_W], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const labels = spring({ config: { damping: 200 }, delay: 20, fps, frame });
  const hostColor = getPlayerColor("host", theme);
  const guestColor = getPlayerColor("guest", theme);

  return (
    <BroadcastShell>
      <SceneHeader
        subtitle={`${Math.round(hostWinRate.rate * 100)}% vs ${Math.round(guestWinRate.rate * 100)}% points won`}
        title="Momentum"
      />

      <div
        style={{
          left: LEFT,
          overflow: "hidden",
          position: "absolute",
          top: 280,
          width: reveal,
        }}
      >
        <MomentumChart
          height={CHART_H}
          hostPlayer="host"
          points={momentumPoints}
          showBreakPoints
          showSetBoundaries
          theme={theme}
          width={CHART_W}
        />
      </div>

      <div
        style={{
          bottom: 200,
          display: "flex",
          gap: 32,
          justifyContent: "center",
          left: 0,
          opacity: labels,
          position: "absolute",
          right: 0,
        }}
      >
        <span style={{ color: hostColor, fontFamily: bodyFont, fontSize: 16 }}>{hostName}</span>
        <span style={{ color: guestColor, fontFamily: bodyFont, fontSize: 16 }}>{guestName}</span>
      </div>

      <InsightCallout delay={60} text={sceneInsight("momentum")} />
      <MatchScoreBar guestName={guestName} hostName={hostName} />
    </BroadcastShell>
  );
}
