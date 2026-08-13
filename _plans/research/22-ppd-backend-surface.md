# 22 — `ppd_backend` Service Surface Dossier

**Scope:** Complete HTTP surface, auth, data deps, deploy/runtime, and proposed specialist tool wrappers for treating `PeakPerformanceData/ppd_backend` as a black-box analytics specialist.  
**Status:** Read-only research. No code was modified; no services were started.  
**Repo path:** `PeakPerformanceData/ppd_backend`  
**Public base URL (prod):** `https://api.wearablesync.app/ppc`  
**Local base URL:** `http://localhost:8000` (no `/ppc` prefix)

**Primary sources (read in full or mapped):**
- `api/main.py` (133 lines)
- `api/routes/graphs.py` (917 lines)
- `api/routes/weekly_km_pace.py` (184 lines)
- `api/routes/wearables.py` (125 lines; **untracked** `??` in git as of research)
- `api/middlewares/timeout.py` (114 lines; defined but **not wired** onto routes)
- `Dockerfile`, `docker-compose.yml`, `README.md`, `requirements.txt`, `requirements-dev.txt`, `render.yaml`, `.github/workflows/ci.yml`, `scripts/auto_deploy.sh`
- Supporting: `config/database.py`, `config/settings.py`, `utils/core/caching.py`, `utils/database/db_helpers.py`, `data_processing/base/{base_graph_generator,graph_data_processor,graph_registry}.py`, `data_processing/factories/graph_factory.py`, `background_jobs/scheduler.py`

**Cross-references (frontend consumers):**
- `peak_performance_data/src/lib/core/config.ts` L31–32 — `PPC_API_URL = https://api.wearablesync.app/ppc`
- `peak_performance_data/src/lib/ai/tools/garminActivityTools.ts` L35–48 — already calls `/wearables/activities/{id}` with `x-internal-service` header

---

## 1. Directory map (`api/`)

```
api/
├── __init__.py                 (empty)
├── main.py                     FastAPI app, CORS, GZip, routers, health, scheduler warmup
├── middlewares/
│   ├── __init__.py             (empty)
│   └── timeout.py              RequestTimeoutError + timeout decorator + CircuitBreaker
└── routes/
    ├── __init__.py             (empty)
    ├── graphs.py               /api/v1/graphs/*  (primary product surface)
    ├── weekly_km_pace.py       /api/weekly-km-pace/
    └── wearables.py            /wearables/activities/{user_id}  (AI-oriented; untracked)
```

Router mounting (`api/main.py` L70–73):

| Router module | Mount prefix | Tags |
|---|---|---|
| `weekly_km_pace.router` | `/api/weekly-km-pace` | `weekly-km-pace` |
| `graphs.router` | *(prefix inside router)* `/api/v1/graphs` | `graphs` |
| `wearables.router` | *(none — paths absolute on router)* | `wearables` |

App also defines `GET /health` (L75–77) and `GET /` (L79–84).

---

## 2. Authentication

**Verdict: no inbound HTTP authentication.**

Evidence:
- No `HTTPBearer`, `APIKey`, `Depends` auth, or `x-internal-service` validation anywhere under `api/`.
- Grep of `api/**/*.py` for auth/security patterns returns nothing.
- CORS (`api/main.py` L28–40) restricts **browser** origins to `peakperformancedata.app` (+ www/http variants) and `localhost:3000`. Non-browser callers (server-to-server agents) are **not** blocked by CORS.
- README mentions `API_KEY` in a sample `.env` (`README.md` L40–42) but **no code reads `API_KEY` for request auth**.
- Frontend AI tools send `x-internal-service: $INTERNAL_SERVICE_SECRET` (`garminActivityTools.ts` L37–48) — **ppd_backend ignores this header today**.

**Outbound secrets the service itself uses** (not request auth):
| Env var | Purpose | File |
|---|---|---|
| `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` | Admin Supabase client | `config/database.py` L18–19, L87–101 |
| `SUPABASE_ANON_KEY` | Anon client | `config/database.py` L20, L141–155 |
| `CLICKHOUSE_WEARABLES_*` | Graph/activity ClickHouse | `config/database.py` L26–30, L48–66 |
| `OPENWEARABLES_API_KEY` | User-id resolution via OW API header `X-Open-Wearables-API-Key` | `config/database.py` L34; `utils/user_id_resolver.py` L99 |
| `REDIS_URL` | Graph L2 cache | `utils/core/caching.py` L198–205; compose L29 |
| `AIRTABLE_*`, `AWS_*` | Background PNG upload (not request auth) | `config/settings.py` L28–38 |

