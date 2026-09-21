---
agent: devin-local
session: immediate-tarp
created: 2026-09-19T19:35:28Z
implementation-started: 2026-09-19
---
# Mobile UX Megaplan: cold start, coach overview, AI access, mobile design, scorekeeper, health, FAQ

Fix the phone experience of the coach app end to end — the 5s+ logo screen, the vanished AI assistant, the unlabeled overview tabs, stretched buttons and the generic "AI-style" look — as a mobile-first plan that reuses the design foundations of _plans/UXandSpeedMegaplan.md and delivers one reviewable work package per reported issue.

## Status

| WP | Scope | Status |
|---|---|---|
| WP-0 | Baseline capture and measurement harness | in progress — bundle baseline recorded; on-device cold-start measurement owner-pending (M-PERF-01) |
| WP-1 | Cold-start perception fix | done |
| WP-2 | AI assistant on mobile | done |
| WP-3 | Coach overview single page + admin route | done — `/management` ruled out (admin-only); `/coach/admin` created |
| WP-4 | Shared primitives (button rule, tabs, cards, motion, tokens) | done |
| WP-5 | Whole-app visual sweep (5a-5d) | done — 5a (coach + shell), 5b (player + parent), 5c (admin/settings), 5d (public); guard at zero and enforced in `pnpm lint` |
| WP-6 | Scorekeeper list CTAs | done |
| WP-7 | Health page mobile + genetics consent | done — consent wording pending Daniel review (M-SAFE-01); retention/revocation gap logged as RG-13 |
| WP-8 | Verification gate and evidence | done — lint/typecheck/guard/budgets green; full suite 2089 passed / 0 failed (F-21/F-22 spec green after the concurrent stream landed it); stale-test debt in 23 committed-source files repaired; evidence `docs/evidence/mobile-ux-final-2026-09-20.md`; RG-14/RG-15/RG-16 logged |

Implementation order note: WP-4 lands before WP-3/WP-6/WP-7 because those packages consume `ActionRow`, the neutral tab style, and the button rule. WP-5a ships with WP-4 per §6.

## 0. Evidence boundary

- Research performed on local source only (APP revision `f4c9b736`, worktree clean). No production access, builds, tests or edits were run. No subagent tooling is exposed in this session, so all findings below are my own static-source observations.
- Every finding is tagged **confirmed** (read in source) or **hypothesis** (needs a measurement or a screenshot to settle). Timings are not measured; "5s+" is Daniel's observation on a phone.
- Paths are relative to **APP** = `PeakPerformanceData/peak_performance_data` (repo `app`, occurrence `app-direct`, pnpm 9.15.0, Next.js 15.5, React 19, Tailwind 3, next-intl, next-pwa, Vitest + Testing Library).
- This is a new plan that **cross-references** `_plans/UXandSpeedMegaplan.md` (called **UXSM** below). It does not duplicate UXSM's cache/loading work packages; it reuses UXSM §6.1 visual foundations and criteria UX-01..05, DATA-01, SAFE-03. Where a fix belongs to a UXSM WP, this plan says so and only adds the mobile-specific part.

## 1. Decisions confirmed with Daniel

| Topic | Decision |
|---|---|
| Test account | Coach, organization mode (drives bottom nav, overview tabs, AI FAB) |
| FAQ "two dots" | Not a bug: Catalan `freqüents` is correct spelling. Dropped. |
| Genetics "Privacy & Consent" box | Remove the notice with unverified claims; keep a short, truthful consent checkbox |
| Full-width buttons | Could not pinpoint one instance; fix the pattern app-wide with one rule |
| Plan relation | New mobile-first plan, cross-reference UXSM |
| Coach overview tabs | Remove tabs; overview becomes one page; Athletes lives at `/coach/players`; Admin moves to its own route |
| Scorekeeper CTAs | Prominent "Start live match", one-tap resume of live/paused matches, link from completed matches into analytics/progress |
| "De-AI-style" visual cleanup | Whole app (all roles and routes, landing included), delivered through shared primitives first, then a screen sweep |

## 2. Objective and acceptance criteria

**Objective.** On a phone (390x844 reference, iOS Safari PWA + Android Chrome), a coach opens the installed app and reaches a useful, calm, correctly-labeled overview quickly; every reported defect below is fixed; and the visual language across the app stops looking like a generic AI-generated dashboard.

Acceptance criteria (IDs are new to this plan; M = mobile):

