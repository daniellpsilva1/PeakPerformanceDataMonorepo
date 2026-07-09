import { interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { bodyFont, condensedFont } from "../fonts";
import { PPD, theme } from "../ppd-tokens";

type StatCardProps = {
  delay?: number;
  hostLabel?: string;
  hostValue: string;
  guestLabel?: string;
  guestValue: string;
  title: string;
};

export function StatCard({
  delay = 0,
  hostLabel = "Host",
  hostValue,
  guestLabel = "Guest",
  guestValue,
  title,
}: StatCardProps) {
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
        backgroundColor: PPD.surface,
        border: `1px solid ${PPD.border}`,
        borderRadius: PPD.radius.sm,
        opacity: enter,
        padding: "20px 24px",
        transform: `translateY(${(1 - enter) * 16}px)`,
      }}
    >
      <div
        style={{
          color: PPD.textMuted,
          fontFamily: bodyFont,
          fontSize: 11,
          fontWeight: 500,
          letterSpacing: "0.5px",
          marginBottom: 16,
          textTransform: "uppercase",
        }}
      >
        {title}
      </div>
      <div style={{ display: "flex", justifyContent: "space-between" }}>
        <StatValue color={theme.playerHost} label={hostLabel} value={hostValue} />
        <StatValue
          align="right"
          color={theme.playerGuest}
          label={guestLabel}
          value={guestValue}
        />
      </div>
    </div>
  );
}

function StatValue({
  align = "left",
  color,
  label,
  value,
}: {
  align?: "left" | "right";
  color: string;
  label: string;
  value: string;
}) {
  return (
    <div style={{ textAlign: align }}>
      <div
        style={{
          color,
          fontFamily: condensedFont,
          fontSize: 32,
          fontWeight: 700,
          lineHeight: 1,
        }}
      >
        {value}
      </div>
      <div
        style={{
          color: PPD.textMuted,
          fontFamily: bodyFont,
          fontSize: 12,
          marginTop: 6,
        }}
      >
        {label}
      </div>
    </div>
  );
}

export function AnimatedCounter({
  delay = 0,
  duration = 30,
  suffix = "",
  target,
}: {
  delay?: number;
  duration?: number;
  suffix?: string;
  target: number;
}) {
  const frame = useCurrentFrame();
  const progress = interpolate(frame - delay, [0, duration], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const value = Math.round(target * progress);
  return <>{value}{suffix}</>;
}
