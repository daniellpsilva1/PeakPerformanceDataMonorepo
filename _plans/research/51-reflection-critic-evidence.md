# 51 — Reflection, Self-Critique & Verifier Patterns: Evidence For and Against

**Topic:** Whether a critic/verifier stage for athlete-facing insights is evidence-backed or cargo-culting  
**Scope:** External research only (web search + web fetch of primary papers, surveys, and production writeups). No local codebase exploration beyond writing this file.  
**Research date:** 2026-08-02  
**Currency note:** Foundational methods are 2023–2024; counter-evidence, surveys, and production practice updated through mid-2026.

---

## Verdict (TL;DR)

| Question | Answer |
|---|---|
| Does intrinsic self-critique “just work”? | **No.** Huang et al. (ICLR 2024) and Kamoi et al. (TACL 2024) show prompted LLMs generally **cannot** reliably self-correct reasoning without external feedback; performance often **degrades**. |
| When does a critic help? | When the critic has **extrinsic signal**: tools, ground-truth tool returns, code execution, deterministic matchers, or a **different** model family with a clear rubric. |
| Generator–verifier asymmetry | Holds for **checkable** properties (numbers match tool output; citation IDs exist). Does **not** hold for open semantic judgment (tone “usefulness”) without calibration. |
| Right design for PPD | **Deterministic-first verifier stack** for numeric grounding + citation validity; **hybrid** (rules + small classifier/LLM) for medical claims; **sampled mid-tier LLM judge** for audience tone. Full Self-Refine loops on every insight = cargo cult. |

**Bottom line:** A critic stage is **not** cargo-culting **if** it is mostly extrinsic verification against tool returns and allowlists. An LLM that “reviews itself” with no new information **is** cargo-culting for factual/medical guarantees.

---

## 1. Foundational techniques (accurate summaries + reported gains)

### 1.1 Self-Refine (Madaan et al., NeurIPS 2023)

**Mechanism:** Same LLM acts as generator → feedback provider → refiner, iteratively, with no extra training.

