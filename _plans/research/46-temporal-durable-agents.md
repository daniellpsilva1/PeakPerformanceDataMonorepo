# 46 — Temporal as Durable Execution for LLM Agents (and Realistic Alternatives)

**Date:** 2026-08-02  
**Scope:** External research only. Prioritizes 2025–2026 sources.  
**Audience:** Small team shipping a multi-agent Python sports-performance platform on a Hetzner box (Docker + Traefik + Redis + two other Python services).  
**Constraints that matter:** nightly batch for ~hundreds of athletes that must survive crashes and resume; event-driven triggers when new data lands; coach HITL gates lasting hours/days; retries against flaky LLM APIs; full auditability for GDPR and safety review; attention budget is scarce.

---

## Executive verdict (read this first)

| Question | Answer |
|---|---|
| Is Temporal the right *programming model* for agents? | **Yes.** Workflow = agent loop / orchestration; Activity = every LLM call and every tool side-effect. Always. |
| Should we self-host Temporal on the Hetzner box? | **No.** Not for a small team. Operational burden dwarfs the $100/mo Cloud plan. |
| Should we use Temporal Cloud (EU)? | **Yes as the production destination.** Essentials (~$100/mo) covers our scale with headroom. |
| What do we start with this week? | **DBOS Transact on Postgres** (library, no new cluster) *or* Temporal Cloud Essentials if we want one decision and no migration later. |
| Is LangGraph + Postgres checkpointer enough alone? | **For agent memory/resume inside a graph: partially. For the platform requirements listed above: no** — you will reinvent scheduling, leases, durable timers, approval inboxes, and audit export. |

**Ranked recommendation for our situation:** see §9.

---

## 1. How Temporal maps onto agent systems

### 1.1 The two primitives

Temporal’s model is a hard split:

| Primitive | Must be | Role in an agent |
|---|---|---|
| **Workflow** | Deterministic (replay-safe) | The agent *loop* and control flow: plan → call tools → decide → maybe wait for coach → continue. State lives in Workflow variables and is reconstructed by replaying Event History. |
| **Activity** | Non-deterministic, side-effecting, retryable | Every LLM call, every tool/API/DB write, every email/Slack notify, every embedding lookup. Results are recorded once and replayed as data. |

Official Temporal guidance (2024–2026) is explicit: non-deterministic LLM outcomes are fine — they belong in Activities. The Workflow orchestrates; it does not “think.”

Sources:

