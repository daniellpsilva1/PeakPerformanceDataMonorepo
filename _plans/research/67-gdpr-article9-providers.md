# GDPR Article 9 / DPA Implications for LLM Providers — Research Dossier

**Date researched:** 2 August 2026  
**Jurisdiction focus:** EU GDPR + Spain (LOPDGDD), AEPD  
**Platform context:** Spain-based sports-performance SaaS for tennis academies; multi-agent LLM system; data classes include wearable HR/HRV/sleep, training load, blood biomarkers, consumer genetics, CGM; many data subjects are minors.  
**Current production posture (as of research request):** DeepSeek (primary LLM), Groq (fallback), OpenAI (embeddings).

> **Not legal advice.** This dossier synthesises primary regulatory text, DPA decisions, and provider terms as publicly available on 2 August 2026. Engage Spanish counsel / DPO before final vendor selection and before processing genetic data.

---

## Executive verdict (read first)

| Question | Answer |
|---|---|
| Is DeepSeek acceptable for this platform? | **No — not for any EU personal data in production.** Especially not for Article 9 data or minors. |
| Acceptable exception? | **Self-hosted open-weight DeepSeek (or other) models on EU-controlled infrastructure with no egress** — a different product from DeepSeek’s hosted API/app. |
| Primary recommended hosted stack | **Mistral (EU) and/or Azure OpenAI / AWS Bedrock in EU regions**, with Zero Data Retention (ZDR) where available. |
| Genetic data | **Must not leave our infrastructure** — self-hosted open-weight only. |
| DPIA | **Mandatory before go-live** of the multi-agent health pipeline. |

---

## 1. GDPR Article 9 — prohibition and exemptions

### 1.1 The rule

Article 9(1) GDPR (EUR-Lex CELEX 32016R0679):

> “Processing of personal data revealing racial or ethnic origin, political opinions, religious or philosophical beliefs, or trade union membership, and the processing of **genetic data**, biometric data for the purpose of uniquely identifying a natural person, **data concerning health** or data concerning a natural person's sex life or sexual orientation **shall be prohibited**.”

Definitions (Art. 4):

- **Genetic data** (4(13)): “personal data relating to the inherited or acquired genetic characteristics of a natural person which give unique information about the physiology or the health of that natural person…”
- **Data concerning health** (4(15)): “personal data related to the physical or mental health of a natural person, including the provision of health care services, which reveal information about his or her health status.”

Recital 35 expands health data to include physiological/biomedical state “independent of its source,” including from devices and apps.

### 1.2 The exemptions (Art. 9(2))

Processing is allowed only if **one** of (a)–(j) applies **in addition to** an Article 6 lawful basis. Relevant candidates for a commercial sports-performance platform:

| Exemption | Viable for us? | Why |
|---|---|---|
| **(a) Explicit consent** | **Primary / likely only viable route** for commercial academy SaaS | Narrow healthcare exceptions do not fit B2B sports analytics. |
| (b) Employment / social security | No (unless academy is employer and Spanish labour law specifically authorises — typically not for genetics/biomarkers as a SaaS feature) | |
| (c) Vital interests | No (emergency-only; subject incapable of consent) | |
| (e) Manifestly made public | No (athletes do not “publish” HRV panels) | |
| (f) Legal claims | Incidental only | |
| (g) Substantial public interest | Requires Spanish statute; sports anti-doping etc. are specific and do not cover commercial performance SaaS | LOPDGDD Art. 9(2) requires a *norma con rango de ley* |
| **(h) Preventive/occupational medicine / care** | **Generally no** for a SaaS vendor | Requires processing by/under a professional bound by secrecy (Art. 9(3)); commercial wellness/performance platforms are routinely held **outside** this exception |
| (i) Public health | No | |
| (j) Research/statistics | Only if structured as Art. 89 research with Spanish law basis — not product inference | |

**Conclusion on legal basis:** For product features that analyse wearable, biomarker, genetic, or CGM data to produce athlete insights, the operable Art. 9 condition is **explicit consent (9(2)(a))**, paired with an Art. 6 basis (typically consent and/or contract for the non-special-category layer). Do **not** rely on Art. 9(2)(h) unless a licensed health professional is contractually and operationally in the processing chain under Spanish secrecy rules.

### 1.3 What makes explicit consent valid for special-category data

EDPB Guidelines 05/2020 on consent (and Art. 4(11), Art. 7, Recital 32/42/43):

