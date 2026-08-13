# 33 — Google PH-LLM (Personal Health Large Language Model)

**Topic:** Google Research / Google Health / DeepMind Personal Health Large Language Model  
**Scope:** External research only (arXiv, Nature Medicine, Google Research blog, companion PHIA work, productization). No local codebase exploration beyond writing this file.  
**Research date:** 2026-08-02  
**Currency note:** Prioritize 2025–2026 sources. Where only 2024 preprint details remain the best technical source, that is flagged.

---

## Verdict (TL;DR)

| Question | Answer |
|---|---|
| What is PH-LLM? | A **Gemini Ultra 1.0** model **fully fine-tuned** for sleep/fitness coaching over **aggregated daily wearable metrics** (textual case studies) + a separate **MLP multimodal adapter** for PRO prediction. |
| Gemini-based? | **Yes.** Base = Gemini Ultra 1.0 (selected over Nano/Pro/Med-PaLM 2). |
| Adapter method? | **Full-weight SFT** for coaching; **MLP adapter (HeLM-style), LLM frozen** for sensor→PRO; **LoRA only for AutoEval raters**, not the main coach model. |
| How are numbers fed in? | Coaching: **textual daily tables + aggregates** (not raw timeseries). PRO: **mean/variance aggregates → 2 latent tokens** + text. |
| Did it ship as PH-LLM? | **No product named PH-LLM.** Research capabilities informed **Fitbit Personal Health Coach → Google Health Coach** (preview Oct 2025; GA May 2026). |
| What superseded it? | **PHIA** (tool-using agent + code gen) for numerical fidelity; **multi-agent Health Coach** (conversation + data-science + domain-expert agents) for product. |
| PPD stance | **Adopt** structured case-study eval, textual aggregate cards, agentic tool computation, SHARP-style safety rubrics. **Do not copy** full Gemini fine-tunes, inventing numbers in-model, or clinical/diagnostic framing. |

---

## 1. Identity, publications, timeline

### 1.1 Primary paper (preprint → journal)

| Stage | Citation | Date | URL |
|---|---|---|---|
| Preprint | *Towards a Personal Health Large Language Model* | 2024-06-11 (arXiv) | https://arxiv.org/abs/2406.06474 · HTML: https://arxiv.org/html/2406.06474 |
| Journal | Khasentino, Belyaeva, Liu, Yang, Furlotte, et al. *A personal health large language model for sleep and fitness coaching.* **Nature Medicine** 31, 3394–3403 (2025) | Published **2025-08-14** | https://www.nature.com/articles/s41591-025-03888-0 · DOI: https://doi.org/10.1038/s41591-025-03888-0 |
| Google pubs page | Same work | — | https://research.google/pubs/a-personal-health-large-language-model-for-sleep-and-fitness-coaching/ |
| Open artifacts | Datasets / notebooks under Google-Health | Ongoing | https://github.com/Google-Health/consumer-health-research/tree/main/phllm |

**Authoring orgs (paper + blog):** Google Research, Google Health, Google DeepMind, Fitbit-adjacent consumer health teams.

**Nature Medicine framing (2025, preferred over preprint wording):** PH-LLM is “a version of the Gemini LLM that was finetuned for text understanding and reasoning when applied to **aggregated daily-resolution numerical sensor data**.”

### 1.2 Companion / sibling research

| Work | Role vs PH-LLM | Citation | URL |
|---|---|---|---|
| **PHIA** — Personal Health Insights Agent | Complementary (and numerically stronger) **agent + code-gen** path; co-announced June 2024; journal 2025/2026 | Merrill et al., arXiv:2406.06464; *Nature Communications* | https://arxiv.org/abs/2406.06464 · https://www.nature.com/articles/s41467-025-67922-y |
| Google Research blog (both papers) | Official synthesis | 2024-06-11 | https://research.google/blog/advancing-personal-health-and-wellness-insights-with-ai/ |
| Personal Health Coach engineering blog | Productization lineage from PH-LLM-like numerical reasoning + multi-agent design | 2025-10-27 | https://research.google/blog/how-we-are-building-the-personal-health-coach/ |
| Google Health Coach GA | Consumer product (Gemini-powered; not “PH-LLM” branded) | 2026-05-07 announce; GA from 2026-05-19 | https://blog.google/products-and-platforms/products/google-health/google-health-coach/ |

