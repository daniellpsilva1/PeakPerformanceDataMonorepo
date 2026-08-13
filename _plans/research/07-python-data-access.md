# 07 — Python AI Agent Data Access Layer

**Scope:** `PeakPerformanceData/ppp_ai_agent` (read-only audit)  
**Primary modules:** `tools/db.py`, `tools/wearables.py`, `tools/cgm.py`, `tools/alerts.py`  
**Also audited:** all other `tools/*` callers of `supabase_rpc` / ClickHouse, plus `api/middleware/auth.py`, `api/routes/insights.py`, `agent/nightly_batch.py`, `config/settings.py`, `requirements.txt`

---

## 1. Supabase client construction

### How it is built

There is **no** official `supabase-py` `create_client(...)` usage in this service, despite `supabase==2.0.3` being listed in `requirements.txt` (unused import). Access is a thin **httpx** wrapper:

```42:67:PeakPerformanceData/ppp_ai_agent/tools/db.py
async def supabase_rpc(path: str, method: str = "GET", params: Optional[dict] = None, json_body: Optional[dict] = None) -> dict:
    """Execute a Supabase REST API call using the service key.

    This is a thin HTTP wrapper — not a full Supabase client, but enough
    for read-only tool queries.
    """
    global _http_client
    if _http_client is None:
        _http_client = httpx.AsyncClient(timeout=15)

    url = f"{SUPABASE_URL}/rest/v1/{path}"
    headers = {
        "apikey": SUPABASE_SERVICE_KEY,
        "Authorization": f"Bearer {SUPABASE_SERVICE_KEY}",
    }
    ...
    resp.raise_for_status()
    return resp.json()
```

Config (`config/settings.py` lines 15–16):

| Env var | Role |
|---------|------|
| `SUPABASE_URL` | Project URL |
| `SUPABASE_SERVICE_KEY` | **Service role key** (not anon) |

**Key type: `service_role`.** Using the service role as both `apikey` and `Authorization: Bearer` means **PostgREST bypasses RLS**. Every query/write is authorized only by application logic (or not at all).

Auth middleware also uses the service key for profile lookups after JWT verification:

```91:97:PeakPerformanceData/ppp_ai_agent/api/middleware/auth.py
            profile_resp = await client.get(
                f"{SUPABASE_URL}/rest/v1/profiles",
                params={"id": f"eq.{user_id}", "select": "organization_id,role"},
                headers={
                    "apikey": SUPABASE_SERVICE_KEY,
                    "Authorization": f"Bearer {SUPABASE_SERVICE_KEY}",
                },
```

### Authorization is the application's responsibility

Because RLS is bypassed, every call site must enforce org/user scoping. Places where that responsibility lands (and where gaps exist):

| Location | What it does | Authz note |
|----------|--------------|------------|
| `api/middleware/auth.py` L35–42 | Internal secret sets `user_id=None`, `organization_id=None` | Callers can pass **any** org/athlete IDs with no request-state binding |
| `api/middleware/auth.py` L44–54 | Session auth attaches `user_id` / `organization_id` / `role` | **Not used** by most tool routes to constrain queries |
| `api/routes/insights.py` L247–364 | Labs/CGM/tennis/genetics endpoints | Accept `organization_id` / `athlete_id` from query params; do not compare to `request.state` |
| `api/routes/insights.py` L112–139 | `list_insights` | Filters optional; with service role can list **all orgs** if filters omitted |
| `api/routes/insights.py` L145–156 | `get_insight` | Fetch by ID only — no org check |
| `tools/athletes.py` | Filters by `organization_id` (+ optional `assigned_player_ids`) | Relies on caller to pass correct org / coach assignment list |
| `tools/alerts.py` | Filters by `organization_id` + `user_id` | Caller-trusted |
| `tools/training.py` | Filters by `organization_id` (+ optional `athlete_id`) | Caller-trusted |
| `tools/biomarkers.py` | Org/athlete filters on panels | `get_panel_biomarkers` / `analyze_lab_panel` take **panel_id only** — no org check |
| `tools/tennis.py` | Takes `organization_id` but **never filters by it** | Cross-org match access if `athlete_id` / `match_id` known |
| `tools/genetics.py` | Org + athlete + consent checks in app code | Consent is app-enforced (good); still service-role |
| `tools/genetic_parser.py` | Writes traits / updates report status | Any authenticated caller of `/genetics/parse` with a `report_id` |
| `tools/wearables.py` / `tools/cgm.py` | ClickHouse by `user_id` only | No org membership check |
| `agent/nightly_batch.py` L197 | `get_athletes(organization_id or "*", limit=500)` | `"*"` produces PostgREST filter `eq.*` — broken/unsafe if org omitted |

