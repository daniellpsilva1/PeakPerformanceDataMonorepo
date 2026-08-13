# 68 — Minors’ Data, AI Interaction & Safeguarding Dossier

**Research date:** 2 August 2026  
**Scope:** Legal, ethical, and safeguarding requirements for an AI multi-agent sports-performance platform (Spain-based, EU-operating) that processes junior athletes’ wearable/health/performance data, delivers AI coaching insights to athlete/coach/parent, and offers a minor-facing AI chat — including a forthcoming B2C consumer product.  
**Method:** External web research and primary-source fetch only. Not legal advice; verify with counsel before shipping.

---

## Executive snapshot (for product)

| Topic | Current status (2 Aug 2026) |
| --- | --- |
| **Spain digital consent age** | **14** under LOPDGDD Art. 7 (AEPD confirmed). Draft organic law would raise to **16** — still in parliamentary process; treat as imminent risk. |
| **GDPR Art. 8 default** | 16; Member States may set 13–16. |
| **Health data (Art. 9)** | Separate, stricter layer. Explicit consent (or other Art. 9 condition) required *in addition* to Art. 6. Parental/guardian explicit consent for under-threshold children. |
| **AI Act (Art. 5)** | Prohibition on exploiting age-related vulnerabilities in force; general application / enforcement from **2 Aug 2026**. |
| **AI chat transparency (Art. 50)** | Must inform users they are interacting with AI; Commission transparency guidelines issued July 2026. |
| **DSA Art. 28** | Platforms accessible to minors: high privacy/safety/security; Commission July 2025 guidelines specifically address AI chatbots/companions. |
| **Companion-AI enforcement** | Italian Garante fined Character.AI (€158k, mid-2026) for weak age gates, late DPIA, default-public minor profiles. |

---

## 1. GDPR Article 8 — Age of digital consent

### 1.1 Text and Member State discretion

GDPR Article 8(1) (information society services offered directly to a child, where the lawful basis is consent under Art. 6(1)(a)):