**Implication for agent service:** treat network exposure as the only gate today (Traefik host+path). Prefer calling from the shared Docker network / Hetzner host. Do **not** assume `x-internal-service` is enforced until `ppd_backend` grows a check. Optionally add shared-secret middleware when the agent lands.

---

## 3. Complete HTTP endpoint inventory

Base paths below are **post-strip** (what the FastAPI app sees). Production callers must prefix with `https://api.wearablesync.app/ppc`.

### 3.1 Health / root

#### `GET /health`
- **File:** `api/main.py` L75–77
- **Params:** none
- **Response:** `{"status": "healthy"}`
- **Computes:** liveness only (used by Docker healthcheck)
- **Latency:** trivial
- **Agent value:** readiness probe before tool calls

#### `GET /`
- **File:** `api/main.py` L79–84
- **Response:** `{"message": "Welcome...", "docs": "/docs"}`
- **Agent value:** none (human/docs)

---

### 3.2 Wearables (structured numbers — preferred for agents)

#### `GET /wearables/activities/{user_id}`
- **File:** `api/routes/wearables.py` L22–124
- **Path param:** `user_id` (Supabase Auth UUID; `ow_workouts.user_id` stores this directly — L86 comment in `graph_data_processor.py`)
- **Query:**
  | Name | Type | Default | Constraints |
  |---|---|---|---|
  | `days_back` | int | 7 | 1–365 |
  | `start_date` | str? | null | ISO `YYYY-MM-DD` |
  | `end_date` | str? | null | ISO `YYYY-MM-DD` |
  | `limit` | int | 50 | 1–500 |
- **Computes:** ClickHouse query on `openwearables_data.ow_workouts` with `argMax(..., synced_at)` dedupe; returns raw workout rows ordered by start time DESC.
- **Response shape (success):**
  ```json
  {
    "success": true,
    "user_id": "<uuid>",
    "count": 12,
    "activities": [
      {
        "user_id": "...",
        "activity_id": "...",
        "activity_name": "...",
        "activity_type": "running",
        "start_time_gmt": "2026-07-01T10:00:00",
        "distance": 5000.0,
        "duration": 1800.0,
        "moving_duration": 1750.0,
        "average_speed": 2.8,
        "max_speed": 4.1,
        "average_hr": 145,
        "max_hr": 178,
        "calories": 420,
        "steps": 6200
      }
    ]
  }
  ```
- **Kind:** **NUMBERS / structured** (best agent input today)
- **Latency:** usually fast (single CH query, LIMIT ≤500). Not Redis-cached at this layer.

---

### 3.3 Weekly km pace (structured numbers; legacy Supabase)

#### `GET /api/weekly-km-pace/`
- **File:** `api/routes/weekly_km_pace.py` L10–184
- **Query:**
  | Name | Type | Default | Notes |
  |---|---|---|---|
  | `user_id` | str | **required** | Supabase user id |
  | `months_range` | int | 2 | documented; not heavily used in handler body |
  | `limit` | int | 50 | 1–500 activity page size |
  | `offset` | int | 0 | offset pagination |
  | `activity_type` | str? | `"Run"` | filter intent (count path currently skips type filter — `db_helpers.py` L60–64) |
  | `retrieve_all` | bool | false | batches up to **2000** activities — slow path |
  | `cursor` | str? | null | cursor pagination |
  | `splits_page` | int | 1 | splits pagination |
  | `splits_page_size` | int | 100 | 1–500 |
  | `sampling_method` | str | `"recent"` | `recent` \| `even` \| `random` |
- **Computes:** loads `garmin_connect_activities` from Supabase → `generate_weekly_kilometer_splits` (`data_processing/weekly_km_pace.py`) producing per-km splits + weekly averages.
- **Response shape (core fields from L364–384 of weekly_km_pace.py + route L170–179):**
  ```json
  {
    "splits": [{ "/* km split rows */" }],
    "pagination": {
      "page": 1, "page_size": 100, "total_items": N,
      "total_pages": N, "has_previous": false, "has_next": true
    },
    "weekly_averages": [{
      "year_week": "...", "week_start": "...", "kilometer": 1,
      "avg_pace_sec_per_km": 300.0, "avg_pace_min_km": 5.0,
      "avg_pace_formatted": "05:00", "activity_count": 3, "avg_distance": 10.2
    }],
    "date_range": { "earliest": "...", "latest": "..." },
    "summary": {
      "total_activities": N, "processed_activities": N, "skipped_activities": N,
      "total_km_splits": N, "sampling_applied": false, "processing_time_sec": 1.2
    },
    "activities_count": N, "activities_total": N, "next_cursor": null,
    "has_more_activities": false, "retrieve_all": false
  }
  ```
