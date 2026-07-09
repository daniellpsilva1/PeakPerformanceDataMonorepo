import { enrichedShots, guestName, hostName, surface } from "@courtviz/data/fixtures";
import { Court } from "@courtviz/react";
import { getPlayerColor } from "@courtviz/themes";
import { interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { BroadcastShell } from "../components/broadcast-shell";
import { CourtCard } from "../components/court-card";
import { InsightCallout } from "../components/insight-callout";
import { MatchScoreBar } from "../components/match-score-bar";
import { SceneHeader } from "../components/scene-header";
import {
  buildPlayerFlows,
  courtPixelBounds,
  curvedPath,
  darkCourt,
  defaultCourtScales,
  getEfficiencyColor,
} from "../court-viz-utils";
import { bodyFont } from "../fonts";
import { sceneInsight } from "../match-stats";

const COURT_W = 540;
const COURT_H = 560;
const GAP = 48;
const TOTAL_W = COURT_W * 2 + GAP + 64;
const LEFT = (1920 - TOTAL_W) / 2;
const TOP = 220;

const hostFlows = buildPlayerFlows(enrichedShots, "host");
const guestFlows = buildPlayerFlows(enrichedShots, "guest");
const hostScales = defaultCourtScales(COURT_W, COURT_H, "full");
const guestScales = defaultCourtScales(COURT_W, COURT_H, "full");
const hostBounds = courtPixelBounds(hostScales, "full");
const guestBounds = courtPixelBounds(guestScales, "full");
const maxFlowCount = Math.max(
  ...hostFlows.map((f) => f.count),
  ...guestFlows.map((f) => f.count),
  1,
);

export function ShotTrajectoriesScene() {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const legendOpacity = interpolate(frame, [180, 210], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <BroadcastShell>
      <SceneHeader
        subtitle="Top patterns · arrow = ball direction · color = win rate"
        title="Shot Patterns"
      />

      <div style={{ display: "flex", gap: GAP, left: LEFT, position: "absolute", top: TOP }}>
        <FlowPanel
          bounds={hostBounds}
          color={getPlayerColor("host", darkCourt)}
          flows={hostFlows}
          frame={frame}
          fps={fps}
          name={hostName}
          scales={hostScales}
          sideDelay={14}
        />
        <FlowPanel
          bounds={guestBounds}
          color={getPlayerColor("guest", darkCourt)}
          flows={guestFlows}
          frame={frame}
          fps={fps}
          name={guestName}
          scales={guestScales}
          sideDelay={26}
        />
      </div>

      <div
        style={{
          bottom: 200,
          color: darkCourt.inkMuted,
          fontFamily: bodyFont,
          fontSize: 16,
          left: 80,
          opacity: legendOpacity,
          position: "absolute",
        }}
      >
        Top 8 patterns per player
      </div>

      <div style={{ bottom: 200, opacity: legendOpacity, position: "absolute", right: 80 }}>
        <svg height={36} width={260}>
          <defs>
            <linearGradient id="flow-grad-dual" x1="0%" x2="100%" y1="0%" y2="0%">
              <stop offset="0%" stopColor={darkCourt.diverging.low} />
              <stop offset="50%" stopColor={darkCourt.diverging.midLight} />
              <stop offset="100%" stopColor={darkCourt.diverging.peak} />
            </linearGradient>
          </defs>
          <rect fill="url(#flow-grad-dual)" height={10} rx={2} width={260} x={0} y={0} />
          <text fill={darkCourt.inkMuted} fontSize={11} x={0} y={26}>
            Low win rate
          </text>
          <text fill={darkCourt.inkMuted} fontSize={11} textAnchor="end" x={260} y={26}>
            High win rate
          </text>
        </svg>
      </div>

      <InsightCallout delay={60} text={sceneInsight("trajectories")} />
      <MatchScoreBar guestName={guestName} hostName={hostName} />
    </BroadcastShell>
  );
}

function FlowPanel({
  bounds,
  color,
  flows,
  frame,
  fps,
  name,
  scales,
  sideDelay,
}: {
  bounds: ReturnType<typeof courtPixelBounds>;
  color: string;
  flows: ReturnType<typeof buildPlayerFlows>;
  frame: number;
  fps: number;
  name: string;
  scales: ReturnType<typeof defaultCourtScales>;
  sideDelay: number;
}) {
  const labelSpring = spring({
    config: { damping: 200 },
    delay: sideDelay,
    fps,
    frame,
  });

  return (
    <CourtCard accentColor={color} label={name} labelOpacity={labelSpring}>
      <Court half="full" height={COURT_H} surface={surface} theme={darkCourt} width={COURT_W}>
        {flows.map((flow, index) => {
          const progress = spring({
            config: { damping: 200 },
            delay: sideDelay + index * 2.5,
            fps,
            frame,
          });
          const strokeW = Math.max(1.2, 7 * Math.sqrt(flow.count / maxFlowCount)) * progress;
          const x1 = scales.x(flow.fromX);
          const y1 = scales.y(flow.fromY);
          const x2 = scales.x(flow.toX);
          const y2 = scales.y(flow.toY);
          const d = curvedPath(x1, y1, x2, y2, 0.07, bounds);
          const flowColor = getEfficiencyColor(flow.winRate, true);

          return (
            <g key={index} opacity={0.82 * progress}>
              <path
                d={d}
                fill="none"
                stroke={flowColor}
                strokeLinecap="round"
                strokeWidth={strokeW}
              />
              <circle
                cx={x1}
                cy={y1}
                fill="none"
                r={4 * progress}
                stroke={color}
                strokeWidth={1.5}
              />
              <circle
                cx={x2}
                cy={y2}
                fill={flowColor}
                r={3.5 * progress}
                stroke={darkCourt.haloColor}
                strokeWidth={0.5}
              />
            </g>
          );
        })}
      </Court>
    </CourtCard>
  );
}
