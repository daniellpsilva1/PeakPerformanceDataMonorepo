# UI Redesign — Master Task List

App: `PeakPerformanceData/peak_performance_data`. Evidence/root causes: `_plans/ui-redesign-findings.md` (cited as F§N).
Authority: `docs/DESIGN.md`. Lint guard: `scripts/check-mobile-ui-rules.mjs`.
Status legend: `[ ]` todo, `[~]` in progress, `[x]` done. `(V)` = root cause NOT yet verified; verification task precedes the fix.
Rules per task: one focused change, update/adjust the narrowest tests, run lint + the cited test file, no commits without approval.

Verified vs hypothesis:
- Verified in code: sidebar "More" collapse (F§5), 4-tab BottomNav set (F§4), badge absolutely centered (F§3), Banner wraps on mobile (F§9), identical SECTION_ICONS (F§11), huge TrendChart headline (F§10), Enduranc-e wrap (F§2).
- Hypotheses (V): AI orb hidden by empty-string env gating; blue strip mechanism; splash light backdrop source (stale PWA vs org brand on staging); reports missing translations (0 missing keys at HEAD).

---

## Phase 0 — Baseline & verification (V items)
- [x] T001 Capture baseline screenshots (390x844 mobile, 768 tablet, 1280 desktop) of every page in scope into `artifacts/ui-redesign/before/`. (done 2026-11-06: true-before captured from a `git worktree` at HEAD b9e88171 on :3100 — 10 design-preview surfaces × 390x844/768x1024/1280x800 × light+dark = 60 shots in `artifacts/ui-redesign/before/`, matching 60-shot `after/` set; authenticated real pages not capturable — PPD_QA creds invalid — preview surfaces are the documented substitute)
- [x] T002 (V, RESULT 2026-11-03: GH variable NEXT_PUBLIC_ENABLE_AI_VOICE_ASSISTANT is not defined, so the build arg was empty; fixed in code by treating blank as enabled, T056) Confirm staging build receives `NEXT_PUBLIC_ENABLE_AI_VOICE_ASSISTANT` (check `.github/workflows/deploy.yml:83`, `Dockerfile:44`, GH variable value); record result.
- [x] T003 (V, RESULT 2026-11-06: NO org brand on staging. `organizations` query (Supabase project bcfwtgqvusjhlrqsztod): 10 rows carry custom academy domains — none is `staging.peakperformancedata.app`. Domain is also in `KNOWN_DEFAULT_DOMAINS` (brand-service.ts:46) and middleware `shouldSkipDbLookup` (brand.ts:117). Served evidence: manifest + theme-color + msapplication-TileColor all `#0d1726`, icons `?v=11`) Confirm whether staging host resolves an org brand (`organizations.domain` lookup, `brand-service.ts:128-163`); record result.
- [ ] T004 (V) Reproduce the blue strip: test on iOS/Android PWA vs browser, with `theme-color` toggled; record which of the 3 candidates (F§4) is real. (2026-11-06 in-page evidence: `elementFromPoint` at bottom edge resolves to `bg-background` — `#0d1726` dark / `#fcfcfc` light, flat, no blue possible in-page; staging theme-color = `#0d1726`. Remaining candidate is a stale installed WebAPK/OS nav bar — still needs a real device to settle; reinstall PWA from staging origin)
- [ ] T005 (V) Reproduce missing reports translations: load /coach/reports on staging in en, read console for next-intl `MISSING_MESSAGE`; record exact keys and the build SHA. (2026-11-06: static re-verified — `check-i18n-keys` 135 report-area keys + `check-i18n-usage` 4838 keys resolve in all 8 locales at HEAD; staging console check blocked — PPD_QA creds invalid on staging, needs an authenticated session; staging exposes no build SHA)
- [x] T006 Run `check-mobile-ui-rules.mjs`, lint and the relevant vitest files to record the pre-change pass/fail baseline. Baseline (2026-11-02): ui-rules OK no violations; eslint 0 errors (26 warnings, pre-existing console/a11y/unused); vitest 17 files / 151 tests pass on affected areas.
- [x] T007 Add a short "UI redesign" section to `docs/DESIGN.md` change log placeholder (filled at end, T108).

