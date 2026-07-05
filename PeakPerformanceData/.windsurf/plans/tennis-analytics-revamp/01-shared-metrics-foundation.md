# Guide 01 — Shared Metrics Foundation

This is the prerequisite for all three pages. It adds the new derived metrics (depth, aggression,
cross-court/down-the-line, last-shot error, return stroke selection, FH/BH usage) in two places:

- **Cross-match** (Progress page) → `src/lib/tennis/progress-metrics.ts` + the evolution API.
- **Single-match** (Insights / Play Patterns) → reusable pure helpers in
  `src/components/tennis-analytics/tennisAnalyticsShared.ts`.

Both layers use the **same formulas** defined here so the per-match numbers line up with the
longitudinal trend (the same discipline the codebase already follows for serve/winner stats).

---

## 0. Court / depth constants (promote to shared)

Add to `tennisAnalyticsShared.ts` (top of file, after the existing surface constants):

```ts
// Court geometry in metres (singles). Net is the court mid-line.
export const TENNIS_COURT_LENGTH_M = 23.77;
export const TENNIS_SERVICE_LINE_M = 6.40;   // distance net → service line
export const TENNIS_BASELINE_M = TENNIS_COURT_LENGTH_M / 2; // 11.885 net → baseline

// Depth zones measured as distance-from-net of a shot's bounce (after folding into
// the attacking half). Thresholds chosen so "deep" ~= last third before baseline.
export const DEPTH_DEEP_MIN_M = 8.5;   // deep   : 8.5 .. 11.885 (back third)
export const DEPTH_SHORT_MAX_M = 6.4;  // short  : 0 .. 6.4 (inside service box)
//                                       mid    : 6.4 .. 8.5

export type DepthZone = 'deep' | 'mid' | 'short';

export function classifyDepthFromNet(distanceFromNetM: number): DepthZone {
  if (distanceFromNetM >= DEPTH_DEEP_MIN_M) return 'deep';
  if (distanceFromNetM <= DEPTH_SHORT_MAX_M) return 'short';
  return 'mid';
}

// Net-centered, attacking-half depth for a bounce. Returns null when no bounce data.
export function shotDepthFromNet(bounceY: number | null): number | null {
  if (bounceY == null) return null;
  const netCentered = bounceY - TENNIS_BASELINE_M;        // -11.885 .. 11.885
  return Math.abs(netCentered);                            // fold into attacking half
}
```

> Rationale for thresholds: service line is 6.40 m from the net; the back third of the
> half-court (≈8.5–11.885 m) is the classic "deep" zone that pins an opponent behind the baseline.
> Keep them as named constants so they are easy to tune; the Kaitlin report's "deep %" ran ~63–79%,
> which these thresholds reproduce on real SwingVision data. **Do not hard-code magic numbers in
> components.**

---

## 1. Single-match helpers (`tennisAnalyticsShared.ts`)

These are pure functions consumed by the Insights and Play Patterns tabs. They take the already
server-attributed `Shot[]` / `MatchPoint[]` the tabs already build. Add them after
`computeWinnersErrors`.

### 1a. Depth distribution

```ts
export type DepthStats = {
  deep: number; deepPct: number;
  mid: number;  midPct: number;
  short: number; shortPct: number;
  total: number; // rally shots with bounce data that landed 'in'
};

export function computeDepthStats(shots: Shot[], player: 'host' | 'guest'): DepthStats {
  let deep = 0, mid = 0, short = 0, total = 0;
  for (const s of shots) {
    if (s.player !== player) continue;
    const stroke = s.stroke?.toLowerCase() ?? '';
    if (stroke === 'serve' || stroke === 'feed' || stroke === '') continue;
    if ((s.result?.toLowerCase() ?? '') !== 'in') continue;   // only balls that landed in
    const d = shotDepthFromNet(s.bounce_y);
    if (d == null) continue;
    total++;
    const zone = classifyDepthFromNet(d);
    if (zone === 'deep') deep++; else if (zone === 'short') short++; else mid++;
  }
  const p = (n: number) => (total > 0 ? Math.round((n / total) * 100) : 0);
  return { deep, deepPct: p(deep), mid, midPct: p(mid), short, shortPct: p(short), total };
}
```

### 1b. Direction mix — cross-court / down-the-line / aggression

