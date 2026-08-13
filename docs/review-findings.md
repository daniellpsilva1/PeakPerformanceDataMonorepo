# Review Findings

All issues identified during the deep codebase review, ordered by severity: **Critical**, **High**, **Medium**, **Low**, **Info**.

---

## Critical

### C-1: Real secrets committed in `.env.local`

**File**: `PeakPerformanceData/peak_performance_data/.env.local:1-30`

The `.env.local` file contains real, active secrets in plaintext:
- `SUPABASE_SERVICE_ROLE_KEY` (line 18) — full admin access to Supabase
- `GITHUB_PAT` (line 12) — GitHub personal access token
- `STRAVA_CLIENT_SECRET` (line 20)
- `CLOUDFLARE_R2_SECRET_ACCESS_KEY` (line 29)
- `GARMIN_CONSUMER_SECRET` (line 8)
- `GARMIN_WEBHOOK_VERIFICATION_TOKEN` (line 5)
- `CRON_API_KEY` / `CRON_SECRET_KEY` (lines 6, 24)
- `AUTHORIZED_API_KEYS` (line 14)

While `.gitignore` has `.env*` pattern (line 34), the file exists on disk with real values. If this was ever committed before the `.gitignore` rule was added, these secrets are in git history. **All listed secrets should be rotated immediately.**

---

## High

### H-1: No authentication middleware on extraction backend

**File**: `PeakPerformanceData/ppd_extraction_backend/src/api/main.py:1-80`

The extraction backend FastAPI app has no auth middleware. All routes rely solely on the `x-user-id` HTTP header (e.g., `garmin_data.py:55-58`, `provider_data.py:67-70`) which is trivially spoofable by any caller. An attacker who knows or guesses a user ID can:
- Trigger Garmin sync for any user
- Disconnect any user's provider
- Export any user's wearable data
- View any user's account status

**Recommendation**: Add JWT verification middleware similar to `ppd_backend/api/middlewares/auth.py`.

### H-2: In-memory rate limiting doesn't work across workers

**File**: `PeakPerformanceData/ppd_backend/api/middlewares/rate_limit.py:27`

```python
_buckets: Dict[str, List[float]] = defaultdict(list)
```

The rate limiter uses an in-memory dict. The Dockerfile (`ppd_backend/Dockerfile:33`) runs gunicorn with `--workers 2`, and `--preload` means each worker has its own `_buckets` dict. This effectively doubles the rate limit. On Render with potential auto-scaling, the problem is worse.

**Recommendation**: Use Redis (already in `docker-compose.yml`) for shared rate limit state.

### H-3: Bare `except:` clauses swallow all exceptions

**File**: `PeakPerformanceData/ppd_backend/api/routes/graphs.py:105-106, 112-113, 135-136`

Multiple bare `except:` clauses catch everything including `KeyboardInterrupt` and `SystemExit`. This hides errors and makes debugging difficult:

```python
# Line 105-106
except:
    return str(obj)
```

**Recommendation**: Replace with `except Exception:` at minimum.

### H-4: Supabase client instance mutated instead of cloned

**File**: `PeakPerformanceData/ppd_backend/config/database.py:108-137`

The comment says "Clone the client to set a specific timeout" but the code assigns `client = _supabase_client_pool` (same reference) then mutates it with `client.execute_with_timeout = execute_with_timeout`. This modifies the shared singleton, which is not thread-safe. Concurrent calls with different timeouts will race.

**Recommendation**: Either use a proper copy/clone or pass timeout as a parameter to each query call.

---

## Medium

### M-1: Python version mismatch between backends

**Files**:
- `PeakPerformanceData/ppd_backend/Dockerfile:1` — `python:3.10-slim`
- `PeakPerformanceData/ppd_extraction_backend/docker/Dockerfile:1` — `python:3.13-slim`

The two backends run different Python versions. This increases the maintenance burden and risks subtle behavior differences (e.g., `dict` ordering, `asyncio` behavior, `typing` changes).

### M-2: `asyncio.ensure_future` silently drops exceptions

**File**: `PeakPerformanceData/ppd_extraction_backend/src/api/routes/garmin_data.py:167-170`

```python
import asyncio
asyncio.ensure_future(
    _post_connect_sync(ow_client, user_id_param)
)
```

Fire-and-forget background tasks created with `asyncio.ensure_future` will silently swallow any exceptions. If `_post_connect_sync` fails, no error is logged and the user never gets their post-connect sync.

