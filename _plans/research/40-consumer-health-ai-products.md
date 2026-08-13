# Consumer Health / Fitness AI Coaching Products — Research Dossier

**Research date:** August 2, 2026  
**Scope:** Shipped consumer health-AI products and closest B2B athlete-management analogues. Prioritizes 2025–2026 primary sources (official blogs, press, support docs, legal terms).  
**Method:** Web search + fetch of official product pages, engineering/product blogs, press releases, and credible trade coverage. No local codebase exploration.

---

## Executive takeaway (for Peak Performance Data)

Shipped leaders treat **proactive, data-grounded surfaces** (Today/home cards, Daily Outlook, activity summaries, risk dashboards, Next Best Actions) as the primary coach—and treat **chat as a secondary “ask why / dig deeper” affordance**, not the home screen. Pure chat-first coaching is rare as the *only* surface; Google Health Coach is the closest to chat-centric, but still anchors the experience in a redesigned **Today tab of proactive insights** with “Ask Coach” as escape hatch.

For dual B2B/B2C: consumer products optimize for solo agency + wellness disclaimers; B2B analogues (Zone7, Orreco, Kitman, Teamworks) ship **staff decision-support dashboards** with humans firmly in the loop—rarely athlete-facing conversational coaches.

---

## 1. Google Health Coach (Gemini / formerly Fitbit Personal Health Coach)

### Status (2026)
- Public Preview through 2025; **exits preview May 19, 2026**, full rollout by May 26, 2026 alongside Fitbit Air.
- Fitbit app **rebrands to Google Health**; Premium becomes **Google Health Premium**.
- First for eligible Fitbit / Pixel Watch users; other devices “coming soon.” 18+ in select markets (30+ countries for Premium bundling with Google AI Pro/Ultra).

### What the AI actually does
- Acts as fitness coach + sleep expert + health/wellness advisor grounded in Gemini.
- Onboarding conversation captures goals, routine, equipment, injuries, lifestyle.
- Produces **adaptive weekly fitness plans** with daily suggestions from readiness, progress, weather.
- Connects dots across fitness/sleep, nutrition, cycle tracking, environment, and (US) medical records.
- Multimodal logging: voice, photos (meals, gym whiteboards), documents/PDFs.
- Summarizes personal medical records in Health tab; redesigned Cycle / Nutrition / Mental Wellbeing for coach context.
- Sleep upgrades: ~15% sleep-stage accuracy improvement; nap detection from ~20 min; transparent Sleep Score breakdown.

### Interaction model
- **Primary:** Redesigned **Today tab** = home for *proactive* insights and nudges.
- **Secondary:** “Ask Coach” for 24/7 conversational Q&A; quick-reply chips.
- Intelligence also embedded in Fitness (Weekly Plan), Sleep, and Health tabs—not a standalone chatbot app.

### Architecture / how Google says it works
- Gemini models + “novel health research” + established wellness principles.
- **SHARP** evaluation framework: Safety, Helpfulness, Accuracy, Relevance, Personalization.
- Consumer Health Advisory Panel + in-house clinicians/sports scientists.
- Collaboration with Stephen Curry / Performance Advisor team on goal setting and recovery framing.
- Explicit: *“Not intended for medical purposes… Check responses for accuracy.”*

### Memory & personalization
- Goal/context updates via conversation; coach adapts immediately.
- Richer context = better coaching (wearable + optional medical records + lifestyle).
- Preview scale: Google cites 500k+ preview users and 1M+ feedback items (trade coverage).

### Human in the loop
- Advisory clinicians shape product/eval; **no clinician in the user’s daily loop**.
- Optional medical-record sync (US) is user-mediated, not care delivery.

### Pricing / packaging
- **Google Health Premium:** $9.99/mo or $99/yr (some listings $99.99/yr).
- Included at no extra cost with **Google AI Pro / Ultra** in 30+ countries.
- Bundled with Premium benefits (workout library, mindfulness, proactive insights).

### Disclaimer language (quoted)
> “Not intended for medical purposes. Gemini features work independently of Gemini apps. Check responses for accuracy; results may vary.”  
> — Google Health Coach blog footnotes (May 7, 2026)

### Sources
- https://blog.google/products-and-platforms/products/google-health/google-health-coach/
- https://store.google.com/product/google_health_premium?hl=en-US
- https://techcrunch.com/2026/05/07/googles-9-99-per-month-ai-health-coach-launches-may-19/
- https://9to5google.com/2026/05/07/google-health-app-fitbit/
- https://www.androidauthority.com/google-health-app-coach-rebrand-3664205/

---

## 2. WHOOP Coach + WHOOP Advanced Labs

