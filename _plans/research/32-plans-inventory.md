# 32 — Plans Inventory & Critical Assessment

**Status:** Read-only research dossier  
**Date:** 2026-08-02  
**Scope:** Every `.plan.md`, every markdown under any `_plans/` directory (including submodules), plus root `README.md` and rule-file locations. No plan or application code was modified except this file.

---

## 1. Executive summary

The monorepo contains **three overlapping planning layers**:

1. **Forward product/engineering plans** (`.plan.md` and a few `_plans/*.md`) — B2C transformation, Stripe, landing, Remotion, agentic layer, SwingVision overhaul, marketing decks, performance/design.
2. **As-built research dossiers** (`_plans/research/01–29`, dated 2026-08-02) — deep code audits prepared specifically to ground a new multi-agent master plan. These are the most current and accurate AI-system documentation.
3. **Older / parallel plans** — Windsurf tennis-analytics revamp, memory-bank B2C plans (superseded but not marked), AcademiesPresentation white-label deck.

**Critical finding for the new agent master plan:** `ppd_agentic_layer_0167692b.plan.md` (2026-07-27) is **partially executed and factually stale**. Phases 1–6 have substantial scaffolding in `ppp_ai_agent` (no longer empty), Phase 0 auth is largely fixed in Next, but Temporal, thin BFF proxy, coach inbox UX, DPIA, and production scheduling remain undone. Prefer research dossiers 01–29 as ground truth; treat the agentic-layer plan as a historical roadmap with corrections below.

**Critical B2B/B2C conflict:** Three B2C plans disagree with each other and with the academy-centric agent plan on org model (`is_personal` vs `organization_id = null`), AI gating (org-required chat vs consumer AI), coach approval HITL, and whether genetics/labs ship to consumers.

---

## 2. Document catalog

### 2.1 Forward plans (`.plan.md` + non-research `_plans/*.md`)

| # | Path | Title (frontmatter / H1) | Inferable date | Validity |
|---|------|--------------------------|----------------|----------|
| F1 | `PeakPerformanceData/ppp_ai_agent/_plans/ppd_agentic_layer_0167692b.plan.md` | PPD Agentic Layer | ~2026-07-27 (file mtime) | **Stale facts; still directionally useful** |
| F2 | `_plans/b2c_consumer_transformation_6e7f8585.plan.md` | B2C Consumer Transformation | ~2026-08 (post-swarm) | **Valid, mostly not started** |
| F3 | `_plans/b2c_landing_dual_audience_894f9d93.plan.md` | B2C Landing Dual Audience | ~2026-08 | **Valid, not started** |
| F4 | `_plans/b2c_stripe_payments_5349075e.plan.md` | B2C Stripe payments | ~2026-08 | **Valid, not started; conflicts with F2 on org model** |
| F5 | `_plans/ppdconsumer_remotion_plan_6b99ab7d.plan.md` | PPDConsumer Remotion Plan | ~2026-08 | **Valid plan-only; not implemented** |
| F6 | `PeakPerformanceData/swingvision-pipeline/_plans/pipeline_overhaul_v2_4bf613e9.plan.md` | Pipeline overhaul v2 | ~2026-08 | **Valid; partially implemented** |
| F7 | `PeakPerformanceData/peak_performance_data/_plans/app_performance_audit_2d7eb1f9.plan.md` | App Performance Audit | ~2026-08 | **Valid; partially done** |
| F8 | `PeakPerformanceData/peak_performance_data/_plans/broadcast_console_redesign_7898b364.plan.md` | Broadcast Console Redesign | ~2026-08 | **Valid; largely not started; design conflict** |
| F9 | `PeakPerformanceData/peak_performance_data/_plans/landing_smoothness_and_showcase_colors_d662e6a9.plan.md` | Landing Smoothness + Showcase Colors | ~2026-08 | **Mostly done** |
| F10 | `PeakPerformanceDataMarketing/_plans/bench_social_posts_06eb7285.plan.md` | Bench social posts | ~2026-08 | **Largely done; superseded by F11** |
| F11 | `PeakPerformanceDataMarketing/_plans/bench_posts_v2_dc45ea25.plan.md` | Bench posts v2 | ~2026-08 | **Partially done** (assets + carousel exist) |
| F12 | `PeakPerformanceDataMarketing/_plans/deck_polish_overhaul_061b8701.plan.md` | Deck polish overhaul | ~2026-08 | **Valid; status unclear / likely in progress** |
| F13 | `PeakPerformanceDataMarketing/AcademiesPresentation/_plans/white-label-deck-c0e2ad.md` | Make the Deck Easy to White-Label | undated | **Mostly done** |
| F14 | `PeakPerformanceData/ppd_research_papers/_plans/ppd_algorithm_research_cf3f801b.plan.md` | PPD Algorithm Research | ~2026-08 | **Partially done** (collect/DB map completed; memos pending) |

