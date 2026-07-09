import type { Story } from "@ladle/react";
import { MomentumChart, ColorBar } from "@courtviz/react";
import { sprawlball, ppdDark } from "@courtviz/themes";
import { momentumPoints, hostName } from "@courtviz/data";

export const MomentumFull: Story = () => {
  const theme = sprawlball;

  return (
    <div style={{ background: theme.background, padding: 20, borderRadius: 8 }}>
      <MomentumChart
        height={250}
        hostPlayer="host"
        points={momentumPoints}
        theme={theme}
        width={900}
      />
      <p style={{ color: theme.ink, fontFamily: "Inter, sans-serif", fontSize: 13, marginTop: 8 }}>
        Point-win momentum — {hostName} vs Boluda (positive = host winning)
      </p>
    </div>
  );
};

export const MomentumDark: Story = () => {
  const theme = ppdDark;

  return (
    <div style={{ background: theme.background, padding: 20, borderRadius: 8 }}>
      <MomentumChart
        height={200}
        hostPlayer="host"
        points={momentumPoints}
        theme={theme}
        width={700}
      />
    </div>
  );
};

export const MomentumCompact: Story = () => {
  const theme = sprawlball;

  return (
    <div style={{ background: theme.background, padding: 16, borderRadius: 8 }}>
      <MomentumChart
        height={150}
        hostPlayer="host"
        points={momentumPoints}
        theme={theme}
        width={500}
      />
    </div>
  );
};

export const ColorBarEfficiency: Story = () => {
  const theme = sprawlball;

  return (
    <div style={{ background: theme.background, padding: 20, borderRadius: 8 }}>
      <svg height={40} width={250}>
        <ColorBar
          label="Win Rate"
          max="100%"
          min="0%"
          theme={theme}
          width={200}
        />
      </svg>
    </div>
  );
};
