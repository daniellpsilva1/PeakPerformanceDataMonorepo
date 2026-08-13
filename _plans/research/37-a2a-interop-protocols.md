# 37 — Agent-to-Agent Interoperability Protocols (A2A & Landscape)

**Research date:** 2026-08-02  
**Scope:** External research only. Decision input for a single-vendor sports-performance multi-agent system (one Python service, several specialist agents, called by a first-party Next.js app).  
**Primary question:** Adopt formal agent-interoperability protocols now, later, or never?

---

## Executive recommendation (short)

| Protocol | Verdict | One-liner |
| --- | --- | --- |
| **A2A** | **Skip now / defer** | Useful only when agents cross org or process boundaries. Zero value inside one Python process. |
| **MCP** | **Defer (tools later)** | Complementary tool layer; not an A2A substitute. Adopt if/when you standardize tool servers, not for internal specialists. |
| **AG-UI** | **Defer / evaluate** | Real problem space for you (agent↔frontend). Worth a spike vs staying on Vercel AI SDK data streams — not urgent if SDK works. |
| **AGNTCY** | **Skip** | Discovery/identity/observability fabric for multi-vendor agent networks. Not your problem. |
| **IBM ACP** | **Skip (dead)** | Merged into A2A (Aug 2025); do not adopt. |
| **ANP** | **Skip** | Decentralized DID-based agent web; research-grade, wrong scale. |
| **A2UI / AP2 / UCP** | **Skip** | A2A-family extensions for generative UI widgets / payments / commerce — irrelevant until partner surfaces exist. |

**Bottom line for Peak Performance Data:** Do not adopt A2A for the current single-service architecture. Keep internal specialist orchestration as in-process Python calls (or a thin private RPC). Revisit A2A only if you expose an agent to partners, academies, or third-party coaching tools across a trust boundary. For the frontend streaming problem you actually have, compare AG-UI to the Vercel AI SDK data stream — that is a separate, more relevant decision than A2A.

---

## 1. A2A: current status

### 1.1 Spec version (as of 2026-08-02)

- **Latest released version: `1.0.0`** (stable / production-ready), published **March 2026**.
- Protocol negotiation uses **Major.Minor** (e.g. `"1.0"`). Patch versions do not affect wire compatibility.
- Clients send `A2A-Version` header; Agent Cards advertise `protocolVersion` per interface.
- Normative source of truth: Protocol Buffer / `spec/a2a.proto` (JSON Schema is convenience, non-normative).
- License: **Apache 2.0**.

Sources:
- https://a2a-protocol.org/latest/specification/
- https://opensource.googleblog.com/2026/04/a-year-of-open-collaboration-celebrating-the-anniversary-of-a2a.html
- https://github.com/a2aproject/A2A

### 1.2 Governance — Linux Foundation status (confirmed)

| Fact | Status |
| --- | --- |
| Origin | Google announced A2A **2025-04-09** (Cloud Next), ~50 launch partners |
| Donation | Google donated A2A to the **Linux Foundation** at Open Source Summit NA, **2025-06-23** |
| Project home | Linux Foundation **A2A Protocol Project** — https://a2a-protocol.org / https://github.com/a2aproject/A2A |
| TSC | Technical Steering Committee includes **AWS, Cisco, Google, IBM Research, Microsoft, Salesforce, SAP, ServiceNow** |
| IBM ACP merger | IBM’s **Agent Communication Protocol (ACP)** officially **merged into A2A** under LF (**2025-08-29**); ACP repo archived; BeeAI migrated to A2A |
| Ecosystem claims | LF/PR Newswire one-year mark (**2026-04-09**): **150+ supporting orgs**, cloud integrations (Azure AI Foundry / Copilot Studio, Amazon Bedrock AgentCore), multi-language SDKs |

**AAIF clarification:** The **Agentic AI Foundation (AAIF)** (announced **2025-12-09**) is a Linux Foundation directed fund whose *founding* projects were **MCP, goose, and AGENTS.md** — not A2A. A2A is a **separate LF project** with its own TSC. Secondary blogs sometimes blur “LF agent stack” into one umbrella; treat A2A and AAIF/MCP as **sibling LF efforts**, not the same project.

