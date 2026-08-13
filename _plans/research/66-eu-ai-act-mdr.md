# EU AI Act & Medical Device Borderline — Compliance Dossier

**Subject:** Peak Performance Data (PPD) — tennis academy / B2C sports-performance AI platform (Spain / EU)  
**Research date:** 2 August 2026  
**Scope:** Regulation (EU) 2024/1689 (AI Act) as amended by the AI Omnibus; MDR 2017/745; IVDR 2017/746; MDCG software guidance; Spain AESIA / AEMPS  
**Disclaimer:** This is regulatory research for product design, not legal advice. Qualification turns on *intended purpose* as stated in labelling, IFU, marketing, and actual use. Obtain EU counsel (regulatory + privacy) before launch.

---

## 1. Executive snapshot (mid-2026)

| Question | Answer as of 2 Aug 2026 |
|---|---|
| Are high-risk AI Act obligations live today? | **No** for Annex III / Annex I product-embedded high-risk systems — deferred by AI Omnibus. |
| What *is* live today for PPD? | Art. 5 prohibitions (since 2 Feb 2025); Art. 4 AI literacy (since 2 Feb 2025, later simplified by Omnibus); GPAI provider rules (since 2 Aug 2025); **Art. 50 transparency** (from **2 Aug 2026**); full market-surveillance enforcement architecture. |
| Likely AI Act risk tier for core PPD product | **Limited-risk** (chatbot / generative outputs → Art. 50) + otherwise **minimal-risk**, *if* Annex III use cases are avoided. Not prohibited if emotion recognition / vulnerability-exploitation practices are avoided. |
| MDR / IVDR exposure | The **wellness carve-out is real but narrow**. Several planned features (injury-risk language, biomarker interpretation, CGM analytics, health LLM) sit on or over the medical-device line. |

---

## 2. AI Act current status (as of mid-2026)

### 2.1 Baseline instrument

- **Regulation (EU) 2024/1689** (AI Act), OJ L, 12 July 2024; entered into force **1 August 2024**.
- Official overview (updated 31 July 2026): https://digital-strategy.ec.europa.eu/en/policies/regulatory-framework-ai
- Consolidated explorer text: https://artificialintelligenceact.eu/

### 2.2 Digital Omnibus / AI Omnibus — high-risk delay confirmed

The Commission’s **Digital Omnibus on AI** (commonly “AI Omnibus”), proposed **19 November 2025**, political agreement **7 May 2026**, entered into force **27 July 2026** as **Regulation (EU) 2026/1744**.

**Official Commission announcement (27 July 2026):**  
https://digital-strategy.ec.europa.eu/en/news/ai-omnibus-enters-force

**Extended high-risk timelines (fixed dates, not conditional on standards):**

| Category | New application date |
|---|---|
| Standalone **Annex III** high-risk systems | **2 December 2027** |
| High-risk AI embedded in **Annex I** regulated products (incl. medical devices, machinery, toys, etc.) | **2 August 2028** |

Commission summary quote (EC news, 27 July 2026):

> “High-risk AI systems in Annex III: Rules apply starting 2 December 2027  
> High-risk AI embedded in physical products (machinery, toys, lifts, etc.) in Annex I: Rules apply starting 2 August 2028”

Other Omnibus effects relevant to PPD:

- Extends some SME simplifications to **small mid-caps (SMCs)**.
- Expands regulatory sandboxes (incl. EU-level sandbox).
- Adds prohibition on AI generating non-consensual intimate / CSAM content (nudification apps) — applicable from **2 December 2026**.
- Clarifies interplay with product-safety law; strengthens AI Office oversight of systems built on GPAI models.
- Simplifies certain AI-literacy / registration burdens (Commission takes a stronger promoting role).

**Critical point:** The Omnibus **postpones** high-risk Chapter III obligations; it does **not** remove classification, Art. 5 bans, GPAI duties, or Art. 50 transparency.

### 2.3 What is live *now* (2 August 2026)

| Date | What became applicable |
|---|---|
| **2 Feb 2025** | Chapters I–II: definitions/scope; **Art. 5 prohibited practices**; **Art. 4 AI literacy** |
| **2 Aug 2025** | Chapter V **GPAI** obligations; governance bodies; much of penalties framework |
| **2 Aug 2026** | General application including **Art. 50 transparency**; market surveillance / enforcement powers broadly active; Commission press: enforcement of transparency rules starts |
| **2 Dec 2026** | Grace end for Art. 50(2) machine-readable marking for systems already on market before 2 Aug 2026; Omnibus nudification/CSAM ban |
| **2 Dec 2027** | Annex III high-risk obligations (Omnibus) |
| **2 Aug 2028** | Annex I product-embedded high-risk obligations (Omnibus) |

Commission FAQ on Art. 50 (updated 24 July 2026):  
https://digital-strategy.ec.europa.eu/en/faqs/transparency-obligations-under-article-50-ai-act

> “Article 50 of the AI Act applies as from 2 August 2026. … A limited grace period is envisaged only for AI systems placed on the market before 2 August 2026 and only as regards the marking and detection obligation for AI-generated content (Article 50(2) …). Providers of such systems must comply with those obligations only as from 2 December 2026.”

