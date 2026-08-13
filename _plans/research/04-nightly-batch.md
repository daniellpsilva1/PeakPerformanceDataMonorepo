# 04 — Nightly Batch Orchestration (as-built)

**Scope:** Existing batch/scheduled insight generation in `PeakPerformanceData/ppp_ai_agent`.  
**Mode:** Read-only investigation (2026-08-02).  
**Primary sources:** `agent/nightly_batch.py`, `agent/__init__.py` (empty), `api/routes/insights.py`, plus scheduling grep across sibling services and deploy configs.

---

## 1. Executive verdict

The nightly batch is a **single-process, sequential `for` loop** that (1) lists athletes from Supabase `profiles`, (2) fans out **per-athlete data fetches concurrently** (wearables + training), (3) calls an LLM with provider failover, and (4) POSTs rows to a Supabase REST path named `insights`.

It is **not wired to any production scheduler**. There is **no Temporal, Celery, APScheduler, cron job, or GitHub Actions workflow** that invokes it. The only triggers are:

- Manual CLI: `python -m agent.nightly_batch` (`nightly_batch.py:15–16`, `232–234`)
- Manual/internal HTTP: `POST /batch/nightly` (`insights.py:33–41`)

Related scheduled systems exist elsewhere (`ppd_extraction_backend` midnight/hourly OW sync; `ppd_backend` 01:00 UTC graph generation) but **neither calls the AI agent batch**.

Additionally, production Supabase (`PeakPerformanceDataV2`) has **no `insights` / `coach_reviews` / `feedback_events` tables**, and the Docker image **does not copy `agent/`**, so the HTTP path cannot import `run_nightly_batch` in the current container build.

---

## 2. Control flow (exact)

### 2.1 Entry points

| Entry | Path | Lines | Behavior |
|---|---|---|---|
| CLI | `agent/nightly_batch.py` | `232–234` | `asyncio.run(run_nightly_batch())` with no org filter |
| HTTP | `api/routes/insights.py` | `33–41` | Reads optional `organization_id` query param; awaits `run_nightly_batch(organization_id=org_id)` |
| Package | `agent/__init__.py` | (empty file) | No exports, no orchestration glue |

HTTP route docstring claims “Requires internal service auth (called by scheduler or admin)” (`insights.py:37`). Auth is enforced globally by `AuthMiddleware` (`api/middleware/auth.py:27–60`): either `x-internal-service` == `INTERNAL_SERVICE_SECRET`, or a Supabase Bearer JWT. `/batch/nightly` is **not** in `PUBLIC_PATHS` (`auth.py:24`).

Router registration: `api/main.py:44–45` includes `insights.router` with no prefix, so the path is literally `POST /batch/nightly` (Traefik strips `/ai` in `docker-compose.yml:21–22`).

### 2.2 Top-level batch: `run_nightly_batch`

File: `PeakPerformanceData/ppp_ai_agent/agent/nightly_batch.py`

```
189:229:PeakPerformanceData/ppp_ai_agent/agent/nightly_batch.py
async def run_nightly_batch(organization_id: str | None = None) -> dict:
    ...
    athletes_result = await get_athletes(organization_id or "*", limit=500)
    athletes = athletes_result.get("athletes", [])
    ...
    for athlete in athletes:
        try:
            insight = await generate_athlete_brief(...)
            if insight:
                insight_id = await store_insight(insight)
                ...
        except Exception as e:
            ...
            errors += 1
```

Steps:

1. **Log start** — `logger.info("Starting nightly batch...")` (`194`).
2. **Fetch cohort** — `get_athletes(organization_id or "*", limit=500)` (`197`).
3. **Empty exit** — if no athletes, return zeros (`200–202`).
4. **Sequential athlete loop** — plain `for athlete in athletes:` (`207–222`). **Not** `asyncio.gather` across athletes; **not** a worker pool.
5. **Per athlete:** `generate_athlete_brief` → optional `store_insight`.
6. **Aggregate counters** — `athletes_processed`, `insights_generated`, `errors` (`225–229`).
7. **Return in-memory dict only** — no run row persisted.

### 2.3 Athlete cohort fetch

File: `PeakPerformanceData/ppp_ai_agent/tools/athletes.py:16–56`

