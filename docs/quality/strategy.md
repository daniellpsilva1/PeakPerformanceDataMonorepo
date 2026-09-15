---
id: PPD-PORTFOLIO-QUALITY-STRATEGY
last_reviewed: 2026-09-13
owner: daniel
related:
  - docs/governance/sdlc.md
  - docs/quality/verification-matrix.md
schema_version: 1
status: draft
title: Quality strategy
type: reference
visibility: internal
---

# Quality strategy

## Principles

1. **Evidence over assertion.** A test file is not proof of a passing run. A forwarded token is not proof of verified identity. A refreshed date is not factual revalidation.
2. **Risk-based rigor.** Not every change needs the same depth. Low-risk changes need lightweight checks; high-risk changes need coordinated plans and evidence.
3. **Honest gaps.** When coverage is incomplete, the gap is documented and tracked, not hidden.
4. **Source-linked verification.** Verification claims cite the source paths and commands that produced them.

## Risk tiers

| Tier | Examples | Required artifacts |
|---|---|---|
| Low | Docs, typos, dep bumps | PR description, basic checks |
| Medium | New endpoints, UI features, config | Change brief, test plan |
| High | Auth, billing, schema, cross-service, health/genetics | PRD, design RFC, ADR, test plan, release record |

## Verification states

The portfolio distinguishes four verification states:

| State | Meaning |
|---|---|
| declared | A test or check is present in the repo |
| prerequisites-validated | The test or check has been confirmed runnable (deps installed, env available) |
| executed | The test or check has been run and produced output |
| enforced | The test or check gates merges or deployments |

See `docs/quality/verification-matrix.md` for the current state of each check.

## What this strategy does not claim

- That all checks are enforced (most are advisory during rollout).
- That high-risk changes always receive full artifacts (this is the target, not the current reality).
- That the verification matrix is exhaustive (it covers known checks).
