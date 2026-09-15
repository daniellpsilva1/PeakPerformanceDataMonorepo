---
id: PPD-PORTFOLIO-GOV-STANDARD
last_reviewed: 2026-09-13
owner: daniel
schema_version: 1
status: draft
title: Documentation standard
type: reference
visibility: internal
---

# Documentation standard

This document defines the authority, freshness, metadata, and quality rules for all managed documentation in the PeakPerformanceData portfolio.

## Authority layers

Documentation is classified into five authority layers. A conflict between layers creates a tracked gap, not a silent rewrite.

1. **Accepted product intent** — requirements, user journeys, UX acceptance, non-goals. Code does not automatically define what the product should do.
2. **Accepted engineering decisions** — RFC conclusions and ADRs. Retrospective rationale is explicitly retrospective; unknown historic rationale remains unknown.
3. **Observed implementation** — source-linked architecture, contracts, and configuration at a recorded revision.
4. **Execution evidence** — actual test, run, and release records with environment, revisions, outcome, and limitations.
5. **Historical/research material** — preserved provenance, excluded from default implementation context until reconciled.

## Status labels

Every managed document carries one of these status values in its frontmatter:

| Status | Meaning |
|---|---|
| `draft` | Author is working; not yet authoritative |
| `accepted` | Approved by the owner; current source of truth for its scope |
| `superseded` | Replaced by a named successor document |
| `archived` | Retained for provenance; not active authority |

## Freshness rules

- `last_reviewed` records the date a human or agent verified the document against its source evidence.
- A date refresh alone does not constitute factual revalidation. The reviewer must confirm source references still resolve.
- Proposed review cadence: high-risk operations/security docs every 90 days; broader portfolio every 180 days. These are reminders, not completion deadlines.

## Evidence classification

Every factual claim in a managed document must be classifiable as one of:

- **Observed fact** — verified from source at a recorded revision.
- **Inference** — derived from source but not directly stated.
- **Proposed design** — not yet implemented.
- **Unverified claim** — stated but not yet checked against source.
- **Historical information** — accurate at a past point in time; may not reflect current state.

## Source references

Managed documents cite source evidence using structured references in frontmatter (`source_refs`) or inline. A source reference includes:

- `repo_id` — the repository identity from `docs/repositories.json`.
- `path` — repository-relative POSIX path.
- `revision` — commit SHA or declared dependency selector.
- `symbol` — optional function, class, or module name.

Paths are never absolute user-local paths (`/Users/...`). Symbol verification uses supported parser adapters only; unsupported symbols are flagged, not guessed.

## Ownership

- `owner` identifies the accountable human (currently `daniel`).
- Agents are authors and review assistants, not independent approval authorities.
- An `accepted` status requires a real `approval_ref` resolving to a decision record. Solo-maintainer decisions are recorded as dated decision records.

## What documentation must not do

- Describe a desired control as implemented.
- Treat a test file as a passing run.
- Treat a date refresh as factual revalidation.
- Infer PR merge/closed/open status without authoritative evidence.
- Claim CI success when a job uses `continue-on-error`.
- Claim security verification when the test is non-blocking or incomplete.
- Claim server-side bearer-token verification merely because a client forwards a token.
- Treat `pnpm test` as a complete suite if it starts watch mode.
- Invent test commands for repositories that do not define them.
- Expose secrets in documentation. Use synthetic identifiers and fixtures.
