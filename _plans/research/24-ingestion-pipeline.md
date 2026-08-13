# 24 — Wearable Ingestion Pipeline (as-built)

**Scope:** `PeakPerformanceData/ppd_extraction_backend` (primary) and brief note on `PeakPerformanceData/ppd_legacy_extraction_backend`.  
**Mode:** Read-only investigation (2026-08-02).  
**Purpose:** Determine ingestion schedule, provider surfaces, and whether any completion signal exists that a multi-agent nightly batch or event-driven agent can subscribe to.

---

## 1. Executive verdict

Ingestion is a **two-path ClickHouse pipeline** on a Hetzner host:

1. **Unofficial Garmin** — password/session scrape via `python-garminconnect` → `wearables_data.*`
2. **OpenWearables (OW) OAuth** — Garmin / Polar / Suunto / Whoop (Apple typed but not wired in PPD BFF) → OW API → `openwearables_data.*`

**Schedule (production):** dedicated `ppd-scheduler` container runs Python `schedule` library:

- **Daily 00:00** — multi-user extraction (`run_all_users_extraction`)
- **Every hour** — OW→ClickHouse sync for OAuth users (`run_ow_sync_all_users`)

Timezone intent is UTC (`EXTRACTION_TIMEZONE=UTC`), but that setting is **never applied** to the scheduler; `schedule.every().day.at("00:00")` uses the **container local clock** (compose does not set `TZ`; assume UTC on Hetzner).

**Completion-signal verdict: NONE suitable for agents.**

There is no Redis pub/sub, no queue message, no outbound webhook, and no durable “batch finished” row that an agent can subscribe to. The closest artifacts are:

- `wearables_data.users.last_sync_at` (stamped after a successful per-user midnight run or some API syncs)
- Log lines (“Multi-user extraction completed…”)
- Schema-only tables `user_extraction_status` and `audit_log` that **no Python code writes**

Until a real completion event is emitted, any nightly AI batch must **guess a wall-clock offset after 00:00 UTC** (or poll `last_sync_at` / fresh ClickHouse rows).

---

## 2. Entry points & runtime topology

### 2.1 CLI (`main.py`)

| Command | Lines | Role |
|---|---|---|
| `run-scheduler` | `47–61` | Starts `MultiUserScheduler`, runs extraction once on startup, then schedule loop |
| `extract-all` | `64–73` | One-shot all active users |
| `extract-user` | `76–109` | One user; optional date-range / force backfill |
| `add-user` / `list-users` / `disable-user` | `115–183` | Multi-user credential management |
| `rebuild-timeseries-daily-rollups` / `validate-…` | `316–489` | OW timeseries rollup maintenance |
| `run-migrations` | `495–523` | Apply `migrations/*.sql` |

### 2.2 API (`src/api/main.py`)

- FastAPI app: webhooks, Garmin Connect BFF, generic provider BFF, health.
- **Also starts a daemon scheduler thread** on lifespan (`20–50`, `49–50`) — same `MultiUserScheduler` as the dedicated container. Production compose runs **both** `ppd-api` and `ppd-scheduler`, so midnight/hourly jobs can fire **twice** unless one path is disabled operationally.

Routers (`73–78`):

- `garmin_data` → `/api/v1/garmin-connect/*`
- `provider_data` → `/api/v1/providers/{provider}/*`
- `webhooks` → `/webhooks/*`
- `garmin_compat_router` → `/api/v1/garmin/webhooks/*`

Default container CMD (`docker/Dockerfile:32`): uvicorn on `:8080`.

### 2.3 Docker Compose (`docker/docker-compose.yml`)

| Service | Lines | Command |
|---|---|---|
| `traefik` | `5–21` | Reverse proxy / TLS |
| `ppd-api` | `49–75` | Default Dockerfile CMD (API) |
| `ppd-scheduler` | `80–98` | `python main.py run-scheduler` |

ClickHouse is **native on the host** (not in this compose); containers reach it via `host.docker.internal` (`46–48`, `59–60`).  
OpenWearables is a **separate** compose stack on shared network `ppd-shared` (`26–41`).

### 2.4 Scripts (`scripts/`)

| Script | Role |
|---|---|
| `auto_deploy.sh` | Host cron `*/5 * * * *` — pull `origin/main`, rebuild `ppd-scheduler` + `ppd-api` (lines `1–5`, `46–47`) |
| `deploy.sh` | Manual deploy helper |
| `setup_database.py` / `migrate_schema.py` | DB setup |
| `manage_users.py` / `add_test_user.py` / `clean_all_tables.py` | Ops helpers |

