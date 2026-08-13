# 79 — TS Wearable / Analytics / Query Tools → Python Consolidation Map

**Status:** Read-only research dossier  
**Date:** 2026-08-02  
**Scope:** Deep-read of highest-value read-only tool groups in Next.js AI tools; specify faithful Python replacements and a consolidation map targeting ~20–28 parameterized tools overall.  
**Method:** Full file reads + schema cross-check against `database.types.ts`, `ppd_backend/api/routes/wearables.py`, `ppp_ai_agent/tools/wearables.py`, and prior dossiers (16, 20, 21, 32).

**Primary sources (read in full):**

| File | Path |
|------|------|
| Wearable insights | `PeakPerformanceData/peak_performance_data/src/lib/ai/tools/wearableInsightTools.ts` |
| Garmin activities | `…/garminActivityTools.ts` |
| Analytics | `…/analyticsTools.ts` |
| Query / roster | `…/queryTools.ts` |
| Athlete self-tools | `…/athleteTools.ts` |
| Filter athletes | `…/filterAthleteTools.ts` |
| Specialist proxies | `…/specialistTools.ts` |
| Wearable BFF | `…/src/app/api/ai-agent/wearable-query/route.ts` |
| Descriptions | `…/src/lib/ai/prompts/systemPrompt.ts` L183–213 |
| CH activities API | `PeakPerformanceData/ppd_backend/api/routes/wearables.py` |
| Python wearables | `PeakPerformanceData/ppp_ai_agent/tools/wearables.py` |

**Do not modify application code.** This file is the only write artifact.

---

## Executive findings

1. **Coach wearable tools are already on ClickHouse** via `PPD_BACKEND_URL/wearables/activities/{id}` (`ow_workouts`). Python `get_wearable_activities` queries the same store.
2. **Athlete-facing `getMyGarminActivities` still reads legacy Supabase `garmin_connect_activities`** — the dual-read gap that produces chart-inconsistent numbers for the player agent.
3. **`filterAthletes.hasGarmin` reads nonexistent `garmin_connections`** (real table: `garmin_connect_accounts`).
4. **`athleteTools` has multiple schema-broken queries** (tennis test columns, `athlete_id` vs `player_id`, `training_date` vs `session_date`, `athlete_goals` vs `player_goals`, `pse_scores` vs `player_pse_scores`, `achievements` vs `player_achievements`, `plan_name` vs `name`).
5. **Consolidation target for these groups:** ~9 parameterized Python tools subsume ~35 factory tools in these files (reads + the write surfaces that should stay out of the read agent or be gated separately).

---

## A. Per-tool inventory

### A1. `wearableInsightTools.ts`

#### `getAthleteWearableInsight` — L16–109

| Field | Detail |
|-------|--------|
| **Name** | `getAthleteWearableInsight` |
| **Zod params** | `athleteName: string`; `metric: enum['average_hr','calories','distance_km','duration_min','max_hr']`; `period: enum['7d','14d','30d'].default('7d')` |
| **Description (quoted)** | `Query Garmin wearable data for an athlete. Use this for questions like "How was João's heart rate this week?", "How far did Ana run in the last 14 days?", "What is Carlos's average training duration?", or "Show me activity trends". Supported metrics: average_hr, max_hr, distance_km, duration_min, calories.` |
| **Data source** | Supabase `profiles` (name resolve, org-scoped) → **HTTP** `POST {NEXT_PUBLIC_APP_URL}/api/ai-agent/wearable-query` → that route → **ppd_backend ClickHouse** `openwearables_data.ow_workouts` |
| **Legacy Supabase activities?** | **No** (path is ClickHouse). |
| **Auth** | Org filter on profile search (`organization_id`, `role='player'`). Downstream route checks session user org + coach/admin or self. **No coach assignment (`playerIds`) scope.** Tool sends `x-internal-service` but the route **ignores it** and requires a user session — server-side `fetch` may 401 if cookies are not forwarded. |
| **Volume** | Pre-aggregated: average, currentValue, trend; returns **at most 10** `dataPoints` (sliced L89). Raw activities not returned. |
| **Return shape** | Success: `{ success: true, athleteName, average, currentValue, dataPoints: [{date,value}], metricLabel, period, trend: 'up'\|'down'\|'stable' }` or empty-message success. Failure: `{ success: false, error }`. |

**TS computation to reimplement (exact):**

Trend / extract logic lives in `wearable-query/route.ts` L94–127:

```typescript
const extractValue = (a: ActivityRow, m: string): number | null => {
  switch (m) {
    case 'average_hr': return a.average_hr
    case 'calories': return a.calories
    case 'distance_km': return a.distance ? Math.round(Number(a.distance) / 100) / 10 : null
    case 'duration_min': {
      const dur = a.moving_duration ?? a.duration
      return dur ? Math.round(Number(dur) / 60 * 10) / 10 : null
    }
    case 'max_hr': return a.max_hr
    default: return null
  }
}
// ...
const average = values.length
  ? Math.round((values.reduce((s, v) => s + v, 0) / values.length) * 10) / 10
  : null
// Trend: if values.length >= 4, compare first half mean vs second half mean; >5% up, <-5% down
```

