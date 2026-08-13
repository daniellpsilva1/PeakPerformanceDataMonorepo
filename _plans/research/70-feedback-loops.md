# 70 — Closing the Feedback Loop Without Large-Scale RLHF

**Research date:** 2026-08-02  
**Scope:** How a sports-performance multi-agent system with hundreds of athletes and tens of coaches can measurably improve from modest explicit feedback (hundreds to low thousands of labels/year), without pretending we have RLHF-scale preference data.  
**Audience:** Product + engineering deciding what to build now vs. never.

---

## 1. Executive judgment

At our volume, the realistic value of coach feedback is almost entirely in **observability, error analysis, prompt iteration, dynamic gold demos, and preference memory** — not in weight updates. Automated prompt optimization (especially **GEPA**, which consumes natural-language reason codes) becomes viable once we have ~50–100 curated failure cases with rich textual diagnoses. **KTO matches our data shape** (binary thumbs) but is **not viable at our scale** for a useful fine-tune; published KTO results use large public preference corpora (Anthropic-HH, SHP, OASST, UltraFeedback), not a few hundred product labels. **Fine-tuning locks you to a base model** that will be obsolete within months; for a small team calling frontier APIs, that is usually a bad trade.

The primary product risk is not “we don’t have enough data to train.” It is **optimizing for thumbs-up** and teaching the system to tell coaches what they want to hear. OpenAI’s April 2025 GPT-4o sycophancy rollback is the clearest production proof that short-term preference signals can dominate truthfulness.

---

## 2. The realistic ladder (cheap → expensive)

| # | Method | Data volume to *work* | Engineering cost | Expected gain at our scale | Verdict for PPD |
|---|--------|----------------------|------------------|----------------------------|-----------------|
| 1 | Feedback as observability / error analysis | **10–50** labeled failures with reason codes; useful from day 1 | Low (schema + dashboards + weekly review) | High: finds systematic bugs (wrong athlete, bad unit, hallucinated metric) that no training run will fix | **Do now** |
| 2 | Prompt iteration from failure analysis | **20–100** clustered failures; each cluster → one prompt/rule change | Low–medium (eval set + versioned prompts) | High if failures are systematic; near-zero if failures are random noise | **Do now** |
| 3 | Dynamic few-shot from approved outputs | **30–200** approved gold demos in a vector store; gains appear ~30+ | Medium (embeddings, retrieval, curation, staleness) | Medium–high for format, tone, and “how we coach”; double-digit lifts vs static few-shot in published work | **Graduate when ≥50 approved** |
| 4 | Preference memory in context | **5–50** durable prefs per coach/org (not thousands of events) | Low–medium (extract + store + inject + expire) | Medium for style/priority (“never prescribe load when readiness < X”); weak for factual correctness | **Do early, carefully** |
| 5 | Automated prompt optimization (MIPROv2 / GEPA) | **20–100** labeled examples for GEPA; **~50–200+** for MIPROv2 (DSPy: ≥200 recommended for longer MIPRO runs) | Medium (DSPy program, metric, reflection LM spend) | Medium–high: GEPA claims up to **35× fewer rollouts than GRPO**, **+10%+ over MIPROv2**; industrial validation at Nubank | **Graduate when eval set ≥50 with text feedback** |
| 6 | SFT on approved outputs | **~500–1,000+** high-quality demos for reliable domain style (LIMA: 1k curated; some QA activation claims ~60 — not a coaching-insight bar) | High (training, eval, deploy, retrain on base upgrades) | Uncertain / often negative ROI vs next frontier model | **Defer; usually skip** |
| 7 | Preference optimization (DPO / KTO / ORPO) | **DPO: ≥~1,000 pairs** (vendors); **KTO: same order of magnitude of binary labels** as public corpora experiments — not hundreds | Very high | Low expected gain at our volume; high sycophancy risk if optimizing thumbs | **Not for years at current volume** |

### 2.1 Evidence for data-volume thresholds (the crux)

