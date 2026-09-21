---
agent: devin-local
session: veil-beach
created: 2026-09-19T00:14:16Z
---
# Performance Workspace: UI/UX and Speed Megaplan

Transform the four core coaching screens and shared shell into a restrained, fast, trustworthy desktop/mobile performance workspace, fixing loading correctness before redesigning presentation and optimizing measured bottlenecks.

## 1. Summary and recommendation

This is not a card-reskin project. The current application has many individual optimizations, but several do not compose correctly: server seeds can be rejected, cache consumers disagree on keys and payloads, optional work blocks critical work, and failures can become misleading empty states. The visual design compounds the problem by giving almost every item the same card treatment and devoting large areas to animated placeholders rather than useful context.

Deliver this as a sequence of independently reviewable work packages:

1. Establish honest baselines and reproduce source-confirmed bugs with behavioral tests.
2. Fix transport, cache identity, cancellation, and data-state correctness.
3. Approve desktop/mobile reference designs for overview and physiology.
4. Implement physiology, overview, tennis, and fitness redesigns on those foundations.
5. Optimize remaining backend bottlenecks using measured evidence.
6. Verify accessibility, numerical parity, cross-role compatibility, mobile performance, and rollback before release.

**Recommended first implementation slice:** WP-00 baseline + WP-01/WP-02 loading correctness + WP-03 reference screens. Do not begin a product-wide visual rewrite or infrastructure migration.

### Research evidence boundary

- Research performed on local source and the five supplied screenshots. App/backend git worktrees were clean when checked.
- App revision: `f4c9b736082030253815193bd3d42e77867f0efd`.
- Backend revision: `d77f6d1b66ce58db4fbf75956d38a610167a97c0`.
- No production access, database queries, application builds, tests, dependency installation, or application edits occurred during planning.
- This file is the only edited artifact. Findings below are static/source observations, not measured production timings or executed test results.
- The existing `docs/evidence/performance-baseline-2026-08-28.md` explicitly says performance was not measured. Percentages and timings in source comments are not accepted as current evidence.
- Next.js 15 native-history behavior and SWR cache/provider behavior were checked against documentation using Context7. Do not adopt newer SWR APIs from main-branch documentation without checking the installed version; no framework upgrade is proposed.

## 2. Decisions confirmed with Daniel

| Decision | Agreed direction |
|---|---|
| Visual style | Restrained, professional performance-analysis workspace, not a decorative generic dashboard |
| Brand | Preserve academy logo and red accent; retain tenant-specific identity rather than hardcode Barcelona red for every academy |
| Scope | Coach overview, physiology, tennis analytics list/detail, fitness tests, shared shell/navigation |
| Devices | Desktop and mobile are equally important; tablet also verified |
| UX freedom | Reorganize workflows and use progressive disclosure while retaining features |
| Technical scope | Full stack where justified; migrations, infrastructure and security-policy changes separately gated |
| Evidence now | Local source research; runtime profiling starts after execution approval |
| Cache behavior | Same-athlete/same-range cached values may show immediately, labeled with freshness, then refresh |
| Proposed speed targets | Useful initial content <=2.5s desktop / <=4s defined mobile profile; warm revisit <=500ms; interaction feedback <200ms |
| Design approval | Daniel reviews overview + physiology desktop/mobile reference screens before broad visual rollout |

### In scope

- `/[locale]/coach` and its overview/athlete/admin panels where needed to preserve the existing workflow.
- `/[locale]/charts`, including authorized athlete selection, provider visibility, official/legacy sources, date filtering, and all existing metric families.
- `/[locale]/coach/tennis-analytics`, including list, match detail, import/upload entry points, video, four analysis tabs, share/edit/delete controls, and links to progress/live scoring.
- `/[locale]/performance-tests`, including analysis, comparison context, raw records, and add/edit interactions.
- Shared desktop sidebar, mobile navigation, page spacing, typography, status/loading patterns, scoped prefetch/cache behavior and relevant BFF/backend paths.
- Regression compatibility for player/parent/admin users of shared components and public match-watch consumers.

### Explicitly out of scope

- Redesigning training, tournaments, messages, reports, health, feedback, marketing, billing or the entire athlete/parent product.
- Replacing Next.js, SWR, Recharts, Radix, Tailwind, Courtviz or BodyViz; broad dependency upgrades.
- Changes to readiness formulas, ACWR risk bands, fitness benchmark definitions, tennis scoring/repair semantics or health-access policy without separate domain/security approval.
- Video-processing pipeline redesign, wearable ingestion redesign, new AI-generated recommendations, new analytics metrics, and removing existing capabilities.
- Vendor checkout normalization, marketing Courtviz changes, infrastructure scaling, Redis provisioning, database/index migrations or production benchmarking without specific approval.

## 3. Repository and governance boundaries

Paths below are relative to these roots:

- **APP:** `PeakPerformanceData/peak_performance_data` — repository `app`, occurrence `app-direct`, active application, namespace `PPD-APP`, docs root `docs`. Next.js 15.5.25, React 19, SWR 2, Recharts 2, Tailwind 3; **pnpm 9.15.0**.
- **BACKEND:** `PeakPerformanceData/ppd_backend` — repository `backend`, occurrence `backend-direct`, active service, namespace `PPD-BACKEND`, engineering docs root `engineering`; FastAPI/ClickHouse, pip/pytest.
- **VENDOR:** APP `vendor/courtviz` is occurrence `app-courtviz-vendor`, not the marketing checkout. APP `vendor/bodyviz` is separately pinned. Neither is to be repinned as part of this plan.

Read/controlling references:

- Portfolio/app/backend `AGENTS.md`; `docs/repositories.json`.
- `PPD-PORTFOLIO-GOV-EVIDENCE`: distinguish declared, prerequisites validated, executed, enforced.
- `PPD-PORTFOLIO-PRODUCT-CAPABILITY-MAP`: performance graphs span APP/BACKEND; ingestion belongs elsewhere.
- `PPD-APP-ARCH-IDENTITY`, `PPD-APP-ARCH-WEARABLES`, `PPD-APP-ARCH-TENNIS`, `PPD-BACKEND-ARCH-OVERVIEW`.
- `PPD-APP-DOCS-VERIFICATION` and `PPD-APP-EVIDENCE-PERFORMANCE-BASELINE-2026-08-28`.
- `PPD-PORTFOLIO-PRODUCT-DECISION-REGISTER`; **RG-02/DG-23** scientific disagreement about ACWR labels remains unresolved. **DG-06** role differences must not be silently normalized. **DG-18** extraction trust gap is not a graph-performance fix.
- APP `docs/design-system.md` is superseded, directing new UI to shared PPD tokens. Observed runtime styling differs: app aliases and brand CSS dominate, and the checked-in integration CSS at `vendor/courtviz/integration/css/ppd-variables.css` is a stub. Treat this as a build/source-authority discrepancy to verify, not proof of production appearance.

These documents are predominantly drafts/source descriptions. The `UX-*`, `PERF-*`, `DATA-*`, and `SAFE-*` criteria below are new requirements proposed by this plan, not invented pre-existing accepted IDs.

**Risk:** medium for layout/components; high for authenticated caches, health data, cross-service contracts, metric summaries, and any database work. Only Daniel approves. Preserve comments unless separately authorized to change them. Keep modified imports, component props, and independent variable declarations alphabetically ordered; do not reorder dependent initializations into invalid execution order.

## 4. Findings and evidence ledger

### 4.1 Physiology

| ID | Source-confirmed observation | Consequence / confidence |
|---|---|---|
| F-01 | APP `src/app/[locale]/charts/page.tsx:145-160` and `src/lib/dashboard/user-providers-snapshot.ts:32-35` call PPC without internal-service or bearer credentials. BACKEND `api/middlewares/auth.py:29-55`, registered in `api/main.py:28`, requires one. APP proxy supplies the internal credentials. | Local contract mismatch is confirmed. If deployed versions match, SSR seed/provider lookup gets rejected. Production linkage and latency impact remain unverified. |
| F-02 | `ExplorationDateRangeProvider.tsx:72-89,130` initializes even an SSR-provided range in an effect and renders null until then. | Chart subtree cannot use server fallback until hydration/effect. Confirmed render gate. |
| F-03 | SSR NDJSON seed accumulates entries and returns after both requested types, stream end, or 1500ms deadline (`charts/page.tsx:170-205,361-369`). | Comments claiming first-graph streaming overstate behavior. Route shell streaming is not independent chart streaming. |
| F-04 | `useGraphBatchPrefetch.ts:261-275` cached fast path calls completion, not start. `ChartsContent.tsx:539-541,631` enables wave 1b only on start. | Cached HRV/RHR can leave the remaining visible batch unstarted; individual hooks may rescue it later. Reproduce with real hooks. |
| F-05 | `useGraphBatchPrefetch.ts:253-269` treats `cache.get(key)` as the response, not SWR state containing `.data`; `useGraphData.ts:173-175` equates cache-entry existence with response availability. | Empty/loading/error state wrappers can be mistaken for usable cached responses. |
| F-06 | `graphBatchRegistry.ts:25-34,95-100` has one controller for concurrent same-range batches; `ChartsContent.tsx:517-525` invokes unscoped cancellation on setup. Registry pending graph types are not tracked. | Cancellation ownership and per-graph waiting are incomplete; superseded work can survive and new work can be aborted. Actual lifecycle races require behavioral tests. |
| F-07 | Batch seeds discard every `success:false`, including confirmed empty responses. Individual fetching separately applies grace, 6s batch wait, polling, retry and error-confirmation logic. Proxy stream timeout is cleared after response headers (`ppc-proxy/.../route.ts:243-254`). | Duplicate fallback/retry work and unbounded body stalls are possible; current timers do not provide one end-to-end deadline. |
| F-08 | `GraphContainerRecharts.tsx:1268-1280,1830-1832` can convert errors after polling expiry into no-data or keep displaying a skeleton. | Misleading state, not just cosmetic delay. A timeout is not evidence of no measurements. |
| F-09 | Hidden chart groups are prefetched by wave timers; dropdown opening prefetches up to three other athletes; chart-hover preload imports heart/sleep/training/pace chunks (`useChartsHoverPrefetch.ts:64-82`). | Speculation competes with current tasks. Amount of real contention requires trace evidence. |
| F-10 | BACKEND `_compact_graph_data` strips all layout and most metadata (`graphs.py:212-241`), but renderer reads shapes, barmode, y-axis ranges, volume_metric and sleep insight fields (`GraphContainerRecharts.tsx:915-1040,1236-1240,1286-1288,1408-1421`). | Payload contract is inconsistent. Reducing bytes must preserve presentation/interpretation metadata. |

