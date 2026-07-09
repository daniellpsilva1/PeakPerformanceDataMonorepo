import { guestName, hostName } from "@courtviz/data/fixtures";
import { getPlayerColor } from "@courtviz/themes";
import { spring, useCurrentFrame, useVideoConfig } from "remotion";
import { BroadcastShell } from "../components/broadcast-shell";
import { InsightCallout } from "../components/insight-callout";
import { MatchScoreBar } from "../components/match-score-bar";
import { SceneHeader } from "../components/scene-header";
import { theme } from "../court-viz-utils";
import { bodyFont, condensedFont } from "../fonts";
import {
  guestServiceStats,
  hostServiceStats,
  longRallyBattle,
  sceneInsight,
} from "../match-stats";

export function SocialStatsScene() {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const footer = spring({ config: { damping: 200 }, delay: 40, fps, frame });
  const hostColor = getPlayerColor("host", theme);
  const guestColor = getPlayerColor("guest", theme);

  return (
    <BroadcastShell>
      <SceneHeader subtitle="How the match was won" title="Key Stats" />

      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 16,
          left: 48,
          position: "absolute",
          top: 260,
          width: 984,
        }}
      >
        <MiniStory
          guestValue={`${Math.round(guestServiceStats.serviceWinRate * 100)}%`}
          hostValue={`${Math.round(hostServiceStats.serviceWinRate * 100)}%`}
          title="Service Points Won"
        />
        <MiniStory
          guestValue={`${Math.round(guestServiceStats.servePlusOneRate * 100)}%`}
          hostValue={`${Math.round(hostServiceStats.servePlusOneRate * 100)}%`}
          title="Serve +1"
        />
        <MiniStory
          guestValue={`${longRallyBattle.guestWon}`}
          hostValue={`${longRallyBattle.hostWon}`}
          title="Long Rallies (7+)"
        />
      </div>

      <div
        style={{
          bottom: 200,
          left: "50%",
          opacity: footer,
          position: "absolute",
          textAlign: "center",
          transform: "translateX(-50%)",
        }}
      >
        <div style={{ color: hostColor, fontFamily: bodyFont, fontSize: 14 }}>{hostName}</div>
        <div style={{ color: guestColor, fontFamily: bodyFont, fontSize: 14, marginTop: 4 }}>{guestName}</div>
      </div>

      <InsightCallout delay={30} text={sceneInsight("stats")} />
      <MatchScoreBar guestName={guestName} hostName={hostName} />
    </BroadcastShell>
  );
}

function MiniStory({
  guestValue,
  hostValue,
  title,
}: {
  guestValue: string;
  hostValue: string;
  title: string;
}) {
  const hostColor = getPlayerColor("host", theme);
  const guestColor = getPlayerColor("guest", theme);

  return (
    <div
      style={{
        backdropFilter: "blur(10px)",
        backgroundColor: "rgba(0,0,0,0.55)",
        border: `1px solid ${theme.inkMuted}33`,
        borderRadius: 10,
        padding: "18px 24px",
      }}
    >
      <div
        style={{
          color: theme.inkMuted,
          fontFamily: condensedFont,
          fontSize: 12,
          fontWeight: 600,
          letterSpacing: "0.14em",
          marginBottom: 10,
          textTransform: "uppercase",
        }}
      >
        {title}
      </div>
      <div style={{ display: "flex", justifyContent: "space-between" }}>
        <span style={{ color: hostColor, fontFamily: condensedFont, fontSize: 32, fontWeight: 700 }}>
          {hostValue}
        </span>
        <span style={{ color: guestColor, fontFamily: condensedFont, fontSize: 32, fontWeight: 700 }}>
          {guestValue}
        </span>
      </div>
    </div>
  );
}