Sources:
- https://www.linuxfoundation.org/press/linux-foundation-launches-the-agent2agent-protocol-project-to-enable-secure-intelligent-communication-between-ai-agents
- https://a2a-protocol.org/latest/
- https://lfaidata.foundation/communityblog/2025/08/29/acp-joins-forces-with-a2a-under-the-linux-foundations-lf-ai-data/
- https://www.linuxfoundation.org/press/a2a-protocol-surpasses-150-organizations-lands-in-major-cloud-platforms-and-sees-enterprise-production-use-in-first-year
- https://www.linuxfoundation.org/press/linux-foundation-announces-the-formation-of-the-agentic-ai-foundation

---

## 2. A2A core concepts

Official framing: A2A is a **machine-to-machine** protocol so **opaque** agents (different vendors/frameworks/servers) can discover each other, negotiate how to interact, and collaborate on tasks **without sharing internal memory, tools, or proprietary logic**.

It is explicitly **not**:
- An agent framework / ADK
- A sub-agent or tool-call protocol (use framework natives or MCP)
- A replacement for MCP
- A human chat app protocol

Source: https://a2a-protocol.org/latest/

### 2.1 Actors

| Actor | Role |
| --- | --- |
| **User** | Human or automated initiator of a goal |
| **A2A Client (Client Agent)** | App/service/agent acting for the user; initiates A2A calls |
| **A2A Server (Remote Agent)** | HTTP (or gRPC) endpoint implementing A2A; treated as a black box |

Roles are fluid: any agent can be client for one call and server for another.

### 2.2 Agent Card

JSON “business card” for discovery and connection setup. Commonly published at a well-known URL (historically `/.well-known/agent-card.json` / related well-known paths — follow current spec).

Typical contents:
- Identity: `name`, `description`, agent `version`
- **`supportedInterfaces[]`**: ordered list of `{ url, protocolBinding, protocolVersion }` — first entry preferred
- **Capabilities**: `streaming`, `pushNotifications`, extended card, extensions
- **Skills**: id, name, description, tags, examples
- **Security**: OpenAPI-style `securitySchemes` / security requirements (API key, OAuth2, OIDC, HTTP auth, mTLS)
- Default input/output MIME modes
- Optional **cryptographic signatures** (`AgentCardSignature` / JWS) — emphasized in v1.0 for production trust

Clients fetch the card, decide fitness for a task, obtain credentials **out-of-band**, then call the advertised interface.

### 2.3 Task lifecycle

A **Task** is the stateful unit of work (`taskId` + optional `contextId` grouping related tasks).

**TaskState values (v1.0):**

| State | Kind |
| --- | --- |
| `TASK_STATE_SUBMITTED` | Acknowledged |
| `TASK_STATE_WORKING` | In progress |
| `TASK_STATE_INPUT_REQUIRED` | Interrupted — needs more user/client input |
| `TASK_STATE_AUTH_REQUIRED` | Interrupted — needs secondary credentials |
| `TASK_STATE_COMPLETED` | Terminal success |
| `TASK_STATE_FAILED` | Terminal error |
| `TASK_STATE_CANCELED` | Terminal cancel |
| `TASK_STATE_REJECTED` | Terminal — agent declines |

An agent may also return a plain **Message** immediately (no Task) for trivial replies.

Core operations (abstract; bound per transport):
`SendMessage`, `SendStreamingMessage`, `GetTask`, `ListTasks`, `CancelTask`, `SubscribeToTask`, push-notification config CRUD, Agent Card / extended card retrieval.

### 2.4 Messages, Parts, Artifacts

| Element | Meaning |
| --- | --- |
| **Message** | One conversational turn (`ROLE_USER` / `ROLE_AGENT`) with `parts[]` |
| **Part** | Exactly one of: `text`, inline `raw` bytes, `url`, or structured `data` (+ mediaType/filename/metadata) |
| **Artifact** | Concrete deliverable of a task (`artifactId`, name, parts); can stream via append/`lastChunk` semantics |

### 2.5 Streaming

