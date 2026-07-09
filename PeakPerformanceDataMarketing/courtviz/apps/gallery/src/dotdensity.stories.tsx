import type { Story } from "@ladle/react";
import { Court, DotLayer, Legend } from "@courtviz/react";
import { createCourtScales } from "@courtviz/core";
import { sprawlball } from "@courtviz/themes";
import { enrichedShots } from "@courtviz/data";

export const AllShotsDotDensity: Story = () => {
  const theme = sprawlball;
  const scales = createCourtScales({ half: "full", height: 800, margin: 1.5, width: 600 });

  return (
    <div>
      <Court half="full" height={800} surface="clay" theme={theme} width={600}>
        <DotLayer
          alpha={0.5}
          colorBy="stroke"
          scales={scales}
          shots={enrichedShots}
          size={4}
          theme={theme}
        />
      </Court>
      <p style={{ color: theme.ink, fontFamily: "Inter, sans-serif", fontSize: 13, marginTop: 8 }}>
        All shots dot density — colored by stroke type
      </p>
    </div>
  );
};

export const HostShotsBySpeed: Story = () => {
  const theme = sprawlball;
  const scales = createCourtScales({ half: "full", height: 800, margin: 1.5, width: 600 });

  return (
    <div>
      <Court half="full" height={800} surface="clay" theme={theme} width={600}>
        <DotLayer
          alpha={0.6}
          colorBy="speed"
          player="host"
          scales={scales}
          shots={enrichedShots}
          size={5}
          theme={theme}
        />
      </Court>
      <p style={{ color: theme.ink, fontFamily: "Inter, sans-serif", fontSize: 13, marginTop: 8 }}>
        Host shots colored by speed (turbo colormap)
      </p>
    </div>
  );
};

export const TerminalShotsMap: Story = () => {
  const theme = sprawlball;
  const scales = createCourtScales({ half: "near", height: 600, margin: 1.5, width: 600 });

  return (
    <div>
      <Court half="near" height={600} surface="clay" theme={theme} width={600}>
        <DotLayer
          alpha={0.7}
          colorBy="player"
          resultFilter="Out"
          scales={scales}
          shots={enrichedShots}
          size={6}
          theme={theme}
          useHalfCourtNormalization
        />
      </Court>
      <p style={{ color: theme.ink, fontFamily: "Inter, sans-serif", fontSize: 13, marginTop: 8 }}>
        Terminal shots (Out) — half-court normalized, colored by player
      </p>
    </div>
  );
};

export const DotDensityWithLegend: Story = () => {
  const theme = sprawlball;
  const scales = createCourtScales({ half: "full", height: 800, margin: 1.5, width: 600 });

  const legendItems = [
    { color: "#E8742C", label: "Forehand" },
    { color: "#2B6CB0", label: "Backhand" },
    { color: "#38A169", label: "Volley" },
    { color: "#805AD5", label: "Serve" },
    { color: "#D53F8C", label: "Overhead" },
  ];

  return (
    <div>
      <Court half="full" height={800} surface="clay" theme={theme} width={600}>
        <DotLayer
          alpha={0.5}
          colorBy="stroke"
          scales={scales}
          shots={enrichedShots}
          size={4}
          theme={theme}
        />
      </Court>
      <svg height={100} width={300}>
        <Legend items={legendItems} theme={theme} x={10} y={10} />
      </svg>
    </div>
  );
};
