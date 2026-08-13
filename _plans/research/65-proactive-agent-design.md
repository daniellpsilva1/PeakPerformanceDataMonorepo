# Proactive Agent Design — Notification Worthiness, Alert Fatigue & Triggering

**Research date:** August 2, 2026  
**Scope:** External research on when a multi-agent sports-performance system should speak at all — clinical alert-fatigue evidence, consumer health notification practice, sports-science change detection, and a concrete trigger architecture for nightly athlete insights + coach roster digests.  
**Method:** Web search + fetch of peer-reviewed meta-analyses (2024–2025 CDS), sports-science methods (Hopkins SWC/TE, Buchheit HR monitoring, ACWR reviews), wearable product docs (Oura, WHOOP, Garmin, Apple), and newsworthiness/LLM hybrid systems. No local codebase exploration beyond this output file.

---

## Executive takeaway (for Peak Performance Data)

**Do not generate a nightly insight for every athlete.** Clinical CDS literature shows override rates of ~80–90% when systems fire indiscriminately; a coach reviewing 500 athlete cards is structurally the same failure mode. Shipped wearables succeed by (1) always showing a passive daily score, (2) only *highlighting* deviations that clear personal baselines, and (3) reserving push/interruptive alerts for rare, high-severity events.

**Recommended architecture:** Deterministic statistical detection decides *whether* to speak; an LLM decides *how* to say it (and never invents a trigger). Gate publication with a newsworthiness score (effect size × confidence × actionability × novelty). Hard rate limits: **≤3 published insights per athlete per week**, **≤7 items in a coach daily digest**, interruptive push only for Tier-1 escalations.

---

## 1. Alert fatigue as a studied phenomenon (clinical CDS)

### 1.1 Override rates — the actual figures

| Source | Year | Finding |
|--------|------|---------|
| Raven et al., *Int J Med Inform* systematic review + meta-analysis | 2025 | Override rates for medication alerts during order entry range **46.2% to 96.2%** |
| Olakotan et al. / JMIR preprint meta-analysis on DDI alerts (PROSPERO CRD42024541597) | 2025 | Pooled DDI override rate **79.8%** (95% CI 73.0–86.7%); individual studies **55.4–95.7%** |
| Poly et al., *Health Informatics J* meta-analysis | 2024 | Overall DDI alert override prevalence **90%** (95% CI 85–95%); CDSS alert generation prevalence ~13% |
| Edrees et al. scoping review (34 studies) | 2022 | DDI override rates **55–98%** (US) and **57–95%** (non-US) |
| Finnish university-hospital CPOE study (EAHP 2025 abstract) | 2025 | Soft-limit pop-ups on 16% of 5.3M orders; **87% overridden**; interaction alerts 93–94% override; Meds75+/pregnancy 94–97% |
| Olson & Wright, *Mayo Clin Proc* commentary | 2023 | Interruptive pop-ups overridden **up to 96%** of the time without action |

**Structural analogy to coaching:** A clinician reviewing EHR alerts and a coach reviewing nightly athlete insights share the same cognitive economics — high volume, variable relevance, time pressure, and a strong incentive to develop a dismiss-by-default habit. Once that habit forms, *even true positives die*.

### 1.2 Why overrides happen

From Raven et al. (2025) and Edrees et al. (2022):

1. **Low clinical relevance** — alert fires on theoretically possible but practically unimportant events.
2. **Poor specificity / over-alerting** — volume desensitizes (“cry wolf”).
3. **Poor workflow integration** — wrong time, wrong person, wrong channel.
4. **Ineffective design** — no clear recommended action; free-text override reasons that teach the system nothing.
5. **Alert fatigue proper** — cognitive desensitization from cumulative exposure.
6. **Legitimate clinical judgment** — “benefit outweighs risk,” “will monitor,” patient already on the combination.

Raven et al. also found higher acceptance for **fellows vs residents** (OR 1.14) and **weekday vs weekend** alerts (OR 1.25) — timing and expertise matter even after relevance.

### 1.3 Recommended mitigations (CDS → coach alerts)

| CDS recommendation | Coach / athlete translation |
|--------------------|----------------------------|
| Five Rights of CDS (right info, person, format, channel, time) | Right metric story → right role (coach vs athlete) → card vs push → morning local time → before training decisions |
| Tier by severity; interruptive only for high stakes | Silent log → insight card → digest item → push (see §10) |
| Increase specificity; suppress low-value alert types | Personal baselines + SWC/TE gates; retire insight types with high dismiss rates |
| Context-aware triggers (labs, comorbidities) | Competition day, training schedule, recent illness, prior insight cooldown |
| Measure override/dismissal; continuous tuning | Weekly fatigue dashboard; auto-suppress insight types above dismiss thresholds |
| Non-interruptive placement for Level-3 (Partners HealthCare tiering) | Default = passive card in digest; push is rare |

**Partners HealthCare tiering evidence (Paterno et al., *JAMIA*):** Making only the most serious DDIs interruptive, with Level-3 as information-only, raised compliance to nearly **two-thirds** for serious alerts — far above un-tiered baselines. Presentation policy matters as much as which rules fire.

