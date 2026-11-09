# PPD AI-Native Strategy Guide

Status: research only, nothing implemented. Date: 2026-11-02.
Inputs: WearablesAI book (`~/Desktop/WearablesAI/book`), FlowState (flowstate.tennis), PadelGod (padelgod.ro), current PPD source, prior dossiers in `_plans/research/` and `ppd_research_papers/`.
Working notes (per-chapter digests, audit, teardowns) are in `/tmp/ppd-research/` (may be lost on reboot; copy if you want to keep them).

---

## 1. Where PPD really stands

PPD is "AI-assisted", not AI-native. It has a capable chat agent (about 121 tools, proposal/approval writes per ADR-0002, roster-bound identity, STT capture) but the intelligence is reactive: the user must open the app and ask.

Verified in source (2026-11-02):

| Finding | Evidence |
|---|---|
| Nightly insight batch exists but nothing schedules it | `ppp_ai_agent/agent/nightly_batch.py`, `POST /batch/nightly`; no workflow/cron references it |
| No proactive delivery (push, email, iMessage) | alerts and insights are pull-only |
| LLM-produced evidence chips are stored as fact, never checked against tool data | `nightly_batch.py` builds `EvidenceChip` directly from LLM JSON |
| Semantic memory extraction is defined but never called | `extractAndStoreMemories` has no call site |
| HealthKit only appears in UI strings, no ingestion | providers actually ingested: Garmin, Polar, Whoop, Suunto |
| ACWR and a 0-100 "Injury Risk" score are live in UI and alerts | contradicts the book and `ppd_research_papers` (ACWR critique) |
| Eval harness is regex/substring unit helpers, no LLM-in-the-loop eval | `ppp_ai_agent/eval/harness.py` |
| Models: DeepSeek primary + Groq fallback, no gateway, no tracing, no prompt versioning | `src/lib/ai/models.ts` |
| Agent service trusts the internal secret and accepts client-supplied org/athlete ids | `ppp_ai_agent/api/middleware/auth.py`, `/events/hook` |
| No ML on tennis data (no ESV, win probability, rating model), only aggregations | 36k shots sit unused |

Data reality: about 36k tennis shots, about 17 Whoop users, 1 Garmin user. That supports descriptive, within-person, baseline-style intelligence. It does not support supervised health models or foundation-model training.

Strengths to build on: the proposal/approval safety model, deterministic athlete resolution, coach-in-the-loop org model, genetics evidence-tier gating, SwingVision shot data, a real `ppd_vision` stack, and an Open Wearables deployment.

---

## 2. What the two apps teach

### FlowState (AI tennis coach "Charly")
Its edge is not model quality. It is a proactive loop:
1. A record is created or updated (sleep synced, workout imported, match mentioned).
2. Deterministic rules decide whether it is worth a message (suppress without an LLM call if not).
3. An LLM writes a short check-in from bounded context.
4. Delivery via push or iMessage, about 3 per day, timed to the user's routine, decaying if unanswered.
Also: source-linked, staged memory with a user-visible edit/forget screen; commitments ("league match Saturday") that trigger follow-ups; Apple Health as the single wearable integration (covers Watch, WHOOP, Oura, Garmin); photo/video technique feedback; meal photo macros; free tier 7 messages/day, Premium removes the cap; providers disclosed (OpenAI via Vercel AI Gateway, Gemini for vision, Perplexity Sonar for search).

PPD already has the primitives (events hook, alerts, insights table, memory tables). It lacks the delivery loop, the Apple Health path, and user-visible memory.

### PadelGod
A production example of rating governance, which is directly relevant to AI-driven match intelligence:
- Level shown as 1.0-7.0 with 7 named tiers, hidden until calibrated ("rather stay quiet than show an uncertain level").
- Only results confirmed by every player count; margin and match-length weighting; provisional high-K early; inactivity does not demote but raises uncertainty; daily growth cap; repeat-opponent decay; separate ladders per discipline/category; event-sourced replay so corrections recompute.
- Algorithm versioning with shadow testing (v3 live, v4.1 tested, promoted only if it passes all checks).
- Matchmaking by level and radius with alert throttling (about 15 km, max once per 6 h, never at night).
- Club operations, tournaments with auto-scheduling, Apple Watch scoring.