**Subtle:** `distance_km` uses `Math.round(distance/100)/10` (one decimal from meters), not `distance/1000`. Values are ordered as returned by CH (newest first); “recent” half is indices `0..half`.

---

#### `getTeamActivityLeaderboard` — L111–213

| Field | Detail |
|-------|--------|
| **Name** | `getTeamActivityLeaderboard` |
| **Zod params** | `metric: enum(SUPPORTED_METRICS)`; `period: enum['7d','14d','30d'].default('7d')` |
| **Description (quoted)** | `Rank all athletes in the team by a wearable metric for a given period. Use this for questions like "who ran the most this week?", "which player has the highest average heart rate?", or "show me the team activity leaderboard".` |
| **Data source** | Supabase `profiles` (all players in org, limit 100) → **N parallel** `GET {PPD_BACKEND_URL}/wearables/activities/{id}?days_back=&limit=200` → **ClickHouse** |
| **Legacy?** | **No.** |
| **Auth** | Org filter only. **No assignment scope.** Fan-out N+1 HTTP. |
| **Volume** | Aggregated leaderboard (one row per athlete with data). Up to 100 athletes × 200 activities fetched then discarded. |
| **Return** | `{ success, leaderboard: [{activityCount, athleteName, value}], metricLabel, period, totalAthletes }` |

**TS aggregation to reimplement (exact, L156–190):**

```typescript
switch (metric) {
  case 'average_hr': value = act.average_hr as number | null; break
  case 'calories': value = act.calories as number | null; break
  case 'distance_km': value = act.distance ? Number(act.distance) / 1000 : null; break
  case 'duration_min': {
    const dur = (act.moving_duration ?? act.duration) as number | null
    value = dur ? Number(dur) / 60 : null
    break
  }
  case 'max_hr': value = act.max_hr as number | null; break
}
const isAvgMetric = ['average_hr', 'max_hr'].includes(metric)
const value = isAvgMetric ? sum / count : sum  // SUM for distance/calories/duration
return { activityCount: count, athleteName, value: Math.round(value * 10) / 10 }
```

**Subtle / naive-port trap:** Leaderboard `distance_km` uses `/1000` while insight tool uses `round(d/100)/10`. HR metrics average per activity; volume metrics **sum**. Athletes with zero countable values are dropped.

---

### A2. `garminActivityTools.ts`

#### `getGarminActivities` — L5–112

| Field | Detail |
|-------|--------|
| **Name** | `getGarminActivities` |
| **Zod params** | `athleteName: string`; `activityType?: string`; `startDate?: YYYY-MM-DD`; `endDate?: YYYY-MM-DD`; `limit: number.default(10)` |
| **Description (quoted)** | `Get Garmin Connect activities for an athlete. Use this to view recent runs, rides, swims, and other activities synced from their Garmin device. Returns distance, duration, pace, heart rate, and other metrics.` |
| **Data source** | Supabase `profiles` → **ppd_backend ClickHouse** `ow_workouts` (default `days_back=90` if no dates) |
| **Legacy?** | **No.** |
| **Auth** | Org + `role='player'`. No assignment scope. |
| **Volume** | Raw activity list, default 10, mapped/normalized. |
| **Return** | `{ success, athlete, count, activities: [{id, activityName, activityType, date, distanceKm, durationMinutes, paceMinPerKm, averageHR, maxHR, calories}] }` |

**TS mapping (exact, L71–92):**

```typescript
const distanceKm = distance ? distance / 1000 : null
const durationMin = movingDur ? movingDur / 60 : dur ? dur / 60 : null
const paceMinPerKm = distanceKm && durationMin && distanceKm > 0
  ? parseFloat((durationMin / distanceKm).toFixed(2))
  : null
```

Client-side `activityType` filter is substring `includes` on `activity_type` (case-insensitive).

---

### A3. `analyticsTools.ts`

#### Helpers (must port)

`getStartDateForPeriod` L13–30 — calendar subtract week/month/quarter/year.  
`calculateAttendanceRate` L35–51 — present / all attendance rows across sessions, percent.  
`calculatePerformanceBreakdown` L56–87 — rating buckets ≥4.5 excellent, ≥3.5 good, ≥2.5 average, else poor → **percentages**.  
`generateInsights` L100–142 / `generateAthleteInsights` L255–288 — rule thresholds (attendance 70/90, poor>20, hours/athlete 2–10, etc.).

#### `getTeamAnalytics` — L144–250

| Field | Detail |
|-------|--------|
| **Name** | `getTeamAnalytics` |
| **Zod params** | `metric: enum['all','attendance','performance','training_volume'].default('all')`; `period: enum['month','quarter','week','year'].default('month')` |
| **Description (quoted from TOOL_DESCRIPTIONS)** | `Get comprehensive team-wide analytics and AI-generated insights. Use this when the user asks about overall team performance, attendance rates, performance distribution, training volume, or aggregate statistics. Supports time periods: week, month, quarter, or year. Can focus on specific metrics: attendance, performance, training_volume, or all. Returns insights like attendance warnings, performance trends, and training recommendations.` |
| **Data source** | **Supabase only:** `profiles` (count), `group_training_sessions` + nested `group_training_attendance`, `training_reports`, `tournaments` |
| **Auth** | `organization_id` on all queries. No assignment scope. Roles counted: `['athlete','player']`. |
| **Volume** | Pre-aggregated metrics + small insights array. Training hours = `totalSessions * 1.5` (**estimate, not duration math**). |
| **Return** | `{ success, metrics: {…}, insights: Insight[] }` |