### What the AI actually does
**WHOOP Coach**
- Generative AI coaching that interprets continuous strain, recovery, sleep, and related biometrics.
- Surfaces guidance via **Daily Outlook** (morning) and **Day in Review** (evening)—plan → perform → reflect loop.
- Answers questions in plain language; remembers goals/routines members share.
- Privacy docs: Coach combines WHOOP metrics with WHOOP science; LLM partner under **zero-retention / zero-training** on member metrics.

**Advanced Labs (launched Sept 30, 2025, US)**
- Upload existing bloodwork (no extra cost with membership) **or** book curated Quest panels (~65 biomarkers).
- Clinician-reviewed results + action plan that integrates into **Weekly Plan / Journal**.
- Coach connects biomarkers (e.g., cortisol, HOMA-IR, ApoB) to continuous signals (HRV, sleep consistency) and daily behaviors.
- Eight framing areas: metabolism, hormones, fitness, nutrients, inflammation, cardiovascular, sleep, cognition.
- Progress tracking across retests; ties into **Healthspan** narrative.

### Architecture hints
- Proprietary algorithms + custom ML + third-party LLMs (OpenAI models cited in Advanced Labs podcast coverage).
- Job postings: **Foundation AI** team building multimodal models over wearables, language, biomarkers, clinical info, self-report.
- Advanced Labs = closed loop: lab → clinician context → Coach → wearable behaviors → retest.

### Proactive vs reactive
- **Strongly proactive primary surface:** Daily Outlook / Day in Review / Weekly Plan.
- Chat/Coach Q&A is reactive deepen-and-explain on top of those briefs.
- Labs add periodic human clinician review; AI then operationalizes day-to-day.

### Interaction model
- Embedded coaching in existing WHOOP rhythms (recovery/strain/sleep), not a separate chat app.
- Labs results live in-app beside continuous data—not a PDF dead-end.

### Memory & personalization
- Goals, journal behaviors, weekly plan adherence, lab history, Healthspan contributors.
- Biomarker context persists into ongoing Coach guidance after upload/purchase.

### Human in the loop
- **Yes for purchased Advanced Labs:** independent clinician review + personalized recommendations.
- Upload path: Coach context without full clinician package (per product marketing).
- Daily coaching remains AI; clinicians are episodic (labs), not chat coaches.

### Pricing / packaging
- Membership tiers (indicative, join.whoop.com): ~$199/yr base; Peak ~$239/yr; Life ~$359/yr (AI coaching framed as membership capability).
- Advanced Labs add-on (press): **1 test $199 / 2× $349 / 4× $599** per year; US-only; age/pregnancy/state restrictions.

### Disclaimer language (quoted)
> “WHOOP Services are not medical advice and, except as otherwise indicated, WHOOP Services and the WHOOP Device are not a medical device… All Content available through the Services is for general fitness and informational purposes only… [Services] do not provide medical advice and are not intended to be a substitute for (i) advice from your doctor… or (ii) a visit, call, or consultation with your doctor…”  
> — WHOOP Terms of Use, §10 NO MEDICAL ADVICE

> “WHOOP Coach is a generative AI feature that is intended to help you set and make progress toward your goals, understand WHOOP concepts, provide educational guidance…”  
> — WHOOP Full Privacy Policy (Coach section)

Feature-level: Healthspan “for wellness purposes only and not for medical use”; Women’s Hormonal Insights “not a medical device and cannot diagnose…”

### Sources
- https://www.whoop.com/us/en/thelocker/new-ai-guidance-from-whoop/
- https://www.whoop.com/us/en/thelocker/whoop-advanced-labs/
- https://www.whoop.com/us/en/thelocker/podcast-344-introducing-the-all-new-whoop-advanced-labs/
- https://www.whoop.com/us/en/press-center/whoop-launches-clinician-reviewed-advanced-labs/
- https://www.whoop.com/us/en/whoop-terms-of-use/
- https://www.whoop.com/us/en/full-privacy-policy/
- https://www.whoop.com/us/en/membership/
- https://jobs.lever.co/whoop/e8b2f0e0-cc8c-462f-83b1-0537f4798aaa

---

## 3. Oura Advisor

### What the AI actually does
- LLM assistant grounded in member Sleep, Activity, Readiness, Resilience (and stress) data.
- Explains dips/trends; creates action plans (sleep, sedentary time, resilience).
- In-chat **data visualizations / long-term charts** (top Labs request).
- **Topic generation** prompts for discovery when users don’t know what to ask.
- **April 2026:** proprietary **women’s health LLM** inside Advisor—cycle, hormones, pregnancy, menopause topics auto-route to clinically curated model; other topics use general Advisor.
- Tone: “conversational” vs “direct”; configurable **check-in notification** frequency.

