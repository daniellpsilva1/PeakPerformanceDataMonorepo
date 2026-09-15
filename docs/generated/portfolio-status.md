---
id: PPD-PORTFOLIO-GENERATED-STATUS
last_reviewed: 2026-09-14
owner: daniel
related:
  - docs/generated/portfolio-index.json
  - docs/audits/documentation-baseline.md
schema_version: 1
status: draft
title: Portfolio status
type: reference
visibility: internal
---

# Portfolio status

This is a generated status snapshot. It is not a substitute for the baseline audit or the gap task list.

## Repository coverage

| Metric | Value |
|---|---|
| Direct repositories | 14 |
| Nested occurrences | 2 |
| Repositories with `AGENTS.md` | 12 of 14 (manim+remotion blocked by missing checkout) |
| Repositories with `.devin/docs.json` | 12 of 14 (manim+remotion blocked) |
| Repositories with docs CI | 12 of 14 (manim+remotion blocked) |
| Repositories with policy bundle | 12 of 14 (manim+remotion blocked) |

## Documentation tooling

| Metric | Value |
|---|---|
| Implemented modules | 16 (config, discovery, documents, links, indexes, cli, report, references, render, git, evidence, impact, policy, sync, adapters/next-routes, adapters/source-symbols) |
| Missing modules | 0 (python-routes.py is a standalone adapter) |
| Tests passing | 114 |
| CLI commands implemented | 7 of 7 (check, catalog, inventory, impact, references, sync, render) |
| CLI commands stubbed | 0 (render returns exit 2 if Mermaid CLI not configured) |

## Root documentation

| Metric | Value |
|---|---|
| Governance docs | 5 |
| Architecture docs | 6 |
| Product docs | 4 (overview, glossary, capability-map, decision-register) |
| Engineering docs | 2 (contributing, submodule-workflow) |
| Quality docs | 2 (strategy, verification-matrix) |
| Security docs | 2 (threat-model, privacy-and-data-handling) |
| Operations docs | 4 (release-process, runbooks-index, reliability, incident-process) |
| Agents docs | 3 (navigation, runtime-knowledge-contract, evaluation-cases) |
| Changes docs | 1 (README) |
| Generated docs | 2 (portfolio-index.json, portfolio-status.md) |
| Audits docs | 3 (documentation-baseline, remediation-backlog, legacy-inventory) |
| Managed docs validated | 6 |
| Invalid docs | 0 |

## Agent support

| Metric | Value |
|---|---|
| Devin skills | 3 of 3 (plan-from-docs, review-doc-impact, maintain-docs) |
| Evaluation cases | 15 of 15 |
| Compatibility matrix | Not tested |

## Blocked items

Manim and Remotion repositories are not checked out (submodule directories empty). Per the plan's safe-verification rules, submodules are not initialized, fetched, or reset. These repos need owner action to check out before docs can be created.

## What this status does not claim

- That the documentation system is fully complete (manim+remotion are blocked).
- That any metric here is enforced (most are advisory).
- That compatibility has been tested (it has not).
- That this snapshot is auto-refreshed (it was generated manually on the date above).