**No project README** exists under `ppd_extraction_backend/` (docs live in `memory_bank/`).

### 2.5 Requirements

`requirements.txt`: `garminconnect`, `garth`, `httpx`, `fastapi`, `uvicorn`, `clickhouse-driver`, `schedule`, `tenacity`, `cryptography`, etc. No Celery/Redis client in PPD itself.

---

## 3. Schedule (exact)

### 3.1 Configuration quote

From `src/scheduler/multi_user_scheduler.py:99–108`:

```python
def setup_schedules(self):
    """Setup extraction schedule - runs for all users at midnight."""

    # Run all users' extractions at midnight
    schedule.every().day.at("00:00").do(self.run_all_users_extraction)

    # Run OW→ClickHouse sync every hour for OAuth users (picks up real-time PUSH data)
    schedule.every().hour.do(self.run_ow_sync_all_users)

    logger.info("Multi-user extraction schedule configured: All users at midnight (00:00), OW sync every hour")
```

Scheduler loop (`555–569`): `schedule.run_pending()` every 60s; on error sleep 300s.

CLI docstring (`main.py:48–49`): “daily at midnight”.  
Settings (`src/config/settings.py:55–56`, `.env.example:53`):

```
EXTRACTION_TIMEZONE=UTC
```

**Important:** `extraction_timezone` is loaded but **never referenced** by scheduler code (only defined in settings / memory bank). Effective timezone = container/OS local time.

### 3.2 What each job does

| Job | When | Behavior |
|---|---|---|
| Midnight multi-user | `00:00` local | Sequential loop over `list_active_users()` (`110–151`). Per user: unofficial Garmin extractors **or** OW sync 30 days if no password (`153–177`). On success → `update_last_sync` (`138`). |
| Hourly OW sync | every hour | If `OPENWEARABLES_ENABLED`, `_run_ow_sync(user_id)` for every active user (`391–405`). Default days in `_run_ow_sync` signature is 7 (`343`), midnight OAuth path passes `days=30` (`174`). |
| Startup | once | `run-scheduler` runs `run_all_users_extraction()` immediately (`main.py:57–59`) before the loop. |
| Webhook-triggered | event | Garmin PING/PUSH handlers auto-sync OW→CH for affected users (`webhooks.py:186–189`, `219–258`, `420–451`). |
| Manual API | on demand | `POST …/sync/trigger` queues background OW→CH (provider_data / garmin_data). |

Legacy single-user scheduler (`src/garmin/scheduler/garmin_scheduler.py:90–96`) also uses `00:00`; production path is `MultiUserScheduler`.

### 3.3 OpenWearables internal schedule

OW stack (`docker/openwearables-prod.yml`) includes `celery-beat`, `celery-worker`, `redis`. That is **OW’s** ingestion/processing, not an agent-facing completion bus for PPD.

### 3.4 Duration & failure handling

**Duration:** Not measured or SLA’d in code. Observational bounds:

- Unofficial path: ~30+ extractors / user, `ThreadPoolExecutor(max_workers=6)` (`199`), rate limit ~0.5–3s/request (`base_extractor.py:84–113`), users **sequential**. Expect **minutes per credentialed user**, scaling linearly with user count.
- OW path: provider sync + concurrent fetches; Garmin waits ≤10s for sync (`sync_service.py:117–118`); post-connect webhook providers retry up to **5 minutes** (`provider_data.py:477–479`).
- Full midnight cohort finish time is **unknown without logs**; agents cannot treat “00:30 UTC” as reliable without instrumentation.

**Failure handling:**

- Per-extractor / per-provider exceptions logged; other extractors continue (`multi_user_scheduler.py:201–207`, `366–376`).
- User success = `successful > 0` extractors (`209–210`) or ≥1 provider synced (`381–386`).
- Auth retries: `tenacity` 3× on Garmin login (`garmin_auth.py:42–46`); extractors 5× on rate limit (`base_extractor.py:115–119`).
- Scheduler loop errors → sleep 5 minutes, continue (`568–569`).
- **No dead-letter queue, no alert webhook, no failed-run table writes.**

---

## 4. Provider integrations

Status reflects **PPD code + Traefik + memory bank**, not live credential validation on the Hetzner box.

