"use client";

import { TOUR_STOPS } from "@bodyviz/core";

export interface TourControlsProps {
  currentStop: number;
  isPlaying: boolean;
  onNext: () => void;
  onPlayPause: () => void;
  onPrev: () => void;
  onSelect: (stop: number) => void;
}

export function TourControls({
  currentStop,
  isPlaying,
  onNext,
  onPlayPause,
  onPrev,
  onSelect,
}: TourControlsProps) {
  return (
    <div
      style={{
        alignItems: "center",
        bottom: "24px",
        display: "flex",
        gap: "8px",
        left: "24px",
        position: "absolute",
        zIndex: 10,
      }}
    >
      <button
        onClick={onPrev}
        style={btnStyle}
        title="Previous stop"
      >
        ◀
      </button>
      <button
        onClick={onPlayPause}
        style={{ ...btnStyle, minWidth: "40px" }}
        title={isPlaying ? "Pause" : "Play"}
      >
        {isPlaying ? "❚❚" : "▶"}
      </button>
      <button
        onClick={onNext}
        style={btnStyle}
        title="Next stop"
      >
        ▶
      </button>
      <div
        style={{
          alignItems: "center",
          display: "flex",
          gap: "4px",
          marginLeft: "8px",
        }}
      >
        {TOUR_STOPS.map((stop, i) => (
          <button
            key={stop.id}
            onClick={() => onSelect(i)}
            style={{
              background:
                i === currentStop
                  ? "rgba(59, 130, 246, 0.6)"
                  : "rgba(42, 53, 80, 0.6)",
              border: "none",
              borderRadius: "50%",
              cursor: "pointer",
              height: "8px",
              padding: 0,
              transition: "background 150ms ease",
              width: "8px",
            }}
            title={stop.title}
          />
        ))}
      </div>
    </div>
  );
}

const btnStyle: React.CSSProperties = {
  alignItems: "center",
  background: "rgba(20, 29, 51, 0.8)",
  backdropFilter: "blur(8px)",
  border: "1px solid rgba(42, 53, 80, 0.8)",
  borderRadius: "8px",
  color: "#F2F5FA",
  cursor: "pointer",
  display: "flex",
  fontFamily: "Inter, Helvetica Neue, Arial, sans-serif",
  fontSize: "14px",
  height: "36px",
  justifyContent: "center",
  padding: 0,
  transition: "all 150ms ease",
  width: "36px",
};
