---
id: PPD-PORTFOLIO-GOV-RESEARCH
last_reviewed: 2026-09-13
owner: daniel
schema_version: 1
status: draft
title: Research basis
type: reference
visibility: internal
---

# Research basis

This document records the primary-source engineering practices that inform the PeakPerformanceData documentation system. These sources inform the design; they do not prove a universal industry process or that every company uses all practices.

## Adopted practices

| Source | Adopted | Avoided |
|---|---|---|
| Google — Documentation | Docs as code, ownership, canonical sources, review with code | Large unowned wikis |
| Google — Code review standard | Evidence, maintainability, incremental improvement | Perfection blocking useful progress |
| Amazon — Working Backwards | Customer problem, expected experience, use cases, optional PR/FAQ | PR/FAQ for every bug fix |
| Linear — How we run projects | Concise specs, ownership, outcomes, iteration | Informal release decisions for sensitive data without risk review |
| GitLab — Architecture design workflow | Versioned design, alternatives, consequential-change reviews | Detailed up-front blueprints for all work |
| C4 — Notation | Clear abstraction levels, labels, legends, protocols | Every C4 level for every subsystem |
| Diátaxis | Distinguish tutorial/how-to/reference/explanation | Forcing PRDs and decisions into an unsuitable hierarchy |
| Google — Testing overview | Controlled environments, behavior tests, trustworthy feedback | Coverage percentage as assurance |
| Google SRE — SLOs | User-journey measures and owner-approved objectives | Invented availability targets |
| Google SRE — Postmortems | Blameless learning and tracked corrective action | Fabricated incident histories |
| OWASP — Threat modeling | Data flows, boundaries, threats, mitigations, validation | A system diagram presented as a complete threat model |
| NIST SSDF 1.1 | Security throughout preparation, protection, development, response | Checklist-based certification claims |
| Google Research — Model cards | Intended use, provenance, limits, evaluation | Invented benchmark results |
| OpenAI — Harness engineering | Small maps, repository knowledge, executable checks, freshness | Autonomous merging and experiment-specific review policies |
| Anthropic — Context engineering | Focused retrieval, context budgets, clear tool/trust boundaries | Loading the entire corpus into prompts |
| AGENTS.md | Portable root/local project context | Assuming identical auto-discovery in all clients |
| W3C — WCAG overview | Testable accessibility criteria; proposed WCAG 2.2 AA target | Declaring conformance without assessment |
| Node.js — Release status | Supported runtime for new tooling | Reusing EOL runtime merely because old CI uses it |

## Tool-specific research

- Mermaid has accessible titles and descriptions (`accTitle`/`accDescr`). C4-specific syntax is experimental. Mermaid CLI supports local Markdown-to-SVG rendering, but its programmatic Node API is not covered by semver. Use the pinned CLI, not an unversioned internal API.
- Supabase CLI migration version and name are distinct. Migration drift checks must account for this separation.
- PlantUML is optional and must render locally under a restricted profile with no public rendering server or remote includes.

## Devin documentation

Installed Devin documentation consulted: `.devin/` directory for new tool-specific configuration, on-demand skills for detailed specialized behavior, and concise always-on context rather than giant root prompts.