| Provider | Status | Auth | Tokens / credentials stored | Sync method | Notes |
|---|---|---|---|---|---|
| **Garmin (unofficial)** | **Live** | Email/password → `garth` session | Password Fernet-encrypted in ClickHouse `wearables_data.users` (`user_manager.py:61–70`, migration `009`); OAuth session files under `garmin_tokens/{user_id}` (`garmin_auth.py:32–39`, `77–78`; volume `docker-compose.yml:62`) | **Polling** midnight (+ CLI) | Writes `wearables_data.*` |
| **Garmin (official OW)** | **Live (code)** | OAuth 2.0 via OW | OW owns tokens (OW Postgres); PPD holds `GARMIN_CONSUMER_KEY/SECRET` for webhook headers (`.env.example:18–19`); BFF in `garmin_data.py` | **Webhook** PING/PUSH + **pull** `sync_provider` + hourly CH pull | Webhooks in `webhooks.py`; Traefik also routes `/api/v1/garmin` → OW (`routes.yml:53–60`) |
| **Polar** | **Partial / live code** | OAuth via OW (`provider_data.py`) | Tokens in OW; PPD `VALID_PROVIDERS` includes `polar` (`22–23`) | **Pull** (OW sync + hourly); Traefik has no Polar-specific webhook route | Scheduler includes `polar` (`SUPPORTED_OW_PROVIDERS` line `21`). External credentials historically “waiting” in `memory_bank/open-wearables.md:49` |
| **Whoop** | **Partial / live code** | OAuth via OW | Tokens in OW | Pull + OW-side webhooks (Traefik `whoop-webhooks` `routes.yml:77–84`); PPD treats whoop/polar as webhook-retry providers (`provider_data.py:477`) | No PPD-native Whoop webhook handler |
| **Suunto** | **Partial / live code** | OAuth via OW | Tokens in OW | Pull via scheduler + BFF | In `VALID_PROVIDERS` + `SUPPORTED_OW_PROVIDERS` |
| **Apple Health** | **Planned / typed only** | SDK push (no OAuth) per OW docs | N/A in PPD | Not in PPD BFF or scheduler provider tuple | `ProviderType` includes `"apple"` (`client.py:9`) but not synced by PPD scheduler |
| **Strava** | **Infra only** | — | — | Traefik route to OW (`routes.yml:65–72`) | No PPD Python routes |
| **Oura / Fitbit** | **Not integrated** | — | — | — | Mentioned as non-matrix in OW docs (`open-wearables.md:184`) |

### 4.1 Webhook receivers (PPD)

File: `src/api/routes/webhooks.py`

| Endpoint | Lines | Purpose |
|---|---|---|
| `POST /webhooks/garmin/ping` | `12–31` | Fetch callback URLs; forward to OW; health-direct CH insert; auto-sync activities |
| `POST /webhooks/garmin/push` | `34–52` | Forward to OW; OW→CH sync |
| `POST /webhooks/garmin/deregistration` | `460–494` | Disconnect Garmin in OW |
| `POST /webhooks/garmin/user-permissions` | `533–547` | Audit log only |
| `GET /webhooks/garmin/health` | `561–564` | Health |

Compat aliases: `/api/v1/garmin/webhooks/*` (`garmin_compat_router.py`).

**Polar / Whoop / Suunto / Strava / Apple:** no dedicated handlers under `src/api/routes/webhooks.py`. Provider webhooks (where they exist) are expected at OW via Traefik host `webhooks.wearablesync.app`.

---

## 5. Auth & token refresh

### 5.1 Unofficial Garmin

1. Credentials: `garmin_email` + Fernet-encrypted `garmin_password_encrypted` in ClickHouse (`migrations/009_create_users.sql:7–11`).
2. Session: resume from `garmin_tokens/{user_id}` via `Garmin().login(tokenstore)`; on failure, fresh login and `garth.dump` (`garmin_auth.py:59–78`).
3. Retries on `GarthHTTPError` / connection (`42–46`).
4. Encryption key: `ENCRYPTION_KEY` env (`settings.py:45`).

### 5.2 Official OAuth (all OW providers)

1. PPD BFF gets authorize URL from OW (`garmin_data.py` / `provider_data.py` oauth routes).
2. OW stores provider refresh/access tokens (OW Postgres — outside this repo).
3. PPD calls OW with `X-Open-Wearables-API-Key` (`client.py:17–19`).
4. Garmin consumer key/secret used for webhook forwarding headers (`webhooks.py:28`, `409`).
5. Refresh: delegated to OW / provider SDKs; PPD does not implement token refresh itself.

---

## 6. Data stores & Supabase

### 6.1 ClickHouse (primary write target)

| Database | Source path |
|---|---|
| `wearables_data` (settings default `CLICKHOUSE_DATABASE`, `.env.example` uses `wearables_data`) | Unofficial Garmin extractors |
| `openwearables_data` | OW sync service + health webhook processor |

