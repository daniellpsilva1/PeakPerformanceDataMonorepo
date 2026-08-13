# 54 — Reliable Structured Output from LLMs

**Research date:** 2026-08-02  
**Scope:** Mid-2026 state of native structured outputs, constrained decoding, reasoning-vs-format evidence, failure modes, retry/repair, two-stage extraction, Pydantic tooling, and a concrete Insight generation design for a multi-provider sports-performance agent system.  
**Constraint:** External research only; no local codebase exploration.

---

## 1. Executive verdict

As of mid-2026, **schema-enforced structured outputs are a solved formatting problem on the major hosted APIs** (OpenAI strict `json_schema`, Anthropic GA `output_config.format` / strict tools, Gemini `response_json_schema`). They do **not** solve semantic correctness. For Insight generation (claim + evidence chips + confidence + actions + coach-review flag), the reliable production pattern is:

1. **Reason freely** (or with an in-schema `reasoning` scratchpad) on a strong model.  
2. **Extract/constrain** into a provider-normalized Pydantic schema with native structured output where available.  
3. **Validate beyond schema** (numeric grounding, evidence↔claim consistency, enum/casings, stop-reason checks).  
4. **Retry with validation errors** (2–3 attempts), then **deterministic template fallback** that is **explicitly marked** as non-model provenance.

Do **not** rely on `json_object` + `json.loads` alone. That is the failure mode we are escaping: parse-only, no retries, silent fallback, no provenance.

---

## 2. Native structured output by provider (mid-2026)

### 2.1 OpenAI — Strict Structured Outputs

**Mechanism:** Constrained decoding against a JSON Schema artifact. Enable via `response_format: { type: "json_schema", json_schema: { name, strict: true, schema } }` (Chat Completions) or the Responses API equivalent (`text.format` / `json_schema`). Distinct from JSON mode (`json_object`), which only guarantees parseable JSON, not schema adherence.

**Sources:**  
- https://developers.openai.com/api/docs/guides/structured-outputs  
- https://learn.microsoft.com/en-us/azure/foundry/openai/how-to/structured-outputs  

**Supported (strict):**

| Feature | Support |
|---|---|
| Types | `string`, `number`, `integer`, `boolean`, `object`, `array`, `enum`, `anyOf` |
| String | `pattern`, `format` (`date-time`, `time`, `date`, `duration`, `email`, `hostname`, `ipv4`, `ipv6`, `uuid`) — **not for fine-tuned models** |
| Number | `minimum`/`maximum`/`exclusive*`, `multipleOf` — **not for fine-tuned models** |
| Array | `minItems`/`maxItems` — **not for fine-tuned models** |
| `$defs` / `$ref` / recursive schemas | Supported |
| Key order | Output follows schema key order |

**Hard requirements / gotchas:**

- Root must be an **object** (not top-level `anyOf` / discriminated union at root).  
- **Every property must be in `required`.** Optional → `"type": ["string", "null"]` (or equivalent union).  
- **`additionalProperties: false` on every object** — required; omitting it errors.  
- Nesting: up to **10 levels**, **5000** total properties.  
- Enum budget: up to **1000** enum values schema-wide; string-enum length caps apply above 250 values.  
- Total string length of property/definition/enum/const names ≤ **120,000**.  

**Unsupported (API rejects with error when `strict: true`):**

- Composition: `allOf`, `not`, `dependentRequired`, `dependentSchemas`, `if`/`then`/`else`  
- Fine-tuned models additionally lack string length/pattern/format and numeric bounds  

**Refusal / truncation:** Safety refusals surface as a dedicated `refusal` channel (Responses API content parts / message fields) rather than schema-shaped JSON. Incomplete generation at max tokens can yield non-schema output — check `finish_reason` / incomplete status.

**Guarantee strength:** Strongest among major clouds when `strict: true` — token-level constrained decoding. JSON mode is **not** a substitute.

---

### 2.2 Anthropic — Native JSON outputs + strict tool use (GA)

**Mechanism (2025–2026 evolution):** Historically tool-use schemas were a strong hint. As of late 2025 / early 2026, Anthropic shipped **native structured outputs** with grammar-constrained sampling:

1. **JSON outputs** — `output_config.format = { type: "json_schema", schema }`  
2. **Strict tool use** — `tools[].strict: true` with `input_schema`  

Both compile schemas into grammars (cached ~24h). GA announced for Sonnet/Opus/Haiku 4.5 families and expanded across newer Claude lines; available on Claude Developer Platform, Bedrock, Vertex, Foundry (with deployment caveats).

**Sources:**  
- https://platform.claude.com/docs/en/build-with-claude/structured-outputs  
- https://claude.com/blog/structured-outputs-on-the-claude-developer-platform  
- https://platform.claude.com/docs/en/agents-and-tools/tool-use/strict-tool-use  
- https://docs.cloud.google.com/gemini-enterprise-agent-platform/models/partner-models/claude/structured-outputs  