1. **Freely given** — real choice; no detriment for refusal; not bundled as a condition of unrelated service (conditionality).
2. **Specific** — separate purposes; granular opt-ins.
3. **Informed** — clear identity of controller(s), categories of data, purposes, recipients (including LLM subprocessors and third countries), withdrawal mechanism.
4. **Unambiguous affirmative act** — no pre-ticked boxes, silence, or “by continuing you agree.”
5. **Explicit** (Art. 9 bar) — a clear *statement* (written/electronic) that specifically names the special-category processing; higher than ordinary Art. 6 consent.
6. **Withdrawable** as easily as given (Art. 7(3)), without service collapse for core non-health features.
7. **Demonstrable** (Art. 7(1)) — logs, versioned notices, per-purpose records.

#### Difficulty A — Coach–athlete / academy–athlete power imbalance

EDPB Guidelines 05/2020 §3.1.1 (imbalance of power; employment analogy; Recital 43): where the data subject cannot refuse without fear of detriment, consent is **unlikely** to be freely given.

Coach–athlete and academy–scholarship relationships are structurally analogous. Mitigations that must be designed into the product:

- Consent collected **directly from the athlete** (or parent/guardian), not “signed by the coach for the roster.”
- Refusal must **not** affect academy membership, court time, or selection — only the specific AI/health features.
- Academy/coach accounts must not coerce “enable all analytics for all athletes” as a default.
- Prefer parent/athlete-facing consent UX over coach-administered bulk enablement for Art. 9 data.

#### Difficulty B — Minors (Spain)

- GDPR Art. 8: Member States may set digital consent age 13–16.
- **LOPDGDD Art. 7:** in Spain, the minor may consent from **age 14**; under 14, holders of parental authority/guardianship must consent.
- For Art. 9 health/genetic data of 14–17-year-olds: Spanish practice still expects heightened transparency; for genetic and clinical-grade data, obtaining **both** minor and parent consent is strongly advisable (counsel confirmation required).
- Controllers must make **reasonable efforts** to verify parental authorisation (Art. 8(2)).

#### Difficulty C — Granularity per data type

Separate explicit consents (at minimum):

1. Wearable-derived physiological metrics (HR, HRV, sleep, readiness, training load inferences)
2. Continuous glucose monitoring
3. Blood biomarker panels
4. Genetic / ancestry / consumer DNA reports
5. Sharing with coaches / parents / academy staff (role-based)
6. Processing by named AI subprocessors / transfers outside the EEA (if any)
7. Optional: use of data for product improvement / model evaluation (default **off**)

Withdrawal of (4) must not disable (1) if (1) remains consented, etc.

---

## 2. Are wearable-derived metrics “health data” under Article 9?

### 2.1 The contested line

Not every step count is automatically Art. 9. WP29’s 2015 Annex on health data in apps/devices (response to Commission mHealth initiative) and Recital 35 establish a **broad, purpose-and-inference-sensitive** test:

WP29 recognised three buckets:

1. Data that are clearly medical/health (diagnoses, clinical measurements, disease risk).
2. Raw lifestyle data that, alone, may not be health data (e.g. isolated step count).
3. A **grey zone**: data that become health data when tracked over time, combined, or used to infer health status.

WP29 warning (paraphrased from the Annex / contemporary summaries): even “innocuous” raw data, combined with other datasets or used to determine health status, fall within health data.

### 2.2 Application to our metrics

| Metric / product use | Article 9? | Reasoning |
|---|---|---|
| Isolated step count, no health inference | Often **no** (personal data only) | Weak health revelation |
| Resting HR, HRV, sleep architecture, SpO2, readiness scores used to assess recovery/overtraining | **Yes** | Physiological state revealing health/recovery status (Recital 35) |
| Training load + readiness → injury-risk / fatigue insights | **Yes** | Inference about physical condition |
| CGM glucose streams | **Yes** (clearly) | Biomedical measurement |
| Blood biomarkers (ferritin, cortisol, CBC, etc.) | **Yes** | Testing of bodily substances (Recital 35) |
| Consumer genetic reports | **Yes** (genetic data named in Art. 9(1)) | Plus Art. 9(4) Member State room |

**Reasoned conclusion for this platform:** Once we store wearable streams **and** generate readiness/recovery/injury-risk insights for coaches and athletes, we are processing **Article 9 health data**. Treating HRV/sleep/readiness as “mere fitness telemetry” to avoid Art. 9 is **not defensible** under WP29/EDPB-aligned interpretation for a performance-medicine-adjacent product. Design consent, DPIA, and vendor controls on that basis.

Distinction that remains useful operationally:

- **Raw fitness telemetry** (steps) vs **health inferences** (overtraining flag) — both may be Art. 9 in combination; inferences always are.
- Minimisation strategy: keep raw series inside our systems; send only **derived, purpose-limited features** to LLMs (see §9).

---