- Table: Supabase REST `profiles`
- Filters: `organization_id=eq.{organization_id}`, `role=eq.player`
- Select: `id,full_name,email,date_of_birth`
- Order: `full_name`
- Limit: caller-supplied (batch uses **500**)

**Bug / gap when org omitted:** CLI and HTTP-without-query both pass `"*"` (`nightly_batch.py:197`), which becomes `organization_id=eq.*` — a literal match, **not** “all orgs”. There is no cross-org pagination/cursor. Hard cap 500 athletes; no offset.

Mapped fields: `id`, `name` ← `full_name` (`athletes.py:44–51`). Batch uses `athlete["id"]` and `athlete.get("name")` (`nightly_batch.py:209–211`).

**Coach assignment is unused:** `generate_athlete_brief` accepts `coach_id` (`58–63`) but the batch never passes it (`209–213`). Docstring coach-roster phase (lines `9–12`) is **not implemented**.

### 2.4 Per-athlete fan-out (data + LLM)

`generate_athlete_brief` (`58–164`):

1. **Concurrent data gather** (`67–71`):
   ```python
   activities, summary, sessions = await asyncio.gather(
       get_wearable_activities(athlete_id, days_back=1, limit=10),  # ClickHouse ow_workouts
       get_wearable_summary(athlete_id, days_back=1),               # ClickHouse ow_activity_summaries
       get_training_sessions(organization_id, athlete_id=..., days_back=1, limit=5),  # Supabase
   )
   ```
2. **Skip if empty** — if all three payloads lack rows, log and return `None` (`74–76`). Skip is **not** counted as an error.
3. **Build prompt context** — JSON dump of activities/summaries/sessions (`79–87`).
4. **LLM call with failover** — `with_failover(call_llm, user_prompt)` (`116`); OpenAI-compatible `chat/completions` via `httpx` timeout 30s (`93–113`); `temperature=0.3`, `response_format=json_object`.
5. **On LLM/provider failure** — log + return `None` (`117–122`) — **not** raised to the loop (so `errors` counter may stay 0 for LLM failures unless store fails).
6. **Build `Insight` pydantic model** (`125–161`) with `source="nightly_batch"`, `trigger="nightly"`.
7. **Schema build failure** — log + return `None` (`162–164`).

### 2.5 Error isolation between athletes

| Failure | Effect on others | Counter |
|---|---|---|
| Exception escaping `generate_athlete_brief` / unexpected | Caught in loop (`220–222`); next athlete continues | `errors += 1` |
| LLM/`ProviderError` inside brief | Returns `None`; loop continues | **not** incremented |
| No wearable/training data | Skip; continue | neither |
| `store_insight` fails / no id | continue | `errors += 1` (`218–219`) |

**Athlete-level isolation exists for unexpected exceptions.** There is **no** process-wide abort on single-athlete failure. There is also **no** retry queue for failed athletes.

### 2.6 Documented but missing phases

Module docstring (`1–12`) promises:

1. Athlete briefs — **partially implemented** (wearables + training only; no CGM/labs/tennis specialists).
2. Coach roster digest aggregating assigned athletes — **not implemented** (no coach loop, no digest function).

Sibling `agent/cgm_specialist.py` exposes `generate_cgm_nightly_insight` but is **never imported** by `nightly_batch.py`.

---

## 3. Where results are written

### 3.1 Intended write path

`store_insight` (`167–186`) POSTs to Supabase REST `insights` via `supabase_rpc("insights", method="POST", json_body={...})`.

Payload fields: `athlete_id`, `organization_id`, `coach_id`, `claim`, `category`, `confidence`, `evidence`, `actions`, `requires_coach_review`, `source`, `trigger`.

### 3.2 Actual database state (production)

Queried Supabase project `PeakPerformanceDataV2` (`bcfwtgqvusjhlrqsztod`):

- **Missing:** `insights`, `coach_reviews`, `feedback_events`
- **Present related AI tables:** `ai_audit_logs`, `ai_memories`, `ai_conversations`

No migration under `peak_performance_data/supabase/migrations/` creates an `insights` table.

**Conclusion:** Successful storage cannot work in current prod schema. Failures become log lines + `errors` increments; no durable insight cards.

### 3.3 HTTP / PostgREST return handling gaps

`tools/db.py:42–67` POST path:

- Sets `Content-Type: application/json`
- Does **not** set `Prefer: return=representation`
- Does **not** set `Prefer: resolution=merge-duplicates` (no upsert)
- `return resp.json()` then `result.get("id")` (`nightly_batch.py:183`)

Without `return=representation`, PostgREST often returns an empty array/`[]`, so `.get("id")` would raise `AttributeError` (caught → store returns `None` → `errors += 1`) even if a row were inserted. No Prefer headers anywhere in `ppp_ai_agent` (grep clean).

### 3.4 Other sinks

- **Logs only** for run progress/errors (stdlib `logging`).
- **No** ClickHouse writes from the batch.
- **No** Redis queue/cache usage in batch (redis is in `requirements.txt:10` but unused here).
- **No** `ai_audit_logs` / `ai_memories` writes from nightly batch.
- HTTP response body is the in-process counter dict only (`insights.py:41`).

---

## 4. Idempotency

**None.**

- Insert is plain POST (`nightly_batch.py:170–182`; `db.py:60–62`).
- No natural key / unique constraint referenced (e.g. `(athlete_id, source, trigger, date)`).
- No upsert / `on_conflict` / dedup key.
- Re-running the same night would **duplicate** insights if the table existed and inserts succeeded.
- Skip-if-no-data is not idempotency; it only avoids LLM spend when inputs are empty.

---

## 5. Failure / resume semantics

| Question | Answer |
|---|---|
| Checkpointing? | **No.** No cursor, no “last_athlete_id”, no run state table. |
| Crash at athlete 400/500? | Athletes 1–399 that already stored stay stored (if inserts worked). 400–500 are **lost for that run**. Restart reprocesses **everyone from the start** (duplicate risk). |
| Partial HTTP timeout? | Gunicorn `--timeout 120` (`Dockerfile:24`). Sequential LLM calls for hundreds of athletes will almost certainly exceed 120s; worker kill mid-loop with no resume. |
| Process model | In-request async work on the FastAPI worker — **not** a detached job. Client disconnect / worker recycle aborts the remainder. |
| Retries | Provider failover only (`with_failover`, `config/provider_router.py:100–123`). No athlete-level retry/backoff. |

---

## 6. Observability

What exists:

- `logger.info` start/complete (`194`, `224`)
- `logger.info` skip-no-data (`75`)
- `logger.error` LLM / build / store / per-athlete (`118–121`, `163`, `185`, `221`)
- Provider try/fail logs in `with_failover` (`116–121` of `provider_router.py`)
- HTTP return counters: `athletes_processed`, `insights_generated`, `errors`

What does **not** exist:

- Batch run / job ID record
- Metrics (Prometheus/OTel) — plan mentions OpenTelemetry (`_plans/ppd_agentic_layer_0167692b.plan.md` Phase 1) but not implemented in batch
- Per-athlete duration / token usage logging in this path
- Correlation IDs
- Alerting on error rate
- Structured audit row in `ai_audit_logs`

---

## 7. Concurrency and rate limiting

### 7.1 Across athletes

**Sequential.** One athlete at a time (`for` loop at `207`). Global LLM concurrency = **1** (plus failover retries on the same athlete).

### 7.2 Within an athlete

**3-way concurrent IO** via `asyncio.gather` (`67–71`): 2 ClickHouse queries + 1 Supabase GET.

### 7.3 Against LLM providers

- Failover chain only (`provider_router.py:61–91`, `100–123`): primary (`LLM_PRIMARY`, default deepseek) → fallback (`LLM_FALLBACK`, default groq) → any remaining configured providers.
- No token bucket, semaphore, QPS limit, or exponential backoff between athletes.
- 30s HTTP timeout per provider attempt (`nightly_batch.py:93`).

### 7.4 Against Supabase / ClickHouse

- Shared lazy `httpx.AsyncClient(timeout=15)` for Supabase (`db.py:48–50`).
- Shared singleton ClickHouse client (`db.py:26–39`).
- No concurrency caps, no retry/jitter, no circuit breaker.
- Because athletes are sequential, CH/Supabase load is naturally low — but a future parallel fan-out would hit them unbounded.

### 7.5 Deploy concurrency

Docker/gunicorn: **2 Uvicorn workers** (`Dockerfile:24`). Two simultaneous `POST /batch/nightly` calls could run two full sequential batches in parallel with **no distributed lock**, amplifying duplicate inserts and LLM spend.

---

