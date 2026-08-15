# B2C Transformation — Comprehensive Improvement Map

> Generated from deep codebase exploration (25+ search agents across signup, onboarding, auth, navigation, billing, wearables, SwingVision, AI agent, middleware, landing, and settings).

---

## Executive Summary

The codebase has **significant B2C scaffolding already in place**: personal organizations, consumer i18n overlay, 5-tab mobile navigation, Stripe tier config, feature gating, onboarding wizard, and setup checklist. However, there are **critical gaps** preventing a seamless B2C experience: the entitlement RPC is missing, the signup form still shows all 4 academy roles, the feature gate hook doesn't check subscription tiers, and SwingVision CTAs are absent from the dashboard.

---

## 1. Signup Flow

**Files:** `src/app/[locale]/signup/page.tsx`, `src/lib/auth/auth.ts`

### Current State
- Platform site shows all 4 roles: player, coach, parent, club_admin
- "individualHint" banner shown for platform but form is unchanged
- Organization selector hidden for platform (good)
- OAuth buttons shown only for platform (good)
- Post-signup: redirects to `/login` (email confirmation required)
- `?plan=` query param from pricing CTA is **not consumed** — user picks plan on landing, gets sent to signup, plan info is lost
- Personal org created via `create_personal_organization` RPC (working in prod)
- Sample matches seeded for personal org users

### Gaps
| # | Gap | Severity |
|---|-----|----------|
| 1.1 | All 4 roles shown to B2C users — coach/parent/club_admin don't make sense for individuals | High |
| 1.2 | `?plan=` param from pricing CTA not preserved through signup → checkout | High |
| 1.3 | Redirects to `/login` after signup — no seamless onboarding start | Medium |
| 1.4 | Date of birth required for players but not coaches — inconsistent for B2C | Low |
| 1.5 | No "player" default selection for platform site — user must choose | Medium |

### Recommended Changes
- **1.1** For `isPlatform`, simplify to a single "Athlete" role (map to `player` internally). Hide coach/parent/club_admin. Or show a 2-step: "Are you an athlete or a coach/academy?" with athlete as default.
- **1.2** Read `?plan=` from URL, store in hidden field, pass to `signUp()`. After email confirmation, redirect to Stripe checkout with the selected plan.
- **1.3** After signup, redirect to a "Check your email" page with a clear CTA, or auto-login if email_confirm is enabled.
- **1.5** Default `role` to `'player'` when `isPlatform` is true.

---

## 2. Onboarding Wizard

**Files:** `src/components/onboarding/OnboardingWizard.tsx`, `src/components/onboarding/OnboardingGate.tsx`

### Current State
- 3 steps: role → focus → paths
- Role step re-asks player/parent/coach (redundant with signup)
- Focus step: compete / train / recover
- Paths step: match (→ `/tennis-scorekeeper`), garmin (→ `/settings/wearables`), video (→ `/tennis-vision`)
- "Explore later" → `/overview`
- Gate: opens for personal-mode users with `!onboarding_completed`
- Posthog analytics for funnel events

### Gaps
| # | Gap | Severity |
|---|-----|----------|
| 2.1 | Role step is redundant — user already chose at signup | High |
| 2.2 | "video" path links to `/tennis-vision` — route may not exist | High |
| 2.3 | No SwingVision import CTA in paths (only "video" which is ambiguous) | Medium |
| 2.4 | "Explore later" goes to `/overview` which redirects to `/player` — extra hop | Low |
| 2.5 | No "connect wearable" step before "paths" — user sees paths before setup | Medium |

### Recommended Changes
- **2.1** Skip role step for B2C (always `player`). Start at "focus" step. Or merge role+focus into a single "What's your goal?" step.
- **2.2** Verify `/tennis-vision` route exists. If not, create it or redirect to `/player/tennis-analytics` import section.
- **2.3** Rename "video" path to "Import SwingVision match" with clearer description. Link to `/player/tennis-analytics?action=import`.
- **2.5** Consider adding wearable connection as a step in the wizard (not just a path option).