**Deleted / missing (noted in git, not present on disk):**
- `PeakPerformanceData/swingvision-pipeline/_plans/pipeline_overhaul_master_plan_032fbbe6.plan.md` — deleted, replaced by F6.
- `PeakPerformanceData/peak_performance_data/_plans/tec-academy-onboarding-0c2c79.md` — appeared in an earlier index but **not present** on disk now.

### 2.2 Research dossiers (`_plans/research/`)

All dated **2026-08-02** unless noted. These are as-built audits for the upcoming multi-agent plan — **prefer these over F1 for factual claims**.

| ID | Path | Title |
|----|------|-------|
| R01 | `_plans/research/01-ppp-api-layer.md` | `ppp_ai_agent` HTTP API Layer |
| R02 | `_plans/research/02-ppp-config-providers.md` | Config & LLM Provider Routing |
| R03 | `_plans/research/03-insight-schema.md` | Structured Insight Schema |
| R04 | `_plans/research/04-nightly-batch.md` | Nightly Batch Orchestration (as-built) |
| R05 | `_plans/research/05-specialist-pattern.md` | Specialist Pattern |
| R06 | `_plans/research/06-python-tool-registry.md` | Python Tool Registry |
| R07 | `_plans/research/07-python-data-access.md` | Python Data Access Layer |
| R08 | `_plans/research/08-tools-athletes-training-tennis.md` | Domain Tools: Athletes, Training, Tennis |
| R09 | `_plans/research/09-tools-health-domain.md` | Sensitive Health Domain Tools |
| R10 | `_plans/research/10-eval-harness.md` | Eval Harness Adequacy Audit |
| R11 | `_plans/research/11-python-tests.md` | Python Pytest Suite Audit |
| R12 | `_plans/research/12-deploy-runtime.md` | Build, Deploy & Runtime |
| R13 | `_plans/research/13-nextjs-ai-route.md` | Next.js `/api/ai-agent` Route |
| R14 | `_plans/research/14-nextjs-prompts.md` | Next.js Config & System Prompts |
| R15 | `_plans/research/15-tool-router-memory.md` | Tool Router & Memory Subsystem |
| R16 | `_plans/research/16-ts-tool-inventory.md` | TypeScript AI Tool Inventory |
| R17 | `_plans/research/17-supabase-ai-schema.md` | Supabase AI / Agent Schema |
| R18 | `_plans/research/18-authz-model.md` | Identity & Authorization Model |
| R19 | `_plans/research/19-training-schema.md` | Training Domain Data Model |
| R20 | `_plans/research/20-tennis-data-model.md` | Tennis Match Data Model & Analytics |
| R21 | `_plans/research/21-clickhouse-wearables.md` | ClickHouse Wearables Data Model |
| R22 | `_plans/research/22-ppd-backend-surface.md` | `ppd_backend` Service Surface |
| R23 | `_plans/research/23-physiology-algorithms.md` | Physiology & Training-Load Algorithms |
| R24 | `_plans/research/24-ingestion-pipeline.md` | Wearable Ingestion Pipeline |
| R25 | `_plans/research/25-swingvision-pipeline.md` | SwingVision Pipeline Architecture |
| R26 | `_plans/research/26-ppd-vision.md` | `ppd_vision` Maturity (Scoping) |
| R28 | `_plans/research/28-nextjs-session-bff.md` | Next.js Session, Locale & BFF Proxy |
| R29 | `_plans/research/29-ui-surfaces.md` | UI Surfaces for Agent Output |
| R32 | `_plans/research/32-plans-inventory.md` | **This document** |

Note: **R27 is missing** from the sequence (gap between 26 and 28).

### 2.3 Windsurf plans (`.windsurf/plans/`)

| Path | Title | Validity |
|------|-------|----------|
| `PeakPerformanceData/.windsurf/plans/tennis-analytics-revamp/00-overview.md` | Tennis Analytics Revamp — Overview | Partially implemented |
| `.../01-shared-metrics-foundation.md` | Shared Metrics Foundation | Partially done (`bounce_y`/`direction` in evolution; `bounce_x` still absent) |
| `.../02-progress-page.md` | Progress page | Partial |
| `.../03-insights-tab.md` | Insights tab | Partial |
| `.../04-play-patterns-tab.md` | Play Patterns tab | Partial |

