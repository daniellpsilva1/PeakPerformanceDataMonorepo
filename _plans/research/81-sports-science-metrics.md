# Research Dossier 81 — Sports-Science Ground Truth for Athlete Monitoring Metrics

**Scope:** External literature review defining one authoritative version of each monitoring metric for a tennis-academy performance platform.  
**Architectural rule:** Deterministic code computes every physiological number; the LLM only narrates.  
**Date:** 2026-08-02  
**Method:** Primary papers, consensus statements, and methodological critiques via web search / fetch. No local algorithm audit in this file (see dossier 23 for codebase inventory).

---

## Executive verdict (read this first)

| Metric | Defensible for product? | Canonical stance |
|--------|-------------------------|------------------|
| **lnRMSSD + 7-day mean/CV + personal SWC** | **Yes — prefer** | Gold-standard field HRV interpretation (Plews/Buchheit) |
| **Personal HRV z-score / SWC bands** | **Yes — prefer** | Required for individual alerting; never use population cut-offs alone |
| **session-RPE load (Foster)** | **Yes — prefer** | Best cross-mode internal load for tennis academies |
| **Foster monotony & strain** | **Yes — with caveats** | Descriptive load-distribution metrics; illness association historical, not causal certainty |
| **CTL / ATL / TSB (EWMA fitness–fatigue)** | **Yes — with caveats** | Useful load history / freshness indicator; not a performance predictor without gain terms |
| **Bannister / Edwards TRIMP** | **Yes — secondary** | Keep if HR available; never mix units with sRPE or vendor load |
| **Vendor training load (Garmin etc.)** | **Passthrough only** | Label as proprietary; do not equate to TRIMP or sRPE |
| **Sleep duration / debt / efficiency (age-specific targets)** | **Yes — with age bands** | Duration & efficiency trends OK; staging is not |
| **Subjective wellness (ASRM)** | **Yes — elevate** | Often outperforms device readiness; must not be subordinated to Body Battery–style scores |
| **ACWR (any formulation) for injury prediction** | **Not defensible as causal/injury metric** | Serious published statistical criticism; do not claim injury risk from ACWR |
| **Device “readiness / recovery / Body Battery” composites** | **Weak — reconsider as primary** | Opaque; not interchangeable; communicate uncertainty; prefer raw HRV + wellness + sleep duration |
| **Wearable sleep staging (light/deep/REM %)** | **Not defensible for coaching decisions** | Validation shows poor stage agreement vs PSG |

---

## 1. HRV-guided training (lnRMSSD)

### 1.1 Authoritative definition

**Metric:** Natural log of the root-mean-square of successive RR-interval differences.

\[
\text{RMSSD} = \sqrt{\frac{1}{N-1}\sum_{i=1}^{N-1}(RR_{i+1}-RR_i)^2}
\]

\[
\ln\text{RMSSD} = \ln(\text{RMSSD})
\]

**Why log-transform:** RMSSD is right-skewed; ln stabilizes variance, reduces influence of extreme days, and makes day-to-day comparisons more linear for SWC/effect-size interpretation. Plews et al. recommend **lnRMSSD** (not raw RMSSD, not HF power) as the field standard because time-domain RMSSD has far lower CV than frequency-domain HF (~12% vs ~52% in cited athlete work).

### 1.2 Rolling mean and coefficient of variation

| Derived metric | Formula | Purpose |
|----------------|---------|---------|
| **7-day mean** | \(\overline{\ln\text{RMSSD}}_{7d} = \frac{1}{n}\sum_{d\in W}\ln\text{RMSSD}_d\) where \(W\) is last 7 calendar days with valid recordings | Smooths daily noise; tracks adaptation better than single-day values |
| **Weekly CV** | \(\text{CV} = (\text{SD}/\text{mean})\times 100\) of daily lnRMSSD within the same week | Captures day-to-day autonomic perturbation (acute recovery stress) |

**Key finding (Plews thesis / IJSPP line of work):** Isolated daily lnRMSSD correlates poorly with fitness/performance change; **averaging ≥3–5 days (ideally ~7)** recovers large correlations with adaptation markers. Prefer ≥3–5 morning recordings/week for a valid weekly mean; do not guide load from a single noisy day.

**Fixed week vs rolling window:** Fixed Mon–Sun (or Sun–Sat) mean+CV suits longitudinal adaptation review; **rolling 7-day mean** suits daily guided-training decisions. Document which the product uses — they are not identical.

### 1.3 Smallest worthwhile change and interpretation bands

**Baseline:** Collect during a light/normal training week (≥7 days preferred), same posture/protocol (typically morning, supine or seated, short ~1 min ultra-short RMSSD OK if validated device).

**SWC (Plews/Buchheit practice):**

\[
\text{SWC}_{\ln\text{RMSSD}} = 0.5 \times \text{CV}_{\text{baseline}}
\]

(alternatively expressed as ±0.5 × individual baseline SD when working in absolute ln units)

**Interpretation bands (individualized):**

| Band | Rule | Practical reading |
|------|------|-------------------|
| **Within SWC** | 7-day mean inside baseline ± SWC | Expected noise / stable |
| **Possibly meaningful** | Outside SWC but uncertainty overlaps (use 90% CL when available) | Caution; confirm with wellness/load |
| **Likely maladaptation** | Sustained ↓ of 7-day mean below −SWC during overload | Consider reducing intensity/volume |
| **Positive adaptation / parasympathetic rebound** | Sustained ↑ above +SWC (esp. into taper) | Often desirable; watch for “saturation” in elites |
| **High CV week** | Elevated weekly CV with flat/falling mean | Unstable autonomic state; prioritize recovery signals |

