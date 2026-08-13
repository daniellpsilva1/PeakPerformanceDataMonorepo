# 19 — Training Domain Data Model

**Status:** Read-only research dossier  
**Date:** 2026-08-02  
**Scope:** Complete training-domain schema as used by the product (`peak_performance_data`), so Python agent tools in `ppp_ai_agent` can query correctly.  
**Authority order:** (1) generated types `src/lib/supabase/database.types.ts`, (2) live query/UI usage, (3) migrations under `supabase/migrations/`, (4) memory-bank docs (may describe migrations not regenerated into types).

---

## Critical finding (athlete ↔ session)

There is **no** `training_sessions` table in the live product schema.

| Wrong (Python `tools/training.py` L39) | Correct |
|---|---|
| `training_sessions` | `group_training_sessions` |
| filter `athlete_id` on session row | join via `group_training_attendance.player_id` |
| columns `title`, `duration_minutes` | `name`, `start_time`/`end_time` (derive duration) |

**Definitive join:** athlete ↔ group session is a **join table** `group_training_attendance`:

```
profiles.id  ←── player_id ──  group_training_attendance  ── session_id ──→  group_training_sessions.id
```

- Column on attendance is **`player_id`** (not `athlete_id`).
- Session has **no athlete array** and **no `athlete_id`**.
- `player_groups` / `player_group_members` are roster groupings only; they do **not** link athletes to sessions.

### Canonical query: all group sessions for athlete X in last N days

```sql
SELECT gts.*, gta.attendance_status, gta.effort_rating, gta.minutes_played
FROM group_training_attendance gta
INNER JOIN group_training_sessions gts ON gts.id = gta.session_id
WHERE gta.player_id = :athlete_id
  AND gts.session_date >= CURRENT_DATE - (:n || ' days')::interval
  AND (gts.is_cancelled IS DISTINCT FROM true)
ORDER BY gts.session_date DESC;
```

PostgREST / Supabase JS pattern used in product (authoritative example):

```147:181:PeakPerformanceData/peak_performance_data/src/app/[locale]/player/training/page.tsx
    supabase
      .from('group_training_sessions')
      .select(`
        id,
        session_name:name,
        session_date,
        location,
        notes,
        group_training_attendance!inner(
          id,
          player_id,
          attendance_status
        )
      `)
      .eq('organization_id', organizationId)
      .eq('group_training_attendance.player_id', userId)
      .lt('session_date', today)
      .gte('session_date', thirtyDaysAgo.toISOString().split('T')[0])
```

Also used correctly in:

- `src/app/api/athletes/[id]/training-load/route.ts` L66–83 (`.eq('player_id', athleteId)`)
- `src/services/alerts/AlertEngine.ts` L238–240
- `src/lib/dashboard/player-init.ts` L144–147
- RPC `get_player_dashboard_init` in `supabase/migrations/20260213_player_dashboard_init_rpc.sql` L90–93

**Broken / legacy references (do not copy):**

| File | Wrong table / column |
|---|---|
| `ppp_ai_agent/tools/training.py` L35–39 | `training_sessions` + `athlete_id` + `title`/`duration_minutes` |
| `src/lib/ai/tools/filterAthleteTools.ts` L82–88 | `session_attendance` + `training_sessions` + `athlete_id` |
| `src/lib/ai/tools/trainingReportTools.ts` L356–376 | `training_sessions` / `session_attendance` |
| `src/lib/ai/tools/athleteTools.ts` L105–110 | uses `group_training_attendance` but filters `.eq('athlete_id', …)` — should be `player_id` |
| `src/lib/ai/tools/athleteTools.ts` L245–248 | selects `training_date`, `pse_score` on attendance — actual columns are `session_date` / no `pse_score` on attendance |

---

## Entity map (tables that exist in `database.types.ts`)

### Group scheduling & attendance (academy core)

| Table | Role | Athlete link |
|---|---|---|
| `group_training_sessions` | Scheduled group sessions | none on row; via attendance |
| `group_training_attendance` | Per-player enrollment + attendance + coach ratings | `player_id` → `profiles` |
| `group_training_session_coaches` | Multi-coach assignment (migration `20260510_court_coordination_foundation.sql` L68–74) | n/a (coach_id) |
| `courts` | Physical courts; `group_training_sessions.court_id` (same migration L107–110) | n/a |

