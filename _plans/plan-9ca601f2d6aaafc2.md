---
agent: devin-local
session: confused-cattle
created: 2026-09-13T02:05:10Z
---
# Coach App Recovery and Professional UX Megaplan

Restore reliable navigation and source-verified athlete data for the production BCN academy app, then deliver a restrained, mobile-first coach experience and a trustworthy AI assistant through independently verifiable releases.

## 1. Objective and agreed direction

Fix the production experience at `https://www.bcnprotennisacademy.app`: long launch/logo and overview waits, nine athletes appearing without their expected metrics, empty athlete panels, crashes when leaving Overview for Players/Training/Tournaments/Reports, transparent notifications, intrusive bottom navigation, and an underdeveloped AI assistant.

User-confirmed decisions:
- Production web app; coach account; real athlete data is expected.
- Polished evolution of the existing product, not a new brand or framework rewrite.
- Light, professional surfaces; opaque white notifications; restrained brand accents; preserve dark-mode compatibility.
- Simple flat mobile navigation tabs instead of the elevated center AI button.
- AI improvements include grounded athlete answers, coaching workflows, chat UX, voice, and app actions.
- Read-only production diagnostics were authorized.

Proposed scope boundary for approval with this plan: coach-first, including shared components needed by that experience and regression testing other roles. Backend changes are included only where necessary to repair the data contract. Player/parent/admin redesign, marketing sites, BodyViz/Courtviz redesign, a new AI platform, new wearable integrations, and bulk historical data migrations are out of scope. The last scope/dependency questions were canceled while screenshots were supplied; these boundaries are proposals, not previously confirmed answers.

Do not equate success with filling every ring. Success means every assigned athlete is accounted for, every displayed measurement is defensible, and unavailable data has an accurate reason and recovery path.

## 2. Research completed and evidence strength

Repository roots used below:
- `FE` = `PeakPerformanceData/peak_performance_data`.
- `BE` = `PeakPerformanceData/ppd_backend`.

Planning baseline: FE HEAD `86faf865`; BE HEAD `78fce68a`. Both submodule worktrees were clean when checked. The monorepo already had deleted `_plans` files; leave those user changes untouched. No implementation files were changed. No database mutations, deployments, cache purges, authentication changes, or athlete-data exports were performed.

### 2.1 Screenshot review

Six supplied images were inspected, including the expanded error on desktop.

| Image | Observed problem | Required response |
|---|---|---|
| Mobile global error | App header and navigation disappear; Catalan generic failure and technical-details control | Treat as an app-root failure, not merely a page data error. Preserve useful recovery and capture the actual exception. |
| Mobile AI sheet | Large welcome block, four full-width prompt pills, clipped multiline placeholder, excessive vertical competition | Compact text-first opening, accessible suggestions, properly sized composer, stable viewport and keyboard behavior. |
| Notifications/overview | Page text clearly visible through the notification panel; duplicate headings/counts; gradient roster hero; overlapping central AI FAB | Opaque surface; one information hierarchy; compact summary; flat navigation. |
| Launch logo | Full dark launch screen and oversized logo before a light application | Measure native/PWA splash separately from HTML/hydration; no artificial launch dwell; coordinate brand/theme transition. A still image cannot establish duration. |
| Athlete detail tab | Large nested empty cards inside accordions, repeated section titles, little information per screen, bottom overlap | Shallow sections, compact unavailable states, useful data above optional detail, persistent athlete context. |
| Desktop expanded error | `/en/coach/training`, `NotFoundError: Failed to execute 'removeChild' on 'Node'` in React chunk | Prioritize DOM ownership/reconciliation; test both desktop English and mobile Catalan. |

The mobile screenshots appear to be Android standalone/PWA. Treat that as the first reproduction target; confirm exact device/browser/display scale during baseline capture. No screenshot specifically shows the standalone Players route; its redesign is informed by its code and the user's report, not a claimed visual inspection of that route.

### 2.2 Confirmed defects and strong findings

**F1 — React-owned startup nodes are removed outside React.**
- `FE/src/app/[locale]/layout.tsx:610–620` renders the cold-start bar/logo as React elements.
- `FE/src/components/layouts/LazyLayoutExtras.tsx:55–60` removes both through DOM `.remove()`.
- `FE/src/components/navigation/NavigationProgress.tsx:80–88` independently removes the bar.
- An isolated, in-memory test against installed React 19 reproduced `NotFoundError` when a React-owned node was removed imperatively and later reconciled. CSS hiding and React-owned removal both passed.
- This is a concrete ownership defect and the leading source of the supplied crash. The exact production route-transition trigger still requires an authenticated browser regression; the isolated reproduction is not proof that no other root-layout defect exists.

**F2 — Global recovery can amplify a real defect.**
- `FE/src/app/global-error.tsx:194–217` reloads chunk errors and calls stale-shell recovery for any other online root error.
- `FE/src/lib/pwa/staleShellRecovery.ts` unregisters all service workers and deletes all Cache Storage entries, guarded only by a 30-second session timestamp. The chunk-error branch bypasses that guard.
- A deterministic DOM exception is not evidence of a stale build. This recovery can repeatedly discard warm caches and contribute to launch waits.

**F3 — Production readiness RPCs reference removed tables.**
- Supabase project `PeakPerformanceDataV2` (`bcfwtgqvusjhlrqsztod`) read-only logs contain SQLSTATE `42P01` errors.
- At the later observation, the rolling 24-hour log window showed 78 `calculate_acwr` errors for missing `garmin_connect_training_readiness`, 13 `get_athletes_readiness_batch` errors for missing `garmin_connect_sleep`, and 3 missing `public.garmin_connect_activities` errors. Counts are observations, not a fixed incident total or attribution to one account.
- `FE/src/lib/dashboard/coach-matrix-fetch.ts` still invokes the failing batch RPC; `readiness-snapshot.ts` still invokes `calculate_acwr`; the training-load route and athlete page still query legacy activities through Supabase.
- The historical batch migration explicitly references those Garmin tables. Do not recreate dead tables or reinstate its synthetic default scores to make the function pass.