Commission Guidelines on Art. 50 transparency: **C(2026) 5054 final**, 20 July 2026 (published ~20 July 2026).  
Code of Practice on Transparency of AI-generated Content: https://digital-strategy.ec.europa.eu/en/policies/code-practice-ai-generated-content

---

## 3. Risk classification for Peak Performance Data

### 3.1 Roles

PPD is almost certainly:

1. **Provider** of AI *systems* placed on the market under its own name (academy SaaS + B2C app + chat agent) — Art. 3(3).
2. **Deployer** when it uses AI under its authority (e.g. internal tooling) — Art. 3(4).
3. **Downstream integrator** of third-party **GPAI models** (not a GPAI *model* provider, unless it substantially modifies a model above Commission compute thresholds).

### 3.2 Prohibited practices (Art. 5) — already enforceable

Relevant risks for a sports academy with **minors**:

#### (a) Exploitation of vulnerabilities — Art. 5(1)(b)

Prohibits AI that exploits vulnerabilities due to age, disability, or socio-economic situation, with the objective or effect of materially distorting behaviour in a way that causes or is reasonably likely to cause significant harm.

**Implication:** Coaching chatbots that nudge minors into overtraining, disordered eating, unsafe return-to-play, or medical self-management present Art. 5(1)(b) and product-safety / consumer-protection risk. Age-appropriate design, hard refusal of clinical advice, and parental/coach controls are compliance-critical — not optional UX.

#### (b) Emotion recognition in workplace / education — Art. 5(1)(f)

> “the placing on the market, the putting into service for this specific purpose, or the use of AI systems to infer emotions of a natural person in the areas of workplace and education institutions, except where the use of the AI system is intended to be put in place or into the market for medical or safety reasons”

**Definition — Art. 3(39):**

> “‘emotion recognition system’ means an AI system for the purpose of identifying or inferring emotions or intentions of natural persons on the basis of their biometric data”

**Does PPD’s readiness/recovery scoring count?**  
Generally **no**, if it estimates *training readiness / recovery load* from HRV, sleep, and activity for sports-performance purposes, **without** identifying/inferring emotions, mood, or intentions from biometric data.

**Would count / create exposure:**

- Inferring “stress”, “anxiety”, “motivation”, “burnout emotion”, or “intention to quit” from face, voice, wearable biometrics, or video in an academy (likely an **education institution** or **workplace** for staff/pro athletes).
- Marketing “emotion-aware coaching” from biometrics.

Outside workplace/education, emotion recognition is **not banned** but is **high-risk** under Annex III point 1(c) (obligations deferred to Dec 2027) and triggers Art. 50(3) deployer notice when used.

**Verdict on emotion recognition:** Design so PPD is **not** an emotion recognition system. Avoid emotion/intention inference language and biometrics-for-affect features entirely in academy settings.

#### (c) Other Art. 5 items

Social scoring, untargeted facial scraping, real-time remote biometric ID, etc. — out of scope if PPD does not do them. Omnibus nudification/CSAM ban irrelevant to sports analytics.

### 3.3 Annex III walkthrough (high-risk use cases)

Source: https://artificialintelligenceact.eu/annex/3/

| Annex III area | Applies to PPD? | Reasoning |
|---|---|---|
| **1. Biometrics** — remote ID; biometric categorisation by sensitive attributes; **emotion recognition** | **Avoidable / currently no** | No remote biometric ID. Do not categorise athletes by sensitive attributes. Do not do emotion recognition. Wearable HRV ≠ emotion recognition if purpose is physiological readiness, not emotion/intention. |
| **2. Critical infrastructure** | **No** | Not a safety component of critical infrastructure. |
| **3. Education & vocational training** | **Usually no; watch admissions / grading** | Point 3 covers AI used to (a) determine access/admission/assignment to educational or vocational training institutions; (b) evaluate learning outcomes (including steering learning); (c) assess appropriate education level; (d) monitor prohibited student behaviour in tests. A tennis academy is arguably vocational/educational in a broad sense, but **sports performance analytics for training load and match stats is not those uses**. **High-risk trigger if** AI decides academy admission, scholarship selection, formal “learning outcome” grading, or exam/proctoring. Keep selection decisions human and outside AI automation. |
| **4. Employment / workers management** | **Conditional** | Point 4(b): AI deciding terms of work-related relationships, promotion/termination, allocating tasks based on behaviour/traits, or monitoring/evaluating performance in such relationships. Risk if academies/clubs use PPD to hire/fire coaches, select contracted pros, or auto-allocate training duties based on AI scores. **Mitigation:** position as coach decision-support for athletic development; prohibit use for employment decisions in T&Cs; no automated HR workflows. |
| **5. Essential private/public services** | **No (typical PPD use)** | 5(a) public benefits/healthcare eligibility; 5(b) creditworthiness; 5(c) life/health insurance pricing; 5(d) emergency triage. Private sports SaaS is not these. Do not sell into insurance underwriting. |
| **6–8. Law enforcement / migration / justice** | **No** | Not applicable. |