**Elite caveat:** Very high lnRMSSD with high RR interval can reflect parasympathetic saturation; Plews recommends also tracking **lnRMSSD:RR ratio** trends in elites.

### 1.4 Recent updates (2024–2026 narrative)

Mobile/wearable HRV reviews continue to endorse: (1) lnRMSSD or RMSSD, (2) weekly mean + CV, (3) individual baselines, (4) guided training vs reacting to single days. Many consumer devices hide raw RR / report opaque “HRV scores” — platforms should prefer **raw or ms RMSSD** and compute ln + SWC themselves.

### 1.5 Citations

- Plews DJ, Laursen PB, Stanley J, Kilding AE, Buchheit M. Training adaptation and heart rate variability in elite endurance athletes: opening the door to effective monitoring. *Sports Med.* 2013;43:773–781. https://doi.org/10.1007/s40279-013-0071-8  
- Plews DJ et al. / Buchheit IJSPP elite rower case work (SWC = 0.5 × baseline CV). PDF mirror: https://mart1buch.wordpress.com/wp-content/uploads/2016/09/plews-ijspp-2016.pdf  
- Flatt AA, Esco MR. Evaluating individual training adaptation with smartphone-derived heart rate variability in a collegiate female soccer team. *J Strength Cond Res.* 2016 (CV lnRMSSD as training-response marker).  
- Narrative review (mobile HRV, 2026): https://pmc.ncbi.nlm.nih.gov/articles/PMC12787763/ and https://www.mdpi.com/1424-8220/26/1/3  

---

## 2. Acute:chronic workload ratio (ACWR)

### 2.1 Original formulation (what people usually mean)

Popularized via Hulin/Gabbett/Blanch team-sport papers (~2014–2016) and IOC load consensus visibility:

\[
\text{ACWR} = \frac{\text{Acute load (typically last 7 days)}}{\text{Chronic load (typically mean of prior 28 days, or 4× weekly loads)}}
\]

Often implemented as **coupled** rolling averages: the acute week is also inside the chronic window (mathematical coupling).

**Historically popular “sweet spot” narrative:** ~0.8–1.3 “optimal”; >1.5 “spike / danger.” This figure was widely propagated (including via Blanch & Gabbett editorials and IOC consensus graphics) and is the band many products still hard-code.

### 2.2 Rolling average vs EWMA debate

| Model | Idea | Claim from proponents |
|-------|------|------------------------|
| **Rolling average (RA)** | Equal weight to each day in 7- and 28-day windows | Simple; matches early ACWR papers |
| **EWMA** (Williams et al. 2017; Murray et al. 2017) | Decay weights; recent load matters more: \(\text{EWMA}_t = \lambda L_t + (1-\lambda)\text{EWMA}_{t-1}\), \(\lambda=2/(N+1)\) with N≈7 acute / ≈28 chronic | More physiologically plausible; more “sensitive” to spikes in observational injury studies |

**Product implication:** Even *among* ACWR believers, RA and EWMA disagree on whether an athlete is inside the “sweet spot.” If you show ACWR at all, you must name the model and never mix them.

### 2.3 The substantial criticism (report fairly — this changes product policy)

Independent methodologists (Impellizzeri, Coutts, Lolli, Batterham, Ward, McCall, et al.) argue ACWR is **statistically and conceptually flawed** for injury-risk decision-making:

1. **Mathematical coupling / spurious correlation** — Acute load is part of chronic load in coupled formulations, inducing artifactual associations (Lolli et al., *BJSM*).  
2. **Ratio scaling fails** — Even “uncoupled” ratios do not validly normalize numerator by denominator; ratios create statistical artifacts (Impellizzeri training-load series; Lolli “inaccurate scaling index”).  
3. **No established causal effect** — Observational associations ≠ justification to manipulate ACWR to reduce injuries; no adequate causal identification (Impellizzeri et al., *IJSPP* 2020: “Conceptual Issues and Fundamental Pitfalls”).  
4. **Sweet-spot figure flawed** — Formal requests for retraction/errata of the iconic ACWR–injury likelihood figure (Impellizzeri et al. OSF preprint).  
5. **Inconsistent directionality** — Some studies find higher ACWR → higher injury; others opposite; selective citation common (Impellizzeri Part 2, *J Athl Train* 2020).  
6. **Dismiss the theory** — “Time to Dismiss ACWR and Its Underlying Theory” (*Sports Med* 2021 line of critique).

**Fair synthesis:** Early team-sport papers reported associations between load “spikes” and injury. Subsequent independent critique shows those associations are contaminated by ratio math, coupling, researcher degrees of freedom, and absence of causal design. **EWMA does not rehabilitate the ratio** — it only changes temporal weighting of a flawed construct.

### 2.4 Platform recommendation (hard)

- **Do not** use ACWR as an injury-prediction or “risk %” metric.  
- **Do not** let the agent say “your injury risk is elevated because ACWR is 1.6.”  
- If a relative-load sparkline is commercially required, label it **“7-day vs 28-day load ratio (descriptive only; not an injury predictor)”** and prefer showing **acute and chronic loads as separate series** (or CTL/ATL) instead of a ratio.  
- Prefer **sRPE weekly totals, monotony/strain, and EWMA CTL/ATL** over ACWR for load storytelling.

### 2.5 Citations