### Sources — §1
- https://doi.org/10.1016/j.ijmedinf.2025.106011
- https://doi.org/10.2196/preprints.88578
- https://doi.org/10.1177/14604582241263242
- https://doi.org/10.3233/shti220101
- https://doi.org/10.1136/ejhpharm-2025-eahp.411
- https://doi.org/10.1016/j.mayocp.2023.05.025
- https://pmc.ncbi.nlm.nih.gov/articles/PMC2605599/
- https://smart.osu.edu/the-toolkit/ehr-alerts/
- https://www.mindbowser.com/reduce-cdss-alert-fatigue-clinical-decision-support/

---

## 2. Alert design that works

### 2.1 Specificity over sensitivity

Alerting on every deviation maximizes sensitivity and destroys trust. Effective systems optimize **positive predictive value**: among alerts shown, a high fraction should be worth acting on. CDS practice: tighten trigger logic with patient context; suppress duplicates; retire rules with chronic high override.

### 2.2 Actionability

Every published insight should answer: **What should the coach/athlete do differently in the next 24–72 hours?** If the only honest answer is “note it,” it belongs in silent logging or a weekly trend, not a daily card.

Oura’s product framing (July 2024): insight messages exist to make data “accessible, actionable, and understandable” and to spark small behavior change — not dump scores.

### 2.3 Severity tiering

| Tier | Interruptiveness | Example CDS | Our product |
|------|------------------|-------------|-------------|
| 0 — Silent | None | Background logging | Store detection event; never surface |
| 1 — Passive | Non-interruptive | Info-only sidebar | Athlete insight card / coach digest row |
| 2 — Soft interrupt | Badge / digest pin | Soft-limit pop-up | Digest “attention” section + optional email digest |
| 3 — Interruptive | Push / require ack | Override-reason alert | Push to coach for acute risk (injury load spike + low readiness) |
| 4 — Hard stop | Block workflow | Rare catastrophic | Out of scope for wellness; reserve for confirmed safety (e.g., biomarker critical + clinician protocol) |

### 2.4 Suppressing repeats

CDS: de-duplicate the same DDI across a session; don’t re-fire identical soft alerts every order. Product: **cooldown windows** and **delta-from-last-published** (see §7).

### 2.5 Interruptive vs non-interruptive

Olson & Wright (2023): interruptive pop-ups force task-switching, increase cognitive load, and invite error. Prefer pathways, order sets, and ambient displays. For us: the coach **roster digest** is the primary non-interruptive surface; push is the exception.

---

## 3. How shipped health/fitness products decide when to notify

### 3.1 Oura

- **Daily insight messages** on Home for Readiness, Sleep, and daytime stress — short narrative cards, not chat.
- Algorithm **prioritizes** among thousands of candidate messages; elevated body temperature and elevated resting heart rate are weighted more heavily than routine metrics.
- Trends highlight “interesting change” in profile focus areas — not every metric every day.
- Push notification categories are limited and user-toggleable: low battery, inactivity (after 50 min), activity progress, bedtime (1h before suggested bedtime), insight availability (e.g., weekly summary). Default: battery + inactivity only.
- Explicit humility: Oura cannot see full life context; messages are hypotheses that invite reflection.

**Suppression of non-events:** The prioritization algorithm and “interesting change” framing mean most days the insight is a soft narrative around the scores the user already expects — not a panic alert for in-range variation. Weekly/monthly/anniversary reports absorb long-horizon news.

Sources:  
https://ouraring.com/blog/inside-the-ring-the-story-behind-ouras-daily-insight-messages/  
https://support.ouraring.com/hc/en-us/articles/360025579173-Managing-Your-Notifications

### 3.2 WHOOP

- Core loop: **Recovery / Strain / Sleep** scores every day (passive, expected surface).
- Prescriptive strain targets by recovery band (e.g., green recovery → higher strain target; red → low strain) — the “speak” is often a *target*, not an alert.
- **WHOOP AI** surfaces guidance “when meaningful patterns emerge” across Sleep, Recovery, Strain, and Journal — pattern emergence language implies non-event suppression.
- Journal Behavior Impacts require enough logged behavior history — no insight without evidence density.
- Product philosophy (design commentary): optimize for **insight over interaction**; screenless hardware reduces notification-driven compulsion.

Sources:  
https://www.whoop.com/us/en/thelocker/a-new-way-to-see-insights-on-which-behaviors-affect-your-recovery/  
https://www.superage.app/en/blog/apple-health-vs-oura-vs-whoop-apps/  
https://medium.com/design-bootcamp/from-wristband-to-health-os-the-product-design-philosophy-behind-whoops-unlikely-dominance-9cb74f4e6424

### 3.3 Garmin

- Health & Wellness alerts are **opt-in toggles**: Body Battery daily summary (a few hours before sleep window), stress drain alerts, rest recharge alerts, abnormal HR (user-set thresholds), move alerts, goal alerts, jet-lag adviser.
- Body Battery itself is a continuous glance (5–100), not a constant push — the *summary* is timed to evening wind-down.
- Abnormal HR uses **user-defined thresholds** — the user owns the interrupt bar.

Source:  
https://www8.garmin.com/manuals/webhelp/GUID-2CF5620C-E585-4E0A-9CC3-9565533EEE4D/EN-US/GUID-EB335B47-6770-4A06-8EEC-8E0355507102.html

