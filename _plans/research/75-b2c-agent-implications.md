# Research Dossier 75 — B2C Consumer Model Implications for the AI Agent System

**Scope:** Extract every implication for a multi-agent AI system that must serve both the existing B2B academy model (coach can approve athlete-facing output) and the planned B2C consumer model (no coach). Read-only against B2C plans + codebase verification.

**Primary sources (read in full):**
- `_plans/b2c_consumer_transformation_6e7f8585.plan.md`
- `_plans/b2c_stripe_payments_5349075e.plan.md`
- `_plans/b2c_landing_dual_audience_894f9d93.plan.md`
- `_plans/ppdconsumer_remotion_plan_6b99ab7d.plan.md` (skimmed)

**Superseded but conflicting priors (referenced by the plans):**
- `PeakPerformanceData/peak_performance_data/_memory_bank/features/b2c-consumer-app-implementation-plan.md`
- `PeakPerformanceData/peak_performance_data/_memory_bank/features/b2c-individual-athlete-implementation.md`

**Date of analysis:** 2026-08-02  
**Constraint:** No application or plan files were modified except this dossier.

---

## 1. Consumer product definition

### Who the user is

From the consumer transformation plan (overview + target account model, L3, L72–95):

| Persona | Auth role (unchanged) | Intent |
|---------|----------------------|--------|
| Individual athlete / player | `player` | Self-serve performance OS: score matches, sync wearables, see readiness/progress, get insights |
| Parent of under-16 | `parent` | Creates/manages child profile; under-16 cannot sign up alone |
| Independent coach (solo) | `coach` | Personal-mode coach; auto-approve `coach_requests` (no club-admin gate) |

Landing plan defaults narrative to **athletes**; parents get “light copy only,” not a third audience track (`b2c_landing_dual_audience` L66–67, L150). Remotion plan scopes video to **individual tennis athlete**; parent out of scope (`ppdconsumer_remotion` L25).

Do **not** invent a new `individual` role — consumer transformation explicitly rejects that (L85); memory-bank plans that add `individual` are marked superseded.

### What they get (product surface)

Proposed consumer IA (identical tabs, content adapts) — transformation L87–95:

1. **Today** — readiness, next session, one insight  
2. **Matches** — history, highlights, share  
3. **Log (+)** — score live / upload / quick note (scorekeeper = activation hook)  
4. **Progress** — trends  
5. **You** — profile, child/athlete switcher, coach mode, settings, devices  

Explicitly **out of consumer v1**: messaging, genetics, labs, leaderboards (transformation L196–197, L195).

### Data sources they connect

| Source | Role in day-one value | Notes from plans |
|--------|----------------------|------------------|
| **Live scorekeeper / match import** | Primary activation | Only hook that delivers value same session (transformation L157) |
| **Garmin** (primary wearable) | Secondary | Honest SLA: recent data after device sync, ~30d backfill, **~3 weeks nightly wear** before HRV Status baseline (L192) |
| **Whoop / Polar** | Live integrations (Remotion L48–49, L61) | Landing: do not claim equal sleep/recovery parity across devices |
| **Video / SwingVision pipeline** | Tertiary | Honest 24–72h SLA, per-user monthly quota; never only day-one path (L159, L246–250) |
| **Strava** | Remotion: **not** a live player connect path (L61) | Memory-bank still lists Strava — treat as stale |

### Pricing / tier structure proposed (conflict across plans)

Three incompatible tier stories exist. Agent entitlement code must lock one.

#### A. Stripe payments plan (billing architecture — locked decisions)

`_plans/b2c_stripe_payments_5349075e.plan.md` L162, L219–221:

| Tier | Price | AI | Other gates |
|------|-------|----|-------------|
| **Free** | €0 | **3 AI insights / month** | Unlimited match upload + basic stats; Garmin sync **free**; 90-day analytical history; always-on export |
| **Pro** | €11.99/mo · €119.99/yr | **60 AI insights** | Unlimited history, multi-season trends, personalized training plans |
| **Premium** | €19.99/mo · €179.99/yr | **Unlimited AI** | Wearable-load fusion; up to 3 athletes |

Also: AI billed as **flat conversation caps**, not credits (L61); academy **per-seat** billing parallel track (L229–231).

#### B. Landing dual-audience plan (marketing display)

`_plans/b2c_landing_dual_audience_894f9d93.plan.md` L83–91:

