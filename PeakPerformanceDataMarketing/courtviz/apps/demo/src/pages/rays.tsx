import { useState } from "react";
import { Court, ColorBar, FigureFrame, RayLayer } from "@courtviz/react";
import { createCourtScales } from "@courtviz/core";
import { broadcast, ppdDark, sprawlball } from "@courtviz/themes";
import { enrichedShots, guestName, hostName, surface } from "@courtviz/data";

export function RaysPage() {
  const [curved, setCurved] = useState(false);
  const [flowMode, setFlowMode] = useState(false);
  const [half, setHalf] = useState<"full" | "near">("full");
  const [normalize, setNormalize] = useState(false);
  const [player, setPlayer] = useState("both");
  const [strokeFilter, setStrokeFilter] = useState<string>("all");
  const [themeName, setThemeName] = useState("ppdDark");

  const theme = themeName === "sprawlball" ? sprawlball : themeName === "broadcast" ? broadcast : ppdDark;
  const courtW = 600;
  const courtH = half === "full" ? 800 : 600;
  const frameW = 700;
  const frameH = courtH + (flowMode ? 240 : 180);
  const scales = createCourtScales({ half, height: courtH, margin: 1.5, width: courtW });

  let shots = player === "both" ? enrichedShots : enrichedShots.filter((s) => s.player === player);
  if (strokeFilter !== "all") {
    shots = shots.filter((s) => s.stroke === strokeFilter);
  }

  const strokes = ["all", "Forehand", "Backhand", "Volley", "Overhead"];

  const modeSubtitle = flowMode
    ? "Flow bundles — width = shot volume · color = point win rate"
    : curved
      ? "Curved arcs from contact to bounce"
      : "Straight rays from contact to bounce · color = stroke type";

  return (
    <div>
      <div className="page-header">
        <h2>Shot Trajectories</h2>
        <p>
          How do shots travel? Hit point → bounce location · {modeSubtitle.toLowerCase()}
        </p>
      </div>

      <div className="controls">
        <div className="control-group">
          <label>Player</label>
          <button className={player === "both" ? "active" : ""} onClick={() => setPlayer("both")}>Both</button>
          <button className={player === "host" ? "active" : ""} onClick={() => setPlayer("host")}>{hostName}</button>
          <button className={player === "guest" ? "active" : ""} onClick={() => setPlayer("guest")}>{guestName}</button>
        </div>
        <div className="control-group">
          <label>Mode</label>
          <button className={!flowMode && !curved ? "active" : ""} onClick={() => { setCurved(false); setFlowMode(false); }}>Straight</button>
          <button className={curved && !flowMode ? "active" : ""} onClick={() => { setCurved(true); setFlowMode(false); }}>Curved</button>
          <button className={flowMode ? "active" : ""} onClick={() => { setFlowMode(true); setCurved(false); }}>Flow</button>
        </div>
        {!flowMode && (
          <div className="control-group">
            <label>Stroke</label>
            <select onChange={(e) => setStrokeFilter(e.target.value)} value={strokeFilter}>
              {strokes.map((s) => (
                <option key={s} value={s}>{s === "all" ? "All" : s}</option>
              ))}
            </select>
          </div>
        )}
        <div className="control-group">
          <label>View</label>
          <button className={half === "full" ? "active" : ""} onClick={() => setHalf("full")}>Full</button>
          <button className={half === "near" ? "active" : ""} onClick={() => setHalf("near")}>Half</button>
        </div>
        {half === "near" && !flowMode && (
          <div className="control-group">
            <label>Normalize</label>
            <button className={normalize ? "active" : ""} onClick={() => setNormalize(!normalize)}>
              {normalize ? "ON" : "OFF"}
            </button>
          </div>
        )}
        <div className="control-group">
          <label>Theme</label>
          <select onChange={(e) => setThemeName(e.target.value)} value={themeName}>
            <option value="ppdDark">PPD Dark</option>
            <option value="sprawlball">SprawlBall</option>
            <option value="broadcast">Broadcast</option>
          </select>
        </div>
      </div>

      <div className="viz-container viz-container--flush">
        <FigureFrame
          height={frameH}
          source="Data: Courtvision. Visualization: Courtviz."
          subtitle={modeSubtitle}
          theme={theme}
          title="Shot Trajectories"
          width={frameW}
        >
          <g transform={`translate(${(frameW - courtW) / 2} 20)`}>
            <Court half={half} height={courtH} surface={surface as "clay"} theme={theme} width={courtW}>
              <RayLayer
                alpha={0.3}
                curved={curved}
                flowMode={flowMode}
                player={player === "both" ? undefined : player}
                scales={scales}
                shots={shots}
                strokeFilter={strokeFilter === "all" ? undefined : [strokeFilter]}
                theme={theme}
                useHalfCourtNormalization={normalize}
              />
            </Court>
          </g>

          {flowMode && (
            <g transform={`translate(${(frameW - 200) / 2} ${courtH + 50})`}>
              <ColorBar label="Point Win Rate" max="100%" min="0%" theme={theme} width={200} />
            </g>
          )}
        </FigureFrame>
      </div>
    </div>
  );
}