### 4.2 Overview

| ID | Source-confirmed observation | Consequence / confidence |
|---|---|---|
| F-11 | `coach-init.ts:48-105` puts 100 observations in critical work, then awaits enhancement results before starting matrix seed (`176-193`). Matrix seed budget is 4500ms; page races whole init at 1500ms. | Roster may be discarded into an empty partial fallback while original work continues. Comments about parallel tiers are inaccurate. |
| F-12 | `CoachApprovalGate.tsx:38-45,67-86` waits for a client approval request before rendering children. | Another post-hydration gate even when SSR dashboard data exists. Preserve approval policy while moving resolution/seed earlier. |
| F-13 | `coach-matrix-fetch.ts:125-154` waits for readiness RPC, then bulk supplemental queries, then snapshots. `coach-athletes-matrix.ts:93-109` bounds concurrency to four but waits for all. `readiness-snapshot.ts:661-670` races without aborting inner work. | Independent work is serialized; large rosters and stalled upstream calls can delay all metrics. |
| F-14 | `completeness.ts:54-55` treats any metric row as complete and nonnegative roster count as query success. SSR/API init shapes differ; client considers one real athlete a nonpartial matrix seed (`useSWR.ts:574-610`). | Partial/failed states can be presented as complete, and enhancement timeouts may never refill. |
| F-15 | Typed metric/status/freshness/scoped-key helpers exist, but current target consumers do not import them. `bff-merge.ts` is not wired to these routes, calls `/api/v1/wearables/summary`, while BACKEND mounts `/wearables/summary` without prefix. Its claimed bounded fetch is `Promise.all`. | Do not claim the planned typed architecture is already live or substitute it blindly. Reuse types; wire only tested paths. |
| F-16 | Two summary implementations exist: `/api/v1/summary` derives from graphs; `/wearables/summary` reads metrics directly. Their time windows, sleep extraction, HRV source, ACWR and freshness differ. | Replacing one with the other is a semantic migration, not a safe drop-in optimization. Keep outside the initial critical-path fixes. |

### 4.3 Tennis and fitness

| ID | Source-confirmed observation | Consequence / confidence |
|---|---|---|
| F-17 | Coach tennis SSR fetches `athletes[0]` list before requested match detail (`page.tsx:130-151`), while client initializes selected player from URL. | Wasted list work / wrong seed for non-first athlete; deep link waits on unrelated list. |
| F-18 | Client URL updates use `router.replace`, alongside SWR detail/list fetches. Local state is initialized from URL but not comprehensively derived from later URL changes. | Potential duplicate RSC/BFF work and broken back/forward state. Request impact must be measured. |
| F-19 | Detail prefetch key includes `hasVideo=1`; selected-detail key does not. `initialMatchDetail` is unconditional fallback (`TennisAnalyticsContent.tsx:225-280,1213-1214`). | Prefetch misses on common video matches; stale seed can be applied to a different selection. |
| F-20 | Full match loader awaits match row then five relations and repairs before any detail (`match-detail.ts:416-544`). Detail/default tab/court render are nested lazy client boundaries. Sets are freshly sorted every render (`TennisAnalyticsDetail.tsx:197`) and feed memo dependencies. | Header/score waits on bulk shots and code; transforms rerun unnecessarily. DB response caps must be checked with >1000-row fixtures. |
| F-21 | Fitness analysis waits for graph-pool although selected tests are SSR-seeded (`PerformanceTestsClient.tsx:221-230,277-305`). Collapsed raw section renders hidden children (`181-183`). | Unnecessary data/code gate and hidden work. |
| F-22 | Fitness pool uses keepPreviousData across athletes; `PhysicalTestGraphs.tsx:49` falls back to first athlete; pool query globally limits all peers to 500 rows (`graph-pool/route.ts:228-238`). | Wrong-athlete display is possible when selected rows are absent; selected history can be displaced by peers. |
| F-23 | Fitness group-score cache omits profiles from key (`PhysicalProgressTimeline.tsx:95-147`), and default demographics are male/junior until profile resolves. Radar uses a 520x440 box with 120px radius and tiny SVG labels. | Stale benchmark context risk; poor use of screen area. Missing demographics must remain explicit. |

### 4.4 Shell, cache and backend

| ID | Source-confirmed observation | Consequence / confidence |
|---|---|---|
| F-24 | AppShell focus ref starts null and returns before initializing (`AppShell.tsx:152-160`). Test manually initializes it outside the component. Scroll map keys only pathname. | Focus-on-navigation is broken by inspection; match/filter history needs finer restoration. |
| F-25 | AuthContext mounts per-user SWR provider; generic prefetch writes through global mutate (`useSWR.ts:440-448`). PrefetchLink always enables viewport prefetch despite its own prefetchRoute/network gates. | Prefetch can warm the wrong cache and duplicate server/API work. |
| F-26 | Session cache restores stale state, timestamps are refreshed on any SWR set, and global stale revalidation is disabled (`swr-config.ts:124-162,178-196`). Graph persistence keys include target URL but not viewer/org/role; old local-storage entries migrate without proven viewer ownership. | Fetch freshness and observation freshness are conflated. Account/role/org transitions need explicit coverage; persistence alone does not prove safe reuse. |
| F-27 | SW caches `tennis-matches-cache` (`next.config.js:322-330`) but neither cleanup name list includes it (`cacheInvalidation.ts:17-28`, `cache-warm-sw.js:28-39`). | Confirmed invalidation coverage gap; exposure depends on lifecycle. This requires security review before rollout, not a claim of observed data leakage. |
| F-28 | Provider discovery runs synchronous ClickHouse query inside async route (`graphs.py:267-310`). Direct metric aggregation does the same (`wearables.py:159`) and executes several queries sequentially. Graph-cache Redis access is synchronous. | Event-loop blocking candidates. Provider path is active; unused aggregator must not be called the current UI root cause. |
| F-29 | Graph API uses 8-worker executor; legacy summary uses default executor and a differently constructed cache key. Query single-flight already exists in GraphDataProcessor; generated-graph cache has L1 + optional Redis L2. | Share existing primitives rather than add speculative caches. Per-process behavior is not cross-instance dedupe. |
| F-30 | Chart instrumentation covers individual GET phases, not full batch/SSR journeys; render end uses requestAnimationFrame and shared chart-type mark names. Bundle checker omits fitness and skips missing target routes. | Existing numbers cannot establish end-to-end UX. Need correlated measurements and meaningful-content events. |

### Visual observations from the screenshots

- Page heading, greeting, role badge, roster strip and large quick-action tiles consume space before the coach reaches reviewable athletes.
- Repeated red icon tiles, rounded cards, pills, shadows and muted backgrounds make distinct workflows look interchangeable.
- Chart placeholders occupy the same large area as final charts, with multiple simultaneous animations and little useful context.
- Tennis deep-link loading does not preserve a useful score/metadata header, and video placeholder space can dominate the page.
- Fitness radar is visually small inside a much larger panel; six small metric cards do not make comparison easy.
- Sidebar truncates the longest label. Charts/labels look low-contrast at screenshot scale, but browser zoom and physical display scale are unknown; actual CSS/contrast will be measured rather than inferred from pixels.

## 5. Acceptance criteria

### Performance targets and measurement rules

These are proposed release targets agreed in direction, **not claims about current performance**. WP-00 freezes the environment and baseline. If a target is not feasible without gated infrastructure work, report the shortfall and its cause; do not redefine useful content or quietly lower the budget.

| ID | Acceptance |
|---|---|
| PERF-01 | p75 time to first useful target content <=2.5s desktop and <=4s mobile under the reference profiles below. Track shell, first useful content, first chart, and full selected-section completion separately. |
| PERF-02 | p75 warm same-scope revisit <=500ms to useful cached content; background revalidation must not replace it with a full skeleton. |
| PERF-03 | Selection/tap feedback <100ms preferred, <200ms required; field/lab interaction duration p75 <=200ms. Uncached data completion separately targets <=2s desktop / <=3s mobile. |
| PERF-04 | LCP p75 <=2.5s desktop / <=4s throttled mobile lab; CLS <=0.1. Field CWV targets after approved RUM are separate from small-sample lab percentiles. |
| PERF-05 | No duplicate in-flight request for an identical resource key; no full-match shot payload before summary readiness; no hidden-category graph requests until visibility/intent demands them. |
| PERF-06 | No work attributable to unopened fitness records, inactive tennis tabs, video playback or chart categories in initial critical JS/render path. At most two graph batch transports active per viewer; one on constrained connection. |
| PERF-07 | At least 50% p75 improvement on a target journey that exceeds its absolute useful-content budget at baseline; already-fast journeys must not regress >10% across comparable repeated runs. Report both values, counts and distributions. |
| PERF-08 | Long-task trace review for athlete switch, scrolling, chart tooltip, tennis tab and fitness comparison; no new >=200ms main-thread task from those interactions on reference mobile profile. No animation-induced scroll blocking. |

**Reference lab profiles:** desktop Chrome at 1440x900, normal CPU, 40Mbps down/10Mbps up/40ms latency; mobile Chromium at 390x844, 4x CPU slowdown, 4Mbps down/1Mbps up/150ms latency. Also test 360px, tablet 768/1024px, 1280px, 1920px and real iOS Safari/Android Chrome. Record exact browser/hardware/throttling settings; emulation is not proof of real-device behavior.

