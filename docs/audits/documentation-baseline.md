---
id: PPD-PORTFOLIO-AUDIT-BASELINE
last_reviewed: 2026-09-13
owner: daniel
related:
  - PPD-PORTFOLIO-REPOSITORIES
schema_version: 1
status: draft
title: Documentation baseline audit
type: explanation
visibility: internal
---

# Documentation baseline audit

This is the starting evidence baseline for the documentation system rollout described in ADR-0001. It records the repository state observed on 2026-09-13 before any documentation work began.

## Superproject state

| Field | Value |
|---|---|
| Root HEAD | `742306b28a233ab19cdc5d48f813d067397c201a` |
| Branch | `master` |
| Audit date | 2026-09-13 |
| Working tree | Pre-existing `_plans/` deletions and one untracked `_plans/plan-9ca601f2d6aaafc2.md` — both preserved untouched per plan scope |

## Direct submodule revisions

| repo_id | Path | Revision |
|---|---|---|
| app | `PeakPerformanceData/peak_performance_data` | `86faf8651a0be6f013af1bd49f8b0304f4b5273b` |
| backend | `PeakPerformanceData/ppd_backend` | `78fce68afcecccec201cf1116b98c0fe246340ca` |
| extraction | `PeakPerformanceData/ppd_extraction_backend` | `0433060b29a23bd2f29c761c10bcf9af4a58d812` |
| legacy-extraction | `PeakPerformanceData/ppd_legacy_extraction_backend` | `69fe3e3c28f5c524d5f1ad018f422667653e9f98` |
| research | `PeakPerformanceData/ppd_research_papers` | `a360e9a945ad4aca5b7259f591ee8641f7d05545` |
| vision | `PeakPerformanceData/ppd_vision` | `38d1e02e2ef6c94a9a04764458556667102b9565` |
| agent | `PeakPerformanceData/ppp_ai_agent` | `335e5bc61e2063ab7d2d54050782f80488f4f106` |
| swingvision | `PeakPerformanceData/swingvision-pipeline` | `1fe4763785d0318c38969a60c65b97ee57a6428a` |
| ai-videos | `PeakPerformanceDataMarketing/AI Videos` | `fe0f091a29f593c04a3696b47e2409068d63150e` |
| academies | `PeakPerformanceDataMarketing/AcademiesPresentation` | `5a1731a6f4f8fa0dc7dc0d739763262c1afb06e5` |
| manim | `PeakPerformanceDataMarketing/Manim` | `74af23758dab981bcbb4cc09208851708589c8fe` |
| remotion | `PeakPerformanceDataMarketing/Remotion` | `8ebd56149adbb6d17d52b4184a10628667cfb719` |
| bodyviz | `PeakPerformanceDataMarketing/ThreeJS` | `e3d28497e19c34d05beaf6d1561b0e7bc62cc2d9` |
| courtviz | `PeakPerformanceDataMarketing/courtviz` | `583692443f4c50f9e2a3602335ad546646933de8` |

## Nested dependency occurrences

| repo_id | Parent | Path | Revision | Role |
|---|---|---|---|---|
| bodyviz | app | `PeakPerformanceData/peak_performance_data/vendor/bodyviz` | `00caeda7b8b36d5b1aabe054e1889e0379780b68` | dependency |
| courtviz | app | `PeakPerformanceData/peak_performance_data/vendor/courtviz` | `7bad49b63d8daa6aff877cdb652462fb94a0fb05` | dependency |

The nested Courtviz and BodyViz checkouts are pinned at different revisions from the marketing checkouts of the same repository identities. This is intentional and must not be normalized away.

## Existing root documentation

| Path | Status at audit | Notes |
|---|---|---|
| `README.md` | Incomplete | Lists fewer submodules than `.gitmodules` defines |
| `docs/api.md` | Stale | Simplified paths; does not match actual router composition |
| `docs/architecture.md` | Partially current | Useful overview but not source-linked or version-pinned |
| `docs/database.md` | Partially current | Omits Vision and SwingVision separate stores |
| `docs/review-findings.md` | Historical | Dated security review with stale claims (see DG-04) |
| `docs/setup.md` | Stale | Says npm while frontend declares pnpm; port mismatch |

## Evidence-backed gap register