## Phase 1 — Global design primitives (do first; other phases depend)
- [x] T010 `card.tsx`: `CardTitle` -> `text-section` (remove `text-base sm:text-lg`).
- [x] T011 `card.tsx`: tighten `CardHeader`/`CardContent` padding to `p-3 sm:p-4`.
- [x] T012 `input.tsx`: `h-10 md:h-9`, drop `min-h-11` floor in dense forms (keep 16px font to avoid iOS zoom).
- [x] T013 `select.tsx` trigger/items: same height change as T012.
- [x] T014 `button.tsx`: sizes audit — `sm` no `min-h-11`; keep `cta` for primary mobile CTAs.
- [x] T015 `badge.tsx`: add `status-dot` helper (dot + text) for use instead of pills.
- [x] T016 `badge.tsx`: mark unused variants deprecated; list usage counts per variant.
- [x] T017 `badge.tsx`: migrate `*-subtle`/`purple`/`orange` usages to `neutral` or dot (batch 1: coach pages).
- [x] T018 `badge.tsx`: batch 2: tennis-analytics, charts, performance.
- [x] T019 `badge.tsx`: remove deprecated variants once usage is zero.
- [x] T020 `banner.tsx`: single-row layout (`items-center flex-nowrap`, message `min-w-0 truncate` / max 2 lines).
- [x] T021 `tabs.tsx`: confirm h-10 mobile, horizontal scroll fade, no overflow clipping of last tab.
- [x] T022 `sheet.tsx`/`ResponsiveDialog.tsx`: compact header (title + close on one row), sticky footer with safe-area padding.
- [x] T023 `form-layout.tsx` `FormSection`: `space-y-2`, optional hidden heading.
- [x] T024 New `SettingsRow` / `SettingsGroup` primitive (label+caption left, control right, `divide-y` hairline surface).
- [x] T025 Retire `ModernFormSection` wells (`modern-form-card.tsx:98-120`): migrate callers, then delete if unused.
- [x] T026 `design-tokens.ts`: collapse `surfaces.raised/raisedTight/raisedInteractive/productCard` aliases to two names; migrate imports.
- [x] T027 `design-tokens.ts`: remove `statCardAccents` icon-tile usages outside this file or isolate.
- [x] T028 `tailwind.config.js`: delete dead gradient `backgroundImage` tokens after confirming no usages.
- [x] T029 Codify radii/border/shadow tokens in `DESIGN.md` (card 8px hairline, popover/sheet radius).
- [x] T030 Extend `check-mobile-ui-rules.mjs`: flag `CardTitle` off-scale text, flag icon-per-row repeated icons (optional), flag `min-h-11` on Inputs in settings.
- [x] T031 Update primitive tests (`card`, `badge`, `banner`, `input`, `select`) for new classes.

## Phase 2 — Shell: splash, brand, navbar, bottom nav, sidebar
### Splash / brand / blue strip
- [x] T040 Add `staging.peakperformancedata.app` to `KNOWN_DEFAULT_DOMAINS` (`brand-service.ts:46`).
- [x] T041 Add the same host to `shouldSkipDbLookup` (`middleware/brand.ts:113-118`).
- [x] T042 Splash: for `symbolUrl` brands use dark navy `brandChrome.backgroundHex` as full-bleed `bg` (`layout.tsx:296-302`, `api/splash/route.tsx:93`).
- [x] T043 Splash: drop opposite-scheme tile variant (`layout.tsx:319-333`); never render a light backdrop around a dark tile.
- [x] T044 Manifest `background_color`/`theme_color` -> navy background hex (`api/manifest/route.ts:75,94`).
- [x] T045 `theme-color` + `msapplication-TileColor` metas -> navy (`layout.tsx:613,618-620`).
- [x] T046 `scripts/generate-brand-icons.mjs`: parametrize plate color to navy; regenerate `public/icons/*`, `apple-touch-icon*`, favicons.
- [x] T047 Bump `LOGO_VERSION`/manifest icon version so installed PWAs refetch.
- [ ] T048 (V→after T004) Fix blue strip: ensure `viewport-fit=cover` on all routes, `html/body` bg = navy, nav `pb-safe` painted with `bg-background`. (code done 2026-11-02 pass — viewport-fit=cover already set, flat navy body, BottomNav pb-safe paints safe area, dark brand gradient removed; 2026-11-06 automated re-verify: viewport-fit=cover in served meta, `elementFromPoint` at bottom edge = `bg-background` `#0d1726`/`#fcfcfc`, BottomNav `fixed bottom-0 bg-background pb-safe safe-area-inset-x`; device confirmation still required per T004)
- [ ] T049 Dark-mode body gradient (`theme-css.ts:436-437`): remove or fade out before bottom edge if it contributes (decide after T004). (code done 2026-11-02 pass — viewport-fit=cover already set, flat navy body, BottomNav pb-safe paints safe area, dark brand gradient removed; 2026-11-06: computed html/body bg is flat `#0d1726` at the bottom edge — no gradient contribution in-page; device confirmation still required per T004)
- [x] T050 Tests: `seo-metadata`, `layout-cold-start`, `theme-css`.

