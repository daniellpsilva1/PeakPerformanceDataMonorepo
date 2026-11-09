# UI redesign commit plan

Proposed commit grouping (app repo: `PeakPerformanceData/peak_performance_data`,
git submodule — commit inside it, not the monorepo root). Headers follow the
allowed prefix set and stay under 52 chars.

## 1. `Improve assistant env flag blank handling`
- src/lib/ai/assistant-state.ts
- tests/lib/ai/assistant-state.test.ts

## 2. `Update bottom nav tabs and AI orb`
- src/components/navigation/BottomNav.tsx
- tests/navigation/BottomNav.test.tsx
- tests/navigation/BottomNav.assistant-matrix.test.tsx

## 3. `Move environment badge beside brand logo`
- src/components/layouts/AppShell.tsx
- src/components/layouts/EnvironmentBadge.tsx
- src/components/ui/AccountMenu.tsx
- src/components/ui/NavBar.tsx
- tests/app/shell-responsive.test.tsx

## 4. `Narrow sidebar and remove More collapse`
- src/components/navigation/Sidebar/Sidebar.tsx
- src/components/navigation/Sidebar/SidebarNavItem.tsx
- src/components/navigation/Sidebar/SidebarNavigation.tsx
- tests/navigation/Sidebar.test.tsx
- tests/navigation/SidebarMobile.test.tsx

## 5. `Darken launch surface and brand icons`
- src/app/[locale]/layout.tsx
- src/app/api/manifest/route.ts
- src/app/api/splash/route.tsx
- src/lib/branding/brand-service.ts
- src/middleware/brand.ts
- scripts/generate-brand-icons.mjs
- public/icons/*, public/apple-touch-icon*, public/favicon-*
- tests/app/seo-metadata.test.ts, tests/app/layout-cold-start.test.tsx
- tests/lib/branding/theme-css.test.ts

## 6. `Improve shared UI primitives`
- src/components/ui/badge.tsx (+ status-dot.tsx)
- src/components/ui/settings-row.tsx
- src/components/ui/tabs.tsx, sheet.tsx, button.tsx, input.tsx, select.tsx
- src/components/ui/form/form-layout.tsx, modern-form-card.tsx
- src/components/mobile/ResponsiveDialog.tsx
- src/lib/design-tokens.ts, tailwind.config.js
- tests/components/ui/*

## 7. `Update dashboards and page chrome`
- dashboard + coach home card/metric changes
- tests/components/dashboard/*

## 8. `Simplify players list and filters`
- src/app/[locale]/coach/players/CoachPlayersPageClient.tsx
- tests/app/coach/players-page.test.tsx

## 9. `Improve training schedule mobile layout`
- src/components/management/training/*.tsx
- tests/components/management/training/*, tests/app/management/training/*

## 10. `Compact settings surfaces`
- src/components/settings/*, src/app/[locale]/settings/*
- src/components/admin/OrganizationSettingsForm.tsx
- src/components/pricing/BillingSettingsClient.tsx
- src/components/integrations/WearableIntegrationsPanel.tsx
- tests/components/settings/*

## 11. `Simplify reports rows and filters`
- src/components/coach/reports/*, ReportsPageClient
- src/app/[locale]/coach/reports/*
- tests/components/coach/*

## 12. `Update locale keys and i18n audit`
- messages/*.json
- scripts/check-i18n-keys.mjs, package.json (check:i18n-reports)

## 13. `Update docs and verification scripts`
- docs/DESIGN.md
- scripts/check-mobile-ui-rules.mjs
- _plans/* (monorepo root — separate repo, commit there if tracked)
