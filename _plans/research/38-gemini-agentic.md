# 38 — Google Gemini for Production Agents (mid-2026)

External research dossier for Peak Performance Data’s multi-agent sports-performance platform (EU tennis academies; wearable / training / match / biomarker / genetic / CGM data; EN/ES/CA/ZH; GDPR Art. 9 health data).

**Research date:** 2026-08-02  
**Method:** Official Google pricing + model docs, Vertex/Agent Platform docs, Gemini API guides; secondary sources only for multilingual benchmarks, long-context evals, and health over-refusal reports.  
**Constraint:** Do not treat pre-2026 model cards as current. Prefer `ai.google.dev` and `cloud.google.com` numbers.

---

## Sources (primary)

| Source | URL | Notes |
|--------|-----|-------|
| Gemini API Pricing | https://ai.google.dev/gemini-api/docs/pricing | Authoritative Developer API $/1M rates (fetched 2026-08-02) |
| Latest Gemini models | https://ai.google.dev/gemini-api/docs/latest-model | Confirms GA of `gemini-3.6-flash` + `gemini-3.5-flash-lite` |
| Gemini 3.6 Flash model card | https://ai.google.dev/gemini-api/docs/models/gemini-3.6-flash | 1,048,576 in / 65,536 out; July 2026 |
| Gemini 3.1 Pro Preview model card | https://ai.google.dev/gemini-api/docs/models/gemini-3.1-pro-preview | Same 1M/64K limits |
| Gemini 3.5 Flash-Lite model card | https://ai.google.dev/gemini-api/docs/models/gemini-3.5-flash-lite | GA high-volume agentic / translation |
| Gemini 3.1 Flash-Lite model card | https://ai.google.dev/gemini-api/docs/models/gemini-3.1-flash-lite | Cheapest Flash-Lite tier |
| Rate limits | https://ai.google.dev/gemini-api/docs/rate-limits | Tiered; project-specific RPM in AI Studio |
| Billing / tiers | https://ai.google.dev/gemini-api/docs/billing | Free → Tier 1/2/3; paid = no training |
| Batch Mode | https://ai.google.dev/gemini-api/docs/batch-mode | 50% discount; ~24h SLO |
| Optimization (Standard/Flex/Priority/Batch/Cache) | https://ai.google.dev/gemini-api/docs/optimization | Cache ~90% input discount; Flex/Batch 50% |
| Context caching | https://ai.google.dev/gemini-api/docs/caching | Implicit (default) + explicit via `generateContent` |
| Caching API | https://ai.google.dev/api/caching | TTL / `expire_time` fields |
| Function calling | https://ai.google.dev/gemini-api/docs/function-calling | Parallel + compositional; modes |
| Structured outputs | https://ai.google.dev/gemini-api/docs/structured-output | JSON Schema / Pydantic / Zod |
| Structured outputs announcement | https://blog.google/innovation-and-ai/technology/developers-tools/gemini-api-structured-outputs/ | Expanded JSON Schema dialect |
| Thinking | https://docs.cloud.google.com/gemini-enterprise-agent-platform/models/thinking | `thinking_level` vs legacy `thinking_budget` |
| Grounding with Google Search | https://ai.google.dev/gemini-api/docs/google-search | EU available; Gemini 3 billed per search query |
| Gemini API Additional Terms | https://ai.google.dev/gemini-api/terms | Paid-only for EEA/UK/CH end users; grounding rules |
| Safety settings | https://ai.google.dev/gemini-api/docs/safety-settings | Configurable categories; OFF default on newer models |
| Vertex / Agent Platform safety | https://docs.cloud.google.com/gemini-enterprise-agent-platform/models/capabilities/configure-safety-filters | Non-configurable CSAM/PII filters |
| Agent Platform pricing | https://cloud.google.com/gemini-enterprise-agent-platform/generative-ai/pricing | Vertex SKUs; non-global premium note |
| Data residency | https://docs.cloud.google.com/gemini-enterprise-agent-platform/resources/data-residency | EU multi-region / country endpoints |
| Zero data retention (Vertex) | https://docs.cloud.google.com/gemini-enterprise-agent-platform/resources/zero-data-retention | Cloud DPA; feature caveats |
| Zero data retention (Developer API) | https://ai.google.dev/gemini-api/docs/zdr | ZDR requires project approval + feature opt-outs |
| Long context (Google) | https://docs.cloud.google.com/gemini-enterprise-agent-platform/models/long-context | >99% single-needle; multi-needle caveat |
| Google Cloud DPA | https://cloud.google.com/terms/data-processing-addendum | Art. 28 processor terms for Vertex path |