### 3.4 Apple Health / HealthKit

- Aggregator + rings; less “coach narrative” than Oura/WHOOP.
- Abnormal rhythm / ECG features are high-specificity medical-adjacent alerts (FDA-cleared pathways) — rare, high stakes.
- Developer constraints: HealthKit background delivery often **15–60 minutes**; apps should not replicate system Activity ring notifications. Implication: don’t design interruptive UX that depends on Apple sync immediacy.
- Focus/Sleep modes teach users to **batch** non-urgent health noise outside deep-work and sleep.

### 3.5 Cross-product pattern (notification worthiness)

1. **Always-on passive score** (Recovery / Readiness / Body Battery) — expected daily ritual, not “news.”
2. **Highlight only deviations or emerging patterns** — algorithm prioritization.
3. **User-controlled categories** for pushes.
4. **Time-bound digests** (morning outlook, evening summary) instead of random pings.
5. **Celebrate and caution** both allowed, but tone stays non-medical and action-light unless severity warrants.

mHealth survey finding (Stawarz et al. / UF survey of commercial apps): most apps still over-rely on time-based daily reminders rather than contextual triggers; retention suffers with high frequency (e.g., every 3 hours worse than 1–2×/day in related domains). Prefer contextual over calendar spam.

Source: https://init.cise.ufl.edu/wp-content/uploads/sites/775/2021/04/MyTrackAppSurvey-cameraReady-final.pdf

---

## 4. Anomaly detection vs LLM judgment for newsworthiness

### 4.1 The architectural claim

> **Deterministic/statistical layer decides WHETHER to speak. LLM layer decides HOW to say it (and optionally ranks among already-triggered candidates).**

### 4.2 Supporting evidence

**Journalism / newsworthiness hybrids (closest published analogue):**
- Globe and Mail / JournalismAI Real Estate Alerter: **anomaly detection + clustering first**, then LLM few-shot newsworthiness on the shortlist. Explicit goal: cut volume before expensive LLM judgment. Human feedback loop for false negatives.
  - https://www.zenml.io/llmops-database/ai-powered-real-estate-transaction-newsworthiness-detection-system
  - https://www.journalismai.info/blog/ks946agrwqogayiiu7etftk6bom8fo
- ArXiv 2509.25491 (*LLM-Assisted News Discovery…*): LLMs help at scale for monitoring and filtering obvious noise; **fine-grained newsworthiness still needs human editorial judgment**. LLMs systematically mis-rank novelty vs actionability.
  - https://arxiv.org/pdf/2509.25491
- ACL 2026 Media-to-Insights demo: staged processing — embeddings/structure for high-volume ops, agents for semantic reasoning; “right tool for each task.”
  - https://aclanthology.org/2026.acl-demo.44.pdf

**Clinical CDS:** Rules fire on structured criteria; narrative generation (if any) is downstream. No serious hospital fires alerts because an LLM “felt concerned.”

**Sports science:** HRV-guided training literature uses **SWC bands and rolling averages** as the decision gate for high vs low intensity days — not prose judgment (Vesterinen/Plews/Buchheit lineage).

### 4.3 Counter-evidence / caveats

1. **LLMs can catch semantic novelty** that stats miss (e.g., “first match after illness” narrative) — but that should be a *second-stage ranker* over candidates that already cleared data gates, or a separate context feature flag, not the sole trigger.
2. **Pure LLM newsworthiness over-fires** on technically interesting but non-actionable anomalies (newsroom finding).
3. **False negatives:** Strict stats miss rare multi-signal stories. Mitigate with a low-cost “weak signal” queue reviewed by a cheaper model or weekly critic, not daily push.
4. **Calibration drift:** Statistical thresholds need recalibration; LLM prompts drift too — but stats fail loudly (unit tests), LLMs fail softly.

### 4.4 Verdict for PPD

**Adopt the split.** Nightly pipeline:

```
raw metrics → feature engineering → statistical detectors → candidate events
  → newsworthiness score + rate limits + dedupe → (optional) LLM rank/merge
  → LLM narration (structured JSON) → publish / silent log
```

The LLM **must not** create a publishable insight without a detector `event_id`. Narration may refuse (“insufficient evidence”) and demote to silent log.

---

## 5. Statistical methods for meaningful change (athlete monitoring)

### 5.1 Individual baselines

For metric \(x\) on athlete \(i\), baseline over a stable window (typically **14–28 days**, or ≥7 for HRV familiarization; recalibrate each mesocycle):

\[
\mu_{i} = \frac{1}{n}\sum_{t=1}^{n} x_{i,t}, \quad
\sigma_{i} = \sqrt{\frac{1}{n-1}\sum_{t=1}^{n}(x_{i,t}-\mu_{i})^{2}}
\]

Prefer **within-athlete** baselines over squad norms for autonomic/recovery metrics (HRV, RHR, sleep). Squad norms are useful for performance tests (CMJ) when SWC uses between-athlete SD.

### 5.2 Z-score against personal baseline

\[
z_{i,t} = \frac{x_{i,t} - \mu_{i}}{\sigma_{i}}
\]