- **M-PERF-01** Installed PWA cold start: time from tap to first visible dashboard content (page header + skeleton or real rows) p75 <= 2.5s on the UXSM mobile lab profile; no brand-logo overlay is visible once HTML has arrived. Measured with the UXSM WP-00 method (20 comparable runs, cold/warm cohorts separated). If the target is not reachable without UXSM WP-05 changes, report the shortfall and its cause rather than lowering the bar.
- **M-NAV-01** A coach on mobile can open the AI assistant in <= 2 taps from any authenticated route, with the same feature gate (`hasFeature('ai')`) as desktop.
- **M-NAV-02** No tab/segment/nav control renders icon-only without a visible text label at 360px and 390px widths. `hideLabelOnMobile` is removed from the codebase.
- **M-NAV-03** Coach overview is a single scrolling page (no tab bar). Athletes and Admin content stay reachable via routes; every existing action (approve/reject requests, notes, matrix) still works and is covered by the existing `tests/components/dashboard/CoachDashboard.test.tsx` updated for the new structure.
- **M-UI-01** Button rule: a button is content-width unless it is the single primary action in a form footer, bottom sheet or dialog. Button groups lay out as a wrapping row, never as stacked full-width blocks, at 360px+. Enforced by primitives (`ModernFormActions`, `EmptyState`, `Alert` actions, new `ActionRow`) and an ESLint/grep guard against `w-full sm:w-auto` on `<Button>`/`<Link>` outside those primitives.
- **M-UI-02** Decorative patterns removed app-wide: `.surface-hero`, `.surface-mesh`, `.accent-line`, `.border-shimmer`, `.glow-ring*`, `.card-hover-lift`, `.shadow-premium-*`, `blur-sm` halo rings, `hover:-translate-y-*` on static cards, gradient avatar rings, `Sparkles` decoration icons, icon-in-tinted-square before every heading, `stagger-children` on analytical content. Motion follows UXSM §6.1 (120-180ms color/opacity only; reduced-motion respected).
- **M-UI-03** UXSM UX-03/UX-04 apply to every screen touched: 44px touch targets, no page-level horizontal scroll at 320px, contrast >= 4.5:1, focus visible, no color-only status.
- **M-HEALTH-01** Health page at 390px: tab bar readable with labels, forms single-column, tables scroll inside a labeled region, no clipped inputs. Genetics tab shows a one-sentence truthful consent; the "Privacy & Consent" notice is gone. Upload still requires the checkbox.
- **M-TENNIS-01** Scorekeeper list: primary "Start live match" CTA visible above the fold on mobile; live/paused matches render as a resume card with score/status and one-tap resume; completed matches expose a link into tennis analytics/progress for that athlete.
- **M-I18N-01** All new/changed UI strings exist in all 8 locales (`en, es, ca, de, fr, nl, pt, zh`) and `pnpm check:i18n-namespaces` passes; `route-namespaces.generated.ts` regenerated if a route's namespaces change.
- **M-SAFE-01** No auth, RLS, migration, security-policy or vendor-revision change. Genetics consent is still recorded (`athlete_consent: true` on insert) and still gates upload client-side. Any consent-text change is reviewed by Daniel before merge.

## 3. Findings ledger (what is actually wrong, in source)

### 3.1 Cold start / "logo page" (issue 1)

| ID | Observation | Status |
|---|---|---|
| C-01 | PWA `start_url` is `/{locale}` (`src/app/api/manifest/route.ts:35`). Middleware redirects authenticated `/` to `/{locale}/coach` (`src/middleware/auth.ts:404-423`) after a session + profile lookup. One extra round trip on every cold launch. | confirmed |
| C-02 | `src/app/[locale]/layout.tsx:569-628` paints `html,body` in the brand splash colour and overlays a fixed, centred brand logo (`#ppd-cold-start-logo`, z-index 9998, opacity .85) **until `html.theme-ready`** is added by `ThemeProvider`'s `useEffect` (`src/components/theme-provider.tsx:15-19`). That effect only runs after the whole client bundle downloads and React hydrates. SSR HTML is already on screen underneath but the user perceives "logo page" until hydration completes. This is the most likely source of the multi-second logo. | confirmed mechanism; duration is hypothesis |
| C-03 | Coach page SSR awaits a 1500ms `DASHBOARD_SEED_TIMEOUT` race (`src/app/[locale]/coach/page.tsx:15`) and then `CoachApprovalGate` waits for a client request before rendering children (UXSM F-11/F-12). | confirmed (UXSM WP-05 owns the fix) |
| C-04 | next-pwa `NetworkFirst` with 3s timeout for locale page navigations (`next.config.js:52-95`): on a slow network the SW waits up to 3s before serving cached HTML. | confirmed config; impact hypothesis |
| C-05 | Root client tree mounts `PostHogProvider`, `AuthProvider`, `UserContextProvider`, `SidebarProvider`, `NavBar`, `AppShell`, SW registration and Speed Insights before any page code. Bundle sizes are budgeted by `scripts/check-bundle-budgets.js` but not measured in this plan. | hypothesis (needs `pnpm build:analyze`) |

### 3.2 AI assistant vanished on coach mobile (issue 2)

| ID | Observation | Status |
|---|---|---|
| A-01 | `src/components/navigation/BottomNav.tsx:263-270,328-340,378` ("P5.3"): coach org-mode renders four flat tabs and **no** center AI FAB. Comment says the assistant is "accessible via the mobile menu". | confirmed |
| A-02 | Nothing in `SidebarMobile.tsx`, `navigationItems.tsx`, `SidebarFooter.tsx`, `NavBar.tsx` or `AccountMenu` calls `openVoiceAssistant`. The only other entry is `LazyVoiceAssistantButton`, which returns `null` below `min-width: 768px` (`src/components/layouts/LazyLayoutExtras.tsx:213-232`). **Coaches on phones have no way to open the assistant.** | confirmed bug |
| A-03 | `VoiceAssistantHost` is mounted in the layout (`layout.tsx:678`) so the modal itself works on mobile once opened. | confirmed |

### 3.3 Coach overview tabs and layout (issue 3)

