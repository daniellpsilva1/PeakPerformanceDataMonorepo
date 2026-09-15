---
id: PPD-PORTFOLIO-RECONCILIATION-HISTORICAL
last_reviewed: 2026-09-13
owner: daniel
related:
  - docs/audits/documentation-baseline.md
  - docs/governance/documentation-standard.md
schema_version: 1
status: draft
title: Historical reconciliation
type: explanation
visibility: internal
---

# Historical reconciliation

This document records how existing historical documents were treated during the documentation system rollout. Historical documents are preserved, not deleted. Stale content gets a dated correction notice and a supersession link.

## Reconciliation dispositions

| Disposition | Meaning | Applied to |
|---|---|---|
| **Preserve with correction notice** | Keep content, add frontmatter + correction notice | Stale but useful docs |
| **Supersede** | Keep as historical, link to new authoritative doc | Docs replaced by new system |
| **Archive** | Mark as `archived` status, keep for evidence | Docs no longer current |
| **Migrate** | Move content to new location with redirect | Docs that need reorganization |
| **Leave untouched** | No change needed | Docs that are still current |
| **Flag as gap** | Document the gap, do not fix | Docs that reveal missing coverage |
| **Backlog** | Add to remediation backlog | Docs that reveal code/infra gaps |

## Per-document reconciliation

### Root docs

| Document | Disposition | Notes |
|---|---|---|
| `README.md` | Preserve with correction notice | Added frontmatter; notes incomplete submodule list (DG-01) |
| `docs/api.md` | Preserve with correction notice | Added frontmatter; notes simplified paths (DG-10) |
| `docs/architecture.md` | Preserve with correction notice | Added frontmatter; notes not source-linked |
| `docs/database.md` | Preserve with correction notice | Added frontmatter; notes missing Vision/SwingVision stores (DG-09) |
| `docs/review-findings.md` | Archive | Added frontmatter with `archived` status; several findings now stale (DG-04) |
| `docs/setup.md` | Preserve with correction notice | Added frontmatter; notes npm vs pnpm conflict (DG-03) |

### App docs

| Document | Disposition | Notes |
|---|---|---|
| `docs/design-system.md` | Leave untouched | Still current |
| `docs/launch-checklist.md` | Leave untouched | Still current |
| `docs/premium-design-overhaul-v2.md` | Flag as gap | Needs review for current relevance |
| `AGENTS.md` (app) | Leave untouched | Pre-existing, not managed by docs system |

### Backend docs

| Document | Disposition | Notes |
|---|---|---|
| `docs/README.md` | Leave untouched | Athlete report docs, not engineering docs |
| `docs/index.html` | Leave untouched | Athlete report UI |

### Extraction docs

| Document | Disposition | Notes |
|---|---|---|
| `memory_bank/extraction-pipeline.md` | Flag as gap | Historical, needs review |
| `memory_bank/garmin-data-extraction.md` | Flag as gap | Historical, needs review |
| `memory_bank/open-wearables.md` | Flag as gap | Historical, needs review |
| `memory_bank/polar-whoop-integration-research.md` | Flag as gap | Historical, needs review |

### Research docs

| Document | Disposition | Notes |
|---|---|---|
| `00_briefable_research_memo.md` | Leave untouched | Current research memo |
| `STATUS.md` | Leave untouched | Current gap register |
| `pdfs/` | Flag as gap | Rights/provenance needs verification (DG-22) |

## Gap register cross-reference

| Gap ID | Description | Disposition |
|---|---|---|
| DG-01 | README lists fewer submodules than .gitmodules | Preserve with correction notice |
| DG-02 | Legacy extraction lifecycle unconfirmed | Flag as gap |
| DG-03 | Setup guide says npm, app declares pnpm | Preserve with correction notice |
| DG-04 | Review findings claim Stripe incomplete (now stale) | Archive |
| DG-05 | render.yaml references Strava env vars | Flag as gap |
| DG-06 | Role name differences (admin vs club_admin) | Document, do not normalize |
| DG-09 | Database doc omits Vision/SwingVision stores | Preserve with correction notice |
| DG-10 | API doc uses simplified paths | Preserve with correction notice |
| DG-16 | Historical future agent architecture differs from code | Flag as gap |
| DG-17 | AI agent evaluation is incomplete | Flag as gap |
| DG-18 | Extraction backend trusts X-User-Id without verification | Backlog |
| DG-21 | Minimal Courtviz enrichment differs from full join | Flag as gap |
| DG-22 | PDF rights/provenance unverified | Flag as gap |
| DG-23 | ACWR disagreement (research vs code) | Document, do not resolve |
| DG-24 | AI Videos repository is empty | Flag as gap |

## What this document does not claim

- That all historical documents have been reviewed (some are flagged for future review).
- That the reconciliation is final (it may be updated as gaps are resolved).
- That archived documents are false (they are historical evidence).
- That correction notices are exhaustive (they point to the most significant gaps only).
