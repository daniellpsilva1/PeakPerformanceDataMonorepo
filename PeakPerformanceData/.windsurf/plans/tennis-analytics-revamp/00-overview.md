# Tennis Analytics Revamp — Overview & Architecture

Goal: bring the **Progress page**, **Insights tab**, and **Play Patterns tab** up to the
analytical richness and visual polish of the reference report
`peak_performance_data/external_data/sv_matches/kaitlin_sv_matches/kaitlin_complete_analysis.html`.

Build order (confirmed): **Progress first → Insights → Play Patterns.**

Data policy (confirmed):
- Compute as many real derived metrics as possible from the existing shot/point data.
- **In scope to add:** depth %, aggression index (inside-out + inside-in), cross-court vs
  down-the-line, last-shot error %, return stroke selection (FH/BH), FH/BH usage balance.
- **De-prioritized (do not invest heavily):** topspin vs slice spin mix, volley conversion,
  top-10%/max speeds. Leave existing spin/speed charts as-is; do not build new UI around them.
- **Never fabricate.** When a match lacks the underlying shots/bounce/direction data, render an
  explicit empty / "insufficient data" state rather than zero-filling.

---

## The three surfaces

| Surface | File | Scope | Data source |
|---|---|---|---|
| Progress page | `src/components/tennis-analytics/TennisProgressContent.tsx` + `tennisProgressCharts.tsx` | Cross-match longitudinal | `/api/tennis/matches/evolution` → `ProgressMatchMetrics[]` |
| Insights tab | `src/components/tennis-analytics/TennisAnalyticsInsightsTab.tsx` | Single match | props: `allShots`, `points`, `match`, server maps |
| Play Patterns tab | `src/components/tennis-analytics/TennisAnalyticsPlayPatternsTab.tsx` | Single match | same single-match props |

Shared code:
- `src/components/tennis-analytics/tennisAnalyticsShared.ts` — types (`Shot`, `MatchPoint`,
  `MatchDetail`), `computeServeStats`, `computeWinnersErrors`, direction/stroke label helpers.
- `src/components/tennis-analytics/tennisAnalyticsCharts.tsx` — `RadialGauge`, `MiniDonut`,
  `ColoredBar`, `accentMap`.
- `src/components/tennis-analytics/tennisProgressCharts.tsx` — `MetricLineChart`,
  `MetricBarChart`, `MetricAreaChart`, `SpeedDotChart`, `StackedSpinChart`, `SkillRadar`,
  `MoversList`, `FocusAreas`, `FormStrip`, `ProgressSummary`, `SectionWrapper`.
- Metric layer: `src/lib/tennis/progress-metrics.ts` (`computeMatchMetrics`,
  `ProgressMatchMetrics`) and `src/lib/tennis/progress-insights.ts` (`METRIC_METADATA`, movers,
  radar, rolling win rate, sparklines).

---

## Raw data available (ground truth)

`Shot` (`tennisAnalyticsShared.ts:56`):
`bounce_x, bounce_y, direction, game_number, hit_x, hit_y, id, player, point_number, result,
set_number, shot_number, speed_kmh, spin, stroke, type`.

`MatchPoint` (`tennisAnalyticsShared.ts:85`):
`break_point, detail, game_number, match_server, point_number, point_winner, serve_state,
set_number, set_point, ...`.

Direction values map via `getTennisDirectionLabelKey` → `crosscourt`, `downTheLine`, `downTheT`,
`insideIn`, `insideOut`, `middle`, `outWide`, `unknown`.

Result values: `in`, `net`, `out`.

> **Important:** the evolution API currently selects shots WITHOUT `bounce_x/bounce_y/direction`
> (`evolution/route.ts:70-73`). The shared-metrics guide adds those columns so depth/direction
> metrics can be computed cross-match. See `01-shared-metrics-foundation.md`.

---

## Court geometry (already defined in PlayPatterns tab)

```
COURT_W = 10.97   SINGLES_W = 8.23   COURT_L = 23.77   SERVICE_L = 6.40
```
- `bounce_y` is baseline-origin; net-centered y = `bounce_y - COURT_L/2` (range ≈ -11.885..11.885).
- `foldToFarHalf(x, y)` mirrors near-half placements into the far/attacking half so a player's
  shots cluster in one half. Depth-from-net `d = folded.y` ∈ [0, 11.885].
- Service line is `SERVICE_L = 6.40` m from net; baseline ≈ `11.885` m from net.

These constants are duplicated in the Play Patterns tab; the shared-metrics guide promotes the
depth helpers into `tennisAnalyticsShared.ts` for reuse.

---

## Design language (keep consistent with the app — do NOT copy the HTML's Chart.js/dark theme)

- Charts: **Recharts** + custom SVG primitives already in the repo. Reuse `MetricLineChart`,
  `MetricBarChart`, `MetricAreaChart`, `SkillRadar`, `CourtPlot`, `RadialGauge`, `ColoredBar`,
  `MiniDonut`. Add new primitives only where noted.
- Layout: `SectionWrapper`/`SectionCard` cards with a 1px top accent bar (`accentMap`).
- Accent rotation per section: emerald (serve), purple (aggression/rally), amber (return/break),
  blue (groundstroke/power), teal (depth/net).
- Typography: `text-xs font-bold uppercase tracking-wider` section titles; `tabular-nums` for all
  numbers; big stats `text-2xl font-black`.
- Colors: winners/positive `#10b981` (emerald), errors/negative `#ef4444` (red), neutral amber
  `#f59e0b`, accent violet `#8b5cf6`, sky `#0ea5e9`. Win/loss dots on court: `#22c55e` / `#ef4444`.
- Dark mode must work (the app is theme-aware via Tailwind `dark:`).
- Every numeric claim shows its denominator (e.g. `12/19`) like the existing gauges.

---

## i18n

Messages live in `peak_performance_data/messages/{en,es,ca,zh}.json` under
`tennisAnalytics.{progress,insights,playPatterns,labels}`. **Every new string must be added to all
four locales.** English is the source of truth; for es/ca/zh add translations (Catalan + Spanish +
Simplified Chinese). Keys within each object must stay alphabetically ordered to match the existing
file and pass lint.

---

## Verification (run from `peak_performance_data/`)

```
npm run lint                                   # ES-lint incl. alphabetical import/prop/var order
npx vitest run tests/lib/tennis/progress-metrics.test.ts
npx vitest run tests/lib/tennis/progress-insights.test.ts
npm run build                                  # type-check the whole app
```

Existing tests to extend:
- `tests/lib/tennis/progress-metrics.test.ts`
- `tests/lib/tennis/progress-insights.test.ts`

---

## Guide index

1. `01-shared-metrics-foundation.md` — new derived metrics, exact formulas, files to touch, tests.
2. `02-progress-page.md` — longitudinal page redesign (do this first).
3. `03-insights-tab.md` — single-match narrative findings + recommendations.
4. `04-play-patterns-tab.md` — single-match tactical court visualizations.

Each guide is self-contained: file paths, code skeletons, i18n keys, and per-step verification.

---

## Coding-standard reminders (enforced by lint)

- Imports, component props, and object keys **alphabetically ordered**.
- No new comments/JSDoc unless they already exist in the pattern you're copying.
- Commit headers: imperative verb prefix, ≤52 chars, >1 word (e.g. `Add tennis depth metrics`).