**Supported HTTP methods in `supabase_rpc`:** only `GET` and `POST` (L58–64). Callers that pass `method="PATCH"` (`genetic_parser.py` L201, L249, L268) hit `ValueError: Unsupported method: PATCH`.

---

## 2. ClickHouse client construction

```26:39:PeakPerformanceData/ppp_ai_agent/tools/db.py
def get_clickhouse_client():
    """Get or create a ClickHouse client for wearable data."""
    global _ch_client
    if _ch_client is None:
        import clickhouse_connect
        _ch_client = clickhouse_connect.get_client(
            host=CLICKHOUSE_WEARABLES_HOST,
            port=CLICKHOUSE_WEARABLES_PORT,
            database=CLICKHOUSE_WEARABLES_DATABASE,
            username=CLICKHOUSE_WEARABLES_USER,
            password=CLICKHOUSE_WEARABLES_PASSWORD,
        )
        logger.info(f"ClickHouse client initialized ({CLICKHOUSE_WEARABLES_HOST}:{CLICKHOUSE_WEARABLES_PORT})")
    return _ch_client
```

| Setting | Source | Default (`config/settings.py`) |
|---------|--------|--------------------------------|
| Host | `CLICKHOUSE_WEARABLES_HOST` | `"localhost"` (L24) |
| Port | `CLICKHOUSE_WEARABLES_PORT` | `8123` HTTP (L25) |
| Database | `CLICKHOUSE_WEARABLES_DATABASE` | `"wearables_data"` (L26) |
| User | `CLICKHOUSE_WEARABLES_USER` | `"default"` (L27) |
| Password | `CLICKHOUSE_WEARABLES_PASSWORD` | `""` (L28) |

**Connection pooling:** none configured. Single process-global client from `clickhouse_connect.get_client` (library may reuse HTTP connections internally; not explicit pool sizing).

**Timeouts:** none passed to `get_client(...)`. Only Supabase httpx client has `timeout=15` (`db.py` L50). ClickHouse queries can hang indefinitely from this code’s perspective.

**Schema note:** Queries fully-qualify `openwearables_data.ow_*` even though the client default DB is `wearables_data`. The connection `database=` param is largely unused by these tools.

---

## 3. Client lifecycle (singletons, sync vs async, event-loop blocking)

| Client | Lifecycle | Sync/Async |
|--------|-----------|------------|
| ClickHouse `_ch_client` | Module-level lazy singleton (`db.py` L22, L28–39) | **Sync** (`clickhouse_connect`) |
| Supabase `_http_client` | Module-level lazy singleton (`db.py` L23, L48–50) | **Async** (`httpx.AsyncClient`) |

Wearable/CGM tool functions are declared `async` but call sync ClickHouse I/O on the event loop:

```70:77:PeakPerformanceData/ppp_ai_agent/tools/wearables.py
    try:
        ch = get_clickhouse_client()
        result = ch.query(query, parameters={
            "uid": user_id,
            "s": start_dt.strftime("%Y-%m-%d %H:%M:%S"),
            "e": end_dt.strftime("%Y-%m-%d %H:%M:%S"),
            "lim": limit,
        })
```

```132:138:PeakPerformanceData/ppp_ai_agent/tools/wearables.py
    try:
        ch = get_clickhouse_client()
        result = ch.query(query, parameters={
            "uid": user_id,
            "s": start_dt.strftime("%Y-%m-%d"),
            "e": end_dt.strftime("%Y-%m-%d"),
        })
```

```154:160:PeakPerformanceData/ppp_ai_agent/tools/cgm.py
    try:
        ch = get_clickhouse_client()
        result = ch.query(query, parameters={
            "uid": user_id,
            "s": start_dt.strftime("%Y-%m-%d %H:%M:%S"),
            "e": end_dt.strftime("%Y-%m-%d %H:%M:%S"),
        })
```