| Tier | Price | AI | Other |
|------|-------|----|-------|
| **Free** | $0 | None claimed | Match import + **limited wearable history** |
| **Athlete** | $9.99 / $99 yr | **No AI** | Core match insights, wearables, progress, tests; **Garmin on Athlete (not Free)** |
| **Athlete+** | $19.99 / $199 yr | **AI companion + priority (AI on this tier only)** | Rename of “Premium” |

B2B landing: Coach from $69/mo, Academy from $449/mo — invitation CTAs (L95–98).

#### C. Superseded memory-bank Freemium

`b2c-consumer-app-implementation-plan.md` L212–224, L1010–1072: Free / Pro $9.99 / Premium $19.99; **AI coach chat only on Premium**; Garmin not on Free.

**Agent implication:** Stripe plan puts *some* AI on Free (3/mo); Landing puts AI **only** on Athlete+. These cannot both be true in entitlement checks. Recommend treating **Stripe plan Phase 7 + Phase 9** as the billing source of truth for metering, and reconciling landing copy before launch. Flag Garmin free-vs-paid as a second product conflict (Stripe L60 vs Landing L90).

---

## 2. Tenancy model — CONFLICT (critical for agent authz)

### Position 1 — Consumer transformation (current “validated” direction)

**Hidden personal organization.**

- Migration: `organizations.is_personal boolean default false` (or `type = 'personal'`) — transformation L133  
- Every consumer signup creates one **hidden** personal org — L75–85, mermaid L74–83  
- Orthogonal **`accountMode`**: `personal` vs `academy`, derived from `organizations.is_personal` — L85, Phase 2 todo L12  
- Thread `accountMode` through: `user-context-lite`, middleware headers, layout, `UserContextProvider` — L135  
- Roles stay the existing five; do not add `individual` — L85  
- Filter personal orgs out of public/admin org lists — L134  
- Rationale: keeps ~80 org-scoped tables + RLS untouched; Makerkit-style pattern — L59  

**Agent-relevant consequence:** `profiles.organization_id` is **always non-null** for consumers. `/api/ai-agent`’s current hard require of `organizationId` (see §7) would succeed mechanically — but org-scoped tools that average **org-wide** reports (`athleteTools` called out at L194) become dangerous (solo org of one member, or wrong aggregates).

### Position 2 — Stripe payments plan

**Org-less B2C: `organization_id = null`.**

- Phase 6 todo L33: “Add org-less individual signup path… audit null-org handling”  
- Explicit: create profile with `organization_id = null` and `role = 'player'` — L211  
- Notes `profiles.organization_id` already nullable; one such row in production — L213  
- Billing subject is `billing_customers` with **user XOR organization** arc — L135–143  
- Entitlement: personal subscription wins; else fall back to org subscription via `profiles.organization_id` — L154  

**Agent-relevant consequence:** Current AI route returns **403** if `organization_id` is null (`route.ts` L61–66). Insights table requires `organization_id NOT NULL` (`20260727_insight_store.sql` L15). Null-org breaks org-keyed RLS, tool constructors that require `organizationId: string`, and insight persistence.

### Position 3 — Superseded memory-bank (explicitly conflicting)

- `is_individual` + `organization_id = NULL` + new role `individual` — `b2c-individual-athlete-implementation.md` L32–39  
- Consumer transformation L68: “Their nullable-org direction conflicts with today’s personal-org decision. This plan supersedes them.”  
- Stripe plan L252–254 also marks both memory-bank files superseded — but then **re-adopts null-org** in Phase 6.

### Conflict verdict

| Plan | Tenancy |
|------|---------|
| `b2c_consumer_transformation` | **Personal org** (`is_personal`, always has `organization_id`) + `accountMode` |
| `b2c_stripe_payments` | **`organization_id = null`** |
| Memory-bank (superseded) | **`organization_id = null`** + `is_individual` |
| Landing | Agnostic; notes “no org-free signup yet” (L40) |
| Remotion | Agnostic; warns features are org-affiliated today (L201–202) |

**For the agent system:** authorization, tool scoping, insight `organization_id`, memory rows, rate-limit ledgers, and coach-review foreign keys **cannot be designed until this is resolved**. Personal-org is compatible with today’s AI stack with fewer migrations; null-org requires rewriting the AI route gate, insight schema (`organization_id NOT NULL`), and most tool factories.

