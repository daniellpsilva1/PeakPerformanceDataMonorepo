import { Composition } from "remotion";
import { FPS, HEIGHT, TOTAL_DURATION, WIDTH } from "./constants";
import { MatchRecap } from "./match-recap";
import { MatchRecapSocial } from "./match-recap-social";
import {
  SOCIAL_FPS,
  SOCIAL_HEIGHT,
  SOCIAL_TOTAL_DURATION,
  SOCIAL_WIDTH,
} from "./social-constants";

export function RemotionRoot() {
  return (
    <>
      <Composition
        component={MatchRecap}
        durationInFrames={TOTAL_DURATION}
        fps={FPS}
        height={HEIGHT}
        id="MatchRecap"
        width={WIDTH}
      />
      <Composition
        component={MatchRecapSocial}
        durationInFrames={SOCIAL_TOTAL_DURATION}
        fps={SOCIAL_FPS}
        height={SOCIAL_HEIGHT}
        id="MatchRecapSocial"
        width={SOCIAL_WIDTH}
      />
    </>
  );
}
