# LangGraph — Deep Critical Evaluation

**Research date:** 2026-08-02  
**Scope:** Python FastAPI multi-agent sports-performance platform (self-hosted Hetzner / Docker / Traefik; Supabase Postgres; ClickHouse; Redis; Next.js + Vercel AI SDK client)  
**Method:** Official docs via web fetch + production critique sources (2025–2026 prioritized)

---

## 1. Executive verdict

**LangGraph is a strong fit for deterministic multi-agent control, provider freedom, HITL pause/resume with Postgres, and SSE streaming from a FastAPI process — but it is not a Temporal-class durable workflow engine.**

For our coach approval queue that can sit idle for hours or days: **HITL state durability is first-class and production-viable** with `AsyncPostgresSaver` + `interrupt()` + `Command(resume=...)`. The paused graph does not need a live process; resuming days later works if the checkpoint survives.

For nightly batch across hundreds of athletes: **checkpointing alone is insufficient**. You still need an external scheduler/worker/lease layer (or Temporal / Agent Server queue) to detect crashed runs, prevent double-resume, and fan out work. LangGraph persists *state*; you must own *execution lifecycle*.

**Bottom line for PPD:** Use LangGraph as the agent orchestration library inside FastAPI; pair it with Postgres checkpointer + your own Redis/queue job runner for batch; keep telemetry on-prem (Langfuse/OTel). Skip LangGraph Platform/Agent Server unless you want to buy Enterprise self-host for the task queue.

---

## 2. Current version and API stability

| Package | Version (PyPI, 2026-08-02) | Notes |
|---------|---------------------------|--------|
| `langgraph` | **1.2.10** | Requires Python ≥3.10; depends on `langchain-core>=1.4.7,<2`, `pydantic>=2.7.4`, `langgraph-checkpoint`, `langgraph-prebuilt`, `langgraph-sdk` |
| `langgraph-checkpoint-postgres` | **3.1.1** | Separate install for production Postgres |

### 1.0 status (Oct 22, 2025)

