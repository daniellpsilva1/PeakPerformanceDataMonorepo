# Architecture

## System Overview

Peak Performance Data (PPD) is a multi-tenant sports performance platform for tennis academies and coaches. It integrates wearable data (Garmin, Polar, Whoop, Suunto), provides AI-assisted coaching, tennis match tracking with a live scorekeeper, physical test analytics, and multi-brand white-label support.

The monorepo at `/Users/danielsilva/Desktop/PeakPerformanceDataMonorepo` contains four top-level areas:

```
PeakPerformanceDataMonorepo/
├── PeakPerformanceData/           # Main application (3 sub-projects)
│   ├── peak_performance_data/     # Next.js frontend (Vercel)
│   ├── ppd_backend/               # FastAPI graph/data processing (Render)
│   └── ppd_extraction_backend/    # FastAPI wearable data extraction (Docker/Hetzner)
├── PeakPerformanceDataMarketing/  # Marketing & visualization assets
│   ├── Remotion/                  # React-based marketing video
│   ├── Manim/                     # Python tennis match visualization
│   ├── ThreeJS/                   # Athlete digital twin (TypeScript)
│   └── courtviz/                  # Tennis court visualization (TypeScript, vendored)
└── _plans/                        # Planning documents
```

## Module Map

### 1. Next.js Frontend (`PeakPerformanceData/peak_performance_data/`)

**Entry point**: `src/app/[locale]/layout.tsx` — root layout with providers (AuthProvider, BrandProvider, ThemeProvider, UserContextProvider).

**Tech stack**: Next.js 15.2.6 (App Router), React 19, TypeScript, TailwindCSS 3.4, SWR for data fetching, Radix UI primitives, Recharts for charts.

**Key directories**:

| Directory | Purpose |
|-----------|---------|
| `src/app/[locale]/` | Locale-prefixed pages (en, es, zh, ca) with role-based routing |
| `src/app/api/` | ~80 API route handlers (BFF pattern) |
| `src/components/` | 477 items — UI components, charts, tennis scorekeeper, wearable panels |
| `src/lib/ai/` | AI agent: config, prompts, 32 tool files, 7 utility files |
| `src/lib/auth/` | Supabase auth: signUp, signIn, invitation accounts, login prefetch |
| `src/lib/api/` | Backend clients: `ppc-client.ts` (graph backend), `wearablesync-client.ts` (extraction backend) |
| `src/lib/supabase/` | Supabase clients, database types (4373 lines), queries |
| `src/lib/tennis/` | Tennis scorekeeper engine, match detail, progress metrics |
| `src/lib/calculations/` | Benchmarks, injury risk, readiness, training load |
| `src/lib/dashboard/` | Dashboard init functions (coach, player, parent) |
| `src/lib/communication/` | Email, WhatsApp, feedback notifications |
| `src/middleware.ts` | Request pipeline: i18n → CORS → brand+auth (parallel) → authorization |
| `src/config/brands/` | Multi-brand configuration (colors, logos, features) |
| `src/services/` | Brand service, domain resolution with in-memory cache |
| `supabase/migrations/` | 75 SQL migrations |
| `vendor/courtviz/` | Vendored tennis court visualization package |
| `tests/` | 94 items — Vitest + Testing Library + MSW |

**Role system**: 4 roles — `player`, `coach`, `parent`, `club_admin`. Each role has dedicated pages and API routes. Middleware enforces authorization based on profile data from Supabase.

**AI Agent** (`src/app/api/ai-agent/route.ts`):
- Edge runtime, 30s max duration
- Primary model: DeepSeek (`deepseek-chat`); Fallback: Groq Llama 3.3 70B
- 50+ tools across 8 categories (athletes, training, competition, analytics, communication, specialized_training, admin, core)
- Intent classification via keyword matching in `toolRouter.ts`
- Conversation memory + semantic memory extraction
- Rate limiting: 50 req/hour (20 for personal accounts)

**Data fetching**: SWR with network-aware overrides (fast/slow/offline), per-user sessionStorage cache persistence, debounced writes.