| ID | Observation | Status |
|---|---|---|
| O-01 | `src/components/dashboard/CoachDashboard.tsx:578-614`: `AccentTabs` with Overview / Athletes / Admin, all `hideLabelOnMobile: true` -> three unlabeled icons on phones. `hideLabelOnMobile: true` appears 3 times app-wide. | confirmed |
| O-02 | Athletes tab renders `UnifiedAthleteView` (matrix + notes); a separate `/coach/players` route already exists (`src/app/[locale]/coach/players/`). Admin tab renders member/coach requests and assignments tables (`CoachDashboard.tsx:654-845`). No route for Admin content exists today. | confirmed |
| O-03 | `CoachHome.tsx` stacks: hero band (CoachHeader + RosterHero), `CoachQuickActions` (5 horizontally scrolling tiles with `stagger-children`), `TodaysCourtCard`, Attention 7/5 grid, `FocusedAthletePanel`, `PendingRequestsCard`. UXSM §6.3 already specifies the desktop composition; the mobile ordering is only sketched. | confirmed |
| O-04 | Bottom nav coach tabs: Overview, Players, Training, Messages (`BottomNav.tsx:229-235`). | confirmed |

### 3.4 Generic "AI-style" design (issue 4)

| ID | Observation | Status |
|---|---|---|
| D-01 | `globals.css:1390-1500` defines `.shadow-premium-*`, `.surface-hero` (135deg gradient band), `.surface-mesh` (radial mesh), `.card-hover-lift`, `.border-shimmer` (animated gradient border), `.glow-ring*`, `.bg-gradient-card`, `.accent-line` (gradient bar). | confirmed |
| D-02 | Usage counts (files): `surface-mesh` 36, `rounded-2xl` 30, `bg-gradient-to` 21, `animate-pulse` 19, `blur-sm` 17, `hover:-translate-y` 16, `shadow-premium` 13, `accent-line` 9, `surface-hero` 7, `Sparkles` 6. Example: `/overview` hero with gradient avatar ring + blur halo + Sparkles eyebrow (`src/app/[locale]/overview/page.tsx:163-200`). | confirmed |
| D-03 | `AccentTabs` (`src/components/ui/accent-tabs.tsx`) paints the active tab as a filled coloured block with `shadow-md`, seven accent colours. Health uses rose/blue/purple. | confirmed |
| D-04 | `Button` default variant carries `shadow-sm hover:shadow-md` and `active:scale-[0.97]` (`src/components/ui/button.tsx:8-14`). | confirmed |
| D-05 | `surfaces.raised` uses `rounded-2xl`; `spacing.editorialGrid` is a 12-col "editorial" grid; `fab.base` uses coloured `shadow-primary/25`. (`src/lib/design-tokens.ts:113-194`) | confirmed |
| D-06 | UXSM §6.1 already agreed the target look (Inter, 8-12px radii, border-led grouping, red reserved for primary action, no glows/gradients/hover-lift). This plan extends that from four coach screens to the whole app. | decision |

### 3.5 Stretched buttons (issue 5)

| ID | Observation | Status |
|---|---|---|
| B-01 | 116 occurrences in 55 files of `w-full sm:w-auto` / `w-full md:w-auto` on buttons and links (e.g. scorekeeper header link `tennis-scorekeeper/page.tsx:93-105`, `ConversationList.tsx:237` empty-state action). 48 `<Button className="...w-full...">` in 33 files. | confirmed |
| B-02 | `ModernFormActions` uses `flex-col-reverse sm:flex-row items-center` (`src/components/ui/modern-form-card.tsx:122-138`) so on mobile children stack, and children with `w-full` stretch. | confirmed |
| B-03 | `NotificationPermissionBanner.tsx:66-115` puts text + two buttons in one non-wrapping row at all widths; at 360px the text column is squeezed. | confirmed (likely one of the "messages" offenders) |

### 3.6 Scorekeeper list (issue 6)

| ID | Observation | Status |
|---|---|---|
| T-01 | `src/app/[locale]/tennis-scorekeeper/page.tsx`: header with a **secondary-styled** full-width "Score live match" link; live matches as small cards with a `Resume` button; recent matches as `Open`. No score preview, no link to analytics/progress, dashed empty state with only text. | confirmed |
| T-02 | Query pulls 20 manual matches for the viewer; live = `in_progress|paused`; no set score fields selected (would need `sets`/score columns or the existing scoreboard summary helper in `src/lib/tennis/scorekeeper/`). | confirmed; score-summary source to verify in WP-6 |

### 3.7 Health page and genetics consent (issue 7-8)

| ID | Observation | Status |
|---|---|---|
| H-01 | `HealthHub.tsx` uses `AccentTabs` (3 coloured tabs) sticky under the header; tabs Injuries / Labs / Genetics. Tab content: `InjuryTestForm` (embedded table + form), `LabPanelForm` + `LabProgressionChart`, `GeneticUpload`. Mobile responsiveness issues to be audited in these four components. | confirmed structure; specific overflow points to record in WP-7 audit |
| H-02 | `GeneticUpload.tsx:95-104` renders the `genetics.privacyTitle` / `privacyBody` notice: "Trait extraction runs on a cloud LLM subprocess… we do not store the original raw file… You can revoke consent and request deletion at any time." | confirmed |
| H-03 | Upload route `src/app/api/ai-agent/genetics/upload/route.ts` inserts `genetic_reports` with `file_path: file.name`, `athlete_consent: true`, `coach_consent`, then POSTs the bytes to `PPP_AI_AGENT_URL/genetics/parse`. There is **no** revoke/delete UI or route in APP, and the "raw file not stored" claim depends on `ppp_ai_agent`, which this plan does not audit. Claims are therefore unverified from APP. | confirmed (unverified claims) |
| H-04 | Coach uploads on behalf of an athlete are allowed (`isCoachOrAdmin`). The consent checkbox text is written in first person ("my genetic data"), which is wrong when a coach uploads. | confirmed |

