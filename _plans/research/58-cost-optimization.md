# 58 — Cost Optimization for Production LLM Agent Systems

**Research date:** 2026-08-02  
**Scope:** External research only (provider docs, benchmarks, production case studies).  
**Audience:** Multi-agent sports-performance platform — nightly batch (~500 athletes + org digests), interactive coach/athlete chat, event-triggered insights, occasional deep multi-agent investigations. Moving from DeepSeek/Groq toward frontier providers (quality + EU compliance).

---

## Executive verdict

The single biggest lever for this workload is **prompt caching of a stable system/tool/schema prefix across the nightly 500-athlete batch**, stacked with a **Batch API (flat 50% off)**. On Anthropic, those multipliers literally multiply: list input × 0.5 batch × 0.1 cache read ≈ **95% off** on the shared prefix. Production teams that structure prefixes correctly routinely see **60–80% cache hit rates** (and 90%+ on well-ordered batch bursts); a single prefix-ordering bug can collapse hits to ~7%.

At ~500 athletes, **self-hosting is not economic**. Distillation of narrow routers/extractors is optional and likely not worth it until token volume is far higher. Semantic response caching is mostly unsafe for athlete-specific answers unless keys include athlete-state fingerprints and aggressive invalidation.

**Recommended (Balanced) monthly LLM spend: ~$340–$480** for 500 athletes → **~$0.70–$0.95 / athlete / month**, assuming the token volumes in §9.

---

## 1. Prompt caching (mid-2026)

Prompt caching stores KV state for a **byte-exact prompt prefix**. It discounts **input** tokens only; output is unchanged. Prefix must be stable — timestamps, athlete IDs, or tool reordering before the breakpoint silently kill hits.

### 1.1 Anthropic (Claude)

| Property | Detail |
|---|---|
| Trigger | Explicit `cache_control: { type: "ephemeral", ttl?: "5m" \| "1h" }` on content blocks |
| Min prefix | Model-dependent: often **1,024** (Sonnet/Opus family), **4,096** (Haiku 4.5 / some Opus 4.x), **512** on newest Fable/Mythos — below threshold → silent no-cache |
| TTL | Default **5 minutes** from last access (refreshes on hit). Optional **1 hour** |
| Write cost | 5m: **1.25×** base input; 1h: **2×** base input |
| Read cost | **0.1×** base input (90% off) |
| Max breakpoints | 4 per request |
| Rate limits | Cache reads often **do not** count against ITPM on current Claude API plans |
| Stacks with Batch | **Yes** — multipliers multiply (documented) |

**2026 ops note:** On 2026-03-06 Anthropic changed omitted-`ttl` default from 1h → 5m. Overnight / spaced jobs that assumed 1h saw hit rates collapse. **Always pin `ttl` explicitly.** For nightly batches that finish in a burst, 5m is fine if requests are dense; Anthropic’s batch guidance prefers **1h TTL** so concurrent batch items share one entry (cannot pre-warm with `max_tokens: 0` inside a batch).