### Interaction model
- Chat-capable, but **entry points are embedded**: Today “+” menu, Readiness insight messages, topic chips.
- Check-ins = light proactive layer; not as aggressive as WHOOP Daily Outlook or Google Today.
- Conversation history shipping (App 7.17.0, June 2026).

### Memory model
- Explicit **Memories**: goals, preferences, life context (e.g., “recovering from knee surgery”) stored and used across domains.
- User-visible Memories list: view / delete individually; full **Reset Advisor** wipes memories + settings.
- BusinessWire (Mar 2025 launch): 87% of surveyed Labs members said Advisor accurately remembered health goals from past conversations.

### Proactive vs reactive
- Moderately proactive via check-ins + insight-entry invitations.
- Labs data: 60% used ≥1×/week; top topics sleep/recovery (75%), stress (57%), activity (45%).
- Framing from clinicians: Advisor helps prepare for doctor visits—not replace them; discovery challenge acknowledged (“three taps deep = doesn’t exist”).

### Guardrails
- Labs-first rollout for new models; offline testing + expert review + AI-as-judge + real-world signals.
- Women’s model: hand-curated research by board-certified clinicians; Oura-controlled infrastructure; conversations not used to train third-party models.
- Product honesty: “can make mistakes”; data discrepancies possible vs rest of app.
- Optional / setup-gated: no data collection until Advisor setup completed.

### Human in the loop
- Clinicians design/eval models; **no clinician in member chat**.
- Explicitly: education / body literacy / prep for clinician visits.

### Pricing / packaging
- Included with active Oura membership (Gen3+); not a separate AI SKU.
- Women’s health model via Labs / eligibility gates.

### Disclaimer language (quoted)
> “Oura Ring is not a medical device and is not intended to diagnose, treat, cure, monitor, or prevent medical conditions or illnesses. Please do not make any changes to your medication, nutrition, or workouts without first consulting your doctor or another medical professional.”  
> — Oura Advisor Member Care (updated June 11, 2026)

> “Oura Advisor is not a doctor. It doesn’t diagnose conditions or prescribe treatments… education tool that can inform and help people prepare for a doctor’s visits—not a replacement for it.”  
> — Dr. Chris Curry, Oura (Designing Trustworthy Health AI, Mar 2, 2026)

### Sources
- https://ouraring.com/blog/oura-advisor/
- https://ouraring.com/blog/designing-trustworthy-health-ai/
- https://support.ouraring.com/hc/en-us/articles/39512345699219-Oura-Advisor
- https://www.businesswire.com/news/home/20250331565896/en/Oura-Advisor-an-AI-powered-Personal-Health-Companion-Now-Rolling-Out-to-All-Oura-Members
- https://athletechnews.com/oura-introduces-oura-advisor/

---

## 4. Ultrahuman (Jade AI / UltraSphere / M2 Live CGM / Blood Vision)

### What the AI actually does
- **Jade AI:** real-time biointelligence correlating ring metrics (sleep, HRV, activity, recovery, skin temp) with CGM and blood biomarkers.
- **UltraSphere (Emerald update, ~July 2025+):** home-screen **decision engine** generating 60+ **Next Best Actions** (energy, wind-down, restorative sleep, etc.), contextualized by location, weather, circadian patterns, archetypes (shift work, jet lag).
- **M2 Live (US, June 18, 2026):** OTC Abbott Lingo CGM integration—Metabolic Score (0–100), spike alerts, Food Score (1–10), Fueling Score for workouts, OGDb community food responses.
- Blood Vision: 100+ biomarkers; Vision Cloud for uploading medical tests → AI summaries/trends.
- Dedicated Jade AI tab + Ring tab NBA surface; on-device processing for live metrics without connectivity.

### Interaction model
- **Primary: proactive cards / Next Best Actions on home**—explicit shift away from “biohacker data dump” toward “tell me what to do next.”
- Chat / metabolic coach exists in ecosystem messaging but is not the Emerald headline UX.
- Scores (Metabolic, Food, Fueling) compress biology into non-clinical action signals.

### How raw biology → non-diagnostic guidance
- Validated wellness scores (Metabolic Score peer-reviewed in *Nature* per Ultrahuman press).
- Correlate glucose with lifestyle sensors → behavior nudges, not disease diagnosis.
- Research partnerships (Stanford sleep–metabolism; Mayo GLP-1 study) used for credibility, not care claims.
- Lingo safety deferred to Abbott safety information.

### Memory & personalization
- Longitudinal ring + CGM + blood + meal logs (~10M meals claimed).
- Archetype/context-aware NBA; goals tracking in Emerald.

