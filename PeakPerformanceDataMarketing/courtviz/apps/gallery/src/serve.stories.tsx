import type { Story } from "@ladle/react";
import { Court, ServeLayer } from "@courtviz/react";
import { createCourtScales } from "@courtviz/core";
import { sprawlball } from "@courtviz/themes";
import { enrichedShots, guestName, hostName } from "@courtviz/data";

export const ServePlacementBoth: Story = () => {
  const theme = sprawlball;
  const scales = createCourtScales({ half: "near", height: 600, margin: 1.5, width: 600 });

  return (
    <div>
      <Court half="near" height={600} surface="clay" theme={theme} width={600}>
        <ServeLayer
          player="host"
          scales={scales}
          shots={enrichedShots}
          theme={theme}
        />
        <ServeLayer
          player="guest"
          scales={scales}
          shots={enrichedShots}
          theme={theme}
        />
      </Court>
      <p style={{ color: theme.ink, fontFamily: "Inter, sans-serif", fontSize: 13, marginTop: 8 }}>
        Serve placement — Orange = {hostName}, Blue = {guestName} (faded = out)
      </p>
    </div>
  );
};

export const FirstServeHost: Story = () => {
  const theme = sprawlball;
  const scales = createCourtScales({ half: "near", height: 600, margin: 1.5, width: 600 });

  return (
    <div>
      <Court half="near" height={600} surface="clay" theme={theme} width={600}>
        <ServeLayer
          player="host"
          scales={scales}
          serveType="first_serve"
          shots={enrichedShots}
          theme={theme}
        />
      </Court>
      <p style={{ color: theme.ink, fontFamily: "Inter, sans-serif", fontSize: 13, marginTop: 8 }}>
        {hostName} — 1st serve placement
      </p>
    </div>
  );
};

export const SecondServeHost: Story = () => {
  const theme = sprawlball;
  const scales = createCourtScales({ half: "near", height: 600, margin: 1.5, width: 600 });

  return (
    <div>
      <Court half="near" height={600} surface="clay" theme={theme} width={600}>
        <ServeLayer
          player="host"
          scales={scales}
          serveType="second_serve"
          shots={enrichedShots}
          theme={theme}
        />
      </Court>
      <p style={{ color: theme.ink, fontFamily: "Inter, sans-serif", fontSize: 13, marginTop: 8 }}>
        {hostName} — 2nd serve placement
      </p>
    </div>
  );
};

export const ServeSideBySide: Story = () => {
  const theme = sprawlball;

  return (
    <div style={{ display: "flex", gap: "24px" }}>
      {(["first_serve", "second_serve"] as const).map((serveType) => {
        const scales = createCourtScales({ half: "near", height: 500, margin: 1.5, width: 500 });
        return (
          <div key={serveType} style={{ textAlign: "center" }}>
            <Court half="near" height={500} surface="clay" theme={theme} width={500}>
              <ServeLayer
                player="host"
                scales={scales}
                serveType={serveType}
                shots={enrichedShots}
                theme={theme}
              />
              <ServeLayer
                player="guest"
                scales={scales}
                serveType={serveType}
                shots={enrichedShots}
                theme={theme}
              />
            </Court>
            <p style={{ color: theme.ink, fontFamily: "Inter, sans-serif", fontSize: 12, marginTop: 4 }}>
              {serveType === "first_serve" ? "1ST SERVE" : "2ND SERVE"}
            </p>
          </div>
        );
      })}
    </div>
  );
};