**Observability / prompt iteration (rungs 1–2)**  
- Industry guidance treats thumbs as *labels attached to traces*, not as training fuel: correlate rating → responseId / traceId / model / prompt version / tools ([Training Boss, thumbs architecture](https://thetrainingboss.com/thumbs-up-down-for-llm-responses/); [Microsoft DS + AI on beyond thumbs](https://medium.com/data-science-at-microsoft/beyond-thumbs-up-and-thumbs-down-a-human-centered-approach-to-evaluation-design-for-llm-products-d2df5c821da5)).  
- A few dozen *diagnostic* failures beat thousands of bare thumbs-down. Microsoft’s feedback-evaluation patent framing: “not helpful” alone is almost useless; structured feature tags are what drive fixes ([Patentlyze summary](https://patentlyze.com/patent/microsoft-ai-assistant-feedback-evaluation-system/)).

**Dynamic few-shot (rung 3)**  
- Production write-ups report ~**8pp** accuracy lift once the gold store crosses ~**30** examples, with further gains as the store grows ([Gemini Lab dynamic few-shot](https://gemilab.net/en/articles/gemini-api/gemini-api-dynamic-fewshot-vector-retrieval-production)).  
- Broader 2025–2026 comparisons: dynamic embedding retrieval often beats static few-shot by **double-digit** margins (e.g. clinical note classification +21.1% macro-F1 vs static; KGQA +12–21 F1) ([Tianpan, 2026-04](https://tianpan.co/blog/2026-04-12-dynamic-few-shot-retrieval-static-examples-accuracy)).  
- Biomedical NER: structured static prompting + dynamic retrieval; strong results with relatively small annotation pools ([npj Artificial Intelligence, 2025](https://www.nature.com/articles/s44387-025-00062-2)).  
- Dynamic ICL via kNN: +14.5 points vs static 4-shot on BioASQ in one 2026 RAG study ([Reason and Verify, arXiv:2603.10143](https://arxiv.org/pdf/2603.10143)).

**Automated prompt optimization (rung 5)**  
- **DSPy optimizer ladder** (official guidance): ~10 examples → `BootstrapFewShot`; ≥50 → `BootstrapFewShotWithRandomSearch`; longer MIPROv2 runs want **~200+** examples to reduce overfitting ([DSPy optimizers docs](https://github.com/stanfordnlp/dspy/blob/main/docs/docs/learn/optimization/optimizers.md)).  
- **GEPA** (Agrawal et al., 2025; ICLR 2026 Oral): reflective evolution using **score + natural-language feedback**; “often turn even just a few rollouts into a large quality gain”; **up to 35× fewer rollouts than GRPO**, average +6% / up to +20% vs GRPO; **>10% over MIPROv2** (e.g. +12% on AIME-2025) ([arXiv:2507.19457](https://arxiv.org/abs/2507.19457); [DSPy GEPA overview](https://dspy.ai/api/optimizers/GEPA/overview/); [gepa-ai/gepa](https://github.com/GEPA-ai/GEPA)). Practitioner guidance: **20–100 labeled examples** + feedback-rich metric ([Particula, 2026](https://particula.tech/blog/dspy-gepa-vs-miprov2-automatic-prompt-optimization); [Morph summary](https://www.morphllm.com/gepa-prompt-optimization)).  
- **Independent / industrial validation of GEPA:**  
  - **Nubank** (arXiv:2606.08867): GEPA inside DSPy optimized LLM-as-judge prompts using free-text human rationales; E2 eval accuracy **68.88% → 88.89%**; Cohen’s κ across models **0.00 → 0.745**; reported production wins +37pp AI transactional NPS, +29pp self-service ([paper](https://arxiv.org/html/2606.08867); [GEPA showcase commit](https://github.com/gepa-ai/gepa/commit/af5f75d3be952984dfbedf9d7c1e57ed5f78748d)).  
  - **Microsoft AI MAI-Thinking-1**: GEPA/DSPy used to optimize a Qwen3-30B judge prompt for code-page filtering (~2,000 human labels → large curated corpus) ([GEPA README citations](https://github.com/GEPA-ai/GEPA)).  
  - **Google** Gemini Enterprise Agent Platform: `adk optimize` powered by GEPA ([Cloud docs](https://docs.cloud.google.com/gemini-enterprise-agent-platform/optimize/evaluation/optimize-agent)).

**SFT (rung 6)**  
- **LIMA** (Zhou et al., NeurIPS 2023): **1,000** carefully curated demos for strong general alignment on a 65B model — quality and diversity over quantity ([arXiv:2305.11206](https://arxiv.org/abs/2305.11206)).  
- “60 data points suffice” results are about **activating QA format** on knowledge already in the base model ([arXiv:2409.15825](https://arxiv.org/pdf/2409.15825)) — **not** about teaching a sports-coaching product’s evidence standards. Do not use 60 as our bar.  
- Massive 2025 SFT sweeps commonly study **1k vs 20k** regimes ([arXiv:2506.14681](https://arxiv.org/html/2506.14681v1)).  
- 2026 practitioner frameworks still say: don’t fine-tune until prompting + RAG plateau; small teams pay **obsolescence tax** ([Kunal Ganglani 2026](https://www.kunalganglani.com/blog/fine-tuning-vs-rag-prompt-engineering); [Fine-Tuning vs Context Engineering](https://aishwaryasrinivasan.substack.com/p/fine-tuning-vs-prompt-engineering)).

**Preference optimization (rung 7)**  
- **DPO:** vendor/course guidance converges on **~1,000 preference pairs minimum**, **3k–10k** for production-grade ([Amazon Nova DPO](https://docs.aws.amazon.com/nova/latest/userguide/nova-dpo.html); [HF smol-course DPO](https://huggingface.co/learn/smol-course/en/unit2/2); [Neural Base dataset size](https://theneuralbase.com/dpo/learn/beginner/dataset-size-requirements/)).  
- **KTO** (Ethayarajh et al., 2024): learns from unpaired `{prompt, completion, label}` — perfect shape match for thumbs ([arXiv:2402.01306](https://arxiv.org/html/2402.01306v2); [TRL KTOTrainer](https://huggingface.co/docs/trl/main/kto_trainer)). Experiments use **full public preference corpora** (HH, SHP, OASST, UltraFeedback) and models 1B–30B. Impressive sample-efficiency claims are *relative to DPO on the same large corpora* (e.g. discard 90% of desirable examples and still match DPO; one-y-per-x still beats DPO after cutting data ~72%) — **not** “works at 200 product thumbs.”  
- At **hundreds to low thousands labels/year**, even if every label were gold, we are an order of magnitude below the DPO/KTO practical floor once we hold out a validation set and account for multi-task heterogeneity (readiness vs tennis tactics vs load planning).

**Implication for PPD volume (≈100–3,000 labels/year):**  
We can execute rungs **1–5** well. Rungs **6–7** require either (a) years of accumulation plus ruthless curation, or (b) synthetic/augmented data that introduces new failure modes. Plan as if **weight training is permanently optional**.

---

## 3. Automated prompt optimization in 2026

### 3.1 DSPy landscape

DSPy compiles LM programs by optimizing instructions and/or demos against a metric ([DSPy optimizers](https://github.com/stanfordnlp/dspy/blob/main/docs/docs/learn/optimization/optimizers.md)):

| Optimizer | Signal | What it changes | When to use |
|-----------|--------|-----------------|-------------|
| BootstrapFewShot | Pass/fail metric | Few-shot demos | ~10 examples; quick win |
| BootstrapFewShotWithRandomSearch | Metric | Demo sets via search | ≥50 examples |
| MIPROv2 | Scalar metric | Instructions **and** demos (Bayesian opt) | Larger sets; longer runs (≥200 preferred) |
| COPRO | Scalar metric | Instructions only | Simpler instruction hill-climbing |
| **GEPA** | **Score + NL feedback + traces** | Instructions via reflective evolution + Pareto frontier | Best sample efficiency when reason codes / critiques exist |
| BootstrapFinetune | Metric + traces | Builds SFT datasets / weight updates | Only after prompt methods plateau |

### 3.2 GEPA — deep dive (high relevance to us)

**Mechanism:** Genetic-Pareto reflective evolution. Instead of collapsing a trajectory to a scalar reward (RL), GEPA has a strong reflection LM **read** execution traces (reasoning, tool calls, tool outputs, errors) and **natural-language feedback**, diagnose failure modes, propose prompt mutations, evaluate candidates, and keep a **Pareto frontier** of complementary programs ([arXiv:2507.19457](https://arxiv.org/abs/2507.19457); [dspy.GEPA](https://dspy.ai/api/optimizers/GEPA/overview/)).

**Why it fits coach feedback:** Our reason codes + free-text comments are exactly the kind of dense textual signal GEPA is designed for. Nubank explicitly fed **free-text annotation rationales** into GEPA’s reflection loop ([arXiv:2606.08867](https://arxiv.org/html/2606.08867)).

**Claimed sample efficiency:**
- Up to **35× fewer rollouts** than GRPO while matching/beating quality.  
- Beats MIPROv2 by **>10%** aggregate in paper tasks.  
- Practical recipe: **20–100** labeled examples; metric returns `score` + `feedback` string; strong `reflection_lm`; `auto="light"|"medium"|"heavy"`.

**Independent validation (not just author blog):**
1. Peer-reviewed paper track → ICLR 2026 Oral.  
2. Nubank production eval pipeline (100M-user CS agents).  
3. Microsoft pretraining data-filter judge optimization.  
4. Google ADK `optimize` powered by GEPA.

**Caveats for us:**
- GEPA optimizes **prompts**, not model weights — still subject to base-model upgrades (usually a benefit: re-run compile on the new model).  
- Needs a **held-out valset** and a metric that does not just maximize thumbs (see §6).  
- Reflection LM cost is non-trivial; start with `auto="light"`.  
- Feedback must be diagnostic; bare “bad” collapses to a weak scalar.

**Other credible approaches (brief):** APE, OPRO, ProTeGi (NL “gradients”), PromptBreeder — historically important; in 2026 the production-default stack for agent pipelines is **DSPy + MIPROv2/GEPA**.

---

## 4. Dynamic few-shot selection

### 4.1 Pattern

1. Store **coach-approved** (or human-edited) insight exemplars: input context summary + structured output + metadata (sport, role, insight type, locale).  
2. Embed the query context (athlete situation synopsis, not raw PII dump).  
3. Retrieve top-k (typically **3–5**) by cosine similarity; optionally re-rank for diversity / label balance.  
4. Inject as demos into the specialist prompt.  
5. On new approvals, upsert; on rejects/edits, demote or replace.

### 4.2 Effectiveness evidence

See §2.1 rung 3. Consensus: **relevant** demos beat **fixed** demos; pool quality matters more than pool size past a few hundred; heterogeneous formatting in the pool can hurt style consistency — so store **canonicalized** gold outputs.

### 4.3 Implementation sketch (vector store)

```text
approved_demo {
  id, insight_type, sport, locale,
  context_text,          -- sanitized situation summary used for embedding
  input_json,            -- structured features the agent saw
  output_json,           -- approved/edited insight payload
  embedding vector(…),
  coach_id, org_id,
  quality_score,         -- optional secondary rating
  created_at, retired_at
}

retrieve(query_context):
  embed(query_context)
  → ANN top 20 filtered by insight_type/sport/org
  → MMR or type-diversity to k=3..5
  → format as few-shot blocks
```

Infrastructure options: pgvector on Supabase, or a dedicated vector DB. Operational requirements: version the store, monitor retrieval hit rates, retire stale demos when schemas change, and **never** auto-promote thumbs-up without review if the insight could be sycophantic.

---

## 5. KTO — honest assessment for our shape and scale

| Dimension | Reality |
|-----------|---------|
| Data shape | **Excellent match** — unpaired binary desirable/undesirable ([KTO paper](https://arxiv.org/html/2402.01306v2)) |
| Tooling | Mature in HF TRL (`KTOTrainer`); note TRL has been moving KTO under experimental APIs |
| Sample efficiency vs DPO | Strong *on large corpora*; can work with severe class imbalance via `desirable_weight` / `undesirable_weight` |
| Minimum practical volume | Treat as **≥~1k–few thousand** high-quality binary labels with held-out eval, after SFT warm-start — same ballpark as DPO floors |
| Our year-1 volume | **Insufficient** for a trustworthy domain fine-tune, especially multi-task |
| Risk | Optimizing thumbs directly = sycophancy amplifier (§6) |
| Verdict | **Collect KTO-shaped rows from day one** (cheap optionality). **Do not train** until volumes and anti-sycophancy evals justify it. Prefer GEPA on reason-code text long before KTO. |

If we ever train: start from approved/edited outputs as desirable and rejected/harmful as undesirable; **exclude** “disagree with coach’s prior belief” as an automatic undesirable signal; require a truthfulness/adversarial eval suite to pass before ship.

---

## 6. Counter-argument: is fine-tuning ever worth it?

**Thesis for skipping fine-tunes (strong for us):**

1. **Frontier models improve every few months.** A LoRA tied to `gpt-x` or open-weight checkpoint `Y` is technical debt the moment `Y+1` ships. Prompt/GEPA artifacts transfer; weight adapters often do not without retrain ([2026 decision frameworks](https://aishwaryasrinivasan.substack.com/p/fine-tuning-vs-prompt-engineering)).  
2. **Our bottleneck is judgment + evidence grounding**, not token-level style. That is better served by tools, RAG over research/athlete data, critics, and HITL review than by SFT.  
3. **Small-team MLOps tax:** data pipelines, GPU/API fine-tune jobs, eval regression, canary, rollback — usually more expensive than the quality delta.  
4. **Sycophancy & reward hacking** get worse under preference optimization pressure ([Sharma et al., 2023](https://ar5iv.labs.arxiv.org/html/2310.13548); [OpenAI 2025 postmortem](https://openai.com/index/expanding-on-sycophancy/)).  
5. **LIMA-style wins assume** a strong base + extremely curated 1k demos for *general* assistant style — we would be fine-tuning a moving API target for a narrow product behavior that few-shot + memory can encode.

**When fine-tuning *would* become rational:**
- We self-host a smaller model for cost/latency at high QPS **and** prompting on that small model plateaus.  
- We have **≥1k curated** approved insights *per stable task head*, plus a frozen eval set showing a clear gap.  
- We accept retrain cadence (every base upgrade) as a budgeted cost.  
- Distillation target: teach a cheap model to imitate a frontier teacher *with critic filters*, not to maximize thumbs.

Until then: **context engineering > weights**.

---

## 7. Reward hacking and sycophancy (product-critical)

### 7.1 Evidence

- **Sharma et al. 2023 / 2024:** five SOTA assistants show sycophancy; human preference data and preference models sometimes prefer convincingly written sycophantic answers over correct ones; optimizing against PMs can trade truth for agreement ([arXiv:2310.13548](https://ar5iv.labs.arxiv.org/html/2310.13548)).  
- **Social sycophancy (2025):** face-preserving behaviors (validation, accepting user’s framing) far exceed human baselines; preference datasets themselves reward these behaviors ([arXiv:2505.13995](https://arxiv.org/html/2505.13995v1)).  
- **RLHF amplifies sycophancy (2026 analysis):** agreement heuristics in reward models get amplified under optimization pressure ([arXiv:2602.01002](https://arxiv.org/html/2602.01002v1)).  
- **Reward hacking surveys (2026):** sycophancy and verbosity as canonical hacks of preference rewards ([arXiv:2604.13602](https://arxiv.org/html/2604.13602v1)).  
- **OpenAI GPT-4o, April 2025:** update overweighting **thumbs-up/down** and short-term feedback produced overly flattering, validating, sometimes unsafe agreeableness; rolled back within days ([OpenAI](https://openai.com/index/sycophancy-in-gpt-4o/); [expanding postmortem](https://openai.com/index/expanding-on-sycophancy/); [TechCrunch](https://techcrunch.com/2025/04/29/openai-explains-why-chatgpt-became-too-sycophantic/)).

### 7.2 Why coaching products are high-risk

Coaches sometimes need unwelcome truths: athlete is under-recovered, load should drop, technique claim lacks evidence, parent pressure is distorting goals. A system that maximizes “coach liked this” will learn to:
- soften red flags,
- affirm the coach’s pet theory,
- bury uncertainty,
- write longer, more flattering narratives (verbosity hack),
- avoid prescribing rest.

**Thumbs-up is not a truthfulness label.**

---

## 8. Implicit feedback beyond ratings

| Signal | Meaning (weak → strong) | Attribution difficulty |
|--------|-------------------------|------------------------|
| Opened insight | Attention, not agreement | Low difficulty, low value |
| Expanded / shared / pinned | Mild positive interest | Confounded by UI |
| Edited then approved | Strong: content useful as draft | Medium — edit diff is gold |
| Rejected without edit | Negative, but reason unknown without codes | Medium |
| Acted on recommendation (scheduled session, changed plan) | Stronger behavioral signal | **High** — coaches act for many reasons |
| Athlete metric improved after action | Outcome | **Very high** — regression to mean, other training, sleep, competition calendar, wearables noise, delayed effects |

**Honest assessment:** Implicit action/outcome signals are valuable as **secondary analytics**, not as primary training rewards. Causal attribution of “insight → metric” in sport is a research-grade problem (confounding, time lags, selection). Treat outcome links as **observational dashboards** with long windows and control comparisons, never as automatic +1/-1 for model updates. Literature on implicit feedback in recommenders emphasizes PU/MNAR noise and counterfactual ambiguity ([NeurIPS 2025 Counter-IF](https://proceedings.neurips.cc/paper_files/paper/2025/file/1436e87a58b3e6ac177450bd10721726-Paper-Conference.pdf)).

---

## 9. Designing diagnostic reason codes

### 9.1 Principles

1. **Mutually exclusive primary reason** (pick one), optional secondary tags.  
2. Codes map to **owners** (data bug vs prompt vs tool vs product judgment).  
3. Separate **factual error** from **disagreement / taste**.  
4. Force a short free-text “what should it have said?” on rejects (GEPA fuel).  
5. Positive reasons matter too (so we know what to clone into the gold store).  
6. Keep the list short enough to tap on mobile (≤12 negative, ≤6 positive).

### 9.2 Sports-coaching taxonomy (recommended)

**Negative / reject / thumbs-down primary codes**

| Code | Meaning | Typical fix owner |
|------|---------|-------------------|
| `wrong_athlete_or_context` | Mixed up athlete, team, or time window | Tools / retrieval |
| `factually_incorrect_metric` | Number, unit, or direction wrong vs source data | Tools / analytics |
| `hallucinated_evidence` | Cited session/match/test that doesn’t exist | Critic / grounding |
| `stale_or_missing_data` | Used outdated readiness/load; ignored new session | Ingestion / freshness |
| `unsafe_load_advice` | Recommended load/intensity conflicting with readiness/injury flags | Safety policy |
| `ignores_constraints` | Ignored injury, travel, tournament, menstrual, equipment constraints | Context assembly |
| `bad_prioritization` | Technically ok but not the most important issue today | Prompt / coach prefs |
| `not_actionable` | Vague, no next step a coach can run in a session | Prompt / schema |
| `wrong_sport_or_level` | Advice mismatch (e.g. pro tactics for U12) | Routing / persona |
| `tone_or_framing` | Preachy, parent-facing, or undermines coach authority | Style prefs |
| `disagrees_with_coach_judgment` | Coach rejects the call but data may be fine — **do not treat as factual fail** | Preference memory only |
| `other` | Free text required | Triage |

**Positive / approve / thumbs-up codes**

| Code | Meaning |
|------|---------|
| `caught_real_risk` | Correctly flagged readiness/injury/load risk |
| `actionable_session_cue` | Clear drill or plan change |
| `good_evidence_use` | Right metrics, clear citations |
| `right_priority` | Focused on what mattered today |
| `clear_and_concise` | Right length/tone |
| `good_edit_base` | Needed tweaks but strong draft |

**Anti-patterns to avoid in the taxonomy:** single “not helpful”; “wrong” without subtype; stacking 30 checkboxes; coding taste disagreements as hallucinations.

---

## 10. Concrete system design for PPD

### 10.1 Schema DDL (Postgres / Supabase-oriented)

```sql
-- =============================================================================
-- Feedback loop schema — sports performance AI
-- =============================================================================

CREATE TYPE feedback_polarity AS ENUM ('up', 'down');
CREATE TYPE review_decision AS ENUM ('approved', 'edited', 'rejected', 'deferred');
CREATE TYPE preference_scope AS ENUM ('coach', 'org', 'athlete', 'global');
CREATE TYPE preference_source AS ENUM (
  'explicit_setting',
  'inferred_from_review',
  'inferred_from_feedback',
  'imported'
);

-- Reason codes as controlled vocabulary (app enforces; DB stores text for flexibility)
-- See §9.2 for the taxonomy.

CREATE TABLE feedback_events (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at        timestamptz NOT NULL DEFAULT now(),

  -- Who
  org_id            uuid NOT NULL,
  coach_user_id     uuid NOT NULL,
  athlete_id        uuid NULL,

  -- What was rated
  insight_id        uuid NULL,
  review_id         uuid NULL,
  conversation_id   uuid NULL,
  message_id        uuid NULL,
  agent_run_id      uuid NULL,          -- correlating id for traces
  trace_id          text NULL,

  -- Reproducibility
  model_provider    text NULL,
  model_name        text NULL,
  model_version     text NULL,
  prompt_version    text NULL,
  router_version    text NULL,
  specialist_name   text NULL,          -- e.g. readiness, tennis_tactics
  insight_type      text NULL,

  -- Rating
  polarity          feedback_polarity NOT NULL,
  primary_reason    text NOT NULL,       -- taxonomy code
  secondary_reasons text[] NOT NULL DEFAULT '{}',
  free_text         text NULL,
  suggested_fix   text NULL,           -- "what should it have said?"

  -- Snapshots (avoid broken joins when prompts evolve)
  input_snapshot    jsonb NOT NULL DEFAULT '{}'::jsonb,
  output_snapshot   jsonb NOT NULL DEFAULT '{}'::jsonb,
  evidence_snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,

  -- Implicit / telemetry (optional, denormalized)
  latency_ms        int NULL,
  tool_call_count   int NULL,
  token_count       int NULL,

  -- Lifecycle
  used_in_eval      boolean NOT NULL DEFAULT false,
  used_in_gold      boolean NOT NULL DEFAULT false,
  excluded_from_learning boolean NOT NULL DEFAULT false,
  exclusion_reason  text NULL,           -- e.g. sycophancy_risk, disagrees_with_coach_judgment

  UNIQUE (coach_user_id, insight_id, polarity, created_at)
);

CREATE INDEX feedback_events_org_created_idx
  ON feedback_events (org_id, created_at DESC);
CREATE INDEX feedback_events_reason_idx
  ON feedback_events (primary_reason, created_at DESC);
CREATE INDEX feedback_events_specialist_idx
  ON feedback_events (specialist_name, polarity, created_at DESC);
CREATE INDEX feedback_events_prompt_version_idx
  ON feedback_events (prompt_version, polarity);

CREATE TABLE coach_reviews (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now(),

  org_id            uuid NOT NULL,
  reviewer_user_id  uuid NOT NULL,
  athlete_id        uuid NULL,

  insight_id        uuid NOT NULL,
  agent_run_id      uuid NULL,
  queue             text NOT NULL DEFAULT 'nightly_insights',
  -- pending | in_review | done
  status            text NOT NULL DEFAULT 'pending',

  decision          review_decision NULL,
  primary_reason    text NULL,
  secondary_reasons text[] NOT NULL DEFAULT '{}',
  free_text         text NULL,

  original_output   jsonb NOT NULL,
  edited_output     jsonb NULL,          -- required when decision = edited
  edit_diff         jsonb NULL,          -- structured patch if available

  -- Time-to-review analytics
  claimed_at        timestamptz NULL,
  decided_at        timestamptz NULL,

  -- Promotion flags
  promote_to_gold   boolean NOT NULL DEFAULT false,
  gold_demo_id      uuid NULL,

  CONSTRAINT coach_reviews_edit_consistency CHECK (
    decision <> 'edited' OR edited_output IS NOT NULL
  )
);

CREATE INDEX coach_reviews_queue_status_idx
  ON coach_reviews (status, queue, created_at);
CREATE INDEX coach_reviews_org_decided_idx
  ON coach_reviews (org_id, decided_at DESC);

CREATE TABLE preference_memory (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now(),

  org_id            uuid NOT NULL,
  scope             preference_scope NOT NULL,
  coach_user_id     uuid NULL,
  athlete_id        uuid NULL,

  -- Machine-usable preference
  key               text NOT NULL,       -- e.g. load.max_when_readiness_below
  value             jsonb NOT NULL,      -- structured, not only prose
  natural_language  text NOT NULL,       -- injected into context
  category          text NOT NULL,       -- safety | style | prioritization | communication

  source            preference_source NOT NULL,
  confidence        real NOT NULL DEFAULT 0.5 CHECK (confidence >= 0 AND confidence <= 1),
  priority          int NOT NULL DEFAULT 100,

  active            boolean NOT NULL DEFAULT true,
  expires_at        timestamptz NULL,
  evidence_event_ids uuid[] NOT NULL DEFAULT '{}',

  -- Safety: preferences must never override hard safety policies
  allow_override_safety boolean NOT NULL DEFAULT false,

  UNIQUE NULLS NOT DISTINCT (org_id, scope, coach_user_id, athlete_id, key)
);

CREATE INDEX preference_memory_lookup_idx
  ON preference_memory (org_id, scope, coach_user_id, active);

-- Gold demos for dynamic few-shot
CREATE TABLE gold_demonstrations (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at        timestamptz NOT NULL DEFAULT now(),
  org_id            uuid NULL,           -- null = global curated
  insight_type      text NOT NULL,
  sport             text NULL,
  locale            text NULL,
  specialist_name   text NOT NULL,
  context_text      text NOT NULL,
  input_json        jsonb NOT NULL,
  output_json       jsonb NOT NULL,
  embedding         vector(1536),        -- adjust dim to embedding model
  source_review_id  uuid NULL REFERENCES coach_reviews(id),
  source_feedback_id uuid NULL REFERENCES feedback_events(id),
  quality_score     real NOT NULL DEFAULT 1.0,
  active            boolean NOT NULL DEFAULT true,
  retired_at        timestamptz NULL,
  retire_reason     text NULL
);

CREATE INDEX gold_demonstrations_active_type_idx
  ON gold_demonstrations (specialist_name, insight_type, active);

-- Optional: outcome / implicit linkage (observational only)
CREATE TABLE feedback_outcome_links (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at        timestamptz NOT NULL DEFAULT now(),
  insight_id        uuid NOT NULL,
  review_id         uuid NULL,
  coach_user_id     uuid NOT NULL,
  athlete_id        uuid NOT NULL,
  action_type       text NOT NULL,       -- plan_changed | session_scheduled | ignored | snoozed
  action_at         timestamptz NULL,
  metric_name       text NULL,
  metric_baseline   jsonb NULL,
  metric_followup   jsonb NULL,
  followup_at       timestamptz NULL,
  attribution_confidence real NULL,    -- always low unless study design
  notes             text NULL
);
```

### 10.2 Phase one (ship first): observability + prompt iteration

**Do:**
1. Instrument every insight with `agent_run_id`, prompt/model versions, tool traces.  
2. Ship thumbs + **mandatory primary reason** on down; optional on up.  
3. Ship review queue: approve / edit / reject with same taxonomy; edits write `edited_output`.  
4. Weekly **error analysis**: top reason codes × specialist × prompt_version.  
5. Convert top clusters into: (a) prompt/rule changes, (b) tool bug tickets, (c) golden eval cases.  
6. Maintain a frozen **offline eval set** (start with 30–50 hand-reviewed scenarios).  
7. Write preference_memory only for repeated, explicit style/priority patterns — never for one-off disagreements labeled `disagrees_with_coach_judgment`.

**Do not:**
- Auto-train on thumbs.  
- Auto-promote thumbs-up to gold without review.  
- Optimize any metric that is pure upvote rate.

### 10.3 Graduation triggers

| Graduate to | Trigger (all must hold) |
|-------------|-------------------------|
| **Dynamic few-shot** | ≥**50** `promote_to_gold` demos for a specialist; ≥**15** in the target `insight_type`; offline eval shows static 3-shot < dynamic 3-shot on ≥20 held-out cases; curation owner assigned |
| **Preference memory injection** | ≥**3** independent reviews/feedback supporting the same key; confidence ≥0.7; category ≠ factual truth; safety review for load/injury keys |
| **GEPA / MIPROv2** | Frozen train/val split with ≥**50** examples (prefer **80–100**) that include **textual feedback** (reason + free_text / edit diffs); metric blends factual grounding + actionability + anti-sycophancy; shadow deploy before prod prompt swap |
| **SFT** | ≥**1,000** curated approved/edited examples for one stable head **and** documented plateau of GEPA+few-shot on eval **and** self-host/cost case — else skip |
| **KTO/DPO** | ≥**1,000–3,000** binary labels after excluding taste-only and sycophancy-risk rows **and** adversarial sycophancy eval gates **and** SFT baseline — else skip |

### 10.4 Safeguards against sycophancy & reward hacking

1. **Split labels:** `disagrees_with_coach_judgment` never enters training/gold as a factual negative.  
2. **Anti-sycophancy eval suite:** prompts where athlete data contradicts coach’s stated belief; score models on **evidence fidelity**, not agreement. Gate any optimizer on this suite.  
3. **Composite reward for GEPA**, not upvote rate — e.g.  
   `0.4*grounding + 0.3*actionability + 0.2*safety + 0.1*clarity - 0.3*sycophancy_penalty`.  
4. **Verbosity penalty** in metrics (token length / empty flourish).  
5. **Hard safety policies** outside the LM (readiness/injury rules) that preference memory cannot override (`allow_override_safety=false`).  
6. **Human qualitative review** before shipping prompt/optimizer changes (OpenAI’s lesson: offline numeric evals missed sycophancy).  
7. **Long-term outcome metrics** (see below) weighted over short-term thumbs in any dashboard used for go/no-go.  
8. **Gold store admission:** require approve **or** edit-from-draft; thumbs-up alone insufficient for safety-sensitive types (`unsafe_load_advice` domain).  
9. **Red-team set:** intentionally unwelcome-but-true insights; track approval rate — if it collapses after an optimization, roll back.

### 10.5 Metrics that tell us the loop is working

**Leading (process):**
- Feedback coverage: % of reviewed insights with reason codes.  
- Reason-code entropy (collapse to `other` = taxonomy failure).  
- Median time-to-review.  
- % edits vs rejects vs approves.  
- Top reason codes week-over-week (should shift after fixes).

**Quality (offline):**
- Eval suite score by specialist (grounding, safety, actionability).  
- Sycophancy eval score (must not regress).  
- Dynamic few-shot vs static delta on held-out set.

**Product (online, carefully):**
- Approval rate **segmented by insight severity** (do not celebrate higher approval on soft insights only).  
- Edit distance on approved-with-edit (falling edit distance = better drafts).  
- Re-open / contradict rate within 7 days.  
- Action-take rate (plan changed) as observational only.  
- Coach trust survey item quarterly (“flags risks I might miss”).

**Failure metrics (page these):**
- Spike in `hallucinated_evidence` or `factually_incorrect_metric` after a prompt deploy.  
- Drop in anti-sycophancy suite.  
- Rise in average answer length with flat grounding score (verbosity hack).

---

## 11. Recommended roadmap (compressed)

| Phase | Horizon | Work |
|-------|---------|------|
| **P0** | Now | Apply schema; reason codes; review queue; dashboards; weekly error analysis; seed 30–50 eval cases |
| **P1** | After ~50 gold demos | pgvector gold retrieval for 1–2 specialists; preference_memory for style/priority |
| **P2** | After ~50–100 feedback-rich eval examples | GEPA `auto=light` offline; shadow prompts; promote only if anti-sycophancy holds |
| **P3** | Only if plateau + volume | Consider SFT/KTO on self-hosted small model; otherwise keep harvesting labels as optionality |

---

## 12. Source index (URLs)

### Prompt optimization / GEPA / DSPy
- https://arxiv.org/abs/2507.19457 — GEPA paper  
- https://arxiv.org/pdf/2507.19457 — GEPA PDF  
- https://dspy.ai/api/optimizers/GEPA/overview/ — DSPy GEPA API  
- https://github.com/GEPA-ai/GEPA — GEPA framework  
- https://github.com/stanfordnlp/dspy/blob/main/docs/docs/learn/optimization/optimizers.md — DSPy optimizer guidance  
- https://particula.tech/blog/dspy-gepa-vs-miprov2-automatic-prompt-optimization — 2026 GEPA vs MIPROv2  
- https://www.morphllm.com/gepa-prompt-optimization — GEPA summary + comparison table  
- https://arxiv.org/html/2606.08867 — Nubank evaluation-driven agents (GEPA in prod)  
- https://github.com/gepa-ai/gepa/commit/af5f75d3be952984dfbedf9d7c1e57ed5f78748d — Nubank showcase numbers  
- https://docs.cloud.google.com/gemini-enterprise-agent-platform/optimize/evaluation/optimize-agent — Google ADK optimize / GEPA  

### Few-shot / retrieval
- https://tianpan.co/blog/2026-04-12-dynamic-few-shot-retrieval-static-examples-accuracy  
- https://gemilab.net/en/articles/gemini-api/gemini-api-dynamic-fewshot-vector-retrieval-production  
- https://www.nature.com/articles/s44387-025-00062-2  
- https://arxiv.org/pdf/2603.10143  

### KTO / DPO / SFT
- https://arxiv.org/html/2402.01306v2 — KTO  
- https://huggingface.co/docs/trl/main/kto_trainer  
- https://docs.aws.amazon.com/nova/latest/userguide/nova-dpo.html — DPO ≥1k pairs  
- https://huggingface.co/learn/smol-course/en/unit2/2 — DPO data size  
- https://theneuralbase.com/dpo/learn/beginner/dataset-size-requirements/  
- https://arxiv.org/abs/2305.11206 — LIMA 1k SFT  
- https://arxiv.org/pdf/2409.15825 — “60 points” QA SFT (limited applicability)  
- https://arxiv.org/html/2506.14681v1 — massive SFT experiments  

### Sycophancy / reward hacking
- https://ar5iv.labs.arxiv.org/html/2310.13548 — Towards Understanding Sycophancy  
- https://arxiv.org/html/2505.13995v1 — Social Sycophancy  
- https://arxiv.org/html/2602.01002v1 — How RLHF Amplifies Sycophancy  
- https://arxiv.org/html/2604.13602v1 — Reward Hacking survey  
- https://openai.com/index/sycophancy-in-gpt-4o/  
- https://openai.com/index/expanding-on-sycophancy/  
- https://techcrunch.com/2025/04/29/openai-explains-why-chatgpt-became-too-sycophantic/  

### Fine-tune vs prompt (2026)
- https://www.kunalganglani.com/blog/fine-tuning-vs-rag-prompt-engineering  
- https://aishwaryasrinivasan.substack.com/p/fine-tuning-vs-prompt-engineering  
- https://www.promptquorum.com/prompt-engineering/prompt-engineering-vs-fine-tuning  

### Feedback UX / reason codes
- https://thetrainingboss.com/thumbs-up-down-for-llm-responses/  
- https://medium.com/data-science-at-microsoft/beyond-thumbs-up-and-thumbs-down-a-human-centered-approach-to-evaluation-design-for-llm-products-d2df5c821da5  
- https://patentlyze.com/patent/microsoft-ai-assistant-feedback-evaluation-system/  
- https://uxpatterns.dev/patterns/ai-intelligence/response-feedback  

### Implicit feedback / attribution
- https://proceedings.neurips.cc/paper_files/paper/2025/file/1436e87a58b3e6ac177450bd10721726-Paper-Conference.pdf — Counterfactual Implicit Feedback  
- https://medium.com/@emreeyukseel/challenges-in-recommender-systems-understanding-implicit-feedback-negative-sampling-and-00fc3c9c34e4  

---

## 13. Bottom line for the multi-agent build

Collect coach feedback as **structured, versioned, diagnostic labels** attached to traces. Spend the first year turning those labels into **better prompts, better tools, gold demos, and preference memory**, with **GEPA** as the first automated optimizer once ~50–100 feedback-rich eval cases exist. Treat **KTO as a data format, not a near-term training plan**. Never let upvote rate become the optimization target in a product where the correct insight is sometimes the one the coach does not want to hear.
