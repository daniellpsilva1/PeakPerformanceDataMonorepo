import { interpolate, useCurrentFrame } from "remotion";

type CourtZoomProps = {
  children: React.ReactNode;
  durationInFrames: number;
  from?: number;
  to?: number;
};

export function CourtZoom({
  children,
  durationInFrames,
  from = 1,
  to = 1.05,
}: CourtZoomProps) {
  const frame = useCurrentFrame();
  const scale = interpolate(frame, [0, durationInFrames], [from, to], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <div
      style={{
        transform: `scale(${scale})`,
        transformOrigin: "center center",
      }}
    >
      {children}
    </div>
  );
}