- [Of course you can build dynamic AI agents with Temporal](https://temporal.io/blog/of-course-you-can-build-dynamic-ai-agents-with-temporal)
- [Durable Execution meets AI](https://temporal.io/blog/durable-execution-meets-ai-why-temporal-is-the-perfect-foundation-for-ai)
- [How To Build a Durable AI Agent with Temporal and Python](https://learn.temporal.io/tutorials/ai/durable-ai-agent/)

### 1.2 Why the LLM call is *always* an Activity

1. **Non-determinism.** LLM outputs vary. Workflow code must produce the same commands when Temporal replays Event History after a crash. If the Workflow itself called the model, replay would generate a *new* plan and diverge from history → nondeterminism failure.
2. **Retries.** Activities have first-class retry policies (backoff, max attempts, non-retryable error types). Flaky OpenAI/Anthropic/Gemini timeouts belong here, not in ad-hoc `try/except` inside the loop.
3. **Idempotent resume.** After an Activity completes, its result is appended to history. On worker crash mid-loop, Temporal resumes *after* the last completed Activity — it does not re-bill or re-mutate for that step.
4. **Timeouts & heartbeats.** Long tool runs (analysis jobs, video pipelines) can heartbeat; LLM calls get start-to-close timeouts independent of the Workflow’s multi-day lifetime.

**Rule of thumb:** if it can fail, rate-limit, return different bytes, or have a side effect — it is an Activity. If it is `if/else`, `for`, `await wait_condition`, child-workflow fan-out, or timer logic — it is Workflow code.

### 1.3 Where the agent loop belongs

The agent loop (ReAct / tool-calling / multi-specialist routing) lives in the **Workflow**:

```text
while not done and steps < max_steps:
    decision = await execute_activity(llm_decide, state)   # Activity
    if decision.needs_human:
        await notify_coach(...)                            # Activity
        await wait_condition(approval, timeout=7 days)     # Workflow (durable)
    elif decision.tool:
        result = await execute_activity(run_tool, ...)     # Activity
        state.append(result)
    else:
        done = True
await execute_activity(persist_insights, state)            # Activity
```

On crash after step 7 of 12, Temporal replays the Workflow function from the top but *injects recorded Activity results* for steps 1–7, then continues at step 8. That is the entire value proposition.

For very long sessions, use `continue_as_new` so Event History does not grow without bound (Temporal documents this for long-lived agents).

### 1.4 Multi-agent shapes that fit

- **Parent Workflow** = nightly batch coordinator (fan-out child Workflows per athlete).
- **Child Workflow** = one athlete’s insight pipeline (isolation, independent retries, per-athlete search attributes for GDPR queries).
- **Nexus / signals across namespaces** = later, if you split services; ignore for v1.

---

## 2. Temporal AI / agent guidance (2025–2026)

### 2.1 Official content worth reading

| Resource | What it teaches | URL |
|---|---|---|
| Learn Temporal: Durable AI Agent (Python) | Full tutorial: Workflows orchestrate; Activities = LLM + tools; confirm gates | https://learn.temporal.io/tutorials/ai/durable-ai-agent/ |
| Blog: dynamic AI agents | Determinism vs dynamism explained cleanly | https://temporal.io/blog/of-course-you-can-build-dynamic-ai-agents-with-temporal |
| Blog: Durable Execution meets AI | Why agents need durable execution (memory, long-running, recovery) | https://temporal.io/blog/durable-execution-meets-ai-why-temporal-is-the-perfect-foundation-for-ai |
| AI Cookbook: HITL Python | Signals + `wait_condition` + timeout | https://docs.temporal.io/ai-cookbook/human-in-the-loop-python |
| Design pattern: Approval | Canonical approval with timeout / escalate | https://docs.temporal.io/design-patterns/approval |
| Guide: Reliable document approvals | Production-grade approvals, reminders, Updates | https://docs.temporal.io/guides/reliable-document-approvals |
| OpenAI Agents SDK + Temporal | Official integration; `TemporalRunner`, sandbox agents as Workflows | https://temporal.io/blog/introducing-temporal-and-agentic-sandboxes-openai-agents-sdk |

### 2.2 SDK helpers / samples (as of 2026)

- **Python SDK:** `temporalio` — Workflows, Activities, Signals, Queries, Updates, Schedules. Mature and production-proven.
- **OpenAI Agents SDK Temporal extension (GA reported March 2026 in secondary sources):** wraps agent runs as Activities; `activity_as_tool` helper. Sample path cited by Temporal: `openai/openai-agents-python/examples/sandbox/extensions/temporal`.
- **AI Cookbook** on docs.temporal.io: HITL, agentic tool-call loops, etc.
- Pattern recommendation from Temporal: Temporal is the *reliability layer under* LangGraph / OpenAI Agents / Pydantic AI — not a replacement for the agent framework.

### 2.3 Recommended Temporal patterns for agents

1. LLM + tools → Activities with aggressive retries on 429/5xx; non-retryable on 400 validation errors.
2. Agent loop → Workflow; cap steps; `continue_as_new` for long chats.
3. HITL → Signal or Update + durable `wait_condition` / timer (zero compute while waiting).
4. Payload size → do **not** put large LLM transcripts in history; store blobs in Postgres/S3 and pass references (or use payload codecs / offload). Temporal history has practical size limits; large prompts saturate history.
5. Audit → Event History *is* the audit log of orchestration; enrich with application-level audit rows for GDPR subject-access (who approved what, which model version, which prompt hash).

---

## 3. Human-in-the-loop: signals, updates, long timers

### 3.1 Primitives

| Primitive | Sync? | Returns value to caller? | Best for |
|---|---|---|---|
| **Signal** | Async fire-and-forget | No | Coach taps Approve in UI; webhook from Slack |
| **Update** | Sync; worker must accept/reject | Yes (+ validators) | UI needs immediate “accepted / invalid” feedback |
| **Query** | Sync read-only | Yes | Poll status for UI (“awaiting approval”) |
| **Timer / `wait_condition(..., timeout=)`** | Durable sleep | N/A | 7-day escalation; reminders |

While waiting, the Worker returns the task; the Workflow is persisted on the server and **consumes no worker compute**. Timers survive restarts. This is the correct model for “coach may take three days.”

Sources: [Approval pattern](https://docs.temporal.io/design-patterns/approval), [HITL cookbook](https://docs.temporal.io/ai-cookbook/human-in-the-loop-python), [Message passing](https://docs.temporal.io/encyclopedia/workflow-message-passing).

### 3.2 Concrete sketch: “wait for coach approval, up to 7 days, then escalate”

```python
# workflows/insight_approval.py
from __future__ import annotations

import asyncio
from dataclasses import dataclass
from datetime import timedelta
from typing import Literal, Optional

from temporalio import activity, workflow
from temporalio.common import RetryPolicy


@dataclass
class ApprovalDecision:
    status: Literal["approved", "rejected"]
    coach_id: str
    comment: str = ""


@dataclass
class InsightDraft:
    athlete_id: str
    insight_id: str
    summary: str
    risk_level: Literal["low", "high"]


@activity.defn
async def notify_coach(draft: InsightDraft) -> None:
    # push to inbox / email / Slack — side effect → Activity
    ...


@activity.defn
async def escalate_to_lead_coach(draft: InsightDraft) -> None:
    ...


@activity.defn
async def publish_insight(draft: InsightDraft, decision: Optional[ApprovalDecision]) -> str:
    ...


@workflow.defn
class CoachApprovalWorkflow:
    def __init__(self) -> None:
        self._decision: Optional[ApprovalDecision] = None

    @workflow.signal
    def submit_decision(self, decision: ApprovalDecision) -> None:
        # Idempotent: ignore late duplicates
        if self._decision is None:
            self._decision = decision

    @workflow.query
    def status(self) -> str:
        if self._decision is None:
            return "AWAITING_APPROVAL"
        return self._decision.status.upper()

    @workflow.run
    async def run(self, draft: InsightDraft) -> dict:
        if draft.risk_level == "low":
            insight_ref = await workflow.execute_activity(
                publish_insight,
                args=[draft, None],
                start_to_close_timeout=timedelta(minutes=2),
                retry_policy=RetryPolicy(maximum_attempts=5),
            )
            return {"outcome": "auto_published", "ref": insight_ref}

        await workflow.execute_activity(
            notify_coach,
            draft,
            start_to_close_timeout=timedelta(minutes=2),
            retry_policy=RetryPolicy(maximum_attempts=5),
        )

        try:
            await workflow.wait_condition(
                lambda: self._decision is not None,
                timeout=timedelta(days=7),
            )
        except asyncio.TimeoutError:
            await workflow.execute_activity(
                escalate_to_lead_coach,
                draft,
                start_to_close_timeout=timedelta(minutes=2),
            )
            return {"outcome": "escalated", "athlete_id": draft.athlete_id}

        if self._decision.status == "rejected":
            return {
                "outcome": "rejected",
                "by": self._decision.coach_id,
                "comment": self._decision.comment,
            }

        insight_ref = await workflow.execute_activity(
            publish_insight,
            args=[draft, self._decision],
            start_to_close_timeout=timedelta(minutes=2),
            retry_policy=RetryPolicy(maximum_attempts=5),
        )
        return {
            "outcome": "published",
            "ref": insight_ref,
            "by": self._decision.coach_id,
        }
```

Coach UI / API route (fire Signal):

```python
await client.get_workflow_handle(workflow_id).signal(
    CoachApprovalWorkflow.submit_decision,
    ApprovalDecision(status="approved", coach_id=coach_id, comment="Looks good"),
)
```

Prefer **Update** instead of Signal when the UI must validate (e.g. reject empty comments) and show synchronous errors. Prefer **Signal** when delivery must succeed even if no worker is currently polling (server buffers the Signal).

---

## 4. Self-hosting reality (brutal honesty)

### 4.1 What you must run

A production Temporal Service is not “one container”:

| Component | Role |
|---|---|
| **Frontend** | gRPC API for clients/workers |
| **History** | Owns Workflow state machines; shard-partitioned; memory-hungry |
| **Matching** | Task queue matching |
| **Internal Worker / System Worker** | Server-side background tasks |
| **Persistence DB** | Postgres *or* Cassandra/MySQL — **source of truth** |
| **Visibility store** | Often Elasticsearch or advanced Postgres visibility for UI search |
| **Web UI** | Ops / debugging |
| **(Optional)** Admin tools, metrics scrapers, multi-cluster replication for HA |

Docker Compose “dev” stacks exist; they are not a production HA posture.

Sources:

- [Production checklist](https://docs.temporal.io/self-hosted-guide/production-checklist)
- [Scaling Temporal: The basics](https://temporal.io/blog/scaling-temporal-the-basics)
- Field write-ups (2025): [piotrmucha.blog Temporal Deployment](https://piotrmucha.blog/2025/09/12/temporal-deployment/), [markaicode benchmarks](https://markaicode.com/benchmarks/temporal-production-benchmark-latency/)

### 4.2 Resource footprint (order of magnitude)

Published production-ish starting points (not our tiny nightly load — but what operators provision):

- History: ~4 CPU / 6–8+ GiB (keep memory &lt;70%)
- Frontend: ~1.5–2 CPU / 4 GiB
- Matching: ~1 CPU / 2 GiB
- Internal worker: ~0.5–1 CPU / 1 GiB
- Postgres: separate; often the **real** bottleneck (connections, `shared_buffers`, vacuum). Default `max_connections=100` is easy to exhaust.

Even a “small” HA-ish layout wants multiple replicas + a tuned Postgres — easily **another dedicated VM or a large slice of the Hetzner box**, competing with your two Python services and Redis.

**Shard count is set at cluster build time and cannot be changed without rebuild/migration.** Wrong guess = painful later.

### 4.3 Operational burden

Temporal’s own production checklist lists: scalability under spikes, uptime testing through upgrades, control plane (you build RBAC/audit if you need them — OSS does not ship Cloud-grade RBAC/audit), sequential minor-version upgrades (server ships as often as ~every two weeks), metrics across service/persistence/workflow completion, staffing people who understand Worker tuning and versioning (`patched` / GetVersion).

Upgrade pain is real: schema migrations + availability testing during upgrades. Persistence is the bottleneck under load. Multi-cluster replication for serious HA is another project.

### 4.4 Monitoring needs

Minimum viable ops surface:

- `service_requests` / `service_errors` / `service_latency`
- `persistence_requests` / `persistence_errors` / `persistence_latency`
- `workflow_success` / `workflow_failed` / `workflow_timeout`
- History pod memory, Postgres connections &amp; disk, schedule-to-start latency
- Alert on sticky Worker failures and workflow task timeouts

### 4.5 Should a small team self-host Temporal on one Hetzner box?

**No.**

Reasons specific to us:

1. We already run Traefik + Redis + two Python services on that box. Adding a multi-service Temporal cluster + Postgres for Temporal is a third production system with sharper failure modes than Celery.
2. Our throughput (hundreds of nightly Workflows) does **not** justify self-host economics — Cloud Essentials is cheaper than one on-call evening.
3. GDPR/safety review benefits from Cloud’s audit logging / SSO on paid tiers; OSS self-host makes you build that.
4. Previous plan proposed Temporal and nothing shipped — classic signal that infra weight exceeded team capacity.

**Exception:** a single-node Temporal + Postgres for *local/dev* only (`temporal server start-dev`) is fine. Production control plane should not live on the same box as the app workers unless you hire platform time.

---

## 5. Temporal Cloud: pricing at our scale + EU regions

### 5.1 Pricing model (2025 update, still current in 2026 docs)

- **Plans:** Essentials from **$100/mo**, Business from **$500/mo**, Enterprise/Mission Critical = sales.
- Essentials includes **~1M Actions/mo** (and storage allocation); Business **~2.5M**.
- Overage Actions: **$50 / million** for first 5M beyond allocation, sliding to **$25 / million** at higher tiers.
- Active storage **$0.042 / GBh**; retained storage **$0.00105 / GBh**.
- Plan fee is the greater of the floor or 5–10% of usage spend.
- Free credits commonly advertised (~$1,000) for new accounts — confirm at signup.

Sources:

- https://temporal.io/pricing  
- https://docs.temporal.io/cloud/pricing  
- https://docs.temporal.io/cloud/actions  
- https://temporal.io/blog/temporal-cloud-pricing-update (Jan/Feb 2025 pricing change)

### 5.2 What is an Action? (for estimation)

Billable examples: Workflow started, Activity started/retried, Timer started, Signal sent, Update accepted/rejected, Query received, Schedule firing (Schedule accounts for multiple Actions per tick), Activity heartbeats that reach the server.

Replay on the Worker does **not** bill Actions.

### 5.3 Estimate for Peak Performance (~500 nightly + event/interactive)

Assumptions (conservative for a multi-step insight agent):

| Path | Workflows / day | Actions / Workflow (rough) | Actions / day |
|---|---:|---:|---:|
| Nightly per-athlete | 500 | 15–25 (fetch, 1–3 LLM, tools, persist, notify) | 7,500–12,500 |
| Event-driven (new match / wearable) | 100 | 15 | 1,500 |
| Interactive / coach chat agents | 50 | 30 | 1,500 |
| HITL signals + timers | — | +2–4 on gated runs | ~500 |
| **Total** | | | **~11k–16k / day** |

Monthly ≈ **330k–480k Actions** — **comfortably inside Essentials’ 1M included Actions**.

**Expected bill: ~$100/mo Essentials** (plan floor), storage negligible at this volume, unless we retain huge histories or enable HA (2× usage multiplier when HA replicas enabled).

If we later fan out 10 Activities per specialist × 5 specialists × 2k athletes, we might approach 2–5M Actions/mo → still low hundreds of USD, not thousands.

### 5.4 EU region availability

Temporal Cloud is available in Europe on AWS and GCP, including:

- AWS `eu-central-1` (Frankfurt) — `aws-eu-central-1`
- AWS `eu-west-1` (Ireland)
- AWS `eu-west-2` (London)
- GCP `europe-west3` (Frankfurt)

Multi-region replication among EU AWS regions is supported; multi-cloud to GCP Frankfurt as well.

Source: https://docs.temporal.io/cloud/regions

**GDPR posture:** put the Namespace in `aws-eu-central-1` (or `gcp-europe-west3`). Workers stay on Hetzner EU. Still perform a DPA / subprocessor review with Temporal — standard Cloud diligence, not a blocker.

---

## 6. Competition (equal rigor)

Legend for durability: **Strong** = journal/replay or equivalent step checkpointing with crash resume; **Medium** = task ack + retries but weak multi-day wait / incomplete history; **DIY** = you build the missing pieces.

### 6.1 Restate

| Dimension | Assessment |
|---|---|
| **Model** | Journal-and-replay durable handlers; Virtual Objects for keyed state; awakeables for callbacks/HITL; `ctx.run` steps. |
| **Durability** | Strong — same family as Temporal. Claims narrower exactly-once gap for handlers vs classic at-least-once activities. |
| **HITL** | First-class awakeables + durable sleeps; good fit for multi-day approvals. |
| **Ops** | **Single binary** (embedded log). Self-host far lighter than Temporal. Cloud + BYOC available. |
| **Cost** | OSS self-host free (BSL). Cloud free tier **50k actions/mo**; paid tiers reported from ~$75/mo (5M actions) upward (verify on https://www.restate.dev/cloud — page is JS-heavy). BYOC capacity-priced for high volume. |
| **Python** | Official `restate_sdk` (PyPI); SDK 1.x in 2026; smaller ecosystem than Temporal’s Python SDK. |
| **Fit for us** | Best self-hostable Temporal-class alternative if we refuse Cloud. Still a new runtime to learn. |

Sources: https://www.restate.dev/vs/temporal · https://docs.restate.dev · https://github.com/restatedev/sdk-python · Restate Cloud public launch (2025).

### 6.2 Inngest

| Dimension | Assessment |
|---|---|
| **Model** | Event-driven durable functions; `step.run`, `step.sleep`, `step.waitForEvent`. |
| **Durability** | Strong at step boundaries; memoized step results. |
| **HITL** | Excellent — `waitForEvent` / realtime patterns; pause indefinitely. |
| **Ops** | Managed Cloud pushes work to your app over HTTP (or connect workers). Self-host OSS possible but Cloud is the product. |
| **Cost** | Hobby $0 (50k executions); **Pro $99/mo** with **1M executions** included. An execution = function run **+ each step**. Agent loops with many `step.run` calls burn quota fast. |
| **Python** | Official `inngest` SDK (Flask/FastAPI/Django). Ecosystem still TS-leaning. |
| **Fit for us** | Strong if we want managed orchestration without Temporal’s mental model. Step metering can surprise agent workloads. |

Sources: https://www.inngest.com/pricing · https://www.inngest.com/platform/durable-execution · https://github.com/inngest/inngest-py

### 6.3 DBOS

| Dimension | Assessment |
|---|---|
| **Model** | Library in-process; checkpoints workflows/steps/queues in **Postgres**. No external orchestrator. |
| **Durability** | Strong for step/workflow checkpoints; recovery on process restart. Throughput ceiling tied to Postgres — fine at our scale. |
| **HITL** | `send`/`recv` style messaging and sleeps; supported for pause/resume. Younger pattern library than Temporal’s approval docs. |
| **Ops** | **Lowest** among durable options — install library, point at Postgres. Optional Conductor console. |
| **Cost** | Library OSS free. Conductor **Pro $99/mo** (1M checkpoints), Teams **$499/mo**. |
| **Python** | First-class (`dbos-transact-py`). Integrates with OpenAI Agents, Pydantic AI, etc. |
| **Fit for us** | Best “start here” on existing Postgres/Supabase. Matches small-team attention budget. |

Sources: https://github.com/dbos-inc/dbos-transact-py · https://www.dbos.dev/compare/dbos-vs-temporal · https://dbos.dev/dbos-pricing

### 6.4 Hatchet

| Dimension | Assessment |
|---|---|
| **Model** | Postgres-backed durable task queue + durable tasks (sleeps, event waits, child spawns). |
| **Durability** | Strong for durable tasks; event log checkpoints. |
| **HITL** | `aio_wait_for` / event conditions — designed for hours/days waits without holding worker slots. |
| **Ops** | Docker Compose + Postgres is realistic; much lighter than Temporal. Cloud available. |
| **Cost** | MIT self-host free. Cloud: free Developer tier (often cited **100k runs/mo**), Team tiers from hundreds USD (confirm https://hatchet.run/pricing). |
| **Python** | Native SDK; good DX for queues + agents. |
| **Fit for us** | Excellent self-host candidate on Hetzner if we want durable queues without Temporal Cloud. Younger than Temporal; validate compliance/audit needs. |

Sources: https://hatchet.run/versus/hatchet-vs-temporal · https://docs.hatchet.run/v1/durable-event-waits · https://github.com/hatchet-dev/hatchet

### 6.5 Prefect

| Dimension | Assessment |
|---|---|
| **Model** | Python `@flow` / `@task`; dynamic control flow; result caching; hybrid workers. |
| **Durability** | Improved durable execution + result persistence; historically stronger as data/ML orchestrator than as multi-day business workflow engine. |
| **HITL** | `pause_flow_run` with UI forms — good productized HITL. |
| **Ops** | Cloud control plane + workers in our VPC/Docker; or self-host Prefect Server. |
| **Cost** | Seat-based Cloud (Hobby free; Starter ~$100/mo; Team seat pricing). Unlimited runs on many tiers — friendly to chatty agent loops. |
| **Python** | Best-in-class Python DX. |
| **Fit for us** | Great for batch analytics pipelines; workable for agents; weaker “Workflow as long-lived entity” story than Temporal/Restate for 7-day approvals at scale. |

Sources: https://www.prefect.io/ · https://www.prefect.io/solutions/agents · community pricing writeups 2026.

### 6.6 Celery + Redis (we already have Redis)

| Dimension | Assessment |
|---|---|
| **Model** | Distributed task queue; acks; retries; routing. |
| **Durability** | **Medium.** Broker durability ≠ workflow history. In-flight complex state is on you. Redis loss / visibility timeout bugs are classic. |
| **HITL** | **DIY.** Holding a worker for 7 days is wrong; you must persist “awaiting approval” in DB and re-enqueue later — i.e. invent a state machine. |
| **Ops** | Low if already familiar; we have Redis. Still need Flower/metrics, poison queues, idempotency keys. |
| **Cost** | Infra only (already paid). |
| **Python** | Excellent, mature. |
| **Fit for us** | Fine for “send email” / “run report now.” **Not** sufficient alone for crash-safe agent loops + multi-day HITL + audit-grade history. |

### 6.7 Plain Postgres job queue (`FOR UPDATE SKIP LOCKED`)

| Dimension | Assessment |
|---|---|
| **Model** | Claims rows as jobs; workers process; status columns. |
| **Durability** | **DIY Strong-ish** if you design well (outbox, leases, heartbeats, dead-letter). Many companies run this forever. |
| **HITL** | Rows with `status=awaiting_approval` + `wake_at` — works, but you build timers, escalation cron, and idempotency. |
| **Ops** | Lowest dependency count; highest application code ownership. |
| **Cost** | Postgres you already run. |
| **Python** | Trivial. |
| **Fit for us** | Acceptable **bootstrap** for nightly batch only. Will become a poorly specified workflow engine by month six if we add agents + HITL + GDPR audit. |

### 6.8 Comparison matrix (our requirements)

| System | Crash resume | Multi-day HITL | LLM retries | Audit trail | Ops burden (small team) | $/mo at our scale | Python |
|---|---|---|---|---|---|---|---|
| Temporal Cloud | Excellent | Excellent | Excellent | Excellent (history + Cloud audit) | Low (workers only) | ~$100 | Excellent |
| Temporal self-host | Excellent | Excellent | Excellent | History yes; RBAC/audit DIY | **Very high** | Infra +++ | Excellent |
| Restate | Excellent | Excellent | Excellent | Journal + UI | Low–med | $0–75+ | Good (younger) |
| DBOS | Excellent | Good | Excellent | Checkpoints + Conductor | **Lowest** | $0–99 | Excellent |
| Hatchet | Excellent | Excellent | Excellent | Event log + UI | Low–med | $0–Cloud | Excellent |
| Inngest | Excellent | Excellent | Excellent | Traces | Low (Cloud) | ~$99 | Good |
| Prefect | Good | Good | Good (cache) | Flow run UI | Low–med | ~$100 seats | Excellent |
| Celery+Redis | Partial | DIY | Partial | DIY | Low | $0 | Excellent |
| SKIP LOCKED | DIY | DIY | DIY | DIY | Low infra / high code | $0 | Excellent |
| LangGraph+PG | Graph-level | Interrupt-based | App-level | Checkpoints | Low infra / med code | $0 | Excellent |

---

## 7. LangGraph Postgres checkpointer + scheduler — argue the case seriously

### 7.1 What it actually gives you

LangGraph persistence (2025–2026 docs):

- **Checkpointers** snapshot graph state after supersteps (`PostgresSaver` / `AsyncPostgresSaver`).
- Enables crash recovery *of the graph*, time-travel, and HITL **interrupts** (pause node, human edits state, resume).
- Durability modes: `exit` / `async` / `sync` — trade performance vs crash consistency.
- **Stores** for long-term cross-thread memory.

Sources:

- https://docs.langchain.com/oss/python/langgraph/persistence  
- https://docs.langchain.com/oss/python/langgraph/checkpointers  
- https://docs.langchain.com/oss/python/langgraph/durable-execution  

With a **simple scheduler** (cron → enqueue athlete IDs) and a **worker process** that runs `graph.ainvoke(..., config={"configurable": {"thread_id": ...}})`, you get:

- Nightly batch that can resume a partially completed athlete thread after worker restart (if durability mode is strong enough — prefer `sync` for money/safety steps).
- HITL via interrupt + external API that updates state and resumes.
- Python-native agent graphs (specialists as nodes) without learning Temporal.

### 7.2 Why this might be enough for *us*

Honest pro-case:

1. **Our scale is tiny.** 500 athletes/night is not Netflix. Postgres handles the checkpoint write load easily.
2. **We already need Postgres** for product data and GDPR records. One more schema (`checkpoints`, `checkpoint_writes`) is cheaper than a Temporal cluster.
3. **Agent framework proximity.** If specialists are LangGraph graphs, the checkpointer *is* the natural durability boundary; wrapping every node in Temporal Activities can feel like double orchestration.
4. **Shipping beats architecture.** A previous Temporal plan never deployed. LangGraph + cron + SKIP LOCKED jobs might ship in a week.
5. **Attention tax.** Every new daemon (Temporal History, Matching, …) is a page at 3am. Checkpointers are “just SQL.”

For a **v0 nightly insight generator** with optional coach review stored as DB rows (not a 7-day durable timer inside an orchestrator), LangGraph+PG is a defensible MVP.

### 7.3 Where it stops being enough

Requirements we stated that LangGraph does **not** fully own:

| Requirement | Gap |
|---|---|
| Survive crashes *and* resume without re-calling LLMs | Need `sync` durability + idempotent tools; easy to get wrong with `async` mode |
| Event-driven triggers at platform level | You still need a queue/bus (Redis/PG) and lease semantics |
| Coach may take **days** while workflow stays alive | Interrupt + external resume works, but **durable timers/escalation/reminders** are DIY crons |
| Retries against flaky LLMs | Per-node retry policies are app code; no standardized Activity retry UX |
| Full auditability of every agent run | Checkpoints ≠ compliance-grade audit (who approved, model version, prompt hash, retention, export). You will build an `agent_runs` table anyway |
| Multi-agent fan-out with per-child isolation | Parent/child Workflow semantics, search attributes, cancellation trees — DIY |
| Worker fleet coordination | No built-in task queue fairness, sticky execution, or schedule-to-start metrics |

LangGraph’s own positioning increasingly points to **LangSmith Deployment** for production long-running agents — i.e. they know checkpointers alone are not a full control plane.

### 7.4 Verdict on LangGraph-only

**Sufficient to avoid a workflow engine for:** single-graph agents, short-to-medium runs, HITL measured in minutes/hours with an application-owned inbox, team willing to own job leases and escalation cron.

**Insufficient as the sole durability layer for:** the full platform brief (nightly batch + event-driven + multi-day coach gates + GDPR/safety audit + flaky LLM retries as a solved primitive). You will reinvent 40–60% of Temporal/DBOS/Hatchet — poorly.

**Pragmatic synthesis:** use LangGraph (or Pydantic AI / custom loop) *inside* Activities/steps, and put a real durable executor *underneath* when HITL spans days or compliance asks “show me every tool call for athlete X on date Y.”

---

## 8. Recommendation for our exact situation

### 8.1 Constraints → weights

- Small team, high attention cost → **minimize new clusters**
- Already on Hetzner Docker/Traefik/Redis → **workers local, control plane preferably managed or library**
- GDPR / safety review → **EU data plane + exportable history**
- Multi-day HITL → **must be a solved primitive**, not a cron hack
- Prior Temporal plan never shipped → **prefer path that can demo in days**

### 8.2 Ranked recommendation

| Rank | Choice | Role |
|---:|---|---|
| **1** | **Temporal Cloud Essentials, Namespace `aws-eu-central-1` (Frankfurt); Workers on Hetzner** | Production destination. Matches every hard requirement. ~$100/mo. |
| **2** | **DBOS Transact on existing Postgres** | Best start-here / lowest ops. Same durability ideas; graduate if we need Cloud-grade UI/RBAC/multi-product maturity. |
| **3** | **Hatchet self-host (Postgres) or Hatchet Cloud** | If we want Temporal-like HITL but insist on self-hosting the orchestrator on the box. |
| **4** | **Restate Cloud or single-binary Restate** | Excellent engineering; slightly more platform-risk (younger Python ecosystem). |
| **5** | **Inngest Cloud** | Fastest managed DX; watch step metering; Python second-class vs TS. |
| **6** | **Prefect Cloud + Docker workers** | If the workload skews data/ML batch more than long-lived business workflows. |
| **7** | **LangGraph Postgres checkpointer + PG `SKIP LOCKED` scheduler** | MVP-only; accept DIY timers/audit. |
| **8** | **Celery + Redis** | Only for dumb jobs; not agents. |
| **❌** | **Self-hosted Temporal cluster on the Hetzner box** | Reject for small-team production. |

### 8.3 “Start here, graduate to that”

**Path A — one decision (preferred if we can spend ~1 week on Temporal learning):**

1. Week 1: Temporal Cloud Essentials EU + Python worker container behind Traefik (outbound to Cloud only).
2. Implement nightly Schedule → parent Workflow → child per athlete; LLM/tools as Activities.
3. Wire coach approval Signal from existing Next.js/API.
4. Export histories / application audit table for GDPR.

**Path B — ship fastest, migrate later (if Temporal fear is blocking):**

1. **Start here:** DBOS workflows/steps on Postgres for nightly insights + `send`/`recv` approval; cron trigger; Redis optional for pub/sub notify only.
2. Keep agent logic in plain Python (or LangGraph nodes called from DBOS steps).
3. **Graduate to Temporal Cloud** when: (a) multi-day approvals + escalations proliferate, (b) compliance wants richer history/RBAC, (c) fan-out / versioning / multi-agent cancellation becomes painful in DBOS, or (d) we hire enough that Cloud’s UI pays for itself.

Do **not** start with self-hosted Temporal “to save $100.” That is false economy.

### 8.4 Self-host Temporal verdict (explicit)

**Do not self-host Temporal in production on our current footprint.** Use Temporal Cloud or pick a lighter durable layer (DBOS/Hatchet/Restate). Revisit self-host only with a dedicated platform engineer and Kubernetes (or equivalent), not a shared Hetzner Docker host.

---

## 9. Concrete code sketch — top recommendation (Temporal Cloud)

Nightly insight batch: Schedule fires a coordinator Workflow; fan-out children; each child runs the agent loop; high-risk drafts wait for coach approval up to 7 days.

```python
# workflows/nightly_insights.py
from __future__ import annotations

import asyncio
from dataclasses import dataclass
from datetime import timedelta
from typing import Any, Literal, Optional

from temporalio import activity, workflow
from temporalio.common import RetryPolicy
from temporalio.workflow import ParentClosePolicy

# --- Activities (LLM + I/O always here) ---------------------------------------

@dataclass
class AthleteRef:
    athlete_id: str


@dataclass
class AgentDecision:
    kind: Literal["tool", "finalize", "needs_approval"]
    tool_name: str | None = None
    tool_args: dict[str, Any] | None = None
    draft_summary: str | None = None
    risk_level: Literal["low", "high"] = "low"


@dataclass
class ApprovalDecision:
    status: Literal["approved", "rejected"]
    coach_id: str
    comment: str = ""


LLM_RETRY = RetryPolicy(
    initial_interval=timedelta(seconds=2),
    backoff_coefficient=2.0,
    maximum_interval=timedelta(minutes=2),
    maximum_attempts=8,
    non_retryable_error_types=["ValueError"],
)


@activity.defn
async def list_athletes_for_nightly() -> list[AthleteRef]:
    ...


@activity.defn
async def load_athlete_context(athlete_id: str) -> dict[str, Any]:
    ...


@activity.defn
async def llm_agent_step(state: dict[str, Any]) -> AgentDecision:
    # Call OpenAI/Gemini/etc. — NEVER from Workflow code
    ...


@activity.defn
async def run_tool(tool_name: str, tool_args: dict[str, Any], athlete_id: str) -> Any:
    ...


@activity.defn
async def persist_insight(athlete_id: str, payload: dict[str, Any]) -> str:
    ...


@activity.defn
async def notify_coach_inbox(athlete_id: str, insight_id: str, summary: str) -> None:
    ...


@activity.defn
async def escalate_stale_approval(athlete_id: str, insight_id: str) -> None:
    ...


# --- Per-athlete child workflow ----------------------------------------------

@workflow.defn
class AthleteNightlyInsightWorkflow:
    def __init__(self) -> None:
        self._approval: Optional[ApprovalDecision] = None

    @workflow.signal
    def coach_decision(self, decision: ApprovalDecision) -> None:
        if self._approval is None:
            self._approval = decision

    @workflow.query
    def approval_status(self) -> str:
        return "pending" if self._approval is None else self._approval.status

    @workflow.run
    async def run(self, athlete: AthleteRef) -> dict[str, Any]:
        ctx = await workflow.execute_activity(
            load_athlete_context,
            athlete.athlete_id,
            start_to_close_timeout=timedelta(minutes=5),
            retry_policy=LLM_RETRY,
        )
        state: dict[str, Any] = {"athlete_id": athlete.athlete_id, "context": ctx, "trace": []}

        for step in range(12):
            decision = await workflow.execute_activity(
                llm_agent_step,
                state,
                start_to_close_timeout=timedelta(minutes=3),
                retry_policy=LLM_RETRY,
            )
            state["trace"].append({"step": step, "decision": decision})

            if decision.kind == "tool":
                result = await workflow.execute_activity(
                    run_tool,
                    args=[decision.tool_name, decision.tool_args or {}, athlete.athlete_id],
                    start_to_close_timeout=timedelta(minutes=10),
                    retry_policy=LLM_RETRY,
                )
                state["trace"].append({"tool_result": result})
                continue

            if decision.kind == "needs_approval":
                insight_id = await workflow.execute_activity(
                    persist_insight,
                    args=[athlete.athlete_id, {"status": "pending_approval", "summary": decision.draft_summary}],
                    start_to_close_timeout=timedelta(minutes=2),
                    retry_policy=LLM_RETRY,
                )
                await workflow.execute_activity(
                    notify_coach_inbox,
                    args=[athlete.athlete_id, insight_id, decision.draft_summary or ""],
                    start_to_close_timeout=timedelta(minutes=2),
                    retry_policy=LLM_RETRY,
                )
                try:
                    await workflow.wait_condition(
                        lambda: self._approval is not None,
                        timeout=timedelta(days=7),
                    )
                except asyncio.TimeoutError:
                    await workflow.execute_activity(
                        escalate_stale_approval,
                        args=[athlete.athlete_id, insight_id],
                        start_to_close_timeout=timedelta(minutes=2),
                    )
                    return {"athlete_id": athlete.athlete_id, "outcome": "escalated", "insight_id": insight_id}

                if self._approval.status == "rejected":
                    return {
                        "athlete_id": athlete.athlete_id,
                        "outcome": "rejected",
                        "insight_id": insight_id,
                        "by": self._approval.coach_id,
                    }

                published_id = await workflow.execute_activity(
                    persist_insight,
                    args=[
                        athlete.athlete_id,
                        {
                            "status": "published",
                            "summary": decision.draft_summary,
                            "approved_by": self._approval.coach_id,
                        },
                    ],
                    start_to_close_timeout=timedelta(minutes=2),
                    retry_policy=LLM_RETRY,
                )
                return {"athlete_id": athlete.athlete_id, "outcome": "published", "insight_id": published_id}

            # finalize
            insight_id = await workflow.execute_activity(
                persist_insight,
                args=[athlete.athlete_id, {"status": "published", "summary": decision.draft_summary}],
                start_to_close_timeout=timedelta(minutes=2),
                retry_policy=LLM_RETRY,
            )
            return {"athlete_id": athlete.athlete_id, "outcome": "published", "insight_id": insight_id}

        return {"athlete_id": athlete.athlete_id, "outcome": "max_steps"}


# --- Nightly coordinator -----------------------------------------------------

@workflow.defn
class NightlyInsightBatchWorkflow:
    @workflow.run
    async def run(self) -> dict[str, Any]:
        athletes = await workflow.execute_activity(
            list_athletes_for_nightly,
            start_to_close_timeout=timedelta(minutes=5),
            retry_policy=LLM_RETRY,
        )

        # Bound concurrency: start children in waves of 25
        results: list[dict[str, Any]] = []
        wave = 25
        for i in range(0, len(athletes), wave):
            chunk = athletes[i : i + wave]
            handles = []
            for a in chunk:
                handles.append(
                    await workflow.start_child_workflow(
                        AthleteNightlyInsightWorkflow.run,
                        a,
                        id=f"nightly-insight-{a.athlete_id}-{workflow.info().workflow_id}",
                        parent_close_policy=ParentClosePolicy.ABANDON,
                        # ABANDON: child can outlive parent while waiting days for coach
                        execution_timeout=timedelta(days=10),
                    )
                )
            # Optionally await only non-HITL; or await all with long timeout
            for h in handles:
                results.append(await h)

        return {"count": len(results), "results": results}
```

Worker + Cloud client sketch:

```python
# worker_main.py
import asyncio
import os
from temporalio.client import Client
from temporalio.service import TLSConfig
from temporalio.worker import Worker

async def main() -> None:
    client = await Client.connect(
        os.environ["TEMPORAL_HOST"],  # e.g. eu-central-1.aws.api.temporal.io:7233
        namespace=os.environ["TEMPORAL_NAMESPACE"],
        api_key=os.environ["TEMPORAL_API_KEY"],
        tls=True,
    )
    worker = Worker(
        client,
        task_queue="insights",
        workflows=[NightlyInsightBatchWorkflow, AthleteNightlyInsightWorkflow],
        activities=[
            list_athletes_for_nightly,
            load_athlete_context,
            llm_agent_step,
            run_tool,
            persist_insight,
            notify_coach_inbox,
            escalate_stale_approval,
        ],
    )
    await worker.run()

if __name__ == "__main__":
    asyncio.run(main())
```

Create a Temporal **Schedule** (CLI or API) to start `NightlyInsightBatchWorkflow` daily at 02:00 Europe/Madrid. Event-driven path: on “new SwingVision match” webhook, `client.start_workflow(AthleteNightlyInsightWorkflow.run, ...)`.

---

## 10. Source index (primary)

### Temporal
- https://learn.temporal.io/tutorials/ai/durable-ai-agent/
- https://temporal.io/blog/of-course-you-can-build-dynamic-ai-agents-with-temporal
- https://temporal.io/blog/durable-execution-meets-ai-why-temporal-is-the-perfect-foundation-for-ai
- https://temporal.io/blog/introducing-temporal-and-agentic-sandboxes-openai-agents-sdk
- https://docs.temporal.io/ai-cookbook/human-in-the-loop-python
- https://docs.temporal.io/design-patterns/approval
- https://docs.temporal.io/guides/reliable-document-approvals
- https://docs.temporal.io/cloud/pricing
- https://docs.temporal.io/cloud/actions
- https://docs.temporal.io/cloud/regions
- https://docs.temporal.io/self-hosted-guide/production-checklist
- https://temporal.io/blog/scaling-temporal-the-basics
- https://temporal.io/blog/temporal-cloud-pricing-update

### Alternatives
- Restate: https://www.restate.dev/vs/temporal · https://docs.restate.dev · https://github.com/restatedev/sdk-python
- Inngest: https://www.inngest.com/pricing · https://www.inngest.com/platform/durable-execution · https://github.com/inngest/inngest-py
- DBOS: https://github.com/dbos-inc/dbos-transact-py · https://dbos.dev/dbos-pricing · https://www.dbos.dev/compare/dbos-vs-temporal
- Hatchet: https://hatchet.run/versus/hatchet-vs-temporal · https://docs.hatchet.run/v1/durable-event-waits · https://github.com/hatchet-dev/hatchet
- Prefect: https://www.prefect.io/ · https://www.prefect.io/solutions/agents
- LangGraph: https://docs.langchain.com/oss/python/langgraph/persistence · https://docs.langchain.com/oss/python/langgraph/checkpointers

### Secondary / field reports (use cautiously)
- https://particula.tech/blog/durable-execution-ai-agents-temporal-inngest-restate
- https://zylos.ai/research/2026-04-24-durable-execution-agent-runtimes/
- https://piotrmucha.blog/2025/09/12/temporal-deployment/
- https://alatirok.com/durable-execution-ai-agents-compared/
- https://devtune.ai/verticals/workflow-orchestration-and-durable-execution/restate (Restate Cloud tier numbers — verify on vendor site)

---

## 11. Decision checklist (print this)

- [ ] Reject self-hosted Temporal on shared Hetzner host  
- [ ] Choose Path A (Temporal Cloud EU) or Path B (DBOS → Temporal Cloud)  
- [ ] Put LLM + tools exclusively in Activities/steps  
- [ ] Implement coach approval with durable wait ≤ 7 days + escalation  
- [ ] Store large prompts/results out-of-band; keep history references  
- [ ] Application-level `agent_run_audit` table for GDPR SAR (don’t rely on orchestrator UI alone)  
- [ ] Budget ~$100/mo orchestrator SaaS; spend attention on agent quality, not History pods  

---

*End of dossier.*