**Supported:**

| Feature | Support |
|---|---|
| Basic types | object, array, string, integer, number, boolean, null |
| `enum` / `const` | Yes (enum: strings/numbers/bools/null only — no complex types) |
| `anyOf`, `allOf` | Yes, with limits (`allOf` + `$ref` not supported) |
| `$ref` / `$defs` / `definitions` | Internal refs yes; **external `$ref` no** |
| String formats | `date-time`, `time`, `date`, `duration`, `email`, `hostname`, `uri`, `ipv4`, `ipv6`, `uuid` |
| Regex `pattern` | Limited subset (no backrefs, lookaround, `\b`) |
| Array `minItems` | **Only 0 or 1** |
| `default` | Supported |
| `additionalProperties` | **Must be `false`** |

**Unsupported / rejected (400):**

- Recursive schemas  
- Numerical constraints: `minimum`, `maximum`, `multipleOf`  
- String length: `minLength`, `maxLength`  
- Array constraints beyond `minItems` ∈ {0,1}  
- `additionalProperties` ≠ false  
- Complex types inside `enum`  

**SDK pitfall (critical):** Python/TS/Ruby/PHP SDKs may **strip unsupported constraints** (`minimum`, `minLength`, etc.), append them to field **descriptions**, and validate client-side. That means the wire schema is weaker than your Pydantic model — **the model is not constrained on those bounds**; only post-validation is. If you send raw schemas without transform, unsupported features 400.

**Complexity limits (compilation):**

| Limit | Value |
|---|---|
| Strict tools / request | 20 |
| Optional parameters (total across strict schemas) | 24 |
| Union-typed parameters (`anyOf` / type arrays) | 16 |
| Grammar compile timeout | 180s |
| Over-complex → `"Schema is too complex for compilation"` | 400 |

**Invalid-output cases (even with structured outputs):**

1. **`stop_reason: "refusal"`** — schema may not hold; billed; HTTP 200.  
2. **`stop_reason: "max_tokens"`** — truncated, may be invalid JSON/schema.  
3. **Enum casing drift** — capitalization of enum/const values is **not guaranteed** (e.g. `"Conversation Topic 3"` vs `"Conversation topic 3"`). Compare case-insensitively; avoid enums that differ only by case.

**Property order:** Required properties first (schema order), then optional — can reorder relative to schema declaration.

**Recommendation for Insights:** Prefer **JSON outputs** (`output_config.format`) for the final Insight object. Use **strict tools** for agent tool calls. Keep Insight schema **all-required**, shallow, few unions.

---

### 2.3 Google Gemini — `responseSchema` vs `responseJsonSchema`

**Mechanism:** Set `response_mime_type: "application/json"` plus a schema. Two dialects:

| Field | Dialect | Strengths | Weaknesses |
|---|---|---|---|
| `responseSchema` (legacy OpenAPI subset) | OpenAPI 3.0-ish | `propertyOrdering` for explicit emit order | No `$ref`/`$defs`; inline duplication |
| `responseJsonSchema` (preferred 2025+) | JSON Schema | `$ref`, `$defs`, recursion, `anyOf`, numeric bounds, `prefixItems`, `additionalProperties`, `null` unions | No `propertyOrdering` concept; mutually exclusive with `responseSchema` |

**Sources:**  
- https://blog.google/innovation-and-ai/technology/developers-tools/gemini-api-structured-outputs/ (2025-11-05)  
- https://ai.google.dev/gemini-api/docs/generate-content/structured-output  
- https://docs.cloud.google.com/gemini-enterprise-agent-platform/models/capabilities/control-generated-output  
- https://gemilab.net/en/articles/gemini-api/gemini-response-json-schema-ref-defs-recursive-migration  

**Supported (JSON Schema path, Gemini 2.5+ / 3.x):**

- Types: string, number, integer, boolean, object, array, null (via type arrays)  
- Object: `properties`, `required`, `additionalProperties`  
- String: `enum`, `format` (`date-time`, `date`, `time`)  
- Number: `enum`, `minimum`, `maximum`  
- Array: `items`, `prefixItems`, `minItems`, `maxItems`  
- Unions: `anyOf`  
- Refs: `$ref` / `$defs` / recursion (via `responseJsonSchema`)  
- Key order: Gemini 2.5+ preserves schema key order implicitly; Gemini 2.0 needs explicit `propertyOrdering` on `responseSchema`

**The silent-ignore trap (bites constantly):**

> “Not all features of the JSON Schema specification are supported. **The model ignores unsupported properties.**”