**Article 6(3) “not high-risk” escape hatch:** Even if a use case sits in Annex III, a system may be deemed not high-risk if it does not pose a significant risk of harm to health, safety or fundamental rights and does not materially influence decision-making (narrow exceptions: e.g. narrow procedural tasks, improve previously completed human activity, detect decision-making patterns without replacing assessment, or preparatory tasks). Do **not** rely on Art. 6(3) without documented assessment — authorities can challenge under Art. 80.

### 3.4 Profiling of minors

The AI Act does **not** create a separate “profiling of minors = high-risk” Annex III bucket. Exposure comes from:

1. **Art. 5(1)(b)** vulnerability exploitation (age).
2. **GDPR Art. 8 / Spanish LOPDGDD** — parental consent, DPIA for children’s data, special-category data (health, genetics).
3. **Product design / DSA-style duty of care** expectations for minors.
4. If profiling feeds **employment** or **education admission** decisions → Annex III.

**Classification conclusion (reasoned):**

> **Primary classification: Limited-risk AI system** (transparency obligations under Art. 50) for the interactive/generative agent, with remaining analytics components **minimal-risk**, provided PPD (i) avoids Art. 5 practices, (ii) does not implement emotion recognition, (iii) does not automate education admission / employment decisions, and (iv) stays non-medical in MDR terms.  
> **Not prohibited** under current design assumptions.  
> **Not high-risk under Annex III** for core sports-performance coaching — but this is *use-case contingent*; academy HR/admissions misuse or biometric affect inference would change the answer. High-risk *obligations* are deferred to **2 Dec 2027 / 2 Aug 2028**, but classification analysis should be done now.

---

## 4. Article 50 — transparency (live 2 August 2026)

### 4.1 Exact duties (quoted)

**Art. 50(1) — interaction disclosure (providers):**

> “Providers shall ensure that AI systems intended to interact directly with natural persons are designed and developed in such a way that the natural persons concerned are informed that they are interacting with an AI system, unless this is obvious from the point of view of a natural person who is reasonably well-informed, observant and circumspect, taking into account the circumstances and the context of use.”

Commission Guidelines criteria (cumulative): AI system; genuine two-way exchange; direct interaction; with natural persons. Background-only analytics without chat are out of Art. 50(1).

**Art. 50(2) — synthetic content marking (providers, including GPAI systems):**

> “Providers of AI systems, including general-purpose AI systems, generating synthetic audio, image, video or text content, shall ensure that the outputs of the AI system are marked in a machine-readable format and detectable as artificially generated or manipulated. … effective, interoperable, robust and reliable as far as this is technically feasible…”

Grace to **2 Dec 2026** only for systems placed on the market **before** 2 Aug 2026.

**Art. 50(3) — emotion / biometric categorisation (deployers):** inform exposed persons of operation of the system (+ GDPR compliance). Relevant only if PPD ships those features.

**Art. 50(4) — deepfakes / public-interest text (deployers):** label deepfakes; label AI text published to inform the public on matters of public interest unless human review + editorial responsibility. Less central to in-app athlete chat; relevant for marketing blogs / social content.

**Art. 50(5) — presentation:**

> “The information referred to in paragraphs 1 to 4 shall be provided to the natural persons concerned in a clear and distinguishable manner at the latest at the time of the first interaction or exposure. The information shall conform to the applicable accessibility requirements.”

### 4.2 What PPD must present (concrete)

For the LLM coach chat and any agentic UI:

1. Clear notice **at first interaction** (and persistent affordance): e.g. “You are chatting with an AI assistant, not a human coach or clinician.”
2. Do **not** rely solely on a buried Terms clause — Commission guidance treats the “obvious” exception narrowly.
3. Accessible presentation (contrast, screen-reader, minors-readable language).
4. Machine-readable marking of synthetic outputs where Art. 50(2) applies (follow Code of Practice techniques; coordinate with model provider watermarking where available).
5. If publishing AI-written public content about health/performance without editorial control → Art. 50(4) label.

Source: https://artificialintelligenceact.eu/article/50/  
FAQ: https://digital-strategy.ec.europa.eu/en/faqs/transparency-obligations-under-article-50-ai-act

---

## 5. GPAI obligations — what downstream PPD inherits

### 5.1 Who bears Art. 53 / 55

**GPAI model providers** (OpenAI, Google, Anthropic, etc.) must meet Art. 53 (documentation, copyright policy, training-data summary) and, if systemic-risk, Art. 55. These applied from **2 August 2025**.

PPD is typically **not** a GPAI model provider. Commission guidance: a downstream modifier becomes a GPAI provider only if modification training compute exceeds **one-third** of the original model’s training compute (very high bar). Fine-tuning/RAG/tooling alone almost never crosses it.

### 5.2 What PPD *does* inherit / must do

| Obligation | Applies to PPD? |
|---|---|
| Obtain and retain **Annex XII**-type information from the GPAI provider (capabilities, limitations, acceptable use) | **Yes** — as downstream system provider integrating the model (Art. 53(1)(b) duty is on the model provider to *make available*; PPD should contractually obtain and use it). |
| Art. 50 system-level transparency for the chat product | **Yes** — PPD as system provider. |
| Art. 25 substantial modification → become provider of a (new) AI system | **Yes if** PPD substantially modifies a high-risk system; for non-high-risk today, still track change control. |
| Systemic-risk model evaluations (Art. 55) | **No** (unless PPD itself provides a systemic-risk GPAI model). |
| Respect model acceptable-use policies (health/minors restrictions) | **Contractually / practically yes** — many GPAI AUPs restrict medical advice and child-directed uses. |