```ts
export type DirectionStats = {
  aggressionPct: number;     // (insideOut + insideIn) / directional groundstrokes
  ccCount: number;
  ccDlRatio: number | null;  // crosscourt / downTheLine (null if no DL)
  dlCount: number;           // downTheLine + downTheT
  insideIn: number;
  insideOut: number;
  total: number;             // directional groundstrokes
};

export function computeDirectionStats(shots: Shot[], player: 'host' | 'guest'): DirectionStats {
  let cc = 0, dl = 0, io = 0, ii = 0, total = 0;
  for (const s of shots) {
    if (s.player !== player) continue;
    const wing = s.stroke?.toLowerCase() ?? '';
    if (!wing.includes('forehand') && !wing.includes('backhand')) continue;
    const dir = getTennisDirectionLabelKey(s.direction);
    if (dir === 'unknown') continue;
    total++;
    if (dir === 'crosscourt') cc++;
    else if (dir === 'downTheLine' || dir === 'downTheT') dl++;
    else if (dir === 'insideOut') { io++; }
    else if (dir === 'insideIn') { ii++; }
  }
  const aggression = total > 0 ? Math.round(((io + ii) / total) * 100) : 0;
  return {
    aggressionPct: aggression,
    ccCount: cc,
    ccDlRatio: dl > 0 ? Math.round((cc / dl) * 100) / 100 : null,
    dlCount: dl,
    insideIn: ii,
    insideOut: io,
    total,
  };
}
```

> Note: inside-out/inside-in are forehand-run-around directions, so they double as an "aggression"
> signal exactly as the reference report uses them.

### 1c. Last-shot error %

"Of the points this player ended, how many ended with THEIR error." Reuse the same last-rally-shot
resolution the tabs already use.

```ts
export type LastShotStats = {
  endedByPlayer: number;       // points whose final rally shot was this player's
  errorEndings: number;        // ...that ended out/net (their error)
  lastShotErrorPct: number;
};

export function computeLastShotStats(
  shots: Shot[],
  player: 'host' | 'guest',
): LastShotStats {
  const lastByPoint = new Map<string, Shot>();
  for (const s of shots) {
    const st = s.stroke?.toLowerCase() ?? '';
    if (st === 'serve' || st === 'feed' || st === '') continue;
    const pk = `${s.set_number}-${s.game_number}-${s.point_number}`;
    const cur = lastByPoint.get(pk);
    if (!cur || s.shot_number > cur.shot_number) lastByPoint.set(pk, s);
  }
  let endedByPlayer = 0, errorEndings = 0;
  for (const last of lastByPoint.values()) {
    if (last.player !== player) continue;
    endedByPlayer++;
    const r = last.result?.toLowerCase() ?? '';
    if (r === 'out' || r === 'net') errorEndings++;
  }
  return {
    endedByPlayer,
    errorEndings,
    lastShotErrorPct: endedByPlayer > 0 ? Math.round((errorEndings / endedByPlayer) * 100) : 0,
  };
}
```

### 1d. Return stroke selection + FH/BH usage

```ts
export type ReturnSelectionStats = {
  bhReturns: number;
  fhReturnPct: number;   // share of returns hit forehand
  fhReturns: number;
  returnInPct: number;   // returns that landed 'in'
  total: number;
};

// `getPointServer` lets us decide who is the returner for each point.
export function computeReturnSelection(
  shots: Shot[],
  player: 'host' | 'guest',
  getServer: GetPointServerFn,
): ReturnSelectionStats {
  // group by point, find the returner's FIRST rally shot (the return)
  const byPoint = new Map<string, Shot[]>();
  for (const s of shots) {
    const pk = `${s.set_number}-${s.game_number}-${s.point_number}`;
    if (!byPoint.has(pk)) byPoint.set(pk, []);
    byPoint.get(pk)!.push(s);
  }
  let fh = 0, bh = 0, inCount = 0, total = 0;
  for (const [pk, list] of byPoint) {
    const [setN, gameN, pointN] = pk.split('-').map(Number);
    const server = getServer(setN, gameN, pointN);
    if (!server) continue;
    const returner = server === 'host' ? 'guest' : 'host';
    if (returner !== player) continue;
    const sorted = [...list].sort((a, b) => a.shot_number - b.shot_number);
    const ret = sorted.find((s) => {
      const st = s.stroke?.toLowerCase() ?? '';
      return st !== 'serve' && st !== 'feed' && st !== '';
    });
    if (!ret) continue;
    const wing = ret.stroke?.toLowerCase() ?? '';
    if (!wing.includes('forehand') && !wing.includes('backhand')) continue;
    total++;
    if (wing.includes('forehand')) fh++; else bh++;
    if ((ret.result?.toLowerCase() ?? '') === 'in') inCount++;
  }
  return {
    bhReturns: bh,
    fhReturnPct: total > 0 ? Math.round((fh / total) * 100) : 0,
    fhReturns: fh,
    returnInPct: total > 0 ? Math.round((inCount / total) * 100) : 0,
    total,
  };
}

export type UsageStats = { bhCount: number; fhCount: number; fhUsagePct: number; total: number };

export function computeUsageStats(shots: Shot[], player: 'host' | 'guest'): UsageStats {
  let fh = 0, bh = 0;
  for (const s of shots) {
    if (s.player !== player) continue;
    const w = s.stroke?.toLowerCase() ?? '';
    if (w.includes('forehand')) fh++; else if (w.includes('backhand')) bh++;
  }
  const total = fh + bh;
  return { bhCount: bh, fhCount: fh, fhUsagePct: total > 0 ? Math.round((fh / total) * 100) : 0, total };
}
```