### Human in the loop
- Primarily software; clinical research partners, not member-facing clinicians for core ring/CGM UX.
- Blood Vision / medical uploads: interpretation as wellness insights.

### Pricing / packaging
- M2 Live: **$129 single sensor** or **$99/mo** subscription (2 sensors/mo); 14-day Lingo wear.
- Ring + Blood Vision + Home as separate ecosystem purchases; Jade/UltraSphere in app platform.

### Disclaimer / claim posture
- Positioned as metabolic *wellness* / health optimization; glucose for adults 18+ not on insulin (Abbott Lingo framing).
- Ultrahuman redirects full CGM safety to Abbott: https://www.hellolingo.com/safety-information
- Avoids framing scores as medical diagnoses in marketing; “improve metabolic health,” “healthy years.”

### Sources
- https://cyborg.ultrahuman.com/press-releases/ultrahuman-launches-m2-live-abbotts-lingo
- https://www.wareable.com/wearable-tech/ultrahuman-emerald-platform-ai-ultrasphere-app-update
- https://www.digitalhealthnews.com/ultrahuman-launches-emerald-update-with-redesigned-app-ultrasphere-decision-engine-improved-vo-max-accuracy
- https://athletechnews.com/ultrahuman-glucose-tracking-cgm-abbott-lingo/

---

## 5. Levels (CGM + labs + AI programs)

### What the AI actually does
- AI food logging, health insights from glucose + labs + habits, **adaptive programs** (e.g., heart health / ApoB pilots).
- Real-time CGM feedback on food/lifestyle response.
- Pattern detection, trigger flagging, habit guidance in-app.
- Evolution (2025–2026): from “see your glucose” → “health improvement partner” with clinician-reviewed packages.

### Interaction model
- **Primary:** dashboard + programs + logging loops (food, habits, CGM overlays)—not chat-first.
- LevelsAI appears as blog/search Q&A affordance; membership journey is intake → CGM → labs → clinician analysis → adaptive program.
- Completeness tiers add human support intensity, not more chat.

### How raw biology → non-diagnostic guidance
- Metabolic Score / glucose patterns → lifestyle experiments.
- Labs interpreted in context of intake + CGM + habits; action plans and programs.
- Explicit: results empower conversations with *your* doctor; Levels Labs do not diagnose.

### Memory & personalization
- Comprehensive intake; goals; food logs; wearable imports; prior bloodwork uploads; program progress; follow-up labs.

### Human in the loop
- **Core / Complete:** licensed clinician review **2×/year** of whole health context (not just numbers).
- Complete: concierge + 50-min functional nutritionist session.
- Build your system ($80/yr): software-first, add CGM/labs à la carte.

### Pricing / packaging (mid-2026)
| Tier | Price | Notable AI / guidance |
|------|-------|------------------------|
| Build your system | $15/mo or $80/yr | App, AI insights, adaptive programs, wearable import, past labs upload |
| Core | $41/mo / $499/yr | + 2× Essential labs (28+ markers), 1 mo CGM, clinician review 2×/yr |
| Complete | $167/mo / $1,999/yr | + Comprehensive 100+ marker labs, 2 mo CGM, concierge, nutritionist |

### Disclaimer language (quoted)
> “Levels is not a healthcare provider, and none of the Services Levels offers are intended to be used to diagnose, treat, cure, or prevent any disease or medical condition… All medical decisions you make should be made in consultation with your physician, and must not be made in reliance upon the Sites or Services.”  
> — Levels Terms of Service

> “Levels Labs does not provide medical diagnoses… These results are designed to help you better understand your body’s responses and support informed conversations with your healthcare provider.”  
> — Levels Support (Feb 13, 2026)

### Sources
- https://www.levels.com/blog/new-levels-core-complete
- https://www.levels.com/
- https://www.levels.com/blog/how-much-does-levels-cost
- https://www.levelshealth.com/terms-of-service
- https://support.levels.com/article/578-can-levels-labs-diagnose-me-with-a-medical-condition

---

## 6. Function Health (blood panels + Private AI Chat + Protocols)

### What the AI actually does
- Membership: **160+ lab tests/year** (large panel + mid-year retest), clinician flags on results, personalized protocols.
- **Private AI Chat (beta):** personalized explanations grounded in lab results, health history, connected devices (“What does my high ApoB mean?”).
- **Protocols (beta):** evidence-based plans for nutrition, fitness, supplements, sleep, stress—adaptive over time.
- 2025–2026: Medical Intelligence Lab; connectors toward ChatGPT / Microsoft Copilot Health / Perplexity Health (trade coverage)—export grounded context to external AIs.

