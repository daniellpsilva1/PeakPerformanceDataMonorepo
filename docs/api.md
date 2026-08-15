# API Reference

This document covers all backend API endpoints across the three services plus a comprehensive listing of the Next.js BFF route directories.

## Service URLs

| Service | Dev URL | Prod URL | Entry Point |
|---------|---------|----------|-------------|
| ppd_backend | `http://localhost:8000` | `https://api.wearablesync.app/ppc` | `PeakPerformanceData/ppd_backend/api/main.py` |
| ppd_extraction_backend | `http://localhost:8001` | `https://api.wearablesync.app` | `PeakPerformanceData/ppd_extraction_backend/src/api/main.py` |
| Next.js BFF | `http://localhost:3000` | `https://www.peakperformancedata.app` | `PeakPerformanceData/peak_performance_data/src/app/` |

## Authentication

### ppd_backend (`PeakPerformanceData/ppd_backend/api/middlewares/auth.py`)

Two auth paths:
1. **Internal service**: `x-internal-service` header matching `INTERNAL_SERVICE_SECRET` env var
2. **User session**: `Authorization: Bearer <token>` — Supabase JWT verified via `GET {SUPABASE_URL}/auth/v1/user`

Public paths (no auth): `/health`, `/`, `/docs`, `/openapi.json`, `/redoc`

### ppd_extraction_backend

No middleware-level auth. Routes validate via `x-user-id` header (Supabase user ID). Webhook endpoints validate Garmin-specific tokens/headers.

### Next.js BFF

`src/lib/api/with-auth.ts` — wraps route handlers with Supabase session validation. Cache profiles: user data 30s, admin data 60s. Returns 401 if no session.

---

## ppd_backend Endpoints

### Health

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/health` | None | Service health check |

**File**: `PeakPerformanceData/ppd_backend/api/main.py:130`

### Graphs

**Router prefix**: `/graphs` (included at `/graphs`)
**File**: `PeakPerformanceData/ppd_backend/api/routes/graphs.py`

| Method | Path | Auth | Query Params | Description |
|--------|------|------|--------------|-------------|
| GET | `/graphs/user-providers/{user_id}` | Required | — | Returns which wearable providers have data for user in ClickHouse |
| GET | `/graphs/available` | Required | — | Lists all available graph types by category |
| GET | `/graphs/preload-status/{user_id}` | Required | — | Checks which graphs are cached for a user |
| POST | `/graphs/preload/{user_id}` | Required | — | Preloads all graphs for a user into cache |
| GET | `/graphs/{user_id}/{graph_type}` | Required | `data_source`, `days_back`, `weeks_back`, `start_date`, `end_date` | Generates or returns cached graph for user |

**Graph types** (from `data_processing/graphs/`):
- **health_graphs** (17): VO2Max, HRV, RestingHR, SleepScore, Stress, BodyBattery, TrainingReadiness, etc.
- **pace_graphs** (4): PaceTrend, PaceZones, IntervalPace, ThresholdPace
- **training_graphs** (5): TrainingLoad, TrainingEffect, VO2MaxTrend, etc.
- **volume_graphs** (5): WeeklyVolume, MonthlyVolume, DistanceTrend, etc.
- **courses_graphs**: Course-specific analysis
- **custom_graphs**: User-defined
- **womens_health_graphs**: Menstrual cycle tracking

### Wearables

**Router prefix**: `/wearables` (included at `/wearables`)
**File**: `PeakPerformanceData/ppd_backend/api/routes/wearables.py`

| Method | Path | Auth | Query Params | Description |
|--------|------|------|--------------|-------------|
| GET | `/wearables/{user_id}/activities` | Required | `start_date`, `end_date`, `limit` (default 100, max 1000) | Returns raw wearable activity data from ClickHouse for AI agent tools |

**Response fields**: `activity_id`, `date`, `activity_type`, `distance_m`, `duration_s`, `avg_hr`, `max_hr`, `calories`, `steps`, `avg_pace`, `avg_speed`

### Weekly KM Pace

**Router prefix**: `/weekly-km-pace` (included at `/weekly-km-pace`)
**File**: `PeakPerformanceData/ppd_backend/api/routes/weekly_km_pace.py`

| Method | Path | Auth | Query Params | Description |
|--------|------|------|--------------|-------------|
| GET | `/weekly-km-pace/` | Required | `user_id` (required), `months_range` (default 2), `limit` (1-500, default 50), `offset` (default 0), `activity_type` (default "Run"), `retrieve_all` (default false), `cursor`, `splits_page` (default 1), `splits_page_size` (1-500, default 100), `sampling_method` ("recent"/"even"/"random") | Weekly kilometer pace analysis with splits and weekly averages |

---

## ppd_extraction_backend Endpoints

### Health

**File**: `PeakPerformanceData/ppd_extraction_backend/src/api/routes/health.py`

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/health` | None | Service health + feature flags |
| GET | `/ready` | None | Readiness check |