Common operational bands (HRV / wellness practice):
- \(|z| < 1.0\): noise / within normal variation
- \(1.0 \le |z| < 1.5\): watch (silent or weak candidate)
- \(1.5 \le |z| < 2.0\): notable
- \(|z| \ge 2.0\): strong deviation (≈ outside ~95% of personal history if roughly normal)

For skewed metrics (RMSSD), use \(\ln(\mathrm{RMSSD})\) before computing \(z\).

### 5.3 Coefficient of variation (CV)

\[
\mathrm{CV}_{i} = \frac{\sigma_{i}}{\mu_{i}} \times 100\%
\]

For HRV, weekly \(\mathrm{CV}\) of \(\ln\mathrm{RMSSD}\) is itself a training-response marker (higher CV often = more autonomic stress / incomplete adaptation). Rising CV across weeks can be a trigger even if mean is stable.

### 5.4 Typical error (TE) / noise

From reliability studies (difference scores between repeated trials):

\[
\mathrm{TE} = \frac{\mathrm{SD}_{\text{diff}}}{\sqrt{2}}
\]

Often expressed as %CV. A test is “useful” when \(\mathrm{TE} < \mathrm{SWC}\) (good), marginal when \(\mathrm{TE} \approx \mathrm{SWC}\), noisy when \(\mathrm{TE} > \mathrm{SWC}\).

### 5.5 Smallest worthwhile change (SWC) — Hopkins

**Team-sport / fitness tests (default):**

\[
\mathrm{SWC} = 0.2 \times \sigma_{\text{between-athletes}}
\]

(Cohen small effect size of 0.20; Hopkins, *Sportscience* 2004, updated.)

**Individual elite competition performance:**

\[
\mathrm{SWC} = 0.3 \times \mathrm{CV}_{\text{competition-to-competition}}
\]

(≈ extra medal per 10 competitions framing; updated from earlier 0.5×.)

**Within-athlete monitoring band (HRV practice, Plews/Buchheit lineage):**

\[
\mathrm{SWC}_{i} = 0.5 \times \sigma_{i}
\]

(sometimes \(0.5\)–\(1.0 \times \sigma_{i}\); many HRV-guided protocols use \(\mu \pm 0.5\sigma\) on 7-day rolling \(\ln\mathrm{RMSSD}\).)

**Decision rule (combined):**

\[
\text{Meaningful if } |x_{t} - \mu| > \max(\mathrm{SWC},\, k\cdot\mathrm{TE})
\]

with \(k \approx 1\) (clearly greater than noise) or use magnitude-based inference (beneficial / trivial / harmful / unclear) when reporting uncertainty.

Sources:  
http://sportsci.org/jour/04/wghtests.htm  
https://sportsci.org/2017/wghtrend.htm  
https://www.scienceforsport.com/smallest-worthwhile-change/  
https://elementssystem.com/wp-content/uploads/2018/06/Buccheit.pdf (Buchheit, *Front Physiol* 2014 — HR measures review)  
https://doi.org/10.3390/jfmk9020093  
https://doi.org/10.3390/s26010003

### 5.6 Shewhart / SPC control charts

Individuals chart (personal baseline):

\[
\mathrm{UCL} = \mu_{i} + L\cdot\sigma_{i}, \quad
\mathrm{LCL} = \mu_{i} - L\cdot\sigma_{i}
\]

with \(L = 3\) classical (rare false alarms) or \(L = 2\) for more sensitive athlete monitoring. Western Electric / Nelson rules (e.g., 2 of 3 beyond 2σ, 4 of 5 beyond 1σ, 8 consecutive on one side) catch persistent shifts without single-day fireworks.

### 5.7 CUSUM (cumulative sum) — small persistent shifts

Tabular two-sided CUSUM (NIST / SPC standard):

\[
S^{+}_{t} = \max\bigl(0,\, S^{+}_{t-1} + (x_{t} - \mu_{0}) - k\bigr)
\]
\[
S^{-}_{t} = \max\bigl(0,\, S^{-}_{t-1} + (\mu_{0} - x_{t}) - k\bigr)
\]

Signal when \(S^{+} > h\) or \(S^{-} > h\).

Typical design for ~1σ shift: \(k = 0.5\sigma\), \(h = 4\text{–}5\sigma\) (in standardized units). CUSUM detects slow HRV/sleep drift faster than Shewhart single-point rules; use for **chronic** deterioration, not match-day noise.

Source: https://www.itl.nist.gov/div898/handbook/pmc/section3/pmc323.htm

### 5.8 Rolling averages (practical HRV)

\[
\bar{x}^{(7)}_{t} = \frac{1}{7}\sum_{j=0}^{6} x_{t-j}
\]

Trigger when 7-day mean exits SWC band of baseline period — reduces day-to-day false alarms vs raw daily \(z\).

### 5.9 Acute:Chronic Workload Ratio (ACWR)

\[
\mathrm{ACWR}_{t} = \frac{\text{Acute load (e.g. last 7 days)}}{\text{Chronic load (e.g. mean of last 28 days)}}
\]

EWMA variants weight recent days more heavily (preferred when sparse data / higher sensitivity needed).

Common interpretive bands (Gabbett tradition; use as **warning**, not diagnosis):

