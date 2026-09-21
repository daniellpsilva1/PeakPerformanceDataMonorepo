---
id: PPD-PORTFOLIO-PRODUCT-CAPABILITY-MAP
last_reviewed: 2026-09-20
owner: daniel
related:
  - PPD-PORTFOLIO-PRODUCT-OVERVIEW
  - PPD-PORTFOLIO-ARCH-CONTAINERS
schema_version: 1
status: draft
title: Capability map
type: reference
visibility: internal
---

# Capability map

This matrix maps product capabilities to the repositories and services that implement them.

## Capability → repository matrix

| Capability | App | Backend | Extraction | Vision | SwingVision | Agent | Courtviz | BodyViz |
|---|---|---|---|---|---|---|---|---|
| Wearable ingestion | BFF routes | — | Sync service | — | — | — | — | — |
| Performance graphs | Dashboard | Graph API | — | — | — | — | — | — |
| Tennis scoring | Scorekeeper | — | — | — | — | — | — | — |
| Tennis video analysis | — | — | — | Analysis | Workers | — | — | — |
| Court visualization | Adapter | — | — | — | — | — | Library | — |
| Body twin | Route + UI | — | — | — | — | — | — | Library |
| AI insights | Orchestrator | — | — | — | — | Specialist tools | — | — |
| AI capture & proposals | Capture/approve routes + review UI | — | — | — | — | — | — | — |
| Billing | Webhook + BFF | — | — | — | — | — | — | — |
| Identity/auth | Middleware + BFF | Auth middleware | (gap DG-18) | API key | — | Auth middleware | — | — |

## Capability → data store matrix

| Capability | Supabase | ClickHouse | Vision PostgreSQL | R2 |
|---|---|---|---|---|
| Wearable ingestion | — | Writes | — | — |
| Performance graphs | — | Reads | — | — |
| Tennis scoring | Reads/writes | — | — | — |
| Tennis video analysis | Reads | — | Writes | Reads/writes |
| AI insights | Reads (via RPC) | — | — | — |
| AI capture & proposals | Reads/writes (`ai_proposals`, `ai_voice_captures`, session participants) | — | — | — |
| Billing | Reads/writes | — | — | — |
| Identity/auth | Auth + profiles | — | — | — |

## What this map does not claim

- That all capabilities are fully implemented (some have gaps documented in the baseline audit).
- That the matrix is exhaustive (edge cases and shared utilities may span additional repos).
- That data store access is always direct (some flows go through RPCs or service-role clients).
