# Research Dossier: Behavior-Change Science & Communication Design for AI Coaching (Youth Athletes)

**Topic:** Behavior-change frameworks, youth-athlete safeguarding, and content design for multi-audience AI coaching  
**Date researched:** 2026-08-02  
**Scope:** External research only (web/literature). Prioritized 2025–2026 sources; retained foundational consensus statements where they remain the governing guidance.  
**Audience context:** Tennis-academy platform serving coaches, adolescent athletes, and parents. Coaching guidance must motivate without pressuring, avoid anxiety/unhealthy behavior induction, and never make medical claims.

---

## 1. Executive takeaways

1. **Effective LLM coaches are modular behavior-science systems**, not chatbots with motivational tone. Google’s Personal Health Agent (PHA) and companion coaching work operationalize motivational interviewing (MI) + SMART goals as separate modules with conversation-flow control; users prioritize *substance* (actionable guidance) over stylistic MI flourishes.
2. **COM-B + BCT taxonomy + SDT** are the dominant design scaffolds for digital health coaching in 2024–2026 LLM systems; they map barriers → tactics → need-supportive language.
3. **Youth athletes are the highest-risk audience for quantified feedback.** Orthosomnia, RED-S / disordered eating pathways, overtraining anxiety, and readiness-score catastrophizing are documented risks. Body-composition and “recovery is poor” messaging are especially hazardous for minors.
4. **Genetics communication is a hard ban** for talent ID and gene-based training prescription per BJSM / FIMS / AIS position statements — including when parents request it.
5. **Parents should receive safeguarding-safe summaries**, not raw biometric dumps or ability judgments; consent must be specific, proportionate, and child-centered (ITF/LTA/IOC/COPPA principles).
6. **Confidence calibration is a product requirement.** Non-experts over-trust fluent AI medical/coaching text even when inaccurate; hedged, evidence-linked, action-scoped language is mandatory.

---

## 2. Behavior-change frameworks and LLM operationalization

### 2.1 COM-B model

**Core idea (Michie et al.):** Behavior occurs when **Capability** (physical/psychological), **Opportunity** (physical/social), and **Motivation** (reflective/automatic) are present.

**Digital/LLM operationalization (2024–2025):**