### 3.8 FAQ (issue 9)

| ID | Observation | Status |
|---|---|---|
| F-01 | `/faq` is a public page; `messages/ca.json` title "Preguntes freqüents" is correct Catalan. **No fix.** | closed |
| F-02 | FAQ content is consumer/pricing copy (free plan, cancel subscription, upgrade). For academy coaches this is irrelevant. Not requested; recorded as optional follow-up only. | optional |

## 4. Scope

### In scope
- Shell: `src/app/[locale]/layout.tsx` cold-start CSS, `LazyLayoutExtras.tsx`, `BottomNav.tsx`, `NavBar.tsx`, `SidebarMobile.tsx`, `AppShell.tsx` (mobile parts only).
- Coach overview: `CoachDashboard.tsx`, `CoachHome.tsx`, `home/cards/*`, new `/coach/admin` route (or `/coach/requests` — see WP-3), `/coach/players` integration.
- Shared primitives: `button.tsx`, `card.tsx`, `page-header.tsx`, `accent-tabs.tsx`, `tabs.tsx`, `empty-state.tsx`, `alert.tsx`, `modern-form-card.tsx`, `design-tokens.ts`, `tailwind.config.js`, `globals.css`.
- Screens: `/overview`, coach messages, `/tennis-scorekeeper` list, `/health` (+ injury/labs/genetics components), and then a whole-app sweep of decorative patterns in priority order (coach routes, player, parent, club-admin, admin, public/landing).
- Translations in `messages/*.json` for new/changed strings.
- Tests: Vitest component tests for BottomNav, CoachDashboard restructure, primitives, GeneticUpload; a mobile-viewport visual check procedure.

### Out of scope (unchanged from UXSM unless noted)
- Cache/SWR/graph transport correctness (UXSM WP-01/02), physiology/tennis-analytics/fitness redesign (UXSM WP-04/06), backend/ClickHouse work, migrations, security-policy changes, vendor repins, new dependencies beyond dev tooling already approved in UXSM WP-00.
- Rewriting the AI assistant modal itself; changing AI feature gating.
- Verifying `ppp_ai_agent` genetics storage behaviour (recorded as a backlog item for `docs/audits/remediation-backlog.md`, not fixed here).
- Rewriting FAQ content (optional follow-up, F-02).

## 5. Design specification (mobile-first, extends UXSM §6)

### 5.1 Global rules
- Adopt UXSM §6.1 foundations for the **whole app**: Inter, H1 24px mobile / 28px desktop, body 14-16px, radii 8-12px panels / 6-8px controls, hairline borders for grouping, shadows only on popovers/dialogs/sheets, red primary reserved for the one primary action per screen, neutral page background with near-white surfaces, 16px mobile page margins with a single padding owner.
- **Motion:** 120-180ms colour/opacity; remove `active:scale`, `hover:-translate-y`, entrance staggers on data; keep `prefers-reduced-motion` handling.
- **Buttons (M-UI-01):** content-width by default; `size="lg"` primary may be full-width only inside `ModernFormActions`, `MobileSheetContent` footers, `ResponsiveDialog` footers. Groups use the new `ActionRow` (`flex flex-wrap items-center gap-2`, primary last, `justify-end` on sm+). Alerts/banners: text block on top, actions row below on mobile (`flex-col` container, actions still content-width).
- **Tabs:** one neutral segmented style (underline or subtle tint), labels always visible, horizontally scrollable when >3 items, min 44px height. `AccentTabs` keeps its API but loses the filled-colour block and `hideLabelOnMobile`; accent colour becomes an optional 2px indicator only.
- **Icons:** no tinted icon squares before headings; icons only where they carry meaning (nav, status, actions).
- **Cards:** `surfaces.raised` -> `rounded-xl` (12px) with hairline border; no hover lift; `Card variant="elevated"` maps to the same surface plus border.

### 5.2 Cold start (shell)
- Remove the fixed logo overlay (`#ppd-cold-start-logo`) entirely. The iOS splash already shows the logo until the first paint; the SSR skeleton then takes over. Keep the 3px progress bar but hide it as soon as HTML is parsed (inline `<script>` at end of `<body>` toggling a class, no React reconciliation issue since it only adds a class to `<html>`), not at hydration.
- Keep `html,body` background gate for dark/light continuity, but make the light-mode white apply via `html:not(.dark)` after the same early class so the page does not sit on a dark brand colour for seconds in light mode.
- `start_url`: keep `/{locale}` (manifest cannot know the role); the middleware redirect is one hop and already carries user headers. Record whether a second `/overview` hop ever occurs in WP-1 measurement.
- Coach page seed race and approval gate: defer to UXSM WP-05; WP-1 here only measures and documents the split (network / SSR / hydrate).

