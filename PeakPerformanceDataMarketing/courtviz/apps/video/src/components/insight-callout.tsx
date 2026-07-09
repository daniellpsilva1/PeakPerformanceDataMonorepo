import { spring, useCurrentFrame, useVideoConfig } from "remotion";
import { bodyFont } from "../fonts";
import { PPD, theme } from "../ppd-tokens";

type InsightCalloutProps = {
  delay?: number;
  text: string;
};

export function InsightCallout({ delay = 20, text }: InsightCalloutProps) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const enter = spring({
    config: { damping: 200 },
    delay,
    fps,
    frame,
  });

  return (
    <div
      style={{
        bottom: 120,
        left: "50%",
        maxWidth: 1100,
        opacity: enter,
        position: "absolute",
        transform: `translateX(-50%) translateY(${(1 - enter) * 10}px)`,
        zIndex: 15,
      }}
    >
      <div
        style={{
          backgroundColor: theme.annotation.calloutFill,
          border: `1px solid ${PPD.border}`,
          borderLeft: `3px solid ${theme.playerHost}`,
          borderRadius: 8,
          color: theme.annotation.calloutTextColor,
          fontFamily: bodyFont,
          fontSize: 19,
          lineHeight: 1.45,
          padding: "14px 28px",
        }}
      >
        {text}
      </div>
    </div>
  );
}
