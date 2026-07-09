import {
  COURT_LENGTH,
  NET_Y,
  SERVICE_LINE_NEAR,
  SINGLES_HALF,
  createCourtScales,
  hasValidSpatialCoords,
} from "@courtviz/core";
import { enrichedShots, guestName, hostName, surface } from "@courtviz/data/fixtures";
import { Court } from "@courtviz/react";
import { getPlayerColor } from "@courtviz/themes";
import { spring, useCurrentFrame, useVideoConfig } from "remotion";
import { BroadcastShell } from "../components/broadcast-shell";
import { CourtCard } from "../components/court-card";
import { InsightCallout } from "../components/insight-callout";
import { MatchScoreBar } from "../components/match-score-bar";
import { SceneHeader } from "../components/scene-header";
import { darkCourt } from "../court-viz-utils";
import {
  guestFirstServe,
  guestServeDirections,
  hostFirstServe,
  hostServeDirections,
  sceneInsight,
} from "../match-stats";

const COURT_W = 540;
const COURT_H = 560;
const GAP = 48;
const TOTAL_W = COURT_W * 2 + GAP + 64;
const LEFT = (1920 - TOTAL_W) / 2;
const TOP = 220;

const SERVICE_BOX_TOLERANCE = 0.5;

/** Mirror serve bounce to near half using bounce position (not hitY). */
function normalizeServeBounce(bounceX: number, bounceY: number): [number, number] {
  if (bounceY > NET_Y) {
    return [-bounceX, COURT_LENGTH - bounceY];
  }
  return [bounceX, bounceY];
}

function isInServiceBox(x: number, y: number): boolean {
  return (
    y >= SERVICE_LINE_NEAR - SERVICE_BOX_TOLERANCE &&
    y <= NET_Y + SERVICE_BOX_TOLERANCE &&
    Math.abs(x) <= SINGLES_HALF + SERVICE_BOX_TOLERANCE
  );
}

function buildServes(player: string) {
  return enrichedShots
    .filter(
      (s) => s.player === player && s.stroke === "Serve" && hasValidSpatialCoords(s),
    )
    .filter((s) => {
      const [nx, ny] = normalizeServeBounce(s.bounceX!, s.bounceY!);
      const inBox = isInServiceBox(nx, ny);
      if (s.result === "In" && !inBox) return false;
      return true;
    })
    .map((s) => {
      const [nx, ny] = normalizeServeBounce(s.bounceX!, s.bounceY!);
      return {
        isFirst: s.type === "first_serve" || s.type === "First Serve",
        isIn: s.result === "In",
        x: nx,
        y: ny,
      };
    });
}

const hostServes = buildServes("host");
const guestServes = buildServes("guest");
const hostScales = createCourtScales({ half: "near", height: COURT_H, margin: 1.5, width: COURT_W });
const guestScales = createCourtScales({ half: "near", height: COURT_H, margin: 1.5, width: COURT_W });

export function ServePlacementScene() {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  return (
    <BroadcastShell>
      <SceneHeader
        subtitle={`First serve in · direction split · avg speed`}
        title="Serve Placement"
      />

      <div style={{ display: "flex", gap: GAP, left: LEFT, position: "absolute", top: TOP }}>
        <ServePanel
          color={getPlayerColor("host", darkCourt)}
          directions={hostServeDirections}
          firstServeIn={Math.round(hostFirstServe.rate * 100)}
          frame={frame}
          fps={fps}
          name={hostName}
          scales={hostScales}
          serves={hostServes}
          startFrame={15}
        />
        <ServePanel
          color={getPlayerColor("guest", darkCourt)}
          directions={guestServeDirections}
          firstServeIn={Math.round(guestFirstServe.rate * 100)}
          frame={frame}
          fps={fps}
          name={guestName}
          scales={guestScales}
          serves={guestServes}
          startFrame={22}
        />
      </div>

      <InsightCallout delay={50} text={sceneInsight("serve")} />
      <MatchScoreBar guestName={guestName} hostName={hostName} />
    </BroadcastShell>
  );
}

function ServePanel({
  color,
  directions,
  firstServeIn,
  frame,
  fps,
  name,
  scales,
  serves,
  startFrame,
}: {
  color: string;
  directions: { avgSpeedKmh: number; downTheT: number; outWide: number };
  firstServeIn: number;
  frame: number;
  fps: number;
  name: string;
  scales: ReturnType<typeof createCourtScales>;
  serves: ReturnType<typeof buildServes>;
  startFrame: number;
}) {
  const labelSpring = spring({
    config: { damping: 200 },
    delay: startFrame,
    fps,
    frame,
  });

  return (
    <CourtCard
      accentColor={color}
      label={name}
      labelOpacity={labelSpring}
      subtitle={`${firstServeIn}% in · ${directions.downTheT} T / ${directions.outWide} wide · ${directions.avgSpeedKmh} km/h`}
    >
      <Court half="near" height={COURT_H} surface={surface} theme={darkCourt} width={COURT_W}>
        {serves.map((serve, i) => (
          <ServeMarker
            color={color}
            frame={frame}
            fps={fps}
            index={i}
            isFirst={serve.isFirst}
            key={i}
            scales={scales}
            serve={serve}
            startFrame={startFrame}
          />
        ))}
      </Court>
    </CourtCard>
  );
}

function ServeMarker({
  color,
  frame,
  fps,
  index,
  isFirst,
  scales,
  serve,
  startFrame,
}: {
  color: string;
  frame: number;
  fps: number;
  index: number;
  isFirst: boolean;
  scales: ReturnType<typeof createCourtScales>;
  serve: { isIn: boolean; x: number; y: number };
  startFrame: number;
}) {
  const progress = spring({
    config: { damping: 200 },
    delay: index * 1.5,
    fps,
    frame: frame - startFrame,
  });
  if (progress <= 0) return null;

  const cx = scales.x(serve.x);
  const cy = scales.y(serve.y);
  const size = 10 * progress;
  const fillOpacity = (serve.isIn ? 0.95 : 0.45) * progress;

  if (isFirst) {
    return (
      <circle
        cx={cx}
        cy={cy}
        fill={serve.isIn ? color : "none"}
        opacity={fillOpacity}
        r={size}
        stroke={serve.isIn ? darkCourt.haloColor : color}
        strokeWidth={serve.isIn ? 1 : 2}
      />
    );
  }

  const h = size * 1.15;
  const path = `M${cx},${cy - h}L${cx - size * 0.95},${cy + h * 0.55}L${cx + size * 0.95},${cy + h * 0.55}Z`;
  return (
    <path
      d={path}
      fill={serve.isIn ? color : "none"}
      opacity={fillOpacity}
      stroke={serve.isIn ? darkCourt.haloColor : color}
      strokeWidth={serve.isIn ? 1 : 2}
    />
  );
}