**PWA**: `next-pwa` with custom service worker, runtime caching strategies, push notification support.

#### Middleware Pipeline

**File**: `src/middleware.ts` (251 lines) — orchestrates all middleware in a specific order:

1. **i18n** (`src/middleware/intl.ts`) — next-intl locale redirect/handling for 4 locales (en, es, zh, ca)
2. **CORS** (`src/middleware/cors.ts`) — handles OPTIONS preflight and sets CORS headers
3. **Social crawler detection** — Rewrites `/watch/{token}` and `/tennis-bench/{slug}` paths to social OG endpoints for crawler user agents (Facebook, WhatsApp, Twitter, LinkedIn, Slack, Telegram, Discord, Pinterest)
4. **Static file early return** — Skips `_next`, `_vercel`, `api/`, files with dots, favicon
5. **Brand + Auth (parallelized)** — `handleBrand()` and `supabase.auth.getSession()` run concurrently via `Promise.all()` to save ~200ms on cold starts
6. **Session validation** — `getUser()` called in parallel with `handleAuth()` only if session validation cookie (`ppd-session-validated`) is stale (30-min TTL). Skips redundant GoTrue round-trip for in-session navigation.
7. **Authorization** (`src/middleware/authorization.ts`) — Role-based path gating using DB profile role (not client-writable `user_metadata.role`). Personal-mode users blocked from org-only routes.

**Route classification** (`src/middleware/routes.ts`):
- **Protected**: `/admin`, `/charts`, `/club-admin`, `/coach`, `/feedback`, `/genetics`, `/history`, `/labs`, `/management`, `/messages`, `/overview`, `/parent`, `/performance-tests`, `/player`, `/profile`, `/settings`, `/tennis-scorekeeper`
- **Auth-only**: `/login`, `/signup` (redirect to dashboard if already authenticated)
- **Public**: `/`, `/accept-invitation`, `/claim-account`, `/confirm-email`, `/forgot-password`, `/privacy-policy`, `/reset-password`, `/tennis-bench`, `/watch`

**Profile cache** (`src/middleware/auth.ts`): Map-based LRU cache (500 entries, 30-min TTL) for profile data (role, orgId, orgName, isOrgAdmin, isPersonal). Cache invalidation via `x-invalidate-profile-cache` header or `ppd-inv-cache` cookie.

#### Multi-Brand White-Label System

**BrandConfig interface** (`src/config/brands/types.ts`):

Defines brand identity with colors (primary, secondary, accent, optional background), assets (logo URLs, favicon, icon settings), and feature flags (ai, charts, genetics, labs, messaging, videoAnalysis, wearables, monthly quotas, historyDepthDays, athleteSeats, advancedMetrics, export, tier).

**Brand resolution pipeline**:
1. **Middleware** (`src/middleware/brand.ts`) — Resolves brand by domain on every request. In-memory LRU cache (5-min TTL). Known dev/preview domains short-circuit to default brand. For production domains, queries Supabase `organizations` table by domain using service role key. Merges org brand colors with defaults. Sets brand info in response headers (`x-middleware-brand-id`, `x-middleware-brand-config`).
2. **Layout** (`src/app/[locale]/layout.tsx`) — Retrieves brand config from middleware headers. Falls back to DB query if headers missing. Caches brand config per request to avoid duplicate queries.
3. **Brand service** (`src/services/brand-service.ts`) — Domain-based brand lookup with caching and concurrency deduplication. Merges partial DB brand colors with defaults. Returns `BrandConfig` or default brand for known domains.
4. **Default brand** (`src/config/brands/default.ts`) — Fallback brand config with default colors and all features enabled.

**Organization brand lookup** is public via a SECURITY DEFINER function (migration `20260815_organizations_brand_lookup_public.sql`) that exposes only `slug`, `domain`, `brand_colors`, `logo_url`, `name` for brand resolution without authentication.

#### Dashboard Data Loading Architecture

The frontend uses an SSR seeding pattern: server components fetch initial data and pass it as `fallbackData` to client-side SWR hooks. This eliminates loading spinners on first paint while keeping data fresh via SWR revalidation.

