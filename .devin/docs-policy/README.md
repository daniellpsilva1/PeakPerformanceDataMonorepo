# .devin/docs-policy/

This directory contains the shared documentation policy bundle distributed to child repositories.

## Purpose

Child repositories receive generated, versioned local copies of shared governance documents under their own `.devin/docs-policy/` directory. This allows each repo's documentation CI to run standalone without access to the root superproject or private cross-repo tokens.

## Contents

The bundle includes:

- `docs/governance/documentation-standard.md` — Documentation authority and freshness rules
- `docs/governance/sdlc.md` — Risk-based SDLC process
- `docs/governance/evidence-and-traceability.md` — Evidence state classification
- `docs/governance/maintenance.md` — Documentation maintenance rules

## Distribution

The `distribution.json` manifest at `.devin/docs-tooling/distribution.json` records:

- Origin repo and revision
- Bundle version
- Included files and SHA-256 digests

## Sync

To sync the bundle to child repos:

```bash
# Dry-run (preview)
node .devin/docs-tooling/src/cli.mjs sync --repo . --dry-run

# Write (updates child repos; stops on local edits)
node .devin/docs-tooling/src/cli.mjs sync --repo . --write
```

## Rules

- Sync updates only declared generated paths, never arbitrary caller paths.
- Sync detects local edits and stops instead of overwriting them.
- Sync generates dry-run reports first.
- Root checks version skew but does not automatically mutate children.
- No `node_modules` or browser binaries are copied into Git.

## What this directory does not claim

- That the bundle is the source of truth (the root `docs/governance/` files are the source).
- That child repos have the latest bundle (they may be behind; check `distribution.json`).
- That sync is automatic (it requires explicit execution).