**Event-loop blocking (explicit):**  
`ch.query(...)` is synchronous network I/O inside `async def` handlers used by FastAPI (`api/routes/insights.py` L319–330 for CGM; nightly batch via `asyncio.gather` of wearable tools at `agent/nightly_batch.py` L67–71). There is **no** `asyncio.to_thread` / `run_in_executor`. A slow ClickHouse response blocks the entire worker event loop.

Supabase path is correctly non-blocking (`await _http_client.get/post`).

---

## 4. Complete table & column inventory

### 4.1 ClickHouse (`openwearables_data`)

#### `ow_workouts` — `tools/wearables.py` L28–68

| Column / expression | Usage |
|---------------------|--------|
| `user_id` | SELECT, WHERE, GROUP BY |
| `id` | SELECT (aliased `activity_id`), GROUP BY |
| `name` | `argMax(..., synced_at)` → `activity_name` |
| `workout_type` | `argMax` → `activity_type` |
| `start_time` | WHERE range; `argMax` → `start_time_gmt` |
| `distance_meters` | `argMax` → `distance` |
| `duration_seconds` | `argMax` → `duration` |
| `moving_time_seconds` | `argMax` → `moving_duration` |
| `avg_speed_mps` | `argMax` → `average_speed` |
| `max_speed_mps` | `argMax` → `max_speed` |
| `avg_heart_rate_bpm` | `argMax` → `average_hr` |
| `max_heart_rate_bpm` | `argMax` → `max_hr` |
| `calories_kcal` | `argMax` → `calories` |
| `steps` | `argMax` |
| `synced_at` | `argMax` version column |
| `app_id`, `org_id`, `provider` | GROUP BY only |

#### `ow_activity_summaries` — `tools/wearables.py` L112–130

| Column | Usage |
|--------|--------|
| `user_id` | SELECT, WHERE, GROUP BY |
| `summary_date` | SELECT, WHERE, GROUP BY, ORDER BY |
| `steps`, `distance_meters`, `calories_kcal`, `active_time_minutes`, `sedentary_time_minutes`, `avg_heart_rate_bpm`, `resting_heart_rate_bpm`, `max_heart_rate_bpm` | `argMax(..., synced_at)` |
| `synced_at` | version column |
| `app_id`, `org_id`, `provider` | GROUP BY |

#### `ow_timeseries` — `tools/cgm.py` L144–152

| Column | Usage |
|--------|--------|
| `timestamp` | SELECT, WHERE, ORDER BY |
| `value` | SELECT (glucose mg/dL) |
| `user_id` | WHERE |
| `metric_type` | WHERE `= 'blood_glucose'` |

### 4.2 Supabase (PostgREST tables)

#### `profiles`

| Columns selected / filtered | Call sites |
|----------------------------|------------|
| `id`, `full_name`, `email`, `date_of_birth` | `tools/athletes.py` L33, L72 |
| Filters: `organization_id`, `role`, `id`, `full_name` | athletes tools |
| `organization_id`, `role` | `api/middleware/auth.py` L93 |

#### `user_alerts` — `tools/alerts.py` L24–36

| Columns | Notes |
|---------|--------|
| `id`, `alert_type`, `title`, `message`, `severity`, `created_at`, `is_read` | select |
| Filters: `organization_id`, `user_id`, `is_read` | |

#### `training_sessions` — `tools/training.py` L27–39

| Columns | Notes |
|---------|--------|
| `id`, `title`, `session_date`, `duration_minutes`, `location`, `description` | select |
| Filters: `organization_id`, `session_date`, `athlete_id` | |

#### `tennis_matches` — `tools/tennis.py`

| Columns | Notes |
|---------|--------|
| `id`, `match_date`, `opponent_name`, `source`, `surface` | select (L32, L62) |
| `id`, `match_date`, `opponent_name` | evolution (L134) |
| Filters: `user_id`, `match_date`, `id` | **`organization_id` param unused** |

#### `tennis_match_sets` — `tools/tennis.py` L71–75

| Columns | Notes |
|---------|--------|
| `set_number`, `host_score`, `guest_score`, `set_winner`, `is_super_tiebreak` | |
| Filter: `match_id` | no `limit` |