| Technique | How used | Evidence |
|-----------|----------|----------|
| **Coach-message priming** | Exemplar coach responses mapped to COM-B categories provided in context | Vardhan et al., *PLOS Digital Health* 2024 — primed LLM rated significantly higher for empathy and actionability |
| **Dialogue re-ranking** | Classify user need into C/O/M; re-rank candidate replies to match barrier | Same study — re-ranking further improved actionability/empathy vs unprimed |
| **Barrier → tactics repository** | Map ~28 barriers to 50+ strategies / 100+ tactics drawn from COM-B, BCTTv1, EAST | JMIR Formative 2025 nutrition coaching agentic workflow ([formative.jmir.org/2025/1/e75421](https://formative.jmir.org/2025/1/e75421)) |

**Sports-performance application:** Before prescribing “train harder,” diagnose whether the blocker is capability (skill/knowledge), opportunity (schedule/court access/parent logistics), or motivation (autonomy threat, fear of failure). Route messages accordingly.

**Sources:**
- https://journals.plos.org/digitalhealth/article?id=10.1371/journal.pdig.0000431
- https://formative.jmir.org/2025/1/e75421
- https://arxiv.org/pdf/2410.14041

### 2.2 Behaviour Change Technique (BCT) Taxonomy v1

**Core idea:** 93 hierarchically clustered “active ingredients” of behavior-change interventions (Michie et al., 2013). Improves transparency, replication, and evaluation of what an agent actually delivers.

**LLM operationalization:**
- Bloom (Stanford, 2025) maps UI interactions to BCT codes (goal setting, self-monitoring, feedback on behavior, social support, etc.) rather than treating chat as unstructured advice ([arxiv.org/html/2510.05449v1](https://arxiv.org/html/2510.05449v1)).
- JMIR 2026 scoping review of LLM cardiometabolic agents explicitly codes delivered BCTs as static / rule-based / generative ([jmir.org/2026/1/e89190](https://www.jmir.org/2026/1/e89190/PDF)).
- Nutrition agent workflows bind each barrier to BCT-aligned tactics rather than generic encouragement.

**Recommended BCT subset for academy coaching agents (safe defaults):**
- 1.1 Goal setting (behavior) — co-created, not imposed
- 1.4 Action planning — when/where/how
- 2.2 Feedback on behavior — descriptive, not evaluative of *worth*
- 2.3 Self-monitoring of behavior — optional for youth; coach-mediated preferred
- 3.1 Social support (unspecified) — coach/parent/teammate as appropriate
- 8.1 Behavioral practice/rehearsal — tennis-skill framing
- 15.1 Verbal persuasion about capability — *competence support*, not flattery

**Avoid / restrict for adolescents:**
- Aggressive social comparison (BCT 6.2) against peers’ recovery/body metrics
- Outcome goals tied to weight/body fat
- Punishment / contingent reward on sleep scores or readiness scores

### 2.3 Self-Determination Theory (SDT)

**Core needs:** **Autonomy**, **Competence**, **Relatedness** (Ryan & Deci). Autonomous motivation predicts sustained health behavior; controlling language undermines it.

**Effect sizes (meta-analysis):** Techniques promoting autonomy support (g≈0.84), autonomy (g≈0.81), competence (g≈0.63), relatedness (g≈0.28), motivation (g≈0.41) ([doi.org/10.1080/17437199.2018.1534071](https://doi.org/10.1080/17437199.2018.1534071)). Competence effects were weaker in children than adults — important for youth product design.

**LLM operationalization:**
- STAR-C digital coach (2025) encodes SDT needs as design norms: user decides goals; system supports agency, transparency, and companionship without paternalism ([frontiersin.org/.../fdgth.2025.1436347](https://www.frontiersin.org/journals/digital-health/articles/10.3389/fdgth.2025.1436347/full)).
- Weight-loss LLM messaging study: GPT-4 with Socratic, autonomy-respecting prompts outperformed formulaic/prescriptive messages; users preferred positive, jargon-free, collaborative tone ([link.springer.com/.../s41347-025-00491-5](https://link.springer.com/article/10.1007/s41347-025-00491-5)).
- HICSS 2025 qualitative study of MI-guided LLM coaching: users want personalization *and* autonomy; tension between authenticity and “AI humanization”; privacy/trust are prerequisites ([doi.org/10.24251/hicss.2025.407](https://doi.org/10.24251/hicss.2025.407)).

**Language mapping for our product:**

| Need | Do | Don’t |
|------|----|-------|
| Autonomy | “Which of these two options fits your week?” | “You must sleep 9 hours tonight.” |
| Competence | “Your first-serve % rose in set 2 — that skill is trainable.” | “You’re not cut out for this level.” |
| Relatedness | “Your coach can help you try this drill tomorrow.” | Isolation + shame (“everyone else recovered better”) |

### 2.4 Motivational Interviewing (MI)

**Core idea:** Client-centered, collaborative exploration of ambivalence; open questions, affirmations, reflections, summaries (OARS); evoke *change talk* rather than impose advice.

**Operationalization in Google’s Personal Health Agent / coaching stack:**

PHA architecture ([arxiv.org/abs/2508.20148](https://arxiv.org/abs/2508.20148); [research.google/blog/the-anatomy-of-a-personal-health-agent/](https://research.google/blog/the-anatomy-of-a-personal-health-agent/), Sep 2025):
- Multi-agent: Data Science + Domain Expert + **Health Coach (HC)** under an orchestrator.
- HC “employs a modular architecture inspired by proven psychological strategies (e.g., motivational interviewing).”
- Expert-derived HC capabilities: (1) goal identification, (2) active listening, (3) context clarification, (4) empowerment, (5) **SMART recommendations**, (6) iterative feedback incorporation.

Companion paper *Substance over Style* (Srinivas et al., Google Research / UW, [arxiv.org/abs/2503.19328](https://arxiv.org/abs/2503.19328)):
- Formative interviews with **N=11** coaches → style vs substance capabilities (I1–I6).
- **Expert coaching module** sequence: goal/purpose → constraints/preferences/barriers → recommendation; embeds active listening + empowerment.
- **Conversation-flow modules** (parallel binary decisions each turn): Probing / Recommendation / Resolution — prevents premature advice and endless interrogation.
- Evaluated with **CEMI** (Client Evaluation of Motivational Interviewing), WAI, CUQ, and SMART Likert items.
- Key finding: users value **substance** (realistic personality, feedback handling, inspiring confidence, framing goals) more than stylistic MI; interrogative-only agents underperformed; Expert-Facilitative scored highest overall.
- Caution: “exploring goal motivation” correlated *negatively* with satisfaction when overdone — MI depth without timely action feels like stalling.

**Stanford Bloom (2025–2026):** Dialog-state prompt chain covers Active Choices topics; second chain selects among **11 MI strategies** then crafts the utterance; improved exercise mindsets ([news.stanford.edu/.../ai-health-coach-mindset](https://news.stanford.edu/stories/2026/04/ai-health-coach-mindset); [arxiv.org/html/2510.05449v1](https://arxiv.org/html/2510.05449v1)).

**Implication for tennis AI:** Separate *when to advise* from *how to phrase*; gather barriers before plans; prefer facilitative over interrogative or purely directive modes for athletes; keep coaches on terse directive+evidence mode.

### 2.5 SMART goal structuring

**Definition:** Specific, Measurable, Attainable/Achievable, Relevant, Time-bound (Doran, 1981).

**PHA / Substance-over-Style operationalization:**
- SMART is capability **HC5** and evaluated as five items: clear goal, measurable progress criteria, attainable, aligned to priorities/barriers, clear timeline.
- Facilitative agents scored higher and less variable on SMART than interrogative/directive agents.
- Importantly, SMART alone did **not** predict user satisfaction as strongly as confidence-inspiring process and goal *framing* — process > checklist.

**Academy adaptation:**
- Athlete goals: skill/behavior (“hit 20 targeted serves after warm-up, 3×/week”) not weight or rigid sleep-score targets.
- Coach goals: session design / load decisions with clear review window.
- Parent goals: support behaviors (“protect wind-down hour on school nights”) not performance outcomes.

---

## 3. What makes AI coaching effective vs ignored

| Factor | Evidence | Design implication |
|--------|----------|-------------------|
| **Personalization depth** | MHC-Coach (TTM-aligned fine-tuned LLM, 2025): among stage-matched messages, **68%** preferred MHC-Coach vs human-expert templates (N=632, p<0.001); experts rated higher perceived effectiveness (4.4 vs 2.8/5) ([nature.com/articles/s44325-025-00083-5](https://www.nature.com/articles/s44325-025-00083-5)) | Personalize to readiness stage, recent load, and barriers — not only name/age |
| **Adaptive vs static** | REINFORCE trial (RL-personalized texts, medication adherence): personalization of framing/history/social/content/reflective elements improved adherence, especially subgroups ([nature.com/articles/s41746-024-01028-5](https://www.nature.com/articles/s41746-024-01028-5)) | Learn which frames work per athlete; avoid one-size loss framing for youth |
| **Hybrid bandit × LLM** | 30-day PA study: cMAB selects intervention *type*; LLM personalizes content; retained LLM acceptance while enabling adaptive selection ([arxiv.org/abs/2506.07275](https://doi.org/10.48550/arxiv.2506.07275)) | Separate *policy* (what technique) from *generation* (wording) |
| **Timing (JITAI)** | RL timing/content personalization improves engagement in mental-health texting; effects often subgroup-specific ([npj Mental Health Research 2025](https://preview-www.nature.com/articles/s44184-025-00173-3)) | Don’t spam nightly “recovery poor” alerts; prefer coach-timed or opt-in morning planning |
| **Message length** | cMAB×LLM study notes LLM messages longer/richer than templates; length itself may cue “personalization”; uncontrolled length confounds acceptance | Athlete: short. Coach: dense bullets. Parent: medium + one ask. Cap youth push notifications |
| **Framing** | Gain vs loss framing responsiveness varies by individual (REINFORCE). Youth: prefer gain/competence frames; avoid fear/injury fatalism | Default gain-frame for adolescents; reserve neutral descriptive for coaches |
| **Substance over style** | Google coaching study: core competency/actionability > MI stylistic polish | Never sacrifice clarity for “coachy” empathy theater |
| **ENGAGE framework** | 2025 precision-engagement model: segment → nudge → guide real-world behavior → anchor habits → measure → adapt ([frontiersin.org/.../fdgth.2025.1713334](https://www.frontiersin.org/journals/digital-health/articles/10.3389/fdgth.2025.1713334/full)) | Optimize for *behavior*, not app screen time |

**Bottom line:** Ignored messages are generic, poorly timed, overly long, controlling, or metric-shaming. Effective messages are stage-matched, barrier-specific, brief for the audience, and end with one clear next action the user can refuse.

---

## 4. Youth-athlete risks of quantified-self feedback (highest priority)

### 4.1 Orthosomnia (sleep tracking → worse sleep)

**Definition / evidence:** Baron et al. (2017) coined **orthosomnia** — perfectionistic pursuit of ideal sleep tracker metrics causing insomnia-like distress; patients trust wearable data over PSG/actigraphy ([jcsm.aasm.org/doi/10.5664/jcsm.6472](https://jcsm.aasm.org/doi/10.5664/jcsm.6472)).

**Athlete-specific call to action:** Walsh et al., *Journal of Sport and Health Science* (2023) — consumer sleep technologies in athletes can fuel orthosomnia/nomophobia; knowing “suboptimal” pre-performance sleep metrics may reduce self-efficacy; **readiness/recovery scores based primarily on sleep are especially hazardous** before competition ([doi.org/10.1016/j.jshs.2023.02.005](https://doi.org/10.1016/j.jshs.2023.02.005)).

**Product rules:**
- Never show red “sleep failed” / “recovery poor” banners to adolescents on match mornings.
- Prefer multi-night *patterns* over single-night verdicts.
- Pair any sleep insight with: “Trackers estimate sleep; how you feel still matters.”
- Offer tracker-free weeks / coach-only views for athletes showing fixation.

### 4.2 Disordered eating, RED-S, body metrics

**IOC 2023 REDs consensus** ([bjsm.bmj.com/content/57/17/1073](https://bjsm.bmj.com/content/57/17/1073)):
- Disordered eating and EDs are common in athlete cohorts; exacerbated by physique pressure, coaching entourage, social media.
- **Body composition assessment recommended only for medical purposes under 18**; exceptional cases need health-team consensus + guardian consent.
- Body composition data are **health data** — confidential; share only with those the athlete authorizes.
- Health-first, performance-second decisions.

**IOC 2024 elite youth consensus** ([bjsm.bmj.com/content/58/17/946](https://bjsm.bmj.com/content/58/17/946)): body composition assessment/interpretation for <18 should be limited to medical/ethical scientific purposes with careful consideration, consensus, and proper consent; elite youth remain children under UNCRC protections.

**Exercise addiction / ED risk in adolescent athletes (2025):** Adolescents at risk of exercise addiction show worse sleep quality, anxiety, depression, and eating-disorder symptoms ([pmc.ncbi.nlm.nih.gov/articles/PMC12231450/](https://pmc.ncbi.nlm.nih.gov/articles/PMC12231450/)).

**Product rules:**
- No weight, BMI, body-fat, “leaner = better,” or calorie-burn shaming in athlete-facing AI.
- Energy/fueling language stays food-positive and growth-protective; escalate suspected LEA/RED-S patterns to coach + qualified clinician pathway — AI does not diagnose.
- Parents: educational RED-S awareness OK; athlete’s body numbers not OK without clinical process.

### 4.3 Overtraining and sleep anxiety

Adolescent sprinter study: maladapted athletes showed poorer sleep efficiency/quantity; higher prior training volume associated with worse sleep and performance via fatigue ([doi.org/10.1155/2021/6694547](https://doi.org/10.1155/2021/6694547)).

**IOC load consensus (2016):** Rapid week-to-week load spikes elevate injury/illness risk; developing athletes need special attention when introduced to new/congested loads ([bjsm.bmj.com/content/50/17/1030](https://bjsm.bmj.com/content/50/17/1030)).

**Product rules:**
- Frame load as *adjustable plan*, not athlete failure.
- Prefer “your recent training rose quickly relative to the last month — worth reviewing with your coach” over “you are overtrained.”
- Never claim definitive injury prediction from wearable deltas.

### 4.4 Wearables in youth — sports medicine guidance

F1000Research 2024 review notes rapid wearable adoption in young athletes for training/sleep/cardiac monitoring, while underscoring wellness vs medical dual-use ambiguity ([f1000research.com/articles/13-1381](https://f1000research.com/articles/13-1381)).

Practical synthesis for academies:
- Wearables are **optional training aids**, not diagnostic devices.
- Adolescent data should default to **coach-mediated interpretation**.
- Subjective wellness (RPE, mood, soreness, enjoyment) should outweigh a single device score when they conflict.
- Competition-day: suppress readiness catastrophizing (aligns with Walsh et al. CST warning).

---

## 5. Safeguarding guidance (tennis & youth sport bodies)

### 5.1 ITF Safeguarding Children Policy (Jan 2025)

Source: https://www.itftennis.com/media/13726/itf-safeguarding-children-policy-jan-2025.pdf

**Information sharing — UK “7 Golden Rules” (quoted principles):**
1. Data Protection Act 2018 / human rights law are frameworks for *appropriate* sharing, not absolute barriers.
2. Be open and honest with the individual (and/or family) about why/what/how/with whom information is shared; seek agreement unless unsafe.
3. Seek advice if unsure.
4. Share with consent where appropriate; may share without consent where safety requires.
5. Base decisions on safety and well-being of the child and others.
6. **Necessary, proportionate, relevant, adequate, accurate, timely and secure.**
7. Keep a record of the decision.

**Implication for AI parent feeds:** Share only what is necessary for the parent’s support role; do not dump full biometric histories “because they paid.”

### 5.2 LTA Safeguarding Children Policy

Source: https://www.lta.org.uk/498128/siteassets/about-lta/file/lta-safeguarding-children-policy.pdf  
Same 7 Golden Rules; safeguarding records secured; share only as necessary/proportionate.

### 5.3 ITF Player Analysis Technology (PAT)

Sources: https://www.itftennis.com/media/2238/player-analysis-technology-overview.pdf ; https://www.itftennis.com/media/13924/2025-itf-pat-approval-procedures.pdf

- PAT may record/store/transmit/analyze/communicate performance info.
- During matches under Rules of Tennis: **no player access to PAT data during points**; access treated like coaching information.
- Approval required for competition use.

**Implication:** Real-time AI coaching overlays during junior matches may violate competition rules even if “helpful.”

### 5.4 IOC youth athletic development (2015) & elite youth (2024)

- Goal: healthy, resilient, capable youth athletes; enjoyable participation; resist adult-/media-centered culture and inappropriate early specialization ([bjsm.bmj.com/content/49/13/843](https://bjsm.bmj.com/content/bjsports/49/13/843.full.pdf)).
- 2024: elite pathway youth remain **children**; child-centered approach; UNCRC protections ([bjsm.bmj.com/content/58/17/946](https://bjsm.bmj.com/content/58/17/946)).
- Psychological overload, injury, RED-S, and identity threats are recognized risks of elite pathways.

### 5.5 Load management (IOC 2016)

Monitor training/competition/psychological load and well-being; avoid rapid acute:chronic spikes; special care for developing athletes ([bjsm.bmj.com/content/50/17/1030](https://bjsm.bmj.com/content/50/17/1030)).

---

## 6. Language that motivates vs harms

### 6.1 Framing negative metrics

| Harmful | Better (athlete) | Better (coach) |
|---------|------------------|----------------|
| “Your recovery is poor.” | “Your overnight metrics look lower than your recent average. How are energy and legs today?” | “Recovery proxy ↓ vs 7-day baseline — consider volume trim or technique focus.” |
| “You slept badly — you’ll play worse.” | “One night doesn’t define you. A slightly easier warm-up can help you feel sharp.” | “Pre-match sleep estimate low — plan shorter warm-up + monitor RPE.” |
| “HRV collapse means you’re broken.” | “Your HRV is quieter than usual. That’s a cue to check in with your coach, not a verdict.” | “HRV deviation; triangulate with RPE/mood before changing plan.” |
| “You’re at high injury risk.” | (Withhold deterministic risk) “Soreness + load jumped this week — worth a coach check before full intensity.” | “Load spike flags elevated *relative* risk historically — adjust progression.” |

**Principles:**
- Describe **data relative to personal baseline**, not moral failure.
- Separate **signal** from **identity**.
- Offer **choice** and **coach collaboration**.
- Prefer **process cues** over outcome fatalism.

### 6.2 Communicating uncertainty

- Use frequency-style hedges: “In situations like this, coaches often…” not “You will get injured.”
- State data limits: “Wearable estimate,” “incomplete nights,” “small sample (3 days).”
- Offer competing explanations when appropriate: sleep debt *or* late match *or* illness *or* device noise.
- Explicit confidence tags: High / Medium / Low — tied to data completeness, not model bravado.

### 6.3 Avoiding deterministic ability / injury language

Ban patterns:
- “You will / won’t make it to [level].”
- “Genetically a sprinter / endurance type.”
- “This pattern means a stress fracture is coming.”
- “Your talent ceiling is…”

Replace with trainable skill language and probabilistic load management language.

### 6.4 Confidence & overtrust (non-experts)

MIT Media Lab / NEJM-covered finding: non-experts **cannot reliably distinguish** AI medical answers from doctors’; they rate AI as more valid/trustworthy and may follow **low-accuracy** AI advice ([media.mit.edu/.../people-overtrust-ai-generated-medical-advice](https://www.media.mit.edu/projects/people-overtrust-ai-generated-medical-advice/overview/)).

2026 clinical AI calibration argument: alignment training rewards decisive fluency over honest uncertainty — **calibration is a design goal** ([doi.org/10.1186/s13040-026-00518-4](https://doi.org/10.1186/s13040-026-00518-4)).

Nature Medicine: clinical AI must convey **patient-specific predictive uncertainty** ([doi.org/10.1038/s41591-023-02562-7](https://doi.org/10.1038/s41591-023-02562-7)).

**Product patterns to reduce overtrust *and* cynicism:**
1. Always show **what was measured** + **what wasn’t**.
2. Use **confidence + action scope**: “Medium confidence → suggested coach review, not medical diagnosis.”
3. Prefer **ranges / alternatives** over single verdicts for youth.
4. Route medical-adjacent topics to humans; AI stays in coaching lane.
5. Avoid fake precision (“injury risk 73%”).

---

## 7. Genetics communication — position statements (quoted)

### 7.1 AIS ethics position (BJSM 2017)

Source: https://bjsm.bmj.com/content/51/1/5  
AIS summary page: https://www.ausport.gov.au/ais/position_statements/genetics

> “Genetic testing has proven of value in the practice of clinical medicine. There are, however, currently **no scientific grounds for the use of genetic testing for athletic performance improvement, sport selection or talent identification**.”

> “Athletes and coaches should be **discouraged from using direct-to-consumer genetic testing** because of its lack of validation and replicability and the lack of involvement of a medical practitioner in the process.”

> “The transfer of genetic material or genetic modification of cells for performance enhancement is **gene doping and should not be used on athletes**.”

> Pitsiladis (cited): “**Current genetic testing has zero predictive power on talent identification and should not be used by sporting organisations, athletes, coaches or parents**.”

> “Use of genetic phenotypes as an absolute predictor of athletic prowess or sport selection is **unscientific and unethical**. The use of these tests in young athletes is particularly problematic…”

> “Information gained from genetic testing should **never be used for inclusion or exclusion in talent identification**.”

### 7.2 FIMS / BJSM DTC consensus (2015)

Source: https://bjsm.bmj.com/content/49/23/1486

> “The general consensus among sport and exercise genetics researchers is that genetic tests have **no role to play in talent identification or the individualised prescription of training to maximise performance**.”

> “**no child or young athlete should be exposed to DTC genetic testing** to define or alter training or for talent identification aimed at selecting gifted children or adolescents.”

> “currently, there is **no place for DTC testing for predicting sports performance and talent identification**.”

### 7.3 AIS–Athlome–FIMS joint statement on exercise prescription & injury prevention (2017)

Source: https://pmc.ncbi.nlm.nih.gov/articles/PMC5688405/

> “Based on current knowledge, there is **no current clinical application for genetic testing in the area of exercise prescription and injury prevention**…”

> Reaffirming 2015 FIMS-Athlome: “there is **no place for DTC testing for predicting sports performance and talent identification**.”

> Predictive value “**too low to warrant clinical application**”; mitigate privacy risks, incidental findings, and **erroneous advice**.

### 7.4 Guardrail rules grounded in the above (implementable)

| Rule ID | Rule | Trigger examples |
|---------|------|------------------|
| GEN-1 | Refuse talent-ID / sport-selection genetics claims | “ACTN3 means sprinter,” “endurance genes,” “talent score” |
| GEN-2 | Refuse gene-based training prescription | “Train power because of genotype X” |
| GEN-3 | Refuse DTC genetics interpretation for performance | Parent uploads 23andMe sports report |
| GEN-4 | Never use genetics for inclusion/exclusion recommendations | Squad selection, academy cut |
| GEN-5 | Clinical genetics (cardiac, etc.) → licensed clinician only | Cardiomyopathy genes |
| GEN-6 | Gene doping discussion → anti-doping education + refuse enhancement advice | CRISPR / gene therapy for performance |
| GEN-7 | Explain *why* with quoted consensus, offer phenotype/training alternatives | Redirect to skills, load, recovery, psychology |

---

## 8. Parent communication, consent, safeguarding

### What parents **should** receive
- Schedule, attendance, session themes, coach-approved progress narratives.
- High-level wellness *trends* relevant to support at home (sleep consistency, hydration reminders) **without** medical diagnosis.
- Safeguarding-critical alerts routed via human safeguarding officers when thresholds met.
- Educational content (growth, relative energy, enjoyment, communication tips).

### What parents **should not** receive (default)
- Raw body composition, weight trajectories, or calorie deficits.
- Peer-ranked recovery/HRV leaderboards involving their child.
- Deterministic talent/genetics judgments.
- Injury diagnoses or imaging interpretations.
- Private athlete chat content (autonomy/relatedness + safeguarding).
- Match-morning “not ready” scarlet letters that become parental pressure.

### Consent considerations
- Parental/guardian consent for under-16/under-18 processing (jurisdiction-specific; COPPA for <13 in US contexts — US Youth Soccer 2025 data policy: verifiable parental consent, limited collection, parental access/deletion rights).
- Consent must be **specific** (performance analytics ≠ research ≠ marketing ≠ sponsor sharing).
- Child’s evolving capacity: explain in child-friendly language; respect refusal where safe.
- Body/health data: IOC REDs — athlete authorization for who sees results; under-18 medical framing.
- ITF/LTA: proportionate sharing; record decisions; safety can override confidentiality.
- Power imbalance: academy must not coerce “consent or no training” for optional research/commercial biometrics ([advocateturkey.com 2026 overview](https://advocateturkey.com/2026/04/29/data-protection-in-sports-athlete-performance-data-privacy-and-biometric-information/)).

**Parent AI tone:** calm, practical, non-alarmist; one support action; never recruit parent as night-time metric enforcer.

---

## 9. Nutrition & supplement advice boundaries

### Where sports nutrition guidance ends
**In-bounds for AI coaching (general, non-diagnostic):**
- Food-first hydration and fueling *education* aligned to training days.
- Regular meal/snack patterns for growing athletes.
- Encourage consulting accredited sports dietitian for individualized plans.
- RED-S *awareness* + escalate; do not diagnose or prescribe restrictive diets.

**Out-of-bounds (route to RD/MD):**
- Therapeutic diets for clinical conditions.
- Weight-cutting / body-fat targets for minors.
- Micronutrient deficiency diagnosis from symptoms/labs without clinician.
- Supplement protocols, dosages, stacks.

### Anti-doping (competitive athletes)
- **Strict liability** (WADA Code): athlete responsible for any prohibited substance in their body, intentional or not ([GSSI / WADA framing](https://www.gssiweb.org/sports-science-exchange/article/no-guarantees!-supporting-athletes-to-reduce-the-risk-of-unintentional-doping-from-supplement-use)).
- Food-first; supplements only if needed, evidence-based, third-party tested (e.g., Informed Sport), documented batch numbers.
- Athletics Australia 2025 policy: supplements for **<18 discouraged** unless advised by accredited SEM physician/sports doctor/sports dietitian; parents/coaches must seek qualified advice first ([athletics.com.au supplements policy](https://www.athletics.com.au/wp-content/uploads/2025/05/POLICY-AA-Supplements-in-Sport.pdf)).
- Canadian operational best practices: assess with MD/RD before supplementing; third-party tested only ([copsin.ca 2024](https://copsin.ca/wp-content/uploads/2024/06/Operational-Best-Practices-for-Dietary-Supplementation-in-Canadian-Sport_FINAL.pdf)).

**AI rule:** Never recommend named supplements, pre-workouts, fat burners, or “natural” herbals to competitive or junior athletes. Response pattern: food-first + refer to qualified professional + contamination risk education.

---

## 10. DELIVERABLE A — Content style guide by audience

### 10.1 Coach (professional triage)

**Voice:** Terse, evidence-backed, decision-oriented. Assume expertise. Lead with recommendation + why + confidence + watch-outs.

**Length:** 40–90 words or 3–5 bullets.  
**Structure:** Action → Evidence → Confidence → Optional alternatives.  
**Do:** Absolute numbers + deltas vs baseline; session prescription options.  
**Don’t:** Pep talks, medical diagnosis, talent judgments, parent-shaming.

| Insight | Bad | Good |
|---------|-----|------|
| Load spike | “Athlete is overtraining and will get injured.” | “Acute:chronic load proxy ↑ ~1.6× vs prior 4 weeks. Prefer technique volume over intensity today; recheck RPE post-session. Confidence: medium (missing 2 wearable days).” |
| Sleep | “Tell them they slept terribly.” | “Sleep estimate 6.1h (7d avg 7.8h). Keep intensity flexible; ask subjective freshness. Don’t foreground score to athlete pre-match.” |
| Serve pattern | “Their serve is broken.” | “1st-serve in% −9 pts vs month baseline under pressure points. Drill: +10 targeted wide serves after warm-up; track next 2 sessions.” |

### 10.2 Athlete (often adolescent)

**Voice:** Warm, competent, autonomy-supportive, short. Skill and effort over scores. Invite choice.

**Length:** 1–3 short sentences + optional one question.  
**Structure:** Notice (neutral) → Meaning (non-fatal) → Choice/action → Optional coach bridge.  
**Do:** Gain frames, personal bests vs self, enjoyment.  
**Don’t:** Shame, peer comparison on body/recovery, injury destiny, weight talk.

| Insight | Bad | Good |
|---------|-----|------|
| Recovery | “Your recovery is poor. Fix it or you’ll fail.” | “Your overnight numbers look quieter than usual. Want a lighter warm-up plan, or check in with your coach about today’s session?” |
| Sleep | “You ruined your sleep score.” | “Trackers guessed a shorter night. One night isn’t your whole story — a calm wind-down tonight can help you feel fresher.” |
| Missed targets | “You didn’t hit your goals. Commitment issue.” | “You got 2 of 3 practice blocks in — solid. Which block is easiest to protect this week?” |

### 10.3 Parent

**Voice:** Reassuring, practical, non-clinical. Support role clarity. Avoid turning home into a performance lab.

**Length:** Short paragraph + one support action.  
**Structure:** What’s going well → What to support at home → What not to police → When to talk to coach (not AI).  
**Do:** Sleep opportunity, meals, enjoyment, logistics.  
**Don’t:** Raw biometric dumps, talent ranking, scare tactics, supplement pitches.

| Insight | Bad | Good |
|---------|-----|------|
| Sleep | “Your child’s sleep is failing; enforce 9 hours or performance collapses.” | “Sleep has been less consistent this week. Helping protect a regular wind-down on school nights is useful — and it’s best not to quiz them on wearable scores each morning.” |
| Load | “They’re being overtrained; confront the coach.” | “Training load rose recently. If you notice unusual fatigue or lost enjoyment, share that with the coach — they’re best placed to adjust the plan.” |
| Nutrition | “Buy this fat-burner / cut carbs.” | “Growing athletes usually do best with regular meals and snacks around training. For personalized nutrition, ask the academy about a sports dietitian.” |

---

## 11. DELIVERABLE B — Prohibited phrasings & claim types (guardrail checklist)

Use as automated detectors (regex + classifier). Flag = block or rewrite + escalate.

### Medical / diagnostic claims
- Diagnoses: “you have overtraining syndrome / RED-S / insomnia / depression / arrhythmia…”
- Treatment: “take X mg,” “stop medication,” “you need MRI/blood tests”
- Prognosis: “this will become a stress fracture,” “career-ending”

### Body / eating / weight (esp. minors)
- Weight/BMI/body-fat targets or “ideal race weight”
- “Eat less,” “skip dinner,” “earn food with training”
- Praise for weight loss / thinness
- Calorie deficits as performance advice for <18

### Deterministic risk & ability
- “You will get injured if…”
- “High injury risk: NN%”
- “Not talented enough,” “ceiling,” “never make [tour]”
- Peer humiliation rankings on body/recovery

### Genetics (hard block — see §7)
- Any DTC sports gene interpretation
- Talent ID / sport selection from genes
- Gene-based training prescription
- Gene doping advice

### Supplements / doping-adjacent
- Named supplement recommendations (creatine, pre-workout, fat burners, herbs, SARMs, etc.)
- “Natural = safe”
- “Undetectable” / masking language

### Sleep / orthosomnia inducers
- Match-morning “recovery failed / not ready” to athlete
- “Perfect sleep score required”
- Ordering athlete to trust device over felt experience

### Controlling / autonomy-thwarting
- “You must,” “non-negotiable,” “or else”
- Parental surveillance scripts (“check their ring every hour”)

### Overconfident certainty
- Fake precision without data quality disclosure
- Absolute language when confidence < high
- Unsourced population claims presented as personal facts

### Safeguarding / privacy
- Sharing athlete private disclosures with parents without policy basis
- Instructing concealment of injuries from medical staff
- Sexual/romantic content; cross-boundary coach-athlete messaging advice

---

## 12. DELIVERABLE C — Structure of a good insight

### Universal skeleton
1. **Claim** (audience-calibrated, non-diagnostic)  
2. **Evidence** (metrics, timeframe, baseline, sport context)  
3. **Confidence** (High/Med/Low + why)  
4. **Action** (one primary; optional alternatives; refusal OK)  
5. **Boundary** (what this is *not*: not a diagnosis / not talent judgment)

### Per audience sequencing

| Audience | Sequence | Example micro-template |
|----------|----------|------------------------|
| **Coach** | Action → Evidence → Confidence → Watch | “Prefer intensity ↓ today. Evidence: ACWR≈1.6, mood↓. Confidence: med (gap nights). Watch: pain report.” |
| **Athlete** | Notice → Normalize → Choice → Coach bridge | “Numbers quieter than usual. Normal to vary. Lighter warm-up or ask coach? Your call.” |
| **Parent** | Context → Home support → Don’t police → Coach path | “Busy training week. Protect wind-down & regular meals. Skip score quizzes. Flag lasting fatigue to coach.” |

### Confidence rubric (product)

| Level | Criteria | Allowed action strength |
|-------|----------|-------------------------|
| High | ≥7d complete data, clear baseline, convergent subjective + objective | Specific session tweak |
| Medium | Partial data or single-signal | Soft suggestion + verify with human |
| Low | Sparse/noisy/conflicting | Ask clarifying Q or coach-only note; no athlete alert |

---

## 13. DELIVERABLE D — Age-appropriate adaptations

| Topic | Athlete ≤12 | Athlete 13–17 | Route to coach instead |
|-------|-------------|----------------|------------------------|
| Wearable scores | Hide raw recovery/HRV; playful streaks on *habits* only | Show simplified trends; no red panic states | Persistent score obsession / anxiety |
| Sleep | Bedtime routine tips; no orthosomnia language | Pattern tips; suppress match-morning scores | Insomnia symptoms, tracker fixation |
| Load | Fun/variety language | Explain “build gradually” without fear | Suspected overreaching, pain, illness |
| Body/nutrition | Food for energy & growth only | Food-first fueling; no weight talk | LEA/RED-S flags, ED talk, weight requests |
| Injury language | “Tell a grown-up if something hurts” | “Check with coach/physio; pain ≠ weakness” | Any acute injury advice |
| Goals | Enjoyment + simple skills | SMART skill/behavior goals co-created | Goals about weight/appearance |
| Genetics | N/A — full refuse | Full refuse + education | Parent pressure for testing |
| Supplements | Never | Never recommend; refer adults to RD/MD | Any supplement request |
| Parent sharing | Parents get logistics + enjoyment | More detail only with consent tiers | Private mental-health content |

**Withhold from adolescent athlete UI (coach/parent-mediated or hidden):**
- Acute:chronic injury-probability scores
- Body composition
- Peer biometric leaderboards
- Clinical biomarker interpretations
- “Not ready to compete” absolute flags on event day

---

## 14. DELIVERABLE E — Genetics & biomarker guardrails (statement-grounded)

### Genetics (implement as hard policy)
1. **No talent ID / sport selection** — AIS/BJSM/FIMS quotes in §7.
2. **No gene-based training prescription** — AIS–Athlome–FIMS: no current clinical application for exercise prescription/injury prevention genetics.
3. **No DTC sports genetics interpretation** for athletes, coaches, or parents — “no child or young athlete should be exposed…”
4. **No inclusion/exclusion** recommendations from genetic data.
5. **Clinical genetics** only via licensed medical pathways with counseling.
6. Stock refusal: cite that genetic tests have “**zero predictive power on talent identification**” (Pitsiladis via AIS) and “**no place for DTC testing**” (FIMS 2015).

### Biomarkers / labs / wearables-as-labs
1. Do not diagnose from single wearable or lab value.
2. Do not prescribe treatment or supplement from biomarkers.
3. Under-18 body composition: medical-purpose only; confidential; athlete-authorized sharing (IOC REDs 2023).
4. Blood biomarkers: Domain-expert style explanations only with clinician oversight flags; never “your testosterone means…” performance scripts for juniors.
5. Always label consumer device outputs as **estimates**, not clinical measurements.
6. If user pastes clinical results: encourage discussion with treating clinician; AI stays educational/coaching-adjacent.

---

## 15. Implementation notes for the multi-agent system

Map frameworks to agents (aligned with Google PHA pattern):

| Agent | Behavior science job |
|-------|----------------------|
| Data / analysis | COM-B capability evidence; descriptive stats; confidence from data quality |
| Domain / sports science | Ground claims; load/RED-S/IOC constraints; refuse genetics/medical overreach |
| Coach experience agent | MI + SMART for athletes; terse triage for coaches; parent support scripts |
| Orchestrator / safety | Audience router; age gates; prohibited-claim scanner; escalation to human coach/safeguarding |

**Eval hooks:** CEMI/WAI-style rubrics for athlete chats; actionability/time-to-decision for coaches; orthosomnia/RED-S harm probes in red-team suites; genetics refusal tests; supplement refusal tests.

---

## 16. Source index (primary URLs)

### Behavior change & LLM coaching
- https://research.google/blog/the-anatomy-of-a-personal-health-agent/
- https://arxiv.org/abs/2508.20148
- https://arxiv.org/abs/2503.19328
- https://research.google/blog/how-we-are-building-the-personal-health-coach/
- https://journals.plos.org/digitalhealth/article?id=10.1371/journal.pdig.0000431
- https://formative.jmir.org/2025/1/e75421
- https://arxiv.org/html/2510.05449v1
- https://www.jmir.org/2026/1/e89190/PDF
- https://www.nature.com/articles/s44325-025-00083-5
- https://www.nature.com/articles/s41746-024-01028-5
- https://doi.org/10.48550/arxiv.2506.07275
- https://news.stanford.edu/stories/2026/04/ai-health-coach-mindset
- https://www.frontiersin.org/journals/digital-health/articles/10.3389/fdgth.2025.1436347/full
- https://www.frontiersin.org/journals/digital-health/articles/10.3389/fdgth.2025.1713334/full
- https://doi.org/10.1080/17437199.2018.1534071
- https://link.springer.com/article/10.1007/s41347-025-00491-5

### Youth risks, sleep, RED-S, load
- https://jcsm.aasm.org/doi/10.5664/jcsm.6472
- https://doi.org/10.1016/j.jshs.2023.02.005
- https://bjsm.bmj.com/content/57/17/1073
- https://bjsm.bmj.com/content/58/17/946
- https://bjsm.bmj.com/content/bjsports/49/13/843.full.pdf
- https://bjsm.bmj.com/content/50/17/1030
- https://doi.org/10.1155/2021/6694547
- https://pmc.ncbi.nlm.nih.gov/articles/PMC12231450/
- https://f1000research.com/articles/13-1381

### Safeguarding / tennis
- https://www.itftennis.com/media/13726/itf-safeguarding-children-policy-jan-2025.pdf
- https://www.lta.org.uk/498128/siteassets/about-lta/file/lta-safeguarding-children-policy.pdf
- https://www.itftennis.com/media/2238/player-analysis-technology-overview.pdf
- https://www.itftennis.com/media/13924/2025-itf-pat-approval-procedures.pdf

### Genetics
- https://bjsm.bmj.com/content/51/1/5
- https://bjsm.bmj.com/content/49/23/1486
- https://pmc.ncbi.nlm.nih.gov/articles/PMC5688405/
- https://www.ausport.gov.au/ais/position_statements/genetics

### Uncertainty / overtrust
- https://www.media.mit.edu/projects/people-overtrust-ai-generated-medical-advice/overview/
- https://doi.org/10.1038/s41591-023-02562-7
- https://doi.org/10.1186/s13040-026-00518-4

### Nutrition / anti-doping
- https://www.gssiweb.org/sports-science-exchange/article/no-guarantees!-supporting-athletes-to-reduce-the-risk-of-unintentional-doping-from-supplement-use
- https://www.athletics.com.au/wp-content/uploads/2025/05/POLICY-AA-Supplements-in-Sport.pdf
- https://copsin.ca/wp-content/uploads/2024/06/Operational-Best-Practices-for-Dietary-Supplementation-in-Canadian-Sport_FINAL.pdf
- https://pmc.ncbi.nlm.nih.gov/articles/PMC10721667/

---

## 17. Research gaps / caveats

- Long-term RCTs of LLM coaching on *youth athlete* mental health and injury outcomes are still sparse; much evidence is adult digital health or short preference studies.
- Orthosomnia prevalence in competitive junior tennis specifically is under-measured (Walsh et al. call for athlete-specific research).
- PAT rules govern *competition* feedback access; academy training-day AI still carries psychological risk even when legal.
- Position statements on genetics date mainly 2015–2017 but remain the cited governing consensus through AIS pages and later reviews (no reversal found as of 2026-08-02).

---

*End of dossier.*
