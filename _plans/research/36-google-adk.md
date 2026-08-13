# Research Dossier: Google Agent Development Kit (ADK) for Python

**Date:** 2026-08-02  
**Scope:** External research only (docs, PyPI, GitHub, engineer write-ups).  
**Candidate use:** `ppp_ai_agent` — FastAPI multi-agent sports-performance service (wearables, training, tennis, biomarkers; Supabase + ClickHouse; Hetzner Docker/Traefik; no GCP).

---

## 1. Executive snapshot

| Item | Finding (as of 2026-08-02) |
|------|----------------------------|
| **Current PyPI version** | **`google-adk` 2.6.1** (uploaded 2026-07-31) |
| **Also shipping** | Parallel **1.x** line still active (`1.37.0`); 2.x is the new major |
| **Docs/API ref versions seen** | Docs site / CLI refs cite **2.3.0–2.6.0**; homepage markets **ADK 2.0** features |
| **License** | Apache 2.0 |
| **Python** | ≥ 3.10 |
| **Release cadence** | Officially “roughly **bi-weekly**” |
| **GitHub** | `google/adk-python` — ~21k stars, ~3.7k forks, hundreds of open issues (high activity) |
| **GCP required?** | **No** for runtime. Framework is OSS and container-runnable. GCP is the *happy path* for managed sessions/deploy/trace, not a hard requirement. |
| **Gemini-only?** | **No.** Native Gemini + first-class **LiteLLM** (OpenAI, Anthropic, Ollama, etc.). Gemini remains the best-supported / best-documented path, especially for Live/bidi streaming. |

**Bottom line for us:** ADK is a serious, rapidly evolving, Python-native agent framework with excellent FastAPI/streaming stories and real multi-agent primitives. It runs fine on Hetzner. The risks are **API churn (1.x→2.0 breaking)**, **Gemini-first quality for advanced streaming**, and **ecosystem gravity toward Agent Engine** even though self-hosting is officially supported.

---

## 2. Version, cadence, maturity, API stability

### Versions

- **Latest stable on PyPI:** `2.6.1` (2026-07-30 release notes / 2026-07-31 upload).  
  Source: https://pypi.org/project/google-adk/ · https://github.com/google/adk-python/releases
- **2.0 line:** Announced around Google I/O 2026 (May 19, 2026 per independent reviews). Introduces graph Workflow Runtime, Task API, collaborative agent modes; **breaking changes** to agent API, event model, and session schema vs 1.x.  
  Source: https://github.com/google/adk-python · https://chatforest.com/reviews/google-adk-2-agent-development-kit-review/
- **1.x still maintained** in parallel (`1.37.0` etc.) — important if pinning for stability.
- **History:** First public packages March/April 2025 (`0.0.1` → Cloud Next era); `1.0.0` May 20, 2025; rapid minor bumps through 2025–2026.

### Cadence

Official README/PyPI: *“The release cadence is roughly bi-weekly.”*  
Practice matches: multiple 2.x releases in July 2026 alone (`2.3`…`2.6.1`).

### Maturity assessment

| Signal | Assessment |
|--------|------------|
| Production claims | Google positions ADK as production-grade; used in Google products narrative (Agentspace / Agent Platform). |
| API stability | **Still churning.** Explicit 2.0 breaking changes. Engineers reported 1.0 “production-ready” launch breaking upgrades (DLabs interviews). Pin versions aggressively. |
| Multi-language | Python (most mature), TypeScript, Go, Java, Kotlin — Python remains the reference. |
| Docs | Much improved vs early 2025; still gaps for advanced production patterns (community complaint). |
| Ecosystem age | ~16 months since public launch — younger than LangGraph/CrewAI, catching up fast. |

**Stability verdict:** Treat **2.x as “usable production with upgrade risk.”** Prefer `~=2.6.1` pins + staging upgrade gates. Do not assume SemVer calm; breaking changes have already happened at “1.0” and “2.0” marketing milestones.

Sources:

- https://pypi.org/project/google-adk/
- https://github.com/google/adk-python
- https://google.github.io/adk-docs/ (also https://adk.dev/)
- https://dlabs.ai/blog/google-adk-production-challenges-and-how-to-solve-them/
- https://www.benpoole.me/blog/google-adk-one-year-later

---

## 3. Core primitives (with doc-sourced examples)

### 3.1 `Agent` / `LlmAgent`

Core LLM-backed unit. `Agent` is the recommended alias for `LlmAgent`. Non-deterministic: the model chooses tools and next steps.

```python
from google.adk import Agent
from google.adk.tools import google_search

agent = Agent(
    name="researcher",
    model="gemini-flash-latest",
    instruction="You help users research topics thoroughly.",
    tools=[google_search],
)
```

Source: https://google.github.io/adk-docs/ · https://adk.dev/streaming/dev-guide/part1/  
(`Agent` ≡ `LlmAgent` noted in streaming guide.)

Richer form with `output_key` (writes final text into session state for downstream agents):