> **Types drift:** `court_id`, `published_at`, `published_by`, and table `group_training_session_coaches` are used by `trainingManagementQueries.ts` L211–236 but are **not** yet in `database.types.ts` `group_training_sessions` Row (L961–989). Prefer runtime schema / migration over stale types for those columns.

### Individual / specialty sessions

| Table | Role | Athlete link |
|---|---|---|
| `training_plans` | Individual (or org) training plans | `athlete_id` (nullable) |
| `series_training_sessions` | Series/drill session header | `athlete_id` |
| `series_training_points` | Series blocks within a series session | via `session_id` → series session |
| `hiit_trainings` | HIIT workouts | `athlete_id` |

### Feedback / subjective load

| Table | Role | Athlete link |
|---|---|---|
| `session_feedback` | Post-session player self-report (RPE, mood, energy) | `player_id` + `session_id` → group session |
| `player_pse_scores` | PSE / sRPE scores (often tied to reports) | `player_id`; optional `report_id` |
| `training_reports` | Coach session/plan reports | optional `session_id` / `training_plan_id`; `attendance` uuid[] of players |

### Periodization markers (sparse)

| Table | Role | Athlete link |
|---|---|---|
| `shock_microcycles` | Planned overload blocks | `athlete_id` |
| `transition_periods` | Transition / deload blocks | `athlete_id` |

### Related but not session tables

| Table | Notes |
|---|---|
| `player_groups` / `player_group_members` | Org roster groups; **not** session membership |
| `coach_player_assignments` | Coach↔player access |
| `coach_observations` | Coach notes (can link `session_id` → group sessions per types Relationships) |
| `injuries` | Used in readiness / load recommendations |
| Garmin / wearable tables | Used for ACWR / readiness (queried as `garmin_connect_*`; not all in `database.types.ts` Tables block) |

### Not present as tables

| Name | Status |
|---|---|
| `training_sessions` | **Does not exist** (Python bug) |
| `session_attendance` | **Does not exist** (legacy Next.js AI bug) |
| `pse_scores` | Referenced by `athleteTools.ts` L882 — **not** in types; real table is `player_pse_scores` |
| `exercises` / workout library | **No table**; plan content lives in `training_plans.plan_data` JSON |
| `wellness_questionnaires` | Documented in memory-bank only; **absent** from `database.types.ts` |
| Monotony / strain stored columns | **Not stored**; not computed as Foster monotony/strain anywhere found |

---

## Full column definitions (important tables)

Source: `PeakPerformanceData/peak_performance_data/src/lib/supabase/database.types.ts` unless noted.

### `group_training_sessions` — L961–989

| Column | Type | Notes |
|---|---|---|
| `id` | string (uuid) | PK |
| `organization_id` | string | required |
| `name` | string | display name (not `title`) |
| `description` | string \| null | |
| `session_date` | string \| null | primary date filter (date) |
| `date` | string \| null | legacy alias still present |
| `start_time` | string \| null | |
| `end_time` | string \| null | |
| `time` | string \| null | legacy |
| `location` | string \| null | free text (courts also via `court_id` in migration) |
| `coach_id` | string \| null | lead coach → profiles |
| `assistant_coaches` | string[] \| null | legacy multi-coach array |
| `session_type` | string \| null | e.g. technical/tactical/match (app enums vary) |
| `status` | string \| null | scheduled / completed / cancelled / … |
| `level` | string \| null | |
| `difficulty_level` | string \| null | |
| `max_participants` | number \| null | |
| `equipment_needed` | string[] \| null | |
| `notes` | string \| null | |
| `is_cancelled` | boolean \| null | |
| `cancellation_reason` | string \| null | |
| `weather_dependent` | boolean \| null | |
| `created_via` | string \| null | |
| `created_by` | string \| null | |
| `created_at` / `updated_at` | string | |

**Added by migration** `20260510_court_coordination_foundation.sql` L107–110 (use in queries even if types lag):

- `court_id uuid` → `courts`
- `published_at timestamptz`
- `published_by uuid` → `profiles`

### `group_training_attendance` — L892–909

| Column | Type | Notes |
|---|---|---|
| `id` | string | PK |
| `session_id` | string | FK → `group_training_sessions` |
| `player_id` | string | FK → `profiles` (**athlete key**) |
| `attendance_status` | string | see status values below |
| `arrival_time` / `departure_time` | string \| null | |
| `minutes_played` | number \| null | used as duration proxy for load |
| `effort_rating` | number \| null | coach effort; used in load fallback |
| `performance_rating` | number \| null | |
| `behavior_rating` | number \| null | |
| `coach_notes` | string \| null | |
| `player_feedback` | string \| null | free text on attendance row |
| `injuries_reported` | string[] \| null | |
| `created_at` / `updated_at` | string | |