### 2.4 Related context (not under `_plans/`, inventoried per request)

| Path | Notes |
|------|-------|
| Root `README.md` | Submodule map; **does not list** `ppp_ai_agent`, `swingvision-pipeline`, `ppd_research_papers` — stale relative to actual tree. |
| `AGENTS.md` / `.cursor/rules` / `.cursorrules` | **None found** outside `node_modules` (vendor Supabase package AGENTS.md only). |
| `.windsurf/workflows/rebrand.md` | Exists under AcademiesPresentation; supports F13. |
| `_memory_bank/features/b2c-consumer-app-implementation-plan.md` | Jan 2026 B2C plan; **superseded by F2/F4 but not marked**. |
| `_memory_bank/features/b2c-individual-athlete-implementation.md` | Nullable-org B2C plan; **superseded; conflicts with F2 personal-org**. |

---

## 3. Per-document assessments (forward plans)

### F1 — PPD Agentic Layer (DEEP DIVE)

**Path:** `PeakPerformanceData/ppp_ai_agent/_plans/ppd_agentic_layer_0167692b.plan.md`  
**Title:** PPD Agentic LLM Layer + Data Expansion Plan  
**Date:** ~2026-07-27  
**Summary:** Proposes a provider-agnostic agentic layer in `ppp_ai_agent` (FastAPI + PydanticAI + Temporal) with one orchestrator calling black-box specialists (wearables, training/tennis, biomarkers, genetics, CGM). Hybrid entrypoints: interactive chat, nightly batch, event hooks. UX is insight cards + coach approval queue, not chat-first. Phase 0 hardens the existing Next Edge agent; Phases 1–6 stand up the Python service, hybrid insights, labs, genetics, CGM/Apple Health, and tennis tools. Explicit non-goals: clinical SaMD, talent genetics, replacing SwingVision with LLM vision.

#### Stated todos vs reality

| Todo | Assessment | Evidence |
|------|------------|----------|
| **phase0-harden** — session auth, assignment scope, memory write, CH wearables, tests | **Partially done** | Session auth: `route.ts:36–45` derives `userId` from session. Assignment: `route.ts:119–128` + `toolRouter.ts:179–186` scopes discovery tools. Memory: `extractAndStoreMemories` called (`route.ts:252–258`) but from **request-body** messages (wrong pair). CH: `garminActivityTools.ts` / `wearableInsightTools.ts` hit PPC/CH; `athleteTools.ts:507` still reads `garmin_connect_activities`. Tests: `tests/api/ai-agent/tool-router.test.ts`, `specialist-tools.test.ts` exist (no longer zero). Edge 30s limit remains (`runtime = 'edge'`, `maxDuration = 30`). |
| **phase1-skeleton** — FastAPI + PydanticAI, Traefik, Next BFF, core tools | **Partially done** | Service exists: `api/main.py`, `tools/`, `schemas/`, `Dockerfile`, `docker-compose.yml`. Tool registry + specialist modules present. **No Temporal.** PydanticAI mentioned in `provider_router.py` comments; not a full orchestrator agent owning chat. Next is **not** a thin stream proxy — still runs `streamText` locally (`route.ts:189`). Specialist tools proxy subset via `specialistTools.ts` → `PPP_AI_AGENT_URL`. Traefik/prod deploy unverified here (see R12). |
| **phase2-hybrid** — Temporal nightly/events, insight cards, coach queue, feedback, eval | **Partially done / mostly scaffolding** | `agent/nightly_batch.py` + `/batch/nightly` + `/events/hook` exist; **no Temporal**. Insight schema in `schemas/insight.py`. Python can POST to `insights` table. Product UI for coach inbox / InsightCards **missing** (R29). Eval is offline unit helpers, not CI golden traces (R10). |
| **phase3-labs** — schema, UI, Biomarker specialist, DPIA | **Partially done** | Migrations `20260727_lab_panels.sql`; UI at `src/app/[locale]/labs`, `components/labs/*`; tools in Python + `specialistTools.ts`. **DPIA not evidenced.** RLS holes called out by F2 still relevant. |
| **phase4-genetics** — guardrailed ingest + educational specialist | **Partially done** | Migration `20260727_genetics.sql`; UI `src/app/[locale]/genetics`, `GeneticUpload.tsx`; Python `tools/genetics.py`, `genetic_parser.py`. Product gating / dual-control / youth restrictions incomplete per F2. |
| **phase5-cgm-apple** | **Scaffold only** | `tools/cgm.py`, `agent/cgm_specialist.py`, tests exist; Apple Health product path not shipped as consumer feature. |
| **phase6-tennis-tools** | **Partially done** | Python `tools/tennis.py` (`get_match_summary`, `get_tennis_evolution`, `get_tennis_matches`); TS proxies in `specialistTools.ts`. Shot-level richness vs UI still a gap (R08/R20). `ppd_vision` bridge still later (R26). |