**Sampling:** five exploratory runs per scenario to find bottlenecks, then at least 20 comparable baseline/final runs for core route/profile/cache-state scenarios. Separate cold-browser/warm-server, warm-browser, and controlled cold-server cohorts; do not mix them. Use process restarts only in an approved isolated environment. Do not clear production caches. Store sanitized artifacts and fixture IDs, not patient/athlete data or tokens.

**Useful content definitions:**
- Overview: correct authorized roster identities/count plus usable athlete-review entry points; readiness/attention completion is a separate required measure, not hidden by a fast roster.
- Physiology: correct athlete/range plus at least one actual visible metric/series, or a confirmed empty state for an intentionally empty fixture. Populated-fixture runs cannot pass with an error or empty state.
- Tennis detail: correct participants/date/set scores and available authoritative summary values. Full shot-derived analysis has its own completion measure.
- Fitness: selected athlete's latest recorded values and labeled comparison context, without waiting for peers.

### Product, design and safety

- **UX-01:** One clear page title and primary action; no duplicated dashboard heading/greeting stack. Daniel approves desktop/mobile overview + physiology reference screens.
- **UX-02:** Coach can identify who needs review, open an athlete's physiology, inspect a match and compare fitness periods without losing selected athlete/context. Key tasks are reachable within one page-level action after selection.
- **UX-03:** WCAG 2.2 AA target: contrast >=4.5:1 for ordinary text, >=3:1 for relevant controls/large text; visible focus, semantic headings/tables/tabs, 44px product touch targets, no color-only statuses, reduced-motion support, 200% text zoom and 320px reflow checks.
- **UX-04:** No page-level horizontal scrolling. Dense tables may scroll within labeled regions; no clipped axis labels or hover-only essential information on mobile.
- **UX-05:** All current metric families, tennis tabs/import/share/video/live-score entry points, and fitness record actions remain discoverable. No placeholder/fake data presented as real.
- **DATA-01:** Ready, empty, unsupported, loading, refreshing, stale, partial, offline, forbidden and error are distinguishable. Transport timeout never becomes confirmed no-data; incomplete readiness never becomes “all clear.”
- **DATA-02:** Cache identity includes viewer, organization, role/account mode, athlete, source, range, resource/match and schema as applicable. A new athlete shows its own cached data or a loading state, never previous-athlete values.
- **DATA-03:** `receivedAt`/cache age, `generatedAt` and `observedAt` are distinct. Unknown observation time is labeled unknown, not “fresh.” No silent TTL extension from unrelated SWR state changes.
- **DATA-04:** Scores, units, period boundaries, statistical denominators, null-vs-zero semantics and tennis repair outputs retain approved behavior. Numerical differences are reviewed as domain changes, not accepted as optimization side effects.
- **SAFE-01:** Verified server identity and DB role/assignment checks remain; client query parameters, prefetch and caches never grant access. No new raw peer health data exposure.
- **SAFE-02:** Logout/account/org/role transitions invalidate scoped data, pending requests and applicable SW caches; delayed old responses cannot repopulate the new scope. Session persistence is bounded and is not offline authorization.
- **SAFE-03:** No production access, migrations, security-policy modifications, vendor revision changes, commits/pushes or deployments without the corresponding explicit approval.

## 6. Design specification

### 6.1 Visual foundations

Use the current stack and semantic token pipeline. Add an **opt-in workspace variant** to existing APP primitives rather than globally restyling every legacy page. Keep the shared vendor package intact. Resolve the token-stub discrepancy before trusting a production build comparison.

- Inter for navigation, controls, data and body. Use tabular numerals with normal/semibold weight, not the global thin `.metric-value` style. No new webfont dependency; avoid serif display typography in these analytical views. Barlow remains available for existing branded surfaces, not required for every heading.
- Workspace H1: 28px desktop / 24px mobile, 600 weight; H2: 20px; panel heading: 16px; body/control: 14-16px; secondary labels: 12-13px. No essential 8-11px SVG labels. Chart axes >=12px at intended rendered size.
- Neutral page background, distinct near-white content surfaces, readable dark ink, deliberate hairline separators. Red reserved for primary action, selection and an occasional athlete series; semantic warning/error colors remain separate from tenant branding.
- Spacing rhythm 4/8/12/16/24/32px. Workspace margins 24-32px desktop and 16px mobile; one owner for page padding. Eliminate nested page padding and multiple full-width max-width wrappers.
- Main panel radius 8-12px, controls 6-8px. Border-led grouping; shadows reserved for popovers/dialogs. No repeated gradient top rules, glows, hover-lift on static cards, pill around every label, or decorative icon block on every heading.
- Motion: 120-180ms color/opacity feedback. No entrance stagger on analytical content and no spinning/pulsing/bouncing combinations. Respect reduced motion for charts as well as CSS.
- Data display: label + value + unit + observation/date context. Up/down change is neutral unless the metric has an approved favorable direction; increasing temperature or resting HR is not automatically green.

**Reuse/extend:** `page-header.tsx`, `card.tsx`, `empty-state.tsx`, `skeleton.tsx`, `tabs.tsx`, existing table/button/select/popover primitives, `src/lib/design-tokens.ts`, `tailwind.config.js`, workspace-scoped CSS in `globals.css`. Keep legacy variants compatible. Add only the necessary small composition components: `WorkspaceToolbar`, `DataStatus`, and an accessible metric comparison/table surface, preferably near current feature components.

### 6.2 Shared shell/navigation

- Preserve route URLs and role gates. For coach navigation, organize existing links into Work, Analysis and Support groups without hiding destinations. Use a shorter display label “Physiology” (page title retains “Physiological performance”) to avoid permanent ellipsis; localize the short label.
- Desktop expanded sidebar approximately current 260px; tablet rail approximately current 72px. Keep collapse control and icon tooltips; active state is a solid subtle tint and simple rule, no glow or horizontal movement.
- Use one top bar for academy/account/notifications/theme; do not repeat role badges at every page heading. Preserve assistant access as a secondary utility without obscuring bottom controls.
- Mobile keeps existing role-appropriate bottom navigation destinations initially; restyle and improve menu grouping rather than introducing a new navigation taxonomy. Analysis destinations are explicit in the menu; context selector is on the page, not hidden behind navigation.
- Stable geometry at first paint: resolve saved sidebar preference in the server shell using a non-sensitive preference cookie, with CSS tablet/mobile defaults; migrate existing local preference once. Do not infer responsive width from user-agent alone. Preserve manual collapse preference on resize.
- Document/window owns vertical scrolling. Remove unnecessary nested vertical overflow in target pages; local table overflow remains. Initialize the focus ref correctly; announce route changes and restore focus to the opening row on detail-back.
- Scroll restoration uses semantic view identity: pathname + athlete/match/group/tab, excluding volatile tracking params. Store list scroll position before entering detail; restore after the list's geometry is ready rather than before data exists. Respect reduced motion for programmatic scroll.

### 6.3 Coach overview: operational workspace

Desktop composition:

```text
Overview / Today                                  Create session   More
Academy · date                       Data updated ... / partial ...
Roster 9  |  Reviewed ...  |  Wearable data ...  |  Readiness ...
------------------------------------------------------------------
Athletes needing review / searchable roster       Today's schedule
Name  Readiness  Sleep  Load  Freshness  Action     Time / Court / Group
...                                               Compact empty state
------------------------------------------------------------------
Selected athlete detail                           Notes / pending items
Physiology   Fitness tests   Tennis analytics      Existing actions
```

- Keep the roster strip compact; prioritize reviewable rows and schedule above large quick-action tiles. Move five equal action tiles into a primary Create session action plus a restrained secondary toolbar.
- One greeting/date line, not a dashboard title plus tabs plus large greeting hero.
- Attention list and roster matrix expose real coverage: e.g. “7 of 9 updated, 2 unavailable.” “No flags in available data” differs from a complete “No athletes need review.” Reviewed items do not erase actual risk counts.
- Focused athlete panel is a useful summary with links to all three analytical screens carrying the same athlete ID. Distinguish missing sleep from 0h, unavailable risk from low risk, and cached metrics from current observations.
- Existing Athletes and Admin tabs remain reachable, but heavy tab content and pending-request enrichment load when needed. Existing approval/note mutations stay intact.
- Mobile: top action + compact roster status, review list first, schedule next, selected athlete disclosure. Rows become readable stacked summaries rather than horizontally squeezed matrices. Keep selection within page context; no auto-dismissal of important information merely by changing a dropdown without explicit reviewed semantics.

### 6.4 Physiology: focused analysis rather than a 30-card feed

```text
Physiological performance                  Athlete selector
Range: 30d  90d  180d  1y  Custom          Source / last observation
Recovery | Sleep | Training | Activity | Pace & routes | ...
------------------------------------------------------------------
HRV: value / unit / observed date      Resting HR: value / unit / date
[readable focused chart]              [readable focused chart]
Additional metrics in selected group / expand as needed
```

- Preserve **90-day default** and existing 30/90/180/365/custom/all-time behavior; all-time remains the current bounded five-year interpretation, clearly labeled rather than claiming unlimited history.
- Group mapping (no metric removal):
  - Recovery: HRV, resting HR, recovery score, SpO2, temperature, respiration, stress, Body Battery.
  - Sleep: duration, efficiency, stages.
  - Training: weekly volume, consistency, training load, intensity balance, workout HR/duration/calories.
  - Activity: steps, daily calories, intensity minutes, VO2max.
  - Pace & routes: weekly velocity, volume/pace trends, pace over time, relativization, markers, course performance.
  - Women's health: existing menstrual-cycle metric only under current visibility/permissions; no speculative prefetch of this category.