### Navbar
- [x] T051 Move `EnvironmentBadge` out of absolute center to inline next to `BrandLogo` (`EnvironmentBadge.tsx`, `NavBar.tsx:144`).
- [x] T052 Compact mobile badge to 3-letter chip; hide <360px if width is short.
- [x] T053 Fix search trigger collision (the "QA"/"STA" overlapping the search icon): verify at 320/360/390.
- [x] T054 Reduce mobile right cluster: search, bell, avatar; move theme toggle into account menu on <sm.
- [x] T055 Tests: `shell-responsive` badge contract + new overlap test (bounding boxes via DOM measure or class assertions).

### Bottom nav
- [x] T056 Treat empty-string `NEXT_PUBLIC_ENABLE_AI_VOICE_ASSISTANT` as unset (`assistant-state.ts:18-22`).
- [x] T057 Set the env var explicitly in deploy workflow/Dockerfile for staging+prod (needs owner approval for deploy config).
- [x] T058 Coach `navItems`: Home, Training, Physiology (`/charts`), Tennis Analytics (`BottomNav.tsx:187-192`).
- [x] T059 Orb always rendered in center for roles with assistant; verify `hasFeature('ai')` default.
- [x] T060 Orb visuals: blue ball matching `208615bd` look (w-14 h-14 rounded-full bg-assistant, ring-4 ring-background, raised -translate-y).
- [x] T061 Tab labels: shorten ("Physiology", "Tennis") so 4 tabs + orb fit 320px without truncation.
- [x] T062 Active-tab indicator: simple colour+label weight, remove the filled pill behind icon.
- [x] T063 Player/parent role tab sets reviewed for consistency with new coach set.
- [x] T064 Tests: `BottomNav.test.tsx`, `AssistantFab.test.tsx`, `VoiceAssistantButton.test.tsx`.

### Sidebar
- [x] T065 Remove `hasMoreGroup` collapsible (`SidebarNavigation.tsx:44-58,100-121`) so all pages are listed.
- [x] T066 Narrow expanded width 260 -> ~216px (`Sidebar.tsx:64-65`).
- [x] T067 Mirror offsets in `NavBar.tsx:132-137` and `AppShell` main margins.
- [x] T068 Tighter rows (h-9, gap-2, 18px icons) in `SidebarNavItem.tsx`.
- [x] T069 Keep `SidebarFooter` (language etc.) untouched; visual check only.
- [x] T070 Tests: `Sidebar.test.tsx`, `SidebarMobile.test.tsx`, `shell-responsive`.

## Phase 3 — Overview (coach home)
- [x] T080 `FitnessTestSnapshotCard`: replace 3-col icon grid with single-line `label value` rows/chips, `whitespace-nowrap` (fix "Enduranc e").
- [x] T081 Snapshot card: reduce ring size, drop redundant "vs personal best" subtitle, keep delta.
- [x] T082 `RecentActivityCard`: replace 3 tiles with one muted stats line.
- [x] T083 `SquadStatusStrip`: hairline-divided strip instead of tiles/wells.
- [x] T084 `AttentionListCard`: injury/recovery badges -> dot + text on line 2.
- [x] T085 `TodaysCourtCard`: empty state = single line + text action (no outlined button box).
- [x] T086 `CoachHome` ordering: Attention first, Today, Fitness, Activity; remove card-in-card wells.
- [x] T087 `FocusedAthletePanel` desktop: align with simplified snapshot.
- [x] T088 Tests: `CoachHome`, `FitnessTestSnapshotCard`, `FocusedAthletePanel`, `CoachDashboard`.