```python
from google.adk.agents.llm_agent import LlmAgent

code_writer_agent = LlmAgent(
    name="CodeWriterAgent",
    model="gemini-2.5-flash",
    instruction="You are a Python Code Generator. ...",
    description="Writes initial Python code based on a specification.",
    output_key="generated_code",
)
```

Source: https://adk.dev/agents/workflow-agents/sequential-agents/

### 3.2 Workflow agents: `SequentialAgent` / `ParallelAgent` / `LoopAgent`

These are **deterministic** orchestrators — they do **not** use an LLM for control flow. (ADK 2.0 docs note templated workflows are superseded by graph/dynamic workflows for new designs, but Sequential/Parallel/Loop remain documented and useful.)

**Sequential** — fixed order, shared `InvocationContext` / session state:

```python
from google.adk.agents.sequential_agent import SequentialAgent

code_pipeline_agent = SequentialAgent(
    name="CodePipelineAgent",
    sub_agents=[code_writer_agent, code_reviewer_agent, code_refactorer_agent],
    description="Executes a sequence of code writing, reviewing, and refactoring.",
)
root_agent = code_pipeline_agent
```

Source: https://adk.dev/agents/workflow-agents/sequential-agents/

**Parallel** — concurrent independent branches; share state via `output_key` then merge:

```python
from google.adk.agents.parallel_agent import ParallelAgent

researcher_agent_1 = LlmAgent(
    name="RenewableEnergyResearcher",
    model="gemini-2.5-flash",
    instruction="Research 'renewable energy sources'. Summarize (1-2 sentences).",
    tools=[google_search],
    output_key="renewable_energy_result",
)
# ... more researchers with distinct output_key ...
ParallelAgent(sub_agents=[researcher_agent_1, researcher_agent_2, researcher_agent_3])
```

Source: https://adk.dev/agents/workflow-agents/parallel-agents/

**Loop** — repeat until `max_iterations` or a sub-agent calls the built-in `exit_loop` tool (codelab / samples pattern).  
Source: https://codelabs.developers.google.com/codelabs/production-ready-ai-with-gc/3-developing-agents/build-a-multi-agent-system-with-adk

### 3.3 Tools

Python functions (or `BaseTool` subclasses) with type hints + docstrings → schema for the LLM. Prefer returning structured `dict` with `status` / `error_message` so the model can recover.

```python
from google.adk.agents import Agent
from google.adk.tools import FunctionTool

def get_weather_report(city: str) -> dict:
    """Retrieves the current weather report for a specified city.

    Returns:
        dict: weather info with 'status' ('success' or 'error') and
        'report' or 'error_message'.
    """
    if city.lower() == "london":
        return {"status": "success", "report": "Cloudy, 18C."}
    return {"status": "error", "error_message": f"Weather for '{city}' unavailable."}

weather_tool = FunctionTool(func=get_weather_report)

weather_sentiment_agent = Agent(
    model="gemini-2.0-flash",
    name="weather_sentiment_agent",
    instruction="""If the user asks about weather, use get_weather_report.
If it returns error, tell the user and ask for another city.""",
    tools=[weather_tool],
)
```

Source: https://adk.dev/tools-custom/

**`ToolContext`** — inject for state, artifacts, transfer actions (omit from docstring so the LLM doesn’t see it):

```python
from google.adk.tools import ToolContext, FunctionTool

def update_user_preference(preference: str, value: str, tool_context: ToolContext):
    """Updates a user preference in session state."""
    tool_context.state[f"user:{preference}"] = value
    return {"status": "success"}

pref_tool = FunctionTool(func=update_user_preference)
```

Source: https://adk.dev/tools-custom/

### 3.4 Sessions & state

A `Session` holds `id`, `app_name`, `user_id`, `events`, `state`, `last_update_time`. Managed via `SessionService`.

```python
from google.adk.sessions import InMemorySessionService

temp_service = InMemorySessionService()
example_session = await temp_service.create_session(
    app_name="my_app",
    user_id="example_user",
    state={"initial_key": "initial_value"},
)
```

**Backends:**

| Service | Persistence | Use |
|---------|-------------|-----|
| `InMemorySessionService` | No | Dev/test |
| `DatabaseSessionService` | Yes (Postgres/MySQL/SQLite async) | **Self-hosted prod (Hetzner)** |
| `VertexAiSessionService` | Yes (GCP Agent Platform) | GCP managed |

```python
from google.adk.sessions import DatabaseSessionService

db_url = "sqlite+aiosqlite:///./my_agent_data.db"
# prod: "postgresql+asyncpg://user:pass@host:5432/agent_db"
session_service = DatabaseSessionService(db_url=db_url)
```

Source: https://adk.dev/sessions/session/

State is the shared scratchpad across agents in a session; `output_key` and `tool_context.state[...]` are the common write paths. Instruction templates can interpolate `{state_key}`.

### 3.5 Memory

Long-term recall across sessions via `MemoryService` (`InMemoryMemoryService`, Vertex Memory Bank / RAG variants). Agents use tools like `load_memory` / `preload_memory`. Swappable backend — Vertex is optional.  
Sources: https://aipractitioner.substack.com/p/google-adk-explained-building-multi · samples GEMINI.md in adk-samples.