**Bottom line:** Downstream deployer status does **not** push Art. 53 model duties onto PPD, but PPD **must** implement Art. 50, configure the model within documented limitations, keep integration documentation, and ensure prompts/tools do not create a *de facto* medical device or prohibited practice.

GPAI Code of Practice / Commission guidance:  
https://digital-strategy.ec.europa.eu/en/policies/regulatory-framework-ai  
https://artificialintelligenceact.eu/introduction-to-code-of-practice/

---

## 6. Human oversight (Art. 14) — when it bites

Art. 14 applies to **high-risk** AI systems. With the Omnibus, binding Annex III high-risk obligations apply from **2 December 2027** (Annex I path **2 August 2028**). Until then, Art. 14 is not a live conformity requirement for a non-high-risk sports app — but:

- If any module becomes high-risk (employment, education admission, emotion recognition outside ban, or **MDR medical device AI** under Annex I), Art. 14 becomes mandatory on the applicable date.
- MDCG 2025-6 / AIB 2025-1 (June 2025) already expects MDAI manufacturers to integrate AI Act oversight into MDR QMS even before final deadlines.
- Best practice for health-adjacent coaching: implement Art. 14-style controls **now**.

### 6.1 What “effective oversight” requires (Art. 14(4) paraphrase + quote)

High-risk systems must enable natural persons to:

> (a) properly understand capacities and limitations and monitor operation (detect anomalies);  
> (b) remain aware of **automation bias**;  
> (c) correctly interpret outputs;  
> (d) decide not to use / disregard / override / reverse outputs;  
> (e) intervene or interrupt via a ‘stop’ button or similar safe halt.

Source: https://artificialintelligenceact.eu/article/14/

### 6.2 Concrete oversight design for PPD (recommended even if not high-risk)

- Coach is the decision-maker; AI outputs labelled “suggestion”, never “prescription”.
- Override / dismiss controls on readiness and load recommendations.
- No automated lockouts of athletes from training based solely on AI scores without human confirmation.
- Logging of recommendations + human actions for audit.
- Clear limitation statements for minors’ accounts; parental/guardian visibility.
- Kill-switch for the agent; refusal policies for medical queries.

AESIA Guide 06 (“Vigilancia humana”) is a useful Spanish practical checklist: https://aesia.digital.gob.es/es/guias

---

## 7. Medical device borderline (MDR / IVDR)

### 7.1 Legal definition — MDR Art. 2(1)

A medical device includes software **intended by the manufacturer** for human beings for one or more **specific medical purposes**, including:

> “diagnosis, prevention, monitoring, **prediction**, **prognosis**, treatment or alleviation of disease,  
> diagnosis, monitoring, treatment, alleviation of, or compensation for, an **injury** or disability,  
> investigation, replacement or modification of the anatomy or of a physiological or pathological process or state,  
> providing information by means of in vitro examination of specimens…”

Source: https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX%3A32017R0745

**MDR expanded “prediction” and “prognosis”** versus the old MDD — this is why “injury risk prediction” and disease-risk language are especially dangerous.

### 7.2 Lifestyle / wellbeing carve-out — quote the actual text

**MDR Recital (19):**

> “It is necessary to clarify that software in its own right, when specifically intended by the manufacturer to be used for one or more of the medical purposes set out in the definition of a medical device, qualifies as a medical device, while software for general purposes, even when used in a healthcare setting, or **software intended for life-style and well-being purposes is not a medical device**. The qualification of software, either as a device or an accessory, is independent of the software’s location or the type of interconnection between the software and a device.”

**Limits of the carve-out:**

1. It is **purpose-based**, not technology-based. Calling something “wellness” does not save medical claims.
2. Marketing, UI copy, coach training materials, and B2C ads are all evidence of intended purpose (MDR Art. 2(12) “intended purpose”).
3. MDCG 2019-11: wellness/fitness apps **without** medical purpose do not qualify as MDSW — but software that creates information used for diagnosis/therapy/monitoring of disease or injury does.
4. Actual use by healthcare professionals in clinical pathways can re-characterise risk in practice; design for sports coaching use only.
5. Annex XVI aesthetic products without medical purpose can still be regulated — not typically relevant here.

### 7.3 MDCG 2019-11 (software qualification)

Primary guidance:  
https://health.ec.europa.eu/system/files/2020-09/md_mdcg_2019_11_guidance_en_0.pdf  
(also rev.1 materials circulating 2025–2026)

Key statement:

> “software only intended for non-medical purposes … **wellness or fitness apps**, do not qualify as MDSW.”

Decision logic (simplified):

1. Is it software?  
2. Is it MDSW (medical purpose under MDR Art. 2(1) / IVDR Art. 2(2))?  
3. If IVD data only → IVDR path.  
4. Then classify (MDR Rule 11 often → Class IIa+ for decision-support).

**Illustrative MDSW examples from MDCG 2019-11 highly relevant to PPD:**

