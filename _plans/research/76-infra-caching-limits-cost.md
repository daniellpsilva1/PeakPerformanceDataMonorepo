# 76 — Infra: Caching, Rate Limits, Cost Tracking, Queues, Realtime

**Date:** 2026-08-02  
**Scope:** Read-only inventory of cross-cutting infrastructure across the Peak Performance Data monorepo for a multi-agent AI system. Reuse vs reinvent.  
**Repo root:** `/Users/danielsilva/Desktop/PeakPerformanceDataMonorepo`

---

## Executive summary

| Capability | Status | Verdict |
|---|---|---|
| Redis (graph cache) | **Working** in `ppd_backend` (`ppc-redis`) | Reuse pattern / share instance |
| Redis (`ppp_ai_agent`) | Declared, **never used** | Dead weight today; free to wire |
| Distributed rate limiting | **Broken** (in-memory Map on Edge) | Must rebuild on Redis/KV |
| AI cost attribution | Partial tokens + `organization_id`; **no USD cost column** | Schema reusable; cost math missing |
| Durable background jobs | Schedulers + Postgres job table + Celery (OW only) | Patterns exist; no agent job queue |
| Feature flags per org | **Absent** (stub type only) | Must build |
| Realtime insight push | Messaging realtime only | Reusable substrate via inserts |
| Supabase Edge Functions | **None** in repo | N/A |
| HTTP retries | Mixed: AI `withRetry`, Garmin `tenacity`; most Next fetch single-shot | Partial |

---

## 1. Redis

### 1.1 `ppp_ai_agent` — declared only

| Location | Evidence |
|---|---|
| `PeakPerformanceData/ppp_ai_agent/config/settings.py:31` | `REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6379/0")` |
| `PeakPerformanceData/ppp_ai_agent/requirements.txt:11` | `redis==5.0.1` |
| Runtime usage | **None** — no `import redis`, no client, no cache/queue calls |
| Docker Compose | Agent compose has **no** Redis service (sibling `ppd_backend` does) |

**Verdict:** Scaffolding for a future cache/queue/rate-limit store. Safe to wire for multi-agent needs without conflicting with existing agent code.

### 1.2 `ppd_backend` — working L1 + Redis L2 graph cache

**Compose:** `PeakPerformanceData/ppd_backend/docker-compose.yml`

- Service `redis` → container `ppc-redis` (`redis:7-alpine`) lines 2–15  
- `maxmemory 256mb`, policy `allkeys-lru` (line 6)  
- Volume `ppc-redis-data` (lines 7–8, 63)  
- `ppc-api` sets `REDIS_URL=redis://redis:6379/0` (line 29), `depends_on: redis` (lines 32–34)  
- Network `ppd-shared` (external)

**Implementation:** `PeakPerformanceData/ppd_backend/utils/core/caching.py`

#### Shared in-process LRU caches (not Redis)

| Instance | Max size | TTL | Lines |
|---|---|---|---|
| `activity_cache` | 2000 | 1800s (30 min) | 108 |
| `polyline_cache` | 500 | 86400s (24 h) | 109 |
| `splits_cache` | 100 | 3600s (1 h) | 110 |

Decorator `@cached` builds keys as `prefix:arg:k=v` (lines 113–152).

#### `GraphCache` (the production Redis user)

| Concern | Detail | Lines |
|---|---|---|
| Architecture | In-memory L1 dict + optional Redis L2 | 176–188 |
| Connect | `REDIS_URL` via `redis.from_url(..., decode_responses=True)`; ping; degrade to memory-only on failure | 197–208 |
| Key prefix (payload) | `ppc:graph:{md5}` | 179, 210–211, 247–250 |
| Key (user index set) | `ppc:graph:user:{user_id}` → `SADD` of bare md5 keys | 180, 243 |
| Key material | `md5(f"{user_id}_{graph_type}_{json.dumps(params, sort_keys=True)}")` | 247–250 |
| Default TTL | **2 hours** (`graph_cache = GraphCache(default_ttl_hours=2)`) | 418 |
| Redis write | `SETEX` with TTL = `max(60, expiry - now)`; JSON payload includes data, expiry, user_id, graph_type, params, access_count | 229–245 |
| Redis read | `GET` + JSON; delete if past `expiry` | 213–227 |
| L1 get path | Miss → load Redis → promote to L1 | 272–288 |
| Intelligent expiry | If expired but `access_count > 3`, return stale + background refresh thread | 300–311 |
| Proactive refresh | If within 2h of expiry and `access_count > 2`, spawn refresh thread | 319–331 |
| Background refresh | `GraphFactory().create_graph(...)` then `set` | 336–354 |
| Invalidation | `invalidate_user_cache(user_id)`: purge L1 by `user_id`, `DEL ppc:graph:{key}` for each, `DEL ppc:graph:user:{user_id}` | 387–415 |
| Empty payloads | **Not cached** at call site (see graphs route) | graphs.py 510–526 |