#### Corrections table (factual claims vs codebase)

| # | Plan claim | Reality | Verdict | Evidence |
|---|------------|---------|---------|----------|
| C1 | `[ppp_ai_agent/] is empty — intended new home` | Package is a full FastAPI service: `api/`, `agent/`, `tools/`, `schemas/`, `eval/`, `tests/`, Docker | **FALSE / outdated** | Directory listing; `api/main.py` |
| C2 | Body `userId` / `organizationId` trusted | Body only takes `locale`, `messages`, `sessionId`. Identity from `supabase.auth.getSession()` + `profiles` | **FALSE / fixed** | `route.ts:25`, `36–67` |
| C3 | Memory auto-write unused | `extractAndStoreMemories` is invoked after stream usage resolves | **FALSE (partially)** | `route.ts:252–258` |
| C4 | (Implied) memory write uses the new turn correctly | Uses `messages` from the **request** (pre-stream). New assistant text is not in that array, so it pairs current/prior user with a **prior** assistant message | **Bug remains** | `route.ts:227–258`; client sends history without the new assistant reply |
| C5 | ~115 tools under `src/lib/ai/tools/` | ~**121** `tool(` factories across tool modules | **Mostly true** (count drifted up) | `rg -c 'tool('` sum = 121 |
| C6 | AI tools still often read legacy Supabase `garmin_connect_*` (dual-read gap) | Mixed: Garmin/wearable insight tools prefer PPC/CH; `athleteTools.ts` still queries `garmin_connect_activities`; `filterAthleteTools` uses `garmin_connections` | **Still true (partial dual-read)** | Those files |
| C7 | Keyword intent router | Still keyword `INTENT_CATEGORY_MAP` in `classifyIntent` | **True** | `toolRouter.ts:21+`, `135–136` |
| C8 | 30s Edge limit | Still `export const runtime = 'edge'` and `maxDuration = 30` | **True** | `route.ts:16–19` |
| C9 | Coach AI is org-wide vs assignment-scoped UI | Discovery tools (`getAthletes`, `searchAthlete`, `filterAthletes`) take `playerIds` scope; many other coach tools remain org-wide | **Partially fixed** | `toolRouter.ts:179–196`; `queryTools.ts:12–30` |
| C10 | Zero agent tests | Next has AI route tests; Python has extensive pytest suite | **FALSE / outdated** | `tests/api/ai-agent/*`; `ppp_ai_agent/tests/test_*.py` |
| C11 | No match-shot tennis tools | Python tennis tools + TS specialist proxies exist; depth vs product UI still incomplete | **Mostly outdated** | `tools/tennis.py`; `specialistTools.ts` |
| C12 | No labs/genetics schemas | Migrations + UI + tools exist (`20260727_lab_panels.sql`, `20260727_genetics.sql`) | **FALSE / outdated** | migrations + `src/app/[locale]/labs`, `/genetics` |
| C13 | Stack: FastAPI + **PydanticAI** + **Temporal** | FastAPI yes; Temporal **absent**; PydanticAI not the live chat orchestrator (Next still owns `streamText`) | **Partially true / Temporal false** | No Temporal imports; `nightly_batch.py` is a plain script |
| C14 | Next becomes thin BFF/proxy streaming to service | Next still hosts the brain; only specialist subset proxies to Python | **Not done** | `route.ts` `streamText`; `specialistTools.ts` |
| C15 | Embeddings fragile / need `OPENAI_API_KEY` | Still OpenAI embeddings with text-search fallback | **Still true** | `semanticMemory.ts:181–205` |
| C16 | Server-side auth never trust body `userId` (as a *requirement*) | Satisfied for Next chat route | **Requirement met** | `route.ts` |
| C17 | `ppp_ai_agent` internal auth verifies athlete access | Internal secret path sets `user_id = None` and accepts client-supplied `athlete_id` / `organization_id` on many routes — **IDOR risk remains** (also flagged by F2) | **Still a gap** | `api/middleware/auth.py:37–42`; `insights.py` query params |
| C18 | Tables `ai_conversations`, `ai_memories`, `ai_audit_logs` | Still present / used | **True** | route + utils |
| C19 | Roles player/coach/parent/club_admin/admin | Still true | **True** | product + `authorization.ts` |
| C20 | Not in product: clinical blood panels, genetics, CGM/Oura/Fitbit | Labs/genetics **routes exist** (unlinked/ungated per F2); CGM specialist code exists without full productization | **Partially outdated** | labs/genetics app routes; F2 Phase 7 |