### 3.6 Callbacks

Hooks: before/after agent, before/after model, before/after tool. Return `None`/empty to continue; return an `LlmResponse` (etc.) to short-circuit.

```python
from google.adk.agents import LlmAgent
from google.adk.agents.callback_context import CallbackContext
from google.adk.models import LlmResponse, LlmRequest
from typing import Optional

def my_before_model_logic(
    callback_context: CallbackContext, llm_request: LlmRequest
) -> Optional[LlmResponse]:
    print(f"before model: {callback_context.agent_name}")
    return None

my_agent = LlmAgent(
    name="MyCallbackAgent",
    model="gemini-2.0-flash",
    instruction="Be helpful.",
    before_model_callback=my_before_model_logic,
)
```

Source: https://adk.dev/callbacks/

### 3.7 Artifacts

Binary/session-scoped blobs (charts, files) via `tool_context.save_artifact` / `load_artifact`.  
Source: https://adk.dev/artifacts/ · session skill notes in adk-python.

### 3.8 Runner

Stateless execution engine: `Runner(app_name=..., agent=..., session_service=...)`. Methods: `run` / `run_async` (turn-based), `run_live` (streaming). Events are Pydantic models (`event.model_dump_json(...)`).

---

## 4. Multi-agent model

### Patterns

1. **LLM transfer (`sub_agents`)** — Coordinator lists specialists; framework injects `transfer_to_agent`. Child **owns** the conversation until it transfers back (LLM-dependent — “stickiness” risk).
2. **`AgentTool`** — Wrap specialist as a tool; parent **retains** control; child returns a result string. Better for synthesis / reliability.
3. **Workflow agents** — Deterministic Sequential / Parallel / Loop.
4. **ADK 2.0 graph / collaborative / Task API** — Graph nodes, fan-out/fan-in, HITL, structured task delegation.

### Transfer example (doc pattern)

```python
from google.adk.agents import LlmAgent

booking_agent = LlmAgent(
    name="Booker",
    description="Handles flight and hotel bookings.",
)
info_agent = LlmAgent(
    name="Info",
    description="Provides general information and answers questions.",
)

coordinator = LlmAgent(
    name="Coordinator",
    model="gemini-2.0-flash",
    instruction="Delegate booking tasks to Booker and info requests to Info.",
    description="Main coordinator.",
    sub_agents=[booking_agent, info_agent],
)
# LLM emits: transfer_to_agent(agent_name='Booker')
```

Source: https://github.com/google/adk-docs/blob/main/docs/agents/multi-agents.md  
Collaboration docs: https://adk.dev/workflows/collaboration/

### AgentTool example

```python
from google.adk.tools.agent_tool import AgentTool

travel_agent = LlmAgent(
    name="travel_agent",
    model="gemini-2.0-flash",
    instruction="Use specialist tools, then present a cohesive plan.",
    tools=[
        AgentTool(agent=flight_agent),
        AgentTool(agent=hotel_agent),
    ],
)
```

Source: https://practicallyagents.com/articles/adk-sub-agents-vs-agent-tool/

### State sharing

- Same session + shared state dict for transfer / sequential pipelines.
- Parallel branches are independent during run; merge via `output_key` + a later merger agent.
- `AgentTool` isolates child history; state/artifact deltas can still propagate back per docs.

### Deterministic control

Prefer **SequentialAgent / ParallelAgent / LoopAgent** or **2.0 Workflow graphs** when routing must not depend on LLM whim. Prefer **AgentTool** when the orchestrator must always synthesize. Use **transfer** only when a specialist must hold a multi-turn dialogue with the athlete/coach.

---

## 5. Tool definition deep-dive

| Topic | Detail |
|-------|--------|
| Declaration | Plain `def` + docstring, or `FunctionTool(func=...)`. Methods/`BaseTool` also supported. |
| Schema derivation | From **Python type hints** + docstring/param descriptions. Docs: type hints are *essential*. |
| Pydantic | Framework itself is Pydantic-heavy (Events, Eval sets). Tool args are primarily **type-hint driven**, not “pass a `BaseModel` as the tool schema” the way PydanticAI does. You can still validate inside the function with Pydantic models. |
| Errors | Convention: return `{"status": "error", "error_message": "..."}` and teach the agent in instructions. Uncaught exceptions surface as failed tool events in the run/trace. |
| Auth / long-running | ToolContext auth helpers; Long Running Function Tools for async jobs. |
| Agents as tools | `AgentTool` / transfer as above. |

Schema guidance (docs):

> Provide type hints for all parameters… This is essential for ADK to generate the correct schema for the LLM.

Source: https://adk.dev/tools-custom/

---

## 6. Model support (multi-provider)

### Official stance

> ADK can work with almost any generative AI model… adapters… including locally running models.

Source: https://google.github.io/adk-docs/

### LiteLLM (first-class Python integration)