- Apps enhancing self-test glucose devices with **trend analysis, personalized risk assessments, or health condition monitoring**.
- Software providing insulin dose recommendations.
- Apps that estimate a user’s **risk of a given condition** based on health data.

**Non-MDSW:** pure fitness/wellness logging and coaching without medical purpose; simple storage/transmission without creating medical information.

### 7.4 Related 2025–2026 guidance / enforcement climate

| Instrument | Relevance |
|---|---|
| **MDCG 2025-4** (June 2025) — MDSW apps on online platforms | Platforms should **separate MDSW apps from health/lifestyle apps**; metadata (CE, UDI, intended purpose). Signals regulators want a bright line in app stores. https://health.ec.europa.eu/latest-updates/mdcg-2025-4-guidance-safe-making-available-medical-device-software-mdsw-apps-online-platforms-june-2025-06-16_en |
| **MDCG 2025-6 / AIB 2025-1** (June 2025) | FAQ on AI Act + MDR/IVDR for Medical Device AI; single technical file allowed (AI Act Art. 11(2)). |
| **MDCG 2024-11** (Oct 2024) | IVDR qualification: products without medical purpose (ancestry, relatives, ethnic origin, **sport / wellbeing / lifestyle**) are not IVDs — but disease predisposition tests are. https://health.ec.europa.eu/document/download/12b92152-371f-404d-a865-93800cd5cdca_en |
| **MHRA AVT guidance** (29 July 2026, UK) | Ambient voice tools for transcription/summary ≠ devices; diagnosis/treatment support = devices. Same *intended purpose* logic EU counsel will recognise. https://www.gov.uk/government/news/mhra-clarifies-regulatory-status-of-ambient-voice-technologies-used-in-the-nhs |

No single EU-wide “sports wearable app” landmark fine unique to tennis was identified in open sources for 2025–mid-2026; enforcement pressure is visible through **MDCG 2025-4 platform delineation**, **home-testing / DTC genetics IVDR scrutiny**, and **AESIA operational sanctioning** for AI Act prohibitions rather than MDR sports cases.

---

## 8. Per-feature MDR/IVDR verdicts for PPD

### (a) Wearable readiness / recovery scores

| | |
|---|---|
| **Verdict** | **Wellness — stayable**, if tightly framed |
| **Why** | Fitness/training readiness from HRV, sleep, load is classic lifestyle/wellbeing territory under Recital 19 + MDCG wellness carve-out, *provided* it is not for diagnosis/monitoring of disease or injury. |
| **Crossing the line** | “Detects overtraining syndrome”, “diagnoses autonomic dysfunction”, “medical recovery clearance”, “monitors cardiac risk”. |
| **Safe phrasing** | “Training readiness estimate for planning practice intensity”; “recovery score for sports performance context”; “not a medical assessment”. |
| **Unsafe phrasing** | “Clinically validates you’re healthy to play”; “screens for illness”; “predicts pathological fatigue”. |

### (b) Training-load and injury-risk indicators

| | |
|---|---|
| **Verdict** | **Unacceptable as currently conceptualised if it predicts injury risk** → restructure or regulate as MDSW |
| **Why** | MDR Art. 2(1) expressly covers **prediction** and **monitoring** of **injury**. An “injury risk %” or “likelihood of ACL injury” is a medical purpose regardless of “sports” branding. Acute:chronic workload ratios presented as *training load management* are safer than injury prediction. |
| **Crossing the line** | “Injury risk score”, “injury prediction model”, “prevent injuries by following this protocol”, return-to-play medical clearance. |
| **Safe phrasing** | “Training load relative to your recent baseline”; “sudden load spike vs your 28-day average”; “coach review recommended before increasing volume”; “performance load indicator — not an injury diagnosis or prediction”. |
| **Unsafe phrasing** | “You have a 72% chance of injury this week”; “AI injury prevention diagnosis”; “cleared / not cleared medically”. |
| **Product action** | **Cut or rename** injury-risk features. Replace with load-management metrics + human coach judgment. If injury prediction is strategically essential → full MDR pathway (likely Class IIa+ under Rule 11) — not a soft launch item. |

### (c) Blood biomarker interpretation against reference ranges

| | |
|---|---|
| **Verdict** | **High MDSW/IVDR risk** if PPD interprets or flags clinical meaning |
| **Why** | Providing information concerning a physiological/pathological state from specimens is core IVDR Art. 2(2) / MDR territory. Displaying lab PDF values unchanged is closer to viewer; **interpreting**, colour-coding “abnormal”, diagnosing deficiency, or recommending treatment crosses into IVD/MDSW. MDCG 2024-11: software can be IVD even without analysing the specimen itself if it provides information based on IVD results. |
| **Crossing the line** | “Your ferritin indicates iron-deficiency anaemia”; “abnormal endocrine panel — likely overtraining pathology”; automated clinical flags. |
| **Safer pattern** | Show values + **lab’s own** reference ranges with disclaimer; educational glossary of *what the analyte is* (general knowledge); “discuss with your physician / sports doctor”; no personalized clinical interpretation; no treatment advice. |
| **Unsafe phrasing** | “We diagnosed low testosterone”; “your panel shows disease X”; “start supplement Y for medical deficiency”. |
| **Product action** | Prefer **pass-through display + education**. Do **not** ship AI clinical interpretation at launch without IVDR/MDR strategy. |

