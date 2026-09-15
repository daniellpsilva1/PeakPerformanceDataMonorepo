---
name: review-doc-impact
description: Review a code change for documentation impact using the impact analyzer
---

# review-doc-impact

## When to use

Use this skill when reviewing a code change (PR, diff, or commit) to determine what documentation needs to be updated.

## Steps

1. **Identify the changed files:**
   - Get the base and head revisions (from PR event or commit SHAs).
   - Run: `node .devin/docs-tooling/src/cli.mjs impact --repo . --base <base> --head <head>`

2. **Read the impact report:**
   - The report lists changed files, documentation impacts, unmapped files, and advisory items.
   - Each impact maps a source pattern to a documentation obligation.

3. **Check for gitlink changes:**
   - If the report mentions gitlink changes, this is a dependency-version change requiring compatibility/integration review.

4. **Triage unmapped files:**
   - Unmapped files are advisory initially.
   - High-risk unmapped additions (auth, billing, schema) need explicit review.

5. **Determine required doc updates:**
   - For each impact, find the referenced documentation.
   - Check if the doc needs updating, or if a scoped no-impact rationale should be recorded.

6. **Report:**
   - List required doc updates with doc IDs.
   - List unmapped files needing triage.
   - List gitlink changes needing compatibility review.
   - Report any gaps (missing docs, stale docs).

## What this skill does not do

- It does not automatically update documentation (use `maintain-docs` for that).
- It does not fail builds (impact checks are advisory during rollout).
- It does not fetch submodules or download external content.
