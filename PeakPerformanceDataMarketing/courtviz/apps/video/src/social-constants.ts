import { linearTiming } from "@remotion/transitions";

export const SOCIAL_FPS = 30;
export const SOCIAL_WIDTH = 1080;
export const SOCIAL_HEIGHT = 1920;
export const SOCIAL_TRANSITION = linearTiming({ durationInFrames: 18 });

export const SOCIAL_DURATIONS = {
  title: 4 * SOCIAL_FPS,
  hexbin: 8 * SOCIAL_FPS,
  momentum: 8 * SOCIAL_FPS,
  stats: 5 * SOCIAL_FPS,
  outro: 4 * SOCIAL_FPS,
} as const;

const SOCIAL_TRANSITION_FRAMES = SOCIAL_TRANSITION.getDurationInFrames({ fps: SOCIAL_FPS });

export const SOCIAL_TOTAL_DURATION =
  SOCIAL_DURATIONS.title +
  SOCIAL_DURATIONS.hexbin +
  SOCIAL_DURATIONS.momentum +
  SOCIAL_DURATIONS.stats +
  SOCIAL_DURATIONS.outro -
  4 * SOCIAL_TRANSITION_FRAMES;
