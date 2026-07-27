"use client";

import type { DailySnapshot } from "@bodyviz/core";

export interface DayScrubberProps {
  snapshots: DailySnapshot[];
  selectedIndex: number;
  onSelect: (index: number) => void;
  todayLabel?: string;
  demoLabel?: string;
}

export function DayScrubber({
  snapshots,
  selectedIndex,
  onSelect,
  demoLabel = "Demo / sample data",
  todayLabel = "Today",
}: DayScrubberProps) {
  return (
    <div
      style={{
        alignItems: "center",
        bottom: "24px",
        display: "flex",
        flexDirection: "column",
        gap: "10px",
        left: "50%",
        position: "absolute",
        transform: "translateX(-50%)",
        zIndex: 10,
      }}
    >
      <span
        style={{
          color: "#64748B",
          fontFamily: "Inter, Helvetica Neue, Arial, sans-serif",
          fontSize: "10px",
          letterSpacing: "1px",
          textTransform: "uppercase",
        }}
      >
        {demoLabel}
      </span>
      <div
        style={{
          alignItems: "center",
          background: "rgba(15, 23, 42, 0.8)",
          backdropFilter: "blur(8px)",
          borderRadius: "12px",
          display: "flex",
          gap: "2px",
          padding: "6px",
        }}
      >
        {snapshots.map((snap, i) => {
          const isSelected = i === selectedIndex;
          const hasData = snap.sleep.score !== null || snap.rhr.bpm !== null;
          const isToday = i === snapshots.length - 1;
          const dayLabel = snap.date.slice(8);
          const dayNum = parseInt(dayLabel, 10);

          return (
            <button
              key={snap.date}
              onClick={() => onSelect(i)}
              style={{
                alignItems: "center",
                background: isSelected
                  ? "rgba(59, 130, 246, 0.25)"
                  : "transparent",
                border: isSelected
                  ? "1px solid rgba(59, 130, 246, 0.5)"
                  : "1px solid transparent",
                borderRadius: "8px",
                color: isSelected
                  ? "#F2F5FA"
                  : hasData
                    ? "#9AA7BD"
                    : "#475569",
                cursor: "pointer",
                display: "flex",
                flexDirection: "column",
                fontFamily: "Inter, Helvetica Neue, Arial, sans-serif",
                fontSize: "11px",
                gap: "2px",
                opacity: hasData ? 1 : 0.4,
                padding: "6px 10px",
                transition: "all 150ms ease",
              }}
            >
              <span style={{ fontWeight: 600 }}>{dayNum}</span>
              {isToday && (
                <span
                  style={{
                    color: "#10B981",
                    fontSize: "8px",
                    letterSpacing: "0.5px",
                    textTransform: "uppercase",
                  }}
                >
                  {todayLabel}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