- **Kind:** **NUMBERS / structured**
- **Latency:** **SLOW when `retrieve_all=true`** or large activity history (pandas processing; hard cap 2000 activities). Prefer paginated mode for agents.
- **Data note:** still on **legacy Supabase `garmin_connect_activities`**, not ClickHouse `ow_workouts`. Prefer `/wearables/activities` for new agent work unless km-split math is required.

---

### 3.4 Graphs API (`/api/v1/graphs`)

Router prefix: `api/routes/graphs.py` L25.

**Shared graph payload shape** (from `BaseGraphGenerator.create_response`, `base_graph_generator.py` L83–107, filtered for cache/API in `_prepare_cache_data` L156–168):

```json
{
  "success": true,
  "cached": true,
  "graph_type": "hrv_trends",
  "user_id": "<uuid>",
  "response_time_ms": "< 100ms",
  "config": { "displayModeBar": true, "displaylogo": false, "responsive": true, "...": "..." },
  "data": [
    { "type": "scatter", "name": "Nightly HRV", "x": ["2026-01-01", "..."], "y": [62, 58, "..."], "...": "plotly trace fields" }
  ],
  "layout": { "title": { "text": "..." }, "xaxis": {}, "yaxis": {} },
  "metadata": {
    "graph_type": "hrv_trends",
    "display_name": "HRV Trends",
    "generated_at": "ISO-8601",
    "data_source": "official",
    "metric": "hrv",
    "...graph-specific stats...": true
  }
}
```

**Critical for agents:** HTTP responses are **Plotly JSON** (series for charts), **not PNG images**. They are structured, but verbose and chart-oriented. Agents should **not** dump raw `data`/`layout` into the LLM context — wrap and pre-aggregate (see §8).

PNG exists only in side paths:
- Optional Airtable upload inside `POST /generate` when `send_to_airtable=true` (`graphs.py` L398–417) — still returns JSON to the client.
- Background daily job uploads PNG to Airtable/S3 (`background_jobs/daily_graph_generator.py`) — **not an HTTP image endpoint**.

---

#### `GET /api/v1/graphs/user-providers/{user_id}`
- **File:** `graphs.py` L203–248
- **Computes:** DISTINCT `provider` across four OW tables (UNION ALL with LIMIT 3 each).
- **Response:** `{"providers": ["garmin","whoop"], "success": true, "user_id": "..."}` (empty providers + `success:false` on error, still 200)
- **Kind:** structured
- **Latency:** fast (early-stop CH scan)
- **Headers:** `Cache-Control: no-store`

#### `GET /api/v1/graphs/available`
- **File:** `graphs.py` L251–264
- **Response:** `{ success, graphs: { categories, total_graphs, graph_types }, total_count, categories }`
- **Kind:** structured catalog
- **Latency:** fast after registry warm; cold start triggers discovery (pandas/plotly import)

#### `GET /api/v1/graphs/preload-status/{user_id}`
- **File:** `graphs.py` L267–295
- **Response:** per-graph `{ cached, load_time: "< 100ms" | "4-6 seconds" }`, counts, `recommendation: "preload"|"ready"`
- **Documents expected cold latency:** **4–6 seconds** per uncached graph (L280)

#### `POST /api/v1/graphs/preload/{user_id}`
- **File:** `graphs.py` L298–362
- **Body/query:** optional `graph_types: list`, `priority: "high"|"normal"|"low"` (default `"normal"`)
- **Behavior:** returns immediately; enqueues background generation (weeks_back=52, days_back=365, data_source=official)
- **Response:** `{ success, message, strategy, estimated_completion, graph_types, status: "processing_in_background" }`
- **Agent use:** warm cache before a coaching session / nightly brief

#### `DELETE /api/v1/graphs/cache/{user_id}`
- **File:** `graphs.py` L365–379
- **Invalidates** in-memory + Redis graph cache for user
- **Response:** `{ success, message, user_id }`

#### `POST /api/v1/graphs/generate`
- **File:** `graphs.py` L382–434
- **Body (`GraphGenerationRequest` L31–39):**
  ```json
  {
    "user_id": "uuid",
    "graph_type": "hrv_trends",
    "send_to_airtable": false,
    "weeks_back": 12,
    "days_back": 90,
    "start_date": null,
    "end_date": null,
    "force_refresh": false
  }
  ```
- **Note:** `force_refresh` / dates are on the model but the handler only passes `weeks_back`/`days_back` into `create_graph` (L388–393) — date/force fields are effectively unused on this path.
- **Response:** Plotly JSON + `metadata` + `airtable_uploaded` (no `figure` object in HTTP response)
- **Latency:** always regenerates (no cache check on this path) → **slow**