## 8. How it is triggered in production today

### 8.1 Inside `ppp_ai_agent`

| Mechanism | Present? | Evidence |
|---|---|---|
| In-process scheduler (`schedule` / APScheduler) | **No** | Grep over `ppp_ai_agent` for cron/celery/temporal/apscheduler/schedule: no runtime scheduler |
| Celery / Temporal / Redis queue consumer | **No** | Not in code; redis dependency unused for jobs |
| CLI cron in Dockerfile/compose | **No** | `docker-compose.yml` runs only the API container; `CMD` is gunicorn (`Dockerfile:24`) |
| GitHub Actions schedule | **No** | No workflow under `ppp_ai_agent`; monorepo `.github/workflows` do not reference nightly batch / `batch/nightly` |
| HTTP self-call from startup | **No** | `api/main.py` has no lifespan scheduler |

### 8.2 Sibling schedulers (related timing, **not** wired)

| Service | Schedule | What it runs | Calls AI batch? |
|---|---|---|---|
| `ppd_extraction_backend` `MultiUserScheduler` | Daily `00:00` + hourly OW sync (`multi_user_scheduler.py:99–108`) | Garmin extract + OW→CH sync | **No** |
| `ppd_backend` `GraphScheduler` | Daily `01:00` UTC (`background_jobs/scheduler.py:32–33`) | Daily graphs + prewarm | **No** |
| `ppd_backend` / extraction `auto_deploy.sh` cron | Every 5 min | Deploy check | **No** |

The agentic plan *intended* Temporal after OW sync / ~01:00 graphs (`ppp_ai_agent/_plans/ppd_agentic_layer_0167692b.plan.md:112`, `183`), but that is design-only.

### 8.3 Deploy packaging blocker

`Dockerfile:13–16` copies only `api/`, `config/`, `schemas/`, `tools/`. **`agent/` is omitted.**  
`insights.py:18` imports `from agent.nightly_batch import run_nightly_batch` — this import fails at module load in the current image unless the image was built differently outside this Dockerfile.

### 8.4 Explicit conclusion

**NO production scheduler is wired to the nightly batch.** It can only run if something external POSTs `/batch/nightly` with internal auth, or an operator runs the module in an environment that includes the `agent` package and working DB schema. No such caller was found in the monorepo.

---

## 9. What durable execution must replace

To match the intended hybrid engine (plan Phase 2) and close the gaps above, a durable orchestrator (Temporal preferred per plan; Celery/Postgres queue also viable) needs to replace at least:

1. **External schedule + dependency ordering**  
   Trigger after OW sync / graph window (~00:30–02:00 UTC), not inside the FastAPI request path. Prefer Temporal Schedule (or cron → enqueue) that does **not** share gunicorn workers.

2. **Workflow + activities decomposition**  
   - Workflow: `NightlyBatchRun(org_id | all_orgs, run_date)`  
   - Activities: `listAthletes`, `fetchAthleteContext`, `generateBrief`, `storeInsight`, optional `generateCoachDigest`, optional `generateCgmInsight`  
   Each athlete (or org shard) as a child workflow / parallel activity with bounded concurrency.

3. **Checkpoint / resume**  
   Durable progress so crash at 400/500 resumes remaining IDs without redoing completed work (activity idempotency keys).

4. **Idempotency**  
   Dedup key e.g. `(organization_id, athlete_id, source='nightly_batch', brief_date)` with upsert; Temporal activity ID / workflow ID = `nightly-{date}-{org}` to prevent double schedules.

5. **Schema + Prefer headers**  
   Create `insights` (+ review/feedback) migrations; POST with `Prefer: return=representation,resolution=merge-duplicates`.

6. **Cohort correctness**  
   Replace `organization_id or "*"` with real multi-org iteration + pagination beyond 500.

7. **Rate limiting**  
   Worker-side semaphores for LLM QPS and CH/Supabase concurrency; reuse `with_failover` inside activities.

8. **Run record / observability**  
   Persist `batch_runs` (started_at, finished_at, counts, error samples); emit metrics; write token usage to `ai_audit_logs`.

9. **Decouple HTTP trigger**  
   `POST /batch/nightly` should enqueue a workflow and return `202 + run_id`, not await the full loop (avoids 120s gunicorn kill).

10. **Ship `agent/` in the image** (or run workers from a separate worker image that includes it).