### Garmin Connect

**Router prefix**: `/api/v1/garmin-connect`
**File**: `PeakPerformanceData/ppd_extraction_backend/src/api/routes/garmin_data.py`

| Method | Path | Headers | Query Params | Description |
|--------|------|---------|--------------|-------------|
| GET | `/api/v1/garmin-connect/oauth/authorize` | `x-user-id` | `callback_url` | Returns Garmin OAuth authorization URL |
| GET | `/api/v1/garmin-connect/oauth/callback` | — | OAuth params | Handles OAuth callback, auto-registers user, triggers background sync |
| GET | `/api/v1/garmin-connect/account/status` | `x-user-id` | — | Returns Garmin connection status (connected/disconnected, sync info) |
| POST | `/api/v1/garmin-connect/disconnect` | `x-user-id` | — | Disconnects Garmin account |
| POST | `/api/v1/garmin-connect/sync` | `x-user-id` | `days` (default 30) | Triggers manual Garmin data sync |
| GET | `/api/v1/garmin-connect/data/summary` | `x-user-id` | `days` (default 7) | Returns summary of synced Garmin data |
| GET | `/api/v1/garmin-connect/export` | `x-user-id` | `format` | Exports user's Garmin data |
| POST | `/api/v1/garmin-connect/legacy-credentials` | `x-user-id` | Body: `garmin_email`, `garmin_password` | Legacy credential-based connection (pre-OAuth) |

### Provider Data (Polar, Whoop, Suunto)

**Router prefix**: `/api/v1/providers`
**File**: `PeakPerformanceData/ppd_extraction_backend/src/api/routes/provider_data.py`

| Method | Path | Headers | Query Params | Description |
|--------|------|---------|--------------|-------------|
| GET | `/api/v1/providers/{provider}/oauth/authorize` | `x-user-id` | `callback_url` | Returns OAuth URL for provider |
| GET | `/api/v1/providers/{provider}/oauth/callback` | `x-user-id` | OAuth params | Handles OAuth callback, triggers background sync |
| GET | `/api/v1/providers/{provider}/account/status` | `x-user-id` | — | Returns provider connection status |
| POST | `/api/v1/providers/{provider}/disconnect` | `x-user-id` | — | Disconnects provider |
| POST | `/api/v1/providers/{provider}/sync` | `x-user-id` | `days` (default 30) | Triggers manual provider data sync |
| GET | `/api/v1/providers/{provider}/data/summary` | `x-user-id` | `days` (default 7) | Returns summary of synced provider data |

**Supported providers**: `polar`, `whoop`, `suunto`

### Webhooks