**Source:** [Self-Refine abstract / NeurIPS](https://proceedings.neurips.cc/paper_files/paper/2023/hash/91edff07232fb1b55a505a9e9f6c0ff3-Abstract-Conference.html), [PDF](https://proceedings.neurips.cc/paper_files/paper/2023/file/91edff07232fb1b55a505a9e9f6c0ff3-Paper-Conference.pdf)

**Reported gains (authors):**

> Across all evaluated tasks, outputs generated with SELF-REFINE are preferred by humans and automatic metrics over those generated with the same LLM using conventional one-step generation, improving by ∼20% absolute on average in task performance.

Tasks spanned dialog, code optimization, math, acronym generation, etc. Gains are strongest on **open-ended generation quality** (style, preference), not on hard reasoning with oracle-free correctness.

**Caveat (later critique):** Huang et al. argue some Self-Refine-style gains on reasoning can come from **sub-optimal initial prompts** rather than true self-correction (see §2).

---

### 1.2 Reflexion (Shinn et al., NeurIPS 2023)

**Mechanism:** Agent converts environmental reward / failure signals into **verbal reflections** stored in episodic memory; next trial conditions on those reflections. Not weight updates—“verbal RL.”

**Source:** [arXiv:2303.11366](https://arxiv.org/abs/2303.11366), [PDF](https://arxiv.org/pdf/2303.11366)

**Reported gains (authors):**

> Reflexion agents improve on decision-making AlfWorld tasks over strong baseline approaches by an absolute 22% in 12 iterative learning steps, and on reasoning questions in HotPotQA by 20%, and Python programming tasks on HumanEval by as much as 11%.

Also: HumanEval pass@1 up to **91%** vs GPT-4 baseline ~80% in their setup (with unit-test / environment feedback for code).

**Critical caveat:** Huang et al. show that for reasoning, Reflexion-style loops that **stop when an oracle says the answer is correct** inflate gains; without oracle labels, gains vanish or reverse. Reflexion’s real strength is **environment/tool feedback** (AlfWorld success heuristics, compiler/tests), not pure self-talk.

---

### 1.3 CRITIC (Gou et al., ICLR 2024)

**Mechanism:** Generate → interact with **external tools** (search, code interpreter) to critique → revise. Explicitly tool-interactive.

**Source:** [arXiv:2305.11738](https://arxiv.org/abs/2305.11738), [OpenReview / ICLR](https://openreview.net/forum?id=Sx038qxjek)

**Reported gains (authors / summaries of paper):**

- ChatGPT: **~7.7 F1** on free-form QA; **~7.0 absolute** on math program synthesis; **~79% reduction** in toxicity probability (toxicity task).
- Ablation is decisive:

> Tool-interaction plays a critical role in CRITIC, as the model’s own critiques contribute marginally to the improvement (−0.03 and +2.33 F1 with the two LLMs), and even fall short compared to the initial output.

**Takeaway for PPD:** CRITIC is the closest academic cousin to what we want—**critique against tools**, not against the model’s vibes.

---

### 1.4 Chain-of-Verification / CoVe (Dhuliawala et al., Findings ACL 2024)

**Mechanism:** (i) draft → (ii) plan verification questions → (iii) answer questions **independently** (factored; do not attend to the draft) → (iv) produce verified final answer.

**Source:** [ACL Anthology](https://aclanthology.org/2024.findings-acl.212/), [arXiv:2309.11495](https://arxiv.org/abs/2309.11495)

**Reported gains (authors):**

> CoVe provides large gains in precision on the list-based tasks, e.g. more than doubles the precision from the Llama 65B few-shot baseline for the Wikidata task (from 0.17 to 0.36).

> We observe a 23% improvement in F1 over the few-shot baseline (0.39 → 0.48) [MultiSpanQA].

> FACTSCORE increases 28% (55.9 → 71.4) from the few-shot baseline [longform], with again only a relatively small reduction in average number of facts provided (16.6 → 12.3).

Factored / 2-step variants beat joint verification because joint answering tends to **repeat the hallucination**.

**Caveat:** CoVe is still largely **intrinsic** (same model’s parametric knowledge answering its own check questions). It reduces some hallucinations by making verification easier than generation, but it is **not** a substitute for grounding against retrieved tool data.

---

### 1.5 Evaluator–optimizer workflow (Anthropic, Dec 2024 → still canonical in 2026)

**Mechanism:** One LLM call generates; another evaluates against criteria and returns feedback; loop until PASS or max iterations.

**Source:** [Building effective agents](https://www.anthropic.com/engineering/building-effective-agents) (2024-12-19)

**When Anthropic says it fits:**

> This workflow is particularly effective when we have **clear evaluation criteria**, and when iterative refinement provides measurable value. The two signs of good fit are, first, that LLM responses can be demonstrably improved when a human articulates their feedback; and second, that the LLM can provide such feedback.

**Examples they give:** literary translation nuances; complex search that needs another round.

**When they warn against complexity:**

> Agentic systems often trade latency and cost for better task performance… you should consider adding complexity **only when it demonstrably improves outcomes**.

Anthropic Labs’ later generator–evaluator harness work (2026 reporting) underscores a related production lesson: agents grading their own work tend toward **confident praise**; a separate, skeptical evaluator is more tractable—but cost can jump dramatically (order-of-magnitude) when overused on long-running tasks.

---

## 2. Critical counter-evidence: “Cannot Self-Correct Reasoning Yet” and follow-ups

### 2.1 Huang et al., ICLR 2024 — core argument

**Paper:** *Large Language Models Cannot Self-Correct Reasoning Yet*  
**Source:** [ICLR PDF](https://proceedings.iclr.cc/paper_files/paper/2024/file/8b4add8b0aa8749d80a34ca5d941c355-Paper-Conference.pdf), [arXiv HTML](https://arxiv.org/html/2310.01798v2)

**Central definition:**

> …**intrinsic self-correction**, whereby an LLM attempts to correct its initial responses based solely on its inherent capabilities, without the crutch of external feedback.

**Core findings (reproduce carefully):**

1. **With oracle labels** (stop correcting once the answer matches ground truth), methods like RCI / Reflexion-style loops show large gains—e.g. GPT-3.5 GSM8K 75.9 → 84.3; CommonSenseQA 75.8 → 89.7.
2. **Without oracle labels**, the same loop **hurts**:

| Model | Setting | GSM8K | CommonSenseQA | HotpotQA |
|---|---|---:|---:|---:|
| GPT-3.5 | Standard | 75.9 | 75.8 | 26.0 |
| GPT-3.5 | Self-Correct r1 (3 calls) | 75.1 | **38.1** | 25.0 |
| GPT-3.5 | Self-Correct r2 (5 calls) | 74.7 | 41.8 | 25.0 |
| GPT-4 | Standard | 95.5 | 82.0 | 49.0 |
| GPT-4 | Self-Correct r1 | 91.5 | 79.5 | 49.0 |
| GPT-4 | Self-Correct r2 | 89.0 | 80.0 | 43.0 |

3. **Mechanism of failure:** models cannot reliably judge their own reasoning; they flip correct→incorrect more often than incorrect→correct on several tasks.
4. **Fairness of cost:** multi-agent debate is no better than **self-consistency** at equal call budget.
5. **Prompt confound:** some “self-correction gains” disappear when the feedback prompt’s extra task info is simply put into the **initial** prompt.

**Authors’ paradox:**

> If an LLM possesses the ability to self-correct, why doesn’t it simply offer the correct answer in its initial attempt?

### 2.2 Kamoi et al., TACL 2024 — critical survey

**Paper:** *When Can LLMs Actually Correct Their Own Mistakes?*  
**Source:** [ACL Anthology](https://aclanthology.org/2024.tacl-1.78/), [arXiv:2406.01297](https://arxiv.org/abs/2406.01297)

**Survey conclusions (quoted):**

> (1) no prior work demonstrates successful self-correction with feedback from prompted LLMs, except for studies in tasks that are exceptionally suited for self-correction, (2) self-correction works well in tasks that can use **reliable external feedback**, and (3) **large-scale fine-tuning** enables self-correction.

They identify **feedback generation** as the bottleneck: models can sometimes repair once an error is localized/oracled, but cannot reliably produce that feedback themselves.

### 2.3 Follow-ups through 2025–2026

| Work | Year | Claim |
|---|---|---|
| Li — *Accuracy-Correction Paradox* | 2025–26 ([arXiv:2601.00828](https://arxiv.org/pdf/2601.00828)) | Weaker models get **higher** intrinsic correction rates (26.8% vs 16.7%); stronger models make fewer but **deeper** errors that resist self-fix. Detection ≠ correction success. |
| *The Self-Correction Illusion* | 2026 ([arXiv HTML](https://arxiv.org/html/2606.05976)) | Models correct **others’** errors more readily than **identical** errors in their own traces—self-correction asymmetry is structural, not just “need a better prompt.” |
| Contrastive Reflection Memory etc. | 2026 | Training-free / memory-guided verification still acknowledges that pure unsupervised iterative Self-Refine accumulates feedback errors and cost. |

**Consensus through mid-2026:** Intrinsic self-critique for **reasoning correctness** is weak-to-negative. Extrinsic / tool / oracle / fine-tuned correctors can work. Preference/style refinement (Self-Refine’s sweet spot) is a different claim and should not be conflated with factual grounding.

---

## 3. The distinction that matters: intrinsic vs extrinsic

| Axis | Intrinsic self-correction | Extrinsic verification |
|---|---|---|
| New information? | None — same weights, same knowledge | Tools, retrieval, tests, schemas, human labels, other model |
| Evidence status | Generally **fails** for reasoning (Huang; Kamoi) | **Works** when feedback is reliable (CRITIC; Reflexion+env; code tests) |
| Typical PPD mapping | “Please critique this insight for accuracy” with no tool bundle | Match numbers to tool JSON; check citation IDs; medical regex/classifier; separate judge model |
| Failure mode | Confirmation bias; correct→incorrect flips; confident self-praise | Tool bugs / incomplete allowlists; judge bias; over-refusal |

**Evidence summary:**

- **Intrinsic:** prefer not to rely on it for safety-critical or numeric claims. Style polish only, if anything.
- **Extrinsic:** this is where published gains concentrate. CRITIC’s ablation (tool-less critique ≈ useless) is the cleanest single data point.

For PPD, every athlete-facing number already has a **deterministic oracle** (the tool return). That is the strongest possible extrinsic signal. Wasting an LLM call to “verify” arithmetic the parser can check is the cargo-cult failure mode.

---

## 4. Generator–verifier asymmetry: when it holds

### 4.1 The optimistic framing

Jason Wei’s *Asymmetry of verification / Verifier’s rule* ([blog](https://www.jasonwei.net/blog/asymmetry-of-verification-and-verifiers-law)):

> Asymmetry of verification is the idea that some tasks are much easier to verify than to solve.  
> **Verifier’s rule:** The ease of training AI to solve a task is proportional to how verifiable the task is. All tasks that are possible to solve and easy to verify will be solved by AI.

Properties that make verification easy: fast to check, objective, scalable, low noise.

Cobbe et al. (2021) and later “alpha asymmetry” arguments: a verifier scores candidates in a **smaller hypothesis space** than a generator that must invent the answer; small verifiers can beat large generators on math when used for selection (e.g. rStar-Math-style systems).

### 4.2 The pushback

LessWrong / Alignment Forum: *Verification Is Not Easier Than Generation In General* ([post](https://www.lesswrong.com/posts/2PDC69DDJuAx6GANa/verification-is-not-easier-than-generation-in-general)):

> …among problems for which verification is easy, verification is easier than generation. Rather a less impressive claim, when you put it like that.

Counterexample class: generating a program that halts is easy; verifying that an arbitrary program halts is undecidable.

### 4.3 LLM-specific evidence (2025)

*Variation in Verification* ([arXiv HTML](https://arxiv.org/html/2509.17995)) and *When Does Verification Pay Off?* (Lu et al., Dec 2025, [arXiv:2512.02304](https://arxiv.org/abs/2512.02304)):

- Verification effectiveness depends on **problem difficulty**, **generator strength**, and **verifier–solver distribution similarity**.
- As solvers get stronger / post-trained for reasoning, **self-verification gains shrink** (higher false-positive accept rates on their own wrong answers).
- **Cross-family** verification often yields higher **verifier gain** than self- or intra-family verification.
- Math / logic / structured puzzles are more verifiable than knowledge-recall / open judgment.

**For PPD:**

| Check | Asymmetry holds? | Why |
|---|---|---|
| Number ∈ tool payload | **Strongly yes** | Exact match / numeric tolerance — classic NP-style verify |
| Citation ID exists in retrieval set | **Strongly yes** | Set membership |
| Medical diagnose/prescribe language | **Partial** | Lexical patterns easy; paraphrases need classifier |
| Tone useful for coach vs parent | **Weak / no** | Subjective; judge ≈ as hard as generate without human rubric |

---

## 5. LLM-as-judge reliability

### 5.1 Known biases

| Bias | Effect (reported ranges) | Sources |
|---|---|---|
| **Position bias** | ~10–15 pt swing on pairwise; not random | Zheng et al. 2024; Shi et al. IJCNLP/AACL 2025 ([anthology](https://aclanthology.org/2025.ijcnlp-long.18/)) |
| **Verbosity bias** | Historically 15–30 pt preference for longer; **much reduced** (<0.011) in 2026 cohort under controlled pairwise rubrics | Wang 2023 vs [Reliability without Validity, 2026](https://arxiv.org/html/2606.19544v1) |
| **Self-preference / family bias** | ~10–25 pt inflation for same-family outputs | Zheng 2024; FutureAGI 2026 summary |
| **Consistency–bias paradox** | Test–retest >0.95 can coexist with severe position bias >0.10 | [Reliability without Validity](https://arxiv.org/html/2606.19544v1) |
| **Kappa deflation** | Exact-match agreement overstates chance-corrected discrimination by **33–41 pp** on MT-Bench | Same 2026 large-scale study (~541k judgments) |

### 5.2 Production mitigations that work

From Arize (2025–26), FutureAGI (2026), Brenndoerfer notes, Shopify Sidekick:

1. **Shuffle / dual-order** pairwise (A/B and B/A); average or require agreement.  
2. **Cross-family judges** — never let the generator’s twin grade itself for launch decisions.  
3. **Pinned judge contract** (model version + rubric + schema); monitor drift.  
4. **Calibrate to humans** with Cohen’s κ (Shopify: 0.02 → 0.61 vs human ceiling 0.69).  
5. **N-stage gated rewards:** deterministic/schema checks **before** semantic LLM judges (Shopify).  
6. **Ensemble consensus** for high-stakes labels; discard disagreements rather than arbitrating (Shopify Sidekick curation, 2026).  
7. Prefer **pointwise rubrics with evidence spans** over vague 1–10 vibe scores.

---

## 6. Different model as critic vs self-critique

**Evidence:** Lu et al., *When Does Verification Pay Off?* (2025) — 37 models, 9 benchmarks ([project page](https://agenticlearning.ai/llm-verification/), [arXiv](https://arxiv.org/abs/2512.02304)):

> We find that **cross-family verification is often more beneficial** than intra-family verification or self-verification, comparing particularly favorably to the latter. … verifier gain decreases as the solution distributions of solver and verifier become more similar. … as models become stronger … they become **less effective as self-verifiers** and **more effective as cross-family verifiers**.

EmergentMind summary of same line of work: cross-family gains on the order of **~2–5 pp** (up to ~7 on highly checkable tasks) via rejection sampling—not magic, but consistently better than self-verify.

**Implication for PPD:** If we use an LLM critic for tone or paraphrase medical detection, prefer a **different family / smaller specialized classifier** than the insight generator. Do **not** ask the generator to approve its own medical safety.

---

## 7. Cost, latency, and making critics cheap

Industry guardrail practice (2025–2026) converges on a **tiered cascade**:

| Tier | Mechanism | Latency | $/request (order of magnitude) |
|---|---|---|---|
| 0 | Regex, schema, allowlists, JSON path equality | µs–ms | ~0 |
| 1 | Small classifier / Haiku-class / ONNX distillate | 10–100 ms | $0.000–0.005 |
| 2 | Mid LLM judge (Sonnet / GPT-4o-class) | 0.5–5 s | $0.01–0.05 |
| 3 | Frontier ensemble / human | seconds–hours | $0.05–50 |

**Techniques that matter for PPD:**

1. **Short-circuit:** fail numeric/citation checks before any LLM critic.  
2. **Sample:** run expensive tone judges on **10–20%** of insights + all high-risk (medical flag, first-time athlete, coach override).  
3. **Batch dimensions** into one judge call when an LLM is needed.  
4. **Async audit** for tone; **sync block** only for medical + numeric failures.  
5. Anthropic routing pattern: cheap model for classification, expensive only when needed.  
6. Prefer **one regenerate** or **template downgrade** over multi-round Self-Refine (each round ≈ ×2–5 cost with diminishing/negative returns on factual tasks).

---

## 8. Production evidence: teams that shipped critics / judges

These are **measured** systems—not blogware:

### 8.1 Shopify Sidekick (2025–2026)

**Sources:** [Building production-ready agentic systems](https://shopify.engineering/building-production-ready-agentic-systems), [Teaching Sidekick to say no](https://shopify.engineering/sidekick-curation) (2026)

- Calibrated LLM judges vs expert GTX: Cohen’s κ **0.02 → 0.61** (human baseline 0.69).  
- **N-Stage Gated Rewards:** procedural/schema validation **before** semantic judges.  
- Syntax validation accuracy **~93% → ~99%**; judge correlation **0.66 → 0.75**.  
- Multi-judge consensus for refusal curation: segmentation skill **0.619 → 0.798** with refusal capability; curated vs naive merge **0.762 → 0.798**.  
- Explicit rejection of “vibe testing” (rate 0–10 without calibration).

### 8.2 Anthropic customer guidance + internal harness

- Evaluator–optimizer is a **named production pattern**, but only with clear criteria and measured value.  
- Parallelization pattern: **separate guardrail model** from the main response model—“tends to perform better than having the same LLM call handle both guardrails and the core response.”  
- Coding agents succeed because **tests are extrinsic verifiers**.

### 8.3 What production does *not* report

Credible teams do **not** claim that ungrounded “please improve yourself” loops fixed factual errors in production. Gains attach to: calibrated judges, schema gates, environment feedback, and cross-model ensembles.

---

## 9. Application to PPD’s four verification needs

### Check 1 — Numeric grounding

**Requirement:** Every number in the insight must match a value returned by a tool.

| Question | Answer |
|---|---|
| Right tool? | **Deterministic.** Parser + structured claim extraction + exact/tolerance match against tool JSON. |
| LLM critic? | **No as primary.** Optional only to *extract* claims from free text if the generator does not emit structured `{value, unit, source_tool, path}` — better: **force structured evidence chips at generation time**. |
| Failure action | **Block or regenerate once** with “allowed numbers only” constraint; if still fail → **template fallback** with raw tool stats, no free prose. |
| Evidence | Generator–verifier asymmetry is maximal here; Huang/Kamoi say intrinsic critique won’t catch arithmetic it can’t judge. |

**Design detail:** Generator must emit numbers only via bound slots (e.g. `{{hrv_rmssd_ms}}`) or a post-hoc AST/regex of numbers cross-checked to a whitelist of floats from the tool envelope (±ε for rounding). Unmatched number → hard fail.

---

### Check 2 — Medical-claim detection

**Requirement:** No diagnosis or prescription.

| Question | Answer |
|---|---|
| Right tool? | **Hybrid:** Tier-0 banned phrases / diagnose–prescribe patterns → Tier-1 small classifier or Haiku-class binary → Tier-2 cross-family LLM only on ambiguous. |
| LLM-only critic? | Insufficient alone (paraphrase escape); rules alone miss soft diagnosis (“you have overtraining syndrome”). |
| Failure action | **Block** publish; rewrite via safe template (“Talk to your clinician…”) or regenerate with medical-safe system prompt **once**. Never soft-pass. |
| Evidence | Healthcare guardrail practice + Anthropic parallel guardrails; medical libraries (e.g. llm-medical-guard style) show µs rule layers catch cure/dose claims. |

**Policy vocabulary to flag (non-exhaustive):** diagnose, disorder, disease, prescription, dosage, “you have/should take/must stop [medication]”, pathologizing HRV/sleep as clinical conditions.

---

### Check 3 — Citation validity

**Requirement:** Every evidence chip references a real retrieved datum.

| Question | Answer |
|---|---|
| Right tool? | **Deterministic.** Chip `source_id` ∈ retrieved set; optional field-path exists; snippet hash match. |
| LLM critic? | **No.** CoVe-style “ask if this citation is real” without the retrieval set is intrinsic hallucination theater. |
| Failure action | Drop invalid chips; if claim loses all evidence → **block or regenerate**. |
| Evidence | Same as numeric: set membership is the ideal extrinsic verifier. |

---

### Check 4 — Tone & usefulness (coach vs athlete vs parent)

| Question | Answer |
|---|---|
| Right tool? | **LLM judge (mid-tier, different family preferred)** with a **role-specific rubric** + few-shot gold examples; calibrated monthly against human labels. |
| Deterministic? | Only shallow: reading-level heuristics, forbid jargon lists per audience, max sentence length. Not sufficient for “useful.” |
| Coverage | **Sample 10–20%** online + 100% offline nightly batch; escalate 100% for new prompt versions. |
| Failure action | **Regenerate once** with audience critique feedback; if fail again → ship with **tone warning flag** for coach review (do not block unless also medical/numeric fail). |
| Evidence | Self-Refine’s real wins are preference/style; Anthropic evaluator–optimizer fit when criteria are clear; Shopify shows calibration is mandatory. |

---

## 10. Concrete verifier design for PPD

### 10.1 Architecture (deterministic-first cascade)

```
Insight draft (generator, structured evidence chips required)
        │
        ▼
[T0] Schema + numeric whitelist + citation ID set-check     ← every output, sync, ~0$
        │ fail → regenerate once (constrained) → else TEMPLATE / BLOCK
        ▼
[T0b] Medical regex / banned clinical speech                ← every output, sync, ~0$
        │ hard hit → BLOCK (or medical-safe rewrite once)
        ▼
[T1] Small medical classifier / Haiku binary (diagnose?)   ← every output OR when T0b soft-hit
        │ positive → BLOCK / safe rewrite
        ▼
[T2] Audience tone LLM judge (cross-family, rubric)        ← sample 15% + all new prompts
        │ fail → regenerate once with feedback; else FLAG
        ▼
Publish (or coach review queue if FLAG)
```

**Do not run:** multi-round Self-Refine / Reflexion without tool feedback on the happy path.

### 10.2 Model tiers

| Role | Tier | Rationale |
|---|---|---|
| Insight generator | Mid/frontier (existing) | Quality of prose + tool use |
| Medical binary | Small / Haiku-class or distilled classifier | High recall, cheap, every request |
| Tone judge | Mid, **different family** from generator | Cross-family verifier gain; avoid self-preference |
| Ensemble / frontier judge | Launch & prompt-change only | Cost; Shopify-style consensus |

### 10.3 Sampling policy

| Check | Frequency |
|---|---|
| Numeric + citation | **100%** |
| Medical rules | **100%** |
| Medical small model | **100%** until FNR proven < target; then can soft-sample if rules catch 95%+ |
| Tone LLM | **15%** steady-state; **100%** for canaries / prompt diffs / first 2 weeks of a skill |

### 10.4 Failure policy (summary)

| Failure | Action |
|---|---|
| Numeric mismatch | Regenerate ×1 constrained → else **template** (numbers only, canned copy) |
| Invalid citation | Strip chip; if claim unsupported → same as numeric fail |
| Medical hard | **Block** or forced disclaimer rewrite; never silent publish |
| Tone fail | Regenerate ×1 → else publish + `needs_human_tone_review` |

Max LLM refinement loops: **1**. Prefer block/template over thrashing (Huang: more rounds can worsen correctness).

### 10.5 Expected cost per insight (order-of-magnitude, 2026 API prices)

Assume ~800–1500 tokens generator already sunk.

| Component | $/insight |
|---|---|
| T0 numeric + citation + medical regex | **~$0.000** |
| T1 medical small model (every time) | **~$0.0005–0.002** |
| T2 tone judge @ 15% sample | **~$0.0015–0.006** amortized (~$0.01–0.04 when sampled) |
| Constrained regenerate (assume 10% fail T0/T1) | **~$0.002–0.008** amortized |
| **Steady-state total verifier overhead** | **≈ $0.004–0.015 / insight** |
| Naïve full Self-Refine 2 rounds + self-judge every time | **≈ $0.04–0.15 / insight** with **worse** factual risk |

Latency budget: T0+T1 add **<100 ms** if classifiers are local/small; T2 should be **async** for user-facing paths or only on batch nightly insights.

### 10.6 Success metrics (so this is not cargo cult)

Ship the critic only if we measure:

1. Numeric mismatch rate → near **0** after T0 (target <0.1%).  
2. Medical false-negative rate on red-team set → **0 critical** escapes.  
3. Citation orphan rate → near **0**.  
4. Tone judge κ vs humans → **≥0.5** before using it to auto-regenerate.  
5. Ablation: show T2 improves human preference; if not, **drop T2** and keep T0/T1.

---

## 11. Final recommendation

| Pattern | Use for PPD? |
|---|---|
| Intrinsic Self-Refine on facts | **No** |
| Reflexion without env/oracle | **No** |
| CoVe without retrieval set | **Optional weak** for prose-only claims; not for tool-grounded numbers |
| CRITIC / tool-interactive critique | **Yes — but implement as code against tool returns**, not as free-form LLM “search your soul” |
| Evaluator–optimizer | **Yes for tone** with calibrated rubric; **no** as sole factual gate |
| LLM-as-judge | **Yes after human calibration**; never uncalibrated vibe scores |
| Cross-family critic | **Yes** when an LLM critic is needed |
| Deterministic gates | **Mandatory** for numbers + citations; first line for medical |

**Verdict sentence:** A critic/verifier stage is evidence-backed for PPD **only as an extrinsic, deterministic-first cascade** with a sampled, calibrated LLM judge for audience fit. An LLM that critiques its own reasoning without tools is the cargo-cult pattern Huang, Kamoi, and 2025–2026 follow-ups have repeatedly falsified.

---

## Sources (primary)

1. Madaan et al. — Self-Refine — https://proceedings.neurips.cc/paper_files/paper/2023/hash/91edff07232fb1b55a505a9e9f6c0ff3-Abstract-Conference.html  
2. Shinn et al. — Reflexion — https://arxiv.org/abs/2303.11366  
3. Gou et al. — CRITIC — https://arxiv.org/abs/2305.11738  
4. Dhuliawala et al. — Chain-of-Verification — https://aclanthology.org/2024.findings-acl.212/  
5. Anthropic — Building effective agents — https://www.anthropic.com/engineering/building-effective-agents  
6. Huang et al. — Cannot Self-Correct Reasoning Yet — https://arxiv.org/html/2310.01798v2  
7. Kamoi et al. — When Can LLMs Actually Correct Their Own Mistakes? — https://aclanthology.org/2024.tacl-1.78/  
8. Li — Accuracy-Correction Paradox — https://arxiv.org/pdf/2601.00828  
9. Self-Correction Illusion — https://arxiv.org/html/2606.05976  
10. Jason Wei — Asymmetry of verification — https://www.jasonwei.net/blog/asymmetry-of-verification-and-verifiers-law  
11. Verification not easier in general — https://www.lesswrong.com/posts/2PDC69DDJuAx6GANa/verification-is-not-easier-than-generation-in-general  
12. Variation in Verification — https://arxiv.org/html/2509.17995  
13. Lu et al. — When Does Verification Pay Off? — https://arxiv.org/abs/2512.02304  
14. Reliability without Validity (LLM-as-Judge 2026) — https://arxiv.org/html/2606.19544v1  
15. Shi et al. — Judging the Judges (position bias) — https://aclanthology.org/2025.ijcnlp-long.18/  
16. Arize — LLM-as-a-Judge in production — https://arize.com/blog/how-to-build-llm-as-a-judge-evaluators-that-hold-up-in-production/  
17. Shopify Sidekick production agents — https://shopify.engineering/building-production-ready-agentic-systems  
18. Shopify Sidekick LLM judge consensus (2026) — https://shopify.engineering/sidekick-curation  
19. FutureAGI — LLM-Judge bias mitigation 2026 — https://futureagi.com/blog/evaluating-llm-judge-bias-mitigation-2026/  
20. CMU LLM Inference lecture notes (Self-Refine / Huang synthesis) — https://www.youtube.com/watch?v=uaxf9yssDy4  