**Subtle:** `totalTrainingHours = Math.round(totalSessions * 1.5)` — naive port that uses real `start_time`/`end_time` will diverge from current behavior.

---

#### `getAthleteStats` — L290–427

| Field | Detail |
|-------|--------|
| **Name** | `getAthleteStats` |
| **Zod params** | `athleteName: string`; `period: enum['month','quarter','week','year'].optional.default('month')` |
| **Description (quoted)** | `Get detailed performance statistics and insights for a specific athlete. Use this when the user wants to see an athlete's progress, attendance rate, performance ratings, training plans, or tournament registrations. Supports time periods: week, month, quarter, or year. Returns AI-generated insights about the athlete's commitment and performance.` |
| **Data source** | Supabase: `profiles`, `group_training_attendance` (**`player_id`**), `tournament_registrations` (direct `athlete_id` + `registered_players` contains), `training_plans`, `training_reports` (`attendance` contains athlete id) |
| **Auth** | Org on profile + session org filter. No assignment scope. |
| **Volume** | Aggregated stats + up to 5 plans + tournament name list + insights. |
| **Return** | `{ success, stats: { athlete, performance, tournamentRegistrations, trainingPlans }, insights }` |

**TS attendance/rating (exact, L371–382):**

```typescript
const attendanceRate = totalSessions > 0 ? Math.round((presentSessions / totalSessions) * 100) : 0
const avgPerformanceRating = performanceRatings.length > 0
  ? Math.round((performanceRatings.reduce((sum, r) => sum + r, 0) / performanceRatings.length) * 10) / 10
  : null
```

Tournament regs are **deduped by registration id** across direct + team paths (L365–369).

---

### A4. `queryTools.ts` (read + write; reads first)

#### `getAthletes` — L9–49

| Field | Detail |
|-------|--------|
| **Zod** | `category?: string` (**UNUSED in execute**); `limit: number.default(20)` |
| **Description** | `Get list of athletes in the organization. Use this to find athlete names before creating reports or registering for tournaments.` |
| **Source** | Supabase `profiles` |
| **Auth** | Org + `role='player'`; optional `playerIds` assignment filter |
| **Return** | `{ success, athletes: [{id,name,email}], count }` — **note: DOB selected but not returned** |
| **Volume** | Directory metadata, ≤20 |

#### `searchAthlete` — L51–98

| Field | Detail |
|-------|--------|
| **Zod** | `query: string` |
| **Description** | `Search for an athlete by name. Use this when you need to find a specific athlete before creating reports or registering for tournaments.` |
| **Source** | Supabase `profiles` ilike; limit 10 |
| **Auth** | Org + optional assignment |
| **Return** | Same athlete shape; empty → `success: false` with hint |

#### `getPerformanceTests` — L419–488

| Field | Detail |
|-------|--------|
| **Zod** | `athleteName`; `limit.default(10)`; `testType?: enum['lactate','other','threshold','time_trial','vo2max']` |
| **Description** | `Get performance test history for an athlete. Use this to view past test results like lactate tests, VO2max tests, or time trials.` |
| **Source** | Supabase `performance_tests` (threshold/lactate fields) — **does not include `tennis_specific_tests`** |
| **Auth** | Org on profile resolve only; tests filtered by `athlete_id` |
| **Return** | `{ success, athlete, count, tests: [{id, testDate, testType, aerobicThresholdHR, …}] }` |

#### Write tools in this file (out of read consolidation, but listed)

| Tool | Lines | Table | Notes |
|------|------:|-------|-------|
| `createPlayer` | 100–148 | auth + profiles via `createManagedPlayer` | Invite flow |
| `createPerformanceTest` | 150–233 | `performance_tests` | Insert |
| `updateAthleteNotes` | 235–282 | `profiles.coach_notes` | |
| `updatePlayer` | 284–359 | `profiles` | |
| `deletePlayer` | 361–417 | `profiles.organization_id=null` | Soft unassign; confirmation gate |
| `updatePlayerDetails` | 490–585 | `player_details` upsert | |
| `getCoaches` | 587–619 | `profiles` roles coach/admin | **Read** |

`getCoaches` description: `Get list of coaches in the organization. Use this to find coach names before assigning players to coaches or when reviewing team structure.`

---

### A5. `filterAthleteTools.ts`

#### `filterAthletes` — L5–125

| Field | Detail |
|-------|--------|
| **Zod** | `hasActiveInjury?: bool`; `hasGarmin?: bool`; `hasNoTrainingInDays?: number`; `limit.default(50)`; `skillLevel?: string` |
| **Description (quoted)** | `Search and filter athletes by attributes. Use this when the user asks things like "who has no Garmin connected?", "list players with fitness below 5", "show injured players", "who hasn't trained this week?", or "find players with skill level advanced". More powerful than searchAthlete — supports attribute-based filtering.` |
| **Source** | Supabase `profiles` + `player_details`; then `garmin_connections`, `injuries`, `session_attendance`/`training_sessions` |
| **Auth** | Org + optional `playerIds` |
| **Return** | `{ success, count, athletes: [{id, name, skillLevel, fitnessLevel, strengths, areasForImprovement}] }` |