**Recommendation for agent design (pending product lock):** Prefer **personal-org + `accountMode`** as the working assumption (consumer transformation is the broader product plan and explicitly calls out superseding null-org). Treat Stripe Phase 6 null-org as a **plan bug / unresolved conflict** that must be reconciled before billing schema lands — `billing_customers.user_id` XOR still works with personal orgs if the subject is the user, not the personal org.

---

## 3. Entitlement model and AI capability by tier

### Feature gates the plans ask for (seams)

Transformation Phase 5 L176: build gating seams on `BrandConfig.features` for: **tier, monthly video/AI/sync meters, history depth, athlete seats, advanced metrics, export** — even though billing is out of scope of that plan.

Stripe Phase 7 L219–223:

| Capability | Free | Pro | Premium |
|------------|------|-----|---------|
| Match upload + basic stats | Unlimited | ✓ | ✓ |
| Garmin sync | Free (ingestion ungated) | ✓ | ✓ |
| Analytical history | 90 days | Unlimited + multi-season | Unlimited |
| AI insights / chats | **3 / month** | **60** | **Unlimited** |
| Personalized training plans | — | Yes | Yes |
| Wearable-load fusion | — | — | Yes |
| Athlete seats (multi) | 1 implied | — | Up to 3 |
| Data export | Always on | ✓ | ✓ |
| AI tab (binary UX) | Hide if locked | Show | Show |
| Locked charts | Blur-and-tease | Full | Full |

Stripe Phase 9 economics L239: ~$0.07/multi-turn conversation with caching → ~74 conversations/mo on a €20 plan at 25% COGS target. Instrument tokens from day one; UI shows “chats left.”

Landing (marketing, conflicts): AI **only** on Athlete+; Garmin **not** on Free.

Memory-bank (stale): AI only on Premium; Free history 30 days.

### What exists in code today for entitlements

| Artifact | Status |
|----------|--------|
| Stripe SDK / webhook / checkout | **Not started** — no `stripe` in app package.json; no `/api/stripe/*`; no `/pricing` route |
| `billing_customers`, `subscriptions`, `get_subject_entitlement` | **Not started** — no billing migrations under `supabase/migrations/` |
| `ai_usage_events` / reserve-commit quota | **Not started** |
| `BrandConfig.features` | **Stub only** — `src/config/brands/types.ts` L32–34 optional `features?: { [key: string]: boolean }` |
| AI rate limit | **In-memory Map**, 50 req / hour / user — `src/lib/ai/utils/rateLimit.ts` L15–17; transformation L194 calls this out as non-durable |

---

## 4. Onboarding and cold-start data reality

### Planned flow (transformation Phase 4, L150–162)

1. Minimal auth → **one skippable** question (compete / train / recover) to reorder home cards  
2. Three-path chooser; **primary CTA: Score a match live**  
3. Secondary: connect Garmin — promise readiness **after tonight’s sleep**  
4. Tertiary: upload video — queue + SLA  
5. Permissions at the hook (priming screens), not at launch  
6. `profiles.onboarding_completed` + 3–5 item home checklist  
7. Per-user **sample data** tagged `is_sample`, badged, one-click delete, excluded from aggregates — do **not** reuse `clone_demo_wearables.py`

Home (Phase 7 L190): max **3 scores** + explicit calibration window (“baseline forming, day 4 of 14”) instead of empty rings.

### Day-one data the AI will actually have

| Data class | Day 1 | Useful for AI? |
|------------|-------|----------------|
| Match from scorekeeper | Possible same session | High — KPIs, serve %, winners if scored |
| Wearable / HRV / sleep | Empty or hours-old; baseline weeks away | Low — must refuse overconfident readiness claims |
| Training history / plans | Empty (no coach-created sessions) | None — hide coach-dependent tools |
| Fitness tests | Empty unless self-logged | Low |
| Org roster / assignments | N/A or self-only personal org | Must not run coach roster tools |
| Sample data | Optional seeded | Must be labeled; AI should disclose sample vs real |

**Cold-start agent policy (derived; plans imply but do not fully specify):**

- Prefer **proactive insight cards** over chat as default coach (L193); chat for follow-ups.  
- If data window &lt; calibration threshold: speak only about **what was just logged** (match) or **setup next step** (connect device / score next match).  
- Never invent baselines; mirror Remotion safe language (L108–110): readiness = training/recovery context, not medical.  
- Landing L160: do **not** claim autonomous AI coaching.

### Implementation status — onboarding