**API surface:** `PeakPerformanceData/ppd_backend/api/routes/graphs.py`

- `DELETE /cache/{user_id}` → `graph_cache.invalidate_user_cache` (lines 365–379)  
- GET/batch paths call `graph_cache.get` / `graph_cache.set` with `_build_cache_key_params` (e.g. lines 455–523, 580–644, 704–794)  
- Skip cache when `graph_payload_has_real_values` is false (lines 510–526)

**Invalidation strategy:** Explicit per-user DELETE endpoint + TTL expiry + Redis `allkeys-lru` under memory pressure. No pub/sub invalidation bus. No org-scoped invalidation. User-set members that exist only in Redis (not in L1) are cleared only via deleting the set key itself—individual orphaned `ppc:graph:*` keys rely on TTL/LRU.

### 1.3 Other Redis in the monorepo

| Location | Role |
|---|---|
| `PeakPerformanceData/ppd_extraction_backend/docker/openwearables-prod.yml:42–44` | OpenWearables Redis for **Celery** broker (OW stack, not PPD app cache) |
| Memory-bank docs | Historical Celery+Redis plans for tennis tracking — not implemented in PPD app code |

### 1.4 Non-Redis caches (related)

| Cache | File | TTL | Notes |
|---|---|---|---|
| `_QueryCache` (ClickHouse DF single-flight) | `ppd_backend/data_processing/base/graph_data_processor.py:24–156` | 30s | In-process only; keys like `ow_activity:…`, `sleep_summaries:…` |
| `db_helpers` timestamp cache | `ppd_backend/utils/database/db_helpers.py:11–226` | 5–10 min | In-process |
| Next.js `Cache-Control` on graphs proxy | `peak_performance_data/src/app/api/ppc-proxy/[...path]/route.ts:98+` | HTTP cache headers | CDN/browser, not Redis |
| Profile invalidate headers | middleware/auth + signout/switch-role routes | Request-scoped | Not Redis |

**No AI response / tool-result Redis cache exists anywhere.**

---

## 2. Rate limiting

### 2.1 Next.js AI agent (primary — broken for serverless)

**Files:**

- `PeakPerformanceData/peak_performance_data/src/lib/ai/utils/rateLimit.ts` (full file, lines 1–95)  
- Wired in `PeakPerformanceData/peak_performance_data/src/app/api/ai-agent/route.ts:8,72–88,221–222,265–269`  
- Config mirror: `PeakPerformanceData/peak_performance_data/src/lib/ai/agentConfig.ts:44–47` (`maxRequestsPerHour: 50`)  
- UI constant: `UsageDashboard.tsx:19` (`RATE_LIMIT = 50`)

**Algorithm:**

- Store: module-level `Map<string, RateLimitEntry>` (line 12)  
- Key: `ai-agent:${userId}` (line 31)  
- Window: 50 requests / 60 minutes (lines 15–17)  
- `checkRateLimit` creates/resets window; `incrementRateLimit` only after successful LLM start (route.ts:221–222)  
- Headers: `X-RateLimit-Limit|Remaining|Reset` (rateLimit.ts:75–82)  
- On exceed: 429 + `logAIAction(..., actionType: 'rate_limited')` (route.ts:74–88)

**Why in-memory is broken on Vercel Edge/serverless:**

1. Route declares `export const runtime = 'edge'` (`route.ts:16`).  
2. Each isolate has its **own** `Map`. Counters do not share across instances/regions.  
3. Cold starts reset the Map (comment at rateLimit.ts:11).  
4. Effective limit ≈ `50 × number_of_active_instances` (under-enforcement).  
5. Team already documented this in `_memory_bank/features/ai-voice-agent-implementation.md` (~line 1188): recommends Vercel KV / Upstash Redis.

