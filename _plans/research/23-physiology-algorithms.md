# Research Dossier 23 — Physiology & Training-Load Algorithms

**Scope:** Read-only inventory of every deterministic physiology / training-load algorithm in the monorepo.  
**Constraint for multi-agent system:** The LLM must NEVER invent or compute physiological numbers — only narrate values produced by these algorithms (or vendor-ingested metrics).  
**Date of analysis:** 2026-08-02  
**Mandate:** Exact file paths + line numbers, formulas, inputs, missing-data handling, scientific references, HTTP exposure, duplication/conflicts, and a numeric-grounding contract.

---

## Executive verdict

| Layer | Role | Computes numbers? |
|-------|------|-------------------|
| **Supabase PL/pgSQL** (`calculate_*`) | Authoritative readiness / ACWR / injury risk for dashboard + alerts | **Yes — primary** |
| **ppd_backend graph generators** | TRIMP, HR zones, sleep debt/efficiency, rolling averages, consistency | **Yes — charts + metadata** |
| **Next.js TS helpers** | Threshold banding, sRPE, PPC readiness fallback, wearable averages | **Yes — secondary / UI** |
| **AlertEngine** | Rule evaluation; sleep debt & test improvement inline | **Yes — partial** |
| **ppd_extraction_backend** | Ingests Garmin/Whoop/Polar vendor scores; does **not** invent composites | **No (passthrough)** |
| **ppp_ai_agent** | CGM scores + lab zone classification | **Yes — health domain** |

**Not implemented anywhere (LLM must not invent):** Banister fitness–fatigue (CTL/ATL/TSB), Foster monotony/strain, EWMA ACWR, personal HRV z-scores, VO₂ from non-vendor formulas, “body battery” recomputation.

---

## 1. Authoritative Supabase RPCs

### 1.1 `calculate_athlete_readiness`

| Field | Detail |
|-------|--------|
| **Path** | `PeakPerformanceData/peak_performance_data/supabase/migrations/20260130_dashboard_enhancement_functions.sql` L10–166 |
| **Output** | `readiness_score` (0–100-ish, higher = better), plus component scores + `recommendation` text |
| **HTTP** | Via Supabase RPC from Next.js (`fetchReadinessSnapshot`, AlertEngine, dashboards). Not a direct FastAPI route. |

**Formula (quoted):**

```sql
-- Weighted composite: training readiness 25%, sleep 20%, stress/recovery 15%,
-- load balance 20%, injury 10%, attendance 10%
readiness_score := (
  COALESCE(v_training_readiness, 50) * 0.25 +
  COALESCE(v_sleep_score, 50) * 0.20 +
  COALESCE(v_stress_recovery, 50) * 0.15 +
  COALESCE(v_load_balance, 50) * 0.20 +
  COALESCE(v_injury_factor, 100) * 0.10 +
  COALESCE(v_attendance_factor, 50) * 0.10
);
```

**Stress/recovery sub-formula (L66–73):**

```sql
v_stress_recovery := ((100 - v_stress_level) * 0.4) + (v_body_battery * 0.6);
-- or body_battery alone, or (100 - stress) alone
```

**Load balance from ACWR (L78–87):** Optimal band 0.8–1.3; at 1.0 → ~100; under 0.8 / over 1.3 degrade toward floors 40 / 20.

**Inputs / windows:**
- Latest Garmin `training_readiness_score`, `sleep_score`, stress, body battery (no freshness gate inside RPC)
- ACWR via `calculate_acwr`
- Active injuries (`active`/`recovering`)
- Attendance last **30 days** → `LEAST(100, rate * 1.1)`

**Missing data:** Defaults missing components to **50** (injury default **100**). This means a user with zero wearables can still get ~55–60. Home UI tries to gate this (`readiness-snapshot.ts`).

**Recommendation bands (L136–146):** ≥80 excellent, ≥65 good, ≥50 moderate, ≥35 low, else very low.

**Science refs in comments:** Weight split described in header; ACWR “sweet spot” 0.8–1.3 (common sports-science range; no paper citation).

---

### 1.2 `calculate_acwr`

| Field | Detail |
|-------|--------|
| **Path** | Same file L173–263 |
| **Output** | `acute_load`, `chronic_load`, `acwr` (ratio), `status`, `trend` |
| **Good direction** | Status `optimal` when **0.8 ≤ ACWR ≤ 1.3** |