```python
from google.adk.agents import LlmAgent
from google.adk.models.lite_llm import LiteLlm

agent_openai = LlmAgent(
    model=LiteLlm(model="openai/gpt-4o"),
    name="openai_agent",
    instruction="You are a helpful assistant powered by GPT-4o.",
)

agent_claude = LlmAgent(
    model=LiteLlm(model="anthropic/claude-3-haiku-20240307"),
    name="claude_direct_agent",
    instruction="You are an assistant powered by Claude Haiku.",
)
```

- Install: `pip install litellm`
- Env: `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, etc.
- Local: Ollama / vLLM via LiteLLM wrapper.
- Anthropic “thinking blocks” supported via LiteLLM path since ADK Python **v1.28.0**.
- **Security note (docs, March 24 2026):** LiteLLM supply-chain incident on versions 1.82.7/1.82.8 — pin carefully if using `eval`/`extensions` extras.

Source: https://adk.dev/agents/models/litellm/

### Honest multi-provider grade

| Capability | Gemini | OpenAI/Anthropic via LiteLLM |
|------------|--------|------------------------------|
| Basic ReAct + tools | Excellent | Good / production-usable |
| Multi-agent + workflows | Excellent | Works (same agent graph) |
| Live / BIDI audio-video | First-class (Live API) | **Second-class / N/A** — Live stack is Gemini-centric |
| Docs & samples density | Highest | Adequate |
| “Feels native” | Yes | Adapter layer; watch tool-calling edge cases |

**Verdict:** Genuinely multi-provider for **text agent loops**. Not equally good for **bidirectional live multimodal**. For `ppp_ai_agent` (text + tools + streaming tokens to web), LiteLLM is viable; keep Gemini as an option, not a requirement.

---

## 7. Streaming

### Modes

| Mode | Transport to model | Use |
|------|-------------------|-----|
| `StreamingMode.SSE` | HTTP streaming (`generate_content_async`) | Text chat; request then stream response |
| `StreamingMode.BIDI` | WebSocket Live API | True duplex; audio/video; interruptions |

Source: https://adk.dev/streaming/dev-guide/part4/

### Surfacing to a web client

1. FastAPI WebSocket (or SSE) ↔ ADK `Runner.run_live` + `LiveRequestQueue`.
2. Downstream: `async for event in runner.run_live(...): websocket.send_text(event.model_dump_json(...))`.
3. Upstream: client messages → `live_request_queue.send_content(...)`.

Doc FastAPI sketch (abbreviated from official streaming Part 1):

```python
import asyncio
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from google.adk.runners import Runner
from google.adk.agents.run_config import RunConfig, StreamingMode
from google.adk.agents.live_request_queue import LiveRequestQueue
from google.adk.sessions import InMemorySessionService
from google.genai import types

app = FastAPI()
session_service = InMemorySessionService()
runner = Runner(app_name="bidi-demo", agent=agent, session_service=session_service)

@app.websocket("/ws/{user_id}/{session_id}")
async def websocket_endpoint(websocket: WebSocket, user_id: str, session_id: str) -> None:
    await websocket.accept()
    run_config = RunConfig(
        streaming_mode=StreamingMode.BIDI,
        response_modalities=["AUDIO"],  # or TEXT for chat UIs
        session_resumption=types.SessionResumptionConfig(),
    )
    live_request_queue = LiveRequestQueue()

    async def upstream_task() -> None:
        try:
            while True:
                data = await websocket.receive_text()
                live_request_queue.send_content(
                    types.Content(parts=[types.Part(text=data)])
                )
        except WebSocketDisconnect:
            pass

    async def downstream_task() -> None:
        async for event in runner.run_live(
            user_id=user_id,
            session_id=session_id,
            live_request_queue=live_request_queue,
            run_config=run_config,
        ):
            await websocket.send_text(
                event.model_dump_json(exclude_none=True, by_alias=True)
            )

    try:
        await asyncio.gather(upstream_task(), downstream_task(), return_exceptions=True)
    finally:
        live_request_queue.close()
