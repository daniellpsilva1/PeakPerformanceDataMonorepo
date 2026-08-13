# 61 — Streaming Agent Output: Python → React/Next.js & Rich Agent UI

**Research date:** 2026-08-02  
**Scope:** External research only (web). Context: moving PPD AI brain from Next.js Edge (`ai@4.3.19`, `toDataStreamResponse()`, Data Stream Protocol v1) into a Python FastAPI service while keeping the existing React client viable during migration.

---

## Executive recommendation (TL;DR)

| Decision | Recommendation |
|---|---|
| **Wire protocol from FastAPI** | Emit **Vercel AI SDK UI Message Stream** over SSE (`Content-Type: text/event-stream`, header `x-vercel-ai-ui-message-stream: v1`). Do **not** invent a custom schema for the chat path. |
| **Client upgrade timing** | **Upgrade client to AI SDK v5+ (target v6 or v7) before or in lockstep with the FastAPI cutover.** Do not invest in emitting legacy v4 `0:`/`9:`/`a:` frames from Python except as a ≤2-week bridge. |
| **Python emitter** | Prefer **`pydantic-ai` `VercelAIAdapter`** (`sdk_version=6` or `7`) if the agent runs on Pydantic AI; otherwise **`ai-sdk-stream-python`** (v6 UIMessageStream) or a thin hand-rolled SSE encoder that matches the official stream-protocol docs. |
| **AG-UI** | **Do not adopt as the primary chat wire format now.** Keep as a future option for multi-surface / CopilotKit-style generative UI. Pydantic AI and assistant-ui already bridge AG-UI if needed later. |
| **Long runs (≥3 min)** | Dual mode: short/interactive stays on UI Message Stream + Redis resumable streams; deep investigations become **background jobs** with progress SSE + notification, not a 3-minute held chat POST. |

---

## 1. Vercel AI SDK: current majors (2025–2026)

### Package versions (as of 2026-08-02)

