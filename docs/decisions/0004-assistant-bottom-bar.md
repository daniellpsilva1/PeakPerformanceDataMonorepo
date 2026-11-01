---
id: PPD-PORTFOLIO-ADR-0004
last_reviewed: 2026-11-01
owner: daniel
related:
  - docs/decisions/0003-locale-persistence.md
  - PeakPerformanceData/peak_performance_data/docs/architecture/i18n-and-shell.md
schema_version: 1
source_refs:
  - path: src/components/navigation/BottomNav.tsx
    repo_id: app
    revision: 75a05373125344a74e2a1fc5634acb789f4c6ba7
  - path: src/components/ai/AssistantFab.tsx
    repo_id: app
    revision: 75a05373125344a74e2a1fc5634acb789f4c6ba7
  - path: src/app/globals.css
    repo_id: app
    revision: 75a05373125344a74e2a1fc5634acb789f4c6ba7
status: draft
title: ADR-0004 — Assistant button lives in the bottom bar centre slot (supersedes drawer-only placement)
type: adr
visibility: internal
---

# ADR-0004 — Assistant button lives in the bottom bar centre slot (supersedes drawer-only placement)

## Decision status

Proposed — pending owner (daniel) approval. Implemented on the working
tree at `75a05373` (uncommitted); this ADR is drafted by an agent for
owner ratification.

## Context

The assistant entry point moved several times: commit `3538cf08` added a
centre `Bot` button for org modes and made `AssistantFab` desktop-only;
`0f110086` then removed the centre slot ("Organization modes: even 4-tab
bar. The assistant lives in the drawer"); a later "2026-10 owner decision"
comment restored a floating FAB "on every viewport". The result was
inconsistent: personal mode had no assistant on the bar (the centre slot
was the Log+ scorekeeper link), and the mobile FAB competed with the new
bar for the same gesture area.

The owner explicitly overrode the drawer-only decision (2026-11-01): the
assistant must be reachable on every authenticated page, for every role
and account mode, as part of the mobile chrome — not hidden in a drawer.

## Decision

- Mobile bottom bar always has a raised centre slot: `2 tabs | assistant
  | 2 tabs`, for all roles and both account modes (personal + org).
- The centre button is the `Bot` icon on the `bg-assistant` (#2563EB)
  token, `h-14 w-14`, raised `-translate-y-1/2` with a `ring-4
  ring-background` cut-out; it opens the layout-owned assistant modal.
- The only entitlement gates are the env flag
  (`NEXT_PUBLIC_ENABLE_AI_VOICE_ASSISTANT`) and `hasFeature('ai')`. The
  bar itself keeps its existing visibility gates (public route, no user,
  loading, keyboard, fullscreen thread, assistant open). When a gate
  fails, the bar falls back to even tabs with no centre slot.
- Personal mode: Log+ became a normal right-side tab; the 5th item
  (`/settings`) was dropped from the bar only — it remains reachable via
  the drawer footer link and the account menu (owner confirmation
  requested: RG-67 in `docs/audits/remediation-backlog.md`).
- `AssistantFab` is desktop-only (`hidden md:flex`); its desktop
  suppression rules are unchanged.
- `--bottom-nav-raised-overhang` reserves the raised button's protrusion
  so fixed bottom UI is never covered.

## Alternatives considered

- **Keep assistant in drawer + floating FAB** — rejected by owner; the
  FAB overlapped content and was gated inconsistently across routes.
- **Keep Log+ as the raised centre link and put the assistant in a
  drawer** — rejected; the assistant is the prioritized action and must
  be one tap from every authenticated page.
- **Show a locked/upsell button when `hasFeature('ai')` is false** —
  deferred; see RG-66 in `docs/audits/remediation-backlog.md`.

## Consequences

- One gesture path on mobile for all roles; Log+ loses its promoted
  centre position (two taps via the right tab instead of one).
- The old suppression list (consent banner, install prompt, coach-players
  bulk actions, `/messages`, `/tennis-scorekeeper`) no longer hides the
  in-bar button — it can coexist with those surfaces.
- iOS safe-area and clearance accounting moved into a shared CSS var, so
  future raised chrome must register through the same mechanism.