Tables include workouts, sleep, timeseries, summaries, `users`, `user_extraction_status` (unused), `provider_connections` / `user_mapping` (schema; connections primarily live in OW API), `audit_log` (unused).

### 6.2 Supabase

**Read-only org lookup during sync** — `src/users/supabase_client.py`:

- Queries `profiles` + nested `organizations(slug)` (`33–44`)
- Fallback org id `"peak_performance"` (`29–30`, `60`)
- Cached in-process (`_ORG_CACHE`)

**No wearable rows are written to Supabase by this service.**  
Contrast: legacy backend wrote activities/accounts/sync jobs to Supabase (see §9).

Secondary side effect: sync trigger may `DELETE` graph cache on `ppc-api` (`provider_data.py:402–407`) — not Supabase.

---

## 7. Deduplication & backfill

### 7.1 Dedup

- ClickHouse **ReplacingMergeTree** on OW tables (`synced_at` / `updated_at` version columns) — e.g. `migrations/001_create_ow_workouts.sql:83`.
- Post-extraction `OPTIMIZE TABLE` (unofficial midnight path in old single-user scheduler; multi-user backfill calls `optimize_all_tables` at `547`; OW sync defaults `skip_optimize=True` to avoid OOM — `sync_service.py:50`, `139–148`).
- CLI `python main.py optimize` (`main.py:292–313`).

### 7.2 Backfill / incremental

| Mechanism | Location | Behavior |
|---|---|---|
| Incremental unofficial | `base_extractor.get_date_range` `50–82` | Start day after `get_last_sync_date`; else `backfill_days` (midnight uses 3 — `196`) |
| Force / range unofficial | `main.py extract-user`, `run_user_backfill` `498–553` | Explicit start/end; bypasses incremental |
| OAuth daily | `_run_ow_sync(..., days=30)` | Rolling window |
| OAuth hourly | `_run_ow_sync` default `days=7` | Rolling window |
| Chunked OW historical | `run_ow_backfill_chunked` `407–496` | 90-day chunks, `skip_provider_sync=True` |
| API post-connect | `provider_data` sync trigger `days=1825` | Long historical pull |
| Webhook | `days=1`, `skip_provider_sync=True` | Near-real-time |

---

## 8. Completion / event surface (detailed)

| Candidate | Exists? | Writable today? | Subscribable by agent? |
|---|---|---|---|
| `users.last_sync_at` | Yes (`009:15`) | Yes — midnight success + some API syncs | **Poll only** (ClickHouse ALTER, eventual consistency); no pub/sub |
| `user_extraction_status` | Schema yes (`009:47–61`) | **No writers in `src/`** | No |
| `openwearables_data.audit_log` | Schema yes (`006`) | **No writers in `src/`** | No |
| `provider_connections.last_sync_at` | Schema yes (`008:31`) | Not written by PPD sync paths found | No (OW API may expose its own) |
| Redis / Celery | In OW stack only | Not PPD agent bus | No |
| Outbound webhook / queue | — | — | **No** |
| Log line “Multi-user extraction completed” | Yes (`150`) | Logs | Fragile; not a contract |

**Verdict:** There is **no agent-grade completion signal**. Nightly batch would need a wall-clock guess after 00:00 UTC (plus buffer for sequential user runtime) **or** poll `last_sync_at` / metric freshness.

Webhook path is already **event-driven for Garmin data arrival**, but it only triggers internal OW→CH sync — it does **not** notify an external agent.

---

## 9. Legacy: `ppd_legacy_extraction_backend`

Brief contrast (`README.md`, `app/services/sync/scheduled_sync_service.py`):

- FastAPI Garmin webhook + Connect sync focused on **Supabase** tables: `garmin_connect_activities`, `garmin_connect_accounts`, `garmin_connect_sync_jobs`.
- Scheduled sync daily at `GARMIN_SYNC_HOUR/MINUTE` default **00:00 UTC** (`scheduled_sync_service.py:21–31`, `47`).
- Encryption via `GARMIN_ENCRYPTION_KEY`; webhook verification token.
- **Superseded** by `ppd_extraction_backend` + ClickHouse + OpenWearables for current production wearables path.

---

## 10. Recommended integration point for event-driven agents

### 10.1 Nightly batch (after full cohort sync)

**Emit once** at the end of `MultiUserScheduler.run_all_users_extraction` (after the summary log at lines `148–151`), and optionally at the end of `run_ow_sync_all_users` if the agent also depends on hourly freshness.

Preferred transport (pick one; order of preference):

