# 80 — Health & Wellness AI Failure Modes: Post-Mortems and Counterweight Research

**Date:** 2026-08-02  
**Purpose:** Deliberate counterweight to optimistic health-AI research. Document how ambitious health-adjacent AI projects fail — what was promised, what was built, what went wrong, and transferable lessons — so a multi-agent sports-performance AI plan can be designed against those modes.  
**Scope note:** External research only. Includes historical cases and 2025–2026 developments current as of August 2026.

---

## 1. IBM Watson Health / Watson for Oncology

### What was promised
After Watson’s Jeopardy! win (2011), IBM positioned Watson for Oncology as a clinical decision-support system that would democratize elite cancer expertise: ingest unstructured medical literature and patient records, recommend evidence-based treatments, match patients to trials, and scale Memorial Sloan Kettering (MSK)–grade oncology worldwide. Watson Health (launched ~2015) was framed as a healthcare “moonshot,” backed by ~$4B in related acquisitions (Truven, Merge, Phytel, Explorys, etc.).

### What was built
A commercial product sold to hospitals globally (including Thailand, South Korea, India), trained primarily through a partnership with MSK. Separate high-profile work with MD Anderson aimed at teaching Watson cancer treatment and trial matching. Marketing and sales scaled ahead of independent clinical validation.

### What went wrong

**Technical / data failures**
- Internal IBM documents (reported by STAT, July 2018) showed Watson for Oncology frequently produced “unsafe and incorrect treatment recommendations.” Training relied on a small number of *synthetic* (hypothetical) cases rather than real patient data; recommendations reflected a few MSK specialists’ preferences rather than guidelines or broad evidence.
- Recommendations conflicted with national treatment guidelines; the system generalized poorly across regions (drug availability, local standards, insurance constraints).
- Example cited in secondary reporting: recommending a high-bleeding-risk drug for a patient already with severe hemorrhage.

**Organizational / partnership failures**
- MD Anderson partnership (~2012–2016): University of Texas System audit found gross mismanagement — ~$62M spent, IT governance bypassed (project framed as “research” not IT), invoices paid without clear service delivery, ~$11.6M deficit from anticipating donations. IBM walked away September 2016.
- Sales continued while internal slides (June–July 2017) shared with Watson Health management documented customer dissatisfaction (“often inaccurate”) and “serious questions about the process for building content and the underlying technology.”

**Outcome**
- Reputation collapse after STAT’s reporting; hospital sales softened.
- January 2022: IBM sold Watson Health healthcare data/analytics assets to Francisco Partners for **$1.065B** cash (SEC 10-Q); assets relaunched as **Merative**. Watson for Oncology as a moonshot narrative ended; IBM refocused on hybrid cloud/AI platform strategy.

### Transferable lesson
Marketing and institutional brand partnerships cannot substitute for real-world data, transparent methodology, external validation, and the willingness to stop selling when internal safety findings are damning. Synthetic-case training + elite-single-site opinion ≠ generalizable clinical AI. Governance theater (big logos, big spend) without IT and clinical QA is a leading indicator of collapse.

**Sources**
- https://www.statnews.com/2018/07/25/ibm-watson-recommended-unsafe-incorrect-treatments/
- https://www.massdevice.com/report-ibm-watson-delivered-unsafe-and-inaccurate-cancer-recommendations/
- https://arstechnica.com/science/2017/02/ibms-watson-proves-useful-at-fighting-cancer-except-in-texas/
- https://newsroom.ibm.com/2022-01-21-Francisco-Partners-to-Acquire-IBMs-Healthcare-Data-and-Analytics-Assets
- https://www.nytimes.com/2022/01/21/business/ibm-watson-health.html
- https://www.theregister.com/2022/07/26/ibm_watson_health_profit/
- https://www.franciscopartners.com/media/Merative
- https://www.healthcare.digital/single-post/ibm-watson-was-once-heralded-as-the-future-of-healthcare-ai-what-exactly-went-wrong
- https://www.henricodolfing.ch/en/case-study-20-the-4-billion-ai-failure-of-ibm-watson-for-oncology/

---

## 2. Babylon Health

### What was promised
Digital-first primary care at population scale: AI symptom checker / triage chatbot + telehealth (GP at Hand in the UK; US value-based care expansion). Public claims included AI performing on par with or better than GPs on RCGP-exam-style cases (BBC, 2018). SPAC merger (2021) implied ~**$4.2B** equity value / ~$3.6B enterprise value.

