---
id: PPD-PORTFOLIO-SDLC-EXAMPLE-WEARABLE
last_reviewed: 2026-09-13
owner: daniel
related:
  - PPD-PORTFOLIO-SDLC-ASSURANCE-MATRIX
  - PPD-PORTFOLIO-ARCH-DATA-FLOWS
  - PPD-APP-ARCH-WEARABLES
schema_version: 1
status: draft
title: Lifecycle example — wearable provider integration
type: explanation
visibility: internal
---

# Lifecycle example — wearable provider integration

This is a worked example showing how the SDLC process applies to a real change: the wearable provider integration that already exists in the codebase. It is written retrospectively to illustrate the process, not as evidence that the process was followed.

## Change summary

Add a wearable provider (Polar/Whoop/Suunto) integration that allows users to connect their device, sync data to ClickHouse, and view it in the app.

## Risk tier: High

This change touches:
- Multiple services (app BFF, extraction backend, graph backend reads)
- Data flow (new provider → ClickHouse → graph API → app)
- Identity boundary (X-User-Id forwarding)

## Stage 1: Discovery

### Problem

Users have wearable devices from multiple manufacturers. Garmin-only support limits the addressable market.

### Customer evidence

- Support tickets requesting Polar/Whoop integration
- Competitive analysis showing multi-provider support as table stakes

## Stage 2: Design

### Change brief

See `docs/templates/change-brief.md` for the template. Key decisions:

1. Use OpenWearables as the unified abstraction layer.
2. Add provider routes under `/api/v1/providers/{provider}` in extraction.
3. Add BFF routes under `src/app/api/providers/[provider]/` in app.
4. Store data in ClickHouse `openwearables_data` database.

### ADR

See `docs/templates/adr.md`. Decision: Use OpenWearables adapter rather than direct provider APIs.

**Consequences:**
- Pro: Single integration point, unified data model
- Con: Dependency on OpenWearables service availability

## Stage 3: Implementation

### Source changes

| Repository | Files | Purpose |
|---|---|---|
| extraction | `src/api/routes/provider_data.py` | Provider API routes |
| extraction | `src/openwearables/sync_service.py` | Sync orchestration |
| extraction | `src/openwearables/transformers/` | Data transformers |
| app | `src/app/api/providers/[provider]/` | BFF routes |
| app | `src/lib/api/wearablesync-client.ts` | Server-side client |

### Identity forwarding

The app forwards `X-User-Id` and optional `Authorization: Bearer` to the extraction backend. The extraction backend trusts `X-User-Id` without verifying the token — see gap DG-18.

## Stage 4: Testing

### Test plan

| Requirement | Level | Reference | Status |
|---|---|---|---|
| OAuth flow completes for each provider | E2E | Manual | Not run |
| Data syncs to ClickHouse | Integration | Manual | Not run |
| Tenant isolation: user A cannot see user B's data | Integration | Manual | Not run |
| Rate limiting on sync trigger | Unit | Manual | Not run |
| Offline retry on network failure | Unit | `outbox.test.ts` (tennis) | Different feature |

### Known gaps

- No automated tests for provider OAuth flow
- No automated tests for cross-tenant isolation
- No automated tests for sync service

## Stage 5: Release

### Release record

See `docs/templates/release-record.md`. Key elements:

- **Order:** Extraction backend first, then app
- **Pre-deployment:** Verify ClickHouse migrations applied
- **Post-deployment:** Verify health endpoints, test OAuth flow
- **Rollback:** Disable provider in app config, extraction routes return 503

## Stage 6: Operations

### Runbook

See `docs/templates/runbook.md` for operational scenarios:

- Provider API outage
- ClickHouse sync failure
- OAuth token expiry

## What this example does not claim

- That this process was followed for the actual implementation (it was not — this is retrospective).
- That all tests exist (many are marked "Not run" — they need to be written).
- That the release was coordinated (unconfirmed).
- That the runbook is complete (it is a template).