**Formula:**

```sql
-- Prefer Garmin training_readiness acute_load / chronic_load (latest row)
-- Fallback:
v_acute_load  := SUM(activity_training_load) over last 7 days
v_chronic_load := SUM(activity_training_load) over last 28 days / 4.0
v_acwr := acute / chronic  -- NULL if chronic = 0
```

**Status bands (L223–233):** `<0.8` undertraining · `≤1.3` optimal · `≤1.5` overreaching · else danger.

**Trend (L235–254):** Compare to ACWR from ≥7 days ago; ±0.1 → increasing/decreasing/stable.

**Missing data:** `acwr = NULL`, status `insufficient_data` when chronic ≤ 0.

**Science:** Classic coupled acute:chronic ratio (Gabbett-style 7:28); no formal citation in SQL.

---

### 1.3 `calculate_injury_risk`

| Field | Detail |
|-------|--------|
| **Path** | Same file L271–426 |
| **Output** | `risk_score` 0–100 (**higher = worse**), `risk_level`, concerns[], recommendations[] |

**Weights (sum 100):** ACWR 25 · load spike 20 · recovery 15 · sleep 10 · HRV 10 · injury history 15 · RHR 5.

| Factor | Method (lines) | Thresholds |
|--------|----------------|------------|
| ACWR | L302–317 | >1.5 → +25; >1.3 → +15; <0.8 → +7.5 |
| Load spike | L319–335 | WoW % increase >30 → +20; >20 → +10 |
| Recovery | L337–353 | Days in last 7 with daily load >100: ≥4 → +15; ≥3 → +9 |
| Sleep debt | L355–367 | vs **7 h (420 min)** over 7 nights; >180 min debt → +10; >120 → +6 |
| HRV trend | L369–381 | Last 3d `weekly_avg` < prior window × 0.9 → “declining” → +10 |
| Injury history | L383–396 | Count last 12 mo: ≥3/+15, ≥2/+9, 1/+4.5 |
| RHR | L398–413 | Latest > 30d avg × 1.1 → +5 |

**Levels (L417–422):** ≥60 high · ≥40 elevated · ≥20 moderate · else low.

**Missing data:** Factors that cannot be computed contribute 0 (score stays low → “low risk” even with sparse data — optimistic bias).

---

### 1.4 Batch RPCs (simplified / divergent)

#### `get_athletes_readiness_batch`

| Field | Detail |
|-------|--------|
| **Path** | `.../supabase/migrations/20260131_athletes_readiness_batch.sql` L6–340 |
| **Role** | Coach matrix; mirrors readiness/ACWR logic with LATERAL joins |

**Conflict note:** Recommendation CASE (L175–226) uses a **simplified** readiness expression that hardcodes load_balance=50, injury=100, attendance=50 — so recommendation text can disagree with the fuller `readiness_score` computed above it (L137–170). Injury risk in batch is **simplified** (omits sleep/HRV/RHR/recovery-day factors).

#### `get_alert_metrics_batch`

| Field | Detail |
|-------|--------|
| **Path** | `.../supabase/migrations/20260131_alert_achievement_batch.sql` L9–199 |
| **Outputs** | acwr, attendance_rate_30d, injury_risk_score (simplified), readiness_score (simplified — load/injury/attendance fixed at 50/100/50), sleep_debt_minutes, test_improvement |

**Conflict:** Alert readiness ≠ `calculate_athlete_readiness`. Alert injury risk ≠ full `calculate_injury_risk`.

---

## 2. AlertEngine (threshold / rule engine)

| Field | Detail |
|-------|--------|
| **Path** | `PeakPerformanceData/peak_performance_data/src/services/alerts/AlertEngine.ts` |
| **HTTP** | `POST/GET /api/alerts/*`, `POST /api/alerts/evaluate/[athleteId]` |

**Does not invent physiology formulas for ACWR/readiness/injury** — calls RPCs (L218–230). Inline algorithms:

### 2.1 Sleep debt minutes (L246–261)

```ts
// 7 hours baseline = 420 minutes
return sleep.reduce((debt, s) => {
  const duration = (s.sleep_duration_seconds || 0) / 60;
  return debt + Math.max(0, 420 - duration);
}, 0);
```