> These helpers are **null-safe and denominator-aware**: `total === 0` ⇒ the UI shows an empty
> state instead of `0%`. Keep that contract.

### Verification (1)
- `npm run lint` (alphabetical ordering of the new exports/keys).
- Add unit tests in a new `tests/lib/tennis/tennisAnalyticsShared.test.ts` covering: a deep/short
  classification boundary, an aggression count, a last-shot error point, and an empty-data case.

```
npx vitest run tests/lib/tennis/tennisAnalyticsShared.test.ts
```

---

## 2. Cross-match metrics (`progress-metrics.ts` + evolution API)

### 2a. Add bounce/direction columns to the evolution query

In `src/app/api/tennis/matches/evolution/route.ts` (the shots select, currently line ~70):

```ts
.from('tennis_match_shots')
.select('bounce_y, direction, game_number, match_id, player, point_number, result, set_number, shot_number, speed_kmh, spin, stroke, type')
.in('match_id', matchIds),
```

(Only `bounce_y` and `direction` are added — `bounce_x`/`hit_*` are not needed for these metrics.)

### 2b. Extend `ProgressShotRow` (`progress-metrics.ts:47`)

```ts
export interface ProgressShotRow {
  bounce_y: number | null;   // NEW
  direction: string | null;  // NEW
  game_number: number;
  player: string | null;
  point_number: number;
  result: string | null;
  set_number: number;
  shot_number: number;
  speed_kmh: number | null;
  spin: string | null;
  stroke: string | null;
  type: string | null;
}
```

### 2c. Extend `ProgressMatchMetrics` (`progress-metrics.ts:82`)

Add these fields (keep the interface alphabetical):

```ts
aggression_pct: number | null;
cc_dl_ratio: number | null;
deep_pct: number | null;
fh_return_pct: number | null;
fh_usage_pct: number | null;
last_shot_error_pct: number | null;
return_in_pct: number | null;
short_pct: number | null;
```

### 2d. Compute them in `computeMatchMetrics`

After `hostShots` is built (`progress-metrics.ts:274`), the host shots are already
server-attributed (`attributeShots`). Add a small block that mirrors the single-match helpers but
operates on `ProgressShotRow` (same formulas, see §1). Because `progress-metrics.ts` is server-side
and must stay dependency-free, **copy the pure formulas** (or, preferred, factor the formulas into
a tiny `src/lib/tennis/shot-metrics.ts` imported by BOTH `tennisAnalyticsShared.ts` and
`progress-metrics.ts` to avoid drift).

> **Recommended:** create `src/lib/tennis/shot-metrics.ts` containing the depth/direction/last-shot
> primitives operating on a minimal `{ bounce_y, direction, player, result, set_number,
> game_number, point_number, shot_number, stroke }` shape. Then:
> - `tennisAnalyticsShared.ts` helpers call into it (mapping `Shot`).
> - `progress-metrics.ts` calls into it directly (`ProgressShotRow` already matches).
> This guarantees the single-match and cross-match numbers cannot diverge.

Example wiring inside `computeMatchMetrics` (using the shared primitives):