## 3. Genetic data and Spanish LOPDGDD (Art. 9(4))

### 3.1 GDPR Art. 9(4)

> “Member States may maintain or introduce further conditions, including limitations, with regard to the processing of genetic data, biometric data or data concerning health.”

### 3.2 Spain — LOPDGDD highlights

**LOPDGDD Art. 9** (special categories):

- Art. 9(1): alone, consent does **not** lift the prohibition where the *main purpose* is to identify ideology, union membership, religion, sexual orientation, beliefs, or racial/ethnic origin (anti-discrimination rule). Genetic/health for sports performance is different, but shows Spanish caution with Art. 9(2)(a).
- Art. 9(2): processing under Art. 9(2)(g)(h)(i) based on Spanish law requires a **statute** (*norma con rango de ley*), which may add security/confidentiality requirements. Health-system management and insurance contracts are expressly contemplated — **not** a free pass for commercial AI sports SaaS.

**Disposición adicional 17ª (health data / biomedical research):** special rules for health research; genetic personal data in research contexts tied to explicit consent or anonymisation under Spanish biomedical research framework (LIB / LOPDGDD interaction). Consumer genetics ingested into a SaaS product is **not** “research” merely because an LLM summarises SNPs.

**Practical Spanish posture for product:**

- Explicit, granular consent remains the path.
- Genetic data: highest restriction tier — minimise, segregate, encrypt, restrict access, **no third-country LLM**, document purpose limitation tightly.
- If any clinical interpretation is offered, Patient Autonomy Law (41/2002) and professional secrecy considerations may be triggered — involve counsel.

---

## 4. International transfers (Chapter V) — and DeepSeek specifically

### 4.1 Legal machinery

1. **Adequacy** (Art. 45) — European Commission decision that a third country ensures essentially equivalent protection.
2. **Appropriate safeguards** (Art. 46) — principally **Standard Contractual Clauses (SCCs)** + binding corporate rules, etc.
3. **Transfer Impact Assessment (TIA)** — after *Schrems II* (CJEU C-311/18), SCCs alone are insufficient where the importer’s law allows disproportionate public-authority access; **supplementary measures** (encryption with EU-held keys, split processing, etc.) may be required — or the transfer must stop.
4. **Derogations** (Art. 49) — explicit consent for specific transfers, etc.; unsuitable as a systemic basis for continuous LLM prompting of health data.

**China:** No EU adequacy decision. Chinese cybersecurity / national intelligence frameworks create well-documented TIA obstacles for cloud AI that stores prompts in the PRC.

### 4.2 DeepSeek — terms and data handling (as of research date)