**Coach dashboard** (`src/lib/dashboard/coach-init.ts`):
- `fetchCoachDashboardInit()` — Concurrent fetch of: profile, coach-player assignments, pending coach/member requests (org-scoped), coach observations (limit 100). Enriches requests with user profiles. Fetches readiness matrix concurrently.
- **Athletes matrix** (`src/lib/dashboard/coach-athletes-matrix.ts`) — Builds readiness + injury risk matrix. Fetches readiness snapshots with timeout budget. Merges batch RPC data with wearable snapshots.
- **Matrix fetch** (`src/lib/dashboard/coach-matrix-fetch.ts`) — Fetches coach athlete assignments, calls batch RPC for readiness data, enriches with profiles.

**Player dashboard** (`src/lib/dashboard/player-init.ts`):
- `fetchPlayerDashboardInit()` — Concurrent fetch of: player dashboard RPC, training data, readiness snapshot (with timeout), tennis tests. Transforms raw data into structured overview, calendar, readiness, and tennis tests data. Returns `partial: true` flag if readiness timed out.
- **Readiness snapshot** (`src/lib/dashboard/readiness-snapshot.ts`) — Fetches and processes readiness data. Extracts latest numeric values from graph data. Derives fallback readiness scores from various health metrics (HRV, sleep, stress, body battery).

**Timeout pattern**: Readiness snapshot fetch uses `Promise.race()` with a budget (typically 3-5s) to avoid blocking UI. If it times out, the dashboard renders with partial data and the client fetches readiness asynchronously.

#### Performance Optimization

**Bundle budgets** (all passing, enforced by `scripts/check-bundle-budgets.js`):

| Route | First Load JS | Budget | Headroom |
|-------|--------------|--------|----------|
| /[locale]/player | 266 KB | 350 KB | 84 KB |
| /[locale]/coach | 115 KB | 350 KB | 235 KB |
| /[locale]/parent | 115 KB | 300 KB | 185 KB |
| /[locale]/charts | 239 KB | 400 KB | 161 KB |
| /[locale]/management | 147 KB | 350 KB | 203 KB |
| /[locale]/coach/tennis-analytics | 272 KB | 450 KB | 178 KB |

Shared by all: 105 KB. Verification: `ANALYZE=true pnpm build` + `node scripts/check-bundle-budgets.js`.

**Optimization phases completed**:
- Phase 2: 58 files migrated to locale-aware routing
- Phase 3: ISR, scorekeeper payload optimization, training SSR cap, skeleton loading
- Phase 4: next/image conversions, landing transition fixes
- Phase 5: `select('*')` replaced with explicit column selects in API routes
- Phase 6: courtviz sideEffects added
- Phase 7: Lists virtualized, providers stabilized
- Phase 8: Landing page smoothness improvements
- Phase 9: All routes verified within budget

#### Supabase Authentication & signUp Flow

The frontend uses Supabase Auth with a 4-layer role system (`player`, `coach`, `parent`, `club_admin`). Registration and invitation acceptance are handled through server actions and API routes.

**signupSchema** (`src/lib/auth/signup-schema.ts`):

Zod schema validates: email (valid format), password (min 8 chars), name (min 2 chars), role (enum), consentGranted (must be true), dateOfBirth (optional), phoneNumber (optional), organizationId/organizationName (optional), isBrandedSite (optional), turnstileToken (optional), preferredLanguage (optional). Also exports `MIN_SIGNUP_AGE` and `calculateAge()` for age gating.

**signUp server action** (`src/lib/auth/auth.ts`):