- Window: last 7 days from `garmin_connect_sleep`
- Missing nights: not imputed; only logged nights contribute
- **Conflicts with** Python sleep-duration debt (8 h target)

### 2.2 Test improvement % (L264–297)

Average % change across 18m run (lower better), vertical jump (higher better), 2.4 km (lower better) between latest two `hiit_trainings`. Requires ≥2 tests.

### 2.3 Attendance rate 30d (L233–244)

`present / total * 100` over 30 days.

### 2.4 Condition evaluation (L165–174)

Operators: `>`, `<`, `=`, `>=`, `<=`, `change_exceeds` (|value| > threshold). Definitions from `alert_definitions` table.

---

## 3. ppd_backend graph algorithms (deterministic Python)

**Service:** `ppd_backend` FastAPI  
**HTTP:** `/api/v1/graphs/{graph_type}/{user_id}`, batch `/api/v1/graphs/batch/{user_id}` (`api/routes/graphs.py`). Public proxy also at `https://api.wearablesync.app/ppc/api/v1/graphs/...`.

### 3.1 Bannister TRIMP + rolling load

| Field | Detail |
|-------|--------|
| **Path** | `.../ppd_backend/data_processing/graphs/training_graphs/training_load.py` L28–45, L65–113 |
| **Output** | Session/daily TRIMP (dimensionless impulse); 7-day & 28-day rolling means |
| **Does NOT emit ACWR ratio** | Only acute/chronic averages as chart traces |

**Formula (quoted L31–45):**

```python
"""Bannister TRIMP = duration × ΔHR-ratio × 0.64 × e^(1.92 × ΔHR-ratio)."""
hr_ratio = (avg_hr - rest_hr) / (max_hr - rest_hr)  # rest_hr default 50
# else hr_ratio = avg_hr / 200.0
return duration_min * hr_ratio * 0.64 * math.exp(1.92 * hr_ratio)
```

- Inputs: `ow_workouts` duration, average_hr, max_hr; default window **180 days**
- Missing: dropna on average_hr; invalid → 0 TRIMP
- Rolling: 7d `min_periods=2`; 28d `min_periods=7`
- **Science:** Named “Bannister TRIMP” in docstring (Banister 1991-style male constants 0.64 / 1.92)

### 3.2 HRV trends (display + rolling)

| Field | Detail |
|-------|--------|
| **Path** | `.../graphs/health_graphs/hrv_trends.py` |
| **Output** | Nightly HRV ms (SDNN or RMSSD) + 7-day rolling avg; period mean |
| **Computation** | Source resolution + `rolling(7, min_periods=3)` — **no personal baseline/z-score** |

Healthy band annotation 20–80 ms (L88–95 comment: “RMSSD 20-80ms typical for active adults”) — applied even when metric is SDNN.

Sources (L112–154): sleep `avg_hrv_sdnn_ms` → timeseries SDNN → RMSSD → legacy → Garmin table.

### 3.3 Sleep duration metadata (debt, consistency)

| Field | Detail |
|-------|--------|
| **Path** | `.../graphs/health_graphs/sleep_duration.py` |
| **Refs** | NSF 18–64 guideline for 7–9 h (L26–28) |

Constants: `_HEALTHY_RANGE_LOW_H = 7`, `_HIGH = 9`, `_TARGET_H = 8`.

**Sleep debt (L169–173):**

```python
debt_per_night = (_TARGET_H - total_hours).clip(lower=0)
sleep_debt_h = float(debt_per_night.sum().round(1))
```

**Consistency:** `std(duration_min, ddof=0)` when ≥2 nights (L175–183).

Rolling total-sleep: 7-day, `min_periods=3`.

### 3.4 Sleep efficiency zones

| Field | Detail |
|-------|--------|
| **Path** | `.../graphs/health_graphs/sleep_efficiency.py` |
| **Cutoffs** | Poor `<75%`, Fair `75–85`, Good `≥85` (L31–32, L94–98) |
| **Rolling** | 7-day `min_periods=3` if ≥3 nights |
| **WoW delta** | Requires ≥14 nights (L173–178) |
| **Science** | “Clinical interpretation” in comments; no paper ID |

Uses provider `efficiency_percent` — does not recompute from stages.

### 3.5 Recovery score (Whoop passthrough + zones)