#### `GET /api/v1/graphs/{graph_type}/{user_id}`
- **File:** `graphs.py` L438–549 — **primary chart endpoint**
- **Query:**
  | Name | Default | Notes |
  |---|---|---|
  | `data_source` | `"official"` | `"official"` = OW OAuth tables; `"unofficial"` = legacy `activities` + user_id resolver |
  | `days_back` | 90 | ignored when both start/end set |
  | `weeks_back` | 12 | ignored when both start/end set |
  | `start_date` | null | `YYYY-MM-DD` |
  | `end_date` | null | `YYYY-MM-DD` |
  | `force_refresh` | false | bypass cache |
- **Cache:** Redis L2 + in-memory L1, TTL **2 hours** (`caching.py` L418 `GraphCache(default_ttl_hours=2)`). Empty payloads are **not** cached (L518–526).
- **Thread pool:** `ThreadPoolExecutor(max_workers=8)` (`graphs.py` L29)
- **Latency:**
  - Cache hit: **&lt; 100ms** (documented in response)
  - Cache miss: typically **~0.5–6s**; comments cite pace graphs **1–2s** cold (`graphs.py` L667–668)
- **Kind:** Plotly JSON (structured chart series)

#### `POST /api/v1/graphs/batch/{user_id}`
- **File:** `graphs.py` L566–657
- **Body (`BatchGraphRequest` L556–563):**
  ```json
  {
    "user_id": "uuid",
    "graph_types": ["sleep_duration", "hrv_trends", "recovery_score"],
    "days_back": 90,
    "weeks_back": 12,
    "start_date": null,
    "end_date": null,
    "force_refresh": false
  }
  ```
  Note: path `user_id` is authoritative for cache/generation; body also carries `user_id`.
- **Response:**
  ```json
  {
    "success": true,
    "user_id": "...",
    "total_graphs": 3,
    "response_time_ms": "1234.56ms",
    "graphs": {
      "hrv_trends": { "success": true, "cached": true, "data": [], "layout": {}, "config": {}, "metadata": {} }
    }
  }
  ```
- **Latency:** waits for **slowest** graph → can be **1–6s+** on cold cache. Prefer stream for UX; for agents prefer smaller batches or cache warm.

#### `POST /api/v1/graphs/batch/stream/{user_id}`
- **File:** `graphs.py` L690–823
- **Body:** same `BatchGraphRequest`
- **Response:** `Content-Type: application/x-ndjson` — one JSON object per line; trailer `{"__done__": true, "response_time_ms": "...", ...}`
- **Latency:** first graph ≈ fastest completion (**~200–500ms** median per comments L667–678); total still bound by slowest
- **Agent note:** NDJSON streaming is awkward for typical tool-calling; prefer `/batch` or single GET with summarization wrapper

---

### 3.5 Registered `graph_type` values (complete list)

Discovered via `def graph_type` returns under `data_processing/graphs/`:

| Category (folder) | `graph_type` | Display name |
|---|---|---|
| health_graphs | `sleep_efficiency` | Sleep Efficiency |
| health_graphs | `sleep_duration` | Sleep Duration |
| health_graphs | `sleep_stages` | Restorative Sleep |
| health_graphs | `hrv_trends` | HRV Trends |
| health_graphs | `resting_heart_rate` | Resting Heart Rate |
| health_graphs | `recovery_score` | Recovery Score |
| health_graphs | `stress_levels` | Stress Levels |
| health_graphs | `body_battery` | Body Battery |
| health_graphs | `body_temperature` | Body Temperature |
| health_graphs | `blood_oxygen` | Blood Oxygen (SpO2) |
| health_graphs | `daily_steps` | Daily Steps |
| health_graphs | `daily_calories` | Daily Calories |
| health_graphs | `workout_calories` | Workout Calories |
| health_graphs | `workout_duration` | Workout Duration |
| health_graphs | `workout_heart_rate` | Workout Heart Rate |
| health_graphs | `hr_zone_distribution` | HR Zone Distribution |
| training_graphs | `vo2_max_trends` | VO2 Max Trends |
| training_graphs | `respiration_rate` | Respiration Rate |
| training_graphs | `intensity_minutes` | Intensity Minutes |
| training_graphs | `training_load` | Training Load |
| volume_graphs | `weekly_workout_volume` | Weekly Workout Volume |
| volume_graphs | `volume_pace_trends` | Volume & Pace Trends |
| volume_graphs | `training_consistency` | Training Consistency |
| volume_graphs | `workout_intensity_balance` | Workout Intensity Balance |
| pace_graphs | `pace_over_time` | Pace Over Time |
| pace_graphs | `weekly_velocity` | Weekly Velocity |
| pace_graphs | `pace_relativization` | Pace Relativization |
| custom_graphs | `volume_pace_markers` | Volume & Pace with Markers |
| courses_graphs | `course_performance` | Course Performance |
| womens_health_graphs | `menstrual_cycle` | Menstrual Cycle |

