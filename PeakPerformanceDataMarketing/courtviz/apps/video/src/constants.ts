import { linearTiming, springTiming } from "@remotion/transitions";

export const FPS = 30;
export const WIDTH = 1920;
export const HEIGHT = 1080;
export const TOTAL_SCENES = 8;

export const SCENE_DURATIONS = {
  title: 5 * FPS,
  shotRain: 10 * FPS,
  hexbinReveal: 9 * FPS,
  shotTrajectories: 9 * FPS,
  servePlacement: 8 * FPS,
  momentum: 9 * FPS,
  statsSpotlight: 6 * FPS,
  outro: 5 * FPS,
} as const;

export const FADE_TRANSITION = linearTiming({ durationInFrames: 18 });
export const SPRING_TRANSITION = springTiming({
  config: { damping: 200 },
  durationInFrames: 22,
});

export const TOTAL_DURATION =
  SCENE_DURATIONS.title +
  SCENE_DURATIONS.shotRain +
  SCENE_DURATIONS.hexbinReveal +
  SCENE_DURATIONS.shotTrajectories +
  SCENE_DURATIONS.servePlacement +
  SCENE_DURATIONS.momentum +
  SCENE_DURATIONS.statsSpotlight +
  SCENE_DURATIONS.outro -
  7 * FADE_TRANSITION.getDurationInFrames({ fps: FPS });