> “Where point (a) of Article 6(1) applies, in relation to the offer of information society services directly to a child, the processing of the personal data of a child shall be lawful where the child is at least **16 years old**. Where the child is below the age of 16 years, such processing shall be lawful only if and to the extent that consent is given or authorised by the holder of parental responsibility over the child. Member States may provide by law for a lower age for those purposes provided that such lower age is **not below 13 years**.”  
> — [gdpr-info.eu/art-8-gdpr](https://gdpr-info.eu/art-8-gdpr/)

Article 8(2):

> “The controller shall make **reasonable efforts** to verify in such cases that consent is given or authorised by the holder of parental responsibility over the child, taking into consideration available technology.”

Recital 38 emphasises that children “merit specific protection” especially regarding marketing, profiling, and collection of personal data when using services.

**Critical scope note:** Art. 8 applies only when (i) the service is an *information society service*, (ii) offered *directly to a child*, and (iii) the controller relies on *consent*. Other Art. 6 bases (contract, legal obligation, legitimate interest) have different analyses — but legitimate interest is widely treated as inappropriate for children’s data where the child cannot reasonably expect the processing, and contract capacity for minors is constrained by national private law.

### 1.2 Spain — LOPDGDD Article 7 (current law)

Spain set the age at **14** in Organic Law 3/2018 (LOPDGDD), Article 7. The AEPD states:

> “el tratamiento de los datos personales de un menor de edad únicamente podrá fundarse en su consentimiento cuando sea mayor de **catorce años**… El tratamiento de los datos de los menores de catorce años, fundado en el consentimiento, solo será lícito si consta el del titular de la patria potestad o tutela.”  
> — [AEPD FAQ](https://www.aepd.es/preguntas-frecuentes/10-menores-y-educacion/FAQ-1001-cual-es-la-edad-para-que-los-menores-puedan-prestar-consentimiento-para-tratar-sus-datos-personales)

AEPD infographic (same rule): under 14 → parents/tutors; 14–17 → minor may consent unless a specific norm requires parental assistance; controller must make reasonable efforts under GDPR Art. 8(2) to verify parental authorisation.  
Source: [AEPD infografía consentimiento menores](https://www.aepd.es/infografias/infografia-consentimiento-menores.pdf)

**Important Spanish nuance:** LOPDGDD Art. 7 is drafted as a general rule on consent-based processing of minors’ data (not limited to the ISS wording of GDPR Art. 8). Practically, Spanish controllers should treat **14** as the consent threshold for minors’ personal data when relying on consent.

### 1.3 Spain — pending raise to 16

*Proyecto de Ley Orgánica para la protección de las personas menores de edad en los entornos digitales* (Congreso 121/000052, presented 27 March 2025) would amend LOPDGDD to raise the age from 14 to **16**. Status as of research date: still in parliamentary processing (urgency procedure; totality debate Sept 2025). **Until enacted and in force, 14 remains the law.**  
Sources: [Congreso BOCG text](https://www.congreso.es/public_oficiales/L15/CONG/BOCG/A/BOCG-15-A-52-1.PDF); [Ministerio de Justicia announcement](https://www.mjusticia.gob.es/es/institucional/gabinete-comunicacion/noticias-ministerio/Proteccion-menores-entorno-digital).

**Product implication:** Design consent architecture for **geo-aware thresholds** and be ready to switch Spain to 16 without a rewrite. Prefer a **conservative pan-EU default of 16** for B2C self-signup, with academy-mediated (B2B) flows always requiring parental/guardian enrolment for under-18s.

### 1.4 Other main EU tennis-academy markets

Approximate Art. 8 national ages (verify before go-live; secondary compilations differ on a few states):

| Age | Member States (illustrative) |
| --- | --- |
| **13** | Belgium, Czechia, Denmark, Estonia, Finland, Latvia, Portugal, Sweden (+ UK under UK GDPR) |
| **14** | Austria, Bulgaria, Cyprus, Italy, Lithuania, **Spain** |
| **15** | France, Greece, Slovenia |
| **16** (GDPR default / no lowering) | Germany, Hungary, Ireland*, Luxembourg, Malta, Netherlands, Poland*, Romania, Slovakia, Croatia |

\*Secondary sources conflict on Ireland/Poland in places; treat **16** as safer default unless local counsel confirms otherwise. Compilations: [EuConsent](https://euconsent.eu/digital-age-of-consent-under-the-gdpr/), [sota.io 2026 developer guide](https://sota.io/blog/gdpr-art-8-childrens-consent-age-verification-parental-authorization-digital-services-developer-guide-2026).

**Pan-EU rule of thumb:** Geo-detect and apply local age **or** apply **16 everywhere**. Do not apply 13 pan-EU.

---

## 2. Article 8 × Article 9 — Minors + health / special-category data

### 2.1 Two independent layers

| Layer | What it answers |
| --- | --- |
| **Art. 6** (+ Art. 8 if consent + ISS + child) | Is there a lawful basis for processing *personal data*? |
| **Art. 9** | Is there a *specific condition* unlocking the ban on special-category data (health, genetic, biometric for unique ID, etc.)? |

Wearable HRV/sleep/recovery, blood biomarkers, injury history, and many training-load metrics that reveal health status are **data concerning health** under Art. 4(15) / Art. 9. Biometric templates used to uniquely identify a person are also Art. 9.

Art. 9(1) prohibits processing unless an Art. 9(2) condition applies. The usual commercial condition is:

> “(a) the data subject has given **explicit consent** to the processing of those personal data for one or more specified purposes, except where Union or Member State law provide that the prohibition… may not be lifted by the data subject”  
> — [GDPR Art. 9](https://eur-lex.europa.eu/legal-content/EN/TXT/HTML/?uri=CELEX%3A02016R0679-20160504)

Other Art. 9(2) conditions (e.g. preventive medicine under (h)) generally require a health-professional / care-system context that a consumer sports app does **not** satisfy.

### 2.2 Who must consent to what

For a **minor below the applicable digital-consent age**, when the service is offered as an ISS and consent is the Art. 6 basis:

1. **Art. 6(1)(a) + Art. 8:** Consent / authorisation by holder of parental responsibility (parent/guardian), verified with reasonable efforts.  
2. **Art. 9(2)(a):** **Explicit** consent for health/genetic/biometric processing — also from the parental-responsibility holder (the child cannot validly give Art. 6 consent, so cannot validly give Art. 9 explicit consent alone).  
3. **Purpose specificity:** Separate, granular consents (or clear multi-purpose checkboxes) for: wearable sync; biomarker upload; AI insight generation; coach access; parent access; research/product improvement; marketing (default off).  
4. **Above the digital-consent age but under 18:** Child may give Art. 8 / LOPDGDD consent for ordinary personal data; for **health data**, still obtain **explicit** consent from the child *and*, as a safeguarding/product rule (not always legally mandatory above the digital-consent age), **parental awareness or co-consent** for Art. 9 processing and for coach visibility. Spanish Civil Code patria potestad and “asistencia” rules can still require parental involvement for certain acts — escalate to counsel for B2C contracts with 14–17s.

### 2.3 Academy (B2B) vs B2C

| Context | Recommended lawful basis approach |
| --- | --- |
| **Academy onboarding** | Parent/guardian creates/approves athlete account; academy is typically controller or joint controller; processing necessary for performance of academy services + explicit Art. 9 consent for health data; DPIA mandatory. |
| **B2C self-signup** | Hard age-gate; under threshold → parental verified consent before any processing; never rely on “child ticked a box.” |
| **Coach as user** | Coach is not the data subject; access is a *disclosure* that must be covered in the privacy notice and consents; minimise fields; audit every access. |

Legitimate interest is a weak / inappropriate basis for children’s health profiling and AI coaching. Prefer **consent** (granular) or, where a genuine care pathway exists with licensed professionals, explore Art. 9(2)(h) with counsel — do not assume a sports academy qualifies.

---

## 3. Verifying parental consent — “reasonable efforts”

### 3.1 Legal standard

GDPR Art. 8(2) requires **reasonable efforts**, technology-aware. WP29 *Guidelines on Consent* (endorsed by EDPB) make verification **risk-proportionate**:

- Controllers must verify age with measures proportionate to processing risk; age checks must not cause *excessive* data processing.  
- If the user claims to be **below** the age of digital consent → accept that claim and obtain parental authorisation (do not “hope” they are older).  
- If the user claims to be **above** → perform appropriate checks that the claim is true.  
- Low-risk parental verification: email confirmation may suffice.  
- Higher-risk: more proof that the authoriser holds parental responsibility; example of a €0.01 bank transfer with confirmation in the description line; trusted third-party verification services.  
Sources: [WP29 Consent Guidelines summaries](https://www.twobirds.com/en/insights/2018/global/consent-article-29-working-party-issues-final-guidance); [Lexology / WP29](https://www.lexology.com/library/detail.aspx?g=fd72b350-628e-481d-bb81-bcb743b932f1).

EDPB **Statement 1/2025 on Age Assurance** (11 Feb 2025): ten principles including necessity/proportionality, data minimisation (often only “over/under threshold,” not exact age), privacy by design (prefer device-local / unlinkable selective disclosure), storage limitation / short retention of verification artefacts, accessibility, reliability, and redress. DPIA expected.  
Sources: [EDPB news](https://www.edpb.europa.eu/news/edpb-adopts-statement-on-age-assurance-creates-a-task-force-on-ai-enforcement-and-gives_en); [Statement PDF (mirror)](https://ppc.land/content/files/2025/02/edpb_statement_20250211ageassurance_en.pdf).

### 3.2 Acceptable implementations for *this* product (health + AI chat = **high risk**)

Email-only double opt-in is **not enough** for wearable health + AI coaching + minor chat. Recommended stack:

1. **Declared age + date of birth** at signup (store DOB for tiering; minimise reuse).  
2. **Hard block** under local threshold until parental flow completes.  
3. **Parent account identity:** government eID / EUDI wallet / bank-ID / credit-card micro-auth / video KYC via a privacy-preserving third party — prefer providers that return only “is parent / is over 18” attestations (aligns with EDPB minimisation).  
4. **Parental responsibility attestation:** signed electronic declaration + ability to challenge (two-parent conflict → pause processing).  
5. **Cooling-off / re-block** after failed minor registrations (Character.AI enforcement theme).  
6. **Re-consent** when the child reaches the digital-consent age (WP29: parental consent expires; obtain fresh consent from the young person) and again at 18.  
7. **Retain proof of consent** (who, when, what purposes, version of notice, verification method) for accountability (Art. 5(2), Art. 7(1)).

AEPD echoes GDPR Art. 8(2) on reasonable efforts for under-14s: [infografía](https://www.aepd.es/infografias/infografia-consentimiento-menores.pdf).

---

## 4. EDPB / DPA guidance & UK Children’s Code

### 4.1 EDPB / AEPD highlights

- Children’s data → specific protection; DPIA for high-risk processing (health + systematic monitoring + vulnerable subjects — Art. 35 criteria clearly met).  
- Age assurance: Statement 1/2025 (above).  
- Feb 2025 EDPB plenary also created an **AI enforcement taskforce**.  
- AEPD: Canal Menores; consent FAQ and infographics cited above.

### 4.2 UK Age Appropriate Design Code (Children’s Code) — 15 standards

Statutory ICO code for ISS likely accessed by under-18s in the UK. Not binding in the EU, but the **most operational design standard** available and widely used as a reference.  
Primary: [ICO Age appropriate design code](https://ico.org.uk/for-organisations/uk-gdpr-guidance-and-resources/childrens-information/childrens-code-guidance-and-resources/age-appropriate-design-a-code-of-practice-for-online-services/).

| # | Standard | Meaning for our product |
| --- | --- | --- |
| 1 | **Best interests of the child** | Design choices (defaults, AI tone, coach visibility, retention) must put the child’s welfare ahead of engagement, upsell, or academy convenience. |
| 2 | **DPIA** | Child-specific DPIA before launch of chat, wearable sync, biomarker modules, coach dashboards for minors. |
| 3 | **Age-appropriate application** | Effective age assurance proportionate to risk; if uncertain, apply child protections to **all** users. |
| 4 | **Transparency** | Child-readable notices; layered “why we need this” for wearables/AI; parent-facing full notices. |
| 5 | **Detrimental use of data** | No use that is detrimental to children’s health/wellbeing — includes body-shaming insights, overtraining pressure, addictive chat loops. |
| 6 | **Policies & community standards** | Enforceable acceptable-use for AI chat; published escalation/safeguarding policy. |
| 7 | **Default settings** | High privacy by default: private profiles; coach share off until parent opts in; marketing off; public/social off. |
| 8 | **Data minimisation** | Collect only fields needed for the athletic purpose; no speculative “nice to have” biometrics. |
| 9 | **Data sharing** | Do not share with third parties (ads, brokers, unrelated AI trainers) without compelling, disclosed reason + consent. |
| 10 | **Geolocation** | Off by default; obvious when on (GPS for tournament travel is optional, not silent). |
| 11 | **Parental controls** | Transparent monitoring: child knows what parents/coaches can see; controls mature with age. |
| 12 | **Profiling** | Off by default unless necessary and explained; avoid solely automated decisions with significant effects (Recital 71). |
| 13 | **Nudge techniques** | No dark patterns to extend chat, weaken privacy, or push biomarker upsells to kids. |
| 14 | **Connected toys & devices** | Wearables = connected devices: secure pairing, parent-mediated link for young children, clear data flows. |
| 15 | **Online tools** | Easy exercise of rights (access, erase, restrict) for child and parent; prominent “delete my data” path. |

ICO foreword framing: settings “high privacy” by default; minimise collection; do not usually share children’s data; geolocation off by default; no nudges to weaken privacy.

---

## 5. EU AI Act — minors

### 5.1 Prohibition — exploiting age vulnerabilities (Art. 5(1)(b))

In force since **2 February 2025**; broader AI Act application/enforcement from **2 August 2026**.

> Prohibited: “an AI system that exploits any of the vulnerabilities of a natural person or a specific group of persons due to their **age**, disability or a specific social or economic situation, with the objective, or the effect, of materially distorting the behaviour of that person… in a manner that causes or is reasonably likely to cause… **significant harm**.”  
> — [AI Act Service Desk — Art. 5](https://ai-act-service-desk.ec.europa.eu/en/ai-act/article-5)

Commission guidelines (July 2025) emphasise children are particularly susceptible to manipulation; intention is **not** required — **effect** suffices. “Significant harm” includes physical or psychological health impacts.  
Analysis: [FPF on Art. 5 red lines](https://fpf.org/blog/red-lines-under-the-eu-ai-act-understanding-manipulative-techniques-and-the-exploitation-of-vulnerabilities/).

**Product risk mapping:** An AI coach that uses a child’s dependency, fear of coach disapproval, or body insecurity to push more training, restrict food, or keep them in chat could engage Art. 5(1)(b) and/or Art. 5(1)(a) (manipulative techniques). Design must avoid parasocial bonding, guilt loops, and “secret from parents” dynamics.

### 5.2 Transparency (Art. 50)

Providers of AI systems interacting directly with natural persons must ensure persons are informed they are interacting with AI (unless obvious). Commission FAQ / July 2026 transparency guidelines: notify at/before first interaction; clear, distinguishable, accessible; purpose includes avoiding over-reliance.  
Sources: [Commission Art. 50 FAQ](https://digital-strategy.ec.europa.eu/en/faqs/transparency-obligations-under-article-50-ai-act); [Guidelines C(2026) 5054](https://ai-act-service-desk.ec.europa.eu/sites/default/files/2026-07/guidelines_on_the_implementation_of_the_transparency_obligations_for_certain_ai_systems_under_article_50_of_the_ai_act_bzptwqhk0ikg1dtlddap41psfy_131215.pdf).

For minors: persistent, child-friendly “This is AI, not a person / not your coach / not a doctor” labelling throughout the session (DSA guidelines reinforce persistence).

### 5.3 High-risk / fundamental rights

Recital 48 AI Act highlights children’s rights (Charter Art. 24; UNCRC / General Comment 25). Systems used in education or that assess persons may fall under Annex III high-risk categories depending on use — get a formal classification opinion for: AI-driven athlete selection/ranking, readiness scores used to exclude from play, or health-risk scoring. Even if not high-risk, treat minor-facing health AI as **high residual risk** in internal governance.

---

## 6. Digital Services Act & 2025–2026 minors/AI initiatives

### 6.1 DSA Article 28

> “Providers of online platforms accessible to minors shall put in place appropriate and proportionate measures to ensure a high level of privacy, safety, and security of minors, on their service.”  
> Profiling-based ads to known minors are banned. Compliance does **not** require collecting extra personal data solely to discover age.  
> — [DSA Art. 28](https://www.eu-digital-services-act.com/Digital_Services_Act_Article_28.html)

**Applicability:** Full DSA “online platform” status depends on hosting user-generated content and intermediary role. A closed academy SaaS may not be a classic UGC platform; a **B2C product with chat, profiles, or social features** more readily engages Art. 28. Regardless, the Commission’s minors guidelines are the emerging **design baseline** for any minor-accessible AI service.

### 6.2 Commission Guidelines on protection of minors (July 2025) — AI companions/chatbots

EUR-Lex Communication pursuant to Art. 28(4) DSA ([52025XC05519](https://eur-lex.europa.eu/eli/C/2025/5519/oj)) explicitly flags AI chatbots/companions and deepfakes as new risk vectors. Expected measures include:

- AI features **not activated by default**; minors not encouraged/enticed to use them.  
- Prior **risk assessment** before deploying AI tools to minors.  
- **Persistent, child-friendly warnings** that the user is interacting with AI.  
- No use of AI to nudge minors toward commercial content or spending.  
- Technical safeguards against harmful content generation; AI support must **not replace human support** as the main mechanism.  
Summaries: [Freshfields DSA decoded](https://www.freshfields.com/en/our-thinking/blogs/technology-quotient/dsa-decoded-6-the-european-commission-finalises-guidelines-on-the-protection-of-102kv4s); [5Rights analysis](https://5rightsfoundation.com/wp-content/uploads/2025/08/Analysis-of-the-Guidelines-to-Article-28.1-of-the-Digital-Services-Act-PDF.pdf).

### 6.3 Broader 2026 political direction

- European Parliament Nov 2025 non-legislative report on minors online: calls for a **harmonised European digital age limit of 16** as default for platforms including AI companions; stresses enforcement of the AI Act; considers prohibiting human-like features that nudge purchases.  
- Commission age-verification app / recommendation (April 2026) toward EU-harmonised privacy-preserving age assurance.  
- Spain draft law (raise consent to 16; parental controls by default on devices).  
Secondary synthesis: EPRS briefing on AI companions (2026) — cited across press; PDF fetch intermittently unavailable.

---

## 7. AI chatbots / companions interacting with minors — regulatory posture

### 7.1 What regulators are punishing

**Italian Garante vs Character.AI (2026):** €158,000 fine; findings included inadequate transparency, late DPIA, late EU representative, **non-functional age gate** (tester aged 15 could register), and **default public profiles** for minors. Prescribed: working age verification, cooling-off after blocked minor registrations, default private profiles.  
Sources: [Garante press release](https://www.garanteprivacy.it/home/docweb/-/docweb-display/docweb/10269594); [The DPO case note](https://thedpo.eu/en/decisions/6ba14a3b-01b0-4e49-9ad0-22f32013919d).

Theme: adequacy = **effectiveness**. Paper policies fail.

### 7.2 Emerging design standards (composite)

1. Working age assurance + cooling-off.  
2. Default private / high-privacy.  
3. Persistent AI disclosure (not human-like companion persona for under-16s).  
4. Opt-in AI chat (not default-on).  
5. No emotional dependency design (pet names, “I miss you,” secret confiding).  
6. Crisis detection → escalate to humans / helplines; AI must not counsel self-harm or ED behaviours.  
7. Session limits / friction against endless use.  
8. Parent visibility into *existence* of chat use (and for younger tiers, content summary) without creating covert surveillance that destroys trust — balance per Children’s Code Standard 11.  
9. DPIA before launch; log safety interventions.

OpenAI “Teen Safety Blueprint” and similar industry roadmaps illustrate market movement toward automatic under-18 protections when age is estimated — useful as floor, not ceiling for a health sports product.

---

## 8. Safeguarding in sport — data on young athletes

### 8.1 ITF / IOC framing

ITF Safeguarding policies (Children 2025; Children & Adults 2026) commit to UNICEF CRC principles; define wide “covered persons” including coaches, medical staff, and anyone supporting a player. Data-protection section incorporates the UK “7 Golden Rules” of information sharing: DP law is not a barrier to *justified* safeguarding sharing, but sharing must be necessary, proportionate, secure, recorded, and preferably with openness to the family.  
Sources: [ITF Safeguarding Children Policy Jan 2025](https://www.itftennis.com/media/13726/itf-safeguarding-children-policy-jan-2025.pdf); [ITF Safeguarding Policy 2026](https://www.itftennis.com/media/15581/itf-safeguarding-policy-2026.pdf).

IOC Framework for Safeguarding Athletes from Harassment and Abuse sits alongside federation policies for Games contexts.

### 8.2 AI specifically in youth sport

UK Child Protection in Sport Unit (Feb 2026): AI using children’s movement, DOB, wearables needs strong governance; follow UK GDPR, ICO, Children’s Code; **biometric data needs tougher governance**; DPIA for bias/unfair assumptions; supplier due diligence on storage, bias testing, training data. Risks: privacy breaches, inaccurate predictions, bias, unsafe digital communication.  
Source: [CPSU — Using AI responsibly in youth sport](https://thecpsu.org.uk/news-and-blogs/2026-02-using-ai-responsibly-in-youth-sport/).

### 8.3 Coach biometric surveillance risk

A coach with continuous HRV, sleep, location, menstrual proxies, weight trends, and AI “attitude/readiness” scores over a child creates:

- **Power asymmetry** and potential for coercion (“your readiness is low — you will not play / you must lose weight”).  
- **Safeguarding risk:** intimate physiological data in adult hands without clinical need.  
- **Abuse-facilitation risk:** private digital channel + deep personal data.  

**Control design:** need-to-know dashboards; no raw bedroom-level sleep stages for coaches of under-16s; no weight/body-fat for coaches of under-18s by default; parent-visible audit of who viewed what; dual-control for sensitive modules; ban AI “character” or psychological profiling of minors for coaches.

---

## 9. Ethical risks — AI feedback on body, recovery, weight, “ceiling”

### 9.1 IOC REDs consensus (2023)

IOC Relative Energy Deficiency in Sport (REDs) consensus:

> “Body composition assessment is recommended **only for medical purposes under 18 years of age**… Exceptional circumstances… warrant careful consideration and consensus among the athletes’ health and performance team and require **guardian consent**.”  
> Body composition data “are considered **health data** and must be kept confidential… each… assessment… requires athlete informed consent and should only be shared with those the athlete authorises.”  
> — [BJSM IOC REDs consensus](https://doi.org/10.1136/bjsports-2023-106994); [Olympics PDF](https://stillmed.olympics.com/media/Documents/Athletes/Medical-Scientific/Consensus-Statements/REDs/BJSM-IOC-consensus-statement-on-Relative-Energy-Deficiency-in-Sport-REDs.pdf)

Prevention subgroup: “**No assessment of body weight and composition unless for medical purposes for athletes <18 years old**”; reduce fat-shaming and ideal-body internalisation; involve multidisciplinary teams.  
Source: [BJSM REDs prevention](https://doi.org/10.1136/bjsports-2023-106932).

### 9.2 Product ethics consequences

AI that tells a 12-year-old “you are under-recovered / your weight trend is suboptimal / you have a low performance ceiling” can:

- Trigger disordered eating and REDs pathways.  
- Internalise coach/parent pressure via a seemingly “objective” machine.  
- Constitute detrimental use of data (Children’s Code Standard 5) and Art. 5 AI Act risk if it distorts training/diet behaviour toward harm.

**Rule:** For under-18s, AI must not discuss weight, body fat, leanness, calorie targets, or performance “ceilings.” Recovery messaging must be non-pathologising, encourage rest and adult help, and never prescribe dietary restriction.

---

## 10. Retention & right to erasure (childhood data)

GDPR Recital 65:

> “That right [to erasure] is relevant in particular where the data subject has given his or her consent **as a child** and is not fully aware of the risks involved by the processing, and later wants to remove such personal data, especially on the internet. The data subject should be able to exercise that right **notwithstanding the fact that he or she is no longer a child**.”  
> — [Recital 65](https://gdpr-info.eu/recitals/no-65/)

ICO guidance: give **particular weight** to erasure of data collected from children; the young person (now adult) can request erasure even if a parent originally consented; resolve parent/child conflicts case-by-case in the child’s best interests.  
Sources: [ICO — right to erasure & children](https://ico.org.uk/for-organisations/uk-gdpr-guidance-and-resources/childrens-information/children-and-the-uk-gdpr/how-does-the-right-to-erasure-apply-to-children/).

**Product requirements:**

- Short default retention for chat logs of minors (e.g. 90 days unless safeguarding hold).  
- Athlete-initiated “erase my childhood performance/health archive” flow at/after 16 and at 18.  
- Do not retain biometric/biomarker history “forever for AI training.”  
- Document legal holds separately from product analytics.

---

## 11. Concrete design requirements for Peak Performance

### 11.1 Consent & account model

```
Account types
├── Guardian (verified adult)
├── Athlete-minor (linked; cannot exist without guardian until local digital-consent age)
├── Athlete-youth (14/15–17 depending on jurisdiction — own ordinary consent + parental co-consent for Art.9 & coach share)
├── Athlete-adult (18+)
├── Coach (role-scoped; academy-bound)
└── Academy admin
```

**Who consents to what**

| Processing | Under digital-consent age | At/above digital-consent age & <18 | 18+ |
| --- | --- | --- | --- |
| Account & basic performance stats | Guardian | Athlete (+ guardian notify) | Athlete |
| Wearables / health metrics (Art. 9) | Guardian **explicit** | Athlete **explicit** + guardian co-consent (product rule) | Athlete explicit |
| Biomarkers | Guardian explicit + clinical context flag | Same + medical professional gate | Athlete + clinician gate |
| Coach visibility of health | Guardian opt-in per category | Dual: athlete + guardian | Athlete |
| AI insights (non-chat) | Guardian | Athlete + guardian awareness | Athlete |
| AI chat | Guardian opt-in; defaults OFF under 16 | Athlete opt-in + guardian awareness | Athlete |
| Marketing / product analytics beyond necessary | OFF | OFF by default | Athlete |

**Capture & proof**

- Timestamped, purpose-tagged consent records; notice version hash; verification method ID.  
- Separate toggles (not bundled).  
- Withdrawal as easy as grant; withdrawing Art. 9 health consent disables wearables/AI health features immediately.

**Age transitions**

- On reaching local digital-consent age: re-consent banner; parental Art. 8 consent no longer sufficient alone; preserve guardian link for safeguarding until 18.  
- At 18: full control; offer archive download + selective erasure; detach guardian access unless athlete re-grants.  
- Birthday jobs must be reliable (timezone-aware).

**B2C vs academy**

- B2C: no under-threshold signup without completed parental verification.  
- Academy: roster import still requires guardian digital acceptance before health modules activate.

### 11.2 Age-tiered feature gating

Assume **Spain-current 14** for local ISS consent, but ship **product safety tiers** that are stricter than bare GDPR consent age because of Art. 9 + AI + sport ethics. Prefer implementing the table below globally.

#### Under-13 (and all under local digital-consent age)

| Allowed | Forbidden / blocked |
| --- | --- |
| Parent-managed account; simple match/training diary entered by coach/parent | Self-serve B2C signup |
| Aggregate training attendance, basic match scores | AI chat (default); if ever enabled, parent-initiated only, tightly scoped FAQ-style, no free-form companion |
| Wearables only with guardian explicit consent + high minimisation (resting HR, sleep *duration*, steps — not full raw streams to coach) | Biomarkers; body composition; weight goals |
| Parent-facing readiness “green/amber” without clinical diagnosis language | AI statements about body, weight, talent ceiling, “you must push harder” |
| Human coach notes with parent CC on sensitive topics | Profiling for ads; public profiles; social feed; streaks that punish rest |

#### 13–15

| Allowed | Forbidden / blocked |
| --- | --- |
| Limited athlete login; child-readable UI | Companion-style AI persona; romantic/friendly parasocial tone |
| Opt-in AI **insights** (cards) after dual consent; always labelled AI; “show parent” default on | Free-form AI chat about diet, weight, self-harm, sexuality, coach conflicts without escalation |
| Opt-in AI chat with session limits, topic allow-list (technique, schedule, rules of tennis), persistent AI badge | Biomarker interpretation by AI; REDs/weight commentary |
| Coach sees performance + training load summaries; health details only if parent enabled | Coach seeing sleep location, menstrual data, raw HRV dumps by default |

#### 16–17

| Allowed | Forbidden / blocked |
| --- | --- |
| Broader AI chat on tennis performance with same safety classifiers | Medical diagnosis; meal plans for weight cut; “your genetic ceiling” |
| Athlete can consent to ordinary data; co-consent still required for Art. 9 modules and coach health share (product rule) | Solely automated selection/exclusion from squads based on AI readiness |
| Request erasure of childhood content | Sharing health data with sponsors/third parties |

**If Spain raises consent age to 16:** treat 14–15 like under-threshold for consent-gated ISS features (parental authorisation required) while keeping the safety gating above.

### 11.3 What coaches may see vs parental awareness

| Data class | Coach default (minor) | Requires parental awareness / opt-in |
| --- | --- | --- |
| Match scores, schedule, technical notes | Yes | Notice at onboarding |
| Training attendance / RPE entered by athlete | Yes | Notice |
| Wearable training load (session strain) | Summary only | Opt-in for detail |
| Sleep duration / readiness traffic-light | Summary if opted in | Opt-in; raw hypnogram **no** for under-16 |
| HRV / resting HR trends | Opt-in | Opt-in |
| Weight / body composition / photos | **Never for under-18** (except licensed medical role with separate pathway) | N/A — withhold |
| Blood biomarkers | **Never for coach** unless clinician role + dual consent | Always |
| AI chat transcripts | **No** (safeguarding team only on escalate) | Parent may receive *usage* summary for under-16 |
| Location / GPS | Off | Explicit opt-in |

Parents of under-16s should receive a monthly access report: which coaches viewed health modules.

### 11.4 Chat safety requirements (minor-facing AI)

**Identity & framing**

- Persistent disclosure: “I am an AI assistant for tennis training, not a person, not a doctor, not a therapist.”  
- No human-like emotional bonding; no “keep this secret from your parents/coach.”  
- Opt-in; off by default under 16.

**Hard refusals (block + log)**

- Sexual content; grooming patterns; meeting strangers.  
- Instructions for self-harm, suicide, violence.  
- Disordered-eating advice, calorie deficits, laxatives, “how to lose weight fast.”  
- Performance-enhancing drugs / unsafe supplementation for minors.  
- Attacks on protected characteristics; bullying assistance.

**Escalate to human / helpline (do not continue DIY counselling)**

- Self-harm / suicide ideation → crisis resources (local e.g. Teléfono de la Esperanza / EU-appropriate) + notify designated safeguarding contact / parent per policy (with careful handling if abuse by parent is alleged — follow ITF-style safeguarding, not auto-email abuser).  
- Eating-disorder signals → encourage parent + sports medicine / mental health professional; disable weight-related tools.  
- Abuse / harassment by coach or adult → safeguarding officer pathway; preserve logs.  
- Medical emergency language → call emergency services messaging.

**Session & product limits**

- Daily time cap and nightly quiet hours for under-16.  
- Rate-limit long emotional venting; offer “talk to a person” CTA.  
- Classifier on inputs/outputs; human review queue for flagged sessions.  
- No push notifications designed for engagement addiction.

### 11.5 Logging & auditability (must retain)

Retain for accountability / safeguarding (separate from product analytics; access-controlled):

1. Consent & verification events (who, method, purposes, notice version).  
2. Age-tier changes and re-consent.  
3. Art. 9 module enable/disable.  
4. Coach/parent access to sensitive fields (viewer, field class, timestamp).  
5. AI chat safety events: refused topics, escalations, model version, prompt-policy version.  
6. DPIA version linked to feature flags.  
7. Model/prompt versions used for insights delivered to minors.  
8. Erasure requests and fulfilment.

Do **not** use minor chat content for model training.

### 11.6 Features we should NOT ship to minors

1. **AI companion / friend persona** (parasocial, loneliness fill-in).  
2. **Body-composition, weight tracking, “ideal weight,” calorie or cut plans** for under-18 (IOC REDs).  
3. **Blood-biomarker AI interpretation** without a licensed clinician in the loop.  
4. **Talent/ceiling/genetic potential scores** for under-18.  
5. **Squad selection or playing-time decisions** made solely by automated readiness AI.  
6. **Public social profiles, feeds, or leaderboards that expose health data.**  
7. **Ad targeting / sale of minor data / third-party tracking pixels** on minor surfaces.  
8. **Coach omniscient biometric surveillance** (continuous bedroom-level physiology).  
9. **Secret chat** modes that hide existence of AI use from parents of under-16s.  
10. **Streak / punishment gamification** that discourages rest or reporting injury.  
11. **Emotion recognition** on faces/voice of children (AI Act high-risk / prohibited contexts nearby — avoid entirely for minors).  
12. **Open-ended mental-health therapy bots.**

---

## 12. Implementation checklist (near-term)

1. Commission external counsel memo: Spain LOPDGDD Art. 7 + pending 16; Art. 9 for wearables; joint controllership with academies; DSA applicability of B2C.  
2. Child-focused DPIA + AI Act risk assessment (Art. 5 / Art. 50 / possible Annex III).  
3. Build guardian verification + consent ledger before any B2C minor launch.  
4. Age-tier policy engine (country × DOB × feature flags).  
5. Red-team the minor chat for ED / self-harm / grooming.  
6. Align coach dashboards to §11.3 minimisation.  
7. Publish parent-facing safeguarding & AI transparency pages (child-readable summary too).  
8. Monitor Spanish organic law and EU age-assurance recommendation for hard cutovers.

---

## 13. Source index (primary & key secondary)

| Source | URL |
| --- | --- |
| GDPR Art. 8 | https://gdpr-info.eu/art-8-gdpr/ |
| GDPR consolidated text | https://eur-lex.europa.eu/legal-content/EN/TXT/HTML/?uri=CELEX%3A02016R0679-20160504 |
| GDPR Recital 65 | https://gdpr-info.eu/recitals/no-65/ |
| LOPDGDD (BOE) | https://www.boe.es/buscar/act.php?id=BOE-A-2018-16673 |
| AEPD consent age FAQ | https://www.aepd.es/preguntas-frecuentes/10-menores-y-educacion/FAQ-1001-cual-es-la-edad-para-que-los-menores-puedan-prestar-consentimiento-para-tratar-sus-datos-personales |
| AEPD minors consent infographic | https://www.aepd.es/infografias/infografia-consentimiento-menores.pdf |
| Spain draft law BOCG | https://www.congreso.es/public_oficiales/L15/CONG/BOCG/A/BOCG-15-A-52-1.PDF |
| EuConsent age map | https://euconsent.eu/digital-age-of-consent-under-the-gdpr/ |
| EDPB age assurance statement (news) | https://www.edpb.europa.eu/news/edpb-adopts-statement-on-age-assurance-creates-a-task-force-on-ai-enforcement-and-gives_en |
| EDPB Statement 1/2025 PDF (mirror) | https://ppc.land/content/files/2025/02/edpb_statement_20250211ageassurance_en.pdf |
| ICO Children’s Code | https://ico.org.uk/for-organisations/uk-gdpr-guidance-and-resources/childrens-information/childrens-code-guidance-and-resources/age-appropriate-design-a-code-of-practice-for-online-services/ |
| ICO erasure & children | https://ico.org.uk/for-organisations/uk-gdpr-guidance-and-resources/childrens-information/children-and-the-uk-gdpr/how-does-the-right-to-erasure-apply-to-children/ |
| AI Act Art. 5 | https://ai-act-service-desk.ec.europa.eu/en/ai-act/article-5 |
| AI Act enforcement timeline | https://digital-strategy.ec.europa.eu/en/policies/enforcement-ai-act |
| AI Act Art. 50 FAQ | https://digital-strategy.ec.europa.eu/en/faqs/transparency-obligations-under-article-50-ai-act |
| DSA Art. 28 | https://www.eu-digital-services-act.com/Digital_Services_Act_Article_28.html |
| Commission minors guidelines (DSA) | https://eur-lex.europa.eu/eli/C/2025/5519/oj |
| Garante Character.AI | https://www.garanteprivacy.it/home/docweb/-/docweb-display/docweb/10269594 |
| ITF Safeguarding Children 2025 | https://www.itftennis.com/media/13726/itf-safeguarding-children-policy-jan-2025.pdf |
| ITF Safeguarding 2026 | https://www.itftennis.com/media/15581/itf-safeguarding-policy-2026.pdf |
| CPSU AI in youth sport | https://thecpsu.org.uk/news-and-blogs/2026-02-using-ai-responsibly-in-youth-sport/ |
| IOC REDs consensus (BJSM) | https://doi.org/10.1136/bjsports-2023-106994 |
| IOC REDs body composition | https://bjsm.bmj.com/content/57/17/1148 |

---

*End of dossier. Update when Spain’s organic law is enacted or when EU harmonised age-assurance tools become mandatory for your service category.*
