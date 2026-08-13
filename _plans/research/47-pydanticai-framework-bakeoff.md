# 47 — PydanticAI Deep Dive & Agent Framework Bakeoff

**Research date:** 2026-08-02  
**Scope:** External research only (official docs, PyPI, GitHub releases, production commentary).  
**Context:** Python FastAPI service (Pydantic v2 + httpx), Hetzner self-hosting, multi-agent sports-performance platform. Existing pin `pydantic-ai==0.0.13` is unused — prior plan never adopted.

---

## Executive recommendation

| Decision | Choice |
|---|---|
| **Primary** | **PydanticAI 2.22.0** (+ Temporal or DBOS for durable HITL) |
| **Runner-up** | **LangGraph** (explicit StateGraph + checkpointers) |
| **Do not pick first** | Google ADK, OpenAI Agents SDK, Microsoft Agent Framework, or a greenfield ~500-line loop *for this stack* |

**Why PydanticAI wins here:** it is the only candidate that simultaneously (1) matches an existing FastAPI + Pydantic v2 ergonomic surface, (2) is genuinely model-agnostic, (3) ships first-party durable-execution capabilities for Temporal / DBOS / Prefect that you can self-host on Hetzner, (4) has first-class deferred-tool HITL, streaming structured output, MCP client+server, and OTel that does **not** require Logfire cloud, and (5) already appears in your requirements history — so adoption is a version jump, not a new dependency philosophy.

**Runner-up LangGraph** if the product’s control plane becomes a large explicit state machine with time-travel, multi-interrupt approval graphs, and audit-grade checkpoint replay as the *primary* abstraction (not agent-as-typed-function).

---

# Part 1 — PydanticAI deep dive

## 1.1 Current version & API stability