11. **Implement missing coach digest** (and optionally CGM nightly) as separate activities gated on data availability.

---

## 10. File index (absolute paths)

| Role | Path |
|---|---|
| Batch implementation | `/Users/danielsilva/Desktop/PeakPerformanceDataMonorepo/PeakPerformanceData/ppp_ai_agent/agent/nightly_batch.py` |
| Empty package init | `/Users/danielsilva/Desktop/PeakPerformanceDataMonorepo/PeakPerformanceData/ppp_ai_agent/agent/__init__.py` |
| HTTP trigger | `/Users/danielsilva/Desktop/PeakPerformanceDataMonorepo/PeakPerformanceData/ppp_ai_agent/api/routes/insights.py` |
| App + router mount | `/Users/danielsilva/Desktop/PeakPerformanceDataMonorepo/PeakPerformanceData/ppp_ai_agent/api/main.py` |
| Auth gate | `/Users/danielsilva/Desktop/PeakPerformanceDataMonorepo/PeakPerformanceData/ppp_ai_agent/api/middleware/auth.py` |
| Athlete cohort | `/Users/danielsilva/Desktop/PeakPerformanceDataMonorepo/PeakPerformanceData/ppp_ai_agent/tools/athletes.py` |
| Supabase/CH clients | `/Users/danielsilva/Desktop/PeakPerformanceDataMonorepo/PeakPerformanceData/ppp_ai_agent/tools/db.py` |
| Wearables (CH) | `/Users/danielsilva/Desktop/PeakPerformanceDataMonorepo/PeakPerformanceData/ppp_ai_agent/tools/wearables.py` |
| Training (Supabase) | `/Users/danielsilva/Desktop/PeakPerformanceDataMonorepo/PeakPerformanceData/ppp_ai_agent/tools/training.py` |
| LLM failover | `/Users/danielsilva/Desktop/PeakPerformanceDataMonorepo/PeakPerformanceData/ppp_ai_agent/config/provider_router.py` |
| Insight schema | `/Users/danielsilva/Desktop/PeakPerformanceDataMonorepo/PeakPerformanceData/ppp_ai_agent/schemas/insight.py` |
| Unwired CGM nightly | `/Users/danielsilva/Desktop/PeakPerformanceDataMonorepo/PeakPerformanceData/ppp_ai_agent/agent/cgm_specialist.py` |
| Docker (no agent copy, 120s timeout) | `/Users/danielsilva/Desktop/PeakPerformanceDataMonorepo/PeakPerformanceData/ppp_ai_agent/Dockerfile` |
| Compose (API only) | `/Users/danielsilva/Desktop/PeakPerformanceDataMonorepo/PeakPerformanceData/ppp_ai_agent/docker-compose.yml` |
| Extraction schedule (upstream data) | `/Users/danielsilva/Desktop/PeakPerformanceDataMonorepo/PeakPerformanceData/ppd_extraction_backend/src/scheduler/multi_user_scheduler.py` |
| Graph schedule (parallel nightly) | `/Users/danielsilva/Desktop/PeakPerformanceDataMonorepo/PeakPerformanceData/ppd_backend/background_jobs/scheduler.py` |
| Design intent (Temporal) | `/Users/danielsilva/Desktop/PeakPerformanceDataMonorepo/PeakPerformanceData/ppp_ai_agent/_plans/ppd_agentic_layer_0167692b.plan.md` |

---

## 11. Durability gap checklist

- [ ] No scheduler wired (cron/Temporal/Celery/GHA) → batch never runs automatically  
- [ ] No durable job/run record or checkpoint/resume  
- [ ] No idempotent upsert / dedup keys  
- [ ] Sequential in-request execution vs gunicorn 120s timeout  
- [ ] Target tables `insights` (+ coach review/feedback) missing in prod  
- [ ] Docker image omits `agent/` package  
- [ ] Org `"*"` sentinel does not mean “all athletes”  
- [ ] Cap 500 athletes, no pagination  
- [ ] Coach roster digest documented but unimplemented  
- [ ] CGM nightly specialist exists but unwired  
- [ ] No LLM/Supabase/CH rate limits beyond natural sequential pacing  
- [ ] Dual gunicorn workers → possible concurrent duplicate runs  
- [ ] Observability limited to process logs + ephemeral counter JSON  