**Broken today:**
- `garmin_connections` **does not exist** (commented in migrations / body-data route; real table `garmin_connect_accounts`).
- `session_attendance` + `training_sessions` — product of record uses `group_training_attendance` + `group_training_sessions`. Likely empty/error filter for “hasn't trained”.

---

### A6. `athleteTools.ts` — athlete-role self tools

Auth model: tools are constructed with **`athleteId = session userId`** (see `toolRouter.ts` L344+). No org cross-athlete access by design for self tools. Several still take `organizationId` for session/tournament filters.

#### Read tools

| Tool | Lines | Description (abbrev) | Source | Volume | Broken? |
|------|------:|----------------------|--------|--------|---------|
| `getMyPerformanceTests` | 9–73 | Own performance + tennis tests | `performance_tests` + `tennis_specific_tests` | ≤limit each | **YES — tennis column map** |
| `getMyStats` | 77–187 | Attendance, rating, plans, goals, tournaments | attendance, reports, plans, goals, tournaments | Aggregated | **YES — wrong FK/cols** |
| `getMyCompetitionResults` | 191–230 | Race times 10K/half/marathon | `competitions` | ≤limit raw | Schema exists; running-centric |
| `getMyTrainingSessions` | 234–290 | Sessions + attendance | `group_training_sessions` | ≤limit | **YES — `training_date`** |
| `getMyTrainingPlan` | 294–338 | Plans | `training_plans` | ≤10 | **YES — `plan_name`/`focus_area`** |
| `getMyGoals` | 342–385 | Goals | `athlete_goals` | ≤20 | **YES — table is `player_goals`** |
| `getMyInjuries` | 389–435 | Injuries | `injuries` | ≤20 | Check `recovery_date` null filter vs `recovery_status` |
| `getMyWellnessScores` | 439–495 | PSE / sRPE | `pse_scores` | ≤limit + avgs | **YES — table is `player_pse_scores`** |
| `getMyGarminActivities` | 499–545 | Garmin activities | **`garmin_connect_activities`** | ≤15 raw | **YES — LEGACY dual-read** |
| `getMyAchievements` | 549–584 | Achievements | `achievements` | all | **YES — table is `player_achievements`** |
| `getMyTournaments` | 588–639 | Tournament regs | `tournament_registrations` | ≤20 | Org unused in filter |
| `getMySeriesTrainings` | 643–683 | Series intervals | `series_training_sessions` | ≤limit | OK if table live |
| `getMyHIITTrainings` | 687–725 | HIIT | `hiit_trainings` | ≤limit | OK if table live |
| `getMyConversations` | 947–1003 | Messages | `conversations` | ≤limit | Uses `(supabase as any)` |

#### Write tools (not in read consolidation)

`submitSessionFeedback`, `updateMyGoalProgress`, `recordMyPSEScore`, `sendMyMessage` — L727–943.

---

#### Broken tennis mapping (verified against `database.types.ts` L2866–2893)

**Tool maps (athleteTools L52–59 / parentTools L246–252):**

```typescript
agility505: t.agility_505,       // DOES NOT EXIST
serve_speed: t.serve_speed,      // DOES NOT EXIST
sprintTime: t.sprint_20m,        // DOES NOT EXIST
yoyoTest: t.yoyo_test,           // DOES NOT EXIST
```

**Actual columns:** `eighteen_m_sprint`, `hexagon_time`, `sideways_time`, `med_ball_*`, `vertical_jump`, `first_step_30sec`, `plank_time`, `push_ups`, `sit_ups`, flexibility fields, `two_point_four_km_time`, etc.

Query uses `select('*')` so rows return, but **all mapped metric fields are `undefined`**.

---

#### Other athleteTools schema defects

| Location | Coded | Actual (`database.types.ts`) |
|----------|-------|------------------------------|
| `getMyStats` L110 | `group_training_attendance.athlete_id` | **`player_id`** |
| `getMyStats` L122–124 | `plan_name`, `focus_area` | **`name`**, **`focus_areas` (array)** |
| `getMyStats` L126–129 | `athlete_goals` | **`player_goals`** (`player_id`, not `athlete_id`) |
| `getMyTrainingSessions` L247–255 | `training_date` | **`session_date`** |
| `getMyTrainingSessions` L265–266 | attendance find without player filter | Joins all attendance; doesn't filter to self |
| `getMyTrainingPlan` L322 | `plan_name`, `focus_area`, `weekly_hours`, `weekly_schedule` | `name`, `focus_areas`; no weekly_* columns in types |
| `getMyGoals` L350 | `athlete_goals` | `player_goals` |
| `getMyWellnessScores` L448 | `pse_scores` + `score`/`srpe` | `player_pse_scores` with `pse_score`, `assessment_date` |
| `getMyGarminActivities` L507 | `garmin_connect_activities` | **Not in generated types**; charts/workout graphs use CH |
| Column map L525–532 | `average_heart_rate`, `distance_meters`, `duration_seconds`, `start_time` | Legacy UI queries use `distance`, `moving_duration`, `start_time_gmt`, … |
| `getMyAchievements` L558 | `achievements` | `player_achievements` (+ definitions join in coach tool) |
| `recordMyPSEScore` L882 | inserts `pse_scores` | Wrong table/shape |