- Declared via Agent Card `capabilities.streaming`
- **SSE** over HTTP (`Content-Type: text/event-stream`)
- Client uses `SendStreamingMessage` (submit + stream) or `SubscribeToTask` (attach to existing task)
- Stream pushes task/status/artifact events until a **terminal** state; stream then closes (v1.0 stream-closure replaces older `final: true` flags)

### 2.6 Push notifications

For long-running / disconnected clients:
- Client registers a webhook via push-notification config APIs
- Server POSTs `StreamResponse`-shaped payloads to the webhook
- Webhook auth via configured scheme (tokens, HMAC, mTLS, etc.)
- **SSRF risk** if webhook URLs are not allow-listed (see §6)

### 2.7 Transport bindings (Layer 3)

A2A is **transport-agnostic at the abstract ops layer**, with three official bindings in v1.0:

| Binding | `protocolBinding` | Typical use |
| --- | --- | --- |
| **JSON-RPC 2.0 over HTTPS** | `JSONRPC` | Default / broadest web compatibility; SSE for streaming |
| **gRPC** | `GRPC` | High-performance typed contracts (`hostname:port`) |
| **HTTP+JSON / REST** | `HTTP+JSON` | REST-native shops, gateway-friendly |

Production: **HTTPS / TLS required** (TLS 1.3+ recommended). Auth credentials live in **HTTP headers / gRPC metadata**, not in the JSON-RPC body.

Sources:
- https://a2a-protocol.org/latest/topics/key-concepts/
- https://a2a-protocol.org/latest/specification/
- https://tyk.io/learning-center/a2a-protocol-architecture-and-technical-specification/

---

## 3. Adoption reality in 2026

### 3.1 What is solid

| Signal | Assessment |
| --- | --- |
| Spec maturity | **v1.0** (Mar 2026) is the first “production-ready” line — signed cards, multi-tenancy / enterprise gaps from 0.x addressed |
| Governance | Real LF project + multi-vendor TSC (not a Google-only side project) |
| Competitor consolidation | IBM ACP → A2A; AGNTCY archived its own ACP in favor of A2A |
| Cloud productization | **Microsoft** (Azure AI Foundry, Copilot Studio), **AWS** (Bedrock AgentCore Runtime), Google ecosystem/ADK samples — native or first-class A2A support announced |
| SDK surface | Official multi-language SDKs (Python, JS, Java, Go, .NET, etc.); GitHub project large (~22k–25k stars range through mid-2026) |
| Framework demos | LangGraph, CrewAI, ADK, AG2, BeeAI adapters — interoperability demos are real |

### 3.2 What is mostly press-release / “supporter” theater

| Signal | How to read it |
| --- | --- |
| “150+ organizations support A2A” | Mostly **logo / intent / platform checkbox** support. Many are cloud/SaaS vendors advertising compatibility, not evidence that your vertical runs peer agents on A2A day-to-day. |
| Vertical case studies (supply chain, insurance, IT ops) | Exist in LF/Google messaging; **independent third-party write-ups of deep multi-org A2A meshes remain sparse** relative to MCP’s tool-server explosion. |
| Boutique production stories | e.g. payment-rail demos (AP2/A2A) — real but niche; prove the protocol *can* ship, not that it is ubiquitous. |
| Consultant/agency blogs | Often inflate “in production at 150 orgs” into “every enterprise agent must speak A2A by Q3.” Treat as marketing. |

### 3.3 Honest production picture (Aug 2026)

1. **A2A won the agent-to-agent protocol war** among big vendors (especially after ACP merge).
2. **MCP still dwarfs A2A in developer day-to-day adoption** (tool servers, IDE/chat connectors, download/ecosystem metrics).
3. **Real A2A production** clusters where it belongs: **cross-product / cross-cloud agent delegation** inside Microsoft, AWS, Salesforce/SAP/ServiceNow-style enterprise platforms — not inside a single app’s specialist roster.
4. For a sports academy SaaS with **first-party agents only**, A2A is **infrastructure you are not yet on the wrong side of** — there is no competitive pressure to speak A2A *internally*.

Independent synthesis aligning with this:
- https://rywalker.com/research/agent-coordination-protocols
- https://www.stravoris.com/insights/agent-protocol-wars-enterprise-architecture
- https://www.linuxfoundation.org/press/a2a-protocol-surpasses-150-organizations-lands-in-major-cloud-platforms-and-sees-enterprise-production-use-in-first-year