Preload priority order (`graphs.py` L322–328):
- **high:** sleep_duration, sleep_efficiency, hrv_trends, respiration_rate, weekly_workout_volume, weekly_velocity
- **normal:** resting_heart_rate, stress_levels, body_battery, vo2_max_trends
- **low:** pace_over_time, volume_pace_trends, volume_pace_markers, pace_relativization

---

## 4. Numbers vs images — agent guidance

| Endpoint family | Returns | LLM-ready? |
|---|---|---|
| `/wearables/activities/*` | Tabular metrics | **Yes** (trim columns / limit rows) |
| `/api/weekly-km-pace/` | Splits + weekly averages | **Yes** (prefer `weekly_averages` + `summary`; drop raw splits) |
| `/api/v1/graphs/*` GET/batch/generate | Plotly `data`/`layout`/`config` + `metadata` | **Partially** — use `metadata` + summarize `y` series; never send full layout |
| Airtable/S3 PNG paths | Images (side effect) | **No HTTP image URL for agents** |
| `/health`, `/available`, providers, cache | Meta | Yes for orchestration |

**There is no dedicated “metrics JSON” endpoint for health metrics** (HRV, sleep, recovery, etc.). Those exist only as Plotly series inside graph responses. The agent specialist wrappers **must** reduce series → stats.

---

## 5. Latency characteristics

| Path | Typical | Notes |
|---|---|---|
| Cache hit graph GET | &lt;100ms | Redis/memory (`preload-status` L280) |
| Single graph cold | 0.5–6s | Documented 4–6s; pace graphs often 1–2s (`graphs.py` L667–668) |
| Batch (non-stream) cold | max(graph times) | Blocks on slowest |
| Batch stream | first paint ~fastest | Better for UI; awkward for tools |
| `/wearables/activities` | ~tens–few hundred ms | Single CH query |
| `/weekly-km-pace` paginated | medium | Supabase + pandas |
| `/weekly-km-pace?retrieve_all=true` | **slow / heavy** | up to 2000 activities |
| First request after boot | +seconds | Heavy import warmup thread (`main.py` L100–117); gunicorn `--preload` helps |
| Gunicorn kill threshold | **120s** | `Dockerfile` CMD |

**Agent recommendations:**
1. Call `POST .../preload/{user_id}` (or rely on nightly prewarm) before interactive briefs.
2. Prefer cached single-metric tools over large uncached batches.
3. Cap `graph_types` ≤ 3–5 per tool call; summarize server-side.
4. Use async/job pattern in the agent service for cold multi-graph fan-out; do not block the LLM turn on 6s×N.
5. Mirror gunicorn timeout (≥120s) if proxying; client-side tool timeout should be lower (e.g. 15–30s) with friendly failure.

**Caching layers:**
- Graph L1 memory + L2 Redis TTL 2h (`caching.py` L176–418)
- In-request CH query single-flight cache in `GraphDataProcessor` (`_query_cache`)
- Activity LRU caches in `caching.py` L108–110 (weekly-km helpers)
- `db_helpers` `@lru_cache` with 300s TTL for Supabase activity fetches

---

## 6. Data dependencies

### 6.1 ClickHouse (primary for graphs + wearables)

Client: `get_clickhouse_wearables_client()` — `config/database.py` L48–66  
Default DB name env: `CLICKHOUSE_WEARABLES_DATABASE` default `"wearables_data"`, but most queries fully-qualify `openwearables_data.*`.

| Table | Used by |
|---|---|
| `openwearables_data.ow_workouts` | official activities, wearables route, provider detect, most training/pace/volume graphs |
| `openwearables_data.ow_activity_summaries` | daily steps/calories/intensity/HR summary graphs; provider detect |
| `openwearables_data.ow_sleep_summaries` | sleep_*, hrv (primary), recovery-related; provider detect |
| `openwearables_data.ow_timeseries` | HRV alternatives, respiration, body battery, stress, SpO2, etc.; provider detect |
| `openwearables_data.ow_timeseries_daily_rollups` | daily rollup path in processor (`graph_data_processor.py` ~L724) |
| `wearables_data.hrv_data` | HRV fallback (`load_hrv_from_garmin_table`, L775–796) |
| `activities` (default DB / unofficial) | `data_source=unofficial` legacy path (`load_activity_data` L175–276) |

