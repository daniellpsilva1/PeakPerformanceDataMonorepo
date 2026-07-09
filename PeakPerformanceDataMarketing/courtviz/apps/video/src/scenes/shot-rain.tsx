import { createCourtScales, hasValidSpatialCoords, shotPlayerWonPoint } from "@courtviz/core";
import { enrichedShots, guestName, hostName, surface } from "@courtviz/data/fixtures";
import { Court } from "@courtviz/react";
import { getPlayerColor } from "@courtviz/themes";
import { interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { BroadcastShell } from "../components/broadcast-shell";
import { CourtZoom } from "../components/court-zoom";
import { InsightCallout } from "../components/insight-callout";
import { MatchScoreBar } from "../components/match-score-bar";
import { SceneHeader } from "../components/scene-header";
import { SetFlash } from "../components/set-flash";
import { SCENE_DURATIONS } from "../constants";
import { darkCourt } from "../court-viz-utils";
import { bodyFont, condensedFont } from "../fonts";
import { sceneInsight } from "../match-stats";

const orderedShots = enrichedShots
  .filter(
    (shot) =>
      shot.stroke !== "Serve" &&
      hasValidSpatialCoords(shot) &&
      shot.result === "In",
  )
  .sort((a, b) => {
    if (a.setNumber !== b.setNumber) return a.setNumber - b.setNumber;
    if (a.gameNumber !== b.gameNumber) return a.gameNumber - b.gameNumber;
    if (a.pointNumber !== b.pointNumber) return a.pointNumber - b.pointNumber;
    return (a.shotNumber ?? 0) - (b.shotNumber ?? 0);
  });

const REVEAL_START = 30;
const REVEAL_END = 270;
const COURT_WIDTH = 760;
const COURT_HEIGHT = 920;
const COURT_LEFT = (1920 - COURT_WIDTH) / 2;
const COURT_TOP = 180;

const scales = createCourtScales({
  half: "full",
  height: COURT_HEIGHT,
  margin: 1.5,
  width: COURT_WIDTH,
});

const setChangeFrames = (() => {
  const changes: Array<{ frame: number; setNumber: number }> = [];
  let lastSet = -1;
  const total = orderedShots.length;
  for (let i = 0; i < total; i++) {
    const set = orderedShots[i]!.setNumber;
    if (set !== lastSet && i > 0) {
      changes.push({
        frame: REVEAL_START + (i / total) * (REVEAL_END - REVEAL_START),
        setNumber: set,
      });
      lastSet = set;
    } else if (i === 0) {
      lastSet = set;
    }
  }
  return changes;
})();

export function ShotRainScene() {
  const frame = useCurrentFrame();
  const totalShots = orderedShots.length;
  const revealProgress = interpolate(
    frame,
    [REVEAL_START, REVEAL_END],
    [0, totalShots],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );
  const visibleCount = Math.floor(revealProgress);
  const currentSet = orderedShots[Math.max(0, visibleCount - 1)]?.setNumber ?? 1;
  const counterSpring = spring({
    config: { damping: 200 },
    fps: 30,
    frame: frame - REVEAL_START,
  });

  return (
    <BroadcastShell>
      <SceneHeader subtitle="Every bounce, in match order" title="Shot Rain" />

      {setChangeFrames.map((change) => (
        <SetFlash key={change.setNumber} setNumber={change.setNumber} triggerFrame={change.frame} />
      ))}

      <div
        style={{
          backgroundColor: "rgba(0,0,0,0.5)",
          border: `1px solid ${darkCourt.inkMuted}44`,
          borderRadius: 8,
          color: darkCourt.ink,
          fontFamily: condensedFont,
          fontSize: 18,
          fontWeight: 700,
          letterSpacing: "0.12em",
          padding: "10px 18px",
          position: "absolute",
          right: 80,
          textTransform: "uppercase",
          top: 68,
        }}
      >
        Set {currentSet}
      </div>

      <div style={{ left: COURT_LEFT, position: "absolute", top: COURT_TOP }}>
        <CourtZoom durationInFrames={SCENE_DURATIONS.shotRain} from={1} to={1.04}>
          <Court half="full" height={COURT_HEIGHT} surface={surface} theme={darkCourt} width={COURT_WIDTH}>
            <defs>
              <filter id="dot-glow">
                <feGaussianBlur result="blur" stdDeviation="2" />
                <feMerge>
                  <feMergeNode in="blur" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>
            </defs>
            <AnimatedDots frame={frame} visibleCount={visibleCount} />
          </Court>
        </CourtZoom>
      </div>

      <div
        style={{
          bottom: 200,
          color: darkCourt.ink,
          fontFamily: condensedFont,
          fontSize: 32,
          fontWeight: 700,
          left: 80,
          opacity: counterSpring,
          position: "absolute",
        }}
      >
        {visibleCount.toLocaleString()}
        <span style={{ color: darkCourt.inkMuted, fontFamily: bodyFont, fontSize: 18, marginLeft: 8 }}>
          / {totalShots.toLocaleString()} shots
        </span>
      </div>

      <div style={{ bottom: 200, display: "flex", gap: 28, position: "absolute", right: 80 }}>
        <LegendSwatch color={getPlayerColor("host", darkCourt)} label={hostName} />
        <LegendSwatch color={getPlayerColor("guest", darkCourt)} label={guestName} />
        <LegendSwatch color={darkCourt.ink} label="Bright = point won" muted />
      </div>

      <InsightCallout delay={40} text={sceneInsight("shotRain")} />
      <MatchScoreBar guestName={guestName} hostName={hostName} />
    </BroadcastShell>
  );
}

function LegendSwatch({
  color,
  label,
  muted = false,
}: {
  color: string;
  label: string;
  muted?: boolean;
}) {
  return (
    <div style={{ alignItems: "center", display: "flex", gap: 10 }}>
      <div
        style={{
          backgroundColor: color,
          borderRadius: "50%",
          height: 12,
          opacity: muted ? 0.5 : 1,
          width: 12,
        }}
      />
      <span style={{ color: darkCourt.ink, fontFamily: bodyFont, fontSize: 16 }}>{label}</span>
    </div>
  );
}

function AnimatedDots({ frame, visibleCount }: { frame: number; visibleCount: number }) {
  const { fps } = useVideoConfig();
  const totalShots = orderedShots.length;

  return (
    <g>
      {orderedShots.slice(0, visibleCount).map((shot, index) => {
        const color = getPlayerColor(shot.player, darkCourt);
        const wonPoint = shotPlayerWonPoint(shot);
        const appearAt = REVEAL_START + (index / totalShots) * (REVEAL_END - REVEAL_START);
        const pop = spring({
          config: { damping: 16, stiffness: 220 },
          fps,
          frame: frame - appearAt,
        });
        const isRecent = index >= visibleCount - 8;
        const baseOpacity = wonPoint ? 0.85 : 0.45;
        const opacity = isRecent ? Math.min(1, baseOpacity + 0.35 * pop) : baseOpacity;
        const radius = (isRecent ? 6.5 : 4) * Math.max(pop, 0.3);

        return (
          <circle
            cx={scales.x(shot.bounceX!)}
            cy={scales.y(shot.bounceY!)}
            fill={color}
            filter={isRecent ? "url(#dot-glow)" : undefined}
            key={`${shot.setNumber}-${shot.gameNumber}-${shot.pointNumber}-${index}`}
            opacity={opacity}
            r={radius}
            stroke={darkCourt.haloColor}
            strokeWidth={0.5}
          />
        );
      })}
    </g>
  );
}