```

Source: https://adk.dev/streaming/dev-guide/part1/

Also: `adk api_server` / `adk web` ship FastAPI servers with SSE/bidi options.  
Source: https://adk.dev/api-reference/cli/

For **token streaming to Next.js** without Live audio: use SSE mode + filter events for partial text parts, or map `run_async` event stream to `StreamingResponse` (`text/event-stream`). Events are already JSON-serializable Pydantic models.

---

## 8. Built-in evaluation

- CLI: `adk eval <agent_folder> <evalset.json>`
- UI: create/run cases in `adk web`
- Pytest: `AgentEvaluator.evaluate(...)`
- Artifacts: `.test.json` unit-style sessions; larger **evalset** files for multi-turn integration
- Metrics: trajectory / tool-use (groundtruth + rubric), final response quality, user simulation, custom metrics (samples expanding in 2.6.x)
- Schemas are **Pydantic-backed** (`EvalSet`, `EvalCase`)

Minimal conceptual case shape (from docs):

```json
{
  "eval_set_id": "home_automation_agent_light_on_off_set",
  "eval_cases": [
    {
      "eval_id": "eval_case_id",
      "conversation": [
        {
          "user_content": {"parts": [{"text": "Turn off device_2 in the Bedroom."}], "role": "user"},
          "final_response": {"parts": [{"text": "I have set the device_2 status to off."}], "role": "model"},
          "intermediate_data": {
            "tool_uses": [
              {"name": "set_device_info", "args": {"location": "Bedroom", "device_id": "device_2", "status": "OFF"}}
            ]
          }
        }
      ],
      "session_input": {"app_name": "home_automation_agent", "user_id": "test_user", "state": {}}
    }
  ]
}
```

Source: https://adk.dev/evaluate/

This is a **real differentiator** vs frameworks that leave eval entirely to third parties.

---

## 9. Deployment & lock-in (critical for Hetzner)

### Official deployment options

1. **Agent Runtime / Agent Platform (Vertex)** — managed, one-command `adk deploy agent_engine`
2. **Cloud Run** — container on GCP
3. **GKE** — Kubernetes on GCP
4. **Other container-friendly infra** — **explicitly documented**

> You can manually package your Agent into a container image and then run it in any environment that supports container images. For example you can run it locally in Docker or Podman. This is a good option if you prefer to run offline or disconnected, or otherwise in a system that has no connection to Google Cloud.

Source: https://adk.dev/deploy/

Homepage FAQ: *“ADK is built for deploy anywhere flexibility. You can containerize and run ADK on your own infrastructure…”*  
Source: https://google.github.io/adk-docs/

Community production pattern for custom infra:

```python
from google.adk.sessions import DatabaseSessionService
session_service = DatabaseSessionService(
    db_url="postgresql+asyncpg://user:password@your-db-host:5432/agent_db"
)
# docker build / docker run with DATABASE_URL + model API keys
```

Sources: https://rfajri.medium.com/google-adk-part-3-deploying-running-your-agent-in-production-e97ddc3aebfc · Cloud Run codelab using `get_fast_api_app` from `google.adk.cli.fast_api`.

### Lock-in matrix for Peak Performance

| Layer | Locked to GCP? | Our approach on Hetzner |
|-------|----------------|-------------------------|
| ADK Python library | No (Apache 2.0) | `pip install google-adk` in Docker image |
| Agent runtime | No | Our FastAPI process behind Traefik |
| Sessions | Optional Vertex | **`DatabaseSessionService` → Postgres** |
| Memory | Optional Vertex Memory Bank | In-memory or self-built / pgvector later |
| Artifacts | Optional GCS | Local/S3-compatible or DB blobs |
| Models | Optional Gemini/Vertex | **LiteLLM → OpenAI/Anthropic/etc.** |
| Tracing | Optional Cloud Trace | **Phoenix / Langfuse via OpenTelemetry** |
| Live BIDI audio | Effectively Gemini | Skip or accept Gemini-only for that feature |

**Lock-in verdict:** **Low–moderate soft lock-in, not hard lock-in.** Docs and CLI push Agent Engine hard; production “golden path” examples assume GCP. But nothing prevents a plain Docker + Postgres + LiteLLM deployment. Soft lock-in risk = team habitually adopting Vertex session/memory/trace APIs that you’d later need to replace.

---

## 10. Observability & tracing

- Local: **`adk web`** Trace view (strong DX).
- Production GCP: Cloud Trace via OpenTelemetry (`enable_tracing=True` / `--trace_to_cloud`).  
  Source: https://adk.dev/observability/cloud-trace/
- Self-hosted / third-party:
  - **Arize Phoenix** — official ADK integration, self-hostable. https://adk.dev/integrations/phoenix/
  - **Langfuse** — via `openinference-instrumentation-google-adk`. https://langfuse.com/integrations/frameworks/google-adk
- Spans typically cover agent invoke, LLM calls, tool execution.

Example (Phoenix):

```python
from phoenix.otel import register