- Hulin BT et al. The acute:chronic workload ratio predicts injury… *BJSM* 2016. https://bjsm.bmj.com/content/50/4/231  
- Blanch P, Gabbett TJ. Has the athlete trained enough… *BJSM* 2016.  
- Murray NB et al. EWMA ACWR more sensitive… *BJSM* 2017;51:749–754. https://bjsm.bmj.com/content/51/9/749  
- Williams S et al. Better way to determine ACWR (EWMA proposal). *BJSM* correspondence.  
- Lolli L et al. Mathematical coupling… *BJSM* 2019;53:921. https://bjsm.bmj.com/content/53/15/921  
- Impellizzeri FM et al. Acute:Chronic Workload Ratio: Conceptual Issues and Fundamental Pitfalls. *IJSPP* 2020. https://doi.org/10.1123/ijspp.2019-0864  
- Impellizzeri FM et al. Training Load and Its Role in Injury Prevention, Part 2. *J Athl Train* 2020. https://pmc.ncbi.nlm.nih.gov/articles/PMC7534938/  
- Impellizzeri et al. The ACWR-injury figure and its ‘sweet spot’ are flawed. OSF: https://doi.org/10.31236/osf.io/gs8yu  
- Wang et al. ACWR systematic review/meta-analysis (2025) — still mixed; does not erase methodological critique. https://doi.org/10.1186/s13102-025-01332-x  

---

## 3. Training load quantification

### 3.1 session-RPE (Foster)

\[
\text{sRPE load (AU)} = \text{CR-10 session RPE} \times \text{duration (min)}
\]

- Collect ~10–30 min post-session (whole-session rating, not peak momentary RPE).  
- Rest days **must** be recorded as **0** (critical for monotony SD).  
- Valid across modes (court, gym, conditioning) — decisive advantage for tennis academies.

**Primary refs:** Foster et al. *MSSE* / Foster monitoring reviews; Haddad et al. 2017 Frontiers review.  
- https://www.frontiersin.org/journals/neuroscience/articles/10.3389/fnins.2017.00612/full  
- Foster C. Monitoring training loads… https://umh1617.umh.es/files/2016/05/2017-Foster-Monitoring-Training-Loads.-The-Past-the-Present-and-the-Future.pdf  

### 3.2 Bannister TRIMP

Classic impulse using duration × HR reserve × lactate-curve weighting (sex-specific exponential):

\[
\text{bTRIMP} \propto t \times \Delta\text{HR}_{\text{ratio}} \times e^{b\cdot\Delta\text{HR}_{\text{ratio}}}
\]

Requires resting & max HR; assumes relatively steady-state aerobic work. Weak for intermittent tennis and resistance sessions.

### 3.3 Edwards TRIMP

Zone-weighted minutes:

| Zone (% HRmax) | Weight |
|----------------|--------|
| 50–60% | ×1 |
| 60–70% | ×2 |
| 70–80% | ×3 |
| 80–90% | ×4 |
| 90–100% | ×5 |

\[
\text{eTRIMP} = \sum_z (\text{minutes in zone}_z \times \text{weight}_z)
\]

Simpler than Bannister; still HR-dependent and mode-limited.

### 3.4 Proprietary vendor loads (Garmin Training Load, WHOOP Strain, etc.)

Opaque algorithms (often EPOC-like or proprietary “strain”). **Not calibrated to sRPE or TRIMP AU.** Different wearables on the same athlete disagree.

### 3.5 Why they are not interchangeable — platform rule

| Rule | Rationale |
|------|-----------|
| **One internal-load currency per athlete view** | Mixing Garmin TL + sRPE + TRIMP in one ACWR/CTL series is scientifically meaningless |
| **Prefer sRPE as academy system-of-record** | Works for tennis + gym + matches without HR |
| **Vendor load = labeled passthrough** | Show as “Garmin Training Load” never as “TRIMP” |
| **If HR TRIMP available, keep parallel track** | Correlate within athlete; do not convert with a magic factor |
| **Never average across vendors** | Different scales |

---

## 4. Foster monotony and strain

### 4.1 Formulas

For 7 daily loads \(L_1\ldots L_7\) (rest = 0):

\[
\text{Monotony} = \frac{\overline{L}}{\text{SD}(L)}
\]

\[
\text{Weekly load} = \sum L_i
\]

\[
\text{Strain} = \text{Weekly load} \times \text{Monotony}
\]

### 4.2 Evidence and bands (historical, use cautiously)

Foster (1998) linked high monotony (often cited **>2.0**) combined with high load/strain (strain often cited **>6000 AU** in swimming/team-sport secondary literature) to increased **illness** incidence — **not** a validated universal injury predictor.

| Metric | Commonly cited bands | Evidence strength |
|--------|----------------------|-------------------|
| Monotony | <1.5 lower concern; 1.5–2.0 caution; >2.0 high monotony | Moderate historical association with illness when load also high |
| Strain | <3500 / 3500–6000 / >6000 AU (sRPE weeks) | Context-dependent; scale depends on how hard athletes rate |

**Agent must not claim:** “Monotony >2 causes injury.”  
**Agent may say:** “Load was very similar every day this week (high monotony); historically that pattern plus high total load has been associated with higher illness rates in some athlete cohorts.”

**Citation:** Foster C. Monitoring training in athletes with reference to overtraining syndrome. *Med Sci Sports Exerc.* 1998;30(7):1164–1168.

---

## 5. Fitness–fatigue modelling: CTL, ATL, TSB

### 5.1 Origin

