# Guide 02 — Progress Page (longitudinal) — BUILD FIRST

Files:
- `src/components/tennis-analytics/TennisProgressContent.tsx` (page + `ProgressBody`)
- `src/components/tennis-analytics/tennisProgressCharts.tsx` (chart primitives)
- i18n: `tennisAnalytics.progress.*` in all four locales

Prerequisite: Guide 01 (new `ProgressMatchMetrics` fields available via the evolution API).

Reference mapping — the Kaitlin report's longitudinal sections map to these new/updated sections:

| Kaitlin section | Progress page section | Status |
|---|---|---|
| Headline metric cards + trend | Headline cards (NEW) | add |
| Performance radar | Skill radar | keep, enhance labels |
| "What correlates with winning" | Win Correlations (NEW) | add |
| Key findings (severity) | Key Findings (NEW) | add |
| Development priorities | Focus Areas | keep, enrich |
| Serve evolution | Serve section | keep |
| Groundstroke reliability + usage + aggression | Groundstroke + Style (NEW charts) | add |
| Depth & rally structure | Depth & Rally (NEW) | add |
| Return performance | Return section (enrich) | add charts |
| Clutch / break points | Return & Break section | keep |

---

## Step 1 — Headline metric cards with trend (top of `ProgressBody`)

Goal: replace the bare `SummaryRow` row with a richer header — record + win% + 4 trend cards
(first serve %, point/return win, winners, deep %) showing recent value and delta vs early period.

1. New primitive in `tennisProgressCharts.tsx`: `HeadlineStat`.

```tsx
export function HeadlineStat({ accent, deltaLabel, label, sub, trend, value }: {
  accent: 'amber' | 'emerald' | 'red' | 'slate';
  deltaLabel?: string | null;
  label: string;
  sub?: string;
  trend?: 'down' | 'flat' | 'up' | null;
  value: string;
}) {
  // big tabular-nums value, uppercase label, optional Δ chip with arrow (lucide ArrowUp/Down)
  // color: emerald for good trend, red for bad, muted for flat
}
```

2. In `ProgressBody`, derive each card from `getMetricProgress(matches, key)` (already in
   `progress-insights.ts`) — `.recent`, `.delta`, `.direction`. Map direction+sign → good/bad.
   Use a tiny helper:

```ts
function trendTone(delta: number | null, direction: 'higher' | 'lower'): 'down' | 'flat' | 'up' | null {
  if (delta == null || delta === 0) return delta === 0 ? 'flat' : null;
  const improving = direction === 'higher' ? delta > 0 : delta < 0;
  return improving ? 'up' : 'down';
}
```

3. Layout: `grid grid-cols-2 sm:grid-cols-4 gap-3`. Keep the existing `SummaryRow` (record/win%)
   above or fold its two tiles into the grid.

i18n: reuse existing `metrics.*` labels; add `progress.headline.delta` ("{delta} vs early").

Verify: `npm run build`; visually check arrows/colors in light+dark.

---

## Step 2 — Win Correlations section (NEW)

Goal: reproduce the report's "what correlates with winning". For each tracked metric, compare the
average in WON matches vs LOST matches; show the gap and which metrics most separate wins/losses.

1. Pure helper in `progress-insights.ts`:

```ts
export interface WinCorrelation {
  key: string;            // metric key
  lossAvg: number | null;
  winAvg: number | null;
  gap: number | null;     // winAvg - lossAvg, sign-normalized by direction
}

export function computeWinCorrelations(matches: ProgressMatchMetrics[]): WinCorrelation[] {
  const wins = matches.filter((m) => m.result === 'win');
  const losses = matches.filter((m) => m.result === 'loss');
  if (wins.length === 0 || losses.length === 0) return [];
  const out: WinCorrelation[] = [];
  for (const key of Object.keys(METRIC_METADATA)) {
    if (MOVER_EXCLUDE.has(key)) continue;
    const avg = (arr: ProgressMatchMetrics[]) => {
      const v = arr.map((m) => m[key as keyof ProgressMatchMetrics]).filter((x): x is number => typeof x === 'number');
      return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null;
    };
    const winAvg = avg(wins), lossAvg = avg(losses);
    if (winAvg == null || lossAvg == null) continue;
    const raw = winAvg - lossAvg;
    const gap = METRIC_METADATA[key].direction === 'higher' ? raw : -raw; // positive gap = helps winning
    out.push({ gap: Math.round(gap * 10) / 10, key, lossAvg, winAvg });
  }
  return out.sort((a, b) => Math.abs(b.gap ?? 0) - Math.abs(a.gap ?? 0));
}
```