---

### A7. `specialistTools.ts` — already Python HTTP proxies

All six tools call `PPP_AI_AGENT_URL` with `x-internal-service`. Routes exist on `insights.py` (`/labs`, `/biomarker-trend`, `/genetic-traits`, `/cgm-scores`, `/tennis-matches`, `/tennis-evolution`).

| Tool | Lines | Params | Backend |
|------|------:|--------|---------|
| `getLabPanels` | 23–44 | athleteId, daysBack=90, limit=20 | Supabase labs via Python |
| `getBiomarkerTrend` | 46–66 | athleteId, biomarkerKey, daysBack=365 | Supabase |
| `getGeneticTraits` | 68–85 | athleteId | Supabase genetics |
| `getCgmScores` | 87–104 | athleteId, daysBack=7 | **ClickHouse** CGM |
| `getTennisMatches` | 106–123 | athleteId, limit=10 | Supabase tennis |
| `getTennisEvolution` | 125–143 | athleteId, matchesBack=10 | Supabase tennis |

**Auth in TS:** passes `organization_id` (except CGM). Python tools do **not** verify org membership of athlete (service key). Descriptions include medical non-diagnosis guardrails — preserve verbatim in Python registry.

**CGM description (quoted):** `Get CGM (continuous glucose monitor) scores for an athlete. Returns spike score, stability score, time-in-range, and fasting baseline. For lifestyle and fueling context only — never medical. Use when discussing glucose, fueling, energy, or nutrition patterns.`

---

## B. Legacy dual-read: precise store matrix

### Within these tool files

| Tool | Store for activity/health numbers | Aligns with Charts `WORKOUT_GRAPHS` (CH)? |
|------|-----------------------------------|-------------------------------------------|
| `getAthleteWearableInsight` | ClickHouse via wearable-query → ppd_backend | **Yes** (if auth succeeds) |
| `getTeamActivityLeaderboard` | ClickHouse via ppd_backend | **Yes** |
| `getGarminActivities` | ClickHouse via ppd_backend | **Yes** |
| `getMyGarminActivities` | **Legacy Supabase `garmin_connect_activities`** | **No — inconsistent** |
| `filterAthletes` (`hasGarmin`) | **`garmin_connections` (missing)** | N/A (boolean); broken vs `garmin_connect_accounts` |
| Analytics / query / specialist (non-CGM) | Supabase domain tables | N/A |
| `getCgmScores` | ClickHouse (Python) | Separate domain |

### Legacy reads that produce chart-inconsistent numbers

**In-scope AI tools (definitive):**

1. **`getMyGarminActivitiesTool`** — `athleteTools.ts` L506–545  
   - `.from('garmin_connect_activities')`  
   - Maps wrong/legacy column names  
   - Player charts for workouts (`ChartsContent` WORKOUT_GRAPHS → ppd_backend graphs → `ow_workouts`) will show CH data while the athlete agent reads empty/stale Supabase.

**Related UI still on legacy (context for “what user sees”):**

| Path | Legacy tables |
|------|---------------|
| `activityQueries.ts` | `garmin_connect_activities` |
| `organizationAwareQueries.ts` | `garmin_connect_activities` |
| Coach athlete `page.tsx` / `ActivityList` / `ActivityStats` | `garmin_connect_activities` |
| `readiness-snapshot.ts` | `garmin_connect_body_battery`, `_heart_rate`, `_sleep` |
| `dashboard/player/body-data/route.ts` | `garmin_connect_*` suite |
| `athletes/[id]/training-load/route.ts` | `garmin_connect_activities` |
| Parent progress / parent-page-data | `garmin_connect_activities` |

**Charts path that matches coach AI tools:** `ChartsContent` workout graphs → ppd_backend → ClickHouse `ow_workouts` / summaries.

**Python service:** `ppp_ai_agent/tools/wearables.py` — ClickHouse only. Correct target for consolidation.

---

## C. Authorization summary

| Pattern | Tools |
|---------|-------|
| Org filter on `profiles` | Most coach tools |
| Assignment `playerIds` | `getAthletes`, `searchAthlete`, `filterAthletes` only |
| Self-only (`athleteId` bound) | All `getMy*` |
| Session check in BFF | `wearable-query` (fragile for tool fetch) |
| Internal secret only | Specialist → Python; Garmin/leaderboard → ppd_backend |
| **No org check on CH user_id** | Any wearable CH fetch by UUID |

---

## D. Consolidation map (key deliverable)

Target: replace the factories in these seven files with **9 parameterized Python tools** (read path). Writes stay in a separate mutating registry (out of scope for the “~20–28 read” budget, but listed).

### D1. `resolve_athletes` (directory)

**Subsumes:** `getAthletes`, `searchAthlete`, `filterAthletes`, `getCoaches` (optional mode)

```python
async def resolve_athletes(
    organization_id: str,
    *,
    query: str | None = None,
    assigned_player_ids: list[str] | None = None,
    role: Literal["player", "coach", "any"] = "player",
    skill_level: str | None = None,
    has_wearable_connection: bool | None = None,  # → garmin_connect_accounts OR OW user map
    has_active_injury: bool | None = None,
    no_training_in_days: int | None = None,       # → group_training_attendance
    limit: int = 20,
) -> ResolveAthletesResult: ...
```