Banister / Calvert impulse–response model (1970s): performance ≈ fitness − fatigue, each a first-order system with different time constants. TrainingPeaks “Performance Manager” popularized simplified EWMA proxies **without** the original gain constants \(k_1,k_2\).

### 5.2 Canonical EWMA definitions (TrainingPeaks conventions)

Using daily training units \(w_t\) (TSS, TRIMP, or **consistently** sRPE-day totals):

\[
\text{CTL}_t = \text{CTL}_{t-1} + (w_t - \text{CTL}_{t-1})\cdot\frac{1}{42}
\]

\[
\text{ATL}_t = \text{ATL}_{t-1} + (w_t - \text{ATL}_{t-1})\cdot\frac{1}{7}
\]

\[
\text{TSB}_t = \text{CTL}_{t-1} - \text{ATL}_{t-1}
\]

| Metric | Meaning | Default τ | Min history |
|--------|---------|-----------|-------------|
| **CTL** | Chronic / “fitness” proxy | 42 d | Prefer ≥42 d; trends usable earlier with ramp-up bias warning |
| **ATL** | Acute / “fatigue” proxy | 7 d (3–7 used; shorter in fast-recovering youth) | ≥7–14 d |
| **TSB** | “Form” / freshness proxy | — | Same as CTL/ATL |

### 5.3 Caveats (mandatory)

1. **TSB is not Banister performance** — gain terms removed; freshness ≠ predicted match outcome.  
2. **Time constants are population defaults**, not individualized tennis constants.  
3. **Unit dependence** — CTL from Garmin TL ≠ CTL from sRPE.  
4. **Ramp-up artifact** — first ~6 weeks of CTL are unstable if starting from 0.  
5. **Youth** — may recover faster (shorter ATL τ), but evidence for sport-specific τ is thin; document chosen constants.

**Citations:**  
- Calvert TW, Banister EW, Savage MV, Bach T. A systems model… *IEEE Trans Syst Man Cybern.* 1976. https://doi.org/10.1109/TSMC.1976.5409179  
- TrainingPeaks science explainer: https://www.trainingpeaks.com/learn/articles/the-science-of-the-performance-manager/  

---

## 6. Readiness / recovery composites

### 6.1 What evidence supports combining

A **mixed-methods** panel is defensible:

1. **Subjective wellness** (sleep quality, fatigue, soreness, mood, stress) — often most sensitive  
2. **lnRMSSD 7-day mean vs personal SWC** — autonomic trend  
3. **Sleep duration vs age-specific need** — recovery substrate  
4. **Internal load context** (sRPE week, ATL/CTL or weekly load) — dose context  

Blind weighted averages of proprietary wearable scores (Body Battery + “training readiness” + stress) **without** individual baselines are **not** evidence-based composites.

### 6.2 Subjective measures often outperform devices

**Saw et al. (BJSM 2016) systematic review** (56 studies): subjective self-report measures reflected acute and chronic training load with **superior sensitivity and consistency** vs common objective markers (HR, blood, etc.); subjective and objective measures **generally did not correlate**.

Later integrative reviews (e.g., Sports Medicine – Open 2022 “Subjective Outperforms Objective Monitoring”) argue subjective monitoring integrates multi-channel organism–environment information that fragmented device metrics miss.

**Product implication for a device-heavy UI:** Elevate daily wellness questionnaires to first-class readiness inputs. Do **not** let Garmin/WHOOP recovery scores silently dominate a composite while wellness is decorative. When they disagree, **prefer investigating wellness + HRV trend + sleep duration**, and say so.

**Citations:**  
- Saw AE, Main LC, Gastin PB. Monitoring the athlete training response… *BJSM* 2016;50:281–291. https://doi.org/10.1136/bjsports-2015-094758 https://bjsm.bmj.com/content/50/5/281  
- Montull et al. Integrative proposals… subjective outperforms objective. *Sports Med Open* 2022. https://link.springer.com/article/10.1186/s40798-022-00432-z  

---

## 7. Sleep

### 7.1 Recommended durations by age (authoritative)

**American Academy of Sleep Medicine (pediatric consensus):**

| Age | Recommended sleep / 24 h |
|-----|---------------------------|
| 6–12 years | **9–12 h** |
| 13–18 years | **8–10 h** |
| Healthy adults (NSF/AASM) | **7–9 h** |

**Athletes:** Walsh et al. 2021 BJSM expert consensus — use age ranges above as baseline; many practitioners speculate athletes may need **more** than general-population minimums under heavy load; elite cohorts often **obtain** ~6.5–7 h despite higher self-reported need (~8+ h). For academies, **default adolescent target = 8–10 h**, not 7 h.

**Critical product bug to avoid:** Hard-coding sleep debt against **7 h** for a 15-year-old is wrong; **8 h floor / mid-band of 8–10** is the minimum defendable default for teens; adults 7–9 with individual preference.

**Citations:**  
- Paruthi S et al. AASM pediatric sleep duration consensus. https://aasm.org/resources/pdf/pediatricsleepdurationconsensus.pdf https://pmc.ncbi.nlm.nih.gov/articles/PMC5078711/  
- AASM teen advisory: https://aasm.org/advocacy/position-statements/teen-sleep-duration-health-advisory/  
- Walsh NP et al. Sleep and the athlete… *BJSM* 2021. PDF: https://www.sportgeneeskunde.com/wp-content/uploads/Br-J-Sports-Med-2021-Walsh-consensus-statement-sleep-and-the-athlete.pdf  

### 7.2 Sleep debt (canonical operationalization)

