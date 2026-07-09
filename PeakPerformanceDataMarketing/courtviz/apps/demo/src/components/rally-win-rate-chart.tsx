import type { RallyBucketStat } from "@courtviz/core";
import type { CourtvizTheme } from "@courtviz/themes";

interface RallyWinRateChartProps {
  hostBuckets: RallyBucketStat[];
  guestBuckets: RallyBucketStat[];
  hostName: string;
  guestName: string;
  theme: CourtvizTheme;
  width?: number;
  height?: number;
}

export function RallyWinRateChart({
  guestBuckets,
  guestName,
  height = 220,
  hostBuckets,
  hostName,
  theme,
  width = 360,
}: RallyWinRateChartProps) {
  const padding = { bottom: 36, left: 36, right: 12, top: 16 };
  const chartW = width - padding.left - padding.right;
  const chartH = height - padding.top - padding.bottom;
  const hasData = hostBuckets.some((b) => b.total > 0) || guestBuckets.some((b) => b.total > 0);

  const barWidth = 28;
  const groupGap = 48;
  const pairGap = 4;

  return (
    <svg aria-label="Rally length win rates" height={height} width={width}>
      <rect fill={theme.background} height={height} rx={8} width={width} />

      {!hasData ? (
        <text
          fill={theme.inkMuted}
          fontFamily={theme.fonts.bodyFont}
          fontSize={12}
          textAnchor="middle"
          x={width / 2}
          y={height / 2}
        >
          Rally length data unavailable
        </text>
      ) : (
        <>
          {[0, 0.25, 0.5, 0.75, 1].map((tick) => {
            const y = padding.top + chartH - tick * chartH;
            return (
              <g key={tick}>
                <line
                  stroke={theme.inkMuted}
                  strokeDasharray={tick === 0 ? undefined : "2,3"}
                  strokeOpacity={0.25}
                  x1={padding.left}
                  x2={padding.left + chartW}
                  y1={y}
                  y2={y}
                />
                <text
                  fill={theme.inkMuted}
                  fontFamily={theme.fonts.bodyFont}
                  fontSize={10}
                  textAnchor="end"
                  x={padding.left - 6}
                  y={y + 3}
                >
                  {Math.round(tick * 100)}%
                </text>
              </g>
            );
          })}

          {hostBuckets.map((bucket, i) => {
            const guestBucket = guestBuckets[i];
            const groupX = padding.left + i * (barWidth * 2 + pairGap + groupGap);
            const hostH = Math.round(bucket.winRate * chartH);
            const guestH = guestBucket ? Math.round(guestBucket.winRate * chartH) : 0;
            const baseY = padding.top + chartH;

            return (
              <g key={bucket.bucket}>
                <rect
                  fill={theme.playerHost}
                  height={hostH}
                  opacity={0.9}
                  rx={2}
                  width={barWidth}
                  x={groupX}
                  y={baseY - hostH}
                />
                <rect
                  fill={theme.playerGuest}
                  height={guestH}
                  opacity={0.9}
                  rx={2}
                  width={barWidth}
                  x={groupX + barWidth + pairGap}
                  y={baseY - guestH}
                />
                {hostH > 14 && (
                  <text
                    fill={theme.background}
                    fontFamily={theme.fonts.bodyFont}
                    fontSize={9}
                    fontWeight={600}
                    textAnchor="middle"
                    x={groupX + barWidth / 2}
                    y={baseY - hostH + 12}
                  >
                    {Math.round(bucket.winRate * 100)}%
                  </text>
                )}
                {guestH > 14 && guestBucket && (
                  <text
                    fill={theme.background}
                    fontFamily={theme.fonts.bodyFont}
                    fontSize={9}
                    fontWeight={600}
                    textAnchor="middle"
                    x={groupX + barWidth + pairGap + barWidth / 2}
                    y={baseY - guestH + 12}
                  >
                    {Math.round(guestBucket.winRate * 100)}%
                  </text>
                )}
                <text
                  fill={theme.ink}
                  fontFamily={theme.fonts.condensedFont}
                  fontSize={11}
                  fontWeight={600}
                  textAnchor="middle"
                  x={groupX + barWidth + pairGap / 2}
                  y={baseY + 16}
                >
                  {bucket.bucket} shots
                </text>
                <text
                  fill={theme.inkMuted}
                  fontFamily={theme.fonts.bodyFont}
                  fontSize={9}
                  textAnchor="middle"
                  x={groupX + barWidth + pairGap / 2}
                  y={baseY + 28}
                >
                  n={bucket.total}
                </text>
              </g>
            );
          })}

          <text
            fill={theme.inkMuted}
            fontFamily={theme.fonts.bodyFont}
            fontSize={10}
            x={padding.left}
            y={height - 6}
          >
            {hostName} (left) · {guestName} (right) — point win rate by rally length
          </text>
        </>
      )}
    </svg>
  );
}
