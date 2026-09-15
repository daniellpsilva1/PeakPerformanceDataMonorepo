---
id: PPD-PORTFOLIO-OPS-RUNBOOKS-INDEX
last_reviewed: 2026-09-13
owner: daniel
related:
  - PPD-PORTFOLIO-ARCH-DEPLOYMENT
  - PPD-PORTFOLIO-SECURITY-DFD
schema_version: 1
status: draft
title: Operations runbooks index
type: overview
visibility: internal
---

# Operations runbooks index

This index lists operational runbooks for the PeakPerformanceData platform. Runbooks are organized by service and scenario. All commands in runbooks must be labeled with a side-effect class.

## Side-effect classes

| Class | Meaning | Requires approval |
|---|---|---|
| `local-read` | Read-only, local machine | No |
| `local-build` | Local build or test | No |
| `external-read` | Read from external service | No |
| `external-write` | Write to external service | Yes |
| `destructive` | Deletes data or state | Yes (explicit, per-action) |

## Runbook inventory

### Application (Vercel)

| Runbook | Scenario | Status |
|---|---|---|
| `app/deployment-rollback.md` | Roll back a Vercel deployment | Pending |
| `app/feature-flag-toggle.md` | Toggle BodyViz or other feature flags | Pending |
| `app/cron-failure.md` | Cron job `cleanup-conversations` fails | Pending |

### Graph backend (Render)

| Runbook | Scenario | Status |
|---|---|---|
| `backend/cache-flush.md` | Flush graph cache | Pending |
| `backend/deployment.md` | Deploy a new version to Render | Pending |
| `backend/health-check.md` | Verify backend health | Pending |

### Extraction backend (Hetzner)

| Runbook | Scenario | Status |
|---|---|---|
| `extraction/clickhouse-maintenance.md` | ClickHouse maintenance | Pending |
| `extraction/sync-failure.md` | Provider sync failure | Pending |
| `extraction/traefik-renewal.md` | SSL certificate renewal via Traefik | Pending |

### SwingVision (Mac Mini)

| Runbook | Scenario | Status |
|---|---|---|
| `swingvision/worker-restart.md` | Restart launchd workers | Pending |
| `swingvision/r2-lifecycle.md` | R2 storage lifecycle management | Pending |
| `swingvision/device-failure.md` | iPhone device failure | Pending |

### Cross-service

| Runbook | Scenario | Status |
|---|---|---|
| `cross-service/provider-outage.md` | Wearable provider API outage | Pending |
| `cross-service/stripe-webhook-failure.md` | Stripe webhook processing failure | Pending |
| `cross-service/ai-agent-degradation.md` | AI agent service degradation | Pending |

## What this index does not claim

- That any runbook has been validated against a real incident (they are pending).
- That the runbook list is exhaustive (it covers observed services only).
- That operational procedures are approved (they need owner review).
- That on-call rotation or escalation contacts are defined (they are not — needs owner input).