No single universal formula; for monitoring platforms use:

\[
\text{Nightly debt} = \max(0,\ \text{Target}_ {\text{age/individual}} - \text{TST})
\]

\[
\text{Rolling debt}_{7d} = \sum_{i=1}^{7}\text{Nightly debt}_i
\]

Optionally allow negative “credit” nights only if product policy explicitly supports banked recovery sleep; default **no negative debt** (simpler, less gameable).

**Target selection order:** (1) athlete-stated need if collected, else (2) age-band midpoint (teen 9 h; adult 8 h), else (3) age-band floor (teen 8 h; adult 7 h) — and **label which**.

### 7.3 Sleep efficiency

\[
\text{SE (\%)} = \frac{\text{TST}}{\text{Time in bed}} \times 100
\]

| SE | Interpretation |
|----|----------------|
| ≥85% | Common clinical/athletic threshold for acceptable efficiency |
| <85% | Flag possible fragmented sleep (not a diagnosis) |
| ≥90% | Often described as very good |

Athlete meta-analyses report mean SE ~86%, with **youth athletes often lower** (~80% in some pooled data).

### 7.4 Consumer wearable sleep staging — known poor validity

**Chinoy et al., Sleep 2021** (7 devices vs PSG): high sensitivity for sleep (≥0.93), **low–medium specificity for wake** (0.18–0.54); **stage classification mixed/inconsistent**; worse on disrupted nights; Garmin devices among weaker sleep/wake performers in that set.

**Miller et al. / Sensors 2022** (Apple, Garmin, Polar, Oura, WHOOP, Somfit vs PSG): two-state sleep/wake agreement ~86–89%, but **multi-state stage agreement only ~50–65%** (κ often ~0.20–0.44) — “all six devices require improvement for specific sleep stages.”

**Later wrist-worn validations (2024–2025):** κ fair–moderate for stages; wake specificity remains weak; deep/REM frequently misclassified as light.

**Agent rule:** Narrate **TST, SE, schedule regularity** with uncertainty. **Do not** coach off “you only got 12% deep sleep.”

---

## 8. Smallest worthwhile change (SWC) and typical error (TE)

### 8.1 Methodology (Hopkins foundation)

**Purpose:** Decide whether an individual’s change is practically meaningful vs noise — foundation of proactive alerting.

| Context | Default SWC |
|---------|-------------|
| Team-sport test (no direct medal model) | \(0.2 \times\) between-athlete SD (Cohen small ES) |
| Individual elite competition performance | \(0.3 \times\) competition-to-competition SD |
| Within-athlete monitoring metrics (HRV, wellness) | Often \(0.5 \times\) individual CV or SD of baseline (Plews-style for HRV; analogous individual baselines for wellness) |

**Typical error (TE):** SEM from reliability study / repeated measures; often expressed as CV%.

**Decision logic for alerts:**

1. Compute observed change \(\Delta\).  
2. Compare to **SWC** (practical relevance) and **TE** (measurement noise).  
3. Confident alert when \(|\Delta| > \text{SWC}\) **and** uncertainty accounts for TE (common heuristic: exceed SWC + TE, or use likelihood bands: possibly / likely / very likely).  
4. If TE > SWC, the metric is **too noisy for fine alerts** — widen bands or require multi-day confirmation (exactly why HRV uses 7-day means).

**Magnitude multipliers (Buchheit-style communication):** ~1× / 3× / 6× / 10× SWC → small / moderate / large / very large.

**Citations:**  
- Hopkins WG. How to interpret changes in an athletic performance test. *Sportscience* 2004. http://sportsci.org/jour/04/wghtests.htm  
- Applied summaries: https://www.globalperformanceinsights.com/post/smallest-worthwhile-change-interpreting-meaningful-change-in-athlete-monitoring  

---

## 9. Tennis-specific and youth tennis monitoring

### 9.1 What the literature supports

- Tennis load monitoring lags team sports; **sRPE + duration**, HR where available, stroke/count or IMU external load, and wellness are the practical stack (Murphy ASCA review; Fraser et al. junior tennis methods review).  
- Junior tennis: high volumes + injury concern → monitoring advocated, but **longitudinal causal load–injury evidence remains thin**.  
- HRV in junior tennis: feasible and responsive to match pressure (pre-match RMSSD ↓); correlations with match outcome often **weak** — use as recovery/autonomic context, not performance oracle (2025 young-tennis HRV study; match-pressure HRV studies).  
- One junior tennis ACWR–match-outcome model found **no relationship** between sRPE/swing-count ACWR and win% when ratios sat near 1.0 — weak support for ACWR in tennis performance.

### 9.2 Youth-specific constraints

- Sleep targets **8–10 h** (not adult 7–9).  
- Growth/maturation confounds wellness and load tolerance — interpret deviations with coach context.  
- Prefer **sRPE + wellness + sleep + lnRMSSD trends** over proprietary recovery scores.  
- Avoid injury-probability language from ACWR.

**Citations:**  
- Fraser J et al. Methods of monitoring training loads in junior tennis players. https://shura.shu.ac.uk/32992/3/Fraser-MethodsOfMonitoring%28AM%29.pdf  
- Murphy AP. Methods of external and internal TL monitoring in elite tennis. ASCA JASC.  
- Modelling relative load vs match outcome in junior tennis: https://doi.org/10.14198/jhse.2022.174.03  
- HRV match pressure junior tennis: https://pubmed.ncbi.nlm.nih.gov/35508281/  

---