### What was built
Consumer-facing triage chatbot, NHS GP at Hand service, US virtual primary care / risk-bearing arrangements. Aggressive growth narrative around AI + access.

### What went wrong

**Clinical safety criticisms**
- NHS oncologist Dr. David Watkins documented triage failures (e.g., cardiac red-flag presentations) from 2017 onward; Babylon acknowledged some “genuine errors” while labeling him a “Twitter troll” in a press release — a governance red flag.
- MHRA later told Watkins it shared “concerns” about the chatbot and highlighted a **regulatory gap**: software triage tools often registered as low-risk devices with inadequate oversight (TechCrunch / Independent, 2021).
- Piecemeal fixes to specific publicized failure cases without addressing systemic triage safety.

**Evidence / claims overreach**
- Fraser, Coiera & Wong (*The Lancet*, 2018) demolished the “beats doctors” narrative: doctor-entered (not patient-entered) data; no significance testing; sensitivity to outlier doctors; unblinded subset selection vs. Semigran historical comparator. Conclusion: no convincing evidence of superiority; possibility of significantly worse performance in realistic settings.

**Business / regulatory friction → collapse**
- Mounting losses post-SPAC; Centene affiliate non-renewal (~half of 2022 revenue); MindMaze / AlbaCore take-private collapsed August 2023.
- US subsidiaries Chapter 7 bankruptcy (August 2023); UK assets into administration / sold for parts (eMed); once ~$2B+ VC darling ended as liquidation.

### Transferable lesson
Triage/chatbot safety failures compound when (1) promotional claims outrun evaluation design, (2) critics are attacked rather than investigated, (3) regulators lag, and (4) the business model requires hypergrowth before trust is earned. Exam-style benchmarks ≠ patient-entered, messy clinical reality.

**Sources**
- https://www.bbc.com/news/technology-44635134
- https://doi.org/10.1016/s0140-6736(18)32819-8
- https://www.digitalhealth.net/2018/11/lancet-review-babylons-ai/
- https://techcrunch.com/2021/03/05/uks-mhra-says-it-has-concerns-about-babylon-health-and-flags-legal-gap-around-triage-chatbots/
- https://www.independent.co.uk/news/health/nhs-symptom-checker-app-safety-complaints-b1813142.html
- https://medcitynews.com/2023/09/babylon-healthcare-ai-uk/
- https://techcrunch.com/2023/08/31/the-fall-of-babylon-failed-tele-health-startup-once-valued-at-nearly-2b-goes-bankrupt-and-sold-for-parts/
- https://www.axios.com/2023/09/04/babylon-health-emed-bankruptcy
- https://www.forbes.com/sites/katiejennings/2023/08/15/digital-health-company-babylon-files-for-bankruptcy-in-us-will-liquidate/
- https://www.sec.gov/Archives/edgar/data/1836967/000110465921076595/tm2118336d1_ex99-1.htm

---

## 3. Google Health restructurings & Apple “Mulberry”

### Google Health — arc
| Phase | What happened |
|--------|----------------|
| Pre-2012 | Original Google Health PHR shut down (low adoption). |
| 2018 | New Google Health unit under David Feinberg; DeepMind Health folded in (Streams AKI app; UK data-sharing controversy earlier with ICO). |
| 2021 | Google **disbands** dedicated Google Health division (~700 people); teams redistributed to Search, Fitbit, Research, Legal. Analysts noted little concrete product to show from the three-year centralization. |
| 2023–2024 | Google Brain + DeepMind → Google DeepMind; health AI continues as research/product features (e.g., MedLM/AMIE lineage) rather than a standalone “health company.” |
| May 2026 | Fitbit app forcibly replaced by **Google Health** app with Gemini-powered coach; heavy user backlash (see §5). |

**Lesson:** Centralizing “health AI” under a prestige org does not guarantee product-market fit. Privacy controversies (DeepMind Streams / Royal Free), clinician workflow friction, and the difficulty of shipping regulated advice repeatedly force big tech to **decompose ambition into features** or bury teams inside Search/devices.

**Sources**
- https://www.cnbc.com/2018/11/13/google-health-unit-absorbs-deepmind-health.html
- https://www.healthcaredive.com/news/google-disbands-health-unit-as-chief-departs-for-cerner/605387/
- https://www.mobihealthnews.com/news/google-dismantles-health-division-strategy-overhaul
- https://blog.google/company-news/inside-google/company-announcements/building-ai-future-april-2024/

