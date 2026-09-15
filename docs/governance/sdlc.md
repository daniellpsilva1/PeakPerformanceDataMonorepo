---
id: PPD-PORTFOLIO-GOV-SDLC
last_reviewed: 2026-09-13
owner: daniel
schema_version: 1
status: draft
title: Software development lifecycle
type: reference
visibility: internal
---

# Software development lifecycle

This document defines the risk-based lifecycle process for changes across the PeakPerformanceData portfolio.

## Risk tiers

Changes are classified by consequence, not line count. A one-line permission change is high-risk.

| Tier | Triggers | Minimum record |
|---|---|---|
| Low | Nonbehavioral copy/docs, cosmetic change, familiar isolated refactor | Problem, scope, acceptance, doc impact, relevant checks; PR description may suffice |
| Medium | New user workflow, cross-component behavior, nonbreaking integration | Short brief/PRD, relevant UX/design notes, test plan, rollout notes |
| High | Identity/tenant access, billing, deletion, schema/data movement, minors/health/genetics, public contracts, agent actions, model-derived safety claims | Accepted intent, alternatives, technical design/ADR, threat review, negative scenarios, compatibility/recovery plan, explicit risk decision |

## Ready to implement

A change is ready to implement when:

- Owner and risk tier are identified.
- Problem and non-goals are stated.
- Acceptance criteria are observable or testable.
- Current implementation and desired change are separated.
- Relevant source and contracts are inspected at correct versions.
- Blocking product/security decisions are resolved or a safe bounded spike is approved.
- Verification and rollout strategy are defined at appropriate depth.

## Done

A change is done when:

- Requirements are mapped to actual implementation or declared gaps.
- Relevant tests are executed in appropriate scope, outcomes recorded honestly.
- Changed contracts, diagrams, and commands are updated.
- Reviews and approvals appropriate to risk are recorded.
- Release, recovery, and customer guidance is available if behavior ships.
- Remaining debt has owner, priority, and validation criteria.

## Lifecycle artifacts

The portfolio maintains templates for the following artifacts. Not every change requires every artifact; the risk tier determines the minimum.

| Artifact | Template | When required |
|---|---|---|
| Change brief | `docs/templates/change-brief.md` | Medium and high risk |
| PRD | `docs/templates/prd.md` | New product capabilities |
| Design RFC | `docs/templates/design-rfc.md` | High risk or cross-service |
| ADR | `docs/templates/adr.md` | Architectural decisions |
| UX spec | `docs/templates/ux-spec.md` | User-facing changes |
| Test plan | `docs/templates/test-plan.md` | Medium and high risk |
| Release record | `docs/templates/release-record.md` | Behavior that ships |
| Runbook | `docs/templates/runbook.md` | Operational systems |
| Postmortem | `docs/templates/postmortem.md` | Incidents |
| Model/metric card | `docs/templates/model-or-metric-card.md` | Metrics, models, scientific claims |

## Documentation alongside code

Documentation is updated as part of the same change that modifies the relevant source. The documentation checker's impact command identifies which documents are affected by a diff. Touching a Markdown file does not by itself satisfy a documentation obligation for a source change.

## Never fabricate

- Customer interviews, benchmark results, legal approval, deployment evidence, or incident timelines.
- Original architectural rationale when only the outcome is known.
- Test execution results without an actual run record.
- Approval by an agent. Agents draft and review; only the owner approves.