## 10. Consumer wearable validation (honest error bars)

### 10.1 Heart rate (nocturnal / rest)

Generally **excellent**: ICC often ~0.98–0.99; errors ~0.3–1 bpm vs ECG in lab sleep studies (Miller et al. 2022 Sensors head-to-head).

### 10.2 HRV (nocturnal RMSSD-type)

**Dial et al. 2025 Physiological Reports** (536 nights; ECG reference):

| Device | HRV agreement (approx.) | MAPE (HRV) |
|--------|-------------------------|------------|
| Oura Gen4 | CCC ≈ 0.99 | ~6% |
| Oura Gen3 | CCC ≈ 0.97 | ~7% |
| WHOOP 4.0 | CCC ≈ 0.94 | ~8% (±10% SD) |
| Garmin Fenix 6 | CCC ≈ 0.87 | ~11% |
| Polar Grit X Pro | CCC ≈ 0.82 | ~16% (±24% SD) |

**Implication:** Personal z-scores/SWC remain valid **within one device**, but **switching vendors resets the baseline**. Garmin/Polar nocturnal HRV error can exceed a small SWC — prefer multi-day confirmation and ultra-short morning ECG-strap protocols when decisions are high-stakes.

Miller et al. 2022: WHOOP among best PPG HRV vs ECG in that lab night (SD of error ~4 ms vs much larger for some others) — still not medical-grade RR series for all use cases.

### 10.3 Sleep

| Claim | Evidence-based accuracy |
|-------|-------------------------|
| Sleep vs wake timing / TST trends | Often usable (agreement ~85–90%; high sensitivity, weak wake specificity) |
| Sleep stages | **Poor–fair**; multi-state agreement ~50–65%; do not clinical-coach on stages |
| Garmin sleep/wake (Chinoy 2021) | Performed **worse than actigraphy** in that protocol |

### 10.4 Recovery / readiness / Body Battery / Strain scores

**Largely unvalidated as constructs.** Underlying HR/HRV may be OK; the composite is a black box. NCAA/swimmer-type analyses find raw HRV/RHR more interpretable than proprietary recovery. **Agent must communicate: “vendor recovery score, not a clinical readiness diagnosis.”**

**Citations:**  
- Miller DJ et al. Validation of six wearables for sleep, HR, HRV. *Sensors* 2022;22:6317. https://doi.org/10.3390/s22166317  
- Dial MB et al. Validation of nocturnal RHR and HRV in consumer wearables. *Physiol Rep* 2025. https://doi.org/10.14814/phy2.70527  
- Chinoy ED et al. Seven consumer sleep trackers vs PSG. *Sleep* 2021;44(5):zsaa291. https://doi.org/10.1093/sleep/zsaa291 PMID 33378539  

---

## 11. Canonical metric specification table

For each metric: definition/formula, inputs & min history, interpretation bands, limitations the agent must communicate, and **explicit NOT-claims**.

### M1 — lnRMSSD (daily)

| Field | Spec |
|-------|------|
| **Definition** | \(\ln\) of RMSSD from RR intervals (ms) |
| **Inputs** | Valid RR or device RMSSD; consistent posture/time |
| **Min history** | 1 day (display); do not alone drive load |
| **Bands** | No universal ms cut-off — individual only |
| **Limitations** | Protocol noise, PPG error, plasma volume artifacts after long heat sessions |
| **MUST NOT claim** | “HRV 65 ms means you are recovered” (absolute cut-offs); clinical autonomic diagnosis |
| **Citation** | Plews et al. 2013 *Sports Med* |

### M2 — 7-day lnRMSSD mean & CV

| Field | Spec |
|-------|------|
| **Definition** | Mean and CV% of daily lnRMSSD over 7 days (fixed week or rolling — pick one and document) |
| **Inputs** | ≥3–5 valid days/week recommended |
| **Min history** | 7 days with adequate sampling |
| **Bands** | Compare mean to baseline ± SWC; flag high CV weeks |
| **Limitations** | Missing days bias the mean; rolling ≠ calendar week |
| **MUST NOT claim** | Single missed day “proves” overtraining |
| **Citation** | Plews thesis / Flatt & Esco; 2026 mobile HRV review |

### M3 — HRV SWC / personal z-score

| Field | Spec |
|-------|------|
| **Definition** | \(\text{SWC}=0.5\times CV_{baseline}\); z = (current 7d mean − baseline mean)/baseline SD |
| **Inputs** | Baseline light week ≥7 days; ongoing daily HRV |
| **Min history** | Baseline week + ongoing |
| **Bands** | \|z\| < ~0.5 trivial; beyond SWC possibly meaningful; sustained multi-day beyond SWC actionable |
| **Limitations** | Baseline must be recomputed after device change or long layoff |
| **MUST NOT claim** | Population percentile HRV as readiness |
| **Citation** | Plews/Buchheit IJSPP practice; Hopkins SWC framework |

### M4 — session-RPE training load

| Field | Spec |
|-------|------|
| **Definition** | CR-10 × minutes (AU) |
| **Inputs** | Post-session RPE + duration; rest day = 0 |
| **Min history** | Per session; weekly sums need 7 days including zeros |
| **Bands** | Individual norms via SWC on weekly totals; no universal “good” AU |
| **Limitations** | Anchoring/education effects; honesty/compliance |
| **MUST NOT claim** | sRPE AU equals Garmin TL or TRIMP |
| **Citation** | Foster; Haddad 2017 |

### M5 — Bannister TRIMP / Edwards TRIMP