**Attendance status values in use (normalize to lowercase):**

| Value | Where |
|---|---|
| `scheduled` | default on create (`GroupTrainingSchedule.tsx` L265; attendance API) |
| `present` | RPCs, alerts, dashboards (canonical “attended”) |
| `attended` | UI badges / load route accept as synonym |
| `absent` / `no_show` / `excused` / `missed` / `cancelled` | various filters |

`recordAttendance` in `trainingManagementQueries.ts` L481 types `'scheduled' \| 'attended' \| 'absent'`, while many analytics paths check `'present'`. Agent tools should treat **`present` and `attended` as present**.

Unique key used by upsert in AI tools: `(session_id, player_id)` (`trainingSessionTools.ts` L302).

### `training_plans` — L3202–3230

| Column | Type | Notes |
|---|---|---|
| `id` | string | |
| `organization_id` | string | |
| `athlete_id` | string \| null | direct FK when individual |
| `coach_id` | string \| null | |
| `assigned_coaches` | string[] \| null | |
| `name` | string | |
| `description` | string \| null | |
| `plan_type` | string | |
| `focus_areas` | string[] | |
| `objectives` | string[] | |
| `duration_weeks` | number | |
| `sessions_per_week` | number | volume signal for plans |
| `skill_level` | string \| null | |
| `target_audience` | string \| null | |
| `start_date` / `end_date` | string \| null | |
| `start_time` / `end_time` | string \| null | |
| `status` | string \| null | active / completed / paused / … |
| `is_active` / `is_template` | boolean \| null | |
| `plan_data` | Json \| null | **exercise/session structure if any** |
| `created_by` | string | |
| `created_via` | string \| null | |
| `created_at` / `updated_at` | string | |

### `session_feedback` — L2184–2203 + migration create

Created in `supabase/migrations/20260130_dashboard_enhancement_tables.sql` L157–183:

| Column | Type | Constraints / meaning |
|---|---|---|
| `id` | uuid | PK |
| `session_id` | uuid | FK → `group_training_sessions` ON DELETE CASCADE |
| `player_id` | uuid | FK → `profiles` |
| `rpe_score` | int | **1–10** RPE |
| `enjoyment_level` | int | **1–5** |
| `difficulty_level` | text | `too_easy` \| `just_right` \| `challenging` \| `too_hard` |
| `what_went_well` | text[] | |
| `what_was_challenging` | text[] | |
| `areas_to_work_on` | text[] | |
| `energy_before` / `energy_after` | int \| null | 1–5 |
| `soreness_areas` | text[] | |
| `questions_for_coach` | text \| null | |
| `coach_response` / `coach_responded_at` | text / timestamptz | |
| `mood_tags` | text[] | motivated, tired, frustrated, confident, focused, distracted |
| `submitted_at` | timestamptz | default now() |
| UNIQUE | `(session_id, player_id)` | one feedback per player per session |

This is the product’s primary **session feedback / wellness-after-session** self-report.

### `player_pse_scores` — L1916–1927 (types; may be incomplete vs DB)

| Column (types) | Type |
|---|---|
| `id` | string |
| `organization_id` | string |
| `player_id` | string |
| `assessment_date` | string |
| `assessment_type` | string |
| `pse_score` | number \| null |
| `report_id` | string \| null → `training_reports` |
| `created_at` / `updated_at` | string |

Memory-bank / wellness tools expect additional columns (`session_duration_minutes`, `srpe`, `session_id`, `notes`, `entry_source`) — see `_memory_bank/features/pse-wellness-questionnaires-implementation.md` L75–87. **`wellnessTools.ts` inserts `rpe`/`score_date`/`srpe` which do not match generated types** — treat PSE tooling as schema-drifted; prefer reading `pse_score` + `assessment_date` from types, and verify remote columns before agent writes.

sRPE definition in product docs/tools: **`sRPE = PSE × duration_minutes`**.

### `hiit_trainings` — L1063–1081