### Apple Project Mulberry (AI health coach) — 2025–2026
**Promised:** Ambitious AI wellness/fitness coach (“Health+” internally), trained with Apple-hired clinicians; sleep/nutrition/PT/mental health/cardiology content; Oakland video studio; personalized recommendations from Watch + Health + surveys + labs; targeted around iOS 26 then slipped to iOS 27.

**What happened (Bloomberg / Gurman, Feb 5, 2026):** Mulberry wound down as a standalone service after Eddy Cue took health oversight from retiring Jeff Williams. Cue judged the plan not competitive with Oura/Whoop apps and pushed for speed. Features to be rolled out piecemeal in Health (videos, gait analysis via iPhone camera, wellness Q&A via “World Knowledge Answers,” advanced Siri health queries later). Concurrent AI org churn (Giannandrea retirement / fold into Federighi’s org).

**Why it matters:** Even Apple — unmatched wearable data, brand trust, capital — balked at shipping a unified **agentic health coach** as a product. Competitive bar, subscription fatigue, reliability/liability risk, and organizational upheaval killed the moonshot packaging. The retreat pattern: *decompose the coach into safer, incremental Health features*.

**Sources**
- https://www.bloomberg.com/news/articles/2026-02-05/apple-is-scaling-back-plans-for-new-ai-based-health-coach-service
- https://9to5mac.com/2026/02/05/apple-reportedly-scales-back-plans-for-ai-powered-health-coach/
- https://www.macworld.com/article/3055235/apples-ai-powered-health-service-is-reportedly-on-life-support.html
- https://www.iclarified.com/99859/apple-scales-back-standalone-ai-health-coach-will-fold-features-into-health-app-report

---

## 4. 2025–2026 failures, retractions, harmful advice, enforcement

### Harmful chatbot / wellness AI cases
| Case | What happened | Lesson |
|------|----------------|--------|
| **NEDA Tessa (2023)** | Eating-disorder prevention chatbot gave calorie-deficit / weight-loss advice after generative capabilities were added; pulled within ~24h of public screenshots. Helpline staff had been replaced amid unionization controversy. | Rule-based safety ≠ generative drift. Vulnerable populations + diet advice is a liability landmine. |
| **Character.AI (2025–2026)** | FTC 6(b) inquiry into companion chatbots & minors (Sept 2025). Pennsylvania State Board of Medicine sued Character Technologies (May 2026) for unlawful practice of medicine: “Doctor of psychiatry” character claimed PA license #, offered assessments. Kentucky AG action on minor harm. 39 AGs warned AI firms (Dec 2025) that unlicensed mental health advice is illegal. | Holding out as a licensed clinician — even via “entertainment” characters — is now an enforcement vector. Minors + health persona is maximum regulatory heat. |
| **Hims / telehealth privacy & claims** | Ongoing FTC attention to consumer health platforms (e.g., Hims allegations noted in STAT coverage ecosystem); BetterHelp ($7.8M, 2023) and Cerebral (~$7M, 2024) for sharing sensitive health data for ads despite privacy promises. | Even without “AI diagnosis,” deceptive health-data practices and overclaiming are FTC Section 5 territory. |

### Regulatory actions / frameworks (2025–2026)
- **FTC companion chatbot inquiry** (Sept 2025): 6(b) orders to seven companies (incl. OpenAI, Character.AI) on child/teen impact, safety testing, disclosures, COPPA.  
  https://www.ftc.gov/news-events/news/press-releases/2025/09/ftc-launches-inquiry-ai-chatbots-acting-companions
- **FTC proposed policy statement on deceptive AI claims** (Federal Register, July 7, 2026): Section 5 applied to misrepresentations about AI performance/efficacy.  
  https://www.govinfo.gov/content/pkg/FR-2026-07-07/html/2026-13628.htm
- **US states:** CA SB243 (companion bots, self-harm/minors), Illinois WOPR Act (restricts unsupervised AI therapy), multi-state AG pressure.  
  See Manatt Health AI Policy Tracker: https://www.manatt.com/insights/newsletters/health-highlights/manatt-health-health-ai-policy-tracker
- **EU:** AI Act transparency obligations for user-facing AI (Article 50) enter force **August 2, 2026**; health CDS intersecting MDR remains high-risk with later full compliance dates. European Parliament briefing on AI companions & minors (2026).  
  https://www.europarl.europa.eu/RegData/etudes/BRIE/2026/789299/EPRS_BRI(2026)789299_EN.pdf
