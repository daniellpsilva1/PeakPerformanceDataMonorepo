---
id: PPD-PORTFOLIO-ENG-CONTRIBUTING
last_reviewed: 2026-09-13
owner: daniel
related:
  - docs/governance/sdlc.md
  - docs/governance/documentation-standard.md
schema_version: 1
status: draft
title: Contributing guide
type: how-to
visibility: internal
---

# Contributing guide

This guide describes how to contribute to the PeakPerformanceData monorepo and its submodules.

## Repository structure

This is a Git superproject with 14 direct submodule repositories. Each submodule is an independent repository with its own package manager, CI, and tests. Do not assume a shared build.

See `docs/repositories.json` for the complete catalog and `docs/architecture/repository-graph.md` for the dependency graph.

## Before you start

1. Read the root `AGENTS.md` for the concise entry point.
2. Read `docs/governance/sdlc.md` for the risk-based lifecycle process.
3. Identify the repository you are working in from `docs/repositories.json`.
4. Read the relevant local `AGENTS.md` if it exists.

## Making changes

### Low risk (docs, typos, dependency bumps)

1. Create a branch.
2. Make the change.
3. Write a PR description with problem, scope, and acceptance.
4. Run relevant checks.
5. Submit PR.

### Medium risk (new endpoints, UI features, config changes)

1. Create a change brief (see `docs/templates/change-brief.md`).
2. Create a test plan (see `docs/templates/test-plan.md`).
3. Implement the change.
4. Run tests.
5. Submit PR with brief and test plan linked.

### High risk (auth, billing, schema, cross-service, health/genetics)

1. Create a PRD (see `docs/templates/prd.md`).
2. Create a design RFC (see `docs/templates/design-rfc.md`).
3. Create an ADR if architectural (see `docs/templates/adr.md`).
4. Create a test plan.
5. Create a release record (see `docs/templates/release-record.md`).
6. Implement, test, and deploy with coordinated order.

## Code style

- Imports must be alphabetically sorted.
- Variables must be alphabetically ordered.
- Component props must be alphabetically ordered.
- ES6 linting must pass.

## Commit messages

- Start with: `Add`, `Bump`, `Disable`, `Enable`, `Fix`, `Improve`, `Migrate`, `Move`, `Release`, `Remove`, `Replace`, `Revert`, `Update`.
- Use imperative mood.
- More than one word.
- No longer than 52 characters.
- Body in sentence case explaining what and why.

## Documentation changes

- Run `node .devin/docs-tooling/src/cli.mjs check --repo .` before submitting.
- Ensure frontmatter is valid for managed docs.
- Do not delete historical docs; add correction notices instead.

## What this guide does not claim

- That all existing code follows these conventions (it may not).
- That CI enforcement is in place for all checks (it is advisory during rollout).
- That this guide covers every scenario (see SDLC process for edge cases).
