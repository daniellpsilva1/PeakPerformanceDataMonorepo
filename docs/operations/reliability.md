---
id: PPD-PORTFOLIO-OPS-RELIABILITY
last_reviewed: 2026-09-13
owner: daniel
related:
  - docs/operations/release-process.md
  - docs/operations/runbooks-index.md
  - docs/architecture/deployment.md
schema_version: 1
status: draft
title: Reliability and SLOs
type: reference
visibility: internal
---

# Reliability and SLOs

This document records the current state of reliability practices. It does not invent SLOs that have not been measured.

## Deployment surfaces

| Surface | Platform | Documented | SLO defined |
|---|---|---|---|
| App (Next.js) | Vercel | Yes (`docs/architecture/deployment.md`) | No |
| Backend (FastAPI) | Render | Yes | No |
| Extraction (FastAPI) | Hetzner/Docker | Yes | No |
| Vision (FastAPI) | Render | Yes | No |
| Agent (Python) | TBD | No | No |
| SwingVision pipeline | Worker/infra | Yes | No |

## Current monitoring state

No SLOs have been defined or measured for any service. This is a known gap, not a hidden one.

## Error handling patterns observed

| Service | Pattern | Source |
|---|---|---|
| App | Next.js error boundaries, API route try/catch | `src/app/` |
| Backend | FastAPI exception handlers | `api/main.py` |
| Extraction | Background scheduler retry, sync error capture | `src/openwearables/sync_service.py` |
| App tennis | Offline outbox with retry | `src/lib/tennis/scorekeeper/outbox.ts` |

## What this document does not claim

- That any SLO exists (none have been defined).
- That monitoring is in place (it has not been verified).
- That error handling is comprehensive (only observed patterns are listed).
- That uptime or latency has been measured (it has not).