### (d) CGM-derived glucose scores

| | |
|---|---|
| **Verdict** | **High MDSW risk** for anything beyond raw display / sports fuelling education |
| **Why** | MDCG 2019-11 explicitly treats apps that enhance glucose self-test devices with **trend analysis, personalized risk assessments, or health condition monitoring** as MDSW. CGM sensors themselves are medical devices; software that “creates” medical information about glycaemic control is in scope. |
| **Crossing the line** | Time-in-range medical targets framed as diabetes control; hypo/hyper alerts as clinical monitoring; “metabolic health diagnosis”; insulin advice. |
| **Narrower wellness attempt** | “Glucose response around training sessions for fuelling experiments”; athlete-selected workouts; no disease claims; no diabetes management; strong “not for medical monitoring” labelling — **still fragile** if users with diabetes reasonably rely on it. |
| **Unsafe phrasing** | “Manages your diabetes”; “medical continuous glucose monitoring dashboard”; “prevents hypoglycaemia events”. |
| **Product action** | **Restructure:** either (i) CE-marked MDSW path with notified body, or (ii) strip to non-interpretive display of user-imported values + general sports nutrition education, with diabetes users directed to their prescribed CGM app. Do not build clinical TIR dashboards in the wellness product. |

### (e) Genetics-based educational context

| | |
|---|---|
| **Verdict** | **Wellness/education OK for non-medical traits; IVDR Class C territory for disease predisposition** |
| **Why** | MDCG 2024-11: tests for ancestry / relatives / ethnic origin / **sport, wellbeing, lifestyle** without medical purpose are **not IVDs**. IVDR covers predisposition to medical conditions/diseases. DTC genetic testing with medical purpose is typically high-classification under IVDR Rule 3. |
| **Crossing the line** | “Your APOE risk for Alzheimer’s”; “genetic injury predisposition diagnosis”; BRCA-style disease risk in-app. |
| **Safe phrasing** | “Educational information about genetic variants sometimes discussed in sports science literature; not a medical genetic test; not diagnostic; consult a genetic counsellor/physician for health questions.” |
| **Unsafe phrasing** | “Your genes show you will get tendon injuries”; “clinical genetic risk report”. |
| **Product action** | Restrict to **educational, non-diagnostic** content. Prefer partner CE-marked IVD reports if medical genetics are offered. Avoid AI “interpreting” raw consumer genetics into disease risk. |

### (f) LLM chat answering athlete questions about their own health data

| | |
|---|---|
| **Verdict** | **Highest borderline risk of the portfolio** — can be wellness *or* MDSW depending on intended purpose and behaviour |
| **Why** | Intended purpose is judged by what the chat *does*. An agent that interprets biomarkers/CGM/symptoms and recommends clinical action is software for diagnosis/monitoring. MHRA 2026 AVT logic and MDR Recital 19 both hinge on purpose. General sports Q&A with hard clinical refusals can stay wellness. |
| **Crossing the line** | “Based on your labs you have X”; triage of chest pain; medication dosing; diagnosing concussion; clearing return-to-play medically. |
| **Safe design** | Explicit non-diagnostic purpose; refuse medical diagnosis/treatment; escalate to human clinician/coach; no autonomous clinical conclusions; Art. 50 AI disclosure; age-gated; prompt + tool filters; evaluation harness for medical-claim leakage. |
| **Unsafe phrasing** | “I’m your AI doctor”; “diagnosis: …”; “you should take 500 mg …”; “you’re cleared to play after concussion”. |
| **Product action** | Launch only with **strict medical-refusal policy**, eval red-team, and documented intended purpose. Treat unconstrained “ask anything about my health data” as **unacceptable regulatory risk**. |

---

## 9. Language & product design: safe vs crossing the line

### 9.1 Global intended-purpose statement (template)

**Safer:**

> “Peak Performance Data is a sports performance and wellness platform for athletes and coaches. It provides training-load, match, and readiness insights to support athletic development. It is **not a medical device**, does **not** diagnose, treat, prevent, or predict disease or injury, and is **not** a substitute for advice from a licensed healthcare professional.”

**Unsafe:**

> “AI clinical decision support for athlete health, injury prediction, and biomarker diagnostics.”

### 9.2 Phrase bank

| Domain | Prefer | Avoid |
|---|---|---|
| Readiness | “training readiness”, “recovery for performance” | “medical clearance”, “healthy vs unhealthy”, “detects illness” |
| Load | “acute:chronic workload”, “load spike vs baseline” | “injury risk %”, “will get injured”, “injury prevention diagnosis” |
| Biomarkers | “lab values as reported by your laboratory”, “educational analyte info” | “we interpret your pathology”, “you have anaemia” |
| CGM | “glucose context around sessions (not medical monitoring)” | “diabetes management”, “hypo prevention system” |
| Genetics | “educational sports-science context” | “genetic disease risk report” |
| Chat | “AI sports assistant — not a clinician” | “AI doctor”, “diagnosis”, “prescription” |
| Minors | “coach + parent supervised insights” | autonomous clinical or body-image coaching |