| Item | Status | Evidence |
|------|--------|----------|
| Onboarding wizard | **Not started** | Transformation L152: “no onboarding machinery today”; only unused `EmptyStateOnboarding` variant in `empty-state.tsx` L196–211 |
| `profiles.onboarding_completed` | **Not started** | No column in migrations grepped |
| Org-free / personal-org signup | **Not started** | `auth.ts` L128–130: `'Organization selection is required'` |
| Sample data tagging | **Not started** | Plan only; `clone_demo_wearables.py` deleted per git status |

---

## 5. Every place the plans mention AI — and what they promise

### Consumer transformation

| Location | Promise / requirement |
|----------|----------------------|
| Phase 0 L110 | Fix `ppp_ai_agent` IDOR; force `athleteId = userId` for player personas |
| Phase 0 L113 | Close RLS on `ai_memories`; gate `match_ai_memories` RPC |
| Phase 5 L176 | Feature-gating seams include monthly **AI** meters |
| Phase 7 L193 | Scheduled writer to `insights` store; **proactive cards default**, chat for follow-ups |
| Phase 7 L194 | Rework AI persona for **solo consumers**; durable rate limits; batch cards on cheap model; today’s route hard-requires org; `systemPrompt` forbids unsolicited advice; org-wide averaging bug |
| Phase 7 L190 | Home shows **one insight** among ≤3 scores |
| Open Q L260 | Products that explain a **rating** (UTR/WTN) outperform generic insights |

### Stripe payments

| Location | Promise |
|----------|---------|
| L60–61 | Gate AI (depth), not Garmin ingestion; flat tiers with conversation caps |
| L219–221 | Free 3 / Pro 60 / Premium unlimited AI insights |
| L223 | Hide AI tab when locked |
| Phase 9 L235–241 | `ai_usage_events` ledger, reserve/commit, model routing, prompt caching, token cost logging |

### Landing dual audience

| Location | Promise / constraint |
|----------|----------------------|
| L87 | Athlete+ = **AI companion + priority**; AI on that tier only |
| L160 | Feature bullets must **not** claim autonomous AI coaching |
| L76–77 | Competitive context: B2C tennis AI ~$8–40/mo |

### Remotion (marketing video only)

| Location | Relevance |
|----------|-----------|
| L52, L100, L120 | Show personal AI insight bubble (“Ask about your game”) mapped to live FAB / VoiceAssistant |
| L60, L126, L202 | **Do not** claim AI-without-org / standalone AI Coach / periodization product |
| L27 | Claims = live player features only; planned B2C infra out of scope |

### Superseded memory-bank (do not implement; note promises that may leak into copy)

- Premium: “AI-powered training insights”, “AI coach chat”  
- Phase 4 “AI & Social”  
- Individual plan open Q: “AI Coach — GPT-powered training suggestions”

---

## 6. Absence of a coach for safety review

### What the data model already assumes (B2B)

`supabase/migrations/20260727_insight_store.sql` L12–26, L73–83:

- `insights.organization_id NOT NULL`  
- `coach_id` nullable  
- `requires_coach_review BOOLEAN NOT NULL DEFAULT FALSE`  
- `coach_review_status`  
- UPDATE policy: coaches / org admins update review status  

Broader agent research corpus (dossiers 45, 46, 60, 65) designs HITL **coach approval queues** for athlete-facing publication. That is B2B-shaped.

### What B2C plans say

| Topic | Addressed? |
|-------|------------|
| Replace coach review for published insights | **No** — transformation says “write to insights store” and “rework AI persona” but never defines auto-publish rules, self-review, or parent-as-reviewer |
| Messaging / SafeSport (adult↔minor 1:1) | **Yes** — hide messaging in personal mode (transformation L196) |
| Genetics / labs special-category | **Yes** — do not ship to consumers (L197) |
| Medical claims | Remotion L108–110, L204 — soft readiness language only |
| Autonomous coaching claim | Landing L160 — forbidden in copy |

**Gap for agent system:** In B2C there is no coach to set `coach_review_status`. Options the plans do **not** choose among:

1. Auto-publish only low-risk categories; high-risk → suppress or soften  
2. Parent review for under-16  
3. Self-ack (“I understand this is not medical advice”)  
4. Keep `requires_coach_review=true` forever → insights never surface (broken)

Insight schema also **cannot store personal-org-less users** if Stripe null-org wins, and personal-org mode still needs a policy: `coach_id` null + auto-approve path.

