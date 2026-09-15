---
name: plan-from-docs
description: Plan implementation tasks by reading the repository's documentation system before writing code
---

# plan-from-docs

## When to use

Use this skill when planning an implementation task in the PeakPerformanceData monorepo. This skill ensures the plan is grounded in the repository's authoritative documentation rather than assumptions.

## Steps

1. **Read the entry points:**
   - Root `AGENTS.md` for portfolio-wide rules.
   - Local `AGENTS.md` for the repository you are working in.

2. **Identify the repository:**
   - Read `docs/repositories.json` to find the repository identity and occurrence.
   - Note the `repo_id`, `profile`, `doc_root`, and `lifecycle`.

3. **Find domain documentation:**
   - Use `docs/agents/navigation.md` to find the relevant domain docs.
   - Read the applicable architecture, API, and data-model docs.

4. **Read governance and decisions:**
   - Check `docs/decisions/` for accepted decisions.
   - Check `docs/product/decision-register.md` for pending decisions.
   - Check `docs/audits/remediation-backlog.md` for known gaps.

5. **Inspect cited source:**
   - Read the source files cited in the documentation.
   - Note any mismatch between docs and source (report as a gap, do not silently fix).

6. **Classify risk:**
   - Low: docs, typos, dep bumps.
   - Medium: new endpoints, UI features, config.
   - High: auth, billing, schema, cross-service, health/genetics.

7. **Produce the plan:**
   - Cite controlling IDs (ADR IDs, doc IDs, gap IDs).
   - Cite source paths and line numbers.
   - List acceptance checks.
   - List required approvals.

## What this skill does not do

- It does not execute application commands.
- It does not modify documentation (use `maintain-docs` for that).
- It does not approve changes (only the owner approves).