**F4 — The fallback omits athletes beyond eight and suppresses useful error information.**
- `FE/src/lib/dashboard/coach-athletes-matrix.ts` uses `slice(0, 8)`, not a concurrency queue that eventually processes every athlete.
- With a failed batch RPC and nine athletes, at least one athlete cannot receive a matrix wearable fallback in that response. Selected-athlete fallback may subsequently load a detail; it does not repair roster-wide coverage.
- Readiness fetch timeouts/non-2xx/parse failures collapse to `null`, and `null` is cached for five minutes. Batch failure plus null fallbacks can still produce HTTP 200 athlete stubs.
- `CoachDashboard` only shows the matrix error banner when SWR has an error and no matrix rows. Successful stub rows conceal the upstream failure.

**F5 — Roster membership rules differ.**
- Overview init and readiness use `active !== false` / true-or-null.
- Players SSR, Players API, report counts, and some organization discovery require `active = true`.
- This can make routes disagree without any athlete actually being removed. Verify live assignment flags before attributing the specific nine-athlete symptom solely to this discrepancy.

**F6 — There are confirmed organization-discovery HTTP 400s.**
- Eight observed assignment-query 400s selected `organization_id, organization:organizations(id,name,description,admin_user_id)`.
- This matches `FE/src/lib/supabase/queries/organizationQueries.ts:startRoleQuery`, including a suspicious embedded `.or('organization.is_personal.is.false,organization.is_personal.is.null')` filter.
- Reproduce the exact PostgREST error and check relationship/filter syntax before fixing it. Do not assume the 400 explains the DOM exception.

**F7 — Startup has redundant and incompletely bounded work.**
- `coach/page.tsx` races init against 1.5 seconds but still awaits an unbounded profile request. `coach-init.ts` itself starts readiness work with a separate 4.5-second seed budget despite describing a roster-only phase.
- Losing `Promise.race` calls do not cancel their upstream work. Subsequent client calls can duplicate it, particularly across serverless runtimes.
- Production logs included roughly five-second 504s on profile, organization, assignments, coach approval, and auth requests. Organization reads were also relatively slow. These are project-level signals, not a measured end-to-end launch profile.
- SWR persists entries even when older than its nominal five-minute age, while global stale revalidation is disabled. A single athlete with data can mark the entire matrix seed sufficiently complete to skip mount revalidation.

**F8 — Notifications have an invalid opacity utility.**
- `FE/src/components/ui/popover.tsx:49` uses `bg-popover/98 backdrop-blur-sm`.
- An in-memory compile with installed Tailwind 3.4 generated the blur rule and `bg-popover`, but no `bg-popover/98` rule; the project has no opacity-98 extension.
- This corroborates the visibly transparent screenshot. Use an opaque token, not another opacity workaround.

**F9 — Metrics are coupled to chart presentation and can be semantically wrong.**
- `readiness-snapshot.ts` takes the first numeric trace rather than a named metric; `recovery_score.py` can include SpO2 alongside recovery. SpO2 must never become readiness when a recovery series is absent.
- Sleep fallback sums awake periods and may substitute a period average for last-night sleep. Selecting by array position and skipping all entries labeled today is not a reliable completed-sleep rule.
- Readiness is partly synthesized from fixed HRV/sleep/load scales without clearly exposing its method. The training-load API defaults effort to 5 and duration to 60 and can count scheduled/published sessions, then mixes those values with provider load.
- Missing injury/attendance information can become low risk/zero. Matrix freshness is dropped and focused fallback labels it as fresh/medium quality.

**F10 — AI has both UX and trust defects.**
- `VoiceAssistantModal` clears chat on every opening; the hook uses the user ID as the conversation ID; the server retains conversation memory, creating a possible mismatch between visible history and remembered context.
- Retry can resend the last assistant message instead of the failed user turn; autoscroll runs on every messages change.
- `ToolResultCard` treats any result without `success:false` as completed. Confirmation results lack that flag and are not rendered as actionable confirmations.
- Intent routing is English-substring based; the screenshot's Catalan suggestions are sent directly as prompts. A translated competition prompt can fail to select competition tools.
- `buildToolSet` supports assigned-player scoping but `/api/ai-agent` passes `null` for that argument. Per-tool authorization must be audited; do not rely on discovery filters or the prompt as security enforcement.
- Some tools still reference legacy Garmin tables. The active chat path is `/api/ai-agent`; the separate `/api/ai-agent/proxy` path is not the modal's active transport.

### 2.3 Important uncertainties and limitations

- Production FE and BE deployment SHAs have not been matched to local HEAD; preserve an explicit deployment/configuration parity gate.
- BE source requires internal-service/JWT auth; the FE snapshot path sends neither. However, the configured-default public graph catalog responded HTTP 200 without credentials, so live routing/deployment policy differs or exempts that route. Missing auth is a contract risk to verify, not a proven explanation for current empty metrics.
- No authenticated session or reference metric for the coach's nine athletes was supplied. Do not read credentials from files or fabricate baseline values. Perform scoped reconciliation through an approved session later.
- Render MCP exposes deployment actions but no read-only log tools; Vercel/Sentry event access is not available through the current tools. Obtain appropriate access or redacted traces for full production correlation.
- Supabase table-list row estimates returned zero broadly; they are not reliable evidence that business data is absent. Use them for schema inventory only.
- Performance advisors reported RLS/index issues, but generic advisor findings are not proof of this incident's cause. Investigate relevant plans only. Reference: https://supabase.com/docs/guides/database/database-linter?lint=0003_auth_rls_initplan and https://supabase.com/docs/guides/database/database-linter?lint=0001_unindexed_foreign_keys.
- Full application tests/builds were not run in planning. Node was absent from shell PATH but `/opt/homebrew/bin/node` worked; no machine configuration was modified.

## 3. Acceptance criteria

