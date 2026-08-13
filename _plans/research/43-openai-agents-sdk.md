# 43 — OpenAI Agent Platform Dossier

**Topic:** OpenAI Agents SDK (Python), AgentKit, Responses API  
**Research date:** 2026-08-02  
**Method:** External research only (official docs via WebFetch, PyPI, Temporal docs, production criticism). No local codebase exploration.  
**Package version verified:** `openai-agents==0.19.2` (PyPI upload 2026-08-01; requires Python ≥3.10)

---

## Executive verdict (for our stack)

Strong fit for **orchestration + streaming + post-generation guardrails** on a FastAPI service we host ourselves. Weak fit if we require **zero vendor telemetry by default**, **first-class multi-provider parity**, or **EU-only traces**. Tracing phones home unless disabled/redirected; ZDR customers cannot use the default OpenAI Traces dashboard at all. Prefer **manager (agents-as-tools)** over pure handoffs so one orchestrator owns the user reply and a single `output_guardrails` chain can enforce non-diagnostic language.

---

## 1. Product map: Agents SDK vs AgentKit vs Responses API

| Layer | What it is | Status (Aug 2026) | When to use |
|---|---|---|---|
| **Responses API** | Low-level `/v1/responses` model API | GA | You own the loop, tools, state |
| **Agents SDK** (`openai-agents`) | Higher-level runtime: Agent, Runner, handoffs, guardrails, sessions, tracing | GA library, still **v0.x** | Multi-step agents with tools/specialists |
| **AgentKit** | Suite announced DevDay 2025: Agent Builder (visual), ChatKit, Connector Registry, Evals | **Agent Builder + Evals wind down Nov 30, 2026**; ChatKit remains | Prototype UI / connectors only — **do not build production logic here** |

