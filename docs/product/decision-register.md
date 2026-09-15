---
id: PPD-PORTFOLIO-PRODUCT-DECISION-REGISTER
last_reviewed: 2026-09-13
owner: daniel
related:
  - docs/decisions/README.md
schema_version: 1
status: draft
title: Decision register
type: reference
visibility: internal
---

# Decision register

This register indexes all accepted engineering decisions. Each decision links to its ADR.

## Active decisions

| ID | Title | Status | Date | ADR |
|---|---|---|---|---|
| DR-0001 | Adopt repository-first documentation system | Draft | 2026-09-13 | `docs/decisions/0001-documentation-system.md` |

## Pending decisions

| Topic | Owner | Needed for | Status |
|---|---|---|---|
| Legacy extraction lifecycle (active vs retired) | daniel | DG-02 resolution | Unconfirmed |
| AI Videos repository purpose | daniel | DG-24 resolution | Unconfirmed |
| ACWR band labeling (research vs code disagreement) | daniel | DG-23 resolution | Unconfirmed |
| Strava env vars in render.yaml (stale vs active) | daniel | DG-05 resolution | Unconfirmed |
| Per-repo CI enforcement (advisory vs blocking) | daniel | WP-17 expansion | Unconfirmed |

## What this register does not claim

- That decisions marked "Draft" are accepted (they are proposals).
- That the register is exhaustive (new decisions are added as they are made).
- That pending decisions have been escalated (they are documented, not resolved).