- Desktop starts with HRV/RHR; other active-group graphs mount/fetch near viewport. Inactive groups show navigation, not giant skeleton panels.
- Mobile starts with one focused graph and a labeled metric selector; selecting another metric loads only that graph. Offer a comparison/list view for users who want several metrics, without pre-mounting them all.
- Persistent context toolbar with athlete, range, source and freshness. On mobile use an accessible sheet/popover for custom dates and extra filters, with Apply/Cancel so each intermediate date choice does not trigger a full refetch.
- Athlete and committed range/group/metric state are URL-backed. Maintain `athleteId`; add `start`, `end`, `group`, `metric` as optional parameters with validated defaults. Invalid/unauthorized IDs render an explanatory state or authorized default, never silently show the invalid athlete's data.
- Separate small HTML metric/header from heavy plotting code so useful text can render without waiting for Recharts. One quiet, size-matched loading state per active visualization; explicit Retry for failure.
- Charts retain meaningful reference lines/ranges, sparse readable axes, visible units and gaps for missing data. Tooltips work on tap and keyboard; equivalent data table is available. Do not fill missing points with zero or downsample away peaks needed for interpretation.
- Preserve existing provider controls, manual sync and legacy source selection. Sync banner uses actual status rather than invented percent completion; a timeout says “Still syncing” or failed/unavailable, not automatic success.

### 6.5 Tennis analytics: score first, analysis second, video on demand

- Desktop list becomes a compact, scannable match table: date, opponent, set score/outcome, source, surface, video status, actions. Mobile uses compact match rows with the same information.
- Keep import, live scoring, share, edit/delete and progress links. Filter/source selection is visible and URL-backed; paginated results must clearly distinguish loaded-window statistics from whole-history statistics.
- Detail first shows athlete/opponent, date/surface/source, set scores and authoritative available match stats. It does not wait for all shots or a video token.
- Put analysis navigation directly below summary. Keep Match stats, Shot stats, Play patterns and Insights. Video is a click-to-load panel/secondary desktop column; on mobile it is a disclosure/Watch action, not an obligatory screenful of placeholder.
- No automatic media download or video-access token acquisition on list mount. Intent prefetch may warm match summary/default analysis, never every match and never signed video tokens.
- Reuse current stat semantics and repair functions. If a summary field requires full shots, show a labeled pending value until analysis resolves rather than approximating it differently.
- Browser back restores athlete, list filters and scroll; forward restores the selected match/tab. Mutations invalidate all matching summary/detail/list variants, not a single URL spelling.

### 6.6 Fitness tests: explicit comparisons and readable values

- Compact header: athlete, latest assessment date, comparison date, benchmark context, Add test.
- Desktop: radar in a bounded approximately 420-480px area next to a readable six-row comparison table (latest, previous, group, benchmark, delta). No large empty canvas surrounding a small spider. Mobile defaults to numeric rows; radar is a secondary view/disclosure.
- Preserve existing category scores/benchmarks and latest-vs-previous comparison; optional date selection uses already authorized loaded records, fetching further history only on demand.
- Group comparison loads independently and states cohort size/date/coverage. No personal record is replaced by a peer due to a truncated pool. Group unavailable does not block own values.
- Unknown demographics are shown as an explicitly selected/default benchmark context, not inferred facts. Maintain current options; do not introduce new normative health claims.
- Raw records/edit form truly mounts on first open. Preserve unsaved edit state if closed again; keep it mounted only after first use or confirm leaving dirty edits. Add test remains available outside the collapsed record section.

## 7. Shared technical contracts

### 7.1 Resource identity and state

Extend/reuse existing `src/lib/dashboard/swr-keys.ts`, `fetch-result.ts`, `metric-contract.ts`, `metric-freshness.ts` rather than create another parallel cache/status framework. The currently unused helpers are scaffolding, not an excuse to change backend data sources.

Proposed shared types (properties kept alphabetical):

```ts
type ResourceScope = {
  accountMode: string;
  athleteId?: string;
  endDate?: string;
  organizationId: string | null;
  resourceId?: string;
  role: string;
  schemaVersion: number;
  source?: 'official' | 'unofficial';
  startDate?: string;
  viewerId: string;
};

type ResourceSnapshot<T> = {
  generatedAt: string | null;
  observedAt: string | null;
  receivedAt: number;
  result: FetchResult<T>;
  scopeKey: string;
};
```

- Canonical key builder serializes validated scope fields in stable order and separates network endpoint from cache key. Fetchers receive/extract the endpoint, never fetch a pipe-delimited identity string.
- Scope is cache partitioning, **not authorization**. Server independently verifies viewer and allowed athlete.
- Reuse `FetchResult` for ready/empty/partial/error; client loading/refreshing/offline are transport/view states around it. Unsupported is per-metric state. Preserve HTTP 401/403/404/429/5xx and safe diagnostic codes.
- Read SWR response via typed state `.data`; write via provider-scoped `mutate`. Do not count an empty wrapper as a hit. Existing global helper callers outside scope remain compatible; target callers receive a scoped mutator explicitly.
- Seed only when full identity matches, including initial tennis match ID and athlete. New schema versions do not reuse old ambiguous persistence.
- Store `receivedAt` only on accepted response arrival, not any cache `set`. `observedAt` comes from source data; missing/invalid timestamp is unknown. Preserve approved 72h metric threshold for now; it is not an HTTP cache TTL.

### 7.2 Freshness and retry policy

Initial policy, measured and verified rather than made global indiscriminately:

| Resource | Fresh-cache interval | Stale behavior |
|---|---|---|
| Roster/approval | 30s in scoped memory | Render same-scope data with refresh; authorization always enforced server-side |
| Readiness | 30s received-cache freshness | Show labeled stale data up to 5min before an explicit unavailable/stale state; measurement freshness remains separate |
| Selected historical graphs | 5min received-cache freshness | Same-key session data may render labeled while refreshing; hard persistence age remains <=4h |
| Completed match summary/analysis | 60s | Same-match stale data while refreshing; immediate invalidation on edits/import/delete |
| Live matches | No persistent HTTP/SW read cache | Preserve live-score behavior and existing outbox |
| Fitness peer comparisons | 60s | Same-scope only, invalidated by test/profile changes; no cross-athlete previous data |

- One retry owner per resource. Stop nested fetcher retries plus SWR retries plus batch fallback from multiplying attempts.
- Visible graph operation gets a 12s total foreground deadline spanning header/body/retry. At deadline show actionable timeout; other charts remain usable. At most one automatic retry for transient failures within that budget; no automatic retries for auth/forbidden/schema failures. Respect 429 Retry-After without displaying an endless spinner.
- A confirmed empty payload is terminal for that request, short-cacheable for 30s, and not polled unless sync is explicitly in progress or the user retries.
- Stream parser validates requested graph types, limits buffered malformed data, handles UTF-8/chunk splits/trailerless EOF, seeds each valid graph immediately, and terminates/cancels reader on timeout/unmount. Stale generation responses cannot write current caches.
- Sync polling is non-overlapping and cancels on scope change; invalidation is scoped and clears terminal-empty cache when new data arrives.

### 7.3 Graph demand scheduler

Evolve `graphBatchRegistry.ts` into the single owner of graph demand; do not leave competing SSR/hover/dropdown/page/direct-fetch systems.

- Resource identity is per viewer/athlete/source/range/graph. Registry tracks pending graph types, request IDs, a set of controllers, subscribers and terminal results. Completed flags expire with real cache data; they are not permanent proof of availability.
- Coalesce demanded graphs into batches of at most four. Maximum two active batches on normal connection, one constrained; priority order is visible > near viewport > explicit intent prefetch. Never enqueue all categories automatically.
- Same resource joins existing work, regardless of which component requested it. A visible demand promotes a prefetch rather than starting a duplicate GET.
- Hook compatibility wrappers can remain while all four callers migrate: `useGraphData`, `useGraphBatchPrefetch`, `useChartsHoverPrefetch`, `useAthleteGraphPrefetch`.
- Cancel previous **scope/generation**, not all registered resources. Abort all controllers owned by that scope; keep valid unrelated completed entries. On last subscriber leaving, cancel work unless explicitly retained as one permitted low-priority prefetch.
- Parent and child effect ordering must not be required for correctness. Register/acquire ownership as one operation, with cleanup tied to acquired request ID. StrictMode setup/cleanup/setup must work.
- Keep official and legacy source separate. Backend batches currently assume official; do not put official responses in unofficial keys. Legacy can use bounded individual transport until explicit batch source support is implemented and tested.

## 8. Implementation work packages

### WP-00 — Baseline, fixtures and tests that expose real behavior

**Dependencies:** execution approval; explicit nonproduction environment/setup approval where needed.

1. Capture repository revisions, package versions, actual token/vendor build provenance and deployed-revision information if later authorized.
2. Define deterministic fixture cases: 0/1/9/30 athletes, complete and partial metrics, no provider, provider timeout, fresh/stale/unknown observation time; 12/100 matches; shot-heavy match >1000 shots; live/paused/completed/manual/imported matches; fitness with no tests, 2 periods, missing demographics and a peer pool >500 records.
3. Use Vitest + Testing Library + MSW already present for failing regression tests. Exercise actual hooks/components/routes, not copied expressions. Unit tests mock all remote data access.
4. Extend `src/lib/performance/chart-marks.ts` to use unique navigation/request instances, clean up marks by enumerating matching entries, and record transport kind (SSR/batch/GET/cache), first useful content, chart commit, selected-section completion and error outcome. Instrument graph batch and tennis/overview/fitness paths as well as individual GETs.
5. Keep React commit/rAF marks distinct from verified browser paint; capture Chrome traces/screenshots to validate actual visible content. Do not label a single rAF as paint proof.
6. Add only dev-time browser verification dependencies if needed: pinned compatible Playwright and accessibility tooling versions published at least seven days before installation, owner-approved. Keep new agent/test configuration under `.devin/`; do not repurpose vendor gallery tooling as app E2E infrastructure. Invoke Devin CLI configuration documentation before creating new Devin configuration.
7. Build/profile a production-mode nonproduction app. Development-mode Next compilation is not the performance baseline. Use an approved isolated auth/data environment; no production bypass route, secrets in fixtures, or real-user exports.
8. Record separate network/server/render/storage costs, request counts, payload bytes, active JS chunks, long tasks, SW on/off, cold/warm cohorts. Diagnostic Server-Timing uses safe stage names only.