tracer_provider = register(
    project_name="ppp-ai-agent",
    auto_instrument=True,
)
```

---

## 11. Community adoption & production signals

| Signal | Evidence |
|--------|----------|
| GitHub popularity | ~21k stars on `adk-python` (high for a 2025-born framework) |
| Google investment | Multi-language SDKs, I/O 2026 ADK 2.0, Agent Platform positioning |
| Production narratives | Internal Google use claims; Cloud Run / Agent Engine tutorials; agency blogs (DLabs) running client projects |
| Compared to LangGraph | Still smaller tutorial/case-study ecosystem; LangGraph often cited as more mature for complex state machines |
| Notable critique themes | See §12 |

Sources: GitHub repo · https://chatforest.com/reviews/google-adk-2-agent-development-kit-review/ · https://www.alekseialeinikov.com/en/blog/topics/cloud/google-adk-build-production-ai-agents-2026

---

## 12. Honest criticism (engineers who tried it)

1. **Breaking upgrades at “stable” milestones** — 1.0 I/O launch broke code; GitHub told people to roll back (DLabs interviews). 2.0 again breaks agent API / events / sessions.  
   https://dlabs.ai/blog/google-adk-production-challenges-and-how-to-solve-them/

2. **Docs lag real-world patterns** — RAG/Sheets integrations, merging parallel outputs, function-tool gotchas discovered via blogs/source diving.

3. **Multi-user / custom agent factories** — “ADK assumes a root agent shared across users”; custom per-user agents broke `adk web` debugging UX (DLabs).

4. **Transfer stickiness** — `sub_agents` children often fail to `transfer_to_agent` back; documented in GitHub issues (#147, #371, #620 per Practically Agents). Mitigation: AgentTool or workflow agents.  
   https://practicallyagents.com/articles/adk-sub-agents-vs-agent-tool/

5. **GCP gravity / perceived lock-in** — ChatForest review (3/5): held back by “Google Cloud deployment lock-in” and ecosystem lag vs LangGraph, despite OSS.  
   https://chatforest.com/reviews/google-adk-2-agent-development-kit-review/

6. **Early deployment friction** — Streamlit/web embedding was painful in 2025; largely improved via Agent Engine + FastAPI paths (Ben Poole retrospective).  
   https://www.benpoole.me/blog/google-adk-one-year-later

7. **Accuracy / cost of multi-agent** — Production “95%+” is hard; multi-agent burns tokens (DLabs).

8. **LiteLLM as adapter risk** — Extra dependency surface (including the March 2026 supply-chain advisory on specific LiteLLM versions).

---

## 13. How `ppp_ai_agent` would look in ADK

Design choice for Peak Performance: **orchestrator + AgentTool specialists** (reliable control return) + optional `ParallelAgent` for independent domain fetches. Sessions on Postgres. Models via LiteLLM. Stream events over FastAPI SSE/WebSocket to the Next.js client. No Vertex.

### 13.1 Tools (Supabase + ClickHouse)

```python
# tools/data_tools.py
from __future__ import annotations

import httpx
from google.adk.tools import FunctionTool, ToolContext

SUPABASE_URL = "..."
SUPABASE_KEY = "..."
CLICKHOUSE_URL = "..."

async def _supabase_get(path: str, params: dict) -> dict:
    async with httpx.AsyncClient(timeout=30) as client:
        r = await client.get(
            f"{SUPABASE_URL}/rest/v1/{path}",
            params=params,
            headers={"apikey": SUPABASE_KEY, "Authorization": f"Bearer {SUPABASE_KEY}"},
        )
        if r.status_code >= 400:
            return {"status": "error", "error_message": r.text}
        return {"status": "success", "data": r.json()}

async def get_athlete_profile(athlete_id: str, tool_context: ToolContext) -> dict:
    """Fetch athlete profile and roster metadata from Supabase."""
    tool_context.state["athlete_id"] = athlete_id
    return await _supabase_get("athletes", {"id": f"eq.{athlete_id}", "select": "*"})

async def query_wearable_metrics(
    athlete_id: str,
    metric: str,
    start_date: str,
    end_date: str,
) -> dict:
    """Query ClickHouse for wearable time-series (HRV, sleep, load, etc.)."""
    sql = """
      SELECT day, value FROM wearable_daily
      WHERE athlete_id = {athlete_id:String}
        AND metric = {metric:String}
        AND day BETWEEN {start_date:String} AND {end_date:String}
      ORDER BY day
    """
    async with httpx.AsyncClient(timeout=60) as client:
        r = await client.post(
            f"{CLICKHOUSE_URL}/",
            params={"query": sql + " FORMAT JSON"},
            # bind params via CH HTTP interface / query params as you do today
        )
        if r.status_code >= 400:
            return {"status": "error", "error_message": r.text}
        return {"status": "success", "rows": r.json().get("data", [])}

async def get_training_plan(athlete_id: str, week_start: str) -> dict:
    """Load training plan / sessions for a week from Supabase."""
    return await _supabase_get(
        "training_sessions",
        {"athlete_id": f"eq.{athlete_id}", "week_start": f"eq.{week_start}", "select": "*"},
    )

async def get_tennis_match_stats(athlete_id: str, match_id: str | None = None) -> dict:
    """Fetch tennis match / shot stats (Supabase or analytics API)."""
    params = {"athlete_id": f"eq.{athlete_id}", "select": "*"}
    if match_id:
        params["id"] = f"eq.{match_id}"
    return await _supabase_get("tennis_matches", params)

async def get_biomarker_panel(athlete_id: str, panel_date: str | None = None) -> dict:
    """Fetch latest or dated biomarker panel from Supabase."""
    params = {"athlete_id": f"eq.{athlete_id}", "select": "*", "order": "collected_at.desc", "limit": "1"}
    if panel_date:
        params = {"athlete_id": f"eq.{athlete_id}", "collected_at": f"eq.{panel_date}", "select": "*"}
    return await _supabase_get("biomarker_panels", params)

profile_tool = FunctionTool(func=get_athlete_profile)
wearable_tool = FunctionTool(func=query_wearable_metrics)
training_tool = FunctionTool(func=get_training_plan)
tennis_tool = FunctionTool(func=get_tennis_match_stats)
biomarker_tool = FunctionTool(func=get_biomarker_panel)
```

### 13.2 Specialist sub-agents + orchestrator

```python
# agents/ppp_team.py
from google.adk.agents import LlmAgent
from google.adk.models.lite_llm import LiteLlm
from google.adk.tools.agent_tool import AgentTool
from tools.data_tools import (
    profile_tool, wearable_tool, training_tool, tennis_tool, biomarker_tool,
)