**Router prefix**: `/webhooks/garmin`
**File**: `PeakPerformanceData/ppd_extraction_backend/src/api/routes/webhooks.py`

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/webhooks/garmin/ping` | Garmin verification token | Garmin PING webhook — fetches data from callback URLs, forwards to OpenWearables |
| POST | `/webhooks/garmin/push` | Garmin signature | Garmin PUSH webhook — receives data directly, forwards to OpenWearables |
| GET | `/webhooks/garmin/deregister` | Garmin verification token | Handles user deregistration |

### Garmin Compatibility Router

**File**: `PeakPerformanceData/ppd_extraction_backend/src/api/routes/garmin_compat_router.py`

| Method | Path | Description |
|--------|------|-------------|
| * | `/garmin/*` | Forwards Garmin webhook endpoints to OpenWearables API |

### OpenWearables Sync Service (Internal)

The OW sync service is not exposed via HTTP routes — it runs internally via the scheduler and CLI. The following documents its internal API surface for reference.

**OpenWearablesSyncService** (`src/openwearables/sync_service.py`):

| Method | Parameters | Description |
|--------|-----------|-------------|
| `sync_user()` | `days`, `end_date_override`, `ow_user_id`, `provider`, `skip_optimize`, `skip_provider_sync`, `skip_wait`, `start_date_override`, `sync_sleep`, `sync_summaries`, `sync_timeseries`, `sync_workouts`, `tenant: TenantContext` | Full sync for a user from a provider. Triggers provider sync, polls for completion (Garmin), concurrently fetches and ingests all data streams, optionally optimizes tables. |
| `_sync_activity_summaries()` | `tenant`, `ow_user_id`, `start_date`, `end_date`, `provider` | Paginated fetch + transform + insert of daily activity summaries |
| `_sync_workouts()` | `tenant`, `ow_user_id`, `start_date`, `end_date`, `provider` | Fetch + deduplicate by `provider_workout_id` + insert workouts |
| `_sync_sleep_sessions()` | `tenant`, `ow_user_id`, `start_date`, `end_date`, `provider` | Fetch + transform + insert detailed sleep sessions |
| `_sync_sleep_summaries()` | `tenant`, `ow_user_id`, `start_date`, `end_date`, `provider` | Fetch + transform + insert daily sleep summaries |
| `_sync_timeseries()` | `tenant`, `ow_user_id`, `start_date`, `end_date`, `provider` | Fetch + transform + insert raw timeseries (HR, stress, steps, etc.) |
| `_sync_body_summary()` | `tenant`, `ow_user_id`, `start_date`, `end_date`, `provider` | Fetch + transform + insert daily body summary |
| `_wait_for_sync()` | `ow_user_id`, `provider`, `timeout` | Polls OW API for provider sync completion (Garmin only) |

**Multi-user scheduler** (`src/scheduler/multi_user_scheduler.py`):

| Method | Description |
|--------|-------------|
| `run_ow_sync_all_users()` | Iterates all active users and runs OW sync with 7-day window |
| `_run_ow_sync(user_id, days=7)` | Resolves OW user context, constructs `TenantContext`, calls `sync_user()` per active provider |
| `run_ow_backfill_chunked(user_id, start_date, end_date)` | Splits backfill into 90-day chunks, calls `sync_user()` with date overrides per chunk |
| `_resolve_ow_user_context(ow_client, user_id)` | Maps Supabase user ID → OW user ID + list of active providers |

**CLI commands for OW sync** (in addition to the general CLI):

| Command | Description |
|---------|-------------|
| `python main.py run-scheduler` | Starts scheduler loop (includes hourly OW sync) |
| `python main.py ow-sync-all` | Run OW sync for all active users (one-shot) |
| `python main.py ow-sync-user --user-id <id>` | Run OW sync for a specific user |
| `python main.py ow-backfill --user-id <id> --start <date> --end <date>` | Chunked historical backfill |

---

## Next.js BFF Key Routes (Selected)

**Auth wrapper**: `src/lib/api/with-auth.ts` — all routes require valid Supabase session unless noted.

### AI Agent

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/api/ai-agent` | Session | AI chat with DeepSeek/Groq, 50+ tools, conversation memory |

**File**: `PeakPerformanceData/peak_performance_data/src/app/api/ai-agent/route.ts`

### Dashboard

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/dashboard/coach/init` | Session (coach) | Coach dashboard initialization data |
| GET | `/api/dashboard/player/init` | Session (player) | Player dashboard initialization data |
| GET | `/api/dashboard/parent/init` | Session (parent) | Parent dashboard initialization data |
| GET | `/api/dashboard/admin/init` | Session (admin) | Admin dashboard initialization data |
| GET | `/api/dashboard/coach/athletes-matrix` | Session (coach) | Coach athletes matrix with risk scores |

### Garmin Connect (Proxy to extraction backend)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/garmin-connect/status` | Session | Proxies to extraction backend account status |
| POST | `/api/garmin-connect/sync` | Session | Proxies to extraction backend sync trigger |
| POST | `/api/garmin-connect/disconnect` | Session | Proxies to extraction backend disconnect |
| GET | `/api/garmin-connect/data/summary` | Session | Proxies to extraction backend data summary |

### Tennis

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET/POST | `/api/tennis/matches` | Session | List/create tennis matches |
| GET/PUT/DELETE | `/api/tennis/matches/{id}` | Session | Match CRUD |
| POST | `/api/tennis/matches/{id}/score` | Session | Update match score |
| GET | `/api/tennis/matches/{id}/detail` | Session | Full match detail with sets/games/points |

### PPC Proxy

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| * | `/api/ppc-proxy/*` | Session | Proxies requests to ppd_backend to avoid CORS |

**File**: `PeakPerformanceData/peak_performance_data/src/lib/api/ppc-client.ts`

### Authentication & Invitations

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/api/invitations/{id}/accept` | Session | Accept org invitation (existing users). Validates invitation status, expiration, email match. Updates profile with org ID + role, marks invitation accepted, links parent-child if applicable. |
| POST | `/api/invitations/{id}/setup-password` | None | Set password + accept invitation (new users). Validates password (min 8 chars), creates/finds auth user via `ensureInvitationAccount()`, updates profile + metadata, marks invitation accepted, signs in user. |

**Files**:
- `PeakPerformanceData/peak_performance_data/src/app/api/invitations/[id]/accept/route.ts`
- `PeakPerformanceData/peak_performance_data/src/app/api/invitations/[id]/setup-password/route.ts`

**Server action** (not an HTTP route):
- `signUp(formData)` — `PeakPerformanceData/peak_performance_data/src/lib/auth/auth.ts` — Handles user registration with captcha verification, role validation, age gating, consent checking, org creation (personal or club admin), user creation via admin client, profile creation, consent event recording, UTM tracking, and async confirmation email.

**Auth wrappers** (`src/lib/api/with-auth.ts`):

| Wrapper | Role Check | Cache |
|---------|-----------|-------|
| `withAuth` | Any authenticated user | 30s |
| `withAdminAuth` | `club_admin` (DB profile lookup) | 60s |
| `withCoachAuth` | `coach` or `club_admin` | 30s |
| `withOrgMemberAuth` | Org membership verified | 30s |
| `withAuthAndProfile` | Authenticated + profile injected | 30s |

### Complete BFF Route Directory

All 65+ route directories under `src/app/api/`:

| Directory | Items | Purpose |
|-----------|-------|---------|
| `achievements/` | 2 | Achievement definitions and player achievements |
| `action-items/` | 1 | Action item management |
| `admin/` | 10 | Admin operations (logs, feedback, tennis-bench) |
| `ai-agent/` | 11 | AI chat agent with conversation memory |
| `alerts/` | 4 | Alert definitions and triggered alerts |
| `athletes/` | 10 | Athlete management and queries |
| `auth/` | 7 | Auth operations (create-member-request, create-coach-request, etc.) |
| `claim-account/` | 1 | Account claiming for minor/invited users |
| `coach/` | 2 | Coach-specific operations |
| `coaches/` | 3 | Coach management |
| `competitions/` | 1 | Competition results |
| `conversations/` | 8 | AI conversation history and management |
| `court-plan/` | 4 | Court coordination and planning |
| `courts/` | 3 | Court management |
| `cron/` | 2 | Cron job endpoints (garmin sync, data processing) |
| `dashboard/` | 22 | Dashboard init for all roles + athletes matrix + sub-dashboards |
| `download/` | 1 | Data export/download |
| `feedback/` | 3 | User feedback submission and history |
| `garmin-connect/` | 13 | Garmin Connect proxy (OAuth, sync, status, disconnect, data) |
| `hiit-trainings/` | 1 | HIIT training records |
| `injuries/` | 1 | Injury tracking |
| `invitation-requests/` | 1 | Invitation request management |
| `invitations/` | 3 | Invitation accept, setup-password, list |
| `management/` | 1 | Management dashboard operations |
| `manifest/` | 1 | PWA manifest |
| `messages/` | 2 | Messaging between users |
| `notifications/` | 2 | Push notification management |
| `observations/` | 2 | Coach observations |
| `organizations/` | 14 | Organization CRUD, branding, members, invitations |
| `parent/` | 7 | Parent-specific operations (children, progress) |
| `parent-child-relationships/` | 4 | Parent-child linking |
| `parents/` | 1 | Parent management |
| `performance-tests/` | 3 | Physical performance tests |
| `personal-tournaments/` | 2 | Personal tournament records |
| `personal-trainings/` | 2 | Personal training records |
| `player-groups/` | 3 | Player group management |
| `players/` | 3 | Player queries |
| `ppc-proxy/` | 1 | Proxy to ppd_backend (avoids CORS) |
| `providers/` | 5 | Generic provider management (Polar, Whoop, Suunto) |
| `pwa-icon/` | 1 | PWA icon generation |
| `reports/` | 5 | Report generation and export |
| `series-training-sessions/` | 1 | Series training sessions |
| `shock-microcycles/` | 1 | Shock microcycle training |
| `splash/` | 1 | Splash screen data |
| `stripe/` | 3 | Stripe webhook and billing endpoints |
| `tennis/` | 21 | Tennis match CRUD, scorekeeper, SwingVision import, stats |
| `tennis-bench/` | 4 | Tennis bench tests, posts, social sharing |
| `tournaments/` | 5 | Tournament management |
| `training-plans/` | 2 | Training plan management |
| `training-sessions/` | 3 | Training session management |
| `transcribe/` | 1 | Audio transcription |
| `transitions/` | 1 | Transition data |
| `upload/` | 2 | File upload endpoints |
| `user/` | 7 | User profile, settings, context |
| `vision-proxy/` | 1 | Proxy for vision/video analysis |
| `watch/` | 3 | Live match watch links and social OG |

---

## Rate Limiting

### ppd_backend (`api/middlewares/rate_limit.py`)

| Identity | Limit | Window |
|----------|-------|--------|
| Authenticated user | 60 req | 60s |
| Internal service | 120 req | 60s |
| Unauthenticated IP | 60 req | 60s |

Public paths exempt: `/health`, `/`, `/docs`, `/openapi.json`, `/redoc`

### AI Agent (`src/lib/ai/agentConfig.ts`)

| Scope | Limit |
|-------|-------|
| Standard user | 50 req/hour |
| Personal account | 20 req/hour |

### Supabase DB-backed (`check_and_increment_rate_limit` RPC)

Used by the AI agent for persistent, multi-worker rate limiting. The RPC is a SECURITY DEFINER function that atomically checks and increments a counter in the `rate_limits` table.

## Internal Service APIs

### Graph Factory (`data_processing/factories/graph_factory.py`)

| Method | Parameters | Description |
|--------|-----------|-------------|
| `create_graph(graph_type, user_id, **kwargs)` | `graph_type`, `user_id`, `weeks_back`, `days_back` | Creates and executes a graph generator, returns dict with figure, data, layout, config, metadata |
| `list_available_graphs()` | — | Returns categorized graph types with display names |
| `data_processor` (property) | — | Lazily initializes `GraphDataProcessor` on first access |

### Graph Registry (`data_processing/base/graph_registry.py`)

| Method | Parameters | Description |
|--------|-----------|-------------|
| `register(graph_class)` | `graph_class` | Registers a graph generator class by instantiating with `None` to get `graph_type` |
| `get_generator(graph_type, data_processor)` | `graph_type`, `data_processor` | Returns generator instance for the given graph type |
| `is_registered(graph_type)` | `graph_type` | Checks if a graph type is registered |
| `list_available_graphs()` | — | Returns list of `{graph_type, display_name, category}` |
| `_ensure_discovered()` | — | Thread-safe lazy auto-discovery of graph generators from `graphs/` directory |
| `_auto_discover_graphs()` | — | Imports all modules in `graphs/` subdirectories, triggers registration |

### Graph Data Processor (`data_processing/base/graph_data_processor.py`)

| Method | Parameters | Description |
|--------|-----------|-------------|
| `load_activity_data(user_id, days_back, ...)` | `user_id`, `days_back=90` | Loads activity data from ClickHouse with 30s cache |
| `load_activity_summaries(user_id, days_back, ...)` | `user_id`, `days_back=90` | Loads daily activity summaries from ClickHouse |
| `load_sleep_summaries(user_id, days_back, ...)` | `user_id`, `days_back=90` | Loads sleep summaries from ClickHouse |
| `load_hrv_from_garmin_table(user_id, days_back, ...)` | `user_id`, `days_back=90` | Loads HRV data from Garmin table |
| `load_timeseries_data(user_id, metric, days_back, ...)` | `user_id`, `metric`, `days_back` | Loads timeseries data for a specific metric |

**Query cache** (`_QueryCache`): Thread-safe single-flight semantics. When a query is in progress, concurrent requests for the same key block until the producer completes. TTL: 30 seconds. Key format: `{user_id}:{query_type}:{params_hash}`.

## CLI Commands (Extraction Backend)

**File**: `PeakPerformanceData/ppd_extraction_backend/main.py`

| Command | Description |
|---------|-------------|
| `python main.py run-scheduler` | Start multi-user extraction scheduler |
| `python main.py extract-all` | Extract data for all active users |
| `python main.py extract-user --user-id <id>` | Extract data for specific user |
| `python main.py add-user --email ... --garmin-email ...` | Add user with Garmin credentials |
| `python main.py list-users` | List all registered users |
| `python main.py disable-user --user-id <id>` | Disable a user |
| `python main.py test-connections` | Test all external service connections |
| `python main.py status` | Show system status report |
| `python main.py optimize` | Run ClickHouse optimization |
| `python main.py rebuild-rollups` | Rebuild daily rollup tables |
| `python main.py validate` | Validate data integrity |
| `python main.py migrate` | Run ClickHouse migrations |