**Validity verdict for F1:** Architecture north star (orchestrator + specialists, hybrid cards, non-diagnostic) remains sound. **Do not trust its “codebase truth” section.** Rebase any new master plan on research dossiers R01–R29 and this corrections table.

---

### F2 — B2C Consumer Transformation

**Path:** `_plans/b2c_consumer_transformation_6e7f8585.plan.md`  
**Summary:** 13-phase plan to make the academy app a self-serve B2C product via auto-created **hidden personal organizations** (`organizations.is_personal`), keeping org-scoped RLS. Front-loads security (committed secrets, `user_metadata` admin, unauth PPC, AI IDOR, RLS holes). Consumer IA: Today / Matches / Log+ / Progress / You. Explicitly hides messaging, genetics, labs in personal mode. Supersedes memory-bank B2C plans.

| Todo | Status | Evidence |
|------|--------|----------|
| phase0-security | **Not started / critical still open** | `.env.production` still on disk; `authorization.ts:34` still falls back to `user.user_metadata?.role`; signup still org-required (`auth.ts:128–130`); AI org hard-required (`route.ts:61–66`) |
| phase1-foundation | **Not started** | Design conflict unresolved (F8 vs docs); memory-bank plans unmarked |
| phase2-personal-org | **Not started** | No `is_personal` / `accountMode` matches in TS/SQL |
| phase3–13 | **Not started** | No Stripe, no consumer IA, no PostHog, etc. |

**Validity:** **Valid and blocking** for consumer launch. Security Phase 0 overlaps F4 Phase 0 and should be unified.

---

### F3 — B2C Landing Dual Audience

**Summary:** Same URL `?audience=athletes|coaches`, athlete-default narrative, honest CTAs (org-bound signup vs invitation), tiered pricing display without Stripe, i18n, leave AcademyLanding alone.

| Todo | Status | Evidence |
|------|--------|----------|
| audience-hook / AudienceSwitcher | **Not started** | No `useLandingAudience` / `AudienceSwitcher` |
| platform-restructure, pricing-grid, navbar, i18n, tests, seo-legal, copy-accuracy | **Not started** | PlatformLanding still single mixed page (Reveal work from F9 is present) |

**Validity:** Valid. Depends on honesty about org-bound signup until F2 ships. Pricing numbers conflict slightly with F4 (€ vs $ tiers).

---

### F4 — B2C Stripe Payments

**Summary:** Stripe Embedded Checkout, `billing_customers` XOR user/org, entitlements via `get_subject_entitlement`, AI metering, academy seats. Phase 0: app_metadata hook + rewrite 85 RLS policies. **Phase 6: org-less signup with `organization_id = null`.**

| Todo | Status | Evidence |
|------|--------|----------|
| All phases (hook, RLS rewrite, schema, Stripe, webhook, entitlements, checkout, seats, AI metering, compliance) | **Not started** | No `billing_customers` / Stripe webhook routes; only unrelated “stripes” in `progress.tsx` |
| b2c-signup (`organization_id = null`) | **Not started; conflicts with F2** | `auth.ts` still requires organization |

**Validity:** Billing architecture still valid. **Org model conflicts with F2** (null org vs personal org). Must reconcile before either ships.

---

### F5 — PPDConsumer Remotion Plan

**Summary:** Plan-only storyboard for ~28s 16:9 `PPDConsumer` film advertising **live** player features only; CTA “Start free” without claiming org-free signup.

| Todo | Status | Evidence |
|------|--------|----------|
| brand-consumer, scenes, wire composition, render-docs | **Not started** | No `PPDConsumer` / `brand-consumer` in Remotion package |

**Validity:** Valid as plan-only. Intentionally avoids promising unfinished B2C infra — good constraint for marketing.

---

### F6 — Pipeline overhaul v2

**Summary:** Seven-phase SwingVision ops overhaul: fix silent prod failures (watchdog, launchd, ingestion, auth), then mobile UX, workbench, encode quality, tests/CI.