### Interaction model
- **Primary:** results UI + clinician-flagged issues + Protocols (structured plans).
- **Secondary:** Private AI Chat for dig-deeper Q&A.
- Clinician Chat offering exists in legal terms as separate human educational chat (availability at Function’s discretion).

### How raw biology → non-diagnostic guidance
- Clinicians review/flag; AI explains and protocolizes lifestyle domains.
- Company self-describes as **technology platform**, not lab or medical provider; third parties perform labs/medical services.
- Protocols stay in wellness lanes (nutrition, fitness, supplements, sleep, stress)—not prescriptions.

### Memory & personalization
- Longitudinal labs, mid-year deltas, device data, stated goals/habits; “built to evolve with you.”

### Human in the loop
- **Yes:** clinicians review every result and flag issues (membership promise).
- AI Chat is educational; optional Clinician Chat is human educational, still not a care relationship per terms.

### Pricing / packaging
- Flat **$365/year** (reduced from $499); includes AI Chat + Protocols beta.
- Imaging / on-demand tests extra; HSA/FSA eligible; no insurance.

### Disclaimer language (quoted)
> “FUNCTION DOES NOT OFFER YOU MEDICAL ADVICE, A DIAGNOSIS, MEDICAL TREATMENT, OR ANY FORM OF A MEDICAL OPINION, THROUGH OUR SERVICES OR OTHERWISE. All material… including without limitation through AI Chat, is strictly for general information purposes.”  
> — Function Terms of Service

> “THE CHAT OFFERINGS ARE INTENDED FOR INFORMATIONAL AND EDUCATIONAL PURPOSES ONLY… NOT DESIGNED TO PROVIDE ANY MEDICAL… ADVICE… OR… DIAGNOSES… YOUR USE OF AI CHAT DOES NOT CREATE A PATIENT OR LICENSED MEDICAL PROFESSIONAL RELATIONSHIP…”  
> — Function Supplemental Chat Terms (May 25, 2025)

> “YOU ACKNOWLEDGE AND AGREE THAT AI CHAT IS NOT A HUMAN… GENERATIVE AI TECHNOLOGY IS KNOWN TO HALLUCINATE…”  
> — same

### Sources
- https://www.functionhealth.com/article/function365
- https://www.functionhealth.com/pricing
- https://www.functionhealth.com/faq
- https://www.functionhealth.com/legal/terms-of-service
- https://www.functionhealth.com/legal/supplemental-chat-terms
- https://www.bloodtestcomparison.com/function-health (secondary pricing/AI timeline)

---

## 7. Strava AI features

### Athlete Intelligence (shipped Oct 2024, subscriber beta → ongoing)
**What it does:** Generative AI post-activity summaries on mobile for run/ride/walk/hike (and variants). Interprets pace, HR, elevation, power, Relative Effort vs ~prior 30 days; milestones; zone time; “Say More” for deeper analysis. Private to athlete.

**Interaction model:** **Embedded in activity detail**—proactive card after upload, not a chat home. Expand-in-place (“Say More”).

**Packaging:** Strava subscription / trial.

### MCP Connector (June 1, 2026)
**What it does:** Official Model Context Protocol server → Claude can query **live** Strava data (streams, GPS, power, clubs/events) read-only via OAuth. Natural-language training analysis outside Strava UI.

**Interaction model:** Chat is **external** (Claude), not Strava’s primary surface. Strava keeps Athlete Intelligence as in-app cards; MCP = power-user “ask anything about my history.”

**Packaging:** Included with Strava subscriptions (incl. Runna bundle, etc.); Claude first, more clients later.

**Positioning:** Safer than manual exports / unofficial tools; athlete remains in control; revocable.

### Sources
- https://press.strava.com/articles/stravas-athlete-intelligence-translates-workout-data-into-simple-and
- https://support.strava.com/hc/en-us/articles/26786795557005-Athlete-Intelligence-on-Strava
- https://press.strava.com/ea/articles/strava-launches-mcp-connector
- https://support.strava.com/hc/en-us/articles/46190267796237-Strava-MCP-Connector

---

## 8. Garmin Connect+ / Active Intelligence

### What shipped (Mar 27, 2025+)
- **Active Intelligence (AI, beta, opt-in):** personalized insights/suggestions through the day from health + activity data; personalization improves with use; marketed as data-secure.
- Also in Connect+: Performance dashboard (custom historic charts), Live activity phone companion, extra Garmin Coach plan guidance/videos, expanded LiveTrack, social badges/frames.
- **Promise:** all pre-existing Connect features/data remain free—AI is additive paywall.