| Column | Type |
|---|---|
| `id` | string |
| `athlete_id` | string |
| `workout_name` | string |
| `workout_type` | string \| null |
| `training_date` | string |
| `duration_minutes` | number |
| `intensity_level` | string \| null |
| `perceived_effort` | number \| null |
| `heart_rate_avg` / `heart_rate_max` | number \| null |
| `calories_burned` | number \| null |
| `recovery_time_minutes` | number \| null |
| `notes` | string \| null |
| `created_by` | string \| null |
| `created_at` / `updated_at` | string |

### `series_training_sessions` — L2139–2148 + `series_training_points` — L2094–2103

**Session:** `id`, `athlete_id`, `training_date`, `notes`, `created_by`, timestamps.  
**Points:** `id`, `session_id` → series session, `series_name`, `duration_minutes`, `rest_between_series`, `created_by`, `created_at`.

### `training_reports` — L3311–3339

Coach-authored reports: `title`, `report_type`, `report_date`, `summary`, `detailed_content`, metrics JSON, `attendance` **uuid[]**, `attendance_rate`, ratings, links to `session_id` / `training_plan_id`.

### `shock_microcycles` — L2259–2277 / `transition_periods` — L3437–3452

Athlete-dated periodization blocks (`start_date`/`end_date`, intensity, focus, notes). Sparse; not the day-to-day schedule.

---

## How load / ACWR / monotony / strain are computed

### ACWR — **Postgres RPC (primary) + Next.js API (secondary)**

1. **Postgres** `calculate_acwr(p_athlete_id)`  
   - Defined: `supabase/migrations/20260130_dashboard_enhancement_functions.sql` L173–250  
   - Typed: `database.types.ts` L3692–3700  
   - Logic:
     - Prefer `garmin_connect_training_readiness.acute_load` / `chronic_load` (latest row)
     - Else sum `garmin_connect_activities.activity_training_load` over 7d (acute) and 28d/4 (chronic)
     - `acwr = acute / chronic`; status bands: `<0.8` undertraining, `≤1.3` optimal, `≤1.5` overreaching, else danger
   - Used by: `calculate_athlete_readiness` (same file L76), `AlertEngine.ts` L229, `readiness-snapshot.ts` L348

2. **Next.js app** `/api/athletes/[id]/training-load`  
   - File: `src/app/api/athletes/[id]/training-load/route.ts` L58–194  
   - Builds daily load from Garmin activities **plus** attendance-derived load:  
     `effort_rating|performance_rating|5 × minutes_played|60` when attendance counts as present (L126–128)  
   - Recomputes ACWR from 42-day daily series (L170–173) for the periodization chart (`TrainingLoadPeriodization.tsx`)

3. **Status helpers only in Next.js**  
   - `src/lib/calculations/training-load.ts` — ACWR bands, load spike (>30% week-over-week), optimal range; **no DB writes**

### Monotony / strain

**Not implemented** as Foster monotony (`mean/sd`) or strain (`load × monotony`) in Postgres, Next.js, or `ppd_backend` under those names. Do not expose agent tools claiming stored monotony/strain.

### Training load graphs in `ppd_backend`

- `ppd_backend/data_processing/graphs/training_graphs/training_load.py`  
- Computes **Bannister TRIMP** from workout HR/duration for charts (ClickHouse/official activity data path), **not** the academy ACWR used in the Next.js dashboard.

### Session RPE / PSE

| Signal | Where stored | How load uses it |
|---|---|---|
| Session RPE | `session_feedback.rpe_score` | subjective feedback; not in `calculate_acwr` |
| PSE / sRPE | `player_pse_scores.pse_score` (+ optional `srpe`) | wellness tools compute sRPE in app; ACWR RPC uses Garmin |
| Coach effort | `group_training_attendance.effort_rating` | used in Next.js training-load route fallback |

---

## Session feedback vs wellness/readiness

| Concept | Table / source | Shape |
|---|---|---|
| **Post-session feedback** | `session_feedback` | RPE 1–10, enjoyment 1–5, difficulty enum, mood tags, energy before/after, free-text arrays, optional coach reply |
| **PSE / sRPE** | `player_pse_scores` | Borg-like 1–10 effort, often after sessions/reports |
| **Composite readiness** | RPC `calculate_athlete_readiness` / wearable snapshot | Garmin training readiness, sleep, stress/BB, ACWR load balance, injury, **attendance rate** — not a single self-report row |
| **Daily wellness questionnaire** | planned `wellness_questionnaires` in memory-bank | **not in generated types** — do not rely on for agent v1 |

---

## Product UI surfaces (confirm usage)