1. **Form data extraction** — Reads email, password, name, role, organizationId, organizationName, parentEmail, dateOfBirth, phoneNumber, consentGranted, consentPolicyVersion, isBrandedSite, turnstileToken, UTM params (firstTouchUtm, lastTouchUtm), signupSource from `FormData`.
2. **Captcha verification** — Validates Cloudflare Turnstile token via siteverify API.
3. **Role validation** — Ensures role is one of the 4 allowed values.
4. **Age gating** — If `dateOfBirth` provided and role is `player`, checks `calculateAge() >= MIN_SIGNUP_AGE`. Returns error if too young.
5. **Consent check** — Verifies `consentGranted === true`.
6. **Organization creation**:
   - **club_admin**: Creates a new organization record in Supabase with the provided `organizationName`.
   - **Other roles**: Creates a personal organization via a SECURITY DEFINER RPC (`create_personal_organization`).
   - **Branded site**: If `isBrandedSite` and `organizationId` provided, skips org creation and joins the existing org.
7. **User creation** — Uses Supabase admin client (`createUser` without `email_confirm` option initially) to create the auth user. This bypasses the public signup rate limits.
8. **Profile creation** — Inserts a row into the `profiles` table with user ID, organization ID, role, name, phone, date of birth, preferred language.
9. **User metadata update** — Updates `user_metadata` with `organization_id` for RLS policy access.
10. **Consent event recording** — Inserts a record into `consent_events` table with policy version, IP, user agent.
11. **UTM tracking** — Stores first/last touch UTM params and signup source in the profile.
12. **Confirmation email** — Sends Supabase confirmation email asynchronously (non-blocking).
13. **Post-signup actions** — Seeds sample tennis matches for players; creates member requests for branded site signups.

**Signup page** (`src/app/[locale]/signup/page.tsx`):

Client component using `react-hook-form` with `zodResolver(signupSchema)`. Features:
- Fetches public organizations for org selection (non-branded sites)
- Turnstile captcha widget
- Conditional fields based on role (e.g. parentEmail for parent role, organizationName for club_admin)
- UTM param capture from URL search params
- On success, redirects to `/login`

**Invitation acceptance** (`src/app/api/invitations/[id]/accept/route.ts`):

For users who already have an account:
1. Verifies Supabase session via `getRouteUserFast()`
2. Fetches invitation by ID — checks status (must be `pending`) and expiration
3. Validates invitee email matches authenticated user email
4. Updates user profile with organization ID and role from invitation
5. Marks invitation as `accepted`
6. If inviter is a player and invitee is a parent, links parent to player

**Invitation setup-password** (`src/app/api/invitations/[id]/setup-password/route.ts`):

For invited users without an account:
1. Validates password (min 8 chars) and preferred language
2. Fetches invitation — checks status and expiration
3. Calls `ensureInvitationAccount()` to find or create Supabase auth user
4. Updates user metadata and profile with org ID, role, language
5. Handles placeholder profile upgrades (fills in name/phone if placeholder)
6. Marks invitation as `accepted`
7. Links parent-child relationships if applicable
8. Signs in the user and returns session tokens or manual sign-in instructions

**ensureInvitationAccount** (`src/lib/auth/invitationAccounts.ts`):

Utility that either finds an existing auth user by email (`findAuthUserByEmail`) or creates a new one via admin client. Ensures profile and metadata are set correctly for the invited role and organization.

**with-auth wrapper** (`src/lib/api/with-auth.ts`):

Higher-order functions that wrap API route handlers with authentication and authorization:

| Wrapper | Access Control |
|---------|---------------|
| `withAuth` | Any authenticated user (valid Supabase session) |
| `withAdminAuth` | `club_admin` role only (verified via DB profile lookup) |
| `withCoachAuth` | `coach` or `club_admin` role |
| `withOrgMemberAuth` | Any org member (verifies org membership) |
| `withAuthAndProfile` | Authenticated + profile data injected |

All wrappers:
1. Create a route-level Supabase client
2. Extract the authenticated user from the session
3. Return 401 if no session
4. For role-based wrappers, fetch the user's `profiles` row from Supabase to verify role
5. Inject `{ user, supabase, profile? }` into the handler
6. Apply cache headers to the response (user data 30s, admin data 60s)

### 2. Graph/Data Processing Backend (`PeakPerformanceData/ppd_backend/`)

**Entry point**: `api/main.py` → FastAPI app on port 8000.

