# 56 — LLM & Agent Observability Tooling

**Date:** 2026-08-02  
**Scope:** External research (web search + vendor docs) for a multi-agent Python sports-performance platform: self-hosted on Hetzner (Docker + Traefik) alongside FastAPI, Redis, Next.js on Vercel. Data is EU health-adjacent (GDPR Art. 9). Needs: multi-step agent debug, cost per athlete/org, audit trail of LLM decisions, payloads ideally never leave EU infra without a DPA.  
**Scale assumption:** 50k–500k LLM spans/month.  
**Verdict:** Prefer **self-hosted Langfuse (MIT OSS)** as the primary LLM observability + prompt + eval control plane on Hetzner; instrument with **OpenTelemetry GenAI attributes + a stable internal domain schema** (`ppd.*`); optionally dual-export metrics/traces to Grafana/Tempo later. Do **not** send raw athlete health payloads to any US SaaS. Treat OTel GenAI conventions as a portable interchange layer that is **not yet Stable**.

---

## 1. OpenTelemetry GenAI semantic conventions (2026 status)

### 1.1 Current status

| Fact | Detail | Source |
|------|--------|--------|
| Stability | **All GenAI-specific spans, events, metrics, and attributes remain Development** (formerly “experimental”). No `gen_ai.*` surface is Stable as of mid-July 2026. | [John Hodge, Jul 2026](https://john-hodge.com/blog/opentelemetry-genai-semantic-conventions/), [DEV Community](https://dev.to/azena-ai/opentelemetrys-genai-semantic-conventions-are-not-stable-yet-heres-what-actually-shipped-in-2026-3mke), [gen-ai-spans.md](https://github.com/open-telemetry/semantic-conventions-genai/blob/main/docs/gen-ai/gen-ai-spans.md) |
| Repo home | Moved out of main `semantic-conventions` in **v1.42.0 (2026-06-12)** into dedicated [`open-telemetry/semantic-conventions-genai`](https://github.com/open-telemetry/semantic-conventions-genai). Main repo GenAI docs deprecated. | [semconv releases](https://github.com/open-telemetry/semantic-conventions/releases) |
| Versioning | Dedicated repo has **no tagged releases** yet (as of ~2026-07-17). Last versioned cut of GenAI content is main-repo v1.42.0. | [John Hodge](https://john-hodge.com/blog/opentelemetry-genai-semantic-conventions/) |
| Opt-in | Instrumentations often default to frozen ~v1.36-era names; latest experimental via `OTEL_SEMCONV_STABILITY_OPT_IN=gen_ai_latest_experimental`. | [John Hodge](https://john-hodge.com/blog/opentelemetry-genai-semantic-conventions/), [Genαi](https://genalphai.com/agent-observability-with-opentelemetry-genai-conventions/) |

**Implication for us:** Build on OTel as the *transport* (OTLP) and adopt GenAI attribute names where useful, but **own a versioned internal attribute model**. Never make `gen_ai.*` our DB contract. Keep domain IDs in a reserved namespace (`ppd.*` / `athlete.*`), not under `gen_ai.*`.

### 1.2 Defined span families (Development)

From the official GenAI spans doc ([gen-ai-spans.md](https://github.com/open-telemetry/semantic-conventions-genai/blob/main/docs/gen-ai/gen-ai-spans.md)):

| Span / operation | `gen_ai.operation.name` examples | Role |
|------------------|----------------------------------|------|
| **Inference** | `chat`, `generate_content`, `text_completion` | Model call (CLIENT, or INTERNAL for in-process) |
| **Embeddings** | `embeddings` | Embedding API calls |
| **Retrievals** | retrieval ops | RAG / document fetch |
| **Fetch response** | — | Async / deferred response fetch |
| **Memory** | memory ops | Agent memory read/write |
| **Execute tool** | `execute_tool` | Tool invocation; name `execute_tool {gen_ai.tool.name}` |
| **Agent** | `invoke_agent` (+ related agent/workflow ops in recent revisions) | Agent entry / handoff (client vs internal span split in v1.41) |

Key attributes (all Development unless noted):

| Attribute | Role |
|-----------|------|
| `gen_ai.operation.name` | Required discriminator |
| `gen_ai.provider.name` | Required; replaced `gen_ai.system` (v1.37, Aug 2025) |
| `gen_ai.request.model` / `gen_ai.response.model` | Model identity |
| `gen_ai.usage.input_tokens` / `output_tokens` | Token counts (also cache + reasoning token fields) |
| `gen_ai.conversation.id` | Session/thread grouping |
| `gen_ai.tool.name` / `gen_ai.tool.call.id` | Tool spans |
| `gen_ai.agent.name` / `gen_ai.agent.version` | Multi-agent |
| `gen_ai.prompt.name` / `gen_ai.prompt.version` | Prompt template identity |
| `gen_ai.input.messages` / `output.messages` / `system_instructions` | Opt-in content (privacy-sensitive) |
| `error.type` | **Stable** (core) |

Metrics (also Development): `gen_ai.client.token.usage`, `gen_ai.client.operation.duration`, streaming TTFT metrics.

Eval correlation (v1.38+): `gen_ai.evaluation.result` event with `evaluation.name`, `score.value` / `score.label`, optional `explanation` and `gen_ai.response.id`.

### 1.3 Vendor / framework adoption

| Emitter / consumer | Stance (mid-2026) |
|--------------------|-------------------|
| **Langfuse** | Native OTLP ingestion; Python SDK is OTel-first; masking hooks on OTel export | [Langfuse OTel](https://langfuse.com/docs/opentelemetry/get-started), [masking](https://langfuse.com/docs/observability/features/masking) |
| **LangSmith** | OTel ingest (`/otel/v1/traces`); docs/examples mixed across GenAI attribute generations | [LangSmith cloud rate limits](https://docs.langchain.com/langsmith/cloud), [John Hodge](https://john-hodge.com/blog/opentelemetry-genai-semantic-conventions/) |
| **Phoenix / OpenInference** | First-class **OpenInference** (`llm.*`, span kinds); since May 2026 auto-converts OTel GenAI → OpenInference at ingest | [Phoenix release note](https://arize.com/docs/phoenix/release-notes/05-2026/05-15-2026-otel-semconv-conversion), [OI vs GenAI](https://arize.com/docs/phoenix/tracing/concepts-tracing/otel-openinference/semantic-conventions) |
| **OpenLLMetry (Traceloop)** | OTel-based SDK; export to Traceloop or any OTel backend; migration status varies by package | [OpenLLMetry docs](https://docs.traceloop.com/docs/openllmetry/introduction) |
| **Pydantic AI / Vercel AI SDK** | Moving toward current `gen_ai.provider.name` + structured messages | [John Hodge](https://john-hodge.com/blog/opentelemetry-genai-semantic-conventions/) |
| **OpenAI Agents SDK** | Own tracing architecture; not native OTel GenAI | [John Hodge](https://john-hodge.com/blog/opentelemetry-genai-semantic-conventions/) |
| **Honeycomb, Grafana Tempo, Jaeger, Datadog** | Generic OTLP consumers; LLM UI quality depends on attribute understanding | Community reports |

### 1.4 Stable enough to build on?

**As interchange: yes, with adapters. As schema contract: no.**

Practical rules:

1. Prefer OTLP + dual-read queries (`gen_ai.provider.name` **or** `gen_ai.system`; `input_tokens` **or** `prompt_tokens`).
2. Pin instrumentation versions; publish a dated “tested-with” table.
3. Domain attributes live under `ppd.*` (or similar), never `gen_ai.*`.
4. Expect rename churn until a Stable release + tagged schema URL exists in `semantic-conventions-genai`.

---

## 2. Langfuse (primary candidate)

### 2.1 License & gated features (precise)

**June 2025 open-sourcing:** All product capabilities moved to MIT — tracing, evals (incl. LLM-as-judge), prompt management, playground, annotation queues, datasets/experiments. Commercial periphery shrank to enterprise *platform/security* features.  
Sources: [Open-sourcing blog 2025-06-04](https://langfuse.com/blog/2025-06-04-open-sourcing-langfuse-product), [open-source handbook](https://langfuse.com/handbook/chapters/open-source), [pricing-self-host](https://langfuse.com/pricing-self-host).

| Tier | License / cost | Includes | Does **not** include (OSS) |
|------|----------------|----------|----------------------------|
| **Self-host Open Source** | **MIT, free, unlimited usage** | Observability, evaluation, prompt management, datasets, playground, annotation, OTel, APIs, org-level RBAC, SSO (incl. Okta/Entra), client-side masking, Helm/Docker/Terraform | Project-level RBAC, **data retention management UI/policies**, **audit logs**, SCIM, server-side data masking, UI customization, Admin/Instance APIs, Langfuse Assistant, SOC2 reports, dedicated support |
| **Self-host Enterprise** | Custom (bundled with ClickHouse Cloud/BYOC/Private) | All OSS + EE security/compliance above + support SLA | — |
| **Cloud Hobby → Enterprise** | Usage-based (see §2.5) | Same product surface; EE features gated by Cloud plan | — |

**Caveat for GDPR retention:** Automated **data retention policies** are an **Enterprise (self-host) / Pro+ (Cloud)** feature. On OSS self-host you must implement retention yourself (ClickHouse TTL, cron deletes, blob lifecycle) or buy EE.

### 2.2 Architecture & dependencies

Production stack (same codebase as Cloud) — [self-hosting overview](https://langfuse.com/self-hosting):

| Component | Role |
|-----------|------|
| `langfuse/langfuse` (Web) | UI + API |
| `langfuse/worker` | Async ingestion, evals |
| **PostgreSQL** | OLTP: users, orgs, projects, API keys, prompts, datasets |
| **ClickHouse** | OLAP: traces, observations, scores |
| **Redis / Valkey** | Queue (BullMQ) + cache (API keys, prompts) |
| **S3-compatible blob** | Raw events, multimodal, exports (MinIO/Garage/Hetzner Object Storage) |
| Optional LLM API | Playground + LLM-as-judge (BYO; keep in same VPC) |

Ingestion path: Web → S3 + Redis queue → Worker → ClickHouse (spike-tolerant). All infra components must run **UTC**.

**Effort on Hetzner:** Medium. Docker Compose is fine for low scale; for production prefer Compose with named volumes + backups, or k3s + Helm. You already run Redis — can share carefully or isolate a Langfuse Redis. ClickHouse is the main new operational burden (but you already use ClickHouse elsewhere in the monorepo for wearables — reuse ops knowledge).

### 2.3 Python SDK & data model

- **Python SDK** (`langfuse` / `@observe`): decorator + low-level observations; OTel-native export; `mask_otel_spans` recommended over legacy `mask`.  
  Docs: [SDK overview](https://langfuse.com/docs/observability/sdk/overview), [masking](https://langfuse.com/docs/observability/features/masking).
- **Trace / session / user:**
  - **Trace** = one application execution (agent run).
  - **Observations** = nested spans/generations/events (steps, LLM calls, tools).
  - **Session** = multi-turn thread (`session_id`).
  - **User** = end-user id (`user_id`) — map carefully (coach vs athlete).
- **Metadata / tags:** Attach org, athlete, workflow IDs for filtering and GDPR queries.
- **Cost tracking:** Built-in token + model cost maps; custom model prices supported.  
  [Token & cost tracking](https://langfuse.com/docs/observability/features/token-and-cost-tracking).
- **Prompt management:** Versioned prompts, labels (prod/staging), composability, caching, playground, experiments — all MIT on self-host.
- **Evals:** Datasets, experiments (SDK + UI), LLM-as-judge, human annotation queues, custom scores, external pipelines — all MIT on self-host (since June 2025).

### 2.4 Cloud pricing & EU region

| Plan | Base | Included units | Overage | Retention access |
|------|------|----------------|---------|------------------|
| Hobby | $0 | 50k units/mo | — | 30 days |
| Core | $29/mo | 100k | Graduated from $8/100k | 90 days |
| Pro | $199/mo | 100k | Same | 3 years + retention mgmt |
| Enterprise | $2,499/mo | 100k | Same (+ custom) | 3 years + audit/SCIM |

Graduated overage: $8 → $7 → $6.50 → $6 per 100k units.  
**Billable unit** = any tracing datapoint: traces, observations (spans/events/generations), **and scores**.  
Source: [langfuse.com/pricing](https://langfuse.com/pricing).

**EU Cloud region:** Ireland, AWS `eu-west-1` — `https://cloud.langfuse.com`. Also US, Japan, HIPAA (US). DPA available.  
Source: [Data regions](https://langfuse.com/security/data-regions).

**Note:** ClickHouse tracing data in Cloud is **not** cross-region replicated; Postgres is. For DR of traces, export to your own blob.

### 2.5 Cost at our scale (Cloud vs self-host)

Assumption: multi-step agents → ~1 trace + 5–15 observations per run. At 50k–500k **LLM spans**, billable units could be ~60k–700k+/mo if every span is an observation.

| Volume (units/mo) | Cloud Core (approx) | Self-host OSS |
|-------------------|---------------------|---------------|
| 50k | Hobby $0 or Core $29 | Infra only |
| 100k | Core $29 | Infra only |
| 500k | ~$29 + $32 = **~$61** | Infra only |
| 1M | ~$101 | Infra only |

Self-host infra on Hetzner (ballpark): small ClickHouse + Postgres + Redis + MinIO/Object Storage + 2 app containers ≈ **€40–150/mo** at this volume if sized modestly; grows with retention and query load. No per-unit license fee.

### 2.6 Scorecard (Langfuse)

| Dimension | Assessment |
|-----------|------------|
| Self-hosting reality | **Strong** — Docker Compose / Helm / Terraform; real production path |
| License | **MIT core**; EE for retention policies, audit logs, project RBAC, SCIM, server-side masking |
| EU residency | Cloud EU (`eu-west-1`) or **self-host on Hetzner (best)** |
| Trace quality (agents) | Excellent nested observations + sessions |
| Cost/token tracking | First-class |
| Prompt versioning | First-class (OSS) |
| Eval integration | First-class (OSS since 2025-06) |
| Payload redaction / local | Client `mask_otel_spans`; keep all storage in EU VPC; EE server-side masking |

---

## 3. LangSmith

### 3.1 Features

Observability (tracing, monitoring, insights), online/offline evals, datasets, annotation queues, Prompt Hub + Playground, bulk export, plus LangSmith Deployment / Fleet / Engine / Sandboxes / LLM Gateway on higher tiers.  
Source: [langchain.com/pricing](https://www.langchain.com/pricing).

### 3.2 Pricing (2026)

| Plan | Seat | Included traces | Hosting |
|------|------|-----------------|---------|
| Developer | $0 (1 seat) | 5k base traces/mo | Cloud |
| Plus | **$39/seat/mo** | 10k base traces/mo | Cloud |
| Enterprise | Custom | Custom | Cloud, **Hybrid**, or **Self-Hosted** |

Usage metering (platform):

- **LCU** = $1.50 (compute/work: Engine, Fleet, deployments, sandboxes).
- **LSU** = $1.00 (storage/traces). Pricing calculator uses **0.005 LSU per additional trace** ⇒ **~$5 per 1k traces** beyond inclusion (verify live calculator).
- Retention model: **base = 14 days**, **extended = 400 days** (auto-upgrades when feedback/online evaluators attach — can spike cost). Older docs also cite ~$0.50/1k base vs $5/1k fully extended; **always verify [pricing-langsmith](https://www.langchain.com/pricing-langsmith)** before budgeting.

Sources: [pricing](https://www.langchain.com/pricing), [usage-and-billing](https://docs.langchain.com/langsmith/usage-and-billing), [Inference.net teardown](https://inference.net/content/langsmith-pricing/) (cross-check; some third-party numbers diverge).

**At 50k–500k traces/mo (Plus, 3 seats):** rough order **$117 seats + hundreds–thousands $ in LSU overage** — typically **much more expensive** than self-hosted Langfuse at our span volumes if we map 1:1 agent runs to traces. If we send every LLM span as a separate “trace,” costs explode; LangSmith’s unit is usually the **run**, not each child span.

### 3.3 Self-hosting

**Enterprise add-on only** — not open source. Requires license key, Kubernetes (Helm), Postgres, Redis, blob storage. Contact sales.  
Sources: [self-hosted](https://docs.langchain.com/langsmith/self-hosted), [deploy overview](https://docs.langchain.com/langsmith/deploy-to-self-hosted-overview).

### 3.4 EU data region

EU SaaS: GCP **`europe-west4` (Netherlands)** — `https://eu.smith.langchain.com`. US default `us-central1`. Also AWS us-east-2, APAC Sydney.  
Source: [LangSmith cloud](https://docs.langchain.com/langsmith/cloud).

### 3.5 Coupling to LangChain

Deepest integration with LangChain/LangGraph (callbacks, Deployment for LangGraph agents). Non-LangChain apps can use SDKs/OTel, but the product gravity and Deployment/Engine features assume LangChain ecosystem. For a **framework-agnostic Python multi-agent** stack, this is optional coupling we should avoid unless we standardize on LangGraph.

### 3.6 Scorecard

| Dimension | Assessment |
|-----------|------------|
| Self-hosting | **Enterprise-only, proprietary** — poor fit for Hetzner OSS preference |
| License | Proprietary SaaS / EE |
| EU residency | Yes (NL), with DPA on paid plans |
| Trace quality | Excellent for LangGraph agents |
| Cost at scale | **High** (seats + LSU); retention upgrades risky |
| Prompts / evals | Strong |
| Health-data | EU region + DPA possible, but Art. 9 still prefers self-host; self-host is expensive EE |

---

## 4. Braintrust

### 4.1 Positioning

**Eval-centric** AI platform: tracing + experiments + scorers + playground + Loop agent for autonomous eval iteration. Strong product for teams whose primary workflow is “improve prompts/agents via eval loops,” less of a pure production APM.

### 4.2 Pricing (verified 2026-08 from pricing page)

| Plan | Fee | Processed data | Scores | Retention | Deploy |
|------|-----|----------------|--------|-----------|--------|
| Starter | $0 | 1 GB (+$4/GB) | 10k (+$2.50/1k) | 14 days | SaaS |
| Pro | **$249/mo** | 5 GB (+$3/GB) | 50k (+$1.50/1k) | 30 days (+$0.50/GB/mo after) | SaaS |
| Enterprise | Custom | Custom | Custom | Custom | **SaaS, BYOC, self-hosted** |

Model credits: Starter $10; Pro promotional $249 → drops to $100 on 2026-09-01 (per secondary analyses).  
Sources: [braintrust.dev/pricing](https://www.braintrust.dev/pricing), [plans-and-limits](https://www.braintrust.dev/docs/plans-and-limits).

Self-host / BYOC / custom retention / SAML / audit logging / BAA / signed DPA → **Enterprise only**. Pro DPA is click-through.

### 4.3 Scorecard

| Dimension | Assessment |
|-----------|------------|
| Self-hosting | Enterprise sales cycle — not free OSS |
| Eval strength | **Best-in-class positioning** |
| EU / Art. 9 | Weak unless Enterprise + residency negotiation |
| Cost at 50k–500k spans | Pro $249 may cover light prod; data GB + scores drive overages; Enterprise if we must keep health payloads |
| Fit for us | Excellent as **eval SaaS for synthetic/redacted fixtures**, poor as sole production store for Art. 9 traces |

---

## 5. Arize Phoenix

### 5.1 OSS self-hosting

- **Free to self-host, no feature gates** on Phoenix OSS. Docker / Compose / Helm.  
  Source: [Phoenix self-hosting](https://arize.com/docs/phoenix/self-hosting).
- License: **Elastic License 2.0 (ELv2)** — free for internal use; **cannot** offer Phoenix as a managed service to third parties. Fine for our internal platform.  
  Sources: [GitHub arize-ai/phoenix](https://github.com/arize-ai/phoenix/), reviews citing ELv2.

### 5.2 OpenInference

OpenInference = Arize-maintained AI semantic conventions on top of OTel (`openinference.span.kind`: LLM, TOOL, AGENT, CHAIN, RETRIEVER, …; `llm.input_messages.*`, etc.). More stable for Phoenix UI than raw GenAI. Phoenix **auto-converts** OTel GenAI → OpenInference since 2026-05-15.  
Sources: [OI best practices](https://arize.com/docs/phoenix/cookbook/tracing/openinference-best-practices), [conversion release](https://arize.com/docs/phoenix/release-notes/05-2026/05-15-2026-otel-semconv-conversion).

### 5.3 Feature completeness

Tracing, evals, datasets, experiments, prompt management, OTLP ingest. Production multi-tenant org billing / project RBAC / enterprise SSO story is thinner than Langfuse Cloud/EE; Arize **AX** is the commercial scale product. Phoenix is excellent for **dev/eval** and solid for self-hosted prod at moderate scale, but Langfuse is stronger on prompt versioning + org cost dashboards + MIT clarity.

### 5.4 Scorecard

| Dimension | Assessment |
|-----------|------------|
| Self-hosting | **Easy**, feature-complete OSS |
| License | ELv2 (not MIT) — OK internally; note SaaS restriction |
| EU residency | Self-host on Hetzner = full control |
| Trace quality | Strong via OpenInference + agent span kinds |
| Cost tracking | Present; less “billing per org” oriented than Langfuse |
| Prompts / evals | Good |
| Fit | Strong **alternative or secondary** eval UI; Langfuse slightly better for our compliance + billing narrative |

---

## 6. Brief assessments: Helicone, Traceloop/OpenLLMetry, W&B Weave

### 6.1 Helicone

- **Gateway-first** LLM observability (proxy), cost tracking, caching, rate limits, prompts.
- Cloud: Hobby 10k req/mo free; **Pro $79/mo**; **Team $799/mo**; Enterprise custom. Retention 7d → 1mo → 3mo → forever.  
  Source: [helicone.ai/pricing](https://www.helicone.ai/pricing).
- Self-host: **Apache 2.0**, Docker/Helm; data stays local.  
- **Gap for us:** Weaker multi-step **agent** tree / eval / prompt-experiment loop vs Langfuse/Phoenix. Better as optional gateway for provider failover + cache, not as system of record for agent audit trails.

### 6.2 Traceloop / OpenLLMetry

- **OpenLLMetry**: Apache-2.0 OTel instrumentation SDK → export to any backend (Tempo, Honeycomb, Datadog, Traceloop).
- Traceloop Cloud: free up to **50k spans/mo**, 24h retention on free; paid/custom retention; on-prem option.  
  Source: [traceloop.com/pricing](https://www.traceloop.com/pricing).
- **Fit:** Excellent as **instrumentation library** feeding our chosen backend; do not need Traceloop SaaS. Watch GenAI attribute generation drift ([John Hodge](https://john-hodge.com/blog/opentelemetry-genai-semantic-conventions/)).

### 6.3 Weights & Biases Weave

- LLM tracing + evals inside W&B ecosystem; `@weave.op` cost capture.
- Pricing tied to W&B seats/storage (~Team ~$50/user/mo class; Enterprise for self-host). SaaS-first.  
- **Fit:** Only if we already standardize on W&B for ML. Extra seat tax and weaker Art. 9 story for production athlete traces. Skip as primary.

---

## 7. Fully self-hosted Grafana stack (Tempo + Loki + Prometheus) — no LLM vendor

### 7.1 Architecture

```
Python agents
  → OTel SDK (GenAI attrs + ppd.* attrs)
  → OTel Collector (redaction processor, sampling, routing)
  → Grafana Tempo (traces)
  → Prometheus / Mimir (gen_ai token & latency metrics)
  → Loki (structured logs / audit decisions)
  → Grafana dashboards + Explore
```

Deploy beside existing Traefik/Docker on Hetzner. Zero LLM-vendor license.

### 7.2 Gain vs lose

| Gain | Lose |
|------|------|
| Full EU data residency; no DPA with LLM vendor | No first-class agent waterfall UI out of the box |
| One observability plane with FastAPI/infra | No built-in prompt registry / versioning |
| Cheap at high span volume (disk + ClickHouse/Tempo) | No native dataset/experiment/eval product |
| Maximum control over redaction in Collector | Cost-per-org dashboards must be built (PromQL + labels) |
| Portable OTel | Engineers build LLM-specific UX (or use Grafana LLM plugins — immature) |
| Audit logs via Loki + immutable object storage | Higher eng investment (weeks → ongoing) |

### 7.3 Recommendation relative to Langfuse

Use Grafana stack as **infra observability + long-term metric warehouse**, not as the sole LLM debugger for year one. Optional: OTel Collector **fan-out** — full (redacted) traces to Langfuse; metrics-only or heavily sampled spans to Tempo.

---

## 8. Cross-option comparison (our constraints)

| Option | Self-host effort | License risk | EU / Art. 9 | Cost @ 50k–500k spans | Agent traces | Cost tracking | Prompts | Evals | Redaction / local |
|--------|------------------|--------------|-------------|----------------------|--------------|---------------|---------|-------|-------------------|
| **Langfuse OSS** | Medium (CH+PG+Redis+S3) | MIT; EE for retention/audit UI | **Best** (Hetzner) | Infra € | ★★★★★ | ★★★★★ | ★★★★★ | ★★★★★ | Client mask; local storage |
| Langfuse Cloud EU | None | SaaS + DPA | Good (IE) | $0–~$100+ | ★★★★★ | ★★★★★ | ★★★★★ | ★★★★★ | Mask + DPA; still subprocessors |
| LangSmith EU | EE only / hard | Proprietary | Good (NL) | High (seats+LSU) | ★★★★★ | ★★★★ | ★★★★★ | ★★★★★ | Gateway redaction; EE self-host |
| Braintrust | EE only | Proprietary | Negotiate | $249+ / EE | ★★★★ | ★★★★ | ★★★★ | ★★★★★ | Enterprise for local |
| Phoenix OSS | Low–medium | **ELv2** | Best if self-host | Infra € | ★★★★★ | ★★★★ | ★★★★ | ★★★★★ | Local |
| Helicone OSS | Low–medium | Apache-2.0 | Best if self-host | Infra € | ★★★ | ★★★★★ | ★★★ | ★★ | Local; gateway model |
| OpenLLMetry→Tempo | Medium–high | Apache-2.0 SDK | Best | Infra € | ★★★ (DIY UI) | DIY | DIY | DIY | Collector processors |
| W&B Weave | EE self-host | Proprietary | Weak default | Seat-heavy | ★★★★ | ★★★★ | ★★★ | ★★★★ | Enterprise |

---

## 9. Recommended stack for Peak Performance Data

### 9.1 Concrete recommendation

1. **System of record (production agent traces):** **Self-hosted Langfuse (MIT)** on Hetzner behind Traefik, same Docker network as FastAPI agents.  
   - Storage: Postgres + ClickHouse + Redis (dedicated) + Hetzner Object Storage/MinIO.  
   - No Cloud path for traces that may contain Art. 9 content unless legal signs DPA **and** payloads are aggressively redacted (prefer neither).
2. **Instrumentation:** OpenTelemetry from Python agents (Langfuse OTel exporter **or** OTel Collector → Langfuse OTLP). Emit GenAI attrs **plus** `ppd.*` domain attrs. Optionally OpenLLMetry/OpenInference auto-instrumentation for LLM SDKs.
3. **Redaction:** Mandatory `mask_otel_spans` (or Collector redaction) **before** export. Default: strip/omit `gen_ai.input.messages` / `output.messages` / tool args that embed HRV, CGM, diagnoses; keep hashes/IDs + aggregate metrics.
4. **Metrics / infra:** Existing or new **Prometheus + Grafana**; optionally Tempo for non-LLM traces. Export Langfuse cost metrics via API into billing warehouse.
5. **Evals:** Langfuse datasets + experiments on self-host (offline CI + sampled online scores). Optionally Braintrust/Phoenix **only** on **synthetic or fully redacted** fixtures if a team prefers that UX — never raw prod health traces.
6. **Skip as primary:** LangSmith (unless we go all-in LangGraph + buy EE), W&B Weave, Helicone-as-SoR.
7. **License caveat to budget for:** If compliance requires **immutable audit logs** and **declarative retention policies** in-product, plan Langfuse **Enterprise self-host** later; until then implement ClickHouse TTL + export-to-cold-storage + application-level audit table in Postgres/Supabase.

### 9.2 What to instrument & granularity

| Level | Span / observation | Always? | Contents |
|-------|-------------------|---------|----------|
| **Agent run** | Root trace / `invoke_agent` | Yes | Workflow name, status, latency, error, all `ppd.*` IDs |
| **Step / specialist** | Span per planner/specialist/critic hop | Yes | Agent name, step type, input/output **summaries** (redacted) |
| **LLM call** | Generation / inference span | Yes | Provider, model, tokens, cost, prompt name/version, finish reason; **messages redacted or truncated** |
| **Tool call** | `execute_tool` | Yes | Tool name, call id, latency, error; args/results **schema-validated & redacted** (IDs OK; raw series no) |
| **Retrieval / embed** | retrieval / embeddings spans | When used | Corpus id, top-k ids, not full document bodies with health text |
| **Eval score** | Score on trace | Sampled / CI | Scorer name, value, rationale truncated |

Sampling policy suggestion: 100% of failed runs + coach-facing insight publishes; 10–100% of successful batch runs depending on volume; always retain cost aggregates.

### 9.3 Domain modeling in traces (GDPR access request ready)

Attach on **every root trace** and propagate to children:

| Attribute | Example | Purpose |
|-----------|---------|---------|
| `ppd.organization_id` | uuid | Tenant isolation, cost rollup |
| `ppd.athlete_id` | uuid | **Primary GDPR subject key** |
| `ppd.coach_id` | uuid \| null | Actor who triggered / recipient |
| `ppd.user_id` | auth subject | Who invoked (may be coach/parent/system) |
| `ppd.insight_id` | uuid \| null | Link to persisted insight |
| `ppd.workflow_run_id` | uuid | Idempotent batch/job id |
| `ppd.workflow_name` | `nightly_athlete_brief` | Product surface |
| `ppd.environment` | `prod` \| `staging` | |
| `ppd.data_class` | `art9` \| `operational` | Retention & redaction policy selector |
| `session_id` | conversation id | Multi-turn chat |
| `trace tags` | `["tennis","wearable","batch"]` | Fast filters |

**GDPR access query:**  
`WHERE metadata.ppd.athlete_id = $athlete_id` (Langfuse metadata/filters) → export all traces/scores for that subject within retention window. Pair with application DB insight rows. Document this query in the RoPA / DSAR runbook.

Do **not** put athlete names, emails, or free-text clinical notes in span names.

### 9.4 PII / health-data redaction strategy

1. **Default deny content capture:** Do not set Opt-In `gen_ai.input.messages` / `output.messages` in production for Art. 9 workflows.
2. **Structured tool I/O:** Allowlist fields per tool (e.g. `hrv_rmssd_ms`, `sleep_score`); drop raw arrays, free text, GPS.
3. **Masking hook:** Regex + JSON path redaction for emails, phones, auth tokens; delete known dangerous OTel attrs from OpenAI instrumentors.
4. **Split sinks:** Full fidelity only in app DB (already access-controlled); observability holds **decision metadata** (model, tokens, tool names, insight id, scores).
5. **Eval datasets:** Build from synthetic athletes or irreversibly anonymized snapshots with separate legal basis; never clone prod traces wholesale to SaaS eval tools.
6. **Vercel Next.js:** Browser/edge must not log prompts with health data to third-party analytics; server actions that call agents should only pass IDs to Hetzner FastAPI.

### 9.5 Retention policy (GDPR-oriented)

| Class | Hot (Langfuse/CH) | Warm (object export) | Notes |
|-------|-------------------|----------------------|-------|
| Art. 9 agent traces (debug) | **30–90 days** | Optional hashed metadata 1–2 years if needed for dispute | Minimize; purpose limitation |
| Cost aggregates (per org/athlete/day) | 13–24 months | Billing warehouse | Not full prompts |
| Safety / medical-overreach incidents | 1–2 years | Legal hold capable | Explicit retention justification |
| Prompt versions & eval datasets | Life of product + 1 year | Git + Langfuse Postgres | Usually non-Art.9 if synthetic |
| Audit of “who accessed athlete X traces” | 1–2 years | App audit log (if no Langfuse EE audit) | Implement in app if OSS |

Implement CH TTL + S3 lifecycle on OSS; revisit Langfuse EE when retention UI + audit logs become mandatory for SOC2/enterprise customers.

### 9.6 Connection to eval program & cost accounting

**Evals (ties to research `10-eval-harness.md` gap):**

- Store golden trajectories + expected tool traces as **Langfuse datasets**.
- CI job runs experiments via Langfuse Python SDK against staging models; gate on safety scorers (medical overreach, missing evidence chips).
- Online: sample production traces → LLM-as-judge **on redacted summaries only** (or rule-based scorers that need no content).
- Scores written back to the same `workflow_run_id` / `insight_id` for closed-loop quality.

**Cost accounting / billing:**

- Langfuse observations carry model + token + $ cost.
- Nightly job: Metrics API / export → aggregate `sum(cost) group by ppd.organization_id, day` (and optionally athlete for internal unit economics, not necessarily customer-facing).
- Feed org-level LLM cost into existing Stripe/B2B invoicing as metered dimension or margin dashboard.
- Alert when org cost / athlete / day exceeds threshold (Langfuse monitors on Cloud Pro+, or Grafana alerts on exported metrics for OSS).

---

## 10. Implementation sketch (Hetzner)

```yaml
# Conceptual compose services (names only)
services:
  langfuse-web:
  langfuse-worker:
  langfuse-postgres:
  langfuse-clickhouse:
  langfuse-redis:          # prefer dedicated vs app Redis
  langfuse-minio:          # or Hetzner Object Storage
  otel-collector:          # optional: redact + fan-out
  # existing:
  fastapi-agents:
  redis-app:
  traefik:
```

Python agent bootstrap (illustrative):

```python
# Pseudocode — pin package versions in prod
from langfuse import Langfuse, observe

def mask_otel_spans(*, params):
    # delete gen_ai.input.messages / output.messages / sensitive tool payloads
    ...

langfuse = Langfuse(mask_otel_spans=mask_otel_spans)

@observe(name="nightly_athlete_brief")
def run_brief(*, organization_id, athlete_id, workflow_run_id, insight_id=None):
    langfuse.update_current_trace(
        session_id=workflow_run_id,
        user_id=f"system:nightly",
        metadata={
            "ppd.organization_id": organization_id,
            "ppd.athlete_id": athlete_id,
            "ppd.workflow_run_id": workflow_run_id,
            "ppd.insight_id": insight_id,
            "ppd.workflow_name": "nightly_athlete_brief",
            "ppd.data_class": "art9",
        },
        tags=["batch", "art9"],
    )
    ...
```

---

## 11. Sources (primary)

### OpenTelemetry GenAI
- https://github.com/open-telemetry/semantic-conventions-genai/blob/main/docs/gen-ai/gen-ai-spans.md  
- https://github.com/open-telemetry/semantic-conventions/releases  
- https://john-hodge.com/blog/opentelemetry-genai-semantic-conventions/ (2026-07-17)  
- https://genalphai.com/agent-observability-with-opentelemetry-genai-conventions/  
- https://dev.to/azena-ai/opentelemetrys-genai-semantic-conventions-are-not-stable-yet-heres-what-actually-shipped-in-2026-3mke  

### Langfuse
- https://langfuse.com/pricing  
- https://langfuse.com/pricing-self-host  
- https://langfuse.com/self-hosting  
- https://langfuse.com/security/data-regions  
- https://langfuse.com/blog/2025-06-04-open-sourcing-langfuse-product  
- https://langfuse.com/handbook/chapters/open-source  
- https://langfuse.com/docs/observability/features/masking  
- https://langfuse.com/docs/observability/features/token-and-cost-tracking  
- https://langfuse.com/docs/administration/billable-units  

### LangSmith
- https://www.langchain.com/pricing  
- https://www.langchain.com/pricing-langsmith  
- https://docs.langchain.com/langsmith/self-hosted  
- https://docs.langchain.com/langsmith/cloud  
- https://docs.langchain.com/langsmith/usage-and-billing  

### Braintrust
- https://www.braintrust.dev/pricing  
- https://www.braintrust.dev/docs/plans-and-limits  

### Phoenix / OpenInference
- https://arize.com/docs/phoenix/self-hosting  
- https://github.com/arize-ai/phoenix/  
- https://arize.com/docs/phoenix/tracing/concepts-tracing/otel-openinference/semantic-conventions  
- https://arize.com/docs/phoenix/release-notes/05-2026/05-15-2026-otel-semconv-conversion  
- https://github.com/Arize-ai/openinference  

### Others
- https://www.helicone.ai/pricing  
- https://www.helicone.ai/blog/self-hosting-launch  
- https://www.traceloop.com/pricing  
- https://docs.traceloop.com/docs/openllmetry/introduction  
- Secondary comparisons: Laminar 2026-01-29, Inference.net LangSmith 2026, TrueFoundry Braintrust/Helicone teardowns (cross-check against vendor pages)

---

## 12. Decision summary

| Decision | Choice |
|----------|--------|
| Primary platform | **Self-hosted Langfuse (MIT)** on Hetzner |
| Interchange | **OTLP + GenAI attrs** (Development — adapter layer) + **`ppd.*` domain model** |
| Not primary | LangSmith, Braintrust Cloud for prod Art.9, W&B Weave |
| Optional later | Langfuse EE (retention + audit logs); Phoenix for eval UX; Tempo fan-out |
| Hard rule | No unredacted athlete health payloads off EU self-hosted infra |

**Licensing caveats to remember:** Langfuse OSS lacks in-product retention policies and audit logs (EE); Phoenix is ELv2 not MIT; LangSmith/Braintrust self-host are paid Enterprise only; OTel GenAI is not Stable — pin versions and dual-read attribute generations.