### Reliability
- From authenticated Overview, navigate to Players, athlete detail, Training, Tournaments, Reports, Notifications, and back; repeat at least 20 transitions across direct links, header/drawer, bottom tabs, browser Back/Forward, and refresh without `NotFoundError`, unhandled browser exceptions, or unsolicited full reloads.
- The same journeys pass for `/ca` and `/en`, Android Chrome/PWA and desktop Chrome; smoke-test iOS Safari/PWA.
- A slow/unavailable data source produces a local recoverable state, not a root crash or a fake empty roster.
- Every link used in these journeys resolves; preserve locale and useful query state.

### Data integrity
- All distinct authorized active athletes, including legacy null-active assignments, appear consistently in Overview, Athletes tab, Players, and AI discovery.
- Validate 0, 1, 8, 9, 25, and 100-athlete fixtures. Nine-athlete coverage must not depend on assignment order.
- Reconcile the real roster by ID with authorized source metadata and sample metrics; record provider, date/range, unit, freshness, and computation method.
- Missing, unsupported, stale, denied, loading, and failed states are distinguishable. Never present unavailable as measured zero, low risk, or disconnected.
- No affected production request hits removed `garmin_connect_*` tables or RPCs that depend on them.
- Frontend cards, focused athlete view, load charts, and AI use the same metric contract; no stale metric from athlete A under athlete B's name.

### Performance targets to validate against the baseline

These are engineering targets, not promises about current production behavior or implementation duration:
- No intentional minimum splash duration; shell visible as soon as authorized HTML can be streamed.
- On a documented representative mobile 4G/midrange-device profile: p75 useful shell/roster within 2.5 seconds, warm navigation content or truthful skeleton within 1 second, immediate interaction feedback within 100 ms.
- Warm authorized roster endpoint p95 below 1 second and warm summary endpoint p95 below 2 seconds in the staging measurement set. Slow dependencies exit into an explicit partial/error state within a bounded overall budget; calibrate the budget from backend latency rather than shortening it until every response is empty.
- Preserve existing route JS budgets, especially coach 350 KB and shared-role budgets. Target field INP <=200 ms and CLS <=0.1, measured separately from the isolated fixture tests.
- No unbounded per-athlete graph-rendering fan-out on startup and no parallel duplicate roster/init fetch caused solely by hydration.

### UX and AI
- Notifications have an opaque white computed background in light mode and no panel backdrop blur; opaque theme-appropriate background in dark mode.
- Mobile navigation is flat, evenly distributed, labeled, safe-area aware, and does not overlap content; AI remains discoverable without an elevated central FAB.
- The first overview viewport contains a compact roster summary and a useful action/status, not stacked greetings and mostly empty rings.
- At 320/360/390/430 px widths, landscape, and 200% text enlargement: no page-level horizontal overflow, clipped composer, inaccessible close/send controls, or unrecoverable scroll locking.
- AI retains the current conversation when closed/reopened, retries the failed user turn correctly, exposes source/date context for factual answers, and distinguishes proposed actions from completed actions.
- Mutations require actual explicit confirmation checked server-side; canceled/expired/replayed confirmations cause no write. No test sends real messages or modifies real athletes.

## 4. Implementation phases and files

### Phase 0 — Establish a reproducible baseline and diagnostics

1. Confirm the affected production deployment/version, academy host, locale, PWA registration/build, device/browser, and exact entry path. Capture a short cold-launch and navigation recording, network waterfall, console exception, and trace identifiers through an approved test session.
2. Separate native splash, document TTFB, server auth/brand lookup, React hydration, roster paint, and readiness completion. Add narrowly scoped performance marks/spans; do not collect athlete names, measurements, cookies, tokens, or raw prompts.
3. Add an actual regression test for the startup-node ownership pattern and shell unmount/remount; preserve the user's reported stack as diagnostic context, not production source code.
4. Review existing Sentry integration. `instrumentation-client.ts` ignores broad `Hydration failed` and `Minified React error` strings; narrow overly broad suppression where it hides actionable failures. Explicitly capture handled root/route errors once with release, route, error class/digest and safe context. Retain masking and sensitive-header scrubbing.
5. Establish baseline failures before implementing fixes. Source-map the production chunk if authorized access is available.

Files:
- `FE/src/instrumentation-client.ts`, `src/instrumentation.ts`, `src/app/global-error.tsx`, `src/components/error/RouteError.tsx`.
- New focused test files under existing `FE/tests/components/layouts/` and `FE/tests/navigation/` conventions.

Exit gate: root exception is reproducible locally or its ownership mechanism is covered by a failing test; gaps in production access are recorded. Do not postpone the confirmed ownership correction just because unrelated backend diagnostics are unavailable.

### Phase 1 — Navigation and DOM ownership hotfix

1. Give the startup indicators one owner. Prefer a small React-owned indicator component exported from the existing `LazyLayoutExtras.tsx`: SSR renders matching initial markup and its hydration state controls removal. Alternatively retain the nodes and hide them via the existing hydration/theme class; no external `.remove()` of React-owned nodes.
2. Update `[locale]/layout.tsx` and both cleanup sites together; eliminate competing imperative removal. Audit other DOM removal calls: temporary download anchors created outside React are a different case and should not be rewritten indiscriminately.
3. Exercise layout replacement, authenticated/public transitions, nested Suspense, locale switching, and root error/reset. If another node still fails, use targeted development diagnostics to identify that owner; never monkey-patch `Node.removeChild`, catch-and-ignore React DOM errors, or add blanket hydration suppression.
4. Limit stale-shell recovery to evidenced missing/stale chunks or build mismatch. Ordinary `NotFoundError`, schema failures, and component errors must not unregister the service worker or clear caches.
5. Apply one consistent reload guard to chunk recovery; provide explicit recovery UI if it fails. Preserve offline behavior, current route, and drafts. Clear only versioned application-owned stale assets when justified, never every origin cache.
6. Correct broken athlete links found in the audit: `FocusedAthletePanel` uses `/coach/players/{id}` although the route is `/coach/athlete/{id}`. Audit `/coach/training/reports/new` against the actual report-creation dialog/route. Normalize `/login` versus `/auth/login` use to existing routing conventions.