**Also:** `AI_CONFIG.rateLimit` is **not** read by `rateLimit.ts` — duplicated magic numbers (50 / 1h).

### 2.2 Other rate limiting

| Location | Mechanism | Distributed? |
|---|---|---|
| `swingvision-pipeline/app/api/login/route.ts:19–33,50–54` | In-memory Map, 10 attempts / 15 min per IP | **No** (same serverless flaw if deployed multi-instance) |
| `ppd_extraction_backend/.../base_extractor.py:84–113` | Client-side sleep/jitter before Garmin API | Outbound throttle, not inbound API limit |
| `ppd_extraction_backend/.../garmin_auth.py` | tenacity + rate-limit exceptions | Outbound |
| `ppd_legacy_extraction_backend/.../garmin_connect_client.py` | `_rate_limit` + retry backoff | Outbound |
| `useAthleteGraphPrefetch.ts:12,58` | Client 2-min cooldown per athlete | UI only |
| Next.js `middleware.ts` | **No** rate limit | — |
| Traefik labels (`ppd_backend/docker-compose.yml:35–45`) | Strip prefix / TLS only — **no** `ratelimit` middleware | — |
| Supabase Auth | Platform defaults only; no custom bucket tables in migrations | — |

**No Redis/Upstash/Vercel KV rate limiter is implemented in application code.**

---

## 3. Cost / usage tracking

### 3.1 Schema: `ai_audit_logs`

**Created:** `PeakPerformanceData/peak_performance_data/supabase/migrations/20260129_ai_voice_agent_tables.sql:47–91`

| Column (original) | Purpose |
|---|---|
| `user_id` | Caller |
| `organization_id` | Tenant (nullable FK) |
| `action_type` | e.g. conversation_started/ended, tool_executed, rate_limited, error |
| `tool_name`, `parameters`, `result_status`, `error_message` | Tool audit |
| `duration_ms`, `tokens_used` | Latency + total tokens |
| `created_at` | Timestamp |
| Indexes | user, org, created_at, tool_name, result_status (lines 65–69) |
| RLS | Own logs; admin/club_admin org logs; insert open (lines 74–91) |

**Telemetry extension:** `.../migrations/20260311_ai_telemetry_and_memory.sql:7–15`

| Added column | Purpose |
|---|---|
| `model_provider` | e.g. `deepseek`, `groq` |
| `prompt_tokens` | Input tokens |
| `completion_tokens` | Output tokens |
| `ttft_ms` | Time to first token |

**Types mirror:** `database.types.ts:130–190` — **no `cost_usd` / `model_name` / `athlete_id` columns**.

### 3.2 Write path

`PeakPerformanceData/peak_performance_data/src/lib/ai/utils/auditLog.ts`

| Function | Records | Lines |
|---|---|---|
| `logAIAction` | Inserts row with action_type, tokens, duration, model_provider, org, tool, etc. | 104–128 |
| `createStreamTelemetry` | In-memory tracker for one stream | 38–46 |
| `logStreamComplete` | `conversation_ended` with prompt/completion/total tokens, duration_ms, ttft_ms, model_provider, result_status + per-tool rows | 52–98 |
| `getAIUsageStats` | Aggregates **per userId** last N days: counts, toolUsage, totalTokens — **not cost, not org rollup** | 154–205 |

Wired from `ai-agent/route.ts`:

- Rate limited → audit (75–80)  
- conversation_started fire-and-forget (92–96)  
- On usage promise: `logStreamComplete` (240–244)  
- Catch path: error log with `userId: 'unknown'` (278–285) — weak attribution on failures

### 3.3 Read path / UI

| Piece | Path | Behavior |
|---|---|---|
| API | `src/app/api/ai-agent/usage/route.ts` | Edge GET; auth; self or admin; `getAIUsageStats(supabase, userId)`; Cache-Control 60s |
| UI | `src/components/ai/UsageDashboard.tsx` | SWR last-30d user stats; **client-side fake cost** `(totalTokens * 0.0003 / 1000)` (line 99) — not persisted, not model-aware |
| Cleanup | `src/app/api/cron/cleanup-conversations/route.ts:67–80` | Deletes audit logs older than **90 days** |

### 3.4 Can we answer “how much did org X cost us last month?”