---

## 4. A2A vs MCP — does “complementary” hold up?

### 4.1 Official boundary

From A2A docs:

| Layer | Protocol | Interaction |
| --- | --- | --- |
| Agent ↔ **tools / data / APIs** | **MCP** | Structured, often tool-like invoke; agent *uses* capabilities |
| Agent ↔ **other agents** | **A2A** | Discovery, negotiation, multi-turn tasks, opaque collaboration |

Classic vignette: Shop Manager talks to customer/supplier agents via **A2A**; Mechanic talks to scanner/manual/lift via **MCP**.

Sources:
- https://a2a-protocol.org/latest/topics/a2a-and-mcp/
- https://a2a-protocol.org/latest/

### 4.2 Where the framing is accurate

- Different trust and UX models: tools are capabilities you *invoke*; remote agents are peers you *delegate to* with conversation, interruption (`input-required` / `auth-required`), and artifacts.
- You can stack them: orchestrator uses A2A sideways; each agent uses MCP downward.
- An A2A skill *can* be thinly wrapped as an MCP tool, but that throws away stateful multi-turn collaboration — A2A’s stated strength.

### 4.3 Where the framing frays (important for our design)

For **single-vendor, single-process** systems:

1. **“Agents” are often just functions/tools with prompts.** If your “tennis specialist” is a routed tool pack inside one service, it is closer to an **MCP tool / internal subroutine** than an opaque A2A peer.
2. **Framework sub-agents are not A2A.** Official A2A docs say A2A is *not* the sub-agent protocol — use framework natives.
3. **MCP is absorbing “more agentic” tool patterns** (long-running tools, richer auth). Some teams will keep using MCP + HTTP for “remote specialists” and never need A2A until a true peer/org boundary appears.
4. **Complementary ≠ mandatory stack.** You do not need A2A because you use MCP, or vice versa.

**Verdict on the slogan:** “MCP for tools, A2A for agents” is **correct at cross-system boundaries**. It is **misleading as a mandate for internal multi-agent apps**. Inside one product, prefer **in-process orchestration**; use MCP when standardizing tool/data access; use A2A when the other party is a **separately owned/deployed agent**.

---

## 5. Competitive / adjacent landscape (2025–2026)

### 5.1 Layered stack (industry consensus model)

```
USERS     │  AG-UI          (agent ↔ frontend)
EDITORS   │  Zed ACP        (agent ↔ IDE)          — out of scope for us
AGENTS    │  A2A            (agent ↔ agent)        — winner at this layer
TOOLS     │  MCP            (agent ↔ tools/data)   — dominant
NETWORK   │  AGNTCY         (discovery, identity, observability, SLIM)
```

### 5.2 Protocol briefs

#### AGNTCY (Cisco → Linux Foundation)

- **What:** “Internet of Agents” **infrastructure** (not a competing wire protocol for task invoke): Open Agentic Schema Framework (OASF), decentralized **Agent Directory**, verifiable **Agent Identity**, **SLIM** messaging, observability SDKs.
- **LF welcome:** 2025-07-29; formative members Cisco, Dell, Google Cloud, Oracle, Red Hat; 65+ supporters claimed.
- **Trajectory:** Archived its own **Agent Connect Protocol (ACP)** (~2026-04) to defer to A2A; now positions as plumbing *under* A2A/MCP.
- **Traction:** Serious enterprise/LF backing; still heavy for teams without multi-org agent networks.
- **For us:** Skip.

Sources:
- https://www.linuxfoundation.org/press/linux-foundation-welcomes-the-agntcy-project-to-standardize-open-multi-agent-system-infrastructure-and-break-down-ai-agent-silos
- https://rywalker.com/research/agntcy

#### IBM ACP (Agent Communication Protocol) — historical

- Launched Mar 2025 with BeeAI; donated to LF; **merged into A2A Aug 2025**.
- Repo archived; migrate to A2A.
- **Note:** Name collision with AGNTCY’s archived ACP and Zed’s **Agent Client Protocol** — three different “ACP”s.

