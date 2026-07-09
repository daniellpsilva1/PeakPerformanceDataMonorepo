import { useMemo, useState } from "react";
import { Court, FigureFrame, Legend, ServeLayer } from "@courtviz/react";
import { computeServeZones, createCourtScales, zoneLabel } from "@courtviz/core";
import { ppdDark } from "@courtviz/themes";
import { enrichedShots, guestName, hostName, surface } from "@courtviz/data";
import type { ServeType } from "@courtviz/react";

function formatPct(rate: number): string {
  return `${Math.round(rate * 100)}%`;
}

export function ServePage() {
  const [serveType, setServeType] = useState<ServeType>("both");
  const [activePlayer, setActivePlayer] = useState<"host" | "guest" | "both">("both");

  const theme = ppdDark;
  const courtSize = 560;
  const frameW = 900;
  const frameH = 720;
  const scales = createCourtScales({ half: "near", height: courtSize, margin: 1.5, width: courtSize });

  const hostZones = useMemo(() => computeServeZones(enrichedShots, "host"), []);
  const guestZones = useMemo(() => computeServeZones(enrichedShots, "guest"), []);

  const legendItems = [
    { color: theme.playerHost, label: `${hostName} — circle = 1st, triangle = 2nd` },
    { color: theme.playerGuest, label: `${guestName} — circle = 1st, triangle = 2nd` },
    { color: theme.inkMuted, label: "Faded markers = serve out" },
  ];

  return (
    <div>
      <div className="page-header">
        <h2>Serve Placement</h2>
        <p>
          Where do serves land? Wide / body / T zones · shape = 1st (circle) vs 2nd (triangle) serve
        </p>
      </div>

      <div className="controls">
        <div className="control-group">
          <label>Serve</label>
          <button className={serveType === "both" ? "active" : ""} onClick={() => setServeType("both")}>Both</button>
          <button className={serveType === "first_serve" ? "active" : ""} onClick={() => setServeType("first_serve")}>1st</button>
          <button className={serveType === "second_serve" ? "active" : ""} onClick={() => setServeType("second_serve")}>2nd</button>
        </div>
        <div className="control-group">
          <label>Player</label>
          <button className={activePlayer === "both" ? "active" : ""} onClick={() => setActivePlayer("both")}>Both</button>
          <button className={activePlayer === "host" ? "active" : ""} onClick={() => setActivePlayer("host")}>{hostName}</button>
          <button className={activePlayer === "guest" ? "active" : ""} onClick={() => setActivePlayer("guest")}>{guestName}</button>
        </div>
      </div>

      <div className="serve-layout">
        <div className="viz-container viz-container--flush serve-court-panel">
          <FigureFrame
            height={frameH}
            source="Data: Courtvision. Visualization: Courtviz."
            subtitle="Half-court normalized — all serves mapped to near service box"
            theme={theme}
            title="Serve Placement Map"
            width={frameW}
          >
            <g transform={`translate(${(frameW - courtSize) / 2} 20)`}>
              <Court half="near" height={courtSize} surface={surface as "clay"} theme={theme} width={courtSize}>
                {(activePlayer === "both" || activePlayer === "host") && (
                  <ServeLayer
                    player="host"
                    scales={scales}
                    serveType={serveType}
                    shots={enrichedShots}
                    theme={theme}
                  />
                )}
                {(activePlayer === "both" || activePlayer === "guest") && (
                  <ServeLayer
                    player="guest"
                    scales={scales}
                    serveType={serveType}
                    shots={enrichedShots}
                    theme={theme}
                  />
                )}
              </Court>
            </g>
            <g transform={`translate(40 ${courtSize + 60})`}>
              <Legend items={legendItems} orientation="vertical" theme={theme} x={0} y={0} />
            </g>
          </FigureFrame>
        </div>

        <div className="serve-stats-panel">
          <div className="serve-stats-card">
            <h3>{hostName}</h3>
            <p className="serve-stats-sub">Serve zone breakdown — in % and point win %</p>
            <table className="serve-stats-table">
              <thead>
                <tr>
                  <th>Zone</th>
                  <th>Count</th>
                  <th>In %</th>
                  <th>Win %</th>
                </tr>
              </thead>
              <tbody>
                {hostZones.map((zone) => (
                  <tr key={`host-${zone.side}-${zone.zone}`}>
                    <td>{zoneLabel(zone)}</td>
                    <td>{zone.count}</td>
                    <td>{formatPct(zone.inRate)}</td>
                    <td>{formatPct(zone.winRate)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="serve-stats-card">
            <h3>{guestName}</h3>
            <p className="serve-stats-sub">Serve zone breakdown — in % and point win %</p>
            <table className="serve-stats-table">
              <thead>
                <tr>
                  <th>Zone</th>
                  <th>Count</th>
                  <th>In %</th>
                  <th>Win %</th>
                </tr>
              </thead>
              <tbody>
                {guestZones.map((zone) => (
                  <tr key={`guest-${zone.side}-${zone.zone}`}>
                    <td>{zoneLabel(zone)}</td>
                    <td>{zone.count}</td>
                    <td>{formatPct(zone.inRate)}</td>
                    <td>{formatPct(zone.winRate)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