| Question | Answer |
|---|---|
| Filter by `organization_id` + date? | **Yes** at SQL level (column + index exist; RLS allows org admins) |
| Sum tokens for org? | **Yes** (`tokens_used` / prompt+completion) if writers always set `organization_id` (happy path does) |
| Dollar cost? | **No** — no stored USD; UI uses a single hardcoded rate; DeepSeek vs Groq pricing differs (`agentConfig.ts:10` comments DeepSeek rates; UI ignores them) |
| Per-athlete cost? | **No** — no athlete_id on audit rows |
| Python `ppp_ai_agent` costs? | **Not in this table** — Next.js route only |
| Retention | Audit rows deleted after 90 days by cron — month-ago queries work only within retention |

**Verdict:** Org **token** attribution is feasible with a SQL aggregate. Org **dollar** cost attribution requires building pricing maps + preferably a `cost_usd` column (or a views/jobs layer). Current UsageDashboard is per-user, not per-org.

---

## 4. Background jobs and queues

### 4.1 Inventory

| Mechanism | Location | Schedule / trigger | Durable? |
|---|---|---|---|
| Graph scheduler (`schedule` lib) | `ppd_backend/background_jobs/scheduler.py:18–79` | Daily 01:00 UTC graphs + prewarm | Process-local loop; lost if process dies mid-job |
| Scheduler entrypoints | `ppd_backend/api/main.py:98,128`; `run_scheduler.py` | Starts/stops with API or dedicated process | — |
| Daily graph generator | `ppd_backend/background_jobs/daily_graph_generator.py` | Invoked by scheduler | Side effects to Airtable/S3/cache |
| Multi-user Garmin/OW extraction | `ppd_extraction_backend/src/scheduler/multi_user_scheduler.py:99–108` | Midnight all users; hourly OW sync | In-process `schedule` |
| Legacy Garmin scheduler | `ppd_extraction_backend/src/garmin/scheduler/garmin_scheduler.py:94` | Daily 00:00 | In-process |
| Legacy sync service | `ppd_legacy_extraction_backend/.../scheduled_sync_service.py` | Loop | In-process |
| FastAPI `BackgroundTasks` | extraction webhooks/provider_data/garmin_data; `ppd_vision` analysis; graphs preload | Request-scoped | **Not durable** (dies with worker) |
| OpenWearables Celery | `ppd_extraction_backend/docker/openwearables-prod.yml:23–27,42–44` | Celery beat/worker + Redis | Durable **inside OW**, not agent-facing |
| SwingVision Postgres job queue | `swingvision-pipeline/workers/ingestion_watcher.py` | Poll → insert `pipeline_jobs` status=`pending` | **Durable** (Supabase/Postgres) |
| Scorekeeper offline outbox | `peak_performance_data/src/lib/tennis/scorekeeper/outbox.ts` | localStorage FIFO | Client-only |
| Vercel Cron | `peak_performance_data/vercel.json:2–7` | `0 3 * * *` → `/api/cron/cleanup-conversations` | Platform cron |
| Cron handler | `src/app/api/cron/cleanup-conversations/route.ts` | Deletes old AI conversations (30d) + audit logs (90d); Bearer `CRON_SECRET` | — |
| Supabase `pg_cron` | Migrations | **Not used** (no `pg_cron` / `cron.schedule` in SQL) | — |
| Supabase Edge Functions | Repo | **None** (no `supabase/functions`, no `config.toml`) | — |
| Celery/BullMQ/Temporal in PPD apps | — | **Absent** | — |

### 4.2 SwingVision queue pattern (best durable example)

- Watcher polls RPC `svp_matches_needing_jobs` (`ingestion_watcher.py:33–45`)  
- Enqueues `pipeline_jobs` rows (`enqueue_match`, lines 48–60)  
- Idempotent via unique constraint / 23505 handling (lines 63–96)  
- Workers claim jobs on Mac Mini (documented in module docstring)

**Reusable idea for agents:** Postgres-backed job table + poller/claimer, not Redis-only fire-and-forget.

---

## 5. Supabase Edge Functions

**Finding:** No Edge Function source tree exists under the monorepo.

- `peak_performance_data/supabase/` contains **migrations only** (no `functions/` directory, no `config.toml`).  
- Cron cleanup is implemented as a **Next.js route** triggered by Vercel Cron, not an Edge Function.  
- Memory-bank docs mention Edge Functions as a future option; not shipped.

---

## 6. Realtime

### 6.1 Current usage

