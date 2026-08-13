# 08 — Domain Tools: Athletes, Training, Tennis

**Status:** Read-only research dossier  
**Date:** 2026-08-02  
**Scope:** Document `ppp_ai_agent` tools that will back the training/tennis specialist agent; assess tennis coverage gaps vs product APIs/schema.  
**Sources (read in full):**
- `PeakPerformanceData/ppp_ai_agent/tools/athletes.py` (L1–95)
- `PeakPerformanceData/ppp_ai_agent/tools/training.py` (L1–54)
- `PeakPerformanceData/ppp_ai_agent/tools/tennis.py` (L1–204)
- `PeakPerformanceData/ppp_ai_agent/tests/test_tennis.py` (L1–71)
- Supporting: `tools/db.py`, `tools/registry.py`, `api/middleware/auth.py`, product tennis APIs/schema

**Store used by all three modules:** Supabase PostgREST via `supabase_rpc` (`tools/db.py` L42–67) with **`SUPABASE_SERVICE_KEY`** (bypasses RLS). Not ClickHouse.

---

## Cross-cutting authorization posture

| Layer | Behavior |
|-------|----------|
| HTTP middleware (`api/middleware/auth.py`) | Requires `x-internal-service` secret **or** Supabase JWT. Internal path sets `request.state.user_id/organization_id/role = None` (L37–41). |
| Tool functions | **No in-tool auth.** They trust caller-supplied `organization_id` / `athlete_id` / `match_id`. |
| Service key | All reads use service role → **RLS does not constrain** these tools. |
| Org membership of athlete | **Never verified** (no join of `profiles.organization_id` to the requested athlete for tennis/training). |
| Coach assignment | Optional `assigned_player_ids` on athlete list/search only; tennis tools have no equivalent. |

**Implication:** A caller who can invoke tools (or who compromises the internal secret) can read any athlete's tennis matches by UUID, and any match by `match_id` via `get_match_summary` with zero ownership check.

**Note:** Next.js `specialistTools.ts` calls agent HTTP paths `/tennis-matches` and `/tennis-evolution`, but `api/main.py` currently only mounts `health` + `insights` routers — those tennis HTTP routes are **not yet exposed** on the FastAPI app (registry tools exist for orchestrator dispatch).

---

## 1. `tools/athletes.py`

Ported from Next.js `src/lib/ai/tools/queryTools.ts`. Registered in `tools/registry.py` L18–28.

### 1.1 `get_athletes` — L16–56

**Signature**
```python
async def get_athletes(
    organization_id: str,
    assigned_player_ids: Optional[List[str]] = None,
    limit: int = 20,
) -> dict
```

| Param | Required | Default | Notes |
|-------|----------|---------|-------|
| `organization_id` | yes | — | Filter `profiles.organization_id` |
| `assigned_player_ids` | no | `None` | If not `None`, adds `id=in.(...)` |
| `limit` | no | `20` | PostgREST `limit` |

**Store / tables / columns**
- Store: **Supabase** `profiles`
- Filter: `organization_id`, `role = 'player'`, optional `id in (...)`
- Select: `id, full_name, email, date_of_birth`
- Order: `full_name`

**Return shape (concrete)**
```json
{
  "athletes": [
    {
      "id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
      "name": "Maria Lopez",
      "email": "maria@example.com",
      "date_of_birth": "2008-03-14"
    }
  ],
  "count": 1,
  "success": true
}
```
On exception: `{"athletes": [], "count": 0, "error": "<str>", "success": false}`.

**Authorization**
- Scopes by caller-supplied `organization_id` (filter only; not verified against session).
- Optional coach scope via caller-supplied `assigned_player_ids` — **trusted**, not looked up from coach–athlete relations.
- Does **not** verify the caller may see that org.

**Volume / LLM safety**
- Max 20 rows (default), ~4 small fields each → **safe** for context (~1–3 KB).

**LLM-friendliness**
- Already reshaped (`full_name` → `name`). Directory metadata only — no arithmetic needed.
- Empty list is success with `count: 0` (no distinct “not found” message).

**Error / empty**
- Empty org → `{athletes: [], count: 0, success: true}`.
- HTTP/DB failure → logged + `success: false` with `error` string.

---

### 1.2 `search_athlete` — L59–95

