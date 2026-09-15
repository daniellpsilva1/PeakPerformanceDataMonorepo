---
id: PPD-PORTFOLIO-NAV-DOCS-INDEX
last_reviewed: 2026-09-13
owner: daniel
schema_version: 1
status: draft
title: Documentation index
type: overview
visibility: internal
---

# PeakPerformanceData documentation

This is the root documentation index for the PeakPerformanceData monorepo. Documentation is repository-first: each repository owns its local docs, and this index provides cross-repository navigation.

## Getting started

- **New to the project?** Read the root [`AGENTS.md`](../AGENTS.md) for the concise entry point.
- **Looking for a repository?** See [`repositories.json`](repositories.json) for the complete catalog of 14 direct repositories and 2 nested dependency occurrences.
- **Understanding the documentation system?** Read the [`documentation standard`](governance/documentation-standard.md) and [`SDLC process`](governance/sdlc.md).

## Governance

| Document | Purpose |
|---|---|
| [Documentation standard](governance/documentation-standard.md) | Authority, freshness, metadata, and quality rules |
| [SDLC process](governance/sdlc.md) | Risk-based lifecycle and artifact requirements |
| [Evidence and traceability](governance/evidence-and-traceability.md) | How claims are linked to verifiable source evidence |
| [Maintenance](governance/maintenance.md) | How documentation stays current |
| [Research basis](governance/research-basis.md) | Primary sources informing this system |

## Architecture

| Document | Status | Notes |
|---|---|---|
| [Architecture overview](architecture.md) | Draft | Useful but not source-linked; will be superseded |
| [API reference](api.md) | Draft | Simplified paths; needs router composition review |
| [Database schema](database.md) | Draft | Omits Vision and SwingVision stores |
| [Setup guide](setup.md) | Draft | Stale: says npm while frontend declares pnpm |

## Audits

| Document | Purpose |
|---|---|
| [Documentation baseline](audits/documentation-baseline.md) | Starting evidence baseline with 26 documented gaps |
| [Review findings (historical)](review-findings.md) | Dated security review; several claims now stale |

## Decisions

| Document | Status |
|---|---|
| [ADR-0001: Documentation system](decisions/0001-documentation-system.md) | Draft |

## Templates

| Template | When to use |
|---|---|
| [Change brief](templates/change-brief.md) | Medium and high-risk changes |
| [PRD](templates/prd.md) | New product capabilities |
| [Design RFC](templates/design-rfc.md) | High-risk or cross-service changes |
| [ADR](templates/adr.md) | Architectural decisions |
| [UX spec](templates/ux-spec.md) | User-facing changes |
| [Test plan](templates/test-plan.md) | Medium and high-risk changes |
| [Release record](templates/release-record.md) | Behavior that ships |
| [Runbook](templates/runbook.md) | Operational systems |
| [Postmortem](templates/postmortem.md) | Incidents |
| [Model/metric card](templates/model-or-metric-card.md) | Metrics, models, scientific claims |

## Repository families

| Family | Repositories | Documentation status |
|---|---|---|
| Main app | `app` | Pending local docs |
| Backend services | `backend`, `extraction`, `legacy-extraction`, `vision`, `agent` | Pending local docs |
| Video pipeline | `swingvision` | Pending local docs |
| Visualization libraries | `courtviz`, `bodyviz` | Pending local docs |
| Marketing media | `academies`, `ai-videos`, `manim`, `remotion` | Pending local docs |
| Research | `research` | Pending local docs |

## Tooling

The documentation checker lives at `.devin/docs-tooling/`. Run it with:

```bash
node .devin/docs-tooling/src/cli.mjs check --repo .
node .devin/docs-tooling/src/cli.mjs catalog --repo . --check
node --test .devin/docs-tooling/test/*.test.mjs
```

All checks are offline and read-only. No application code is executed.
