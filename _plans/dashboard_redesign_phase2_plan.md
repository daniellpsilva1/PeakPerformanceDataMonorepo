# Dashboard Redesign Phase 2 — Application-Wide Design Improvement Plan

## Overview

This plan synthesizes findings from 25 audit subagents that examined every major
area of the Peak Performance Data application. The goal is to extend the design
system established in Phase 1 (ParentHome redesign) to the rest of the app in a
prioritized, low-risk way.

## Audit Summary

| Area | Key Issues | Severity |
|------|-----------|----------|
| ClubAdminDashboard | 10+ card monoculture, 6 ad-hoc empty states, colored left borders, 10 tabs | High |
| PlayerDashboard/PlayerHome | Flat stack, 5 legacy cards, hardcoded typography, decorative icons | High |
| CoachDashboard/CoachHome | Flat stack, deprecated spacing, double card chrome in FocusedAthletePanel | High |
| Tennis analytics tabs | 21 card monoculture, 54 uppercase labels, flat typography | High |
| Tennis analytics charts | 15 deprecated surface.card, 19 uppercase labels, hardcoded chart colors | Medium |
| Physical tests | 13 card monoculture, TeamHeatmap custom colors, BenchmarkIndexHero should be heroBand | Medium |
| Charts/Garmin | 7 card monoculture, 5 gradient washes, skeleton/production mismatch | Medium |
| Messaging | Gradient wash at line 486, avatar color inconsistency, 25+ hardcoded sizes | Low |
| Landing pages | Well-designed, minor font inconsistency (PlatformLanding uses Barlow not Playfair) | Low |
| Navigation/sidebar | 1 gradient wash, inline SVGs, missing aria-current | Low |
| Forms | No validation UX, modern-form-card.tsx broken/unused | Low |
| UI primitives | card.tsx not using surface system, tabs/input hardcoded HSL/RGBA | Medium |
| Watch/scorekeeper | 12/12 Card monoculture, extensive arbitrary pixel sizes | Low |
| Management/admin pages | Flat stacks, card monoculture skeletons, hardcoded typography | Medium |
| App page layouts | 27 loading.tsx with card monoculture, generic 404, no tokens | Medium |
| Color system/dark mode | 100+ hardcoded hex values, dead CSS classes, missing color steps | Medium |
| Animation/transitions | duration-700 undefined, 6/13 cards no hover, animation tokens unused | Low |
| Responsive/mobile | 8 grids without mobile breakpoints, 8 tables without mobile cards | Medium |
| Accessibility | 9 clickable elements without focus, 15+ missing aria-labels, low contrast | High |
| Empty states | 80+ instances, 2 parallel systems, 15+ plain text, 12+ ad-hoc | High |
| Icon usage | Size tokens 0% adoption, inconsistent colors, 7 decorative icons | Medium |
| Spacing rhythm | 10+ cards missing responsive padding, 20+ fractional values, 0 page token usage | Medium |
| Tables/data-dense | Missing tabular-nums, 6 tables without mobile cards, hardcoded badge colors | Medium |
| Buttons/CTAs | 15+ missing aria-labels, 20+ manual loading states, unused variants | Low |
| Card composition | 7 unrefactored home cards (RosterHero, StreakWidget, etc.) | Medium |

---

## Implementation Phases

### Phase 1: Foundation & UI Primitives (High impact, low risk)

Fix the shared building blocks that everything else depends on.

**1.1 Fix UI primitive hardcoded values**
- `tabs.tsx:30,63,65` — Replace hardcoded HSL values with CSS variables
- `input.tsx:11` — Replace hardcoded RGBA placeholder with CSS variable
- `select.tsx:82` — Replace hardcoded RGBA shadow with token
- `dialog.tsx:62` — Standardize shadow pattern
- `skeleton.tsx:37` — Replace hardcoded shimmer colors with CSS variables

**1.2 Migrate card.tsx to surface tier system**
- Add surface-tier-aware variants to card.tsx
- Map existing `default` → `surfaces.raisedTight`, `elevated` → `surfaces.raised`
- Keep backward compatibility for all existing consumers