**Signature**
```python
async def search_athlete(
    organization_id: str,
    query: str,
    assigned_player_ids: Optional[List[str]] = None,
) -> dict
```

| Param | Required | Default | Notes |
|-------|----------|---------|-------|
| `organization_id` | yes | — | Org filter |
| `query` | yes | — | `ilike.%{query}%` on `full_name` |
| `assigned_player_ids` | no | `None` | Same as `get_athletes` |

**Store / tables / columns**
- Same as `get_athletes`, plus `full_name ilike`, hard `limit=10`.

**Return shape**
```json
{
  "athletes": [
    {
      "id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
      "name": "Maria Lopez",
      "email": "maria@example.com",
      "date_of_birth": "2008-03-14"
    }
  ],
  "count": 1,
  "success": true
}
```

**Authorization** — same posture as `get_athletes`.

**Volume / LLM safety** — Max 10 rows → **safe**.

**LLM-friendliness** — Same directory shape. Unlike Next.js `searchAthleteTool` (which returns `success: false` + hint when empty), Python returns empty success list.

**Error / empty**
- No matches → `{athletes: [], count: 0, success: true}`.
- Exception → `success: false` + `error`.

**Gap vs Next.js:** Python includes `date_of_birth` in the mapped object; Next.js list tool omits DOB in the mapped return (though it selects it). Minor.

---

## 2. `tools/training.py`

Ported (claimed) from Next.js `trainingSessionTools.ts`, but **schema mismatch** — see critical note below. Registered L30–35.

### 2.1 `get_training_sessions` — L15–54

**Signature**
```python
async def get_training_sessions(
    organization_id: str,
    athlete_id: Optional[str] = None,
    days_back: int = 7,
    limit: int = 20,
) -> dict
```

| Param | Required | Default | Notes |
|-------|----------|---------|-------|
| `organization_id` | yes | — | Filter |
| `athlete_id` | no | `None` | Optional `athlete_id=eq.` filter |
| `days_back` | no | `7` | `session_date >= utcnow - days` |
| `limit` | no | `20` | Cap |

**Store / tables / columns (as coded)**
- Store: **Supabase** table name **`training_sessions`**
- Select: `id, title, session_date, duration_minutes, location, description`
- Filter: `organization_id`, `session_date gte`, optional `athlete_id`
- Order: `session_date.desc`

**CRITICAL SCHEMA MISMATCH**

Product of record uses **`group_training_sessions`** (`database.types.ts` L961+; Next.js `trainingSessionTools.ts` L22–27):
- Columns: `name` (not `title`), `session_date`, `start_time`, `end_time`, `location`, `session_type`, `status`, `description`, `organization_id`
- **No** `title`, **no** `duration_minutes`, **no** `athlete_id` on the session row (athletes via `group_training_attendance.player_id`)

Also exists: `series_training_sessions` (individual series work). No `CREATE TABLE training_sessions` found in `peak_performance_data/supabase` migrations.  
→ This tool is very likely **broken against current schema** (or hits a non-existent table). `trainingReportTools.ts` also references `training_sessions` (legacy bug in Next.js).

**Return shape (intended)**
```json
{
  "sessions": [
    {
      "id": "sess-uuid",
      "title": "Morning court",
      "date": "2026-07-28T08:00:00",
      "duration": 90,
      "location": "Court 3",
      "description": "Serve + return block"
    }
  ],
  "count": 1,
  "success": true
}
```
(`duration` is raw minutes with **no unit label** in the key/value.)

**Authorization**
- Trusts `organization_id` and optional `athlete_id`.
- No check that athlete belongs to org.
- No coach assignment filter.

**Volume / LLM safety**
- Max 20 sessions, small fields → **safe** if it worked.

**LLM-friendliness**
- Row list, lightly renamed. `duration` is a bare number (minutes implied by source column, not labelled).
- No aggregation (total hours, attendance %, type mix) — LLM would need to sum if asked for totals.
- No session type/status (product has `session_type`, `status`).

**Error / empty**
- Empty → `{sessions: [], count: 0, success: true}`.
- Exception → `success: false` + `error`.

**Training coverage gaps (product has tools/tables, Python agent does not)**
| Product capability | Store | Python tool? |
|--------------------|-------|--------------|
| Group sessions list/filter by type/status | `group_training_sessions` | No (broken `training_sessions`) |
| Attendance | `group_training_attendance` | No |
| Session feedback / PSE | feedback tables via `sessionFeedbackTools` | No |
| Series / individual plans | `series_training_sessions` (+ points) | No |
| HIIT sessions | `hiitTrainingTools` | No |
| Periodization / plans | `periodizationTools`, `trainingPlanTools` | No |

