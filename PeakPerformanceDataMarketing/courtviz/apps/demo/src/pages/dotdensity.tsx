import { useState } from "react";
import { Court, DensityLayer, DotLayer, FigureFrame, Legend } from "@courtviz/react";
import { createCourtScales } from "@courtviz/core";
import { broadcast, ppdDark, sprawlball } from "@courtviz/themes";
import { enrichedShots, guestName, hostName, surface } from "@courtviz/data";
import type { DotColorBy } from "@courtviz/react";

export function DotDensityPage() {
  const [colorBy, setColorBy] = useState<DotColorBy>("stroke");
  const [densityMode, setDensityMode] = useState(false);
  const [half, setHalf] = useState<"full" | "near">("full");
  const [normalize, setNormalize] = useState(false);
  const [player, setPlayer] = useState("both");
  const [themeName, setThemeName] = useState("ppdDark");

  const theme = themeName === "sprawlball" ? sprawlball : themeName === "broadcast" ? broadcast : ppdDark;
  const courtW = 600;
  const courtH = half === "full" ? 800 : 600;
  const frameW = 700;
  const frameH = courtH + 200;
  const scales = createCourtScales({ half, height: courtH, margin: 1.5, width: courtW });

  const shots = player === "both" ? enrichedShots : enrichedShots.filter((s) => s.player === player);

  const legendItems = colorBy === "stroke"
    ? [
        { color: theme.playerHost, label: "Forehand" },
        { color: theme.playerGuest, label: "Backhand" },
        { color: "#38A169", label: "Volley" },
        { color: "#805AD5", label: "Serve" },
        { color: "#D53F8C", label: "Overhead" },
      ]
    : colorBy === "result"
      ? [
          { color: "#38A169", label: "In" },
          { color: "#E53E3E", label: "Out" },
          { color: "#3182CE", label: "Net" },
        ]
      : colorBy === "player"
        ? [
            { color: theme.playerHost, label: hostName },
            { color: theme.playerGuest, label: guestName },
          ]
        : [];

  return (
    <div>
      <div className="page-header">
        <h2>Dot Density</h2>
        <p>
          Where do shots land? Each dot is a bounce · {densityMode ? "contour bands = shot density" : "color = stroke type"}
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
          <button className={!densityMode ? "active" : ""} onClick={() => setDensityMode(false)}>Dots</button>
          <button className={densityMode ? "active" : ""} onClick={() => setDensityMode(true)}>Density</button>
        </div>
        {!densityMode && (
          <div className="control-group">
            <label>Color</label>
            <button className={colorBy === "stroke" ? "active" : ""} onClick={() => setColorBy("stroke")}>Stroke</button>
            <button className={colorBy === "player" ? "active" : ""} onClick={() => setColorBy("player")}>Player</button>
            <button className={colorBy === "speed" ? "active" : ""} onClick={() => setColorBy("speed")}>Speed</button>
            <button className={colorBy === "result" ? "active" : ""} onClick={() => setColorBy("result")}>Result</button>
          </div>
        )}
        <div className="control-group">
          <label>View</label>
          <button className={half === "full" ? "active" : ""} onClick={() => setHalf("full")}>Full</button>
          <button className={half === "near" ? "active" : ""} onClick={() => setHalf("near")}>Half</button>
        </div>
        {half === "near" && !densityMode && (
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
          subtitle={densityMode ? "KDE density contours — brighter = more shots" : "Scatter plot — one dot per bounce location"}
          theme={theme}
          title="Shot Bounce Distribution"
          width={frameW}
        >
          <g transform={`translate(${(frameW - courtW) / 2} 20)`}>
            <Court half={half} height={courtH} surface={surface as "clay"} theme={theme} width={courtW}>
              {densityMode ? (
                <DensityLayer
                  half={half}
                  player={player === "both" ? undefined : player}
                  scales={scales}
                  shots={shots}
                  theme={theme}
                />
              ) : (
                <DotLayer
                  alpha={0.55}
                  colorBy={colorBy}
                  player={player === "both" ? undefined : player}
                  scales={scales}
                  shots={shots}
                  size={4}
                  theme={theme}
                  useHalfCourtNormalization={normalize}
                />
              )}
            </Court>
          </g>

          {!densityMode && legendItems.length > 0 && (
            <g transform={`translate(${(frameW - courtW) / 2} ${courtH + 40})`}>
              <Legend
                items={legendItems}
                orientation={legendItems.length > 3 ? "vertical" : "horizontal"}
                theme={theme}
                x={10}
                y={4}
              />
            </g>
          )}
        </FigureFrame>
      </div>
    </div>
  );
}