---

## 7. Minors signing up directly

### Plans

| Plan | Stance |
|------|--------|
| Consumer transformation Phase 3 L145–146 | **Age gate 16+** (GDPR Art. 8 EU-safe default). Under-16 **must** be created under a parent account. `date_of_birth` server-validated. Consent event table (append-only) for Art. 9 |
| Transformation L196 | SafeSport / NSPCC: no unsupervised adult–minor messaging |
| Transformation open Q L261 | Athlete-vs-user modeling; current `claim_token` assumes one guardian — divorced parents break it |
| Stripe | Silent on minors |
| Landing | Parents: light copy only; no third track (L150, L218) |
| Remotion | Parent out of scope |

### Code already present (B2B minor plumbing)

- `supabase/migrations/20260426_minor_account_support.sql` — `profiles.created_by_parent_id`, invitation `target_profile_id` for email-less child profiles  
- Parent AI tools already scope to **approved** relationships (`parentTools.ts`)  

**Not present:** server-side 16+ gate on consumer signup; consent event table; Turnstile.

**Agent implication:** B2C under-16 conversations are **parent-mediated** (parent role tools on child athlete id). Direct minor chat accounts should not exist. Tone/safety: no 1:1 coach messaging tools in personal mode; stricter medical/injury refusal for youth.

---

## 8. Implementation status matrix (code evidence)

| Workstream | Status | Evidence |
|------------|--------|----------|
| Personal org / `is_personal` / `accountMode` | **Not started** | No `is_personal` / `accountMode` in app source (grep); no migration |
| Org-less signup (`organization_id = null`) | **Not started** | `auth.ts` L128–130 blocks; AI route L61–66 403s without org |
| Stripe products, webhook, Embedded Checkout | **Not started** | No stripe dependency; no `/api/stripe`; no `[locale]/pricing` page |
| Billing / entitlement tables + `get_subject_entitlement` | **Not started** | Absent from `supabase/migrations/` |
| AI usage ledger / quota RPC | **Not started** | Absent |
| Consumer onboarding wizard | **Not started** | Unused empty-state variant only |
| Dual-audience landing (`?audience=`) | **Not started** | `PlatformLanding.tsx` still single Early Access pricing card L424–469; no `AudienceSwitcher` / `useLandingAudience` |
| Landing pricing tiers Athlete/Athlete+ | **Not started** | `messages/en.json` still “Early Access” / “Request Invitation” |
| Remotion `PPDConsumer` | **Not started** | Plan-only; no `scenes/consumer` files |
| Insight store schema | **Partial** | Migration `20260727_insight_store.sql` exists; transformation L193: **nothing writes** to it; no TS references to `requires_coach_review` |
| AI agent (B2B org-gated) | **Partial / live** | `src/app/api/ai-agent/route.ts` requires org; role prompts in `systemPrompt.ts`; in-memory rate limit; player tool subset via `toolRouter.ts` L166–168 |
| Minor parent-created profiles | **Partial** | Migration 20260426; not wired to consumer 16+ gate |
| Scorekeeper / personal trainings / matches | **Partial** | Exist but org hard-fail (e.g. `personal-trainings/route.ts` L46–47) |
| Phase 0 security (IDOR, RLS, secrets) | **Pending** (plan todos all `pending`) | Out of scope to re-audit here; transformation treats as launch blocker |

**Overall B2C product:** plans only. **AI stack today:** B2B academy-only.

---

## 9. Current AI stack facts that B2C will collide with

Exact gates and behaviors agents must change:

```61:66:PeakPerformanceData/peak_performance_data/src/app/api/ai-agent/route.ts
    const organizationId = profile.organization_id
    if (!organizationId) {
      return NextResponse.json(
        { error: 'User is not associated with an organization' },
        { status: 403 }
      )
```

```28:33:PeakPerformanceData/peak_performance_data/src/lib/ai/prompts/systemPrompt.ts
const responseGuidelines = `
4. **Response length**:
   - Keep responses short. 1-3 sentences max unless the user explicitly asks for detail.
   - For data queries: return the data in a compact table or list. No commentary unless asked.
   - Never reply with a numbered list of questions. Never ask more than one question at a time.
   - Never add unsolicited suggestions, tips, or "you might also want to..." remarks.`
```

Athlete prompt still assumes coach messaging and org context (`systemPrompt.ts` L91–107, L110–113).