**User ID semantics:**
- `data_source=official` / wearables route: Supabase Auth UUID stored directly on `ow_*` tables.
- `data_source=unofficial`: resolve via `UserIdResolver` → OW internal id (`utils/user_id_resolver.py`).

### 6.2 Supabase

| Table | Used by |
|---|---|
| `garmin_connect_activities` | weekly-km-pace; daily graph generator active-user discovery |
| `performance_tests` | custom/marker graphs (`graph_data_processor.py` ~L944+) |
| `lactate_test_points` | lactate overlays |
| `competitions` | marker overlays |
| `injuries` | marker overlays |
| `transition_periods` | marker overlays |

### 6.3 External APIs (server-side)

| Service | Purpose |
|---|---|
| OpenWearables `GET /api/v1/users?external_user_id=` | unofficial user_id map |
| Airtable + S3 | background/optional PNG storage |
| Redis | graph cache L2 |

---

## 7. Deployment specifics (mirror this pattern)

### 7.1 Public URL

| Item | Value | Source |
|---|---|---|
| Host | `api.wearablesync.app` | `docker-compose.yml` L38 |
| Path prefix | `/ppc` | Traefik `PathPrefix(`/ppc`)` L38 |
| Strip prefix | `/ppc` stripped before app | middleware `ppc-strip` L43–44 |
| Effective app paths | `/health`, `/api/v1/graphs/...`, `/wearables/...` | FastAPI |
| Full prod example | `https://api.wearablesync.app/ppc/api/v1/graphs/available` | frontend `PPC_API_URL` |
| TLS | Let's Encrypt via Traefik | L41–42 |
| Entrypoint | `websecure` | L39 |
| Docker network | external `ppd-shared` | L57–59 |
| Priority | Traefik router priority `20` | L40 |

### 7.2 Compose services

- **`ppc-api`:** build local Dockerfile; port 8000; env from `.env`; `CLICKHOUSE_WEARABLES_HOST=host.docker.internal`; `REDIS_URL=redis://redis:6379/0`
- **`redis`:** `redis:7-alpine`, 256mb `allkeys-lru`, healthcheck ping
- Volumes: `ppc-logs`, `ppc-redis-data`
- Healthcheck: HTTP GET `localhost:8000/health` every 30s, start_period 10s

### 7.3 Gunicorn (`Dockerfile` L32–36)

```
gunicorn api.main:app \
  --workers 2 \
  --preload \
  --worker-class uvicorn.workers.UvicornWorker \
  --bind 0.0.0.0:$PORT \
  --timeout 120 \
  --graceful-timeout 30 \
  --worker-tmp-dir /dev/shm \
  --max-requests 1000 \
  --max-requests-jitter 50
```

| Setting | Value |
|---|---|
| Workers | **2** |
| Worker class | `uvicorn.workers.UvicornWorker` |
| Preload | yes (cold-start strategy) |
| Timeout | **120s** |
| Graceful timeout | 30s |
| Max requests / jitter | 1000 / 50 |
| Base image | `python:3.10-slim` |
| App port | 8000 |

### 7.4 Runtime side processes

On FastAPI startup (`main.py` L87–123):
1. Background thread: `graph_scheduler.start()` — daily jobs at **01:00 UTC** (`scheduler.py` L32–33)
2. Background thread: warm graph registry / pandas / plotly

### 7.5 Host deploy automation

`scripts/auto_deploy.sh`:
- Repo dir on server: `/opt/ppc-backend`
- Cron-oriented: fetch `origin/main`, `docker compose build && up -d` on SHA change
- Lock file `/tmp/ppc-autodeploy.lock`

### 7.6 Legacy Render

`render.yaml` still describes a Docker web service `ppd-backend` with `/health` — **not** the current Hetzner/Traefik path. Treat as legacy. Frontend CORS still lists old Render host in one file; production charts use WearableSync domain.

### 7.7 Mirror checklist for new agent service

1. Join `ppd-shared` Docker network.
2. Traefik: `Host(api.wearablesync.app) && PathPrefix(/<your-prefix>)` + stripprefix.
3. Gunicorn + UvicornWorker, small worker count, explicit timeouts.
4. Health endpoint for compose healthcheck.
5. Redis if caching tool results.
6. Auto-deploy from `/opt/<service>` cron pattern.
7. Env via `.env` + compose `env_file`.

---

## 8. CI / lint / test conventions

**Workflow:** `.github/workflows/ci.yml`

| Item | Value |
|---|---|
| Triggers | PR → `main`/`development`; push → `development` |
| Concurrency | cancel-in-progress per ref |
| Python | **3.11** (note: Docker image is **3.10**) |
| Install | `pip install -r requirements.txt` then `pip install ruff` |
| Lint | `ruff check .` (no `ruff.toml` / `pyproject.toml` in repo — Ruff defaults) |
| Test | `pytest -v --tb=short` with `TESTING=true` |
| Dev deps file | `requirements-dev.txt` pins `pytest==7.4.4`, `pytest-asyncio` — **CI does not install requirements-dev**, so pytest must be available another way or CI is fragile |