Unlike OpenAI/Anthropic (which typically **reject** unsupported keywords), Gemini may **accept the request and silently ignore** unsupported keywords. Cloud docs for the OpenAPI-style path are explicit: unsupported fields are ignored. Always re-validate with Pydantic; never assume a keyword was enforced because the call succeeded.

**Other notes:**

- MIME type alone without schema ≈ “JSON hint,” not a guarantee.  
- Docs stress: structured output guarantees **syntactic** schema shape, **not semantic** correctness.  
- Very large / deeply nested schemas may be rejected — simplify names/nesting.  
- Prefer Pydantic → `model_json_schema()` → `response_json_schema`.

---

### 2.4 Open models & hosted open-weight APIs

| Stack | Enforcement | Notes |
|---|---|---|
| **vLLM** | XGrammar (default `auto`), Guidance/llguidance, Outlines, LM Format Enforcer | `structured_outputs` / guided JSON / regex / CFG / `structural_tag` |
| **SGLang / TensorRT-LLM / MLC-LLM** | XGrammar (+ XGrammar-2 Structural Tag, 2026) | Strict tool calling for DeepSeek/Qwen-class models |
| **Fireworks** | `json_object` / `json_schema` + BNF Grammar mode | Supports most JSON Schema 2020-12; instruct model to produce JSON |
| **Together** | `response_format` JSON schema | Also recommend pasting schema into system prompt |
| **Mistral** | JSON mode + Custom Structured Outputs (`chat.parse`) | Custom schema recommended over loose JSON mode |
| **Groq / others** | Mixed; many expose OpenAI-compatible `json_schema` | Compatibility uneven — treat as best-effort unless benchmarked |

**Sources:**  
- https://docs.vllm.ai/en/latest/features/structured_outputs/  
- https://blog.mlc.ai/2026/05/04/xgrammar-2-fast-customizable-structured-generation  
- https://docs.fireworks.ai/structured-responses/structured-response-formatting  
- https://docs.together.ai/docs/inference/chat/structured-outputs  
- https://docs.mistral.ai/capabilities/structured-output/structured_output_overview  
- https://www.requesty.ai/blog/structured-outputs-across-llm-providers-the-compatibility-mess  

**Practical rule:** Self-hosted open models can match hosted reliability **only** if served behind a modern constrained-decoding backend (XGrammar / llguidance). Prompt-only JSON on open models is not production-grade for nightly batches.

---

## 3. Constrained decoding deep dive

### 3.1 How it works

At each decode step, a grammar / automaton / PDA computes a **token mask** of schema-legal next tokens. Illegal logits are zeroed before sampling. This is stronger than prompting and stronger than “JSON mode” (which only constrains to the JSON language, not your schema).

### 3.2 Major libraries / engines

| Engine | Approach | Strengths | Weaknesses |
|---|---|---|---|
| **Outlines** | Regex/FSM precomputation | Mature Python ergonomics | High compile cost/memory for complex schemas |
| **XGrammar** | Adaptive token-mask cache + PDA; overlaps with GPU forward | Near-zero e2e overhead when integrated; default in vLLM/SGLang | Compile cost; some JSON Schema features unsupported |
| **llguidance** (Guidance) | Lazy on-the-fly masks (~50μs/mask claimed) | Fast cold start; dynamic schemas; JSON Schema subset | Different feature coverage vs XGrammar |
| **LM Format Enforcer** | Regex-oriented dynamic masks | Simple | Slower; limited CFG nesting |
| **llama.cpp grammars** | GBNF CFG | Ubiquitous locally | Slower parser; less JSON Schema fidelity |

**Sources:**  
- https://arxiv.org/pdf/2411.15100 (XGrammar)  
- https://guidance-ai.github.io/llguidance/llg-go-brrr  
- https://dreaming.press/posts/outlines-vs-xgrammar-vs-llguidance.html  
- https://openreview.net/pdf?id=FKOaJqKoio (JSONSchemaBench)  
- https://aclanthology.org/2025.ranlp-1.124.pdf (Hidden Cost of Structure)  

### 3.3 Availability through hosted APIs

Hosted OpenAI / Anthropic / Gemini structured outputs **are** constrained decoding (or equivalent grammar-constrained sampling) — you do not run Outlines yourself. Self-hosted or Fireworks Grammar mode exposes the knobs directly. For our multi-provider Insight path, **prefer provider-native structured output**; only run local Outlines/XGrammar if we self-host a fallback model.

### 3.4 Performance cost

- **Modern engines (XGrammar, llguidance) + co-designed serving:** often **near-zero** end-to-end overhead (mask work hidden behind GPU forward).  
- **Older / regex-precompute (classic Outlines):** grammar compile can dominate; +10–40% latency cited in production writeups for complex schemas.  
- **Hosted APIs:** first-schema compile may add latency (Anthropic caches grammars ~24h); subsequent calls cheaper.  
- **JSONSchemaBench** shows large variance in compile time and constraint coverage across engines — coverage ≠ quality of generated *content*.