- **FDA Digital Health Advisory Committee** (Nov 2025): drew lines among companions, mental-health chatbots, and CDS.

### Transferable lesson for 2026
The enforcement mood has shifted from “innovation sandbox” to **minors + impersonation + unsubstantiated health claims**. Wellness labeling is not a safe harbor if the UX behaves like a clinician or therapist.

**Additional sources**
- https://www.npr.org/sections/health-shots/2023/06/08/1180838096/an-eating-disorders-chatbot-offered-dieting-advice-raising-fears-about-ai-in-hea
- https://www.nbcnews.com/tech/neda-pulls-chatbot-eating-advice-rcna87231
- https://www.washingtontimes.com/news/2026/may/5/pennsylvania-suing-ai-company-saying-chatbots-illegally-hold-licensed/
- https://www.cooley.com/news/insight/2026/2026-06-25-ai-chatbots-medical-claims-draw-regulatory-scrutiny
- https://www.ftc.gov/news-events/news/press-releases/2023/03/ftc-ban-betterhelp-revealing-consumers-data-including-sensitive-mental-health-information-facebook
- https://www.ftc.gov/news-events/news/press-releases/2024/04/proposed-ftc-order-will-prohibit-telehealth-firm-cerebral-using-or-disclosing-sensitive-data

---

## 5. Consumer health AI that shipped and was rejected or quietly dismantled

| Product / change | User reaction | What users disliked |
|------------------|---------------|---------------------|
| **Google Health replaces Fitbit app (May 2026)** | Flood of 1-star reviews; subscription cancellations; “Google Health Ruined Fitbit” discourse | AI coach as dominant CTA; AI sleep summaries crowding raw metrics; removed badges, community, groups, sleep animals, granular skin temp, recipes; buggy tracking; clinical-looking UI hiding useful data |
| **Apple Mulberry / Health+** | Never shipped as standalone | Internal judgment: not competitive; subscription fatigue context; risk of wrong advice |
| **Amazon Halo** | Discontinued July 31, 2023 | Weak differentiation, privacy unease, incomplete ecosystem stickiness |
| **Original Google Health PHR (2011)** | Shutdown for low adoption | Users won’t maintain yet another health record silo |
| **Babylon symptom checker marketing** | Clinician revolt + regulatory concern | Overclaiming AI “diagnosis”; unsafe triage edge cases |

**Product lesson:** Wearable/sports users often want **accurate numbers, clear trends, and coach-controllable workflows** — not unsolicited generative narration. Forcing AI coach into the primary UX while removing beloved utility/gamification features destroys trust faster than the AI can create value.

**Sources**
- https://kotaku.com/google-fitbit-app-health-new-update-ai-filled-version-and-everybody-is-mad-2000699806
- https://piunikaweb.com/2026/05/25/google-health-app-removes-fitbit-features-badges-sleep-profile/
- https://www.healthcare.digital/single-post/google-health-5-0-the-paradigm-shift-in-consumer-wellness
- https://support.google.com/googlehealth/answer/17068213

---

## 6. Reproducibility & validity: good in validation, bad in deployment

### Landmark clinical example — Epic Sepsis Model
- Vendor-reported AUC ~0.76–0.83; independent external validation at Michigan Medicine (JAMA Internal Medicine, 2021): hospitalization-level AUC **0.63**.
- At recommended threshold: missed **67%** of sepsis patients while alerting on **18%** of all hospitalizations → alert fatigue; identified only 7% of sepsis cases clinicians had already missed via timely antibiotics.
- Proprietary opacity blocked independent scrutiny until after widespread deployment.

https://jamanetwork.com/journals/jamainternalmedicine/fullarticle/2781307  
https://www.michiganmedicine.org/health-lab/popular-sepsis-prediction-tool-less-accurate-claimed

### Why models fail to transport (literature)
1. **Site-specific data-generating processes** — coding, practice patterns, case mix differ; multivariate distributions shift (npj Digital Medicine, 2024: “Why do probabilistic clinical models fail to transport between sites”).  
   https://www.nature.com/articles/s41746-024-01037-4
2. **Label leakage / outcome definition games** — Epic sepsis labels tied to billing/actions that already imply clinician suspicion.
3. **Temporal / concept drift** — care patterns change after deployment.
4. **Two-way moving target** — deploying a model changes clinician behavior, which changes outcomes and invalidates retrospective metrics (PMC12851562).  
   https://pmc.ncbi.nlm.nih.gov/articles/PMC12851562/