**Recommendation**: Use `asyncio.create_task` with an exception-logging callback, or FastAPI's `BackgroundTasks`.

### M-3: Hardcoded real Supabase URL in `.env.example`

**File**: `PeakPerformanceData/ppd_extraction_backend/.env.example:35`

```env
SUPABASE_URL=https://bcfwtgqvusjhlrqsztod.supabase.co
```

The `.env.example` contains the real production Supabase project URL. This leaks the project identifier. Example files should use placeholders.

### M-4: `supabase: any` type in auth wrapper

**File**: `PeakPerformanceData/peak_performance_data/src/lib/api/with-auth.ts:19`

```typescript
export type AuthContext = {
  supabase: any
  user: User
}
```

Using `any` for the Supabase client loses all type safety. The `Database` type (4373 lines in `database.types.ts`) exists but is not used here.

**Recommendation**: Use `SupabaseClient<Database>` from `@supabase/supabase-js`.

### M-5: No webhook signature verification on extraction backend

**File**: `PeakPerformanceData/ppd_extraction_backend/src/api/routes/webhooks.py:1-80`

The Garmin PING webhook endpoint does not verify the Garmin webhook signature. It accepts any request at `/webhooks/garmin/ping` and processes it. An attacker could send forged webhook payloads to inject fake wearable data.

### M-6: `openwearables_data` database creation not idempotent in Docker

**File**: `PeakPerformanceData/ppd_extraction_backend/migrations/000_create_database.sql:5`

```sql
CREATE DATABASE IF NOT EXISTS openwearables_data;
```

ClickHouse's `CREATE DATABASE IF NOT EXISTS` is fine, but the migration runner (`python main.py migrate`) needs to handle the case where the database already exists. If migrations are run manually, the `wearables_data` database (used by the `users` table in migration 009) is never created by any migration file — it must pre-exist.

### M-7: No input validation on `x-user-id` header

**Files**:
- `PeakPerformanceData/ppd_extraction_backend/src/api/routes/garmin_data.py:55-58`
- `PeakPerformanceData/ppd_extraction_backend/src/api/routes/provider_data.py:67-70`

The `_get_user_id` function accepts any string from the `x-user-id` header without validating format (e.g., UUID). This could allow SQL injection in ClickHouse queries if user IDs are used in raw SQL strings without parameterization.

### M-8: Frontend PWA service worker excludes may break updates

**File**: `PeakPerformanceData/peak_performance_data/next.config.js:22`

```javascript
buildExcludes: [/middleware-manifest\.json$/, /app-build-manifest\.json$/]
```

While the comment explains this prevents precaching 404'd manifests, excluding these from the service worker means the SW won't know about new builds that change these manifests. This could cause stale content to be served from cache even after a new deployment.

---

## Low

### L-1: No test coverage for AI agent

**Directory**: `PeakPerformanceData/peak_performance_data/tests/`

No tests exist for the AI agent route (`src/app/api/ai-agent/route.ts`), tool router (`src/lib/ai/utils/toolRouter.ts`), or any of the 32 tool files in `src/lib/ai/tools/`. The AI agent is a significant feature with 50+ tools and external API calls.

### L-2: Unpinned dependencies in `ppd_backend/requirements.txt`

**File**: `PeakPerformanceData/ppd_backend/requirements.txt`

Some dependencies use `>=` or no version pin, which can cause reproducibility issues:
- `pandas>=2.2.0`
- `numpy>=1.26.0`

Most others are pinned with `==`, making the inconsistency notable.

### L-3: `ppd_backend` uses `clickhouse-connect` while `ppd_extraction_backend` uses `clickhouse-driver`

**Files**:
- `PeakPerformanceData/ppd_backend/requirements.txt` — `clickhouse-connect==0.7.16`
- `PeakPerformanceData/ppd_extraction_backend/requirements.txt` — `clickhouse-driver==0.2.9`

Two different ClickHouse client libraries are used across backends. `clickhouse-connect` uses HTTP (port 8123) while `clickhouse-driver` uses native protocol (port 9000). This means different ports, different query APIs, and different behavior. Not a bug, but a consistency issue.

### L-4: `AuthContext` type doesn't include profile for all handlers

**File**: `PeakPerformanceData/peak_performance_data/src/lib/api/with-auth.ts:18-30`

`AuthContext` has `supabase` and `user`, while `AuthContextWithProfile` adds `profile`. Some handlers may need profile data but use the base `AuthContext`, requiring an extra Supabase query inside the handler.