---

## 3. Setup Checklist

**Files:** `src/components/onboarding/SetupChecklist.tsx`

### Current State
- 4 items: welcome, score match, connect Garmin, log training
- Personal-mode only, auto-hides when all complete
- Links to relevant pages

### Gaps
| # | Gap | Severity |
|---|-----|----------|
| 3.1 | No "Import SwingVision match" item | Medium |
| 3.2 | No "Explore analytics" item (was in consumer overlay strings) | Low |
| 3.3 | "Connect Garmin" is specific — should be "Connect wearable" (Garmin/Polar/Whoop) | Low |

### Recommended Changes
- **3.1** Add SwingVision import checklist item: `href: '/player/tennis-analytics?action=import'`
- **3.3** Update label from "Connect Garmin" to "Connect wearable" to match consumer overlay.

---

## 4. Player Dashboard (Home)

**Files:** `src/components/dashboard/home/PlayerHome.tsx`, `src/components/dashboard/home/cards/ConnectWearableCard.tsx`

### Current State
- Personal mode: SetupChecklist, StreakWidget, ConnectWearableCard, CalibrationBanner, UpcomingTrainingCard, AchievementsSection
- Organization mode: TennisHighlightCard, FitnessTestSnapshotCard, UpcomingTrainingCard, UpcomingTournamentCard
- ConnectWearableCard: empty-state CTA when no wearable connected
- HeroRingTrio: readiness, ACWR, training load rings
- Match count query only for personal mode

### Gaps
| # | Gap | Severity |
|---|-----|----------|
| 4.1 | No SwingVision import CTA card on dashboard | High |
| 4.2 | No "upgrade to unlock" CTAs for free-tier users | High |
| 4.3 | No tennis match summary/highlight for personal mode (only org mode) | Medium |
| 4.4 | ConnectWearableCard links to `/settings/wearables` but doesn't mention Polar/Whoop | Low |

### Recommended Changes
- **4.1** Add `ImportSwingVisionCard` — empty-state CTA shown when `hasMatches === false`, linking to tennis analytics import.
- **4.2** Add `UpgradeCard` or `UpsellBanner` shown when free-tier limits are hit (e.g., 7-day history limit, no AI).
- **4.3** Show `TennisHighlightCard` in personal mode too (not just org mode).

---

## 5. Navigation

**Files:** `src/components/navigation/BottomNav.tsx`, `src/components/navigation/Sidebar/navigationItems.tsx`

### Current State
- Personal mode: 5-tab consumer IA (Today, Matches, Log+, Progress, You)
- Center FAB: Log+ (scorekeeper) in personal mode, AI assistant in org mode
- `getConsumerTabs()` defines 6 items but BottomNav shows 5 (billing is 6th, hidden)
- Sidebar uses `getNavigationItems()` filtered by role + accountMode

### Gaps
| # | Gap | Severity |
|---|-----|----------|
| 5.1 | "Billing" tab defined but never shown (6th item, BottomNav slices to 5) | Medium |
| 5.2 | No "Charts" or "Wearables" tab in consumer navigation | Medium |
| 5.3 | AI assistant FAB hidden in personal mode — Athlete+ tier includes AI | High |
| 5.4 | "Matches" tab goes to `/player/tournaments` — should include scorekeeper matches | Low |

### Recommended Changes
- **5.1** Either show billing in a sub-menu under "You" or make it accessible from settings page.
- **5.3** Show AI assistant FAB for Athlete+ tier users in personal mode. Use `useFeatureGate().hasFeature('ai')` to conditionally show.
- **5.4** Consider renaming "Matches" to "Tennis" and linking to `/player/tennis-analytics` which shows both live and imported matches.

---

## 6. Stripe / Billing / Entitlements

**Files:** `src/lib/stripe/config.ts`, `src/lib/stripe/entitlements.ts`, `src/lib/auth/feature-gate.ts`, `src/hooks/useFeatureGate.ts`, `src/app/api/stripe/create-checkout/route.ts`, `src/components/pricing/BillingSettings.tsx`