```python
class AthleteDirectoryRow(BaseModel):
    id: str
    name: str
    email: str | None = None
    date_of_birth: str | None = None
    skill_level: str | None = None
    fitness_level: float | None = None
    strengths: list[str] | None = None
    areas_for_improvement: list[str] | None = None

class ResolveAthletesResult(BaseModel):
    success: bool
    count: int
    athletes: list[AthleteDirectoryRow] = []
    error: str | None = None
```

**Fix on port:** use `garmin_connect_accounts` (or CH presence), `group_training_*` for training recency; honor assignment scope.

---

### D2. `get_wearable_metrics` (ClickHouse only — kill legacy)

**Subsumes:** `getAthleteWearableInsight`, `getGarminActivities`, `getTeamActivityLeaderboard`, `getMyGarminActivities`, Python `get_wearable_activities` / `get_wearable_summary`

```python
async def get_wearable_metrics(
    organization_id: str,
    *,
    athlete_id: str | None = None,          # required unless mode=leaderboard
    athlete_ids: list[str] | None = None,   # leaderboard scope; default org players
    metrics: list[Literal[
        "average_hr", "max_hr", "distance_km", "duration_min", "calories",
        "steps", "resting_hr"               # summary metrics optional
    ]] | None = None,
    mode: Literal["timeseries", "activities", "leaderboard", "daily_summary"] = "timeseries",
    period: Literal["7d", "14d", "30d", "90d"] | None = "7d",
    start_date: str | None = None,
    end_date: str | None = None,
    activity_type: str | None = None,
    aggregation: Literal["avg", "sum", "latest", "auto"] = "auto",
    # auto: avg for HR, sum for distance/calories/duration (match leaderboard)
    limit: int = 50,
    assigned_player_ids: list[str] | None = None,
) -> WearableMetricsResult: ...
```

```python
class WearableDataPoint(BaseModel):
    date: str
    value: float
    metric: str

class WearableActivity(BaseModel):
    activity_id: str
    activity_name: str
    activity_type: str
    start_time_gmt: str
    distance_km: float | None
    duration_min: float | None
    pace_min_per_km: float | None
    average_hr: float | None
    max_hr: float | None
    calories: float | None

class LeaderboardRow(BaseModel):
    athlete_id: str
    athlete_name: str
    value: float
    activity_count: int
    metric: str

class WearableMetricsResult(BaseModel):
    success: bool
    mode: str
    athlete_id: str | None = None
    athlete_name: str | None = None
    period: str | None = None
    metrics: dict[str, dict] = {}  # metric -> {average, current, trend, data_points[:N]}
    activities: list[WearableActivity] = []
    leaderboard: list[LeaderboardRow] = []
    daily_summaries: list[dict] = []
    count: int = 0
    error: str | None = None
```

**Store:** ClickHouse `openwearables_data.ow_workouts` (+ `ow_activity_summaries` for `daily_summary`).  
**Never** `garmin_connect_*`.  
**Preserve:** distance rounding difference documented; pick **one** convention (`distance_m/1000` rounded 2dp) and document migration; trend ±5% half-split; leaderboard avg vs sum.

---

### D3. `get_team_analytics`

**Subsumes:** `getTeamAnalytics`

```python
async def get_team_analytics(
    organization_id: str,
    *,
    metric: Literal["all", "attendance", "performance", "training_volume"] = "all",
    period: Literal["week", "month", "quarter", "year"] = "month",
    include_insights: bool = True,
) -> TeamAnalyticsResult: ...
```

```python
class Insight(BaseModel):
    category: Literal["attendance", "performance", "training_volume"]
    level: Literal["good", "info", "warning"]
    message: str
    value: str | float | None = None
    action: str | None = None

class TeamAnalyticsResult(BaseModel):
    success: bool
    metrics: dict
    insights: list[Insight] = []
    error: str | None = None
```

Port insight thresholds and `sessions * 1.5` hours estimate **or** replace with real duration and version the contract.

---

### D4. `get_athlete_stats`

**Subsumes:** `getAthleteStats`, `getMyStats` (self: bind `athlete_id` from session)

```python
async def get_athlete_stats(
    organization_id: str,
    athlete_id: str,
    *,
    period: Literal["week", "month", "quarter", "year"] = "month",
    include_insights: bool = True,
) -> AthleteStatsResult: ...
```

```python
class AthleteStatsResult(BaseModel):
    success: bool
    athlete: dict  # id, name, dob, member_since
    performance: dict  # attendance_rate, average_rating, sessions, period
    training_plans: dict  # active[], total
    tournament_registrations: list[dict]
    active_goals: list[dict] = []
    insights: list[Insight] = []
    error: str | None = None
```

**Use:** `group_training_attendance.player_id`, `training_plans.name` / `focus_areas`, `player_goals`.

---

### D5. `get_performance_tests`

**Subsumes:** `getPerformanceTests`, `getMyPerformanceTests` (partial), tennis tests

```python
async def get_performance_tests(
    organization_id: str,
    athlete_id: str,
    *,
    suite: Literal["physiological", "tennis_specific", "all"] = "all",
    test_type: str | None = None,
    limit: int = 20,
) -> PerformanceTestsResult: ...
```