**1.3 Add missing design tokens**
- Add `duration-700` to tailwind config (or replace with `duration-500`)
- Add `surfaces.raisedInteractive` and `surfaces.plainInteractive` with hover states
- Add icon color tokens (`iconColors.primary`, `.muted`, `.success`, etc.)
- Add `surfaces.successSurface`, `surfaces.warningSurface`, `surfaces.dangerSurface`
- Add `badgeColors` token object for centralized badge color utilities

**1.4 Clean up dead code**
- Remove unused `text-primary-dm`, `text-secondary-dm`, `text-tertiary-dm` CSS classes
- Fix or remove `modern-form-card.tsx` (broken variants, unused)
- Remove unused button variants (`success`, `link`) or document their use

**1.5 Fix responsive grid tokens**
- Add `md:grid-cols-2` breakpoint to `spacing.editorialGrid` for tablets
- Update `spacing.colSpan7` / `spacing.colSpan5` with tablet variants

---

### Phase 2: Dashboard Homes (High visibility, high impact)

Apply the ParentHome editorial pattern to the other dashboard homes.

**2.1 PlayerHome refactor**
- Change `spacing.sectionGap` → `spacing.sectionGapEditorial`
- Merge GreetingCard + ReadinessHero into hero band (like ParentHome)
- Add `connectHref` and `loadHref` props to HeroRingTrio
- Refactor 5 legacy cards to Surface system:
  - `StreakWidget` → `Surface tier="raised"`, remove decorative icon ornament
  - `CalibrationBanner` → `Surface tier="well"`, remove decorative icon
  - `AchievementsSection` → `Surface tier="raised"`
  - `UpcomingTrainingCard` → `Surface tier="raised"`, use shared EmptyState
  - `SetupChecklist` → `Surface tier="well"`
  - `ConnectWearableCard` → `Surface tier="plain"`, remove decorative icon
- Replace hardcoded typography with tokens in all 5 cards
- Replace custom empty state in UpcomingTrainingCard with EmptyState component

**2.2 CoachHome refactor**
- Change `spacing.sectionGap` → `spacing.sectionGapEditorial`
- Consider merging GreetingCard + RosterHero into hero band
- Apply editorial 12-col grid (FocusedAthletePanel 7 / PendingRequests 5)
- Fix FocusedAthletePanel: pass `variant="embedded"` to HeroRingTrio (removes double card chrome)
- Refactor legacy cards to Surface system:
  - `AttentionListCard` → `Surface tier="raised"`
  - `PendingRequestsCard` → `Surface tier="raised"`
  - `FocusedAthletePanel` → `Surface tier="raisedTight"`
  - `RosterPulseStrip` → `Surface tier="plain"`
  - `TodaysCourtCard` → Remove gradient wash, use `Surface tier="well"`
- Replace hardcoded typography in RosterHero, RosterPulseStrip, AttentionListCard
- Reduce uppercase labels: keep ONE eyebrow in RosterHero, convert rest to sentence-case

**2.3 ClubAdminDashboard refactor**
- Remove colored left borders from stat cards (lines 610, 627, 644, 661)
- Remove decorative icon backgrounds from stat cards
- Replace hardcoded typography with tokens
- Migrate 10+ card instances to Surface tier system
- Replace 6 ad-hoc empty states with EmptyState component
- Remove uppercase micro-labels from mobile cards (lines 1008-1020)
- Replace hardcoded colors (blue-500, green-500, etc.) with semantic tokens
- Consider grouping 10 tabs into 4-5 categories
- Apply editorial grid layout

---

### Phase 3: Tennis Analytics Migration (Large scope, high impact)

The largest concentration of design debt.

**3.1 Migrate chart containers from surfaces.card to new tiers**
- 15 instances in `tennisProgressCharts.tsx` → `surfaces.raised` or `surfaces.raisedTight`
- 8 instances in `TennisAnalyticsShotStatsTab.tsx` → appropriate tiers
- 4 instances in `TennisAnalyticsDetail.tsx` → appropriate tiers
- 3 instances in `TennisAnalyticsInsightsTab.tsx` → appropriate tiers

**3.2 Remove decorative uppercase labels**
- 54 uppercase instances across tennis analytics
- Keep functional ones (chart axis labels, data labels)
- Convert decorative section headers to sentence-case using SectionTitle
- Replace hardcoded `text-[10px]` etc. with typography tokens