### 9.3 Design rules that keep features on the wellness side

1. **Intended purpose document** signed by product + legal; control all marketing claims.
2. **UI disclaimers** at feature entry, not only ToS.
3. **No automated medical decisions**; human coach in the loop for load changes affecting minors.
4. **Separate modules**: if a future CE-marked MDSW is needed (e.g. injury prediction), isolate it — do not contaminate the wellness CE-free product with medical claims (MDCG modular logic).
5. **App store categorisation** as health & fitness / sports — not “medical”; align with MDCG 2025-4 delineation expectations.
6. **Eval harness** that fails builds when the agent emits diagnosis/treatment/injury-prediction claims.
7. **B2C ads** reviewed under the same claim rules as the IFU.

---

## 10. Spain-specific considerations

### 10.1 AESIA (AI supervisory authority)

- **Agencia Española de Supervisión de la Inteligencia Artificial (AESIA)**, A Coruña — first dedicated national AI supervisor in the EU.
- Market surveillance / single point of contact under AI Act Art. 70.
- Sanctioning powers phased with AI Act: prohibited practices oversight from early 2025; broader enforcement aligned with Aug 2025 / Aug 2026 waves (press coverage Aug 2025: AESIA can fine for prohibited practices).
- Publishes practical (non-binding) guides 01–16 from the Spanish AI sandbox: conformity, QMS, risk, **human oversight**, data governance, transparency, accuracy, robustness, cybersecurity, logging, post-market, incidents, technical documentation.  
  https://aesia.digital.gob.es/es/guias  
  Contact: aesia@digital.gob.es

**Other Spanish authorities in the map:**

| Authority | Domain |
|---|---|
| **AESIA** | AI Act market surveillance (lead) |
| **AEPD** | GDPR / LOPDGDD — health data, minors, genetics |
| **AEMPS** | Medicines & medical devices (MDR/IVDR) |
| **CNMC** | Competition aspects |

### 10.2 AEMPS (devices)

- Spanish competent authority for MDR/IVDR vigilance, market surveillance, and economic-operator obligations.
- If any PPD module is MDSW/IVD: Spanish registration / EUDAMED, vigilance reporting to AEMPS, and notified-body conformity assessment as class requires.
- AI as a medical device safety component → dual AESIA awareness + AEMPS MDR path; Omnibus high-risk AI date for Annex I products → **2 Aug 2028**, but **MDR obligations are already live** independently of the AI Act delay.

### 10.3 Practical Spain checklist

- Map PPD systems for AESIA inventory (AI systems list + risk class rationale).
- DPIA with AEPD expectations for minors + special-category data.
- Do not wait for Dec 2027 high-risk AI deadlines to clean medical claims — AEMPS can act under MDR today.
- Consider Spanish AI sandbox / AESIA guides for documentation templates.

---

## 11. Compliance checklist

### 11.1 Must do before launch (AI Act — live now)

- [ ] **Art. 5 review:** no emotion recognition in academy/workplace; no vulnerability-exploitative nudges toward minors; no social scoring of athletes.
- [ ] **Art. 50(1):** AI interaction disclosure at first chat/agent use; accessible; persistent.
- [ ] **Art. 50(2):** machine-readable marking plan for synthetic outputs (Code of Practice); if already shipping before 2 Aug 2026, comply by **2 Dec 2026**.
- [ ] **Art. 4 literacy:** ensure staff who build/deploy AI understand risks (Omnibus simplifies but does not erase responsibility for safe deployment).
- [ ] **GPAI due diligence:** contracts + Annex XII infosheets from model providers; respect AUPs on medical/minors; document model/version.
- [ ] **Classification memo:** written Annex III analysis (education/employment/emotion) with use restrictions in customer contracts.
- [ ] **Minors controls:** parental consent flows, age-appropriate UX, coach oversight defaults.

### 11.2 Must document (even if minimal-risk)

- [ ] Intended purpose statement (wellness/sports performance — non-diagnostic).
- [ ] AI system inventory (components, models, data sources, users).
- [ ] Risk assessment covering Art. 5, Annex III edge cases, MDR borderline per feature.
- [ ] Claim matrix (allowed / forbidden UI and marketing language).
- [ ] Human oversight & override design description.
- [ ] Agent evaluation reports (medical-claim leakage, minor-safety).
- [ ] DPIA / records of processing (GDPR) for health, wearable, genetic, CGM data.
- [ ] Incident response linking product, AI, and (if any) device vigilance.

### 11.3 Must do before launch (MDR / product claims)

- [ ] Legal review of all six feature areas against MDR Art. 2(1) / IVDR Art. 2(2) / Recital 19 / MDCG 2019-11 / MDCG 2024-11.
- [ ] Remove or quarantine **injury-risk prediction** language and models.
- [ ] Biomarker module: no clinical interpretation engine at launch.
- [ ] CGM module: either MDSW strategy or non-interpretive display + fuelling education only.
- [ ] Genetics: educational only; no disease-predisposition scoring.
- [ ] LLM: hard refusal policy + eval gates; never “AI doctor”.
- [ ] Align App Store / Play listing category and description with wellness (MDCG 2025-4 logic).