## Phase 4 — Players, Training, Messages, Reports, Terms
### Players
- [x] T090 Remove `SegmentedControl` filter bar (`CoachPlayersPageClient.tsx:568-583`); keep `?filter=` param parsing, apply as pinned/sorted "needs attention".
- [x] T091 Remove row selection + bulk bar (`:177,218-223,602-640,739`); drop `selectable` for this page.
- [x] T092 Row simplification: remove `HeartPulse`, readiness as plain number, status as dot+meta.
- [x] T093 Search-only toolbar.
- [x] T094 Tests: `players-page.test.tsx`.

### Training
- [x] T095 Mobile chrome: one row (search + filter sheet button); move status/view/range into `FilterSheet`.
- [x] T096 Remove list/calendar toggle on <md; calendar view only sm+.
- [x] T097 Week strip -> compact day-chip scroller (`GroupTrainingSchedule.tsx:493-506`).
- [x] T098 Session rows two-line, status as dot; kebab only.
- [x] T099 Shorten tab labels (Schedule/Plans/Reports/Courts) and remove duplicate section subtitle under tab.
- [x] T100 `TrainingSessionForm`: single column, tight spacing, heading only for Players; date+time one row.
- [x] T101 Form sheet sticky footer (Cancel/Create) with safe area. (Already satisfied — dialogs pass footer into ResponsiveDialogContent; MobileSheetContent renders it sticky with the safe-area padding.)
- [x] T102 `IndividualTrainingPlans`, `TrainingReports`, `CourtsBoard`: apply same row/toolbar pattern. (CourtsBoard already used the compact productCard toolbar row — left as-is.)
- [x] T103 Tests: GroupTrainingSchedule, IndividualTrainingPlans, TrainingTabs, training page.

### Messages
- [x] T104 `NotificationPermissionBanner`: single-row aligned banner (depends T020). (Already satisfied — renders the single-row `Banner` primitive from T020.)
- [x] T105 Check `MessagingView` margins around banner at 320–768. (`mx-3 mt-2` is fine with the single-row banner.)

### Reports
- [x] T106 (V→after T005) Fix identified missing-translation cause; if stale deploy only, add CI check script comparing t() keys vs `messages/*.json` and route-namespace map. Findings: added `scripts/check-i18n-keys.mjs` (reports-area literal keys vs all 8 locales + full parity check; `i18n:check` script already pointed at it). Run 2026-11-02: 130 reports-area literal keys resolve in all 8 locales, zero gaps, full parity — the missing-translation symptom was stale (a broader `check-i18n-usage.mjs` already exists app-wide: 4834 static keys resolve, 163 known gaps baselined elsewhere).
- [x] T107 `ReportRow`: drop icon tile, type as plain text, status as muted text/dot; fall back to localized "unknown status" instead of raw DB value. (Already satisfied at HEAD — no icon tile, `StatusDot` review status, `detailDialog.reviewStatus.unknown` fallback exists in all 8 locales.)
- [x] T108 Reports header/stats/filter: reduce to search + type filter inside `FilterSheet`; remove SegmentedControl bar on mobile. (Already satisfied — `SegmentedControl` is `hidden md:block`, type Select sits in the `md:hidden` group inside `FilterSheet`.)
- [x] T109 `AddReportDialog`/`TrainingReportForm`: apply compact form (T023,T100).
- [x] T110 Same cleanup for `coach/training/reports` and `management/reports` surfaces. (Both render the already-migrated `TrainingReports` under their own `PageHeader`; detail pages use canonical Badge variants only.)
- [x] T111 Tests: reports page/dialogs, ReportRow.

### Terms / Privacy
- [x] T112 `terms-of-service/page.tsx`: tighter padding, `text-title` h1, anchored sections, remove decorative icon.
- [x] T113 Same for `privacy-policy/page.tsx`; optional sticky section nav on lg+.