| Package | Current | Notes |
|---|---|---|
| [`ai`](https://www.npmjs.com/package/ai) | **7.0.48** (latest on npm; updated 2026-08-01) | Major **7.0.0** released **2026-06-25** |
| AI SDK UI React hooks | `@ai-sdk/react` (paired with `ai` major) | `useChat` lives here post-split |
| Your current | `ai@4.3.19` | Legacy **Data Stream Protocol v1** (`text/plain`, `X-Vercel-AI-Data-Stream: v1`) |

Sources: [npm `ai`](https://www.npmjs.com/package/ai), [AI SDK 7 blog](https://vercel.com/blog/ai-sdk-7), [changelog](https://vercel.com/changelog/ai-sdk-7), [v7 migration guide](https://ai-sdk.dev/docs/migration-guides/migration-guide-7-0).

### Major timeline

| Version | Approx. release | Streaming / UI impact |
|---|---|---|
| **v4** | 2024–early 2025 | Custom **Data Stream Protocol**: `TYPE_ID:JSON\n` on `text/plain`; `toDataStreamResponse()`; header `X-Vercel-AI-Data-Stream: v1` |
| **v5** | **2025-07-31** | Replaces custom framing with **SSE UI Message Stream**; `UIMessage` vs `ModelMessage`; `message.parts[]`; `createUIMessageStream` / `toUIMessageStreamResponse`; removes `StreamData`, `StreamingTextResponse` |
| **v6** | **2025-12-22** | Same UI Message Stream wire; tool **approval states**; `convertToModelMessages` becomes **async**; Agent APIs mature |
| **v7** | **2026-06-25** | Node **22+**, ESM-only; production agent depth; **UI Message Stream wire same as v6** per Pydantic AI docs (`sdk_version=7` ≡ wire of 6) |

Sources: [AI SDK 5 announcement](https://vercel.com/blog/ai-sdk-5), [v5 migration](https://ai-sdk.dev/docs/migration-guides/migration-guide-5-0), [v6 migration](https://ai-sdk.dev/docs/migration-guides/migration-guide-6-0), [Hivebook v4→v5→v6 summary](https://www.hivebook.wiki/wiki/vercel-ai-sdk-6-typescript-llm-framework-generatetext-streamtext-toolloopagent-preparestep-mcp-tools-output-object-structured-outputs-usechat-parts-array-over-sse-and-what-changed-from-v4-to-v5-to-v6), [Pydantic AI vercel_ai API](https://pydantic.dev/docs/ai/api/ui/vercel_ai/).

### What changed from v4 (relevant to us)

1. **Protocol:** `0:"Hello"\n` / `9:{tool…}\n` / `a:{result…}\n` → SSE `data: {"type":"text-delta",…}\n\n` with start/delta/end IDs.
2. **Header:** `X-Vercel-AI-Data-Stream: v1` → `x-vercel-ai-ui-message-stream: v1`.
3. **Content-Type:** effectively `text/plain` data stream → `text/event-stream`.
4. **Messages:** `content: string` → `parts: UIMessagePart[]` (text, reasoning, tool-*, source-*, data-*, file, …).
5. **Server helpers:** `toDataStreamResponse()` → `toUIMessageStreamResponse()` / `createUIMessageStreamResponse({ stream: toUIMessageStream(...) })`.
6. **Custom data:** `StreamData` / annotations → `data-*` parts via `writer.write({ type: 'data-…', data })`.
7. **Client:** `append` → `sendMessage`; modular `DefaultChatTransport`; optional `resume` for reconnect.

Codemods: `npx @ai-sdk/codemod@latest migrate` (v5); `npx @ai-sdk/codemod v6`; `npx @ai-sdk/codemod v7`.  
v7 also: `npx skills add vercel/ai --skill migrate-ai-sdk-v6-to-v7`.

**v7 constraint for Next.js 15 shops:** Node.js **22+** required. Prefer Node 24 LTS in CI/prod if staying current ([v7 migration](https://ai-sdk.dev/docs/migration-guides/migration-guide-7-0)).

---

## 2. Current wire format: UI Message Stream Protocol (v5+)

Official spec: [AI SDK UI — Stream Protocols](https://ai-sdk.dev/docs/ai-sdk-ui/stream-protocol) (docs label this the **Data Stream Protocol** in the v5+ sense; it is **SSE-based**, not the v4 `TYPE_ID:` framing).

### Required HTTP response headers

```http
Content-Type: text/event-stream
Cache-Control: no-cache, no-transform
x-vercel-ai-ui-message-stream: v1
X-Accel-Buffering: no
```

(`UI_MESSAGE_STREAM_HEADERS` from `ai` encapsulates the SDK’s expected set for resume endpoints — see [resume streams docs](https://ai-sdk.dev/docs/ai-sdk-ui/chatbot-resume-streams).)

### Framing rules

- Each event: `data: <json>\n\n` (SSE).
- Stream terminates with: `data: [DONE]\n\n`.
- Content blocks use **start → delta* → end** with stable `id`s.
- Multi-step tool loops: wrap LLM turns with `start-step` / `finish-step`.

### Supported part types (v7 docs)

| `type` | Role |
|---|---|
| `start` | Message begin (`messageId`) |
| `text-start` / `text-delta` / `text-end` | Streamed assistant text |
| `reasoning-start` / `reasoning-delta` / `reasoning-end` | Thinking/reasoning display |
| `reasoning-file` | Files produced during reasoning |
| `source-url` / `source-document` | Citations |
| `file` | File refs |
| `custom` | Provider-specific (`kind`) |
| `data-*` | Custom structured UI data (e.g. `data-weather`) |
| `error` | Stream error text |
| `tool-input-start` / `tool-input-delta` / `tool-input-available` | Tool args streaming |
| `tool-approval-request` / `tool-approval-response` | HITL approval (v6+) |
| `tool-output-available` / `tool-output-denied` | Tool results / denial |
| `start-step` / `finish-step` | Agent step boundaries |
| `finish` | Message complete |
| `abort` | Stream aborted |

### Worked example (exact frame format)

A one-step tool call then answer:

```text
data: {"type":"start","messageId":"msg_01HZX"}

data: {"type":"start-step"}

data: {"type":"tool-input-start","toolCallId":"call_abc","toolName":"getAthleteReadiness"}

data: {"type":"tool-input-delta","toolCallId":"call_abc","inputTextDelta":"{\"athleteId\":"}

data: {"type":"tool-input-delta","toolCallId":"call_abc","inputTextDelta":"\"ath_42\"}"}

data: {"type":"tool-input-available","toolCallId":"call_abc","toolName":"getAthleteReadiness","input":{"athleteId":"ath_42"}}

data: {"type":"tool-output-available","toolCallId":"call_abc","output":{"score":82,"status":"ready","confidence":0.87}}

data: {"type":"text-start","id":"txt_01"}

data: {"type":"text-delta","id":"txt_01","delta":"Readiness is "}

data: {"type":"text-delta","id":"txt_01","delta":"**82** — green to train."}

data: {"type":"text-end","id":"txt_01"}

data: {"type":"source-url","sourceId":"src_hrv","url":"https://app.example/metrics/hrv","title":"HRV trend"}

data: {"type":"data-confidence","id":"conf_1","data":{"value":0.87,"label":"model confidence"}}

data: {"type":"finish-step"}

data: {"type":"finish"}

data: [DONE]
```

Approval mid-stream (v6+):

```text
data: {"type":"tool-approval-request","toolCallId":"call_xyz","approvalId":"approval_123"}
```

Client responds via `useChat` / `addToolApprovalResponse`; server later emits:

```text
data: {"type":"tool-approval-response","approvalId":"approval_123","approved":true}
data: {"type":"tool-output-available","toolCallId":"call_xyz","output":{...}}
```

Or denial:

```text
data: {"type":"tool-output-denied","toolCallId":"call_xyz"}
```

---

## 3. Legacy v4 Data Stream Protocol (what you emit today)

Spec: [AI SDK v4 Stream Protocols](https://ai-sdk.dev/v4/docs/ai-sdk-ui/stream-protocol).

- Format: `TYPE_ID:CONTENT_JSON\n` (not SSE JSON envelopes).
- Header: `X-Vercel-AI-Data-Stream: v1`.
- Common codes:

| Code | Meaning | Example |
|---|---|---|
| `0` | Text delta | `0:"Hello"\n` |
| `b` | Tool call streaming start | `b:{"toolCallId":"…","toolName":"…"}\n` |
| `c` | Tool call delta | `c:{"toolCallId":"…","argsTextDelta":"…"}\n` |
| `9` | Tool call (complete args) | `9:{"toolCallId":"…","toolName":"…","args":{…}}\n` |
| `a` | Tool result | `a:{"toolCallId":"…","result":{…}}\n` |
| `e` / `d` | Finish / error variants (see v4 docs) | |

**Important:** A v5+ `useChat` client **cannot** parse v4 frames (and vice versa). Mixing majors causes “Failed to parse stream” errors ([troubleshooting](https://ai-sdk.dev/v4/docs/troubleshooting/use-chat-failed-to-parse-stream), [v6 silent-break notes](https://skilldham.com/blog/ai-sdk-v6-migration-usechat-streamtext)).

---

## 4. Python implementations of the Vercel stream protocol

There is **no official Vercel-maintained Python SDK**. Community / adjacent options (ranked for our use case):

### A. `pydantic-ai` — `VercelAIAdapter` (strongest if on Pydantic AI)

- Docs: [Vercel AI integration](https://pydantic.dev/docs/ai/integrations/ui/vercel-ai/), [API](https://pydantic.dev/docs/ai/api/ui/vercel_ai/)
- PyPI: [`pydantic-ai` ≈ 1.86.1](https://pypi.org/project/pydantic-ai/1.86.1/) (2026)
- FastAPI one-liner:

```python
from fastapi import FastAPI
from starlette.requests import Request
from starlette.responses import Response
from pydantic_ai import Agent
from pydantic_ai.ui.vercel_ai import VercelAIAdapter

agent = Agent("openai:gpt-4.1")
app = FastAPI()

@app.post("/chat")
async def chat(request: Request) -> Response:
    return await VercelAIAdapter.dispatch_request(
        request, agent=agent, sdk_version=6  # or 7; wire ≡ 6
    )
```

- `sdk_version`: `5` (default, back-compat) | `6` (tool approval) | `7` (same wire as 6).
- Also emits citations via `SourceUrlChunk` / `DataChunk` in tool `metadata`.
- Companion: `AGUIAdapter` / `AGUIApp` for AG-UI ([docs](https://github.com/pydantic/pydantic-ai/blob/main/docs/ui/ag-ui.md)).

### B. `ai-sdk-stream-python` — typed UIMessageStream for v6

- PyPI: [`ai-sdk-stream-python` 0.4.0](https://pypi.org/project/ai-sdk-stream-python/) (2026-06)
- GitHub: [shloimy-wiesel/ai-sdk-stream-python](https://github.com/shloimy-wiesel/ai-sdk-stream-python)
- Pydantic models for ~16 v6 events; auto lifecycle (`start`, `start-step`, `text-start`, …); FastAPI-friendly context object.

### C. `ai-datastream` / `py-ai-datastream` — older Data Stream Protocol

- [elementary-data/py-ai-datastream](https://github.com/elementary-data/py-ai-datastream), [PyPI 0.1.1](https://pypi.org/project/ai-datastream/) (2025-06)
- Targets the **classic** Data Stream Protocol (v4-era docs link). **Not preferred** for a greenfield FastAPI brain in 2026 unless you must stay on `ai@4`.

### D. Vercel Labs preview template

- [ai-sdk-preview-python-streaming](https://github.com/vercel-labs/ai-sdk-preview-python-streaming) — FastAPI + Next.js demo of streaming to `useChat`. Useful as a reference, not a library.

### E. Hand-rolled encoder (always viable)

Minimal FastAPI sketch matching the official protocol:

```python
import json
from fastapi import FastAPI, Request
from fastapi.responses import StreamingResponse

app = FastAPI()

def sse(obj: dict | str) -> str:
    payload = obj if isinstance(obj, str) else json.dumps(obj, separators=(",", ":"))
    return f"data: {payload}\n\n"

@app.post("/api/ai-agent")
async def ai_agent(request: Request):
    body = await request.json()

    async def gen():
        yield sse({"type": "start", "messageId": "msg_1"})
        yield sse({"type": "start-step"})
        yield sse({"type": "text-start", "id": "t1"})
        for token in ["Hello", " from", " FastAPI"]:
            if await request.is_disconnected():
                return
            yield sse({"type": "text-delta", "id": "t1", "delta": token})
        yield sse({"type": "text-end", "id": "t1"})
        yield sse({"type": "finish-step"})
        yield sse({"type": "finish"})
        yield sse("[DONE]")

    return StreamingResponse(
        gen(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache, no-transform",
            "Connection": "keep-alive",
            "x-vercel-ai-ui-message-stream": "v1",
            "X-Accel-Buffering": "no",
        },
    )
```

---

## 5. AG-UI protocol — decision analysis

### What it is

**AG-UI (Agent–User Interaction Protocol)** — open, event-based standard for agent ↔ UI, maintained in the CopilotKit orbit. Spec: [docs.ag-ui.com](https://docs.ag-ui.com/concepts/events), repo: [ag-ui-protocol/ag-ui](https://github.com/ag-ui-protocol/ag-ui).

### Transport

- **Primary:** HTTP POST `RunAgentInput` → **SSE** stream of typed events.
- Also: WebSockets, webhooks (transport-agnostic design).
- Python: `ag_ui.core` + `ag_ui.encoder.EventEncoder`; FastAPI `StreamingResponse` patterns documented ([DeepWiki FastAPI patterns](https://deepwiki.com/ag-ui-protocol/ag-ui/5.3-fastapi-integration-patterns)).

### Event types (canonical + extensions)

From [events docs](https://docs.ag-ui.com/concepts/events) and [`events.py`](https://github.com/ag-ui-protocol/ag-ui/blob/main/sdks/python/ag_ui/core/events.py):

**Lifecycle:** `RUN_STARTED`, `RUN_FINISHED`, `RUN_ERROR`, `STEP_STARTED`, `STEP_FINISHED`  
**Text:** `TEXT_MESSAGE_START` → `TEXT_MESSAGE_CONTENT`* → `TEXT_MESSAGE_END` (+ chunk variants)  
**Thinking / reasoning:** `THINKING_*`, `REASONING_*` families  
**Tools:** `TOOL_CALL_START` → `TOOL_CALL_ARGS`* → `TOOL_CALL_END` → `TOOL_CALL_RESULT`  
**State:** `STATE_SNAPSHOT`, `STATE_DELTA` (JSON Patch), `MESSAGES_SNAPSHOT`  
**Activity:** `ACTIVITY_SNAPSHOT`, `ACTIVITY_DELTA`  
**Special:** `RAW`, `CUSTOM`  
**Interrupts:** `RUN_FINISHED` with `outcome: { type: "interrupt", interrupts: [...] }` for HITL pause/resume

### Adapters / ecosystem maturity (2026)

| Integration | Status |
|---|---|
| **CopilotKit** | First-party; AG-UI is its backbone ([docs](https://docs.copilotkit.ai/backend/ag-ui)) |
| **Pydantic AI** | Official `AGUIAdapter` / `AGUIApp` + `VercelAIAdapter` |
| **assistant-ui** | `@assistant-ui/react-ag-ui` (e.g. 0.0.46, 2026-07) |
| **LangGraph / CrewAI / Mastra** | Emit AG-UI (ecosystem claims; verify per stack) |
| **AWS Bedrock AgentCore** | Native AG-UI support reported Mar 2026 ([overview article](https://anhtu.dev/ag-ui-protocol-when-ai-agents-render-ui-for-users-2026-2246)) |
| **Vercel AI SDK** | **Not a native emitter**; bridge via adapters or dual endpoints |

### AG-UI vs hand-emitting Vercel format

| Criterion | Emit Vercel UI Message Stream | Adopt AG-UI as primary |
|---|---|---|
| Keep existing `useChat` path | ✅ Native | ❌ Need CopilotKit / assistant-ui AG-UI runtime or custom bridge |
| Python FastAPI support | ✅ Pydantic AI / ai-sdk-stream-python | ✅ First-class Python SDK |
| Tool progress + reasoning | ✅ Built into protocol | ✅ Richer lifecycle/state sync |
| State sync (JSON Patch) | ⚠️ DIY via `data-*` | ✅ Native |
| Bidirectional / interrupts | ⚠️ Approval parts + custom | ✅ Interrupt model + optional WS |
| Maturity for *your* stack | High — you already use AI SDK | Medium — new frontend dependency |
| Migration cost now | Low–medium (upgrade SDK) | High (replace chat UI runtime) |

**Verdict for PPD:** Emit **Vercel UI Message Stream** from FastAPI. Revisit AG-UI if/when you want CopilotKit-style in-app generative UI across non-chat surfaces, or multi-framework agent backends sharing one frontend contract. Pydantic AI’s dual adapters mean you can expose **both** endpoints later without rewriting the agent core.

---

## 6. Plain SSE with a custom event schema (third option)

### What you control

- Exact event names (`token`, `tool_start`, `plan_step`, …).
- Independent evolution of backend and frontend.
- Easy Redis pub/sub fan-out for background jobs.
- No coupling to Vercel’s version cadence.

### What you give up

- Free `useChat` parsing, resume helpers, AI Elements tool/reasoning components.
- Ecosystem (assistant-ui data-stream runtime, Pydantic AI Vercel adapter, Chat SDK templates).
- You must write: parser, reconnect, tool-state machine, approval round-trip, message persistence shape.
- Future hiring/onboarding cost: every engineer learns *your* protocol.

**When custom SSE wins:** non-chat surfaces (dashboard job toasts, tournament import progress) and **background deep-investigation progress channels**.  
**When it loses:** primary coach/athlete chat — stay on UI Message Stream.

---

## 7. Streaming from FastAPI

### `StreamingResponse` vs `sse-starlette`

| Concern | Raw `StreamingResponse` | [`sse-starlette`](https://github.com/sysid/sse-starlette) `EventSourceResponse` |
|---|---|---|
| SSE framing | Manual | `ServerSentEvent` model |
| Keepalive / ping | Manual | Built-in ping task |
| Disconnect | `request.is_disconnected()` + `CancelledError` | Background disconnect listener |
| Headers | You set | Sensible defaults + yours |

For UI Message Stream you often still use `StreamingResponse` because frames are **`data: {json}`** with types inside JSON (not always named SSE `event:` fields). Either works if you format correctly and flush.

### Disconnect & cancellation

```python
async def gen(request: Request):
    try:
        async for chunk in agent_stream:
            if await request.is_disconnected():
                await upstream.abort()  # stop paying for tokens
                break
            yield sse(chunk)
    except asyncio.CancelledError:
        await upstream.abort()
        raise
    finally:
        await cleanup()
```

Sources: [sse-starlette README](https://github.com/sysid/sse-starlette/), [SSE + FastAPI guide](https://www.server-sent-events.com/backend-stream-generation-connection-management/python-fastapi-sse-implementation-guide/), [backpressure article](https://www.devopsness.com/blog/streaming-llm-responses-sse-backpressure).

### Backpressure

- Prefer `async for` + `yield` (natural pressure) over buffering all tokens in a list.
- If using a producer task: **bounded** `asyncio.Queue(maxsize=N)` so a slow client stalls the LLM reader instead of OOMing the process.

### Proxying through Next.js

**Prefer a Route Handler that pipes the body**, not opaque rewrites alone for long streams:

```ts
// app/api/ai-agent/route.ts
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300; // platform-dependent

export async function POST(req: Request) {
  const upstream = await fetch(process.env.PYTHON_AI_URL + "/chat", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      // forward auth cookies / JWT as needed
      Accept: "text/event-stream",
    },
    body: await req.text(),
    signal: req.signal, // critical: cancel upstream on client abort
  });

  if (!upstream.ok || !upstream.body) {
    return new Response(await upstream.text(), { status: upstream.status });
  }

  return new Response(upstream.body, {
    status: 200,
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "x-vercel-ai-ui-message-stream": "v1",
      "X-Accel-Buffering": "no",
    },
  });
}
```

Pitfalls:
- Do **not** gzip/`compress` middleware on this route (buffers).
- Edge runtime + 30s `maxDuration` is exactly what you’re escaping — use **Node runtime** and raise limits, or bypass Next for the stream (browser → Traefik → FastAPI) with CORS + auth cookies carefully.
- `next.config` rewrites can work for simple cases but give less control over abort propagation than an explicit pipe.

Sources: [LLMTest 2026 streaming guide](https://llmtest.io/blog/streaming-llm-responses-nextjs-fastapi-node-2026), [DEV: what breaks in production](https://dev.to/ahmed_mahmoud360/streaming-ai-responses-in-nextjs-sse-fetch-streams-and-what-breaks-in-production-4f76), [Ranjan FastAPI+Next streaming](https://ranjankumar.in/building-chatgpt-style-streaming-in-react-fastapi-next-js-production-guide).

### Traefik & nginx — buffering (classic production bug)

#### nginx (exact knobs)

```nginx
location /api/ai/ {
    proxy_pass http://fastapi:8000/;
    proxy_http_version 1.1;
    proxy_set_header Connection "";
    proxy_buffering off;
    proxy_cache off;
    proxy_read_timeout 3600s;
    proxy_send_timeout 3600s;
    # Also honor app header:
    # X-Accel-Buffering: no  (set by FastAPI response)
}
```

#### Traefik

- Traefik **streams by default** for chunked / `text/event-stream` responses **unless** the **buffering middleware** is attached.
- **Do not** apply `buffering` middleware (esp. `maxRequestBodyBytes`) to AI SSE routes — it forces full response buffering and breaks SSE ([Traefik community](https://community.traefik.io/t/problem-with-streaming-sse-server-behind-traefik/23007), [issue #7930](https://github.com/traefik/traefik/issues/7930), [issue #12869](https://github.com/traefik/traefik/issues/12869)).
- Practical Traefik v2/v3 Docker labels pattern:

```yaml
labels:
  - traefik.enable=true
  - traefik.http.routers.ai.rule=Host(`api.example.com`) && PathPrefix(`/chat`)
  - traefik.http.routers.ai.entrypoints=websecure
  - traefik.http.services.ai.loadbalancer.server.port=8000
  # Explicitly NO buffering middleware on this router
  # Raise idle timeouts on the entrypoint / load balancer in front (ALB/Cloudflare)
```

- EntryPoint / upstream idle timeouts must exceed your longest interactive stream (e.g. 5–15 minutes) or the LB closes the socket while the model still runs.
- Cloudflare: enable streaming; avoid HTML/minify features on API hostnames.

Always set from FastAPI:

```python
headers={
    "Cache-Control": "no-cache, no-transform",
    "X-Accel-Buffering": "no",
    "x-vercel-ai-ui-message-stream": "v1",
}
```

---

## 8. Resumable streams (reload mid-generation)

### Vercel / AI SDK approach

Docs: [Chatbot Resume Streams](https://ai-sdk.dev/docs/ai-sdk-ui/chatbot-resume-streams) (v7).  
Package: [`resumable-stream`](https://www.npmjs.com/package/resumable-stream) + **Redis** + DB column `activeStreamId`.

Flow:
1. **POST** chat → generate UI Message Stream; in `consumeSseStream`, `createNewResumableStream(streamId, () => stream)` into Redis; persist `activeStreamId`.
2. Client `useChat({ id, resume: true })` → on mount **GET** `/api/chat/[id]/stream`.
3. GET calls `resumeExistingStream(activeStreamId)` or returns **204** if none.
4. On finish / stop: clear `activeStreamId`.
5. Explicit **stop** needs a dedicated POST that cancels producer work — client `stop()` alone only drops the HTTP reader ([Ably analysis](https://ably.com/vercel/vercel-ai-sdk-resumable-stream-what-it-covers-and-what-it-doesnt)).

**Python adaptation:** FastAPI publisher writes the same SSE frames into Redis Streams / pub-sub channel keyed by `stream_id`; Next BFF or FastAPI GET resumes by replaying buffered frames then tailing live. Or keep resume endpoint in Next while FastAPI is the producer that also publishes to Redis.

### Redis-backed alternatives

- Custom Redis Stream (`XADD`/`XREAD`) of UI Message parts with consumer offset stored per tab.
- Job pattern for ≥3 min work (section 10): resume is “reattach to job progress SSE,” not “resume chat token buffer.”

---

## 9. Rich agent UI patterns & libraries

### Patterns worth adopting (mapped to protocol)

| Pattern | How to stream | UI affordance |
|---|---|---|
| Streaming reasoning | `reasoning-*` parts | Collapsible “Thinking” panel |
| Live tool progress | `tool-input-start` → deltas → `tool-input-available` → spinner until `tool-output-available` | Tool card with running/done states |
| Generative UI | Tool output → React component; or `data-*` parts | Domain cards (readiness, match) |
| Citations | `source-url` / `source-document` | Inline superscripts + hover preview |
| Confidence | `data-confidence` or message metadata | Subtle meter, not fake precision |
| Mid-stream approval | `tool-approval-request` (v6+) | Approve/Deny modal (AI Elements `Confirmation`) |
| Multi-step plan | `start-step`/`finish-step` + `data-plan` | Stepper / checklist |

### Library assessment

#### Vercel AI Elements ([elements.ai-sdk.dev](https://elements.ai-sdk.dev), [github](https://github.com/vercel/ai-elements/))

- shadcn-style registry: Conversation, Message, Reasoning, Tool, Citation, Confirmation, ChainOfThought, …
- Latest release noted: `ai-elements@1.9.0` (2026-03).
- **Best fit for you:** already on shadcn + AI SDK; fastest path from “completed tool cards only” → live tool + reasoning UI.
- Tight coupling to AI SDK message `parts` / tool states.

#### assistant-ui ([assistant-ui.com](https://www.assistant-ui.com/))

- Radix-style chat primitives; runtimes for AI SDK data stream **and** AG-UI (`@assistant-ui/react-ag-ui`).
- Strong if you want a full chat shell replacement with pluggable backends.
- Higher migration cost than bolting AI Elements onto existing `useChat`.

#### CopilotKit ([copilotkit.ai](https://www.copilotkit.ai/))

- AG-UI-native; generative UI, shared state, Slack/Teams surfaces.
- Excellent for “agent drives the app,” heavier for “upgrade our existing chat cards.”
- Adopt when product goal expands beyond chat into in-app copilots.

**Recommendation:** Stage 1–2 = **AI Elements + upgraded `useChat`**. Reassess CopilotKit/assistant-ui only if generative UI / multi-surface becomes a roadmap pillar.

---

## 10. Long-running work (minutes): jobs + notification

Holding a single chat POST open for **3+ minutes** fights:
- Edge/platform `maxDuration`
- Traefik/ALB idle timeouts
- Mobile backgrounding
- Token waste on abandoned tabs

### Recommended dual-mode architecture

```
Interactive (≤60–90s):  useChat → UI Message Stream → FastAPI agent loop
Deep investigation:     POST /jobs → 202 {jobId} → worker → Redis progress
                        UI: progress panel via SSE/EventSource
                        On complete: push/toast + hydrate chat message from persisted result
```

Patterns in the wild:
- Celery/Redis + SSE progress ([long-running-api-demo](https://github.com/naveengarla/long-running-api-demo), [Async-Worker](https://github.com/Jaguar000212/Async-Worker), [fastapi-pulse](https://github.com/rgreen1207/fastapi-pulse))
- Redis Streams + reconnectable SSE without cancelling worker ([longshot](https://github.com/AkshatSoni26/longshot))
- Architect-style: worker publishes lifecycle events; UI subscribes ([Rhesis](https://docs.rhesis.ai/contribute/worker/architect-background-tasks))

### UI for a 3-minute deep investigation

1. User selects “Deep investigation” (or agent tool `start_deep_investigation` returns `jobId` immediately via `tool-output-available`).
2. Chat shows a **running investigation card** (plan steps, % or step labels) subscribed to `GET /jobs/{id}/events`.
3. User can navigate away; card persists from DB job state.
4. On completion: notification + assistant message appended with summary, citations, confidence; full report in side panel.
5. Optional: short UI Message Stream only for the *final synthesis* after tools finish in the worker.

Do **not** rely solely on resumable chat streams for 3-minute tool farms — use them for **token generation reconnect**, not for **orchestration durability**.

---

## 11. Concrete recommendations for PPD

### 11.1 Exact protocol to emit from FastAPI

**Emit UI Message Stream (SSE), header `x-vercel-ai-ui-message-stream: v1`.**  
Prefer Pydantic AI `VercelAIAdapter(..., sdk_version=6|7)` or `ai-sdk-stream-python`.  
Include for sports agent UX: `tool-input-*`, `tool-output-available`, `reasoning-*` (if model supports), `source-url`, custom `data-confidence` / `data-plan`.

### 11.2 Staged migration plan

| Stage | Duration | Backend | Frontend | Goal |
|---|---|---|---|---|
| **0 — Spike** | 2–3 days | FastAPI emits UI Message Stream to a scratch Next page on `ai@6` or `@7` | Throwaway | Prove Traefik + pipe + tool cards |
| **1 — Client upgrade** | 1 week | Keep Edge route temporarily **or** dual-emit | Upgrade `ai@4.3.19` → **v5 then v6** (or jump to **v6/v7** with codemods); migrate `message.content` → `parts`; swap `toDataStreamResponse` → `toUIMessageStreamResponse` | Unblock protocol |
| **2 — BFF cutover** | 1 week | FastAPI is source of truth; Next Route Handler pipes SSE | Point `useChat` transport at BFF | Remove Edge 27s soft abort |
| **3 — UI richness** | 1–2 weeks | Emit tool-input-start early; sources; confidence data parts | AI Elements Tool/Reasoning/Citation; show **running** tool state | Fix “blank while tool runs” |
| **4 — HITL + resume** | 1 week | `tool-approval-request` for sensitive tools; Redis resumable | Approval UI; `resume: true` | Production resilience |
| **5 — Deep jobs** | 1–2 weeks | Job queue for ≥2–3 min investigations | Progress card + notifications | Escape stream timeouts |

**Do not** build a long-lived Python emitter for v4 `0:`/`9:`/`a:` unless Stage 1 slips — that doubles protocol debt.

**Node:** if targeting AI SDK 7, bump runtimes to Node 22+.

### 11.3 Traefik + Next.js config checklist

- [ ] FastAPI sets `text/event-stream`, `Cache-Control: no-cache, no-transform`, `X-Accel-Buffering: no`, `x-vercel-ai-ui-message-stream: v1`
- [ ] Traefik: **no buffering middleware** on AI routes; timeouts ≥ stream budget
- [ ] nginx (if any): `proxy_buffering off;`
- [ ] Next: Node runtime pipe with `req.signal`; no compression on route; raise `maxDuration` or bypass Next for stream
- [ ] Heartbeats / SSE comments every ≤15–30s if idle gaps between tools
- [ ] Verify in prod with DevTools: frames arrive incrementally, not as one blob at end

### 11.4 Prioritized UI upgrades (from “completed tool cards only”)

1. **P0 — Live tool state:** render on `tool-input-start` / `input-streaming` / `input-available` (spinner + tool name + args preview); keep result card on `output-available`.
2. **P0 — Step awareness:** show “Step 2/N” from `start-step`/`finish-step`.
3. **P1 — Reasoning panel:** collapsible `reasoning-*` (helps coach trust).
4. **P1 — Citations:** `source-url` → inline markers + hover preview (wearable/doc links).
5. **P1 — Confidence:** `data-confidence` on insight cards (never as fake certainty).
6. **P2 — Approvals:** destructive/export tools via `tool-approval-request`.
7. **P2 — Plan visualization:** `data-plan` checklist for multi-tool investigations.
8. **P3 — Generative UI:** map high-value tools (readiness, match highlight) to dedicated React components instead of generic JSON cards (AI Elements / custom).

### 11.5 Handling a 3-minute deep-investigation run

1. Classify intents: interactive vs deep (router or explicit UI toggle).
2. Deep path returns immediately with `jobId` (tool result or `202`).
3. Worker runs tools; publishes progress events (`step`, `tool`, `partial_finding`).
4. UI card streams progress; supports reconnect via job id.
5. On complete: persist assistant `UIMessage` (parts + sources + confidence); notify user; optional short stream for narrative summary only.
6. Keep interactive chat streams resumable via Redis for mid-reload of *normal* answers (≤90s).

---

## 12. Source index

| Topic | URL |
|---|---|
| Stream protocol (v7) | https://ai-sdk.dev/docs/ai-sdk-ui/stream-protocol |
| Stream protocol (v4 legacy) | https://ai-sdk.dev/v4/docs/ai-sdk-ui/stream-protocol |
| AI SDK 5 announcement | https://vercel.com/blog/ai-sdk-5 |
| Migrate 4→5 | https://ai-sdk.dev/docs/migration-guides/migration-guide-5-0 |
| Migrate 5→6 | https://ai-sdk.dev/docs/migration-guides/migration-guide-6-0 |
| Migrate 6→7 | https://ai-sdk.dev/docs/migration-guides/migration-guide-7-0 |
| AI SDK 7 | https://vercel.com/blog/ai-sdk-7 |
| npm `ai` | https://www.npmjs.com/package/ai |
| Resume streams | https://ai-sdk.dev/docs/ai-sdk-ui/chatbot-resume-streams |
| Generative UI | https://ai-sdk.dev/docs/ai-sdk-ui/generative-user-interfaces |
| AI Elements | https://github.com/vercel/ai-elements / https://elements.ai-sdk.dev |
| Pydantic AI ↔ Vercel | https://pydantic.dev/docs/ai/integrations/ui/vercel-ai/ |
| Pydantic AI ↔ AG-UI | https://github.com/pydantic/pydantic-ai/blob/main/docs/ui/ag-ui.md |
| ai-sdk-stream-python | https://pypi.org/project/ai-sdk-stream-python/ |
| ai-datastream | https://pypi.org/project/ai-datastream/ |
| AG-UI events | https://docs.ag-ui.com/concepts/events |
| AG-UI repo | https://github.com/ag-ui-protocol/ag-ui |
| CopilotKit AG-UI | https://docs.copilotkit.ai/backend/ag-ui |
| assistant-ui AG-UI | https://www.assistant-ui.com/docs/runtimes/ag-ui/overview |
| sse-starlette | https://github.com/sysid/sse-starlette |
| Traefik SSE buffering | https://community.traefik.io/t/problem-with-streaming-sse-server-behind-traefik/23007 |
| Traefik buffering issue | https://github.com/traefik/traefik/issues/12869 |
| Next/FastAPI streaming prod | https://llmtest.io/blog/streaming-llm-responses-nextjs-fastapi-node-2026 |
| resumable-stream caveats | https://ably.com/vercel/vercel-ai-sdk-resumable-stream-what-it-covers-and-what-it-doesnt |

---

## 13. Appendix — v4 vs v5+ side-by-side

```text
# v4 (current PPD)
Content-Type: text/plain
X-Vercel-AI-Data-Stream: v1
0:"Hello"
9:{"toolCallId":"c1","toolName":"foo","args":{}}
a:{"toolCallId":"c1","result":{}}

# v5+ (target)
Content-Type: text/event-stream
x-vercel-ai-ui-message-stream: v1
data: {"type":"text-start","id":"t1"}
data: {"type":"text-delta","id":"t1","delta":"Hello"}
data: {"type":"text-end","id":"t1"}
data: {"type":"tool-input-available","toolCallId":"c1","toolName":"foo","input":{}}
data: {"type":"tool-output-available","toolCallId":"c1","output":{}}
data: {"type":"finish"}
data: [DONE]
```

---

*End of dossier 61.*