| Field | Spec |
|-------|------|
| **Definition** | See §3.2–3.3 |
| **Inputs** | HR time series + HRrest/HRmax (Bannister); zone minutes (Edwards) |
| **Min history** | Per session |
| **Bands** | Individual only |
| **Limitations** | Poor for gym/tennis intermittency; needs accurate max HR |
| **MUST NOT claim** | Interchangeable with sRPE; superior “objective truth” for tennis |
| **Citation** | Banister 1991; Edwards 1993; Foster monitoring review |

### M6 — Vendor training load

| Field | Spec |
|-------|------|
| **Definition** | Proprietary (passthrough) |
| **Inputs** | Vendor API |
| **Min history** | Vendor-defined |
| **Bands** | Vendor UI bands only; do not rebrand as TRIMP |
| **Limitations** | Opaque; cross-vendor incomparable |
| **MUST NOT claim** | Scientifically standardized load; injury threshold |
| **Citation** | Treat as engineering artifact; see wearable validation §10 |

### M7 — Foster monotony

| Field | Spec |
|-------|------|
| **Definition** | mean daily load / SD daily load (7 days, zeros included) |
| **Inputs** | Daily sRPE loads |
| **Min history** | 7 days |
| **Bands** | <1.5 / 1.5–2.0 / >2.0 (heuristic) |
| **Limitations** | SD→0 explodes value; illness association ≠ causation; AU-scale dependent for strain |
| **MUST NOT claim** | Injury prediction; universal clinical cut-off |
| **Citation** | Foster 1998 *MSSE* |

### M8 — Foster strain

| Field | Spec |
|-------|------|
| **Definition** | Weekly load × monotony |
| **Inputs** | Same as M7 |
| **Min history** | 7 days |
| **Bands** | ~6000 AU often cited as high-risk *in sRPE swimming/team literature* — recalibrate per population |
| **Limitations** | Thresholds not tennis-validated |
| **MUST NOT claim** | Definite illness/injury if >6000 |
| **Citation** | Foster 1998; secondary applied summaries |

### M9 — CTL / ATL / TSB

| Field | Spec |
|-------|------|
| **Definition** | EWMA τ=42 / τ=7; TSB=CTL−ATL (document if using prior-day convention) |
| **Inputs** | Consistent daily load currency |
| **Min history** | Prefer 42+ days; flag ramp-up |
| **Bands** | TSB: negative = relatively fatigued vs chronic; positive = relatively fresh — **individualize**, avoid dogma (+15 on race day etc.) without sport context |
| **Limitations** | Not Banister full model; not match-win predictor |
| **MUST NOT claim** | “TSB predicts you will win”; fitness VO₂ proxy |
| **Citation** | Calvert/Banister 1976; TrainingPeaks PMC methodology |

### M10 — ACWR (if retained at all)

| Field | Spec |
|-------|------|
| **Definition** | Acute(7)/Chronic(28) RA or EWMA — **must label** |
| **Inputs** | Same load unit for both |
| **Min history** | 28 days |
| **Bands** | **Do not show 0.8–1.3 as injury sweet spot** |
| **Limitations** | Coupling, ratio artifacts, no causal injury evidence |
| **MUST NOT claim** | Injury risk elevation/reduction; “validated sweet spot” |
| **Citation** | Impellizzeri IJSPP 2020; Lolli BJSM; Impellizzeri JAT 2020 — **prefer dropping** |

### M11 — Subjective wellness composite

| Field | Spec |
|-------|------|
| **Definition** | Daily Likert subscales (sleep quality, fatigue, soreness, mood, stress); sum or mean; flag vs personal SWC |
| **Inputs** | Morning ASRM; coach-supported compliance |
| **Min history** | Baseline ~7–14 days |
| **Bands** | Individual SWC (0.5× baseline SD common practice) |
| **Limitations** | Social desirability; needs psychological safety |
| **MUST NOT claim** | Wellness alone diagnoses overtraining syndrome |
| **Citation** | Saw et al. 2016 *BJSM* |

### M12 — Device readiness / recovery score

| Field | Spec |
|-------|------|
| **Definition** | Vendor black-box (passthrough) |
| **Inputs** | Vendor |
| **Min history** | Vendor |
| **Bands** | Vendor only; secondary to M2+M11+M13 |
| **Limitations** | Not validated as readiness construct; disagrees across brands |
| **MUST NOT claim** | Medical clearance; superior to athlete-reported wellness |
| **Citation** | Saw 2016; wearable validation §10 |

### M13 — Sleep duration & debt

| Field | Spec |
|-------|------|
| **Definition** | TST; debt vs age/individual target (§7) |
| **Inputs** | Wearable TST or diary; age |
| **Min history** | Nightly; 7-day debt sum for alerts |
| **Bands** | Teens 8–10 h target; adults 7–9 h; debt alerts on sustained multi-night shortfall beyond TE |
| **Limitations** | Wearables overestimate TST / miss WASO; diary bias |
| **MUST NOT claim** | Exact PSG TST; 7 h target for adolescents |
| **Citation** | AASM pediatric consensus; Walsh 2021 |

### M14 — Sleep efficiency

| Field | Spec |
|-------|------|
| **Definition** | TST/TIB × 100 |
| **Inputs** | TST + TIB |
| **Min history** | Nightly; trend weekly |
| **Bands** | ≥85% acceptable heuristic; <85% flag |
| **Limitations** | Wearable TIB/WASO errors; not a disorder diagnosis |
| **MUST NOT claim** | Insomnia diagnosis from wearable SE |
| **Citation** | Athlete sleep meta-analyses; clinical 85% convention |