```python
class TennisSpecificTest(BaseModel):
    id: str
    test_date: str
    eighteen_m_sprint: float | None = None
    hexagon_time: float | None = None
    sideways_time: float | None = None
    vertical_jump: float | None = None
    first_step_30sec: float | None = None
    med_ball_forehand: float | None = None
    med_ball_backhand: float | None = None
    med_ball_overhead: float | None = None
    med_ball_reverse: float | None = None
    plank_time: float | None = None
    push_ups: float | None = None
    sit_ups: float | None = None
    sit_and_reach: float | None = None
    # …remaining flexibility / 2.4km fields
    notes: str | None = None

class PerformanceTestsResult(BaseModel):
    success: bool
    athlete_id: str
    physiological: list[dict] = []
    tennis_specific: list[TennisSpecificTest] = []
    count: int
    error: str | None = None
```

---

### D6. `get_athlete_training_context`

**Subsumes:** `getMyTrainingSessions`, `getMyTrainingPlan`, `getMySeriesTrainings`, `getMyHIITTrainings`, (coach analogues elsewhere)

```python
async def get_athlete_training_context(
    organization_id: str,
    athlete_id: str,
    *,
    include: list[Literal["sessions", "plans", "series", "hiit"]] = ["sessions", "plans"],
    upcoming_only: bool = False,
    include_completed_plans: bool = False,
    limit: int = 15,
) -> AthleteTrainingContextResult: ...
```

Fix: `session_date`, filter attendance to `player_id = athlete_id`, `training_plans.name`.

---

### D7. `get_athlete_wellness`

**Subsumes:** `getMyWellnessScores`, coach wellness tools (sibling file), injury+goals optional modes

```python
async def get_athlete_wellness(
    organization_id: str,
    athlete_id: str,
    *,
    include: list[Literal["pse", "injuries", "goals", "achievements"]] = ["pse"],
    active_injuries_only: bool = False,
    include_completed_goals: bool = False,
    limit: int = 20,
) -> AthleteWellnessResult: ...
```

Tables: `player_pse_scores`, `injuries`, `player_goals`, `player_achievements`.

---

### D8. `get_specialist_health` (thin facade over existing Python)

**Subsumes:** `getLabPanels`, `getBiomarkerTrend`, `getGeneticTraits`, `getCgmScores` (+ optional `analyze_lab_panel`)

```python
async def get_specialist_health(
    organization_id: str,
    athlete_id: str,
    *,
    domain: Literal["labs", "biomarker_trend", "genetics", "cgm"],
    biomarker_key: str | None = None,
    days_back: int | None = None,
    limit: int = 20,
) -> dict: ...
```

Preserve medical disclaimers in tool description strings.

---

### D9. `get_tennis_performance`

**Subsumes:** `getTennisMatches`, `getTennisEvolution` (+ Python `get_match_summary`)

```python
async def get_tennis_performance(
    organization_id: str,
    athlete_id: str,
    *,
    mode: Literal["matches", "evolution", "match_summary"] = "matches",
    match_id: str | None = None,
    limit: int = 10,
    matches_back: int = 10,
) -> dict: ...
```

---

### Optional mutating bucket (not in the ~9 read set)

Keep behind confirmation gates, separate registry:

- `manage_player` ← create/update/delete/notes/details  
- `manage_performance_test` ← create  
- Athlete writes: feedback, PSE, goal progress, message  

---

## E. Subsumption table (old → new)

| Old TS tool | New Python tool | `mode` / params |
|-------------|-----------------|-----------------|
| `getAthletes` | `resolve_athletes` | query=None |
| `searchAthlete` | `resolve_athletes` | query=… |
| `filterAthletes` | `resolve_athletes` | filters=* |
| `getCoaches` | `resolve_athletes` | role=coach |
| `getAthleteWearableInsight` | `get_wearable_metrics` | mode=timeseries |
| `getGarminActivities` | `get_wearable_metrics` | mode=activities |
| `getTeamActivityLeaderboard` | `get_wearable_metrics` | mode=leaderboard |
| `getMyGarminActivities` | `get_wearable_metrics` | mode=activities, athlete_id=self |
| `get_wearable_activities` (Py) | `get_wearable_metrics` | mode=activities |
| `get_wearable_summary` (Py) | `get_wearable_metrics` | mode=daily_summary |
| `getTeamAnalytics` | `get_team_analytics` | — |
| `getAthleteStats` | `get_athlete_stats` | — |
| `getMyStats` | `get_athlete_stats` | athlete_id=self |
| `getPerformanceTests` | `get_performance_tests` | suite=physiological |
| `getMyPerformanceTests` | `get_performance_tests` | suite=all |
| `getMyTrainingSessions` | `get_athlete_training_context` | include=[sessions] |
| `getMyTrainingPlan` | `get_athlete_training_context` | include=[plans] |
| `getMySeriesTrainings` | `get_athlete_training_context` | include=[series] |
| `getMyHIITTrainings` | `get_athlete_training_context` | include=[hiit] |
| `getMyWellnessScores` | `get_athlete_wellness` | include=[pse] |
| `getMyInjuries` | `get_athlete_wellness` | include=[injuries] |
| `getMyGoals` | `get_athlete_wellness` | include=[goals] |
| `getMyAchievements` | `get_athlete_wellness` | include=[achievements] |
| `getLabPanels` | `get_specialist_health` | domain=labs |
| `getBiomarkerTrend` | `get_specialist_health` | domain=biomarker_trend |
| `getGeneticTraits` | `get_specialist_health` | domain=genetics |
| `getCgmScores` | `get_specialist_health` | domain=cgm |
| `getTennisMatches` | `get_tennis_performance` | mode=matches |
| `getTennisEvolution` | `get_tennis_performance` | mode=evolution |
| `getMyCompetitionResults` | keep thin or fold into `get_athlete_stats` | running races |
| `getMyTournaments` | fold into `get_athlete_stats` or training context | — |
| `getMyConversations` | messaging domain tool (elsewhere) | — |