### Current State
- 3 tiers: free, athlete ($), athletePlus ($$)
- Feature limits per tier defined in config
- `getEntitlement()` calls `get_subject_entitlement` RPC (cached 30s)
- `getFeatureGateForB2CUser()` overlays tier limits on brand features
- Checkout requires auth, creates Stripe session
- BillingSettings shows plan, invoices, Stripe portal
- Landing page pricing CTA: paid tiers → Stripe checkout, free → signup

### Gaps
| # | Gap | Severity |
|---|-----|----------|
| 6.1 | `get_subject_entitlement` RPC **does not exist** in prod — all entitlement checks fail silently to free | **Critical** |
| 6.2 | `useFeatureGate` hook only reads brand features, **doesn't check subscription tier** | **Critical** |
| 6.3 | No freemium upsell CTAs in UI when limits are hit | High |
| 6.4 | No "current plan" indicator in settings page | Medium |
| 6.5 | Checkout falls back to signup if user not logged in — no `?plan=` preservation | High |
| 6.6 | No billing link in main settings page (`src/app/[locale]/settings/page.tsx`) | Medium |

### Recommended Changes
- **6.1** Create `get_subject_entitlement` RPC in Supabase. Must check personal org subscriptions and org-seat fallback.
- **6.2** Update `useFeatureGate` to fetch entitlement from a new `/api/entitlement` endpoint (or pass via server component) and merge with brand features.
- **6.3** Add `UpsellBanner` component shown when free-tier limits are hit (7-day history, 1 sync/mo, no AI).
- **6.5** When checkout returns 401, redirect to `/signup?plan=athlete&interval=monthly` and preserve plan through signup → post-confirmation → checkout.
- **6.6** Add billing link to `SettingsPageClient` or settings page layout.

---

## 7. Wearable Integration

**Files:** `src/app/[locale]/settings/wearables/page.tsx`, `src/components/integrations/WearableIntegrationsPanel.tsx`, `src/components/dashboard/home/cards/ConnectWearableCard.tsx`

### Current State
- WearableIntegrationsPanel: Garmin, Polar, Whoop support
- Garmin OAuth callback handling with sync trigger
- ConnectWearableCard: empty-state CTA on dashboard
- Provider status hooks with optimistic updates
- Settings page at `/settings/wearables`

### Gaps
| # | Gap | Severity |
|---|-----|----------|
| 7.1 | No Apple Watch / HealthKit integration | Medium |
| 7.2 | ConnectWearableCard only mentions "wearable" generically — no provider logos | Low |
| 7.3 | No in-onboarding wearable connection (wizard links to settings page) | Medium |
| 7.4 | Free tier limited to 1 wearable sync/month — no visible counter | High |

### Recommended Changes
- **7.4** Add sync counter UI showing "X/1 syncs used this month" for free-tier users with upgrade CTA.

---

## 8. SwingVision Integration

**Files:** `src/components/tennis-analytics/TennisAnalyticsContent.tsx`, `src/app/api/tennis/import/route.ts`

### Current State
- SwingVision xlsx import in TennisAnalyticsContent
- Source tabs: SwingVision vs Live-scored
- Import supports xlsx file upload with date parsing from filename
- Match metadata: surface + date selection
- Coaches/parents can import for athletes/children

### Gaps
| # | Gap | Severity |
|---|-----|----------|
| 8.1 | No SwingVision CTA on player dashboard | High |
| 8.2 | No SwingVision item in setup checklist | Medium |
| 8.3 | Import UI buried in analytics page — not discoverable for new users | High |
| 8.4 | Onboarding wizard "video" path links to `/tennis-vision` (may not exist) | High |
| 8.5 | No SwingVision auto-pipeline integration (planned but not implemented) | Medium |