### Secondary (capability / risk only)

| Source | URL | Use |
|--------|-----|-----|
| Grounding EU rollout | https://developers.googleblog.com/en/gemini-api-and-ai-studio-now-offer-grounding-with-google-search/ | Available across Europe (from 2024-12-05) |
| Alconost translation 2026 | https://alconost.com/en/blog/best-llm-for-translation-2026 | Gemini strong overall; DeepSeek edges zh-CN |
| Artificial Analysis multilingual | https://artificialanalysis.ai/models/multilingual | Gemini 3.x near top on Chinese |
| Gemini Apps language list | https://support.google.com/gemini/answer/13575153 | Catalan + Chinese officially supported |
| Health-ORSC-Bench (ACL 2026 Findings) | https://aclanthology.org/2026.findings-acl.1177 | Gemini in high-safety / non-trivial over-refusal cluster |
| Digital Applied NIAH-2 (Apr 2026) | https://www.digitalapplied.com/blog/long-context-retrieval-needle-in-haystack-2026 | Gemini leads long-context; multi-needle still degrades |
| Janus Compliance Gemini GDPR 2026 | https://www.januscompliance.co.uk/blog/is-the-gemini-api-gdpr-compliant-2026 | Vertex vs AI Studio DPA distinction (secondary legal summary) |

---

## 1. Current model lineup (as of 2026-08-02)

### 1.1 Production-relevant text/agent models

| Display name | Exact model ID | Context (in) | Max out | Status | Role |
|--------------|----------------|--------------|---------|--------|------|
| **Gemini 3.6 Flash** | `gemini-3.6-flash` | 1,048,576 | 65,536 | **GA (July 2026)** | Current Flash workhorse for agentic / multimodal |
| **Gemini 3.5 Flash-Lite** | `gemini-3.5-flash-lite` | 1,048,576 | 65,536 | **GA** | High-volume agents, translation, simple processing |
| **Gemini 3.1 Flash-Lite** | `gemini-3.1-flash-lite` | 1,048,576 | 65,536 | GA | Cheapest Lite tier (~$0.25/$1.50) |
| **Gemini 3.1 Pro Preview** | `gemini-3.1-pro-preview` (+ `…-customtools`) | 1,048,576 | 65,536 | Preview | Highest capability / critique / hard synthesis |
| **Gemini 3.5 Flash** | `gemini-3.5-flash` | 1M (family) | 65K class | Still listed | Prior Flash; **prefer 3.6** (same input $, cheaper output) |
| **Gemini 3 Flash Preview** | `gemini-3-flash-preview` | 1M | — | Preview | Mid-tier cheaper Flash |
| **Gemini 2.5 Pro** | `gemini-2.5-pro` | 1M | — | Stable legacy | Still priced; long-context surcharge >200K |
| **Gemini 2.5 Flash** | `gemini-2.5-flash` | 1M | — | Stable legacy | Still strong value if you pin versions |
| **Gemini 2.5 Flash-Lite** | `gemini-2.5-flash-lite` | 1M | — | Stable legacy | Ultra-cheap ($0.10/$0.40) |

Specialized (usually not our core router): Live / TTS / Image / Omni / Translate variants (`gemini-3.1-flash-live-preview`, `gemini-3.5-live-translate-preview`, Nano Banana image models, etc.).

**Pinning recommendation:** Prefer GA IDs `gemini-3.6-flash`, `gemini-3.5-flash-lite`, `gemini-3.1-flash-lite`. Use `gemini-3.1-pro-preview` only behind a feature flag until GA.

### 1.2 Pricing table — Official Gemini API (Paid Standard, USD / 1M tokens)

Source: https://ai.google.dev/gemini-api/docs/pricing (and Vertex Agent Platform mirror). **Thinking tokens bill as output.**