5. **External validation is insufficient** — Nature Medicine (2023) argues for **recurring local validation** over one-shot external validation as the gold stamp.  
   https://www.nature.com/articles/s41591-023-02540-z
6. **Vendor-reported metrics in LMICs / procurement** — 2026 audit literature documents preventable harms when donors accept vendor precision claims without post-deployment verification.  
   https://doi.org/10.64898/2026.03.21.26348981
7. **Trial-to-world gap** — narrative reviews (Healthcare 2025) cite bias from homogeneous datasets, workflow misalignment, increased clinician workload.  
   https://doi.org/10.3390/healthcare13070701

### Transferable lesson
Internal validation on convenient historical data is marketing, not safety. Without prospective shadow-mode evaluation, calibration reporting, local recalibration, and the ability to **turn the model off**, “high AUC” products become alert-fatigue machines or silent failures.

---

## 7. Sports-specific: injury-prediction AI oversold

This section is critical for any product with an “injury risk” score.

### Systematic evidence
**Bullock et al., Sports Medicine (2022)** — systematic review of 30 studies / 204 musculoskeletal injury prediction models:
- **0** studies performed external validation.
- **98%** of models high or unclear risk of bias (PROBAST); only 2% low ROB.
- 10% a priori sample size; 47% internal validation; 63% reported discrimination; **7%** reported calibration.
- **Conclusion: no models could be recommended for use in practice.**

https://pubmed.ncbi.nlm.nih.gov/35689749/

### Sports medicine opinion leadership
- **Bullock / Hughes et al. — “Black Box Prediction Methods Deserve a Red Card”** (Sports Medicine, 2022): proprietary/ML black boxes prevent independent evaluation of performance, interpretability, utility, generalizability; threaten athlete care.  
  https://pubmed.ncbi.nlm.nih.gov/35175575/
- Follow-on: “Trade Secret Taboo” — open science required (2023).  
  https://pubmed.ncbi.nlm.nih.gov/37160562/
- **Comment on football ML injury papers** (Sports Medicine – Open, 2024): models rated high ROB; warning against treating predictors as causal levers (intervening on correlates can harm athletes); dataset “balancing” biases risk estimates; hard classification thresholds override clinician judgment.  
  https://link.springer.com/article/10.1186/s40798-024-00745-1
- **2025 scoping review (PMC12013557):** screening-only data largely ineffective; AUC gains from GPS/wellness still modest; no one-size-fits-all; GRADE certainty often very low/low; inconsistent injury definitions.  
  https://pmc.ncbi.nlm.nih.gov/articles/PMC12013557/

### Commercial oversell pattern
Vendor “injury risk %” dashboards typically: train on small single-club datasets, skip external validation, hide equations, imply causality (“reduce this load metric to prevent injury”), and sell certainty athletes and parents will over-trust — especially for minors.

### Transferable lesson
An “injury risk score” without published: outcome definition, prevalence, calibration, external validation, uncertainty bands, and explicit **non-causal** framing is scientifically indefensible and commercially reckless. Sports science’s own literature already red-cards this category.

---

## 8. Multi-agent / agentic AI project failures (2025–2026 industry data)

### Headline figure
**Gartner (press release, 25 June 2025):** Over **40% of agentic AI projects will be canceled by end of 2027**, due to escalating costs, unclear business value, or inadequate risk controls.

