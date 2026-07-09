import { enrichedShots, guestName, hostName, surface } from "@courtviz/data/fixtures";
import { Court } from "@courtviz/react";
import { getPlayerColor } from "@courtviz/themes";
import { spring, useCurrentFrame, useVideoConfig } from "remotion";
import { BroadcastShell } from "../components/broadcast-shell";
import { InsightCallout } from "../components/insight-callout";
import { MatchScoreBar } from "../components/match-score-bar";
import { SceneHeader } from "../components/scene-header";
import {
  buildPlayerHexbins,
  darkCourt,
  defaultCourtScales,
  getEfficiencyColor,
} from "../court-viz-utils";
import { condensedFont } from "../fonts";
import { sceneInsight } from "../match-stats";

const COURT_W = 480;
const COURT_H = 520;
const LEFT = (1080 - COURT_W) / 2;

const hostHexbins = buildPlayerHexbins(enrichedShots, "host");
const guestHexbins = buildPlayerHexbins(enrichedShots, "guest");
const hostScales = defaultCourtScales(COURT_W, COURT_H, "near");
const guestScales = defaultCourtScales(COURT_W, COURT_H, "near");

export function SocialHexbinScene() {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  return (
    <BroadcastShell>
      <SceneHeader subtitle="Frequency & efficiency" title="Court Heatmaps" />

      <div style={{ left: LEFT, position: "absolute", top: 220 }}>
        <PlayerBlock
          color={getPlayerColor("host", darkCourt)}
          frame={frame}
          fps={fps}
          hexbins={hostHexbins}
          name={hostName}
          scales={hostScales}
          startDelay={12}
        />
      </div>

      <div style={{ left: LEFT, position: "absolute", top: 900 }}>
        <PlayerBlock
          color={getPlayerColor("guest", darkCourt)}
          frame={frame}
          fps={fps}
          hexbins={guestHexbins}
          name={guestName}
          scales={guestScales}
          startDelay={30}
        />
      </div>

      <InsightCallout delay={40} text={sceneInsight("hexbin")} />
      <MatchScoreBar guestName={guestName} hostName={hostName} />
    </BroadcastShell>
  );
}

function PlayerBlock({
  color,
  frame,
  fps,
  hexbins,
  name,
  scales,
  startDelay,
}: {
  color: string;
  frame: number;
  fps: number;
  hexbins: ReturnType<typeof buildPlayerHexbins>;
  name: string;
  scales: ReturnType<typeof defaultCourtScales>;
  startDelay: number;
}) {
  const label = spring({ config: { damping: 200 }, delay: startDelay, fps, frame });

  return (
    <div style={{ opacity: label }}>
      <div
        style={{
          color,
          fontFamily: condensedFont,
          fontSize: 22,
          fontWeight: 700,
          marginBottom: 8,
          textTransform: "uppercase",
        }}
      >
        {name}
      </div>
      <Court half="near" height={COURT_H} surface={surface} theme={darkCourt} width={COURT_W}>
        {hexbins.map((hex, index) => {
          const progress = spring({
            config: { damping: 200 },
            delay: startDelay + index * 2,
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
            <polygon
              fill={getEfficiencyColor(hex.value, true)}
              key={index}
              opacity={0.85 * progress}
              points={points}
            />
          );
        })}
      </Court>
    </div>
  );
}