**Files:** APP `src/lib/performance/chart-marks.ts`, target page/components and API routes, `scripts/check-bundle-budgets.js`, existing test files; necessary new tests under `tests/components`, `tests/hooks`, `tests/api`, `tests/e2e`; proposed `.devin/playwright.config.ts` and `scripts/performance-audit.mjs` only after setup approval.

**Exit:** reproducible baseline artifacts and failing tests for F-01/F-04/F-05/F-19/F-21/F-22/F-24. No performance claim inferred from screenshots.

### WP-01 — Restore valid server seeds and consistent graph payloads

1. Reuse APP `src/lib/api/internal-service.ts` for server PPC transport. Charts seed passes verified viewer ID, authorized athlete ID and an AbortSignal. Never use target athlete as viewer identity for a coach.
2. Change provider snapshot signature to:

```ts
fetchUserProvidersSnapshot(
  athleteId: string,
  authenticatedUserId: string,
  options?: { signal?: AbortSignal; timeoutMs?: number },
): Promise<FetchResult<ProvidersResponse>>
```

   Update all observed call sites: charts page, `src/lib/dashboard/player-init.ts`, `src/app/api/dashboard/player/init/route.ts`. Self-access uses the verified user for both IDs; preserve compatibility adapters for existing player output shape. Errors remain errors internally, not `[]`.
3. Add a stream-safe path in existing internal-service transport: explicit lifecycle cleanup and body deadline, rather than clearing its only timer on headers. Keep the JSON helper backward compatible. Remove abort listeners on settlement. Do not log internal headers/secrets.
4. Initialize date context synchronously from server-supplied range; route always supplies serialized dates. Preserve timezone/day boundaries with a shared calendar-date parser; no server/client `Date.now()` drift in cache keys.
5. Keep current seed time budget for baseline comparison; do not arbitrarily shorten it to make shell timing appear better. Providers and priority seed run in parallel and return partial valid seeds on deadline. Cancel/release SSR reader in finally. No claim of independent chart streaming until implemented/verified.
6. Separate lightweight chart summary/frame from plotting code so HTML values can use the SSR fallback. Existing suspense renders shell promptly; graph rendering no longer requires an empty first provider render.
7. Define compact v2 as an additive allowlist: retain data/customdata, metadata used by insights and provenance, and `layout.shapes`, `barmode`, `yaxis.range`, `yaxis2.range` or equivalent explicitly typed fields. Remove unused theme/font/config only. Include all currently consumed sleep insight fields (`nights_logged`, `nights_above_seven`, `sleep_debt_hours_vs_target`, `avg_sleep_hours`, `consistency_stddev_minutes`, `avg_efficiency_percent`, `nights_good`, `nights_poor`, `avg_awake_minutes`, `recent_week_delta_percent`, `avg_deep_minutes`, `avg_rem_minutes`, `nights_deep_on_target`, `nights_rem_on_target`, `deep_target_low_minutes`, `rem_target_low_minutes`) plus `volume_metric`, `data_source`, error and source timestamps where available.
8. Version the client cache to avoid reusing old compact responses missing fields. Unknown old backend response remains supported through a compatibility adapter; never fabricate reference bands.

**Tests:** missing/valid internal credentials; viewer != athlete; authorization denied before privileged read; partial seed + stalled final graph; provider failure vs empty; identical server/client range; compact/full visual-data parity.

**Exit:** valid nonproduction SSR seeds, no silent auth failure, no seed/refetch duplication for fresh exact-key data, preserved chart semantics.

### WP-02 — One scoped cache/demand/retry system

1. Implement the resource identity/state contracts and scheduler from section 7 in existing key/registry/hooks. Add a shared small NDJSON parser module under `src/lib/charts/` only because three duplicated readers currently disagree.
2. Replace timer-gated chart waves with demanded graph sets. During transition, fix fast-path start/readiness notification immediately and test before removal of the wave implementation.
3. Seed confirmed empty results and classify errors; no empty retry loop. Hook returns explicit status plus same-key data. Same-athlete range changes may retain a visibly labeled old chart while loading only if its old range remains visible; default is cached exact-range or skeleton. Athlete changes never retain previous values, including summary headers.
4. Scope persistence by verified viewer/org/role/account mode and schema; drop unowned legacy graph entries rather than migrate them into another identity. Add size/entry bounds and in-memory read memoization; schedule persistence off the critical render path. Preserve original expiry during supported migration.
5. Fix target prefetch helpers to use current provider-scoped mutate and the same canonical keys as consumers. Dedupe maps include identity and expiry. Do not migrate unrelated mutation helpers blindly.
6. Honor `prefetchRoute` and connection quality in the actual Link prop. For expensive analytical routes use intent prefetch of route shell/current resource instead of unconditional full-route viewport prefetch. No batch for three arbitrary athletes on dropdown-open; only focused option/current navigation intent.
7. Scope polling/invalidation for sync, mutation, role change, logout and account switch. Pending request generation is invalidated **before** cleanup so late responses cannot repopulate caches.
8. **Security approval gate:** address the missing tennis SW cleanup coverage and privacy of private API caching. Recommended target: network-only SW behavior for authenticated graph/tennis responses, SW caches static assets only for these resources, and scoped in-memory/session SWR owns their reuse. Preserve scorekeeper outbox. If any authenticated SW response caching remains, it needs explicit viewer partitioning, acknowledged purge, request-in-flight race handling and acceptance tests. Do not silently change security policy under a performance ticket.
9. Update cache freshness handling only for these resources, not a global blanket `keepPreviousData` or never-revalidate setting.

**Files:** APP `src/hooks/{graphBatchRegistry,useGraphBatchPrefetch,useGraphData,useChartsHoverPrefetch,useAthleteGraphPrefetch,useRouteTransitionPrefetch}.ts`, `src/hooks/api/useSWR.ts`, `src/lib/{swr-config.ts,dashboard/swr-keys.ts,cache/graphPersistence.ts,cache/graphInvalidation.ts}`, `AuthContext.tsx`, `prefetch-link.tsx`; privacy-gated `next.config.js`, `public/cache-warm-sw.js`, `src/lib/pwa/cacheInvalidation.ts`.

**Tests:** SWR cache `{data:undefined,isLoading:true}` and error-only entries; 2 concurrent waves same key; cached priority + missing visible sibling; StrictMode remount; A→B→A athlete switch; range/source changes; malformed/hung stream; logout while fetch/persistence is pending; different viewers accessing same athlete; network unavailable; single bounded retry; no prefetched video token.

**Exit:** DATA-01/02/03 and SAFE-01/02 pass in actual consumers; duplicate demand coalesces; no invisible all-graph fan-out.

### WP-03 — Reference design and opt-in foundations

1. Implement workspace variants for the existing primitives and page wrapper, leaving legacy defaults unchanged. Follow section 6 dimensions and semantic colors.
2. Create overview + physiology reference screens using realistic synthetic fixtures. Render ready, loading, partial, empty, stale, error and long-name states at desktop/mobile widths, light/dark, Barcelona and a contrasting tenant brand.
3. Implement navigation grouping, short labels, accessible selectors and button hierarchy. Keep route URLs/feature entitlements intact. Persist non-sensitive sidebar preference in SSR-compatible form.
4. Fix actual AppShell focus lifecycle and semantic-view scroll restoration; real mounted component tests plus browser navigation tests.
5. Audit composed padding/max-width and CSS token precedence. Avoid editing generated vendor CSS; if canonical artifact regeneration is required, stop for vendor-occurrence/build approval.
6. Review side-by-side screenshots with Daniel. Record decisions in this plan/evidence, not a new standalone design-document dump. Do not spread unapproved styling across all screens.

**Files:** APP `src/components/ui/{page-header,card,empty-state,skeleton,tabs}.tsx`, `src/lib/design-tokens.ts`, `tailwind.config.js`, `src/app/globals.css`, `src/components/layouts/AppShell.tsx`, `src/app/[locale]/layout.tsx`, sidebar components, `BottomNav.tsx`, `NavBar.tsx`; target home/chart compositions.

**Exit:** UX-01/03/04 owner-approved reference screens; no other role/page visual regressions from opt-in styles.

### WP-04 — Physiology workflow and rendering

1. Replace the long all-category page with the section 6.4 workspace; define one typed metric/group catalog reused for navigation, provider visibility, graph demand and module preload.
2. Initialize selected athlete and range from validated server state; keep URL and UI consistent on refresh/back/forward. Use native history for client-owned selection state to avoid rerunning whole RSC seeds; preserve locale/unrelated params. Real route navigation still uses router/Link.
3. Keep data fetching outside the plotting chunk. `ChartFrame` shows metric summary/status even if plot module is loading. Load the active group's module, not every section on hover.
4. Replace both copies of animated chart-loading UI with one quiet skeleton matched to selected plot dimensions; expose a single polite region status rather than dozens of screen-reader announcements.
5. Use container width for chart layout rather than every chart reacting to global window resize. Keep transform inputs stable; memoize normalized series; disable entrance animations on data-dense charts. Profile before adding workers or virtualization.
6. Preserve legends, reference shapes, source choice, provider error distinction, date range and a data-table alternative. Display neutral directional changes unless favorable direction is defined.
7. Model sync as pending/running/settled/failed with truthful status. Remove fabricated progress and automatic success on safety timeout; retain existing sync trigger permissions and OAuth callbacks.

**Files:** APP charts page/loading/error; `ChartsContent.tsx`, `LazyChart.tsx`, `chartConstants.ts`, `GarminConnectGraphs/GraphContainerRecharts.tsx` and `sections/*`; ExplorationDateRange components, chart defaults, viewer context, related translation namespaces.