Files:
- `FE/src/app/[locale]/layout.tsx`.
- `FE/src/components/layouts/LazyLayoutExtras.tsx`.
- `FE/src/components/navigation/NavigationProgress.tsx`.
- `FE/src/app/global-error.tsx`, `src/lib/pwa/staleShellRecovery.ts`.
- `FE/src/components/dashboard/home/cards/FocusedAthletePanel.tsx` and `src/app/[locale]/coach/athlete/[id]/page.tsx`.

Tests: hydration/cleanup/unmount, no duplicate cleanup owners, repeated route transitions, no cache purge on normal exceptions, at-most-once confirmed stale-chunk recovery, offline recovery, valid locale-aware links.

Release independently after acceptance. Do not bundle the full redesign into the crash hotfix.

### Phase 2 — A consistent roster and explicit API states

1. Consolidate assignment selection/mapping used by SSR, init, Players API, and matrix. Normalize true/null active membership once; exclude false; deduplicate athlete IDs; preserve missing-profile assignments as an explicit unresolved-profile state instead of silently dropping them.
2. Preserve authorization: derive viewer/role/org from verified server context; apply coach assignment and tenant boundaries before privileged reads. Profile query failure is not the same as an anonymous user or an organization-free coach.
3. Reproduce the organization-discovery 400. Fix embedded-resource filtering with documented PostgREST semantics or a scoped two-query selection of organization IDs and organizations. Do not weaken RLS or add a service-role bypass for failed ordinary queries.
4. Introduce explicit typed roster and summary DTOs in the existing API response/type modules. Use runtime validation at external/API boundaries using the already installed Zod; remove `any` from the touched pipeline.
5. Use a discriminated fetch result: ready / empty / partial / error, plus retryability and safe diagnostic code. Preserve HTTP 401/403/429/5xx in a shared fetch error; do not return HTTP 200 empty collections on infrastructure errors.
6. Keep last successful data visible with a stale warning after background failure. Empty-state CTAs must appear only after a successful empty response. Make retries local and predictable.
7. Ensure report athlete counts and organization selector use the same membership definition. Verify current roster updates immediately after permitted mutations via bound SWR invalidation.

Files:
- `FE/src/lib/dashboard/coach-init.ts`, `src/app/api/dashboard/coach/init/route.ts`.
- `FE/src/app/[locale]/coach/players/page.tsx`, `src/app/api/coaches/[id]/players/route.ts`.
- `FE/src/hooks/data/useCoachPlayers.ts`, `src/hooks/api/useSWR.ts`, shared API fetch utilities already used by those hooks.
- `FE/src/lib/supabase/queries/organizationQueries.ts`, relevant duplicate logic in `organizationAwareQueries.ts`, `src/lib/supabase/server.ts`.
- `FE/src/types/api-responses.ts`, affected coach report count.

Tests: true/null/false membership, duplicate assignment, missing profile, unauthorized tenant/athlete, 400/401/403/429/500/timeout, SSR/API payload parity, retry and stale-success display.

### Phase 3 — Restore source-verified athlete summaries and training load

Implement in two compatible increments: immediate removal of broken dependencies, then an efficient typed summary path.

**3A. Stop the broken production calls and recover complete coverage.**
1. Remove readiness's unconditional dependency on `get_athletes_readiness_batch`, `calculate_acwr`, and Supabase Garmin activity tables on the affected production paths.
2. Fetch existing Supabase injury and attendance/training records separately in bulk, so a wearable outage cannot erase injury/attendance information.
3. As a transitional adapter, reuse the working PPC wearable sources with bounded concurrency (a queue, e.g. four workers), not `slice(0,8)`. Every requested athlete must produce data or an explicit incomplete/failed status. Do not silently convert work deferred by the request deadline into no-data.
4. Bound the whole operation and propagate AbortSignal to actual HTTP/DB calls. Avoid uncanceled work after a timeout. Add in-flight deduplication only within an authorization-safe, versioned cache scope.
5. Verify the deployed PPC authentication contract; consolidate server-only backend request construction using the existing internal-service pattern. Never place the internal secret in a client module or bypass authorization to improve latency.

**3B. Replace graph scraping with a typed, batched metric read.**
1. Add a backend summary operation in `BE/api/routes/wearables.py` and a reusable metric aggregation service, using existing ClickHouse loaders from `data_processing/base/graph_data_processor.py`. A new service file is justified to keep request handling separate from metric logic.
2. Contract: bounded, deduplicated authorized athlete IDs; explicit as-of/timezone/range; one entry per ID; per-metric value, unit, source/provider, observed-at, status, and optional method/version. Response includes generated-at and completion/error metadata, not full Plotly graphs.
3. Read relevant current sources (`ow_sleep_summaries`, `ow_health_scores`, `ow_timeseries`, `ow_workouts`) with parameterized filters and established latest-sync deduplication. Preserve app/org/provider identity; inspect actual schema and user-ID mapping before writing queries. Do not guess columns or assume Supabase ID equality without reconciliation.
4. Ensure backend batch input is service-authenticated and authorized by a trusted viewer/assignment scope. A raw client-supplied list of athlete IDs is never sufficient authorization. Existing graph proxy auth must not become a shortcut around this.
5. Correct metric semantics:
   - Recovery: explicitly select recovery, never SpO2 or a trend/annotation trace.
   - Sleep: use completed-session/provider asleep duration; exclude awake from stage-sum fallback; do not label a multi-day average as last night; select by timestamps/timezone.
   - HRV: retain units/provider method; do not blend incomparable providers without a defined policy.
   - Load: retain source and units; do not add proprietary provider load to arbitrary session-RPE load. Only calculate session-RPE from recorded effort and actual duration; no default 5 x 60 or scheduled-session load.
   - ACWR: require a documented sufficient observation window and comparable load source. Otherwise unavailable/insufficient history, not a fabricated ratio or safe training recommendation.
   - Readiness: distinguish provider recovery from any derived readiness estimate; expose method/input coverage. Do not introduce a new physiological scoring formula in this repair without product/domain sign-off.
   - Injury/attendance: unknown is not false/low/zero; only confirmed records drive alerts. Keep recorded injury status distinct from a computed risk prediction.
