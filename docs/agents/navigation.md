---
id: PPD-PORTFOLIO-AGENTS-NAVIGATION
last_reviewed: 2026-09-13
owner: daniel
related:
  - AGENTS.md
  - docs/agents/runtime-knowledge-contract.md
  - docs/repositories.json
schema_version: 1
status: draft
title: Agent navigation map
type: reference
visibility: internal
---

# Agent navigation map

This document helps AI agents (Devin, Cursor, Windsurf, Claude Code, Codex, and custom application agents) find the right documentation for a task.

## Step 1: Identify the repository

Read `docs/repositories.json` to identify which of the 14 repositories your task touches. Each entry has an `id`, `path`, `family`, and `package_manager`.

## Step 2: Read the entry points

| Layer | File | Purpose |
|---|---|---|
| Portfolio entry | `AGENTS.md` | Concise portfolio-wide rules |
| Repository entry | `<repo>/AGENTS.md` | Repository-specific rules (where present) |
| Knowledge contract | `docs/agents/runtime-knowledge-contract.md` | What runtime agents may know |

## Step 3: Find domain documentation

| Domain | Start here |
|---|---|
| Wearables | `docs/architecture/data-flows.md` → `PeakPerformanceData/peak_performance_data/docs/architecture/wearables.md` |
| Identity/tenancy | `PeakPerformanceData/peak_performance_data/docs/architecture/identity.md` |
| Tennis/offline | `PeakPerformanceData/peak_performance_data/docs/architecture/tennis.md` |
| Billing | `PeakPerformanceData/peak_performance_data/docs/architecture/billing.md` |
| AI agents | `PeakPerformanceData/peak_performance_data/docs/architecture/ai-orchestration.md` |
| Vision | `PeakPerformanceData/ppd_vision/docs/architecture.md` |
| SwingVision | `PeakPerformanceData/swingvision-pipeline/docs/architecture.md` |
| Courtviz | `PeakPerformanceDataMarketing/courtviz/docs/architecture.md` |
| BodyViz | `PeakPerformanceDataMarketing/bodyviz/docs/architecture.md` |

## Step 4: Find governance and decisions

| Need | File |
|---|---|
| Documentation standard | `docs/governance/documentation-standard.md` |
| SDLC process | `docs/governance/sdlc.md` |
| Evidence rules | `docs/governance/evidence-and-traceability.md` |
| Decisions | `docs/decisions/` |
| Decision register | `docs/product/decision-register.md` |

## Step 5: Find templates

All templates are in `docs/templates/`. See `docs/README.md` for the full index.

## Step 6: Verify with the checker

```bash
node .devin/docs-tooling/src/cli.mjs check --repo .
```

## Compatibility

This navigation map is designed to be portable across agent tools. It does not claim that compatibility has been tested for any specific tool.

| Tool | Entry point | Status |
|---|---|---|
| Devin | `AGENTS.md` + `.devin/skills/` | Designed (skills pending) |
| Cursor | `AGENTS.md` + `.cursorrules` | Designed (not tested) |
| Windsurf | `AGENTS.md` + `.codeium/` | Designed (not tested) |
| Claude Code | `AGENTS.md` | Designed (not tested) |
| Codex | `AGENTS.md` | Designed (not tested) |
| Custom app agents | `docs/agents/runtime-knowledge-contract.md` | Designed (not tested) |

## What this map does not claim

- That all repositories have local `AGENTS.md` files (4 of 14 do).
- That compatibility has been tested (it has not).
- That this map is exhaustive (it covers the primary navigation paths).