#### `tennis_match_stats` — `tools/tennis.py` L78–83, L148–153

| Columns | Notes |
|---------|--------|
| `stat_name`, `stat_value` | match summary |
| `match_id`, `stat_name`, `stat_value` | evolution batch |
| Filters: `match_id`, `player`, `set_number` | no `limit` on stats rows |

#### `lab_panels` — `tools/biomarkers.py`

| Columns | Call sites |
|---------|------------|
| `id`, `athlete_id`, `panel_type`, `lab_name`, `drawn_at`, `received_at`, `notes` | `get_lab_panels` L33 |
| `id`, `athlete_id`, `organization_id`, `panel_type`, `lab_name`, `drawn_at` | `analyze_lab_panel` L113 |
| `id`, `drawn_at` | `get_biomarker_trend` L166 |
| Filters: `organization_id`, `drawn_at`, `athlete_id`, `id` | |

#### `lab_biomarkers` — `tools/biomarkers.py`

| Columns | Call sites |
|---------|------------|
| `id`, `biomarker_key`, `display_name`, `value`, `unit`, `ref_low`, `ref_high`, `status`, `provenance` | L68 |
| `panel_id`, `value`, `unit`, `ref_low`, `ref_high`, `status` | trend L181 |
| Filters: `panel_id`, `biomarker_key` | no row limit on panel biomarkers |

#### `lab_reference_ranges` — `tools/optimal_zones.py` L114–121

| Columns | Notes |
|---------|--------|
| `biomarker_key`, `display_name`, `ref_low`, `ref_high`, `ref_unit`, `optimal_low`, `optimal_high`, `optimal_zone_label` | |
| Filters: `biomarker_key`, `activity_context` | |

#### `genetic_reports` — `tools/genetics.py`, `tools/genetic_parser.py`

| Columns | Notes |
|---------|--------|
| `id`, `athlete_consent`, `coach_consent` | read L49 |
| Filters: `athlete_id`, `organization_id`, `parse_status` | |
| Writes (intended PATCH): `parse_status`, `parsed_at`, `parse_error` | parser L201–271 (broken — PATCH unsupported) |

#### `genetic_traits` — `tools/genetics.py`, `tools/genetic_parser.py`

| Columns | Notes |
|---------|--------|
| `id`, `trait_key`, `display_name`, `evidence_tier`, `feature_label`, `description`, `disclaimer`, `source` | read L69 |
| Filter: `report_id` | no limit |
| POST insert of trait dicts + `report_id` | parser L242 |

#### `genetic_trait_catalog` — `tools/genetics.py` L104–107; `tools/genetic_parser.py` L36–38

| Columns | Notes |
|---------|--------|
| `trait_key`, `display_name`, `evidence_tier`, `category`, `description`, `disclaimer`, `is_actionable` | catalog tool |
| + `snp_rsids`, `possible_features` | parser fetch |
| no filters / no limit | full table pull |

#### `insights` — `api/routes/insights.py`, `agent/nightly_batch.py`

| Columns | Notes |
|---------|--------|
| Wide select L123; `select=*` L151 | list/get |
| POST body: `athlete_id`, `organization_id`, `coach_id`, `claim`, `category`, `confidence`, `evidence`, `actions`, `requires_coach_review`, `source`, `trigger` | store |
| Review POST attempts `id`, `coach_review_status` | L181–184 (PostgREST upsert semantics unclear without Prefer headers) |

#### `coach_reviews` — `insights.py` L187–198

| Columns written | `insight_id`, `coach_id`, `action`, `comment`, optional `edited_claim`, `edited_actions` |

#### `feedback_events` — `insights.py` L226–238

| Columns written | `user_id`, `organization_id`, `feedback_type`, `reason_codes`, `comment`, optional `insight_id`, `conversation_id` |

### 4.3 Tables **not** referenced in this Python service

- No `garmin_connect_*` / `garmin_connections` tables.
- No Redis-backed tables/keys.

---

## 5. Query construction & injection risk

### ClickHouse — parameterized (low SQL injection risk)

All three CH queries use `clickhouse_connect` bind parameters (`%(uid)s`, `%(s)s`, `%(e)s`, `%(lim)s`). Values are **not** string-interpolated into SQL.