6. The BFF merges metric summaries with authorized roster/injury/attendance and exposes one shared typed response consumed by matrix, focused athlete, athlete load, and AI tools. Preserve existing public response fields during migration where other roles depend on them.
7. Per-metric states should be `available`, `stale`, `missing`, `unsupported`, or `error`; use null for unavailable numeric values. Derive freshness from observation time, not fetch time. Cache successful data with a bounded freshness policy; transient errors must not become five-minute authoritative empty results.
8. Update provider discovery to recognize current score-only sources too; failure of provider discovery must not discard independently valid metric data. Provider capabilities should drive unavailable copy.
9. Reconcile each of the nine athletes through an authorized session; use a minimal ID/status/date checklist and a few agreed numeric samples, not a broad export.

Files:
- `FE/src/lib/dashboard/coach-matrix-fetch.ts`, `coach-athletes-matrix.ts`, `readiness-snapshot.ts`, `user-providers-snapshot.ts`.
- `FE/src/app/api/dashboard/coach/athletes-matrix/route.ts`.
- `FE/src/app/api/athletes/[id]/readiness/route.ts`, `training-load/route.ts`.
- `FE/src/app/[locale]/coach/athlete/[id]/page.tsx`.
- `FE/src/components/dashboard/home/types.ts`, `src/components/dashboard/coach/AthleteReadinessMatrix.tsx`, `src/types/api-responses.ts`.
- `BE/api/routes/wearables.py`, `api/routes/graphs.py` provider discovery, `data_processing/base/graph_data_processor.py`, new narrowly scoped summary service and tests.
- A new server-only FE PPC client/shared metric contract module only where existing files cannot reasonably provide a reusable boundary.

No schema migration is assumed necessary. If indexes or a materialized summary prove necessary after profiling, design a forward-only migration separately, validate locally, and obtain explicit production approval. Do not edit old migrations, recreate legacy Garmin tables, drop old functions, or change RLS policies as a workaround.

### Phase 4 — Startup, caching, and navigation performance

1. Make coach init genuinely roster-first: profile/authorized roster and minimal session summary only. Notes, pending requests, readiness, courts, charts, and assistant extras must not block useful initial content.
2. Reuse one request-scoped verified profile result where possible; retain auth verification and role/approval controls. Parallelize independent authorized work, not privileged data reads before access is established.
3. Define separate roster completeness and metric completeness; remove the overloaded `__partial` heuristic and the rule that one good athlete implies a complete seed. Provide a compatibility adapter while consumers migrate.
4. Share scoped SWR keys across overview/players/details; include viewer/org/athlete/range/schema version where appropriate. Scope persisted UI selection to account/org. On identity/org/role change, remount or invalidate the actual cache owner and cancel in-flight old-scope requests.
5. Make TTL meaningful: stale cached entries may display with timestamps, but must revalidate according to age. Persist successful serializable data, not an unexamined entire internal SWR state/error. Avoid `keepPreviousData` when switching athlete identity unless the old identity remains clearly labeled.
6. Audit the service worker's private HTML/API caching. Prefer network-only auth/identity and personalized document responses until a proven user/build-aware cache model exists; static assets can remain cached. Never serve expired successful identity as authorization, cache transient failures as empty data, or mix app builds.
7. Coordinate `next.config.js`, `public/cache-warm-sw.js`, `ServiceWorkerRegistration`, and `cacheInvalidation.ts`; keep invalidation lists synchronized. Do not require users to reinstall the app. Any runtime stale-asset cleanup must be narrowly targeted and preserve user drafts.
8. Remove duplicate prefetch mechanisms where they compete for the initial network budget. Prioritize visible/intent-driven next routes, honor reduced-data/slow connection, and use bound SWR cache APIs rather than assuming global prefetch reaches a custom provider.
9. Align native manifest splash, HTML startup indicator, theme color, and brand assets. Do not force the UI to wait for logo decoding or add another timed splash. Preserve chosen theme and tenant identity.
10. Keep one navigation-progress implementation; handle canceled/same-page/query-only navigation, Back/Forward, and programmatic navigation without a stuck progress bar. Localize the hardcoded slow-navigation message.

Files:
- `FE/src/app/[locale]/coach/page.tsx`, `src/lib/dashboard/coach-init.ts`, init route.
- `FE/src/components/auth/AuthContext.tsx`, `src/components/providers/UserContextProvider.tsx`, `src/lib/swr-config.ts`, `src/hooks/api/useSWR.ts`.
- `FE/src/components/layouts/AppShell.tsx`, `LazyLayoutExtras.tsx`, navigation prefetch components and `src/hooks/useDataPrefetch.ts`.
- `FE/next.config.js`, `public/cache-warm-sw.js`, `src/components/pwa/ServiceWorkerRegistration.tsx`, `src/lib/pwa/cacheInvalidation.ts`.
- `FE/src/app/[locale]/layout.tsx`, `src/components/theme-provider.tsx`, manifest/splash routes only if baseline evidence requires them.

Exit gate: faster launch is measured, not inferred from a shorter skeleton; offline/auth/session-switch correctness passes before changing production cache strategy.

### Phase 5 — Professional visual system and shared mobile shell