```15:17:PeakPerformanceData/peak_performance_data/src/lib/ai/utils/rateLimit.ts
const RATE_LIMIT_CONFIG = {
  maxRequests: 50, // Max requests per window
  windowMs: 60 * 60 * 1000, // 1 hour window
}
```

Insight schema requires org + coach review fields (`20260727_insight_store.sql` L12–26).

---

## 10. Deliverable — B2B vs B2C agent system divergence spec

Assumption for this spec: **`accountMode = personal | academy`**, personal org present (Position 1). If null-org wins, every row marked † needs redesign.

### 10.1 Authorization scope

| Dimension | B2B (`academy`) | B2C (`personal`) |
|-----------|-----------------|------------------|
| Tenant key | Real academy `organization_id` | Personal org id † (or null — unresolved) |
| Athlete visibility | Coach: assignments; Admin: org; Player: self; Parent: approved children | Player: **self only**; Parent: children in personal org; Independent coach: self-created roster only |
| Cross-athlete tools | Allowed for coach/admin | **Disabled** for player; coach tools only if personal-mode coach with seats |
| IDOR rule | Force `athleteId = userId` for players (planned Phase 0) | Same, mandatory |
| Org-wide aggregates | Allowed with care | **Forbidden** — always filter `athlete_id = self` |

### 10.2 Tool availability

| Tool class | B2B | B2C |
|------------|-----|-----|
| Roster CRUD, groups, attendance, org tournaments | Coach/admin | Off (or limited self-logging personal trainings/tournaments) |
| Messaging tools | On | **Off** (SafeSport + empty contact list) |
| Genetics / labs | Gated / legal review | **Off** |
| Wearable / ClickHouse query | Assigned athletes | Self only |
| Match / tennis analytics | Org + self | Self (`user_id`-owned matches already fit) |
| Training plan generate | Coach creates for athlete | Self-serve only on **Pro+** (Stripe); never claim coach assignment |
| Insight publish | May set `requires_coach_review` | Auto-policy (see 10.3) — no coach updater |
| Filter/search athletes | Coach scoped | N/A for solo player |

### 10.3 Output review / what replaces the coach gate

| Output | B2B | B2C replacement |
|--------|-----|-----------------|
| High-risk athlete-facing insight (injury, illness, “don’t train”, clinical tone) | `requires_coach_review = true` → coach queue | **Do not publish** as advice; refuse or reframe as “talk to a qualified professional / your coach if you have one”; log silently |
| Medium-risk training load / readiness | Coach digest or approve | Auto-publish only with **evidence + calibration disclaimer** + data-age check |
| Low-risk match stats / descriptive trends | Auto or light review | Auto-publish; proactive card |
| Chat answers | Live to requester by role | Live to self/parent; still no unsolicited medical advice |
| Under-16 | Coach + parent norms | Parent is the conversational principal; child profile is data subject |

Plans do not define this matrix — **it is a required product decision** before shipping proactive B2C insights.

### 10.4 Tone and audience

| | B2B | B2C |
|--|-----|-----|
| Primary reader | Coach (ops), then athlete | Athlete (or parent) |
| System prompt spine | Coach: direct task agent; Athlete: companion but “insights only when asked” | Solo companion; **proactive cards OK** on schedule; chat still concise |
| Org framing | “Organization: {academy}” | “Personal account” — no academy jargon (consumer i18n overlay Phase 8) |
| Deferral | “Ask your coach” | “Here’s what your data shows” / setup CTAs; no fake coach |
| Unsolicited advice | Forbidden in chat today | Cards may nudge; chat should stay ask-driven unless following a card |

### 10.5 Cold-start behavior

| Phase | Agent behavior |
|-------|----------------|
| No matches, no wearables | Decline deep analysis; drive **Score a match** or connect Garmin; optional disclosed sample insights |
| 1 match, &lt;7d wearables | Match-only insights; readiness = “baseline forming” |
| &lt;14–21d HRV | No HRV Status claims (plan: ~3 weeks) |
| Sample rows present | Prefix “Sample data —”; exclude from aggregates/tools used for advice |

### 10.6 Entitlement enforcement

- Resolve Free AI (3/mo vs none) **before** coding gates.  
- Server-side only: `get_subject_entitlement` + `reserve_ai_quota` / `commit_ai_quota` (Stripe Phase 9) — never JWT-only.  
- Map “insight” vs “chat turn” consistently (plans use both terms).  
- Hide AI tab when quota tier is zero (Landing Athlete / if Free has 0).  
- Premium multi-athlete (3) must align with personal-org child/linked seats.