| ACWR | Zone |
|------|------|
| < 0.8 | Under-training / deconditioning risk |
| 0.8 – 1.3 | “Sweet spot” (lowest relative injury risk in many team-sport studies) |
| 1.3 – 1.5 | Caution |
| > 1.5 | “Danger zone” — elevated relative injury risk (often cited ~2–4× in early literature) |

**2025 meta-analysis caveat** (*BMC Sports Sci Med Rehabil*): 0.8–1.3 often low-risk and >1.5 elevated across soccer/tennis/rugby subgroups, but individual tolerance varies; mathematical coupling critiques exist (Impellizzeri et al.). Treat ACWR as one feature in a multi-signal detector, never sole injury oracle.

Sources:  
https://link.springer.com/article/10.1186/s13102-025-01332-x  
https://www.scienceforsport.com/acutechronic-workload-ratio/  
https://pmc.ncbi.nlm.nih.gov/articles/PMC7485291/

---

## 6. Multiple comparisons — the quantitative problem

### 6.1 The math

If \(m\) independent tests each use \(\alpha = 0.05\) and all nulls are true:

\[
P(\text{at least one false positive}) = 1 - (1-\alpha)^{m}
\]

| \(m\) | \(P(\ge 1 \text{ FP})\) |
|------|-------------------------|
| 1 | 5% |
| 20 | **≈ 64%** |
| 100 | **≈ 99.4%** |

**Our scale:** 20 metrics × 500 athletes = **10,000 nightly tests**.  
Expected false positives if uncorrected at \(\alpha=0.05\): \(10000 \times 0.05 = 500\) spurious “significant” changes **every night** — enough to destroy the digest.

Even at \(\alpha=0.01\): ~100 false alarms/night. At \(\alpha=0.001\): ~10/night — still too many for coaches without further novelty/rate limits.

### 6.2 Corrections

**Bonferroni (FWER):** \(\alpha' = \alpha / m\). For \(m=20\) per athlete, \(\alpha'=0.0025\). Very conservative; good for Tier-3 push triggers.

**Holm-Bonferroni:** Step-down; slightly more power than Bonferroni at same FWER.

**Benjamini–Hochberg FDR:** Order p-values \(p_{(1)}\le\cdots\le p_{(m)}\); find largest \(k\) with \(p_{(k)} \le (k/m)Q\); reject all \(i\le k\). Use \(Q=0.10\) for exploratory digest candidates, \(Q=0.05\) for published cards.

**Hierarchy we should use (not pure p-values):**
1. Effect-size / SWC gate first (practical significance).
2. Within-athlete \(z\) or CUSUM (not cross-sectional p-hacking).
3. FDR across metrics **within athlete** for borderline candidates.
4. Global rate limits + newsworthiness score (stronger than any α tweak).

Prefer **magnitude + reliability** (Hopkins) over NHST for athlete monitoring. P-values are a secondary filter for research-grade biomarkers.

Sources:  
https://www.biostathandbook.com/multiplecomparisons.html  
https://pmc.ncbi.nlm.nih.gov/articles/PMC4333023/  
https://statisticsfundamentals.com/hypothesis-testing/bonferroni-correction/

---

## 7. Novelty and repetition suppression

### 7.1 Why repetition kills trust

Telling a coach “HRV is low” five days running teaches them to ignore HRV alerts. CDS de-duplication and SOC alert clustering exist for the same reason.

### 7.2 What counts as “new information”

An insight is novel if **at least one** holds:

1. **State transition:** metric crossed a new band (e.g., green→red readiness) vs remaining in-band.
2. **Delta from last published:** \(|x_t - x_{\text{last published}}| > \mathrm{SWC}\) **and** direction/story changed.
3. **New corroborating signal:** second metric newly agrees (HRV low *and* ACWR > 1.5 *and* sleep debt).
4. **New context:** competition within 48h, return from illness, travel/timezone change.
5. **Trend inflection:** CUSUM newly signals after being in-control; slope sign change on 7–14 day regression.
6. **Resolution news:** recovery back into SWC after a published deficit (positive closure — high value, often under-sent).

### 7.3 Dedup / cooldown rules (concrete)

| Rule | Default |
|------|---------|
| Same `(athlete, insight_type, direction)` | **72h cooldown** before re-publish |
| Same fingerprint (metric set + band) | **5 days** unless severity escalates ≥1 tier |
| Escalation exception | If \(|z|\) increases by ≥1.0 or new Tier-3 criterion, allow re-publish |
| Positive resolution | Allowed once per episode even inside cooldown |
| Embedding similarity | If cosine(sim) of narration embedding vs last 7 days > 0.92 **and** same type → suppress (LLM-side safety net) |
| Coach digest | Collapse multiple athletes with identical template into one cluster row (“4 athletes: elevated ACWR”) when >3 |

Store every detection in `insight_events` with `published=false` when suppressed — needed for eval and fatigue analytics.

---

## 8. Timing

### 8.1 Principles

- Deliver when decisions happen: **coach morning planning** and **pre-session**, not midnight UTC spam.
- Respect **athlete local timezone** and coach primary venue timezone.
- Competition days: raise severity sensitivity for readiness/load; suppress “nice-to-know” tennis technique trivia.
- Post-travel: widen SWC bands for 48h (circadian noise) or tag insights as travel-confounded.
- Weekends: Raven et al. found lower alert acceptance on weekends — prefer digest batching Friday for weekend tourneys rather than Saturday 6am noise.