| Path | What it loads |
|---|---|
| `src/app/[locale]/management/training/page.tsx` | `getGroupTrainingSessionsWithAttendance` → tabs: group schedule, plans, reports, courts |
| `src/components/management/training/*` | CRUD for sessions/attendance/plans |
| `src/app/[locale]/coach/training/` | coach training management (same query layer) |
| `src/app/[locale]/player/training/page.tsx` | athlete’s sessions via **inner join on attendance.player_id** + own `training_plans` |

---

## Data volumes (for LLM context sizing)

Inferred from schema + UI defaults (not live DB counts):

| Stream | Typical per athlete | 7-day window | 28-day window |
|---|---|---|---|
| Group sessions (via attendance) | ~3–6 / week (`sessions_per_week` on plans; academy schedule) | **3–7 rows** | **12–28 rows** |
| `session_feedback` | ≤1 per attended session | 0–7 | 0–28 |
| `player_pse_scores` | 0–1 per session if entered | 0–7 | 0–28 |
| `hiit_trainings` | sparse (0–3 / week if used) | 0–3 | 0–12 |
| `series_training_sessions` | sparse | 0–3 | 0–12 |
| `training_plans` | 0–2 active | few | few |
| Shock/transition | rare (0–1 active) | 0–1 | 0–1 |
| Garmin daily load points | up to 1/day if wearable | ≤7 | ≤28 |

**LLM guidance:** Default tools to **14–28 days**, `limit` 20–40 for session lists, and return **pre-aggregated** load/attendance summaries rather than raw row dumps. A full 28-day package (sessions + attendance + feedback + ACWR summary) is typically **well under ~15–25 KB** JSON if fields are projected.

---

## Recommended Python agent tools (training specialist)

Replace broken `get_training_sessions` in `tools/training.py`. All tools should use Supabase service client, filter by `organization_id` where applicable, and treat `athlete_id` argument as `profiles.id` = `player_id` / `athlete_id` depending on table.

### 1. `get_athlete_training_sessions`

```python
async def get_athlete_training_sessions(
    organization_id: str,
    athlete_id: str,
    days_back: int = 14,
    include_upcoming: bool = True,
    limit: int = 40,
) -> dict
```

**Query:** `group_training_attendance` ⋈ `group_training_sessions` where `player_id = athlete_id`, `organization_id` match, `session_date` window.

**Return:**
```json
{
  "success": true,
  "athlete_id": "uuid",
  "count": 5,
  "sessions": [
    {
      "id": "uuid",
      "name": "U16 Technical",
      "session_date": "2026-07-28",
      "start_time": "16:00",
      "end_time": "17:30",
      "duration_minutes": 90,
      "location": "Court 3",
      "session_type": "technical",
      "status": "completed",
      "attendance_status": "present",
      "effort_rating": 7,
      "minutes_played": 90
    }
  ]
}
```

### 2. `get_athlete_planned_training`

```python
async def get_athlete_planned_training(
    organization_id: str,
    athlete_id: str,
    days_ahead: int = 14,
    limit: int = 20,
) -> dict
```

**Sources:** upcoming rows from tool (1) with `session_date >= today` + active `training_plans` where `athlete_id = …` and `status` in active-like states.

**Return:**
```json
{
  "success": true,
  "upcoming_sessions": [ /* same shape as above */ ],
  "active_plans": [
    {
      "id": "uuid",
      "name": "Pre-season block",
      "start_date": "2026-07-01",
      "end_date": "2026-08-15",
      "sessions_per_week": 5,
      "focus_areas": ["serve", "fitness"],
      "status": "active",
      "objectives": ["…"]
    }
  ]
}
```

### 3. `get_athlete_training_load`

```python
async def get_athlete_training_load(
    athlete_id: str,
    days_back: int = 28,
) -> dict
```

**Preferred:** call RPC `calculate_acwr` (+ optionally `calculate_athlete_readiness`).  
**Optional enrichment:** daily series mirroring `/api/athletes/[id]/training-load` (Garmin + attendance sRPE proxy).

**Return:**
```json
{
  "success": true,
  "acute_load": 420,
  "chronic_load": 380,
  "acwr": 1.11,
  "status": "optimal",
  "trend": "stable",
  "readiness_score": 72.5,
  "recommendation": "Good readiness - suitable for moderate to high intensity",
  "daily_loads": [{"date": "2026-07-28", "load": 85}],
  "source": "calculate_acwr+garmin"
}
```