---

## 3. `tools/tennis.py`

Module docstring (L1–4): returns structured summaries — **not** raw shot-level data. Registered L96–113. Tests: registry + schema only (`tests/test_tennis.py`); **no integration tests** against Supabase.

### 3.1 `get_tennis_matches` — L16–50

**Signature**
```python
async def get_tennis_matches(
    organization_id: str,
    athlete_id: str,
    days_back: int = 90,
    limit: int = 20,
) -> dict
```

| Param | Required | Default | Notes |
|-------|----------|---------|-------|
| `organization_id` | yes (registry) | — | **Accepted but NEVER used in query** |
| `athlete_id` | yes | — | Mapped to `tennis_matches.user_id` |
| `days_back` | no | `90` | `match_date >= since` |
| `limit` | no | `20` | Cap |

**Store / tables / columns**
- Store: **Supabase** `tennis_matches`
- Filter: `user_id = athlete_id`, `match_date gte`
- Select: `id, match_date, opponent_name, source, surface`
- Order: `match_date.desc`

**Return shape**
```json
{
  "matches": [
    {
      "id": "m-uuid",
      "match_date": "2026-07-20",
      "opponent_name": "J. Smith",
      "source": "swingvision",
      "surface": "clay"
    }
  ],
  "count": 1,
  "success": true
}
```

**Authorization**
- **Trusts `athlete_id`.** `organization_id` is dead parameter (IDOR across orgs).
- No ownership / coach / parent check (service key).
- Contrast: product `GET /api/tennis/matches` enforces session + coach/parent gates (`matches/route.ts` L8–42).

**Volume / LLM safety**
- ≤20 thin rows → **safe**.

**LLM-friendliness**
- Catalogue only — **no score, result, or sets**. Product list joins `tennis_match_sets` and exposes `live_status`, `total_points`, host/guest names (`tennisAnalyticsQueries.ts` L14–36).
- Model cannot answer “did they win?” from this tool alone → must call `get_match_summary` per match.

**Error / empty**
- Empty → `{matches: [], count: 0, success: true}`.
- Exception → `success: false` + `error`.

---

### 3.2 `get_match_summary` — L53–117

**Signature**
```python
async def get_match_summary(match_id: str) -> dict
```

| Param | Required | Default | Notes |
|-------|----------|---------|-------|
| `match_id` | yes | — | Only argument; **no org/athlete** |

**Store / tables / columns**
1. `tennis_matches`: `id, match_date, opponent_name, source, surface` where `id=match_id`
2. `tennis_match_sets`: `set_number, host_score, guest_score, set_winner, is_super_tiebreak`
3. `tennis_match_stats`: `stat_name, stat_value` where `player='host'`, `set_number=0` (match totals)

**Return shape**
```json
{
  "summary": {
    "match_id": "m-uuid",
    "match_date": "2026-07-20",
    "opponent_name": "J. Smith",
    "source": "swingvision",
    "surface": "clay",
    "result": "win",
    "score": "6-4, 3-6, 6-2",
    "sets_won": 2,
    "sets_lost": 1,
    "first_serve_pct": 62.5,
    "aces": 4,
    "double_faults": 2,
    "winners": 28,
    "unforced_errors": 19,
    "break_points_converted": 3,
    "break_points_opportunities": 7
  },
  "success": true
}
```
Not found: `{"error": "Match not found", "success": false}`.  
Exception: `{"error": "<str>", "success": false}` (no empty summary wrapper).

**Authorization**
- **Any `match_id` → full summary.** No `user_id` / org check. Highest-risk tool of the three modules.

**Volume / LLM safety**
- Single object, ~15 fields → **safe**. Intentionally avoids shots/points.

**LLM-friendliness**
- Partially pre-aggregated:
  - `first_serve_pct` computed in tool (L105) — **unit implied (%), key ends `_pct`, value not rounded** (can be long float).
  - `double_faults`, `winners`, `unforced_errors` derived from named stats.
  - Break points left as **raw counts** (`converted` / `opportunities`) — model must divide for conversion %.