**Sources:** [Anthropic pricing](https://www.anthropic.com/pricing), [Ginger Labs caching guide](https://gingerlabs.ai/blog/anthropic-prompt-caching), [Particula TTL postmortem](https://particula.tech/blog/anthropic-prompt-cache-ttl-5-minute-regression-debugging), [Hivebook 2026 caching wiki](https://www.hivebook.wiki/wiki/anthropic-prompt-caching-breakpoints-ttls-invalidation-rules-and-workspace-isolation-2026), [Respan May 2026](https://www.respan.ai/articles/claude-prompt-caching).

### 1.2 Google Gemini (implicit + explicit)

| Property | Implicit | Explicit |
|---|---|---|
| Trigger | Automatic on Gemini 2.5+ (common prefixes) | Create `CachedContent`, reference by name |
| Min tokens | ~**2,048** (Gemini 2.x); ~**4,096–6,144** (Gemini 3 family — model-specific) | Same minima |
| TTL | Opportunistic; deleted within 24h; **no guarantee** | Default **1 hour**; settable (min ~1 minute, no hard max) |
| Write | Standard input (no extra write premium) | Standard input on create |
| Read | **~90% off** when hit occurs | **Guaranteed 90% off** (2.5+); 75% on older 2.0 |
| Storage | None | **~$1.00 / MTok / hour** (Flash); **~$4.50 / MTok / hour** (Pro) |
| Guarantee | Best-effort | Guaranteed discount while cache exists |

For production cost predictability on batch, **use explicit caching**. Implicit is free money when it hits; do not budget around it.

**Sources:** [Gemini caching docs](https://ai.google.dev/gemini-api/docs/generate-content/caching), [Vertex AI caching blog](https://cloud.google.com/blog/products/ai-machine-learning/vertex-ai-context-caching), [Cloud context-cache overview](https://docs.cloud.google.com/gemini-enterprise-agent-platform/models/context-cache/context-cache-overview), [AI Free API 2026 guide](https://www.aifreeapi.com/en/posts/gemini-api-context-caching-reduce-cost).

### 1.3 OpenAI

| Property | Pre–GPT-5.6 | GPT-5.6+ |
|---|---|---|
| Trigger | Automatic prefix caching | Implicit **or** explicit breakpoints via `prompt_cache_options` / `prompt_cache_breakpoint` |
| Min prefix | **1,024** tokens (increments of 128 thereafter) | Same |
| TTL / retention | In-memory ~5–10 min idle (up to ~1h light load); optional extended up to ~24h on supported models | `ttl: "30m"` minimum lifetime (only supported value); may retain longer |
| Write | **Free** | **1.25×** uncached input (`cache_write_tokens`) |
| Read discount | Model-dependent: ~50% (gpt-4o) → **75–90%** (GPT-4.1 / GPT-5.x); audio up to ~98.75% | Typically **~90%** on current 5.x |
| Routing tip | `prompt_cache_key` helps pin related traffic to same machine at >~15 RPM | Same |
| Batch + cache | Partial — GPT-5+ only inside Batch; **Flex** (`service_tier=flex`) = 50% + full caching | Prefer Flex when you need both |

**Sources:** [OpenAI prompt caching](https://developers.openai.com/api/docs/guides/prompt-caching), [Prompt Caching 201 cookbook](https://developers.openai.com/cookbook/examples/prompt_caching_201), [Flexera 2026 breakdown](https://www.flexera.com/blog/ai/prompt-caching-breakdown/), [Bedrock GPT-5.6 explicit caching](https://aws.amazon.com/blogs/machine-learning/introducing-explicit-prompt-caching-for-openai-gpt-5-6-models-on-amazon-bedrock/).

### 1.4 Others (brief)

| Provider | Pattern |
|---|---|
| DeepSeek | Automatic prefix caching, steep discounts historically — less relevant given EU/quality move |
| Bedrock (Claude / GPT) | Mirrors provider semantics with AWS billing; GPT-5.6 explicit caching GA with 30m reuse, 90% read / 1.25× write |
| Azure OpenAI | Prompt caching available on supported deployments; confirm region for EU residency |

### 1.5 Practical cache-hit rates

| Scenario | Hit rate | Source |
|---|---|---|
| Broken prefix (dynamic ID mid-prompt) | **~7%** | ProjectDiscovery / DigitalOcean case |
| Same workload after moving dynamic fields to tail | **74%** (bill −59%) | Same |
| Controlled reorder benchmark | **0% → 99.3%** | DigitalOcean lab |
| Healthy production cluster (Vellum, Helicone reports) | **50–80%** | Digital Applied 2026 survey |
| Well-structured batch burst (identical prefix) | **90–99%** of cacheable tokens after first write | Expected for our nightly job |

**Rule of thumb:** On a stable-prompt workload, hit rate **<60% is a bug** (usually dynamic leakage). Anthropic 5m write breaks even at ~1.4 reads; 1h write needs more reuse — fine for 500 reads/night.

**Sources:** [DigitalOcean hit-rate case](https://www.digitalocean.com/community/tutorials/prompt-caching-in-practice-hit-rate), [Digital Applied 2026](https://www.digitalapplied.com/blog/prompt-caching-2026-cut-llm-costs-engineering-guide), [72Technologies production notes](https://www.72technologies.com/blog/prompt-caching-in-production-what-saves-money).

### 1.6 Implication for the 500-athlete nightly job

Structure every insight request as:

1. **Stable prefix (cache):** system instructions, tool schemas, insight JSON schema, domain rubrics, safety rules (≥2–4k tokens).
2. **Dynamic suffix (never cached):** athlete_id, date, metrics blob, recent sessions.

Submit as **one Message Batch** with **1h `cache_control` TTL**. Expected: 1 write + ~499 reads per night on the prefix → prefix cost collapses to near cache-read rates.

---

## 2. Batch APIs

All three frontier providers offer **50% off input and output** for async jobs with a **24h completion window**.

| Provider | Discount | Typical turnaround | Hard SLA | Limits | Caching stack |
|---|---|---|---|---|---|
| **OpenAI Batch** | 50% in+out | Often 2–6h | 24h (then expire) | 50k req / 200MB; 2k batches/hr; separate RPM/TPM pool | GPT-5+ only; else use **Flex** |
| **Anthropic Message Batches** | 50% in+out | **Usually <1h** | 24h; expired unbilled | 100k req or 256MB; results 29 days | **Full stack** (× multipliers) |
| **Gemini Batch** | 50% in+out | Majority ≪24h | 24h target | Up to ~2GB via Files/GCS; inline <20MB | Explicit caching yes (published rates); implicit undocumented |

**Operational tradeoffs**

| Pro | Con |
|---|---|
| Flat 50% with no quality change | Must tolerate up to 24h |
| Separate rate-limit pool (won’t starve chat) | Need idempotent `custom_id` + resubmit on expiry |
| Perfect for nightly insights + digests + evals | Not for interactive chat |
| Stacks with caching (esp. Anthropic) | Multi-turn tool agents inside batch are awkward — prefer single-shot structured synthesis |

**Nightly job verdict:** This is a **textbook batch candidate**. Target: insights + org digests + offline critique sampling via Batch; keep chat and “coach is waiting” paths on sync + cache + routing.

**Sources:** [OpenAI Batch](https://developers.openai.com/api/docs/guides/batch), [LeanLM batch+cache stacking (Jun 2026)](https://leanlm.ai/blog/llm-batch-api), [APIScout comparison](https://apiscout.dev/guides/openai-vs-anthropic-vs-gemini-batch-api-2026), [TechEarl limits matrix](https://techearl.com/llm-batch-api).

---

## 3. Model routing and cascades

### 3.1 RouteLLM (LMSYS) and successors

- **RouteLLM** ([github.com/lm-sys/RouteLLM](https://github.com/lm-sys/RouteLLM), [LMSYS blog](https://www.lmsys.org/blog/2024-07-01-routellm/), ICLR 2025 paper): preference-trained routers (matrix factorization recommended). Published: **up to ~85% cheaper** vs always-GPT-4 on MT-Bench while holding **~95% quality**; MMLU ~45%; GSM8K ~35%. Matrix-factorization path: ~95% quality at ~26% strong-model calls.
- **2026 commercial / gateway successors:** NotDiamond, Martian (learned routers, ~100–200ms decision latency); LiteLLM / OpenRouter / Helicone static+rules routing; vLLM Semantic Router / OctoRouter for self-host stacks.
- Honest 2026 take ([dreaming.press comparison](https://dreaming.press/posts/2026-06-21-routellm-vs-notdiamond-vs-martian.html), [Klymentiev guide](https://klymentiev.com/blog/llm-router)): headline 85% only if (a) large price gap and (b) large routable share. Measure on **your** prompts. Static rules + caching often capture **70–80%** of available savings before learned routing.

### 3.2 Provider-native / gateway routing

| Mechanism | Use |
|---|---|
| LiteLLM model lists + aliases | `haiku` default, escalate to `sonnet`/`opus` |
| OpenRouter / Portkey fallbacks | Provider failover + cost tiers |
| OpenAI Flex vs standard | Latency/cost tier, not quality cascade |
| Gemini Flash → Pro | Cheap default, escalate on confidence/flags |

### 3.3 Cascade pattern for this product

```
intent / risk classify (Haiku or Flash-Lite)
  → easy FAQ / nav / memory extract → cheap model
  → insight synthesis / nuanced coaching → mid model (Sonnet / Flash)
  → medical-adjacent, conflict, or critique fail → Opus / Pro
```

Expected savings vs always-Sonnet on chat: **40–70%** if ≥70% of turns are routable (typical for sports Q&A + “what does this metric mean?”).

---

## 4. Semantic response caching

### 4.1 Landscape (2026)

| Tool | Status | Notes |
|---|---|---|
| **GPTCache** (Zilliz) | Effectively unmaintained (last real momentum 2024) | Still works; not a greenfield default |
| **RedisVL SemanticCache** / LangCache | Production-pragmatic | Best if Redis already in stack |
| **omnicache-ai** | Active GPTCache successor | Adaptive thresholds, multi-tenant namespaces |
| **Upstash Semantic Cache** | Managed | Serverless; higher lookup latency |
| **Gateway caches** (Bifrost, Portkey, Helicone exact/semantic) | Low effort | Quality bounded by gateway embedder |
| **BetterDB / Valkey-native** | Emerging | Sub-ms local hits in benchmarks |

**Sources:** [omnicache-ai](https://github.com/ashishpatel26/omnicache-ai), [dreaming.press GPTCache vs Redis](https://dreaming.press/posts/gptcache-vs-redis-vs-gateway-semantic-caching.html), [Maxim 2026 roundup](https://www.getmaxim.ai/articles/top-semantic-caching-solutions-for-ai-applications-in-2026/).

### 4.2 Honesty for athlete-specific answers

Semantic caches reuse answers for “similar” questions. That is **dangerous** when answers depend on HRV, sleep, injury status, or today’s training load.

**Safe only if cache key includes:**

- `org_id`, `athlete_id`
- **State fingerprint**: hash of the metric snapshot / as-of timestamp used to generate the answer (e.g. `sha256(athlete_id + as_of_date + metrics_version)`)
- Locale, role (coach vs athlete), and model/prompt version
- Similarity threshold **high** (≥0.95) **and** exact state match — or skip semantic match entirely and use **exact** keys

**Invalidation problem**

| Event | Action |
|---|---|
| New wearable sync / match upload | Invalidate that athlete’s keys (or bump `metrics_version`) |
| Nightly insight regenerated | Replace insight cache; purge chat answers that cited prior insight |
| Prompt / model version bump | Global namespace bump (`prompt_v`) |
| Coach overrides / notes | Invalidate athlete + org digest keys |

**Recommendation:** Do **not** semantic-cache personalized insights or coaching advice. Do exact-cache: (a) FAQ / product help, (b) research-corpus RAG snippets, (c) identical tool results for identical queries within a short TTL. Prefer **provider prompt caching** over response caching for the batch.

---

## 5. Context compression and pruning

| Technique | Claimed compression | Measured production reality |
|---|---|---|
| **LLMLingua / LongLLMLingua** | Up to ~20×; LongLLMLingua +21% RAG quality at ¼ tokens | Strong on paper; compressor latency can erase gains |
| **LLMLingua-2** | Task-agnostic, 3–6× faster than v1 | Best practical compressor for predictable rates |
| **2026 “in the wild” study** (~30k queries) | — | End-to-end latency **≤18%** improvement in a narrow window; GPU mem **≤75%** cut; quality OK on summarization/QA, fragile on code/few-shot |
| **Selective Context** | Lightweight | Largely unmaintained since 2024 |
| **Manual pruning** (drop stale turns, tool-result caps, structured athlete cards) | 30–60% context | Highest ROI for agents — no extra model |

**For us:** Prefer **deterministic context engineering** (compact athlete state cards, max-N sessions, tool-result truncation, memory summaries) over neural compression. Consider LLMLingua-2 only if RAG/research contexts regularly exceed ~5–8k tokens and profiling shows net $ savings after compressor cost.

**Sources:** [Microsoft LLMLingua](https://github.com/microsoft/LLMLingua), [MSR project](https://www.microsoft.com/en-us/research/project/llmlingua/), [arXiv 2604.02985](https://arxiv.org/pdf/2604.02985), [dreaming.press compression comparison](https://dreaming.press/posts/2026-06-22-prompt-compression-llmlingua-vs-selective-context.html).

---

## 6. Small-model distillation

Teacher (frontier) → synthetic labels → student (Haiku-class / 7–14B / Nova Micro).

| Finding | Number |
|---|---|
| Bedrock Nova Premier → Micro intent routing | **>95% cost cut**, ~50% latency cut, judge score ≈ Haiku |
| Structural ROI threshold (SFAI / industry 2026) | Often **≥50M tokens/month** on the narrow task; clearer at **100–500M+** |
| Below ~100M tokens/month | Caching + routing usually beat distillation on ROI |

**At our scale (order ~50–150M tokens/month across all tasks, much of it already cache/batch discounted):** distill only **narrow, stable** heads — intent routing, memory extraction, PII/safety triage — and only after static routing is live. Do **not** distill full insight synthesis yet (distribution shifts with sports seasons, locales, new metrics).

**Sources:** [AWS Nova distillation case](https://aws.amazon.com/blogs/machine-learning/optimize-video-semantic-search-intent-with-amazon-nova-model-distillation-on-amazon-bedrock/), [SFAI Labs distillation case](https://sfailabs.com/guides/the-ai-project-distillation-case-when-a-smaller-fine-tune-beats-a-bigger-model), [aitechconnect 2026 playbook](https://aitechconnect.in/tips/llm-distillation-teacher-student-production-2026).

---

## 7. Structured vs verbose output

| Approach | Effect |
|---|---|
| Free-form prose | Pads explanations; high output tokens |
| JSON mode / `json_schema` structured outputs | **~30–50% fewer output tokens** on extraction/classification vs prose; **~20–35% bill** cut when output-heavy |
| Schema overhead | +30–300 tokens for schema enforcement — usually dominated by savings + eliminated retries |
| Retry-on-parse-failure | Often costs more than schema overhead |

**For us:** Nightly insights, digests, memory extracts, and tool args should be **strict structured**. Render athlete-facing prose in the app (or a cheap second pass) only when UX needs narrative. Output tokens are 4–5× input on Claude — this is a first-class lever.

**Sources:** [Prism / Ssimplifi structured-outputs cost tradeoff](https://ssimplifi.com/blog/structured-outputs-cost-tradeoff), [Cloudchipr token-cost benchmarks](https://cloudchipr.com/blog/llm-token-costs-benchmarked), [TokenMix structured-output guide 2026](https://tokenmix.ai/blog/structured-output-json-guide).

---

## 8. Open-weight self-hosting economics

### 8.1 Rough GPU math (mid-2026)

| Item | Typical |
|---|---|
| H100 80GB on-demand | ~$2.50–$5.50/hr |
| A100 80GB reserved | ~$1.70–$3.20/hr |
| L40S / smaller for 7–13B | ~$1.10/hr |
| Ops labor minimum | **10–20 hrs/month** ($750–$3k) or fraction of FTE |
| Utilization reality | Bursty sports workloads often **≪50%** → effective $/token spikes |

Break-even vs mid-tier APIs commonly cited at **~50–250M tokens/month** vs premium APIs, and **often never** vs budget APIs (Haiku / Flash-Lite), once ops is included. vs Claude Sonnet-class: analyses put break-even around **~2–5M tokens/day** sustained with acceptable open 70B quality — still far above our steady load if chat is bursty and nightly is short.

### 8.2 Our volume check

Balanced-tier token throughput (order-of-magnitude):

- Insights: 15k × ~7.3k tokens ≈ **110M tokens/month** (mostly input; much cacheable)
- Chat + misc: ~**40–80M**
- **Billable after cache/batch** ≪ raw tokens

A single always-on H100 at $3/hr = **~$2,190/month** before redundancy and labor — already **>4×** the Balanced API bill below, for a model that likely underperforms Sonnet/Opus on coaching nuance and complicates EU ops.

**Verdict:** At 500 athletes, **do not self-host** for synthesis. Revisit only if (a) EU residency forces it, (b) sustained >~200M **uncached equivalent** tokens/month, and (c) open weights pass quality evals.

**Sources:** [AICost.ai break-even tool](https://aicost.ai/tools/self-host-breakeven), [renezander 2026 guide](https://renezander.com/guides/self-hosted-llm-vs-api/), [voaige tokenomics](https://voaige.com/blog/the-tokenomics-of-open-source-llms-when-apis-beat-self-hosting-your-model-and-when-they-do-not), [akshayghalme break-even math](https://akshayghalme.com/blogs/self-hosting-llms-break-even-math/).

---

## 9. Cost attribution and controls

### 9.1 Attribution model

Propagate on every LLM call (gateway metadata / LiteLLM `user` + `metadata`):

```
org_id, athlete_id (nullable), user_id, role,
feature (nightly_insight|org_digest|chat|event_insight|deep_investigate),
model, prompt_version, request_id, session_id
```

Roll up:

- **Per organization** (B2B showback / invoice line)
- **Per athlete** (B2C unit economics, abuse detection)
- **Per feature** (which product surface burns cash)

**Stack:** LiteLLM proxy (budgets, routing, spend tables) + Langfuse/Helicone (traces). Metadata must be set **server-side** — never trust client-supplied `user` alone.

### 9.2 Caps, rate limits, graceful degradation

| Control | Behavior |
|---|---|
| Soft budget (e.g. 80%) | Alert Slack; downgrade new chat to Haiku/Flash |
| Hard daily org budget | Block **optional** features (deep investigate, long RAG); still allow nightly batch under platform budget |
| Per-athlete chat RPM/TPM | Anti-runaway; return 429 with UX copy “AI quota for today” |
| Circuit breaker | On provider 5xx/429: fail over provider → degrade model → cached last insight → static template |
| Session caps | `max_budget_per_session` / max agent iterations for multi-agent deep dives |
| Feature flags | Kill switch per `feature` without taking down auth/app |

Prefer **degrade** over hard error: serve yesterday’s insight, cheaper model, or “coach digest delayed” rather than 500 stack traces.

**Sources:** [LiteLLM multi-tenant](https://docs.litellm.ai/docs/proxy/multi_tenant_architecture), [LiteLLM spend tracking](https://docs.litellm.ai/docs/proxy/cost_tracking), [Particula per-tenant attribution](https://particula.tech/blog/per-tenant-llm-cost-attribution-multi-tenant-saas), [runcycles cost-control 2026](https://runcycles.io/blog/ai-agent-cost-control-2026-litellm-helicone-openrouter-runtime-authority).

---

## 10. Pricing tables used (as of 2026-08-02)

Steady-state rates for planning. **Sonnet 5 intro $2/$10 runs through 2026-08-31; from 2026-09-01 use $3/$15.** Model below uses **post-intro Sonnet** so budgets don’t surprise in September.

### Anthropic Claude (API)

| Model | Input | Output | Cache read | Cache write 5m | Cache write 1h | Batch in | Batch out |
|---|---:|---:|---:|---:|---:|---:|---:|
| Haiku 4.5 | $1 | $5 | $0.10 | $1.25 | $2 | $0.50 | $2.50 |
| Sonnet 5 (intro → Aug 31) | $2 | $10 | $0.20 | $2.50 | $4 | $1.00 | $5.00 |
| Sonnet 5 (from Sep 1) | $3 | $15 | $0.30 | $3.75 | $6 | $1.50 | $7.50 |
| Opus 5 | $5 | $25 | $0.50 | $6.25 | $10 | $2.50 | $12.50 |
| Fable 5 | $10 | $50 | $1.00 | $12.50 | $20 | $5.00 | $25.00 |

Anthropic batch × cache read example (Sonnet 5 steady): `$3 × 0.5 × 0.1 = $0.15 / MTok`.

### Google Gemini (representative)

| Model | Input | Output | Cache read | Storage | Batch in | Batch out |
|---|---:|---:|---:|---:|---:|---:|
| 2.5 Flash-Lite | $0.10 | $0.40 | ~$0.01 | ~$1/MTok/hr | $0.05 | $0.20 |
| 2.5 Flash | $0.30 | $2.50 | $0.03 | ~$1/MTok/hr | $0.15 | $1.25 |
| 2.5 Pro (≤200k) | $1.25 | $10 | $0.125 | ~$4.50/MTok/hr | $0.625 | $5.00 |
| 3.1 Pro (≤200k) | $2.00 | $12 | ~$0.20 | ~$4.50/MTok/hr | $1.00 | $6.00 |

### OpenAI (indicative GPT-5.x, Jul/Aug 2026 aggregators)

| Tier | Input | Output | Cached in (typ.) |
|---|---:|---:|---:|
| Luna-class | ~$0.20 | ~$1.20 | ~90% off |
| Terra-class | ~$2 | ~$12 | ~90% off |
| Sol-class | ~$5 | ~$30 | ~90% off; writes 1.25× on 5.6+ |

**Sources:** [BenchLM Claude Aug 2026](https://benchlm.ai/anthropic/api-pricing), [SSD Nodes Claude Aug 2026](https://www.ssdnodes.com/learn/how-much-is-1m-tokens-claude), [Coursiv Claude 2026](https://coursiv.io/blog/claude-pricing-2026), [MetaCTO Gemini May 2026](https://www.metacto.com/blogs/the-true-cost-of-google-gemini-a-guide-to-api-pricing-and-integration), [flatkey Gemini 2026](https://flatkey.ai/blog/gemini-api-pricing).

---

## 11. Workload assumptions (shared across tiers)

| Parameter | Value | Notes |
|---|---|---|
| Athletes | **500** | |
| Nights / month | **30** | |
| Nightly insights | 500 × 30 = **15,000** | |
| Orgs | **15** | → 15 digests/night = **450**/month |
| Event-triggered insights | **1,500**/month | ~50/day |
| Chat completions | **18,000**/month | ~athletes 8 msgs × 3 turns + coaches |
| Deep investigations | **20**/month × multi-call | |
| Insight tokens | prefix **4,000** + state **2,500** + out **800** | Structured JSON |
| Digest tokens | prefix **5,000** + roster **10,000** + out **1,500** | |
| Chat turn tokens | prefix **3,000** + dyn **1,000** + out **400** | |
| Chat cache hit on prefix | **75%** | Sync traffic |
| Batch prefix | 1 write + (N−1) reads / night | |
| Contingency | **+40%** on Balanced/Premium, **+50%** Economy | Tool loops, retries, locale, thinking tokens |

EU compliance: prefer **Anthropic** or **Google EU regions**; Economy may use Gemini for $ but keep a Claude path for regulated orgs.

---

## 12. Three-tier cost model

### 12.1 Economy — cheapest viable

**Quality tradeoffs (explicit):** Weaker coaching nuance and multilingual quality vs Sonnet/Opus; no systematic critique; higher factual miss rate on edge physiology; Flash “thinking” tokens can surprise if left on — disable for extraction.

| Task | Model |
|---|---|
| Routing / intent | Gemini 2.5 Flash-Lite |
| Extraction / memory | Flash-Lite (structured) |
| Nightly synthesis + digests | Gemini 2.5 Flash **Batch + explicit cache** |
| Event insights | Flash sync + cache |
| Chat | Flash-Lite (90%) → Flash (10%) |
| Critique | None (schema validation + rules only) |
| Deep investigate | Flash, capped 4 calls; else defer |

#### Arithmetic — Economy

**A. Nightly insights (Flash batch + cache)**  
Per night:  
- Cache write: \(4000/10^6 × \$0.15 = \$0.0006\)  
- Cache reads: \(499 × 4000/10^6 × \$0.015 = \$0.0299\)  
- Dynamic in: \(500 × 2500/10^6 × \$0.15 = \$0.1875\)  
- Output: \(500 × 800/10^6 × \$1.25 = \$0.50\)  
- Storage ≈ \(4000/10^6 × \$1 × 2h ≈ \$0.008\)  
**Night ≈ $0.73 → ×30 = $21.90/mo**

**B. Org digests:** scale ≈ 15/500 of insight dynamic+output with larger roster → **≈ $2.20/mo**

**C. Events (Flash sync, 80% cache hit on 4k):**  
Per: \(0.8×4k×\$0.03 + 0.2×4k×\$0.30 + 2.5k×\$0.30 + 0.8k×\$2.50\) / 1e6  
\(= \$0.000096 + \$0.00024 + \$0.00075 + \$0.002 = \$0.00309\)  
**×1,500 = $4.63**

**D. Chat:**  
Flash-Lite 16,200 × \(0.75×3k×\$0.01 + 0.25×3k×\$0.10 + 1k×\$0.10 + 0.4k×\$0.40\) / 1e6  
\(= 16200 × \$0.0003575 = \$5.79\)  
Flash 1,800 × ≈ \$0.0014 = **$2.52** → chat **$8.31**

**E. Routing 34.5k × (200 in + 50 out) Flash-Lite:**  
\(34500 × (200×0.10 + 50×0.40)/10^6 = \$1.38\)

**F. Deep 20×4 × (6k in + 1k out) Flash:**  
\(80 × (6000×0.30 + 1000×2.50)/10^6 = \$0.34\)

| Line | $/month |
|---|---:|
| Insights | 21.90 |
| Digests | 2.20 |
| Events | 4.63 |
| Chat | 8.31 |
| Routing | 1.38 |
| Deep | 0.34 |
| **Subtotal** | **38.76** |
| +50% contingency | **58.14** |

| Unit | Value |
|---|---:|
| **Per athlete / month (base)** | **$0.078** |
| **Per athlete / month (with contingency)** | **$0.116** |

---

### 12.2 Balanced — recommended

**Quality tradeoffs:** Sonnet-quality synthesis; Haiku routing may mis-route ~5–15% of hard chats (escalation catches most); critique on 20% sample only; deep Opus rare.

| Task | Model |
|---|---|
| Routing / intent | Claude Haiku 4.5 |
| Extraction / memory | Haiku 4.5 structured |
| Nightly synthesis + digests | Claude Sonnet 5 **Batch + 1h prompt cache** |
| Event insights | Sonnet 5 sync + cache |
| Chat | Haiku (85%) → Sonnet (15%) |
| Critique | Haiku on **20%** of insights (batch) |
| Deep investigate | Opus 5 (capped) |

#### Arithmetic — Balanced (Sonnet post-Sep rates)

**A. Nightly insights (Sonnet batch × cache)**  
Batch cache read \(=\$0.15/M\), batch write 1h \(=\$3.00/M\), batch in \(=\$1.50/M\), batch out \(=\$7.50/M\).

Per night:  
- Write: \(4000/10^6 × \$3.00 = \$0.012\)  
- Reads: \(499 × 4000/10^6 × \$0.15 = \$0.2994\)  
- Dynamic: \(500 × 2500/10^6 × \$1.50 = \$1.875\)  
- Output: \(500 × 800/10^6 × \$7.50 = \$3.00\)  
**Night = $5.186 → ×30 = $155.59/mo**

**B. Digests:**  
Per night: write \(5k×\$3/M=\$0.015\); reads \(14×5k×\$0.15/M=\$0.0105\); dyn \(15×10k×\$1.50/M=\$0.225\); out \(15×1.5k×\$7.50/M=\$0.1688\)  
**Night $0.419 → ×30 = $12.58**

**C. Events Sonnet sync (80% hit):**  
Per: \(0.8×4k×\$0.30 + 0.2×4k×\$3.75 + 2.5k×\$3 + 0.8k×\$15\) / 1e6 = **$0.02346**  
**×1,500 = $35.19**

**D. Chat:**  
Haiku 15,300 × \(0.75×3k×\$0.10 + 0.25×3k×\$1.25 + 1k×\$1 + 0.4k×\$5\) / 1e6  
\(= 15300 × \$0.0041625 = \$63.69\)  
Sonnet 2,700 × \(0.75×3k×\$0.30 + 0.25×3k×\$3.75 + 1k×\$3 + 0.4k×\$15\) / 1e6  
\(= 2700 × \$0.0124875 = \$33.72\)  
**Chat = $97.41**

**E. Routing Haiku 34.5k × (200+$1 + 50×$5)/M = $15.53**

**F. Critique 3,000 × (1.5k in + 0.2k out) Haiku batch ≈ half:**  
Use sync Haiku: \(3000 × (1500×1 + 200×5)/10^6 = \$7.50\)

**G. Deep Opus 20×8 × (8k in + 1.5k out):**  
\(160 × (8000×5 + 1500×25)/10^6 = \$12.40\)

| Line | $/month |
|---|---:|
| Insights | 155.59 |
| Digests | 12.58 |
| Events | 35.19 |
| Chat | 97.41 |
| Routing | 15.53 |
| Critique sample | 7.50 |
| Deep | 12.40 |
| **Subtotal** | **336.20** |
| +40% contingency | **470.68** |

| Unit | Value |
|---|---:|
| **Per athlete / month (base)** | **$0.67** |
| **Per athlete / month (with contingency)** | **$0.94** |

**Aug 2026 intro Sonnet ($2/$10):** scale Sonnet-heavy lines by ~2/3 → subtotal roughly **~$250–$280** before contingency (~**$0.50–$0.56**/athlete base).

**Naive baseline (all Sonnet sync, no cache/batch):**  
Insights alone: \(15000 × (6500×\$3 + 800×\$15)/10^6 = \$472.50\) — already above full Balanced stack. Full naive platform **~$1.5k–$2.5k/mo**.

---

### 12.3 Premium — quality-first

**Quality tradeoffs:** Highest cost; still not immune to hallucination — keep evidence citations and human coach override. Fable/Mythos reserved for R&D, not default prod.

| Task | Model |
|---|---|
| Routing | Haiku 4.5 |
| Extraction | Sonnet 5 structured |
| Nightly synthesis | **Opus 5** Batch + 1h cache |
| Digests | Opus 5 Batch + cache |
| Event insights | Opus 5 sync + cache |
| Chat | Sonnet 5 (90%) → Opus 5 (10%) |
| Critique | Opus 5 on **100%** of insights (batch) |
| Deep investigate | Opus 5 multi-agent (higher cap) |

#### Arithmetic — Premium

**A. Insights Opus batch × cache**  
Batch cache read \(=\$0.25/M\), 1h write \(=\$5/M\), batch in \(=\$2.50\), batch out \(=\$12.50\).

Per night:  
- Write: \(4k×\$5/M = \$0.02\)  
- Reads: \(499×4k×\$0.25/M = \$0.499\)  
- Dyn: \(500×2.5k×\$2.50/M = \$3.125\)  
- Out: \(500×0.8k×\$12.50/M = \$5.00\)  
**Night $8.644 → ×30 = $259.32**

**B. Digests Opus:** ~**$25/mo** (same method as Balanced, Opus rates)

**C. Full critique batch Opus:**  
\(15000 × (2000×\$2.50 + 300×\$12.50)/10^6 = \$131.25\)

**D. Events Opus sync ~$0.05 each × 1,500 ≈ $75**

**E. Chat:** Sonnet 16,200 × ~$0.0125 = **$202.50**; Opus 1,800 × ~$0.0208 = **$37.44** → **$239.94**

**F. Extraction upgrade (Sonnet on 15k insights + 18k chat preprocessors ≈ 20k × 800 in + 150 out):**  
\(20000 × (800×3 + 150×15)/10^6 = \$69.00\)  
(Routing Haiku still ~$15)

**G. Deep 20×12 Opus calls × $0.0775 ≈ $18.60**

| Line | $/month |
|---|---:|
| Insights | 259.32 |
| Digests | 25.00 |
| Critique 100% | 131.25 |
| Events | 75.00 |
| Chat | 239.94 |
| Extraction | 69.00 |
| Routing | 15.53 |
| Deep | 18.60 |
| **Subtotal** | **833.64** |
| +40% contingency | **1,167.10** |

| Unit | Value |
|---|---:|
| **Per athlete / month (base)** | **$1.67** |
| **Per athlete / month (with contingency)** | **$2.33** |

---

### 12.4 Tier comparison

| Tier | Monthly (base) | Monthly (+contingency) | $/athlete base | $/athlete +cont. | Biggest quality gap |
|---|---:|---:|---:|---:|---|
| **Economy** | ~$39 | ~$58 | $0.08 | $0.12 | Nuance, multilingual, no critique |
| **Balanced** ★ | ~$336 | ~$471 | $0.67 | $0.94 | Sampled critique only |
| **Premium** | ~$834 | ~$1,167 | $1.67 | $2.33 | Cost; still needs grounding |

★ Recommended default for B2B + serious B2C.

**B2C pricing viability:** Even Premium contingency (~$2.33/athlete/mo) leaves room under a ~$10–20 consumer SKU if AI is not the only COGS. Economy (~$0.12) is viable for freemium daily insights; Balanced (~$0.94) is the sweet spot for “personalized coach AI” paid tiers.

---

## 13. Lever ranking for this product

| Rank | Lever | Est. savings vs naive Sonnet sync | Effort | Notes |
|---|---|---|---|---|
| 1 | **Prompt caching + prefix hygiene** | 50–80% of **input** on repeated prefix | Low | Biggest lever for 500× same shape |
| 2 | **Batch API on nightly/digests** | Flat **50%** in+out; stacks with #1 | Low–med | Perfect fit; 24h OK |
| 3 | **Model routing / cascades** | 40–70% on chat | Med | Haiku/Flash default |
| 4 | **Structured compact outputs** | 20–35% on synthesis/extract | Low | Also reliability win |
| 5 | **Deterministic context pruning** | 20–40% input on chat/agents | Med | Better than LLMLingua first |
| 6 | **Critique sampling + rules** | Avoids 5× Opus critique bill | Low | Premium pays for 100% |
| 7 | **Semantic response cache** | Low here | Med | Unsafe without state keys |
| 8 | **Distillation** | High later | High | Not at 500-athlete ROI yet |
| 9 | **Self-host open weights** | Negative at this scale | Very high | Skip |

---

## 14. Implementation checklist

1. Pin Anthropic `cache_control.ttl` explicitly (`5m` vs `1h`); monitor `cache_read_input_tokens` / `cache_creation_input_tokens` every night.
2. Move all dynamic athlete fields **after** the cache breakpoint; freeze tool JSON key order.
3. Put nightly insights + digests + critique sampling on **Message Batches** (or Gemini Batch); keep chat sync.
4. Put LiteLLM (or equivalent) in front: `org_id`/`athlete_id` metadata, soft/hard budgets, model allow-lists.
5. Emit structured insights only; render prose in product UI.
6. Circuit breaker: provider failover → cheaper model → last-good insight → human-readable degrade message.
7. Revisit distillation when a single narrow task exceeds ~50–100M tokens/month sustained.
8. Reprice after **2026-09-01** Sonnet intro expiry; re-run §12 arithmetic on live `usage` exports monthly.

---

## 15. Source index

- Anthropic pricing & caching: https://www.anthropic.com/pricing  
- Anthropic TTL regression: https://particula.tech/blog/anthropic-prompt-cache-ttl-5-minute-regression-debugging  
- Anthropic caching guides: https://gingerlabs.ai/blog/anthropic-prompt-caching · https://www.respan.ai/articles/claude-prompt-caching  
- OpenAI caching: https://developers.openai.com/api/docs/guides/prompt-caching · https://developers.openai.com/cookbook/examples/prompt_caching_201  
- OpenAI Batch: https://developers.openai.com/api/docs/guides/batch  
- Gemini caching: https://ai.google.dev/gemini-api/docs/generate-content/caching · https://cloud.google.com/blog/products/ai-machine-learning/vertex-ai-context-caching  
- Batch + cache stacking: https://leanlm.ai/blog/llm-batch-api  
- Hit-rate case study: https://www.digitalocean.com/community/tutorials/prompt-caching-in-practice-hit-rate  
- RouteLLM: https://github.com/lm-sys/RouteLLM · https://www.lmsys.org/blog/2024-07-01-routellm/  
- Router 2026 comparisons: https://dreaming.press/posts/2026-06-21-routellm-vs-notdiamond-vs-martian.html · https://klymentiev.com/blog/llm-router  
- Semantic cache landscape: https://github.com/ashishpatel26/omnicache-ai · https://dreaming.press/posts/gptcache-vs-redis-vs-gateway-semantic-caching.html  
- LLMLingua / compression study: https://github.com/microsoft/LLMLingua · https://arxiv.org/pdf/2604.02985  
- Distillation ROI: https://sfailabs.com/guides/the-ai-project-distillation-case-when-a-smaller-fine-tune-beats-a-bigger-model · https://aws.amazon.com/blogs/machine-learning/optimize-video-semantic-search-intent-with-amazon-nova-model-distillation-on-amazon-bedrock/  
- Structured outputs cost: https://ssimplifi.com/blog/structured-outputs-cost-tradeoff  
- Self-host break-even: https://aicost.ai/tools/self-host-breakeven · https://renezander.com/guides/self-hosted-llm-vs-api/  
- Cost controls: https://docs.litellm.ai/docs/proxy/cost_tracking · https://particula.tech/blog/per-tenant-llm-cost-attribution-multi-tenant-saas  
- Claude price aggregators (Aug 2026): https://benchlm.ai/anthropic/api-pricing · https://www.ssdnodes.com/learn/how-much-is-1m-tokens-claude  
- Gemini price aggregators: https://www.metacto.com/blogs/the-true-cost-of-google-gemini-a-guide-to-api-pricing-and-integration · https://flatkey.ai/blog/gemini-api-pricing  

---

*End of dossier. Numbers are planning estimates — validate against one week of instrumented `usage` before locking B2C COGS.*
