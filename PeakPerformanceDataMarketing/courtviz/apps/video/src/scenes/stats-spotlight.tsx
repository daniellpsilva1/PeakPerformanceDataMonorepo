import { guestName, hostName } from "@courtviz/data/fixtures";
import { getPlayerColor } from "@courtviz/themes";
import { spring, useCurrentFrame, useVideoConfig } from "remotion";
import { BroadcastShell } from "../components/broadcast-shell";
import { InsightCallout } from "../components/insight-callout";
import { MatchScoreBar } from "../components/match-score-bar";
import { SceneHeader } from "../components/scene-header";
import { theme } from "../court-viz-utils";
import { bodyFont, condensedFont } from "../fonts";
import { PPD } from "../ppd-tokens";
import {
  guestServiceStats,
  hostServiceStats,
  longRallyBattle,
  sceneInsight,
} from "../match-stats";

export function StatsSpotlightScene() {
  return (
    <BroadcastShell>
      <SceneHeader subtitle="How the match was won" title="By The Numbers" />

      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 20,
          left: "50%",
          position: "absolute",
          top: 240,
          transform: "translateX(-50%)",
          width: 900,
        }}
      >
        <StoryCard
          delay={8}
          guestLabel={`${Math.round(guestServiceStats.serviceWinRate * 100)}%`}
          guestName={guestName}
          headline="Won on Return"
          hostLabel={`${Math.round(hostServiceStats.serviceWinRate * 100)}%`}
          hostName={hostName}
          narrative={`${hostName} won ${hostServiceStats.serviceWon} of ${hostServiceStats.servicePoints} service points — return game decided the match`}
        />
        <StoryCard
          delay={20}
          guestLabel={`${Math.round(guestServiceStats.servePlusOneRate * 100)}%`}
          guestName={guestName}
          headline="Serve +1"
          hostLabel={`${Math.round(hostServiceStats.servePlusOneRate * 100)}%`}
          hostName={hostName}
          narrative={`Points won in 3 shots or fewer on own serve — ${hostName} converted ${hostServiceStats.servePlusOneWon}/${hostServiceStats.servePlusOne}`}
        />
        <StoryCard
          delay={32}
          guestLabel={`${longRallyBattle.guestWon}`}
          guestName={guestName}
          headline="Long Rallies (7+)"
          hostLabel={`${longRallyBattle.hostWon}`}
          hostName={hostName}
          narrative={`Points won in extended exchanges — ${hostName} edged ${longRallyBattle.hostWon}–${longRallyBattle.guestWon} in the attrition battle`}
        />
      </div>

      <InsightCallout delay={50} text={sceneInsight("stats")} />
      <MatchScoreBar guestName={guestName} hostName={hostName} />
    </BroadcastShell>
  );
}

function StoryCard({
  delay,
  guestLabel,
  guestName: guest,
  headline,
  hostLabel,
  hostName: host,
  narrative,
}: {
  delay: number;
  guestLabel: string;
  guestName: string;
  headline: string;
  hostLabel: string;
  hostName: string;
  narrative: string;
}) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const enter = spring({ config: { damping: 200 }, delay, fps, frame });
  const hostColor = getPlayerColor("host", theme);
  const guestColor = getPlayerColor("guest", theme);

  return (
    <div
      style={{
        backgroundColor: PPD.surface,
        border: `1px solid ${PPD.border}`,
        borderRadius: PPD.radius.md,
        opacity: enter,
        padding: "20px 28px",
        transform: `translateY(${(1 - enter) * 16}px)`,
      }}
    >
      <div
        style={{
          color: PPD.textMuted,
          fontFamily: condensedFont,
          fontSize: 14,
          fontWeight: 700,
          letterSpacing: "0.04em",
          marginBottom: 12,
          textTransform: "uppercase",
        }}
      >
        {headline}
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 12 }}>
        <div>
          <div style={{ color: hostColor, fontFamily: condensedFont, fontSize: 32, fontWeight: 700 }}>
            {hostLabel}
          </div>
          <div style={{ color: PPD.textMuted, fontFamily: bodyFont, fontSize: 12 }}>{host}</div>
        </div>
        <div style={{ textAlign: "right" }}>
          <div style={{ color: guestColor, fontFamily: condensedFont, fontSize: 32, fontWeight: 700 }}>
            {guestLabel}
          </div>
          <div style={{ color: PPD.textMuted, fontFamily: bodyFont, fontSize: 12 }}>{guest}</div>
        </div>
      </div>
      <div style={{ color: theme.ink, fontFamily: bodyFont, fontSize: 14, lineHeight: 1.45 }}>
        {narrative}
      </div>
    </div>
  );
}
