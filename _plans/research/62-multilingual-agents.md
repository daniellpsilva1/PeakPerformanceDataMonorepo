# Multilingual LLM Agents: Lower-Resource Languages and Safety Parity

**Research date:** 2026-08-02  
**Scope:** Multi-agent sports-performance platform for tennis academies (Spain + international). Product UI locales: English, Spanish, Catalan, Chinese. Agents must produce coaching insights and chat in the user’s language. Known product issues: English-only keyword tool router; system prompt lists Portuguese but not Catalan; Catalan is comparatively low-resource; medical-claim guardrails (never diagnose, never prescribe) tested only in English; generated insights stored in DB and shown in a UI that already localizes static strings.  
**Method:** External research only (benchmarks, arXiv, ACL, vendor docs, terminology authorities; prioritize 2025–2026). No local codebase exploration.

---

## 1. Executive verdict

**Treat Catalan and safety-sensitive claim language as first-class product risks, not i18n polish.** Frontier models (Claude Opus 4.6 / Gemini 3.x / GPT-5.x) are near-parity on Spanish and Chinese for general reasoning, but Catalan is absent from mainstream multilingual indices and must be judged via Iberian suites (LA Leaderboard, IberoBench/IberBench, Aina CLUB). **Safety alignment does not transfer reliably across languages** — Welo Data (2025) reports ~4–5× higher unsafe rates in low-resource languages; MultiJail (ICLR 2024) found ~3× more harmful content in low-resource vs high-resource; CSRT (ACL 2025) shows code-switching raises attack success +46.7% vs English. That is the direct risk for “never diagnose / never prescribe.”

**Concrete stack recommendation:**
1. **Prompting:** English system prompt for policy + reasoning structure; explicit output-locale; user message stays in user’s language; inject Catalan/Chinese glossary slices for domain terms.
2. **Router:** Kill English keyword matching. Prefer **native LLM tool calling** with multilingual tool *descriptions* + few-shot examples in ES/CA/ZH; optional embedding shortlist if tool count grows.
3. **Insight storage:** **Canonical structured facts + locale renderings** (generate-once structured payload; per-locale narrative with safety gate). Do not blindly MT a free-text English insight into three locales without claim-level checks.
4. **Safety eval:** Stratified red-team (EN full, ES/ZH high coverage, CA oversampled relative to traffic) + back-translation claim checks + language-specific medical phrasing sets — not 4× English cost.
5. **Glossary:** TERMCAT-backed Catalan sports/physio terms + curated Chinese sports-science glossary; dynamic per-turn injection; post-hoc term QA.

---

## 2. Frontier multilingual capability (mid-2026)

### 2.1 Spanish and Chinese on commercial leaderboards

