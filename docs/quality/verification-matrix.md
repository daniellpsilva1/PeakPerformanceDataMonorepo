---
id: PPD-PORTFOLIO-QUALITY-VERIFICATION-MATRIX
last_reviewed: 2026-09-13
owner: daniel
related:
  - docs/quality/strategy.md
  - docs/governance/evidence-and-traceability.md
schema_version: 1
status: draft
title: Verification matrix
type: reference
visibility: internal
---

# Verification matrix

This matrix records the current state of known checks across the portfolio. States are: `declared`, `prerequisites-validated`, `executed`, `enforced`. See `docs/quality/strategy.md` for definitions.

## Documentation tooling

| Check | Location | State | Notes |
|---|---|---|---|
| Docs metadata check | `.devin/docs-tooling/src/cli.mjs check` | executed | 69 unit tests pass; root check passes |
| Catalog consistency | `.devin/docs-tooling/src/cli.mjs catalog --check` | executed | Generates and compares catalog |
| Link validation | `.devin/docs-tooling/src/links.mjs` | executed | Local Markdown links only |
| Source reference check | `.devin/docs-tooling/src/references.mjs` | executed | Cited source paths must exist |
| Mermaid block extraction | `.devin/docs-tooling/src/render.mjs` | executed | Parses blocks for renderer |
| Root docs CI | `.github/workflows/docs.yml` | declared | Advisory (continue-on-error: true) |

## App

| Check | Location | State | Notes |
|---|---|---|---|
| Lint | `pnpm lint` (declared) | declared | Not executed by docs work |
| Type check | `pnpm typecheck` (declared) | declared | Not executed by docs work |
| Unit tests | `pnpm test` (declared) | declared | Not executed by docs work |
| Playwright e2e | `pnpm exec playwright test` (declared) | declared | Not executed by docs work |
| Stripe webhook signature | `src/app/api/stripe/webhook/route.ts` | declared | Verification logic present in source |
| Auth middleware | `src/middleware.ts` | declared | Session validation present in source |

## Backend

| Check | Location | State | Notes |
|---|---|---|---|
| Python tests | `pytest` (declared) | declared | Not executed by docs work |
| Graph API routes | `api/routes/graphs.py` | declared | Source present |
| Wearables API routes | `api/routes/wearables.py` | declared | Source present |

## Extraction

| Check | Location | State | Notes |
|---|---|---|---|
| Python tests | `pytest` (declared) | declared | Not executed by docs work |
| Provider data routes | `src/api/routes/provider_data.py` | declared | Source present |
| Sync service | `src/openwearables/sync_service.py` | declared | Source present |

## Vision

| Check | Location | State | Notes |
|---|---|---|---|
| Python tests | `pytest` (declared) | declared | Not executed by docs work |

## SwingVision

| Check | Location | State | Notes |
|---|---|---|---|
| Node tests | `npm test` (declared) | declared | Not executed by docs work |

## Courtviz

| Check | Location | State | Notes |
|---|---|---|---|
| Visual gallery | `pnpm gallery` (declared) | declared | Playwright command declared but Playwright dep not confirmed |
| Component tests | `pnpm test` (declared) | declared | Not executed by docs work |

## BodyViz

| Check | Location | State | Notes |
|---|---|---|---|
| Gallery | `pnpm gallery` (declared) | declared | Playwright command declared but Playwright dep not confirmed |
| Fallback render | `packages/bodyviz/src/fallback.ts` | declared | Source present |

## What this matrix does not claim

- That declared checks have been executed (they have not, per safe-verification rules).
- That enforced checks gate merges (no enforcement is currently verified).
- That this matrix is exhaustive (it covers known checks at time of writing).