**Tech stack**: FastAPI 0.111, uvicorn, gunicorn (2 workers), pandas, numpy, plotly, clickhouse-connect, supabase-py, boto3 (S3), redis.

**Key modules**:

| Module | Purpose |
|--------|---------|
| `api/main.py` | App setup, middleware chain, background scheduler startup |
| `api/routes/graphs.py` | 916 lines — graph generation, caching, preload, user providers |
| `api/routes/wearables.py` | ClickHouse workout queries for AI agent |
| `api/routes/weekly_km_pace.py` | Weekly pace analysis with pagination |
| `api/middlewares/auth.py` | Internal service secret or Supabase JWT verification |
| `api/middlewares/rate_limit.py` | In-memory sliding window: 60 req/min user, 120 internal |
| `data_processing/factories/graph_factory.py` | Lazy graph processor init, registry-based discovery |
| `data_processing/base/graph_registry.py` | Auto-discovery, lazy loading, thread-safe |
| `data_processing/base/graph_data_processor.py` | 1092 lines — QueryCache with single-flight, ClickHouse + Supabase |
| `data_processing/graphs/` | 7 categories: health (17), pace (4), training (5), volume (5), courses, custom, womens_health |
| `data_processing/graphs/graph_theme.py` | Plotly theme with brand colors |
| `background_jobs/scheduler.py` | Daily graph generation at 01:00 UTC + prewarm |
| `background_jobs/daily_graph_generator.py` | Multi-period generation + Airtable upload |
| `background_jobs/graph_prewarm.py` | Priority graph prewarming for active users |
| `utils/external_services/` | AirtableUploader (Plotly→PNG→S3→Airtable), S3Uploader |
| `utils/core/caching.py` | LRUCache with TTL, graph_cache, activity_cache, polyline_cache |
| `config/database.py` | ClickHouse + Supabase client pools, circuit breaker |

**Deployment**: Docker on Render. `render.yaml` configures web service with health check at `/health`.

**Cold start optimization**: Pervasive lazy imports — pandas, numpy, plotly, boto3 all deferred to first use. Background thread warms graph registry after startup.

### 3. Extraction Backend (`PeakPerformanceData/ppd_extraction_backend/`)

**Entry point**: `src/api/main.py` → FastAPI app on port 8080. CLI entry: `main.py` (Typer).

**Tech stack**: FastAPI, uvicorn, python-garminconnect (GitHub), garth (OAuth), clickhouse-driver, httpx, tenacity, loguru, typer, cryptography (Fernet).

**Key modules**:

| Module | Purpose |
|--------|---------|
| `src/api/main.py` | App setup, lifespan (ClickHouse + OW client init, scheduler thread) |
| `src/api/routes/garmin_data.py` | 1059 lines — OAuth, account status, sync trigger, data summary, export, legacy creds |
| `src/api/routes/provider_data.py` | 543 lines — Generic provider routes (Polar, Whoop, Suunto) |
| `src/api/routes/webhooks.py` | 565 lines — Garmin PING/PUSH webhook handlers, background processing |
| `src/api/routes/health.py` | Health + readiness checks |
| `src/api/routes/garmin_compat_router.py` | OW-compatible Garmin webhook forwarding |
| `src/config/settings.py` | Pydantic settings (Garmin, OW, ClickHouse, Supabase, encryption) |
| `src/garmin/auth/garmin_auth.py` | OAuth with python-garminconnect, token persistence, tenacity retry |
| `src/garmin/extractors/` | 48 items — base_extractor with retry, rate limiting, validation |
| `src/scheduler/multi_user_scheduler.py` | Daily Garmin extraction + hourly OpenWearables sync |
| `src/openwearables/client.py` | Unified API client for multi-provider wearable data |
| `src/openwearables/sync_service.py` | OW→ClickHouse orchestration with TenantContext |
| `src/openwearables/health_data_processor.py` | 1077 lines — Garmin Health webhooks → ClickHouse timeseries |
| `src/users/user_manager.py` | ClickHouse user CRUD, Fernet encryption for Garmin passwords |
| `src/database/clickhouse_client.py` | Connection management, retry, chunked inserts |
| `src/users/supabase_client.py` | User org ID lookup via Supabase service key |
| `migrations/` | 11 SQL migration files for ClickHouse (ow_workouts, ow_timeseries, users, etc.) |