**Primary module:** `PeakPerformanceData/peak_performance_data/src/hooks/data/useConversationRealtime.ts`

| Hook | Channel | Events | Lines |
|---|---|---|---|
| `useConversationRealtime` | `conversation:{id}` | `postgres_changes` INSERT/UPDATE on `messages` filtered by `conversation_id` | 94–213 |
| `useConversationsRealtime` | `user-conversations:{userId}` | UPDATE/INSERT on `conversation_participants` filtered by `user_id` | 227–285 |

**Consumers:**

- `useUnreadMessages.ts:81` — badges + PWA app badge  
- `MessagingView.tsx` — live thread  
- `BottomNav.tsx` / `SidebarNavigation.tsx` — unread counts  

**Semantics:** DB change → Supabase Realtime → client SWR cache mutate / append. Not a custom broadcast channel for arbitrary agent events.

### 6.2 Could an agent push an insight to a live client?

| Approach | Feasible today? | Notes |
|---|---|---|
| Insert a row into `messages` in a conversation the user is in | **Yes** | Existing INSERT subscription would deliver; AI already has messaging tools (`messagingTools.ts`, `broadcastToParentsTool`) |
| Subscribe clients to a new `ai_insights` / `notifications` table | **Partial** | Would need table + Realtime publication + new hook; pattern copy-paste from messages |
| Supabase Broadcast / Presence channels | **Not used** in app code | Would be net-new |
| Web Push (`usePushNotifications`, `web-push.ts`) | Exists for messaging-style push | Offline delivery path; separate from Realtime |

**Verdict:** Realtime substrate is reusable. Agent → live insight is easiest by writing a DB row that clients already (or newly) subscribe to. No dedicated “agent insight channel” exists.

---

## 7. HTTP client conventions

### 7.1 Next.js (`peak_performance_data`)

| Client | Timeout | Retry | File |
|---|---|---|---|
| PPC proxy client | 30s AbortController | **None** (single-shot) | `src/lib/api/ppc-client.ts:54–55` |
| WearableSync / Garmin | `GARMIN_API_TIMEOUT` default 30s (`config.ts:48`); export 2× | **None** | `wearablesync-client.ts:104–105,182,336` |
| Vision client | 120s | **None** | `vision-client.ts:97–98` |
| AI route LLM | 27s abort before Edge 30s kill | `withRetry` maxRetries=2, DeepSeek→Groq fallback | `ai-agent/route.ts:180–216`; `retry.ts:32–59` |
| `withRetry` helper | — | Exponential backoff; skips retry on rate limit / auth / validation | `src/lib/ai/utils/retry.ts` |
| SWR hooks | — | `errorRetryCount` often 2 (e.g. unread messages) | Various |
| Parent provider fetch | 1.2–2.5s | Single-shot | `parent-page-data.ts`, progress-summary route |

**No shared axios/ky instance; mostly raw `fetch` + AbortController. No Upstash/retry library in Next app beyond local `withRetry`.**

### 7.2 Python services

| Service | Library | Timeouts | Retries |
|---|---|---|---|
| `ppd_extraction_backend` Garmin extractors | `tenacity` `@retry` 5 attempts, exp backoff 4–120s | Sleep/jitter rate limit | `base_extractor.py:115–120` |
| OW client | `httpx.AsyncClient` | `Timeout(30.0, connect=10.0)` | **No** retry wrapper | `openwearables/client.py:20–24` |
| Provider/webhook routes | httpx 5–30s | Mostly single-shot; sync path polls/retires every 5s up to 5 min | `provider_data.py` |
| `ppd_backend` | httpx 10s in user_id_resolver; `timeout_middleware` decorator 30s; `CircuitBreaker` on DB | Circuit breaker threshold 5 / recovery 60s | `timeout.py`, `database.py:37` |
| `ppp_ai_agent` | `httpx==0.24.1` in requirements | No shared retry utility found in agent package | Single-shot by default |
| Legacy Garmin client | Custom `_retry_request` | Exp backoff on 429 | `garmin_connect_client.py:79+` |

**Verdict:** Retries are domain-specific (Garmin, AI). Cross-service HTTP is largely single-shot with timeouts. No monorepo-wide retry policy.

---

## 8. Feature flags