| Model ID | Input | Output (incl. thinking) | Cached input | Cache storage / hr | Batch in / out |
|----------|------:|------------------------:|-------------:|-------------------:|----------------|
| `gemini-3.6-flash` | $1.50 | **$7.50** | $0.15 | $1.00 / 1M tok·hr | $0.75 / $3.75 |
| `gemini-3.5-flash` | $1.50 | $9.00 | $0.15 | $1.00 | $0.75 / $4.50 |
| `gemini-3.5-flash-lite` | $0.30 | $2.50 | $0.03 | $1.00 | $0.15 / $1.25 |
| `gemini-3.1-flash-lite` | $0.25 (text/img/vid); $0.50 audio | $1.50 | $0.025 / $0.05 | $1.00 | $0.125 / $0.75 |
| `gemini-3-flash-preview` | $0.50 (text/img/vid); $1.00 audio | $3.00 | $0.05 / $0.10 | $1.00 | $0.25 / $1.50 |
| `gemini-3.1-pro-preview` | $2.00 (≤200K) / **$4.00 (>200K)** | $12 / **$18 (>200K)** | $0.20 / $0.40 | **$4.50** | $1.00/$6.00 (≤200K); $2/$9 (>200K) |
| `gemini-2.5-pro` | $1.25 / $2.50 (>200K) | $10 / $15 | $0.125 / $0.25 | $4.50 | 50% of standard |
| `gemini-2.5-flash` | $0.30 | $2.50 | $0.03 | $1.00 | $0.15 / $1.25 |
| `gemini-2.5-flash-lite` | $0.10 | $0.40 | $0.01 | $1.00 | $0.05 / $0.20 |

**Inference lanes (same page / optimization guide):**

| Lane | Price vs Standard | Latency | Use |
|------|-------------------|---------|-----|
| Standard | 1.0× | Seconds | Interactive chat / tools |
| **Batch** | **0.5×** | Up to ~24h (often faster) | Nightly athlete insights |
| Flex | 0.5× | Minutes (1–15 min target) | Sheddable async chains |
| Priority | ~1.8× | Seconds, higher reliability | SLA-sensitive UX |

**Grounding (Gemini 3.x):** 5,000 free search queries/month shared across Gemini 3 models, then **$14 / 1,000 search queries** (billed **per search query** the model issues, not per prompt). Gemini 2.5 grounding uses older RPD + $35/1k grounded-prompt pricing.

**Vertex / EU regional note:** Agent Platform pricing documents a **non-global endpoint premium** (~10%) for some GA Gemini 3 SKUs (e.g. 3.5 Flash / 3.5 Flash-Lite / 3.1 Flash-Lite). Budget ~1.1× token rates when pinned to `europe-west*` for residency. Confirm live SKU for `gemini-3.6-flash` in your region before locking unit economics.

**Paid vs Free data use (pricing page):** Free tier — content **used to improve products**. Paid tier — **not** used to improve products. *This is necessary but not sufficient for Art. 9 — see §10.*

### 1.3 Rate limits