### 5.3 Coach mobile overview (single page)
Order at 390px:
1. Compact header: academy name + date on one line, coach name once (no greeting hero, no role badge, no Sparkles).
2. Roster status strip: `9 athletes · 2 need review · 7 with data` as text chips, tappable to scroll.
3. Primary action row: `Create session` (primary) + overflow `More` (sheet with Players, Insights, Messages, Reports).
4. Athletes needing review: stacked rows (name, reason, readiness value) with tap -> athlete detail; "View all" -> `/coach/players`.
5. Today's court (schedule) card.
6. Pending requests: compact list with Approve/Reject as content-width buttons in an `ActionRow`; "Manage" -> `/coach/admin`.
7. Selected athlete disclosure (FocusedAthletePanel) collapsed by default on mobile.
Desktop keeps UXSM §6.3 composition; the tab bar is removed on both.

### 5.4 Admin route
- New route `/coach/admin` (server page + client) holding: member requests, coach requests, assignments table; reuses the existing handlers extracted from `CoachDashboard.tsx` into a hook (`useCoachAdminActions`). Reachable from: overview "Manage requests" link, sidebar coach group (Management already exists — verify `navigationItems.tsx:355` roles; if `/management` already covers assignments, point there instead of creating a duplicate route — decide in WP-3 step 1 after reading `/management`).
- Sidebar and bottom-nav gain no new tab; the overview links and the mobile menu expose it.
- **Decision (WP-3a, 2026-09-20):** `/management` does NOT own coach request/assignment administration — it is an org-ops hub (players/training/tournaments cards + stats) restricted to admin roles by `src/middleware/authorization.ts` (`managementPaths`); coaches are redirected away. Implemented `/coach/admin` with `useCoachAdminActions` + `useCoachAdminData` hooks and a coach-group nav item (`navigation.admin`), which also exposes it in the mobile sheet menu.

### 5.5 AI assistant on mobile (coach)
- Keep the four flat tabs. Add the assistant as the **first item of the mobile sheet menu** (SidebarMobile footer, labeled "Assistant", `Bot` icon) **and** as a NavBar right-side icon button on mobile (`md:hidden`) so it is one tap away. Both gated by `hasFeature('ai')` exactly like the desktop `VoiceAssistantButton`. Fix the misleading P5.3 comment.

### 5.6 Scorekeeper list
- Header: title + one-line subtitle; **primary** `Start live match` button (content-width, right-aligned on sm+, left-aligned under title on mobile).
- Live section: resume card with players, status pill (Live/Paused), elapsed/last-updated, current score summary if available from existing scorekeeper helpers, whole card tappable, primary `Resume`.
- Recent section: rows with players, date, result, `Open` (ghost) and `View analytics` link to `/coach/tennis-analytics?player=<athlete>&match=<id>` for coaches or `/player/…` progress for players (resolve the correct existing route per role in WP-6 step 1).
- Empty state: `EmptyState` with a primary `Start live match` CTA and one sentence.

### 5.7 Health page
- Neutral segmented tabs with labels; sticky behaviour kept.
- Forms single-column on mobile; tables inside `scroll-table` regions with a visible label; inputs 44px; actions via `ModernFormActions`.
- Genetics: remove the notice block; consent checkbox text becomes role-aware and truthful: self: "I consent to processing this genetic file to generate educational sport-context traits. This is not medical advice." coach: "I confirm the athlete (or guardian) has consented to processing this genetic file for educational sport context." Keep the `disabled={!consentChecked}` gate and the `athlete_consent`/`coach_consent` insert. Daniel reviews the exact wording before merge (M-SAFE-01).

## 6. Work packages

Each WP is independently reviewable and ships in the order listed. Every WP ends with: `pnpm lint`, `pnpm typecheck`, `pnpm test -- <narrowed paths>`, `pnpm check:i18n-namespaces` when strings change, and the 360/390/768 px visual check described in §7.

### WP-0 — Plan file, baseline capture and measurement harness
1. Copy this plan to `_plans/MobileUXMegaplan.md` with a header block matching `UXandSpeedMegaplan.md` and a cross-reference table (this plan WP -> UXSM WP).
2. Run `pnpm build:analyze` (nonproduction) and `pnpm check-bundle-budgets`; record First Load JS for `/[locale]/coach`, `/[locale]/health`, `/[locale]/tennis-scorekeeper`, `/[locale]/coach/messages`.
3. Cold-start measurement recipe (owner runs on device or approves a nonproduction deploy): Safari Web Inspector / Chrome remote debugging timeline for the installed PWA; capture `navigationStart -> responseStart -> domContentLoaded -> theme-ready class -> first roster row`. Five exploratory runs; 20 comparable runs before/after WP-1.
4. Screenshot baseline of the eight screens at 390px (coach overview, players, messages, scorekeeper list, scorekeeper new, health x3 tabs, FAQ) into `docs/evidence/mobile-ux-baseline-<date>/` (sanitised, synthetic account).

**Exit:** baseline numbers and screenshots exist; bundle sizes recorded; no code changed yet.