---

## 4. Does constraining output hurt reasoning?

### 4.1 The notable claim

**Tam et al., “Let Me Speak Freely?”** (EMNLP 2024 Industry) — arXiv:2408.02442 / ACL anthology 2024.emnlp-industry.91  

Finding: format restrictions (especially stricter JSON/schema constraints) **degraded reasoning** on GSM8K-class tasks vs free-form; looser formats hurt less; classification sometimes improved under structure.

https://arxiv.org/abs/2408.02442  
https://aclanthology.org/2024.emnlp-industry.91/

### 4.2 Rebuttals and follow-ups

1. **.txt / dottxt — “Say What You Mean”**  
   https://blog.dottxt.ai/say-what-you-mean.html  
   Argues the paper conflated **API JSON-mode** with true constrained decoding, used mismatched prompts, and leaned on an “AI parser.” With matched prompts, they report structured JSON **matching or beating** free-form for Llama-3-8B-Instruct on the same tasks.

2. **Dylan Castillo — “Say What You Mean… Sometimes”**  
   https://dylancastillo.co/posts/say-what-you-mean-sometimes.html  
   Agrees the original study had methodological issues, but finds that **on GPT-4o-mini**, even after prompt fixes, structured vs unstructured gaps can remain on some reasoning tasks. Conclusion: neither extreme generalizes to all models.

3. **“The Hidden Cost of Structure”** (RANLP 2025)  
   https://aclanthology.org/2025.ranlp-1.124.pdf  
   Finds divergence: base models may benefit from constraints; instruction-tuned models can degrade on generation tasks. Mechanism: constraints force the model off its preferred token path → lower confidence / factual errors that are still schema-valid.

4. **Practitioner synthesis (“Capacity, Not Format” / format-tax writeups, 2025–2026)**  
   https://dreaming.press/posts/does-structured-output-hurt-llm-accuracy.html  
   https://dreaming.press/posts/json-mode-vs-function-calling-vs-constrained-decoding.html  
   Thesis: the tax is paid when the model is near its **capability boundary**. Strong models with headroom absorb schemas; weak models or hard tasks pay. Schema field order matters: answer-before-reason amputates CoT.

### 4.3 Balanced conclusion

| Claim | Status |
|---|---|
| “Constrained decoding always destroys reasoning” | **False** (overstated; often confounded) |
| “Structure is free on all tasks/models” | **False** |
| Practical truth | Format compliance and hard reasoning **compete for generation capacity**. Extraction/classification often benefit. Multi-step analytical Insights can suffer if the model must emit rigid JSON **before** thinking. |
| Mitigation both camps accept | **Think first, structure second**: free-text reasoning pass, or put a free-form `reasoning` / `analysis` field **first** in the schema, then constrained fields. |

For sports Insights (synthesis over metrics, not GSM8K), treat the risk as **real but manageable**: use two-stage or reasoning-first schema design; do not force answer-first JSON on a small model.

---

## 5. Failure modes in practice