| Fact | Value | Source |
|---|---|---|
| **Current PyPI version** | **`pydantic-ai` 2.22.0** | [PyPI](https://pypi.org/project/pydantic-ai/) |
| **Released** | 2026-07-31 | [GitHub releases](https://github.com/pydantic/pydantic-ai/releases) |
| **Python** | ≥ 3.10 | Install docs |
| **License** | MIT | PyPI / GitHub |
| **Your pin** | `0.0.13` (2024-12-16) | Ancient — pre-dates virtually all production features below |
| **Companion packages** | `pydantic-ai-slim==2.22.0`, `pydantic-evals`, `pydantic-graph`, `pydantic-ai-examples` | Install docs |

### Stability trajectory

- **0.0.x (late 2024 → early 2025):** Explicit “break APIs ASAP” beta. Early criticism (Eigenwise, Dec discussions) was correct *for that era*.
- **1.x (2025):** Feature accretion — tools, graphs, MCP, streaming, early durable wrappers (`TemporalAgent`, `DBOSAgent`, `PrefectAgent`).
- **2.x (2026):** Capability-based architecture. Durable execution moved from wrapper agents to attachable capabilities (`TemporalDurability`, `DBOSDurability`, `PrefectDurability`). Wrapper agents deprecated, removal targeted at **v3** ([PR #4977](https://github.com/pydantic/pydantic-ai/pull/4977), [issue #5477](https://github.com/pydantic/pydantic-ai/issues/5477)).
- **Reality check:** Weekly minor releases (2.14 → 2.22 in ~11 days of late July 2026). Expect minor churn at edges (provider adapters, Temporal activity config) but the core `Agent[Deps, Output]` / `RunContext` / tools / `output_type` shape is stable enough for production. Pin a minor (`==2.22.*` or exact) and upgrade deliberately.

**Practical implication for PeakPerformance:** treat `0.0.13` as dead weight. Jump to **2.22.0** (or latest 2.x at adopt time) via `pydantic-ai-slim[...]` to control dependency weight.

Docs hubs:
- https://pydantic.dev/docs/ai/overview/
- https://ai.pydantic.dev/ (canonical alias)
- https://github.com/pydantic/pydantic-ai

---

## 1.2 Core primitives

### Agent

An `Agent` is a typed container for instructions, tools/toolsets, structured `output_type`, `deps_type`, model, model settings, and composable **capabilities**.

```python
from dataclasses import dataclass
from pydantic import BaseModel, Field
from pydantic_ai import Agent, RunContext

@dataclass
class SupportDependencies:
    customer_id: int
    db: DatabaseConn  # your own type

class SupportOutput(BaseModel):
    support_advice: str = Field(description="Advice returned to the customer")
    block_card: bool
    risk: int = Field(ge=0, le=10)

support_agent = Agent(
    "openai:gpt-5.2",
    deps_type=SupportDependencies,
    output_type=SupportOutput,
    instructions=(
        "You are a support agent in our bank, give the "
        "customer support and judge the risk level of their query."
    ),
)

@support_agent.instructions
async def add_customer_name(ctx: RunContext[SupportDependencies]) -> str:
    name = await ctx.deps.db.customer_name(id=ctx.deps.customer_id)
    return f"The customer's name is {name!r}"

@support_agent.tool
async def customer_balance(
    ctx: RunContext[SupportDependencies], include_pending: bool
) -> float:
    """Returns the customer's current account balance."""
    return await ctx.deps.db.customer_balance(
        id=ctx.deps.customer_id, include_pending=include_pending
    )

result = await support_agent.run("What is my balance?", deps=deps)
# result.output: SupportOutput  (validated)
```

Source: [Overview / bank support example](https://pydantic.dev/docs/ai/overview/), [Agents](https://pydantic.dev/docs/ai/core-concepts/agent).

**Run APIs:**
1. `agent.run()` / `run_sync()` — complete result
2. `agent.run_stream()` / `run_stream_sync()` — stream text / structured output
3. `agent.run_stream_events()` — raw event stream + final result event
4. `agent.iter()` — iterate the underlying agent graph node-by-node

Agents are designed for **global reuse** (FastAPI-app style), not per-request construction.

### Dependency injection (`deps_type` + `RunContext`)

- Declare `deps_type=MyDeps` on the agent → tools, instruction functions, and output functions receive `RunContext[MyDeps]`.
- Pass `deps=` at `run()` time.
- Static type checkers catch wrong `RunContext[...]` annotations.
- Ideal FastAPI fit: put `httpx.AsyncClient`, Supabase/ClickHouse clients, `athlete_id`, auth principal into a dataclass deps object per request.

### Output types & validation

- `output_type` can be `str`, Pydantic models, dataclasses, TypedDicts, unions, lists, etc.
- Failed validation triggers **reflection / self-correction** (retry with error feedback to the model).
- Output modes include tool-output (default schema-as-tool), native structured output where providers support it, and output functions/validators.
- Partial validation is used during streaming (Pydantic experimental partial JSON).

Source: [Output](https://pydantic.dev/docs/ai/core-concepts/output).

### Tools & toolsets

Registration paths:
- `@agent.tool` — needs `RunContext`
- `@agent.tool_plain` — no context
- `tools=[...]` / `Tool(...)` constructor
- `toolsets=[...]` — collections (function toolsets, MCP, third-party)

Schemas come from signatures + docstring parameter extraction (griffe: google/numpy/sphinx).

### Dynamic tool preparation

Per-tool `prepare` and agent-wide `prepare_tools`:

```python
from pydantic_ai import Agent, RunContext, ToolDefinition

async def only_if_42(
    ctx: RunContext[int], tool_def: ToolDefinition
) -> ToolDefinition | None:
    return tool_def if ctx.deps == 42 else None

agent = Agent("openai:gpt-5.2", deps_type=int)

@agent.tool(prepare=only_if_42)
def special_tool(ctx: RunContext[int], x: str) -> str:
    return x
```

Agent-wide:

```python
async def prepare_tools(
    ctx: RunContext, tool_defs: list[ToolDefinition]
) -> list[ToolDefinition]:
    # filter / rewrite all tools for this step
    return [t for t in tool_defs if t.name != "dangerous"]
```

Use cases: role-based tool gating, progressive disclosure, cache-friendly tool sets, coach vs athlete permission surfaces.

Source: [Advanced tools — prepare / prepare_tools](https://pydantic.dev/docs/ai/tools-toolsets/tools-advanced).

### System prompts / instructions

Two layers (docs still show both):
- **`instructions=` / `@agent.instructions`** — preferred modern path; can be static strings or dynamic async functions with deps.
- **`system_prompt=` / `@agent.system_prompt`** — still present in examples; treat as legacy-adjacent to `instructions` for new code.

Dynamic instruction functions are the FastAPI-middleware equivalent: inject athlete name, locale, role, feature flags every run.

### Capabilities (v2 composition model)

Capabilities bundle tools, hooks, instructions, and model settings. Built-ins include Thinking, WebSearch, WebFetch, ImageGeneration, MCP, ToolSearch, Instrumentation, HandleDeferredToolCalls, and durability capabilities. This is the extension point that replaced many one-off wrapper classes.

---

## 1.3 Multi-agent support

Docs define five complexity levels ([Multi-agent patterns](https://pydantic.dev/docs/ai/guides/multi-agent-applications/)):

| Pattern | Mechanism | Control returns to caller? |
|---|---|---|
| Single agent | Default | n/a |
| **Agent delegation** | Call another agent inside a `@tool` | Yes (nested) |
| **Programmatic hand-off** | App code sequences agents; pass `message_history` | App decides |
| **Graph (`pydantic-graph`)** | Typed state machine of nodes/edges | Graph runner |
| Deep agents | Planning + files + sandbox + delegation + HITL + durable | Composite |

### Delegation example

```python
from pydantic_ai import Agent, RunContext, UsageLimits

joke_selection_agent = Agent(
    "openai:gpt-5.2",
    name="joke_selection_agent",
    instructions="Use joke_factory, then return one joke.",
)
joke_generation_agent = Agent(
    "google:gemini-3-flash-preview",
    name="joke_generation_agent",
    output_type=list[str],
)

@joke_selection_agent.tool
async def joke_factory(ctx: RunContext, count: int) -> list[str]:
    r = await joke_generation_agent.run(
        f"Please generate {count} jokes.",
        usage=ctx.usage,  # roll usage into parent
    )
    return r.output
```

### Programmatic hand-off

Application (or human) decides the next agent. Share context via `message_history=result.all_messages()`. Natural fit for FastAPI route orchestration and coach-approval gates.

### `pydantic-graph` vs LangGraph

| Dimension | `pydantic-graph` | LangGraph |
|---|---|---|
| Role | Typed async graph/state machine; **optional** for complex cases | Core product abstraction (StateGraph is the framework) |
| Coupling | Standalone — **no** dependency on `pydantic-ai` | Coupled to LangChain ecosystem (lighter than full LangChain, but still) |
| Edge definition | Type hints on `BaseNode` return types | Explicit edges / conditional edge functions |
| Docs posture | “Graphs are a nail; agents are a hammer — consider other multi-agent approaches first” | Graph-first |
| Durability | Pair with Temporal/DBOS/Prefect via PydanticAI capabilities | Built-in checkpointers (Memory/SQLite/Postgres/Redis) |
| HITL | Via deferred tools + durable engine, or graph.iter() | First-class `interrupt()` / `Command(resume=...)` |
| Best for | Occasional typed pipelines inside a PydanticAI app | Large, audit-heavy, branching workflows as the product’s spine |

**Assessment:** PydanticAI’s multi-agent story is **composition-first** (delegation + app hand-off). Graphs exist but are deliberately secondary. LangGraph’s state machine is more mature as a *primary* orchestration UI. For a sports platform that is mostly “typed specialist agents + FastAPI routing + occasional durable approval,” PydanticAI’s composition model fits better. If you later need a 40-node tournament-ops workflow with time-travel debugging, LangGraph (or Temporal workflows with PydanticAI agents as activities) is stronger.

---

## 1.4 Durable execution (Temporal, DBOS, Prefect, Restate)

Official overview: [Durable execution](https://pydantic.dev/docs/ai/capabilities/durable_execution/overview/).

Supported engines:
1. **Temporal** (capability in-package)
2. **DBOS** (capability in-package)
3. **Prefect** (capability in-package)
4. **Restate** (external SDK, public-interface integration — also a reference for custom engines)
5. Additional: Kitaru, Apache Airflow (external)

### How the integration works (post-v2 capability model)

**Old (deprecated):** wrap agent → `TemporalAgent` / `DBOSAgent` / `PrefectAgent` auto-wrapped `run()`.

**Current:** attach capability; **you** own the durable boundary:

```python
agent = Agent(
    "openai:gpt-5.6-sol",
    name="geography",
    instructions="You're an expert in geography.",
    capabilities=[TemporalDurability()],  # or DBOSDurability / PrefectDurability
)
# Durability ONLY applies when agent.run() executes inside a workflow/flow.
```

What the capability buys you:
- Inside a workflow, **model requests**, **tool calls**, and **MCP I/O** are routed through Temporal activities / DBOS steps / Prefect tasks.
- Progress survives process crash, deploy, and transient API failure via the engine’s replay/checkpoint model.
- Streaming + MCP remain supported under durability.
- Outside a workflow, the same `Agent` is a normal non-durable agent (transparent).

### Temporal (best “enterprise durable” for Hetzner)

Architecture: Temporal Server stores encrypted workflow state; Worker runs deterministic workflow (agent loop) + activities (model/tool/MCP I/O).

```python
from temporalio import workflow
from temporalio.client import Client
from temporalio.worker import Worker
from pydantic_ai import Agent
from pydantic_ai.durable_exec.temporal import (
    PydanticAIPlugin, PydanticAIWorkflow, TemporalDurability,
)

agent = Agent(
    "openai:gpt-5.6-sol",
    name="geography",
    instructions="You're an expert in geography.",
    capabilities=[TemporalDurability()],
)

@workflow.defn
class GeographyWorkflow(PydanticAIWorkflow):
    __pydantic_ai_agents__ = [agent]

    @workflow.run
    async def run(self, prompt: str) -> str:
        result = await agent.run(prompt)
        return result.output

# Worker registers activities via PydanticAIPlugin
# API endpoint should start/signal workflow — NOT call agent.run() in-process
```

Install: `pip install "pydantic-ai[temporal]"` or slim equivalent.  
Self-host Temporal on Hetzner (or Temporal Cloud if ever acceptable).  
Critical API note: attaching `TemporalDurability` alone does **not** make HTTP handlers durable — the FastAPI route must start a workflow and bridge events/results.

Caveats from docs:
- Activity `RunContext` is a **serialized copy** — mutating `ctx.usage` inside tools does not accrue to parent the way in-process runs do; carry delegate usage explicitly.
- Per-run capabilities / some dynamic toolsets have Temporal registration constraints ([issue #5477](https://github.com/pydantic/pydantic-ai/issues/5477)).

Source: [Temporal integration](https://pydantic.dev/docs/ai/capabilities/durable_execution/temporal/).

### DBOS (best “lightweight durable” for Hetzner)

DBOS is an **in-process library** that checkpoints workflows/steps to Postgres (or SQLite). No separate workflow cluster required — very attractive for a single-service Hetzner deployment.

```python
from dbos import DBOS, DBOSConfig
from pydantic_ai import Agent
from pydantic_ai.durable_exec.dbos import DBOSDurability

DBOS(config={"name": "ppd_agent", "system_database_url": "postgres://..."})

agent = Agent(
    "openai:gpt-5.6-sol",
    name="geography",
    capabilities=[DBOSDurability()],
)

@DBOS.workflow()
async def answer(question: str) -> str:
    result = await agent.run(question)
    return result.output

async def main():
    DBOS.launch()
    print(await answer("What is the capital of Mexico?"))
```

Notes:
- Model requests + MCP go through DBOS steps automatically; **custom tools / event stream handlers that do I/O should be `@DBOS.step`**.
- `DBOSAgent` wrapper deprecated; must wrap `run` in `@DBOS.workflow` yourself.
- Postgres recommended for production.

Source: [DBOS integration](https://pydantic.dev/docs/ai/capabilities/durable_execution/dbos/).

### Prefect

Prefect 3 transactional/task semantics. `PrefectDurability` routes model/tool/MCP through Prefect tasks when `agent.run()` is inside `@flow`. Good if you already run Prefect for data pipelines; otherwise Temporal/DBOS are cleaner agent runtimes.

Source: [Prefect integration](https://pydantic.dev/docs/ai/capabilities/durable_execution/prefect/).

### What this buys PeakPerformance specifically

| Need | Without durability | With Temporal/DBOS + PydanticAI |
|---|---|---|
| Coach approves training plan change overnight | Process dies → lost mid-loop | Workflow pauses; resumes days later |
| Wearable tool call times out | Retry from scratch; duplicate side effects | Activity/step retries with checkpointed progress |
| Multi-specialist nightly insight job | Cron + hope | Durable workflow with per-step replay |
| Streaming UI during durable run | DIY bridging | Supported; bridge workflow events to SSE/WS |

**Recommendation for this stack:** start with **DBOS + Postgres** if you want minimal ops; graduate to **self-hosted Temporal** when you need multi-worker scale, schedules, and stronger workflow isolation.

---

## 1.5 Human-in-the-loop & deferred tools

Source: [Deferred tools](https://pydantic.dev/docs/ai/tools-toolsets/deferred-tools/).

Two deferred flavors:
1. **Approval required** — `requires_approval=True` or raise `ApprovalRequired` (incl. from `args_validator`)
2. **External execution** — raise `CallDeferred`; caller/handler supplies result

Two resolution strategies:
1. **Inline handler** — `HandleDeferredToolCalls` capability; run continues in one call
2. **Stop-the-world** — run ends with `DeferredToolRequests`; later resume with `message_history` + `DeferredToolResults` (new `run_id`; correlate via `conversation_id`)

```python
from pydantic_ai import Agent, ApprovalRequired, CallDeferred, RunContext
from pydantic_ai.capabilities import HandleDeferredToolCalls

async def handle_deferred(ctx, requests):
    approvals = {c.tool_call_id: True for c in requests.approvals}
    calls = {c.tool_call_id: f"(external {c.tool_name})" for c in requests.calls}
    return requests.build_results(approvals=approvals, calls=calls)

agent = Agent(
    "openai:gpt-5.2",
    capabilities=[HandleDeferredToolCalls(handler=handle_deferred)],
)

@agent.tool_plain(requires_approval=True)
def delete_file(path: str) -> str:
    return f"File {path!r} deleted"
```

**Security warning (official docs):** HITL approval is **not** an authz boundary against an untrusted client that can submit `message_history`. Enforce sensitive actions inside the tool with real auth; treat approval as protection against the *model*, not the client.

Combined with Temporal/DBOS: pause for coach approval across process restarts — this is the production HITL pattern you need.

---

## 1.6 Streaming (incl. structured output)

| API | Use |
|---|---|
| `run_stream()` + `stream_text()` | Token text streaming |
| `run_stream()` + `stream_output()` | **Validated partial structured output** |
| `run_stream_events()` | Raw `AgentStreamEvent`s |
| `iter()` + node streams | Full control; stream tools + final structured output |

```python
async with agent.run_stream("Extract the athlete profile") as result:
    async for profile in result.stream_output():
        # each yield is an accumulated snapshot with partial validation
        yield profile
```

Caveats:
- Default `run_stream()` may treat first matching output as final and skip dangling tool calls — set `end_strategy` or use `run_stream_events` / `iter` when tools must always run.
- Output functions/validators see `ctx.partial_output` — skip side effects until final.
- Cancelled streams mark response `state='interrupted'`; history repair is built in.

Source: [Agents — streaming](https://pydantic.dev/docs/ai/core-concepts/agent), [Output — streamed results](https://pydantic.dev/docs/ai/core-concepts/output).

---

## 1.7 Observability: Logfire vs plain OpenTelemetry

**Compliance answer: you do not need Logfire cloud.**

Facts from [Logfire integration docs](https://pydantic.dev/docs/ai/integrations/logfire/):
- Instrumentation is **optional**; if Logfire isn’t configured, virtually no overhead / nothing sent.
- Instrumentation uses **OpenTelemetry** GenAI semantic conventions.
- Options:
  1. Logfire cloud (productized UX)
  2. Logfire SDK with `send_to_logfire=False` + OTLP exporter to your collector
  3. **OTel without Logfire at all** — configure TracerProvider yourself and call `Agent.instrument_all()` / Instrumentation capability

```python
import logfire

logfire.configure(send_to_logfire=False)  # stay off Pydantic cloud
logfire.instrument_pydantic_ai()
# OTEL_EXPORTER_OTLP_ENDPOINT=https://your-collector.internal
```

Or pure OTel (no `logfire` package) — ensure `Agent.instrument_all()` is called or spans stay silent.

**For Hetzner:** run Grafana Tempo / Jaeger / self-hosted OTel collector. Keep `pydantic-ai-slim` without logfire if you want zero SDK gravity toward their SaaS.

Caveat: Logfire remains the *best* UI for this framework; commercial incentive exists (Series A / Logfire monetization). That is a product coupling risk, not a technical lock-in — OTel exit is real.

---

## 1.8 Model provider support

Model-agnostic by design. Documented providers include:

OpenAI, Anthropic, Gemini/Google, DeepSeek, Grok/xAI, Cohere, Mistral, Perplexity, Azure AI Foundry, Amazon Bedrock (+ Mantle), Google Cloud/Vertex, Ollama, LiteLLM, Groq, OpenRouter, Together, Fireworks, Cerebras, Hugging Face, GitHub, Heroku, Vercel, Nebius, OVHcloud, Alibaba Cloud, SambaNova, Z.AI — plus **custom models**.

Full install pulls OpenAI/Anthropic/Google; slim extras per provider (`openai`, `google`, `anthropic`, `bedrock`, `groq`, `mistral`, `cohere`, `xai`, `openrouter`, `huggingface`, …).

Source: [Overview](https://pydantic.dev/docs/ai/overview/), [Install](https://pydantic.dev/docs/ai/overview/install/).

---

## 1.9 Evals

**Package:** `pydantic-evals` (also bundled with full `pydantic-ai`; slim extra `evals`).

Philosophy: **code-first** datasets/cases/evaluators/experiments (not a web-config product). Optional Logfire visualization.

```python
from pydantic_evals import Case, Dataset
from pydantic_evals.evaluators import IsInstance

dataset = Dataset(
    name="readiness_insights",
    cases=[
        Case(
            name="low_hrv",
            inputs={"hrv": 32, "sleep_hours": 5.1},
            expected_output="reduce_intensity",
        )
    ],
    evaluators=[IsInstance(type_name="str")],
)

report = dataset.evaluate_sync(my_agent_task)
report.print()
```

Features: built-in evaluators, LLM-as-judge, custom evaluators, **span-based evaluation** via OTel traces (tool-call path correctness), dataset YAML/JSON, concurrency controls.

Independence: `pydantic-evals` does **not** require `pydantic-ai`.

Source: [Evals overview](https://pydantic.dev/docs/ai/evals/evals).

---

## 1.10 MCP — client and server

Source: [MCP overview](https://pydantic.dev/docs/ai/mcp/overview).

1. **Client (agent uses MCP tools):** preferred `capabilities=[MCP(url=...)]`; local execution by default; `native=True` opts into provider-native MCP with local fallback. Lower-level: `MCPToolset` via `toolsets=[...]`.
2. **Server (agent inside an MCP server):** documented under MCP server guides — expose PydanticAI agents as MCP tools for Cursor/Claude Desktop/etc.

Also: AG-UI / UI event stream integrations for interactive frontends.

---

## 1.11 Honest criticism from production users

| Criticism | Status as of 2026-08 | Severity for you |
|---|---|---|
| “It’s beta / APIs break constantly” ([Eigenwise on 0.0.13](https://eigenwise.io/writing/the-hidden-costs-of-ai-frameworks)) | **Stale** for core APIs; still true at the margins (weekly 2.x releases, durable capability migration) | Medium — pin versions |
| Logfire monetization gravity | Real commercial incentive; **technical** OTel escape hatch is documented and used in the wild | Low–Medium — enforce `send_to_logfire=False` in policy |
| Provider adapter bugs (Vertex auth races, Google timeout overrides) | Ongoing GitHub issues ([#2026](https://github.com/pydantic/pydantic-ai/issues/2026), [#4031](https://github.com/pydantic/pydantic-ai/issues/4031)) | Medium — wrap providers, set timeouts at multiple layers |
| Tool-retry regressions after releases ([#5178](https://github.com/pydantic/pydantic-ai/issues/5178)) | Happens in production for some users (~0.5% task failure cited) | Medium — pin + regression evals |
| Framework churn vs “just write a loop” ([Eigenwise](https://eigenwise.io/writing/the-hidden-costs-of-ai-frameworks), HN agent discourse 2026) | Valid for simple agents; weaker once durability + HITL + streaming structured output are requirements | See Part 2 steelman |
| Smaller ecosystem vs LangGraph | True for graph patterns / community recipes | Medium |
| Durable usage accounting quirks under Temporal | Documented limitation | Low if you design for it |

**Net:** early-2025 “don’t use this in prod” takes are obsolete. Late-2026 risk is **release velocity + provider edge cases**, mitigated by pinning, evals, and slim installs — not by avoiding the framework.

---

# Part 2 — Head-to-head synthesis

## 2.1 Candidates & versions (as of 2026-08-02)

| Candidate | Current version / status | Primary docs |
|---|---|---|
| **PydanticAI** | **2.22.0** (2026-07-31) | https://pydantic.dev/docs/ai/overview/ |
| **LangGraph** | 1.x line (1.0 GA Oct 2025; ongoing 2026 releases; use ≥1.0.10 for security) | https://docs.langchain.com/oss/python/langgraph/ |
| **Google ADK** | **2.0.0 GA** (Python 2026-05-19) | https://github.com/google/adk-docs |
| **OpenAI Agents SDK** | **openai-agents 0.19.1** | https://openai.github.io/openai-agents-python/ |
| **Microsoft Agent Framework** | **1.0 GA** (2026-04-03), Python + .NET | https://github.com/microsoft/agent-framework |
| **No framework** | Your code + provider SDKs + optional Temporal/DBOS | — |

## 2.2 Steelman: “no framework, ~500-line loop”

Experienced teams argue:

1. An agent is `while not done: messages → model → maybe tools → append → repeat`.
2. Frameworks add abstraction tax, version churn, and leaky “magic” (streaming end strategies, context copies in activities).
3. Your real differentiators are **domain tools, authz, data access, and product UX** — not the loop.
4. FastAPI + Pydantic + httpx + Instructor/structured outputs already cover 80% of typed LLM I/O.
5. Durability belongs in **Temporal/DBOS**, which you can call directly without an agent framework wrapping them.
6. Every framework is still converging on MCP/A2A; protocol skill matters more than framework skill.

**When this is correct:**
- Single-agent, request-scoped, no multi-day HITL
- <10 tools, simple retries
- Team is small and owns the loop deeply
- You are willing to build: schema export, validation reflection, stream partial parse, usage limits, message history normalization across providers, tool gating, eval harness, and OTel spans yourselves

**Why it fails for PeakPerformance’s stated requirements:**
- Durable HITL + multi-agent + streaming structured output + provider independence is **not** 500 lines — it is 3–8k lines of the exact code PydanticAI/LangGraph already maintain against shifting provider APIs.
- You already have evidence of under-adoption (`pydantic-ai==0.0.13` unused). A roll-your-own loop often becomes an undocumented internal framework with worse docs than PydanticAI.
- Sports-performance workflows (coach approval, overnight batches, wearable fan-in) are textbook durable-engine territory; frameworks that *integrate* those engines beat DIY glue.

**Steelman verdict:** keep a **thin domain orchestration layer** in FastAPI (routing, authz, deps). Do **not** reinvent the agent runtime. If you ever outgrow PydanticAI, the exit cost is rewriting tool wrappers — keep tools as plain async functions.

## 2.3 Comparison matrix

Scores: **5** = excellent fit for our constraints · **1** = poor / fights the stack.  
Weights reflect PeakPerformance priorities (durable HITL + FastAPI/Pydantic fit + self-host/no vendor telemetry + provider independence).

| Criterion (weight) | PydanticAI | LangGraph | Google ADK | OpenAI Agents SDK | MS Agent Framework | No framework |
|---|:---:|:---:|:---:|:---:|:---:|:---:|
| Deterministic control | 3 | **5** | 4 | 3 | 4 | **5** |
| Durable execution + HITL | **5** | **5** | 4 | 2 | 4 | 2* |
| Streaming (incl. structured) | **5** | 4 | 3 | 4 | 3 | 3 |
| Type safety (Pydantic v2) | **5** | 3 | 3 | 3 | 4 | 4 |
| Provider independence | **5** | **5** | 3 | 3 | 3 | **5** |
| Self-host / no vendor telemetry | **5** | 4 | 3 | 2 | 2 | **5** |
| Observability (OTel-friendly) | **5** | 4 | 3 | 3 | 4 | 3 |
| Maturity / stability | 4 | **5** | 4 | 3 | 3 | **5**† |
| Dependency weight | 4‡ | 3 | 3 | **5** | 3 | **5** |
| Learning curve | **5** | 2 | 3 | **5** | 3 | 4 |
| Fit: FastAPI + Pydantic v2 codebase | **5** | 3 | 2 | 3 | 2 | 4 |
| **Weighted feel (qualitative)** | **Best overall** | Best graphs | Best GCP | Fastest OpenAI | Best Azure | Best only if scope shrinks |

\* No-framework durability is excellent *if* you adopt Temporal/DBOS yourselves — score assumes “500-line loop” without that investment.  
† “Maturity” of *your* code is high only after you write and operate it.  
‡ Use `pydantic-ai-slim[openai,anthropic,temporal|dbos,mcp,evals]` — avoid full kitchen-sink install.

### Narrative by criterion

**Deterministic control:** LangGraph wins (explicit nodes/edges/state). PydanticAI is agent-loop-first; graphs optional. DIY wins on paper but you maintain the graph yourself.

**Durable + HITL:** Tie PydanticAI (Temporal/DBOS/Prefect capabilities + deferred tools) vs LangGraph (checkpointers + `interrupt`). ADK 2.0 has session persistence + long-running pause/resume (strong on GCP). MS AF durable extension leans Azure Functions / Durable Task. OpenAI SDK has sessions/memory but not Temporal-class durable execution. DIY needs a real workflow engine anyway.

**Streaming:** PydanticAI’s `stream_output()` with partial Pydantic validation is best-in-class for typed UIs. LangGraph streaming is strong but more event/state oriented.

**Type safety:** PydanticAI is purpose-built. Others wrap Pydantic or Zod-like schemas with less end-to-end generics.

**Provider independence:** PydanticAI ≈ LangGraph ≈ DIY. Lab SDKs (OpenAI, Google, Microsoft) are multi-provider *capable* but culturally single-cloud.

**Self-host / telemetry:** PydanticAI and DIY are cleanest. LangGraph is self-hostable; LangSmith is optional but culturally central. ADK/MS/OpenAI pull toward Vertex/Foundry/OpenAI platforms.

**Observability:** PydanticAI OTel-native. LangGraph/LangSmith excellent but SaaS gravity. Others vary.

**Maturity:** LangGraph has the deepest production battle scars for orchestration. PydanticAI 2.x is production-viable with pin discipline. MS AF 1.0 and ADK 2.0 are new GA (2026). OpenAI SDK still 0.x on PyPI (`0.19.1`).

**Dependency / learning curve:** OpenAI SDK and DIY are lightest. PydanticAI is easy if you know FastAPI/Pydantic. LangGraph is steep.

**Codebase fit:** PydanticAI is the only framework that feels like a continuation of FastAPI. Your unused `0.0.13` pin is ironic confirmation of that earlier instinct.

## 2.4 Recommendation & change conditions

### Primary: **PydanticAI 2.22.x + DBOS or Temporal**

Adopt plan (research-level, not implementation):
1. Replace `pydantic-ai==0.0.13` with `pydantic-ai-slim[openai,anthropic,google,mcp,evals,dbos]` (or `temporal`).
2. Model each specialist as `Agent[AppDeps, OutputModel]` with dataclass deps holding httpx/DB clients.
3. Use programmatic hand-off + selective delegation; introduce `pydantic-graph` only when FastAPI routing becomes spaghetti.
4. HITL via `requires_approval` / `HandleDeferredToolCalls`; durable pause via DBOS workflows (start) or Temporal (scale).
5. Observability: OTel → self-hosted collector; `send_to_logfire=False` or no Logfire SDK.
6. Gate releases with `pydantic-evals` datasets for insight quality and tool-path correctness.

### Runner-up: **LangGraph**

Choose if product management frames the system as a **durable state machine** (many branches, time-travel, parallel fan-out with joins) rather than a constellation of typed agents behind FastAPI.

### Conditions that would change the answer

| If this becomes true… | Switch to… |
|---|---|
| Azure is the strategic cloud / Durable Functions is mandated | **Microsoft Agent Framework 1.0** |
| Vertex AI Agent Engine / A2A-on-GCP is mandated | **Google ADK 2.0** |
| You standardize 100% on OpenAI Responses + want minimal glue | **OpenAI Agents SDK** (accept weaker durable story or add Temporal yourself) |
| Control plane is a 30+ node audit-heavy graph with time-travel as a user feature | **LangGraph** |
| Scope collapses to single-agent request/response, <10 tools, no durable HITL | **No framework** (+ structured output helper) |
| PydanticAI 3.x removes durable APIs without migration path / Logfire becomes mandatory | Re-evaluate → LangGraph + Temporal |

### Explicit non-recommendations for this stack

- **Google ADK** — excellent, but GCP-centric gravity and weaker FastAPI/Pydantic ergonomic match for a Hetzner-hosted FastAPI monorepo.
- **OpenAI Agents SDK** — great DX, weak durable-engine story relative to requirements; provider culture risk.
- **Microsoft Agent Framework** — strong, but Azure hosting story; unnecessary weight for a Python/Hetzner shop.
- **No framework as default** — steals roadmap into infrastructure; only if requirements shrink.

---

## Sources (primary)

### PydanticAI
- https://pypi.org/project/pydantic-ai/ (v2.22.0)
- https://github.com/pydantic/pydantic-ai/releases
- https://pydantic.dev/docs/ai/overview/
- https://pydantic.dev/docs/ai/overview/install/
- https://pydantic.dev/docs/ai/core-concepts/agent
- https://pydantic.dev/docs/ai/core-concepts/output
- https://pydantic.dev/docs/ai/tools-toolsets/tools
- https://pydantic.dev/docs/ai/tools-toolsets/tools-advanced
- https://pydantic.dev/docs/ai/tools-toolsets/deferred-tools/
- https://pydantic.dev/docs/ai/guides/multi-agent-applications/
- https://pydantic.dev/docs/ai/graph/graph/
- https://pydantic.dev/docs/ai/capabilities/durable_execution/overview/
- https://pydantic.dev/docs/ai/capabilities/durable_execution/temporal/
- https://pydantic.dev/docs/ai/capabilities/durable_execution/dbos/
- https://pydantic.dev/docs/ai/capabilities/durable_execution/prefect/
- https://pydantic.dev/docs/ai/integrations/logfire/
- https://pydantic.dev/docs/ai/mcp/overview
- https://pydantic.dev/docs/ai/evals/evals
- https://github.com/pydantic/pydantic-ai/pull/4977
- https://github.com/pydantic/pydantic-ai/issues/5477

### Criticism / production signal
- https://eigenwise.io/writing/the-hidden-costs-of-ai-frameworks (early 0.0.13 critique — historically useful, now partially stale)
- https://github.com/pydantic/pydantic-ai/issues/5178
- https://github.com/pydantic/pydantic-ai/issues/4031
- https://github.com/pydantic/pydantic-ai/issues/2026

### Competitors
- LangGraph checkpointers: https://docs.langchain.com/oss/python/langgraph/checkpointers
- LangGraph persistence: https://docs.langchain.com/oss/python/langgraph/persistence
- Google ADK 2.0: https://github.com/google/adk-python/releases/tag/v2.0.0 · https://github.com/google/adk-docs
- OpenAI Agents SDK: https://pypi.org/project/openai-agents/ · https://openai.github.io/openai-agents-python/
- Microsoft Agent Framework 1.0: https://devblogs.microsoft.com/agent-framework/microsoft-agent-framework-version-1-0/ · https://learn.microsoft.com/en-us/agent-framework/integrations/durable-extension
- Industry comparisons (secondary): https://deepresearch.ninja/2026/06/AI-Agent-Frameworks-in-2026-A-Comprehensive-Comparison/ · https://dreaming.press/posts/openai-agents-sdk-vs-pydantic-ai-vs-google-adk.html

---

## Appendix — Suggested dependency shape for this monorepo

```text
pydantic-ai-slim[openai,anthropic,google,mcp,evals,dbos]==2.22.0
# later: swap/add temporal instead of or in addition to dbos
# never require logfire in production images unless explicitly approved
```

```python
# FastAPI sketch
@router.post("/agents/readiness/run")
async def run_readiness(...):
    deps = AppDeps(http=httpx_client, athlete_id=..., principal=user)
    # short path: await agent.run(...)
    # durable path: start DBOS/Temporal workflow; return workflow_id
```

---

*End of dossier 47.*