- Does **not** label units on aces/winners/errors (counts are fine).
- Does **not** expose serve/return won %, rally length, speeds, FH/BH split, spin, depth — those exist in product `computeMatchMetrics`.
- Assumes athlete is always **host** (`player=eq.host`). Wrong if athlete played as guest / doubles side.
- No fallback when `tennis_match_stats` empty (live scorekeeper matches) — product derives from points+shots (`progress-metrics.ts` L407+).

**Arithmetic left to the LLM (anti-goal)**
- Break-point conversion %
- Winner/error ratio
- Games won %
- Any per-set rate

**Error / empty**
- Missing match → explicit error.
- Present match, empty stats → fields become `null` / `0`-derived nulls; still `success: true`.

---

### 3.3 `get_tennis_evolution` — L120–204

**Signature**
```python
async def get_tennis_evolution(
    organization_id: str,
    athlete_id: str,
    limit: int = 20,
) -> dict
```

| Param | Required | Default | Notes |
|-------|----------|---------|-------|
| `organization_id` | yes (registry) | — | **Unused in query** |
| `athlete_id` | yes | — | `tennis_matches.user_id` |
| `limit` | no | `20` | Match count (no `days_back`) |

**Store / tables / columns**
1. `tennis_matches`: `id, match_date, opponent_name` (no surface/source in evolution output)
2. Batch `tennis_match_stats`: `match_id, stat_name, stat_value` for `player=host`, `set_number=0`

**Does not read:** `tennis_match_shots`, `tennis_match_points`, `tennis_match_games`, `tennis_match_sets` — unlike product `GET /api/tennis/matches/evolution` which loads all five child tables and runs `computeMatchMetrics` (capped at 50 matches).

**Return shape**
```json
{
  "evolution": [
    {
      "match_id": "m-uuid",
      "match_date": "2026-06-01",
      "opponent_name": "A. Rival",
      "first_serve_pct": 58.3,
      "second_serve_pct": 91.2,
      "aces": 3,
      "double_faults": 1,
      "winners": 22,
      "unforced_errors": 17,
      "break_points_converted": 2,
      "break_points_opportunities": 5,
      "service_points_won_pct": 64.1,
      "return_points_won_pct": 38.0
    }
  ],
  "count": 1,
  "success": true
}
```
Order: oldest → newest (reversed after fetch).

**Authorization** — same as `get_tennis_matches` (trust `athlete_id`; ignore org).

**Volume / LLM safety**
- Default 20 points × ~12 metrics → roughly **safe** (~5–15 KB JSON).
- Product evolution can be huge because it pulls **all shots/points** for up to 50 matches server-side then aggregates; Python version stays small by using stats sheet only.

**LLM-friendliness**
- Better than raw rows: several % metrics precomputed and rounded to 1 decimal.
- Still returns raw BP counts (not conversion %).
- Missing most product evolution metrics (see gap list).
- No `result`, `score`, `surface`, `source`.
- `service_points_won_pct` denominator uses `first_serves` only (L192–194) — same shortcut as product stats branch when Stats sheet present; fragile.
- Matches without stats rows produce mostly `null` metrics (no points/shots fallback).

**Error / empty**
- No matches → `{evolution: [], count: 0, success: true}`.
- Exception → empty evolution + `error` + `success: false`.

---

## 4. Test coverage (`tests/test_tennis.py`)

| Test | What it checks |
|------|----------------|
| `test_tennis_tools_registered` | Names in registry |
| `test_get_*_schema` | required/optional param lists |
| `TestFullToolRegistry` | All specialist tools present; `len(tools) >= 16` |

**Missing:** No mocked Supabase tests for return shapes, empty stats, guest-player, or auth misuse of `organization_id`.

---

## 5. Product tennis surface inventory (for gap analysis)

### 5.1 Supabase `tennis_*` tables

| Table | Role in product | Used by Python agent? |
|-------|-----------------|----------------------|
| `tennis_matches` | Match header (date, opponent, source, surface, live_status, video, etc.) | Partial (`get_tennis_matches`, summary, evolution) |
| `tennis_match_sets` | Set scores / winner | `get_match_summary` only |
| `tennis_match_games` | Per-game server/winner | **No** |
| `tennis_match_points` | Point log, BP/SP flags, detail | **No** |
| `tennis_match_shots` | Shot analytics (speed, spin, stroke, bounce coords, zones) | **No** |
| `tennis_match_stats` | SwingVision Stats sheet key/value | summary + evolution (host, set 0 only) |
| `tennis_match_uploads` | Import/upload pipeline | **No** |
| `tennis_match_share_links` | Watch links | **No** |
| `tennis_match_participants` | Doubles / named sides | **No** |
| `tennis_match_pauses` | Live active-time | **No** |
| `tennis_specific_tests` | Court fitness tests | **No** (Next.js `athleteTools` has it) |