**Exit:** every current graph reachable, no unselected category network/render work, desktop/mobile chart readability and PERF-01/02/03 verified on selected scope.

### WP-05 — Overview critical path and honest completeness

1. Refactor `fetchCoachDashboardInit` and `/api/dashboard/coach/init` to share an authorized **roster-first loader** and identical DTO. Reuse request-scoped verified profile; no duplicate page/profile join. Initial response contains profile/org/roster and explicit section states; matrix is not awaited inside roster init.
2. Resolve approval with existing `resolveCoachApproval` concurrently with allowed initial reads and pass a matching seed to `CoachApprovalGate`. Preserve existing approved/pending/rejected/legacy/personal semantics; do not remove the check for speed or change its error policy without approval.
3. Start readiness and schedule independently once authorized roster/scope are available. Fetch notes/pending requests through existing APIs when relevant; if init supports enhancement sections, `sections=notes,requests` fetches those without replacing roster or returning timed-out arrays as final empty values. Client retries only failed requested sections.
4. Replace count heuristics in `completeness.ts`: roster success is explicit; metric completeness means every requested athlete/resource has a terminal result, with available/missing/error counts separately tracked. One successful athlete is not a complete nine-athlete roster. Confirmed missing is terminal, not a reason for infinite polling.
5. In matrix loader start independent batch RPC and supplemental queries together. Keep bounded athlete concurrency, but thread AbortSignal/deadline through RPC, snapshot and HTTP/body work. Return per-athlete status and partial results at an operation deadline; never silently drop athletes. Initial configurable matrix operation budget 6s; caller cannot leave orphan fallback work.
6. Keep current readiness source precedence for first rollout. Use typed result adapters around active `/api/v1/summary` path. Preserve errors instead of five-minute cached nulls, and avoid summary→batch→four GET cascade after authoritative no-data. Recovery fallback is allowed only for explicitly recoverable/unavailable endpoint cases within one total budget.
7. Supplemental injury/attendance failure remains explicit; wearable outages do not erase successfully loaded injury/attendance records. UI uses source status, not fabricated 0/false/low defaults.
8. Implement operational overview composition and contextual deep links. Lazy-load heavy athlete/admin tab components; preserve note/approval mutation behavior and scoped invalidation.

**Files:** APP coach page, `CoachDashboard{,Loader}.tsx`, `CoachApprovalGate.tsx`, `home/CoachHome.tsx`, relevant `home/cards/*`, `coach/UnifiedAthleteView.tsx`, `src/lib/dashboard/{coach-init,coach-matrix-fetch,coach-athletes-matrix,readiness-snapshot,coach-dto,completeness,fetch-result}.ts`, `src/types/api-responses.ts`, coach init/matrix APIs and hooks.

**Tests:** roster succeeds while metrics hang; observations slow without blocking roster; approval seeded vs pending; 0/1/9/30 athletes; first athlete succeeds/rest fail; real-data denominator; injury known but wearables unavailable; query failure vs no assignments; deadline stops downstream work; notes refill after error; no false all-clear.

**Exit:** roster/controls usable independently, correct partial counts, no duplicated matrix seed/client fan-out, meaningful readiness completion measured separately.

### WP-06 — Tennis route, summary and analysis separation

1. Fix server selection first: validate requested player against authorized roster. For `?match=`, skip first-athlete list fetch and seed requested summary directly; list seed uses selected athlete when in list mode.
2. Add `GET /api/tennis/matches/[id]/summary` backed by new `loadTennisMatchSummary` in existing `match-detail.ts`. Return `{data, generatedAt, schemaVersion: 1}`. `data` contains authorized match metadata, set scores, stored total_points and match-level stored stats; **no shots, points, games, pipeline job or signed video URL**. Missing shot-derived values stay null/pending. Retain existing full-detail endpoint for consumers/public watch.
3. Summary and existing full analysis load in parallel for an opened detail; summary renders independently and full analysis no longer gates header. Keep a fast small summary renderer outside the client-only heavy detail chunk. Data-heavy tabs remain lazy; default analysis code begins loading on actual detail intent, not after summary/analysis has completed.
4. Apply same authorization to both loaders/endpoints. Do not replace current user-scoped RLS reads with service-role reads simply for speed. `match-access.ts` has active=true semantics differing from other assignment helpers; preserve current intended access and obtain security-owner decision before consolidating discrepancies.
5. Build canonical list/summary/detail/video keys once in `tennisAnalyticsShared.ts` or a small adjacent query-key module using section 7 scope. Remove `hasVideo` from resource identity; infer/fetch pipeline status separately after authorized match metadata. Match fallback includes its exact seed key.
6. Native history updates same-page client-owned player/match/tab state; state derives from current URL. Push on opening match, replace filter edits; back/forward restores expected view without duplicate full-route reseed. Preserve live in-progress redirect behavior.
7. Add cursor pagination to existing list query/API: page size 12, deterministic `(match_date DESC,id DESC)`, opaque validated cursor. Response keeps `data`, `hasMore`, adds `nextCursor`. Maintain existing no-cursor callers until migrated. “Load more” appends one page; do not unbound the full library. Show recent-result calculations as recent/loaded-window unless whole-history API is explicitly requested.
8. Stabilize sets and shared point/game/shot indices. Extract pure match view-model functions and freeze current repaired outputs with fixtures. Do not remove server/client repair passes until parity tests prove equivalence, including missing server, tiebreak/super-tiebreak, duplicate shots, second serves, manual and imported matches.
9. Verify >1000 relation rows; if current service row cap truncates results, add bounded stable pagination for full analysis relations with unique tie-breakers and a consistent match version/read strategy. Never improve speed by silently capping analytical data. Mutating live matches stay on existing live path.
10. Defer video-access/quota/pipeline UI to metadata availability/explicit Watch or upload intent; hide unavailable actions accurately. Detail summary remains usable if video fails.

**Files:** APP coach tennis page/loading; shared player/parent pages only for contract compatibility; `TennisAnalyticsContent.tsx`, `TennisAnalyticsDetail.tsx`, `TennisAnalyticsMatchStatsTab.tsx`, other tabs, shared helpers; `src/lib/tennis/match-detail.ts`, `src/lib/supabase/queries/tennisAnalyticsQueries.ts`, list/detail APIs; new summary route and small summary/view-model modules.

**Tests:** non-first athlete deep link; detail without playerId resolves authorized owner or explicit denied state; matching vs mismatched fallback; hover then click sends one canonical request; back/forward with scroll; concurrent player switches; all four tabs; video failure; edits/import/deletes invalidate list + summary + analysis; pagination tie dates; >1000 shots numerical parity; public watch and offline scorekeeper unaffected.

**Exit:** score/header useful before heavy data, no initial video download, no detail-list waterfall, correct navigation and all analysis capabilities retained.

### WP-07 — Fitness own-data-first and explicit comparison

1. Use selected athlete's SSR tests immediately for latest/previous values. Split own tests and peer pool in component props instead of replacing own data with `poolTests.length ? poolTests : tennisTests`.
2. Disable keepPreviousData across athlete scope; remove `athletes[0]` fallback in `PhysicalTestGraphs`. Selected missing => explicit no selected data, never peer substitution.
3. Fetch minimal selected profile context with existing server queries in parallel with own tests, preserving permission checks. Context is known/default/overridden; display which it is. Avoid hidden recalculation from “male/junior” to a loaded profile.
4. Keep graph-pool endpoint backward compatible and add a bounded comparison mode for selected assessment date(s). Fetch selected history separately; peers are scoped and paginated to completion or return explicit truncation metadata. Prefer only same-date records actually needed by the current group-score algorithm. Do not change cohort definition or averaging rules. If full bounded peer retrieval cannot meet budget, gate a server aggregate proposal rather than deliver a biased 500-row average.
5. Cache derived comparisons by tests + profiles + period + benchmark context, or use component useMemo with those dependencies; no incomplete module-level key. Correct optional-date validation and ensure client date filters use the same calendar representation.
6. Truly lazy-mount raw records and heavy form on first open; keep dirty form state safe on close. Lazy import add/edit dialog itself only when needed.
7. Implement section 6.6 radar/table/mobile composition. Separate own-data and group-data status; group failure offers local retry without blocking the assessment.
8. Explicitly invalidate own tests/peer comparison after test add/edit/delete; benchmark profile change invalidates derived comparisons.

**Files:** APP performance-tests page/loading/error, `PerformanceTestsClient.tsx`, `PhysicalTestGraphs.tsx`, `PhysicalProgressTimeline.tsx`, `BenchmarkContextBar.tsx`, `TennisSpecificTestsForm.tsx` and button/dialog boundary as needed, graph-pool API, `physical-test-metrics.ts` only for pure presentation computations.

**Tests:** A→B switch while A pool resolves; selected athlete excluded from old 500-row window; no peer fallback; profile changes recalculate; missing demographic label; no records; slow/failed peer request while own values visible; closed form not mounted; dirty form state; raw/normalized score parity.

**Exit:** own assessment is not blocked by cohort fetch; charts and rows agree numerically; mobile comparison is readable without hover.

### WP-08 — Backend throughput and compact-path hardening

**Implement code-confirmed low-risk fixes; gate infrastructure/schema work on profiles.**