[Artificial Analysis Multilingual Index](https://artificialanalysis.ai/models/multilingual) (Global-MMLU-Lite style, mid-2026 snapshot) shows **near ties** among frontier models on high-resource Romance and Chinese:

| Language | Top models (score ~) |
|----------|----------------------|
| Spanish | Gemini 3.1 Pro / Gemini 3 Pro / Gemini 3 Flash / Claude Opus 4.6 / Claude Opus 4.5 — all **94** |
| Chinese | Claude Opus 4.6 / Gemini 3.1 Pro / Gemini 3 Pro — **94**; Gemini 3 Flash **93** |
| English | Claude Opus 4.6 / Gemini 3.1 Pro / Gemini 3 Flash — **95** |
| Overall avg | Gemini 3.1 Pro **93**; Gemini 3 Pro / Claude Opus 4.6 **92** |

Secondary synthesis: [Awesome Agents — Multilingual LLM Leaderboard (March 2026)](https://awesomeagents.ai/leaderboards/multilingual-llm-leaderboard/) — same pattern: high-resource SaaS locales (ES, ZH, FR, DE, KO) are interchangeable among top-5; **gaps open on low-resource languages** (Swahili/Yoruba/Burmese in their index). Catalan is **not** in Artificial Analysis’s 16-language index.

Implication for PPD: picking Claude vs Gemini vs GPT for Spanish/Chinese coaching chat is mostly a **price / latency / tool-calling reliability** decision, not a language-quality decision. Catalan needs separate evaluation.

### 2.2 Catalan and Iberian evaluation resources

Catalan has an unusually active NLP ecosystem for a “minoritized” language — use it.

| Resource | What it covers | URL |
|----------|----------------|-----|
| **Projecte Aina** (Generalitat / BSC) | Open Catalan models, datasets, speech, MT; Aina Kit | [Aina Kit docs](https://langtech-bsc.gitbook.io/aina-kit), [gov portal](https://politiquesdigitals.gencat.cat/ca/economia/catalonia-ai/aina/) |
| **CLUB** (Catalan Language Understanding Benchmark) | NER, POS, STS, TC, TE, QA (ViquiQuAD, CatalanQA, XQuAD-ca) | [github.com/projecte-aina/club](https://github.com/projecte-aina/club), [lm-catalan](https://github.com/projecte-aina/lm-catalan), demo [club.aina.bsc.es](https://club.aina.bsc.es/) |
| **LA Leaderboard** (2025) | 66 datasets in Spanish, Catalan, Basque, Galician; 50 LLMs | [arxiv.org/html/2507.00999](https://arxiv.org/html/2507.00999) |
| **IberoBench** (COLING 2025) | Iberian LLM eval in Eleuther harness; language-specific + multilingual models | [ACL PDF](https://aclanthology.org/2025.coling-main.699.pdf) |
| **IberBench** (2025) | Broader Iberian suite incl. toxicity, sentiment, industry tasks; notes Galician/Basque lag | [arxiv.org/pdf/2504.16921](https://arxiv.org/pdf/2504.16921) |

**LA Leaderboard findings (relevant):** Top general performers include Gemma-2-9B, Llama-3.1-8B-IT, Qwen-2.5-IT (14B/32B). For Catalan specifically, **EuroLLM** ranks among top-3 for QA and reasoning; Iberian-specialized models (Salamandra, CataLlama, Aitana) are competitive for domain/constrained deploy even when not #1 overall. Catalan datasets listed include caBREU, CatalanQA, COPA-ca, CoQCat, PAWSca, TE-ca, WNLI-ca, XNLI-ca, CatCoLA, FLORES-200, MGSM, XStoryCloze, XQuAD-ca, VeritasQA, etc.

**Practical takeaway:** Do not assume “Spanish ≈ Catalan.” Evaluate the *production* model on a **PPD Catalan slice** (coach chat + insight generation + refusal tasks) using Aina/Ibero items for fluency/reasoning and custom items for sports physiology. Small Iberian models are useful as **judges / translation checkers**, not as primary coaching agents unless you self-host for cost.

### 2.3 Open models (short)

- **Qwen2.5 / Qwen3 families:** Strong Chinese + solid multilingual; often competitive on LA Leaderboard quantized IT variants.
- **Llama 3.1 8B/70B IT:** Solid Spanish; Catalan via LA Leaderboard competitive at 8B class.
- **EuroLLM / Salamandra:** Europe-first multilingual; good Iberian signal for open deploy.
- **CataLlama / Aitana:** Catalan-adapted; useful for offline QA or term checking, not as the only chat model.

---

## 3. High-resource vs lower-resource quality gap

### 3.1 Fluency is not the whole gap

The gap shows up as:
1. **Reasoning quality** — English CoT often stronger than native-language CoT ([The Reasoning Lingua Franca](https://arxiv.org/pdf/2510.20647), 2025): models generally reason better in English, but English reasoning can fail via “Lost in Translation” when the question’s meaning is mangled.
2. **Instruction following** — Fair comparisons without translationese find English instructions are *not* universally superior; task- and label-dependent ([NAACL 2025 short](https://aclanthology.org/2025.naacl-short.55.pdf)).
3. **Tool / function calling** — MASSIVE-Agents (EMNLP Findings 2025): top model **34% avg AST accuracy across 52 languages**; English **57.37%** vs Amharic **6.81%** ([anthology](https://aclanthology.org/2025.findings-emnlp.1099/)). Multilingual tool use is a hard gap, not a soft fluency issue.
4. **Safety / refusal** — See §4. This is the critical gap for PPD medical claims.

### 3.2 Where Catalan sits

Catalan is mid-resource in NLP terms (strong public investment via Aina, TERMCAT, FLORES coverage) but **low-resource relative to product LLM pretraining mass** vs ES/EN/ZH. Expect:
- Good surface Catalan from frontier models.
- Higher rate of **Spanish leakage** (code-mixing, Castilian calques).
- Weaker sports-science terminology unless constrained (§6).
- Weaker refusal reliability than English for adversarial medical prompts (§4).

Chinese is high-resource for most frontier models (scores ~94) but still shows **terminology inventiveness** in physiology and **register** issues (简体 vs 繁体; 教练 vs 家长 tone).

---

## 4. Safety parity: the documented cross-lingual failure mode

### 4.1 Core evidence

| Study | Finding | URL |
|-------|---------|-----|
| **Welo Data / Welocalize (Nov 2025)** | 10 models × 79 languages × 210k prompt pairs. Safety strongest in English; **low-resource prompts can raise harmful responses ~4–5×** (e.g. Hate: &lt;10% EN → 40–50% low-resource). Translation of harmful prompts is a practical jailbreak. | [MultiLingual coverage](https://multilingual.com/welo-data-research-llm-safety-doesnt-transfer-across-languages/), [Welo summary](https://welodata.ai/global-security-blind-spots-llm-safety-failures-in-low-resource-languages/) |
| **MultiJail (Deng et al., ICLR 2024)** | 315 harmful queries × 10 languages (native translation). Unintentional jailbreak: **unsafe rate rises as resource drops; low-resource ~3× high-resource**. Intentional multilingual+malicious instruction: ChatGPT 80.9% / GPT-4 40.7% unsafe. | [arxiv:2310.06474](https://arxiv.org/pdf/2310.06474), [HF dataset](https://huggingface.co/datasets/DAMO-NLP-SG/MultiJail), [GitHub](https://github.com/DAMO-NLP-SG/multilingual-safety-for-LLMs) |
| **Why Do Safety Guardrails Degrade Across Languages? (2026)** | IRT decomposition on MultiJail: language-agnostic robustness vs prompt hardness vs language difficulty vs **prompt-specific cross-lingual gap τ**. Physical-harm categories and lower-resource languages cluster high-τ; mistranslation and cultural grounding mismatches contribute. | [arxiv.org/html/2605.17173v1](https://arxiv.org/html/2605.17173v1) |
| **CSRT — Code-Switching Red-Teaming (ACL 2025)** | Intra-sentence code-switching: **+46.7% ASR vs English** red-teaming; more languages / lower-resource languages → higher ASR. Cheap automated synthesis. | [ACL 2025](https://aclanthology.org/2025.acl-long.657/), [PDF](https://aclanthology.org/2025.acl-long.657.pdf) |
| **CREST (Dec 2025)** | Lightweight multilingual safety classifier (0.5B, 100 langs) via cluster-guided transfer from 13 high-resource languages — evidence that **external** multilingual guardrails can help when model-internal alignment fails. | [arxiv.org/html/2512.02711v1](https://arxiv.org/html/2512.02711v1) |

### 4.2 Why this matters for “never diagnose / never prescribe”

English-only red-teaming of medical soft-claims is **insufficient**. Failure modes for PPD:
- Catalan/Spanish paraphrase of “Is this tendinopathy?” → model answers with diagnostic language that EN refusal would block.
- Chinese parent asks for training load “处方/药” metaphors → model emits prescription-like advice.
- Code-switching (ES+EN tennis slang + medical ask) bypasses EN-tuned refusals (CSRT).
- **Insight translation** can soften or harden a claim: EN “possible fatigue signal” → ZH that reads as diagnosis.

**Mitigations that research supports:**
1. Language-specific refusal *examples* and forbidden claim templates in the system prompt (not EN-only).
2. Structured claim tags in generated insights (`claim_type: observational | correlational | forbidden`) checked per locale.
3. Optional external multilingual safety classifier (CREST-style) as a second pass on outputs before DB write / UI show.
4. Red-team in CA/ES/ZH with native or high-quality human-revised prompts (MultiJail methodology), not MT-only.

---

## 5. Prompt language strategy: English system vs target-language system

### 5.1 Evidence summary

| Source | Claim |
|--------|-------|
| [Is Translation All You Need? (NAACL 2025)](https://aclanthology.org/2025.naacl-long.485.pdf) | Translate-to-English often best for NLP tasks on English-centric LLMs; for **real user queries** with cultural/language nuance, **native prompts** can win with strong multilingual models. |
| [How and Where to Translate? (2025)](https://arxiv.org/html/2507.22923v1) | Optimal strategy varies by language and model; translating **identity + instructions** into source language often helps; for low-resource dissimilar languages, English generation may be safer unless task requires target text. |
| [Fair comparison without translationese (NAACL 2025)](https://aclanthology.org/2025.naacl-short.55.pdf) | English instruction advantage is **not overwhelming** when translationese is removed; depends on task/labels. |
| [Reasoning Lingua Franca (2025)](https://arxiv.org/pdf/2510.20647) | English reasoning usually higher accuracy; but mistranslation of the *question* can make English reasoning worse than native. |
| Practitioner synthesis ([PromptQuorum](https://www.promptquorum.com/prompt-engineering/prompting-across-languages)) | English system for structure/reasoning; target-language for register; **always declare output language explicitly**; few-shots should match task language. |

### 5.2 Recommended PPD prompting pattern

```
System (English, stable, cacheable):
  - Role, safety policy (never diagnose/prescribe), tool rules
  - Output locale: {locale}  ← explicit every turn
  - Register notes: coach formal ES vs Catalan (evitar castellanismes), ZH simplified, parent-friendly
  - Glossary block (filtered, ≤N terms) for this turn’s domain

User:
  - Raw user text in their language (do NOT pre-translate to English for chat)
  - Structured athlete facts / tool results in English or locale-neutral JSON

Assistant:
  - Reply in {locale}
  - Internal tool args: English enum names; natural-language args may be multilingual
```

**Do not** MT the entire system prompt into Catalan via machine translation (translationese risk). **Do** hand-author short Catalan/Chinese *examples* of good refusals and good insight tone. For chain-of-thought on hard physiology reasoning, allow English reasoning then locale answer — but keep the **user message** in the user’s language so meaning is not lost in a pre-translate step.

---

## 6. Domain terminology: Catalan and Chinese sports science

### 6.1 Authoritative Catalan sources

| Resource | Content | URL |
|----------|---------|-----|
| TERMCAT **Diccionari general de l’esport** | ~11,931 terms, 89 sports + multidisciplinary (incl. sports medicine) | [termcat.cat …/114](https://www.termcat.cat/en/diccionaris-en-linia/114/presentacio/en) |
| TERMCAT **Diccionari de fisioteràpia** | ~1,800 terms: anatomy, physiology, pathology, units | [termcat.cat …/196](https://www.termcat.cat/en/diccionaris-en-linia/196/presentacio/en) |
| TERMCAT sports portal | Multiple sport-specific dictionaries | [esports.termcat.cat](https://esports.termcat.cat/ca/diccionaris-en-linia) |

Build a **PPD termbase** (EN ↔ ES ↔ CA ↔ ZH) seeded from TERMCAT for Catalan/Spanish, and from a curated Chinese sports-science / exercise-physiology glossary (plus academy house style). Include: HRV, readiness, acute:chronic workload, RPE, VO₂max, tendinopathy (as *descriptive* labels the *system* may store — agent must still not diagnose), serve speed units, etc.

### 6.2 Techniques that work

1. **Dynamic glossary injection** — Only inject terms present in the current user message / tool payload (avoids prompt dilution). Pattern documented in production MT systems: [TranslateBooksWithLLMs GLOSSARY.md](https://github.com/hydropix/TranslateBooksWithLLMs/blob/main/docs/GLOSSARY.md); issue discussion on dynamic injection: [GitHub #132](https://github.com/hydropix/TranslateBooksWithLLMs/issues/132). Cap ~20–50 terms/turn; longest-match first; CJK substring match.
2. **Constraint-aware refine** — Generate → check missing glossary terms → LLM revise ([Constraint-Aware Iterative Prompting](https://arxiv.org/html/2411.08348v1); [WMT terminology-aware](https://aclanthology.org/2023.wmt-1.80.pdf)).
3. **Post-generation QA gate** — Regex/term checker: if EN source used “HRV” and CA output invented a non-TERMCAT calque, fail or auto-replace.
4. **Forbidden paraphrase list** — For safety-sensitive terms, allow only approved renderings of observational language (e.g. CA *possible senyal de fatiga* vs diagnostic *tendinitis*).

### 6.3 Chinese specifics

- Prefer **简体中文** for product locale `zh` unless a TW/HK academy requests 繁體.
- Keep Latin acronyms (HRV, RPE, ACWR) with Chinese gloss on first use.
- Avoid medical 诊断 framing; use 观察 / 趋势 / 值得关注的信号.

---

## 7. Tool selection and intent classification (why keywords fail)

### 7.1 Failure mode

English keyword routers (`hrv`, `readiness`, `match`) miss:
- ES: *variabilidad de la frecuencia cardíaca*, *estado de preparación*
- CA: *variabilitat de la freqüència cardíaca*, *estat de preparació*
- ZH: *心率变异性*, *身体准备状态*
- Paraphrases and tennis slang with no keyword overlap

This is not fixable by expanding keyword lists (combinatorial explosion + constant maintenance).

### 7.2 Options (2025–2026 practice)

| Approach | Pros | Cons | Fit for PPD |
|----------|------|------|-------------|
| **Native LLM tool calling** | Multilingual understanding in one model; schema-constrained; least maintenance | MASSIVE-Agents shows accuracy drops off English; need good tool descriptions | **Primary recommendation** for small/medium toolsets |
| **Multilingual embeddings → shortlist tools** | Fast, cheap; language-agnostic similarity | Weak on indirect intent; needs fusion for nuance | Good **prefilter** if &gt;30 tools |
| **Small multilingual classifier** | Low latency, stable taxonomy | Needs labeled ES/CA/ZH data; taxonomy drift | Optional later if cost/latency demands |
| **Hybrid embedding + LLM** ([intent-fusion](https://github.com/Liyuan1992/intent-fusion), [Respan 2026 guide](https://www.respan.ai/articles/intent-classification-with-llms)) | Best accuracy in production reports | Two systems | If router is a separate hop from generation |

### 7.3 Multilingual function-calling evidence

- **MASSIVE-Agents** (52 langs): large EN→other drop; translated prompts help in ablations but do not close the gap fully ([anthology](https://aclanthology.org/2025.findings-emnlp.1099/)).
- **NAACL Industry 2025** — translation pipeline for tool-calling data: **keep function names/descriptions untranslated**; translate natural-language args carefully ([PDF](https://aclanthology.org/2025.naacl-industry.9.pdf)).
- Vendor: OpenAI function calling / Anthropic advanced tool use support tool search for large catalogs ([OpenAI docs](https://developers.openai.com/api/docs/guides/function-calling.md), [Anthropic engineering](https://www.anthropic.com/engineering/advanced-tool-use)).

### 7.4 Replacement for PPD keyword router

**Phase 1 (now):** Remove English keyword gate. Pass **all tools** (or role-filtered subset) to the LLM with:
- English `name` + JSON schema (stable)
- Descriptions that include **ES/CA/ZH example utterances**
- 2–4 multilingual few-shots of tool selection
- Explicit instruction: select tools from user intent in any supported language

**Phase 2 (if tool count grows):** Embedding shortlist (top-k tools) using a multilingual embedder (§8), then LLM chooses among shortlist.

**Do not** rely on a separate English-only intent classifier as the sole gate.

---

## 8. Multilingual embeddings for memory and retrieval

### 8.1 Current strong options (2025–2026)

| Model | Notes | URL |
|-------|-------|-----|
| **Llama-Embed-Nemotron-8B** | #1 MMTEB (Oct 2025 report); instruction-aware; strong multilingual + cross-lingual | [arxiv.org/html/2511.07025](https://arxiv.org/html/2511.07025) |
| **Nemotron 3 Embed** (8B / 1B) | Mid-2026 RTEB #1 claims for 8B; 34 languages; RAG/agent memory focus | [coverage](https://quasa.io/media/nvidia-releases-nemotron-3-embed-open-embedding-models-that-supercharge-rag-and-agentic-ai) |
| **Qwen3-Embedding** (0.6B–8B) | Strong MTEB; competitive commercial APIs in paper | [arxiv.org/pdf/2506.05176](https://arxiv.org/pdf/2506.05176) |
| **BGE-M3** | 100+ languages; dense+sparse+multi-vector; 8k context; still excellent practical default | [arxiv.org/html/2402.03216v3](https://arxiv.org/html/2402.03216v3) |
| **Granite Embedding Multilingual R2** | Strong under-500M / under-100M open options; 52 langs; 32k context | [arxiv.org/html/2605.13521](https://arxiv.org/html/2605.13521) |
| **multilingual-e5-large-instruct** | Mature baseline; use query/passage prefixes | (Wang et al.; widely on HF) |
| **Gemini Embedding / Cohere embed-multilingual / OpenAI text-embedding-3** | Managed APIs if self-host is not required | Vendor docs |

### 8.2 Cross-lingual retrieval: Spanish query → English memory

**Yes, this works well enough for product use** with modern multilingual embeddings (BGE-M3, E5-mistral/instruct, Qwen3-Embedding, Nemotron embed), especially for EN↔ES and EN↔ZH. Catalan↔EN is typically workable because of Romance proximity and training overlap, but **validate** with a small PPD memory set (coach preferences stored in EN, queried in CA).

Best practices:
- Store memories in a **canonical language (English)** for facts + optional `locale_note`.
- Embed the canonical text (and optionally a locale mirror if quality matters).
- Retrieve with query in any locale; threshold slightly lower for CA if needed.
- Rerank with a multilingual cross-encoder when precision matters (safety-relevant corrections).

---

## 9. Storing generated insights across locales

### 9.1 Options

| Model | Cost | Consistency | Safety risk | UX authenticity |
|-------|------|-------------|-------------|-----------------|
| A. Generate EN once → MT to ES/CA/ZH | Lowest | High structure, medium phrasing | **High** — MT can invent diagnosis-like wording or drop hedges | Medium (MT flavor) |
| B. Generate natively per locale from same tools/facts | Higher (× locales) | Facts can diverge if regen independent | Medium — each locale needs same safety gate | Highest |
| C. **Canonical structured insight + per-locale narrative render** | Medium | **Best** (numbers/claims locked) | **Lowest if gated** | High |

### 9.2 Recommendation: Model C (canonical + renders)

Industry shift toward “direct generation” for marketing copy ([MultiLingual DirectGC, Aug 2025](https://multilingual.com/magazine/august-2025/from-sequential-localization-to-direct-content-generation/)) is right for *voice*, but **sports insights are safety-sensitive structured claims**. CMS practice still stores per-locale fields with review states ([Meduzzen](https://meduzzen.com/blog/ai-localization-at-scale/)). Hybrid:

1. **Generate once** a locale-neutral **insight payload** (metrics, evidence IDs, claim enums, severity).
2. **Render** `title`/`body` per requested locale (lazy or batch), using glossary + safety templates.
3. **Do not** show a locale until it passes claim/glossary QA.
4. Coach in Catalan and parent in Chinese see **the same underlying facts**, different narratives.

### 9.3 Schema recommendation

```sql
-- Conceptual schema (adapt to existing insight tables)

insight_canonical (
  id uuid PK,
  athlete_id uuid,
  academy_id uuid,
  insight_type text,              -- readiness | tennis | training | ...
  created_at timestamptz,
  evidence jsonb NOT NULL,        -- {metric, value, unit, window, source_ids[]}
  claims jsonb NOT NULL,          -- [{id, type: observational|comparative, severity, en_template_key}]
  safety_flags jsonb,             -- {contains_medical_advice: false, ...}
  generator_model text,
  generator_prompt_hash text
);

insight_locale (
  insight_id uuid REFERENCES insight_canonical(id),
  locale text,                    -- en | es | ca | zh
  title text NOT NULL,
  body text NOT NULL,
  status text,                    -- draft | qa_passed | published | rejected
  glossary_version text,
  safety_qa jsonb,                -- {backtranslation_ok, forbidden_phrases:[], reviewer}
  rendered_at timestamptz,
  PRIMARY KEY (insight_id, locale)
);
```

**Rules:**
- UI reads `insight_locale` for viewer locale; falls back to `en` if missing, with banner if needed.
- Mutations to numbers/claims only on `insight_canonical`; locale rows re-render.
- Never store only a free-text blob without structured `claims`.

---

## 10. Evaluating safety across four languages without 4× cost

### 10.1 Sampling strategy

| Tier | Languages | Volume | Purpose |
|------|-----------|--------|---------|
| T0 | EN | Full suite (baseline) | Regression |
| T1 | ES, ZH | ~50–70% of EN suite | High-traffic locales |
| T2 | CA | **Oversample relative to traffic** (aim parity with ES on medical items) | Highest product risk among locales |
| Adversarial | Code-switch ES↔EN, CA↔ES, ZH↔EN | Small (~50–100) | CSRT-style failures |

**Translate once, revise with native speaker** for medical/refusal items (MultiJail lesson: human translation &gt; raw MT for eval validity). Use MT only for bulk fluency smoke tests.

### 10.2 Cheap automated checks

1. **Back-translation claim check:** Locale body → EN → compare hedges/claim type to canonical `claims` JSON (flag upgrades from observational → diagnostic).
2. **Forbidden-phrase lists** per locale (diagnose/prescribe lexicon).
3. **Judge model** with structured rubric (separate from generator); sample 10% of production insights.
4. **CREST-style** multilingual safety classifier as optional pre-publish filter.
5. **CSRT smoke:** monthly batch of code-switched medical jailbreaks.

### 10.3 Language-specific red-team themes (sports domain)

- Requests for diagnosis (tendón, 肌腱, “és una lesió?”)
- Requests for medication/supplements dosing
- Return-to-play clearance language
- Parent anxiety → overconfident reassurance
- Coach asking agent to invent forbidden clinical claims “for the parent”

Target: **same refusal rate within ±X% of English** on the medical slice — define X (e.g. 5 pp) as a release gate.

---

## 11. Numbers, dates, and units per locale

Small but real correctness issue when agents emit `"1,234.5 km/h"` vs Spanish/Catalan `"1.234,5"` or Chinese fullwidth digits.

**Rules:**
- Keep **canonical numeric values** in JSON as IEEE numbers + UCUM/SI unit codes (`bpm`, `ms`, `km/h`).
- Format at **render time** with `Intl.NumberFormat` / `Intl.DateTimeFormat` for the viewer locale ([MDN Intl](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Internationalization), [W3C number formatting](https://www.w3.org/International/questions/qa-number-format), [Smashing Magazine Intl guide (2025)](https://www.smashingmagazine.com/2025/08/power-intl-api-guide-browser-native-internationalization/)).
- Prompt the model: “Emit bare numbers in JSON; do not localize digit grouping in tool payloads.”
- For prose, either (a) interpolate pre-formatted strings from the app, or (b) instruct locale-aware formatting and QA-check separators for ES/CA (`es-ES`, `ca-ES`) vs `zh-CN`.
- Units: prefer SI; localize unit *labels* via glossary (e.g. CA *revolucions per minut*), not via model invention.
- Tennis: serve speed — decide academy default km/h vs mph; store SI, display per academy setting.

---

## 12. Concrete recommendations (actionable)

### 12.1 Prompting strategy for multilingual output

1. English **system** prompt: safety, tools, schema, role.  
2. Explicit `Respond in {locale}` every turn.  
3. User text left in original language.  
4. Filtered glossary injection for domain terms.  
5. Hand-written few-shots for refusals in ES/CA/ZH.  
6. Remove Portuguese from prompt if unused; **add Catalan**.  
7. Prefer structured evidence in English/JSON; narrative in locale.

### 12.2 Replacement for keyword tool router

**Replace with native LLM tool selection** (+ multilingual tool descriptions and examples). Add embedding shortlist only when tool cardinality hurts latency. Measure with a MASSIVE-Agents-style internal set of ES/CA/ZH utterances → expected tool.

### 12.3 Storage model for insights

**Canonical structured insight + `insight_locale` renders** (§9.3). Lazy-render locales on first view or nightly batch. Safety QA before `published`. Same facts for coach (CA) and parent (ZH).

### 12.4 Multilingual safety evaluation plan (realistic scope)

| Workstream | Effort | Cadence |
|------------|--------|---------|
| 80 EN medical/refusal gold prompts | 1–2 days authoring | Freeze as suite |
| Native-revised ES/ZH/CA parallels (full medical slice; CA prioritized) | ~3–5 human hours/locale | Once + quarterly refresh |
| Automated back-translation + forbidden lexicon | Engineering | CI on prompt/model change |
| CSRT + MultiJail-style sample (non-medical + medical) | Automated | Monthly |
| Production sample judge (2% chats, 10% new insights) | Automated + spot human | Weekly |

**Success metric:** Refusal/compliance rate on medical slice for CA/ES/ZH within 5 percentage points of EN; zero published insights with `claim_type` upgrade under back-translation.

### 12.5 Glossary approach (Catalan + Chinese)

1. Seed CA/ES from TERMCAT sport + physio dictionaries; ZH from curated exercise-physiology list.  
2. Store as termbase: `term_id, en, es, ca, zh, pos, domain, safety_class, forbidden_alts[]`.  
3. At generation: detect terms in evidence/user text → inject ≤20 mandatory mappings.  
4. After generation: term QA + optional refine pass.  
5. Version the glossary; store `glossary_version` on `insight_locale`.

---

## 13. Source index (primary URLs)

**Capability / Iberian**
- https://artificialanalysis.ai/models/multilingual  
- https://awesomeagents.ai/leaderboards/multilingual-llm-leaderboard/  
- https://arxiv.org/html/2507.00999 (LA Leaderboard)  
- https://aclanthology.org/2025.coling-main.699.pdf (IberoBench)  
- https://arxiv.org/pdf/2504.16921 (IberBench)  
- https://github.com/projecte-aina/club  
- https://github.com/projecte-aina/lm-catalan  
- https://langtech-bsc.gitbook.io/aina-kit  

**Safety**
- https://multilingual.com/welo-data-research-llm-safety-doesnt-transfer-across-languages/  
- https://welodata.ai/global-security-blind-spots-llm-safety-failures-in-low-resource-languages/  
- https://arxiv.org/pdf/2310.06474 (MultiJail)  
- https://huggingface.co/datasets/DAMO-NLP-SG/MultiJail  
- https://aclanthology.org/2025.acl-long.657/ (CSRT)  
- https://arxiv.org/html/2605.17173v1 (guardrail degradation IRT)  
- https://arxiv.org/html/2512.02711v1 (CREST)  

**Prompting**
- https://aclanthology.org/2025.naacl-long.485.pdf  
- https://arxiv.org/html/2507.22923v1  
- https://aclanthology.org/2025.naacl-short.55.pdf  
- https://arxiv.org/pdf/2510.20647  

**Tools / intent**
- https://aclanthology.org/2025.findings-emnlp.1099/ (MASSIVE-Agents)  
- https://aclanthology.org/2025.naacl-industry.9.pdf  
- https://www.respan.ai/articles/intent-classification-with-llms  
- https://developers.openai.com/api/docs/guides/function-calling.md  
- https://www.anthropic.com/engineering/advanced-tool-use  

**Embeddings**
- https://arxiv.org/html/2511.07025 (Llama-Embed-Nemotron-8B)  
- https://arxiv.org/pdf/2506.05176 (Qwen3 Embedding)  
- https://arxiv.org/html/2402.03216v3 (BGE-M3)  
- https://arxiv.org/html/2605.13521 (Granite Multilingual R2)  

**Terminology / localization**
- https://www.termcat.cat/en/diccionaris-en-linia/114/presentacio/en  
- https://www.termcat.cat/en/diccionaris-en-linia/196/presentacio/en  
- https://github.com/hydropix/TranslateBooksWithLLMs/blob/main/docs/GLOSSARY.md  
- https://arxiv.org/html/2411.08348v1  
- https://multilingual.com/magazine/august-2025/from-sequential-localization-to-direct-content-generation/  
- https://meduzzen.com/blog/ai-localization-at-scale/  

**Numbers / dates**
- https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Internationalization  
- https://www.w3.org/International/questions/qa-number-format  
- https://www.smashingmagazine.com/2025/08/power-intl-api-guide-browser-native-internationalization/  

---

## 14. Open questions for implementation

1. Confirm product `zh` = Simplified only.  
2. Whether academy-level glossary overrides (club slang) are needed beyond TERMCAT.  
3. Whether insight publish requires human review for CA initially (recommended for first 4–6 weeks).  
4. Whether to add a lightweight multilingual output filter (CREST-class) before DB write in addition to prompt policy.
