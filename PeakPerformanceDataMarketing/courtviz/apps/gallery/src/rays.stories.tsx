import type { Story } from "@ladle/react";
import { Court, RayLayer } from "@courtviz/react";
import { createCourtScales } from "@courtviz/core";
import { sprawlball } from "@courtviz/themes";
import { enrichedShots } from "@courtviz/data";

export const AllRaysFullCourt: Story = () => {
  const theme = sprawlball;
  const scales = createCourtScales({ half: "full", height: 800, margin: 1.5, width: 600 });

  return (
    <div>
      <Court half="full" height={800} surface="clay" theme={theme} width={600}>
        <RayLayer
          alpha={0.2}
          scales={scales}
          shots={enrichedShots}
          theme={theme}
        />
      </Court>
      <p style={{ color: theme.ink, fontFamily: "Inter, sans-serif", fontSize: 13, marginTop: 8 }}>
        All shot trajectories — hit → bounce with arrowheads
      </p>
    </div>
  );
};

export const ForehandRaysHalfCourt: Story = () => {
  const theme = sprawlball;
  const scales = createCourtScales({ half: "near", height: 600, margin: 1.5, width: 600 });

  return (
    <div>
      <Court half="near" height={600} surface="clay" theme={theme} width={600}>
        <RayLayer
          alpha={0.4}
          player="host"
          scales={scales}
          shots={enrichedShots}
          strokeFilter={["Forehand"]}
          theme={theme}
          useHalfCourtNormalization
        />
      </Court>
      <p style={{ color: theme.ink, fontFamily: "Inter, sans-serif", fontSize: 13, marginTop: 8 }}>
        Host forehand trajectories — half-court normalized
      </p>
    </div>
  );
};

export const BackhandRaysHalfCourt: Story = () => {
  const theme = sprawlball;
  const scales = createCourtScales({ half: "near", height: 600, margin: 1.5, width: 600 });

  return (
    <div>
      <Court half="near" height={600} surface="clay" theme={theme} width={600}>
        <RayLayer
          alpha={0.4}
          player="host"
          scales={scales}
          shots={enrichedShots}
          strokeFilter={["Backhand"]}
          theme={theme}
          useHalfCourtNormalization
        />
      </Court>
      <p style={{ color: theme.ink, fontFamily: "Inter, sans-serif", fontSize: 13, marginTop: 8 }}>
        Host backhand trajectories — half-court normalized
      </p>
    </div>
  );
};
