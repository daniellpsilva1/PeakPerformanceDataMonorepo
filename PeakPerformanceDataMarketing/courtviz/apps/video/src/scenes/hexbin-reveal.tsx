import { enrichedShots, guestName, hostName, surface } from "@courtviz/data/fixtures";
import { Court } from "@courtviz/react";
import { getPlayerColor } from "@courtviz/themes";
import { spring, useCurrentFrame, useVideoConfig } from "remotion";
import { BroadcastShell } from "../components/broadcast-shell";
import { CourtCard } from "../components/court-card";
import { CourtZoom } from "../components/court-zoom";
import { InsightCallout } from "../components/insight-callout";
import { MatchScoreBar } from "../components/match-score-bar";
import { SceneHeader } from "../components/scene-header";
import { SCENE_DURATIONS } from "../constants";
import {
  buildPlayerHexbins,
  darkCourt,
  darkStops,
  defaultCourtScales,
  getEfficiencyColor,
} from "../court-viz-utils";
import { condensedFont } from "../fonts";
import { sceneInsight } from "../match-stats";

const COURT_W = 540;
const COURT_H = 560;
const GAP = 48;
const TOTAL_W = COURT_W * 2 + GAP + 64;
const LEFT = (1920 - TOTAL_W) / 2;
const TOP = 220;

const hostHexbins = buildPlayerHexbins(enrichedShots, "host");
const guestHexbins = buildPlayerHexbins(enrichedShots, "guest");
const hostScales = defaultCourtScales(COURT_W, COURT_H, "near");
const guestScales = defaultCourtScales(COURT_W, COURT_H, "near");
const maxCount = Math.max(
  ...hostHexbins.map((h) => h.count),
  ...guestHexbins.map((h) => h.count),
  1,
);

export function HexbinRevealScene() {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  return (
    <BroadcastShell>
      <SceneHeader subtitle="Size = frequency · color = win rate" title="Court Dominance" />

      <div style={{ left: LEFT, position: "absolute", top: TOP }}>
        <CourtZoom durationInFrames={SCENE_DURATIONS.hexbinReveal}>
          <div style={{ display: "flex", gap: GAP }}>
            <PlayerPanel
              color={getPlayerColor("host", darkCourt)}
              frame={frame}
              fps={fps}
              hexbins={hostHexbins}
              name={hostName}
              scales={hostScales}
              sideDelay={12}
            />
            <PlayerPanel
              color={getPlayerColor("guest", darkCourt)}
              frame={frame}
              fps={fps}
              hexbins={guestHexbins}
              name={guestName}
              scales={guestScales}
              sideDelay={28}
            />
          </div>
        </CourtZoom>
      </div>

      <LegendBar />
      <InsightCallout delay={50} text={sceneInsight("hexbin")} />
      <MatchScoreBar guestName={guestName} hostName={hostName} />
    </BroadcastShell>
  );
}

function PlayerPanel({
  color,
  frame,
  fps,
  hexbins,
  name,
  scales,
  sideDelay,
}: {
  color: string;
  frame: number;
  fps: number;
  hexbins: ReturnType<typeof buildPlayerHexbins>;
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
      <Court half="near" height={COURT_H} surface={surface} theme={darkCourt} width={COURT_W}>
        {hexbins.map((hex, index) => {
          const progress = spring({
            config: { damping: 200 },
            delay: sideDelay + index * 2,
            fps,
            frame,
          });
          const cx = scales.x(hex.cx);
          const cy = scales.y(hex.cy);
          const points = hex.vertices
            .map(([vx, vy]) => {
              const px = scales.x(vx);
              const py = scales.y(vy);
              return `${cx + (px - cx) * progress},${cy + (py - cy) * progress}`;
            })
            .join(" ");

          return (
            <g key={index} opacity={progress}>
              <polygon fill="none" opacity={0.4} points={points} stroke={darkCourt.haloColor} strokeWidth={1.5} />
              <polygon
                fill={getEfficiencyColor(hex.value, true)}
                opacity={0.88}
                points={points}
                stroke={darkCourt.ink}
                strokeWidth={0.4}
              />
              {hex.count >= 4 && progress > 0.85 ? (
                <text
                  dominantBaseline="middle"
                  fill={darkCourt.haloColor}
                  fontFamily={condensedFont}
                  fontSize={11}
                  fontWeight={700}
                  textAnchor="middle"
                  x={cx}
                  y={cy}
                >
                  {hex.count}
                </text>
              ) : null}
            </g>
          );
        })}
      </Court>
    </CourtCard>
  );
}

function LegendBar() {
  return (
    <div
      style={{
        bottom: 190,
        display: "flex",
        gap: 40,
        left: "50%",
        position: "absolute",
        transform: "translateX(-50%)",
      }}
    >
      <svg height={44} width={300}>
        <defs>
          <linearGradient id="hex-eff-grad" x1="0%" x2="100%" y1="0%" y2="0%">
            {darkStops.map(([offset, color], i) => (
              <stop key={i} offset={`${offset * 100}%`} stopColor={color} />
            ))}
          </linearGradient>
        </defs>
        <text fill={darkCourt.ink} fontSize={12} textAnchor="middle" x={150} y={10}>
          Win rate
        </text>
        <rect fill="url(#hex-eff-grad)" height={12} rx={2} width={300} x={0} y={16} />
        <text fill={darkCourt.inkMuted} fontSize={11} x={0} y={38}>
          Cold
        </text>
        <text fill={darkCourt.inkMuted} fontSize={11} textAnchor="end" x={300} y={38}>
          Hot
        </text>
      </svg>
      <svg height={44} width={140}>
        <text fill={darkCourt.ink} fontSize={12} textAnchor="middle" x={70} y={10}>
          Frequency
        </text>
        <circle cx={25} cy={28} fill={darkCourt.playerHost} opacity={0.5} r={5} />
        <circle cx={70} cy={28} fill={darkCourt.playerHost} r={9} />
        <circle cx={115} cy={28} fill={darkCourt.playerHost} r={13} />
        <text fill={darkCourt.inkMuted} fontSize={10} textAnchor="middle" x={70} y={42}>
          max {maxCount}
        </text>
      </svg>
    </div>
  );
}