### 5.2 Product API routes (`src/app/api/tennis/`)

| Route | Purpose | Agent tool? |
|-------|---------|-------------|
| `GET matches` | Auth'd match list + sets | Partial / thinner |
| `GET matches/[id]` | Full detail via `loadTennisMatchDetail` (games/point/shot/stat) | Partial (`get_match_summary` only) |
| `GET matches/evolution` | Full `ProgressMatchMetrics[]` from games+points+sets+shots+stats | Partial / much thinner |
| `matches/[id]/video*` | Video access | No (appropriate) |
| `matches/[id]/share-links*` | Sharing | No |
| `scorekeeper/*` | Live scoring | No |
| `import`, `video-upload*` | Ingest | No |

### 5.3 Product UI analytics tabs (`TennisAnalyticsDetail`)

1. **match-stats** — scoreboard + Stats-sheet metrics  
2. **shot-stats** — speeds, FH/BH in%, serve placement, distribution (`TennisAnalyticsShotStatsTab`)  
3. **play-patterns** — depth, direction, court plots, last-shot, winners/errors (`TennisAnalyticsPlayPatternsTab` + `shot-metrics.ts`)  
4. **insights** — narrative/insight tab  
Plus **progress** pages using `progress-metrics.ts` + `progress-insights.ts` (movers, skill profile, win correlations, period averages).

### 5.4 `ProgressMatchMetrics` fields present in product, absent from Python evolution

From `progress-metrics.ts` L92–142 / return L448+:

`accuracy_pct`, `avg_rally_length`, `bh_errors`, `bh_speed`, `bh_winners`, `break_points_converted_pct`, `break_points_saved_pct`, `depth_deep_pct`, `direction_aggression_pct`, `direction_cc_dl_ratio`, `fh_errors`, `fh_speed`, `fh_usage_pct`, `fh_winners`, `first_serve_speed`, `games_won_pct`, `last_shot_error_pct`, `return_fh_pct`, `return_in_pct`, `result`, `score`, `second_serve_speed`, `source`, `spin_*_pct`, `surface`, `winner_error_ratio`, weighted attempt counts, etc.

Python evolution covers only a small serve/winner/error/BP/SPW/RPW subset from the stats sheet.

---

## 6. Concrete missing tools (tennis specialist backlog)

Each item is a recommended **pre-aggregated, unit-labelled** tool — not a raw-row dump (raw `tennis_match_shots` for a match is often thousands of rows → unsafe for LLM context).

### P0 — Match / shot analytics (major gap)

1. **`get_match_shot_stats(match_id, athlete_id)`**  
   Aggregates from `tennis_match_shots` (+ server attribution from games/points): avg/peak serve & FH/BH speeds (km/h), in%, stroke mix, serve direction placement (T / wide), spin distribution %. Ports `TennisAnalyticsShotStatsTab` / `computeServeStats` / `shot-metrics` usage stats.  
   *Tables: `tennis_match_shots`, `tennis_match_games`, `tennis_match_points`, `tennis_matches`.*

2. **`get_match_play_patterns(match_id, athlete_id)`**  
   Depth zone %, direction aggression / CC:DL ratio, last-shot error %, winners vs UE by stroke, optional binned bounce heatmap summary (counts per zone — not raw coords).  
   *Tables: shots + points + sets; logic in `shot-metrics.ts` / PlayPatterns tab.*

3. **`get_match_point_summary(match_id, athlete_id)`**  
   Point-level aggregates only: break/set point conversion, longest rally, favorited points count, serve-state outcomes — **not** full point log.  
   *Tables: `tennis_match_points` (+ optional terminal shots).*

4. **`get_match_detail_structured(match_id, athlete_id)`**  
   Sets + key per-set stats (host+guest), live_status, location, total_points — supersedes thin list + incomplete summary. Align with `loadTennisMatchDetail` but strip video blobs and raw shot arrays.