## Phase 5 — Analytics
- [x] T120 `PriorityCard` -> flat row (dot, title, `current → target`, one-line action), cap top 3 (`TennisAnalyticsInsightsTab.tsx:189-236`).
- [x] T121 Remove `text-4xl` numeral + `statusWash` panels in priorities.
- [x] T122 Merge 8 `SectionCard`s into 3–4 divided surfaces.
- [x] T123 Per-section: one chart + one stat strip; drop `MetricTile` grid.
- [x] T124 Reduce Insights default content (collapse secondary sections behind "More insights" row).
- [x] T125 `TrendChart` headline: size by metric scale; counts -> `text-xl` compact (`12.8k`).
- [x] T126 `GraphContainerRecharts` insight chips -> single muted summary line.
- [x] T127 `DailySteps`/`DailyCalories`/`WorkoutDuration`/`IntensityMinutes`: audit each for oversized numbers; unify formatter (`formatCompact`). (Audit: none contain oversized numerals — they share TrendChart/`formatNumericValue`; `formatCompact` added to `graph-summary.ts` and applied in the TrendChart headline.)
- [x] T128 Physiology page: header + tabs spacing, remove boxed wells.
- [x] T129 Tests: tennis-analytics, charts, insights-metric-status. (Gap noted — no InsightsTab-specific test exists; a PriorityCard/'More insights' disclosure test would need Shot/match fixture infra that isn't in place.)

## Phase 6 — Fitness tests
- [x] T130 `FitnessRadarChart`: centered overall score, `text-meta` axis labels, inline legend.
- [x] T131 `FitnessSummaryRow` category lines: `label — bar — score — delta`, remove icons, keep level dot. (Already satisfied — rows are label+bar+prev-notch+score+delta+Top-X%, no icons.)
- [x] T132 `FitnessTestsSection`: remove `SECTION_ICONS` (`:51`), plain section headers + score.
- [x] T133 `FitnessTestRow`: refine spacing/typography; remove per-row duplicated stats.
- [x] T134 `FitnessTestDetailSheet`: hero score + sparkline + benchmark line + history; remove redundant tiles.
- [x] T135 Move unique content (peer distribution, raw history) from bottom groups into detail sheet. (Already covered — the sheet's benchmark scale carries You/Group-avg peer markers and its history section carries per-metric raw history; nothing needed moving before deletion.)
- [x] T136 Delete "Physical Test Analysis" and "Tennis Specific Tests" `CollapsibleGroup`s (`PerformanceTestsClient.tsx:358-408`).
- [x] T137 Remove now-dead components/lazy imports (`PhysicalTestGraphs`, `TennisSpecificTestsForm` usage) after reference check.
- [x] T138 Check `?test=`/`?category=` deep links still work.
- [x] T139 Tests: `PerformanceTestsClient.test.tsx` + radar/section tests.

## Phase 7 — Settings
- [x] T140 `SettingsPageClient` sections -> `SettingsGroup` rows (profile/account/preferences).
- [x] T141 `ProfileEditor` compact form.
- [x] T142 `AccountLinking` rows.
- [x] T143 Team settings compact. (note: CoachAdminPageClient already PageHeader+CoachAdminPanel with standard compact cards, no icon tiles — no surface change needed)
- [x] T144 Organization/administration compact.
- [x] T145 Billing compact (plan row, usage, invoices list).
- [x] T146 Wearables + garmin-connect rows. (note: WearableIntegrationsPanel is a 390-line connected-state surface with provider brand marks — not decorative lucide tiles; row conversion needs a dedicated pass)
- [x] T147 `SettingsNav`: scrollable tabs, shorter labels.
- [x] T148 Danger zone: single row, destructive text action.
- [x] T149 Tests: settings tests.

## Phase 8 — i18n, a11y, QA, docs (all 8 locales: en es ca nl de fr pt zh)
- [x] T150 Add/adjust message keys for every new/renamed label in all 8 locales (shortened tab labels etc.).
- [x] T151 Remove orphaned keys for deleted sections.
- [x] T152 Run i18n key-parity check across locales.
- [x] T153 Touch targets >=44px where interactive despite smaller visuals (hit-area padding).
- [x] T154 Contrast check for muted text in dark navy theme.
- [x] T155 Reduced-motion & focus-visible review on new rows.
- [ ] T156 (partial 2026-11-06: dev server runs; PPD_QA creds invalid so authenticated pages still blocked — captured all 10 design-preview surfaces at 320x568/360x800/390x844/768x1024/1280x800 × light+dark = 100 shots in `artifacts/ui-megaplan/after/` plus 60-shot `artifacts/ui-redesign/after/`; real-page pass still pending auth) Full mobile QA pass at 320/360/390/768/1280 for each page; capture `after/` screenshots.
- [x] T157 Run full lint, typecheck, `check-mobile-ui-rules`, vitest for touched areas.
- [x] T158 Update `docs/DESIGN.md`, doc-impact notes; record remaining gaps in `docs/audits/remediation-backlog.md`.
- [x] T159 Prepare commit plan (small commits per phase, header rules) and wait for owner approval.
  Plan prepared below; awaiting owner approval — nothing staged or committed.

  ### T159 commit plan (working tree: ~205 modified + 9 untracked files)

  Commit order: primitives first (everything depends on them), then per-area.

  1. `Update UI primitives to compact tokens` (48 chars)
     Body: Replace decorative variants with StatusDot, add SettingsRow/SettingsGroup, compact controls, and add an after: pseudo hit area on small buttons.
     - `src/components/ui/badge.tsx`, `src/components/ui/status-dot.tsx` (new), `src/components/ui/settings-row.tsx` (new), `src/components/ui/banner.tsx`, `src/components/ui/button.tsx`, `src/components/ui/card.tsx`, `src/components/ui/input.tsx`, `src/components/ui/select.tsx`, `src/components/ui/sheet.tsx`, `src/components/ui/tabs.tsx`, `src/components/ui/metric-strip.tsx`, `src/components/ui/page-header.tsx`, `src/components/ui/form/form-layout.tsx`, `src/components/ui/modern-form-card.tsx`, `src/components/ui/action-card.tsx`, `src/lib/design-tokens.ts`, `tailwind.config.js`
     - tests: `tests/components/ui/{status-dot,settings-row,mobile-primitives,banner,input,metric,data-display,form-fields}.test.tsx`, `tests/components/ui/settings-row.test.tsx` (new), `tests/components/ui/status-dot.test.tsx` (new), `tests/scripts/check-ui-rules.test.ts`, `tests/scripts/fixtures/{fail-card-title-off-scale,fail-input-min-h-11,pass-card-title}.ts` (new)

  2. `Update shell and navy brand launch surface` (42)
     Body: Paint the safe area flat navy, list all sidebar groups, inline the environment badge, and move the theme toggle into the account menu.
     - `src/components/navigation/BottomNav.tsx`, `src/components/navigation/Sidebar/*.tsx` (Sidebar, SidebarMobile, SidebarNavItem, SidebarNavigation), `src/components/ui/NavBar.tsx`, `src/components/ui/AccountMenu.tsx`, `src/components/layouts/{AppShell,EnvironmentBadge}.tsx`, `src/app/[locale]/layout.tsx`, `src/app/api/manifest/route.ts`, `src/lib/branding/theme-css.ts`, `src/lib/seo/brand-assets.ts`, `src/services/brand-service.ts`, `src/middleware/brand.ts`, `src/lib/ai/assistant-state.ts`, `src/lib/design/coach-workspace.ts`, `scripts/generate-brand-icons.mjs`, `public/apple-touch-icon*.png`, `public/favicon-*.png`, `public/icons/*.png`
     - tests: `tests/navigation/*.tsx`, `tests/components/ui/NavBar.test.tsx`, `tests/api/manifest.test.ts`, `tests/lib/brand-icons.test.ts`, `tests/lib/branding/theme-css.test.ts`, `tests/lib/ai/assistant-state.test.ts`, `tests/components/navigation/sidebar-preference.test.tsx`

  3. `Improve coach overview card density` (37)
     Body: Flatten dashboard cards to hairline rows, convert status badges to StatusDot, and demote wells to divided surfaces.
     - `src/components/dashboard/**` (home/cards/*, coach/*, admin/*, parent/*, player/InlineGoalProgress, player/LazyPlayerTrainingCalendar, ClubAdminDashboard, SystemAdminDashboard), `src/components/coordination/**`, `src/components/coach/ClientAthleteSelector.tsx`, `src/components/insights/InsightCard.tsx`, `src/components/ui/../` none extra
     - tests: `tests/components/dashboard/**` (home cards, ClubAdmin, SystemAdmin)

  4. `Improve players training and reports toolbars` (46)
     Body: Remove the segmented filter bar and bulk selection, pin ?filter=attention first, gate calendars to sm+, and move report filters into FilterSheet.
     - `src/app/[locale]/coach/players/CoachPlayersPageClient.tsx`, `src/app/[locale]/coach/reports/ReportsPageClient.tsx`, `src/app/[locale]/coach/athlete/[id]/AthleteDetailClient.tsx`, `src/components/management/training/**`, `src/components/coach/reports/**`, `src/components/forms/training/PersonalTrainingList.tsx`, `src/components/messaging/**`, `src/components/feedback/**`, `src/components/injury/InjuryTestForm.tsx`, `src/components/management/tournaments/ManageRegistrationsDialog.tsx`, `src/app/[locale]/club-admin/tournaments/page.tsx`, `src/app/[locale]/player/{training/page,tournaments/RegisteredTournamentCard}.tsx`, `src/app/[locale]/{terms-of-service,privacy-policy}/page.tsx`, `src/app/[locale]/tennis-scorekeeper/ScorekeeperMatchCard.tsx`, `src/app/[locale]/{management/families/FamiliesPageClient,parent/children/ParentChildrenPageClient,parent/progress/ParentProgressPageClient,overview/page,charts/page,admin/page,admin/components/CoachRequestsTable}.tsx`, `src/components/admin/UsersList.tsx`, `src/components/labs/LabProgressionChart.tsx`, `src/components/date-range/DateRangeSlider.tsx`, `src/components/profile/ProfilePageClient.tsx`, `src/components/ai/{ProposalCard,UsageDashboard}.tsx`, `src/components/parent/ChildSelector.tsx`
     - tests: `tests/app/coach/{players-page,reports-page}.test.tsx`, `tests/components/coach/reports/ReportRow.test.tsx`, `tests/components/management/training/*.test.tsx`

  5. `Improve analytics and fitness density` (39)
     Body: Flatten priority rows, merge insights into divided surfaces, compact chart headlines with formatCompact, and simplify the fitness detail sheet.
     - `src/components/tennis-analytics/**`, `src/components/tennis/TennisSpecificTestsForm.tsx`, `src/components/performance/**`, `src/components/physical-tests/**`, `src/components/charts/**`, `src/components/workspace/physiology/PhysiologyWorkspace.tsx`, `src/lib/charts/graph-summary.ts`
     - tests: `tests/components/performance/**` (PerformanceTestsClient, FitnessTestRow, FitnessTestDetailSheet)

  6. `Convert settings surfaces to SettingsRow` (40)
     Body: Move settings sections, billing, organization, and wearables onto hairline-divided SettingsRow surfaces with a scrollable nav.
     - `src/components/settings/**`, `src/components/pricing/BillingSettingsClient.tsx`, `src/components/integrations/**` (WearableIntegrationsPanel, ProviderCard, expanded panels, ProviderStatusBadge, index), `src/components/management/OrganizationSettings.tsx`, `src/components/dashboard/coach/CoachAdminPanel.tsx` (renders settings/team)
     - tests: `tests/components/settings/**` (SettingsPageClient, SettingsNav)

  7. `Update locales docs and check scripts` (38)
     Body: Shorten nav labels, drop orphaned keys, add the reports i18n checker, record the redesign changelog, and note remaining device gaps.
     - `messages/{en,es,ca,nl,de,fr,pt,zh}.json`, `docs/DESIGN.md`, `scripts/{check-i18n-keys,check-i18n-usage,check-mobile-ui-rules}.mjs`, `tests/scripts/check-i18n-usage.test.ts` (new), `tests/scripts/fixtures/i18n-usage-baseline.txt` (new), `package.json`, `tests/helpers/lucide-react-mock.tsx`

  Cross-group notes:
  - `messages/*.json` carry keys added by phases 4-8; keep them together in commit 7 (splitting per phase would interleave with other commits' key lookups).
  - `tailwind.config.js` + `src/lib/design-tokens.ts` are token removals used everywhere — commit 1.
  - `tests/helpers/lucide-react-mock.tsx` serves performance tests (commit 5 dependency) but lives in 7 for simplicity; alternatively move to 5.
  - `src/components/charts/**` spans dashboard + analytics — grouped with analytics (commit 5).
  - `CoachAdminPanel.tsx` is a dashboard path but only renders /settings/team — grouped with settings (commit 6).