Source: https://lfaidata.foundation/communityblog/2025/08/29/acp-joins-forces-with-a2a-under-the-linux-foundations-lf-ai-data/

#### ANP (Agent Network Protocol)

- **What:** Open stack for an “Agentic Web”: `did:wba` identity, Agent Description/Discovery, E2EE messaging profiles, payment (AP2) apps; W3C Community Group aspirations.
- **Status:** Spec line ~**1.1** for identity/discovery/messaging pieces; meta-protocol still draft; AgentConnect multi-lang SDK (~0.8.x mid-2026).
- **Traction:** ~1k GitHub stars class; **research / decentralized long-tail**, not enterprise default.
- **For us:** Skip.

Sources:
- https://github.com/agent-network-protocol/AgentNetworkProtocol
- https://agentnetworkprotocol.com/en/specs/03-did-wba-method-specification/
- https://rywalker.com/research/agent-coordination-protocols

#### AG-UI (Agent–User Interaction Protocol)

- **What:** Open **event-based** protocol for **agent ↔ user-facing app** (SSE / WebSocket / webhooks): text streaming, tool-call lifecycle, state deltas, interrupts/HITL, generative UI hooks, etc.
- **Origin:** CopilotKit (+ LangGraph/CrewAI partnership lineage); MIT; docs at https://docs.ag-ui.com
- **Positioning:** Completes the triangle with MCP (tools) and A2A (agents). Distinct from Google’s **A2UI** (declarative UI *payload* format); they compose (AG-UI pipe + A2UI widgets).
- **Traction:** Strong framework integrations (LangGraph, CrewAI, Microsoft Agent Framework, Google ADK, AWS Strands/AgentCore, Mastra, Pydantic AI, etc.); CopilotKit first-party client; growing alternative clients (TanStack AI natively emits AG-UI events).
- **For us:** See §8 — **relevant**, unlike A2A.

#### A2UI / AP2 / UCP (“A2Family” extensions)

- Google/community extensions on A2A’s extensibility model: **A2UI** (agent→UI widgets), **AP2** (agent payments), **UCP** (commerce).
- Interesting if you ever do partner commerce or generative UI across orgs; **not** current product needs.

Source: https://opensource.googleblog.com/2026/04/a-year-of-open-collaboration-celebrating-the-anniversary-of-a2a.html

#### Zed Agent Client Protocol

- JSON-RPC “LSP for coding agents” ↔ editors. Irrelevant to sports-performance product UI.

---

## 6. A2A security model

### 6.1 What the protocol specifies

Design philosophy: **reuse enterprise web security**, don’t invent a new crypto stack.

| Concern | A2A approach |
| --- | --- |
| Transport | HTTPS / TLS mandatory in production; verify server certs |
| Authentication | Declared on Agent Card (OpenAPI-style schemes); credentials obtained **out-of-band**; sent in **HTTP headers**, never as identity inside JSON-RPC payloads |
| Authorization | **Server-implemented**; recommend skill-scoped OAuth scopes, least privilege, backend checks on every sensitive action |
| In-task auth | Task → `AUTH_REQUIRED`; client gathers secondary creds outside A2A, then continues |
| Agent identity | Historically weak (self-asserted cards); **v1.0 pushes Signed Agent Cards**; Sigstore/keyless signing emerging; identity/trust framework docs still evolving (e.g. PR discussions on verification levels, revocation) |
| Opacity | Agents do not share tools/memory — reduces some lateral exposure, increases need to treat remote agents as untrusted peers |

Source: https://a2a-protocol.org/latest/topics/enterprise-ready/

### 6.2 Known attack surface

| Risk | Mechanism |
| --- | --- |
| **Agent Card spoofing / shadowing** | Tampered well-known card redirects endpoint or weakens advertised auth |
| **Card / context poisoning** | Malicious metadata influencing LLM routing/trust decisions |
| **Impersonation** | Missing card signatures + bearer-token-only auth |
| **Webhook SSRF** | Push notification URLs pointing at internal resources |
| **Delegation / confused deputy** | Orchestrator with broad scopes coerced (prompt injection) into calling privileged skills on peer agents |
| **Insufficient backend authz** | Gateway validates token; agent fails to re-check skill/data permissions |
| **Replay** | Long-lived tokens without `jti`/DPoP/mTLS binding |
| **Cross-agent prompt injection** | Untrusted artifact/message parts entering another agent’s context |