| Field | Detail |
|-------|--------|
| **Path** | `.../graphs/health_graphs/recovery_score.py` |
| **Output** | Vendor recovery % 0–100; zones Low ≤33 / Moderate ≤66 / High ≤100 (L19–23) |
| **Computation** | Daily avg from timeseries; **no PPD formula** |

### 3.6 HR zone distribution

| Field | Detail |
|-------|--------|
| **Path** | `.../graphs/health_graphs/hr_zone_distribution.py` L27–34, L72–100 |
| **Method** | Max HR = clamp(q99 of samples, 140–220); minute-bin average HR; 5-zone model 50–100% HRmax |

Zones: Z1 50–60 · Z2 60–70 · Z3 70–80 · Z4 80–90 · Z5 90–100 % max HR.

### 3.7 Training consistency

| Field | Detail |
|-------|--------|
| **Path** | `.../graphs/volume_graphs/training_consistency.py` |
| **Metric** | Distinct days/week with workout **> 5 min**; target **4 days** |
| **Outputs** | `consistency_percent` = weeks_on_target/total×100; streak; avg days/week |

### 3.8 Intensity minutes

| Field | Detail |
|-------|--------|
| **Path** | `.../graphs/training_graphs/intensity_minutes.py` |
| **Computation** | Plot vendor moderate/vigorous minutes; WHO daily goal line **~21 min** (150/7) — L56–62 |

### 3.9 VO₂ max trends

| Field | Detail |
|-------|--------|
| **Path** | `.../graphs/training_graphs/vo2_max_trends.py` |
| **Computation** | Vendor VO₂ + 5-point rolling; fitness zone lines at 50/40/30 (Excellent/Good/Fair) — display only |

### 3.10 Resting HR / Stress / Body Battery / SpO2 / Respiration

| Graph | Path | Deterministic math |
|-------|------|-------------------|
| Resting HR | `resting_heart_rate.py` | 7d rolling (`min_periods=3`); healthy band 50–70 bpm annotation |
| Stress | `stress_levels.py` | Zones Rest/Low/Medium at 25/50/75 (display) |
| Body battery | `body_battery.py` | Daily min/max/avg from timeseries |
| Blood O₂ | `blood_oxygen.py` | 7d rolling |
| Respiration | `respiration_rate.py` | 7d rolling |

These mostly **visualize vendor metrics**; rolling averages are the only PPD math.

---

## 4. Next.js TypeScript algorithms

### 4.1 ACWR / load helpers (banding only)

**Path:** `.../src/lib/calculations/training-load.ts`

```ts
// L2–8 — status from ratio (does not compute ACWR)
if (acwr < 0.8) undertraining
if (acwr <= 1.3) optimal
if (acwr <= 1.5) overreaching
else danger

isLoadSpike: WoW delta > 30%   // L31–35
getOptimalLoadRange: [0.8, 1.3] × chronic  // L37–41
```

Aligned with SQL status bands.

### 4.2 Readiness banding

**Path:** `.../src/lib/calculations/readiness.ts`  
Levels: ≥80 excellent · ≥65 good · ≥50 moderate · ≥35 low · else very_low.  
**Conflict:** Colors use ≥70 / ≥50 (L11–20) vs levels use 80/65; coach matrix also uses 70/50.

### 4.3 Injury risk banding

**Path:** `.../src/lib/calculations/injury-risk.ts` — mirrors SQL levels (≥60/40/20). No score computation.

### 4.4 Body-data route — **alternate readiness formula**

**Path:** `.../src/app/api/dashboard/player/body-data/route.ts` L221–228

```ts
function calculateTrainingReadiness(data: any): number {
  const batteryScore = (data.body_battery_high || 50) * 0.3;
  const sleepScore = (data.sleep_score || 50) * 0.4;
  const stressScore = ((100 - (data.stress_avg || 50)) * 0.3);
  return Math.round(batteryScore + sleepScore + stressScore);
}
```

Also `getHRVStatus` absolute ms: ≥60 Balanced · ≥40 Slightly Low · ≥20 Low · else Very Low (L214–218) — **not baseline-relative**.  
Sleep quality: ≥80 Excellent · ≥60 Good · ≥40 Fair (L206–211).

### 4.5 PPC readiness fallback — **third readiness / fake ACWR**

**Path:** `.../src/lib/dashboard/readiness-snapshot.ts`

**`deriveLoadRatio` (L87–109)** — labeled as `acute_chronic_load_ratio` but is:

```
current_last_weekly_volume / mean(previous up to 4 points)
```

from `weekly_workout_volume` graph — **not** 7d/28d ACWR.

**`deriveFallbackReadinessScore` (L150–178):** Prefer Whoop recovery; else average of:
- `(sleepHours / 8) * 100`
- `(hrvMs / 70) * 100`
- `100 - (|loadRatio - 1| / 0.75) * 100`

### 4.6 sRPE

**Paths:** `wellnessTools.ts` L36–37; `athleteTools.ts` ~L879  
`sRPE = RPE × session_duration_minutes` (Foster session-RPE load). Stored in `player_pse_scores.srpe`.

### 4.7 Wearable query aggregates

**Path:** `.../src/app/api/ai-agent/wearable-query/route.ts` L108–127  
Average of activity metrics; trend if ≥4 points: first half vs second half, ±5% → up/down.

### 4.8 Physical-test percentiles & benchmarks

| File | Algorithm |
|------|-----------|
| `physical-test-metrics.ts` L165–185 | Linear min–max percentile in cohort; invert if lower-is-better; n≤1 → 50 |
| Same L206–246 | Category score = mean of metric percentiles |
| `physical-test-benchmarks.ts` | American age/sex band → 0–100 score |
| `benchmarks.ts` L60–67 | Age-group p25/p50/p75/p90 interpolation |

---

## 5. Extraction backend (passthrough)

**Path examples:**
- `ppd_extraction_backend/src/garmin/extractors/training_readiness_extractor.py` — maps Garmin `score`, factor percents, `hrvWeeklyAverage` as `baseline_hrv_value` (L51–76). **No composite readiness invented.**
- Sleep / HRV / body battery / training status extractors store vendor fields (`training_load_ratio`, sleep scores, etc.).

Legacy extraction (`ppd_legacy_extraction_backend`) similarly stores Garmin baselines (`baseline_low`/`high` for HRV) without recomputing.

---

## 6. ppp_ai_agent health scoring (related physiology)

Documented deeply in `09-tools-health-domain.md`; summarized for the grounding contract:

### 6.1 CGM scores — `tools/cgm.py`

| Score | Formula | Range / good |
|-------|---------|--------------|
| Spike | `100 - (pct_above_140 * 60 + excursion_factor * 40)` L49–67 | 0–100; **higher = better** (despite dataclass comment) |
| Stability | From CV%: `100 - cv*2.5` L70–89 | 0–100; higher better |
| TIR | % in **70–140 mg/dL** L92–106 | % |
| Fasting baseline | Median of 03:00–09:00 readings L109–128 | mg/dL |

Empty readings → spike/stability return **50** (neutral).

### 6.2 Biomarker zones — `tools/optimal_zones.py` L46–79

Classify vs ref + optimal bands → `below_normal` / `below_optimal` / `optimal` / `above_optimal` / `above_normal` / `normal`. Delta from optimal L82–102.

---

## 7. Duplication & conflicting definitions (critical)

| Metric | Location A | Location B | Conflict |
|--------|------------|------------|----------|
| **Readiness score** | SQL composite (6 weights, default 50s) | body-data TS (battery 30/sleep 40/stress 30) | Different formulas → different numbers |
| **Readiness score** | SQL | PPC fallback (recovery or sleep/HRV/load blend) | Third definition |
| **Readiness score** | `calculate_athlete_readiness` | `get_alert_metrics_batch` simplified | Alerts use incomplete readiness |
| **ACWR** | SQL 7d sum / (28d sum / 4) or Garmin | `deriveLoadRatio` weekly volume ratio | **Same field name, different math** |
| **Training load** | Garmin `activity_training_load` (SQL) | Bannister TRIMP (Python graphs) | Different units; not interchangeable |
| **Sleep debt** | Alert/SQL: **7 h** baseline | Python sleep graph: **8 h** target | Debt hours disagree |
| **HRV “status”** | Absolute ms thresholds in body-data | Injury risk: 3d vs prior ×0.9 | Absolute vs relative |
| **Readiness UI bands** | Levels 80/65/50/35 | Colors/matrix 70/50 | “Ready” count vs level labels disagree |
| **Injury risk** | Full 7-factor SQL | Batch alert/matrix simplified | Scores diverge |
| **Recommendation text** | Full readiness score | Batch recommendation CASE uses hardcoded 50s for load/injury/attendance | Text vs score mismatch |

