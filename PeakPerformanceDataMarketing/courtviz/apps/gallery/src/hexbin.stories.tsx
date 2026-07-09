import type { Story } from "@ladle/react";
import { Court, HexbinLayer } from "@courtviz/react";
import { createCourtScales } from "@courtviz/core";
import { broadcast, ppdDark, sprawlball, type CourtvizTheme } from "@courtviz/themes";
import { enrichedShots, guestName, hostName } from "@courtviz/data";

const themes: Record<string, CourtvizTheme> = { broadcast, ppdDark, sprawlball };

export const BounceHexmapHost: Story = () => {
  const theme = sprawlball;
  const scales = createCourtScales({ half: "near", height: 600, margin: 1.5, width: 600 });
  const groundstrokes = enrichedShots.filter(
    (s) => s.player === "host" && s.stroke !== "Serve" && s.result === "In",
  );

  return (
    <div>
      <Court half="near" height={600} surface="clay" theme={theme} width={600}>
        <HexbinLayer
          colorScale="efficiency"
          gridsize={6}
          half="near"
          minCount={2}
          player="host"
          scales={scales}
          shots={groundstrokes}
          theme={theme}
        />
      </Court>
      <p style={{ color: theme.ink, fontFamily: "Inter, sans-serif", fontSize: 13, marginTop: 8 }}>
        {hostName} groundstroke bounce locations — Size = frequency, Color = win rate
      </p>
    </div>
  );
};

export const BounceHexmapSpeed: Story = () => {
  const theme = sprawlball;
  const scales = createCourtScales({ half: "near", height: 600, margin: 1.5, width: 600 });
  const groundstrokes = enrichedShots.filter(
    (s) => s.player === "host" && s.stroke !== "Serve" && s.result === "In",
  );

  return (
    <div>
      <Court half="near" height={600} surface="clay" theme={theme} width={600}>
        <HexbinLayer
          colorScale="speed"
          gridsize={6}
          half="near"
          minCount={2}
          player="host"
          scales={scales}
          shots={groundstrokes}
          theme={theme}
        />
      </Court>
      <p style={{ color: theme.ink, fontFamily: "Inter, sans-serif", fontSize: 13, marginTop: 8 }}>
        {hostName} groundstroke bounce locations — Size = frequency, Color = avg speed
      </p>
    </div>
  );
};

export const BounceHexmapGuest: Story = () => {
  const theme = sprawlball;
  const scales = createCourtScales({ half: "near", height: 600, margin: 1.5, width: 600 });
  const groundstrokes = enrichedShots.filter(
    (s) => s.player === "guest" && s.stroke !== "Serve" && s.result === "In",
  );

  return (
    <div>
      <Court half="near" height={600} surface="clay" theme={theme} width={600}>
        <HexbinLayer
          colorScale="efficiency"
          gridsize={6}
          half="near"
          minCount={2}
          player="guest"
          scales={scales}
          shots={groundstrokes}
          theme={theme}
        />
      </Court>
      <p style={{ color: theme.ink, fontFamily: "Inter, sans-serif", fontSize: 13, marginTop: 8 }}>
        {guestName} groundstroke bounce locations — Size = frequency, Color = win rate
      </p>
    </div>
  );
};

export const HexmapDarkTheme: Story = () => {
  const theme = ppdDark;
  const scales = createCourtScales({ half: "near", height: 600, margin: 1.5, width: 600 });
  const groundstrokes = enrichedShots.filter(
    (s) => s.player === "host" && s.stroke !== "Serve" && s.result === "In",
  );

  return (
    <div>
      <Court half="near" height={600} surface="hard" theme={theme} width={600}>
        <HexbinLayer
          colorScale="efficiency"
          gridsize={6}
          half="near"
          minCount={2}
          player="host"
          scales={scales}
          shots={groundstrokes}
          theme={theme}
        />
      </Court>
    </div>
  );
};

export const HexmapAllThemes: Story = () => {
  const groundstrokes = enrichedShots.filter(
    (s) => s.player === "host" && s.stroke !== "Serve" && s.result === "In",
  );

  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: "24px" }}>
      {Object.entries(themes).map(([name, theme]) => {
        const scales = createCourtScales({ half: "near", height: 400, margin: 1.5, width: 400 });
        return (
          <div key={name} style={{ textAlign: "center" }}>
            <Court half="near" height={400} surface="clay" theme={theme} width={400}>
              <HexbinLayer
                colorScale="efficiency"
                gridsize={6}
                half="near"
                minCount={2}
                player="host"
                scales={scales}
                shots={groundstrokes}
                theme={theme}
              />
            </Court>
            <p style={{ color: theme.ink, fontFamily: "Inter, sans-serif", fontSize: 12 }}>
              {name}
            </p>
          </div>
        );
      })}
    </div>
  );
};
