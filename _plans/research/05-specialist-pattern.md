# 05 — Specialist Pattern Dossier

**Scope:** Existing "specialist" modules in `PeakPerformanceData/ppp_ai_agent` — the closest thing to agents in the codebase today.  
**Status:** Read-only research. No code was modified.  
**Primary sources (read in full):**
- `PeakPerformanceData/ppp_ai_agent/agent/cgm_specialist.py` (231 lines)
- `PeakPerformanceData/ppp_ai_agent/agent/biomarker_specialist.py` (225 lines)
- `PeakPerformanceData/ppp_ai_agent/tests/test_cgm_specialist.py` (150 lines)
- `PeakPerformanceData/ppp_ai_agent/tests/test_biomarkers.py` (161 lines)

**Supporting sources:**
- `PeakPerformanceData/ppp_ai_agent/config/provider_router.py`
- `PeakPerformanceData/ppp_ai_agent/schemas/insight.py`
- `PeakPerformanceData/ppp_ai_agent/tools/cgm.py` (`CGM_DISCLAIMER`, score computation)
- `PeakPerformanceData/ppp_ai_agent/eval/harness.py` (`check_medical_overreach`)
- `PeakPerformanceData/ppp_ai_agent/agent/nightly_batch.py` (same LLM pattern, third sibling)
- `PeakPerformanceData/ppp_ai_agent/api/routes/insights.py` (biomarker wiring; CGM not wired)
- `PeakPerformanceData/ppp_ai_agent/requirements.txt` (lists `pydantic-ai==0.0.13`, unused by specialists)

---

## 1. What a "specialist" is today

A specialist is **not** an agent. It is a **one-shot, event- or schedule-triggered pipeline**:

1. Fetch structured domain data via a Python tool function (ClickHouse / Supabase).
2. Serialize a JSON context blob into a single user message.
3. POST once to an OpenAI-compatible `/chat/completions` endpoint with a static system prompt and `response_format: {"type": "json_object"}`.
4. Parse the JSON string with `json.loads`.
5. Map fields into a Pydantic `Insight` with `.get()` defaults.
6. On any failure → return a deterministic `_build_fallback_insight(...)`.

There is **no tool-calling loop**, no planner, no memory, no self-critique, and no post-generation safety filter on the production path.

| Specialist | Entry function | Trigger | Data tool | Category | Wired into product? |
|---|---|---|---|---|---|
| CGM | `generate_cgm_nightly_insight` | Intended: nightly | `get_cgm_scores` | `nutrition` | **No** — defined but never imported by `nightly_batch.py` or API routes |
| Biomarker | `generate_panel_landed_insight` | `lab_ingest` event | `analyze_lab_panel` | `labs` | **Yes** — `api/routes/insights.py` L69–81 |
| (Sibling) Nightly batch | `generate_athlete_brief` | `/batch/nightly` | wearables + training | dynamic | Yes — same httpx pattern |

---

## 2. System prompts — verbatim

### 2.1 CGM specialist (`CGM_NIGHTLY_SYSTEM`)

**File:** `PeakPerformanceData/ppp_ai_agent/agent/cgm_specialist.py` **L18–41**

```
You are a sports nutrition and fueling analyst. You are given CGM scores (not raw glucose data).

Generate a single insight about the athlete's glucose patterns in the context of fueling and lifestyle.

Rules:
- Use LIFESTYLE and FUELING language only — never medical language.
- Never mention diabetes, prediabetes, insulin, or any medical condition.
- Never prescribe medications or supplements.
- If stability is low, suggest reviewing pre-training fueling timing.
- If time-below-range is high, suggest ensuring adequate pre-session fueling.
- If spike score is low (frequent spikes), suggest reviewing meal composition/timing.
- Always include the disclaimer: glucose scores are for lifestyle context only.
- Output a single JSON object matching the Insight schema.

Output format (JSON):
{
  "claim": "<single declarative sentence about fueling/lifestyle>",
  "category": "nutrition",
  "confidence": "high|medium|low",
  "evidence": [{"metric": "...", "source": "ClickHouse CGM scores", "value": ..., "unit": "score", "trend": null}],
  "actions": [{"action_type": "...", "description": "...", "priority": "low|medium", "requires_coach_approval": false}],
  "requires_coach_review": false
}
```