### 1.3 Talks / presentations

No dedicated public conference talk titled “PH-LLM” was found as of 2026-08-02. Closest public materials:

- Google Research blog posts above (primary narrative).
- Broader Google Health AI talks (Med-PaLM / Med-Gemini lineage) are **adjacent clinical LLMs**, not PH-LLM — do not conflate (e.g. Check Up ’23 Med-PaLM 2: https://www.youtube.com/watch?v=3Ud-BMOCkDI).

---

## 2. Full architecture

### 2.1 Base model selection

Authors evaluated Gemini Nano 1.0, Gemini Pro 1.0, Gemini Ultra 1.0, and Med-PaLM 2 on sleep/fitness professional MCQs. **Gemini Ultra 1.0 won** and became the PH-LLM base.

> **Implication for PPD:** Domain exam score ≠ coaching quality. They still needed case-study SFT and separate numeric tooling.

### 2.2 Two-stage training (Nature Medicine Methods)

```
Stage A — Coaching SFT
  Gemini Ultra 1.0
       │
       │ full-model supervised fine-tune
       │ on sleep + fitness case-study
       │ prompt→response pairs (1:1 mixture)
       ▼
  PH-LLM (text coach)

Stage B — Multimodal PRO adapter (HeLM-style)
  20 daily sensors × 15 days
       │ mean + variance → 20×2 matrix, z-scored
       ▼
  MLP adapter (1024 → 4096 → 1024 → 2 tokens)
       │ prefix tokens into frozen PH-LLM
       ▼
  Binary PRO prediction (log-likelihood scoring)
```

#### Stage A details (coaching)

- **Method:** Full-model fine-tuning of Gemini Ultra 1.0 (Nature Medicine: “finetuned the **entire model**”). Not LoRA for the coach.
- **Data:** 457 sleep + 300 fitness case studies for train/val/test (70:15:15); holdout 50 sleep + 50 fitness written **from scratch by experts** (no LLM draft).
- **Examples:** Each case study section is a separate example → **1,371 sleep + 1,500 fitness** prompt–response pairs across splits; ~2,871 for train/val/test total sections.
- **Mixture:** 1:1 sleep:fitness; fitness upsampled higher-QC cases 2:1.
- **Hyperparams (preprint §3.3):** max 1500 steps, global batch 4, LR `2.5e-7`, weight decay `1e-2`, linear warmup 50 steps, cosine decay, checkpoint every 50 steps; pick first checkpoint after ≥1 epoch with low log perplexity.
- **Targets:** Expert-edited long-form coaching in second person (insights / etiology / recommendations for sleep; demographics / training load / sleep / health / readiness assessment for fitness).

#### Stage B details (PRO / multimodal)

- Follows **HeLM** multimodal adapter methodology.
- Input: matrix of **20 wearable measurements × 15 days** → encode **mean & variance** → z-score → project via **3-hidden-layer MLP** to **2 embedding tokens**.
- Those tokens are a **prefix** to a text prompt that also includes native (non-z-scored) textual fields.
- **Adapter trained by backprop; PH-LLM weights frozen.**
- Compared to zero-shot / few-shot text-only (up to 7 exemplars) and logistic regression on the same aggregates.

#### AutoEval (not the coach)

- Separate **Gemini Pro 1.0 + LoRA (rank 4 on attention)** raters trained to score Likert principles — used for checkpoint filtering before expensive human expert review.

### 2.3 How wearable sensor data was represented

This is the design detail most relevant to Peak Performance Data.

| Path | Representation | Granularity | Raw timeseries? |
|---|---|---|---|
| **Sleep coaching case studies** | Text tables/prompts: demographics + up to **29 days of daily metrics** (bed/wake, stages, etc.) + **aggregated stats** (means, demographic percentiles, 5th/95th peer bounds; weekday/weekend splits) | Daily + summary | **No** — Nature Medicine limitation explicitly: only textual case-study inputs; raw timeseries not persisted |
| **Fitness coaching case studies** | Demographics + up to **30 days** daily TRIMP / HR zones / steps + exercise logs + sleep + RHR/HRV/RR + aggregates (acute/chronic TRIMP, **ACWR**, recent vs 28-day z-scores) + **synthetic subjective readiness/soreness** | Daily + summary + logs | **No** |
| **PRO prediction** | Aggregates (mean/var over 15 days) as **MLP tokens** + parallel **text of daily/mean fields** | Day-level aggregates, not waveforms | **No raw waveforms**; CNN on full series underperformed LR in their low-data regime |
| **PHIA (companion)** | Tabular wearable data analyzed via **Python/Pandas code execution**; LLM sees tool outputs (aggregates/trends), not necessarily full raw dump in final answer | Query-dependent | Can operate on higher-resolution tables via code |

**Blog vs paper nuance (flag):** The June 2024 Google Research blog says PH-LLM uses a multimodal encoder for “raw time-series sensor data such as HRV and respiratory rate.” The **2025 Nature Medicine** text is stricter and clearer: coaching uses **aggregated daily-resolution numerical sensor data in textual form**; multimodal encoding applies to **daily summaries** for PROs. Prefer the journal wording for architecture decisions.

---

## 3. Training data and evaluation tasks

### 3.1 Task suite (three pillars)

1. **Long-form personalized coaching** (857 real-world Fitbit case studies; sleep + fitness).
2. **Expert domain knowledge** via certification-style MCQs (sleep medicine + NSCA-CSCS fitness).
3. **Patient-reported outcome (PRO) prediction** from wearable aggregates (PROMIS Sleep Disturbance / Impairment; Google Digital Well-Being Study subset).

### 3.2 Case studies (coaching)

| Domain | N | Experts | Structure | Prompting scaffolds |
|---|---:|---|---|---|
| Sleep | 507 (457 train/val/test + 50 holdout) | 6 sleep physicians/psychologists (MD/DO/PsyD) | Insights → Etiology → Recommendations | **RU-SATED** (Routine, Sleep Quality, Alertness, Timing, Efficiency, Duration); **SMART** goals |
| Fitness | 350 (300 + 50 holdout) | 7 athletic trainers | Demographics → Training load → Sleep → Health metrics → Assessment/recommendations | Readiness 1–5 + load metrics (TRIMP, ACWR) |

**Data source:** Anonymized Fitbit production data from consented US research users (Pixel Watch / Fitbit ecosystem).

**Label creation detail (important):** Train/val/test targets were often **Gemini Ultra drafts edited by experts**; holdout targets were **expert-written from scratch**. This reduces circularity on final human eval but means training data may contain residual model-style artifacts (authors note possible low-quality rest-period statements in fitness training data).

### 3.3 Professional exams

| Exam bank | N | PH-LLM | Gemini Ultra 1.0 | Human experts (sample) | Pass / CME bar |
|---|---:|---:|---:|---:|---:|
| Sleep (AMA PRA Cat. 1 / ABIM MOC-style BoardVitals) | 629 | **79%** | 77% | 76% (N=204 subset) | ~70% CME |
| Fitness (NSCA-CSCS practice banks) | 99 | **88%** | 88% | 71% | ~70% pass |

Ablations: self-consistency (N=5) helped fitness; chain-of-thought mixed.

### 3.4 PRO prediction

- ~4.7k–10k Digital Well-Being Study participants; analyses use subsets with nearly complete 15-day sensor coverage.
- 16 binary outcomes from PROMIS sleep disturbance/impairment items.
- Specialized discriminative models only reach roughly **AUROC 0.55–0.75** — subjective sleep from sensors is hard.
- **MLP-adapter PH-LLM ≈ logistic regression**; significantly beats zero-/few-shot text for **12/16** outcomes.
- Signal is **distributed across many sensors**, not dominated by one feature.

### 3.5 Evaluation methodology for long-form

Human rubric (15 Likert 1–5 principles) covering:

- Domain knowledge correctness  
- Use of important user data / interpretations  
- Personalization  
- Confabulations / unwarranted assumptions  
- **Potential for harm**  
- Readability / overall quality  

Plus **AutoEval** LoRA raters as scalable proxy (inter-rater agreement comparable to human–human on several metrics).

---

## 4. Key published results

### 4.1 Headline numbers (Nature Medicine 2025)

- Sleep MCQ **79%** > expert sample 76%; fitness MCQ **88%** > expert sample 71%.
- Sleep case studies: PH-LLM mean rating **4.61** vs experts **4.75** (statistically lower, small effect); **fine-tuning beat base Gemini** on insights/etiology and on referencing domain knowledge + user data.
- Fitness case studies: PH-LLM **≈ expert / ≈ base Gemini** overall; **training-load section worse** than experts (and sometimes base).
- PRO: multimodal adapter **necessary and sufficient** to match specialized LR; text-only prompting insufficient.

### 4.2 Qualitative failure modes (authors + expert interviews)

Documented by the paper’s qualitative section and Discussion — these are more actionable than exam scores:

1. **Missing life context:** Job, family, shift work, constraints — experts could not confidently pick etiology or SMART recommendations from sensors alone.
2. **Recommendations hardest:** Ambiguous, preference-dependent, CBT-i style advice varies by expert; fine-tuning gains weakest here.
3. **Cross-section inconsistency:** Strong insight section contradicted by later recommendation/assessment.
4. **Confabulations / wrong day references:** Still occurred after fine-tuning; rates not clearly better than base Gemini on that axis — “function of specific case studies.”
5. **Harm-relevant misses:** Over-cautious on overtraining; **under-called undersleeping**; sometimes missed **detraining** signals (e.g., rising resting HR).
6. **Numeric fidelity limits of in-model reasoning:** Companion PHIA paper states LLMs alone struggle with numerical reasoning; PH-LLM uses pre-aggregated summaries rather than computing over high-resolution series with tools.
7. **Training-data quality can hurt a section:** Fitness training-load SFT may have absorbed lower-quality rest-period statements.
8. **No outcome validation of behavior change:** Coaching quality ≠ health outcomes.
9. **Demographic / sampling bias:** Fitness enriched for active, often male 30–59; DWB skewed female; race/ethnicity not acquired — equity/generalizability caution.
10. **Ceilinged rubrics:** Ratings skewed high → hard to differentiate models.

### 4.3 Author-listed limitations (Nature Medicine Discussion, condensed)

1. Subjective long-form eval; high rating skew.  
2. Single rater seeing all candidates → possible style bias.  
3. Residual confabulations / incorrect data refs.  
4. Non-representative samples; unmeasured context.  
5. **Only textual case-study inputs** (no raw timeseries).  
6. Multimodal adapter explores tiny design space; small paired-outcome dataset.  
7. Missingness largely avoided by selection criteria.  
8. No blinded preference / behavior-change studies.  
9. Broader caution: reliability, safety, equity unfinished.

---

## 5. Prompting and personalization strategy

### 5.1 Coaching prompts

- Section-specific prompts mirroring expert instructions (sleep Tables A.1–A.5 / fitness A.6–A.10 in preprint appendix).
- **Scaffolded clinical frameworks** embedded in prompts (RU-SATED; SMART; etiology axes: circadian, homeostatic drive, hyperarousal, extrinsic).
- **Chained sections:** Etiology/recommendations receive prior model (or expert) section outputs substituted into the next prompt — personalization is staged, not one-shot.
- Second-person coach voice (“you”).
- Peer-relative context: demographic percentiles and 5th/95th bounds for sleep aggregates — personalization against population norms, not only absolute values.
- Fitness readiness uses **synthetic subjective logs** (fatigue/soreness) to simulate conversational context the sensors lack.

### 5.2 Exam / PRO prompting

- MCQ: optional CoT + self-consistency.
- PRO: binary yes/no likelihood scoring; few-shot exemplars when text-only.

### 5.3 Personalization levers used

| Lever | Present? |
|---|---|
| Individual longitudinal wearable window (15–30d) | Yes |
| Demographics | Yes |
| Peer percentile norms | Yes (sleep) |
| Acute vs chronic deltas / z-scores | Yes (fitness) |
| Subjective readiness (synthetic in research) | Yes (fitness) |
| Multi-turn memory of prior coach chats | Research paper: limited; **product** Health Coach adds this |
| Medical records / injuries / equipment | Research: no; **product** Health Coach onboarding + records (US) |

---

## 6. Safety and non-diagnostic framing

### 6.1 Research framing

- Positioned as **personal health / wellness coaching** (sleep hygiene, workout readiness), explicitly **not** as a clinical diagnostic system.
- Evaluation rubric includes **potential for harm** and confabulation checks.
- Authors repeatedly caution that strong MCQ/case-study scores are **necessary but not sufficient**, and that confabulations + missing context remain deployment blockers.
- Expert interviews acknowledge recommendations can be wrong for real constraints (e.g., shift workers).

### 6.2 Product / Google Health Coach disclaimers (2025–2026)

From Google Research / Google Health product pages:

- **“Not a medical device.”**
- **“Intended for general wellness and fitness purposes only.”**
- **“Not intended for medical purposes.”** / “Always consult a qualified healthcare professional.”
- **“Check responses for accuracy; results may vary.”**
- Age gate: Coach features for **18+** (support docs).
- Privacy: Fitbit/Google Health wellness data **not used for Google Ads** (stated commitment).

### 6.3 Operational guardrails in productization (beyond the paper)

Google’s Oct 2025 coach blog describes:

- **SHARP** eval framework: **S**afety, **H**elpfulness, **A**ccuracy, **R**elevance, **P**ersonalization.
- Scale: claimed **>1M human annotations**, **>100k hours** expert/generalist evaluation; autoraters for scale.
- **Consumer Health Advisory Panel** + in-house clinical/sports scientists.
- Multi-agent separation: conversational orchestration vs **data-science agent that computes** vs domain-expert plan agent — reduces pressure on a single generative pass to invent numbers.

**PPD alignment:** These product guardrails map cleanly onto PPD’s hard constraint (EU non-diagnostic; deterministic physiology; LLM narrates).

---

## 7. Did PH-LLM ship? What happened since publication?

| Date | Event | Status of “PH-LLM” |
|---|---|---|
| 2024-06 | arXiv + Google Research blog with PHIA companion | Research only |
| 2025-08 | Nature Medicine publication; GitHub datasets/notebooks | Research artifact release |
| 2025-10 | Fitbit **Personal Health Coach** public preview (US Premium Android → iOS); blog cites “capabilities similar to those showcased by PH-LLM” + multi-agent design | **PH-LLM not a product SKU**; research → product capability |
| 2025–2026 | PHIA journal version (*Nature Communications*) strengthens agent+code-gen narrative | Parallel research track |
| 2026-05 | **Google Health Coach** exits preview; Fitbit app → Google Health; Premium GA from May 19 | Gemini-powered multi-agent coach; wellness disclaimers |

**Bottom line:** PH-LLM as a standalone fine-tuned Gemini Ultra model was **not released as an API/product**. Its ideas (wearable contextualization, sleep/fitness coaching eval, multimodal aggregates) fed Google’s consumer coach; the **shipping architecture is multi-agent + tools**, not a single PH-LLM endpoint.

---

## 8. Follow-up work that supersedes or extends PH-LLM

1. **PHIA (Merrill et al.)** — ReAct agent + Python sandbox + web search; **84%** accuracy on 4,000 objective numeric health queries; human eval shows large gains vs single-shot code gen / text numerical reasoning. Explicitly contrasts with PH-LLM’s in-model reasoning over **pre-aggregated** 30-day summaries. **This is the more relevant numeric architecture for PPD.**
2. **Google Health Coach multi-agent system (2025–2026)** — Conversation agent + data-science agent (fetch/analyze/summarize, code when needed) + domain expert agents; SHARP eval; proactive “Today” insights. Production evolution of the research line.
3. **Broader Google health LLM stack (context only):** Med-PaLM / Med-Gemini remain **clinical** research tracks — different risk class; do not import diagnostic framing into PPD.

---

## 9. What Peak Performance Data should adopt

Concrete recommendations mapped to PPD’s stack (ClickHouse wearables, Supabase training/match, non-diagnostic EU constraint, deterministic physiology + narrating LLM).

### 9.1 Data representation (highest leverage)

1. **Feed the LLM curated daily + aggregate “athlete cards,” not raw timeseries.** Mirror PH-LLM’s case-study inputs: 14–30 day daily tables + means/SDs + acute/chronic ratios + peer or personal baselines. Keep high-resolution series in ClickHouse for tools, not prompt stuffing.
2. **Never ask the LLM to invent physiological numbers.** PHIA’s result is the warning: LLMs fail numerical reasoning; code/tools must compute HRV deltas, ACWR, sleep consistency, CGM TIR, etc. The model narrates tool outputs.
3. **Dual path is OK:** (a) deterministic metric tools for any number shown to users; (b) optional learned adapters later for soft signals (e.g., predicted subjective readiness) — but **never present adapter scores as measured physiology**.
4. **Include peer/personal percentiles carefully** (as PH-LLM did for sleep): personalization improves coaching, but label as population/personal baselines, not clinical norms.

### 9.2 Agent architecture

5. **Prefer PHIA/Health-Coach-style multi-agent over full-model PH-LLM SFT.** For PPD: orchestrator + **data tools** (ClickHouse/Supabase) + domain specialists (sleep/recovery, training load, tennis match, parent/coach voice) + shared non-diagnostic policy.
6. **Chain sections with consistency checks.** PH-LLM’s section chaining helped structure; their failure mode was contradiction across sections — add a verifier that readiness recommendations must cite computed metrics and not conflict with prior insight bullets.
7. **Use synthetic or real subjective context deliberately.** Fitness case studies needed fatigue/soreness; PPD should collect athlete RPE / wellness check-ins rather than invent them.

### 9.3 Evaluation (steal their rubric, not their exams)

8. **Build academy-specific case studies** (coach-authored gold answers) with rubrics covering: domain knowledge, use of athlete data, personalization, confabulation, **potential for harm**, readability — plus PPD-specific “**no invented numbers**” and “**non-diagnostic language**” principles.
9. **Holdout must be human-written from scratch** (they did this correctly) to avoid LLM-on-LLM circularity.
10. **AutoEval raters** (small LoRA / prompted judge) for CI; human experts for release gates — SHARP-like axes: Safety, Helpfulness, Accuracy, Relevance, Personalization.
11. **MCQ domain probes are necessary but insufficient** — use as regression tests for sports-science knowledge, not as go-live criteria.

### 9.4 Prompting / personalization

12. **Scaffold with coaching frameworks** (RU-SATED-like sleep; SMART goals; readiness scales), role-aware (coach vs athlete vs parent).
13. **Personalize with constraints** the sensors miss: schedule, tournament calendar, injury flags, academy rules — PH-LLM’s biggest qualitative gap.
14. **Second-person coach voice** for athlete/parent surfaces; third-person clinical-adjacent tone for coach dashboards if preferred — keep both non-diagnostic.

### 9.5 Safety / regulatory posture (EU)

15. Copy product-level framing: **wellness/performance coaching, not medical device**; always-on disclaimer; escalate to clinicians for symptoms.
16. Rubric-enforce **refusal/redirect** on diagnostic asks (“Do I have sleep apnea?” → refer).
17. Explicitly evaluate **harm misses** they found: undersleeping, detraining, overreach — especially for junior athletes.

### 9.6 Modalities PPD is adding (biomarkers, genetics, CGM)

18. Extend the **same pattern**: deterministic feature extraction → structured card → narrating agent. Do **not** fine-tune an LLM to “read” raw CGM curves or genetic VCFs end-to-end without tools.
19. Genetics/biomarkers: stricter non-diagnostic language; prefer “research associations / training implications discussed with staff” over etiology claims.

---

## 10. What we should NOT copy

| PH-LLM / Google pattern | Why not for PPD |
|---|---|
| **Full fine-tune of a frontier Gemini Ultra on private wearable case studies** | Cost, data access, model lock-in; Google’s own product moved to **multi-agent + tools** on general Gemini. |
| **In-model arithmetic over sensor tables as source of truth** | Documented failure mode; contradicted by PHIA; violates PPD “no invented numbers.” |
| **Treating exam-passing as product readiness** | Authors themselves call MCQs necessary≠sufficient; sleep recommendations still lag experts. |
| **MLP adapter as the primary numeric path for user-facing metrics** | Useful for soft PRO research; **not** a substitute for deterministic physiology pipelines. |
| **Claiming “raw timeseries multimodal LLM” from the 2024 blog wording** | Journal clarifies aggregates/text for coaching; avoid overclaiming in PPD design docs. |
| **LLM-drafted training labels without a clean human holdout** | Risk of absorbing model confabulations (their fitness training-load regression). |
| **Diagnostic / clinical framing (Med-PaLM style)** | Wrong risk class for EU non-device constraint; PH-LLM is the wellness cousin — stay there. |
| **Assuming sensor-only etiology is enough** | Experts said context is essential; academy workflows must inject schedule/injury/RPE. |
| **Shipping without harm-focused eval** | Undersleeping/detraining misses are exactly the failure modes academies care about. |
| **Expecting behavior-change proof from model ratings alone** | Neither PH-LLM nor early coach blogs claim outcome RCTs; don’t oversell. |

---

## 11. Design lesson for PPD (one paragraph)

PH-LLM proves that a strong general LLM **plus** carefully structured wearable aggregates and expert coaching scaffolds can approach human coaches on sleep/fitness *narrative* tasks — but Google’s own follow-ons show the durable architecture is **agentic computation + specialist orchestration + ruthless eval for confabulation and harm**, not a single fine-tuned model inventing physiology. Peak Performance Data should implement the **case-study card + tool-computed metrics + narrating multi-agent** pattern, with SHARP-like non-diagnostic gates, and treat PH-LLM’s SFT and MLP adapter as research techniques to borrow from selectively, not as the production blueprint.

---

## 12. Source URLs (complete)

### Primary PH-LLM
- https://arxiv.org/abs/2406.06474  
- https://arxiv.org/html/2406.06474  
- https://www.nature.com/articles/s41591-025-03888-0  
- https://doi.org/10.1038/s41591-025-03888-0  
- https://research.google/pubs/a-personal-health-large-language-model-for-sleep-and-fitness-coaching/  
- https://research.google/pubs/towards-a-personal-health-large-language-model/  
- https://github.com/Google-Health/consumer-health-research/tree/main/phllm  

### Companion PHIA / agents
- https://arxiv.org/abs/2406.06464  
- https://arxiv.org/html/2406.06464  
- https://www.nature.com/articles/s41467-025-67922-y  
- https://doi.org/10.1038/s41467-025-67922-y  

### Google Research / product blogs
- https://research.google/blog/advancing-personal-health-and-wellness-insights-with-ai/ (2024-06-11)  
- https://research.google/blog/how-we-are-building-the-personal-health-coach/ (2025-10-27)  
- https://blog.google/products-and-platforms/products/google-health/google-health-coach/ (2026-05-07)  
- https://support.google.com/googlehealth/answer/17068213?hl=en (Google Health app / Premium / Coach eligibility & “not medical purposes”)  

### Related context (not PH-LLM)
- HeLM multimodal adapter methodology (cited by PH-LLM for Stage B): search “HeLM multimodal LLM wearable” / Belyaeva et al. references inside the PH-LLM paper.  
- Med-PaLM lineage talks (clinical, different track): https://www.youtube.com/watch?v=3Ud-BMOCkDI  

---

## 13. Freshness flags

| Claim | Status as of 2026-08-02 |
|---|---|
| Architecture / metrics from Nature Medicine 2025 | **Current journal version** — prefer over 2024 blog “raw timeseries” shorthand |
| Hyperparameters for SFT | Best detailed in **2024 arXiv**; journal focuses on “entire model” finetune |
| Product = Google Health Coach | **Current** (GA May 2026); still wellness-disclaimer, Fitbit/Pixel-first |
| PH-LLM public API | **Does not exist** |
| Dedicated PH-LLM conference talk | **Not found**; may appear later — treat as gap |

---

*End of dossier.*