Hardening guidance from security write-ups: signed cards + domain binding, short-lived sender-constrained tokens (DPoP / mTLS-bound), per-skill scopes, webhook allow-lists, treat all card fields as untrusted input, OpenTelemetry audit of delegation chains.

Sources:
- https://tyk.io/learning-center/a2a-security-the-developers-complete-guide/
- https://securew2.com/blog/a2a-protocol-security
- https://live.paloaltonetworks.com/t5/community-blogs/safeguarding-ai-agents-an-in-depth-look-at-a2a-protocol-risks/ba-p/1235996
- https://github.com/sigstore/sigstore-a2a

### 6.3 Implication for single-service apps

If all agents share one process and one auth boundary (your Next.js session → your Python service), **A2A’s security machinery is pure overhead** — you already have app authz. A2A security complexity appears when **foreign agents** enter the trust graph.

---

## 7. Practical cost of adopting A2A

### 7.1 What you must build / operate

Even with official Python SDK:

1. **Agent Cards** for each exposed agent (+ hosting well-known endpoints, versioning, signatures)
2. **A2A server surface** (JSON-RPC and/or gRPC and/or REST) wrapping each specialist
3. **Task store** (state machine, history, artifacts, pagination)
4. **SSE streaming + optional webhooks** (infra for long-lived connections, retries, SSRF controls)
5. **AuthN/Z integration** aligned to card-declared schemes (OAuth/OIDC/mTLS)
6. **Client-side discovery & version negotiation** (`A2A-Version`, interface selection)
7. **Observability** (trace context across agent hops)
8. **Compliance testing** against v1.0 + regression when peers upgrade
9. **Ops:** exposure beyond localhost means API gateway, rate limits, tenancy

### 7.2 What you get

- Standard peer discovery and opaque delegation across frameworks/vendors
- Portable task lifecycle (interrupt for input/auth, artifacts, streaming)
- Ecosystem on-ramps (Azure/AWS/Salesforce-style platforms, partner agents)
- Future-proofing for marketplace / partner agent scenarios

### 7.3 Cost inside a single process / single service

| Pattern | A2A value |
| --- | --- |
| Specialists as Python functions / classes in one process | **None** — serialization, HTTP, cards, tasks are waste |
| Specialists as multiple containers **you** own, private network | **Low** — private gRPC/HTTP + shared auth is simpler; A2A only if you want protocol practice |
| Specialist exposed to **external** callers / partner agents | **High** — this is the design point |

**Rule:** A2A pays for **boundary crossing** (org, vendor, or untrusted deployment). It does not pay for **modularity** inside your codebase — modules and a router already do that.

---

## 8. AG-UI deep dive (relevant to our Next.js ↔ agent streaming)

### 8.1 Problem AG-UI solves

Agent UIs are not CRUD: long-running streams, tool traces, shared app state, HITL interrupts, multimodal parts, generative UI. Ad-hoc SSE schemas proliferated (Vercel AI SDK data stream, LangServe, OpenAI Assistants, custom). **AG-UI** standardizes an **event taxonomy** over HTTP SSE / WebSocket so frontends and agent backends interoperate without rewriting the client when the runtime changes.

Canonical event families include: run lifecycle, `TEXT_MESSAGE_*`, `TOOL_CALL_*`, `STATE_DELTA` / patches, thinking/trace (non-raw-CoT), interrupts, custom events.

Docs: https://docs.ag-ui.com/introduction  
Repo: https://github.com/ag-ui-protocol/ag-ui

### 8.2 vs Vercel AI SDK data stream (your current path)

| Dimension | Vercel AI SDK UI Message / data stream | AG-UI |
| --- | --- | --- |
| Nature | Framework protocol optimized for `useChat` / AI SDK | Open, runtime-agnostic event protocol |
| Coupling | Tight to AI SDK + Next/React patterns | Any backend ↔ any AG-UI client |
| State sync | Possible via data parts; less first-class | Native state deltas / shared store model |
| Bidirectional | Primarily SSE request/response streams | SSE + optional WebSocket |
| Generative UI | Strong in AI SDK / RSC ecosystem | Tool-based + declarative (compose with A2UI) |
| Interop tax | Native if you stay in AI SDK | Need adapter (`@ag-ui/vercel-ai-sdk`) if bridging |
| Ecosystem bet | Best DX **inside** Vercel/Next stack you already use | Best bet if agent **runtime** will diversify (Python service, LangGraph, Bedrock AgentCore, etc.) |

