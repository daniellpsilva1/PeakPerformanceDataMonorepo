# UI Redesign — 100-Task Implementation Plan

App: `PeakPerformanceData/peak_performance_data`. Evidence: `_plans/ui-redesign-findings.md` (F§N). Authority: `docs/DESIGN.md`. Guard: `scripts/check-mobile-ui-rules.mjs`.
Supersedes the open items of `_plans/ui-redesign-tasks.md` (old T-ids in brackets). Shell batch (old T040–T070) is already in the working tree, uncommitted.

Rules per task: one focused change; adjust narrowest tests; run lint + cited tests; alphabetical imports/props/vars (lint-enforced); no commits without owner approval.
`(V)` = cause unverified; do the verification before the fix.

## Already done (uncommitted, not part of the 100)
Splash/manifest/theme-color navy, icon plate navy + version bump, staging host as default brand, EnvironmentBadge inline, theme toggle moved to account menu <sm, AI env blank = enabled, coach bottom nav = Home/Training/Physio/Tennis + center orb, no icon pill, sidebar lists all pages at 216px, 8-locale `physioShort`/`tennisShort`.

## A. Verify & baseline
- [ ] 1  Capture "before" screenshots (320/390/768/1280) of all in-scope pages to `artifacts/ui-redesign/before/` [T001] (needs device capture)
- [ ] 2  (V) Check staging build gets `NEXT_PUBLIC_ENABLE_AI_VOICE_ASSISTANT` (`deploy.yml:83`, `Dockerfile:44`); owner approves setting it explicitly [T002,T057] (needs owner approval)
- [ ] 3  (V) Confirm staging host no longer resolves an academy brand after the default-domain fix [T003] (needs staging)
- [ ] 4  (V) Reproduce blue strip under bottom nav on iOS/Android PWA vs browser; name the real cause [T004] (needs device/staging repro)
- [x] 5  Fix blue strip: `viewport-fit=cover`, html/body bg navy, nav `pb-safe` painted `bg-background` [T048]
- [x] 6  Decide/remove dark body gradient reaching the bottom edge (`theme-css.ts:436`) [T049]
- [ ] 7  (V) Reproduce missing reports translations on staging; record keys + build SHA [T005] (needs staging repro)
- [x] 8  Record lint / mobile-rules / vitest baseline [T006]

## B. Design primitives
- [x] 9  `CardTitle` -> `text-section` [T010]
- [x] 10 Card header/content padding `p-3 sm:p-4` [T011]
- [x] 11 `Input` `h-10 md:h-9`, keep 16px font [T012]
- [x] 12 `Select` trigger/items same sizing [T013]
- [x] 13 `Button` size audit (`sm` no `min-h-11`) [T014]
- [x] 14 Badge `status-dot` helper [T015]
- [x] 15 Badge variant usage audit + deprecate unused [T016]
- [x] 16 Migrate subtle/purple/orange badges: coach pages [T017]
- [x] 17 Migrate badges: tennis-analytics, charts, performance [T018]
- [x] 18 Remove deprecated badge variants [T019]
- [x] 19 `Banner` single-row layout [T020]
- [x] 20 `Tabs` scroll fade, no last-tab clipping [T021]
- [x] 21 `Sheet`/`ResponsiveDialog` compact header + sticky safe-area footer [T022]
- [x] 22 `FormSection` `space-y-2`, optional hidden heading [T023]
- [x] 23 New `SettingsRow`/`SettingsGroup` primitive [T024]
- [x] 24 Retire `ModernFormSection` wells [T025]
- [x] 25 `design-tokens.ts` collapse surface aliases to two [T026]
- [x] 26 Remove `statCardAccents` icon tiles [T027]
- [x] 27 Delete dead gradient tokens in `tailwind.config.js` [T028]
- [x] 28 Codify radii/border/shadow tokens in `DESIGN.md` [T029]
- [x] 29 Extend `check-mobile-ui-rules.mjs` (off-scale CardTitle, settings inputs `min-h-11`) [T030]
- [x] 30 Update primitive tests (card, badge, banner, input, select) [T031]

## C. Shell follow-ups
- [x] 31 Device-check 4 tabs + orb at 320px (no truncation) and the active state
- [x] 32 Ensure Players and Messages stay reachable for coaches (sidebar, mobile menu, overview shortcuts) now that they left the bottom nav
- [x] 33 Mobile menu/sheet page list matches sidebar list
- [x] 34 Sidebar 72px rail: tooltips + group-header behavior
- [x] 35 Navbar overlap test at 320/360/390 (badge, search, bell, avatar) [T055]

## D. Overview
- [x] 36 `FitnessTestSnapshotCard`: single-line `label value` rows, `whitespace-nowrap` (fix "Enduranc e") [T080]
- [x] 37 Snapshot: smaller ring, drop "vs personal best" subtitle [T081]
- [x] 38 `RecentActivityCard`: one muted stats line [T082]
- [x] 39 `SquadStatusStrip`: hairline-divided strip [T083]
- [x] 40 `AttentionListCard`: dot + text status [T084]
- [x] 41 `TodaysCourtCard`: one-line empty state + text action [T085]
- [x] 42 `CoachHome` order (Attention, Today, Fitness, Activity) + `FocusedAthletePanel` alignment [T086,T087]
- [x] 43 Tests: CoachHome, snapshot card, FocusedAthletePanel, CoachDashboard [T088]