### 10.7 Cost control at low ARPU (€12–20/mo)

| Lever | Spec |
|-------|------|
| Default surface | Deterministic detectors → cheap model narration for cards (transformation L193–194) |
| Chat model | Mid-tier + prompt caching (Stripe L239); DeepSeek prefix caching already noted in `systemPrompt.ts` L1–3 |
| Hard caps | Tier monthly conversation/insight caps; durable ledger not in-memory 50/hr |
| Tool budget | Strip coach/admin tools from personal player sessions (tokens + risk) |
| Context size | Short history; no org-wide pulls |
| Video/AI | Separate video quota (Phase 13); don’t burn LLM on pipeline status |
| COGS target | ~25% of subscription (Stripe L239) |

### 10.8 Mode detection (implementation seam)

Derive once per request:

```
accountMode = organization.is_personal ? 'personal' : 'academy'
billingSubject = user subscription ?? org subscription
role = profiles.role  // unchanged enum
```

Pass `accountMode` into: AI route, tool router, system prompt selector, insight publisher, entitlement check.

---

## 11. Open conflicts the agent program must escalate

1. **Tenancy:** personal org vs `organization_id = null` (Sections 2).  
2. **AI on Free:** 3/mo (Stripe) vs none (Landing / memory-bank).  
3. **Garmin on Free:** free (Stripe) vs paid Athlete (Landing).  
4. **Tier names/prices:** Pro €11.99 vs Athlete $9.99; Premium vs Athlete+.  
5. **Coach-review replacement** for B2C proactive insights (Section 6) — unspecified.  
6. **Insight `organization_id NOT NULL`** vs null-org signup.  
7. Memory-bank `individual` role — rejected by transformation but still in repo docs.

---

## 12. Remotion note

`ppdconsumer_remotion_plan_6b99ab7d.plan.md` is marketing-only. Relevant constraints: advertise live capabilities only; do not claim org-free AI; safe readiness language; CTA “Start free” → org-bound signup until B2C ships. No agent runtime implications beyond copy honesty.

---

## Sources index (absolute paths)

- `/Users/danielsilva/Desktop/PeakPerformanceDataMonorepo/_plans/b2c_consumer_transformation_6e7f8585.plan.md`
- `/Users/danielsilva/Desktop/PeakPerformanceDataMonorepo/_plans/b2c_stripe_payments_5349075e.plan.md`
- `/Users/danielsilva/Desktop/PeakPerformanceDataMonorepo/_plans/b2c_landing_dual_audience_894f9d93.plan.md`
- `/Users/danielsilva/Desktop/PeakPerformanceDataMonorepo/_plans/ppdconsumer_remotion_plan_6b99ab7d.plan.md`
- `/Users/danielsilva/Desktop/PeakPerformanceDataMonorepo/PeakPerformanceData/peak_performance_data/src/app/api/ai-agent/route.ts`
- `/Users/danielsilva/Desktop/PeakPerformanceDataMonorepo/PeakPerformanceData/peak_performance_data/src/lib/ai/prompts/systemPrompt.ts`
- `/Users/danielsilva/Desktop/PeakPerformanceDataMonorepo/PeakPerformanceData/peak_performance_data/src/lib/ai/utils/rateLimit.ts`
- `/Users/danielsilva/Desktop/PeakPerformanceDataMonorepo/PeakPerformanceData/peak_performance_data/src/lib/ai/utils/toolRouter.ts`
- `/Users/danielsilva/Desktop/PeakPerformanceDataMonorepo/PeakPerformanceData/peak_performance_data/src/lib/auth/auth.ts`
- `/Users/danielsilva/Desktop/PeakPerformanceDataMonorepo/PeakPerformanceData/peak_performance_data/supabase/migrations/20260727_insight_store.sql`
- `/Users/danielsilva/Desktop/PeakPerformanceDataMonorepo/PeakPerformanceData/peak_performance_data/supabase/migrations/20260426_minor_account_support.sql`
- `/Users/danielsilva/Desktop/PeakPerformanceDataMonorepo/PeakPerformanceData/peak_performance_data/src/components/landing/PlatformLanding.tsx`
- `/Users/danielsilva/Desktop/PeakPerformanceDataMonorepo/PeakPerformanceData/peak_performance_data/src/config/brands/types.ts`