1. Move blocking provider discovery/cache I/O off FastAPI event loop using a shared bounded executor/service operation. Keep query parameterization. Provider discovery must retain all discovered providers; `LIMIT 3` before deduplication can miss providers in mixed datasets, so test distinct-provider behavior before changing query shape.
2. Reuse shared graph cache-key normalization in graph and `/api/v1/summary` endpoints. Preserve explicit start/end equivalence and data source. Do not change summary observation window as a cache optimization.
3. Add generated-resource single-flight above executor submission for identical authorized graph/source/range requests. Reuse existing GraphDataProcessor query single-flight below it; do not occupy all executor workers with waiters for a task queued behind them. Clean up failures and cancellations; cap queue admission and respect rate-limit response semantics.
4. Keep capacity at existing eight graph workers initially; reserve/limit speculative demand through application scheduler. Profile queue wait, ClickHouse I/O, transformation/Plotly generation, serialization and first stream chunk independently. Do not assume more workers improve throughput.
5. Stream cancellation stops scheduling new work and drops abandoned results. Running synchronous DB work may not be interruptible; configure bounded query timeouts only through approved settings and document this limitation. Never claim AbortController cancels a running Python query automatically.
6. Preserve compact v2 metadata contract from WP-01. Add timestamp/provenance only from real underlying observations; generation time is not observation time. Use typed error outcomes for generation/serialization failure.
7. **Optional, gated optimization:** activate direct `/wearables/summary` metric aggregation only after metric parity/domain review. Fix the BFF route prefix and unbounded fan-out, move its blocking aggregation off-loop, then test provider mappings (SDNN vs RMSSD), sleep duration/awake semantics, observation timestamps, load denominator and zero/null handling against authoritative fixtures. Do not wire existing `bff-merge.ts` unchanged. This path is not required for first UI release if existing summary meets targets.
8. **Evidence-dependent follow-up:** inspect approved nonproduction query plans for relevant athlete/date lookups, summary tables and match relations. Propose indexes/materialized summaries/Redis topology only with actual bottleneck evidence, cardinality and rollback. No migration SQL or infrastructure setting is preapproved by this plan.

**Files:** BACKEND `api/routes/{graphs,summary,wearables}.py`, `utils/core/caching.py`, `data_processing/base/graph_data_processor.py`, and optional `data_processing/metric_aggregator.py`; necessary shared generation-service module if extraction from duplicated routes improves ownership. APP `bff-merge.ts` remains unused until optional gate passes.

**Tests:** concurrent identical requests generate once; different source/range/user does not coalesce; generator failure releases waiters; cancellation and queue saturation; first stream entry before slow sibling; partial/empty/error responses; compact/full parity; mixed-provider discovery; summary cache normalization.

**Exit:** throughput improvement is demonstrated without weakening auth, moving work to an unbounded executor, or changing numerical meaning.

### WP-09 — Integration, accessibility, localization and release evidence

1. Run focused tests per package; then one final integrated app suite/build gate plus relevant backend suites. Fix regressions, record unrelated pre-existing failures honestly, never disable security checks or inflate budgets to pass.
2. Verify all eight locales (`en`, `es`, `zh`, `ca`, `nl`, `de`, `fr`, `pt`), long names, expanded translations, day/date formats and locale-preserving URLs. Add keys to existing namespaces/route messages, not every namespace to root provider.
3. Keyboard/assistive testing: drawer and filter-sheet focus trap, Escape and focus return; arrow-key tabs; selectable metric rows; chart/table equivalence; live-region restraint; announcements on scope change.
4. Compare before/after traces for every core journey, screenshots for all data states, payload/network counts and real-device interactions. Verify SW installed/upgraded/disabled paths separately.
5. Tighten budget checker to require the four target routes to appear and include performance-tests. Preserve existing hard ceilings for coach 350KB/charts 400KB/tennis 450KB; set fitness limit from baseline without loosening other budgets. Track actual initial critical chunks as well as Next First Load JS, which can omit later eager dynamic downloads. Require no net critical-path JS growth without reviewed justification.
6. Roll out correctness independently of visual changes. Use the existing deployment preview/release process, not billing entitlements as rollout flags. If per-route visual gating is needed, use one server-resolved non-entitlement rollout switch; configuration change needs approval. Backend additive contracts precede client adoption.
7. Daniel approves release evidence. Production access/deployment and any canary are separately authorized. Roll back UI composition by approved revert/redeploy while retaining compatible correctness/security fixes; no destructive DB rollback assumed.
8. Complete documentation impact review against approved base/head revisions. Update existing architecture/verification/evidence documents or record explicit blockers; preserve historical text with dated corrections. Do not mark tests executed/enforced without runs/control proof.

## 9. File map

### Existing APP files expected to change

| Area | Files / purpose |
|---|---|
| Route orchestration | `src/app/[locale]/{coach,charts,performance-tests}/page.tsx`, `coach/tennis-analytics/page.tsx`, corresponding loading/error files |
| Shell | `src/app/[locale]/layout.tsx`, `src/components/layouts/AppShell.tsx`, `src/components/navigation/Sidebar/{Sidebar,SidebarContext,SidebarNavItem,SidebarNavigation,SidebarMobile,navigationItems}.tsx`, `BottomNav.tsx`, `src/components/ui/NavBar.tsx` |
| Opt-in design | `src/lib/design-tokens.ts`, `tailwind.config.js`, `src/app/globals.css`, existing page-header/card/skeleton/empty-state/tabs primitives |
| Physiology | `ChartsContent.tsx`, `LazyChart.tsx`, `GarminConnectGraphs/GraphContainerRecharts.tsx`, section exports, `ExplorationDateRangeProvider.tsx`, `ExplorationDateRangeSlider.tsx`, `src/lib/chart-defaults.ts` |
| Request ownership | `src/hooks/{graphBatchRegistry,useGraphBatchPrefetch,useGraphData,useChartsHoverPrefetch,useAthleteGraphPrefetch,useRouteTransitionPrefetch}.ts`, `src/hooks/api/useSWR.ts`, `src/components/ui/prefetch-link.tsx`, relevant existing navigation prefetch map |
| Cache/identity | `src/lib/swr-config.ts`, `src/lib/cache/{graphPersistence,graphInvalidation}.ts`, `src/lib/dashboard/swr-keys.ts`, `AuthContext.tsx`, `useLogout.ts` as required for verified cleanup |
| Server PPC | `src/lib/api/internal-service.ts`, `src/lib/dashboard/user-providers-snapshot.ts`, `src/app/api/ppc-proxy/[...path]/route.ts`; provider-call compatibility in `player-init.ts` and player init API |
| Overview | `CoachDashboard.tsx`, `CoachDashboardLoader.tsx`, `CoachApprovalGate.tsx`, `home/CoachHome.tsx`, relevant `home/cards/*`, dashboard loader/DTO/status/completeness/readiness modules, coach init/matrix APIs |
| Tennis | `TennisAnalyticsContent.tsx`, `TennisAnalyticsDetail.tsx`, tab components/shared helpers, `src/lib/tennis/match-detail.ts`, `tennisAnalyticsQueries.ts`, `/api/tennis/matches` and `[id]` route |
| Fitness | `PerformanceTestsClient.tsx`, `PhysicalTestGraphs.tsx`, `PhysicalProgressTimeline.tsx`, `BenchmarkContextBar.tsx`, raw record/dialog boundaries, graph-pool API |
| Privacy-gated SW | `next.config.js`, `public/cache-warm-sw.js`, `src/lib/pwa/cacheInvalidation.ts` |
| Verification | `src/lib/performance/chart-marks.ts`, `scripts/check-bundle-budgets.js`, test suites, package manifest/lockfile only if approved dev tooling is added |
| Locale | `messages/{en,es,zh,ca,nl,de,fr,pt}.json`, applicable consumer overlays, route-specific namespace selection only where new keys require it |

### Necessary new modules, not a blanket new framework

- APP `src/app/api/tennis/matches/[id]/summary/route.ts`.
- APP small extracted chart frame/NDJSON parser and tennis summary/pure view-model modules, adjacent to existing feature code.
- APP behavior/integration/browser tests listed below; approved dev-only browser/performance harness if absent.
- BACKEND shared graph-generation request service only if needed to centralize executor/single-flight across graph/summary routes.
- No new runtime documentation dump, no new runtime UI library, no vendor edits. Existing project docs receive impact updates during implementation with authorization.

## 10. Verification plan

### Exact behavioral coverage

| Area | Required cases and assertions |
|---|---|
| Graph seeds | Correct internal auth; authorization before privileged fetch; one valid seed + slow other; errors not persisted as empty; deterministic range; data visible without date-provider effect gate |
| Graph scheduler | Cached/error/loading SWR wrappers; all-seeded/partial/empty batches; concurrent same-base batches; no unrelated cancel; per-graph readiness; superseded generation; StrictMode; stream chunks split/malformed/missing trailer/stalled body |
| Cache isolation | Viewer A/B same athlete URL; coach role/org switch; stale value label; receivedAt vs observedAt; logout + late response + delayed persistence; old unowned storage; SW private cache deletion acknowledgement |
| Overview | Actual init/approval/matrix consumers; failed roster vs zero athletes; 1 of 9 metrics not complete; supplemental injury survives wearable failure; unavailable not all-clear; note/request enrichment retries; no hanging orphan snapshot |
| Tennis | Requested non-first athlete; deep link skips unrelated list; canonical hover/click keys; seed cannot follow next match; summary without shots; >1000 shots complete; all repair/scoring fixtures unchanged; history/filter/scroll restoration; live/manual/public watch compatibility |
| Fitness | Own values before peers; no first-peer fallback; >500 pool records; profile changes; benchmark default disclosure; closed form not mounted; unsaved state retained; numerical radar/table agreement |
| UI/a11y | Desktop/mobile/tablet; dark/light; long translations; reduced motion; keyboard tabs/dialogs; focus reset/return; no overlap with FAB/bottom nav; no nested scroll traps |
| Performance | Cold/warm/populated/empty/error scenarios; separately record latency/requests/JS/bytes/long tasks; no passing populated fixture via early error/skeleton |

### Existing suites to extend