Do **not** invent monotony/strain unless implemented later.

### 4. `get_athlete_attendance`

```python
async def get_athlete_attendance(
    organization_id: str,
    athlete_id: str,
    days_back: int = 30,
) -> dict
```

**Query:** attendance ⋈ sessions; aggregate present/(present+absent).

**Return:**
```json
{
  "success": true,
  "days_back": 30,
  "total_sessions": 18,
  "present": 15,
  "absent": 2,
  "scheduled_or_other": 1,
  "attendance_rate": 83.3,
  "recent": [
    {"session_date": "2026-07-28", "name": "…", "attendance_status": "present"}
  ]
}
```

### 5. `get_athlete_session_feedback`

```python
async def get_athlete_session_feedback(
    athlete_id: str,
    days_back: int = 28,
    limit: int = 20,
) -> dict
```

**Query:** `session_feedback` where `player_id = athlete_id`, join session name/date; optionally union recent `player_pse_scores`.

**Return:**
```json
{
  "success": true,
  "count": 4,
  "avg_rpe": 6.5,
  "feedback": [
    {
      "session_id": "uuid",
      "session_name": "U16 Technical",
      "session_date": "2026-07-28",
      "rpe_score": 7,
      "enjoyment_level": 4,
      "difficulty_level": "challenging",
      "mood_tags": ["focused"],
      "energy_before": 4,
      "energy_after": 2,
      "what_went_well": ["serve consistency"],
      "what_was_challenging": ["third-set fitness"],
      "submitted_at": "2026-07-28T18:02:00Z"
    }
  ],
  "pse_scores": [
    {"assessment_date": "2026-07-28", "pse_score": 7, "assessment_type": "post_session"}
  ]
}
```

### 6. `get_athlete_specialty_trainings` (optional but complete view)

```python
async def get_athlete_specialty_trainings(
    athlete_id: str,
    days_back: int = 28,
    limit: int = 20,
) -> dict
```

**Query:** `hiit_trainings` + `series_training_sessions` (+ nested points) by `athlete_id`.

**Return:**
```json
{
  "success": true,
  "hiit": [{"id": "…", "workout_name": "…", "training_date": "…", "duration_minutes": 30, "perceived_effort": 8}],
  "series": [{"id": "…", "training_date": "…", "points": [{"series_name": "A", "duration_minutes": 5}]}]
}
```

### 7. `get_athlete_periodization` (optional)

```python
async def get_athlete_periodization(athlete_id: str) -> dict
```

**Query:** open/overlapping `shock_microcycles` + `transition_periods` for athlete.

---

## Implementation notes for `ppp_ai_agent`

1. **Delete reliance on `training_sessions`.** Point `supabase_rpc` / PostgREST at `group_training_attendance` + embed `group_training_sessions`.
2. Always filter athlete with **`player_id`** on attendance / feedback / PSE; use **`athlete_id`** only on plans, HIIT, series, shock, transition.
3. Prefer **RPC** for ACWR/readiness over reimplementing formulas in Python.
4. Project columns explicitly (no `select *`) to keep LLM context small.
5. Align with product AI tools that already work: `trainingSessionTools.ts`, `sessionFeedbackTools.ts`, player training page — not the legacy wrong names in `filterAthleteTools.ts` / `trainingReportTools.ts` / current `tools/training.py`.

---

## Source index (absolute paths)

| Artifact | Path |
|---|---|
| Generated schema | `/Users/danielsilva/Desktop/PeakPerformanceDataMonorepo/PeakPerformanceData/peak_performance_data/src/lib/supabase/database.types.ts` |
| Query layer | `…/src/lib/supabase/queries/trainingManagementQueries.ts` |
| Player join example | `…/src/app/[locale]/player/training/page.tsx` L147–181 |
| Load API | `…/src/app/api/athletes/[id]/training-load/route.ts` |
| ACWR RPC | `…/supabase/migrations/20260130_dashboard_enhancement_functions.sql` L173+ |
| Session feedback DDL | `…/supabase/migrations/20260130_dashboard_enhancement_tables.sql` L157–183 |
| Courts / multi-coach | `…/supabase/migrations/20260510_court_coordination_foundation.sql` |
| Broken Python tool | `…/PeakPerformanceData/ppp_ai_agent/tools/training.py` |
| Prior tool inventory | `_plans/research/08-tools-athletes-training-tennis.md` |