Sources:
- https://ai-sdk.dev/docs/ai-sdk-ui/stream-protocol
- https://docs.ag-ui.com/introduction
- https://tanstack.com/ai/latest/docs/comparison/vercel-ai-sdk
- https://qubittool.com/blog/a2ui-vs-ag-ui-vercel-agent-ui-comparison

### 8.3 Recommendation for Peak Performance Data

You already use **Vercel AI SDK data streams** between Next.js and the server. That is a **solved, first-party** path.

- **Do not rip out AI SDK for AG-UI** unless you hit a concrete wall: e.g. Python agent runtime emitting a different event schema, need for CopilotKit-class generative UI / shared state, or multiple heterogeneous frontends.
- **Do** keep AG-UI on the radar: if the multi-agent Python service becomes the system of record for streaming (bypassing AI SDK’s server helpers), AG-UI (or a thin AG-UI emit layer) is a better long-term wire format than inventing a fourth proprietary stream.
- **Practical path:** Stay on AI SDK now; if/when Python owns the stream, either (a) emit AI SDK UI message stream from Python (header `x-vercel-ai-ui-message-stream: v1`) or (b) adopt AG-UI end-to-end and adapt the Next client. Choose based on whether you want **Vercel ecosystem DX** or **runtime portability**.

**AG-UI verdict: Defer — evaluate when Python owns streaming or you need richer agentic UI.** Unlike A2A, this addresses a problem you already have.

---

## 9. Direct answer: Is A2A useful for us now?

### 9.1 Current architecture (given)

- Single company, single product
- Several specialist agents in **one Python service**
- Called by **one first-party Next.js app**
- No third-party agent peers in the trust graph

### 9.2 Verdict: **No. Skip A2A now.**

Implementing A2A between co-located specialists would:

- Add HTTP/JSON-RPC/task/card overhead with **no interoperability gain**
- Duplicate auth you already enforce at the app/BFF boundary
- Force a distributed-systems security model you do not need
- Slow iteration on domain tools (tennis, wearables, training) that matter more

Keep specialists as **internal modules** with a router/orchestrator. Use ordinary function calls, shared memory/context objects, and your existing streaming path to the Next.js client.

### 9.3 Future conditions that would make A2A useful

Adopt (or expose) A2A **when at least one** of these becomes a committed product goal:

1. **Partner / academy interoperability** — e.g. a third-party coaching SaaS agent must call your “tennis analyst” agent (or vice versa) without a bespoke private API.
2. **Agent marketplace / platform** — academies plug in external agents (nutrition, biomechanics vendors) that must discover skills via Agent Cards.
3. **Cross-cloud enterprise packaging** — you sell into Azure/AWS agent fabrics that **require** A2A-compatible endpoints in RFPs.
4. **Multi-tenant opaque agents across trust domains** — different legal entities’ agents collaborate with signed identity, not your session cookie.
5. **You split specialists into separately scaled services owned by different teams/vendors** *and* you want a standard peer protocol rather than an internal RPC schema.

**Trigger design (cheap optionality):** Keep specialists behind a clean internal interface (`invoke_specialist(name, context) -> stream`). When a partner trigger hits, wrap **that same interface** with an A2A server + Agent Card — do not rewrite the domain logic. Optional: publish a **private** Agent Card only on a partner gateway, not the public internet.

### 9.4 MCP in the same breath

- **Not a substitute for A2A** for partner agents.
- **Possibly useful later** if you expose reusable tool servers (ClickHouse queries, SwingVision ops) to multiple agent hosts.
- **Not required** for internal Python tools registered in-process.

---

## 10. Decision matrix (Peak Performance Data)