### 2.2 Biomarker specialist (`PANEL_LANDED_SYSTEM`)

**File:** `PeakPerformanceData/ppp_ai_agent/agent/biomarker_specialist.py` **L24–45**

```
You are a sports performance analyst. A new lab panel has been received.

Analyze the biomarker results and generate a single insight for the athlete's coach.

Rules:
- Report which biomarkers are outside optimal zones with specific values.
- Never diagnose medical conditions or prescribe medications/supplements.
- Suggest non-medical actions only (e.g. 'consult with team physician', 'monitor trend', 'adjust training load').
- If any biomarker is outside normal reference range, set requires_coach_review=true.
- Cite the biomarker name, value, unit, and optimal zone for each evidence chip.
- Output a single JSON object matching the Insight schema.

Output format (JSON):
{
  "claim": "<single declarative sentence>",
  "category": "labs",
  "confidence": "high|medium|low",
  "evidence": [{"metric": "...", "source": "Supabase lab_biomarkers", "value": ..., "unit": "...", "trend": null}],
  "actions": [{"action_type": "...", "description": "...", "priority": "low|medium|high", "requires_coach_approval": true|false}],
  "requires_coach_review": true|false
}
```

### 2.3 Prompt-engineering quality analysis

| Dimension | CGM | Biomarker | Verdict |
|---|---|---|---|
| **Role framing** | "sports nutrition and fueling analyst"; scopes input to scores not raw glucose | "sports performance analyst"; audience = coach | Adequate short role lock; no expertise bounds beyond domain label |
| **Output format** | Inline JSON sketch of Insight fields | Same pattern | Present, but **not a real JSON Schema** — no `$defs`, no required arrays, no enum enforcement beyond prose |
| **Safety / guardrails** | Strong lexical bans: diabetes, prediabetes, insulin, medical conditions, meds/supplements; lifestyle-only | "Never diagnose… or prescribe…"; non-medical actions only; coach-review on abnormal | Prompt-only. CGM is tighter on forbidden terms; biomarker is broader ("never diagnose") |
| **Few-shot examples** | **Absent** | **Absent** | No positive/negative exemplars; model must invent claim tone and action_type vocabulary |
| **Missing-data handling** | Out-of-band: early `return None` if `has_data` is false (L57–59). Prompt itself does **not** say what to do if scores are partial/null | Out-of-band: `return None` if analysis fails or `total == 0` (L61–71). Prompt assumes a panel exists | Missing data is handled in Python, not in the prompt. Partial/null fields (e.g. `fasting_baseline: null`) get dumped into user JSON with no instruction |
| **Hedging language** | Soft conditionals in rules ("suggest reviewing…"); fallback claims use "appears", "may support", "Consider" | Rules demand specific values; fallback claims are blunt counts ("X biomarker(s) outside normal range") | CGM hedges more; biomarker fallback is assertive about counts (safer because counts are deterministic) |
| **Disclaimer enforcement** | Rule: "Always include the disclaimer…" + disclaimer injected into user context (L72) | No disclaimer string in prompt | CGM asks the model to include a disclaimer in the claim; **code never checks** that it did. Fallback **omits** the disclaimer from `claim` entirely |
| **Category / review flags** | Example hardcodes `"requires_coach_review": false` — conflicts with fallback which sets it true when stability < 50 | Explicitly tells model when to set coach review | CGM prompt example under-teaches coach-review gating |
| **Evidence linking** | Asks for evidence chips with fixed source string | Asks to cite name/value/unit/**optimal zone** — but EvidenceChip schema has **no optimal_zone field** (`schemas/insight.py` L40–47) | Biomarker prompt asks for a citation shape the schema cannot store |

**Overall PE grade:** Functional starter prompts for a constrained JSON card, weak as agent system prompts. No few-shots, no chain-of-thought / scratchpad, no "refuse if…" branch, no faithfulness rule ("only use numbers from the context"), no self-check step. Biomarker prompt mentions optimal zones that cannot be represented on `EvidenceChip`. CGM prompt's disclaimer rule is unenforced.

---

## 3. Exact LLM invocation mechanism

### 3.1 Shared shape (copy-pasted in both specialists)

Both nest an inner `async def call_llm(provider, prompt: str) -> dict` and pass it to `with_failover`.

**CGM:** `cgm_specialist.py` L78–101, call at L104  
**Biomarker:** `biomarker_specialist.py` L84–107, call at L110  

```python
async with httpx.AsyncClient(timeout=30) as client:
    resp = await client.post(
        f"{provider.base_url}/chat/completions",
        headers={
            "Authorization": f"Bearer {provider.api_key}",
            "Content-Type": "application/json",
        },
        json={
            "model": provider.model,
            "messages": [
                {"role": "system", "content": <SYSTEM_PROMPT>},
                {"role": "user", "content": prompt},
            ],
            "temperature": 0.3,
            "response_format": {"type": "json_object"},
        },
    )
    resp.raise_for_status()
    data = resp.json()
    content = data["choices"][0]["message"]["content"]
    return json.loads(content)
```

### 3.2 Provider failover (not an agent framework)

**File:** `config/provider_router.py` L100–123

- Tries providers in order: `LLM_PRIMARY` (default `deepseek`) → `LLM_FALLBACK` (default `groq`) → any remaining keyed providers (`openai`).
- Models: `deepseek-chat`, `llama-3.3-70b-versatile`, `gpt-4o-mini` (L35–52).
- Any exception from `fn` → next provider; if all fail → `ProviderError`.
- Docstring mentions "PydanticAI-compatible interfaces" (L4) but specialists **do not use PydanticAI** despite `pydantic-ai==0.0.13` in `requirements.txt`.

### 3.3 Consequences of hand-rolled httpx + `json_object`

| Capability | Present? | Detail |
|---|---|---|
| **Tool calling** | No | No `tools` / `tool_choice` in the request body. The model never calls `get_cgm_scores` or `analyze_lab_panel`; Python fetches first, then the LLM only narrates. |
| **Multi-turn agent loop** | No | Exactly two messages (system + user). No assistant→tool→assistant cycle. |
| **Retries on malformed JSON** | No | `json.loads(content)` sits inside `call_llm`. A parse error is treated as a **provider failure** and may failover to another provider (good), but there is **no same-provider retry / repair prompt**. If all providers return non-JSON or empty choices, outer `except` → fallback insight. |
| **Schema-constrained decoding** | No | `response_format: {"type": "json_object"}` only forces *some* JSON object, not the Insight schema. No OpenAI `json_schema`, no Guided JSON / outlines, no PydanticAI `result_type=Insight`. Invalid `confidence` enums blow up later at `ConfidenceLevel(...)` and trigger fallback. |
| **Streaming** | No | Full response buffered; no SSE / `stream=True`. |
| **Token accounting** | No | `usage` from the completion response is never read. No cost, latency, or prompt/completion token logs beyond provider name. |
| **Tracing / observability** | No | Only `logger.info` / `logger.error` / `logger.warning`. No OpenTelemetry, Langfuse, LangSmith, or request IDs. |
| **Hardcoded timeout** | Yes | `httpx.AsyncClient(timeout=30)` — 30s total, not configurable per specialist or env. |
| **Temperature** | Yes | Hardcoded `0.3` in both (low-ish for structured cards; still allows claim wording variance). |
| **Max tokens** | No | Not set; provider defaults apply. |
| **Seed / determinism** | No | Not set. |
| **Content moderation / output filter** | No | No call to `check_medical_overreach` on the production path (see §5). |
| **Conversation memory** | No | Stateless per invocation; no prior insights, coach prefs, or chat history. |

**User prompt construction:**
- CGM L75: `f"CGM scores (last {days_back} days):\n{json.dumps(context, indent=2)}"` — includes disclaimer string in the JSON blob.
- Biomarker L81: `f"Lab panel data:\n{json.dumps(context, default=str, indent=2)}"` — sends `summary` + panel metadata only (not full per-marker feature list unless nested inside `summary`).

**Insight assembly after LLM (both):**
- Evidence / actions built with permissive `.get()` defaults (`metric` → `"unknown"`, empty description OK).
- Category **forced** in code (`InsightCategory.NUTRITION` / `LABS`) — LLM `"category"` field is ignored.
- `source` / `trigger` stamped by code (`"cgm_specialist"`/`"nightly"` vs `"biomarker_specialist"`/`"event"`).
- Broad `except Exception` around assembly → fallback (CGM L145–147; biomarker L154–158).

---

## 4. Deterministic fallbacks

### 4.1 What triggers them

| Trigger | CGM | Biomarker |
|---|---|---|
| Upstream data missing / empty | `return None` (no fallback) — L57–59 | `return None` — L61–71 |
| All LLM providers fail (`ProviderError` or any exception from `with_failover`) | `_build_fallback_insight` — L105–107 | Same — L111–116 |
| LLM JSON maps but Insight construction fails (bad enum, unexpected types, etc.) | `_build_fallback_insight` — L145–147 | Same — L154–158 |

### 4.2 CGM `_build_fallback_insight` (`cgm_specialist.py` L150–230)

Threshold logic:
- `stability >= 75` **and** `spike >= 70` → HIGH confidence, "stable… Current fueling patterns may support…"
- `stability >= 50` → MEDIUM, "Moderate glucose variability… Consider reviewing…"
- else → MEDIUM, "Higher glucose variability… A nutritionist may help…"; `requires_coach_review=True`; adds `recommend` action with `requires_coach_approval=True`
- If `time_below_range_pct > 10` → append low-readings / pre-session fueling sentence

Always attaches 3 evidence chips (stability, spike, time_in_range) + a low-priority `monitor` action.

**Quality:** Surprisingly good for a template — same lifestyle tone as the prompt, numeric scores embedded in the claim, coach-review gate on high variability. Nearly identical copy already exists in `tools/cgm.py` `get_glucose_training_context` L224–232 (third copy of the same heuristics).

**Gaps vs LLM path / prompt:**
- Does **not** append `CGM_DISCLAIMER` into `claim` despite system-prompt rule "Always include the disclaimer".
- Does not use spike-only branches (prompt mentions low spike score; fallback only gates on stability + spike for the "stable" branch).
- Confidence never set to LOW.

### 4.3 Biomarker `_build_fallback_insight` (`biomarker_specialist.py` L161–224)

Threshold logic on summary counts:
- `abnormal > 0` → HIGH, coach review required, `consult_physician` high-priority action
- `elif suboptimal > 0` → MEDIUM, `monitor_trend` action, no coach review
- else → HIGH, "all biomarkers within optimal zone", no actions

Evidence chips = one per `summary["flags"]` entry (flagged markers only — optimal markers omitted).

**Quality:** Safe, terse, coach-oriented. Faithful to counts. Weaker prose than CGM (no hedging, no panel_type/lab_name/drawn_at in the claim). Unused import of `supabase_rpc` / `datetime` in the module suggest storage was once intended here but lives in the API route instead.

### 4.4 Can the user tell LLM vs fallback?

**No reliable signal in the Insight schema or API response.**

- Same `source` string (`"cgm_specialist"` / `"biomarker_specialist"`) for both paths.
- Same `trigger`, category, evidence shape.
- No `generation_mode`, `model`, `provider`, or `is_fallback` field on `Insight` (`schemas/insight.py` L58–82).
- Fallback claims are slightly more formulaic ("Lab panel received with N biomarker(s)…"; CGM embeds `/100` scores), but an LLM could emit the same style. Conversely, fallback CGM prose is natural enough to pass as model output.

**Implication:** Ops cannot audit how often the deterministic path is serving production insights without scraping logs (`"LLM failed for…"`).

---

## 5. Safety guardrails — prompt vs enforcement

### 5.1 Non-diagnostic / non-medical language rules

**In prompts (prompt-only):**
- CGM L23–29: lifestyle/fueling only; never diabetes/prediabetes/insulin/medical conditions; never prescribe; always include disclaimer.
- Biomarker L29–32: never diagnose or prescribe; non-medical actions only; coach review if outside normal range.

**In data layer:**
- `CGM_DISCLAIMER` (`tools/cgm.py` L28–32): *"Glucose scores are for lifestyle and fueling context only. They are not medical advice and do not diagnose diabetes or any metabolic condition. Consult a physician for medical concerns."*
- Tool design returns **scores only**, not raw glucose series, to the LLM (`tools/cgm.py` L9, docstring; specialist context L63–73).

**In eval (offline / tests only):**
- `eval/harness.py` `check_medical_overreach` L92–102 — regex over `MEDICAL_OVERREACH_PATTERNS` (diagnose, prescribe, diabetes, insulin, etc.).
- Used by `tests/test_cgm_specialist.py` L140–149 (parametrized **hand-written** bad strings, not live model output).
- Used by `tests/test_biomarkers.py` only as **prompt string assertions** (L124–144) — does not run over generated claims.
- Also covered in `tests/test_eval.py` and `tests/test_integration.py`.

### 5.2 What actually ENFORCES post-generation?

| Check | On LLM output before return? |
|---|---|
| `check_medical_overreach(claim)` | **No** |
| Disclaimer present in claim | **No** |
| Evidence values ⊆ tool results (`check_faithfulness`) | **No** (harness only) |
| Forbidden action types (prescribe, dose, etc.) | **No** |
| JSON Schema validation of full Insight from LLM | **Partial** — Pydantic construction; many fields `.get()`-softened; invalid confidence → fallback |
| Category whitelist | **Yes by override** — hardcoded category enum in constructor |
| Coach-review policy | **Partial** — biomarker LLM can set flag; CGM LLM flag trusted as-is; fallback CGM/biomarker set deterministically |

**Verdict: safety is prompt-only + offline tests. Production specialists do not validate or rewrite unsafe LLM claims.** A model that ignores the system prompt can emit diagnostic language and it will be stored if it still parses as an Insight.

Coach review (`requires_coach_review` / API `/insights/{id}/review`) is a **human gate for some insights**, not an automated content filter. CGM prompt example even suggests `requires_coach_review: false` by default.

---

## 6. Duplication and a shared base abstraction

### 6.1 Copy-paste inventory

The following blocks are structurally identical across CGM and biomarker (and largely `nightly_batch.py`):

1. Inner `call_llm` with httpx POST, timeout 30, temperature 0.3, `json_object`, `json.loads` (~25 lines).
2. `try: with_failover(...); except → fallback/None`.
3. EvidenceChip list comprehension with `.get()` defaults.
4. InsightAction list comprehension with `.get()` defaults.
5. Insight constructor with athlete/org/coach + claim/confidence/evidence/actions + source/trigger stamps.
6. Second `try/except` around Insight assembly → fallback.

**Approx. 70–90 lines** of orchestration are duplicated per specialist. Domain-specific deltas are small:
- System prompt constant
- Data fetch + early exit
- Context dict keys
- Fallback heuristic function
- Hardcoded `category`, `source`, `trigger`
- Default action priority (`"low"` CGM vs `"medium"` biomarker)

### 6.2 Suggested shared abstraction (design only — not implemented)

```text
SpecialistSpec:
  name: str                    # "cgm_specialist"
  system_prompt: str
  category: InsightCategory
  trigger: str                 # "nightly" | "event"
  temperature: float = 0.3
  timeout_s: float = 30

async def generate_insight(spec, *, fetch_context, build_fallback, ids...) -> Optional[Insight]:
  context = await fetch_context()
  if context is None: return None
  user_prompt = render(context)
  try:
      raw = await complete_json(spec, user_prompt)   # shared httpx + failover + optional repair
      insight = map_insight(raw, spec, ids)          # shared mapping
      insight = enforce_safety(insight, context)     # NEW: overreach + faithfulness
      return insight
  except Exception:
      return build_fallback(context, ids)
```

Optional upgrades inside `complete_json`:
- Use PydanticAI `Agent` with `result_type=InsightDraft` (dependency already in requirements).
- Retry once with "fix JSON to schema" repair message.
- Capture `usage`, provider name, latency into Insight metadata / logs.
- Stream or not as a policy flag.

---

## 7. What is missing to make these real agents

| Capability | Current state | Gap |
|---|---|---|
| **Tool use** | Tools exist in `tools/registry.py` and are used *by the host* before the LLM call | Agent cannot decide to fetch trends, compare prior panels, pull training load, or re-query CGM windows |
| **Planning** | Single fixed pipeline | No goal decomposition ("check abnormal → pull trends → draft coach note") |
| **Multi-step reasoning** | One completion | No intermediate scratchpad, no deliberative sampling, no debate between specialists |
| **Self-critique** | None | No second pass ("does this claim invent numbers? medical language?") |
| **Evidence linking / faithfulness** | Prompt asks for chips; harness can check offline | No runtime check that evidence values ⊆ tool payload; biomarker optimal zones drop on the floor |
| **Memory** | Stateless | No prior insights, coach edits, athlete preferences, or longitudinal panel history in context |
| **Orchestration** | Event hook / batch caller | No router that picks specialist(s), merges outputs, or escalates |
| **Human-in-the-loop as agent protocol** | Coach review API exists for stored insights | Not part of the generation loop (no revise-with-feedback turn) |
| **Streaming / progressive disclosure** | None | Coach UI waits for full card |
| **Eval in CI against live outputs** | Pattern tests + regex red-team on static strings | No golden tool-trace replay of specialist generations in the production path |
| **Wiring completeness** | Biomarker hooked; CGM specialist **orphaned** | `generate_cgm_nightly_insight` is never called from `nightly_batch` or routes — only fallback unit-tested |

### Minimal bar to call them "agents"

1. LLM-visible tools (at least: fetch scores/panel, fetch trend, fetch related training context).
2. A loop with terminate condition (max N steps) and structured final `Insight`.
3. Post-generation validators: medical-overreach fail → regenerate or fallback; faithfulness fail → strip/repair evidence.
4. Provenance fields: `provider`, `model`, `is_fallback`, token usage.
5. Wire CGM into nightly batch; share one completion client (preferably PydanticAI already in deps).

---

## 8. Test coverage notes (from required test files)

### `tests/test_cgm_specialist.py`
- Exercises **only** `_build_fallback_insight` branches (stable / moderate / high / low readings / evidence chips).
- Safety tests assert **prompt string contents** and that fallback claims lack diabetes/insulin language.
- Parametrized medical-overreach tests feed **synthetic strings** into `check_medical_overreach` — never mocks the LLM path of `generate_cgm_nightly_insight`.
- **No test** calls `generate_cgm_nightly_insight` (async LLM path untested).

### `tests/test_biomarkers.py`
- Majority covers `tools/optimal_zones.py` classification math (valuable, but not the specialist).
- `TestBiomarkerSpecialistSafety` only greps `PANEL_LANDED_SYSTEM` for "never diagnose", "prescribe", "non-medical", `"category": "labs"`.
- Tool registry smoke tests for biomarker tools.
- **No test** of `_build_fallback_insight` or `generate_panel_landed_insight`.

---

## 9. File / line reference index

| Artifact | Path | Lines |
|---|---|---|
| CGM system prompt | `agent/cgm_specialist.py` | 18–41 |
| CGM entry + fetch | same | 44–75 |
| CGM httpx call | same | 78–101 |
| CGM failover + map | same | 103–147 |
| CGM fallback | same | 150–230 |
| Biomarker system prompt | `agent/biomarker_specialist.py` | 24–45 |
| Biomarker entry + fetch | same | 48–81 |
| Biomarker httpx call | same | 84–107 |
| Biomarker failover + map | same | 109–158 |
| Biomarker fallback | same | 161–224 |
| Provider failover | `config/provider_router.py` | 100–123 |
| Insight schema | `schemas/insight.py` | 40–82 |
| CGM disclaimer | `tools/cgm.py` | 28–32 |
| Medical overreach checker | `eval/harness.py` | 69–102 |
| Biomarker event wiring | `api/routes/insights.py` | 68–99 |
| Nightly sibling pattern | `agent/nightly_batch.py` | 35–55, 90–113 |
| pydantic-ai dep (unused here) | `requirements.txt` | 6 |

---

## 10. Bottom line

The specialist pattern is a **templated one-shot LLM JSON card generator** with a solid deterministic backup and strong *documented* non-medical intent. It is **not** an agentic system: no tools-in-the-loop, no multi-turn reasoning, no schema-constrained decoding, no production safety enforcement, no tracing/token accounting, and heavy duplication across modules. Safety lives in system prompts and pytest string checks; the runtime trusts the model (or the fallback) once JSON parses. Upgrading to a multi-agent architecture should start by extracting a shared `complete_json` + `map_insight` + `enforce_safety` layer, then adding tool loops and provenance — not by cloning a third near-identical specialist file.