**No z-score physiology algorithms found** (search hits were unrelated).  
**No Foster monotony/strain implementation** (only competitor-analysis docs mention CTL/ATL/TSB).

---

## 8. Numeric-grounding contract — facts the agent may state

### 8.1 MAY state (deterministic or vendor-sourced)

| # | Fact | Source of truth | Units / range | Notes |
|---|------|-----------------|---------------|-------|
| 1 | `readiness_score` from `calculate_athlete_readiness` | Supabase RPC | ~0–100, ↑ better | Prefer this over TS fallbacks |
| 2 | Component scores: training_readiness, sleep_score, stress_recovery, load_balance, injury_factor, attendance_factor | Same RPC | 0–100 | |
| 3 | RPC recommendation text | Same RPC | text | |
| 4 | ACWR, acute_load, chronic_load, status, trend | `calculate_acwr` | ratio; status enum | Prefer over `deriveLoadRatio` |
| 5 | Injury risk_score, risk_level, concerns | `calculate_injury_risk` | 0–100, ↑ worse | Prefer full RPC over batch |
| 6 | Sleep debt minutes (7h baseline) | AlertEngine / SQL injury / alert batch | minutes | State baseline used |
| 7 | Sleep debt hours vs **8 h** target | sleep_duration graph metadata | hours | Different baseline — label it |
| 8 | Sleep avg hours, nights ≥7, nights in 7–9, consistency stdev | sleep_duration metadata | h / count / min | |
| 9 | Sleep efficiency %, zone counts, WoW delta | sleep_efficiency metadata | % | |
| 10 | Vendor sleep_score, body_battery, stress, Garmin training_readiness | Tables / extractors | vendor scales | Do not recompute |
| 11 | Whoop recovery_score | timeseries / recovery graph | 0–100% | |
| 12 | Nightly HRV ms + 7d rolling + period avg | hrv_trends | ms | State SDNN vs RMSSD |
| 13 | Session/daily TRIMP + 7d/28d rolling TRIMP | training_load.py | TRIMP units | Not Garmin load |
| 14 | Garmin activity_training_load sums | activities table | Garmin load units | |
| 15 | sRPE = RPE × minutes | wellness/athlete tools | load units | |
| 16 | Attendance rate 30d | SQL / AlertEngine | % | |
| 17 | Load spike WoW % | injury risk / `isLoadSpike` | % | Spike if >30% |
| 18 | HR zone minutes Z1–Z5 | hr_zone_distribution | min/day | maxHR = p99 |
| 19 | Training consistency % / streak / days per week | training_consistency | % / weeks / days | Target 4 d/wk |
| 20 | Intensity moderate/vigorous minutes | intensity_minutes | min | WHO ~21 min/day line |
| 21 | VO₂ max (vendor) + rolling | vo2_max_trends | mL·kg⁻¹·min⁻¹ | |
| 22 | RHR daily + 7d rolling | resting_heart_rate | bpm | |
| 23 | Activity avg/current + trend for HR/distance/duration/calories | wearable-query | varies | ±5% halves |
| 24 | Physical-test category percentiles / benchmark scores | physical-test-* | 0–100 | Cohort or US tables |
| 25 | Test improvement % (HIIT pair) | AlertEngine | % | |
| 26 | CGM spike/stability/TIR/fasting baseline | ppp_ai_agent cgm.py | scores / % / mg/dL | Lifestyle disclaimer |
| 27 | Biomarker zone status + delta from optimal | optimal_zones.py | enum / numeric delta | |
| 28 | Alert trigger comparisons | AlertEngine + definitions | boolean | Thresholds from DB |

### 8.2 MUST NOT invent (hallucination traps)