| Protocol | Adopt now? | When to revisit | Notes |
| --- | --- | --- | --- |
| **A2A v1.0** | **Skip** | Partner agent API, marketplace, or cloud RFP requires it | Won the a2a war; wrong layer for in-process specialists |
| **MCP** | **Defer** | Standardizing external tool servers / IDE connectors | Complementary; higher ecosystem gravity than A2A |
| **AG-UI** | **Defer / spike** | Python owns stream or generative UI / HITL needs grow | Real overlap with Vercel AI SDK problem |
| **Vercel AI SDK streams** | **Keep** | Until AG-UI spike proves superior for your runtime | Current production path |
| **AGNTCY** | **Skip** | Multi-org agent directory / identity fabric | Overkill |
| **IBM ACP** | **Skip** | Never | Merged into A2A |
| **ANP** | **Skip** | Never (unless decentralized identity becomes a product) | Research-grade |
| **A2UI / AP2** | **Skip** | Generative UI widgets or agent payments | Extensions, not core |

---

## 11. Source index

### Primary / official

- A2A home: https://a2a-protocol.org/latest/
- A2A specification v1.0.0: https://a2a-protocol.org/latest/specification/
- A2A key concepts: https://a2a-protocol.org/latest/topics/key-concepts/
- A2A and MCP: https://a2a-protocol.org/latest/topics/a2a-and-mcp/
- A2A enterprise security: https://a2a-protocol.org/latest/topics/enterprise-ready/
- A2A GitHub: https://github.com/a2aproject/A2A
- LF A2A launch (2025-06-23): https://www.linuxfoundation.org/press/linux-foundation-launches-the-agent2agent-protocol-project-to-enable-secure-intelligent-communication-between-ai-agents
- LF A2A one-year (2026-04-09): https://www.linuxfoundation.org/press/a2a-protocol-surpasses-150-organizations-lands-in-major-cloud-platforms-and-sees-enterprise-production-use-in-first-year
- Google OSS anniversary (2026-04): https://opensource.googleblog.com/2026/04/a-year-of-open-collaboration-celebrating-the-anniversary-of-a2a.html
- ACP → A2A merger: https://lfaidata.foundation/communityblog/2025/08/29/acp-joins-forces-with-a2a-under-the-linux-foundations-lf-ai-data/
- AAIF formation: https://www.linuxfoundation.org/press/linux-foundation-announces-the-formation-of-the-agentic-ai-foundation
- AGNTCY LF welcome: https://www.linuxfoundation.org/press/linux-foundation-welcomes-the-agntcy-project-to-standardize-open-multi-agent-system-infrastructure-and-break-down-ai-agent-silos
- AG-UI docs: https://docs.ag-ui.com/introduction
- AG-UI GitHub: https://github.com/ag-ui-protocol/ag-ui
- Vercel AI SDK stream protocol: https://ai-sdk.dev/docs/ai-sdk-ui/stream-protocol
- ANP specs: https://github.com/agent-network-protocol/AgentNetworkProtocol

### Secondary analyses (used with caution)

- https://rywalker.com/research/agent-coordination-protocols
- https://rywalker.com/research/agntcy
- https://www.stravoris.com/insights/agent-protocol-wars-enterprise-architecture
- https://tyk.io/learning-center/a2a-protocol-architecture-and-technical-specification/
- https://tyk.io/learning-center/a2a-security-the-developers-complete-guide/
- https://securew2.com/blog/a2a-protocol-security
- https://live.paloaltonetworks.com/t5/community-blogs/safeguarding-ai-agents-an-in-depth-look-at-a2a-protocol-risks/ba-p/1235996
- https://qubittool.com/blog/a2ui-vs-ag-ui-vercel-agent-ui-comparison
- https://tanstack.com/ai/latest/docs/comparison/vercel-ai-sdk
- https://github.com/sigstore/sigstore-a2a

---

## 12. One-paragraph architecture guidance

Build the multi-agent system as a **modular monolith**: orchestrator + specialists + tool registry in Python; Next.js authenticates users and streams via **Vercel AI SDK** (or later AG-UI if the Python runtime owns the wire). Treat A2A as an **optional façade** you add when a **foreign agent** must talk to you — not as the internal bus. That preserves velocity now and preserves optionality for partner interoperability later without paying the distributed-agent tax today.