**Deployment**: Docker on Hetzner with Traefik reverse proxy. Two containers: `ppd-api` (API+webhooks) and `ppd-scheduler` (background extraction). ClickHouse runs natively on the host.

**Data pipeline**: Garmin/OW → Webhooks (PING/PUSH) → OpenWearables API → ClickHouse (openwearables_data + wearables_data databases).

#### OpenWearables Sync Service

The OW sync service is the core orchestration layer that fetches wearable data from the OpenWearables unified API and writes it into ClickHouse, scoped by multi-tenant context.

**TenantContext** (`src/openwearables/sync_service.py`):

A dataclass that carries multi-tenant identifiers throughout every sync operation:

```python
@dataclass
class TenantContext:
    app_id: str    # Application identifier (e.g. "ppd")
    org_id: str    # Supabase organization ID
    user_id: str   # Supabase user ID
```

Every record written to ClickHouse is tagged with these three fields, enabling per-org and per-user data isolation without separate databases.

**OpenWearablesSyncService** (`src/openwearables/sync_service.py`):

Orchestrates the full sync cycle for a single user. On init, it creates a `ClickHouseClient` (targeting the `openwearables_data` database) and an `OpenWearablesClient` (HTTP client for the OW API).

`sync_user()` flow:
1. **Provider sync trigger** — Calls `ow_client.sync_provider()` to tell OW to pull fresh data from the upstream provider (e.g. Garmin). For Garmin, it then polls `_wait_for_sync()` until the provider sync completes.
2. **Concurrent data fetch** — Uses `asyncio.gather()` to fetch and ingest four data streams in parallel:
   - Activity summaries (`_sync_activity_summaries`)
   - Sleep sessions + sleep summaries (`_sync_sleep_sessions`, `_sync_sleep_summaries`)
   - Workouts (`_sync_workouts`)
   - Timeseries (`_sync_timeseries`)
   - Body summary (`_sync_body_summary`)
3. **Transform** — Each stream passes through a dedicated transformer module that converts raw OW API responses into ClickHouse-ready dicts, injecting `TenantContext` fields.
4. **Insert** — Transformed records are inserted via `ClickHouseClient.insert_data()`, which chunks large batches (default 5000 records) to avoid memory limits.
5. **Deduplication** — Workouts are deduplicated by `provider_workout_id` before insertion.
6. **Table optimization** — Optionally runs `OPTIMIZE TABLE ... FINAL` on synced tables to merge parts and deduplicate.
7. **Daily rollup refresh** — Refreshes daily rollup tables after sync for pre-aggregated queries.

**Transformer pipeline** (`src/openwearables/transformers/`):

Each data type has a dedicated transformer that maps OW API fields to ClickHouse columns:

| Transformer | Input | Output Table |
|-------------|-------|-------------|
| `activity_summaries.py` | OW daily activity summaries | `ow_activity_summaries` |
| `sleep_summaries.py` | OW daily sleep summaries | `ow_sleep_summaries` |
| `sleep_sessions.py` | OW detailed sleep sessions | `ow_sleep_sessions` |
| `timeseries.py` | OW raw timeseries (HR, stress, steps, etc.) | `ow_timeseries` |
| `workouts.py` | OW workout records | `ow_workouts` |
| `body_summary.py` | OW daily body summary | `ow_body_summary` |

All transformers accept `(items: List[Dict], tenant: TenantContext, provider: str)` and return `List[Dict]` with tenant fields injected.

**OpenWearablesClient** (`src/openwearables/client.py`):

Async HTTP client (`httpx`) for the OW unified API. Key methods:
- `create_user()` / `get_user()` — User provisioning in OW
- `get_auth_url()` — Generates OAuth URLs for provider connections
- `sync_provider()` — Triggers upstream provider sync (async/sync mode per provider)
- `get_activity_summaries()` / `get_sleep_summaries()` / `get_sleep_sessions()` / `get_workouts()` / `get_timeseries()` / `get_body_summary()` — Paginated data fetch with date range filtering