```ts
const depth = computeDepthStats(hostShots, 'host');
const direction = computeDirectionStats(hostShots, 'host');
const lastShot = computeLastShotStats(hostShots, 'host');
const usage = computeUsageStats(hostShots, 'host');
const returnSel = computeReturnSelection(attributed, 'host', getServer); // build getServer from lookups
```

Then add to the returned object (alphabetical):

```ts
aggression_pct: direction.total > 0 ? direction.aggressionPct : null,
cc_dl_ratio: direction.ccDlRatio,
deep_pct: depth.total > 0 ? depth.deepPct : null,
fh_return_pct: returnSel.total > 0 ? returnSel.fhReturnPct : null,
fh_usage_pct: usage.total > 0 ? usage.fhUsagePct : null,
last_shot_error_pct: lastShot.endedByPlayer > 0 ? lastShot.lastShotErrorPct : null,
return_in_pct: returnSel.total > 0 ? returnSel.returnInPct : null,
short_pct: depth.total > 0 ? depth.shortPct : null,
```

> Build `getServer` from the existing `lookups` exactly like `deriveStatsFromPlay` does
> (`progress-metrics.ts:451`): `tiebreakPointServer ?? correctedServer ?? pointMatchServer`.

### 2e. Register metric metadata (`progress-insights.ts:28`)

Add to `METRIC_METADATA` (alphabetical), so movers/period-averages/sparklines pick them up:

```ts
aggression_pct: { direction: 'higher', key: 'aggression', unit: '%' },
cc_dl_ratio: { direction: 'higher', key: 'ccDlRatio', unit: '' },
deep_pct: { direction: 'higher', key: 'deepPct', unit: '%' },
fh_return_pct: { direction: 'higher', key: 'fhReturnPct', unit: '%' },
fh_usage_pct: { direction: 'higher', key: 'fhUsage', unit: '%' },
last_shot_error_pct: { direction: 'lower', key: 'lastShotError', unit: '%' },
return_in_pct: { direction: 'higher', key: 'returnIn', unit: '%' },
short_pct: { direction: 'lower', key: 'shortPct', unit: '%' },
```

> Direction notes: `deep_pct` higher is better; `short_pct` and `last_shot_error_pct` lower is
> better; `cc_dl_ratio` is contextual — mark `higher` but exclude from "focus areas" if noisy
> (add to a small `MOVER_EXCLUDE`-style set if it produces misleading movers).
> `aggression_pct` and `cc_dl_ratio` are *style*, not strictly good/bad — consider adding them to
> the `MOVER_EXCLUDE` set (`progress-insights.ts:57`) so they appear in charts but not in
> improved/declined rankings.

### 2f. i18n metric labels

Add under `tennisAnalytics.progress.metrics` in all four locales (alphabetical):
`aggression`, `ccDlRatio`, `deepPct`, `fhReturnPct`, `fhUsage`, `lastShotError`, `returnIn`,
`shortPct`. English examples:

```json
"aggression": "Aggression (inside-out/in)",
"ccDlRatio": "Cross-court : Down-the-line",
"deepPct": "Deep ball %",
"fhReturnPct": "Forehand return %",
"fhUsage": "Forehand usage %",
"lastShotError": "Last-shot error %",
"returnIn": "Return in %",
"shortPct": "Short ball %"
```

### Verification (2)
- Extend `tests/lib/tennis/progress-metrics.test.ts`: feed a fixture match with known bounce_y /
  direction shots and assert `deep_pct`, `aggression_pct`, `last_shot_error_pct`, `fh_usage_pct`.
- Extend `tests/lib/tennis/progress-insights.test.ts`: assert the new metrics surface in
  `getMetricProgress` and that `aggression_pct`/`cc_dl_ratio` are excluded from movers (if added to
  the exclude set).
- Build:

```
npx vitest run tests/lib/tennis/progress-metrics.test.ts tests/lib/tennis/progress-insights.test.ts
npm run build
```

---

## Output of this guide

After completing Guide 01 you have, for every match:
- single-match helpers (`computeDepthStats`, `computeDirectionStats`, `computeLastShotStats`,
  `computeReturnSelection`, `computeUsageStats`) ready for the tabs, and
- new `ProgressMatchMetrics` fields (`deep_pct`, `short_pct`, `aggression_pct`, `cc_dl_ratio`,
  `last_shot_error_pct`, `fh_usage_pct`, `fh_return_pct`, `return_in_pct`) flowing through the
  evolution API into the Progress page.

Proceed to `02-progress-page.md`.