| Failure | What happens | Detection | Mitigation |
|---|---|---|---|
| **Truncation at max_tokens** | Incomplete JSON; schema violation even under “guaranteed” modes | `finish_reason` / `stop_reason == max_tokens` / incomplete flag | Raise `max_tokens`; shorten schema text fields; reject + retry; never repair-truncation into a confident Insight |
| **Refusal inside JSON wrapper** | Model refuses but wraps prose in `{}` or fills schema with refusal text | OpenAI `refusal` field; Anthropic `stop_reason: refusal`; semantic scan for refusal phrases in claim | Do not persist as Insight; escalate / fallback template with `requires_coach_review=true` |
| **Enum drift** | Near-miss enum (case, synonym, plural) | Anthropic casing caveat; Pydantic enum validation | Casefold enums; keep enums short/canonical; normalize layer before validate |
| **Schema-valid hallucination** | Numbers/types match schema but invent metrics | Semantic validators (claim digits ⊆ evidence; source IDs exist) | Post-schema checks; ground evidence from tool results, not model invention |
| **Unicode / multilingual** | Mojibake, wrong locale units, RTL punctuation breaking naive parsers, fullwidth digits | Locale-aware number parse; NFC normalize; reject unknown units | Store canonical SI/imperial codes; localize only in UI layer |
| **Silent keyword ignore (Gemini)** | Bounds/`pattern` you thought were enforced weren’t | Diff wire schema vs intended; fuzz tests | Pydantic re-validation; never trust provider for semantic bounds |
| **SDK schema transform (Anthropic)** | `ge=0` stripped to description | Inspect outbound schema | Dual validate: provider subset + full Pydantic |
| **Markdown fences / preamble** | ` ```json ` wrappers when not using native structured mode | Detect fences | Prefer native structured; else strip fences / json-repair |
| **Premature close** | Extra `}` orphans later fields; repair libs may drop data | Compare repaired vs raw | Prefer `safe-json-repair`-style tools that don’t drop orphans; still re-validate |

Production lesson from Cadence (2026): OpenAI strict ≈ token-level guarantee; Anthropic historically ~99% then catch with `safeParse` — with GA grammar sampling, treat Anthropic similarly but **still** validate stop reasons and enum casing.  
https://cadence.withremote.ai/blog/structured-outputs-llm-production

---

## 6. Retry and repair strategies

### 6.1 Reprompt with validation error (primary)

Pattern used by Instructor / PydanticAI:

1. Call model with schema.  
2. Parse → Pydantic validate (schema + custom validators).  
3. On failure: append **failed output + structured error messages** to the conversation; ask for a corrected object only.  
4. Cap retries (see §9).  
5. On exhaustion → deterministic fallback with provenance mark.

Feedback should be **machine-readable and specific**:

```text
Validation failed:
- evidence[1].value: expected number, got "12.4 km/h" (string)
- claim: contains number 48 that is not present in any evidence[].value
Please regenerate the full Insight JSON correcting these issues. Do not invent new metrics.
```

### 6.2 JSON repair libraries (secondary, structural only)

| Library | Role |
|---|---|
| [`json-repair`](https://github.com/mangiucugna/json_repair) / PyPI `json-repair` | Fix commas, quotes, fences, truncated closers; optional schema-guided repair |
| `safe-json-repair` | Emphasizes never silently dropping orphaned fields after premature `}` |
| `llm-json-repair` | Repair + field extraction from heavily truncated blobs |

**When to use:** Only when native structured output is unavailable or returned truncated/fenced text. **Never** treat repair as semantic validation. Prefer rejecting truncated outputs over “successful” repair of half an Insight.

### 6.3 When to fall back

Fall back immediately (no more model retries) when:

- Safety refusal  
- Persistent semantic grounding failures after N retries (invented metrics)  
- Provider outage / schema compile 400 that won’t fix itself  
- Budget / latency SLA exceeded for the nightly batch slot  

Fall back after retries when:

- Repeated `ValidationError` / parse errors  
- Enum/format thrashing  
- `max_tokens` truncation twice even after raising limit  

---

## 7. Two-stage: reason then extract

### 7.1 Pattern

**Stage A — Reason (unconstrained or lightly guided):**  
Model produces free-text analysis citing provided metric context (tool results already in prompt). Prefer a mid/large model. Optional: ask for explicit “Evidence used: …” bullets in prose.

**Stage B — Extract (cheap + constrained):**  
Small/fast model (or same model with native structured output) maps Stage A → Insight schema. Schema may include `reasoning` only if you keep a one-stage path; in two-stage, Stage A holds the reasoning and Stage B is pure projection.

### 7.2 Evidence for the approach

- Tam et al.’s own comparison regimes: NL-then-convert outperformed strict restricted JSON on reasoning-heavy tasks.  
- Dottxt + practitioner consensus: constrain the **output**, not the **thought**.  
- Instructor docs recommend progressive validation / staged extraction for complex schemas.  
- Cost: Stage B is short and cacheable; Stage A dominates quality.

### 7.3 When one-stage is enough

One-stage with **reasoning field first** in the schema is acceptable when:

- Model is strong (frontier / near-frontier)  
- Task is closer to extraction than multi-hop reasoning  
- Latency budget forbids two calls  
- You still run full semantic validators  

**Recommendation for Insights:** Default to **two-stage** for nightly batch quality; allow one-stage reasoning-first for interactive/low-latency paths.

---

## 8. Pydantic-specific tooling

### 8.1 Instructor

https://github.com/567-labs/instructor/  
https://python.useinstructor.com/learning/validation/retry_mechanisms/

- Patches provider clients; `response_model=YourModel`.  
- Modes: tools / JSON / native structured depending on provider.  
- **Retry loop:** on `ValidationError` or parse failure → append error + bad response → re-ask; configurable `max_retries` (often 0 default on client — set explicitly).  
- Supports custom `@field_validator` / `@model_validator` — these drive retries.  
- Exhaustion → `InstructorRetryException` with attempt history.  
- Good for focused extraction; less of an agent runtime.

### 8.2 PydanticAI

https://pydantic.dev/docs/ai/core-concepts/output  

**Output modes:**

| Mode | Marker | Behavior |
|---|---|---|
| Tool output (default) | `ToolOutput` / bare model | Structured via tool calling; optional `strict` |
| Native structured | `NativeOutput` | Provider JSON-schema constrained decoding |
| Prompted | `PromptedOutput` | Schema in instructions + JSON mode if available; validate + retry |

**Retry loop:**

- Output retry budget via `Agent(retries={'output': N})` or per-run; **default output budget is 1**.  
- `@agent.output_validator` raises `ModelRetry("…")` → model re-prompted; consumes budget.  
- Tool argument validation similarly retries.  
- Prefer `NativeOutput(Insight)` on OpenAI/Anthropic/Gemini for final objects; use `output_validator` for claim↔evidence grounding.

### 8.3 Related

- **LangChain / LlamaIndex structured output** — similar validate-retry wrappers; heavier.  
- **Outlines + Pydantic** — local constrained decoding to Pydantic models.  
- **LiteLLM** — provider normalization; still need your own validation layer.

**For our stack:** Prefer **PydanticAI `NativeOutput` + output validators** (or thin Instructor-style loop if not adopting full agents) so retries are first-class and provider modes are explicit — not hand-rolled `httpx` + `json.loads`.

---

## 9. Recommended design for Insight generation

### 9.1 Cross-provider schema strategy

Define a single **canonical Pydantic `Insight` model**, then compile **provider views**:

```text
Insight (canonical Pydantic)
  ├─ openai_schema: all required, additionalProperties:false, null-unions for optionals
  ├─ anthropic_schema: strip min/max/minLength; keep enums ASCII; all-required preferred;
  │                    ≤16 unions; avoid recursion; minItems only 0/1
  └─ gemini_schema: response_json_schema from model_json_schema();
                    do not rely on ignored keywords; re-validate fully
