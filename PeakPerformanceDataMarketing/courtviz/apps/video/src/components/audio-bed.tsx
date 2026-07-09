import { Audio } from "@remotion/media";
import { staticFile } from "remotion";
import { FPS, TOTAL_DURATION } from "../constants";

type AudioBedProps = {
  totalDuration?: number;
};

export function AudioBed({ totalDuration = TOTAL_DURATION }: AudioBedProps = {}) {
  return (
    <Audio
      src={staticFile("audio/ambient.mp3")}
      volume={(f) => {
        const fadeIn = Math.min(1, f / (2 * FPS));
        const fadeOut = Math.min(1, (totalDuration - f) / (3 * FPS));
        return 0.55 * fadeIn * fadeOut;
      }}
    />
  );
}