### M15 — Sleep staging (light/deep/REM)

| Field | Spec |
|-------|------|
| **Definition** | Vendor stage minutes/% |
| **Verdict** | **Not defensible for coaching decisions** |
| **MUST NOT claim** | Accurate deep/REM architecture; stage-based training prescription |
| **Citation** | Chinoy 2021; Miller 2022; later wrist-worn PSG comparisons |

### M16 — SWC/TE alert engine (meta-metric)

| Field | Spec |
|-------|------|
| **Definition** | Per-metric SWC + TE gates for proactive alerts |
| **Inputs** | Reliability CV + baseline distribution per metric |
| **Min history** | Metric-specific (HRV ≥7d baseline; tests need reliability study) |
| **Bands** | Trivial / possibly / likely meaningful |
| **Limitations** | Wrong SWC constant → alert spam or blindness |
| **MUST NOT claim** | Statistical significance (p-values) from SWC alone |
| **Citation** | Hopkins 2004 *Sportscience* |

---

## 12. Metrics to reconsider or drop

### Drop or demote hard

1. **ACWR as injury-risk metric** — Methodologically not defensible for causal/injury claims (Impellizzeri et al.). If marketing demands a spike indicator, show separate acute vs chronic loads or ATL/CTL, not a ratio sold as risk.  
2. **Wearable sleep stage percentages as decision metrics** — Validation consistently poor; narrative harm > value.  
3. **Hard-coded 7 h sleep need for all athletes** — Contradicts AASM adolescent guidance.  
4. **Single blended “readiness_score” dominated by vendor Body Battery/stress** without wellness + personal HRV SWC — Conflicts with Saw et al. evidence hierarchy.

### Keep but humble

- CTL/ATL/TSB (freshness/load history, not performance prophecy)  
- Monotony/strain (distribution descriptors)  
- Vendor loads (labeled passthrough)  
- Device recovery scores (secondary, uncertain)

### Preferentially invest

- lnRMSSD 7-day mean/CV + personal SWC  
- sRPE load + monotony/strain  
- Age-aware sleep duration/debt + efficiency trends  
- Daily wellness ASRM with personal baselines  
- SWC/TE alerting discipline across all of the above  

---

## 13. Agent communication contract (summary)

1. Numbers come only from deterministic implementations of this spec.  
2. Uncertainty language must scale with device accuracy (HRV MAPE, sleep specificity).  
3. Never convert between sRPE, TRIMP, and Garmin TL.  
4. Never state injury probability from ACWR.  
5. Never prescribe from deep/REM%.  
6. When device recovery and wellness disagree, say that **subjective monitoring is often more sensitive** (Saw 2016) and present both.  
7. Adolescents: sleep targets 8–10 h unless individualized higher.

---

## 14. Source URL index (selected)

| Topic | URL |
|-------|-----|
| Plews HRV review | https://doi.org/10.1007/s40279-013-0071-8 |
| Plews IJSPP PDF | https://mart1buch.wordpress.com/wp-content/uploads/2016/09/plews-ijspp-2016.pdf |
| Mobile HRV narrative 2026 | https://pmc.ncbi.nlm.nih.gov/articles/PMC12787763/ |
| Impellizzeri ACWR pitfalls | https://doi.org/10.1123/ijspp.2019-0864 |
| Impellizzeri Part 2 | https://pmc.ncbi.nlm.nih.gov/articles/PMC7534938/ |
| Lolli coupling | https://bjsm.bmj.com/content/53/15/921 |
| Sweet-spot flawed | https://doi.org/10.31236/osf.io/gs8yu |
| Murray EWMA ACWR | https://bjsm.bmj.com/content/51/9/749 |
| Haddad sRPE review | https://www.frontiersin.org/articles/10.3389/fnins.2017.00612/full |
| Foster monitoring PDF | https://umh1617.umh.es/files/2016/05/2017-Foster-Monitoring-Training-Loads.-The-Past-the-Present-and-the-Future.pdf |
| TrainingPeaks CTL/ATL | https://www.trainingpeaks.com/learn/articles/the-science-of-the-performance-manager/ |
| Banister model | https://doi.org/10.1109/TSMC.1976.5409179 |
| Saw et al. subjective > objective | https://doi.org/10.1136/bjsports-2015-094758 |
| Subjective outperforms (2022) | https://link.springer.com/article/10.1186/s40798-022-00432-z |
| AASM pediatric sleep | https://pmc.ncbi.nlm.nih.gov/articles/PMC5078711/ |
| Walsh athlete sleep 2021 | https://www.sportgeneeskunde.com/wp-content/uploads/Br-J-Sports-Med-2021-Walsh-consensus-statement-sleep-and-the-athlete.pdf |
| Hopkins SWC | http://sportsci.org/jour/04/wghtests.htm |
| Miller wearables validation | https://doi.org/10.3390/s22166317 |
| Dial 2025 wearable HRV | https://doi.org/10.14814/phy2.70527 |
| Chinoy sleep trackers | https://doi.org/10.1093/sleep/zsaa291 |
| Junior tennis load methods | https://shura.shu.ac.uk/32992/3/Fraser-MethodsOfMonitoring%28AM%29.pdf |

---

*End of dossier 81. This file is the sports-science ground truth for reconciling inconsistent readiness/ACWR/sleep-debt/load-unit definitions before agent narration is wired to UI numbers.*