Auth: `X-Open-Wearables-API-Key` header. Timeout: 30s read, 10s connect.

**Multi-user scheduler** (`src/scheduler/multi_user_scheduler.py`):

Runs the OW sync loop for all active users:

1. **Hourly sync** — `run_ow_sync_all_users()` iterates `user_manager.list_active_users()` and calls `_run_ow_sync()` per user with `days=7`.
2. **Per-user sync** — `_run_ow_sync()` resolves the OW user context (maps Supabase user ID → OW user ID + active providers via `_resolve_ow_user_context()`), constructs a `TenantContext`, and calls `service.sync_user()` for each active provider.
3. **Chunked backfill** — `run_ow_backfill_chunked()` splits historical backfills into 90-day chunks to avoid timeouts, calling `sync_user()` with explicit `start_date_override` / `end_date_override` per chunk.
4. **Scheduler loop** — Checks scheduled jobs every minute with error handling and retry delays. Runs in a background thread started by the FastAPI lifespan handler.

**ClickHouseClient** (`src/database/clickhouse_client.py`):

Connection management with auto-reconnect and chunked inserts:
- `insert_data(table, data, user_id)` — Chunks data by `_INSERT_CHUNK_SIZE` (5000), injects `user_id` if missing, and executes `INSERT INTO ... VALUES` per chunk.
- `get_connection()` — Context manager that returns a ClickHouse connection, with retry on connection errors.

### 4. Marketing Assets (`PeakPerformanceDataMarketing/`)

| Subproject | Tech | Purpose |
|------------|------|---------|
| Remotion/ | React, Remotion | 7-scene marketing video with TransitionSeries |
| Manim/ | Python, Manim | Tennis match visualization scenes |
| ThreeJS/ | TypeScript, turbo | Athlete digital twin (3D) |
| courtviz/ | TypeScript, turbo | Tennis court visualization (vendored into frontend via `vendor/`) |

## Data Flow

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         USER (Browser/PWA)                              │
└────────────────────────────────┬────────────────────────────────────────┘
                                 │
                    HTTPS / Vercel Edge
                                 │
┌────────────────────────────────▼────────────────────────────────────────┐
│              Next.js Frontend (Vercel)                                  │
│              peak_performance_data/                                     │
│                                                                         │
│  middleware.ts: i18n → CORS → brand → auth → authorization              │
│                                                                         │
│  src/app/api/ (~80 route handlers)                                      │
│  ├── ai-agent/          → DeepSeek/Groq (Edge runtime)                  │
│  ├── garmin-connect/    → WearableSync client                           │
│  ├── ppc-proxy/         → PPC backend proxy                             │
│  ├── dashboard/         → Supabase queries                              │
│  ├── tennis/            → Match CRUD, scorekeeper                       │
│  ├── organizations/     → Org management                                │
│  └── ...                → Auth, achievements, alerts, etc.              │
└──────────┬──────────────────────┬──────────────────────┬───────────────┘
           │                      │                      │
           │ Supabase JS          │ HTTP (ppc-proxy)     │ HTTP (wearablesync)
           │                      │                      │
┌──────────▼──────────┐  ┌───────▼──────────┐  ┌───────▼──────────────────┐
│   Supabase          │  │  ppd_backend      │  │  ppd_extraction_backend  │
│   (PostgreSQL)      │  │  (Render/Docker)  │  │  (Hetzner/Docker)        │
│                     │  │                   │  │                          │
│  Auth, profiles,    │  │  Graph generation │  │  Garmin OAuth            │
│  organizations,     │  │  ClickHouse query │  │  Webhooks (PING/PUSH)    │
│  training, tennis,  │  │  Weekly pace      │  │  Provider sync           │
│  AI conversations,  │  │  Airtable upload  │  │  OW→ClickHouse sync      │
│  achievements, etc. │  │                   │  │                          │
│  75 migrations      │  │  Port 8000        │  │  Port 8080               │
│  RLS policies       │  │                   │  │                          │
└─────────────────────┘  └───────┬──────────┘  └───────┬──────────────────┘
                                 │                      │
                          ┌──────▼──────┐        ┌──────▼──────┐
                          │  ClickHouse │        │  ClickHouse │
                          │  (wearables │        │  (wearables │
                          │   _data +   │        │   _data +   │
                          │   openwea-  │        │   openwea-  │
                          │   rables_   │        │   rables_   │
                          │   data)     │        │   data)     │
                          └─────────────┘        └─────────────┘
                                                   │
                                           ┌───────▼───────┐
                                           │ OpenWearables │
                                           │ (separate     │
                                           │  Docker stack)│
                                           └───────────────┘