| Todo cluster | Status | Evidence |
|--------------|--------|----------|
| p0-auth (HMAC, fail-closed, logout) | **Done** | `lib/auth.ts` HMAC; `middleware.ts` fail-closed; `api/logout` |
| p1-errors, p2-bottom-nav, p3-workbench / match-edit / cancel | **Largely done** | `app/error.tsx`, `bottom-tab-bar.tsx`, `next-actions-workbench.tsx`, job cancel/match routes (git status) |
| Remaining p0–p6 (encode, CI, indexes, etc.) | **Partial / pending** | Plan todos still marked pending; work in progress in tree |

**Validity:** Valid. Supersedes deleted master plan. Operational, not product-strategy conflict with B2C/agent plans except video SLA honesty (F2 Phase 13).

---

### F7 — App Performance Audit

**Summary:** Ranked root causes for nav + `/charts` TTI; phases for LazyChart leak, batch waves, locale nav, coach/training, bundle/PPC rollups.

| Todo | Status | Evidence |
|------|--------|----------|
| p1-lazychart-leak | **Likely done** | `LazyChart.tsx` imports `CHART_HEIGHT_CLASS` from `./chartConstants` (not GraphContainerRecharts) |
| Other phases | **Partial / unknown** | Charts page and nav still actively modified (git status); full audit not re-run here |

**Validity:** Valid. Referenced by F2 Phase 12 as unfinished work.

---

### F8 — Broadcast Console Redesign

**Summary:** Adopt `@ppd/tokens` navy + Barlow Condensed “analytics instrument” aesthetic; rebuild tokens, primitives, landing, auth, dashboards. Conflicts with other design docs.

| Todo | Status | Evidence |
|------|--------|----------|
| Nearly all phases | **Not started / minimal** | App still mostly shadcn; `@ppd/tokens` only mentioned as supplementary in `globals.css` |
| landing todo | **Conflicts with F3/F9** | Landing currently marketing-blue `#0047FF` system, not full broadcast-console rebuild |

**Validity:** Valid as design direction candidate. F2 Phase 1 says pick ONE design system and supersede the others — **this conflict is unresolved**.

---

### F9 — Landing Smoothness + Showcase Colors

**Summary:** Remove scroll jank (noise overlay, blurs), extract Reveal, retint Tennis Bench grays to brand blue.

| Todo | Status | Evidence |
|------|--------|----------|
| remove-noise / Reveal / apply-reveals | **Done** | No `feTurbulence`; `Reveal.tsx` used throughout `PlatformLanding.tsx` |
| navbar / blurs / bench retints | **Likely done or mostly done** | Reveal + landing changes present; spot-check sufficient for “mostly shipped” |

**Validity:** **Mostly complete** — mark done or verify remaining bench tint todos only.

---

### F10 / F11 — Bench social posts (v1 + v2)

**F10 Summary:** 10-slide 4:5 carousel from Bench data, preview on `/tennis-bench`.  
**F11 Summary:** Rewrite slides court-plot-first; regenerate PNGs; posts only.

| Todo | Status | Evidence |
|------|--------|----------|
| F10 bench-ui + assets | **Done** | `BenchSocialCarousel.tsx`; `public/tennis-bench/posts/*` + `manifest.json` |
| F11 rewrite / verify | **Partial** | Assets and carousel exist; whether v2 storyboard fully applied needs visual QA |

**Validity:** F10 largely superseded by F11. Marketing-only; no agent conflict.

---

### F12 — Deck polish overhaul (courtviz match-report)

**Summary:** Polish 50-slide Tennis Bench coach deck: logo, trajectories, new charts, export/sync.

| Todo | Status | Evidence |
|------|--------|----------|
| Various polish items | **In progress / unclear** | Adjacent to F10/F11 asset pipeline; not fully verified |

**Validity:** Valid marketing/analytics viz work; orthogonal to agent runtime.

---

### F13 — White-label AcademiesPresentation deck

**Summary:** Make `brand.json` the single source of truth for HTML + PPTX rebrand.

| Items | Status | Evidence |
|-------|--------|----------|
| Inject brand CSS vars, accentPalette, logo from brand | **Done** | `deck.js` `setProperty`, `accentPalette`, fetches `brand.json`; embedded brand in `deck-content.js` |
| rebrand workflow | **Done** | `.windsurf/workflows/rebrand.md` |

**Validity:** **Mostly complete.** B2B sales narrative (“for Academies”) — conflicts with B2C landing messaging only at brand/comms level.

---

### F14 — PPD Algorithm Research

**Summary:** Research memo in `ppd_research_papers`: papers, algorithms, application map — **explicitly not** agentic-layer build.