### Interaction model
- **Proactive insight cards / suggestions**—not chat-first coaching.
- Reviews (Lifehacker et al.) often call Active Intelligence thin vs free metrics; product still ships as card/insight model.

### Human in the loop
- “Expert training guidance” content from Garmin coaches for plan followers—not live clinician/coach chat.

### Pricing
- **$6.99/mo or $69.99/yr**; 30-day trial.

### Sources
- https://www.garmin.com/en-US/newsroom/press-release/wearables-health/elevate-your-health-and-fitness-goals-with-garmin-connect/
- https://www.theverge.com/news/636211/garmin-connect-plus-subscription-wearables
- https://www.techradar.com/health-fitness/garmin-adds-premium-garmin-connect-tier-with-ai-features-but-promises-your-free-experience-is-not-going-away
- https://lifehacker.com/health/everything-you-get-with-garmin-connect-plus

---

## 9. B2B team-sport / athlete-management AI (closest academy analogues)

These products sell to **staff** (coaches, performance, medical, GMs). AI is almost never a consumer chat coach for athletes as the primary product.

### Kitman Labs (iP / My iP)
- **Shipped (May 27, 2026):** My iP—self-serve reporting/visualization across performance, medicine, coaching, operations; built with **Google Cloud / Gemini Enterprise Agent Platform**.
- Used by 2,000+ elite orgs / 26 countries.
- AI capabilities described as **foundation + progressive rollout**: help build reports, surface patterns/trends—with “clinical responsibility” and governance.
- **Coach UX:** daily/weekly summaries, load/readiness/injury dashboards, role-specific views—not athlete chat.
- Humans (practitioners) remain decision-makers; AI accelerates insight/reporting.

Source: https://www.kitmanlabs.com/news/kitman-labs-launches-my-ip/ · https://www.kitmanlabs.com/

### Catapult
- Wearable GPS/IMU load monitoring (Vector Pro/Core, Catapult One for HS/youth).
- Marketing: ML/AI algorithms for actionable insights; sport/position metrics; video+load context; injury mitigation tooling.
- **Coach UX:** session dashboards, live monitoring, alerts for overexertion—**decision support**, not conversational AI coach.
- Democratization via Catapult One (~consumer/academy pricing cited in secondary coverage ~$179/yr).

Source: https://www.catapult.com/solutions/athlete-monitoring

### Teamworks
- Operating system for elite orgs (Hub, AMS, S&C, Nutrition, coaching products).
- **Teamworks Intelligence** (ex-Zelus): ML for athlete evaluation, roster construction, contract valuation, game strategy—front-office/performance analytics.
- **Ask Teamworks:** plain-language query of platform data for staff.
- Computer vision (Sportlogiq acquisition Jan 2026 hockey; PFF enterprise Mar 2026 football event data)—film/event AI, not wellness chat.
- Athlete-facing: schedules, wellness, communications—staff AI is the differentiator.

Sources: https://teamworks.com/intelligence/ · https://teamworks.com/platform/ · https://teamworks.com/blog/building-a-winning-team/

### Orreco
- **Agentic AI platform** embedding Bayesian models across biomarker surveillance, training load, women’s performance, wellness, medical notes, motion (CV soft-tissue risk), injury risk.
- Interpretable personalized thresholds → transparent decision-support for clinical/coaching use.
- Athlete app for recovery/readiness/wellness ownership; staff universal dashboard + modules.
- FitrWoman / FitrCoach: cycle-aware guidance for athletes + coach platform—human coaches mediate.
- Claims peer-validated injury prediction (e.g., 85% PL hamstring model on site).

Source: https://www.orreco.ai/

### Zone7 (Svexa)
- Injury-risk / load AI for soccer & American football.
- Ingests GPS, HR, sleep, wellness, medical history, session logs → individualized models.
- **Pro UX:** daily risk scores + injury-type forecasts + drivers + load prescriptions; weekly planner + periodization **simulator**.
- Color-coded staff dashboards (green/amber/red) before training—**proactive cards for coaches**.
- Elite tier: human sports/data scientists in the loop for custom research.
- Secondary claims: ~72% injury prediction accuracy; availability improvements at clubs (treat as marketing unless audited).

Sources: https://zone7.ai/product/ · https://svexa.com/player-availability-how-ai-keeps-your-best-players-on-the-pitch/

### B2B AI summary table