### 8.2 Recommended schedule

| Surface | When |
|---------|------|
| Athlete card generation | Nightly batch after wearables sync SLA (e.g., 04:00–06:00 athlete local) |
| Athlete-facing push (rare) | 07:00–08:00 local, never during Sleep Focus / 22:00–06:00 |
| Coach roster digest | 06:30 coach-local on training days; 07:30 competition days |
| Midday re-check | Only Tier-3 (acute illness flag, biomarker critical) |
| Weekly trend pack | Sunday evening or Monday AM — absorbs non-urgent novelty |

### 8.3 Training / competition modifiers

- **Match day −1 / 0:** Boost readiness, sleep, HRV, ACWR weights; mute first-serve % noise unless extreme.
- **Post-match +1:** Prefer recovery narratives; suppress “increase load” CTAs.
- **Off / recovery day:** Lower rate limit further; celebrate adherence.

---

## 9. Measuring whether proactive output is working

### 9.1 Metrics

| Metric | Definition | Healthy target (starting) |
|--------|------------|---------------------------|
| Open / expand rate | Digest item or card opened | ≥40% coach; ≥25% athlete |
| Action rate | Explicit act (adjust plan, message athlete, acknowledge) | ≥15% of Tier-2+ |
| Dismiss / ignore rate | Swipe-away or “not useful” without expand | <40% |
| Opt-out rate | Category disabled | <0.5%/week per category |
| Time-to-action | Delivery → action | Stable or falling |
| Alert-to-action ratio | Actions / published insights | >20% for Tier-2+ (SOC analogy) |
| Repeat-type dismiss | Dismiss rate by `insight_type` | Flag if >60% over 14 days |
| False-alarm audits | Spot-check: % of published with no coach-recognized value | <25% |

Product literature: rising **close-to-click** precedes unsubscribes by weeks; 73% of users cite irrelevant/poorly timed notifications as unsubscribe reason (Courier). Push marketing fatigue crossover often near **~5 sends/week**.

Sources:  
https://www.courier.com/blog/how-to-reduce-notification-fatigue-7-proven-product-strategies-for-saas  
https://www.courier.com/blog/what-is-alert-fatigue  
https://www.web-push-notifications.com/notification-engagement-campaign-optimization/notification-frequency-fatigue-management/  
https://panther.com/blog/what-is-alert-fatigue

### 9.2 Feedback loop → suppression

1. Instrument dismiss, useful/not useful, and action outcomes per `insight_type` + severity.
2. Weekly job: if dismiss rate >60% **and** action rate <10% for a type over ≥50 impressions → **auto-demote** type one tier (card→silent, or raise newsworthiness threshold +0.1).
3. If opt-out spike on a category → freeze that category’s generative experiments.
4. Human sports-scientist review queue for top false-alarm clusters monthly.
5. Never use LLM self-rating of “helpfulness” as the sole quality metric — use coach behavior.

---

## 10. Concrete proactive engine design for PPD

### 10.1 Trigger architecture (two layers)

```
LAYER A — Deterministic Detection (Python, testable)
  baselines → detectors per metric family → CandidateEvent
  fields: athlete_id, metric, effect_size, z, swc_ratio,
          cusum_flag, severity_raw, evidence[], context_flags
        │
        │ only if CandidateEvent exists
        ▼
GATE — Newsworthiness + Policy
  score = f(effect, confidence, actionability, novelty)
  rate limits, dedupe, competition modifiers, FDR (optional)
        │
        │ if score ≥ threshold and under caps
        ▼
LAYER B — LLM Narration (structured output)
  input: CandidateEvent + evidence + prior insights
  output: headline, body, CTA, severity, citations
  may REFUSE → silent log (never invent new triggers)
```

### 10.2 Metric-specific detectors

#### A. Readiness (0–100 composite)

- Baseline: 28-day median & SD (robust to outliers).
- Trigger if **daily readiness** \(\le \mu - \max(0.5\sigma,\, 10\text{ pts})\) **or** \(z \le -1.5\).
- Escalation: \(z \le -2.0\) **and** competition within 48h → Tier-2/3.
- Suppress if readiness already published “low” within 72h unless further drop ≥8 points.

#### B. HRV (prefer morning lnRMSSD or vendor-normalized HRV)

- Transform: \(y = \ln(\mathrm{RMSSD})\) when raw ms available.
- Baseline: 14–28 day \(\mu_y, \sigma_y\); also track 7-day rolling mean \(y^{(7)}\).
- **Primary trigger:** \(y^{(7)}\) exits \(\mu \pm 0.5\sigma\) (SWC band) for **≥2 consecutive days**.
- **Acute trigger:** single-day \(z \le -2.0\) only if sleep and RHR corroborate (multi-signal).
- **Chronic:** CUSUM on \(y\) with \(k=0.5\sigma\), \(h=4\sigma\) → Tier-2 “persistent autonomic decline.”
- Rising weekly CV of \(y\) > baseline CV + 0.5×baseline CV → watch candidate.

#### C. Sleep (duration, efficiency, or Sleep Score)