| Candidate | Reality |
|---|---|
| `BrandConfig.features?: { [key: string]: boolean }` | Stub comment only — `src/config/brands/types.ts:31–34`. No brand file populates/reads it for gating. |
| `organizations` table | Branding fields only (`name`, `logo_url`, `brand_colors`, …) — `database.types.ts:1489–1529`. **No flags/settings JSON.** |
| LaunchDarkly / Flagsmith / Unleash / PostHog flags | **Not present** |
| Env-based kill switches | Ad-hoc `process.env` checks exist elsewhere but not a per-org flag system |

**Verdict:** Must build org/user feature flags (DB column or table + server check). Brand `features` type is a dead stub.

---

## 9. Gap analysis for multi-agent system

Needs: distributed rate limiting, response caching, per-org cost attribution, durable background jobs, feature flags per org, realtime push of insights.

### 9.1 Exists and reusable

| Asset | Reuse how |
|---|---|
| `ppc-redis` + `GraphCache` pattern | Template for Redis key prefix / SETEX / degrade-to-memory; consider sharing Redis on `ppd-shared` with agent DB index isolation (`ppc:graph:` vs `agent:…`) |
| `ai_audit_logs` + `organization_id` + token columns | Foundation for cost dashboards; extend don't replace |
| `logStreamComplete` / telemetry tracker | Pattern for per-call accounting in Next (and port to Python agents) |
| Vercel Cron + cleanup route | Pattern for scheduled maintenance jobs |
| SwingVision `pipeline_jobs` + watcher | Best in-repo durable queue pattern (Postgres claim/lease) |
| Extraction / graph `schedule` loops | Fine for fixed nightly batch if process supervised |
| Supabase Realtime on postgres_changes | Push insights by inserting subscribed rows |
| Messaging tools + web push | Human-visible delivery of agent output today |
| `withRetry` + provider failover | Interactive LLM path pattern |
| `tenacity` in extraction | Outbound API resilience pattern |
| OW Celery+Redis | Only if agent work is co-located with OW (usually not) |

### 9.2 Exists but broken / insufficient

| Asset | Problem |
|---|---|
| AI `rateLimit.ts` Map | Broken across Edge isolates; under-enforces; config duplicated |
| SwingVision login rate limit Map | Same class of bug if multi-instance |
| UsageDashboard cost | Fake constant; per-user only; not org billing |
| Audit retention 90d | Insufficient for long-term finance without export/warehouse |
| `ppp_ai_agent` Redis dep | Unused; no compose service; false sense of readiness |
| Graph cache invalidation | User-scoped only; no org/versioned semantic cache for LLM answers |
| In-process schedulers | Not HA; no ack/retry/dead-letter for agent workflows |
| FastAPI BackgroundTasks | Not durable for multi-minute agent runs |
| Brand `features` stub | Type exists, behavior doesn't |

### 9.3 Must build

| Need | Recommendation (reuse-first) |
|---|---|
| **Distributed rate limiting** | Redis (share `ppc-redis` or Upstash if limiting on Vercel Edge) with sliding/fixed window per `user_id` and/or `organization_id`. Replace Map in `rateLimit.ts`. |
| **AI / tool response caching** | New Redis namespace (e.g. `agent:cache:`) with TTLs + hash of (org, athlete, tool, args). Do **not** overload `ppc:graph:` keys. Optional semantic cache later. |
| **Per-org dollar cost** | Persist `cost_usd` (or compute from model+tokens via pricing table); org rollup API; stop relying on UsageDashboard heuristic. Pipe Python agent calls into same audit table. |
| **Durable agent jobs** | Postgres job table (clone SwingVision pattern) **or** Celery/RQ on Redis for short jobs; avoid HITL-on-Celery for day-long waits (see plans 39/46). |
| **Feature flags per org** | `organization_settings` / `feature_flags` JSONB on `organizations` + server helper; optionally mirror onto BrandConfig later. |
| **Realtime insight push** | Either (A) insert notification/message rows using existing Realtime, or (B) new `ai_insights` table + `postgres_changes` hook mirroring `useConversationRealtime`. |
| **Edge Functions** | Only if you want cron/webhooks off Vercel; currently unnecessary given Vercel Cron + Python schedulers. |
| **Unified HTTP retry policy** | Shared helper for Python (tenacity defaults) and TS (`withRetry`) for agent→backend calls. |

### 9.4 Suggested build order

