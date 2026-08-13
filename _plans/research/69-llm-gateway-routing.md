# 69 — LLM Gateway and Routing Infrastructure

**Research date:** 2026-08-02  
**Scope:** External research only (vendor docs, GitHub, independent 2025–2026 reviews). No local codebase exploration.  
**Audience:** Multi-agent Python sports-performance platform, self-hosted on Hetzner (Docker, Traefik, Redis). Needs multi-provider failover, tiered model routing, per-org cost tracking for billing, budget caps, rate limiting. Replacing a ~120-line sequential provider router (no retries, backoff, circuit breaking, or cost tracking). Prompt caching is load-bearing for the nightly batch cost model.

---

## Executive verdict

**Do not introduce a separate HTTP LLM gateway as a hard dependency for v1.** Use the **LiteLLM Python SDK `Router` in-process** for provider unification, retries, fallbacks, cooldowns, and cost calculation; own **org / athlete / agent / workflow_run** attribution, budgets, and rate limits in Redis + Postgres. Call providers with **explicit Anthropic `cache_control` (and verify `cache_creation_input_tokens` / cached reads on every batch warm-up)**.

**Reject OpenRouter for production athlete/health-adjacent traffic** (US proxy, global default routing, enterprise-only EU residency). Treat Portkey SaaS / Cloudflare AI Gateway the same way for primary paths: useful for experiments, not for EU health-adjacent prompts. Bifrost is the best *performance-oriented* self-hosted gateway if you later need a shared edge for many non-Python clients; it is optional, not required for the Python agent runtime.

**Prompt-caching finding (non-negotiable):** LiteLLM documents and tests Anthropic `cache_control` passthrough (content-block and top-level automatic caching). Portkey also supports native Anthropic caching on Anthropic-native / Messages paths, but strips `cache_control` when adapting to Chat Completions–shaped providers. Any gateway that only speaks OpenAI Chat Completions without an Anthropic-native path is **disqualifying** for the nightly batch. Prefer the path that preserves provider-native headers and content blocks; add a CI assertion that cache write/read tokens appear on the warm-up call.

---

## Comparison matrix (decision-relevant)

| Dimension | LiteLLM SDK Router | LiteLLM Proxy | Portkey | OpenRouter | Bifrost | Helicone GW | Cloudflare AI GW | Kong AI GW | No gateway (native SDKs / PydanticAI) |
|---|---|---|---|---|---|---|---|---|---|
| Self-host on Hetzner | Yes (library) | Yes (Docker) | OSS GW yes; full platform Enterprise | No | Yes (Docker/K8s) | Yes (Docker; project risk) | No | Yes (Enterprise-heavy) | Yes |
| EU data handling | Data stays on your hosts + chosen providers | Same | SaaS US-centric; hybrid/airgap Enterprise | Default global US; EU enterprise-only | Self-host → you control | Self-host or US cloud | Cloudflare edge (US co.) | Self-host possible | Best fidelity |
| Latency overhead | Low (in-process; vendor claims ~ms-class for proxy) | Vendor: ~8ms P95 @ 1k RPS; field reports higher under load | Claims “fastest”; still hop | Extra hop + provider pick | ~11 µs @ 5k RPS (vendor) | Rust, sub-5ms claimed | Edge hop | Plugin hop | Lowest |
| Cost tracking granularity | Per-call `completion_cost`; tags via metadata you pass | Key / user / team / org / tags (proxy) | Metadata + virtual keys | Per-request accounting | Virtual keys / teams / customers | Rich observability | Basic cost analytics | Metering plugins | You build it |
| Budget enforcement | App-layer (recommended) or proxy budgets | Key/team/user budgets (OSS); advanced tag/provider budgets often Enterprise | Budgeting on paid/Enterprise | Credits only | Hierarchical VK budgets (OSS) | Rate limits; credit model on cloud | Rate limits | AI rate-limit plugins | You build it |
| Streaming | Yes | Yes | Yes | Yes | Yes | Yes | Yes | Yes | Yes (native) |
| Prompt-cache passthrough | **Yes** (documented Anthropic `cache_control`) | Yes + auto-inject hooks | Yes on Anthropic-native; **stripped on adapters** | Unreliable for health/EU; not recommended | Response/semantic cache ≠ prompt cache; verify Anthropic path | Response cache focus; verify | Response cache; verify | Plugin-dependent | **Best** |
| Structured-output fidelity | Good via `/v1/messages` / mapped params; validate yourself | Same | Native path good; adapter path lossy | Varies by upstream | OpenAI-compat layer risk | OpenAI-compat layer risk | OpenAI-compat | Plugin translation risk | **Best** |
| Operational burden | Low (dep + config) | Medium–high (Postgres, Redis, upgrades, memory) | Medium (SaaS) / high (self-host + control plane) | Low | Medium (Go binary; ops) | Medium + **maintenance-mode risk** | Low ops, no self-host | High (platform team) | Medium eng (you own reliability) |