2. New primitive `CorrelationList` in `tennisProgressCharts.tsx`: rows of `metric | win avg vs loss
   avg | diverging bar` (top 5 by |gap|). Positive gap → emerald bar (helps wins), negative →
   amber. Show "Only computed when you have both wins and losses" empty state.

3. Render in `ProgressBody` (accent `emerald`) above the chart sections.

i18n: `progress.correlations.{title,subtitle,winAvg,lossAvg,empty,gapHelps,gapHurts}`.

Verify: extend `progress-insights.test.ts` with a fixture (2 wins, 2 losses, known values).

---

## Step 3 — Key Findings (NEW, narrative + severity)

Goal: the report's "Key Findings" cards. Generate 3–6 narrative findings from period averages,
movers, and correlations. Pure, deterministic, null-safe.

1. Helper in `progress-insights.ts`:

```ts
export type FindingSeverity = 'positive' | 'warning' | 'critical' | 'neutral';
export interface ProgressFinding {
  severity: FindingSeverity;
  // i18n template key + interpolation values (NO hard-coded English in the lib)
  template: string;
  values: Record<string, number | string>;
}

export function computeProgressFindings(matches: ProgressMatchMetrics[]): ProgressFinding[] {
  // examples (each guarded by null checks):
  // - biggest improved mover -> positive
  // - biggest declined mover -> warning/critical based on |delta|
  // - top win-correlation metric below its win-average in recent matches -> critical
  // - deep_pct recent vs win-average -> tie depth to outcomes
  // Return at most 6, sorted critical→warning→neutral→positive.
}
```

2. Reuse the existing `MoversList`/`FocusAreas` visual style, or add `FindingsList` primitive:
   colored left-border card (red/amber/slate/emerald) + icon (lucide `AlertTriangle`, `TrendingUp`,
   `Info`) + sentence built from `t(finding.template, finding.values)`.

3. i18n: `progress.findings.title` + a `findings.templates.*` map, e.g.
   `"mostImproved": "{metric} improved most: {early} → {recent}."`,
   `"keyMetricBelowWinLevel": "{metric} ({recent}) is below your typical winning level ({winAvg})."`

Verify: `progress-insights.test.ts` snapshot of templates+values for a fixture.

---

## Step 4 — Groundstroke & Style charts (NEW)

In a new `SectionWrapper accent="blue" title={t('sections.groundstrokes')}` add:

1. FH vs BH usage balance over time — `MetricLineChart` series `fh_usage_pct` (0–100, unit %).
   Pair with a caption noting "higher = running around the backhand more".
2. Aggression index over time — `MetricLineChart` series `aggression_pct` (unit %).
3. Last-shot error % over time — `MetricAreaChart` series `last_shot_error_pct` (unit %, direction
   lower-better → use red accent).
4. Cross-court : down-the-line ratio — `MetricLineChart` series `cc_dl_ratio` (no unit, no yDomain).

Wire series exactly like the existing `servePctSeries` pattern (`TennisProgressContent.tsx:301`):

```ts
const styleSeries = useMemo(() => [
  { color: '#8b5cf6', key: 'aggression_pct', name: metricLabel(t, 'aggression_pct') },
  { color: '#0ea5e9', key: 'fh_usage_pct', name: metricLabel(t, 'fh_usage_pct') },
], [t]);
```

