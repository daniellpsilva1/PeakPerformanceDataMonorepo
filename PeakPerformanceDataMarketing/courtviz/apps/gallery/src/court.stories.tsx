import type { Story } from "@ladle/react";
import { Court } from "@courtviz/react";
import {
  broadcast,
  ppdDark,
  sprawlball,
  type CourtvizTheme,
} from "@courtviz/themes";
import type { CourtHalf, Surface } from "@courtviz/core";

const surfaces: Surface[] = ["clay", "hard", "grass"];
const themes: Record<string, CourtvizTheme> = { broadcast, ppdDark, sprawlball };
const halves: CourtHalf[] = ["full", "near", "far"];

export const CourtMatrix: Story = () => (
  <div style={{ display: "flex", flexWrap: "wrap", gap: "24px" }}>
    {Object.entries(themes).map(([themeName, theme]) =>
      surfaces.map((surface) =>
        halves.map((half) => (
          <div key={`${themeName}-${surface}-${half}`} style={{ textAlign: "center" }}>
            <Court
              height={300}
              half={half}
              surface={surface}
              theme={theme}
              width={300}
            />
            <p style={{ color: theme.ink, fontFamily: "Inter, sans-serif", fontSize: 12 }}>
              {themeName} · {surface} · {half}
            </p>
          </div>
        )),
      ),
    )}
  </div>
);

export const FullCourtClay: Story = () => (
  <Court height={600} surface="clay" width={600} />
);

export const FullCourtHard: Story = () => (
  <Court height={600} surface="hard" width={600} />
);

export const FullCourtGrass: Story = () => (
  <Court height={600} surface="grass" width={600} />
);

export const HalfCourtClay: Story = () => (
  <Court half="near" height={400} surface="clay" width={600} />
);

export const DarkThemeCourt: Story = () => (
  <Court height={600} surface="hard" theme={ppdDark} width={600} />
);

export const BroadcastCourt: Story = () => (
  <Court height={600} surface="hard" theme={broadcast} width={600} />
);

export const LandscapeCourt: Story = () => (
  <Court
    height={400}
    orientation="landscape"
    surface="clay"
    width={800}
  />
);
