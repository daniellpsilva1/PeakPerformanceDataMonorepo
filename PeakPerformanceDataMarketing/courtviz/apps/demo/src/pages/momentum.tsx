import { useState } from "react";
import { MomentumChart } from "@courtviz/react";
import { broadcast, ppdDark, sprawlball } from "@courtviz/themes";
import { guestName, hostName, momentumPoints, sets } from "@courtviz/data";

export function MomentumPage() {
  const [themeName, setThemeName] = useState("ppdDark");
  const [width, setWidth] = useState(900);
  const [height, setHeight] = useState(280);

  const theme = themeName === "sprawlball" ? sprawlball : themeName === "broadcast" ? broadcast : ppdDark;
  const setScores = sets.map((s) => `Set ${s.setNumber}: ${s.hostScore}-${s.guestScore}`).join(" · ");

  return (
    <div>
      <div className="page-header">
        <h2>Momentum Chart</h2>
        <p>
          Match flow — cumulative point differential · positive = {hostName} ahead · {setScores}
        </p>
      </div>

      <div className="controls">
        <div className="control-group">
          <label>Theme</label>
          <button className={themeName === "ppdDark" ? "active" : ""} onClick={() => setThemeName("ppdDark")}>PPD Dark</button>
          <button className={themeName === "sprawlball" ? "active" : ""} onClick={() => setThemeName("sprawlball")}>SprawlBall</button>
          <button className={themeName === "broadcast" ? "active" : ""} onClick={() => setThemeName("broadcast")}>Broadcast</button>
        </div>
        <div className="control-group">
          <label>Width</label>
          <select onChange={(e) => setWidth(Number(e.target.value))} value={width}>
            <option value={500}>500</option>
            <option value={700}>700</option>
            <option value={900}>900</option>
            <option value={1200}>1200</option>
          </select>
        </div>
        <div className="control-group">
          <label>Height</label>
          <select onChange={(e) => setHeight(Number(e.target.value))} value={height}>
            <option value={200}>200</option>
            <option value={250}>250</option>
            <option value={280}>280</option>
            <option value={350}>350</option>
          </select>
        </div>
      </div>

      <div className="viz-container momentum-panel">
        <MomentumChart
          height={height}
          hostPlayer="host"
          points={momentumPoints}
          showBreakPoints
          showSetBoundaries
          showSetLabels
          theme={theme}
          width={width}
        />
        <p className="viz-caption">
          {hostName} ({theme.playerHost}) vs {guestName} ({theme.playerGuest}) — break points marked as dots · dashed lines = set boundaries
        </p>
      </div>
    </div>
  );
}