Primary source: [DeepSeek Privacy Policy](https://cdn.deepseek.com/policies/en-US/deepseek-privacy-policy.html)

Quoted facts:

- **Controller:** Hangzhou DeepSeek Artificial Intelligence Co., Ltd. (China).
- **Inputs collected:** “text input, voice input, prompt, uploaded files, photos, feedback, chat history…”
- **Training use:** Personal data used “to improve and develop the Services and to **train and improve our technology**, such as our machine learning models and algorithms.” Opt-out of training exists as a right in the policy — **not** a default enterprise zero-training guarantee comparable to Azure/OpenAI API.
- **Storage location (explicit):**  
  > “To provide you with our services, we **directly collect, process and store your Personal Data in People's Republic of China**.”
- **Sensitive data disclaimer:**  
  > “The Services are **not designed or intended to process sensitive Personal Data** (e.g., … **health**, … **genetic** or biometric data, **personal data of children**…).”  
  > “We do not ask for, and **you should not provide** sensitive Personal Data…”
- **DPA / Art. 28 processor package:** No mature, publicly documented enterprise Art. 28 DPA + SCC package comparable to Azure/Mistral/Anthropic commercial offerings. Consumer policy frames DeepSeek as **controller**. Open Platform text shifts end-user controller duties to the developer app — but **does not remove PRC storage or Chapter V problems** for prompts sent to DeepSeek’s hosted API.

### 4.3 DeepSeek — EU regulatory actions (2025–2026)

| Authority / actor | Date | Action | Status (as of ~Jan 2026 secondary sources; verify live) |
|---|---|---|---|
| **Italy — Garante** | 28–30 Jan 2025 | Urgent **limitation/ban** on processing Italian users’ data (Art. 58(2)(f)); opened investigation. DeepSeek claimed GDPR did not apply / no Italian operations; Garante found responses “entirely unsatisfactory.” | Ban/limitation **imposed**; investigation opened. Primary: [Garante press release](https://www.garanteprivacy.it/home/docweb/-/docweb-display/docweb/10097450) |
| **Ireland — DPC** | 29 Jan 2025 | Request for information | No public final decision found as of research |
| **France — CNIL** | ~30 Jan 2025 | Analysis / scrutiny reported | Ongoing posture |
| **Belgium, NL, EL, LU, PT, PL, LT, HR, DE…** | Jan–Feb 2025+ | Investigations / warnings (NL warned users about uploading others’ data to China) | Coordinated via expanded EDPB AI Enforcement Task Force (reported) |
| **Spain — AEPD** | 3 Feb 2025 | **OCU complaint** filed asking AEPD to intervene | Complaint filed; no public AEPD final decision located in open sources as of this research — treat as **active Spanish risk** |
| **Germany — Berlin BlnBDI (+ coordinated Länder)** | 6 May 2025 request; **27 Jun 2025** DSA notice | Found **unlawful transfers to China** (Art. 46(1) GDPR); no adequacy; inadequate safeguards; Chinese authority access + lack of enforceable remedies. Notified Apple/Google under **DSA Art. 16** that DeepSeek apps are illegal content in DE. | Primary: [Berlin DPA press release](https://www.datenschutz-berlin.de/pressemitteilung/berliner-datenschutzbeauftragte-meldet-ki-app-deepseek-in-deutschland-bei-apple-und-google-als-rechtswidrigen-inhalt/) |
| **Greece — HDPA** | 2025 | Pressured Art. 27 representative appointment; DeepSeek appointed Prighter (May 2025) | Partial remediation only — does **not** cure China transfer unlawfulness |

Secondary synthesis (MIAI Grenoble, Jan 2026 “DeepSeek One Year Later”): Italy first ban; investigations across ≥12 EEA states; compliance steps (EEA supplemental privacy clauses Feb 2025, Art. 27 rep May 2025) characterised as **reactive** and insufficient to resolve core transfer/sovereignty issues.  
Source: https://ai-regulation.com/deepseek-one-year-later-regulatory-storm-global-surge/

### 4.4 DeepSeek verdict (definitive for this stakeholder question)

**Hosted DeepSeek (app or API that sends prompts to DeepSeek’s PRC infrastructure) is not acceptable** for:

1. Any identifiable athlete/coach/parent personal data of EU residents;  
2. **All** Article 9 classes (wearables health inferences, CGM, biomarkers, genetics);  
3. Minors’ data;  
4. Even “anonymised-looking” prompts that include athlete IDs, academy names + rare metrics, or free text that re-identifies.

**Reasons (stacked, independently fatal):**

1. **Chapter V failure:** PRC storage + no adequacy + no credible Schrems II–resistant SCC/TIA story for continuous health/AI prompting (Berlin DPA expressly found Art. 46(1) breach).  
2. **Regulatory hostility:** Italian limitation order; German DSA illegal-content finding; Spanish consumer complaint to AEPD; multi-state investigations. Using DeepSeek as primary LLM for an EU health-adjacent product is **governance malpractice**.  
3. **Contractual/role failure:** DeepSeek positions as controller / uses data to train; not a clean Art. 28 processor with ZDR.  
4. **Their own policy:** forbids / disclaims sensitive health, genetic, and children’s data.  
5. **Accountability (Art. 5(2)/24):** no reasonable DPIA would approve this transfer for Art. 9 data.

**Only acceptable DeepSeek-related path:** open-weight weights **self-hosted** in EU (our VPC / EU sovereign cloud), with **no telemetry to DeepSeek Inc.**, under our controllership — evaluated as a model artefact, not as a Chinese SaaS subprocessors.

---

## 5. Alternative providers — due diligence matrix (Aug 2026)

| Provider | HQ / default residency | DPA (Art. 28) | Sub-processors | EU residency | Zero retention | Trains on inputs? | Special-category stance |
|---|---|---|---|---|---|---|---|
| **DeepSeek hosted** | PRC | No adequate enterprise package | PRC group / vendors | **No** (PRC) | No | **Yes** (improve/train; opt-out) | Policy: **do not submit** sensitive/health/genetic/children |
| **Groq** | US | Yes ([Customer DPA](https://console.groq.com/docs/legal/customer-data-processing-addendum), SCCs) | Per DPA | US-centric | ZDR available in console | **No** (unless instructed) | Better than DeepSeek; still US transfer + weak for Art. 9 at scale |
| **OpenAI API** | US; EU residency for eligible | Yes + SCCs | Published list | Eligible: `eu.api.openai.com` (approval-gated) | ZDR / modified abuse monitoring (approval) | **No** by default (since Mar 2023) | Enterprise path OK for lower tiers with EU+ZDR; genetics still avoid |
| **Anthropic Claude API** | US | Yes (in Commercial ToS) + SCCs | Published | Native EU pin limited; **prefer Bedrock/Vertex EU** | ZDR for approved orgs | **No** on commercial API | Same — use EU cloud wrap for Art. 9-adjacent |
| **Google AI Studio (free/consumer path)** | Global | Weak / not for enterprise health | Google | Not suitable | N/A | **May train / human review** on free tiers | **Do not use** for personal/health data |
| **Google Vertex AI / paid Gemini** | US corp; EU regions | Google Cloud DPA | GCP list | **Yes** if EU regional endpoint pinned | ZDR-style controls for eligible | **No** without permission (Service Terms) | Viable for tiers 1–2 with pinning + minimisation |
| **Mistral La Plateforme** | **France (EU)** | Yes ([DPA](https://legal.mistral.ai/terms/data-processing-addendum)) | Disclosed; SCCs if needed | **EU-default** | ZDR on Scale / eligible API | Paid API opted out by default; Labs models may train unless ZDR | **Best hosted EU-native option** for tiers 1–2 (and careful 3) |
| **Azure OpenAI / Azure AI** | Microsoft; choose geo | Microsoft Products DPA | Microsoft list | **Yes** (EU / DataZone EU) | Prompts not stored in model; abuse logging configurable; no training on prompts | **No** train/retrain on prompts/completions | Strong for tiers 1–3 with EU deployment type (avoid Global) |
| **AWS Bedrock (EU regions)** | AWS; choose Region | AWS DPA / GDPR center | AWS + model providers under Bedrock terms | **Yes** (`eu-central-1`, `eu-west-1`, etc.) | Inference not used to improve base models; private customisation copies | **No** sharing to improve base models | Strong; Anthropic/Mistral/Meta models under AWS EU control plane |

Sources include: Microsoft Azure OpenAI data privacy docs; OpenAI “Your data” / EU residency announcements; Anthropic Privacy Center DPA/ZDR pages; Mistral legal DPA & Commercial ToS; Groq DPA & Services Agreement; AWS Bedrock security/privacy pages; secondary 2026 vendor trackers (cross-check before contracting).

---

## 6. Role: processor or controller?

Per EDPB Guidelines 07/2020 and CNIL guidance on AI providers:

| Fact pattern | Role |
|---|---|
| Customer sends prompts; provider processes **only** to return inference; **no** training on customer content; bound by instructions | Provider = **processor**; customer = **controller** → need **Art. 28 DPA** (+ SCCs if transfer) |
| Provider uses prompts to **train/improve** its models / determines own purposes | Provider = **(joint) controller** for that purpose → need controller–controller terms / Art. 26; usually **unacceptable** for Art. 9 health |
| DeepSeek consumer/hosted (train + PRC + own purposes) | DeepSeek as **controller** (their policy) / at minimum not a clean processor |
| Azure OpenAI / Bedrock / Mistral paid / Anthropic commercial / Groq Cloud (with DPA) | Marketed as **processor** for customer content |

**For our platform:** we are **controller** (determine purposes: athlete insights, coach tools). LLM vendors must be **processors** under Art. 28. DeepSeek’s hosted offering fails this design. If a vendor trains on our prompts, they become controller for that purpose — incompatible with special-category purpose limitation.

---

## 7. DPIA — mandatory, and what it must contain

### 7.1 Triggers we meet

Art. 35(1)/(3) GDPR + WP29/EDPB Guidelines on DPIA (WP248 rev.01):

Mandatory examples in Art. 35(3) include:

> “(b) processing on a **large scale** of special categories of data referred to in Article 9(1)”

WP29 criteria (DPIA likely if ≥2, sometimes 1): evaluation/scoring; automated decision-making with significant effect; systematic monitoring; **sensitive data**; **data concerning vulnerable subjects** (children); innovative use / new technology (AI); matching datasets; large scale.

**Our system meets at least:**

1. Large-scale Art. 9 health (and genetic) data  
2. Vulnerable subjects (minors in academies)  
3. Evaluation/scoring (readiness, load, risk flags)  
4. Innovative AI / multi-agent LLMs  
5. Cross-border / multiple actor processing (academy, parents, coaches, vendors)

→ **DPIA is mandatory before deployment.**

### 7.2 Minimum content (Art. 35(7))

1. Systematic description of processing and purposes (incl. each agent + vendor)  
2. Necessity & proportionality assessment (why LLM needs which features)  
3. Risk assessment to rights/freedoms (re-ID, discrimination, coercion in sport, China/US access, minor harms)  
4. Mitigations (consent UX, minimisation, EU residency, ZDR, encryption, access control, DPA/SCC/TIA, erasure runbooks, human oversight)

Also: DPO advice (Art. 35(2)); prior consultation with AEPD if residual high risk (Art. 36).

---

## 8. Data minimisation applied to LLM prompts

### 8.1 Legal anchor

Art. 5(1)(c) GDPR — personal data must be “adequate, relevant and **limited to what is necessary**.”  
Art. 25 — data protection by design.  
EDPB Opinion 28/2024 on AI models (adopted 17 Dec 2024; Irish DPC request): stresses case-by-case personal-data analysis, accountability, documentation; legitimate interest may apply to *some* AI development/deployment contexts but **does not authorise** Art. 9 processing without an Art. 9 condition; web-scraping / indiscriminate capture criticised via minimisation lens.  
PDF: https://www.edpb.europa.eu/system/files/2024-12/edpb_opinion_202428_ai-models_en.pdf  
(ChatGPT Taskforce report May 2024 is a predecessor; Opinion 28/2024 is the current horizontal EDPB AI-personal-data opinion as of this research; no full replacement guidelines located for 2025–2026 that supersede it.)

### 8.2 Architecture implication

```
[Wearable / lab / genetics sources]
        ↓
[In-VPC feature store — EU]
  - raw series, PDFs, VCF/SNP tables NEVER egress
        ↓
[Deterministic feature compilers]
  - z-scores, RAG-ready summaries, flags, week-over-week deltas
        ↓
[Policy gateway — data tier classifier]
        ↓
   ┌────┴────┬────────────┬──────────────┐
   ▼         ▼            ▼              ▼
 Tier1     Tier2        Tier3          Tier4
 Mistral/  Mistral/     Azure EU /     Self-hosted
 Azure EU  Azure EU     self-host      open-weight
           ZDR          aggregates     only
```

**Rule:** LLMs receive **compiled features and natural-language questions**, not raw biometric files, full CGM CSVs, lab PDFs, or genetic raw data.

---

## 9. Right to erasure when data was sent to an LLM

Art. 17 GDPR — controller must erase without undue delay where applicable, and under Art. 19 inform recipients.

Practical requirements:

1. **Vendor contract:** deletion assistance, documented retention (0 / 7 / 30 days), ZDR preferred for Art. 9.  
2. **Our logs:** prompt/response stores must be erasable by `athlete_id` / consent withdrawal.  
3. **Irreversibility problem:** if vendor trained on prompts or retains backups, full erasure may be **technically limited** — this is why training-on-customer-data and long log retention are unacceptable for Art. 9.  
4. **Model weights:** erasure from a foundation model trained on unlawfully retained prompts is generally infeasible; Opinion 28/2024 discusses when a *model* itself contains personal data — another reason never to allow Art. 9 prompts into training corpora.  
5. **Runbook:** consent withdrawal → disable agents → delete feature-store rows → delete conversation memory → issue vendor deletion requests → record completion in DPIA evidence file.

DeepSeek’s retention (“as long as you have an account” + legitimate interests including improving services) + PRC storage makes Art. 17 **practically unenforceable** — independently disqualifying.

---

## 10. EDPB Opinion 28/2024 (and successors)

**Opinion 28/2024** (17 Dec 2024) — personal data in development/deployment of AI models:

- Anonymity of a model is **case-by-case**; extraction / regurgitation risks matter.  
- Legitimate interest *can* be a basis for some development/deployment processing of **ordinary** personal data if necessity + balancing succeed — **not** a substitute for Art. 9.  
- Unlawful training then “anonymisation” does not erase accountability for the unlawful phase; deployment of a truly anonymous model is analysed separately (nuanced / contested).  
- Heavy emphasis on **documentation and accountability**.

**2025–2026:** EDPB AI Enforcement Task Force coordination around generative AI (including DeepSeek wave); no superseding omnibus “Opinion 28 replacement” identified that changes the Art. 9 analysis for health SaaS. Continue to monitor EDPB and AEPD AI pages.

---

## 11. RECOMMENDATION — definitive product posture

### 11.1 DeepSeek

| Data class | Hosted DeepSeek API/app | Self-hosted open-weight (EU VPC, no egress) |
|---|---|---|
| Non-sensitive ops | **Forbidden** (still personal data → PRC) | Allowed if threat model OK |
| Wearable health metrics | **Forbidden** | Allowed with DPIA + consent |
| Biomarkers | **Forbidden** | Allowed only with extreme access control |
| Genetic | **Forbidden** | Allowed only if strictly necessary + segregated |

**Verdict: Remove DeepSeek hosted as primary (and as any production path for personal data). Immediately.**

### 11.2 Ranked providers by data tier

#### Tier 1 — Non-sensitive operational tasks  
(routing, UI copy, tennis rules Q&A, tool-planning without athlete physiology)

1. **Mistral** (EU-native, DPA, no-train default on paid)  
2. **Azure OpenAI — EU / EU DataZone** (not Global)  
3. **AWS Bedrock EU** (Claude/Mistral/Llama)  
4. **OpenAI API with EU residency + ZDR** (if eligible)  
5. **Anthropic** via Bedrock/Vertex EU (direct Anthropic OK for Tier 1 with SCCs; prefer EU wrap)  
6. **Groq** — acceptable only for Tier 1 with DPA + ZDR + TIA; **demote from health fallback**  
7. ~~DeepSeek hosted~~ **eliminated**

#### Tier 2 — Wearable-derived metrics (HRV, sleep, RHR, readiness)  
Send **only derived features** (see §11.3).

1. **Mistral API + ZDR** (EU)  
2. **Azure OpenAI EU regional / DataZone EU + no abuse logging of content if available**  
3. **Bedrock EU (Anthropic Claude / Mistral)**  
4. Vertex AI **EU regional endpoint** + DPA (pin every request)  
— Direct US OpenAI/Anthropic/Groq: **avoid** for Tier 2 unless EU residency + ZDR locked.

#### Tier 3 — Blood biomarkers  
Prefer **no raw panels** in prompts.

1. **Self-hosted open-weight in EU** (first choice if interpreting panel narrative)  
2. Else **Azure OpenAI EU** or **Mistral ZDR** with **aggregates/flags only** (e.g. “ferritin low vs athlete baseline, trend ↓”)  
3. Never: DeepSeek, Groq, free AI Studio, non-ZDR US endpoints

#### Tier 4 — Genetic data  
1. **Self-hosted open-weight only** (Mistral Small/Large weights, Llama, or similar on EU GPU — OVHcloud/Scaleway/IONOS/Azure confidential EU).  
2. **No hosted third-party LLM** — including Mistral hosted and Azure — for raw genetic files or full variant tables.  
3. If any external LLM is ever proposed: **reject** unless counsel signs off on anonymisation that survives WP29 anonymisation tests (unlikely for personal genomics).

### 11.3 What may leave infrastructure vs what must not

| Tier | May send externally (to approved EU processor) | Must never leave our infrastructure |
|---|---|---|
| 1 | Task text, non-identifying sports knowledge, pseudonymous session tokens | Passwords, auth secrets, full message archives of minors without need |
| 2 | Pseudonymous athlete token + **compiled** features: e.g. `hrv_rmssd_z = -1.4`, `sleep_score_7d = 62`, `readiness = amber`, `acute:chronic = 1.35` | Raw wearable streams, second-level HR, full sleep hypnograms, device IDs+GPS trails |
| 3 | Sparse flags: `marker=ferritin, status=below_ref, direction=falling` + question | Lab PDFs, full panels, reference ranges with identifiers, clinic names + DOB |
| 4 | **Nothing genetic to external LLM** | VCF/BAM/SNP tables, ancestry reports, disease-risk scores, raw consumer DNA exports |

Embeddings (currently OpenAI): move to **EU-resident embedding endpoint** (Mistral/Azure/Bedrock embeddings in EU) or self-hosted; do not embed Art. 9 raw text into US-default OpenAI without EU+ZDR eligibility.

### 11.4 Self-hosted requirement

| Tier | Self-hosted required? | Suggested weights |
|---|---|---|
| 1 | No | — |
| 2 | No if Mistral/Azure EU + ZDR + minimisation | Optional local for latency/privacy marketing |
| 3 | **Strongly preferred** | Mistral / Llama instruct, 70B-class if quality needs |
| 4 | **Yes — mandatory** | Same; air-gapped or private subnet; no vendor telemetry |

### 11.5 Contractual & documentation checklist

- [ ] Appoint / confirm DPO; register processing in RoPA (Art. 30)  
- [ ] Complete **DPIA** (Art. 35) covering multi-agent + each vendor; AEPD prior consultation if needed  
- [ ] Art. 6 + Art. 9(2)(a) matrix per purpose; granular consent UX (athlete/parent)  
- [ ] Minor flow: LOPDGDD Art. 7 (14+); parental for <14; verify authority  
- [ ] Art. 28 DPA executed **before** any personal data to vendor  
- [ ] SCC Module 2/3 + **TIA** for any US transfer; prefer **no transfer** (EU processing)  
- [ ] Sub-processor lists reviewed; objection process  
- [ ] Contractual **no training on customer content** + audit rights  
- [ ] Enable **ZDR** / disable content abuse logs where Art. 9 present  
- [ ] Pin **EU regions** (Azure not Global; Vertex not global endpoint; Bedrock EU)  
- [ ] Prompt policy gateway enforcing tier rules  
- [ ] Erasure runbook + vendor deletion SLAs  
- [ ] Security: encryption, key custody in EU, access logs, pen-test  
- [ ] Remove DeepSeek API keys from production; rotate secrets  
- [ ] Update privacy notice: recipients, transfers, AI profiling disclosures  
- [ ] Processor agreements with academies (who is controller vs joint?) — typically academy + platform joint or platform processor depending on packaging; document Art. 26 if joint  
- [ ] Annual vendor re-assessment (DeepSeek/China risk shows how fast posture changes)

---

## 12. Immediate migration order (engineering)

1. **Kill-switch** hosted DeepSeek for all traffic containing personal data (today).  
2. Stand up **Mistral** and/or **Azure OpenAI EU** as primary; Bedrock EU as secondary.  
3. Keep **Groq** only behind a classifier that blocks Tier 2–4; enable Groq ZDR; plan deprecation for anything but Tier 1.  
4. Move embeddings to EU.  
5. Implement feature compilers + policy gateway before re-enabling health agents.  
6. Self-host path for genetics (and preferably biomarkers) before those agents go GA.  
7. Finish DPIA + consent before marketing “AI health coach” claims in ES/EU.

---

## Source index (primary / high-value)

1. GDPR Regulation (EU) 2016/679 — https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX:32016R0679  
2. LOPDGDD (Ley Orgánica 3/2018) — https://www.boe.es/eli/es/lo/2018/12/05/3  
3. EDPB Guidelines 05/2020 on consent — https://www.edpb.europa.eu/sites/default/files/files/file1/edpb_guidelines_202005_consent_en.pdf  
4. EDPB Guidelines 07/2020 controller/processor — https://www.edpb.europa.eu/system/files/2023-10/EDPB_guidelines_202007_controllerprocessor_final_en.pdf  
5. WP29/EDPB DPIA guidelines (WP248) — https://www.edpb.europa.eu/our-work-tools/our-documents/guidelines/guidelines-dataprotection-impact-assessment-wp248-rev01_en  
6. WP29 Annex on health data in apps/devices (2015) — https://ec.europa.eu/justice/article-29/documentation/other-document/files/2015/20150205_letter_art29wp_ec_health_data_after_plenary_annex_en.pdf  
7. EDPB Opinion 28/2024 AI models — https://www.edpb.europa.eu/system/files/2024-12/edpb_opinion_202428_ai-models_en.pdf  
8. Italy Garante DeepSeek block (30 Jan 2025) — https://www.garanteprivacy.it/home/docweb/-/docweb-display/docweb/10097450  
9. Berlin BlnBDI DeepSeek DSA notice (27 Jun 2025) — https://www.datenschutz-berlin.de/pressemitteilung/berliner-datenschutzbeauftragte-meldet-ki-app-deepseek-in-deutschland-bei-apple-und-google-als-rechtswidrigen-inhalt/  
10. DeepSeek Privacy Policy — https://cdn.deepseek.com/policies/en-US/deepseek-privacy-policy.html  
11. Mistral DPA — https://legal.mistral.ai/terms/data-processing-addendum  
12. Groq Customer DPA — https://console.groq.com/docs/legal/customer-data-processing-addendum  
13. Azure OpenAI data privacy — https://learn.microsoft.com/en-us/azure/foundry/responsible-ai/openai/data-privacy  
14. OpenAI data controls / EU residency — https://developers.openai.com/api/docs/guides/your-data ; https://openai.com/index/introducing-data-residency-in-europe/  
15. Anthropic DPA / ZDR — https://privacy.claude.com/en/articles/7996862-how-do-i-view-and-sign-your-data-processing-addendum-dpa  
16. AWS Bedrock security & privacy — https://aws.amazon.com/bedrock/security-compliance/  
17. Google Vertex ZDR / residency — https://docs.cloud.google.com/vertex-ai/generative-ai/docs/vertex-ai-zero-data-retention (and related Gemini Enterprise Agent Platform docs)  
18. AEPD minors FAQ / LOPDGDD Art. 7 — https://www.aepd.es/preguntas-frecuentes/10-menores-y-educacion  
19. MIAI DeepSeek one-year regulatory survey (28 Jan 2026) — https://ai-regulation.com/deepseek-one-year-later-regulatory-storm-global-surge/  
20. Euroconsumers / OCU DeepSeek complaint timeline — https://www.euroconsumers.org/the-full-story-of-deepseek-how-euroconsumers-is-driving-action-for-consumers/

---

*End of dossier. Single output file for swarm research item 67.*