| ID | Observed gap | Source evidence | Documentation response |
|---|---|---|---|
| DG-01 | Incomplete portfolio map | Root README lists nine submodules; `.gitmodules` defines 14 | Complete generated registry and navigation |
| DG-02 | Starter onboarding and wrong port | App README says port 3001; package scripts use 3000 | Replace starter prose with accurate project onboarding |
| DG-03 | Package-manager/version drift | Root setup says npm; app/Courtviz/BodyViz declare pnpm 9.15.0; SwingVision CI uses npm | Per-repository command/toolchain records |
| DG-04 | Stale review findings | Root review says no frontend CI, no AI tests, no Stripe SDK; current files contain all three | Dated corrections, historical status, current evidence index |
| DG-05 | Stale product and role model | `_memory_bank/app-design-document.md` describes Strava-centered behavior and three roles; current identity paths differ | Current capability baseline and explicit persona/access review |
| DG-06 | Unsafe inference from role labels | `match-access.ts` recognizes `admin`, while other paths use `club_admin` | Document role names exactly per boundary; do not normalize away differences |
| DG-07 | Architectural diagram sources mostly historical | Mermaid search primarily surfaced `_plans/` documents | Owned, source-linked living diagram set |
| DG-08 | Backend docs folder already publishes another artifact | `ppd_backend/docs/README.md` describes an athlete analysis report | Use `ppd_backend/engineering/`; preserve report folder |
| DG-09 | Root data model omits a separate store | Vision owns PostgreSQL `db/migrations/`; SwingVision has another migration set against documented shared Supabase | Separate store/schema ownership and shared-table coordination |
| DG-10 | API inventory is not faithful to router composition | Graph router prefix is `/api/v1/graphs`; weekly routes are included under `/api/weekly-km-pace`; root API guide uses simplified paths | Source-derived route inventory, separately reviewed auth contract |
| DG-11 | Vision README lists only health | `api/routes/analysis.py` implements analyze/status/results | Complete contract reference and state model |
| DG-12 | Configured security checks are advisory | App CI marks dependency audit and SQL security test step `continue-on-error` | Separate configured, executed and enforced states |
| DG-13 | Local schema reproduction is unverified | Baseline SQL explicitly says best-effort reconstruction; config/CI comments mention missing baseline | Label reconstructed/local/live state distinctly |
| DG-14 | SQL test structure needs investigation | `plan(10)` with nine visible assertions; cross-user fixture creation after role switch | Separate remediation item; do not claim executed failure or fix in docs scope |
| DG-15 | Migration drift script has a semantic mismatch | Script compares full filename stems to remote `version`; Supabase CLI separates timestamp version and name | Do not treat script output as proof without remediation/verification |
| DG-16 | Historical future agent architecture differs from code | Next AI route still owns `streamText`; specialist tools call Python service | Describe split orchestration, not proposed future frameworks |
| DG-17 | Evaluation helpers are narrower than their claims | Python harness uses pattern detection/value substrings; tests use constructed outputs | Label unit/helper checks, not end-to-end model safety |
| DG-18 | Identity forwarding does not prove verification | App wearable client forwards optional bearer token; extraction main has no auth middleware; sampled provider helper checks header presence | Observed versus required trust boundary and separate remediation |
| DG-19 | Offline scoring has hidden lifecycle complexity | `scorekeeper/outbox.ts`, types/reducer and existing outbox tests | Separate scoring state from synchronization state; document retries/session boundaries |
| DG-20 | Research and implementation claims disagree | Research questions ACWR bands; `training-load.ts` labels thresholds optimal/danger | Metric evidence cards and unresolved scientific-claim register |
| DG-21 | Adapter richness differs across consumers | `courtviz-adapter.ts` minimal enrichment uses null winner/rally values | Document actual adapter contract; do not imply a full point join everywhere |
| DG-22 | Runtime/tooling support lifecycle is stale | Existing workflows use Node 20; official Node release table marks it EOL | Use supported LTS for new isolated doc tooling; product upgrades separate |
| DG-23 | Declared gallery check has uncertain prerequisites | BodyViz gallery script invokes Playwright; inspected gallery/root manifests do not declare it | Record declared/unvalidated; do not claim runnable visual coverage |
| DG-24 | Marketing documentation omits/contradicts compositions | Remotion README mixes 30/45-second claims; `src/Root.tsx` registers marketing and consumer compositions | Generate/verify composition reference from actual configs |
| DG-25 | Frozen video path should not be revived | Courtviz `apps/video/FROZEN.md` redirects match analytics to interactive/seekable exports | Explicit agent task-routing constraint |
| DG-26 | Sensitive historical/report content complicates publication | Existing athlete reports, dataset summaries, operational identifiers and research PDFs | Private-first classification and no blanket indexing/publication |

## Preservation constraints

The following working-tree state is preserved untouched by this documentation rollout:

- Pre-existing `_plans/` deletions (10 files removed before this session).
- Untracked `_plans/plan-9ca601f2d6aaafc2.md` (IDE/open-document artifact).
- All application source code, tests, migrations, CI workflows, and configuration.
- All existing documentation files (updated in place, not deleted or moved without approval).

## Correction note

An earlier security review (`docs/review-findings.md`) claimed no frontend CI, no AI-agent tests, and no Stripe SDK. Repository inspection on 2026-09-13 contradicted all three claims: frontend CI exists at `.github/workflows/ci.yml`, AI-agent tests exist under `tests/api/ai-agent/`, and Stripe SDK is present in `package.json`. The review must be treated as historical evidence with a date/status label, not current truth.