| Todo | Status |
|------|--------|
| collect-swarm, finish-db-map | **completed** (frontmatter) |
| team top10s, top50, algorithms map, briefable memo | **pending** |

**Validity:** Valid research track; complements but does not replace agent plans.

---

### Windsurf — Tennis Analytics Revamp

**Summary:** Bring Progress / Insights / Play Patterns to reference-report richness; shared metrics foundation first.

| Area | Status | Evidence |
|------|--------|----------|
| Shared metrics / evolution columns | **Partial** | Evolution selects `bounce_y, direction` but **not** `bounce_x` (`evolution/route.ts`); `direction_aggression_pct` exists in `progress-metrics.ts` |
| Progress / Insights / Play Patterns UI | **Partial** | Components exist and are actively modified; not fully matching guide |

**Validity:** Still useful; overlaps agent Phase 6 tennis tool depth.

---

### Memory-bank B2C plans (superseded)

Both propose B2C with Stripe and org changes; F2/F4 explicitly supersede them. **Neither file is marked superseded in-repo.** Leaving them unmarked is an active footgun for agents.

---

## 4. Research dossiers — collective assessment

R01–R29 (2026-08-02) are **current as-built truth** for the AI stack. They collectively establish:

- Python service exists but is **not** the chat brain; Next Edge still orchestrates.
- Auth: Next chat session-derived; Python internal-secret path is a privilege escalation / IDOR surface.
- Insight schema + nightly batch scaffolding exist; **product surfaces for cards/coach queue do not** (R29).
- Eval harness inadequate for health-data multi-agent shipping (R10).
- `ppd_vision` is not a near-term agent data source (R26); SwingVision pipeline is the CV path (R25).
- Physiology math must stay in PPC/deterministic code (R23).

**Validity:** Fresh. Use as primary input to the new master plan. Gap: missing R27.

---

## 5. Conflicts matrix (especially B2B vs B2C)

### 5.1 Account / tenancy model (highest severity)

| Source | Model |
|--------|-------|
| **F2 Consumer** | Hidden `organizations.is_personal = true`; keep org-scoped RLS |
| **F4 Stripe** | `profiles.organization_id = null` for individuals; entitlements XOR user/org |
| **Memory-bank B2C** | Nullable org / `is_individual` |
| **F1 Agentic + product today** | Hard-requires `organization_id` for AI (`route.ts:61–66`) and most RLS |

**Conflict:** New agent system cannot assume a single tenancy shape. Personal-org keeps AI/org tools working with fewer RLS rewrites; null-org forces widespread authz changes and breaks current AI gate.

**Recommendation for agent master plan:** Adopt F2’s personal-org as the dual-mode substrate; treat F4’s null-org path as superseded for identity (billing subject can still be user XOR org via `billing_customers`).

### 5.2 Coach approval / HITL vs self-serve consumer

| Source | Stance |
|--------|--------|
| **F1 Agentic** | Coach approval queue for load changes / athlete-visible prescriptions; observational cards may auto-publish |
| **F2 Consumer** | Solo athletes; hide messaging; AI persona for consumers; no academy coach |
| **Product B2B today** | Coach/parent/club_admin roles, assignments, messaging |

**Conflict:** HITL coach review is core to F1 safety model but meaningless for personal-mode solo users. Agent policies must be **mode-aware**: `academy` → coach review gates; `personal` → athlete self-approval / softer auto-publish with stronger non-diagnostic refusals and rate limits.

### 5.3 Genetics / labs visibility

| Source | Stance |
|--------|--------|
| **F1** | Ship labs (Phase 3) and genetics (Phase 4) into agent specialists for academies |
| **F2** | **Do not ship** genetics or labs to consumers; special-category + open RLS |
| **Code** | Routes/UI exist for both |

**Conflict:** Agent tools already proxy labs/genetics. Consumer mode must hard-disable those tools and UI; academy mode needs consent + DPIA before expansion.

### 5.4 AI product packaging / metering

| Source | Stance |
|--------|--------|
| **F1** | Hybrid cards + chat; morning roster brief for coaches |
| **F2** | Rework AI for solo; durable rate limits; write insights store on schedule |
| **F3 Landing** | Athlete+ tier = AI companion only; Free/Athlete without AI |
| **F4** | AI conversation caps + `ai_usage_events` ledger |

**Conflict:** Landing sells AI on Athlete+ before Stripe/entitlements exist. Agent system must reserve metering hooks (F4) and not assume unlimited academy AI when personal tiers launch.

### 5.5 Messaging