```

**Suggested core fields (illustrative):**

| Field | Type | Notes |
|---|---|---|
| `reasoning` | `str` | One-stage only; omit from persisted API or store separately |
| `claim` | `str` | Human-readable; no bare numbers absent from evidence |
| `evidence` | `list[EvidenceChip]` | `metric`, `source`, `value`, `unit`, `trend` |
| `confidence` | `enum[low,medium,high]` | Short lowercase enums |
| `recommended_actions` | `list[str]` | Bound length in Pydantic, not only schema |
| `requires_coach_review` | `bool` | Force true on low confidence / fallback / grounding fail |
| `provenance` | `object` | **Required** — see §9.4 |

Keep nesting ≤3 levels. Put free-text `reasoning` **before** `claim` if one-stage. Prefer `trend: Literal["up","down","flat","unknown"]` over free strings.

### 9.2 One-stage vs two-stage

**Default (nightly, hundreds of generations): two-stage reason-then-extract.**

```text
┌─────────────────────────────┐
│ Stage A: Analyst call       │  Anthropic Sonnet / Gemini Pro / OpenAI
│ Free text or light bullets  │  Context = tool metrics only (ground truth)
│ No JSON schema required     │
└──────────────┬──────────────┘
               │ analysis_text
               ▼
┌─────────────────────────────┐
│ Stage B: Extractor call     │  Native structured output (cheap model OK)
│ NativeOutput(Insight)       │  Prompt: "Project the analysis into schema.
│                             │   Use ONLY numbers appearing in CONTEXT."
└──────────────┬──────────────┘
               │
               ▼
        Pydantic + semantic validators
               │
        pass ──┼── fail → retry Stage B (≤2) with errors
               │         still fail → Stage A once more OR fallback
               ▼
        Persist Insight + provenance
```

**Justification:** Insight quality is reasoning-bound (multi-metric synthesis). Format tax is real near capability limits; nightly batch can afford two calls. Extraction is where OpenAI/Anthropic/Gemini guarantees matter. Interactive UI can use one-stage reasoning-first with the same validators.

### 9.3 Retry policy

| Layer | Attempts | Feedback | Escalate when |
|---|---|---|---|
| Stage B extract | **2 retries** (3 total tries) | Full Pydantic error list + failed JSON; remind “numbers must come from context” | Still invalid |
| Stage A re-reason | **1** optional | “Previous analysis produced ungrounded claim X” | Grounding fails twice |
| Provider failover | 1 alternate provider | Same schema view for that provider | Primary 5xx / schema compile failure |
| Deterministic fallback | 1 | N/A | After above exhausted, or on refusal |

**Do not retry** pure refusals or clear policy blocks — go to fallback with coach-review.

**Backoff:** validation retries can be immediate; provider 429 → exponential backoff separate from validation budget.

### 9.4 Deterministic fallback + provenance marking (critical)

Current defect: silent template fallback indistinguishable from model Insights. Fix with an explicit, persisted provenance contract.

**Required fields on every Insight:**

```python
class InsightProvenance(BaseModel):
    generation_method: Literal[
        "model_native_structured",
        "model_tool_structured",
        "model_prompted_json",
        "model_two_stage",
        "template_fallback",
        "human_edited",
    ]
    is_model_generated: bool
    model_provider: str | None = None
    model_name: str | None = None
    schema_name: str = "Insight"
    schema_version: str
    attempt_count: int
    validation_errors: list[str] = []
    fallback_reason: str | None = None
    generated_at: datetime
    prompt_hash: str | None = None
    context_metric_ids: list[str] = []