https://www.gartner.com/en/newsroom/press-releases/2025-06-25-gartner-predicts-over-40-percent-of-agentic-ai-projects-will-be-canceled-by-end-of-2027  
(Secondary: https://www.cdomagazine.tech/aiml/over-40-of-agentic-ai-projects-likely-to-be-abandoned-by-2027-gartner-forecast)

### Supporting Gartner context
- January 2025 poll (n=3,412 webinar attendees): 19% significant investment, 42% conservative, 31% wait-and-see/unsure, 8% none.
- “Agent washing”: vendors rebrand chatbots/RPA/assistants as agents; ~**130** vendors estimated as truly agentic.
- Most projects: early PoCs, hype-driven, often misapplied; models lack maturity for complex multi-step autonomous goals.
- Longer-term optimism (not a contradiction): by 2028, 15% of day-to-day work decisions agentic; 33% of enterprise software with agentic features — *if* applied with discipline.

### Related GenAI abandonment
Gartner also reported ≥**50% of GenAI projects abandoned after PoC** (data quality, risk controls, cost, unclear value).  
https://www.gartner.com/en/articles/genai-project-failure

### Methodology caveats (critical)
1. **Forecast, not autopsy** — “40% canceled by 2027” is a Gartner prediction, not a measured failure rate of deployed agents.
2. **Managerial cancellation ≠ model broken** — projects die from TCO, ROI ambiguity, governance — even if demos look good.
3. **Webinar-poll investment stats** are convenience samples, not representative enterprise censuses.
4. Reconciler analyses (2026) note separate RAND-style findings that most enterprise AI delivers no business value — different population/definition; do not conflate with the 40% agentic figure.  
   https://alatirok.com/ai-agent-failure-rate-2026/  
   https://www.forbes.com/sites/robertszczerba/2026/07/07/why-40-of-agentic-ai-projects-may-be-canceled-by-2027/
5. Agent-specific technical failure mode often missed by portfolio stats: **error compounding** across multi-step tool chains.

### Transferable lesson
Multi-agent ambition is statistically likely to be canceled unless value is workflow-narrow, costs are instrumented, and risk controls exist before autonomy expands. “Agent washing” your own roadmap (calling a chatbot orchestra “multi-agent” without durable state, evals, or kill switches) is how you join the 40%.

---

## 9. Synthesized failure modes → early warnings → design decisions

### A. Technical failures

| Failure mode | Early warning | Mitigating design decision |
|--------------|---------------|----------------------------|
| Synthetic / single-site training that doesn’t generalize (Watson) | Model agrees with 1–2 experts; fails on out-of-academy athletes or different sports | Train/eval on real longitudinal athlete data; hold out academies; never ship on synthetic-only vignettes |
| Generative drift past safety rails (Tessa) | New model/prompt version changes advice tone on diet, pain, supplements | Versioned prompts; regression suite of “forbidden advice”; generative off by default in high-risk domains |
| Multi-step agent error compounding | Tool-chain tasks succeed in demo, fail silently in production logs | Cap autonomy depth; require structured tool outputs; critic/verifier agent; human confirm for actions |
| Black-box proprietary injury models | Cannot explain score; no code/equation; vendor AUC only | Prefer transparent features + calibrated probabilities; publish methodology; allow disable |
| Data quality / missing wearables | Imputed “risk” when HRV/sleep gaps are large | Explicit missingness flags; refuse to score when data insufficient |

### B. Evaluation failures

| Failure mode | Early warning | Mitigating design decision |
|--------------|---------------|----------------------------|
| Validation ≠ deployment (Epic sepsis) | Retrospective AUC celebrated; no shadow-mode prospective study | Mandatory shadow deployment + calibration plots before any athlete-facing score |
| Exam/benchmark theater (Babylon RCGP) | Marketing cites quiz performance vs. clinicians | Ban exam-style claims; evaluate on coach/athlete-entered messy queries |
| No external validation (injury lit.) | Single-club backtest as “clinical proof” | Pre-register external validation across ≥2 academies; PROBAST-aware reporting |
| Label leakage / outcome games | Injury labels include coach already resting the athlete | Strict temporal cutoffs; outcomes defined independent of the score’s use |
| Ignoring calibration | Only accuracy/AUC in decks | Report calibration, prevalence, PPV at operating points coaches actually use |

### C. Product / adoption failures

| Failure mode | Early warning | Mitigating design decision |
|--------------|---------------|----------------------------|
| AI coach crowds out core utility (Fitbit→Google Health) | Coaches complain they can’t find load/sleep numbers; AI summary is first screen | Metrics-first UI; AI as opt-in assistant, not hero CTA |
| Alert fatigue | Coaches mute injury alerts; ignore readiness | Sparse alerts; tunable thresholds; track override rates as a KPI |
| Subscription / moonshot packaging rejected (Mulberry) | Buyers want modules, not “AI doctor” SKU | Sell workflow outcomes (session planning, recovery flags) not “AI physician” |
| Clinician/coach distrust after overclaim | Sports med staff publicly criticize product | Co-design with S&C/physio; publish limitations in-product |
| Replacing humans prematurely (NEDA helpline) | Support staff cut before AI proven | AI augments coach; never replaces safeguarding pathways |

### D. Regulatory failures

| Failure mode | Early warning | Mitigating design decision |
|--------------|---------------|----------------------------|
| Impersonating clinicians (Character.AI) | Copy says “AI doctor,” “diagnoses,” “prescribes rest like a physio” | Hard ban on medical titles; “coaching support, not medical care”; licensed-human escalation |
| Unsubstantiated efficacy claims (FTC §5 / 2026 AI policy) | Landing page: “prevents injuries,” “detects overtraining disease” | Claims board; legal review; only claim what evaluation supports |
| Minors + companion-like chat (FTC 6b, state laws, EU) | Open-ended emotional chat with U18 athletes | Age-gated features; no companion persona; crisis routing; parental/academy controls |
| Soft device / MDR creep | Injury risk + genetic advice starts looking like CDS | Regulatory classification memo before build; wellness vs device boundary enforced in prompts/tools |
| Health data for ads / sloppy processors (BetterHelp/Cerebral) | Analytics pixels on athlete health pages | No adtech on health surfaces; DPIA; Article 9 / minor safeguards |

### E. Organizational failures

| Failure mode | Early warning | Mitigating design decision |
|--------------|---------------|----------------------------|
| Sell ahead of safety (Watson/Babylon) | Sales deck stronger than eval report | Ship gate: written safety eval signed before customer enablement |
| Attacking critics (Babylon) | Defensive PR vs. clinician bug reports | Blameless incident process; public status for safety bugs |
| Moonshot org without IT/clinical governance (MD Anderson) | “Research exception” from normal engineering QA | Same SDLC for AI as for payments; audit trail |
| Hype-driven multi-agent PoC (Gartner 40%) | Many agents, no ROI metric, rising LLM bill | One workflow, cost ceiling, kill criteria at 90 days |
| Leadership churn kills ambitious coach (Apple) | Scope expands with every exec | Written problem statement frozen; feature decomposition allowed, claim inflation not |
| Agent washing yourselves | Calling router+tools “multi-agent AGI for sport” | Honest architecture doc; autonomy levels ladder |

---

## 10. How this specific project could fail

**Context applied:** A small company building a sophisticated multi-agent sports-performance AI on wearable, training, biomarker, and **genetic** data for **tennis academies including minors**, with an existing “injury risk” score narrative.

Be unsparing: the failure modes above map onto this product with high fidelity. You are combining (a) Watson-style overclaim risk, (b) Babylon-style chatbot trust risk, (c) injury-prediction literature’s red card, (d) Character.AI/FTC minors heat, and (e) Gartner’s agentic cancellation economics — with a fraction of Apple’s or Google’s legal and clinical bench.

### Structural vulnerabilities unique to this bet
1. **Injury risk score is already in the kill zone.** Sports Medicine’s systematic review says essentially no existing models are fit for practice. Shipping a glossy score to academies and parents of minors invites: (i) coaches resting kids incorrectly, (ii) parents suing after an injury the score “missed,” (iii) regulators treating the score as CDS. Genetic modifiers make this worse — rare variants + tiny samples = storytelling, not science.
2. **Minors + multi-agent chat + health-adjacent advice** is the exact intersection of 2025–2026 enforcement (FTC companions, state unlicensed practice, EU AI Act transparency, safeguarding duties). A single screenshot of the agent telling a 14-year-old to ignore pain or cut calories is an existential PR event.
3. **Multi-agent architecture multiplies failure surface** while a small team cannot staff clinical safety, ML eval, EU regulatory, and academy customer success simultaneously. Gartner’s cancellations are driven by cost + unclear value + weak risk controls — all endemic in small-team agent platforms.
4. **Heterogeneous academies = transport failure.** A model tuned on one Mediterranean academy’s Garmin + SwingVision stack will misfire on another’s incomplete wearables, different coaching load philosophy, and different injury logging culture — Epic sepsis all over again, with worse n.
5. **Genetic + biomarker expansion** invites medical-device and genetic non-discrimination / consent landmines before the coaching agent has proven it can reliably summarize yesterday’s HRV.

### Three most likely ways this project goes wrong

#### 1) The injury-risk / readiness score becomes a liability magnet (highest probability)
**How it fails:** The score is marketed (or even UI-implied) as predictive. It is built on small, academy-specific data without external validation or calibration. A high-profile junior tears an ACL the week after a “green” score — or a coach over-rests a healthy athlete into lost ranking points. Sports scientists blog the methodology; academies churn; insurers and parents escalate.

**What prevents it:**
- Reposition immediately: **load / recovery indicators**, not “injury probability.” Remove percentage-risk language.
- No genetic features in any risk-like score until multi-academy prospective study exists.
- Publish limitations in-product; show confidence/missingness; require coach acknowledgment.
- Shadow-mode + calibration report per academy before enablement; kill switch if override rate or false alarm rate exceeds thresholds.
- Independent sports-med advisor with authority to block release.

#### 2) The agent gives a harmful or “doctor-like” recommendation to a minor (highest severity)
**How it fails:** Multi-agent stack with broad tools (wearables, biomarkers, genetics, free-text coaching) produces diet restriction, “play through pain,” supplement, or mental-health advice. Parent posts screenshots. Looks like NEDA×Character.AI. Academy terminates; regulators inquire; company spends a year on legal, not product.

**What prevents it:**
- Strict tool/allowlist by age and role; U18 default: no open companion chat, no genetic interpretation, no nutrition deficits, no pain dismissal.
- Deterministic safety layer *before* LLM (blocked intents), plus post-generation classifiers.
- Escalation paths to human coach/physio/safeguarding; never claim clinical titles.
- Red-team suite weekly (cardiac red flags, disordered eating, concussion, self-harm).
- Human-in-the-loop for any recommendation that changes training load by more than a defined threshold.

#### 3) Agentic complexity + cost + unclear ROI → quiet abandonment (highest “death by Gartner”)
**How it fails:** Team builds specialist agents, memory, nightly batches, RAG over papers — demos impress. Production: token costs spike, tool failures compound, coaches still use WhatsApp and Excel. No single workflow metric moves. Leadership shelves the “multi-agent platform” and keeps dashboards. Matches the >40% canceled-by-2027 pattern.

**What prevents it:**
- One beachhead workflow (e.g., next-day readiness briefing for the coach) with a numeric success metric and a 90-day kill/continue gate.
- Cost budgets per academy per day; eval harness before new agents.
- Prefer a thin orchestrator + reliable tools over a society of agents.
- Ship coach-visible value weekly without requiring autonomy; add agents only when a measured bottleneck exists.
- Explicitly reject agent washing in roadmap language.

### Secondary ways to die (monitor, but less primary)
- **Claims / FTC-EU:** “Prevents injury,” “AI sports doctor,” genetic disease framing.
- **Privacy:** Ad pixels, loose processor agreements, genetic data without Article 9-grade consent.
- **Adoption:** AI summaries bury tennis metrics (Fitbit lesson) → coaches mute the product.
- **Org:** Selling logos (academy logos as Watson sold MSK) before eval exists.

### Bottom line for planning
Ambitious multi-agent health-adjacent sports AI fails when it **claims prediction it cannot validate**, **talks to minors like a clinician**, and **builds autonomy before proving one workflow**. The literature and the corpses (Watson, Babylon, Epic sepsis, injury-model reviews, Mulberry’s retreat, 2026 chatbot enforcement) all point the same way: narrow claims, ruthless evaluation, metrics-first product, minors as a hard constraint, and agents as a last resort — not a brand strategy.

---

## Source index (quick list)

**Watson:** STAT 2018; MassDevice; Ars Technica MD Anderson audit; IBM/Francisco/Merative 2022; NYT; The Register  
**Babylon:** BBC; Lancet Fraser et al. 2018; TechCrunch MHRA 2021; Independent; MedCity; TechCrunch/Axios/Forbes bankruptcy 2023; SEC SPAC exhibit  
**Google/Apple:** CNBC DeepMind Health; Healthcare Dive 2021 disband; Google AI future blog 2024; Bloomberg/9to5Mac/Macworld Mulberry Feb 2026; Kotaku/PiunikaWeb Fitbit→Google Health 2026  
**2025–26 enforcement:** FTC companions; FTC BetterHelp/Cerebral; Federal Register AI deception 2026; PA Character.AI suit; Manatt tracker; EU Parliament AI companions briefing; NEDA Tessa NPR/NBC  
**Validity:** JAMA IM Epic sepsis; Nature Medicine local validation; npj Digital Medicine transport; Healthcare 2025 narrative review  
**Sports injury:** Bullock 2022 PubMed 35689749; Black Box Red Card 35175575; Sports Med Open comment 2024; PMC12013557 scoping review  
**Agentic:** Gartner 2025-06-25 press release; CDO Magazine; Forbes 2026; Gartner GenAI abandonment article  

---

*End of dossier.*
