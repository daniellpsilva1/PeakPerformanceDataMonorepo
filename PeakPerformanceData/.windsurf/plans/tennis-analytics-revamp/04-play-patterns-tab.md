# Guide 04 — Play Patterns Tab (single match)

File: `src/components/tennis-analytics/TennisAnalyticsPlayPatternsTab.tsx`
Helpers: `tennisAnalyticsShared.ts` (Guide 01 §1) + the in-file `CourtPlot`, `foldToFarHalf`,
court geometry constants.
i18n: `tennisAnalytics.playPatterns.*` (all four locales)

The tab already has: player/set toggles, rally-length win rate, serve placement court plot,
serve+1/return+1, per-wing direction tendencies, winners/errors court map. It is the tactical
single-match view. We add **depth placement**, **direction flow (CC/DL + aggression)**, and a
**rally-length distribution** so it matches the report's tactical depth.

All new sections must respect the existing `activePlayer` and `setFilter` state and the
`pointData` memo already computed.

---

## Step 1 — Depth placement & zones (NEW)

Goal: the report's "deep vs short" tactical view, but as a court visualization.

1. Compute depth zone aggregates from `pointData` (reuse `shotDepthFromNet` + `classifyDepthFromNet`
   from shared). For the active player's rally shots that landed `in` with bounce data:
   - count deep/mid/short, and build court dots colored by zone (emerald=deep, amber=mid,
     red=short) using the existing `foldToFarHalf` + `CourtPlot`.

```ts
const depthPlacement = useMemo(() => {
  const dots: PlotDot[] = [];
  const agg = { deep: 0, mid: 0, short: 0 };
  for (const p of pointData) {
    for (const s of p.shots) {
      if (s.player !== activePlayer || !isRallyShot(s.stroke)) continue;
      if ((s.result?.toLowerCase() ?? '') !== 'in') continue;
      if (s.bounce_x == null || s.bounce_y == null) continue;
      const folded = foldToFarHalf(s.bounce_x, s.bounce_y - COURT_L / 2);
      const zone = classifyDepthFromNet(Math.abs(folded.y));
      agg[zone]++;
      dots.push({ color: zone === 'deep' ? '#22c55e' : zone === 'short' ? '#ef4444' : '#f59e0b', x: folded.x, y: folded.y });
    }
  }
  const total = agg.deep + agg.mid + agg.short;
  return { agg, dots, total };
}, [activePlayer, pointData]);
```

2. UI: `SectionCard accent="teal"` with `CourtPlot` (left) + three `ColoredBar`/legend rows (right)
   showing deep/mid/short %. Optionally draw faint depth-zone bands on the court (extend `CourtPlot`
   with an optional `depthBands` prop that renders 2 horizontal guide lines at the service line and
   the `DEPTH_DEEP_MIN_M` line). Empty hint when `total === 0`.

i18n: `playPatterns.{depthPlacement,depthPlacementDesc,deepZone,midZone,shortZone,noDepthData}`.

---

## Step 2 — Direction flow: CC/DL + aggression (NEW)

Goal: the report's cross-court vs down-the-line counts/ratio and inside-out/in aggression, but
tactical and per-wing.

1. Use `computeDirectionStats` on the active player's shots (filtered by `setFilter`). Since the
   helper takes a flat `Shot[]`, build that array from `pointData`:

```ts
const activeShots = useMemo(
  () => pointData.flatMap((p) => p.shots).filter((s) => s.player === activePlayer),
  [activePlayer, pointData],
);
const dirStats = useMemo(() => computeDirectionStats(activeShots, activePlayer), [activeShots, activePlayer]);
```

2. UI: `SectionCard accent="blue"`:
   - `MiniDonut` with CC vs DL counts + a big `ccDlRatio` number.
   - Aggression chip: `aggressionPct%` with `(insideOut + insideIn)/total`.
   - Keep the existing per-wing direction tendencies section below it (it complements this summary).
   - Empty hint when `dirStats.total === 0`.

i18n: `playPatterns.{directionFlow,directionFlowDesc,crossCourt,downTheLine,ccDlRatio,aggression,
noDirectionData}` (some may already exist — reuse `labels.directions.*`).

---

## Step 3 — Rally-length distribution (NEW)

The tab has rally-length WIN RATE; add the report's rally-length DISTRIBUTION (how points are
structured), which is a different story (where points are won/lost by length).

1. Compute counts per bucket (serve ≤1, short 2–4, medium 5–8, long ≥9) for the active player's
   points (reuse the bucket defs already in `rallyBuckets`, but count totals + share, not win rate).
2. UI: horizontal bars (share of points) using `ColoredBar` with `RALLY_BUCKET_COLORS`. Pair next to
   the existing win-rate bars, or stack as a second card in the same section.

i18n: `playPatterns.{rallyDistribution,rallyDistributionDesc,ofPoints}`.

---

## Step 4 — Last-shot error context (small stat)

Add a compact stat to the winners/errors map card: `computeLastShotStats(activeShots, activePlayer)`
→ show `lastShotErrorPct%` with `errorEndings/endedByPlayer`, captioned "points you ended that ended
in your error". This ties the placement map to the report's last-shot-error metric.

i18n: `playPatterns.{lastShotError,lastShotErrorDesc}`.

---

## Step 5 — Polish & ordering

Suggested section order:
1. Controls (player/set) — existing
2. Rally-length win rate + Rally-length distribution (Step 3) — same section, two cards
3. Serve placement — existing
4. Depth placement & zones (Step 1)
5. Direction flow CC/DL + aggression (Step 2)
6. Per-wing direction tendencies — existing
7. Serve+1 / Return+1 — existing
8. Winners vs errors map (+ last-shot context, Step 4) — existing, enriched

Constraints:
- Everything keys off `activePlayer` + `setFilter`; verify switching player/set updates new sections.
- Court dots already clamp to the SVG; reuse `CourtPlot` rather than a new court.
- Empty hints everywhere bounce/direction data is missing.

---

## Verification

```
npm run lint
npm run build
npm run dev    # match detail → Play Patterns tab
```

Manual:
- Toggle host/guest and each set → depth, direction, distribution all recompute.
- SwingVision match → court dots + zones render; live-scored (no bounce) → depth shows empty hint
  but rally distribution/direction (which only need stroke/direction) still render where data exists.
- Light + dark; mobile (court collapses above the stats column via the existing
  `sm:grid-cols-[...]` pattern).