1. **HTTP POST** to the multi-agent orchestrator (`POST /internal/events/ingestion.completed`) with shared secret — mirrors existing `ppc-api` cache invalidation pattern.
2. **ClickHouse row** in a new `openwearables_data.ingestion_runs` (or finally use `audit_log`) so agents can poll/CDC without coupling to PPD process uptime.
3. **Redis pub/sub** on the shared OW Redis — only if agents already share that network; document key namespace.

Do **not** rely on `schedule` wall clock alone.

### 10.2 Suggested payload

```json
{
  "event_type": "ingestion.batch.completed",
  "run_id": "uuid",
  "trigger": "midnight_scheduler | hourly_ow_sync | webhook | manual",
  "started_at": "2026-08-02T00:00:01Z",
  "finished_at": "2026-08-02T00:18:42Z",
  "timezone": "UTC",
  "success_count": 12,
  "failure_count": 1,
  "athletes": [
    {
      "user_id": "supabase-auth-uuid",
      "org_id": "academy-slug",
      "providers": ["garmin", "whoop"],
      "status": "success",
      "date_range": { "start": "2026-07-03", "end": "2026-08-02" },
      "databases_touched": ["openwearables_data", "wearables_data"],
      "metrics_hint": ["sleep", "workouts", "timeseries", "readiness"]
    }
  ]
}
```

### 10.3 Event-driven (near-real-time) agents

Hook **after** successful per-user sync in:

- `webhooks._auto_sync_after_webhook` / `_process_push_data` (Garmin)
- `OpenWearablesSyncService.sync_user` completion (`logger.info("Completed sync…")` at line `150`)
- `provider_data._sync_ow_to_clickhouse` after rows > 0

Payload subset: single athlete, `trigger: "webhook"|"api_sync"`, providers, `date_range` of the sync window, categories present in the webhook (activities, sleeps, stressDetails, …).

### 10.4 Interim (no code change yet)

1. Schedule AI nightly batch at **≥ 01:00–02:00 UTC** (buffer after 00:00 + sequential users). Treat as fragile.
2. Gate per athlete on freshness: e.g. ClickHouse `max(synced_at)` / `users.last_sync_at` within last N hours before generating insights.
3. For Garmin real-time: temporarily tolerate missing events; do not assume webhook ⇒ agent notification.

---

## 11. File index (primary)

| Path | Role |
|---|---|
| `PeakPerformanceData/ppd_extraction_backend/main.py` | CLI entry |
| `…/src/scheduler/multi_user_scheduler.py` | Production schedule + extract/sync |
| `…/src/garmin/scheduler/garmin_scheduler.py` | Legacy single-user schedule |
| `…/src/api/main.py` | FastAPI + embedded scheduler thread |
| `…/src/api/routes/webhooks.py` | Garmin webhook receivers |
| `…/src/api/routes/garmin_data.py` | Garmin OAuth BFF |
| `…/src/api/routes/provider_data.py` | Polar/Whoop/Suunto BFF |
| `…/src/openwearables/sync_service.py` | OW→ClickHouse orchestration |
| `…/src/openwearables/client.py` | OW HTTP client |
| `…/src/openwearables/health_data_processor.py` | Direct Garmin health → CH |
| `…/src/garmin/auth/garmin_auth.py` | Unofficial tokenstore auth |
| `…/src/users/user_manager.py` | Encrypted creds + `last_sync_at` |
| `…/src/users/supabase_client.py` | Org slug lookup only |
| `…/src/config/settings.py` | Env config |
| `…/docker/docker-compose.yml` | `ppd-api` + `ppd-scheduler` |
| `…/docker/traefik/dynamic/routes.yml` | Public routing / OW webhooks |
| `…/migrations/006_*.sql`, `008_*.sql`, `009_*.sql` | Audit / connections / users schemas |
| `…/memory_bank/open-wearables.md` | Architecture + provider matrix |
| `…/memory_bank/polar-whoop-integration-research.md` | Polar/Whoop gap analysis |
| `PeakPerformanceData/ppd_legacy_extraction_backend/` | Supabase-era Garmin sync (legacy) |

---

## 12. Gaps relevant to multi-agent design

1. **No completion event** → force time-offset or polling until emit is added.
2. **Dual scheduler** (API thread + `ppd-scheduler`) → duplicate work / race risk.
3. **`EXTRACTION_TIMEZONE` unused** → document/fix before relying on non-UTC hosts.
4. **Unused status tables** → either wire them or add `ingestion_runs`.
5. **Apple/Strava** not in PPD sync loop despite OW/Traefik surface.
6. **Duration unknown** → instrument `run_all_users_extraction` with wall-clock + per-user timing before hard-coding agent offsets.