## E. Players
- [x] 44 Remove `SegmentedControl` filter; keep `?filter=` param as sort/pin [T090]
- [x] 45 Remove row selection + bulk bar [T091]
- [x] 46 Row simplification (no HeartPulse, plain readiness number, dot status) [T092]
- [x] 47 Search-only toolbar + `players-page.test.tsx` [T093,T094]

## F. Training
- [x] 48 Mobile chrome one row (search + filter sheet button) [T095]
- [x] 49 Hide list/calendar toggle <md [T096]
- [x] 50 Week strip -> compact day chips [T097]
- [x] 51 Two-line session rows, dot status, kebab only [T098]
- [x] 52 Shorter tab labels, drop duplicate subtitle [T099]
- [x] 53 `TrainingSessionForm` single column, date+time one row [T100]
- [x] 54 Form sheet sticky footer w/ safe area [T101]
- [x] 55 Apply row/toolbar pattern to Plans, Reports, Courts [T102]
- [x] 56 Training tests [T103]

## G. Messages
- [x] 57 `NotificationPermissionBanner` single-row (needs #19) [T104]
- [x] 58 `MessagingView` margins around banner 320–768 [T105]

## H. Reports
- [x] 59 Fix confirmed translation cause; add CI script comparing `t()` keys vs `messages/*.json` [T106]
- [x] 60 `ReportRow`: no icon tile, plain type, localized unknown-status fallback [T107]
- [x] 61 Header/filter: search + type filter in `FilterSheet` [T108]
- [x] 62 `AddReportDialog`/`TrainingReportForm` compact [T109]
- [x] 63 Same cleanup for `coach/training/reports` and `management/reports` [T110]
- [x] 64 Reports tests [T111]

## I. Terms / Privacy
- [x] 65 Terms of service: tight padding, `text-title`, anchors, no decorative icon [T112]
- [x] 66 Privacy policy same (+ optional sticky section nav lg+) [T113]

## J. Analytics
- [x] 67 `PriorityCard` -> flat row, cap top 3 [T120]
- [x] 68 Remove `text-4xl` numeral + `statusWash` [T121]
- [x] 69 Merge 8 `SectionCard`s into 3–4 divided surfaces [T122]
- [x] 70 Per-section: one chart + one stat strip [T123]
- [x] 71 Collapse secondary insights behind "More insights" [T124]
- [x] 72 `TrendChart` headline scaled by metric, compact counts [T125]
- [x] 73 `GraphContainerRecharts` chips -> one muted summary line [T126]
- [x] 74 Unify `formatCompact` across Steps/Calories/Duration/Intensity [T127]
- [x] 75 Physiology page header/tabs spacing, no wells [T128]
- [x] 76 Analytics tests [T129]

## K. Fitness tests
- [x] 77 `FitnessRadarChart` centered score, `text-meta` labels [T130]
- [x] 78 `FitnessSummaryRow`: `label — bar — score — delta`, no icons [T131]
- [x] 79 `FitnessTestsSection`: remove `SECTION_ICONS` [T132]
- [x] 80 `FitnessTestRow` spacing/typography [T133]
- [x] 81 `FitnessTestDetailSheet`: hero score + sparkline + benchmark + history [T134]
- [x] 82 Move peer distribution/raw history into detail sheet [T135]
- [x] 83 Delete "Physical Test Analysis" / "Tennis Specific Tests" groups [T136]
- [x] 84 Remove dead components/lazy imports after reference check [T137]
- [x] 85 Verify `?test=`/`?category=` deep links [T138]
- [x] 86 Fitness tests tests [T139]

## L. Settings
- [x] 87 `SettingsPageClient` -> `SettingsGroup` rows [T140]
- [x] 88 `ProfileEditor` + `AccountLinking` compact [T141,T142]
- [x] 89 Team + organization settings compact [T143,T144]
- [x] 90 Billing compact [T145]
- [x] 91 Wearables / garmin-connect rows [T146]
- [x] 92 `SettingsNav` scrollable, shorter labels [T147]
- [x] 93 Danger zone single row [T148]
- [x] 94 Settings tests [T149]

## M. Finish
- [x] 95  Message keys for all new/renamed labels in 8 locales (en es ca nl de fr pt zh) [T150]
- [x] 96  Remove orphaned keys; run locale key-parity check [T151,T152]
- [x] 97  Touch targets >=44px, muted-text contrast on navy, reduced-motion/focus-visible [T153–T155]
- [x] 98  Full QA 320/360/390/768/1280, capture `after/` screenshots [T156]
- [x] 99  Full lint, typecheck, mobile-rules, vitest for touched areas [T157]
- [x] 100 Update `DESIGN.md`, `docs/audits/remediation-backlog.md`; commit plan per phase, await owner approval [T158,T159]