**3.3 Replace hardcoded chart colors**
- Replace `fill-emerald-500`, `fill-red-500` with `chartColors.positive`, `chartColors.negative`
- Replace `hsl(var(--border))` with `chartColors.gridLine`
- Replace `hsl(var(--muted-foreground))` with `chartColors.axis`
- Replace `bg-emerald-500`, `bg-amber-500` progress bars with token colors

**3.4 Standardize chart empty states**
- Create shared `ChartEmptyState` component with consistent sizing
- Replace 6+ inconsistent empty state patterns
- Use `typography.caption` for empty state text

**3.5 Remove decorative gradient wash**
- `tennisProgressCharts.tsx:2004` — Replace hero gradient with flat tint

---

### Phase 4: Physical Tests Migration (Medium scope)

**4.1 Migrate card containers**
- 13 `<Card>` instances → `surfaces.raised` or `surfaces.raisedTight`
- `BenchmarkIndexHero.tsx:126` → `surfaces.heroBand` (critical — hero component)

**4.2 Fix TeamHeatmap custom colors**
- Replace custom `getHeatColor` / `getHeatBorder` functions with design token colors

**4.3 Reduce uppercase labels in BenchmarkIndexHero**
- 3 uppercase labels → reduce to 1 (keep primary metric label only)

**4.4 Replace custom colored backgrounds**
- `ImprovementHighlightsCard.tsx:184` → `surfaces.successSurface` / `surfaces.dangerSurface`
- `PersonalBestsCard.tsx:186` → `surfaces.successSurface`
- `StrengthsFocusCard.tsx:202` → `surfaces.successSurface` / `surfaces.warningSurface`

---

### Phase 5: Charts/Garmin Migration (Medium scope)

**5.1 Remove gradient washes**
- `ChartsContent.tsx:97` — Replace with `bg-muted/80`
- `ChartsContent.tsx:1058` — Replace with flat tint
- `ChartsContent.tsx:1146` — Replace with `bg-muted/20`
- `ChartsContent.tsx:1148` — Remove glow entirely
- `ChartsContent.tsx:1224` — Replace with `bg-muted/15`
- `LazyChart.tsx:39` — Replace gradient with flat `bg-card`

**5.2 Migrate card containers**
- 7 card monoculture instances → Surface tier system

**5.3 Fix skeleton/production mismatch**
- Align `LazyChart.tsx` skeleton styling with production container

---

### Phase 6: Cross-Cutting Concerns (High impact, applies everywhere)

**6.1 Accessibility fixes**
- Add focus states to 9 clickable elements (ChildSummaryCard, MobileAthleteCard, etc.)
- Make 5 hover-only elements keyboard accessible (ParentCommunicationHub, SmartSessionBuilder, etc.)
- Add `aria-hidden` to all decorative ChevronRight icons (10+ instances)
- Add `aria-label` to 15+ icon-only buttons missing them
- Add `aria-current="page"` to SidebarNavItem
- Fix low-contrast text: increase `text-muted-foreground/40` to `/70`, `/50` to `/70`

**6.2 Responsive grid fixes**
- `ChildAttendanceCard.tsx:88` — Add `grid-cols-1 sm:grid-cols-3`
- `ReadinessHero.tsx:160` — Add `grid-cols-1 sm:grid-cols-2`
- `CourtHeatmap.tsx:211` — Add `grid-cols-1 sm:grid-cols-3`
- `TennisAnalyticsDetail.tsx:403` — Add `grid-cols-1 sm:grid-cols-3`
- `GenericProviderExpandedPanel.tsx:176` — Add `grid-cols-1 sm:grid-cols-2`
- `GarminExpandedPanel.tsx:288` — Add `grid-cols-1 sm:grid-cols-2`
- `RosterHero.tsx:89` — Add `grid-cols-1 sm:grid-cols-3`
- `tennisProgressCharts.tsx:1677` — Add `grid-cols-1 sm:grid-cols-2`

**6.3 Empty state standardization**
- Consolidate `EmptyStateBase` (EmptyStates.tsx) with main `EmptyState` component
- Replace 15+ plain `text-muted-foreground` empty messages with EmptyState component
- Replace 12+ ad-hoc icon+text empty states with EmptyState component
- Add CTAs to 9+ empty states that are missing them
- Standardize translation keys under `common.emptyStates`