### 11.4 Features with unacceptable regulatory risk — cut or restructure

| Feature | Action |
|---|---|
| Injury risk % / injury prediction | **Cut or fully MDR-regulate** — do not soft-launch as wellness |
| Clinical biomarker interpretation / abnormal flagging | **Cut** at launch; pass-through + education only |
| CGM clinical monitoring / diabetes management | **Cut** or pursue CE MDSW |
| Disease-risk genetics scoring | **Cut**; educational sports traits only or partner IVD |
| Unconstrained health LLM over labs/CGM/symptoms | **Restructure** with refusals + scope limits; else MDSW |
| Emotion/mood inference from biometrics in academies | **Cut** — Art. 5(1)(f) / Annex III risk |
| Automated academy admission / employment decisions | **Cut** — Annex III education/employment |

### 11.5 Should prepare before Dec 2027 (even if not high-risk today)

- [ ] Monitor Omnibus implementing texts and harmonised standards.
- [ ] If product drifts into Annex III or MDR AI: Art. 9–15 controls, QMS, logging, FRIA (Art. 27), registration, conformity assessment.
- [ ] Dual AESIA + AEMPS engagement plan for any MDAI module.
- [ ] Track Commission Art. 50 guidelines + Code of Practice updates.

---

## 12. Source index (primary & high-value secondary)

### AI Act / Omnibus
1. https://digital-strategy.ec.europa.eu/en/policies/regulatory-framework-ai — AI Act overview & timeline (updated 31 July 2026)  
2. https://digital-strategy.ec.europa.eu/en/news/ai-omnibus-enters-force — Omnibus entry into force (27 July 2026)  
3. https://digital-strategy.ec.europa.eu/en/faqs/transparency-obligations-under-article-50-ai-act — Art. 50 FAQ (24 July 2026)  
4. https://digital-strategy.ec.europa.eu/en/policies/code-practice-ai-generated-content — Transparency Code of Practice  
5. https://digital-strategy.ec.europa.eu/en/policies/enforcement-ai-act — Enforcement timeline  
6. https://artificialintelligenceact.eu/article/50/ — Art. 50 text  
7. https://artificialintelligenceact.eu/article/14/ — Art. 14 human oversight  
8. https://artificialintelligenceact.eu/annex/3/ — Annex III  
9. https://artificialintelligenceact.eu/article/5/ — Art. 5 prohibitions  
10. https://ai-act-service-desk.ec.europa.eu/en/ai-act/article-3 — Definitions incl. emotion recognition  
11. https://ai-act-service-desk.ec.europa.eu/en/ai-act/article-53 — GPAI provider obligations  
12. https://www.mayerbrown.com/en/insights/publications/2026/07/eu-ai-act-news-digital-omnibus-on-ai-new-guidance-on-risk-classification-gpai-and-transparency-obligations — Omnibus analysis (July 2026)

### MDR / IVDR / MDCG
13. https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX%3A32017R0745 — MDR 2017/745 (Recital 19; Art. 2)  
14. https://health.ec.europa.eu/system/files/2020-09/md_mdcg_2019_11_guidance_en_0.pdf — MDCG 2019-11  
15. https://health.ec.europa.eu/document/download/12b92152-371f-404d-a865-93800cd5cdca_en — MDCG 2024-11 IVDR qualification  
16. https://health.ec.europa.eu/latest-updates/mdcg-2025-4-guidance-safe-making-available-medical-device-software-mdsw-apps-online-platforms-june-2025-06-16_en — MDCG 2025-4  
17. https://www.pureglobal.com/news/eu-guidance-mdcg-2025-6-clarifies-compliance-for-medical-device-ai — MDCG 2025-6 / AIB 2025-1 summary  
18. https://www.sanolabs.eu/blog/wellness-app-vs-medical-device-eu-mdr — Wellness vs MDSW practical summary  
19. https://www.gov.uk/government/news/mhra-clarifies-regulatory-status-of-ambient-voice-technologies-used-in-the-nhs — MHRA AVT (29 July 2026) intended-purpose analogy

### Spain
20. https://aesia.digital.gob.es/es/guias — AESIA guides  
21. https://www.glacis.io/guide-eu-ai-act-spain — AESIA / AEMPS competence map  
22. https://www.elespanol.com/invertia/disruptores/politica-digital/europa/20250802/aesia-puede-sancionar-empresas-incumplan-ley-europea-ia/1003743856242_0.html — AESIA sanctioning (Aug 2025 press)

---

## 13. Bottom-line recommendation for PPD

Ship as a **sports performance / wellness AI platform** with:

1. **Art. 50-ready** conversational AI (disclosure + marking).  
2. **No injury-prediction product.**  
3. **No clinical interpretation layer** on labs/CGM/genetics.  
4. **Hard medical refusals** in the agent, especially for minors.  
5. **Contractual bans** on using scores for employment or academy admissions automation.  
6. **Written borderline + Annex III memos** ready for AESIA/AEMPS questions.  
7. Treat any future injury-prediction or clinical CGM/lab module as a **separate CE-marked MDSW programme**, not a toggle in the wellness app.

*End of dossier — research snapshot 2 August 2026.*
