# 39 — Managed Agent Hosting & Durable Execution Substrates (as of Aug 2026)

**Research date:** 2026-08-02  
**Scope:** External research only (web search + official docs). Decision context: small company, Python FastAPI agent service already on Hetzner (Docker + Traefik + Redis), EU health-adjacent data (GDPR Art. 9), scaling toward multi-agent with nightly batch, event triggers, and human-in-the-loop (HITL) waits of hours–days.

---

## Executive decision (short)

**Keep the agent runtime on Hetzner.** Do not migrate the Python agent service to Vertex Agent Engine, Bedrock AgentCore, Azure Foundry Agent Service, or Cloudflare Agents as the primary host. Those platforms solve *managed agent runtime / session / memory / sandbox* problems you largely already own; they add hyperscaler lock-in, metered platform fees on top of model tokens, and Art. 9 data-processing surface area you do not need.

**Durability substrate recommendation**

| Rank | Option | Verdict |
|------|--------|---------|
| **1 (choose)** | **Self-hosted Temporal** (Docker on Hetzner, Postgres persistence, workers = existing Python services) | Best fit for Art. 9 + HITL + batch + events with your stack |
| **2 (fallback)** | **Temporal Cloud** namespace in `aws-eu-central-1` or `gcp-europe-west3`, workers still on Hetzner | Buy ops relief; keep PHI out of workflow payloads |
| Avoid as core HITL layer | Celery+Redis, Postgres job queue | Fine for fire-and-forget; wrong model for day-long approvals |
| Interesting later | Self-hosted Restate / self-hosted Inngest | Simpler binaries; less mature ops/Python ecosystem than Temporal for this use case |