1. Wire Redis rate limits for AI (unblocks safe multi-agent traffic).  
2. Extend `ai_audit_logs` (+ Python writers) for real cost attribution.  
3. Durable job table for nightly/async agent work.  
4. Org feature flags.  
5. Response caching on Redis.  
6. Insight realtime channel (or reuse messages/notifications).

---

## 10. Key file index

| Topic | Absolute path |
|---|---|
| Graph Redis cache | `/Users/danielsilva/Desktop/PeakPerformanceDataMonorepo/PeakPerformanceData/ppd_backend/utils/core/caching.py` |
| Redis compose | `/Users/danielsilva/Desktop/PeakPerformanceDataMonorepo/PeakPerformanceData/ppd_backend/docker-compose.yml` |
| Graph cache API | `/Users/danielsilva/Desktop/PeakPerformanceDataMonorepo/PeakPerformanceData/ppd_backend/api/routes/graphs.py` |
| Query single-flight cache | `/Users/danielsilva/Desktop/PeakPerformanceDataMonorepo/PeakPerformanceData/ppd_backend/data_processing/base/graph_data_processor.py` |
| Agent Redis stub | `/Users/danielsilva/Desktop/PeakPerformanceDataMonorepo/PeakPerformanceData/ppp_ai_agent/config/settings.py` |
| AI rate limit | `/Users/danielsilva/Desktop/PeakPerformanceDataMonorepo/PeakPerformanceData/peak_performance_data/src/lib/ai/utils/rateLimit.ts` |
| AI route | `/Users/danielsilva/Desktop/PeakPerformanceDataMonorepo/PeakPerformanceData/peak_performance_data/src/app/api/ai-agent/route.ts` |
| Audit / telemetry | `/Users/danielsilva/Desktop/PeakPerformanceDataMonorepo/PeakPerformanceData/peak_performance_data/src/lib/ai/utils/auditLog.ts` |
| Usage API | `/Users/danielsilva/Desktop/PeakPerformanceDataMonorepo/PeakPerformanceData/peak_performance_data/src/app/api/ai-agent/usage/route.ts` |
| Usage UI | `/Users/danielsilva/Desktop/PeakPerformanceDataMonorepo/PeakPerformanceData/peak_performance_data/src/components/ai/UsageDashboard.tsx` |
| Audit migration | `/Users/danielsilva/Desktop/PeakPerformanceDataMonorepo/PeakPerformanceData/peak_performance_data/supabase/migrations/20260129_ai_voice_agent_tables.sql` |
| Telemetry migration | `/Users/danielsilva/Desktop/PeakPerformanceDataMonorepo/PeakPerformanceData/peak_performance_data/supabase/migrations/20260311_ai_telemetry_and_memory.sql` |
| Vercel cron | `/Users/danielsilva/Desktop/PeakPerformanceDataMonorepo/PeakPerformanceData/peak_performance_data/vercel.json` |
| Cleanup cron | `/Users/danielsilva/Desktop/PeakPerformanceDataMonorepo/PeakPerformanceData/peak_performance_data/src/app/api/cron/cleanup-conversations/route.ts` |
| Graph scheduler | `/Users/danielsilva/Desktop/PeakPerformanceDataMonorepo/PeakPerformanceData/ppd_backend/background_jobs/scheduler.py` |
| Extraction scheduler | `/Users/danielsilva/Desktop/PeakPerformanceDataMonorepo/PeakPerformanceData/ppd_extraction_backend/src/scheduler/multi_user_scheduler.py` |
| SVP job enqueue | `/Users/danielsilva/Desktop/PeakPerformanceDataMonorepo/PeakPerformanceData/swingvision-pipeline/workers/ingestion_watcher.py` |
| Realtime hooks | `/Users/danielsilva/Desktop/PeakPerformanceDataMonorepo/PeakPerformanceData/peak_performance_data/src/hooks/data/useConversationRealtime.ts` |
| Unread + realtime | `/Users/danielsilva/Desktop/PeakPerformanceDataMonorepo/PeakPerformanceData/peak_performance_data/src/hooks/data/useUnreadMessages.ts` |
| AI retry helper | `/Users/danielsilva/Desktop/PeakPerformanceDataMonorepo/PeakPerformanceData/peak_performance_data/src/lib/ai/utils/retry.ts` |
| Brand features stub | `/Users/danielsilva/Desktop/PeakPerformanceDataMonorepo/PeakPerformanceData/peak_performance_data/src/config/brands/types.ts` |

---

*End of dossier 76.*