5. **`get_tennis_evolution_full(athlete_id, organization_id, limit)`**  
   Parity with `/api/tennis/matches/evolution` → return `ProgressMatchMetrics`-shaped **precomputed** series (include shot-derived metrics). Cap matches (≤20–50); never return raw shots to the model.

### P1 — Longitudinal insight (product progress pages)

6. **`get_tennis_progress_insights(athlete_id, ...)`**  
   Period averages, biggest movers, skill profile axes, win correlations, rolling win rate — port `progress-insights.ts` (`computeProgressFindings`, `buildSkillProfile`, etc.).

7. **`compare_tennis_matches(match_id_a, match_id_b)`** / **`compare_periods(early_n, recent_n)`**  
   Side-by-side labelled deltas so LLM does not subtract series by hand.

8. **`get_tennis_matches` enrichment**  
   Add `result`, `score`, `sets`, `live_status`, `total_points` (join sets) so list answers win/loss without N summary calls.

### P2 — Adjacent tennis domain data

9. **`get_tennis_specific_tests(athlete_id, organization_id)`**  
   From `tennis_specific_tests` with **units labelled** (sprint s, jump cm, med-ball m, etc.). Present in Next.js athlete tools; absent in Python registry.

10. **`get_match_opponent_comparison(match_id)`**  
    Host vs guest aggregated stats (`tennis_match_stats` for both players; set_number filters).

11. **`get_per_set_stats(match_id)`**  
    Stats where `set_number > 0`, not only match totals.

12. **`get_match_participants(match_id)`**  
    Doubles / named players from `tennis_match_participants`.

13. **Surface / source filtered queries**  
    e.g. clay-only evolution — product UI filters on `surface` / `source`; tools ignore these.

### Explicitly out of scope for LLM tools (keep out of context)

- Raw shot coordinate dumps / full heatmap point clouds  
- Video bytes / R2 keys / share tokens  
- Scorekeeper write APIs (append point, pause, finish)  
- Upload/import pipeline status (unless ops agent)

---

## 7. LLM math risk summary

| Tool | Pre-aggregated? | Units labelled? | LLM still must compute? |
|------|-----------------|-----------------|-------------------------|
| `get_athletes` / `search_athlete` | N/A (directory) | N/A | No |
| `get_training_sessions` | No (rows) | `duration` unlabelled minutes | Sums/averages if asked |
| `get_tennis_matches` | No (catalogue) | N/A | Cannot compute outcomes (data missing) |
| `get_match_summary` | Partial | `_pct` key only; BP raw | BP%, W/UE ratio, games% |
| `get_tennis_evolution` | Partial | `_pct` keys; BP raw | Trends by hand; missing shot metrics entirely |

**Design intent for specialist upgrade:** push all tennis arithmetic into tools (mirror `computeMatchMetrics` / `shot-metrics`), return labelled scalars (`first_serve_pct: 62`, `unit: "%"` or suffix in key), never hand the model raw `tennis_match_shots` rows.

---

## 8. Registry snapshot (these three modules)

From `tools/registry.py`:

| Tool name | Required | Optional |
|-----------|----------|----------|
| `get_athletes` | `organization_id` | `assigned_player_ids`, `limit` |
| `search_athlete` | `organization_id`, `query` | `assigned_player_ids` |
| `get_training_sessions` | `organization_id` | `athlete_id`, `days_back`, `limit` |
| `get_tennis_matches` | `organization_id`, `athlete_id` | `days_back`, `limit` |
| `get_match_summary` | `match_id` | — |
| `get_tennis_evolution` | `organization_id`, `athlete_id` | `limit` |

---

## 9. Findings checklist (for implementers)

- [ ] Fix training tool → `group_training_sessions` (+ attendance join) or document alias view  
- [ ] Enforce athlete∈org (and coach assignment) inside tennis/training tools despite service key  
- [ ] Use `organization_id` or drop it from tennis signatures  
- [ ] Add `user_id` check on `get_match_summary`  
- [ ] Enrich match list with score/result  
- [ ] Add shot/play-pattern/evolution-full tools with pre-aggregation  
- [ ] Wire FastAPI routes if Next.js `agentFetch('/tennis-*')` remains the BFF path  
- [ ] Add unit tests with mocked PostgREST payloads  

---

*End of dossier 08.*
