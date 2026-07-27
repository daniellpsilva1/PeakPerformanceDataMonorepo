import type { Story } from "@ladle/react";
import { TOUR_STOPS, createTourState, getCurrentStop } from "@bodyviz/core";
import { demoSnapshots } from "@bodyviz/data";
import {
  BodyCanvas,
  BodyTwin,
  FallbackSilhouette,
  SystemSpotlight,
} from "@bodyviz/react";
import { colorPrimitives } from "@bodyviz/tokens";
import { useState } from "react";

const containerStyle: React.CSSProperties = {
  background: colorPrimitives.navy900,
  display: "flex",
  flexDirection: "column",
  gap: "16px",
  height: "500px",
  padding: "16px",
  position: "relative",
};

export const Fallback: Story = () => {
  const [stopIndex, setStopIndex] = useState(0);
  const stop = TOUR_STOPS[stopIndex]!;
  const snapshot = demoSnapshots[0]!;

  return (
    <div style={containerStyle}>
      <div style={{ flex: 1, position: "relative" }}>
        <FallbackSilhouette
          activeSystem={stop.id}
          snapshot={snapshot}
          tourStop={stop}
        />
      </div>
      <div style={{ display: "flex", gap: "8px" }}>
        {TOUR_STOPS.map((s, i) => (
          <button
            key={s.id}
            onClick={() => setStopIndex(i)}
            style={{
              background: i === stopIndex
                ? colorPrimitives.primaryBright
                : colorPrimitives.navy700,
              border: "none",
              borderRadius: "4px",
              color: colorPrimitives.ink,
              cursor: "pointer",
              padding: "4px 12px",
            }}
          >
            {s.title}
          </button>
        ))}
      </div>
    </div>
  );
};

export const SystemSpotlightGallery: Story = () => {
  const snapshot = demoSnapshots[0]!;
  return (
    <div style={containerStyle}>
      {TOUR_STOPS.map((stop) => (
        <SystemSpotlight
          key={stop.id}
          provider="demo"
          snapshot={snapshot}
          stop={stop}
        />
      ))}
    </div>
  );
};

export const BodyTwinGallery: Story = () => {
  const [stopIndex, setStopIndex] = useState(0);
  const stop = TOUR_STOPS[stopIndex]!;
  const snapshot = demoSnapshots[0]!;

  return (
    <div style={containerStyle}>
      <div style={{ flex: 1, position: "relative" }}>
        <BodyCanvas>
          <BodyTwin
            activeSystem={stop.id}
            snapshot={snapshot}
            tourStop={stop}
          />
        </BodyCanvas>
      </div>
      <div style={{ display: "flex", gap: "8px" }}>
        {TOUR_STOPS.map((s, i) => (
          <button
            key={s.id}
            onClick={() => setStopIndex(i)}
            style={{
              background: i === stopIndex
                ? colorPrimitives.primaryBright
                : colorPrimitives.navy700,
              border: "none",
              borderRadius: "4px",
              color: colorPrimitives.ink,
              cursor: "pointer",
              padding: "4px 12px",
            }}
          >
            {s.title}
          </button>
        ))}
      </div>
    </div>
  );
};