### Recommended Changes
- **8.1** Add `ImportSwingVisionCard` to PlayerHome (personal mode).
- **8.3** Add a prominent "Import match" button in the tennis analytics page header.
- **8.4** Fix onboarding wizard "video" path to link to `/player/tennis-analytics?action=import`.

---

## 9. AI Agent

**Files:** `src/lib/ai/prompts/systemPrompt.ts`, `src/lib/ai/utils/toolRouter.ts`

### Current State
- Personal mode: `getSoloPrompt()` (dedicated B2C prompt)
- Organization mode: role-based prompts (coach/admin, athlete/player, parent)
- Tool router has accountMode awareness
- 50+ tools across categories

### Gaps
| # | Gap | Severity |
|---|-----|----------|
| 9.1 | AI feature gated to Athlete+ tier only — free and athlete tiers have `ai: false` | Medium |
| 9.2 | No AI FAB in personal mode BottomNav (hidden, replaced by Log+) | High |
| 9.3 | No "upgrade to unlock AI" CTA when free-tier user tries to access AI | Medium |

### Recommended Changes
- **9.2** Show AI FAB for Athlete+ users in personal mode. Use feature gate to conditionally render.
- **9.3** Add upgrade modal when free/athlete user clicks AI FAB.

---

## 10. Middleware & Routing

**Files:** `src/middleware.ts`, `src/middleware/auth.ts`, `src/middleware/authorization.ts`

### Current State
- Auth: session validation, org isolation, role-based redirects
- Authorization: personal-mode blocked from /management, /club-admin, /admin, /messages, /genetics, /labs
- /overview fast-redirects to role dashboard
- Profile cache with 30-min TTL

### Gaps
| # | Gap | Severity |
|---|-----|----------|
| 10.1 | Personal-mode users can still access `/coach` if their role is `coach` | Low |
| 10.2 | No redirect from `/charts` to `/player` for personal-mode (charts is allowed) | Low |
| 10.3 | `/overview` still renders for admins and pending-approval users — academy-oriented | Low |

### Recommended Changes
- No critical changes needed. Authorization is well-structured for B2C.

---

## 11. Landing Page

**Files:** `src/app/[locale]/page.tsx`, `src/components/landing/PlatformLanding.tsx`

### Current State
- Audience switcher: athletes vs academies
- Pricing tiers: athletes see free/athlete/athletePlus, academies see coach/academy
- B2C paid tiers → Stripe checkout (falls back to signup)
- Sticky CTA after scroll
- Hero with animated title, feature cards, testimonials

### Gaps
| # | Gap | Severity |
|---|-----|----------|
| 11.1 | Root page metadata says "tennis academies" — not B2C friendly | Medium |
| 11.2 | No "Get started free" CTA — pricing CTA goes to checkout or signup | Medium |
| 11.3 | No app store / PWA install CTA | Low |

### Recommended Changes
- **11.1** Update metadata to be B2C-friendly: "Peak Performance — Train smarter with wearable data, match analytics, and AI coaching."
- **11.2** Add "Start free" CTA button in hero section.

---

## 12. Consumer i18n Overlay

**Files:** `src/i18n/consumer-overlay.ts`, `messages/overlays/consumer/en.json`

### Current State
- Deep-merges consumer strings over base messages when `accountMode === 'personal'`
- Covers: nav, dashboard, settings, onboarding, AI, tennis analytics, integrations, profile, account, subscription, genetics, tennis vision
- 4 locales: en, es, ca, zh

### Gaps
| # | Gap | Severity |
|---|-----|----------|
| 12.1 | Missing overlay strings for: charts page, training page, tournaments page | Medium |
| 12.2 | "coach" → "AI Coach" overlay may confuse when AI is not available on free tier | Low |
| 12.3 | No overlay for email templates (confirmation, password reset) | Low |

### Recommended Changes
- **12.1** Add overlay strings for charts, training, and tournaments pages.

---

## 13. Settings Page

**Files:** `src/app/[locale]/settings/page.tsx`, `src/app/[locale]/settings/billing/page.tsx`, `src/components/pricing/BillingSettings.tsx`