Example (safe pattern):

```61:67:PeakPerformanceData/ppp_ai_agent/tools/wearables.py
            WHERE user_id = %(uid)s
              AND start_time >= %(s)s
              AND start_time <= %(e)s
            GROUP BY app_id, org_id, user_id, provider, id
        )
        ORDER BY start_time_max DESC
        LIMIT %(lim)s
```

```147:151:PeakPerformanceData/ppp_ai_agent/tools/cgm.py
        WHERE user_id = %(uid)s
          AND metric_type = 'blood_glucose'
          AND timestamp >= %(s)s
          AND timestamp <= %(e)s
```

**No ClickHouse SQL string interpolation of user input found.**

### Supabase / PostgREST — filter string interpolation (injection / filter-break risk)

User- or tool-controlled values are embedded into PostgREST filter expressions via f-strings. This is **not classic SQL injection** (PostgREST parses filters), but **filter injection / logic bypass** is possible if values contain commas, parentheses, or operators (e.g. `ilike`, `in.()`).

Exact examples:

```30:40:PeakPerformanceData/ppp_ai_agent/tools/athletes.py
    params = {
        "organization_id": f"eq.{organization_id}",
        "role": "eq.player",
        "select": "id,full_name,email,date_of_birth",
        "order": "full_name",
        "limit": str(limit),
    }

    if assigned_player_ids is not None:
        ids_csv = ",".join(assigned_player_ids)
        params["id"] = f"in.({ids_csv})"
```

```68:71:PeakPerformanceData/ppp_ai_agent/tools/athletes.py
    params = {
        "organization_id": f"eq.{organization_id}",
        "role": "eq.player",
        "full_name": f"ilike.%{query}%",
```

```24:29:PeakPerformanceData/ppp_ai_agent/tools/alerts.py
    params = {
        "organization_id": f"eq.{organization_id}",
        "user_id": f"eq.{user_id}",
        "select": "id,alert_type,title,message,severity,created_at,is_read",
        "order": "created_at.desc",
        "limit": str(limit),
```

```29:35:PeakPerformanceData/ppp_ai_agent/tools/tennis.py
        data = await supabase_rpc("tennis_matches", params={
            "user_id": f"eq.{athlete_id}",
            "match_date": f"gte.{since}",
            "select": "id,match_date,opponent_name,source,surface",
            "order": "match_date.desc",
            "limit": str(limit),
        })
```

```147:153:PeakPerformanceData/ppp_ai_agent/tools/tennis.py
        ids_csv = ",".join(match_ids)
        stats_resp = await supabase_rpc("tennis_match_stats", params={
            "match_id": f"in.({ids_csv})",
            "player": "eq.host",
            "set_number": "eq.0",
            "select": "match_id,stat_name,stat_value",
        })
```

```113:118:PeakPerformanceData/ppp_ai_agent/tools/optimal_zones.py
    keys_csv = ",".join(biomarker_keys)
    params = {
        "biomarker_key": f"in.({keys_csv})",
        "activity_context": f"eq.{activity_context}",
        "select": "biomarker_key,display_name,ref_low,ref_high,ref_unit,optimal_low,optimal_high,optimal_zone_label",
    }
```

Also: URL path interpolation `f"{SUPABASE_URL}/rest/v1/{path}"` (`db.py` L52). `path` is currently a hard-coded table name from call sites (not user input), so low risk today.

---

## 6. Error handling

### Supabase wrapper (`db.py`)

- `resp.raise_for_status()` — HTTP errors propagate as `httpx.HTTPStatusError`.
- No retry, no circuit breaker.
- Connection/timeout failures surface as httpx exceptions to callers.
- Empty JSON arrays are returned as success to tools (PostgREST `[]`).

### Tool-level pattern (typical)

Most tools wrap in `try/except Exception`, log, and return structured failure with `success: False` and often empty lists — **errors are swallowed from the orchestrator’s perspective** (returned as data, not raised):

- `wearables.py` L96–98, L157–159  
- `cgm.py` L192–194  
- `alerts.py` L50–52  
- `athletes.py` L54–56, L93–95  
- `training.py` L52–54  
- `tennis.py` L48–50, L115–117, L202–204  
- `biomarkers.py` L56–58, L90–91, L198–200  
- `genetics.py` L93–95, L123–125  
- `optimal_zones.py` L123–125 → returns `{}` on failure (silent empty ranges)