### WP-1 — Cold-start perception fix (C-01, C-02, C-04)
Files: `src/app/[locale]/layout.tsx`, `src/components/theme-provider.tsx`, `src/components/layouts/LazyLayoutExtras.tsx` (`ColdStartBarCleanup`), `next.config.js` (SW timeout only if measurement supports it), `tests/app/` new `layout-cold-start.test.tsx`.
1. Delete the `#ppd-cold-start-logo` element and its CSS. Keep splash colour continuity via `html,body{background-color}`.
2. Add an inline script at the end of `<body>` that adds `html.shell-ready` synchronously (before hydration); move the bar-hide and light-mode-white CSS to key off `shell-ready`; keep `theme-ready` only for next-themes needs. Remove `ColdStartBarCleanup` no-op and its import.
3. Leave `start_url` as is; document the redirect hop in evidence.
4. If WP-0 traces show the SW 3s `networkTimeoutSeconds` delaying HTML, lower it for the locale page rule to 1.5s (config change only; no cache-name changes — UXSM F-27 security review boundary).
5. Coach seed/approval gates: **not touched here**; cross-reference UXSM WP-05 in the evidence file.

**Tests:** render `LocaleLayout` head/body markup and assert no cold-start-logo node; script adds the class; snapshot of critical CSS. **Exit:** M-PERF-01 measured before/after; if still > 2.5s, the evidence file names the remaining segment (SSR vs hydrate) and points at UXSM WP-05.

### WP-2 — Restore AI assistant on mobile for coaches (A-01, A-02)
Files: `BottomNav.tsx`, `src/components/navigation/Sidebar/SidebarMobile.tsx`, `src/components/ui/NavBar.tsx`, `src/components/ai/VoiceAssistantButton.tsx` (extract a size/variant prop instead of duplicating), `messages/*.json` (`navigation.openAiAssistant` already exists — reuse), `tests/navigation/BottomNav.test.tsx` (new), `tests/navigation/SidebarMobile.test.tsx` (new).
1. Add a mobile-only (`md:hidden`) assistant icon button in `NavBar` right cluster, gated by `useFeatureGate().hasFeature('ai')`, calling `openVoiceAssistant()`.
2. Add an "Assistant" entry at the top of the mobile sheet menu, same gate.
3. Correct the P5.3 comment in `BottomNav.tsx`.
4. Tests: coach org-mode renders no center FAB (unchanged), NavBar mobile shows assistant button when gated on and hides when off; clicking calls `openVoiceAssistant`.

**Exit:** M-NAV-01.

### WP-3 — Coach overview: remove tabs, add admin route, mobile composition (O-01..O-04)
Files: `CoachDashboard.tsx`, `CoachHome.tsx`, `home/cards/{CoachHeader,RosterHero,CoachQuickActions,AttentionListCard,PendingRequestsCard,FocusedAthletePanel}.tsx`, `home/primitives/*`, new `src/app/[locale]/coach/admin/{page,loading,error}.tsx` + `CoachAdminPageClient.tsx`, new hook `src/hooks/coach/useCoachAdminActions.ts`, `navigationItems.tsx`, `tests/components/dashboard/CoachDashboard.test.tsx`, `tests/components/dashboard/home/*`, translations `coachDashboard.*`.
1. Read `/management` and `navigationItems.tsx:355` first; if it already owns assignments/requests for coaches, link there and skip the new route (record the decision in the plan file).
2. Extract request/assignment handlers + SWR mutations from `CoachDashboard.tsx` into `useCoachAdminActions`; keep behaviour and scoped invalidation identical.
3. Remove `AccentTabs` from `CoachDashboard.tsx`; render `CoachHome` directly; `onViewMatrix` -> `router.push('/coach/players')`, `onViewPending` -> `/coach/admin` (or `/management`).
4. Rebuild `CoachHome` mobile ordering per §5.3 with `useMediaQuery`-free CSS ordering (Tailwind `order-*`), collapse FocusedAthletePanel on mobile via a disclosure.
5. Replace `CoachQuickActions` five tiles with `Create session` primary + `More` sheet (reuse `MobileSheetContent`).
6. Remove `hideLabelOnMobile` prop from `AccentTabs` and its three usages (the other two are located via grep in this step).
7. Update tests: tab assertions -> single page; admin actions tested through the new route/hook; `UnifiedAthleteView` still tested on `/coach/players` if it moves there (verify `CoachPlayersPageClient` already covers matrix + notes; if not, mount `UnifiedAthleteView` in a "Readiness" section of the players page).

**Exit:** M-NAV-02, M-NAV-03; no coach action lost (checklist: approve/reject member, approve/reject coach, create/update/delete note, matrix, dismiss attention, focus athlete).