Official positioning ([Agents SDK guide](https://developers.openai.com/api/docs/guides/agents), [AgentKit announcement](https://openai.com/index/introducing-agentkit/)):

- Use **Responses API** when you want to own the loop.
- Use **Agents SDK** when you want the SDK to manage turns, tool execution, handoffs, guardrails, sessions, and resumable approvals.
- Agent Builder is being retired; OpenAI recommends migrating durable workflows to the **Agents SDK**.

Sources:
- https://openai.github.io/openai-agents-python/
- https://developers.openai.com/api/docs/guides/agents
- https://openai.com/index/introducing-agentkit/
- https://pypi.org/project/openai-agents/

---

## 2. Agents SDK maturity and core primitives

### Version / maturity

| Fact | Value |
|---|---|
| PyPI package | `openai-agents` |
| Current version | **0.19.2** (2026-08-01) |
| Python | ≥3.10 |
| License | MIT |
| Lineage | Production upgrade of experimental **Swarm** |
| Stability signal | Still **0.x** after ~17 months; weekly-ish release cadence — expect churn |

Install:

```bash
pip install openai-agents
# optional extras:
pip install 'openai-agents[voice]'   # voice pipeline
pip install 'openai-agents[redis]'   # Redis sessions
pip install 'openai-agents[litellm]' # LiteLLM adapter (beta)
pip install 'openai-agents[any-llm]' # Any-LLM adapter (beta)
```

### Core primitives

| Primitive | Role |
|---|---|
| **Agent** | LLM + instructions + tools + optional handoffs / guardrails / `output_type` |
| **Runner** | Executes the agent loop (`run`, `run_sync`, `run_streamed`) |
| **Tools** | `@tool` / `function_tool`, hosted tools, MCP, `Agent.as_tool()` |
| **Handoffs** | Transfer conversation ownership to another agent (exposed as tools to the LLM) |
| **Guardrails** | Input / output / tool validation with tripwires |
| **Sessions** | Client-side (or OpenAI-backed) conversation history across runs |
| **Context** | Typed DI bag passed through tools/handoffs (`RunContextWrapper`) |
| **Tracing** | Built-in spans → OpenAI dashboard by default |

Default model (docs, Aug 2026): **`gpt-5.4-mini`** with `reasoning.effort="none"` and `verbosity="low"`. Recommended higher-quality: **`gpt-5.6-sol`**.

### Hello world (official)

```python
from agents import Agent, Runner

agent = Agent(name="Assistant", instructions="You are a helpful assistant")
result = Runner.run_sync(agent, "Write a haiku about recursion in programming.")
print(result.final_output)
```

Source: https://openai.github.io/openai-agents-python/

### Agent + tools + structured output (official patterns)

```python
from pydantic import BaseModel
from agents import Agent
from agents.decorators import tool

@tool
def get_weather(city: str) -> str:
    """returns weather info for the specified city."""
    return f"The weather in {city} is sunny"

class CalendarEvent(BaseModel):
    name: str
    date: str
    participants: list[str]

agent = Agent(
    name="Calendar extractor",
    instructions="Extract calendar events from text",
    model="gpt-5-nano",
    tools=[get_weather],
    output_type=CalendarEvent,  # uses structured outputs
)
```

Source: https://openai.github.io/openai-agents-python/agents/

### Context (dependency injection)

```python
from dataclasses import dataclass
from agents import Agent

@dataclass
class UserContext:
    name: str
    uid: str
    is_pro_user: bool

agent = Agent[UserContext](
    name="Coach assistant",
    instructions="Help the athlete with performance questions.",
)
```

Source: https://openai.github.io/openai-agents-python/agents/

---

## 3. Multi-agent: handoffs vs supervisor/orchestrator

Official orchestration guide describes two first-class patterns:

| Pattern | Mechanism | Who owns the final reply | Best when |
|---|---|---|---|
| **Agents as tools (manager)** | `specialist.as_tool(...)` on a manager agent | Manager keeps control | Combine multiple specialists; one place for shared output guardrails |
| **Handoffs** | `handoffs=[...]`; LLM calls `transfer_to_<agent>` | Specialist becomes active agent | Specialist should speak directly; focused prompts |

```python
from agents import Agent

booking_agent = Agent(...)
refund_agent = Agent(...)

# Manager pattern (orchestrator)
customer_facing_agent = Agent(
    name="Customer-facing agent",
    instructions=(
        "Handle all direct user communication. "
        "Call the relevant tools when specialized expertise is needed."
    ),
    tools=[
        booking_agent.as_tool(
            tool_name="booking_expert",
            tool_description="Handles booking questions and requests.",
        ),
        refund_agent.as_tool(
            tool_name="refund_expert",
            tool_description="Handles refund questions and requests.",
        ),
    ],
)

# Handoff pattern
triage_agent = Agent(
    name="Triage agent",
    instructions="If booking → hand off to booking; if refunds → refund agent.",
    handoffs=[booking_agent, refund_agent],
)
```

Sources:
- https://openai.github.io/openai-agents-python/multi_agent/
- https://openai.github.io/openai-agents-python/handoffs/
- https://openai.github.io/openai-agents-python/agents/

### How handoffs differ from a supervisor

- Handoffs are **peer ownership transfer**, not a call/return. After handoff, the specialist sees (by default) the full conversation history and produces the final output.
- They are represented as **tools** to the LLM (`transfer_to_refund_agent`).
- You can customize with `handoff()`, `on_handoff`, `input_type` (metadata), and `input_filter` (rewrite history).
- Nested handoff history is an **opt-in beta**.

### Limitations (important for us)

1. **Guardrail boundaries:** Input guardrails run only for the **first** agent; output guardrails only for the agent that produces the **final** output. Mid-chain specialists do not automatically get the same I/O guardrails.
2. **Tool guardrails do not apply to handoff calls** themselves (only function tools).
3. Handoffs stay **within a single `Runner.run`** — not a durable cross-request workflow by themselves.
4. Less deterministic than code-orchestrated graphs (LangGraph-style); routing quality depends on the triage model + prompts.
5. Combining handoffs with experimental **hosted multi-agent** is rejected (conflicting ownership).

**Recommendation for PPD:** Prefer **manager + `as_tool()` specialists** so the orchestrator always owns the answer and `output_guardrails` always run on the user-facing text.

---

## 4. Guardrails — mechanism and non-diagnostic fitness

### Mechanism

Three layers:

1. **Input guardrails** — on the first user input (parallel by default; blocking with `run_in_parallel=False`).
2. **Output guardrails** — on the final agent output (always after completion).
3. **Tool guardrails** — before/after each `@tool` invocation (skip/replace/tripwire).

Tripwires: if `tripwire_triggered=True`, the SDK raises `InputGuardrailTripwireTriggered` or `OutputGuardrailTripwireTriggered` and **halts** the run.

### Official output-guardrail example (adapted pattern)

```python
from pydantic import BaseModel
from agents import (
    Agent,
    GuardrailFunctionOutput,
    OutputGuardrailTripwireTriggered,
    RunContextWrapper,
    Runner,
)
from agents.decorators import output_guardrail

class MessageOutput(BaseModel):
    response: str

class DiagnosticClaimCheck(BaseModel):
    reasoning: str
    makes_medical_claim: bool
    offending_phrases: list[str]

checker = Agent(
    name="Non-diagnostic guardrail",
    instructions=(
        "Detect diagnoses, treatment prescriptions, medication advice, "
        "or disease labels. Performance/lifestyle language is OK."
    ),
    output_type=DiagnosticClaimCheck,
    model="gpt-5.6-luna",  # cheap/fast checker
)

@output_guardrail
async def non_diagnostic_guardrail(
    ctx: RunContextWrapper, agent: Agent, output: MessageOutput
) -> GuardrailFunctionOutput:
    result = await Runner.run(checker, output.response, context=ctx.context)
    return GuardrailFunctionOutput(
        output_info=result.final_output,
        tripwire_triggered=result.final_output.makes_medical_claim,
    )

agent = Agent(
    name="Performance coach",
    instructions="Sports performance analyst. Never diagnose.",
    output_guardrails=[non_diagnostic_guardrail],
    output_type=MessageOutput,
)

try:
    await Runner.run(agent, "Is my HRV low because I have heart disease?")
except OutputGuardrailTripwireTriggered:
    # return safe fallback / ask coach to rephrase
    ...
```

Source pattern: https://openai.github.io/openai-agents-python/guardrails/

### Suitability for our non-diagnostic constraint

| Requirement | Fit | Notes |
|---|---|---|
| Post-generation validation that model made no medical claim | **Yes — strong** | First-class `output_guardrails` + tripwire exception is exactly this |
| Fail closed before user sees text | **Yes** | Exception before you stream final answer (on non-streamed path); on stream, drain then check / suppress |
| Deterministic regex/rules | **Yes** | Guardrail function can be pure Python (no LLM) |
| LLM classifier as second pass | **Yes** | Common pattern in docs (cheap model under the hood) |
| Validate every specialist mid-chain | **Partial** | Agent I/O guardrails are boundary-scoped; use **tool guardrails** or manager pattern |
| Streaming token-by-token with live tripwire | **Caveat** | Output guardrails run on **final** output; partial tokens may already have been sent unless you buffer |

**Verdict:** Suitable as the primary post-generation enforcement layer for non-diagnostic language, especially if we (a) use manager orchestration, (b) combine regex + cheap LLM checker, (c) buffer streamed text until the output guardrail passes, or stream only after a structured final object is validated.

---

## 5. Sessions and memory

### Built-in behavior

When `session=` is passed to `Runner.run`:

1. Before run: load history and prepend to input.
2. After run: persist new items (user, assistant, tool calls, etc.).

Cannot combine Sessions with `conversation_id` / `previous_response_id` / `auto_previous_response_id` in the same run.

### Where it persists

| Backend | Package / module | Persistence location |
|---|---|---|
| `SQLiteSession` | built-in | Local file or in-memory (our process / volume) |
| `AsyncSQLiteSession` | extensions | Same, async |
| `RedisSession` | `openai-agents[redis]` | Redis we host |
| `SQLAlchemySession` | extensions | Any SQLAlchemy DB (e.g. Supabase Postgres) |
| `MongoDBSession` | `openai-agents[mongodb]` | MongoDB |
| `DaprSession` | `openai-agents[dapr]` | Dapr state store |
| `OpenAIConversationsSession` | built-in | **OpenAI Conversations API** (server-side; not ZDR-friendly for residency) |
| `OpenAIResponsesCompactionSession` | memory helper | Wraps another session; uses `responses.compact` |
| `EncryptedSession` | wrapper | Encryption + TTL over another backend |

```python
from agents import Agent, Runner, SQLiteSession

session = SQLiteSession("conversation_123", "conversations.db")
result = await Runner.run(agent, "What city is the Golden Gate Bridge in?", session=session)
result = await Runner.run(agent, "What state is it in?", session=session)  # remembers
```

```python
from agents.extensions.memory import SQLAlchemySession

session = SQLAlchemySession.from_url(
    "athlete_42",
    url="postgresql+asyncpg://user:pass@db/ppd",
    create_tables=True,
)
```

Source: https://openai.github.io/openai-agents-python/sessions/

**For us:** Prefer `SQLAlchemySession` → Supabase Postgres or `RedisSession` on Hetzner. Avoid `OpenAIConversationsSession` for EU health-adjacent content.

---

## 6. Tracing and compliance

### Defaults

- Tracing is **enabled by default**.
- Spans cover: full run, agent turns, LLM generations, tool calls, guardrails, handoffs, audio.
- Default exporter: `BatchTraceProcessor` → **OpenAI backend** → Traces dashboard.

### Do traces leave our infrastructure?

**Yes, by default.** Generation spans can include **prompts and outputs** (`trace_include_sensitive_data` defaults to `True`). That is a direct compliance concern for wearables / biomarkers / genetics content.

### Disable / redirect

```bash
# 1) Global env disable
export OPENAI_AGENTS_DISABLE_TRACING=1

# 2) Sensitive payload redaction (still may send metadata unless disabled)
export OPENAI_AGENTS_TRACE_INCLUDE_SENSITIVE_DATA=false
```

```python
from agents import set_tracing_disabled, set_trace_processors, RunConfig, Runner

set_tracing_disabled(True)  # global

# or per-run
await Runner.run(agent, "…", run_config=RunConfig(tracing_disabled=True))

# or replace exporters (do NOT include OpenAI exporter)
set_trace_processors([MyLocalOtelProcessor()])  # replaces default; no OpenAI upload unless you add one
```

Also: `add_trace_processor()` adds a secondary sink **in addition to** OpenAI unless you replace via `set_trace_processors`.

### ZDR interaction

Official tracing docs: **“For organizations operating under a Zero Data Retention (ZDR) policy using OpenAI's APIs, tracing is unavailable.”**

So for EU ZDR projects we must plan on **local/self-hosted observability**, not the OpenAI Traces UI.

Sources:
- https://openai.github.io/openai-agents-python/tracing/
- https://developers.openai.com/api/docs/guides/your-data

---

## 7. Model support and LiteLLM in practice

### OpenAI path (recommended)

- Default: `OpenAIResponsesModel` → Responses API.
- Also: `OpenAIChatCompletionsModel`.
- Per-agent / per-run model selection; mix models in one workflow.

### Non-OpenAI paths

| Approach | Maturity | Notes |
|---|---|---|
| OpenAI-compatible `base_url` + Chat Completions | Practical | Many providers; disable/redirect tracing if no OpenAI key |
| `AnyLLMModel` / `AnyLLMProvider` | **Beta**, best-effort | `openai-agents[any-llm]` |
| `LitellmModel` / `litellm/...` names | **Beta**, best-effort | `openai-agents[litellm]`; usage metrics often need `ModelSettings(include_usage=True)` |
| Hosted OpenAI tools (web/file search, computer use) | OpenAI-only | Not portable |

Official caveat: adapters add a compatibility layer; **structured outputs / tool calling / usage** vary by provider. Providers without JSON Schema structured outputs will break apps that rely on `output_type`.

```python
# LiteLLM (beta) — conceptual pattern from docs
# pip install 'openai-agents[litellm]'
from agents import Agent
from agents.extensions.models.litellm_model import LitellmModel

agent = Agent(
    name="Anthropic specialist",
    model=LitellmModel(model="anthropic/claude-opus-4-7", api_key="…"),
)
```

Source: https://openai.github.io/openai-agents-python/models/

**Honest practice note:** Multi-provider works for Chat Completions-shaped models, but Responses-only features (tool search, programmatic tool calling, some reasoning settings) will not. Treat LiteLLM as an escape hatch, not the primary production path.

---

## 8. Structured outputs / strict JSON schema

- Set `Agent(..., output_type=MyPydanticModel)`.
- SDK uses the model's **structured outputs** path (Responses / compatible providers).
- Supports Pydantic models, dataclasses, TypedDict, lists (via TypeAdapter).
- Off-OpenAI: some providers only support `json_object` without schema → malformed JSON risk. Docs explicitly recommend providers with JSON Schema support.

---

## 9. Streaming to a web client (including tool events)

```python
from agents import Agent, Runner, ItemHelpers
from openai.types.responses import ResponseTextDeltaEvent

result = Runner.run_streamed(agent, "Summarize last week's training load.")
async for event in result.stream_events():
    if event.type == "raw_response_event" and isinstance(event.data, ResponseTextDeltaEvent):
        yield event.data.delta  # token deltas to SSE/WebSocket
    elif event.type == "agent_updated_stream_event":
        yield {"type": "agent", "name": event.new_agent.name}
    elif event.type == "run_item_stream_event":
        if event.name == "tool_called":
            yield {"type": "tool_called", "item": event.item}
        elif event.name == "tool_output":
            yield {"type": "tool_output", "item": event.item}
        elif event.name == "message_output_created":
            yield {"type": "message", "text": ItemHelpers.text_message_output(event.item)}
```

Semantic `RunItemStreamEvent.name` values include: `message_output_created`, `tool_called`, `tool_output`, `handoff_requested`, `handoff_occured` (legacy spelling), MCP approval events, etc.

**Must** consume `stream_events()` to completion (session persistence / approvals may finish after last token).

Source: https://openai.github.io/openai-agents-python/streaming/

---

## 10. Temporal / durable execution

Not built into the Agents SDK itself. **Official Temporal integration** exists:

- Python: `temporalio.contrib.openai_agents` (`OpenAIAgentsPlugin`, `activity_as_tool`)
- Model calls and I/O tools run as Temporal Activities; orchestration in Workflows
- Survives worker restarts; retries rate limits; HITL via signals + `RunState`

```python
from temporalio import workflow
from agents import Agent, Runner
from temporalio.contrib import openai_agents

@workflow.defn
class HelloWorldAgent:
    @workflow.run
    async def run(self, prompt: str) -> str:
        agent = Agent(
            name="Hello World Agent",
            instructions="Use tools when needed.",
            tools=[
                openai_agents.workflow.activity_as_tool(
                    get_weather, start_to_close_timeout=timedelta(seconds=10)
                ),
            ],
        )
        result = await Runner.run(agent, prompt)
        return result.final_output
```

Sources:
- https://temporal.io/blog/announcing-openai-agents-sdk-integration
- https://docs.temporal.io/ai-cookbook/openai-agents-sdk-python
- https://github.com/temporalio/sdk-python/tree/main/temporalio/contrib/openai_agents

Also: sandbox agents can be wrapped as Temporal workflows (OpenAI + Temporal joint demos).

**For us:** FastAPI request path can stay non-Temporal; nightly / long multi-tool analyses should use Temporal if we adopt this stack.

---

## 11. Realtime / voice (brief)

- **Realtime agents:** WebSocket voice/multimodal with `gpt-realtime-2.1`, interruption detection, context, guardrails (`pip install 'openai-agents[voice]'` / realtime extras as docs evolve).
- **Voice pipeline:** STT → agent workflow → TTS (separate from Realtime API).
- Pricing (standard): `gpt-realtime-2.1` audio ~$32 / $64 per 1M tokens; mini tier cheaper.
- EU note: tracing is **not currently EU data-residency compliant for `/v1/realtime`**.

Sources:
- https://openai.github.io/openai-agents-python/ (Realtime / Voice sections)
- https://developers.openai.com/api/docs/pricing
- https://developers.openai.com/api/docs/guides/your-data

---

## 12. Current OpenAI model lineup (mid-2026)

Frontier text models ([Models](https://developers.openai.com/api/docs/models), [Pricing](https://developers.openai.com/api/docs/pricing)):

| Model ID | Role | Context | Max out | Input $/1M | Cached in $/1M | Output $/1M | Long-ctx in/out* |
|---|---|---|---|---|---|---|---|
| `gpt-5.6-sol` (`gpt-5.6` alias) | Flagship agentic | 1.05M | 128K | 5.00 | 0.50 | 30.00 | 10.00 / 45.00 |
| `gpt-5.6-terra` | Balanced | 1.05M | 128K | 2.00 | 0.20 | 12.00 | 4.00 / 18.00 |
| `gpt-5.6-luna` | Fast/cheap | 1.05M | 128K | 0.20 | 0.02 | 1.20 | 0.40 / 1.80 |
| `gpt-5.5` | Prior flagship | ~1M | — | 5.00 | 0.50 | 30.00 | 10.00 / 45.00 |
| `gpt-5.5-pro` | Pro | — | — | 30.00 | — | 180.00 | 60.00 / 270.00 |
| `gpt-5.4` | Previous gen | — | — | 2.50 | 0.25 | 15.00 | 5.00 / 22.50 |
| `gpt-5.4-mini` | SDK default | — | — | 0.75 | 0.075 | 4.50 | — |
| `gpt-5.4-nano` | Tiny | — | — | 0.20 | 0.02 | 1.25 | — |

\*Long-context meter applies when prompt context exceeds the short-context threshold (pricing page: short vs long columns; ~272K mentioned in secondary reporting). Cache writes listed for GPT-5.6 family (e.g. Sol $6.25 short / $12.50 long).

**Prompt caching:** Cached input is typically **~90% off** list input (e.g. Sol $5 → $0.50). GPT-5.6 supports `prompt_cache_options` (explicit mode, `ttl` e.g. `"30m"`).

**Batch API:** **50% discount** vs synchronous rates; 24h completion window ([Batch guide](https://developers.openai.com/api/docs/guides/batch)). Example Batch rates for Sol short-context ≈ $2.50 in / $15 out per 1M (half of $5/$30).

**Regional processing:** **+10% uplift** for eligible models released on/after 2026-03-05 when using data-residency endpoints.

**Knowledge cutoff (GPT-5.6 family):** Feb 16, 2026 (models page).

---

## 13. EU data residency, ZDR, DPA, training policy

| Control | Status | Notes for us |
|---|---|---|
| Training on API inputs | **No by default** (since 2023-03-01); opt-in only | Documented in Your Data guide |
| Default abuse retention | Up to **30 days** | Applies unless MAM/ZDR |
| Zero Data Retention (ZDR) | Approval-gated | Forces `store=false` on Responses/Chat Completions; some endpoints still store app state |
| Modified Abuse Monitoring (MAM) | Approval-gated | Excludes most customer content from abuse logs |
| EU data residency | `eu.api.openai.com` — storage **and** processing Yes | Requires MAM or ZDR for non-US regions |
| DPA | Available for business/API | Needed for GDPR Art. 28 |
| Conversations / ChatKit threads | Retain until deleted; **not ZDR eligible** | Avoid for health-adjacent memory |
| Agents SDK tracing | Uploads to OpenAI; **unavailable under ZDR** | Disable or self-host processors |
| Realtime tracing residency | Not EU-compliant currently | Voice path needs extra review |

Sources:
- https://developers.openai.com/api/docs/guides/your-data
- https://openai.com/index/introducing-data-residency-in-europe/
- https://openai.com/business-data/

---

## 14. Honest production criticism

Synthesized from HN threads, independent research (Ry Walker, June 2026), and operator blogs:

1. **OpenAI gravity:** Defaults (models, Responses, traces dashboard) pull you into the platform; LiteLLM/AnyLLM are explicitly **beta**.
2. **Tracing phones home:** Easy to accidentally exfiltrate prompts/tool I/O; ZDR orgs lose the free dashboard.
3. **Still 0.x:** Rapid weekly churn without 1.0 stability guarantees — painful for slow enterprise upgrade cycles.
4. **Thin ops layer:** No built-in cost circuit breakers, durable queues, or fleet management; Temporal (or your own) is required for crash-proof long runs.
5. **Debugging abstractions:** Some engineers prefer raw Responses loops for transparency; agent state is hard to step-debug without traces.
6. **Handoff vs graph:** Fine for routing; weaker than LangGraph for complex branching, retries, and parallel fan-out with explicit state machines.
7. **Positive:** Fastest path for OpenAI-centric teams; guardrails/sessions/streaming are genuinely productive; Klarna-scale support agents cited by OpenAI as Agents SDK / Responses successes.

Sources:
- https://news.ycombinator.com/item?id=44353964
- https://rywalker.com/research/openai-agents-sdk
- https://openai.com/index/introducing-agentkit/

---

## 15. Sketch: PPD multi-agent system on Agents SDK + FastAPI

### Topology (manager pattern — preferred)

```
                    ┌─────────────────────────────┐
                    │  Orchestrator Agent         │
                    │  gpt-5.6-terra / sol        │
                    │  output_guardrails:         │
                    │    non_diagnostic + locale  │
                    │  tools = specialists.as_tool│
                    └───────────┬─────────────────┘
          ┌─────────────┬───────┼───────────┬────────────┐
          ▼             ▼       ▼           ▼            ▼
     Wearables     Training   Tennis    Biomarker     Genetics/CGM
     (ClickHouse)  (Supabase) (SV/PPG)  (labs)        (strict tools)
          │             │       │           │            │
          └─────────────┴───────┴───────────┴────────────┘
                              │
                     SQLAlchemySession / Redis
                     (Hetzner / Supabase)
```

### Agent definitions (sketch)

```python
from dataclasses import dataclass
from pydantic import BaseModel
from agents import Agent, Runner, RunConfig, GuardrailFunctionOutput, RunContextWrapper
from agents.decorators import tool, output_guardrail
from agents.extensions.memory import SQLAlchemySession

@dataclass
class AthleteContext:
    athlete_id: str
    locale: str  # en | es | ca | zh
    role: str    # player | coach | parent

class CoachReply(BaseModel):
    response: str
    citations: list[str]
    requires_coach_review: bool

@tool
async def query_wearables(ctx: RunContextWrapper[AthleteContext], days: int = 7) -> str:
    """Fetch HRV/sleep/load aggregates from ClickHouse for the athlete."""
    # → ClickHouse (self-hosted / our VPC)
    ...

@tool
async def query_training(ctx: RunContextWrapper[AthleteContext], days: int = 14) -> str:
    """Fetch training sessions from Supabase Postgres."""
    ...

@tool
async def query_tennis_matches(ctx: RunContextWrapper[AthleteContext], limit: int = 5) -> str:
    """Fetch recent match/shot stats."""
    ...

wearables_agent = Agent[AthleteContext](
    name="Wearables specialist",
    instructions="Interpret wearable load/recovery. Lifestyle language only. Locale={locale}.",
    tools=[query_wearables],
    model="gpt-5.6-terra",
)

training_agent = Agent[AthleteContext](
    name="Training specialist",
    tools=[query_training],
    model="gpt-5.6-terra",
)

tennis_agent = Agent[AthleteContext](
    name="Tennis specialist",
    tools=[query_tennis_matches],
    model="gpt-5.6-terra",
)

biomarker_agent = Agent[AthleteContext](
    name="Biomarker specialist",
    instructions="Panel commentary for performance context. Never diagnose disease.",
    model="gpt-5.6-sol",
)

@output_guardrail
async def non_diagnostic(ctx: RunContextWrapper, agent: Agent, output: CoachReply):
    # regex denylist + optional cheap LLM classifier (gpt-5.6-luna)
    banned = ["diagnose", "you have", "diabetes", "prescrib", "disease"]
    hit = any(b in output.response.lower() for b in banned)
    return GuardrailFunctionOutput(output_info={"hit": hit}, tripwire_triggered=hit)

orchestrator = Agent[AthleteContext](
    name="PPD orchestrator",
    instructions=(
        "Sports performance orchestrator. Multilingual: answer in the athlete locale. "
        "Call specialists as tools. Never diagnose or prescribe. "
        "Cite metrics, suggest lifestyle/training actions only."
    ),
    tools=[
        wearables_agent.as_tool("wearables_expert", "Wearable recovery/load analysis"),
        training_agent.as_tool("training_expert", "Training plan and load analysis"),
        tennis_agent.as_tool("tennis_expert", "Match and shot analytics"),
        biomarker_agent.as_tool("biomarker_expert", "Lab panel performance context"),
    ],
    output_type=CoachReply,
    output_guardrails=[non_diagnostic],
    model="gpt-5.6-sol",
)
```

### Streaming FastAPI endpoint (sketch)

```python
import json
from fastapi import FastAPI
from fastapi.responses import StreamingResponse
from agents import Runner, RunConfig
from agents import set_tracing_disabled

set_tracing_disabled(True)  # EU: no OpenAI trace upload

app = FastAPI()

@app.post("/v1/agent/chat")
async def chat(body: dict):
    ctx = AthleteContext(
        athlete_id=body["athlete_id"],
        locale=body.get("locale", "en"),
        role=body.get("role", "player"),
    )
    session = SQLAlchemySession.from_url(
        body.get("session_id", ctx.athlete_id),
        url=os.environ["SESSION_DATABASE_URL"],
    )

    async def event_gen():
        result = Runner.run_streamed(
            orchestrator,
            body["message"],
            context=ctx,
            session=session,
            run_config=RunConfig(
                tracing_disabled=True,
                model="gpt-5.6-sol",
            ),
        )
        # Option A (safer for guardrails): buffer text deltas, flush after completion
        # Option B: stream tool events live, buffer final message until output guardrail
        buffered = []
        try:
            async for event in result.stream_events():
                if event.type == "run_item_stream_event" and event.name == "tool_called":
                    yield f"data: {json.dumps({'type':'tool_called'})}\n\n"
                elif event.type == "raw_response_event":
                    # collect; or stream if risk-accepted
                    ...
            yield f"data: {json.dumps({'type':'final','output':result.final_output.model_dump()})}\n\n"
        except Exception as e:
            # OutputGuardrailTripwireTriggered → safe fallback copy
            yield f"data: {json.dumps({'type':'blocked','reason':'non_diagnostic'})}\n\n"

    return StreamingResponse(event_gen(), media_type="text/event-stream")
```

### Deployment notes (Hetzner + Docker + Traefik)

- Run SDK **in-process** in our FastAPI container — no OpenAI-hosted agent runtime required.
- Point OpenAI client at `https://eu.api.openai.com/v1` with EU project + ZDR/MAM.
- `OPENAI_AGENTS_DISABLE_TRACING=1` or custom OTEL → Grafana/Tempo on our servers.
- Sessions in Redis/Postgres on our infra.
- Nightly batch / long tool chains → Temporal worker sidecar with `OpenAIAgentsPlugin`.

---

## 16. Scorecard (for our criteria)

| Criterion | Score (0–10) | Rationale |
|---|---|---|
| **Multi-provider freedom** | **5** | Possible via Chat Completions / LiteLLM / AnyLLM, but beta adapters; Responses-only features and hosted tools are OpenAI-locked |
| **Self-hosting, no vendor telemetry** | **4** | Library self-hosts on Hetzner, but default tracing exports to OpenAI (incl. sensitive payloads); ZDR disables that dashboard entirely; model traffic still leaves infra unless we use non-OpenAI models |
| **Streaming quality** | **8** | Excellent `run_streamed` with token deltas + tool/handoff semantic events; FastAPI SSE-friendly |
| **Durability** | **7** | Not native, but first-party Temporal integration is real and documented |
| **Guardrail support** | **8** | First-class input/output/tool guardrails + tripwires map cleanly to non-diagnostic post-validation; watch streaming/buffering and handoff boundary rules |
| **Maturity** | **6** | Widely adopted, actively maintained (0.19.2), still pre-1.0 with API churn; AgentKit visual layer sunsetting |

**Weighted overall (equal weights): ~6.3 / 10**

### Decision hint

- Choose Agents SDK if we are OK being **OpenAI-primary**, will **disable/redirect tracing**, and want the fastest path to specialists + guardrails + streaming.
- Prefer LangGraph / PydanticAI if **provider neutrality** and **no accidental vendor telemetry** outweigh OpenAI integration speed.
- Do **not** invest in Agent Builder; ChatKit only if we want an embeddable chat shell.

---

## Source index

| URL | Used for |
|---|---|
| https://openai.github.io/openai-agents-python/ | SDK overview, install, hello world |
| https://openai.github.io/openai-agents-python/agents/ | Agent config, context, output_type, manager vs handoffs |
| https://openai.github.io/openai-agents-python/handoffs/ | Handoff model, filters, limitations |
| https://openai.github.io/openai-agents-python/multi_agent/ | Orchestration patterns |
| https://openai.github.io/openai-agents-python/guardrails/ | Input/output/tool guardrails, tripwires |
| https://openai.github.io/openai-agents-python/sessions/ | Session backends and persistence |
| https://openai.github.io/openai-agents-python/tracing/ | Default export, disable, ZDR note, processors |
| https://openai.github.io/openai-agents-python/streaming/ | Stream events, tool events |
| https://openai.github.io/openai-agents-python/models/ | Defaults, LiteLLM/AnyLLM beta, structured output caveats |
| https://openai.github.io/openai-agents-python/results/ | RunResult surfaces |
| https://developers.openai.com/api/docs/guides/agents | SDK vs Responses |
| https://developers.openai.com/api/docs/models | Model IDs, context windows |
| https://developers.openai.com/api/docs/pricing | Pricing, cache, regional uplift |
| https://developers.openai.com/api/docs/guides/batch | 50% batch discount |
| https://developers.openai.com/api/docs/guides/your-data | ZDR, MAM, EU residency, training policy |
| https://openai.com/index/introducing-agentkit/ | AgentKit + sunset note |
| https://openai.com/index/introducing-data-residency-in-europe/ | EU residency announcement |
| https://openai.com/business-data/ | Business privacy / no-training default |
| https://pypi.org/project/openai-agents/ | Version 0.19.2 |
| https://docs.temporal.io/ai-cookbook/openai-agents-sdk-python | Temporal integration |
| https://temporal.io/blog/announcing-openai-agents-sdk-integration | Durable agents announcement |
| https://rywalker.com/research/openai-agents-sdk | Independent criticism (June 2026) |
| https://news.ycombinator.com/item?id=44353964 | Production anecdotes |