| Temptation | Why forbidden |
|------------|---------------|
| Personal HRV baseline / z-score / “% below baseline” | Not computed (vendor baselines stored but unused in PPD formulas) |
| CTL / ATL / TSB / fitness–fatigue | Not implemented |
| Monotony / strain (Foster) | Not implemented |
| “True” ACWR from TRIMP | Python only plots rolling TRIMP; ACWR is Garmin/SQL load |
| Recomputed body battery / Whoop strain | Vendor-only |
| Absolute “good HRV is X ms” as clinical truth | Only display bands; age/sex not modeled |
| Sleep need personalization beyond fixed 7h or 8h | Fixed targets only |
| Injury probability % | Risk score is heuristic points, not probability |
| VO₂ estimated from age/HR formulas | Vendor values only |
| Filling missing readiness with 50 without saying “defaulted” | RPC defaults invent mid-scale scores |
| Using `deriveLoadRatio` as ACWR | Misnamed field |
| Using body-data `calculateTrainingReadiness` as the org readiness | Divergent formula |
| Medical diagnosis from CGM/labs | Explicitly lifestyle / zone classification only |
| Averaging incompatible load units (TRIMP + Garmin load + sRPE) | Different scales |

### 8.3 Preferred single source of truth (agent policy)

| Concept | Canonical | Fallback if null |
|---------|-----------|------------------|
| Readiness | `calculate_athlete_readiness` | Vendor Whoop recovery **labeled as recovery**, not “PPD readiness” |
| ACWR | `calculate_acwr` | insufficient_data — do not substitute volume ratio |
| Injury risk | `calculate_injury_risk` | null / unknown |
| Sleep debt (alerts) | 7 h / 420 min | — |
| Sleep debt (charts) | 8 h target metadata | — |
| Training impulse (OW graphs) | Bannister TRIMP | — |
| Session wellness load | sRPE | — |

---

## 9. HTTP / service map

| Algorithm family | Service | Exposure |
|------------------|---------|----------|
| SQL calculate_* / batches | Supabase | RPC from Next.js server |
| AlertEngine | Next.js | `/api/alerts/**` |
| Graph generators (TRIMP, HRV, sleep, …) | ppd_backend | `/api/v1/graphs/**` (+ wearablesync proxy) |
| Wearable activity aggregates | Next.js → ppd_backend | `/api/ai-agent/wearable-query` → `/wearables/activities/{id}` |
| CGM / lab zones | ppp_ai_agent | Agent tools / insights API |
| Extraction | ppd_extraction_backend | Ingest jobs only |

---

## 10. Gaps for hallucination-eval design

1. **Fixture: missing wearables** — assert agent does not state readiness ≈50 from RPC defaults without data-quality caveat.  
2. **Fixture: ACWR naming** — assert agent never calls weekly volume ratio “ACWR”.  
3. **Fixture: sleep debt** — assert stated baseline (7h vs 8h) matches tool used.  
4. **Fixture: TRIMP vs Garmin load** — assert units not mixed.  
5. **Fixture: invent CTL/monotony** — must refuse / say unavailable.  
6. **Fixture: HRV z-score** — must refuse.  
7. **Cross-UI consistency** — coach matrix (batch) vs player home (full RPC) may already disagree; agent should prefer full RPC and not reconcile inventively.

---

## 11. File index (quick)

| Path | Algorithms |
|------|------------|
| `peak_performance_data/supabase/migrations/20260130_dashboard_enhancement_functions.sql` | readiness, ACWR, injury risk |
| `.../20260131_athletes_readiness_batch.sql` | batch readiness/ACWR/risk |
| `.../20260131_alert_achievement_batch.sql` | alert metrics batch |
| `peak_performance_data/src/services/alerts/AlertEngine.ts` | thresholds, sleep debt, test Δ |
| `peak_performance_data/src/lib/calculations/*.ts` | banding, sRPE helpers, physical tests |
| `peak_performance_data/src/lib/dashboard/readiness-snapshot.ts` | PPC fallback readiness/load ratio |
| `peak_performance_data/src/app/api/dashboard/player/body-data/route.ts` | alt readiness + HRV status |
| `ppd_backend/.../training_load.py` | Bannister TRIMP |
| `ppd_backend/.../hrv_trends.py` | HRV rolling |
| `ppd_backend/.../sleep_duration.py` | 8h debt, NSF range |
| `ppd_backend/.../sleep_efficiency.py` | 75/85 cutoffs |
| `ppd_backend/.../hr_zone_distribution.py` | 5-zone minutes |
| `ppd_backend/.../training_consistency.py` | days/week target |
| `ppd_extraction_backend/.../training_readiness_extractor.py` | Garmin passthrough |
| `ppp_ai_agent/tools/cgm.py` | CGM scores |
| `ppp_ai_agent/tools/optimal_zones.py` | lab zones |

---

*End of dossier 23.*