1. Keep academy branding, existing Inter typography, and core workflows. Product pages use white/neutral opaque surfaces, one restrained accent, clear hierarchy, modest radii, subtle borders, and semantic status colors.
2. Remove decorative gradient heroes, unnecessary icon tiles, repeated shadows, animated count/ring clusters, and multiple nested card frames on the touched coach screens. Do not globally restyle the marketing/tennis-bench experience.
3. Define coach workspace variants using existing design tokens and primitives. Favor explicit shared variants over broad global CSS changes. Change global defaults only when the intended semantic contract is clear, as with opaque popovers.
4. Use one page title, concise supporting context, and a primary action. Show functional labels rather than icon-only segmented navigation on mobile. Keep long Catalan labels readable rather than squeezing or shrinking all text.
5. Replace the coach mobile center-FAB layout with four equal flat tabs: Overview, Athletes, Training, Messages. Keep Tournaments/Reports/other destinations reachable from the existing clearly labeled menu and desktop sidebar. Move Assistant to an ordinary labeled menu/header/page action; do not add a new floating button.
6. Preserve consumer personal-mode navigation semantics and other-role links. Shared surface/spacing improvements can apply broadly; other roles do not receive an unapproved IA rewrite.
7. Establish one bottom-clearance owner and shared nav-height/safe-area token. Update shell/page/footer clearance together; no delayed footer responsible for whether content is reachable. Hide navigation appropriately during full-screen dialogs/threads/keyboards without unmounting the assistant state owner.
8. Fix scroll restoration/focus management in `AppShell`: its pathname ref is updated before the focus effect checks it, so route-focus behavior needs a real regression test. Document scrolling and modal scroll locks must not compete.

Files:
- `FE/src/lib/design-tokens.ts`, `src/components/ui/{card,metric,page-header,accent-tabs,popover}.tsx`, relevant scoped styles in `src/app/globals.css` and `tailwind.config.js`.
- `FE/src/components/ui/NavBar.tsx`, `src/components/navigation/{BottomNav,LazyBottomNav}.tsx`, Sidebar navigation items.
- `FE/src/components/layouts/AppShell.tsx`, `src/components/ui/Footer.tsx`, `src/app/[locale]/coach/layout.tsx`.

Visual gate: approve compact mobile/desktop implementations of Overview and Athletes before propagating the new workspace treatment across all coach pages. Use supplied screenshots as before-state references.

### Phase 6 — Overview and athlete workflows

**Overview**
- Merge dashboard heading/greeting into one compact header with date/academy context.
- Replace the large multi-ring roster hero with a useful summary row: assigned athletes, assessed/available coverage, attention count with assessment scope, and data freshness.
- Never say “connect a wearable” solely because a fetch failed. Show a clear service warning/retry separately from genuinely unconnected athletes.
- Prioritize today's schedule/action and athletes needing review. Do not display “all clear” when the roster was not assessed.
- Focused athlete selection should open trustworthy compact metrics and a direct athlete-detail link. Keep measurements and source status aligned during selection changes.
- Separate dismissing a notification from resolving an injury/risk; selecting an athlete must not silently imply the issue is resolved.

**Athletes tab inside Overview**
- Preserve existing workflow compatibility initially, but use the same roster items and status components as Players.
- Replace the tall stack of empty analytics accordions with compact named sections; load data only when needed and distinguish loading/error/empty.
- On mobile use roster list -> selected athlete view with a clear back action and retained search/selection; on desktop allow list/detail split.
- Avoid repeated section headings and card-inside-card empty states. Show one compact explanation and relevant action when a source is unavailable.

**Standalone Players and athlete detail**
- Use a searchable, sortable roster with attention/data-status filters. Desktop: useful compact table/list; mobile: rows with name, primary metric/status, last update, and disclosure.
- Replace prominent always-visible red delete controls with a labeled overflow action and explicit confirmation, preserving permissions.
- Keep roster count consistent; maintain search/filter/scroll state across detail navigation.
- Athlete detail: concise identity header and sections for Summary, Training, Reports, and Tournaments. Preserve calendar, claim/invite, and report workflows; remove broken links and legacy activity counts.

Files:
- `FE/src/components/dashboard/CoachDashboard.tsx`, `home/CoachHome.tsx`.
- `FE/src/components/dashboard/home/cards/{RosterHero,FocusedAthletePanel,AttentionListCard,GreetingCard,CoachQuickActions}.tsx`.
- `FE/src/components/dashboard/coach/{UnifiedAthleteView,AthleteReadinessMatrix,InjuryRiskDashboard,TrainingLoadPeriodization}.tsx`.
- `FE/src/app/[locale]/coach/players/CoachPlayersPageClient.tsx`, athlete detail page and consumed athlete components.
- Reuse `MetricRing` only where a real comparable proportion exists; no app-wide ring removal is required.

### Phase 7 — Training, tournaments, and reports

1. After the root crash is repaired, verify each route's real request/render path independently; do not label them fixed merely because navigation no longer throws.
2. Training: mobile agenda-first view, clear day/week selector, accessible create session action, attendance details on demand. Desktop retains calendar/court tools. Bound SSR date range and payload; fetch history/future pages on demand without truncating the functional calendar.
3. Tournaments: mobile upcoming-list default with optional calendar; responsive filters; consistent date interval semantics. Audit `date` filtering versus `start_date` sorting and ongoing/end-date behavior. Add explicit SWR error/stale handling.
4. Reports: compact list with date/athlete/session/status; preserve create/edit/view/export. Replace swallowed SSR failures and ignored hook errors with retryable states. Unrated reports must not yield a false `0.0/10` average. Report summaries/details must use compatible types and fetch full details only when needed.
5. Replace unrestricted bulk page fetches with bounded windows/pagination and explicit totals, so a page-size cap never becomes a misleading organization-wide count.
6. Use shared dialogs, validation, confirmations, and mutation invalidation. Preserve date/timezone behavior and selected queries/deep links. Test actual saves against local/staging fixtures only.

Files:
- `FE/src/app/[locale]/coach/training/page.tsx`, `src/components/management/training/{TrainingTabs,GroupTrainingSchedule,IndividualTrainingPlans,TrainingReports}.tsx`.
- `FE/src/app/[locale]/coach/tournaments/{page,CoachTournamentsClient}.tsx`, tournament list/calendar/dialog components.
- `FE/src/app/[locale]/coach/reports/{page,ReportsPageClient}.tsx`, `src/components/coach/reports/*`, `src/hooks/data/useReports.ts`.
- `FE/src/lib/supabase/queries/{trainingManagementQueries,tournamentManagementQueries}.ts` and their matching API routes where contract changes require them.