**Test layout:** `tests/` covering API graphs, graph generators, registry, cache single-flight, scheduler, Airtable utils.

**Convention for new agent service:** same shape — GitHub Actions, Python 3.11 CI, Ruff, pytest, concurrency group, no secrets in lint job.

---

## 9. How an agent should call it

```
Agent service (Hetzner / ppd-shared)
    │  HTTP (no auth today)
    ▼
https://api.wearablesync.app/ppc/...   OR   http://ppc-api:8000/... (compose DNS)
    │
    ▼
ppd_backend FastAPI  →  ClickHouse wearables  +  Supabase (legacy/markers)
```

**Preferred call order for a readiness/coaching brief:**
1. `GET /api/v1/graphs/user-providers/{user_id}` — know device context.
2. `GET /wearables/activities/{user_id}?days_back=14&limit=50` — recent load.
3. `GET /api/v1/graphs/{metric}/{user_id}?days_back=28` for 3–5 priority metrics (or batch if cache warm).
4. Summarize Plotly → stats in the tool layer before LLM.
5. Optionally `POST /preload/{user_id}` after login / overnight.

**Do not reimplement** pace/HRV/sleep math in the agent — call this specialist.

---

## 10. Proposed specialist tool wrappers

Each tool is an agent-facing function. It calls `ppd_backend`, then returns a **small pre-aggregated JSON** suitable for an LLM (target &lt;2–4 KB).

### 10.1 Orchestration tools

| Tool name | Endpoint | Input schema | Output shape (LLM) |
|---|---|---|---|
| `ppc_health` | `GET /health` | `{}` | `{ ok: bool }` |
| `list_wearable_providers` | `GET /api/v1/graphs/user-providers/{user_id}` | `{ user_id: uuid }` | `{ user_id, providers: string[], has_garmin: bool, has_whoop: bool }` |
| `list_available_metrics` | `GET /api/v1/graphs/available` | `{}` | `{ graph_types: string[], categories: string[], total: int }` |
| `preload_athlete_metrics` | `POST /api/v1/graphs/preload/{user_id}` | `{ user_id, priority?: "high"\|"normal", graph_types?: string[] }` | `{ queued: true, graph_types, estimated_seconds }` |
| `invalidate_athlete_metric_cache` | `DELETE /api/v1/graphs/cache/{user_id}` | `{ user_id }` | `{ invalidated: true }` |

### 10.2 Structured data tools (prefer these)

| Tool name | Endpoint | Input schema | Output shape (LLM) |
|---|---|---|---|
| `get_recent_workouts` | `GET /wearables/activities/{user_id}` | `{ user_id, days_back?: 1–90 default 14, limit?: ≤50, activity_type?: string, start_date?, end_date? }` | `{ count, workouts: [{ date, name, type, distance_km, duration_min, pace_min_per_km?, avg_hr?, max_hr?, calories? }], totals: { distance_km, duration_min, sessions } }` — **compute pace in wrapper** like `garminActivityTools.ts` |
| `get_weekly_km_pace_summary` | `GET /api/weekly-km-pace/` | `{ user_id, splits_page_size?: 20, sampling_method?: "recent", retrieve_all?: false }` | `{ date_range, summary, weekly_averages: [{ week_start, kilometer, avg_pace_formatted, activity_count }] }` — **omit raw `splits` array** unless explicitly requested |

### 10.3 Metric summary tools (wrap Plotly graphs)

Shared helper: `summarize_plotly_metric(payload)` → extracts from primary trace `y` + `metadata`:

```json
{
  "metric": "hrv_trends",
  "display_name": "HRV Trends",
  "success": true,
  "cached": true,
  "unit": "ms",
  "points": 28,
  "latest": { "date": "2026-07-30", "value": 61 },
  "previous": { "date": "2026-07-29", "value": 58 },
  "stats": { "mean": 55.2, "min": 40, "max": 72, "std": 8.1 },
  "trend": "up|down|flat",
  "delta_latest_vs_mean_pct": 10.5,
  "metadata": { "/* passthrough small keys only */" }
}
```