APP:
- `tests/hooks/graphBatchRegistry.test.ts`
- `tests/lib/cache/graphPersistence.test.ts`
- `tests/charts/{chart-defaults,chartConstants}.test.ts`
- `tests/coach-dashboard-init.test.ts`
- `tests/components/dashboard/CoachDashboard.test.tsx`
- `tests/lib/dashboard/{coach-assignments,coach-bulk-fetch,completeness,fetch-result,metric-contract,metric-freshness,readiness-snapshot,swr-keys,bff-merge}.test.ts`
- `tests/components/navigation/{SidebarNavItem,SidebarContext.hydration}.test.tsx`
- `tests/lib/layouts/appshell-scroll-focus.test.ts` — supplement/replace copied-logic assurance with mounted component tests, preserving comments unless authorized.
- `tests/lib/tennis/shot-metrics.test.ts` and scorekeeper tests as compatibility coverage.
- `tests/tennis-tests-access.test.ts`, `tests/api/performance-tests/performance-tests.test.ts`
- `tests/scripts/check-bundle-budgets.test.ts`

New focused suites:
- `tests/hooks/useGraphData.test.tsx`, `tests/hooks/useGraphBatchPrefetch.test.tsx`
- `tests/components/charts/ChartsContent.test.tsx`
- `tests/components/layouts/AppShell.test.tsx`
- `tests/components/tennis-analytics/TennisAnalyticsContent.test.tsx`
- `tests/lib/tennis/match-detail.test.ts`, `tests/api/tennis/match-summary.test.ts`
- `tests/components/performance/PerformanceTestsClient.test.tsx`
- `tests/api/performance-tests/graph-pool.test.ts`
- `tests/lib/api/internal-service.test.ts`, `tests/api/ppc-proxy/streaming.test.ts`
- Browser journeys under `tests/e2e/performance-workspace/` after harness approval.

BACKEND:
- `tests/test_api/test_graphs.py`, `tests/test_api/test_summary_helpers.py`
- `tests/test_data_processing/test_base/test_query_cache_single_flight.py`
- `tests/test_data_processing/test_provider_discovery.py`
- `tests/test_data_processing/test_metric_aggregator.py`, `test_metric_semantics.py` for optional direct-summary gate.
- Add route-level streaming/compact/single-flight tests with proper test auth; do not bypass production middleware globally. Existing graph tests make unauthenticated requests and must be validated before assuming they work with current middleware.

### Commands (implementation phase only)

Run in APP with pnpm 9.15.0; these are planned commands, **not executed evidence**:

```bash
pnpm exec vitest run tests/hooks/graphBatchRegistry.test.ts tests/lib/cache/graphPersistence.test.ts tests/charts
pnpm exec vitest run tests/coach-dashboard-init.test.ts tests/components/dashboard/CoachDashboard.test.tsx tests/lib/dashboard
pnpm exec vitest run tests/components/navigation tests/lib/layouts
pnpm exec vitest run tests/lib/tennis tests/tennis-tests-access.test.ts tests/api/performance-tests
pnpm exec vitest run tests/hooks/useGraphData.test.tsx tests/hooks/useGraphBatchPrefetch.test.tsx tests/components/charts/ChartsContent.test.tsx
pnpm exec vitest run tests/components/tennis-analytics tests/api/tennis tests/lib/tennis/match-detail.test.ts
pnpm exec vitest run tests/components/performance/PerformanceTestsClient.test.tsx tests/api/performance-tests/graph-pool.test.ts
pnpm exec vitest run tests/lib/api/internal-service.test.ts tests/api/ppc-proxy/streaming.test.ts
pnpm typecheck
pnpm lint
pnpm check:i18n
pnpm check:i18n-namespaces
```

New-file commands apply after those suites exist. Use the narrowest relevant group per work package, not every command after every edit. `pnpm test` is Vitest despite stale AGENTS wording. If `next lint`/ESLint 9 compatibility blocks the declared lint script, diagnose and use `pnpm exec eslint <changed paths>` under the existing config, then request approval for any script/config correction; do not weaken rules. User alphabetical ordering remains a manual/targeted check even though current config does not explicitly declare every sorting rule.

Final app gate:

```bash
pnpm exec vitest run
pnpm typecheck
pnpm build:analyze
pnpm check-bundle-budgets
```

`build:analyze` invokes next build directly, unlike `pnpm build`'s prebuild chain. Validate already-built vendor artifacts first; do not silently build against stubs or install/repin nested repos. Record successful build exit independently of the tee pipeline. Build/vendor setup requires execution approval and must use isolated nonproduction configuration.

Browser gate after dev-tool approval:

```bash
pnpm exec playwright test --config .devin/playwright.config.ts
```

BACKEND targeted gates in its own environment:

```bash
python -m pytest tests/test_api/test_graphs.py tests/test_api/test_summary_helpers.py
python -m pytest tests/test_data_processing/test_base/test_query_cache_single_flight.py tests/test_data_processing/test_provider_discovery.py
python -m pytest tests/test_data_processing/test_metric_aggregator.py tests/test_data_processing/test_metric_semantics.py
```

All remote I/O is mocked for these tests; no production data required. New streaming/compact test paths are added to the applicable targeted gate. Report environment/auth fixture failures rather than treating declarations as passes.

Documentation checks from portfolio root, when authorized doc-impact updates are made:

```bash
node .devin/docs-tooling/src/cli.mjs check --repo .
node .devin/docs-tooling/src/cli.mjs catalog --repo . --check
```

Review doc impact using actual approved base/head revisions; no invented SHAs. Update APP verification evidence and architecture notes, BACKEND engineering API/architecture notes, and portfolio remediation backlog for discovered assurance/security/scientific discrepancies. Preserve historical records. During this planning session those edits are deliberately deferred.

## 11. Order, dependencies and approval gates

```text
WP-00 baseline + failing tests
   ├─ WP-01 authenticated seeds / compact contract
   ├─ WP-02 scope + scheduler + state correctness
   └─ WP-03 reference design -> Daniel visual approval
             |
       WP-04 physiology
       WP-05 overview
       WP-06 tennis
       WP-07 fitness
             |
       WP-08 measured residual backend work
             |
       WP-09 integration + evidence -> Daniel release approval
```

WP-08's compact/transport and proven event-loop issues can land alongside WP-01/02; its optional semantic/schema/infrastructure branches do not hold up independent UI improvements. New API fields are additive before consumers switch. Keep source repos independently testable and commit-ready; commits themselves require separate authorization.

| Gate | Required approval / evidence |
|---|---|
| G-0 | Daniel approves implementation plan; does not authorize production access, deployments, or commits |
| G-1 | Nonproduction setup/fixtures/dev-tool additions approved; valid baseline with no real data exposure |
| G-2 | Daniel approves overview/physiology desktop/mobile reference designs |
| G-3 | Security owner/Daniel approves private-cache policy changes and resolves any access-policy discrepancy before those changes ship |
| G-4 | Domain approval + parity evidence before changing metric source/formula/benchmark/repair behavior; RG-02 remains separate |
| G-5 | Explicit approval for proposed database/index migrations, Redis/infrastructure settings or vendor artifact/revision changes, with rollback |
| G-6 | Measured acceptance + compatibility + accessibility evidence and Daniel release approval; production access/deployment still explicitly authorized |

### Rollback principles

- Roll back layout independently of transport/cache fixes; do not reintroduce known wrong-athlete or unauthorized-cache behavior as a shortcut.
- Backend compact/summary additions remain backward compatible until old clients and SW versions age out under tested policy.
- Test SW upgrade and cleanup before release; a new UI release must not resurrect old private cached responses.
- No destructive migration rollback, branch rewrite, file deletion, push or deploy is implied by plan approval.

## 12. Risks and unresolved implementation gates

1. **Production reproduction:** local source is not a trace of the deployed app. Baseline must verify deployment revision/configuration and identify which candidates actually execute in the slow sessions.
2. **Sensitive data/access:** current graph/fitness/tennis paths do not share one obvious authorization policy. Do not broaden access or normalize active-null/admin semantics without review. Cache is never an access check.
3. **Numerical correctness:** two summary paths differ and compact responses remove consumed fields. Preserve current approved numbers with golden fixtures; do not trade accuracy for payload reduction. Direct metric-aggregator adoption is optional and gated.
4. **Readiness interpretation:** existing ACWR labels and heuristic scores are not clinical facts. Improve provenance/status and avoid adding new claims; domain decisions remain separate.
5. **Serverless limitations:** module maps only dedupe within an instance. End-to-end latency cannot be guaranteed by process-local cache changes if cold starts/DB latency dominate; profile before asking for infrastructure.
6. **Backend cancellation:** aborting HTTP does not forcibly stop running synchronous Python/ClickHouse work. Bound new scheduling and query timeouts, and report residual work honestly.
7. **Scope breadth:** shared shell/primitives affect other roles. Opt-in workspace styles and compatibility tests prevent a four-screen redesign becoming an unreviewed whole-product rewrite.
8. **Fixture realism:** a nine-athlete screenshot is not evidence of maximum load. Test larger rosters/libraries and explicit service row caps without silently truncating analytics.
9. **Build provenance:** vendor integration CSS is a local stub; linked package availability and fonts must be verified before visual/bundle claims. Do not “fix” by editing the unrelated marketing checkout.
10. **Existing test strength:** declarations and helper tests do not establish actual route/component behavior; baseline failures remain visible and do not justify disabling CI/security controls.
11. **No measured results yet:** all acceptance targets, designs and implementation steps are proposed. Completion requires recorded artifacts, not an updated date or a successful-looking skeleton.

## 13. Definition of done

- Daniel approves the reference design and final four-screen desktop/mobile experience.
- All four routes preserve features, links, roles, sources and metric semantics; each renders useful content independently of unrelated heavy work.
- Source-confirmed loading/cache/state defects have behavioral regression coverage; no false no-data/all-clear, cross-athlete reuse, or orphan foreground waits.
- Baseline/final artifacts demonstrate absolute targets and required relative improvement, or a clearly documented owner-approved blocker prevents claiming completion.
- All relevant test/lint/typecheck/build/i18n/a11y checks have explicit executed results and limitations; no inferred passes.
- Any private-cache/access, metric-source, infrastructure or schema changes have their specific approvals.
- Documentation impact is updated in existing records or explicitly blocked; no production operations, commits or pushes without separate authorization.