---

## 1. LiteLLM (proxy + Python SDK)

### 1.1 Current version and surface

| Item | Value (as of 2026-08-02) |
|---|---|
| PyPI latest | **`litellm` 1.83.9** |
| License (core) | MIT |
| Enterprise | Separate commercial license on Enterprise features |
| Docs | https://docs.litellm.ai/docs/ |
| GitHub | https://github.com/BerriAI/litellm |

Two products share one package:

1. **Python SDK** — `litellm.completion` / `Router` as a drop-in OpenAI-shaped client inside the app.
2. **Proxy (AI Gateway)** — self-hosted OpenAI-compatible HTTP service with virtual keys, Admin UI, Redis-backed limits, logging callbacks.

Vendor positioning: SDK for developers building LLM apps; Proxy for platform teams centralizing access. Performance claim for proxy: **8ms P95 at 1k RPS** ([benchmarks](https://docs.litellm.ai/docs/benchmarks)). Prefer Docker images with the **`-stable`** tag for production (12h load-tested release cycle).

### 1.2 Unified interface and providers

- One OpenAI-compatible `completion` / `acompletion` / embeddings / image API across **100+** providers (OpenAI, Anthropic, Gemini, Bedrock, Azure, Vertex, Groq, DeepSeek, etc.).
- Normalized exceptions (`RateLimitError`, `APIError`, …).
- Observability callbacks: Langfuse, MLflow, Helicone, OTEL, Prometheus, S3/GCS, etc.

### 1.3 Routing strategies

Documented strategies ([routing docs](https://docs.litellm.ai/docs/routing)):

| Strategy | Behavior | When to use |
|---|---|---|
| `simple-shuffle` (**default, recommended**) | Weighted / RPM-TPM aware random pick | Production default — lowest overhead |
| Latency-based | Prefer historically faster deployments | Interactive chat |
| Least-busy | Prefer lowest in-flight concurrency | Burst protection |
| Rate-limit aware (v1 / async v2) | Skip saturated RPM/TPM | Multi-key Azure/OpenAI pools |
| Lowest-cost (async) | Prefer cheaper deployment | Non-latency-critical batch |
| Custom | User strategy hook | Domain rules |

Reliability primitives: **cooldowns**, **fallbacks** (leave model group), **retries** (stay in group), fixed + exponential backoff, Redis for multi-instance cooldown / TPM tracking.

Architecture note ([life of a request](https://docs.litellm.ai/docs/proxy/architecture)): retries stay inside a model group; fallbacks move to the next group.

### 1.4 Budgets, rate limits, cost tracking (proxy)

OSS proxy already includes (per LiteLLM Enterprise docs contrast):

- Virtual keys, users, teams
- Spend tracking by key / user / team
- Budgets + RPM/TPM rate limits by key / user / team
- Request/response logging
- Fallbacks / load balancing

Enterprise adds (not exhaustive): SSO/SAML (+ SCIM), OIDC/JWT auth, audit logs with retention, org/project admin delegation, secret managers + key rotation, advanced guardrail suites, temporary budget increases, some tag/provider budget routing features, SLA support. Tag-based provider budget routing is marked **Enterprise** in places ([provider budget routing](https://docs.litellm.ai/docs/proxy/provider_budget_routing)).

**Pricing:** OSS self-host **$0**. Enterprise is quote-only; third-party 2026 writeups cite ~**$250/mo** Basic and ~**$30k/yr** Premium — treat as unverified rumor; use vendor “Request pricing”. No token markup: you keep provider contracts.

### 1.5 Caching, guardrails, observability

- **Response caching** (Redis) separate from **provider prompt caching**.
- **Prompt caching:** first-class. Anthropic `cache_control` on content blocks; top-level automatic caching support; `cache_control_injection_points` and `enable_anthropic_prompt_caching` for auto-injection; usage fields include `cache_creation_input_tokens` / `prompt_tokens_details.cached_tokens`; `completion_cost()` accounts for cache pricing ([prompt caching docs](https://docs.litellm.ai/docs/completion/prompt_caching)).
- Guardrails: hooks / partner integrations; fuller suite under Enterprise.
- Pass-through endpoints and Anthropic `/v1/messages` path for higher native fidelity ([pass-through](https://docs.litellm.ai/docs/proxy/pass_through), [structured output /v1/messages](https://docs.litellm.ai/docs/anthropic_unified/structured_output)).

### 1.6 Criticisms (fair summary)

LiteLLM is extremely popular (tens of thousands of GitHub stars, hundreds of millions of Docker pulls) and the fastest way to get multi-provider routing in Python. Production reports and issue archaeology (2025–2026) consistently note:

- **Large, fast-moving codebase** — high open-issue count; regressions between versions; pin and prefer `-stable` images.
- **Long-running proxy stability** — memory growth / degradation after hours; teams recycle workers or set hard memory limits (OOM risk).
- **DB in the request path** — spend/log tables can slow the proxy at high RPS if Postgres is used as the hot log store.
- **Retry footguns** — default retries can amplify spend and rate-limit storms if 4xx are retried carelessly.
- **GIL / Python throughput ceiling** vs Go/Rust gateways at multi-k RPS.
- **Security incident signal:** independent 2026 writeups mention a March 2026 PyPI supply-chain event affecting releases briefly — pin hashes, use private mirrors, prefer stable tags.
- Enterprise open-core: governance features you may eventually want (SSO, audit) are paid.

For **our** expected load (hundreds of athletes nightly + interactive chat, not 100k+ RPS), the SDK Router path is well inside the safe zone; the proxy’s scale horror stories matter only if we centralize all traffic through a long-lived LiteLLM Proxy without ops discipline.

**Sources:** https://docs.litellm.ai/docs/, https://docs.litellm.ai/docs/routing, https://docs.litellm.ai/docs/enterprise, https://docs.litellm.ai/docs/completion/prompt_caching, https://github.com/BerriAI/litellm, https://www.litellm.ai/, https://dev.to/therealmrmumba/when-litellm-becomes-a-bottleneck-exploring-gateway-alternatives-3a4h, https://dev.to/pranay_batta/litellm-has-1000-open-github-issues-heres-what-three-of-them-reveal-3jeo, https://dev.to/ai-gateway-veteran/5-pitfalls-i-hit-running-litellm-proxy-in-production-with-a-1-page-survival-map-4k1h, https://www.truefoundry.com/blog/litellm-pricing-guide

---

## 2. Portkey

### 2.1 Features

Production AI gateway + control plane: universal API, **config-driven** strategies (`fallback`, `loadbalance`, `conditional`), retries, circuit protection, canary, caching (simple + semantic on paid), guardrails, virtual keys, budgets/rate limits, observability (logs, traces, metadata), prompt management, MCP gateway.

Configs are first-class: save a Config ID in the UI / API, pass `config` on each request; targets nest (conditional → loadbalance → fallback).

### 2.2 Self-hosting and pricing (2026)

| Plan | Price | Notes |
|---|---|---|
| Open Source gateway | $0 | `npx @portkey-ai/gateway` / Docker; community features |
| Developer | Free | 10k logs/mo, 3-day log retention — not for production |
| Production | **$49/mo** | 100k logs/mo, +$9 / 100k overage; 30-day logs |
| Enterprise | Custom | VPC / private cloud / airgap, SSO, BAA, HIPAA/GDPR certs, granular budgets |

**Important:** Palo Alto Networks announced acquisition of Portkey (banner on portkey.ai/pricing, 2026). Expect product direction to tilt toward enterprise security platforms; OSS gateway may continue but roadmap risk is real.

Self-host FAQ: full production self-host / data residency guarantees are an **Enterprise** conversation; OSS gateway can run locally but control-plane features lag SaaS.

Anthropic prompt caching: documented with `cache_control` on messages ([Portkey Anthropic caching](https://portkey.ai/docs/integrations/llms/anthropic/prompt-caching)). **Caveat:** on Messages→Chat Completions adapter paths, `cache_control` is **stripped** ([Messages API docs](https://portkey.ai/docs/product/ai-gateway/messages-api)). Use Anthropic-native / passthrough for batch.

**Sources:** https://portkey.ai/pricing, https://portkey.ai/docs/product/ai-gateway, https://portkey.ai/docs/product/ai-gateway/conditional-routing, https://github.com/Portkey-AI/gateway

---

## 3. OpenRouter

### 3.1 What it is good for

- One key → 300+ models / 60+ providers for **prototyping**, model bakeoffs, and non-sensitive workloads.
- Provider routing / fallbacks without running infra.
- Fast catalog coverage when evaluating new models.

### 3.2 Pricing markup (2026)

- **No markup on listed inference token prices** vs underlying providers.
- **5.5% fee on credit purchases** (min **$0.80**); crypto **5%**.
- **BYOK:** first **1M requests/month** free, then **5%** of equivalent OpenRouter model cost (Enterprise raises free tier in some reports).
- Credits may expire after **365 days**.

### 3.3 Privacy / EU health-adjacent

| Fact | Implication |
|---|---|
| US company; default global edge | Prompts can leave the EU |
| ZDR default for prompts/completions (metadata still logged) | Better than naïve logging, not a residency guarantee |
| EU in-region (`eu.openrouter.ai`) | **Enterprise-only** |
| InferCheck (verified 2026-04): even EU routing may touch US gateway infra | Residual cross-border risk |
| Each upstream provider is a sub-processor | Hard GDPR story for health-adjacent athlete data |

**Verdict: not appropriate as the production gateway for EU health-adjacent athlete data.** Optional for internal model evals with synthetic/non-PII prompts only.

**Sources:** https://openrouter.ai/docs/faq, https://openrouter.ai/docs/guides/features/sovereign-ai.mdx, https://openrouter.ai/blog/announcements/simplifying-our-platform-fee/, https://infercheck.eu/en/provider/openrouter, https://vensas.de/en/blog/openrouter-llm-gateway-eu

---

## 4. Other gateways (brief)

### 4.1 Bifrost (Maxim AI)

- **Go**, Apache 2.0, self-host Docker/K8s/binary.
- Vendor claim: **~11 µs** overhead at 5k RPS; “50× faster than LiteLLM” marketing.
- OSS includes: OpenAI-compatible API, fallbacks, virtual keys, hierarchical budgets/rate limits, semantic caching, MCP gateway, OTEL/Prometheus.
- Enterprise (custom): clustering, adaptive LB, SSO/SAML, vault, audit logs, guardrails, airgap.
- Strong choice if you need a **shared multi-language edge** with low overhead.
- For us: optional later; adds a moving part Python does not need on day one. **Confirm Anthropic prompt-cache header/content passthrough in a spike** before trusting nightly batch through it (semantic/response cache ≠ Anthropic KV prompt cache).

**Sources:** https://github.com/maximhq/bifrost, https://docs.getbifrost.ai/overview, https://www.getmaxim.ai/bifrost/pricing

### 4.2 Helicone AI Gateway

- Rust gateway (GitHub `Helicone/ai-gateway`), Docker self-host; cloud gateway at `ai-gateway.helicone.ai`.
- Unified OpenAI SDK format, fallbacks, caching, rate limits, deep Helicone observability.
- Cloud: credits with claimed **0% inference markup** (contrast carefully with OpenRouter’s purchase fee model).
- **Risk:** Helicone joined Mintlify (2025–2026); community reports of **maintenance-mode** posture for parts of the stack. License on the gateway repo listed **GPL-3.0** (check before embedding). Prefer not as primary control plane given roadmap uncertainty.

**Sources:** https://github.com/helicone/ai-gateway/, https://docs.helicone.ai/gateway/overview, https://www.helicone.ai/blog/introducing-ai-gateway

### 4.3 Cloudflare AI Gateway

- Managed edge only — **no self-hosted** option.
- Core features free (analytics, caching, rate limiting); Workers plan for log volume; Unified Billing **5%** credit fee.
- Disqualified for Hetzner-first / EU health-adjacent primary path (US company, edge processing).

**Sources:** https://developers.cloudflare.com/ai-gateway/reference/pricing/

### 4.4 Kong AI Gateway

- AI plugins on Kong Gateway / Konnect: RAG helpers, PII, semantic cache, rate limits, MCP/A2A.
- Best if you **already** run Kong as the org API platform. Otherwise heavy ops and Enterprise licensing for the features you care about.
- Not a fit for a greenfield Python agent stack on Hetzner unless Kong is already planned.

**Sources:** https://www.braintrust.dev/articles/ai-gateway-comparison-2026, https://topreviewed.ai/blog/llm-gateway-comparison-bifrost-litellm-kong-cloudflare-and-vercel-what-youre-actually-choosing

### 4.5 2026 entrants / market notes

- Market split: **performance OSS** (Bifrost, Helicone Rust) vs **Python-native flexibility** (LiteLLM) vs **managed control planes** (Portkey → Palo Alto, Cloudflare, Vercel AI Gateway).
- Requesty and other EU-positioned routers appear in compliance blogs as OpenRouter alternatives; evaluate only if EU-only SaaS becomes a requirement — still a third party for health-adjacent data.

---

## 5. No-gateway option (steelman)

### 5.1 Native SDKs + thin abstraction

Call `anthropic`, `openai`, `google-genai` (etc.) directly behind a ~200–400 LOC interface: `complete(tier, messages, *, cache=..., response_model=..., metadata=...)`.

**Strengths**

- **Zero passthrough risk** for prompt caching, betas, structured outputs, thinking blocks.
- No second process to page, upgrade, or OOM.
- Full control of retry taxonomy and cost events shaped exactly for org/athlete/agent/run.
- Matches “we already have Redis + Traefik + Docker” — fewer new boxes.

**Costs you must still build**

- Provider parameter mapping, streaming adapters, error normalization.
- Failover chains, cooldowns, jittered backoff (exactly what the 120-line router lacked).
- Pricing tables (or scrape LiteLLM’s model cost map without adopting the proxy).
- Observability hooks.

### 5.2 Framework model abstractions

| Framework | Multi-provider | Fallbacks | Gaps vs our needs |
|---|---|---|---|
| **PydanticAI** | Built-in OpenAI, Anthropic, Gemini, Bedrock, Groq, OpenRouter, … | `FallbackModel` sequences on `ModelAPIError` (configurable) | No org budgets/rate limits; cost tracking is your job; OpenRouter provider exists but we should not use it for prod PII |
| **LangChain** chat models | Broad | `with_fallbacks([...])` | Same governance gap; heavier dependency if not already committed |

Steelman conclusion: **framework fallbacks solve provider outages, not billing.** For a product that invoices orgs for LLM spend, you still need an application spend ledger. Combining **PydanticAI models** (if the agent framework bakeoff selects it) **with** LiteLLM Router underneath *or* native SDKs + your ledger is coherent; do not assume the framework replaces cost governance.

**Sources:** https://pydantic.dev/docs/ai/models/overview, https://pydantic.dev/docs/ai/api/models/fallback/

---

## 6. Prompt caching & structured-output fidelity (deep dive)

### 6.1 Disqualifying failure mode

If a gateway rewrites Anthropic Messages into OpenAI Chat Completions and drops:

- content-block `cache_control`
- top-level `cache_control`
- `anthropic-beta` / `anthropic-version` headers
- `output_config` / `output_format` / thinking / tool `strict`

…then nightly batch cache hit rate collapses and structured extraction silently degrades. **That is a ship blocker.**

### 6.2 Findings by stack

| Stack | Prompt cache | Structured output |
|---|---|---|
| Anthropic Python SDK direct | Full fidelity | Full fidelity (`output_config` / parse helpers) |
| LiteLLM SDK with `cache_control` on blocks | Documented supported; verify usage tokens | Prefer Anthropic model + native params or `/v1/messages` |
| LiteLLM Proxy `/v1/messages` | Supported; auto-inject available | `output_format` / schema documented |
| Portkey Anthropic-native | Supported | Native features work |
| Portkey adapter providers | **`cache_control` stripped** | Lossy |
| OpenAI-compat-only gateways | High risk unless explicit Anthropic route | High risk |

### 6.3 Mandatory acceptance test

For any chosen path, CI or smoke job must:

1. Send a ≥min-token system prefix with `cache_control: {type: "ephemeral", ttl: "1h"}` (pin TTL; Anthropic default TTL changes have burned teams).
2. Assert `cache_creation_input_tokens > 0` (or provider equivalent) on first call.
3. Assert cached read tokens > 0 on second call within TTL.
4. Assert cost calculator uses cache-read pricing (see research note 58).

---

## 7. Recommended design for Peak Performance

### 7.1 Gateway or no gateway?

**Recommendation: no separate gateway process in v1.**

Adopt **LiteLLM `Router` as an in-process library** inside the Python agent runtime:

- Replaces the hand-rolled sequential try-list with retries, cooldowns, fallbacks, and model aliases.
- Keeps prompts on Hetzner → provider only (plus your chosen EU-capable providers).
- Avoids LiteLLM Proxy’s Postgres/memory ops tax until multiple non-Python clients need a shared edge.
- Implement **SpendGuard** (Redis + Postgres) for org/athlete/agent/run attribution — dimensions LiteLLM virtual keys alone will not model cleanly.

**Revisit Bifrost or LiteLLM Proxy when:** (a) Next.js and other services need the same key/budget plane, (b) sustained RPS makes in-process routing awkward, or (c) you want Admin UI for non-eng operators — still keep Anthropic batch on a verified cache-safe path.

### 7.2 Routing policy (tiers + failover)

| Tier | Tasks | Primary | Failover chain | Notes |
|---|---|---|---|---|
| **T0 Router/Extract** | Tool routing, JSON extraction, classification, short rewrites | Cheap fast model (e.g. Claude Haiku / Gemini Flash / GPT-4.1-mini — pick via bakeoff) | Same-tier alternate provider → degrade to T1 only if both fail | Strict structured output; short timeouts |
| **T1 Interactive** | Coach/athlete chat turns, single-agent answers | Mid frontier (e.g. Sonnet-class) | Alternate frontier provider (Gemini / OpenAI) | Streaming on; latency-based shuffle among healthy keys |
| **T2 Synthesis** | Nightly digests, multi-agent synthesis, deep investigations | Frontier (Sonnet/Opus-class or Gemini Pro-class) | Second frontier provider | **Prompt cache required**; prefer Batch API where eligible |
| **T3 Embeddings** | RAG / memory | Dedicated embedding model | Same provider second region/key | Separate RPM pool |

Alias map example (logical → deployments):

```yaml
model_groups:
  tier0:
    - anthropic/claude-haiku-4-5
    - gemini/gemini-2.5-flash
  tier1:
    - anthropic/claude-sonnet-4-5
    - openai/gpt-4.1
  tier2:
    - anthropic/claude-sonnet-4-5   # cache-warmed prefix
    - google/gemini-2.5-pro
```

Policy knobs:

- Interactive: `routing_strategy="latency-based"` within tier; fallbacks across providers.
- Nightly batch: sticky primary for **cache locality**; failover only on hard failures; do not shuffle mid-batch across providers (breaks Anthropic cache).
- Never route production athlete prompts through OpenRouter/Cloudflare.

### 7.3 Retry policy

| Error class | Retry? | Action |
|---|---|---|
| 408 / 409 / 429 / 500 / 502 / 503 / 504 | Yes | Exponential backoff + full jitter |
| Provider timeout / connection reset | Yes | Retry same deployment once, then sibling |
| 401 / 403 (auth) | No | Alert; mark key unhealthy; failover key if pool |
| 400 validation / schema | No | Surface to agent; do not failover blindly (wastes $) |
| Context length exceeded | No retry same model | Failover to larger-context sibling or compact context |
| Content policy | No | Record; degrade UX |

**Defaults (starting point):**

- `max_retries` per deployment: **2** (interactive) / **3** (batch)
- Backoff: `base=0.5s`, `cap=8s`, **full jitter**: `sleep = random(0, min(cap, base * 2**attempt))`
- Hard timeout: interactive **60s**; synthesis **180s**; extract **30s**
- Circuit / cooldown: after **N=3** consecutive failures on a deployment, cooldown **30–60s** (LiteLLM Router cooldowns; mirror in SpendGuard for provider keys)
- Cap amplified spend: **do not** retry non-idempotent paid failures more than policy; prefer failover to cheaper healthy tier when primary is 429-storming

### 7.4 Cost tracking design

**Event schema (append-only), store in Postgres; hot counters in Redis:**

```text
llm_usage_events (
  id, ts,
  org_id, athlete_id null, user_id null,
  agent_name, workflow_run_id, task_tier,
  provider, model, deployment_id,
  prompt_tokens, completion_tokens,
  cache_write_tokens, cache_read_tokens,
  cost_usd, latency_ms, status, error_class,
  request_id, trace_id
)
```

**Attribution rules**

| Dimension | Source |
|---|---|
| `org_id` | Auth context (required) |
| `athlete_id` | Tool/agent context when scoped |
| `agent_name` | Specialist / router name |
| `workflow_run_id` | Nightly batch id / chat turn group id |
| `task_tier` | T0–T3 from caller |

**Pipeline:** after each successful/failed call → compute cost (`litellm.completion_cost` or internal price table that understands cache rates) → `XADD`/insert event → Redis `INCRBYFLOAT org:{id}:spend:{yyyymmdd}` etc.

Billing reads Postgres aggregates; real-time caps read Redis.

### 7.5 Budget enforcement

| Cap type | Behavior |
|---|---|
| **Soft org daily/monthly** | Alert (Slack/email); continue; mark `budget_soft_hit` |
| **Hard org monthly** | Block T2/T3; allow T0 extract-only or cached FAQ; return typed `BudgetExceeded` |
| **Hard org daily burn** | Same degradation; protects runaway loops |
| **Per-workflow ceiling** | Stop agent graph; persist partial artifacts |
| **Per-user interactive RPM/$** | 429 to client with Retry-After |

**Graceful degradation order when hard cap hit:**

1. Disable proactive / nightly synthesis for that org.
2. Serve cached last digest if fresh.
3. Allow T0 classification + retrieval-only answers (“I can show your last metrics, but AI synthesis is paused”).
4. Never silently route to a steeper model.

### 7.6 Rate limiting

| Scope | Limit examples (tune) | Store |
|---|---|---|
| Org RPM / TPM | e.g. 60 RPM interactive, higher batch window | Redis token bucket |
| User RPM | e.g. 20 RPM chat | Redis |
| Provider key RPM | Match provider quotas | LiteLLM Router rpm/tpm fields |
| Workflow concurrency | e.g. max 10 in-flight athletes/org | Redis semaphore |

Fail closed on Redis errors for **hard** budget checks; fail open with alert only if you accept spend risk (prefer fail closed for billing).

### 7.7 Interface sketch

```python
from __future__ import annotations

from dataclasses import dataclass
from enum import Enum
from typing import Any, AsyncIterator

from litellm import Router
from litellm.utils import completion_cost


class Tier(str, Enum):
    ROUTER = "tier0"
    INTERACTIVE = "tier1"
    SYNTHESIS = "tier2"
    EMBED = "tier3"


@dataclass(frozen=True)
class LlmContext:
    org_id: str
    agent_name: str
    workflow_run_id: str
    athlete_id: str | None = None
    user_id: str | None = None


@dataclass
class LlmResult:
    content: str | list[dict[str, Any]]
    model: str
    provider: str
    cost_usd: float
    cache_read_tokens: int
    cache_write_tokens: int
    raw: Any


class BudgetExceeded(Exception):
    def __init__(self, org_id: str, soft: bool):
        self.org_id = org_id
        self.soft = soft


class SpendGuard:
    """Redis budgets/rate limits + Postgres usage ledger."""

    async def authorize(self, ctx: LlmContext, tier: Tier, est_cost: float) -> None: ...
    async def record(self, ctx: LlmContext, tier: Tier, result: LlmResult, status: str) -> None: ...


class LlmGateway:
    """In-process gateway: LiteLLM Router + domain SpendGuard."""

    def __init__(self, router: Router, spend: SpendGuard):
        self.router = router
        self.spend = spend

    async def complete(
        self,
        *,
        tier: Tier,
        ctx: LlmContext,
        messages: list[dict[str, Any]],
        stream: bool = False,
        cache_control: dict[str, Any] | None = None,
        response_format: dict[str, Any] | None = None,
        timeout: float | None = None,
    ) -> LlmResult | AsyncIterator[Any]:
        await self.spend.authorize(ctx, tier, est_cost=0.0)
        kwargs: dict[str, Any] = {
            "model": tier.value,  # model_name alias in Router
            "messages": messages,
            "timeout": timeout,
            "metadata": {
                "org_id": ctx.org_id,
                "athlete_id": ctx.athlete_id,
                "agent": ctx.agent_name,
                "workflow_run_id": ctx.workflow_run_id,
                "tier": tier.value,
            },
        }
        # Preserve Anthropic prompt caching — do not strip content-block cache_control
        if cache_control is not None:
            kwargs["cache_control"] = cache_control
        if response_format is not None:
            kwargs["response_format"] = response_format

        try:
            if stream:
                return self._stream(ctx, tier, kwargs)
            resp = await self.router.acompletion(**kwargs)
            result = self._to_result(resp)
            await self.spend.record(ctx, tier, result, status="ok")
            return result
        except BudgetExceeded:
            raise
        except Exception as exc:
            await self.spend.record(
                ctx, tier,
                LlmResult("", "", "", 0.0, 0, 0, None),
                status=type(exc).__name__,
            )
            raise

    def _to_result(self, resp: Any) -> LlmResult:
        usage = getattr(resp, "usage", None)
        cache_read = int(getattr(getattr(usage, "prompt_tokens_details", None), "cached_tokens", 0) or 0)
        cache_write = int(getattr(usage, "cache_creation_input_tokens", 0) or 0)
        cost = float(completion_cost(completion_response=resp) or 0.0)
        return LlmResult(
            content=resp.choices[0].message.content,
            model=resp.model,
            provider=getattr(resp, "provider", "") or "",
            cost_usd=cost,
            cache_read_tokens=cache_read,
            cache_write_tokens=cache_write,
            raw=resp,
        )


# Router construction (sketch)
def build_router() -> Router:
    return Router(
        model_list=[
            {"model_name": "tier0", "litellm_params": {"model": "anthropic/claude-haiku-4-5", "rpm": 200}},
            {"model_name": "tier0", "litellm_params": {"model": "gemini/gemini-2.5-flash", "rpm": 200}},
            {"model_name": "tier1", "litellm_params": {"model": "anthropic/claude-sonnet-4-5", "rpm": 60}},
            {"model_name": "tier1", "litellm_params": {"model": "openai/gpt-4.1", "rpm": 60}},
            {"model_name": "tier2", "litellm_params": {"model": "anthropic/claude-sonnet-4-5", "rpm": 40}},
            {"model_name": "tier2", "litellm_params": {"model": "gemini/gemini-2.5-pro", "rpm": 40}},
        ],
        routing_strategy="simple-shuffle",
        num_retries=2,
        timeout=60,
        fallbacks=[
            {"tier0": ["tier1"]},  # only if tier0 group exhausted
        ],
        set_verbose=False,
    )
```

Nightly batch caller **must** put stable prefix content blocks with `cache_control` in `messages` (and assert cache tokens). Sticky `tier2` → Anthropic primary for the batch window.

### 7.8 Docker / ops note (if proxy added later)

If introducing LiteLLM Proxy beside Traefik:

- Image: `ghcr.io/berriai/litellm:…-stable`
- Redis (existing) for RPM/TPM + cooldowns
- Postgres for virtual keys/spend — **offload raw logs** to object storage / ClickHouse so the proxy DB stays small
- Memory limit + rolling restart
- Pin version; block unattended `:main` pulls
- Keep provider API keys in the agent host or proxy — never in OpenRouter

---

## 8. Decision summary

| Choice | Decision |
|---|---|
| Primary integration | **LiteLLM SDK Router in-process** |
| Separate HTTP gateway | **Not in v1** |
| OpenRouter / Cloudflare | **No** for production athlete data |
| Portkey | Defer; acquisition + SaaS residency concerns |
| Bifrost | Revisit for multi-service edge / extreme perf |
| Cost & budgets | **Own SpendGuard** (Redis + Postgres) |
| Prompt caching | Explicit Anthropic `cache_control` + CI verification |
| Framework | Optional PydanticAI/`FallbackModel` *above* this gateway, not instead of spend controls |

---

## 9. Source index

| Topic | URL |
|---|---|
| LiteLLM docs | https://docs.litellm.ai/docs/ |
| LiteLLM routing | https://docs.litellm.ai/docs/routing |
| LiteLLM prompt caching | https://docs.litellm.ai/docs/completion/prompt_caching |
| LiteLLM Enterprise | https://docs.litellm.ai/docs/enterprise |
| LiteLLM architecture | https://docs.litellm.ai/docs/proxy/architecture |
| LiteLLM pass-through | https://docs.litellm.ai/docs/proxy/pass_through |
| LiteLLM GitHub | https://github.com/BerriAI/litellm |
| Portkey pricing | https://portkey.ai/pricing |
| Portkey gateway | https://portkey.ai/docs/product/ai-gateway |
| Portkey conditional routing | https://portkey.ai/docs/product/ai-gateway/conditional-routing |
| Portkey Anthropic caching | https://portkey.ai/docs/integrations/llms/anthropic/prompt-caching |
| OpenRouter FAQ | https://openrouter.ai/docs/faq |
| OpenRouter sovereign AI | https://openrouter.ai/docs/guides/features/sovereign-ai.mdx |
| OpenRouter fee change | https://openrouter.ai/blog/announcements/simplifying-our-platform-fee/ |
| InferCheck OpenRouter GDPR | https://infercheck.eu/en/provider/openrouter |
| Bifrost | https://docs.getbifrost.ai/overview |
| Bifrost pricing | https://www.getmaxim.ai/bifrost/pricing |
| Helicone gateway | https://docs.helicone.ai/gateway/overview |
| Cloudflare AI GW pricing | https://developers.cloudflare.com/ai-gateway/reference/pricing/ |
| PydanticAI models | https://pydantic.dev/docs/ai/models/overview |
| PydanticAI FallbackModel | https://pydantic.dev/docs/ai/api/models/fallback/ |
| Braintrust 2026 comparison | https://www.braintrust.dev/articles/ai-gateway-comparison-2026 |
| Zylos 2026 gateway research | https://zylos.ai/research/2026-03-29-llm-gateway-api-management-multi-model-platforms |

---

*End of dossier 69.*