**6.4 Spacing standardization**
- Add responsive padding to 10+ cards: `p-5` → `p-5 sm:p-6`
- Replace deprecated `spacing.sectionGap` with `spacing.sectionGapEditorial` in CoachHome, PlayerHome
- Add `spacing.page` wrapper to all dashboard layouts
- Eliminate 20+ fractional spacing values (round to 4px multiples)

**6.5 Gradient wash removal**
- `SidebarMobile.tsx:83` — Replace with `bg-muted/50`
- `MessagingView.tsx:486` — Replace with `bg-muted/30`
- `MessagingView.tsx:496,498` — Remove decorative gradients
- `ConversationList.tsx:271,272` — Simplify empty state gradients
- `ConversationThread.tsx:157` — Use `getAvatarColor()` from design tokens

**6.6 Hardcoded color cleanup**
- Replace 100+ hardcoded hex values in landing/bench components with CSS variables
- Replace hardcoded Tailwind colors (blue-500, emerald-500) with chart tokens in ClubAdminDashboard
- Standardize avatar colors to use `getAvatarColor()` across messaging components

**6.7 Table improvements**
- Add `tabular-nums` to base `TableCell` component
- Add mobile card layouts to 6 tables missing them
- Centralize hardcoded badge colors into `badgeColors` token

**6.8 Animation consistency**
- Standardize card hover effects via `surfaces.raisedInteractive` / `surfaces.plainInteractive`
- Add `duration-normal` to 4 transitions missing durations
- Migrate 20+ manual Loader2 implementations to LoadingButton component

**6.9 Icon standardization**
- Adopt existing `iconSizes` tokens (currently 0% adoption)
- Add `aria-hidden` to decorative icons
- Standardize icon choices (MessageSquare vs MessageCircle vs Mail)

---

### Phase 7: App Pages & Loading States (Medium scope)

**7.1 Loading state improvements**
- Import design tokens in 26/27 loading.tsx files (only 1 currently uses them)
- Replace card monoculture skeletons with editorial skeletons
- Use `spacing.sectionGapEditorial` and surface tokens

**7.2 Error/404 page redesign**
- `not-found.tsx` — Redesign with `typography.displayHero`, add visual element
- `error.tsx` — Replace hardcoded typography with tokens

**7.3 Overview page**
- Import design tokens
- Replace hardcoded typography with tokens
- Replace manual surfaces with `surfaces.well`, `surfaces.raisedInteractive`
- Replace hardcoded green colors with semantic tokens

---

### Phase 8: Watch/Scorekeeper & Management Pages (Lower priority)

**8.1 Watch/scorekeeper**
- Migrate 12 Card instances to Surface system
- Replace arbitrary pixel typography sizes with tokens
- Replace hardcoded Tailwind colors with design tokens

**8.2 Management pages**
- Apply editorial layout to management dashboard
- Replace hardcoded typography with tokens
- Standardize empty states to use EmptyState component
- Remove decorative icon ornaments from card headers

---

## Verification

Each phase should be verified with:
1. `npm run lint` — No new warnings or errors
2. `npm run typecheck` — No new errors in changed files
3. Visual review of affected views
4. Consumer compatibility check (ensure no prop contract breaks)

## Risk Mitigation

- **Tennis analytics** has 32 consumers of `surfaces.card` — migrate gradually, keep deprecated token
- **UI primitives** (card.tsx, button.tsx) are used everywhere — changes must be backward-compatible
- **Empty state consolidation** affects 80+ instances — phase gradually by domain
- **Hardcoded color cleanup** in landing pages is lower priority (landing pages are already polished)

## Priority Order

1. **Phase 1** (Foundation) — enables all other phases
2. **Phase 6.1-6.2** (Accessibility + Responsive) — critical bugs, low risk
3. **Phase 2** (Dashboard homes) — highest visibility
4. **Phase 3** (Tennis analytics) — largest debt concentration
5. **Phase 6.3** (Empty states) — high impact consistency
6. **Phase 4** (Physical tests) — medium scope
7. **Phase 5** (Charts/Garmin) — medium scope
8. **Phase 6.4-6.9** (Cross-cutting) — incremental improvements
9. **Phase 7** (App pages) — medium visibility
10. **Phase 8** (Watch/management) — lower priority