| Vendor | AI shipped to coaches | Athlete-facing AI | HITL |
|--------|----------------------|-------------------|------|
| Kitman | Personalized analytics/reporting; Gemini foundation for future AI assist | Limited; staff OS | Practitioners decide |
| Catapult | Load insights, ML metrics, live alerts | Consumer One insights | Coaches/medical |
| Teamworks | Intelligence models + Ask Teamworks NL query | Ops/comms apps | Front office + staff |
| Orreco | Agentic Bayesian decision-support modules | Readiness/wellness app + FitrWoman | Strong clinical/coach |
| Zone7 | Daily risk forecasts + load sims | Minimal | Performance/medical staff (+ Elite humans) |

---

## Cross-cutting UX patterns that work

1. **Ground every insight in the user’s longitudinal sensors / labs** — generic LLM chat without biometrics loses trust (WHOOP, Oura, Google, Ultrahuman all lead with data fusion).
2. **Compress biology into scores + one next action** — Recovery/Readiness, Metabolic Score, Food Score, injury risk color, Relative Effort summary beat raw panels.
3. **Morning brief / Today home as ritual** — WHOOP Daily Outlook, Google Today, Ultrahuman UltraSphere, Garmin Active Intelligence, Zone7 morning risk board.
4. **Chat as deepen, not discover** — “Ask Coach,” “Say More,” Private AI Chat, Oura Advisor from a Readiness card, Strava MCP for power users.
5. **Memories with user control** — Oura’s visible/deletable Memories is the clearest pattern; Google/WHOOP use conversational goal state.
6. **Labs + wearables closed loop** — WHOOP Advanced Labs, Levels Core/Complete, Function, Ultrahuman Blood Vision+CGM: episodic clinical data → daily AI behaviors → retest.
7. **Wellness framing + explicit non-diagnosis** — universal legal pattern; Function/Levels/WHOOP/Oura/Google nearly identical claim structure.
8. **Optional clinician layer as upsell** — Levels Complete, Function clinician review, WHOOP Labs clinicians; AI handles daily cadence.
9. **B2B: dashboards & simulations over chat** — coaches need squad triage before training, not a chatbot.
10. **Ship AI inside existing workflows** — activity page (Strava), Today tab (Google/Oura), recovery loop (WHOOP), report builder (Kitman)—adoption follows habit.

---

## Chat vs cards / daily briefs — verdict

### Verdict
**Proactive cards and daily briefs should be the primary surface; chat should be a secondary “ask why / plan with me” affordance.**

### Evidence
| Product | Primary surface | Chat role |
|---------|-----------------|-----------|
| Google Health Coach | Today proactive insights + Weekly Plan | Ask Coach 24/7 |
| WHOOP | Daily Outlook / Day in Review / Weekly Plan | Coach Q&A + Labs follow-ups |
| Oura | Today insights + check-ins; Advisor entry from metrics | Chat + Memories |
| Ultrahuman | UltraSphere Next Best Actions on home | Jade tab / coach secondary |
| Levels | Programs + CGM/lab dashboard | LevelsAI / Q&A secondary |
| Function | Results + Protocols | Private AI Chat beta |
| Strava | Post-activity Athlete Intelligence card | MCP→Claude external; “Say More” |
| Garmin | Active Intelligence suggestions | No chat-first coach |
| Zone7 / Orreco / Kitman | Staff risk/load/report dashboards | Ask Teamworks / future My iP AI assist |

Even the most chat-capable consumer product (Google Health Coach) **centers the redesigned Today tab** and describes the coach as connecting dots and “surfacing it when it’s helpful”—language of proactive delivery, with conversation as always-available depth.

Chat-primary fails as sole UX because:
- Users don’t know what to ask (Oura invested in topic generation for this).
- High-frequency health decisions need **push at decision time** (morning readiness, pre-session risk).
- Coaches in B2B need **squad-level triage**, not N parallel chats.

**Recommended PPD shape:**  
Daily/weekly brief + embedded cards on readiness, training, match, biomarkers → “Why?” / “What should I change?” opens agent chat with that card’s context pre-loaded. For academy B2B, mirror Zone7/Kitman: coach dashboard first; athlete brief second; chat tertiary.

---

## Dual B2B / B2C implications for Peak Performance Data

| Dimension | Solo consumer (B2C) | Coach-mediated academy (B2B) |
|-----------|---------------------|------------------------------|
| Decision owner | User | Coach / performance / medical staff; athlete executes |
| Primary UX | Personal Today / Daily Outlook | Squad availability, load, risk, progress dashboards |
| AI tone | Motivational wellness coach | Decision-support; uncertainty + drivers shown (Orreco/Zone7) |
| Chat | Athlete “ask why” | Manager “Ask platform” (Teamworks-style) + optional athlete Q&A |
| Human loop | Optional clinician upsell | Required: coaches always in loop; AI advises |
| Claims | Strict wellness / non-diagnostic | Performance & availability language; clinical modules need governance |
| Packaging | $10–$170/mo consumer SKUs or hardware membership | Seat/org license; AI often embedded in platform tier |
| Data sharing | Individual privacy controls | Role-based staff access; athlete app subset (Orreco pattern) |
| Success metric | Habit adherence, biomarker movement, retention | Availability, load compliance, development pathway, staff time saved |

