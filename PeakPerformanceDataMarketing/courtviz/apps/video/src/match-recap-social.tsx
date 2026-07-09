import { TransitionSeries } from "@remotion/transitions";
import { fade } from "@remotion/transitions/fade";
import { AbsoluteFill } from "remotion";
import { AudioBed } from "./components/audio-bed";
import { SocialTitleScene } from "./scenes/social-title";
import { OutroScene } from "./scenes/outro";
import { SocialHexbinScene } from "./scenes/social-hexbin";
import { SocialMomentumScene } from "./scenes/social-momentum";
import { SocialStatsScene } from "./scenes/social-stats";
import {
  SOCIAL_DURATIONS,
  SOCIAL_TOTAL_DURATION,
  SOCIAL_TRANSITION,
} from "./social-constants";

export function MatchRecapSocial() {
  return (
    <AbsoluteFill style={{ backgroundColor: "#000000" }}>
      <AudioBed totalDuration={SOCIAL_TOTAL_DURATION} />
      <TransitionSeries>
        <TransitionSeries.Sequence durationInFrames={SOCIAL_DURATIONS.title}>
          <SocialTitleScene />
        </TransitionSeries.Sequence>

        <TransitionSeries.Transition presentation={fade()} timing={SOCIAL_TRANSITION} />

        <TransitionSeries.Sequence durationInFrames={SOCIAL_DURATIONS.hexbin}>
          <SocialHexbinScene />
        </TransitionSeries.Sequence>

        <TransitionSeries.Transition presentation={fade()} timing={SOCIAL_TRANSITION} />

        <TransitionSeries.Sequence durationInFrames={SOCIAL_DURATIONS.momentum}>
          <SocialMomentumScene />
        </TransitionSeries.Sequence>

        <TransitionSeries.Transition presentation={fade()} timing={SOCIAL_TRANSITION} />

        <TransitionSeries.Sequence durationInFrames={SOCIAL_DURATIONS.stats}>
          <SocialStatsScene />
        </TransitionSeries.Sequence>

        <TransitionSeries.Transition presentation={fade()} timing={SOCIAL_TRANSITION} />

        <TransitionSeries.Sequence durationInFrames={SOCIAL_DURATIONS.outro}>
          <OutroScene />
        </TransitionSeries.Sequence>
      </TransitionSeries>
    </AbsoluteFill>
  );
}
