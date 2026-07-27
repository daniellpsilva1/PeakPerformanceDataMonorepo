"use client";

import type { BodySystemId } from "@bodyviz/tokens";
import { bodySystemColors } from "@bodyviz/tokens";
import type { DailySnapshot } from "@bodyviz/core";
import { isStopAvailable, stopHasData, type TourStop } from "@bodyviz/core";
import { getMetricForSystem } from "./metrics";

export interface SystemSpotlightProps {
  stop: TourStop;
  snapshot: DailySnapshot;
  provider: "garmin" | "whoop" | "polar" | "mixed" | "demo";
  unavailableLabel?: string;
  noDataLabel?: string;
}

export function SystemSpotlight({
  stop,
  snapshot,
  provider,
  noDataLabel = "No data available for this day",
  unavailableLabel = "Unavailable on this wearable",
}: SystemSpotlightProps) {
  const colors = bodySystemColors[stop.id as BodySystemId];
  const available = isStopAvailable(stop.id, provider);
  const hasData = stopHasData(stop.id, snapshot);
  const metric = getMetricForSystem(stop.id, snapshot);

  return (
    <div
      style={{
        alignItems: "flex-start",
        display: "flex",
        flexDirection: "column",
        gap: "8px",
      }}
    >
      <div
        style={{
          alignItems: "center",
          display: "flex",
          gap: "10px",
        }}
      >
        <span
          style={{
            backgroundColor: colors.glow,
            borderRadius: "50%",
            display: "inline-block",
            height: "10px",
            width: "10px",
          }}
        />
        <h2
          style={{
            color: "#F2F5FA",
            fontFamily: "Barlow Condensed, Arial Narrow, sans-serif",
            fontSize: "28px",
            fontWeight: 700,
            letterSpacing: "0.5px",
            margin: 0,
            textTransform: "uppercase",
          }}
        >
          {stop.title}
        </h2>
      </div>

      <p
        style={{
          color: "#9AA7BD",
          fontFamily: "Inter, Helvetica Neue, Arial, sans-serif",
          fontSize: "14px",
          lineHeight: 1.5,
          margin: 0,
          maxWidth: "380px",
        }}
      >
        {stop.description}
      </p>

      {available ? (
        hasData ? (
          <div
            style={{
              alignItems: "baseline",
              display: "flex",
              gap: "6px",
              marginTop: "4px",
            }}
          >
            <span
              style={{
                color: colors.glow,
                fontFamily: "Barlow Condensed, Arial Narrow, sans-serif",
                fontSize: "42px",
                fontWeight: 700,
                lineHeight: 1,
              }}
            >
              {metric.display}
            </span>
          </div>
        ) : (
          <span
            style={{
              color: "#64748B",
              fontFamily: "Inter, Helvetica Neue, Arial, sans-serif",
              fontSize: "13px",
              fontStyle: "italic",
              marginTop: "4px",
            }}
          >
            {noDataLabel}
          </span>
        )
      ) : (
        <span
          style={{
            color: "#64748B",
            fontFamily: "Inter, Helvetica Neue, Arial, sans-serif",
            fontSize: "13px",
            fontStyle: "italic",
            marginTop: "4px",
          }}
        >
          {unavailableLabel}
        </span>
      )}
    </div>
  );
}
