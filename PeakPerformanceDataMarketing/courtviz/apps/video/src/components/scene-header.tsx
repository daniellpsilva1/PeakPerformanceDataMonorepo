import { interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { bodyFont, condensedFont } from "../fonts";
import { PPD, theme } from "../ppd-tokens";

type SceneHeaderProps = {
  subtitle?: string;
  title: string;
};

export function SceneHeader({ subtitle, title }: SceneHeaderProps) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const progress = spring({
    config: { damping: 200 },
    fps,
    frame,
  });

  const lineWidth = interpolate(progress, [0, 1], [0, 48]);

  return (
    <div
      style={{
        left: 80,
        opacity: progress,
        position: "absolute",
        top: 64,
        transform: `translateY(${(1 - progress) * -16}px)`,
        zIndex: 10,
      }}
    >
      <div
        style={{
          backgroundColor: PPD.accent,
          height: 2,
          marginBottom: 12,
          width: lineWidth,
        }}
      />
      <div
        style={{
          color: theme.ink,
          fontFamily: condensedFont,
          fontSize: 40,
          fontWeight: 700,
          letterSpacing: "0.03em",
          lineHeight: 1,
          textTransform: "uppercase",
        }}
      >
        {title}
      </div>
      {subtitle ? (
        <div
          style={{
            color: PPD.textMuted,
            fontFamily: bodyFont,
            fontSize: 16,
            marginTop: 8,
          }}
        >
          {subtitle}
        </div>
      ) : null}
    </div>
  );
}
