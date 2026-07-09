import { condensedFont, bodyFont } from "../fonts";
import { theme } from "../ppd-tokens";

type CourtCardProps = {
  accentColor: string;
  children: React.ReactNode;
  label: string;
  labelOpacity?: number;
  subtitle?: string;
};

export function CourtCard({
  accentColor,
  children,
  label,
  labelOpacity = 1,
  subtitle,
}: CourtCardProps) {
  return (
    <div
      style={{
        backgroundColor: "rgba(255,255,255,0.04)",
        border: "1px solid #FFFFFF14",
        borderRadius: 12,
        padding: 16,
      }}
    >
      <div
        style={{
          borderBottom: `2px solid ${accentColor}`,
          color: accentColor,
          fontFamily: condensedFont,
          fontSize: 15,
          fontWeight: 700,
          letterSpacing: "0.06em",
          marginBottom: subtitle ? 8 : 20,
          opacity: labelOpacity,
          paddingBottom: 6,
          textTransform: "uppercase",
        }}
      >
        {label}
      </div>
      {subtitle ? (
        <div
          style={{
            color: theme.inkMuted,
            fontFamily: bodyFont,
            fontSize: 12,
            marginBottom: 20,
            opacity: labelOpacity,
          }}
        >
          {subtitle}
        </div>
      ) : null}
      {children}
    </div>
  );
}
