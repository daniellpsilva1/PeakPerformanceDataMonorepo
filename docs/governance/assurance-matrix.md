---
id: PPD-PORTFOLIO-SDLC-ASSURANCE-MATRIX
last_reviewed: 2026-09-13
owner: daniel
related:
  - docs/governance/sdlc.md
  - docs/governance/evidence-and-traceability.md
schema_version: 1
status: draft
title: SDLC assurance matrix
type: reference
visibility: internal
---

# SDLC assurance matrix

This matrix maps each SDLC stage to required artifacts, verification levels, and current status. It operationalizes the governance documents into a checkable grid.

## Verification levels

| Level | Meaning |
|---|---|
| **Declared** | A document or command exists in the repository |
| **Prerequisites validated** | Dependencies and environment needed to run the check are confirmed present |
| **Executed** | The check has been run and produced output |
| **Enforced** | The check blocks merge or deployment when it fails |

A declared check is not necessarily runnable. Missing dependencies, missing private submodules, or unavailable renderers must produce explicit incomplete status rather than success.

## Risk tiers

| Tier | Criteria | Required artifacts |
|---|---|---|
| **Low** | Documentation-only, typo fix, dependency bump | PR description |
| **Medium** | New API endpoint, UI feature, config change | Change brief + test plan |
| **High** | Cross-service change, schema migration, auth change, data flow change | PRD + design RFC + ADR + test plan + release record |

## Assurance matrix

| Stage | Artifact | Low | Medium | High | Current status |
|---|---|---|---|---|---|
| Discovery | Problem statement | — | Optional | Required | Template exists |
| Discovery | Customer evidence | — | Optional | Required | Template exists |
| Design | Change brief | — | Required | Required | Template exists |
| Design | Design RFC | — | — | Required | Template exists |
| Design | ADR | — | Optional | Required | Template exists, ADR-0001 exists |
| Design | UX spec | — | If UI change | If UI change | Template exists |
| Implementation | Source code | Required | Required | Required | Per-repo |
| Testing | Unit tests | Optional | Required | Required | Per-repo |
| Testing | Integration tests | — | Optional | Required | Per-repo |
| Testing | E2E tests | — | — | If UI change | Per-repo |
| Testing | Test plan | — | Required | Required | Template exists |
| Release | Release record | — | Optional | Required | Template exists |
| Release | Rollback plan | — | — | Required | Template exists |
| Operations | Runbook | — | If operational | If operational | Template exists |
| Operations | Postmortem | If incident | If incident | If incident | Template exists |

## Worked example: Wearable provider addition

This example traces a hypothetical "add Suunto provider" change through the matrix.

| Stage | Artifact | Content | Evidence |
|---|---|---|---|
| Discovery | Problem statement | "Users want Suunto data in PPD" | `docs/templates/prd.md` |
| Design | Change brief | Add Suunto to `VALID_PROVIDERS`, extraction sync, app BFF | `docs/templates/change-brief.md` |
| Design | ADR | Choose OpenWearables adapter vs direct API | `docs/templates/adr.md` |
| Implementation | Source code | `provider_data.py`, `wearablesync-client.ts` | Per-repo |
| Testing | Test plan | OAuth flow, sync, tenant isolation, rate limit | `docs/templates/test-plan.md` |
| Release | Release record | Extraction + app coordinated deploy | `docs/templates/release-record.md` |

## Worked example: Tennis scoring rule change

| Stage | Artifact | Content | Evidence |
|---|---|---|---|
| Discovery | Problem statement | "Add no-ad scoring option" | `docs/templates/prd.md` |
| Design | Design RFC | Reducer change, outbox compatibility, Courtviz adapter | `docs/templates/design-rfc.md` |
| Implementation | Source code | `rules.ts`, `types.ts` | `src/lib/tennis/scorekeeper/` |
| Testing | Test plan | Reducer unit, outbox, Courtviz adapter, E2E scorekeeper | `docs/templates/test-plan.md` |
| Release | Release record | App-only deploy (no backend change) | `docs/templates/release-record.md` |

## What this matrix does not claim

- That all existing changes followed this matrix (they did not — this is a new system).
- That the risk tiers are exhaustive (they are starting points for discussion).
- That CI enforcement is in place (WP-17 will add it).
- That all templates have been validated against real changes (they are drafts).