Official stance (https://ai.google.dev/gemini-api/docs/rate-limits):

- Dimensions: **RPM**, **input TPM**, **RPD** (resets midnight Pacific), plus spend-based caps.
- Applied **per project**, not per API key.
- Exact RPM/TPM are **tier- and model-specific** and shown in [AI Studio rate limits](https://aistudio.google.com/rate-limit) — not a single universal number.

Usage tiers:

| Tier | Qualification | Billing cap (approx.) |
|------|---------------|------------------------|
| Free | Active project / trial | N/A |
| Tier 1 | Billing linked | $250 |
| Tier 2 | Paid ≥$100 + 3 days | $2,000 |
| Tier 3 | Paid ≥$1,000 + 30 days | $20k–$100k+ |

Published Tier-1 **TPM-class** examples from the rate-limits page (illustrative, not RPM): Gemini 3.1 Pro Preview ~5M; Flash-Lite class ~10M; several Flash SKUs ~3M. **Batch has separate quotas.** For 500-athlete nightly + interactive chat, plan on **Tier 2+** and Batch for the overnight job so interactive RPM is not stolen by the batch fan-out.

---

## 2. Function / tool calling

Official: https://ai.google.dev/gemini-api/docs/function-calling

| Capability | Status (mid-2026) | Notes for us |
|------------|-------------------|--------------|
| Single tool call | Mature | Standard ReAct loops |
| **Parallel tool calls** | Supported | Multiple independent `function_call`s in one turn; map results by `id` |
| **Compositional / sequential** | Supported | Model can chain tools across turns |
| Forced tool choice | Yes — `ANY` / `tool_choice: "any"` | Also `AUTO`, `NONE`, `VALIDATED` (preview / combo mode) |
| Schema adherence mode | `VALIDATED` | Constrains to schema-valid calls or natural language |
| Built-in + custom tools | Supported (Gemini 3) | Search, code execution, Maps, Computer Use, URL context + your tools |
| Structured output + tools | Gemini 3 series | Can require schema-shaped final answers when not calling tools |
| Thought signatures | Required for thinking models | Must echo signatures across multi-turn agent loops or get 400s |

**Quality posture for agents:** Gemini 3.6 Flash is explicitly positioned for **fewer turns / fewer tool calls / less loop spiraling** vs 3.5 Flash (latest-model page). That matters for multi-specialist routers (wearable → tennis → biomarkers). Still: treat tool args as untrusted; validate server-side; never let the model invent numeric physiology (aligns with PHIA dossier #34).

**Forced tool choice use cases for us:** extraction agents that *must* call `get_athlete_snapshot` before answering; critique agents forced into a fixed review tool.

---

## 3. Structured output

Official: https://ai.google.dev/gemini-api/docs/structured-output + Nov 2025 JSON Schema expansion blog.

- Set `response_mime_type: application/json` + `response_schema` (OpenAPI/JSON Schema).
- SDKs accept **Pydantic / Zod**.
- Expanded dialect: `anyOf`, `$ref`, `minimum`/`maximum`, `prefixItems`, `additionalProperties`, null types.
- Property order preserved for Gemini 2.5+.

**Strictness vs competitors (practical 2026 consensus):**

| Provider | Guarantee |
|----------|-----------|
| OpenAI strict / Anthropic structured | Strong sampler-level schema binding |
| **Gemini `response_schema`** | Strong on **shape / types / required / enums**; Google still expects **app-side value validation** |
| JSON mode alone | Valid JSON only — insufficient for insight schemas |

**Recommendation:** Use Gemini structured output for insight envelopes and tool-router plans, then **Zod/Pydantic business validation + retry**. Do not treat schema compliance as semantic correctness for biomarkers or CGM advice.

---

## 4. Thinking / reasoning modes

| Generation | Control | Defaults | Billing |
|------------|---------|----------|---------|
| Gemini 2.5 | `thinking_budget` (token soft cap; `-1` = dynamic) | Dynamic up to ~8192; Pro cannot fully disable | Thinking tokens = **output** price |
| Gemini 3.x | `thinking_level`: `minimal` / `low` / `medium` / `high` | 3.6 Flash & 3.5 Flash → **medium**; 3.5 Flash-Lite → **minimal** | Same — billed as output |

**When it helps agentic sports tasks:**

| Level | Fit |
|-------|-----|
| `minimal` / `low` | Routing, classification, JSON extraction, tool-arg fill |
| `medium` | Interactive coach chat, multi-tool synthesis of wearable+match |
| `high` | Cross-domain critique, conflicting biomarker vs training load, hard planning |

**Cost trap:** A “short” answer can still spend thousands of thinking tokens at output rates ($7.50–$12 / 1M). Always set `thinking_level` explicitly in the router; monitor `usage_metadata.thoughts_token_count`. For nightly batch, prefer Lite + `minimal`/`low` unless the athlete’s case is flagged complex.

---

## 5. Context caching (high leverage for multi-agent)

Official: https://ai.google.dev/gemini-api/docs/caching · https://ai.google.dev/api/caching · optimization guide.

### Mechanics

1. **Implicit caching** — default on Gemini 2.5+; automatic prefix hits; no storage fee; savings passed through when hit.
2. **Explicit caching** — create `CachedContent` with system instruction + tools + static docs; reference by name on later calls. **Not** on Interactions API — use `generateContent` (or Vertex equivalent).

### Thresholds (documented mins)

| Model family | Min tokens for cache |
|--------------|---------------------|
| Gemini 3.5 Flash / 3.1 Pro Preview | **4,096** |
| Gemini 2.5 Flash / Pro | **2,048** |

(Treat 3.6 Flash / 3.5 Flash-Lite as 3.x → plan for **≥4K** shared prefix.)

### Pricing / TTL

- Cached input reads ≈ **10% of input price** (~**90% discount**).
- Storage typically **$1.00 / 1M tokens / hour** (Pro-class **$4.50**).
- Explicit TTL: set `ttl` (duration) or `expire_time`; **default TTL = 1 hour** if unset; no hard min/max documented beyond short practical floor (~1 minute after create in guides).
- Batch: cache hits priced like non-batch cached tokens (batch page); **do not assume batch 50% stacks on top of the 90% cache discount** — verify `usage_metadata` in pilot.

### Why it matters for PPD

Multi-agent loops re-send: large system prompts, tool JSON schemas, academy policy text, locale style guides. Put **static prefix first** (system + tools + glossary), keep athlete-dynamic payload last. Explicitly cache the shared agent kit for the nightly window (TTL 2–6h) and for interactive chat (session or 1h sliding refresh).

---

## 6. Batch API

- **50% off** standard input/output for the model.
- Async; **target ≤24h** turnaround (often much faster).
- Ideal for **nightly insights across hundreds of athletes**.
- Combine with caching for shared system/tool prefix; keep per-athlete dynamic context in the variable suffix.
- Flex inference is a synchronous cousin at similar discount for sheddable chains — Batch is cleaner for “500 athletes by morning.”

---

## 7. Multilingual (EN / ES / CA / ZH)

| Language | Assessment |
|----------|------------|
| English | Frontier-class |
| Spanish | Strong; safe default for academies |
| **Catalan** | Officially supported in Gemini Apps language lists; not always broken out in public MMLU-style boards — **must eval in-house** on coaching tone + sports jargon |
| **Chinese** | Artificial Analysis: Gemini 3.x near top; Alconost 2026: Gemini excellent on zh-TW, DeepSeek often edges **zh-CN** technical translation |

**Product implication:** Gemini is a strong **primary synthesizer** for ES/CA/ZH UX. For Simplified Chinese *polished marketing/medical phrasing*, consider a DeepSeek (or Qwen) polish pass while keeping Gemini for tool-using agent loops. Always pass explicit locale + glossary in the cached system prefix (`ca-ES`, `zh-CN` vs `zh-TW`).

---

## 8. Long-context behavior

- Marketing / model cards: **1M** input on current Flash/Pro.
- Google docs: near-perfect **single-needle** retrieval; **multi-needle / multi-hop degrades**.
- Independent Apr 2026 NIAH-style compilations: Gemini leads the field at 1M, but complex reasoning still softens past ~200–400K.
- **Pricing cliff:** Pro families double (or more) when prompts **>200K**.

**For PPD:** Prefer **summaries + RAG + tool fetches** over stuffing full CGM/wearable histories. Use long context for “one match video transcript + shot table” or “last 14-day aggregated features,” not raw millions of samples. Cache stable corpora; don’t pay 1M input on every agent turn.

---

## 9. Grounding with Google Search (EU)

- **Available in Europe** (Google announcement: Europe from 2024-12-05; docs say all available languages).
- Gemini API Additional Terms: for **EEA / Switzerland / UK**, API clients available to end users must use **Paid Services**.
- Grounding results have strict display / retention rules (Search Suggestions, limited storage).
- **ZDR conflict:** Vertex ZDR docs warn Search/Maps grounding stores prompts/outputs (~30 days) and can preclude zero-retention — prefer **Web Grounding for Enterprise** or disable grounding for Art. 9 pipelines.
- Practical use for us: optional **public tennis news / tournament schedules**, not for private biomarker reasoning. Default **off** for health agents.

---

## 10. Enterprise / GDPR / Art. 9 posture

| Topic | AI Studio / Developer API | Vertex AI / Gemini Enterprise Agent Platform |
|-------|---------------------------|-----------------------------------------------|
| Auth | API key | IAM / service accounts |
| Training on prompts | Free: **yes**; Paid: **no** | **No** (Cloud commitments) |
| DPA (Art. 28) | Weaker Google APIs ToS path; ZDR is a special request | **Google Cloud Data Processing Addendum** |
| EU data residency | Not a first-class residency product | **Yes** — pin `europe-west4` / EU multi-region endpoints; **global endpoint ≠ EU** |
| VPC-SC / CMEK / audit | Limited | Full Cloud controls |
| Recommended for Art. 9 health | Prototype only (paid) | **Production default for PPD** |

**Actionable EU setup:**

1. Run production agents on **Vertex** in **`europe-west4`** (or current EU region with full model availability).
2. Avoid `aiplatform.googleapis.com` global for health payloads.
3. Execute Cloud DPA; document sub-processors; DPIA for Art. 9.
4. If ZDR required: disable features that retain data (explicit cache, grounding, session store); follow Vertex ZDR checklist; note in-memory cache TTL behavior.
5. Budget **non-global SKU premium** where applicable.

**AI Studio vs Vertex summary:** Studio/Developer API is fine for demos and non-PHI experiments on **paid** tier. For academy athlete health data, **Vertex + EU region + DPA** is the compliance path.

---

## 11. Safety filters & health over-refusal

**Configurable** (API `safety_settings`): harassment, hate speech, sexually explicit, dangerous content — thresholds `OFF` / `BLOCK_ONLY_HIGH` / `BLOCK_MEDIUM_AND_ABOVE` / `BLOCK_LOW_AND_ABOVE`. Newer Gemini 3.5+ defaults many filters to **OFF** (model-inherent safety still applies). **Non-configurable:** CSAM and some PII protections on Vertex.

**Over-refusal risk (practical):**

- Health-ORSC-Bench (ACL Findings 2026): frontier models including **Gemini** sit in a **high-safety / meaningful over-refusal** cluster on hard benign health prompts; Gemini noted as relatively sensitive to some abuse categories.
- Field reports: legitimate medical/pregnancy/drug Qs can return `finish_reason: SAFETY`; sports-performance content with blood markers, genetics, CGM hypo/hyper discussion can trip **dangerous-content** heuristics if thresholds are tight.

**Mitigations for PPD:**

1. Per-surface safety profiles: sports-physiology agents at `BLOCK_ONLY_HIGH` on dangerous-content; never blanket `OFF` in production without legal review.
2. System prompt: “performance coaching for supervised athletes, not diagnosis; escalate clinical concerns.”
3. Instrument blocks by category; graded retry relaxing only the firing category.
4. Keep **deterministic metric code** for numbers (PHIA lesson); model narrates, does not invent labs.
5. Eval suite of Catalan/Spanish biomarker + CGM coaching prompts before GA.

---

## 12. Fit in a tiered model router

### Recommended Gemini roles

| Task | Model | Lane | Why |
|------|-------|------|-----|
| **Routing / intent / tool plan** | `gemini-3.1-flash-lite` or `gemini-3.5-flash-lite` | Standard, `thinking_level=minimal` | Cheap, fast, structured plan JSON |
| **Extraction** (match stats, wearable digests → schema) | `gemini-3.1-flash-lite` | Batch nightly / Standard interactive | Best $/structured-output |
| **Synthesis** (coach-facing nightly insight, chat) | `gemini-3.6-flash` | Standard + **explicit cache**; Batch for nightly | Best agentic Flash; fewer tool loops |
| **Critique / conflict resolution** (biomarker vs load vs match) | `gemini-3.1-pro-preview` (or 2.5 Pro if pin stable) | Standard, `thinking_level=high`, sparse | Reserve for hard cases (~5–15% of athletes) |
| **Batch nightly (default)** | Lite extract → 3.6 Flash synthesize | **Batch 50%** + cache | Cost floor for 500 athletes |
| **Multilingual polish (zh-CN optional)** | Gemini OK; DeepSeek optional second pass | — | See §7 |
| **Grounded public web** | 3.6 Flash + `google_search` | Paid only; **off** for Art. 9 core | Tournaments/news only |

**What Gemini should *not* own alone:** arithmetic on HRV/glucose/labs; legal “diagnosis”; sole processor without Vertex residency for EU health data.

### Comparison vs current DeepSeek-primary / Groq-fallback

| Dimension | Gemini (Vertex EU) | DeepSeek (current primary) | Groq fallback |
|-----------|--------------------|----------------------------|---------------|
| Agentic tools + cache + batch | **Best-in-class Google stack** | Strong models, weaker enterprise EU story | Latency king, smaller models |
| Art. 9 / DPA / residency | **Vertex EU** | Must verify separately | Typically weak for health |
| Cost at Lite/Batch | Very competitive | Often cheaper raw tokens | Cheap/fast |
| Long multimodal context | **Leader** | Good text; weaker multimodal enterprise | Limited |
| Catalan | Needs eval; officially supported | Needs eval | Needs eval |

**Strategic recommendation:** Move **production EU health agents** to **Vertex Gemini** as the **compliance + agent runtime** backbone; keep DeepSeek as optional **cost/quality A-B** for Chinese polish or non-health text; keep Groq (or Flash-Lite) as **ultra-low-latency router/fallback** only on non-sensitive paths—or dual-run Flash-Lite on Vertex for one less vendor on health traffic.

---

## 13. Workload cost estimate — ~500 athletes

Assumptions (adjust after measuring real tokenizers):

| Component | Tokens / athlete / night | Notes |
|-----------|--------------------------|-------|
| Cached shared prefix (system + tools + glossary) | 8,000 | Hit rate ~95% after warmup |
| Dynamic athlete context | 6,000 | Aggregates, not raw CGM |
| Insight output + thinking | 2,500 | `medium` on hard, `low` on easy → use 2.5K avg |
| Interactive chat | 200 conversations/day × 3 turns × (3.5K in + 1.2K out) | Moderate academy usage |

### Nightly batch (500 athletes, Batch API)

**Path A — Lite extract + 3.6 Flash synthesize (recommended)**

1. Extract (all 500) on `gemini-3.1-flash-lite` Batch:  
   - In: 500 × 6K × $0.125 / 1M ≈ **$0.38**  
   - Out: 500 × 0.8K × $0.75 / 1M ≈ **$0.30**
2. Synthesize on `gemini-3.6-flash` Batch with cache:  
   - Cached reads: 500 × 8K × $0.075 / 1M ≈ **$0.30**  
   - Dynamic in: 500 × 6K × $0.75 / 1M ≈ **$2.25**  
   - Out: 500 × 2.5K × $3.75 / 1M ≈ **$4.69**  
   - Cache storage: 8K × ~6h × $1 / 1M ≈ **negligible (~$0.05)**

**Nightly total ≈ $7.9/day → ~$240/month**

**Path B — All 3.6 Flash Batch + cache (simpler):** ~$6–9/day depending on thinking.

**Path C — Pro critique on 10% flagged athletes (50 × Standard, not batch):**  
50 × (10K × $2 + 3K × $12) / 1M ≈ **$2.8/day → ~$85/month**

### Interactive chat (Vertex Standard, 3.6 Flash, cache hits on prefix)

600 turns/day × (3.5K × $1.50 + 1.2K × $7.50) / 1M ≈ **$8.55/day → ~$260/month**  
(With 50% of input cached: roughly **~$200/month**.)

### Blended monthly (order of magnitude)

| Slice | USD / month |
|-------|------------:|
| Nightly Path A | ~240 |
| Chat | ~200–260 |
| Pro critique 10% | ~85 |
| Grounding (optional, low volume) | <50 |
| **Total Gemini-centric** | **~$550–650** |
| + ~10% EU non-global premium | **~$600–720** |

Sensitivity: doubling thinking tokens on nightly synthesis alone can add ~$100–150/month — hence explicit `thinking_level` routing.

Compare: uncached, non-batch, all-Pro nightly would be **several thousand $/month** — caching + Batch + Lite are mandatory, not optional.

---

## 14. Concrete recommendation (executive)

1. **Adopt Vertex AI Gemini in `europe-west4` (or current full-SKU EU region)** as the production agent platform for academy health data; execute Cloud DPA; disable free-tier / global endpoints for PHI.
2. **Router tiering:**  
   - `gemini-3.1-flash-lite` / `gemini-3.5-flash-lite` → route + extract  
   - `gemini-3.6-flash` → synthesize + interactive tools  
   - `gemini-3.1-pro-preview` → sparse critique  
3. **Always** enable prefix caching; **Batch** the nightly 500-athlete job; pin thinking levels.
4. **Grounding off** by default on Art. 9 paths; paid-only if used for public tennis context.
5. **Safety:** sports-physiology profile + Health-ORSC-style eval; don’t ship biomarker chat without block instrumentation.
6. **Keep DeepSeek** only where it wins evals (likely zh-CN polish) or as cost A/B — not as the EU health System of Record.
7. Pilot 2 weeks on 50 athletes: measure cache hit rate, thinking tokens, Catalan quality, false safety blocks — then lock the router config.

---

## 15. Open items / verify before contract

- [ ] Live Vertex SKU price for `gemini-3.6-flash` on `europe-west4` (non-global premium).
- [ ] Model availability matrix for EU regions (historically some regions lagged).
- [ ] ZDR eligibility + whether explicit context cache is acceptable under your DPIA.
- [ ] In-house Catalan coaching eval set (no public CA sports bench).
- [ ] Confirm Batch queue latency for 500-job nightly vs academy morning SLAs.
- [ ] Legal review: Art. 9 + Google Cloud DPA + subprocessors list.

---

*End of dossier. Single-file research output; no codebase changes.*