### L-5: `next.config.js` is 536 lines long

**File**: `PeakPerformanceData/peak_performance_data/next.config.js`

The Next.js config file is very large (536 lines), mostly due to PWA runtime caching rules. This makes it hard to review and maintain. Consider extracting runtime caching config to a separate file.

### L-6: No CI/CD pipeline visible in frontend

**Directory**: `PeakPerformanceData/peak_performance_data/.github/`

A `.github` directory exists but the workflows were not reviewed in depth. The frontend relies on `deploy.sh` (manual script) for Vercel deployment. No automated CI pipeline is evident for running tests before deploy.

### L-7: `garmin_tokens` directory mounted in Docker but not gitignored

**File**: `PeakPerformanceData/ppd_extraction_backend/docker/docker-compose.yml:62`

```yaml
volumes:
  - ../garmin_tokens:/app/garmin_tokens
```

The `garmin_tokens` directory contains OAuth tokens and is mounted into containers. Ensure this directory is in `.gitignore` (it appears in the extraction backend's `.gitignore` but should be verified).

### L-8: Duplicate `CACHE_USER_DATA` / `CACHE_ADMIN_DATA` logic

**File**: `PeakPerformanceData/peak_performance_data/src/lib/api/with-auth.ts:44-46`

Cache profiles are defined as constants but the `applyCacheHeaders` function has complex logic to check existing headers, method type, and overrides. This logic could be simplified.

### L-9: `database.types.ts` is 4373 lines and auto-generated

**File**: `PeakPerformanceData/peak_performance_data/src/lib/supabase/database.types.ts`

This file is auto-generated by Supabase but committed to the repo. It should be regenerated periodically via `supabase gen types`. No script or documentation exists for regenerating it.

---

## Info

### I-1: Monorepo uses git submodules for some dependencies

**File**: `/Users/danielsilva/Desktop/PeakPerformanceDataMonorepo/.gitmodules`

The monorepo uses git submodules. Ensure `git clone --recursive` is used when cloning.

### I-2: `vendor/courtviz` is a vendored copy

**Directory**: `PeakPerformanceData/peak_performance_data/vendor/courtviz/`

The `courtviz` package is vendored into the frontend from `PeakPerformanceDataMarketing/courtviz/`. Updates to the marketing project's courtviz need to be manually synced to the vendor directory.

### I-3: Two Supabase migration counts (49 vs 56)

The system memory mentions 49 migrations, but the directory listing shows 56 files. This is likely due to migrations being added over time. The `database.types.ts` may be out of date with the latest migrations.

### I-4: Marketing projects are independent repos

**Directory**: `PeakPerformanceDataMarketing/`

Each marketing subproject (Remotion, Manim, ThreeJS, courtviz) has its own `.git` directory, meaning they are separate git repositories, not part of the main monorepo's git history.

### I-5: `ppd_backend` has a `_memory_bank` directory

**Directory**: `PeakPerformanceData/ppd_backend/_memory_bank/`

This appears to be AI-assistant memory files (possibly from Claude or another tool). Not part of the application but present in the repo.

### I-6: No API versioning strategy

Neither backend has API versioning beyond the `/api/v1/` prefix on extraction backend routes. The `ppd_backend` has no version prefix at all. Breaking changes would affect all consumers simultaneously.

### I-7: Frontend has 80+ API route handlers

**Directory**: `PeakPerformanceData/peak_performance_data/src/app/api/`

The BFF layer has approximately 80 API route handlers. This is a large surface area that could benefit from code generation or a more structured approach (e.g., tRPC or generated routes from OpenAPI spec).

### I-8: `vercel.json` has cron jobs but no visible cron auth verification

**File**: `PeakPerformanceData/peak_performance_data/vercel.json`

Cron jobs are defined but authentication relies on `CRON_API_KEY` / `CRON_SECRET_KEY` environment variables. Ensure these are checked in every cron-invoked route handler.

---

## Summary

| Severity | Count |
|----------|-------|
| Critical | 1 |
| High | 4 |
| Medium | 8 |
| Low | 9 |
| Info | 8 |
| **Total** | **30** |

### Top priorities:
1. **Rotate all secrets** exposed in `.env.local` (C-1)
2. **Add authentication** to extraction backend (H-1)
3. **Move rate limiting to Redis** for multi-worker correctness (H-2)
4. **Fix bare except clauses** in graph routes (H-3)
5. **Fix Supabase client mutation** in database config (H-4)