- Duration: trigger if sleep hours \(< \mu - \max(\mathrm{SWC}=0.2\sigma_{\text{squad or self}},\, 45\text{ min})\) for **1 night before competition** or **≥2 nights** otherwise.
- Efficiency / score: \(z \le -1.5\) with TE awareness (wearable sleep staging noisy — require corroboration with readiness or HRV for Tier-2).
- Sleep debt accumulator: rolling 7-day deficit > 3 hours → candidate.

#### D. Training load / ACWR

- Compute rolling and EWMA ACWR for primary load (session RPE×duration and/or tennis external load).
- Triggers:
  - ACWR \(> 1.5\) → Tier-2 candidate (danger zone).
  - ACWR \(> 1.3\) **and** readiness \(z<-1\) → Tier-2.
  - ACWR \(< 0.8\) for ≥7 days in prep block → Tier-1 “underloading” (lower priority than overload).
- Week-to-week acute spike: acute load > 1.5 × prior-week acute → candidate even if ACWR math is soft.

#### E. First-serve percentage (tennis)

- Baseline: last 8–12 matches or 28-day hitting sessions; use match-type stratification (comp vs practice) if enough n.
- TE: estimate from match-to-match SD; SWC = \(0.2 \times \sigma_{\text{between}}\) or \(0.3\times\mathrm{CV}\) if individual-performance framing.
- Trigger: rolling 3-match first-serve % below \(\mu - \max(\mathrm{SWC},\, \mathrm{TE})\) **and** sample size ≥30 serves/match equivalent.
- Suppress single-match blips unless \(z\le -2.5\) in a final/semifinal.

#### F. Biomarker out-of-range

- Use **lab reference intervals** + athlete personal baseline when ≥3 historical points.
- Trigger: value outside clinical reference **or** \(z\ge 2.5\) personal with physician-configured critical flags.
- Always Tier-2 minimum; critical flags → Tier-3 interruptive to coach (+ care pathway disclaimer).
- Never LLM-invent clinical advice; narration = “flag for medical staff review” template.

### 10.3 Newsworthiness score

Normalize each component to \([0,1]\):

\[
N = 0.35\,E + 0.25\,C + 0.25\,A + 0.15\,V
\]

| Component | Definition |
|-----------|------------|
| \(E\) effect size | \(\min(1, |z|/3)\) or \(\min(1, |x-\mu|/(2\cdot\mathrm{SWC}))\); ACWR: map 1.3→0.5, 1.5→0.8, 2.0→1.0 |
| \(C\) confidence | Data quality: completeness, TE usefulness, multi-signal agreement (0.5 + 0.25 per corroborating metric, cap 1) |
| \(A\) actionability | Rubric: clear CTA in next 72h (1.0), monitor only (0.3), none (0) — **set by detector taxonomy**, not LLM |
| \(V\) novelty | 1.0 new transition; 0.6 new corroboration; 0.3 still true but cooling down; 0 if cooldown blocked |

**Publish thresholds:**

| Destination | Min \(N\) |
|-------------|-----------|
| Silent log | \(N \ge 0\) (all detections) |
| Athlete card | \(N \ge 0.55\) |
| Coach digest | \(N \ge 0.60\) |
| Soft pin / email | \(N \ge 0.72\) |
| Interruptive push | \(N \ge 0.85\) **and** Tier ≥3 criteria |

Competition-day modifier: multiply \(E\) by 1.15 for readiness/HRV/sleep/ACWR (cap 1).

### 10.4 Rate limits (recommended)

| Cap | Value | Rationale |
|-----|-------|-----------|
| Published insights / athlete / week | **3** | Wearable push fatigue crossover ~5/week; leave headroom for human messages |
| Published insights / athlete / day | **1** (2 if Tier-3) | Ritual, not firehose |
| Coach digest items / day | **7** (hard), prefer **5** | Working-memory-friendly; cluster rest |
| Interruptive pushes / coach / day | **2** | CDS: interruptive must be rare |
| Interruptive pushes / athlete / week | **1** | Avoid cry-wolf on one athlete |
| Silent logged events | Unlimited | For eval / CUSUM continuity |

If more candidates than cap: sort by \(N\), then severity, then actionability; drop remainder to silent or weekly pack.

### 10.5 Deduplication and cooldown (engine defaults)

- Fingerprint: `sha256(athlete_id | insight_type | direction | band)`.
- Cooldown 72h same fingerprint; 5 days same type unless escalation.
- Merge multi-metric stories into **one** insight when they share a root cause template (e.g., “recovery deficit”: HRV + sleep + readiness) — detector emits `composite_id`.
- Coach digest clustering when ≥3 athletes share type.

### 10.6 Escalation ladder

| Level | Condition | Surface |
|-------|-----------|---------|
| L0 Silent | Detection only / \(N\) below card threshold | DB only |
| L1 Card | \(N\ge0.55\) | Athlete home insight card |
| L2 Digest | \(N\ge0.60\) | Coach daily digest row |
| L3 Pin | \(N\ge0.72\) or ACWR>1.5 or biomarker OOR | Digest top + optional email |
| L4 Push | \(N\ge0.85\) and (readiness \(z\le-2\) on match-day **or** biomarker critical **or** ACWR>1.5 ∧ readiness \(z\le-1.5\)) | Mobile push to coach (and athlete if configured) |