Empty results are treated as successful empty payloads (`success: True`, empty lists / `has_data: False` for CGM L162–163).

### Exceptions

- `analyze_lab_panel` (`biomarkers.py` L111+) — first `supabase_rpc` **not** in try/except; failures can raise to the API.
- `genetic_parser._update_parse_error` L273–274 — `except Exception: pass` fully swallows update failures.
- Auth token verification failures return `None` → 401 (`auth.py` L112–114).

### Timeouts

- Supabase httpx: **15s** (`db.py` L50).
- Auth verification client: **10s** (`auth.py` L73).
- ClickHouse: **none configured**.

---

## 7. Caching / Redis

| Item | Status |
|------|--------|
| `redis==5.0.1` in `requirements.txt` L11 | Declared |
| `REDIS_URL` in `config/settings.py` L31 | Defined |
| `import redis` / Redis client usage in tools or API | **None** |
| In-process query cache | **None** |
| docker-compose Redis service | **None** (agent service only) |

**Verdict:** Redis is a dependency/config placeholder; **not used by the data access layer**.

---

## 8. Row limits & pagination (LLM prompt risk)

| Query / tool | Limit? | Risk |
|--------------|--------|------|
| `get_wearable_activities` | `LIMIT %(lim)s` default **50** | Bounded |
| `get_wearable_summary` | **No LIMIT**; bounded by `days_back` (default 7 → ~7 rows/day groups) | Low–moderate if `days_back` large |
| `get_cgm_scores` | **No LIMIT**; all `blood_glucose` points in window | **High** — CGM can be dense (minutes); loads **all rows into memory** then scores; scores (not series) go to LLM, but process can OOM / block |
| `get_alerts` | default 20 | Bounded |
| `get_athletes` | default 20; nightly uses **500** | Bounded |
| `search_athlete` | hard **10** | Bounded |
| `get_training_sessions` | default 20 | Bounded |
| `get_tennis_matches` / evolution | default 20 | Bounded |
| `tennis_match_sets` / `tennis_match_stats` | **no limit** | Low (small cardinality per match) |
| `get_lab_panels` | default 10 | Bounded |
| `get_panel_biomarkers` | **no limit** | Moderate (panel size) — features go to LLM via specialist |
| `get_biomarker_trend` | panels capped **50**; biomarkers unlimited for key | Bounded-ish |
| `get_genetic_traits` | **no limit** | Moderate |
| `get_genetic_trait_catalog` | **no limit** — full catalog | Moderate if large |
| `list_insights` | `min(limit, 100)` | Bounded |
| PostgREST max-rows server default | Not set by client (`Range` / `Prefer` unused) | Server may still cap |

**Largest LLM-adjacent risk:** wearable activity rows (up to `limit`) and biomarker panel `features` arrays are serialized into prompts (`nightly_batch.py` L87–88). CGM avoids sending raw series to the LLM (scores only) but still fetches unbounded CH rows.

---

## 9. Dual-read gap: ClickHouse vs legacy Supabase Garmin tables

### In this Python service (`ppp_ai_agent`)

**Gap does not exist.** Wearable tools read ClickHouse only:

- `get_wearable_activities` → `openwearables_data.ow_workouts` (`wearables.py` L1–4, L60)
- `get_wearable_summary` → `openwearables_data.ow_activity_summaries` (`wearables.py` L124)
- CGM → `openwearables_data.ow_timeseries` (`cgm.py` L146)

No references to `garmin_connect_*` in any Python file under `ppp_ai_agent`.

Nightly batch also uses these CH tools (`agent/nightly_batch.py` L3–4, L28–29, L67–69).

### Contrast: Next.js AI tools (outside this service)

Legacy Supabase Garmin reads still exist in the main app, e.g.:

- `peak_performance_data/src/lib/ai/tools/athleteTools.ts` (~L507): `.from('garmin_connect_activities')`
- `peak_performance_data/src/lib/ai/tools/filterAthleteTools.ts` (~L50): `.from('garmin_connections')`

