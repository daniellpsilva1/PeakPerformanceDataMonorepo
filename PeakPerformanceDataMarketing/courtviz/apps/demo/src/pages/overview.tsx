import { Link } from "react-router-dom";
import { Court, HexbinLayer, DotLayer, MomentumChart } from "@courtviz/react";
import {
  computeBreakPointConversion,
  computeFirstServeInRate,
  computePointsWonRate,
  computeRallyBucketStats,
  createCourtScales,
} from "@courtviz/core";
import { ppdDark } from "@courtviz/themes";
import {
  enrichedShots,
  guestName,
  hostName,
  matchDate,
  momentumPoints,
  points,
  sets,
  shots,
  surface,
} from "@courtviz/data";
import { FigureCard } from "../components/figure-card";
import { RallyWinRateChart } from "../components/rally-win-rate-chart";

export function OverviewPage() {
  const theme = ppdDark;

  const hostPointsWon = computePointsWonRate(points, "host");
  const guestPointsWon = computePointsWonRate(points, "guest");
  const hostFirstServe = computeFirstServeInRate(enrichedShots, "host");
  const guestFirstServe = computeFirstServeInRate(enrichedShots, "guest");
  const hostBreakPoints = computeBreakPointConversion(enrichedShots, "host");
  const guestBreakPoints = computeBreakPointConversion(enrichedShots, "guest");

  const hostGroundstrokes = enrichedShots.filter(
    (s) => s.player === "host" && s.stroke !== "Serve" && s.result === "In",
  );
  const hostRally = computeRallyBucketStats(enrichedShots, "host");
  const guestRally = computeRallyBucketStats(enrichedShots, "guest");

  const hexScales = createCourtScales({ half: "near", height: 350, margin: 1.5, width: 350 });
  const dotScales = createCourtScales({ half: "full", height: 450, margin: 1.5, width: 350 });

  const cards = [
    {
      label: "Total Shots",
      sub: "All tracked strokes",
      value: shots.length.toString(),
    },
    {
      label: "Total Points",
      sub: "Completed points",
      value: momentumPoints.length.toString(),
    },
    {
      label: "Sets",
      sub: sets.map((s) => `${s.hostScore}-${s.guestScore}`).join(", "),
      value: sets.length.toString(),
    },
    {
      label: `${hostName} Points Won`,
      sub: `${hostFirstServe.total > 0 ? Math.round(hostFirstServe.rate * 100) : 0}% 1st serve in · ${hostBreakPoints.total > 0 ? Math.round(hostBreakPoints.rate * 100) : 0}% BP conv`,
      value: `${hostPointsWon.total > 0 ? Math.round(hostPointsWon.rate * 100) : 0}%`,
    },
    {
      label: `${guestName} Points Won`,
      sub: `${guestFirstServe.total > 0 ? Math.round(guestFirstServe.rate * 100) : 0}% 1st serve in · ${guestBreakPoints.total > 0 ? Math.round(guestBreakPoints.rate * 100) : 0}% BP conv`,
      value: `${guestPointsWon.total > 0 ? Math.round(guestPointsWon.rate * 100) : 0}%`,
    },
  ];

  return (
    <div>
      <div className="page-header">
        <h2>Match Overview</h2>
        <p>
          {hostName} vs {guestName} · {matchDate} · {surface} — key metrics and court visualizations
        </p>
      </div>

      <div className="stats-row">
        {cards.map((card) => (
          <div className="stat-card" key={card.label}>
            <div className="label">{card.label}</div>
            <div className="value">{card.value}</div>
            <div className="sub">{card.sub}</div>
          </div>
        ))}
      </div>

      <div className="viz-grid">
        <FigureCard
          footer="Hex size = shot frequency · Color = point-win rate on that bounce zone"
          subtitle="Where does the host win points from?"
          title="Host Bounce Hexmap"
        >
          <Court half="near" height={350} surface={surface as "clay"} theme={theme} width={350}>
            <HexbinLayer
              colorScale="efficiency"
              gridsize={6}
              half="near"
              minCount={2}
              player="host"
              scales={hexScales}
              shots={hostGroundstrokes}
              theme={theme}
            />
          </Court>
        </FigureCard>

        <FigureCard
          footer="Each dot = one bounce location · Color = stroke type"
          subtitle="Full-court shot density across both players"
          title="All Shots Dot Density"
        >
          <Court half="full" height={450} surface={surface as "clay"} theme={theme} width={350}>
            <DotLayer
              alpha={0.45}
              colorBy="stroke"
              scales={dotScales}
              shots={enrichedShots}
              size={3}
              theme={theme}
            />
          </Court>
        </FigureCard>

        <FigureCard
          footer="Positive = host ahead · Negative = guest ahead · Dashed lines = set boundaries"
          subtitle="Cumulative point differential through the match"
          title="Momentum Chart"
        >
          <MomentumChart
            height={200}
            hostPlayer="host"
            points={momentumPoints}
            theme={theme}
            width={350}
          />
        </FigureCard>

        <FigureCard
          footer="Win rate by rally length bucket — one count per point, not per shot"
          subtitle="Who wins short vs extended rallies?"
          title="Rally Length Win Rates"
        >
          <RallyWinRateChart
            guestBuckets={guestRally}
            guestName={guestName}
            hostBuckets={hostRally}
            hostName={hostName}
            theme={theme}
          />
        </FigureCard>
      </div>

      <div className="page-footer-link">
        <Link to="/hexmap">Explore all visualizations →</Link>
      </div>
    </div>
  );
}