Translate to PPD as a Glicko-2-style rating engine with a policy layer, built with the same shadow-versioning discipline you would apply to any model.

---

## 3. What the book gives you (condensed)

The book is effectively a spec for a defensible wearable-AI system. The parts that matter for PPD, ranked by value over effort (full catalog of about 53 items in `/tmp/ppd-research/book/00_SYNTHESIS.md`):

1. Provenance and QC substrate: observation store with source/device/firmware/algo version, QC-as-code, idempotent event-time ingestion, reproducible feature store.
2. Transparent readiness: audited nightly HRV (lnRMSSD) pipeline with a signal-quality gate and a "refuse, don't repair" contract; robust 28-day median/MAD baseline; flag on 3 consecutive nights below -1 z; reliability-gated change classifier (noise / unclear / meaningful via TE and SWC); hierarchical shrinkage for cold-start athletes.
3. Load without ACWR: sRPE x duration, CTL/ATL/TSB as a descriptive state, monotony/strain, return-to-play logic. The book shows ACWR bands flag 14-26% of pure-noise days.
4. Sleep and circadian: deviation from personal baseline, regularity index, social jet lag; sleep staging only as relative trend.
5. Uncertainty as a feature: conformal intervals, adaptive conformal under drift, abstention ("unable to classify"), drift monitoring per device/firmware.
6. Agent architecture: orchestrator -> analyst -> allow-listed deterministic tools -> writer (claims with bindings only) -> numeric-grounding verifier (fail closed) -> coach review; claim typing with forbidden lexicon; golden-set evals; immutable audit bundles; minors policy. Runnable verifier at `book/code/ch3_03_numeric_grounding.py`.
7. Tennis analytics: Markov win-probability and point importance (30-30 and deuce are the biggest points), serve/return pack with Wilson intervals, Expected Shot Value, physio x performance fusion studies (PPD's unique niche).
8. Foundation models: do not train one at this scale. Use frozen checkpoints as feature extractors against transparent baselines with subject-wise splits; use them first for imputation and forecasting.
9. Experimentation: Bayesian N-of-1, micro-randomised nudge trials, bandits with logged propensities, stepped-wedge rollouts.
10. Regulatory framing: claims, not algorithms, make something a medical device. Use comparative wording ("below your usual range"), avoid "risk of illness/injury", keep a claims linter and an evidence dossier per feature. FDA general wellness (final 2026-01-06); EU AI Act embedded-in-device high-risk date moved to 2 Aug 2028; GDPR Art. 9 applies now.

Caveat on sourcing: the book's own SOTA file marks some regulatory items "pending". Re-verify dates before using them in legal or marketing copy.

---

## 4. What to build (organized as capability layers)

### Layer 0 - Make the existing AI trustworthy (do first, mostly small)
| Item | Why |
|---|---|
| Numeric-grounding verifier on chat and nightly batch (fail closed) | Today any invented number reaches users |
| Claims linter in CI and at output time | Removes "Injury Risk" style language; keeps wellness positioning |
| Replace ACWR bands and the 0-100 injury score with TSB + transparent multi-signal screen (components shown) | Live methodological bug; also regulatory exposure |
| Fix agent-service authorization (resolve athlete/org from verified identity, not request params) | Cross-tenant risk if the internal secret leaks |
| Memory: wire or remove extraction; route writes through proposals; add a user-visible memory screen | Dead code plus bypass of ADR-0002 |
| Provider/data-residency review for minors' health data (DeepSeek) | GDPR Art. 9 exposure |

### Layer 1 - Become proactive (the biggest "AI-native" jump)
- Event -> deterministic gate -> LLM message -> channel, replicating the FlowState loop on your `/events/hook` and alerts.
- Triggers: sleep/HRV synced, workout imported, match logged, commitment due, unanswered question follow-up.
- Channels: web push and email first; WhatsApp/iMessage later.
- Throttling and quiet hours (borrow PadelGod's alert rules), decay when unanswered, user-controlled frequency via chat.
- Schedule `nightly_batch` for real (durable scheduler; see section 5).
- Coach side: daily roster triage digest and a review inbox (the insight schema already has `requires_coach_review`).

### Layer 2 - Data substrate
- Provenance observation store, QC gate, feature store with config hashes.
- Apple Health path (read-only) to cover Watch, WHOOP, Oura, Garmin in one integration; decide whether this needs a native iOS companion.
- Populate `user_mapping` so wearable data joins with tennis data.
- sRPE and a 5-item wellness check-in (about 30 seconds) as first-class data; sRPE exists via PSE scores, wellness does not.

### Layer 3 - Defensible physiology intelligence
- Nightly HRV pipeline port, robust baselines, change classifier, cold-start shrinkage.
- Sleep deviation and regularity.
- Transparent green/yellow/red screen and a weekly coach review generator.
- Conformal intervals and an explicit "not enough data" state.

### Layer 4 - Tennis intelligence (PPD's moat)
- Now: serve/return pack, Markov point importance and win probability, shot heatmaps (CourtViz).
- Next: Expected Shot Value on `tennis_match_shots` (needs about 1k labelled points, match-wise CV), Glicko-2 rating with PadelGod-style policy layer, rally pattern baseline.
- Later: physio x performance fusion ("recovery dropped and first-serve percentage fell"), wrist-IMU stroke recognition (Silent Impact, arXiv:2507.23215), serve biomechanics from video after validation, wiring `ppd_vision` outputs into the product.

### Layer 5 - Agentic coach (after Layers 0-2)
- Deterministic tool registry; LLM only narrates.
- Conversation memory with provenance, staging (tentative -> established), and forget controls.
- Commitment tracking.
- Photo/video technique feedback via a vision model, clearly caveated.
- Voice: improve dictation only; cascaded STT -> text agent -> TTS later.
- Personal-athlete (B2C) mode: the Stripe plan and landing plan disagree on AI gating, and the tenancy model (personal org vs null org) is unresolved. Decide that before building consumer-facing AI entitlements.

### Layer 6 - Learning system
- Golden-set eval harness (100-300 cases, tool correctness, grounding, faithfulness, red-team for diagnosis/minors) run in CI per prompt/model change.
- Tracing and cost: Langfuse self-hosted (runs on ClickHouse, keeps data in the EU).
- Feedback capture from coaches (thumbs plus reason codes) feeding error analysis and prompt iteration. At this data volume, fine-tuning is not worthwhile.
- N-of-1 and nudge experiments once there is enough delivery volume.

---

## 5. Recommended engineering stack (for a small team on Next.js + FastAPI + Hetzner/Coolify)

These are research recommendations, not yet validated in your environment.
- Scheduling/durability: lightweight first (DBOS or Inngest-style) before Temporal.
- TS agents: Vercel AI SDK (check your installed version; `models.ts` imports `LanguageModelV1`, i.e. an older API).
- Python service: PydanticAI for typed tool use and structured output.
- Gateway: LiteLLM (or similar) to centralize provider routing, residency, and cost caps.
- Open Wearables MCP server exposed internally, since your backend already runs OW.
- Prompt/versioning: store prompts and model specs with versions on every insight and audit record.

---

## 6. Suggested sequencing

1. Layer 0 safety fixes plus schedule the nightly batch (shadow mode, no user delivery yet).
2. Proactive delivery for one trigger (post-session check-in) to one cohort.
3. sRPE/wellness capture, `user_mapping`, provenance store.
4. HRV pipeline, baselines, TSB; retire ACWR/injury score.
5. Markov + serve/return pack in the UI; then ESV and rating engine.
6. Apple Health integration decision.
7. Eval/tracing infrastructure in parallel from step 1.

---

## 7. Decisions needed from you

1. Primary audience for the AI: academy coaches (B2B) or individual athletes (B2C), or both with a coach-in-the-loop differentiator.
2. Tenancy model for individual athletes (personal org vs null org).
3. Apple Health: native iOS companion vs staying web/PWA with OAuth providers.
4. Channels for proactive messages (push, email, WhatsApp/iMessage).
5. LLM provider policy for minors' health data (EU residency, zero retention).
6. Wellness-only positioning (recommended) vs any regulated claim.

## 8. Open questions and unverified items

- Whether `user_mapping` is populated in production (static review cannot tell).
- Current user and data volumes (taken from docs dated mid-2026).
- Competitor claims come from their own marketing and policy pages; pricing and provider details are as published, not independently confirmed.
- Book regulatory dates flagged "pending" in its own SOTA file.
- Several of the sidekick's secondary findings (e.g. the full risk list) are in `/tmp/ppd-research/audit/gap-audit.md`; I verified only the headline items above.