The prior “dual-read gap” note in `ppp_ai_agent/_plans/ppd_agentic_layer_0167692b.plan.md` describes the **Next.js** AI path, not the current Python tool implementations.

---

## 10. Additional DAL defects relevant to multi-agent upgrade

1. **Service role + weak route binding** — authenticated session identity is not enforced against tool `organization_id` / `athlete_id` / `user_id` arguments.
2. **Tennis tools ignore `organization_id`** — parameter accepted, never applied to PostgREST filters.
3. **`supabase_rpc` lacks PATCH** — genetic parse status updates cannot work as written.
4. **POST without `Prefer: return=representation`** — `result.get("id")` after inserts (`nightly_batch.py` L183, `insights.py` L97) may fail depending on PostgREST defaults.
5. **Unused deps:** `supabase` SDK and `redis` packages are installed but unused by DAL code.
6. **Database name mismatch:** client default DB `wearables_data` vs fully-qualified `openwearables_data.*` in SQL.

---

## 11. File index (absolute paths)

| Path | Role |
|------|------|
| `/Users/danielsilva/Desktop/PeakPerformanceDataMonorepo/PeakPerformanceData/ppp_ai_agent/tools/db.py` | Client singletons |
| `/Users/danielsilva/Desktop/PeakPerformanceDataMonorepo/PeakPerformanceData/ppp_ai_agent/tools/wearables.py` | CH workouts + summaries |
| `/Users/danielsilva/Desktop/PeakPerformanceDataMonorepo/PeakPerformanceData/ppp_ai_agent/tools/cgm.py` | CH timeseries → scores |
| `/Users/danielsilva/Desktop/PeakPerformanceDataMonorepo/PeakPerformanceData/ppp_ai_agent/tools/alerts.py` | Supabase alerts |
| `/Users/danielsilva/Desktop/PeakPerformanceDataMonorepo/PeakPerformanceData/ppp_ai_agent/tools/athletes.py` | Supabase profiles |
| `/Users/danielsilva/Desktop/PeakPerformanceDataMonorepo/PeakPerformanceData/ppp_ai_agent/tools/training.py` | Supabase training_sessions |
| `/Users/danielsilva/Desktop/PeakPerformanceDataMonorepo/PeakPerformanceData/ppp_ai_agent/tools/tennis.py` | Supabase tennis_* |
| `/Users/danielsilva/Desktop/PeakPerformanceDataMonorepo/PeakPerformanceData/ppp_ai_agent/tools/biomarkers.py` | lab_panels / lab_biomarkers |
| `/Users/danielsilva/Desktop/PeakPerformanceDataMonorepo/PeakPerformanceData/ppp_ai_agent/tools/optimal_zones.py` | lab_reference_ranges |
| `/Users/danielsilva/Desktop/PeakPerformanceDataMonorepo/PeakPerformanceData/ppp_ai_agent/tools/genetics.py` | genetic_* reads |
| `/Users/danielsilva/Desktop/PeakPerformanceDataMonorepo/PeakPerformanceData/ppp_ai_agent/tools/genetic_parser.py` | genetic_* writes |
| `/Users/danielsilva/Desktop/PeakPerformanceDataMonorepo/PeakPerformanceData/ppp_ai_agent/tools/registry.py` | Tool dispatch map |
| `/Users/danielsilva/Desktop/PeakPerformanceDataMonorepo/PeakPerformanceData/ppp_ai_agent/config/settings.py` | Env config |
| `/Users/danielsilva/Desktop/PeakPerformanceDataMonorepo/PeakPerformanceData/ppp_ai_agent/api/middleware/auth.py` | Auth + service-role profile fetch |
| `/Users/danielsilva/Desktop/PeakPerformanceDataMonorepo/PeakPerformanceData/ppp_ai_agent/api/routes/insights.py` | HTTP → tools / CRUD |
| `/Users/danielsilva/Desktop/PeakPerformanceDataMonorepo/PeakPerformanceData/ppp_ai_agent/agent/nightly_batch.py` | Batch CH + Supabase → insights |
| `/Users/danielsilva/Desktop/PeakPerformanceDataMonorepo/PeakPerformanceData/ppp_ai_agent/requirements.txt` | Declares redis/supabase unused |

---

*End of dossier. No application code was modified.*
