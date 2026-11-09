# UI Redesign — Findings

Read-only investigation of `PeakPerformanceData/peak_performance_data` (Next.js 15.5, App Router under `src/app/[locale]`, next-intl v4, pnpm). Local HEAD = `f8b83160` = `origin/staging` (2026-11-01).

Design authority: `docs/DESIGN.md` (PPD-APP-DESIGN-SYSTEM, accepted 2026-11-01) — mobile-first, "borders over shadows", one accent moment per screen, hairline `border-border/60` surfaces, product type scale (`text-title/section/body/meta/label/metric/metric-hero`), banned patterns enforced by `scripts/check-mobile-ui-rules.mjs` (gradients, icon tiles, uppercase labels, card shadows, hover motion, text ≤11px). `docs/design-system.md` is superseded.

Every area below: **files/lines responsible → root cause → proposed fix → files touched + tests**.

---

## 1. Staging splash / launch screen & logo

**Complaint:** splash should be fully dark-blue around the logo; currently a white/light blue-grey backdrop around a dark rounded icon square with a white circle logo.

### Files responsible

- `src/app/[locale]/layout.tsx`
  - `resolveSplashLogo` :246-269; `getSplashScreens` :271-353 — emits `apple-touch-startup-image` links.
  - Call site :659-676 (gated on iOS UA via `shouldRenderIosSplashScreens` :505).
  - Brand chrome resolution :552-566 (`resolveBrandChrome`, `useSymbolChrome`, `themeHexClean`).
  - `<meta name="theme-color">` :613,618-620 — symbolUrl brands emit **brand primary** (#2557e6-ish) for both schemes; `msapplication-TileColor` :613 same.
  - `viewport` export :436-448 — `themeColor: '#0d1726'` fallback, `viewportFit: 'cover'`.
  - Cold-start `html,body` background :632-646 (`appLightBgHsl`/`appDarkBgHsl`).
- `src/app/api/splash/route.tsx` — dynamic ImageResponse; `bg` full-bleed :93, rounded **tile** plate :100-119 (`tile` param, `tileSize` :80).
- `src/app/api/manifest/route.ts` — `background_color` :75 (`useSymbolChrome ? themeHex : neutralHex`), `theme_color` :94, icon set :97-126 (static `/icons/icon-*.png` when `symbolUrl`, else `/api/pwa-icon` composite on `iconBgHex` :65).
- `src/lib/branding/theme-css.ts` — `resolveBrandChrome` :364-413 (`backgroundHex`/`darkBackgroundHex`/`neutralHex` ≈ hsl(221,20%,55%) — the "light blue-grey"), `isDarkBackground` :342.
- `src/lib/seo/brand-assets.ts` — `buildPwaIconUrl` :37-44, `buildTabIconUrl` :52-69, `ASSET_VERSION`/`LOGO_VERSION='10'` :11-12.
- `src/config/brands/default.ts` — background `217 50% 10%` (dark navy `#0d1726`), primary `221.2 83.2% 53.3%` (bright blue), `assets.symbolUrl: '/peak-symbol-white.png'`.
- `scripts/generate-brand-icons.mjs` — generates `public/icons/icon-*.png`, `apple-touch-icon*.png`, `favicon-*.png` on a **primary-blue** plate.
- Brand resolution: `src/middleware/brand.ts` `shouldSkipDbLookup` :113-118; `src/services/brand-service.ts` `KNOWN_DEFAULT_DOMAINS` :46; `getBrandByDomain` :128-163; `setMiddlewareBrandHeader` compact brand :85-93.
- Deploy/config: `Dockerfile:44-45` (build args), `.github/workflows/deploy.yml:81-84` (`NEXT_PUBLIC_ENV=staging` for staging branch).

### Root cause

Two mechanisms produce the reported look:

1. **Current code path for non-`symbolUrl` brands** (academies): `getSplashScreens` per-scheme branch layout.tsx:314-333 — light-scheme devices get `bg=appLightBgHex` (#fcfcfc white) + `tile=darkBackgroundHex` (navy rounded square) + light logo inside → **exactly** "white/light blue-grey backdrop, dark rounded icon square, white circle logo". Manifest `background_color` = `neutralHex` (light blue-grey) + `/api/pwa-icon` dark plate gives the same look on Android/Chrome splash & install surfaces.
2. **Stale pre-2026-11-01 assets/manifest on an installed PWA.** The `symbolUrl` "one solid-brand look" only landed in `eb921856` (2026-11-01). A PWA installed earlier cached `background_color: neutralHex` + dark-plate icons.

Compounding risk: **`staging.peakperformancedata.app` is absent from both `KNOWN_DEFAULT_DOMAINS` (brand-service.ts:46) and middleware `shouldSkipDbLookup` (brand.ts:113-118).** If an `organizations` row carries that domain (or a test org), the staging site resolves an *academy* brand with no `symbolUrl` → path 1 above, plus `useSymbolChrome=false` → neutral manifest bg + dark-plate dynamic icons.

Note: the *current* default-brand look is **bright primary blue**, not dark navy. The request ("fully dark-blue") needs `brandChrome.backgroundHex`/`darkBackgroundHex` (#0d1726) as the single launch surface instead of `themeHex`.

### Proposed fix

- Make the single launch surface the **dark navy brand background** (`brandChrome.backgroundHex`, `#0d1726`) for `symbolUrl` brands: splash `bg=` (layout.tsx:296-302), manifest `background_color`+`theme_color` (manifest route :75,94), `msapplication-TileColor` + `theme-color` metas (layout.tsx:613,618-620). Regenerate `public/icons/*` on navy via `scripts/generate-brand-icons.mjs` (reads primary from `default.ts` — parametrize or point at background).
- For non-symbolUrl brands, drop the opposite-scheme tile variant (layout.tsx:319-333 `needsTile`/`tileQuery`) — always emit the brand background; or keep tile only when `!isDarkBackground`.
- Add `staging.peakperformancedata.app` to `KNOWN_DEFAULT_DOMAINS` (brand-service.ts:46) and middleware `shouldSkipDbLookup` (brand.ts:113-118) so staging never resolves an org brand by accident.
- Bump `LOGO_VERSION`/`ICON_VERSION` (brand-assets.ts:11, manifest route:16) so installed PWAs refetch.
- Tests: `tests/app/seo-metadata.test.ts`, `tests/app/layout-cold-start.test.tsx`, `tests/lib/branding/theme-css.test.ts`.

---

## 2. Overview / home (coach dashboard)

**Complaint:** cleaner, better data, fewer heavy cards. Includes "Fitness test snapshot" card (label wrapping `Endurance`→`Enduranc e`, ring chart), "Today's court assignment", "Recent activity".

### Files responsible

- Route `src/app/[locale]/coach/page.tsx` → `CoachDashboardLoader` → `CoachHome` `src/components/dashboard/home/CoachHome.tsx:218-309` — order: `CoachHeader` (:221-226) → `SquadStatusStrip` (:228-240) → `AttentionListCard` (:249-257) → `TodaysCourtCard` (:258-260) → `FitnessTestSnapshotCard` (mobile only, :272-281) → `RecentActivityCard` (:261-267) → `PendingRequestsCard` (:292).
- `cards/CoachHeader.tsx` (89) — greeting + nextAction + `CoachQuickActions` slot.
- `cards/SquadStatusStrip.tsx` — tappable tiles :139-157, wearable nudge well :226-247, degraded retry card :171-180.
- `cards/AttentionListCard.tsx` — rows :44-92 (avatar + reason + injury/recovery badges).
- `src/components/coordination/TodaysCourtCard.tsx` — SWR `/api/court-plan/me` :51-60, skeleton :62-69, assignment rows ~:110-156.
- `cards/FitnessTestSnapshotCard.tsx` — header link :182-203, hero `ScoreRing`+big number+level+percentile :205-236, **category chip grid** :243-273 (`grid grid-cols-3` + icon + `break-words text-meta` label :252-256 → "Enduranc e"), movers DeltaChips :275-280. `ScoreRing` = `src/components/performance/fitness/ScoreRing.tsx` (89).
- `cards/RecentActivityCard.tsx:14-77` — three muted count tiles (`bg-muted/40 p-3` + `text-2xl` count + icon + label).
- `cards/FocusedAthletePanel.tsx` (302) — desktop right column incl. embedded fitness snapshot.
- `cards/PendingRequestsCard.tsx`, `cards/StreakWidget.tsx`, `primitives/HeroRingTrio.tsx`, `ReadinessHero.tsx`, `CompactReadiness.tsx`.
- Player/parent variants: `PlayerHome.tsx`, `ParentHome.tsx`, `TodayStripCard.tsx`.

### Root cause

- "Enduranc e": the 3-col chip grid gives each cell ~100px; `icon (14px) + gap + break-words` forces mid-word wrap of "Endurance"/"Flexibility" (`text-meta` + `leading-tight`, :252-256).
- Heaviness: every block is a `surfaces.productCard` (`bg-card rounded-lg border`) with own padding — six stacked cards plus inner wells (`bg-muted/40` tiles in RecentActivity, nudge well in SquadStatusStrip, chip grid in snapshot) = card-in-card density.

### Proposed fix

- Snapshot card: drop the 6-cell icon grid; render categories as one wrap row of `label value` chips (`text-sm` + level dot, `whitespace-nowrap`) or a 6-bar inline strip; keep `ScoreRing`+score+delta.
- Merge `RecentActivityCard` into a single muted stats line (like Reports' stats line, `ReportsPageClient:388-401`) or the MetricStrip pattern — kill the 3 boxed tiles.
- `AttentionListCard` rows already follow the two-line pattern; demote injury/recovery `Badge`s to dot+text in line 2 per DESIGN.md.
- SquadStatusStrip: replace per-tile boxed tiles with a hairline-divided strip (MetricStrip semantics).
- Tests: `tests/components/dashboard/home/CoachHome.test.tsx`, `FitnessTestSnapshotCard.test.tsx`, `FocusedAthletePanel.test.tsx`, `tests/components/dashboard/CoachDashboard.test.tsx`, `tests/app/coach-loading.test.tsx`.

---

## 3. Top NavBar overlap with STAGING badge

**Complaint:** logo, hamburger, search icon overlapped by env badge ("QA"/"STA"), bell, theme, avatar crowding.

### Files responsible

- `src/components/ui/NavBar.tsx` — `<header fixed top-0 z-40>` :122-142; `<nav className="container relative ...">` :143; `EnvironmentBadge` at :144; left cluster `BrandLogo`+`LazySidebarMobile` :145-165; right cluster `CommandPaletteTrigger` :172-174, `LazyVoiceAssistantButton` (hidden md) :183-185, `LazyAlertsDropdown` :188-203, `ThemeToggle` :209, `LazyAccountMenu` :211-215.
- `src/components/layouts/EnvironmentBadge.tsx:6-22` — `absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2`, `pointer-events-none`, `STA` (3-letter) <sm / full env ≥sm.
- `src/components/navigation/CommandPaletteTrigger.tsx:43-48` — `min-h-11 min-w-11` Search icon button.

### Root cause

The badge is **absolutely centered over the entire nav bar**. On ≤400px screens the left cluster (logo+hamburger ≈90px) and right cluster (search+bell+theme+avatar ≈4×44px+gaps ≈180px) meet at center → the centered chip sits on top of the search icon/bell. It is only "non-overlapping" because `pointer-events-none` lets clicks through; visually it collides.

### Proposed fix

- Take the badge out of the center: render it inline beside the `BrandLogo` (left cluster, `hidden sm:` tag) or as a tiny corner ribbon on the avatar/theme area; alternatively a 2px top strip under the header.
- Trim the mobile cluster: keep search, bell, avatar; the `ThemeToggle` is on every viewport per the 2026-11-01 correction (NavBar.tsx:205-209) — reconsider if space is still tight (move to account menu).
- Tests: `tests/navigation/shell-responsive.test.tsx` (badge compaction contract), `tests/app/layout-cold-start.test.tsx`.

---

## 4. Mobile bottom bar — AI orb missing, tab set, blue strip

**Complaint:** AI assistant orb must be centered in the footer as a blue ball (was there ~2-3 months ago). Tabs should be Home, Training, [orb], Physiology, Tennis Analytics (now Home, Players, Training, Messages). A blue strip is visible below the bar.

### Files responsible

- `src/components/navigation/BottomNav.tsx` — `navItems` by role :174-217 (coach = `/coach`,`/coach/players`,`/coach/training`,`/coach/messages` :187-192); `assistantEnabled = isVoiceAssistantEnvEnabled() && hasFeature('ai')` :227; `hasCenterSlot`/left/right slicing :228-234; spacer `w-16` :330; **orb markup** :363-380 (`fab.assistant` + `ring-4 ring-background`, `Bot` icon, anchored `absolute left-1/2 top-0 -translate-y-1/2`); `pb-safe` + `safe-area-inset-x` on `<nav>` :303-307.
- `src/lib/ai/assistant-state.ts:18-22` — `isVoiceAssistantEnvEnabled()`: `undefined`→true, `'true'/'1'`→true, **anything else incl. `''`→false**.
- `src/hooks/useFeatureGate.ts` — `hasFeature('ai')`: returns true unless `features.ai === false` (brand features absent → true).
- `src/components/ai/AssistantFab.tsx` — desktop-only entry (`hidden md:flex`, :105).
- `src/lib/design-tokens.ts:126-128` — `fab.assistant` = `w-14 h-14 rounded-full bg-assistant text-white …` (the "blue ball").
- Nav `pb-safe`/`--bottom-nav-*` vars: `src/app/globals.css:185-246` (`--bottom-nav-height:3.5rem`, `--bottom-nav-safe-area:max(1rem,env(safe-area-inset-bottom))`, `pb-safe` :986-988).
- `viewportFit:'cover'` layout.tsx:446; `appleWebApp.statusBarStyle:'black-translucent'` :412; manifest `background_color`/`theme_color` (manifest route :75,94).

### Root cause — missing orb

The center-orb code **already exists at HEAD** (BottomNav.tsx:363-380) but is gated on `assistantEnabled`. The observed 4-tab bar (Home/Players/Training/Messages = `navItems.slice` with no center slot) means `assistantEnabled === false` on the user's build:

- `NEXT_PUBLIC_ENABLE_AI_VOICE_ASSISTANT` is a **build arg** (`.github/workflows/deploy.yml:83` ← GH var; `Dockerfile:44`). If the GH var is unset, the ARG arrives as `''` → `isVoiceAssistantEnvEnabled()` returns **false** (empty string is not `undefined`). `.env.example:19` documents `=true`. **Fix candidate #1: treat `''` as unset (default-enabled) in assistant-state.ts:18-22, and set the var explicitly in deploy config.**
- `hasFeature('ai')` can only be false if the resolved brand sets `features.ai === false` (relevant only if staging resolves an org brand — see Area 1; compact middleware brand drops `features` → true).

### Git history — how the orb was rendered

- `208615bd` (2026-09-01, "Fix coach UX freeze, voice assistant, and messaging reads") — **center `AIAssistantFAB` for org modes**: `AIAssistantFAB` memo (fab.base + `Bot` h-6), layout `2 left / w-14 spacer / 2 right`, `absolute left-1/2 top-0 -translate-x-1/2 -translate-y-1/2`. This is the version the user remembers (~2-3 months ago).
- `cea02d22` (2026-09-24, "Update navigation IA for all roles") — **removed** the org center FAB ("assistant opens via the NavBar icon / mobile sheet menu (M-NAV-01)").
- `8b1b8a6a` (2026-10-02, "Add blue floating assistant and simplify bottom nav") — floating `AssistantFab` all viewports.
- `3538cf08` + `0f110086` (2026-10-30) — restored the raised **in-bar** centre assistant button (current code), `eb921856` (2026-11-01) refined. Restore = keep current :363-380 markup; fix the gating, not the renderer.

### Required tab change

Coach `navItems` (BottomNav.tsx:187-192) → `[ {/coach, Home}, {/coach/training, Training}, {/charts, Physiology}, {/coach/tennis-analytics, Tennis Analytics} ]`; existing slice logic (:229-234) then yields Home/Training left, Physiology/Tennis right. `navigation.physiology` and `navigation.tennisVision` keys already exist in all locale files. Players/Messages stay reachable via drawer+sidebar.

### Blue strip below the bar — candidates (ranked)

1. **iOS standalone bottom bezel** painted from `theme-color`/manifest `background_color` — currently bright **primary blue** for `symbolUrl` brands (manifest:75,94; layout :618-620). When the webview's painted area doesn't reach the home-indicator region, iOS fills it with the theme color → bright blue strip. Setting the launch surface to dark navy (Area 1 fix) resolves the colour; also verify `viewport-fit=cover` actually emits on the PWA start route.
2. **`html,body` background** (inline CSS, layout.tsx:634-637): dark-scheme devices paint `hsl(217 50% 10%)` navy; if the fixed `<nav>`'s `pb-safe` fails (e.g. `env()` = 0 because a route bypasses the locale layout's `viewportFit:'cover'` — the comment at :439-440 admits it's a fallback only), a navy band shows below the bar.
3. Dark-mode `body` radial-gradient background (`theme-css.ts:436-437`) + overscroll rubber-banding.
- Proposed: align launch surface to navy (Area 1); ensure every route inherits `viewportFit:'cover'`; keep `pb-safe` on the nav (already ≥1rem painted) and `bg-background` consistent.

Tests: `tests/navigation/BottomNav.test.tsx`, `tests/navigation/shell-responsive.test.tsx`, `tests/components/ai/AssistantFab.test.tsx`, `tests/navigation/VoiceAssistantButton.test.tsx`.

---

## 5. Desktop/tablet sidebar

**Complaint:** asked for narrower; a previous change hid pages (only one extra item visible). Requirement: ALL pages listed, narrower horizontally only, language switcher etc. stay at bottom.

### Files responsible

- `src/components/navigation/Sidebar/Sidebar.tsx:46-66` — `hidden md:block fixed z-50`; widths `isAutoWidth ? 'w-[72px] lg:w-[260px]' : isCollapsed ? 'w-[72px]' : 'w-[260px]'`.
- `SidebarNavigation.tsx:44-58` — **`hasMoreGroup`**: when ≥2 groups and expanded, all non-primary groups collapse under a "More" `Collapsible` (:100-121, auto-expands only when a child is active :55-57). Comment :46-49 dates it **2026-11-01 (`eb921856`)** — the regression.
- `navigationItems.tsx` — coach gets `team` group (5 items :32-131) + `analysis` group (4 items :88-131) → analysis items (Tennis Analytics, Physiology, Performance Tests, Reports) hidden under "More".
- `SidebarContext.tsx` (auto-width/collapse, `SIDEBAR_PREF_COOKIE`), `SidebarHeader.tsx` (workspace mark+collapse), `SidebarFooter.tsx` (language etc.), `SidebarNavItem.tsx` (row, `min-h-11`), `SidebarMobile.tsx` (drawer).
- `AppShell.tsx` + `NavBar.tsx` mirror `md:left-[72px] lg:left-[260px]` offsets (NavBar.tsx:132-137) — any width change must update these.

### Root cause

"Narrower" was implemented by hiding secondary groups under a disclosure (`SidebarNavigation.tsx:50-58`), not by reducing width. With the rail collapsed (72px) all items show as icons; expanded shows only the primary group + a "More" row.

### Proposed fix

- Remove the `hasMoreGroup`/Collapsible for the expanded rail (keep group headers); or keep collapse only when groups ≥3.
- Narrow expanded width `260px → ~208–224px` (Sidebar.tsx:64-65 + the two offset mirrors: NavBar.tsx:133-137, AppShell `<main>` margins); tighter rows (36px at md+, `gap-2`, 18px icons per DESIGN.md shell contract).
- Keep `SidebarFooter` (language switcher etc.) at bottom untouched.
- Tests: `tests/navigation/Sidebar.test.tsx`, `SidebarMobile.test.tsx`, `tests/navigation/shell-responsive.test.tsx`.

---

## 6. Players page

**Complaint:** remove the 'All / Needs attention / Injured / No data' filter bar and row-selection checkboxes; cleaner list.

### Files responsible

- `src/app/[locale]/coach/players/CoachPlayersPageClient.tsx` (854)
  - Filter state `'all'|'attention'|'injured'|'no-data'` :187-196; URL sync :207-216; `clearFilters` :200-205.
  - `SegmentedControl` filter bar inside `Toolbar` :568-583 (`t('filter.all'/'attention'/'injured'/'no-data')`).
  - Filtering pipeline :263-320 (`needsCoachAttention`, `has_active_injury`, `has_real_data`).
  - **Selection**: `selectedRows` :177; `setAssistantFabSuppressed('coach-players-bulk-actions', …)` :218-223; bulk action bar :602-640 (`messageSelected`); `onSelectionChange={setSelectedRows}` :739; `rowActions` :740+.
  - Mobile card row :685-738 (avatar + status dot + name + meta + readiness pill + chevron).
- `src/components/ui/data-table.tsx` — `selectable` prop :100,169; checkbox column :204-228; mobile-card checkbox :488-495; row-selection sync :250-256.
- `src/lib/dashboard/coach-athlete-risk.ts` (`needsCoachAttention`).

### Root cause

Filter bar + selection are page-level features bolted onto `DataTable`; both render dense chrome on mobile. Note: `?filter=attention` deep-link (:190-196) is used by the dashboard attention card — keep parsing the param but it can map to a highlight/sort instead of a visible chip row.

### Proposed fix

- Drop the `SegmentedControl` (:572-583) — search-only `Toolbar`; surface "needs attention" as an inline sort/pinned section or a subtle stat link, not a chip bar.
- Remove `selectable`/`onSelectionChange`/bulk bar (:177,218-223,602-640,739) — per-row `rowActions` (view/note/message/remove) already covers actions; drop the checkbox column in `data-table.tsx` usage here (keep the prop — other pages may use it).
- Row = the existing two-line card (:685-738): avatar+dot, name, `dot status · meta`, readiness number inline (drop `HeartPulse` icon per "no icons in front of plain data").
- Tests: `tests/app/coach/players-page.test.tsx` (filter + selection coverage will need updates).

---

## 7. Training page

**Complaint:** hard to read, unintuitive on mobile — tabs, Add Session, search, filter, calendar/list toggle, week strip, and the Add New Training Session sheet form (too big, aggressive inputs).

### Files responsible

- `src/app/[locale]/coach/training/page.tsx:95-128` — `MetricStrip` + `TrainingTabs`; skeletons :43-68.
- `src/components/management/training/TrainingTabs.tsx:52-119` — Radix `Tabs` (group-schedule / individual-plans / reports / courts), lazy panels :15-40.
- `src/components/management/training/GroupTrainingSchedule.tsx` (1302)
  - Header + `Add Session` :560-566; view toggle list/calendar `viewMode` :226; `agendaRange day|week` :227-228; search+debounce :207-214; `levelFilter` :215; `FilterBar`/`FilterSheet` imports :16-17; **week strip** :493-506 (+week shift :546); date-grouped agenda :534-544; session table/rows + kebab dropdowns (imports :7-30, `MoreVertical`); add/edit `ResponsiveDialog` :1077+; view dialog :949-1074.
- `src/components/management/training/TrainingSessionForm.tsx` (235) — `FormSection` ×4 (`sectionDetails` :102-132, `sectionSchedule` :134-150 `FormRow cols={3}` date+2 times, `location` :152-190 CourtPicker+max participants, coach multi-select :192-216) + `playerAssignment` slot + `FormErrorSummary`/`FormActions`.
- `src/components/management/training/IndividualTrainingPlans.tsx` (871), `TrainingReports.tsx` (544), `TrainingCalendar.tsx` (423), `ManagePlayersDialog.tsx` (411), `PlayerAssignmentInput.tsx` (335), `src/components/coordination/CourtsBoard.tsx`.
- Shared: `src/components/mobile/ResponsiveDialog.tsx` (247), `src/components/ui/form/form-layout.tsx` (`FormSection`:19-38, `FormRow`:168), `field-shell.tsx`, `form-actions.tsx`, `fields/*`.
- Tests: `tests/components/management/training/GroupTrainingSchedule.test.tsx`, `IndividualTrainingPlans.test.tsx`, `TrainingTabs.test.tsx`, `tests/app/management/training/page.test.tsx`.

### Root cause

Mobile crams: MetricStrip + 4 tabs + search + status Select + FilterSheet + list/calendar toggle + day/week range + week strip + grouped rows — ~4 chrome rows before any data. The session form stacks 4 sections × h-11 inputs + multi-select + player assignment inside a near-full-height sheet ("aggressive" = tall inputs, boxed sections, big paddings).

### Proposed fix

- Mobile: one chrome row — search (icon-expand) + `FilterSheet` holding status/view/range; default agenda = today; week strip becomes a compact day-chip scroller; kill the list/calendar toggle on <md (calendar only on sm+ or inside the sheet).
- Tabs: already scrollable `TabsList` — shorten labels ("Schedule / Plans / Reports / Courts").
- Session rows: keep two-line pattern (time · court/coaches line, name+attendance); demote status `Badge` to dot.
- Form sheet: single-column, `space-y-3` sections (no section headings except Players), `FormRow cols={3}` → date+time on one row already — keep but tighten field spacing; sticky footer `FormActions` (`hideActions` + `formId` pattern exists, :36-55); `Input`/`Select` mobile `h-10` per DESIGN.md (currently `min-h-11 h-11`).
- Consider reusing the compact "rows-in-one-surface" list style (settings `divide-y` cards) for the form on mobile.

---

## 8. Reports page — i18n audit + row design + Terms

### Files responsible

- `src/app/[locale]/coach/reports/page.tsx` (+`layout.tsx` → `RouteMessagesProvider route="/coach/reports"`).
- `src/app/[locale]/coach/reports/ReportsPageClient.tsx` (551) — PageHeader :380-386, stats line :387-401, `Toolbar`+`SegmentedControl` (type filter :406-425)+`FilterSheet` (period/coach :432-485), `ReportRow` list, `AddReportDialog`/`ReportDetailDialog`/`EditReportDialog` :488-540.
- `src/components/coach/reports/ReportRow.tsx` — icon tile `ReportTypeIcon` + 2-line row + rating/`reviewStatus` badges + `MetaChip`s + kebab (~:60-160).
- `src/components/coach/reports/report-type.tsx` (118) — type→icon/colour map.
- `AddReportDialog.tsx` (222), `EditReportDialog.tsx` (191), `ReportDetailDialog.tsx` (229), `TrainingReportForm.tsx` (219 — sections basicInfo/reportContent/playerSelection, `TournamentPlayerSelector`).
- Other report surfaces: `src/app/[locale]/coach/training/reports/page.tsx` + `[id]/page.tsx` (`TrainingReports` + `reportView` ns), `src/app/[locale]/management/reports/page.tsx`, `management/training/reports/[id]/page.tsx` + `[id]/edit/page.tsx`, `src/components/management/training/TrainingReports.tsx` (544, `useTranslations('trainingReports')`).

### i18n audit result — **no missing keys at HEAD**

Method: extracted every `t('key')` bound to `useTranslations`/`getTranslations` namespaces across 15 reports files (112 static keys) + 7 management/training report files (83 static keys), resolved against `messages/{en,es,ca,nl,de,fr,pt,zh}.json`.

- Missing per locale: **en 0, es 0, ca 0, nl 0, de 0, fr 0, pt 0, zh 0** (dynamic prefixes verified: `coach.reports.trainingTypes.*` covers `REPORT_TYPES` = session/weekly/monthly/plan_progress + `unknown`, `detailDialog.reviewStatus.*` covers completed/draft/pending/reviewed/submitted, `distributionChart.typeLabels.*` mirrors trainingTypes; `trainingReports.trainingTypes.*` same).
- Namespace delivery verified: `src/i18n/route-namespaces.generated.ts` `'/coach/reports'` (:29) includes `coach`, `common`, `validation`, `tournaments`, `ui`, `apiErrors`, `coachDashboard`, `errorBoundary` + `SHELL_NAMESPACES` — covers every client `useTranslations` in the tree (incl. `tournaments.playerSelector` inside `AddReportDialog`). Nested providers **replace** messages (see `coach/layout.tsx` comment) so a missing list entry would render `namespace.key` fallbacks — that is the failure mode the user saw; the current map is correct.
- Fragility: the map is generated (`scripts/generate-route-namespaces.js`); `trainingReports`/`reportView` are absent from `/coach/reports` (unused there today). `ReportRow` falls back to the raw `reviewStatus` DB value for unmapped statuses (~:106-110) — English text leaks in any locale.
- Likely observed cause: a staging build predating key/provider-map updates, or a different "reports" surface (TrainingReports tab under `/coach/training`, which *is* covered). Recommend the audit script above as a CI check; there is also `I18N_AUDIT_REPORT.md` + `update-translations.js` at repo root.

### Row/list redesign

- `ReportRow` already follows the two-line pattern (title+rating/status badge; meta chips). Simplify: drop `ReportTypeIcon` tile (icon-in-front-of-data), keep a small glyph or plain type text; `Draft`/status → muted text or subtle badge `neutral`, not `*-subtle` coloured pills; keep kebab for view/edit/delete.
- Create-report flow (`AddReportDialog`+`TrainingReportForm`): reuse the compact form proposal from §7/§12.

### Terms page

- `src/app/[locale]/terms-of-service/page.tsx` (120) — plain prose `article` (`prose prose-neutral`, `max-w-3xl`, `py-12`), icon, `lastUpdated`, s1–s10 headings/lists. Already simple; to clean: tighten top padding on mobile, consistent `text-title` h1 + `scroll-mt` anchors, optional sticky section nav on lg+, same treatment for `privacy-policy/page.tsx`.

---

## 9. Messages page — "Enable notifications" control

**Complaint:** misaligned.

### Files responsible

- `src/components/messaging/MessagingView.tsx:488-489` — `<NotificationPermissionBanner className="mx-3 mt-2" />` inside the conversation column.
- `src/components/messaging/NotificationPermissionBanner.tsx:60-95` — `Banner` with `actions={<Button>Enable</Button>}`, `icon={Bell}`, `onDismiss` X.
- `src/components/ui/banner.tsx:29-61` — `flex flex-wrap items-start gap-2` <sm → icon+text on row 1, **Enable button + X wrap to row 2** (the misalignment); `text-caption` on mobile.

### Proposed fix

- Single-line banner: `Bell` 16px + one-line message + inline text action ("Enable" as `variant="link"`/`ghost` or small solid) + X — all `items-center`, no wrap (`flex-nowrap` w/ `truncate`, or let the message wrap to 2 lines max).
- Alternatively move opt-in into the conversation-list empty state / settings row (`NotificationToggle` exists at :98-155 for the settings surface).

---

## 10. Tennis analytics

**Complaint:** overall design liked; Insights tab cards too heavy/too much data; "Development priorities" too heavy; physiological stats → huge numbers in some charts.

### Files responsible

- `src/components/tennis-analytics/TennisAnalyticsContent.tsx` (1851) — list/upload/detail shell.
- `src/components/tennis-analytics/TennisAnalyticsDetail.tsx` — tab state :189 (`insights|match-stats|play-patterns|shot-stats`, default match-stats), tab defs :361-365, InsightsTab mount :548-560, chunk preload :486.
- `src/components/tennis-analytics/TennisAnalyticsInsightsTab.tsx` (1589)
  - **`PriorityCard`** :189-236 — rank chip + `statusWash` coloured panel + **`text-4xl`** current + progress bar w/ target tick + title/data/action/detail = the "heavy" priorities card. `RecommendationsPanel` :238-272 ("Development priorities" opener, :1041-1048).
  - **`SectionCard`** :275-281 (`surface-card p-5 sm:p-6`) × **8 sections** — comparison :1051-1148, serving :1152-1233, returns :1237-1288, groundstrokes :1292-1361, style :1364-1418, depthRally :1421-1489, breakPoints :1492-1519, rallyAndPoints :1522-1573.
  - `DeltaStat` :135, `StatStrip` :284, `MetricTile` :309, `statusBar/statusWash/statusText` :100-116, insight computation ~:329-1003.
  - Charts: `tennisAnalyticsCharts.tsx` (`RadialGauge`, `MiniDonut`, `ColoredBar`), `chart-hover.tsx`.
- Physiology ("Physiological performance" page = `/charts`):
  - `src/components/charts/ChartsContent.tsx` (1401) — metric tabs + `GraphContainerRecharts` panels (`ChartsContent:163-185` lazy map).
  - `src/components/charts/trend/TrendChart.tsx:214` — headline `text-metric lg:text-4xl` (32-36px) — fine for HR/HRV but absurd for **DailySteps (~12,847) / DailyCalories (~2,5xx kcal) / WorkoutDuration / IntensityMinutes**.
  - `src/components/charts/GarminConnectGraphs/GraphContainerRecharts.tsx` — insight chips `metric-value` :736-739, latest-value strip :1610 (`formatNumericValue`), per-metric files `DailySteps.tsx`, `DailyCalories.tsx`, `WeeklyWorkoutVolume.tsx`, `WorkoutCalories.tsx` etc.
  - `sections/*.ts` chart-group definitions.
- Tests: `tests/components/tennis-analytics/TennisAnalyticsContent.test.tsx`, `insights-metric-status.test.ts`.

### Proposed fix

- `PriorityCard` → flat list row: status dot + title + `current → target` inline (`text-sm tabular-nums`) + one-line action; kill the coloured `statusWash` panel, `text-4xl` numeral, and embedded progress bar (or keep a 4px underline bar). Cap at top-3.
- `SectionCard` ×8 → merge into 3-4 divided surfaces (hairline `divide-y` inside one card, or `inset` wells); keep one chart + one stat strip per section; drop `MetricTile` grid density.
- Charts: cap headline at `text-metric` (32) only for 0-100 scale metrics; for counts (steps/kcal/minutes) use compact `text-xl` + abbreviated units (e.g. `12.8k steps`); replace `metric-value` chip strip with a muted single-line summary.

---

## 11. Fitness tests (performance-tests)

**Complaint:** keep big radar on top (refine); refine per-category lines; test detail pages more refined; stop identical icons; remove duplicated "specific tests"/"physical test analysis" bottom sub-sections.

### Files responsible

- `src/app/[locale]/performance-tests/page.tsx` + `src/components/performance/PerformanceTestsClient.tsx` (411)
  - `FitnessSummaryRow` mount :317-325 (radar + category bar list).
  - `FitnessTestsSection` :330-339 (one card per metric group; rows open detail sheet; `?test=`/`?category=` deep links).
  - `BenchmarkContextBar` :343-352.
  - **`CollapsibleGroup` "Physical Test Analysis"** (`LazyPhysicalTestGraphs`) :358-379, `defaultOpen={false}`.
  - **`CollapsibleGroup` "Tennis Specific Tests"** (`LazyTennisSpecificTestsForm`) :393-408, `defaultOpen={false}`.
  - `CollapsibleGroup` impl :117-181 (`surfaces.raised` card + chevron toggle).
- `src/components/performance/FitnessSummaryRow.tsx` — `SUMMARY_CATEGORIES` :28, `FitnessRadarChart` import :6, category cards w/ bar+previous notch+delta+percentile (~:129-160+).
- `src/components/performance/fitness/FitnessRadarChart.tsx` (183) — current-vs-previous radar.
- `src/components/performance/fitness/FitnessTestsSection.tsx` — **`SECTION_ICONS` :51** (only `Dumbbell, Flame, StretchHorizontal, Timer` for all sections → identical icons), section headers :361-374, detail-sheet lazy mount :407-421, deep-link handling :231-268.
- `src/components/performance/fitness/FitnessTestRow.tsx` (320) — per-metric row (bar, score, delta).
- `src/components/performance/fitness/FitnessTestDetailSheet.tsx` (702) — detail sheet w/ recharts.
- `src/components/tennis/TennisSpecificTestsForm.tsx` (raw records table — bottom dup #1).
- `src/components/physical-tests/PhysicalTestGraphs.tsx` + `BenchmarkDistributionCard`, `CategoryTrendsCard`, `ImprovementHighlightsCard`, `MetricProgressChart`, `PersonalBestsCard`, `ProgressRadar`, `PhysicalProgressTimeline` — bottom dup #2.
- `src/components/performance/fitness/ScoreRing.tsx`.
- Tests: `tests/components/performance/PerformanceTestsClient.test.tsx`.

### Proposed fix

- Radar: keep at top; centre the overall score in the ring, shrink category axis labels to `text-meta`, legend inline.
- Category bars in `FitnessSummaryRow`: thin single-line rows `label — bar — score — delta` (they largely exist; tighten icons out, keep level dot).
- `FitnessTestsSection`: remove `SECTION_ICONS` (identical/repeated glyphs → no icons per "no icon tiles"); section headers = plain `text-section` + category score chip.
- `FitnessTestDetailSheet`: single-column, hero score + sparkline + benchmark line + history list; remove redundant stat tiles.
- Bottom sections: delete the two collapsed `CollapsibleGroup`s (:358-408) — move any unique content (peer distribution `BenchmarkDistributionCard`, raw record history) into the detail sheet / a "History" tab; the rest duplicates the top charts as the user noted.
- Tests: `PerformanceTestsClient.test.tsx` (asserts on the collapsible groups — needs updating).

---

## 12. Settings

**Complaint:** forms too big/aggressive on mobile (General, Team, Coach, Administration, Billing, Wearables…).

### Files responsible

- `src/app/[locale]/settings/layout.tsx` → `RouteMessagesProvider route="/settings"`; `src/components/settings/SettingsNav.tsx:21-31` — tabs: general, team (coach), organization (club_admin), billing, wearables.
- `src/app/[locale]/settings/page.tsx` → `src/components/settings/SettingsPageClient.tsx` (723) — sections `profile/account/preferences/devices/danger` :45-51; in-page scrollspy nav :89-110; toggle/input rows ~:540-719 (`divide-y divide-border rounded-lg border` pattern :630,687); components `ProfileEditor.tsx`, `AccountLinking.tsx`, `LanguageSwitcher`, `LogoutButton`, `Switch`, `Input`.
- Subpages: `settings/team/page.tsx`, `settings/organization/page.tsx`, `settings/billing/page.tsx`, `settings/wearables/page.tsx`, `settings/garmin-connect/page.tsx`.
- Shared form primitives:
  - `src/components/ui/form/form-layout.tsx` — `FormSection` :19-38 (`space-y-3 sm:space-y-4`, `text-section` heading), `FormRow` :161-175, `FilterBar` :54, `FilterSearch` :87-160.
  - `src/components/ui/modern-form-card.tsx` — `ModernFormCard`/`Header`/`Title`/`Section` :38-140 — `ModernFormSection` :98-120 = `rounded-lg bg-muted/50 p-4 sm:p-6 border border-border/50` (boxed wells = "aggressive").
  - `src/components/ui/input.tsx:17` — `min-h-11 h-11 md:h-9`, `text-base` mobile.
  - `src/components/ui/select.tsx:22` — `min-h-11 h-11 md:h-9`, `min-w-[7.5rem]`.
  - `src/components/ui/form/field-shell.tsx`, `form-actions.tsx`, `form-error-summary.tsx`, `combobox-field.tsx`, `fields/*`.
- Tests: `tests/components/settings/SettingsNav.test.tsx`, `SettingsPageClient.test.tsx`.

### Proposed fix — compact settings system

- Standardize "settings row": `label + caption` left, control right (`Switch`, inline `Select`/`Input` at `h-9`, `text-sm`) inside one `divide-y` surface — the pattern already used at :630/:687; apply it to ProfileEditor/AccountLinking/billing/wearables forms instead of stacked `FormSection`s.
- Retire `ModernFormSection` boxed wells (:98-120) or demote to `inset` only where grouping truly needed.
- Reduce vertical chrome: `FormSection space-y-3 sm:space-y-4 → space-y-2`; `FormRow` collapses to 1 col on mobile already — keep; `ModernFormHeader mb-8 → mb-4`.
- Mobile density: keep `h-10` controls under md (DESIGN.md) but remove the extra `min-h-11` floor on Inputs/Selects inside settings rows (they double the tap target through wrappers).

---

## 13. Global design system — primitives & tokens audit

### Files audited

- `tailwind.config.js` — `fontSize` :63-90, `boxShadow` :247-258, `backgroundImage` (dead gradient tokens) :259-281, `borderRadius` :282-286, easings :95-103.
- `src/app/globals.css` — `--radius:0.5rem` :12; light/dark surface vars :14-40,:74-127; shadows :280-285,:323-328; `--bottom-nav-*` :185-246; safe-area utils :959-995; `.surface-card` :633-641.
- `src/lib/design-tokens.ts` (846) — `fab` :126-138; `surfaces` :160-200 (`raised/raisedTight/well/raisedInteractive/productCard` = 4 names for the same card); `typography` (title/section/meta/label/metric/metricHero + deprecated eyebrow + legacy h1-h4/display1-2); `spacing`; `statusColors`; `chartSeries`; `levelColors`; `statCardAccents` (icon-tile factory — banned outside this file).
- `src/components/ui/card.tsx` — `cardVariants` :7-30 (default/interactive/inset; `border-border/60`); `CardHeader` :44-50 (`px-3 pt-3 sm:px-6 sm:pt-6`); `CardTitle` :56-62 (`text-base sm:text-lg` — **off the type scale**, should be `text-section`); `CardContent` :88-94.
- `src/components/ui/button.tsx` — variants :12-21; sizes :25-33 (`min-h-11 h-10 md:h-9`; `cta` :30).
- `src/components/ui/badge.tsx` — **20 variants** :10-55 (default/secondary/destructive/outline/success/info/warning + neutral/danger/brand + 4 *-subtle + purple/orange-subtle + win/loss/pending/clay/personal + 4 *-solid).
- `src/components/ui/input.tsx:17`, `select.tsx:22,83,128` (trigger h-11→md:h-9, popover `rounded-xl` + `--shadow-elev-md`, item h-11), `tabs.tsx:110-137` (underline tabs, h-11→md:h-9), `sheet.tsx:75-96` (bottom `rounded-t-2xl` + drag handle + `max-h-85dvh`), `dialog.tsx`, `banner.tsx:29-61`, `page-header.tsx`, `metric.tsx`/`metric-strip.tsx`, `segmented-control.tsx`, `data-table.tsx`.
- Legacy/unused-but-shipped: `modern-form-card.tsx`, `card-variants.tsx`, `action-card.tsx`, `loading-button.tsx`.

### What makes it look heavy / "AI-generated"

1. **Three overlapping type scales** — product (`text-title/section/meta/label/metric`), legacy (`display-hero/xl/lg`, `heading-1..3`, `body-sm`), workspace (`ws-*`); plus `CardTitle` and `ModernFormTitle` hardcoding `text-base sm:text-lg`/`text-2xl` off-scale.
2. **Too many badge variants** (20) → badge soup on every row.
3. **Icon tiles & glyphs everywhere** — `statCardAccents`, per-category icons in fitness cards, `ReportTypeIcon`, MetaChip icons.
4. **Card-in-card wells** — `bg-muted/50` inset sections inside `bg-card` borders (RecentActivity tiles, ModernFormSection, nudge wells).
5. **Dead tokens still shipped** — gradient `backgroundImage` set + `--shadow-card`/boxShadow scale (banned by lint for resting cards but still imported by legacy components → drift).
6. **Inconsistent radii** — `--radius` 8px cards / `rounded-xl` popovers+select content+sheet `rounded-t-2xl` / `rounded-lg` wells — acceptable but needs codifying; `rounded-xl`+`bg-card` is lint-banned yet `SelectContent` uses `rounded-xl` on `bg-popover` (fine, popover≠card — flag for reviewers).
7. **Density** — `min-h-11 h-11` floor on Inputs/Selects/Button sm while DESIGN.md says `h-10` <md — forms feel oversized on mobile.

### Proposed token set

- **Type (single scale):** title 22/28 (lg 24/32), section 15/22 600, body 14/20, meta 12/16 500 muted, label 12/16 500 muted, metric 32/36 (lg 36/40) condensed tabular, metric-hero 56 condensed. Deprecate `display-*/heading-*/ws-*` (workspace keeps its own opt-in `ws-*` but never on product surfaces); align `CardTitle`→`text-section`.
- **Surfaces (4):** canvas `bg-background`; surface `bg-card border-border/60 rounded-lg`; inset `bg-muted/60 rounded-lg border-transparent`; raised/overlay `bg-popover` + `--shadow-elev-sm/md` (menus, sheets). Remove `--shadow-card*` + `shadow-xs…2xl` from component classes.
- **Radius:** `--radius` 8 (cards), 6 (controls), 12 (dialogs/sheets/popovers), full (avatars/dots/counts only).
- **Badges (6):** neutral, outline, success, warning, danger, brand (+`pending` if needed). Migrate win/loss/personal/clay → semantic text colors or the 6.
- **Controls:** Input/Select/Button `h-10` <md, `h-9` md+ (remove `min-h-11` where a row already supplies a 44px hit target); icon buttons 36px visual + `after:` hit area (already in `button.tsx` icon size).
- **Icons:** 16px in content, 20px nav, 24px empty states; no tiles, none before plain data.
- **Spacing:** keep `spacing.page/cardPadding/sectionGap*`; drop ad-hoc `p-4 sm:p-6` inside shared primitives in favor of tokens.
- **Motion:** keep `transition-colors`/`opacity` 120-160ms `ease-decel`; keep `ease-spring` for taps only.
- Extend `scripts/check-mobile-ui-rules.mjs` rules for: badge-variant allowlist, `CardTitle` type scale, icon-tile imports, `min-h-11` on Inputs/Selects inside `divide-y` settings rows.

### Cross-cutting test files

`tests/scripts/check-ui-rules.test.ts`, `tests/lib/branding/theme-css.test.ts`, `tests/navigation/shell-responsive.test.tsx`, `tests/app/seo-metadata.test.ts`, `tests/app/layout-cold-start.test.tsx`, plus the per-area test files listed above. Lint gate = `pnpm lint` (includes the mobile-UI rules script); safe commands per AGENTS.md: `pnpm lint`, `pnpm typecheck`, `pnpm test` (not run — read-only task).

---

## Priority ordering suggestion

1. **Env/config quick wins:** `NEXT_PUBLIC_ENABLE_AI_VOICE_ASSISTANT` truthiness + staging brand domain skip (Areas 1, 4) — tiny diffs, big visible payoff.
2. **Shell:** EnvironmentBadge slot, sidebar de-collapse + narrowing, bottom-nav tab set + safe-area strip (Areas 3-5).
3. **Highest-traffic pages:** Coach home (2), Training (7), Players (6), Insights tab (10).
4. **System:** compact form system + token consolidation (12, 13) which the page redesigns then consume; reports/terms polish + i18n CI guard (8); messages banner (9); performance-tests dedup (11).