MODEL = LiteLlm(model="anthropic/claude-sonnet-4-20250514")  # or openai/gpt-4.1 / gemini-...

wearable_agent = LlmAgent(
    name="wearable_specialist",
    model=MODEL,
    description="Interprets wearable recovery, sleep, HRV, and training load.",
    instruction="""You are a wearables specialist for elite athletes.
Use query_wearable_metrics and get_athlete_profile. Return concise clinical-coach language
with numbers and trends. On tool errors, explain the gap; do not invent data.""",
    tools=[profile_tool, wearable_tool],
)

training_agent = LlmAgent(
    name="training_specialist",
    model=MODEL,
    description="Analyzes training plans, sessions, and periodization.",
    instruction="Use get_training_plan / profile tools. Focus on load, intensity, and readiness alignment.",
    tools=[profile_tool, training_tool],
)

tennis_agent = LlmAgent(
    name="tennis_specialist",
    model=MODEL,
    description="Analyzes tennis match and shot analytics.",
    instruction="Use get_tennis_match_stats. Discuss serve, rally, break points, and tactical patterns.",
    tools=[profile_tool, tennis_tool],
)

biomarker_agent = LlmAgent(
    name="biomarker_specialist",
    model=MODEL,
    description="Interprets blood/biomarker panels in a performance context.",
    instruction="Use get_biomarker_panel. Flag out-of-range markers cautiously; not medical diagnosis.",
    tools=[profile_tool, biomarker_tool],
)

# AgentTool = parent always synthesizes (avoids transfer stickiness)
orchestrator = LlmAgent(
    name="ppp_orchestrator",
    model=MODEL,
    description="Peak Performance Data multi-domain coach assistant.",
    instruction="""You are the Peak Performance orchestrator for coaches/athletes/parents.
Route domain questions to the right specialist tool(s):
- recovery/sleep/HRV/load → wearable_specialist
- plans/sessions/periodization → training_specialist
- match/shot tennis analytics → tennis_specialist
- bloodwork/biomarkers → biomarker_specialist
You may call multiple specialists, then synthesize one coherent answer.
Never fabricate metrics. Cite dates and athlete context from tool results.
Keep PHI/athlete data scoped to the authenticated athlete_id in session state.""",
    tools=[
        AgentTool(agent=wearable_agent),
        AgentTool(agent=training_agent),
        AgentTool(agent=tennis_agent),
        AgentTool(agent=biomarker_agent),
        profile_tool,  # light direct tools OK on orchestrator
    ],
)

root_agent = orchestrator
```

Optional deterministic parallel gather (when intent is “full readiness brief”):

```python
from google.adk.agents import ParallelAgent, SequentialAgent, LlmAgent

gather = ParallelAgent(
    name="domain_gather",
    sub_agents=[wearable_agent, training_agent, tennis_agent, biomarker_agent],
)
synthesize = LlmAgent(
    name="brief_synthesizer",
    model=MODEL,
    instruction="Merge domain outputs from state into a single readiness brief.",
    # read {wearable...} keys if each item sets output_key
)
brief_pipeline = SequentialAgent(
    name="full_brief_pipeline",
    sub_agents=[gather, synthesize],
)
```

### 13.3 Streaming FastAPI endpoint (SSE token/event stream)

```python
# main.py
import os
from fastapi import FastAPI, Request
from fastapi.responses import StreamingResponse
from google.adk.runners import Runner
from google.adk.sessions import DatabaseSessionService
from google.genai import types
from agents.ppp_team import root_agent

APP_NAME = "ppp_ai_agent"

session_service = DatabaseSessionService(
    db_url=os.environ["DATABASE_URL"],  # postgresql+asyncpg://...
)
runner = Runner(
    app_name=APP_NAME,
    agent=root_agent,
    session_service=session_service,
)

app = FastAPI(title="PPP AI Agent (ADK)")

@app.post("/v1/chat/stream")
async def chat_stream(request: Request):
    body = await request.json()
    user_id = body["user_id"]
    session_id = body.get("session_id") or body["user_id"]
    text = body["message"]
    athlete_id = body.get("athlete_id")

    session = await session_service.get_session(
        app_name=APP_NAME, user_id=user_id, session_id=session_id
    )
    if not session:
        await session_service.create_session(
            app_name=APP_NAME,
            user_id=user_id,
            session_id=session_id,
            state={"athlete_id": athlete_id} if athlete_id else {},
        )

    content = types.Content(role="user", parts=[types.Part(text=text)])

    async def event_generator():
        async for event in runner.run_async(
            user_id=user_id,
            session_id=session_id,
            new_message=content,
        ):
            # Forward ADK events; frontend picks text deltas / tool calls
            yield f"data: {event.model_dump_json(exclude_none=True, by_alias=True)}\n\n"
        yield "data: {\"type\":\"done\"}\n\n"

    return StreamingResponse(event_generator(), media_type="text/event-stream")
