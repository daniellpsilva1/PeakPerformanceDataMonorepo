# Guide 03 — Insights Tab (single match)

File: `src/components/tennis-analytics/TennisAnalyticsInsightsTab.tsx`
Helpers: `tennisAnalyticsShared.ts` (Guide 01 §1)
i18n: `tennisAnalytics.insights.*` (all four locales)

The tab already has: quick-stat cards, head-to-head comparison, serve/groundstroke/break/net gauges,
and an auto-generated insight engine (`insights` useMemo, ~line 347) that produces severity-tagged
chips. We extend the data it computes and add three report-grade sections: **Depth & Rally
structure**, **Style & Aggression**, and a **Recommendations** panel.

---

## Step 1 — Wire the new single-match helpers

Near the existing `useMemo` blocks, add:

```ts
const depthStats = useMemo(() => computeDepthStats(hostShots, 'host'), [hostShots]);
const directionStats = useMemo(() => computeDirectionStats(hostShots, 'host'), [hostShots]);
const lastShotStats = useMemo(() => computeLastShotStats(allShots, 'host'), [allShots]);
const usageStats = useMemo(() => computeUsageStats(hostShots, 'host'), [hostShots]);
const returnSelection = useMemo(
  () => computeReturnSelection(allShots, 'host', getPointServer),
  [allShots, getPointServer],
);
```

(Imports added alphabetically at the top from `./tennisAnalyticsShared`.)

> `hostShots` is already the server-attributed host-only array passed as a prop; `allShots` carries
> every player's shots and is needed for last-shot and return-selection logic.

---

## Step 2 — Depth & Rally section (NEW)

`SectionCard accent="teal" title={t('sections.depthRally')}`:

- A 3-segment depth bar (deep / mid / short) using `ColoredBar` rows or a single stacked bar:
  - Deep → emerald, Mid → amber, Short → red.
  - Each row shows `deepPct%` and `deep/total`.
- Empty state when `depthStats.total === 0` (`t('noDepthData')`).
- Add an auto-insight: if `deepPct < 70` push a `medium` insight `actions.improveDepth`; if
  `>= 75` push `positive` `actions.maintainDepth`. Follow the exact push pattern used by the
  existing engine (object with `action/data/detail/key/severity/title`) and add to the sort.

i18n additions under `insights`:
`sections.depthRally`, `metrics.{deepBall,midBall,shortBall}`, `noDepthData`,
`titles.depth`, `actions.{improveDepth,maintainDepth,depthSteady}`, `details.{depthLow,depthHigh,
depthSteady}`, `data.deepPct`.

---

## Step 3 — Style & Aggression section (NEW)

`SectionCard accent="purple" title={t('sections.style')}`:

- FH/BH usage split — horizontal stacked bar (sky = FH `usageStats.fhUsagePct`, violet = BH).
  Caption: high FH usage = running around the backhand.
- Aggression index — `RadialGauge value={directionStats.aggressionPct}` caption
  `t('metrics.aggression')`, sub `(${directionStats.insideOut}+${directionStats.insideIn})/${directionStats.total}`.
- Cross-court vs down-the-line — `MiniDonut` with two segments (`ccCount`, `dlCount`) + ratio label
  `directionStats.ccDlRatio ?? '—'`.
- Last-shot error — `RadialGauge` (lower better; if you want the ring color inverted, pass the value
  but show that low is good in the caption) with sub `${lastShotStats.errorEndings}/${lastShotStats.endedByPlayer}`.
- Empty states keyed off each helper's `total`/`endedByPlayer`.

Auto-insights: high `lastShotErrorPct` (>60) → `medium`; low FH/BH balance extreme (`fhUsagePct`
>70 or <30) → `neutral` style note.

i18n: `sections.style`, `metrics.{fhUsage,aggression,ccDl,lastShotError}`, `noStyleData`,
plus titles/actions/details/data keys for any new insight rules.

---

## Step 4 — Recommendations panel (NEW, report's "Development Priorities")

The engine already produces severity-ranked `insights`. Add a dedicated, prominent panel that lists
the top 3 `high`/`medium` insights as numbered priorities (distinct from the inline chips).

1. New presentational component in this file: `RecommendationsPanel`.

```tsx
function RecommendationsPanel({ items, title }: {
  items: { action: string; detail: string; severity: InsightSeverity; title: string }[];
  title: string;
}) {
  // numbered list (1..3), severity dot, bold title, action sentence + detail
  // emerald/amber/red accent per severity
}
```

2. In the component body, derive:

```ts
const priorities = useMemo(
  () => insights.filter((i) => i.severity === 'high' || i.severity === 'medium').slice(0, 3),
  [insights],
);
```

3. Render the panel near the top (right under the quick-stats grid) so the actionable takeaways lead
   the tab, with a `t('recommendations.empty')` state when there are none (i.e. everything steady).

i18n: `recommendations.{title,empty,priorityLabel}` (priorityLabel e.g. "Priority {n}").

---

## Step 5 — Polish

- Keep all existing sections; insert the two new sections after Groundstrokes and before Break
  Points so the flow is: quick stats → recommendations → comparison → serving → groundstrokes →
  style → depth & rally → break points → net.
- Make sure every new gauge/bar shows a denominator and an empty state — no bare `0%`.
- Verify the `insights` sort still ends high→medium→neutral→positive after adding new rules.

---

## Verification

```
npm run lint
npm run build
# add helper unit tests if not already (Guide 01 §1 verification)
npx vitest run tests/lib/tennis/tennisAnalyticsShared.test.ts
npm run dev    # open a match detail → Insights tab
```

Manual:
- SwingVision match with bounce/direction data → depth + style sections populate.
- Live-scored match without bounce/direction → those sections show empty hints, rest still works.
- Recommendations panel shows the same top issues reflected by the inline chips.
- Light + dark mode; mobile width (cards are 2-col on `sm`).
