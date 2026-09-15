---
id: PPD-PORTFOLIO-ADR-0001
last_reviewed: 2026-09-13
owner: daniel
schema_version: 1
status: draft
title: ADR-0001 — Adopt a repository-first documentation system
type: adr
visibility: internal
---

# ADR-0001 — Adopt a repository-first documentation system

## Decision status

Draft — pending owner acceptance.

## Context

The PeakPerformanceData monorepo is a Git superproject with 14 direct submodule repositories and 2 nested dependency occurrences. Existing documentation is inconsistent in authority and freshness:

- The root README lists fewer submodules than `.gitmodules` defines.
- Root setup docs prescribe npm while the frontend declares pnpm.
- An old security review claims no frontend CI, no AI tests, and no Stripe SDK; all three now exist.
- Historical design documents describe a Strava-centric product that no longer matches current architecture.
- Diagrams are mostly historical `_plans/` artifacts, not source-linked living documents.

AI agents (Devin, Cursor, Windsurf, Claude Code, Codex) need a reliable, version-pinned knowledge base to plan and implement changes correctly. The current state leads to wrong-version selections, stale-architecture assumptions, and unverified claims presented as fact.

## Options considered

1. **No change** — continue with ad-hoc documentation. Rejected: agents cannot reliably distinguish current from historical information.
2. **Hosted documentation portal** (Backstage, MkDocs, etc.) — rejected for now: adds infrastructure, deployment, and maintenance burden before content quality is established. Private Git-first is simpler and sufficient.
3. **Repository-first documentation system with safe CI** — selected: documentation lives in the repository, is reviewed with code, validated by offline tooling, and linked to source evidence. No external infrastructure required.

## Decision

Adopt a repository-first documentation system with:

- **Authority model** separating accepted intent, decisions, observed implementation, execution evidence, and historical material.
- **Metadata contracts** for frontmatter, repository identities, catalogs, and change/evidence records.
- **Risk-based SDLC** with low/medium/high tiers determining minimum documentation requirements.
- **Source-linked diagrams** using Mermaid as the default textual format.
- **Portable agent navigation** via concise `AGENTS.md` files and on-demand skills under `.devin/`.
- **Safe documentation CI** that validates structure, links, metadata, and diagram syntax without executing application code or requiring production credentials.
- **Documentation-only runtime-agent knowledge contract** (default-deny eligibility, no integration in this phase).

## Consequences

- Every managed document carries frontmatter metadata with owner, status, and source references.
- A documentation checker tool is maintained under `.devin/docs-tooling/` and distributed to child repositories as generated bundles.
- Historical documents are inventoried and classified, not deleted.
- Application code, database schemas, deployments, and security policies are not modified as part of this documentation rollout.
- Discovered runtime and assurance gaps are recorded in a separate remediation backlog, not silently fixed.

## References

- `docs/governance/documentation-standard.md`
- `docs/governance/sdlc.md`
- `docs/governance/evidence-and-traceability.md`
- `docs/governance/maintenance.md`
- `docs/governance/research-basis.md`
- `docs/audits/documentation-baseline.md`
- `docs/repositories.json`