```

**Template fallback behavior:**

- Build claim from the strongest available metric via rules (e.g. “HRV {value}{unit}, {trend} vs 7-day baseline”).  
- Evidence chips copied **verbatim** from computed metrics (never invented).  
- `confidence = "low"`.  
- `requires_coach_review = true`.  
- `recommended_actions` = generic safe actions from a vetted catalog.  
- `provenance.generation_method = "template_fallback"`.  
- `provenance.is_model_generated = false`.  
- `provenance.fallback_reason` = machine code (`parse_exhausted` \| `validation_exhausted` \| `refusal` \| `provider_error` \| `truncation`).

**UI / downstream contract:**

- API and UI **must** branch on `is_model_generated` / `generation_method`.  
- Show a visible badge: e.g. “Rule-based summary” vs “AI insight”.  
- Exclude `template_fallback` from model-quality evals and from auto-send athlete notifications unless product explicitly allows.  
- Telemetry: counter of fallback rate per specialist / provider (alert if > threshold).

### 9.5 Validation beyond schema

Implement as Pydantic `model_validator` and/or PydanticAI `output_validator`:

1. **Numeric grounding:** Every number token in `claim` (and actions) appears in `evidence[].value` or an allowlisted set (dates, percentages derived by declared formulas).  
2. **Evidence completeness:** ≥1 evidence chip; each chip’s `metric`/`source` ID exists in the request context.  
3. **Unit consistency:** `unit` ∈ catalog for that metric; reject mixed systems without conversion.  
4. **Trend consistency:** If trend is `up`/`down`, claim polarity must not contradict.  
5. **Confidence calibration rules:** High confidence forbidden if evidence count < 2 or any chip is interpolated/missing.  
6. **Coach-review triggers:** low confidence, conflicting metrics, medical-adjacent language, fallback path.  
7. **Locale:** Normalize Unicode digits to ASCII before grounding checks; store canonical claim in one locale; translate later.  
8. **Refusal/leak scan:** Block phrases like “as an AI”, “I cannot”, policy refusals inside claim.  
9. **Enum normalization:** Casefold before validate.  
10. **Truncation gate:** If provider stop reason is length/max_tokens → hard fail (no repair-to-success).

On semantic failure, retry with the specific rule id in the error feedback; after budget → fallback.

### 9.6 Provider routing matrix

| Priority | Provider | Mode | Role |
|---|---|---|---|
| 1 | Anthropic | `output_config.format` JSON schema (Stage B); free text Stage A | Primary quality |
| 1b | Gemini | `response_json_schema` + MIME JSON | Parallel primary / cost flex |
| 2 | OpenAI | `strict: true` json_schema | Fallback provider / Stage B specialist |
| 3 | Fireworks/Together/vLLM open model | `json_schema` via XGrammar | Disaster fallback before templates |

Always run the **same** Pydantic semantic layer regardless of provider. Never skip provenance.

### 9.7 Concrete pipeline (pseudo)

```python
async def generate_insight(ctx: MetricContext) -> Insight:
    # Stage A
    analysis = await llm.complete(provider=primary, messages=reason_prompt(ctx), max_tokens=…)
    if is_refusal(analysis):
        return template_fallback(ctx, reason="refusal")

    # Stage B + retries
    errors: list[str] = []
    for attempt in range(1, 4):
        raw = await llm.structured(
            provider=primary,
            schema=provider_schema(Insight, primary),
            messages=extract_prompt(ctx, analysis, errors),
            max_tokens=…,
        )
        if raw.stop_reason in {"max_tokens", "length"}:
            errors = ["truncated_output"]; continue
        if raw.is_refusal:
            return template_fallback(ctx, reason="refusal")
        try:
            insight = Insight.model_validate(raw.data)  # includes semantic validators
            insight.provenance = make_provenance(
                method="model_two_stage", attempt=attempt, provider=primary, …
            )
            return insight
        except ValidationError as e:
            errors = format_errors(e)

    # Optional: one provider failover of Stage B only
    …
    return template_fallback(ctx, reason="validation_exhausted", errors=errors)