LLM narration runs only for L1+.

### 10.7 Fatigue monitoring → automatic response

| Signal (14-day rolling) | Automatic response |
|------------------------|--------------------|
| Insight-type dismiss >60% and action <10% (n≥50) | Raise that type’s publish threshold by +0.10; notify eng dashboard |
| Coach digest open rate <25% | Reduce digest cap 7→5; tighten \(N\) to 0.65 |
| Push dismiss >50% | Disable L4 for that coach 7 days; leave L2/L3 |
| Athlete category opt-out | Honor immediately; keep L0 logging |
| Global false-alarm audit >25% | Freeze new insight types; sports-sci review |

---

## 11. Worked volume example (why this matters)

Naive: 500 athletes × 1 insight/night = **500 coach-facing items/day** → guaranteed fatigue (CDS 80–90% override territory).

With detectors + \(N\ge0.60\) + 3/athlete/week + digest cap 7:

- Expect rough order **5–15%** of athletes to clear publish bar on a typical night → 25–75 candidates.
- Digest keeps **top 7**; rest silent or athlete-only card.
- Coach sees a short, ranked list — structurally closer to Partners’ tiered DDI success than to unfiltered CPOE soft alerts.

---

## 12. Implementation checklist (non-code)

1. Build baseline store (per athlete, per metric, mesocycle-aware).
2. Implement detectors with unit tests on synthetic series (known SWC crossings, CUSUM trips).
3. Persist all `CandidateEvent`s including suppressed.
4. Newsworthiness + rate limiter as pure functions (no I/O).
5. LLM narration with `event_id` foreign key mandatory; refusal path.
6. Instrument dismiss/action/opt-out from day one.
7. Weekly auto-tune job for insight-type thresholds.
8. Sports scientist review of top dismissed types monthly.

---

## 13. Source index (primary URLs)

### Clinical alert fatigue
- https://doi.org/10.1016/j.ijmedinf.2025.106011
- https://doi.org/10.2196/preprints.88578
- https://doi.org/10.1177/14604582241263242
- https://doi.org/10.3233/shti220101
- https://doi.org/10.1016/j.mayocp.2023.05.025
- https://pmc.ncbi.nlm.nih.gov/articles/PMC2605599/
- https://www.mindbowser.com/reduce-cdss-alert-fatigue-clinical-decision-support/
- https://smart.osu.edu/the-toolkit/ehr-alerts/

### Consumer products
- https://ouraring.com/blog/inside-the-ring-the-story-behind-ouras-daily-insight-messages/
- https://support.ouraring.com/hc/en-us/articles/360025579173-Managing-Your-Notifications
- https://www.whoop.com/us/en/thelocker/a-new-way-to-see-insights-on-which-behaviors-affect-your-recovery/
- https://www8.garmin.com/manuals/webhelp/GUID-2CF5620C-E585-4E0A-9CC3-9565533EEE4D/EN-US/GUID-EB335B47-6770-4A06-8EEC-8E0355507102.html
- https://www.superage.app/en/blog/apple-health-vs-oura-vs-whoop-apps/
- https://init.cise.ufl.edu/wp-content/uploads/sites/775/2021/04/MyTrackAppSurvey-cameraReady-final.pdf

### Newsworthiness / hybrid LLM architectures
- https://www.zenml.io/llmops-database/ai-powered-real-estate-transaction-newsworthiness-detection-system
- https://www.journalismai.info/blog/ks946agrwqogayiiu7etftk6bom8fo
- https://arxiv.org/pdf/2509.25491
- https://aclanthology.org/2026.acl-demo.44.pdf

### Sports science statistics
- http://sportsci.org/jour/04/wghtests.htm
- https://sportsci.org/2017/wghtrend.htm
- https://www.scienceforsport.com/smallest-worthwhile-change/
- https://elementssystem.com/wp-content/uploads/2018/06/Buccheit.pdf
- https://doi.org/10.3390/jfmk9020093
- https://doi.org/10.3390/s26010003
- https://link.springer.com/article/10.1186/s13102-025-01332-x
- https://www.scienceforsport.com/acutechronic-workload-ratio/
- https://www.itl.nist.gov/div898/handbook/pmc/section3/pmc323.htm

### Multiple comparisons & product fatigue analytics
- https://www.biostathandbook.com/multiplecomparisons.html
- https://pmc.ncbi.nlm.nih.gov/articles/PMC4333023/
- https://statisticsfundamentals.com/hypothesis-testing/bonferroni-correction/
- https://www.courier.com/blog/what-is-alert-fatigue
- https://www.courier.com/blog/how-to-reduce-notification-fatigue-7-proven-product-strategies-for-saas
- https://panther.com/blog/what-is-alert-fatigue

---

## 14. Bottom line

Clinical systems that alert on everything see **~80–90% overrides**. Consumer winners show a **daily score by default** and treat *insights* as prioritized exceptions. For PPD: **stats decide whether, LLM decides how**; publish only when newsworthiness clears ~0.55–0.60 with hard caps (**3/athlete/week**, **7 digest items**), cooldowns, and a dismiss-driven feedback loop that demotes noisy insight types automatically. Silence is a feature.