**Practical split for PPD:**
1. **Shared insight engine** (same grounding: wearables, training, tennis analytics, labs, genetics, CGM).
2. **Two skins / policies:** consumer brief for athletes/parents vs coach workbench with overrides and annotations.
3. **Never let AI bypass the coach in B2B** for load/medical decisions; let AI draft athlete-facing language the coach approves (Orreco “push content,” Kitman clinical responsibility).
4. **Parents:** Function/Oura-style explainers + “talk to coach/clinician” CTAs—not autonomous medical coaching.
5. **Monetization:** consumer Premium AI brief (Google/WHOOP pattern ~$10/mo software); academy pays for multi-agent staff tools (Zone7/Kitman pattern).

---

## Source index (all URLs)

### Google / Fitbit
- https://blog.google/products-and-platforms/products/google-health/google-health-coach/
- https://store.google.com/product/google_health_premium?hl=en-US
- https://techcrunch.com/2026/05/07/googles-9-99-per-month-ai-health-coach-launches-may-19/
- https://9to5google.com/2026/05/07/google-health-app-fitbit/
- https://www.androidauthority.com/google-health-app-coach-rebrand-3664205/

### WHOOP
- https://www.whoop.com/us/en/thelocker/new-ai-guidance-from-whoop/
- https://www.whoop.com/us/en/thelocker/whoop-advanced-labs/
- https://www.whoop.com/us/en/thelocker/podcast-344-introducing-the-all-new-whoop-advanced-labs/
- https://www.whoop.com/us/en/press-center/whoop-launches-clinician-reviewed-advanced-labs/
- https://www.whoop.com/us/en/whoop-terms-of-use/
- https://www.whoop.com/us/en/full-privacy-policy/
- https://www.whoop.com/us/en/membership/
- https://jobs.lever.co/whoop/e8b2f0e0-cc8c-462f-83b1-0537f4798aaa

### Oura
- https://ouraring.com/blog/oura-advisor/
- https://ouraring.com/blog/designing-trustworthy-health-ai/
- https://support.ouraring.com/hc/en-us/articles/39512345699219-Oura-Advisor
- https://www.businesswire.com/news/home/20250331565896/en/Oura-Advisor-an-AI-powered-Personal-Health-Companion-Now-Rolling-Out-to-All-Oura-Members

### Ultrahuman
- https://cyborg.ultrahuman.com/press-releases/ultrahuman-launches-m2-live-abbotts-lingo
- https://www.wareable.com/wearable-tech/ultrahuman-emerald-platform-ai-ultrasphere-app-update
- https://www.digitalhealthnews.com/ultrahuman-launches-emerald-update-with-redesigned-app-ultrasphere-decision-engine-improved-vo-max-accuracy

### Levels
- https://www.levels.com/blog/new-levels-core-complete
- https://www.levels.com/
- https://www.levelshealth.com/terms-of-service
- https://support.levels.com/article/578-can-levels-labs-diagnose-me-with-a-medical-condition

### Function Health
- https://www.functionhealth.com/article/function365
- https://www.functionhealth.com/pricing
- https://www.functionhealth.com/legal/terms-of-service
- https://www.functionhealth.com/legal/supplemental-chat-terms

### Strava
- https://press.strava.com/articles/stravas-athlete-intelligence-translates-workout-data-into-simple-and
- https://support.strava.com/hc/en-us/articles/26786795557005-Athlete-Intelligence-on-Strava
- https://press.strava.com/ea/articles/strava-launches-mcp-connector
- https://support.strava.com/hc/en-us/articles/46190267796237-Strava-MCP-Connector

### Garmin
- https://www.garmin.com/en-US/newsroom/press-release/wearables-health/elevate-your-health-and-fitness-goals-with-garmin-connect/
- https://www.theverge.com/news/636211/garmin-connect-plus-subscription-wearables

### B2B analogues
- https://www.kitmanlabs.com/news/kitman-labs-launches-my-ip/
- https://www.catapult.com/solutions/athlete-monitoring
- https://teamworks.com/intelligence/
- https://teamworks.com/platform/
- https://www.orreco.ai/
- https://zone7.ai/product/
- https://svexa.com/player-availability-how-ai-keeps-your-best-players-on-the-pitch/

---

*End of dossier. Written 2026-08-02 for Peak Performance Data multi-agent AI product planning.*