```

Dockerfile sketch (Hetzner + Traefik):

```dockerfile
FROM python:3.12-slim
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY . .
ENV PORT=8080
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8080"]
```

`requirements.txt` pin example:

```
google-adk==2.6.1
litellm>=1.75.0,<1.82.7  # avoid compromised versions; re-check advisory
httpx
fastapi
uvicorn[standard]
asyncpg
sqlalchemy[asyncio]
aiosqlite  # local only
```

---

## 14. Verdict & scores (for framework bake-off)

Scoring: **1–5** (5 = excellent fit for Peak Performance constraints).

| Criterion | Score | Notes |
|-----------|------:|-------|
| **Multi-provider freedom** | **4** | LiteLLM is real and documented; Live/bidi remains Gemini-first. |
| **Self-hosting without GCP lock-in** | **4** | Officially supported; DatabaseSessionService + Docker. Soft gravity toward Vertex remains. |
| **Streaming quality** | **4.5** | Outstanding FastAPI/WebSocket/`run_live` story; SSE + event JSON for web clients. Best-in-class if you use Gemini Live; still strong for text SSE. |
| **Durability / checkpointing** | **3.5** | Solid session persistence via SQL; Memory services; CheckpointService work landing in ecosystem — not yet LangGraph-checkpoint mature. |
| **Maturity** | **3.5** | Fast-moving, bi-weekly releases, 2.0 breakage; ~21k stars; eval + DX are strong for age. |
| **Python-native fit** | **5** | Type-hint tools, Pydantic events, FastAPI first-class, matches our stack. |

**Weighted take for `ppp_ai_agent`:** ADK is a **top-tier candidate** if you value Google-grade agent DX, built-in eval, and streaming — and you are willing to pin versions and avoid Vertex APIs. Prefer **AgentTool orchestrator** over transfer-based sub_agents for specialist routing. If you need ironclad graph checkpointing and a larger third-party ecosystem today, **LangGraph** may still win durability; if you want Pydantic-model-native tools with less framework surface, **PydanticAI** may win simplicity. ADK wins when you want structured multi-agent + eval + FastAPI streaming without inventing the loop yourself.

### Recommendation for this bake-off

- **Shortlist: yes.** Especially given FastAPI + multi-agent specialists + Hetzner viability.
- **Do not** assume Agent Engine.
- **Do** prototype one specialist + orchestrator + SSE endpoint on LiteLLM (Anthropic or OpenAI) with `DatabaseSessionService` against existing Postgres before committing.
- **Pin** `google-adk==2.6.1` and treat upgrades as release-train work.

---

## 15. Source index

| Resource | URL |
|----------|-----|
| PyPI `google-adk` | https://pypi.org/project/google-adk/ |
| GitHub | https://github.com/google/adk-python |
| Docs home | https://google.github.io/adk-docs/ · https://adk.dev/ |
| LiteLLM models | https://adk.dev/agents/models/litellm/ |
| Custom tools | https://adk.dev/tools-custom/ |
| Sequential / Parallel | https://adk.dev/agents/workflow-agents/sequential-agents/ · https://adk.dev/agents/workflow-agents/parallel-agents/ |
| Multi-agent workflows | https://adk.dev/agents/multi-agents/ · https://adk.dev/workflows/collaboration/ |
| Sessions | https://adk.dev/sessions/session/ |
| Callbacks | https://adk.dev/callbacks/ |
| Artifacts | https://adk.dev/artifacts/ |
| Streaming guide | https://adk.dev/streaming/dev-guide/part1/ · part3 · part4 |
| Evaluate | https://adk.dev/evaluate/ |
| Deploy | https://adk.dev/deploy/ |
| Observability / Cloud Trace | https://adk.dev/observability/ · https://adk.dev/observability/cloud-trace/ |
| Phoenix | https://adk.dev/integrations/phoenix/ |
| Langfuse | https://langfuse.com/integrations/frameworks/google-adk |
| Google multi-agent patterns blog | https://developers.googleblog.com/en/developers-guide-to-multi-agent-patterns-in-adk/ |
| Practically Agents (transfer vs AgentTool) | https://practicallyagents.com/articles/adk-sub-agents-vs-agent-tool/ |
| DLabs production challenges | https://dlabs.ai/blog/google-adk-production-challenges-and-how-to-solve-them/ |
| Ben Poole one-year later | https://www.benpoole.me/blog/google-adk-one-year-later |
| ChatForest ADK 2.0 review | https://chatforest.com/reviews/google-adk-2-agent-development-kit-review/ |
| AI Practitioner explainers | https://aipractitioner.substack.com/p/google-adk-explained-building-multi |
| Custom Docker / DB sessions | https://rfajri.medium.com/google-adk-part-3-deploying-running-your-agent-in-production-e97ddc3aebfc |
| Cloud ADK overview | https://docs.cloud.google.com/gemini-enterprise-agent-platform/build/adk |

---

*End of dossier.*