```

---

## 10. Implementation checklist

- [ ] Replace hand-rolled `json_object` + `json.loads` with provider-native structured outputs.  
- [ ] Single canonical Pydantic Insight + per-provider schema adapters.  
- [ ] Always check stop/finish/refusal before parse.  
- [ ] Semantic validators for claim↔evidence grounding.  
- [ ] Retry budget: 3 extract tries + optional 1 re-reason + 1 provider failover.  
- [ ] `json-repair` only as pre-parse assist when not on native structured path.  
- [ ] **Mandatory provenance** with `template_fallback` distinctly marked.  
- [ ] UI badge + analytics for fallback rate.  
- [ ] Eval harness: schema pass rate, grounding pass rate, fallback rate, format-tax A/B (one-stage vs two-stage).  
- [ ] Never ship Insights that fail grounding as `confidence=high`.

---

## 11. Source index

### Provider docs
- OpenAI Structured Outputs: https://developers.openai.com/api/docs/guides/structured-outputs  
- Azure OpenAI Structured Outputs: https://learn.microsoft.com/en-us/azure/foundry/openai/how-to/structured-outputs  
- Anthropic Structured Outputs: https://platform.claude.com/docs/en/build-with-claude/structured-outputs  
- Anthropic Strict Tool Use: https://platform.claude.com/docs/en/agents-and-tools/tool-use/strict-tool-use  
- Anthropic GA blog: https://claude.com/blog/structured-outputs-on-the-claude-developer-platform  
- Gemini Structured Outputs (API): https://ai.google.dev/gemini-api/docs/generate-content/structured-output  
- Gemini JSON Schema announcement (2025-11-05): https://blog.google/innovation-and-ai/technology/developers-tools/gemini-api-structured-outputs/  
- Gemini Enterprise control generated output: https://docs.cloud.google.com/gemini-enterprise-agent-platform/models/capabilities/control-generated-output  
- Fireworks structured responses: https://docs.fireworks.ai/structured-responses/structured-response-formatting  
- Together structured outputs: https://docs.together.ai/docs/inference/chat/structured-outputs  
- Mistral structured outputs: https://docs.mistral.ai/capabilities/structured-output/structured_output_overview  
- vLLM structured outputs: https://docs.vllm.ai/en/latest/features/structured_outputs/  
- XGrammar-2 (2026-05): https://blog.mlc.ai/2026/05/04/xgrammar-2-fast-customizable-structured-generation  

### Research & commentary
- Tam et al. 2024 “Let Me Speak Freely?”: https://arxiv.org/abs/2408.02442 · https://aclanthology.org/2024.emnlp-industry.91/  
- dottxt rebuttal: https://blog.dottxt.ai/say-what-you-mean.html  
- Castillo replication: https://dylancastillo.co/posts/say-what-you-mean-sometimes.html  
- Hidden Cost of Structure (RANLP 2025): https://aclanthology.org/2025.ranlp-1.124.pdf  
- XGrammar paper: https://arxiv.org/pdf/2411.15100  
- JSONSchemaBench: https://openreview.net/pdf?id=FKOaJqKoio  
- llguidance performance: https://guidance-ai.github.io/llguidance/llg-go-brrr  
- Format tax synthesis: https://dreaming.press/posts/does-structured-output-hurt-llm-accuracy.html  
- JSON mode vs constrained decoding: https://dreaming.press/posts/json-mode-vs-function-calling-vs-constrained-decoding.html  
- Outlines vs XGrammar vs llguidance: https://dreaming.press/posts/outlines-vs-xgrammar-vs-llguidance.html  
- Production lessons (Cadence, 2026): https://cadence.withremote.ai/blog/structured-outputs-llm-production  
- Provider compatibility survey (2026): https://www.requesty.ai/blog/structured-outputs-across-llm-providers-the-compatibility-mess  
- Gemini responseSchema vs responseJsonSchema: https://gemilab.net/en/articles/gemini-api/gemini-response-json-schema-ref-defs-recursive-migration  

### Tooling
- Instructor: https://github.com/567-labs/instructor/ · https://python.useinstructor.com/learning/validation/retry_mechanisms/  
- PydanticAI output: https://pydantic.dev/docs/ai/core-concepts/output  
- json-repair: https://github.com/mangiucugna/json_repair  

---

## 12. One-paragraph summary for planners

Native structured outputs on OpenAI (strict), Anthropic (GA grammar-constrained JSON / strict tools), and Gemini (`response_json_schema`) make schema-valid JSON reliable in 2026, but each supports a different JSON Schema subset—OpenAI/Anthropic reject bad keywords; Gemini often silently ignores them—so always re-validate with Pydantic. Constrained decoding is cheap on modern stacks; the real risk is semantic hallucination and a residual “format tax” on hard reasoning, mitigated by two-stage reason-then-extract (or reasoning-first fields). Retries should feed validation errors back for ~3 extract attempts, use JSON repair only for structural messes outside native modes, and on exhaustion emit a **template Insight marked `generation_method=template_fallback` / `is_model_generated=false`** so UI and evals never confuse rules with models.
