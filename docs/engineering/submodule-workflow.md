---
id: PPD-PORTFOLIO-ENG-SUBMODULE-WORKFLOW
last_reviewed: 2026-09-13
owner: daniel
related:
  - docs/architecture/repository-graph.md
  - docs/engineering/contributing.md
schema_version: 1
status: draft
title: Submodule workflow
type: how-to
visibility: internal
---

# Submodule workflow

This guide describes how to work with the Git superproject and its 14 submodule repositories.

## Initial checkout

```bash
git clone --recursive <superproject-url>
cd PeakPerformanceDataMonorepo
```

If submodules are not initialized:

```bash
git submodule update --init --recursive
```

## Checking out a specific submodule

```bash
cd PeakPerformanceData/peak_performance_data
git checkout main
git pull
```

## Making changes in a submodule

1. Work in the submodule directory (e.g., `PeakPerformanceData/peak_performance_data/`).
2. Create a branch in the submodule repository.
3. Make changes, commit, and push to the submodule's remote.
4. Submit a PR to the submodule repository.
5. After merge, update the superproject's gitlink:

```bash
cd PeakPerformanceData/peak_performance_data
git checkout main
git pull
cd ../..
git add PeakPerformanceData/peak_performance_data
git commit -m "Update app submodule to latest"
```

## Nested vendor submodules

The app has two nested vendor submodules under `vendor/`:

| Vendor | Path | Pinned revision | Marketing checkout revision |
|---|---|---|---|
| BodyViz | `vendor/bodyviz` | `00caeda7b8` | `e3d2849719` |
| Courtviz | `vendor/courtviz` | `7bad49b63d` | `583692443f` |

These are intentionally pinned at different revisions. Do not normalize away version differences.

### App vendor setup

After cloning or updating the app submodule:

```bash
cd PeakPerformanceData/peak_performance_data
bash scripts/ensure-vendor-stubs.sh
pnpm install
```

The `ensure-vendor-stubs.sh` script copies committed prebuilt dist from `vendor-prebuilt/bodyviz/` into `vendor/bodyviz/packages/*/dist/` when the submodule is missing or its dist is absent.

## Updating submodule pins

Updating a submodule pin is a dependency-version change requiring compatibility/integration documentation review. Do not update pins casually.

## What this guide does not claim

- That all submodules are currently at their latest versions (they are pinned at specific revisions).
- That nested vendor pins should match marketing checkouts (they should not).
- That submodule updates are automatic (they require explicit superproject commits).