| Source | Stance |
|--------|--------|
| **F1** | Reuse messaging; later `insight`/`system` sender |
| **F2** | Hide messaging in personal mode (SafeSport / empty org contacts) |
| **TS tools** | Rich messaging tool suite for coaches |

**Conflict:** Agent must not DM athletes in personal mode; academy bot-identity still missing (R29).

### 5.6 Design system

| Source | Stance |
|--------|--------|
| **F8 Broadcast Console** | Navy + Barlow + `@ppd/tokens` |
| **F3 Landing** | Keep `#0047FF` / Barlow/DM Sans marketing system |
| **F2** | Pick one; mark others superseded |
| Docs | `design-system.md` vs `premium-design-overhaul-v2.md` vs F8 |

**Conflict:** Unresolved. Agent UI (insight cards) should wait for the design pick or use neutral product primitives.

### 5.7 Pricing / CTA honesty

| Source | Stance |
|--------|--------|
| **F3** | Athlete Free / $9.99 / $19.99; Coach from $69; waitlist until Stripe |
| **F4** | Pro €11.99 / Premium €19.99 |
| **F5 Remotion** | “Start free” → org-bound signup today |
| **F13 Academies deck** | Essentials €9 / Performance €19 / Elite €29 per player |

**Conflict:** Three price ladders. Agent metering should key off entitlement plan keys, not landing copy.

### 5.8 Org-required AI vs consumer home insights

Today AI returns 403 without org. F2 wants consumer insights written to `insights` / preference tables. Python nightly batch can write insights, but **no product UI consumes agent Insight schema** (R29). Consumer and academy both need the card surface; only academy needs coach inbox.

---

## 6. Implications for the new multi-agent master plan

1. **Rebase facts on R01–R29 + corrections table**, not F1’s “codebase truth.”
2. **Dual policy plane:** `accountMode ∈ {personal, academy}` must be a first-class input to orchestrator policy (tool allowlists, HITL, messaging, labs/genetics).
3. **Finish Phase 0 leftovers before expanding specialists:** memory write bug, remaining dual-read Garmin paths, Python IDOR on internal auth, durable rate limits.
4. **Do not introduce Temporal as a blocker** if cron + existing `/batch/nightly` can ship; F1’s Temporal choice is unimplemented — decide consciously.
5. **Unify tenancy with F2 personal-org**; reject null-org for agent/RLS unless F4 is rewritten.
6. **Resolve design system** before building InsightCard / CoachInbox UI.
7. **Mark superseded plans** (memory-bank B2C, F10 vs F11, F1 factual section) to stop agent confusion.
8. **Serve both markets with one tool registry**, mode-specific policies — matches F1’s “shared registry” instinct and F2’s mode gating.

---

## 7. Quick status dashboard

| Plan | Built? | Still valid? |
|------|--------|--------------|
| F1 Agentic layer | Partial scaffolding | Direction yes; facts no |
| F2 B2C consumer | Almost none | Yes (blocking) |
| F3 Dual landing | None | Yes |
| F4 Stripe | None | Yes, with org-model conflict |
| F5 Remotion consumer | None | Yes (plan-only) |
| F6 SwingVision overhaul | Significant partial | Yes |
| F7 Perf audit | Partial | Yes |
| F8 Broadcast redesign | Minimal | Yes, contested |
| F9 Landing smoothness | Mostly done | Yes → close out |
| F10/F11 Bench posts | Mostly / partial | F11 current |
| F12 Deck polish | Unclear | Yes |
| F13 White-label deck | Mostly done | Yes |
| F14 Algorithm research | Partial | Yes |
| Windsurf tennis revamp | Partial | Yes |
| R01–R29 research | N/A (audits) | **Authoritative for AI** |
| Memory-bank B2C | None | **Stale / supersede** |

---

## 8. Sources consulted (non-exhaustive)

- All paths listed in §2
- `peak_performance_data/src/app/api/ai-agent/route.ts`
- `peak_performance_data/src/lib/ai/utils/{toolRouter,semanticMemory}.ts`
- `peak_performance_data/src/lib/ai/tools/{specialistTools,queryTools,athleteTools,garminActivityTools,wearableInsightTools}.ts`
- `ppp_ai_agent/{api/main.py,api/middleware/auth.py,api/routes/insights.py,agent/nightly_batch.py,tools/registry.py}`
- `peak_performance_data/src/lib/auth/auth.ts`, `src/middleware/authorization.ts`
- Spot checks: Remotion, PlatformLanding, swingvision-pipeline auth/UI, labs/genetics routes, migrations `20260727_*`