### WP-4 — Shared primitives: button rule, tabs, cards, motion, tokens (B-01..B-03, D-01, D-03..D-05)
Files: `button.tsx`, `accent-tabs.tsx`, `tabs.tsx`, `card.tsx`, `page-header.tsx`, `empty-state.tsx`, `alert.tsx`, `modern-form-card.tsx`, new `src/components/ui/action-row.tsx`, `design-tokens.ts`, `tailwind.config.js`, `globals.css`, `eslint.config.mjs` (or `scripts/check-button-width.mjs` if a lint rule is disproportionate), `tests/components/ui/*`.
1. `Button`: drop `active:scale`, `shadow-sm hover:shadow-md` on default/success/destructive; keep sizes; add `fullWidth?: boolean` prop as the only sanctioned way to stretch.
2. `ActionRow` primitive per §5.1; `ModernFormActions` -> `flex flex-wrap justify-end gap-2` (no `flex-col-reverse`), stretching only via `fullWidth`.
3. `EmptyState`/`Alert`: actions render in `ActionRow`; remove `w-full sm:w-auto` wrappers.
4. `AccentTabs`: neutral segmented style, labels always shown, scrollable list, accent as 2px indicator; remove `hideLabelOnMobile`; keep `cols` for backwards compatibility but default to auto.
5. Tokens: `surfaces.raised/raisedInteractive` -> `rounded-xl border border-border/60 bg-card` (no shadow); delete `heroBand`; `fab.base` -> neutral shadow; `animations.spring/hoverLift` -> colour-only.
6. `globals.css`: remove `.surface-hero`, `.surface-mesh`, `.accent-line`, `.border-shimmer`, `.glow-ring*`, `.card-hover-lift`, `.shadow-premium-*`, `.bg-gradient-card`, `.stagger-children`; keep `.nums`, `.scroll-table`, safe-area utilities.
7. Guard: script `scripts/check-mobile-ui-rules.mjs` failing on `w-full sm:w-auto|w-full md:w-auto` on `Button|Link|<a` outside the sanctioned primitives, and on any use of the removed CSS classes; wire into `pnpm lint` via `&&` only after WP-5 sweep is complete (until then run it manually and record the count going down).

**Tests:** primitives render tests (labels visible, `fullWidth` behaviour, no removed classes). **Exit:** M-UI-01 primitives; build passes with removed classes (WP-5 removes the call sites in the same PR series, so ship WP-4 and WP-5a together to avoid a broken intermediate state).

### WP-5 — Whole-app visual sweep (D-02) in slices
Each slice: replace decorative classes with the primitives from WP-4, fix stretched buttons, verify 360/390/768, screenshot before/after.
- **5a Coach + shell (ships with WP-4):** `/overview` page, coach layout/loading skeletons (remove `surface-mesh` from `loading.tsx` files), `CoachHome` cards, `/coach/players`, `/coach/messages` (`MessagingView`, `ConversationList`, `EmptyMessagingPane`, `NotificationPermissionBanner` -> text-over-actions layout), `/coach/training`, `/coach/tournaments`, `/coach/reports`, `/coach/insights`, `/coach/tennis-analytics` list header only (detail is UXSM WP-06), `/coach/tennis-vision`, `/coach/analytics`.
- **5b Player + parent:** `PlayerHome`, `ParentHome`, `/player/*`, `/parent/*` cards and quick actions, `PlayerDashboard`, `ParentDashboard`.
- **5c Club-admin + admin + settings/profile/notifications/feedback/labs/genetics/performance-tests page frames** (performance-tests internals stay in UXSM WP-07 scope).
- **5d Public:** `/faq`, `/pricing`, `/privacy-policy`, `/terms-of-service`, login/signup/forgot/reset, landing (`PlatformLanding`, `AcademyLanding`, `LandingNavBar`, `Footer`) — landing keeps its brand fonts but drops shimmer/glow/gradient-card patterns.
- After 5d: enable the guard script in `pnpm lint`.

**Exit:** M-UI-02, M-UI-03 on every slice; guard script passes.

### WP-6 — Scorekeeper list CTAs (T-01, T-02)
Files: `src/app/[locale]/tennis-scorekeeper/page.tsx` (+ extract `ScorekeeperMatchCard.tsx`), `src/lib/tennis/scorekeeper/*` (read-only unless a score summary helper is missing), translations `tennisScorekeeper.*`, `tests/app/tennis-scorekeeper-list.test.tsx` (new).
1. Resolve the analytics deep-link per role (coach: `/coach/tennis-analytics`; player: existing player progress route — verify in `navigationItems.tsx`) and whether a compact score summary exists for list rows; if it requires a new query column, select it in the same Supabase query (no schema change).
2. Implement §5.6: primary CTA, resume card, recent rows with analytics link, `EmptyState` with CTA.
3. Tests: renders CTA, resume card for `in_progress|paused`, analytics link for `completed`, empty state.

**Exit:** M-TENNIS-01.

### WP-7 — Health page mobile + genetics consent (H-01..H-04)
Files: `HealthHub.tsx`, `src/components/injury/{InjuryTestForm,InjuryForm,InjuryTable,AddInjuryButton}.tsx`, `src/components/labs/{LabPanelForm,LabProgressionChart}.tsx`, `src/components/genetics/GeneticUpload.tsx`, `src/app/[locale]/health/page.tsx`, `messages/*.json` (`genetics.consent`, new `genetics.consentOnBehalf`; delete `privacyTitle`/`privacyBody` in all 8 locales), `tests/components/health/*` (new), `docs/audits/remediation-backlog.md` (new item: verify `ppp_ai_agent` genetics raw-file retention and add a consent revocation/deletion path).

**Mobile audit findings (360/390px, recorded before editing):**