### Current State
- Settings page: ProfileEditor + SettingsPageClient
- Billing page: BillingSettings with plan info, invoices, Stripe portal
- No visible link from settings → billing in the main settings page

### Gaps
| # | Gap | Severity |
|---|-----|----------|
| 13.1 | No billing/subscription link in settings page | Medium |
| 13.2 | No "delete account" or "export data" in settings (GDPR) — referenced in overlay but not implemented | Medium |
| 13.3 | No notification preferences UI | Low |

### Recommended Changes
- **13.1** Add "My Subscription" link in settings page that goes to `/settings/billing`.
- **13.2** Verify `cleanup_user_data` RPC is wired to a delete-account UI. Add data export endpoint.

---

## 14. Empty States

**Files:** `src/components/dashboard/shared/EmptyStates.tsx`

### Current State
- Generic empty states: NoAthletesAssigned, NoWearablesData, NoGoalsCreated, NoTestResults, NoObservations, NoAlerts, NoAchievements, NoCalendarSessions
- No B2C-specific empty states with CTAs

### Gaps
| # | Gap | Severity |
|---|-----|----------|
| 14.1 | No "Import your first SwingVision match" empty state | Medium |
| 14.2 | No "Connect a wearable to see readiness" empty state with direct link | Medium |
| 14.3 | No "Upgrade to unlock this feature" empty state | Medium |

### Recommended Changes
- Add B2C-specific empty states with action buttons (connect wearable, import match, upgrade plan).

---

## Priority Ranking

### P0 — Critical (blocks B2C launch)
1. **6.1** Create `get_subject_entitlement` RPC — all billing/entitlement checks broken
2. **6.2** Fix `useFeatureGate` to check subscription tier — client-side gating broken
3. **1.1** Simplify signup roles for platform (B2C) — confusing for individuals
4. **6.5** Preserve `?plan=` through signup → checkout — revenue loss

### P1 — High (degrades B2C experience)
5. **8.1** Add SwingVision import CTA to player dashboard
6. **4.2** Add freemium upsell CTAs when limits are hit
7. **9.2** Show AI FAB for Athlete+ users in personal mode
8. **2.1** Skip redundant role step in onboarding wizard
9. **2.2** Fix `/tennis-vision` route in onboarding paths
10. **5.3** AI assistant access for Athlete+ tier in personal mode
11. **1.5** Default role to `player` for platform signup

### P2 — Medium (polish & completeness)
12. **3.1** Add SwingVision to setup checklist
13. **4.3** Show TennisHighlightCard in personal mode
14. **11.1** Update landing page metadata for B2C
15. **13.1** Add billing link in settings page
16. **12.1** Complete consumer i18n overlay strings
17. **7.4** Add wearable sync counter for free tier
18. **1.3** Improve post-signup redirect flow
19. **4.1** Add SwingVision import card to dashboard

### P3 — Low (nice-to-have)
20. **10.1** Tighten personal-mode route restrictions
21. **11.2** Add "Start free" CTA in hero
22. **14.1-14.3** B2C-specific empty states
23. **3.3** Rename "Connect Garmin" to "Connect wearable"
24. **5.4** Rename "Matches" tab to "Tennis"
25. **13.2** Wire GDPR delete/export to UI

---

## Architecture Strengths (Keep These)

- **Personal org model**: All org-scoped RLS works without modification
- **Consumer i18n overlay**: Clean deep-merge pattern for B2C strings
- **5-tab mobile nav**: Consumer IA with Log+ FAB is well-designed
- **Feature gate architecture**: Server-side `getFeatureGateForB2CUser` is correct (just not wired to client)
- **Stripe tier config**: Clean tier definitions with env-var price IDs
- **Onboarding gate**: Simple, effective trigger for personal-mode users
- **Middleware authorization**: Personal-mode route blocking is comprehensive
- **Setup checklist**: Good progressive disclosure for new users
