---
id: PPD-PORTFOLIO-ADR-0003
last_reviewed: 2026-10-02
owner: daniel
related:
  - docs/decisions/0002-ai-proposal-approval-model.md
schema_version: 1
source_refs:
  - path: src/i18n/routing.config.ts
    repo_id: app
    revision: 9617bbbcc00b4b09aeb24d54f6588ab48029458a
  - path: src/lib/i18n/locale-preference.ts
    repo_id: app
    revision: 9617bbbcc00b4b09aeb24d54f6588ab48029458a
  - path: src/app/[locale]/login/page.tsx
    repo_id: app
    revision: 9617bbbcc00b4b09aeb24d54f6588ab48029458a
  - path: src/components/ui/LanguageSwitcher.tsx
    repo_id: app
    revision: 9617bbbcc00b4b09aeb24d54f6588ab48029458a
  - path: src/components/ui/LanguageSheet.tsx
    repo_id: app
    revision: 9617bbbcc00b4b09aeb24d54f6588ab48029458a
  - path: src/app/api/user/language/route.ts
    repo_id: app
    revision: 9617bbbcc00b4b09aeb24d54f6588ab48029458a
  - path: src/app/api/manifest/route.ts
    repo_id: app
    revision: 9617bbbcc00b4b09aeb24d54f6588ab48029458a
status: draft
title: ADR-0003 — Locale persistence via NEXT_LOCALE cookie and profile preference
type: adr
visibility: internal
---

# ADR-0003 — Locale persistence via NEXT_LOCALE cookie and profile preference

## Decision status

Draft — implemented in app commit `9617bbbc` on branch `fix/coach-mobile-ux-2026-10`; pending owner approval.

## Context

Before this change, the `NEXT_LOCALE` cookie written by next-intl middleware was a session cookie, so every browser or installed-PWA restart discarded the user's language choice and re-guessed the locale from `Accept-Language`. A signed-in user whose browser sent a Catalan `Accept-Language` would land back on `/ca` regardless of the language they had picked. Separately, language switchers wrote the preference to `localStorage`, but no code ever read it back — the write was dead code. Login itself did not consult the profile's `preferred_language`, so the post-login redirect could undo the user's stored preference.

Observed symptoms: signed-in users bounced back to the browser-detected locale after restarts, and the login page redirected by cookie/browser locale even when the profile disagreed.

## Options considered

- **One-year cookie + profile preference (chosen).** The cookie covers everyone (including signed-out visitors), and `profiles.preferred_language` is the durable source of truth for signed-in users; the cookie is kept in sync so middleware can resolve the locale without a database read.
- **`localStorage` only.** Rejected: middleware runs on the server and cannot read `localStorage`, so the first response after a restart would still be in the wrong locale. The pre-existing write-only `localStorage` code proved this path was already broken.
- **Disable `Accept-Language` detection entirely.** Rejected: first-time visitors with no cookie would always get English, which is worse for non-English audiences than detection.
- **Profile column only.** Rejected: anonymous visitors have no profile row, and reading the database inside middleware on every request adds latency to every navigation.

## Decision

1. `NEXT_LOCALE` is a persistent one-year cookie: `routing.config.ts` sets `localeCookie: { maxAge: 60 * 60 * 24 * 365 }` (`peak_performance_data/src/i18n/routing.config.ts:9`) and `peak_performance_data/src/lib/i18n/locale-preference.ts` exposes `writeLocaleCookie` (`max-age=31536000`, `samesite=lax`, `secure` on https) plus `LOCALE_COOKIE`, `SUPPORTED_LOCALES`, `stripLocalePrefix`, and `isSupportedLocale`.
2. For signed-in users, `profiles.preferred_language` is the source of truth; `/api/user/language` writes it (`peak_performance_data/src/app/api/user/language/route.ts`).
3. Login precedence is **profile → auth metadata → current locale → `en`** (`peak_performance_data/src/app/[locale]/login/page.tsx:156–165`). When the profile preference disagrees with `user_metadata.preferred_language`, the metadata is healed to match (`login/page.tsx:167–169`); role and language are never trusted from client-writable `user_metadata` alone.
4. Every switcher uses one `useLanguageChange` hook (`peak_performance_data/src/components/ui/LanguageSwitcher.tsx:57`): it writes the cookie, saves the profile preference for signed-in users, refreshes the session, and reloads. Switchers (account menu, sidebar, settings, profile) open the shared `LanguageSheet` (`peak_performance_data/src/components/ui/LanguageSheet.tsx`) instead of maintaining separate menus.
5. The web-app manifest `start_url` is `/` (`peak_performance_data/src/app/api/manifest/route.ts:73`), so PWA launches re-resolve the saved locale instead of deep-linking a stale language prefix.
6. `Accept-Language` detection is unchanged: unauthenticated visitors with no cookie still get their browser language.

## Consequences

- Signed-in users keep their language across restarts and devices; anonymous visitors keep browser detection until they pick a language, after which the cookie persists it.
- The cookie can disagree with the profile when a user changes language on another device; login re-synchronizes the cookie from the profile, so drift self-heals on next sign-in.
- All eight supported locales (`en`, `es`, `ca`, `zh`, `nl`, `de`, `fr`, `pt`) share the same code path; adding a locale requires no switcher changes.
- The locale cookie is `samesite=lax` and non-HttpOnly by design — the client must be able to write it. It contains only a language tag, no user data.

## What this document does not claim

- That the decision is approved — it is a draft pending owner review.
- That locale is applied on the server before hydration for signed-in users without a cookie; first paint follows the cookie/browser, then the profile sync.
- Any measurement of how often profile-vs-cookie drift occurred in production before the fix.

## References

- Implementation: app commit `9617bbbcc00b4b09aeb24d54f6588ab48029458a` (branch `fix/coach-mobile-ux-2026-10`).
- Tests: `tests/lib/i18n/locale-preference.test.ts`, `tests/components/ui/useLanguageChange.test.tsx`, `tests/components/ui/LanguageSheet.test.tsx`, `tests/app/login-locale.test.tsx`, `tests/api/user/language.test.ts`, `tests/api/manifest.test.ts`.