- `GeneticUpload.tsx:95-105` — unverified `privacyTitle`/`privacyBody` notice block (H-02/H-03); `consent` is first-person regardless of uploader (H-04); submit Button uses `className="w-full"` instead of the sanctioned `fullWidth` prop.
- `LabPanelForm.tsx` — form grids are already `grid-cols-1` below `sm` (OK); submit uses `className="w-full"`; CSV preview `<table>` sits in a `max-h-32 overflow-y-auto` box with no horizontal scroll-table wrapper.
- `InjuryTable.tsx` / `InjuryTestForm.tsx` — desktop tables already live behind `overflow-x-auto` at `sm+` with mobile card layouts below (OK), but the scroll regions lack the `scroll-table` class and a region label (`role="region"` + `aria-label`) required by M-HEALTH-01.
- `InjuryTestForm.tsx:230-232` — non-embedded header still uses the icon-in-tinted-square pattern (`rounded-lg bg-primary/10 p-2`) banned by M-UI-02 (embedded mode used by HealthHub bypasses it, but the standalone render does not).
- `InjuryForm.tsx:411-443` — footer wraps Cancel/Reset in `flex w-full flex-col sm:w-auto sm:flex-row`, stacking both buttons full-width on mobile; `ResponsiveDialogFooter` already supplies ActionRow layout post-WP-4d, so the inner wrapper is redundant.
- `LabProgressionChart.tsx` — `CardHeader` row `flex items-center justify-between` squeezes the title/description against a `w-48` (192px) biomarker `Select` at 360px; should stack on mobile.
- `HealthHub.tsx` — `AccentTabs` renders neutral segmented tabs post-WP-4b (accents remain only as 2px indicators); sticky tab bar already correct; `AddInjuryButton` trigger is `size="sm"` content-width (OK).
- `health/page.tsx` — clean: `PageHeader` already neutralized in WP-4d; selectors stack below `sm`.

1. Audit each component at 360/390px; record the concrete overflow/squeeze points in the plan file before editing.
2. Apply neutral tabs, single-column forms, `scroll-table` regions, `ModernFormActions`/`ActionRow`.
3. `GeneticUpload`: delete the notice block (lines 95-104) and both translation keys; make consent text role-aware (`athleteId === currentUserId` -> self text, else on-behalf text; obtain current user id from `useUser()`); keep checkbox gate and upload call unchanged.
4. Tests: upload disabled until consent; self vs on-behalf text; no `privacyTitle` string rendered.
5. Daniel reviews consent wording (M-SAFE-01) before merge.

**Exit:** M-HEALTH-01.

### WP-8 — Verification gate and evidence
1. Re-run WP-0 cold-start recipe (20 runs) and screenshots; write `docs/evidence/mobile-ux-<date>.md` with before/after, bundle sizes, guard-script output, test run output.
2. Full `pnpm lint && pnpm typecheck && pnpm test` once as the final gate.
3. Update `_plans/MobileUXMegaplan.md` status table; add any discovered gaps to `docs/audits/remediation-backlog.md`.

## 7. Verification

- Per WP: `pnpm lint`, `pnpm typecheck`, `pnpm test -- tests/<narrow paths>`; `pnpm check:i18n-namespaces` when `messages/*.json` change.
- Visual: `pnpm dev` (nonproduction env, synthetic coach account) at 360x780, 390x844, 768x1024 in Chrome device mode + one real iPhone via Safari; check no horizontal scroll (`document.documentElement.scrollWidth <= innerWidth`), labels visible, touch targets >= 44px (Chrome a11y overlay), reduced-motion.
- Cold start: recipe in WP-0/WP-8; report both cohorts; do not claim a number that was not measured.
- Guard script output trending to zero across WP-5 slices; enforced in lint after 5d.
- Existing suites that must stay green: `tests/components/dashboard/*`, `tests/navigation/*`, `tests/i18n-namespaces.test.ts`, `tests/middleware*.test.ts`.

## 8. Risks and considerations

- **Scope size of "whole app":** WP-5 is the largest item; slicing by role keeps each PR reviewable. Landing pages have SEO/marketing stakeholders — 5d changes only decorative patterns, not copy or structure.
- **Removing the logo overlay** changes perceived brand continuity on launch; the iOS splash still shows the logo, so the trade is a faster visible app. If Daniel wants a logo during a truly blank window, keep it only until `shell-ready` (HTML parsed), never until hydration.
- **Cold-start target may not be reachable without UXSM WP-05** (1.5s seed race + approval gate). WP-1 will make the shell visible sooner but the roster may still arrive late; the evidence will say which.
- **Coach tab removal** moves Admin content to a route; deep links or tests referencing `?tab=` (check `handleTabChange` and URL sync in `CoachDashboard.tsx`) must redirect to the new route.
- **Genetics consent** is special-category data. Removing the notice is fine; weakening the consent gate is not. Wording is owner-reviewed; the unverified storage claims go to the backlog rather than being re-asserted.
- **Style rules:** keep imports/props/independent variable declarations alphabetical; do not remove existing comments except the factually wrong P5.3 note, which is corrected rather than deleted.
- **Approvals:** application edits, commits and pushes need Daniel's explicit go-ahead per `AGENTS.md`; nothing in this plan touches migrations, RLS, security policies or vendor pins.

## 9. Cross-reference to UXandSpeedMegaplan

| This plan | UXSM |
|---|---|
| WP-1 shell cold start | WP-00 measurement method; WP-05 coach init/approval gate (not duplicated) |
| WP-3 overview single page | §6.3 desktop composition; WP-05 step 8 lazy tab content (superseded by route split) |
| WP-4/5 primitives and sweep | §6.1 foundations, WP-03 opt-in variants — this plan makes them the default app-wide instead of opt-in |
| WP-6 scorekeeper | §6.5 tennis list semantics; live matches keep no persistent cache (§7.2) |
| Criteria | UX-01..05, DATA-01, SAFE-03 apply unchanged |