### Phase 8 — Notifications and overlay consistency

1. Replace the popover background with valid opaque `bg-popover`; remove its blur. Confirm tenant theme variables resolve to white in light mode. Keep a subdued border/shadow, not glass.
2. Give mobile notifications a viewport-bounded panel with readable heading, compact empty state, meaningful timestamps, unread state, keyboard focus behavior, and reachable View all action.
3. Unify alert state between header and full notification page; invalidate both relevant keys on read/dismiss. Optimistic actions must check HTTP status and roll back on failure; “mark all read” must handle partial failure rather than silently claiming success.
4. Opening the panel triggers/joins a request when deferred idle loading has not happened. Show loading/error distinctly; do not imply “all caught up” before data is fetched.
5. Verify dialogs/date pickers/selects after shared popover changes; preserve existing portal and calendar interaction behavior.

Files:
- `FE/src/components/ui/popover.tsx`, `src/components/dashboard/alerts/{AlertsDropdown,AlertsList}.tsx`.
- `FE/src/components/ui/NavBar.tsx`, `src/app/[locale]/notifications/page.tsx`, relevant shared alert hook/API invalidation.

### Phase 9 — Trustworthy, useful AI assistant

**Chat and mobile UX**
1. Keep conversation state above the modal content lifecycle; do not clear on mount. Use explicit conversation IDs scoped to user/org; a New conversation action resets both visible state and server context consistently.
2. Use a compact header and two or three context-relevant suggestions with a More option. Include selected athlete/date range in visible context chips. Clearly label the assistant as AI without making a robot illustration the focal point.
3. Use a stable pinned composer and one scrollable message region. Size textarea for actual font/placeholder line-height; shorter localized placeholder; grow by measured content. Keep send/stop/voice accessible with the keyboard open and at large text sizes.
4. Preserve scroll position while reading history; autoscroll only near the bottom, otherwise offer Jump to latest. Retain draft on transient failure/close.
5. Retry/regenerate the failed turn without appending an assistant response as user input. Distinguish connecting, retrieving data, generating, awaiting confirmation, canceled, timed out, rate limited, and failed.
6. Retain voice, but show editable transcript before submission, permission recovery, unsupported-browser fallback, and no unintended sending of partial speech. Handle IME Enter correctly.

**Grounding and workflows**
1. Make the active `/api/ai-agent` path consume the same roster/metrics adapters as the UI, including source, date, coverage, and unavailable reasons. Fix remaining legacy table tools used in coach workflows.
2. Resolve authorized assigned IDs server-side and pass/enforce them consistently in discovery and every data/write tool. Re-check permissions when executing an action; org-wide admin privileges remain separate.
3. Improve routing for Catalan/Spanish/Portuguese and contextual follow-up requests. Use stable intent IDs for built-in suggestions, passed through a server allowlist, and a safe multilingual/follow-up strategy for free text. Tool selection must not expand permissions.
4. Deliver four initial workflows: roster/attention briefing, athlete comparison with aligned dates/coverage, training preparation based on actual available information, and report draft with sources. Existing capabilities should be refined before adding more tool families or switching model providers.
5. Render structured citations/source chips and deep links separately from free-form generated markup. Preserve sanitization and accessible semantic lists/tables; no unsafe HTML workaround.
6. Distinguish observed facts, computed summaries, and suggestions. Do not invent a missing score, imply medical certainty, or produce confident injury-risk conclusions from unavailable data.

**Confirmed actions**
1. Replace generic green result cards with typed results for read-only data, draft/proposal, confirmation required, executed, and failed.
2. Use a server-held pending-action record bound to user/org/conversation/tool/validated arguments and expiration; explicit confirm/cancel UI submits the pending action identity. Execution reauthorizes and uses an idempotency key. Do not trust an LLM-generated `confirmed:true` as proof of consent.
3. Reuse an existing suitable persistence store only after inspecting its schema; if a new pending-action table is required, propose a separately reviewed forward migration and production approval. Read/draft workflows can ship before write actions.
4. Preserve existing AI rate limits/entitlements; validate request size/message/tool schemas and enforce the full end-to-end timeout, including context preparation. Cancellation must propagate to upstream requests. Do not enable auto-provisioning or external sends as part of an ordinary read test.

Files:
- `FE/src/components/ai/{VoiceAssistantHost,VoiceAssistantModal,QuickActions,MessageBubble,ToolResultCard}.tsx`.
- `FE/src/hooks/ai/useAIAgent.ts`, `useSpeechRecognition.ts` where tests identify a voice defect.
- `FE/src/components/mobile/{ResponsiveDialog,MobileSheetContent}.tsx`.
- `FE/src/app/api/ai-agent/route.ts`, `src/lib/ai/utils/{toolRouter,conversationMemory}.ts`, relevant prompts/tools including `confirmationTools`, `queryTools`, `wearableInsightTools`, `garminActivityTools`, and legacy athlete/filter tools.
- New pending-action handler/model only if required after the existing persistence audit; approval and test gates apply.

AI evaluation set: at least 30 deterministic fixture-backed cases spanning English/Catalan, nine-athlete coverage, missing/stale/partial sources, duplicate names, follow-ups, comparisons, unauthorized athletes, failed tools, retries, voice cancellation, and confirmation replay/cancel. Real-provider smoke tests are opt-in and must not perform real writes.

## 5. Verification plan