Full scoring and rationale in [§ Decision](#decision-durability-substrate).

---

## 1. Google Vertex AI Agent Engine (Gemini Enterprise Agent Platform Runtime)

Formerly **Reasoning Engine**; now part of the **Gemini Enterprise Agent Platform** (Vertex AI rebrand at Cloud Next 2026).

### Problem it solves

Managed production runtime for agents: autoscaling compute, session/conversation state, long-term Memory Bank, sandboxed code execution, tracing/ops integration with GCP. You deploy ADK / LangGraph / LangChain agents and Google runs the session lifecycle.

### What it manages

| Capability | Managed? | Notes |
|------------|----------|-------|
| Sessions | Yes | Conversation history & state |
| Memory Bank | Yes | Cross-session long-term memory |
| Code execution / sandbox | Yes | Billed as Agent Compute/Memory |
| Scaling | Yes | Managed runtime autoscaling |
| Tracing / observability | Partial | Platform + Cloud Logging/Monitoring |
| Your business tools / DB access | No | You still wire connectors; data often leaves your VPC unless carefully designed |

### Pricing (published, USD)

Official Gemini Enterprise Agent Platform / Scale pricing (unified SKUs):

| Resource | Free tier / month | Then |
|----------|-------------------|------|
| **Agent Compute** | 50 vCPU-hours | **$0.085 / vCPU-hour** |
| **Agent Memory (RAM)** | 100 GiB-hours | **$0.009 / GiB-hour** |
| **Agent Storage** | 1 GiB-month | ~**$0.00041 / GiB-hour** storage SKU |

Sessions & Memory Bank (as of mid-2026 billing notes): storage billed as Agent Storage; reads/writes converted into Agent Compute (e.g. 3M reads ≈ 1 vCPU-h; 1M writes ≈ 1 vCPU-h). Google notes Memory Bank / Sessions billing on this structure commencing **2026-09-01**. Secondary sources cited earlier 2026 event-based rates (~$0.25 / 1k events) during the transition — **confirm live SKUs before budgeting**.

Model tokens (Gemini etc.) are **always separate**.

Sources:  
- https://cloud.google.com/products/gemini-enterprise-agent-platform/pricing  
- https://cloud.google.com/products/gemini-enterprise-agent-platform  
- https://g360technologies.com/agentic-ai-gets-metered-vertex-ai-agent-engine-billing-goes-live/

### Frameworks

First-class: **ADK**, **LangGraph**, **LangChain** (official “use a LangGraph/LangChain/ADK agent” docs under Agent Platform Runtime).

Sources:  
- https://cloud.google.com/vertex-ai/generative-ai/docs/agent-engine/use/langgraph  
- https://docs.cloud.google.com/python/docs/reference/vertexai/latest/vertexai.agent_engines

### EU regions / residency

Agent Runtime listed in multiple EU locations including Belgium (`europe-west1`), Netherlands (`europe-west4`), Frankfurt (`europe-west3`), Paris, Milan, Madrid, Warsaw, Finland, etc. **Caveat for Art. 9:** Google’s Agentspace/Gemini Enterprise residency docs note Agent Engine feature gaps — e.g. some Memory Bank / Code execution **at-rest DRZ (data residency)** limitations in EU multi-region. Treat residency feature-by-feature, not “GCP EU = done.”

Sources:  
- https://docs.cloud.google.com/gemini-enterprise-agent-platform/machine-learning/general/locations  
- https://cloud.google.com/agentspace/docs/locations

### Self-host / lock-in

- **No true self-host** of Agent Engine. ADK/LangGraph code is portable; Sessions, Memory Bank, Runtime APIs are GCP-proprietary.
- Lock-in: **high** for memory/session/runtime; **medium** if you only use ADK as a library and keep state elsewhere.

### Relevance to us

**Low as primary host.** You already run Python agents on Hetzner. Agent Engine shines for GCP-native enterprises that want Google to own sessions/memory/scaling. For a cost-sensitive Art. 9 shop, it is an expensive second control plane plus residency diligence burden.

---

## 2. Google Agentspace — still distinct?

### What it is / was

**Agentspace** (late 2024 / 2025) was Google’s **employee-facing** enterprise agent hub: company search, agent gallery, SSO, admin governance — not a developer runtime for embedding custom agents into your product.

At **Cloud Next 2026**, Google:

- Renamed developer platform **Vertex AI → Gemini Enterprise Agent Platform**
- Absorbed **Agentspace UX into Gemini Enterprise** (the app)

### Relevance to a custom-agent developer

**Mostly no.** Build on Agent Platform / ADK / your own FastAPI. Use Gemini Enterprise/Agentspace only if you want a packaged internal assistant for non-technical staff (seat/product SKU), not as the runtime for athlete-facing multi-agent workflows.

Sources:  
- https://thenextweb.com/news/google-cloud-next-ai-agents-agentic-era  
- https://drpranayjha.com/gemini-enterprise-agentspace-enterprise-agents/  
- https://callsphere.ai/blog/tw26w19-gemini-enterprise-agent-platform-vertex-ai-rebrand-explained  
- https://uibakery.io/blog/vertex-ai-agent-builder

---

## 3. AWS Bedrock AgentCore

GA ~Oct 2025. Modular “production agent platform,” not a thin wrapper around classic Bedrock Agents.

### Problem it solves

Secure session-isolated agent runtime, memory, tool gateway, identity, browser/code sandboxes, policy, evaluations, observability — mix-and-match consumption pricing.

### What it manages

| Component | Role |
|-----------|------|
| **Runtime** | Serverless microVM sessions; CPU billed on active consumption (I/O wait free for CPU) |
| **Memory** | Short-term events + long-term records/retrieval |
| **Gateway** | Tool/MCP invocation, search, indexing |
| **Browser / Code Interpreter** | Sandboxed tools |
| **Identity / Policy** | OAuth/API keys, Cedar-style authorization |
| **Observability** | CloudWatch-backed traces |
| **Evaluations / Optimization** | Quality loops (some preview-free) |

Framework-agnostic positioning: CrewAI, LangGraph, LlamaIndex, etc. Any foundation model (not Bedrock-only).

### Pricing (published, us-east-1 class list rates)

| Meter | Price |
|-------|-------|
| Runtime / Browser / Code Interpreter **CPU** | **$0.0895 / vCPU-hour** |
| Runtime / Browser / Code Interpreter **Memory** | **$0.00945 / GB-hour** |
| Short-term memory | **$0.25 / 1,000** new events |
| Long-term memory storage (built-in strategies) | **$0.75 / 1,000** records / month |
| Long-term memory storage (self-managed / override) | **$0.25 / 1,000** records / month |
| Long-term retrieval | **$0.50 / 1,000** retrievals |
| Gateway API invocations | **$0.005 / 1,000** |
| Gateway Search API | **$0.025 / 1,000** |
| Tool indexing | **$0.02 / 100** tools / month |
| Web Search | **$7 / 1,000** queries |
| Identity (outside Runtime/Gateway) | **$0.010 / 1,000** token/key requests |
| Policy auth | **$0.000025 / request** |
| Observability | CloudWatch rates |

AWS example: 10M support sessions/month ≈ **~$7,235** Runtime alone (before models/memory/gateway).

Sources:  
- https://aws.amazon.com/bedrock/agentcore/pricing/  
- https://aws.amazon.com/bedrock/agentcore/faqs/

### EU regions

FAQs list Europe: **Frankfurt, Ireland, London, Paris, Stockholm** (among ~15 regions). Suitable for residency *if* you pin models, memory, and logs there and complete a DPA / Art. 9 assessment.

### Self-host / lock-in

- **No self-host** of AgentCore services.
- Runtime packaging can be container-based (portable code) but Memory/Gateway/Identity APIs are AWS-specific → **high platform lock-in** if you lean on them.

### Relevance to us

Strong product if you were AWS-native and wanted to *stop* operating agent infra. For Hetzner-first + Art. 9 + cost: **overkill**. Nightly batch over hundreds of athletes + multi-day HITL is a **workflow durability** problem more than a Bedrock Runtime problem.

---

## 4. Azure AI Foundry Agent Service

### Problem it solves

Stateful agent API (threads, messages, runs, tools) integrated with Azure OpenAI / Foundry models, optional BYO Cosmos DB / Storage / AI Search for data ownership.

### What it manages

- Agent definitions, threads, runs (Assistants / Responses-style stateful API)
- Tools: file search, code interpreter, web/custom tools
- Basic setup: Microsoft-managed storage  
- **Standard setup:** BYO Cosmos DB (threads), Storage (files), AI Search (vectors) — better for sovereignty

Does **not** replace a general durable workflow engine for multi-day HITL across your own Python services (you still need orchestration for batch/approvals outside the chat thread model).

### Pricing

- **No separate per-agent platform fee** for Agent Service itself
- Pay for: model tokens, Code Interpreter (**~$0.033 / session** in secondary 2026 guides), file search storage/calls, BYO Azure resources (Cosmos RU/s is material — ~1000 RU/s per container × several containers per project)
- Data Zone / EU processing often ~**10% premium** vs global standard for models

Sources:  
- https://azure.microsoft.com/en-us/pricing/details/foundry-agent-service/  
- https://azure.microsoft.com/en-us/products/ai-foundry/agent-service  
- https://learn.microsoft.com/en-us/azure/ai-foundry/agents/faq  
- https://learn.microsoft.com/en-us/azure/ai-foundry/responsible-ai/agents/data-privacy-security  
- https://learn.microsoft.com/en-us/azure/foundry/agents/concepts/standard-agent-setup

### EU residency

Regional endpoints; Standard BYO keeps data in your tenant. For strict EU processing, use **Data Zone** deployments (commonly cited: Sweden Central, Germany West Central). Global Standard can route outside EU — unsuitable for Art. 9 without legal review.

### Self-host / lock-in

- No self-host of the Agent Service control plane
- Lock-in: **high** to Azure OpenAI thread/run APIs; BYO storage reduces data lock-in but not API lock-in

### Relevance to us

Only compelling if you standardize on Microsoft 365 / Copilot distribution. Not a fit as the durability layer under a Hetzner FastAPI multi-agent system.

---

## 5. Cloudflare Workers AI + Agents SDK + Durable Objects

### Problem it solves (take seriously)

**Per-agent durable identity** with SQLite state, hibernation (idle ≈ $0 compute), alarms/schedules, WebSockets, fibers/checkpoints, human-in-the-loop patterns, and global scale — without running always-on VMs. Agents SDK sits on Durable Objects; Workers AI or external LLMs for inference.

This is the most credible “managed” alternative to Temporal-*like* durability for **session-scoped agents**, priced for sparse activity.

### What it manages

| Piece | Role |
|-------|------|
| Durable Objects | Stateful actor per agent/session; SQLite |
| Hibernation | Zero duration charge when idle |
| Alarms / schedules | Wake for delayed work |
| Fibers / Workflows | Long-running recoverable tasks |
| Agents SDK | Harness, tools, HITL, MCP, sandboxes |
| Workers AI | Optional on-edge inference |

Docs explicitly contrast DO hibernation vs always-on VMs for “10k agents active 1% of the time.”

Sources:  
- https://developers.cloudflare.com/agents/  
- https://developers.cloudflare.com/agents/concepts/long-running-agents/  
- https://agents.cloudflare.com/  
- https://github.com/cloudflare/agents

### Pricing (Durable Objects, Workers Paid)

| Meter | Included | Overage |
|-------|----------|---------|
| Requests | 1M / month | **$0.15 / million** |
| Duration | 400,000 GB-s / month | **$12.50 / million GB-s** |
| SQLite rows read | 25B / month | **$0.001 / million** |
| SQLite rows written | 50M / month | **$1.00 / million** |
| SQL stored data | 5 GB-month | **$0.20 / GB-month** |

Workers AI neurons billed separately (~$0.011 / 1k neurons in common docs; confirm live).

Source: https://developers.cloudflare.com/durable-objects/platform/pricing/

### EU data residency

Durable Objects support **jurisdiction `"eu"`** — object compute + persistence constrained to EU. Combine with Regional Services / Data Localization Suite for request path and metadata boundaries. Suitable *technically* for GDPR residency; Art. 9 still needs DPA, subprocessors, and careful logging (EU metadata boundary can hide some DO metrics).

Sources:  
- https://developers.cloudflare.com/durable-objects/reference/data-location/  
- https://developers.cloudflare.com/data-localization/how-to/durable-objects/

### Self-host / lock-in

- **No self-host** of DO runtime
- Lock-in: **high** to Cloudflare programming model (JS/TS Workers; Python via limited paths — not your FastAPI mental model)
- Rewrite cost from Python FastAPI multi-service → Workers/Agents SDK is large

### Assessment for us

**Interesting for interactive per-user agents and cheap idle HITL waits**, weak as a drop-in for:

- Existing **Python** FastAPI + scientific tooling on Hetzner
- Nightly **batch across hundreds of athletes** with heavy ClickHouse/DB access (egress + rewrite)
- Keeping Art. 9 processing on infrastructure you already control end-to-end

Verdict: **watch / spike for edge chat agents**; **do not** make it the system of record for multi-agent batch + approvals in 2026.

---

## 6. LangGraph Platform / LangGraph Server (LangSmith Deployment)

### Problem it solves

Deploy LangGraph graphs with managed persistence, streaming, cron, auth, scale-to-zero serverless or dedicated deploys — plus LangSmith tracing/evals. OSS LangGraph alone does **not** give you production durability; Platform/Server does.

### Options

| Mode | Who runs what | Access |
|------|---------------|--------|
| **OSS LangGraph** | You (DIY persistence/queue) | Free MIT |
| **LangSmith Cloud Deployment** | LangChain | Plus+ |
| **Hybrid** | Control plane SaaS, data plane you | Enterprise |
| **Self-hosted LangSmith / Deployment** | You | Enterprise |

### Pricing (LangSmith, 2026)

| Plan | Seat | Notes |
|------|------|-------|
| Developer | $0 | 5k base traces/mo; no Deployment |
| Plus | **$39 / seat / mo** | 10k traces; **1 free Small serverless deployment** |
| Enterprise | Custom | Self-hosted / hybrid, SSO, SLA |

Usage units:

- **1 LCU = $1.50**, **1 LSU = $1.00**
- Deployment metering examples: Runtime Compute **0.045 LCU / vCPU-hr**, Runtime Memory **0.006 LCU / GiB-hr**, Database Compute **0.177 LSU / vCPU-hr**, etc.
- Data location: LangChain Cloud **US or EU**

Sources:  
- https://www.langchain.com/pricing  
- https://www.zenml.io/blog/langgraph-pricing  
- https://www.truefoundry.com/blog/langgraph-pricing

### What it gives vs rolling your own

- Graph-aware deploy, checkpointing, streaming APIs, cron, auth wrappers, Studio debugging
- Does **not** replace Temporal for arbitrary multi-service orchestration, multi-day signals across non-LangGraph workers, or org-wide job control unless everything is a LangGraph deploy

### EU / self-host / lock-in

- EU cloud region available on managed
- Production self-host of full Platform → **Enterprise sales**
- Lock-in: **medium–high** to LangGraph checkpoint/deploy APIs if Platform is the runtime; OSS graph code more portable

### Relevance to us

Use **OSS LangGraph inside your Python service** if you like the programming model; use LangSmith for **traces** (cheap). Do **not** require LangGraph Platform as the durability layer unless the whole product is LangGraph-shaped and you accept Enterprise for EU self-host.

---

## 7. Temporal Cloud as durability under self-hosted agents

### Problem it solves

Durable workflow orchestration: retries, timers, signals (HITL), schedules (nightly), child workflows, visibility UI — while **your Workers (agent code) stay on Hetzner**. Temporal never needs your model weights; it stores **event history** (keep PHI out of payloads).

### Pricing (official)

Plans: Essentials / Business / Enterprise / Mission Critical.

| Plan | Floor | Allocation (examples) |
|------|-------|------------------------|
| **Essentials** | greater of **$100/mo** or 5% of usage | 1M Actions, 1 GB Active, 40 GB Retained |
| **Business** | greater of **$500/mo** or 10% of usage | 2.5M Actions, 2.5 GB Active, 100 GB Retained |

Pay-as-you-go Actions after allocation:

| Volume | $/million Actions |
|--------|-------------------|
| First 5M | **$50** |
| Next 5M | $45 |
| … down to | $25 at 100–200M |
| Active Storage | **$0.042 / GBh** |
| Retained Storage | **$0.00105 / GBh** |

Workers compute is **yours** (Hetzner) — not in Temporal’s bill.

Sources:  
- https://docs.temporal.io/cloud/pricing  
- https://docs.temporal.io/cloud/overview  
- https://temporal.io/pricing.md

### EU regions

Namespaces on AWS: **eu-central-1 (Frankfurt), eu-west-1 (Ireland), eu-west-2 (London)**; GCP **europe-west3 (Frankfurt)**. Multi-region HA options exist.

Source: https://docs.temporal.io/cloud/regions

### Self-host option

Yes — same OSS server (Apache 2.0). Persistence: Postgres/MySQL/Cassandra. Fits Docker Compose / small K3s on Hetzner.

### Lock-in

**Low–medium.** Workflow code uses Temporal SDK (Python first-class); migration to/from Cloud is supported conceptually (workers portable). Not hyperscaler-agent lock-in.

### Relevance to us

**Primary pattern:** Hetzner agent workers + Temporal for durability. Choose Cloud vs self-host in [§ Decision](#decision-durability-substrate).

---

## 8. Modal, Inngest, Restate (alternative substrates)

### 8.1 Modal

**Solves:** Serverless Python compute (functions, sandboxes, GPUs) with scale-to-zero — great for bursty jobs, not a full workflow brain.

| Item | Detail |
|------|--------|
| Pricing | CPU **$0.0000131 / physical-core / sec**; memory **$0.00000222 / GiB / sec**; ~**$30/mo** free credits (Starter). Sandboxes ~3× CPU/mem. Region pin **eu** = **1.5×**, narrow **eu-west** = **1.75×**. Non-preemptible CPU **3×**. |
| EU | Region selection includes `eu` / `eu-west` etc. |
| Self-host | **No** |
| Lock-in | Medium (decorators/platform); code is still Python |
| Agent fit | Run activities/batch slices; **pair with** Temporal/Inngest/Restate for HITL |

Sources:  
- https://modal.com/pricing  
- https://modal.com/docs/guide/region-selection  

**For us:** Optional offload for heavy CPU/GPU slices; **not** the HITL substrate. EU pin tax + no self-host hurts Art. 9 + cost story vs Hetzner always-on small fleet.

### 8.2 Inngest

**Solves:** Event-driven durable functions with step memoization, sleeps, concurrency controls, native DX — cloud or OSS self-host.

| Item | Detail |
|------|--------|
| Pricing (Cloud) | Hobby **$0** (50k executions); Pro from **$99/mo** with **1M executions** included, then PAYG; HIPAA BAA on Enterprise |
| Execution math | Run + each `step.run` counts — deep agent loops get expensive |
| EU | Cloud is multi-tenant (confirm current region map with sales); **self-host** keeps data on Hetzner |
| Self-host | **Yes** (OSS 1.0+; SQLite or Postgres) |
| Lock-in | Low–medium (SDK patterns); self-host reduces vendor risk |
| HITL | Sleeps + wait-for-event patterns; good for days if designed well |
| Observability | Strong in Cloud; thinner when fully self-hosted |

Sources:  
- https://www.inngest.com/pricing  
- https://www.inngest.com/docs/self-hosting  
- https://www.inngest.com/blog/inngest-1-0-announcing-self-hosting-support  

**For us:** Credible **lighter** alternative to Temporal if you want event-first DX and accept self-hosting the Inngest server. Slightly less battle-tested than Temporal for complex multi-agent saga + ops tooling.

### 8.3 Restate

**Solves:** Journal-based durable execution as a **single binary**; workflows, virtual objects, awakeables (HITL), strong fit for agents; Cloud or self-host; BYOC on AWS/GCP.

| Item | Detail |
|------|--------|
| Pricing (Cloud) | Usage-based **durable actions**; free tier **50k actions/mo**; `us` or **`eu`** env hostnames |
| BYOC | Capacity-based; Restate claims large savings vs action-metered Temporal at high QPS (marketing comparison — validate) |
| Self-host | **Yes** — single binary, laptop → cluster |
| Lock-in | Low–medium (SDK); binary is open |
| Python | Supported; ecosystem younger than Temporal |
| Observability | Cloud UI timelines; improving |

Sources:  
- https://www.restate.dev/blog/announcing-restate-cloud-public  
- https://docs.restate.dev/cloud/getting-started  
- https://www.restate.dev/blog/announcing-restate-byoc  
- https://alatirok.com/durable-execution-ai-agents-compared/

**For us:** Best “simple self-host durability” competitor to Temporal. Prefer Temporal today for Python maturity, UI/ops ecosystem, and hiring/docs; revisit Restate in 6–12 months if Temporal ops feel heavy.

---

## Cross-platform comparison (managed agent runtimes)

| Platform | Solves | Ballpark platform cost | EU residency | Self-host | Lock-in | Fit for us |
|----------|--------|------------------------|--------------|-----------|---------|------------|
| Vertex Agent Engine | Sessions, memory, scale | $0.085/vCPU-h + $0.009/GiB-h + storage/ops | Many EU regions; feature DRZ caveats | No | High | Low |
| Agentspace / Gemini Enterprise app | Employee hub | Seat/product SKUs | EU multi-region options | No | High (workspace) | N/A for custom API |
| Bedrock AgentCore | Full agent stack | ~$0.09/vCPU-h + memory/events | DE/IE/UK/FR/SE | No | High | Low |
| Azure Foundry Agents | Threaded agents + tools | Models + tools + BYO Azure | Data Zone / BYO | No | High | Low |
| CF Agents + DO | Hibernating stateful agents | DO $12.50/M GB-s etc. | `eu` jurisdiction | No | High (TS/Workers) | Spike only |
| LangGraph Platform | Graph deploy + memory APIs | $39/seat + LCU/LSU | US/EU cloud; Enterprise self-host | Enterprise | Medium–high | Optional tracing only |
| Temporal Cloud | Orchestration only | ≥$100/mo + Actions | EU namespaces | OSS yes | Low–med | **High** |
| Restate Cloud | Orchestration | Free 50k actions; PAYG | `eu` envs | OSS yes | Low–med | Medium |
| Inngest Cloud | Event durable functions | ≥$0 / $99 Pro | Self-host for sovereignty | OSS yes | Low–med | Medium |
| Modal | Serverless Python compute | Per-sec + region tax | `eu` pin 1.5× | No | Medium | Activity offload only |

---

## Decision: durability substrate

### Requirements mapped

| Need | Implication |
|------|-------------|
| Nightly batch × hundreds of athletes | Schedules + fan-out child workflows/activities; concurrency caps |
| Event-driven triggers | Signals / event → workflow start |
| HITL pause hours–days | Durable wait without holding workers; resume on approval |
| Already Hetzner + Docker + Traefik + Redis + Python | Prefer substrate that runs beside existing services |
| Art. 9 | Prefer history/state on your Postgres/Hetzner; minimize US SaaS seeing payloads |

### Scorecard (1 = poor, 5 = excellent)

| Option | Ops burden (lower is better → inverted score) | Cost | HITL | Observability | **Total / 20** |
|--------|-----------------------------------------------|------|------|---------------|----------------|
| **Self-hosted Temporal** | Ops 3/5 (score **3**) | **5** (infra you already pay) | **5** | **5** | **18** |
| **Temporal Cloud (EU)** | Ops **5** | **3** ($100+ floor + Actions; workers still yours) | **5** | **5** | **18** |
| **Self-hosted Restate** | Ops **4** (single binary) | **5** | **5** | **3** | **17** |
| **Self-hosted Inngest** | Ops **4** | **5** | **4** | **3** | **16** |
| **Celery + Redis** | Ops **5** (you have Redis) | **5** | **2** | **2** | **14** |
| **Postgres job queue** | Ops **4** | **5** | **1** | **2** | **12** |
| Inngest Cloud | Ops **5** | **3** | **4** | **4** | **16** (Art. 9 weaker) |

Scoring notes:

- **HITL:** Temporal/Restate win with signals/awakeables and durable timers. Celery needs DIY state machines + polling; long `sleep` ties workers or loses state. Postgres queues have no native “pause 3 days for coach approval.”
- **Ops:** Celery wins short-term familiarity; Temporal server is another Docker stack (Postgres + Temporal services) but well-documented. Temporal Cloud removes that.
- **Cost:** At hundreds of athletes/night (likely well under millions of Actions), Temporal Cloud Essentials **$100/mo** often beats engineering time; self-host wins if you refuse third-party history storage.
- **Observability:** Temporal UI/history is a step-change vs Flower/custom SQL.

### Clear recommendation

**Primary: Self-hosted Temporal on Hetzner.**

Why this is the *minimum complexity that actually meets the requirements*:

1. You keep **Art. 9 workflow state** in your Postgres on Hetzner.
2. Python SDK is first-class; activities call your existing FastAPI/tools/ClickHouse stack with no rewrite to Workers or GCP.
3. Native **Schedules** (nightly), **Signals** (approvals), **child workflows** (per athlete), retries, and timeouts.
4. Complexity is **one more Docker compose service family**, not a hyperscaler agent platform migration.
5. Celery/Postgres look simpler on day 1 and become a custom workflow engine by month 3 once HITL + partial failure + replay show up.

**Architecture sketch**

```
Traefik → FastAPI agent API (start/signal/query workflows)
                ↓
         Temporal Server (Docker) + Postgres
                ↓
         Worker containers (same image/repo as agent)
                ↓
         Redis (cache/pubsub only — not source of truth for HITL)
```

**Fallback: Temporal Cloud in `aws-eu-central-1` (or `gcp-europe-west3`).**

Use if Temporal server ops (upgrades, persistence, metrics) distract from product for >1 engineer-week/quarter. Keep Workers on Hetzner; put only **non-sensitive IDs** in workflow payloads; fetch health data inside activities from your DB. Budget **~$100–500/mo** platform until Action volume grows.

**Do not** use Celery or a Postgres queue as the system of record for multi-day approvals. Keep Celery only for trivial fire-and-forget if already present.

**Restate** is the runner-up if a spike shows the single-binary ops model fits your team better than Temporal — same topology (workers on Hetzner), different SDK.

**Managed agent platforms (Google/AWS/Azure/CF)** are deferred: wrong layer for this decision; revisit only for a narrow sandbox/browser need, not for core durability.

---

## Practical cost sketch (order-of-magnitude)

Assume ~500 athletes × nightly workflow ≈ 500 starts/day × ~20 Actions/workflow ≈ **300k Actions/month** — inside Temporal Essentials **1M included** → often **~$100/mo** Cloud plan only.

Self-hosted Temporal: **+$0 license**; + small Postgres/CPU on existing Hetzner (tens of €), not hundreds of $ of AgentCore/Vertex runtime.

Vertex/AgentCore at even modest always-on or high session counts routinely reaches **thousands $/mo** before model tokens (see AgentCore 10M-session example ~$7k Runtime).

---

## Sources index

| Topic | URL |
|-------|-----|
| Google Agent Platform pricing | https://cloud.google.com/products/gemini-enterprise-agent-platform/pricing |
| Google Agent Platform product | https://cloud.google.com/products/gemini-enterprise-agent-platform |
| Google ML locations | https://docs.cloud.google.com/gemini-enterprise-agent-platform/machine-learning/general/locations |
| Agentspace / Gemini Enterprise residency | https://cloud.google.com/agentspace/docs/locations |
| Agent Engine billing commentary | https://g360technologies.com/agentic-ai-gets-metered-vertex-ai-agent-engine-billing-goes-live/ |
| Next 2026 rebrand | https://thenextweb.com/news/google-cloud-next-ai-agents-agentic-era |
| Agentspace vs Agent Platform | https://drpranayjha.com/gemini-enterprise-agentspace-enterprise-agents/ |
| Bedrock AgentCore pricing | https://aws.amazon.com/bedrock/agentcore/pricing/ |
| Bedrock AgentCore FAQs | https://aws.amazon.com/bedrock/agentcore/faqs/ |
| Azure Foundry Agent pricing | https://azure.microsoft.com/en-us/pricing/details/foundry-agent-service/ |
| Azure Agent FAQ / privacy | https://learn.microsoft.com/en-us/azure/ai-foundry/agents/faq |
| Cloudflare Agents | https://developers.cloudflare.com/agents/ |
| DO pricing | https://developers.cloudflare.com/durable-objects/platform/pricing/ |
| DO jurisdictions | https://developers.cloudflare.com/durable-objects/reference/data-location/ |
| LangSmith pricing | https://www.langchain.com/pricing |
| Temporal Cloud pricing | https://docs.temporal.io/cloud/pricing |
| Temporal regions | https://docs.temporal.io/cloud/regions |
| Inngest pricing | https://www.inngest.com/pricing |
| Inngest self-hosting | https://www.inngest.com/docs/self-hosting |
| Restate Cloud announce | https://www.restate.dev/blog/announcing-restate-cloud-public |
| Restate getting started | https://docs.restate.dev/cloud/getting-started |
| Modal pricing | https://modal.com/pricing |
| Modal regions | https://modal.com/docs/guide/region-selection |
| Durable execution comparison | https://alatirok.com/durable-execution-ai-agents-compared/ |

---

*End of dossier. No local codebase changes beyond this file.*
