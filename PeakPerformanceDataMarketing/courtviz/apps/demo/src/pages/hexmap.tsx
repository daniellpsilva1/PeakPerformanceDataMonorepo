import { useState } from "react";
import { Court, ColorBar, FigureFrame, HexbinLayer, HexSizeLegend } from "@courtviz/react";
import { createCourtScales } from "@courtviz/core";
import { broadcast, ppdDark, sprawlball, type CourtvizTheme } from "@courtviz/themes";
import { enrichedShots, guestName, hostName, surface } from "@courtviz/data";
import type { HexbinColorScale } from "@courtviz/react";

const themes: Record<string, CourtvizTheme> = { broadcast, ppdDark, sprawlball };

export function HexmapPage() {
  const [colorScale, setColorScale] = useState<HexbinColorScale>("efficiency");
  const [gridsize, setGridsize] = useState(6);
  const [player, setPlayer] = useState("host");
  const [themeName, setThemeName] = useState("ppdDark");

  const theme = themes[themeName]!;
  const courtSize = 600;
  const frameWidth = 700;
  const frameHeight = 800;
  const scales = createCourtScales({ half: "near", height: courtSize, margin: 1.5, width: courtSize });
  const groundstrokes = enrichedShots.filter(
    (s) => s.player === player && s.stroke !== "Serve" && s.result === "In",
  );

  const playerName = player === "host" ? hostName : guestName;
  const colorLabel = colorScale === "efficiency" ? "Win Rate" : colorScale === "speed" ? "Speed (km/h)" : "Count";
  const encodingLabel =
    colorScale === "efficiency"
      ? "win rate"
      : colorScale === "speed"
        ? "avg speed"
        : "shot count";

  return (
    <div>
      <div className="page-header">
        <h2>Hexbin Map</h2>
        <p>
          Where do you win points? Hex size = shot frequency · Color = {encodingLabel}
        </p>
      </div>

      <div className="controls">
        <div className="control-group">
          <label>Player</label>
          <button className={player === "host" ? "active" : ""} onClick={() => setPlayer("host")}>{hostName}</button>
          <button className={player === "guest" ? "active" : ""} onClick={() => setPlayer("guest")}>{guestName}</button>
        </div>
        <div className="control-group">
          <label>Color</label>
          <button className={colorScale === "efficiency" ? "active" : ""} onClick={() => setColorScale("efficiency")}>Win Rate</button>
          <button className={colorScale === "speed" ? "active" : ""} onClick={() => setColorScale("speed")}>Speed</button>
          <button className={colorScale === "count" ? "active" : ""} onClick={() => setColorScale("count")}>Count</button>
        </div>
        <div className="control-group">
          <label>Grid</label>
          <select onChange={(e) => setGridsize(Number(e.target.value))} value={gridsize}>
            <option value={4}>4</option>
            <option value={6}>6</option>
            <option value={8}>8</option>
            <option value={10}>10</option>
          </select>
        </div>
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
          height={frameHeight}
          source="Data: Courtvision. Visualization: Courtviz."
          subtitle={`${playerName} — ${groundstrokes.length} in-play groundstrokes · color encodes ${encodingLabel}`}
          theme={theme}
          title="Shot Placement Efficiency"
          width={frameWidth}
        >
          <g transform={`translate(${(frameWidth - courtSize) / 2} 20)`}>
            <Court half="near" height={courtSize} surface={surface as "clay"} theme={theme} width={courtSize}>
              <HexbinLayer
                colorScale={colorScale}
                gridsize={gridsize}
                half="near"
                minCount={2}
                player={player}
                scales={scales}
                shots={groundstrokes}
                theme={theme}
              />
            </Court>
          </g>

          <g transform={`translate(${(frameWidth - courtSize) / 2} ${courtSize + 40})`}>
            <ColorBar
              label={colorLabel}
              max={colorScale === "efficiency" ? "100%" : colorScale === "speed" ? "120" : "max"}
              min={colorScale === "efficiency" ? "0%" : colorScale === "speed" ? "40" : "0"}
              theme={theme}
              width={200}
            />
            <HexSizeLegend maxCount={20} theme={theme} x={280} y={10} />
          </g>
        </FigureFrame>
      </div>
    </div>
  );
}