### Existing infrastructure and gaps
- FE uses Vitest 3, React Testing Library, jsdom, MSW, Zod, and Sentry. Browser E2E tooling is not currently declared in package.json.
- Existing `tests/coach-dashboard-init.test.ts` asserts failure-as-empty behavior and includes weak assertions; update it to the explicit-state contract rather than preserving the defect.
- `tests/setup.ts` globally mocks `next-intl`, so ordinary component tests cannot prove real provider/locale behavior. Add focused tests using actual providers/messages instead of trusting key-returning mocks.
- Existing relevant suites: `tests/components/dashboard/CoachDashboard.test.tsx`, `tests/api/coach/player-assignments.test.ts`, `tests/api/with-auth-verified-identity.test.ts`, `tests/auth/login-middleware.test.ts`, `tests/api/ai-agent/tool-router.test.ts`, navigation tests, `tests/lib/calculations/readiness.test.ts`.
- BE uses pytest and pytest-asyncio in `requirements-dev.txt`; existing graph/processor tests are under `tests/test_api/` and `tests/test_data_processing/`.

### Required additions
- Ownership regression: hydrate/mount/unmount/reconcile startup indicators, locale shell replacement, error reset; no external mutation of React-owned child nodes.
- API contract and schema tests: membership parity, failure states, readiness DTO, assignment/tenant authorization, per-metric null handling, stale cache, identity switch.
- Backend/source tests: nine-plus athletes, constrained concurrency, deadline cancellation, latest-sync deduplication, correct metric selection, sleep awake exclusion, timezone/completed session, score-only provider, missing history, per-athlete partial failure.
- UI tests: valid opaque popover CSS, compact empty/error states, source indicators, roster search/selection, notification optimistic rollback, mobile nav state.
- AI tests: conversation reopening, failed-turn retry, multilingual routing, no cross-athlete carryover, correct confirmation rendering and server enforcement.
- Browser suite: propose a minimal Playwright dev dependency/config and `tests/e2e/coach-*` files. Pin a release at least seven days old; dependency installation needs implementation approval. If dependencies are declined, retain an equivalent documented manual browser matrix, but do not claim it provides automated coverage.

### Commands during implementation

From FE, using the repository's pnpm 9.15 environment:
- `pnpm exec vitest run` for scoped suites first, then the full relevant suite.
- `pnpm lint`.
- `pnpm typecheck`.
- `pnpm check:i18n` and `pnpm check:i18n-namespaces` for changed locales; inspect any existing baseline failures rather than bulk-rewriting unrelated translations.
- `pnpm build` for the normal build including prebuild/vendor handling.
- `pnpm build:analyze` and `node scripts/check-bundle-budgets.js` for the report-based budget check after vendor preparation. The budget script reads `.next/build-report.txt`; a stale report is not acceptable evidence.
- `pnpm exec playwright test` once that test dependency/config is approved and installed.

From BE:
- `python -m pytest tests/test_api/test_graphs.py` plus new summary/auth contract cases.
- `python -m pytest tests/test_data_processing/test_graphs/test_health_graphs/test_sleep_graphs.py` plus relevant processor/summary tests.
- Run any SQL security/migration tests only on an explicitly confirmed disposable local/staging database; never point a generic test command at production credentials.

Match user alphabetical import/prop/variable conventions in touched code, honoring dependency ordering where required. Run ES6/ESLint checks; do not claim the current lint config enforces every alphabetical rule automatically. Preserve existing comments unless explicitly authorized to change them. Avoid new runtime dependencies unless a concrete gap justifies them.

### Browser/device matrix
- Primary: Android Chrome installed PWA, Catalan; desktop Chrome, English, including the exact Training transition supplied.
- Also Android browser mode, iOS Safari and installed PWA, tablet and desktop layouts.
- Viewports 320, 360, 390, 430, 768, 1024, 1440 px; portrait/landscape; 200% text; reduced motion; light/dark; long localized labels.
- Cold start, warm cache, online slow network, failed upstream, offline -> reconnect, expired session, background -> resume, sign-out/account switch, org/role switch, old-build -> new-build.
- Open/close notifications, menus, assistant, voice permission dialog; ensure focus return, Escape/Back behavior, no stale scroll lock, no content hidden by navigation, no keyboard-covered composer.
- Test approved local/staging create/edit flows and cache invalidation for players, sessions, tournaments, reports, and alerts. Never perform these against production without explicit approval.

## 6. Release ordering and safety gates

1. **Release A: crash recovery** — startup DOM ownership, guarded recovery, diagnostics, link fixes, focused regressions. Opaque notifications can be a small independent safe patch.
2. **Release B: data reliability** — assignment parity, proper error contracts, remove dead dependencies, complete nine-athlete processing, secure source adapter and typed summaries. Deploy compatible backend support first if needed, then FE consumers; no schema-dependent FE deployment ahead of backend readiness.
3. **Release C: performance** — roster-first startup, scoped caches/revalidation, bounded work, measured launch/transition improvements.
4. **Release D: coach UX** — shared workspace variants and flat nav, Overview/Athletes visual gate, then Training/Tournaments/Reports/notifications.
5. **Release E: assistant** — grounded read/draft workflows and conversation/mobile fixes first; explicitly confirmed mutation workflows only after authorization/idempotency tests pass.

Each release must have passing scoped tests, build/type/lint, before/after behavior evidence, and a safe rollback path. Do not push, deploy, run database migrations, change project configuration, or clear user/device storage without explicit approval for the relevant action. A known bad implementation should not be restored merely to meet an arbitrary release schedule.

## 7. Final definition of done

- The supplied `removeChild` crash no longer occurs in the full authenticated navigation regression, not just the isolated mechanism test.
- The nine-athlete roster is consistent everywhere and every metric has a truthful state and provenance.
- Production source errors on the repaired paths are eliminated or surfaced explicitly; no hidden dead-table dependency remains in those paths.
- The launch and transition targets are measured with the same device/network profile before and after.
- The updated coach app has one coherent light professional visual system, flat mobile navigation, readable functional labels, opaque overlays, and no large decorative empty-state stacks.
- AI chat is usable with a mobile keyboard, preserves conversation context, grounds its answers, and cannot claim success for an unconfirmed/failed action.
- Other roles, tenant branding, localization, authorization, accessibility, and existing bundle budgets remain intact.
- Any remaining blocker is explicitly reported with evidence and a follow-up owner/gate; no user-requested area is silently dropped.