LangGraph **1.0 GA** shipped with LangChain 1.0 ([blog](https://www.langchain.com/blog/langchain-langgraph-1dot0), [release notes](https://docs.langchain.com/oss/python/releases/langgraph-v1)):

- Stability commitment: **no breaking changes until 2.0**.
- Core graph APIs (`StateGraph`, nodes, edges, checkpointing, streaming, HITL) **unchanged** in spirit; 1.x is polish + type safety + docs.
- Main migration change: **`langgraph.prebuilt.create_react_agent` deprecated** → use LangChain’s `create_agent` (`langchain.agents`), which runs on LangGraph and adds middleware.
- Python 3.9 dropped (EOL Oct 2025).

Post-1.0 (1.1–1.2 line through Jul 2026): streaming `version="v2"` unified chunks; `stream_events(..., version="v3")` typed projections; `DeltaChannel` (beta) for smaller checkpoints; durability modes (`exit` / `async` / `sync`).

**Stability judgment:** Core orchestration surface is mature enough for production after 1.0. Expect minor-version churn in streaming APIs and prebuilt helpers; pin `langgraph~=1.2` and `langgraph-checkpoint-postgres~=3.1`.

**Sources:**
- https://www.langchain.com/blog/langchain-langgraph-1dot0
- https://docs.langchain.com/oss/python/releases/langgraph-v1
- https://docs.langchain.com/oss/python/migrate/langgraph-v1
- https://pypi.org/project/langgraph/ (1.2.10)
- https://github.com/langchain-ai/langgraph/releases

---

## 3. Graph model

### Mental model

LangGraph = Pregel-style message-passing over a **StateGraph**:

1. **State** — shared schema + per-key reducers  
2. **Nodes** — pure functions / async callables that return partial state updates (may call LLMs, tools, DBs)  
3. **Edges** — fixed or conditional routing to next node(s)  
4. **Super-steps** — one tick where scheduled nodes run (possibly in parallel); checkpoints land at super-step boundaries

Docs: https://docs.langchain.com/oss/python/langgraph/graph-api

### State typing

Supported schemas:

- **`TypedDict`** (preferred for performance)
- **`dataclass`** (defaults)
- **Pydantic v2 `BaseModel`** (recursive validation; slower; note: LangChain `create_agent` does *not* support Pydantic state)

Reducers via `Annotated`:

```python
from typing import Annotated, TypedDict
from operator import add
from langgraph.graph import StateGraph, START, END

class AthleteInsightState(TypedDict):
    athlete_id: str
    messages: Annotated[list, add]          # append reducer
    readiness_score: float | None           # default: overwrite
    pending_approval: dict | None
    approved: bool | None

def route_after_analysis(state: AthleteInsightState) -> str:
    if state.get("pending_approval"):
        return "coach_gate"
    return "persist"

builder = StateGraph(AthleteInsightState)
builder.add_node("analyze", analyze_node)
builder.add_node("coach_gate", coach_gate_node)
builder.add_node("persist", persist_node)
builder.add_edge(START, "analyze")
builder.add_conditional_edges("analyze", route_after_analysis, {
    "coach_gate": "coach_gate",
    "persist": "persist",
})
builder.add_edge("coach_gate", "persist")
builder.add_edge("persist", END)
```

Input/output schemas can differ from the internal `OverallState` for API boundaries. Private channels exist but **are not hidden from streaming** unless you pass `output_keys`.

### Deterministic control

You retain full control:

- Conditional edges = explicit routers (Python, not LLM-required)
- Nodes can be 100% deterministic (SQL, ClickHouse aggregations, rule engines)
- LLM nodes are opt-in islands inside a deterministic skeleton
- `Command(goto=..., update=...)` from nodes for dynamic routing without opaque agents

This is LangGraph’s main differentiator vs “autonomous agent” frameworks: **you design the control plane**.

---

## 4. Persistence and checkpointing

### Checkpointer interface

Implementations conform to `BaseCheckpointSaver`:

| Method | Role |
|--------|------|
| `put` / `aput` | Store checkpoint + metadata |
| `put_writes` / `aput_writes` | Pending task writes (partial super-step recovery) |
| `get_tuple` / `aget_tuple` | Load checkpoint for `get_state` |
| `list` / `alist` | History for time-travel |

Docs: https://docs.langchain.com/oss/python/langgraph/checkpointers  
API: https://reference.langchain.com/python/langgraph/checkpoints

### What gets persisted

At each **super-step**:

- Channel values (full state snapshot, or deltas with `DeltaChannel`)
- Channel versions / step metadata
- Next nodes to run
- Pending writes from completed sibling nodes if another node fails
- Interrupt payloads when paused

**Thread** = sequence of checkpoints keyed by `thread_id` (must be ≤255 chars for Postgres). Optional `checkpoint_id` for time-travel.

### Postgres checkpointer

```python
from langgraph.checkpoint.postgres.aio import AsyncPostgresSaver

# Separate package: langgraph-checkpoint-postgres==3.1.1
async with AsyncPostgresSaver.from_conn_string(DATABASE_URL) as checkpointer:
    await checkpointer.setup()  # migrations — call once
    graph = builder.compile(checkpointer=checkpointer)

config = {"configurable": {"thread_id": f"insight-{athlete_id}-{date}"}}
```

Production notes:

- Use **`AsyncPostgresSaver`** with FastAPI async.
- Prefer a **connection pool** (psycopg3); don’t share one sync connection across workers.
- Call `setup()` once (tables + migrations, including `checkpoint_migrations`).
- Checkpoints grow unboundedly — add retention/prune cron.
- Optional AES encryption via `EncryptedSerializer` + `LANGGRAPH_AES_KEY`.
- Serialization uses `JsonPlusSerializer` (msgpack/JSON); exotic types need care (known historical Postgres JSON serialization bugs around LangChain message objects — pin checkpoint-postgres carefully).

### Durability modes (library-level)

Pass to `invoke` / `stream` / `astream`:

| Mode | Behavior | Use when |
|------|----------|----------|
| `"exit"` | Persist only on exit / interrupt / error | Fast paths; no mid-run crash recovery |
| `"async"` | Persist async while next step runs | Default tradeoff; small crash window |
| `"sync"` | Persist before next step | HITL + production batch nodes you cannot afford to lose |

**Recommendation for PPD:** `durability="sync"` on approval-gated and write-side graphs; `"async"` acceptable for read-only chat streaming.

### Time-travel and replay

- `graph.get_state_history(config)` → chronological `StateSnapshot`s
- Replay: `invoke(None, prior_checkpoint_config)` — **re-executes** nodes after that checkpoint (side effects run again unless you wrap them carefully)
- Fork: `update_state(...)` then resume — original history preserved
- Interrupts **re-trigger** on time-travel into a node that calls `interrupt()`

Docs: https://docs.langchain.com/oss/python/langgraph/use-time-travel

### Stores (long-term memory)

Separate from checkpointers: cross-thread key-value memory (preferences, facts). Optional Postgres store. Use for athlete profiles that outlive a single nightly thread.

---

## 5. Human-in-the-loop (hard requirement)

### Official semantics

From https://docs.langchain.com/oss/python/langgraph/interrupts:

> When an interrupt is triggered, LangGraph saves the graph state using its persistence layer and **waits indefinitely** until you resume execution.

Concrete mechanics:

1. Node calls `interrupt(payload)` with JSON-serializable value  
2. Runtime checkpoints state and suspends  
3. Caller sees interrupt via `stream.interrupts` / `__interrupt__`  
4. Process may exit — **no compute held**  
5. Later: same `thread_id` + `Command(resume=value)`  
6. Resume value becomes the return value of `interrupt()`  
7. **Important:** the node restarts from the **beginning** of that node; code before `interrupt()` re-runs

### Survive process restart + multi-day pause?

| Concern | Verdict |
|---------|---------|
| State survives Docker/Traefik restart with Postgres checkpointer | **Yes** |
| Wait hours/days without a live worker | **Yes** — idle in DB |
| Resume after redeploy | **Yes**, if graph code compatible with saved state |
| Automatic wake on crash mid-node | **No** — external orchestrator required |
| Exactly-once side effects on resume | **No** — you must make nodes idempotent; put side effects *after* interrupt or behind idempotency keys |
| Concurrent double-resume of same thread | **Not prevented by OSS library** — need advisory lock / single-worker-per-thread |

### Coach approval pattern (recommended)

```python
from langgraph.types import interrupt, Command

def coach_gate(state: AthleteInsightState):
    # Side-effect-free prep only before interrupt
    decision = interrupt({
        "type": "coach_approval",
        "athlete_id": state["athlete_id"],
        "summary": state.get("pending_approval"),
        "actions": ["approve", "reject", "edit"],
    })
    # decision arrives days later via Command(resume=...)
    if decision.get("action") == "reject":
        return {"approved": False, "pending_approval": None}
    if decision.get("action") == "edit":
        return {
            "approved": True,
            "pending_approval": None,
            "messages": [{"role": "system", "content": decision["edits"]}],
        }
    return {"approved": True, "pending_approval": None}
```

**API surface for the product:**

1. Nightly job starts graph → hits `coach_gate` → interrupt persisted  
2. FastAPI writes a row to `coach_approvals` (or derive from `get_state`)  
3. Coach UI loads queue; coach submits decision  
4. FastAPI: `await graph.ainvoke(Command(resume=decision), config, durability="sync")`  
5. Stream result to client if interactive; otherwise continue batch

**Static breakpoints** (`interrupt_before=["node"]`) are also available but less flexible than dynamic `interrupt()`.

### HITL durability verdict (precise)

LangGraph **meets** the “pause for hours/days and resume after process restart” requirement for coach approval **as state durability**. It does **not** give Temporal’s “workflow never dies silently” guarantee for the *active* execution phase before/after the interrupt. Design the approval queue around **persisted interrupted threads + explicit resume API**, and keep all mutating writes after the gate (or idempotent).

---

## 6. Multi-agent patterns and control retained

Official multi-agent guide (LangChain, built on LangGraph): https://docs.langchain.com/oss/python/langchain/multi-agent

| Pattern | Control | Fit for PPD |
|---------|---------|-------------|
| **Custom workflow / StateGraph** | Highest — you own every edge | **Primary recommendation** for sports insights |
| **Router** | Deterministic or LLM classify → specialists | Good for interactive chat |
| **Subagents** (tools) | Supervisor LLM calls specialists as tools | OK; extra model call overhead |
| **Supervisor** (`langgraph-supervisor`) | Central LLM routes workers | Convenient; maintainers now prefer tool-based supervisor |
| **Handoffs / Swarm** (`langgraph-swarm`) | Peer agents transfer control | Weaker for compliance/audit; harder to reason |
| **Hierarchical teams** | Nested supervisors | Useful if org maps to domains (physiology / tennis / training) |

**Control retained:** With a custom `StateGraph` of specialist **subgraphs**, you keep deterministic outer orchestration and confine LLM autonomy inside specialists. Prebuilt supervisor/swarm trade control for speed of prototyping — fine for experiments, not for coach-facing write paths.

**Sources:**
- https://github.com/langchain-ai/langgraph-supervisor-py (note: recommend tool-based supervisor)
- https://github.com/langchain-ai/langgraph-swarm-py
- https://docs.langchain.com/oss/python/langchain/supervisor

---

## 7. Subgraphs and composition

Docs: https://docs.langchain.com/oss/python/langgraph/use-subgraphs

- Compile a specialist graph and `add_node("physiology", physiology_subgraph)`.
- Default: subgraph inherits parent checkpointer; parent sees subgraph as **one super-step**.
- `compile(checkpointer=True)` on subgraph → fine-grained checkpoints / interrupt mid-subgraph.
- Separate schemas + transform functions when parent/child state differ.
- Nested namespaces: `"node:uuid|child:uuid"` in `checkpoint_ns`.

For PPD: outer orchestrator owns athlete thread; specialists are subgraphs with narrow schemas (`WearableState`, `TennisState`, …).

---

## 8. Streaming → FastAPI SSE → Vercel AI SDK

### Modes

| Mode | Payload |
|------|---------|
| `values` | Full state after each step |
| `updates` | Per-node delta |
| `messages` | `(LLM token chunk, metadata)` |
| `custom` | Arbitrary via `get_stream_writer()` |
| `checkpoints` / `tasks` / `debug` | Ops/debug |

Streaming docs: https://docs.langchain.com/oss/python/langgraph/streaming

Prefer:

- `astream(..., stream_mode=[...], version="v2")` for unified `{type, ns, data}` chunks  
- or `stream_events(..., version="v3")` for typed projections (`messages`, `values`, `interrupts`)

### FastAPI SSE bridge (sketch)

```python
from fastapi import FastAPI
from fastapi.responses import StreamingResponse
from langgraph.types import Command
import json

app = FastAPI()

def sse(event: str, data: dict) -> str:
    return f"event: {event}\ndata: {json.dumps(data, default=str)}\n\n"

@app.post("/api/agent/stream")
async def stream_agent(body: dict):
    thread_id = body["thread_id"]
    config = {"configurable": {"thread_id": thread_id}}
    inp = body.get("input")
    if "resume" in body:
        inp = Command(resume=body["resume"])

    async def gen():
        async for part in graph.astream(
            inp,
            config=config,
            stream_mode=["messages", "updates", "custom"],
            version="v2",
            durability="sync",
        ):
            t = part["type"]
            if t == "messages":
                msg, meta = part["data"]
                # Map to Vercel AI SDK Data Stream Protocol text deltas
                yield sse("text-delta", {"delta": getattr(msg, "content", "") or ""})
            elif t == "updates":
                yield sse("data", {"type": "node-update", "data": part["data"]})
            elif t == "custom":
                yield sse("data", {"type": "progress", "data": part["data"]})
        # After stream: check interrupts
        snap = await graph.aget_state(config)
        if snap.interrupts:
            yield sse("data", {
                "type": "interrupt",
                "payload": [i.value for i in snap.interrupts],
            })
        yield sse("done", {})

    return StreamingResponse(gen(), media_type="text/event-stream")
```

**Vercel AI SDK:** From Next.js, consume the SSE / AI data stream and map `text-delta` → `useChat` / `streamText` protocol. Keep a thin BFF route in Next that proxies to FastAPI with auth cookies, or call FastAPI directly with the user’s JWT. Interrupt events should surface as a custom UI card (“Awaiting coach approval”) rather than as assistant text.

---

## 9. Durability vs Temporal (rigorous)

| Capability | LangGraph checkpointing | Temporal (or Agent Server queue) |
|------------|-------------------------|----------------------------------|
| Persist graph state between nodes | Yes | Yes (event history) |
| Resume after intentional HITL days later | Yes (with Postgres) | Yes (signals/updates) |
| Auto-detect process death & restart worker | **No** (OSS lib) | **Yes** |
| Per-activity retries / timeouts / heartbeats | Node `RetryPolicy` only; process-scoped | First-class |
| Timers / cron / sleep for days while active | Sleep = idle checkpoint only if you exit; no durable timer | Durable timers |
| Exactly-once side effects | **No** — idempotency on you | At-least-once + idempotency keys |
| Versioning of long-running workflows | Manual (state schema migrations) | Workflow versioning / patches |
| Fan-out hundreds of athletes | DIY (Redis queue + workers) | Native task queues |
| Duplicate resume locking | DIY | Lease / single execution |

Critical citations:

- Temporal: https://temporal.io/blog/temporal-langgraph-plugin-durable-execution — “checkpoints preserve your data, not your execution”
- Diagrid: https://www.diagrid.io/blog/checkpoints-are-not-durable-execution-why-langgraph-crewai-google-adk-and-others-fall-short-for-production-agent-workflows
- Cordum (2026): https://cordum.io/blog/temporal-vs-langgraph — hybrid LangGraph + Temporal often wins for side-effecting agents

**For PPD nightly batch:** LangGraph nodes should be short, idempotent units. Own fan-out with Redis/RQ/Celery/Arq **or** run LangGraph nodes as Temporal activities (official plugin exists). Do not put a 3-hour ClickHouse loop inside one node and expect crash safety.

**Agent Server** (LangSmith Deployment) adds a Postgres + Redis **task queue**, leases, and SSE bridging — closer to durable *runs* than the bare library. Self-hosting it requires **Enterprise** license.

---

## 10. Observability and telemetry residency

### Is LangSmith required?

**No.** Tracing is opt-in via env (`LANGSMITH_TRACING=true` + API key). LangGraph runs fully without it.

Docs: https://docs.langchain.com/langsmith/trace-with-langgraph

### Alternatives

| Stack | Self-host | Coupling |
|-------|-----------|----------|
| **Langfuse** | Yes (OSS Docker/K8s) | Native LangChain/LangGraph callbacks; keep traces on Hetzner |
| **OpenTelemetry** | Yes | Export spans to your collector; LangSmith also ingests OTel if you ever want hybrid |
| **LangSmith Cloud** | N/A | Traces leave your infra (US/EU/APAC regions) |
| **LangSmith Self-Hosted** | Yes | **Enterprise add-on**; keeps data in your VPC |

Compliance path for PPD: **do not set LangSmith env vars in production**; wire Langfuse (or OTel → Grafana Tempo) as callbacks. You lose LangSmith’s polished agent graph debugger / eval UI unless you pay for self-hosted Enterprise — you do **not** lose runtime correctness.

Langfuse LangChain integration: https://langfuse.com/docs/integrations/langchain/tracing

---

## 11. Deployment: library vs LangGraph Platform / Agent Server

| Approach | What you get | What you give up | Cost |
|----------|--------------|------------------|------|
| **Library in FastAPI** (recommended starting point) | Full graph API, Postgres checkpointer, SSE you own | Task queue, run leases, Studio UI, managed crons | Free (OSS MIT) |
| **LangSmith Deployment / Agent Server** | API + queue workers + Redis pubsub + Postgres persistence + `/stream` SSE | Operate K8s/Helm stack; license | Cloud from ~$39/seat + deployment metering; **self-host = Enterprise** |
| **Hybrid Temporal + LangGraph** | Durable execution + agent graphs | Two systems to operate | Temporal OSS self-host or Temporal Cloud |

Pricing references:

- https://www.langchain.com/pricing  
- Self-hosted overview: https://docs.langchain.com/langsmith/deploy-to-self-hosted-overview  
- Agent Server: https://docs.langchain.com/langsmith/agent-server  

Third-party 2026 summary (verify against official pricing): LangGraph framework free; managed platform historically advertised from ~$35/mo; LangSmith Plus ~$39/seat — https://www.truefoundry.com/blog/langgraph-pricing

**For Hetzner self-host without vendor telemetry:** embed the library. Use Redis you already have for job fan-out. Revisit Agent Server only if you want their run model badly enough to negotiate Enterprise.

---

## 12. Honest criticism (production engineers)

Fair themes from 2025–2026 postmortems:

1. **Abstraction overhead** — Teams report debugging “the graph” instead of business logic; sequential pipelines may not need a graph engine ([DEV: Why We Removed LangGraph](https://dev.to/nicolaric/why-we-removed-langgraph-from-our-ai-platform-i9o)).
2. **Checkpoint / serialization landmines** — In-memory works; Postgres then fails on non-JSON types / schema evolution ([GH #5769](https://github.com/langchain-ai/langgraph/issues/5769), [GH #6491](https://github.com/langchain-ai/langgraph/issues/6491) invalid state corrupting threads).
3. **Dependency weight** — Pulls `langchain-core`, checkpoint packages, SDK; version matrix churn historically painful (improved post-1.0 but still a surface).
4. **“Durable” marketing vs reality** — Checkpoint ≠ durable execution; silent dead runs without a supervisor ([Diagrid](https://www.diagrid.io/blog/checkpoints-are-not-durable-execution-why-langgraph-crewai-google-adk-and-others-fall-short-for-production-agent-workflows), [Temporal blog](https://temporal.io/blog/temporal-langgraph-plugin-durable-execution)).
5. **Migration away** — Some teams prototype in LangGraph then rewrite hot paths in plain Python for latency/control ([BSWEN 2026](https://docs.bswen.com/blog/2026-03-18-why-teams-migrate-from-langgraph/)).
6. **Counterpoint** — Others prefer LangGraph over LangChain’s older AgentExecutor opacity for explicit node I/O debugging ([studiochrome](https://studiochrome.ai/writing/langchain-vs-langgraph/)).

**Net:** Criticism is strongest when LangGraph is used as a generic workflow engine or for linear CRUD-ish agents. It is weakest (i.e. LangGraph looks good) when you need branching + HITL + streaming + typed state — exactly our coach-gated insight pipeline.

---

## 13. Design sketch for Peak Performance Data

### Architecture

```
┌─────────────┐     SSE / AI stream     ┌──────────────────────────┐
│ Next.js +   │ ◄─────────────────────► │ FastAPI Agent Service    │
│ Vercel AI   │   resume approval       │  - StateGraph orchestrator│
│ SDK         │                         │  - AsyncPostgresSaver     │
└─────────────┘                         │  - Langfuse callbacks     │
                                        └───────────┬──────────────┘
                    Redis job queue                  │
        ┌───────────┴────────────┐                   │
        ▼                        ▼                   ▼
  Nightly fan-out           Resume worker     Supabase Postgres
  (per athlete thread)      (approvals)       (checkpoints +
                                               coach_approvals)
                               ▼
                          ClickHouse (reads)
```

### Orchestrator + specialist subgraphs

```python
# graphs/orchestrator.py
from typing import Annotated, Literal, TypedDict
from operator import add
from langgraph.graph import StateGraph, START, END
from langgraph.types import interrupt, Command
from langgraph.checkpoint.postgres.aio import AsyncPostgresSaver

class OrchestratorState(TypedDict):
    athlete_id: str
    date: str
    messages: Annotated[list, add]
    wearable_digest: dict | None
    tennis_digest: dict | None
    training_plan: dict | None
    insight_draft: dict | None
    approval: dict | None
    status: Literal["running", "awaiting_coach", "published", "rejected"]

# Imported compiled subgraphs (specialists)
from graphs.physiology import physiology_graph
from graphs.tennis import tennis_graph
from graphs.training import training_graph

def synthesize(state: OrchestratorState) -> dict:
    draft = build_insight_draft(state)  # deterministic merge + optional LLM polish
    return {"insight_draft": draft, "status": "awaiting_coach"}

def coach_gate(state: OrchestratorState) -> dict:
    decision = interrupt({
        "type": "coach_approval",
        "athlete_id": state["athlete_id"],
        "date": state["date"],
        "draft": state["insight_draft"],
    })
    if decision["action"] == "reject":
        return {"status": "rejected", "approval": decision}
    draft = state["insight_draft"]
    if decision["action"] == "edit":
        draft = {**draft, **decision.get("edits", {})}
    return {"status": "published", "approval": decision, "insight_draft": draft}

def publish(state: OrchestratorState) -> dict:
    if state["status"] != "published":
        return {}
    upsert_insight(state["athlete_id"], state["date"], state["insight_draft"])  # idempotent
    return {}

def build_orchestrator():
    g = StateGraph(OrchestratorState)
    g.add_node("physiology", physiology_graph)   # subgraph
    g.add_node("tennis", tennis_graph)
    g.add_node("training", training_graph)
    g.add_node("synthesize", synthesize)
    g.add_node("coach_gate", coach_gate)
    g.add_node("publish", publish)

    g.add_edge(START, "physiology")
    g.add_edge(START, "tennis")          # parallel specialists
    g.add_edge(START, "training")
    g.add_edge("physiology", "synthesize")
    g.add_edge("tennis", "synthesize")
    g.add_edge("training", "synthesize")
    g.add_edge("synthesize", "coach_gate")
    g.add_edge("coach_gate", "publish")
    g.add_edge("publish", END)
    return g

async def get_graph(pool):
    checkpointer = AsyncPostgresSaver(pool)
    # await checkpointer.setup() once at boot
    return build_orchestrator().compile(checkpointer=checkpointer)
```

### Nightly batch (external durability)

```python
# jobs/nightly.py — Arq/RQ/Celery worker
async def process_athlete(athlete_id: str, date: str):
    thread_id = f"nightly:{date}:{athlete_id}"  # < 255 chars
    config = {"configurable": {"thread_id": thread_id}}
    # Redis SETNX lease to prevent double-run
    async with redis_lock(f"lock:{thread_id}", ttl=3600):
        await graph.ainvoke(
            {"athlete_id": athlete_id, "date": date, "messages": [], "status": "running"},
            config=config,
            durability="sync",
        )
        snap = await graph.aget_state(config)
        if snap.tasks and any(t.interrupts for t in snap.tasks):
            await enqueue_coach_approval(thread_id, snap)
```

### Approval resume endpoint

```python
@app.post("/api/coach/approvals/{thread_id}/decide")
async def decide(thread_id: str, body: dict, user=Depends(require_coach)):
    config = {"configurable": {"thread_id": thread_id}}
    result = await graph.ainvoke(
        Command(resume=body),
        config=config,
        durability="sync",
    )
    return {"ok": True, "status": result.get("status"), "insight": result.get("insight_draft")}
```

### Provider freedom

Bind models via LangChain chat model factories (`ChatOpenAI`, `ChatAnthropic`, OpenRouter, local vLLM) inside specialist nodes only. Orchestrator edges stay model-agnostic.

### Observability

```python
from langfuse.callback import CallbackHandler  # or current Langfuse LangChain handler

langfuse_handler = CallbackHandler()  # self-hosted host URL
await graph.ainvoke(inp, config={
    "configurable": {"thread_id": thread_id},
    "callbacks": [langfuse_handler],
})
```

Do not set `LANGSMITH_TRACING` in prod.

---

## 14. Scorecard (PPD requirements)

Scale: 1 (poor) – 5 (excellent) for *our* constraints.

| Criterion | Score | Rationale |
|-----------|------:|-----------|
| **Deterministic control** | **5** | StateGraph + conditional edges + deterministic nodes; LLM optional |
| **Durability** (batch / crash recovery) | **3** | Excellent state snapshots; weak auto-recovery vs Temporal; needs your queue |
| **Human-in-the-loop** | **5** | First-class `interrupt` + indefinite wait + Postgres resume days later |
| **Streaming** | **5** | Rich modes; clean FastAPI SSE → AI SDK bridge |
| **Provider freedom** | **5** | LangChain model abstractions; no forced vendor model |
| **Self-hosting w/o vendor telemetry** | **5** | OSS MIT library; LangSmith optional; Langfuse/OTel on-prem |
| **Maturity** | **4** | 1.0+ (now 1.2.10); enterprise logos; residual serialization/schema sharp edges |
| **Dependency weight** | **2** | langchain-core + checkpoint stack + pydantic; heavier than a thin custom FSM |

**Weighted take:** Outstanding on control, HITL, streaming, and compliance-friendly self-host. Acceptable durability **if** you add a job/lease layer. Do not treat LangGraph alone as the nightly batch OS.

---

## 15. Recommendation for framework choice process

1. **Shortlist LangGraph** for the interactive + coach-gated insight graphs.  
2. **Mandate** `AsyncPostgresSaver` + `durability="sync"` + idempotent publish nodes.  
3. **Own** Redis-based fan-out/leases for nightly hundreds-of-athletes (or Temporal if batch reliability becomes the #1 risk).  
4. **Skip** LangGraph Platform initially; revisit only for Agent Server queue features under Enterprise.  
5. **Pin** `langgraph==1.2.10`, `langgraph-checkpoint-postgres==3.1.1`; integration-test Postgres resume across process kill.  
6. Compare scores against Temporal-only / CrewAI / custom FSM in sibling research docs before final pick.

---

## 16. Primary sources

1. https://docs.langchain.com/oss/python/releases/langgraph-v1  
2. https://docs.langchain.com/oss/python/migrate/langgraph-v1  
3. https://www.langchain.com/blog/langchain-langgraph-1dot0  
4. https://docs.langchain.com/oss/python/langgraph/graph-api  
5. https://docs.langchain.com/oss/python/langgraph/checkpointers  
6. https://docs.langchain.com/oss/python/langgraph/persistence  
7. https://docs.langchain.com/oss/python/langgraph/interrupts  
8. https://docs.langchain.com/oss/python/langgraph/streaming  
9. https://docs.langchain.com/oss/python/langgraph/use-subgraphs  
10. https://docs.langchain.com/oss/python/langgraph/use-time-travel  
11. https://docs.langchain.com/oss/python/langchain/multi-agent  
12. https://docs.langchain.com/langsmith/agent-server  
13. https://docs.langchain.com/langsmith/deploy-to-self-hosted-overview  
14. https://docs.langchain.com/langsmith/trace-with-langgraph  
15. https://www.langchain.com/pricing  
16. https://reference.langchain.com/python/langgraph/checkpoints  
17. https://pypi.org/project/langgraph/ (1.2.10 as of 2026-08-02)  
18. https://pypi.org/project/langgraph-checkpoint-postgres/ (3.1.1)  
19. https://temporal.io/blog/temporal-langgraph-plugin-durable-execution  
20. https://www.diagrid.io/blog/checkpoints-are-not-durable-execution-why-langgraph-crewai-google-adk-and-others-fall-short-for-production-agent-workflows  
21. https://cordum.io/blog/temporal-vs-langgraph  
22. https://langfuse.com/docs/integrations/langchain/tracing  
23. https://github.com/langchain-ai/langgraph-supervisor-py  
24. https://github.com/langchain-ai/langgraph-swarm-py  
25. https://dev.to/nicolaric/why-we-removed-langgraph-from-our-ai-platform-i9o  
26. https://docs.bswen.com/blog/2026-03-18-why-teams-migrate-from-langgraph/  
27. https://github.com/langchain-ai/langgraph/issues/6491  
28. https://github.com/langchain-ai/langgraph/issues/5769  