i18n: `progress.sections.groundstrokes`, `progress.charts.{usageBalance,aggression,lastShotError,
ccDlRatio}` (+ `*Subtitle`).

---

## Step 5 — Depth & Rally section (NEW)

`SectionWrapper accent="teal" title={t('sections.depth')}`:

1. Deep vs Short % over time — stacked or dual line: `deep_pct` (emerald) and `short_pct` (amber)
   via `MetricLineChart` (unit %, yDomain [0,100]). Optionally a `StackedBar` primitive if you want
   deep/mid/short stacking — but mid is derivable (100 − deep − short).
2. Average rally length over time — reuse existing `rallySeries` (`avg_rally_length`); move it here
   from the Aggression section if it reads better, or keep duplicated reference.

Caption: tie deep% to outcomes ("wins average higher deep %").

i18n: `progress.sections.depth`, `progress.charts.{depthMix,depthMixSubtitle}`.

---

## Step 6 — Return section enrichment

The current page only charts return/break inside one section. Add:
- Forehand return % over time — `MetricLineChart` series `fh_return_pct` (unit %, yDomain [0,100]).
- Return in % over time — `MetricLineChart` series `return_in_pct`.

Combine with existing `return_points_won_pct`, `break_points_converted_pct`,
`break_points_saved_pct` so the section reads as a full return/clutch story.

i18n: `progress.charts.{returnSelection,returnSelectionSubtitle}`.

---

## Step 7 — Polish & ordering

Final `ProgressBody` order (top → bottom):
1. Headline cards + Form strip (Step 1)
2. Skill radar (existing)
3. Win Correlations (Step 2)
4. Key Findings (Step 3)
5. Biggest movers + Focus areas (existing)
6. Serve section (existing)
7. Groundstroke & Style (Step 4)
8. Depth & Rally (Step 5)
9. Return & Break (Step 6 enriched)
10. Power & accuracy (existing) — keep, low priority
11. Spin mix (existing) — keep as-is (de-prioritized), consider moving to the bottom

Other polish:
- Ensure all new sections respect the `matches.length < 2` guard already in `TennisProgressContent`.
- Each new chart must render an empty hint when its series has no non-null points (the
  `MetricLineChart` primitives already drop null points; add a guard that hides a chart whose series
  are entirely null using `extractSparkline(matches, key).length === 0`).
- Keep the surface filter / range filter / source toggle working — new metrics flow through the
  same `matches` array so no extra wiring needed.

---

## i18n checklist (all four locales)

Under `tennisAnalytics.progress`:
- `headline.delta`
- `sections.{groundstrokes,depth}` (serve/aggression/returnBreak/power already exist)
- `charts.{usageBalance,usageBalanceSubtitle,aggression,aggressionSubtitle,lastShotError,
  lastShotErrorSubtitle,ccDlRatio,ccDlRatioSubtitle,depthMix,depthMixSubtitle,returnSelection,
  returnSelectionSubtitle}`
- `correlations.{title,subtitle,winAvg,lossAvg,empty}`
- `findings.title` + `findings.templates.{mostImproved,mostDeclined,keyMetricBelowWinLevel,
  depthTiedToWins,...}`
- `metrics.*` for the new keys (added in Guide 01 §2f)

Keep keys alphabetical within each object.

---

## Verification (page)

```
npx vitest run tests/lib/tennis/progress-insights.test.ts tests/lib/tennis/progress-metrics.test.ts
npm run lint
npm run build
npm run dev     # open /player/tennis-analytics/progress (and coach/parent variants)
```

Manual checks:
- Player with ≥4 SwingVision matches: headline trends, correlations, findings, new charts all
  populate.
- Player with only live-scored matches (no bounce data): depth/aggression charts show empty hints
  rather than zero lines.
- Coach/parent viewing another player via `?playerId=` still works.
- Light + dark mode.
