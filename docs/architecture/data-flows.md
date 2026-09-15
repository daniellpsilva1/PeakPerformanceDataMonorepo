---
id: PPD-PORTFOLIO-ARCH-DATA-FLOWS
last_reviewed: 2026-09-13
owner: daniel
schema_version: 1
status: draft
title: Cross-service data flows
type: explanation
visibility: internal
---

# Cross-service data flows

This document indexes the data flows that cross repository boundaries in the PeakPerformanceData platform. Each flow links to the owning repository's local documentation.

## Wearable data ingestion

```mermaid
flowchart LR
    Browser[Browser] --> BFF[Next.js BFF\napi/providers/[provider]]
    BFF -->|X-User-Id + optional Bearer| Extraction[Extraction Backend\napi/v1/providers/[provider]]
    Extraction --> OW[OpenWearables API]
    Extraction --> CH[(ClickHouse\nopenwearables_data)]
    Graph[Graph Backend\napi/v1/graphs] --> CH
    Graph --> BFF
    BFF --> Browser
```

### Identity and trust boundary

The app wearable client forwards both `X-User-Id` and an optional `Authorization: Bearer` token. The extraction backend's `provider_data.py` uses `_get_user_id()` which checks only for the `X-User-Id` header. No authentication middleware is visible in `src/api/main.py`. This is documented as gap DG-18 and is in the remediation backlog.

### Repositories and local docs

| Repository | Local doc | Source evidence |
|---|---|---|
| app | `docs/architecture/wearables.md` | `src/app/api/providers/[provider]/*`, `src/lib/api/wearablesync-client.ts` |
| extraction | `docs/architecture.md`, `docs/api.md`, `docs/data-model.md` | `src/api/routes/provider_data.py`, `src/openwearables/sync_service.py` |
| backend | `engineering/architecture.md`, `engineering/api.md` | `api/routes/graphs.py`, `api/routes/wearables.py` |

### Tenant context

The extraction sync service defines `TenantContext(app_id, org_id, user_id)` and maps the app user to an `ow_user_id` in ClickHouse. The graph backend reads from ClickHouse `openwearables_data` tables to serve dashboard graphs.

### Open questions

- Whether the forwarded bearer token is verified server-side (DG-18).
- Whether the graph backend enforces tenant isolation when reading ClickHouse (needs source verification).
- Whether the 30-day timeseries window cap in `sync_user` is sufficient for all use cases.