**Count:** 35 factories → **9** read tools (+ messaging/writes separate).

---

## F. Subtle behaviors — naive ports will break

1. **Leaderboard vs insight distance units** (`/1000` vs `round(d/100)/10`).
2. **Leaderboard aggregation:** avg HR vs **sum** volume metrics.
3. **Trend half-split** assumes newest-first ordering.
4. **Training hours estimate** `sessions * 1.5`, not wall-clock duration.
5. **Performance breakdown** converts counts to **percentages**.
6. **Tournament dual-path** (athlete_id + registered_players) with Map dedupe.
7. **`getAthleteWearableInsight` auth:** BFF requires session; tool does not forward cookies — may always 401 from agent runtime; prefer direct CH/Python like the other two tools.
8. **Role filter inconsistency:** wearables use `role='player'`; analytics counts `athlete|player`.
9. **`category` on `getAthletes`** accepted by Zod, never applied.
10. **Attendance column:** coach tools use `player_id`; athlete `getMyStats` wrongly uses `athlete_id`.
11. **Specialist CGM** omits `organization_id` — any user_id readable with internal secret.
12. **Description says “Garmin”** but CH data is multi-provider (Garmin/Whoop/Polar/…) — model selection bias.

---

## G. Broken tools checklist (verified)

| # | Tool | Defect | Evidence |
|---|------|--------|----------|
| 1 | `getMyPerformanceTests` / parent tennis map | Maps nonexistent `agility_505`, `serve_speed`, `sprint_20m`, `yoyo_test` | `database.types.ts` L2866–2893; dossier 20 L459 |
| 2 | `getMyGarminActivities` | Reads legacy `garmin_connect_activities`; wrong column names; not in generated types | `athleteTools.ts` L507; CH charts path |
| 3 | `filterAthletes` `hasGarmin` | Table `garmin_connections` missing → `garmin_connect_accounts` | migrations 20260212/20260401; body-data L28 |
| 4 | `filterAthletes` `hasNoTrainingInDays` | `session_attendance` / `training_sessions` vs `group_training_*` | `filterAthleteTools.ts` L81–89; dossier 08 |
| 5 | `getMyStats` | `athlete_id` on attendance; `athlete_goals`; `plan_name`/`focus_area` | types: `player_id`, `player_goals`, `name`/`focus_areas` |
| 6 | `getMyTrainingSessions` | `training_date` → `session_date`; attendance not scoped to self | types L961–982 |
| 7 | `getMyTrainingPlan` / `getMyGoals` | Wrong table/column names | types training_plans / player_goals |
| 8 | `getMyWellnessScores` / `recordMyPSEScore` | `pse_scores` → `player_pse_scores` different shape | types L1916+ |
| 9 | `getMyAchievements` | `achievements` → `player_achievements` | types L1636 |
| 10 | `getAthletes.category` | Parameter dead | `queryTools.ts` L16–19 |
| 11 | `getAthleteWearableInsight` | Likely session-auth failure on server fetch | route L8–14 vs tool L48–59 |

---

## H. Recommended port order

1. **`get_wearable_metrics`** on ClickHouse — delete all TS legacy Garmin activity reads for agents.  
2. **`resolve_athletes`** with fixed connection + attendance filters + assignment scope.  
3. **`get_athlete_stats` + `get_team_analytics`** with corrected FKs.  
4. **`get_performance_tests`** with real tennis columns.  
5. Fold specialist + tennis into facades (already Python).  
6. Athlete self tools become the same parameterized tools with `athlete_id` forced from session.

---

## I. File reference index

| Artifact | Absolute path |
|----------|---------------|
| Wearable insights | `/Users/danielsilva/Desktop/PeakPerformanceDataMonorepo/PeakPerformanceData/peak_performance_data/src/lib/ai/tools/wearableInsightTools.ts` |
| Garmin activities | `…/garminActivityTools.ts` |
| Analytics | `…/analyticsTools.ts` |
| Query | `…/queryTools.ts` |
| Athlete | `…/athleteTools.ts` |
| Filter | `…/filterAthleteTools.ts` |
| Specialist | `…/specialistTools.ts` |
| Wearable BFF | `…/src/app/api/ai-agent/wearable-query/route.ts` |
| ppd_backend wearables | `…/ppd_backend/api/routes/wearables.py` |
| Python wearables | `…/ppp_ai_agent/tools/wearables.py` |
| Schema types | `…/src/lib/supabase/database.types.ts` |