```

### Key data flows:

1. **Wearable sync**: User connects Garmin/Polar/Whoop → OAuth via OpenWearables → OW fetches data → Webhook notifies extraction backend → Data synced to ClickHouse → ppd_backend generates graphs from ClickHouse

   **OW sync pipeline detail**:
   ```
   Scheduler (hourly)
     → _run_ow_sync(user_id)
       → _resolve_ow_user_context()  (Supabase ID → OW user ID + providers)
       → TenantContext(app_id, org_id, user_id)
       → sync_user()
         → ow_client.sync_provider()  (trigger upstream fetch)
         → _wait_for_sync()  (Garmin only — poll until complete)
         → asyncio.gather():
             _sync_activity_summaries()  → transform → ClickHouse
             _sync_workouts()            → dedupe → transform → ClickHouse
             _sync_sleep_sessions()      → transform → ClickHouse
             _sync_sleep_summaries()     → transform → ClickHouse
             _sync_timeseries()          → transform → ClickHouse
             _sync_body_summary()        → transform → ClickHouse
         → OPTIMIZE TABLE ... FINAL (optional)
         → daily rollup refresh
   ```

2. **AI agent**: User sends message → Edge route classifies intent → Selects relevant tools → Calls Supabase for data → Streams DeepSeek response → Saves conversation + semantic memory

3. **Graph generation**: Frontend requests graph → ppd_backend checks LRU cache → If miss, queries ClickHouse → Generates Plotly figure → Caches JSON → Optionally uploads to Airtable/S3

4. **Tennis scorekeeper**: Pure client-side scoring engine (`rules.ts`) → State persisted to Supabase via API routes → Match detail loader fetches sets/games/points/shots

5. **Background jobs**: ppd_backend scheduler runs daily at 01:00 UTC → Generates monthly/quarterly/annual graphs → Uploads to Airtable. Extraction backend scheduler runs daily Garmin extraction + hourly OW sync.

## Cross-Cutting Concerns

- **Multi-tenancy**: Organization-scoped data in Supabase (RLS policies), ClickHouse (app_id/org_id/user_id tenant keys), brand-by-domain resolution in middleware
- **Caching**: LRU caches (backend), SWR with sessionStorage (frontend), query caches with single-flight semantics, graph prewarming
- **Cold start optimization**: Lazy imports throughout both backends — heavy libraries (pandas, numpy, plotly, boto3) deferred to first use
- **i18n**: next-intl with 4 locales (en, es, zh, ca), translation files in `messages/`
- **PWA**: Service worker with NetworkFirst caching, push notifications, offline support
- **Security**: Supabase RLS (69 tables, all RLS-enabled), JWT verification, internal service secrets, Fernet encryption for Garmin passwords, Cloudflare Turnstile captcha on signup, SECURITY DEFINER functions for privileged operations, consent event tracking (GDPR Art. 6), rate limiting (DB-backed for AI agent, in-memory for API), personal data cleanup RPC (60+ table pairs)
- **B2C flow**: Personal organizations (`organizations.is_personal`) for solo users, `create_personal_organization` RPC (SECURITY DEFINER, idempotent), `check_and_increment_rate_limit` RPC, `cleanup_user_data` RPC for GDPR deletion, Stripe subscription columns on profiles, UTM/signup source attribution tracking
