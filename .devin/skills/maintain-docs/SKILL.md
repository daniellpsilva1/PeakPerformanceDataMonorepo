---
name: maintain-docs
description: Create, update, and validate documentation in the PeakPerformanceData monorepo
---

# maintain-docs

## When to use

Use this skill when creating, updating, or validating documentation in the PeakPerformanceData monorepo.

## Steps

### Creating a new document

1. **Choose the right location:**
   - Root docs: `docs/<category>/<name>.md` (product, engineering, quality, security, operations, agents, architecture, governance, decisions, changes, audits, generated).
   - Per-repo docs: `<repo>/<doc_root>/<name>.md` (check the repo's `.devin/docs.json` for `doc_root`).

2. **Add frontmatter:**
   - Every managed doc must have valid frontmatter.
   - Required fields: `id`, `last_reviewed` (YYYY-MM-DD), `owner`, `schema_version` (1), `status` (draft/accepted/superseded/archived), `title`, `type` (overview/tutorial/how-to/reference/explanation/prd/rfc/adr/ux-spec/test-plan/runbook/release/postmortem/research/metric-card/model-card), `visibility` (internal).
   - Optional: `related` (list of doc IDs), `source_refs`, `domain_tags`, `superseded_by`.

3. **Write honest content:**
   - Distinguish observed, proposed, verified, historical, and unknown.
   - Cite source paths for claims.
   - Add a "What this document does not claim" section.

4. **Validate:**
   - Run: `node .devin/docs-tooling/src/cli.mjs check --repo .`
   - Run: `node .devin/docs-tooling/src/cli.mjs catalog --repo . --write` (to update the catalog)

### Updating an existing document

1. **Read the document first.**
2. **Update `last_reviewed` to the current date.**
3. **Make the change.**
4. **If the change supersedes old content, add a correction notice rather than deleting.**
5. **Validate with the checker.**

### Validating all docs

1. Run: `node .devin/docs-tooling/src/cli.mjs check --repo .`
2. Run: `node .devin/docs-tooling/src/cli.mjs catalog --repo . --check`
3. Run: `node .devin/docs-tooling/src/cli.mjs references --repo .` (checks source refs)
4. Run: `node --test .devin/docs-tooling/test/*.test.mjs` (run tooling tests)

### Syncing shared policy to child repos

1. Run: `node .devin/docs-tooling/src/cli.mjs sync --repo . --dry-run` (preview)
2. Review the dry-run report for local edits.
3. If no local edits: `node .devin/docs-tooling/src/cli.mjs sync --repo . --write`

## Rules

- Do not delete historical documents. Add correction notices instead.
- Do not run application builds, tests, or deployments.
- Do not modify application code, database migrations, or deployment config.
- Do not fetch, checkout, or reset submodules.
- Do not fabricate approvals, test runs, or evidence.
- A test file is not a passing run. A forwarded token is not a verified identity. A date refresh is not factual revalidation.

## What this skill does not do

- It does not modify application code.
- It does not run application tests.
- It does not approve changes (only the owner approves).
