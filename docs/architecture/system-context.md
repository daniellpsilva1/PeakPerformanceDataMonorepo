---
id: PPD-PORTFOLIO-ARCH-SYSTEM-CONTEXT
last_reviewed: 2026-09-13
owner: daniel
related:
  - PPD-PORTFOLIO-ARCH-DATA-FLOWS
schema_version: 1
source_refs:
  - path: vercel.json
    repo_id: app
    revision: 86faf8651a0be6f013af1bd49f8b0304f4b5273b
  - path: render.yaml
    repo_id: backend
    revision: 78fce68afcecccec201cf1116b98c0fe246340ca
  - path: docker/docker-compose.yml
    repo_id: extraction
    revision: 0433060b29a23bd2f29c761c10bcf9af4a58d812
status: draft
title: System context (C4 L1)
type: explanation
visibility: internal
---

# System context (C4 L1)

This diagram shows the PeakPerformanceData platform boundary, its users, and external systems. Source-linked to revisions observed on 2026-09-13.

## Diagram

```mermaid
flowchart TD
    Player[Player] --> PPD
    Coach[Coach] --> PPD
    Parent[Parent] --> PPD
    Admin[Club Admin] --> PPD

    PPD["PeakPerformanceData Platform\n(multi-tenant sports performance)"]

    PPD --> Garmin[Garmin Connect API]
    PPD --> Polar[Polar API]
    PPD --> Whoop[Whoop API]
    PPD --> Suunto[Suunto API]
    PPD --> OW[OpenWearables API]
    PPD --> Supabase[(Supabase PostgreSQL)]
    PPD --> ClickHouse[(ClickHouse)]
    PPD --> Stripe[Stripe]
    PPD --> DeepSeek[DeepSeek / Groq]
    PPD --> R2[(Cloudflare R2)]
    PPD --> SV[SwingVision]

    PPD --> Vercel["Vercel (app)"]
    PPD --> Render["Render (graph backend)"]
    PPD --> Hetzner["Hetzner (extraction + video)"]
```

## Actors

| Actor | Description |
|---|---|
| Player | Athlete viewing own performance data, tennis scoring, body twin |
| Coach | Managing assigned players, viewing analytics, tennis coaching |
| Parent | Viewing linked child's data and tennis matches |
| Club Admin | Managing organization, members, and academy settings |

## External systems

| System | Purpose | Evidence |
|---|---|---|
| Garmin Connect API | Wearable data source | `src/api/routes/garmin_data.py` in extraction |
| Polar / Whoop / Suunto | Wearable data sources | `src/api/routes/provider_data.py` in extraction |
| OpenWearables API | Unified wearable data abstraction | `src/openwearables/client.py` in extraction |
| Supabase PostgreSQL | Primary relational database (auth, profiles, orgs, billing) | App migrations, `config/database.py` in backend |
| ClickHouse | Wearable timeseries and analytics data store | Extraction migrations, `openwearables_data` database |
| Stripe | Billing and subscriptions | `src/lib/stripe/` in app, `package.json` dependency |
| DeepSeek / Groq | LLM providers for AI agent | `src/app/api/ai-agent/route.ts` in app |
| Cloudflare R2 | Video storage (raw, enhanced, canonical, archived) | SwingVision `workers/shared/` |
| SwingVision | iPhone-based tennis video analysis | SwingVision pipeline |

## Deployment surfaces

| Surface | Config evidence | Status |
|---|---|---|
| Vercel (app) | `vercel.json` — region `iad1`, crons, redirects | Configured |
| Render (graph backend) | `render.yaml` — Docker, starter plan | Configured |
| Hetzner (extraction) | `docker/docker-compose.yml` — Traefik, ClickHouse | Configured |
| Mac Mini (SwingVision) | `infra/launchd/` — worker daemon | Configured |

## What this diagram does not show

- Internal service-to-service communication paths (see containers diagram).
- Data flow details (see `data-flows.md`).
- Trust boundaries (see security DFD).
- Whether configured deployments are currently live and healthy (unverified).