| Tool name | Endpoint | Input schema | Notes |
|---|---|---|---|
| `get_metric_summary` | `GET /api/v1/graphs/{graph_type}/{user_id}` | `{ user_id, graph_type, days_back?: 28, start_date?, end_date?, force_refresh?: false }` | Generic; whitelist graph_types |
| `get_sleep_summary` | same → `sleep_duration` (+ optional `sleep_efficiency`, `sleep_stages`) | `{ user_id, days_back?: 28 }` | May issue 1–3 GETs or one batch; merge into `{ duration, efficiency, restorative }` |
| `get_recovery_snapshot` | `hrv_trends` + `recovery_score` + `resting_heart_rate` + `body_battery` | `{ user_id, days_back?: 14 }` | Priority “high/normal” metrics; use `/batch` if cache warm |
| `get_training_load_snapshot` | `weekly_workout_volume` + `training_load` + `intensity_minutes` + `vo2_max_trends` | `{ user_id, days_back?: 42 }` | Training block view |
| `get_pace_snapshot` | `pace_over_time` (+ optional `weekly_velocity`) | `{ user_id, days_back?: 90 }` | **Slow when cold** — require cache or async; surface `metadata.avg_pace`, `best_pace`, `pace_improvement` |
| `get_stress_respiration_snapshot` | `stress_levels` + `respiration_rate` | `{ user_id, days_back?: 28 }` | Wellness adjunct |
| `get_metrics_batch_summary` | `POST /api/v1/graphs/batch/{user_id}` | `{ user_id, graph_types: string[1..5], days_back?: 28 }` | Returns `Record<graph_type, MetricSummary>`; cap length |

### 10.4 Tools to **avoid** exposing raw

| Raw endpoint | Why not expose 1:1 |
|---|---|
| `POST /generate` with `send_to_airtable` | Side effects; no cache; Airtable is ops |
| Full Plotly `layout` / hovertemplates | Token bloat |
| `/batch/stream` | Streaming not tool-friendly |
| `retrieve_all=true` weekly-km | Memory/latency risk |

### 10.5 Example wrapper pseudocode

```python
# agent tool → specialist
async def get_metric_summary(user_id: str, graph_type: str, days_back: int = 28) -> dict:
    url = f"{PPC_BASE}/api/v1/graphs/{graph_type}/{user_id}"
    raw = await http.get(url, params={"days_back": days_back, "data_source": "official"})
    if not raw.get("success"):
        return {"success": False, "metric": graph_type, "reason": "no_data_or_error"}
    return summarize_plotly_metric(raw)  # drop layout/config; keep stats + latest
```

`PPC_BASE` prod: `https://api.wearablesync.app/ppc`  
`PPC_BASE` compose: `http://ppc-api:8000`

---

## 11. Gaps / risks for the multi-agent design

1. **No inbound auth** — specialist is open if Traefik/network is reachable; agent should not amplify by proxying to the public internet without a secret.
2. **`wearables.py` is untracked** in git (`??`) — confirm it is committed before depending on it in production deploys.
3. **Health metrics lack a first-class numbers API** — Plotly summarization is mandatory glue.
4. **weekly-km-pace still on Supabase Garmin tables** — may diverge from OW ClickHouse truth.
5. **CI Python 3.11 vs Docker 3.10**; pytest not in prod requirements.
6. **`timeout_middleware` unused** — only gunicorn 120s protects hung CH queries.
7. Frontend already patterns the specialist call (`garminActivityTools`, `wearableInsightTools`, charts via `PPC_API_URL`) — reuse those URL/env conventions (`PPD_BACKEND_URL` / `NEXT_PUBLIC_PPC_API_URL`).

---

## 12. Quick reference — endpoint table

| Method | Path | Auth | Kind | Slow? |
|---|---|---|---|---|
| GET | `/health` | none | meta | no |
| GET | `/` | none | meta | no |
| GET | `/wearables/activities/{user_id}` | none | **numbers** | usually no |
| GET | `/api/weekly-km-pace/` | none | **numbers** | yes if `retrieve_all` |
| GET | `/api/v1/graphs/user-providers/{user_id}` | none | numbers | no |
| GET | `/api/v1/graphs/available` | none | meta | no |
| GET | `/api/v1/graphs/preload-status/{user_id}` | none | meta | no |
| POST | `/api/v1/graphs/preload/{user_id}` | none | side-effect | returns fast |
| DELETE | `/api/v1/graphs/cache/{user_id}` | none | side-effect | no |
| POST | `/api/v1/graphs/generate` | none | Plotly JSON (+ optional PNG upload) | **yes** |
| GET | `/api/v1/graphs/{graph_type}/{user_id}` | none | Plotly JSON | cold **yes** |
| POST | `/api/v1/graphs/batch/{user_id}` | none | Plotly JSON map | cold **yes** |
| POST | `/api/v1/graphs/batch/stream/{user_id}` | none | NDJSON Plotly | cold **yes** |

**End of dossier.**
