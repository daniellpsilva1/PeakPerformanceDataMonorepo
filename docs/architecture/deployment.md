---
id: PPD-PORTFOLIO-ARCH-DEPLOYMENT
last_reviewed: 2026-09-13
owner: daniel
related:
  - PPD-PORTFOLIO-ARCH-CONTAINERS
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
  - path: infra/launchd/
    repo_id: swingvision
    revision: 1fe4763785d0318c38969a60c65b97ee57a6428a
status: draft
title: Deployment topology
type: explanation
visibility: internal
---

# Deployment topology

This document records the deployment surfaces observed in checked-in configuration. It distinguishes **configured** (present in source) from **verified deployed** (confirmed live). Only the configured state is evidenced here.

## Diagram

```mermaid
flowchart TB
    subgraph Vercel["Vercel — region iad1"]
        App["Next.js App\n(build: pnpm build)"]
        Cron["Cron: cleanup-conversations\n(0 3 * * *)"]
    end

    subgraph Render["Render — starter plan"]
        Backend["Graph Backend\n(Docker, health: /health)"]
    end

    subgraph Hetzner["Hetzner — Docker/Traefik"]
        Traefik["Traefik v3.3\n(SSL, routing, webhooks)"]
        Extraction["Extraction Backend\n(uvicorn, 100MB max event)"]
        CHContainer["ClickHouse Container"]
        Traefik --> Extraction
        Extraction --> CHContainer
    end

    subgraph MacMini["Mac Mini — launchd"]
        SVWorkers["SwingVision Workers\n(python, launchd daemons)"]
        SVDashboard["SwingVision Dashboard\n(Next.js)"]
    end

    subgraph External["External services"]
        Supabase[(Supabase)]
        R2[(Cloudflare R2)]
        Stripe[Stripe]
        LLM[DeepSeek / Groq]
        OW[OpenWearables API]
    end

    App --> Backend
    App --> Extraction
    App --> Supabase
    App --> Stripe
    App --> LLM
    Backend --> CHContainer
    Backend --> Supabase
    SVWorkers --> R2
    SVWorkers --> Supabase
    SVDashboard --> Supabase
```

## Configured deployment evidence

### Vercel (app)

| Config | Value | Source |
|---|---|---|
| Region | `iad1` | `vercel.json` |
| Build command | `HUSKY=0 pnpm run build` | `vercel.json` |
| Install command | `ensure-vendor-stubs.sh && build:courtviz && build:bodyviz && pnpm install --frozen-lockfile` | `vercel.json` |
| Cron | `cleanup-conversations` at `0 3 * * *` | `vercel.json` |
| Redirects | `/strava-auth-callback`, `/presentation/*` | `vercel.json` |

### Render (graph backend)

| Config | Value | Source |
|---|---|---|
| Type | `web` (Docker) | `render.yaml` |
| Plan | `starter` | `render.yaml` |
| Health check | `/health` | `render.yaml` |
| Env vars | `DATABASE_URL`, `STRAVA_*`, `AWS_*` | `render.yaml` |

Note: `render.yaml` references `STRAVA_*` env vars, which may be stale. See gap DG-05.

### Hetzner (extraction)

| Config | Value | Source |
|---|---|---|
| Proxy | Traefik v3.3 (SSL, routing) | `docker/docker-compose.yml` |
| App server | uvicorn with `--h11-max-incomplete-event-size 104857600` | `src/api/main.py` comment, Dockerfile |
| Database | ClickHouse container | `docker/docker-compose.yml` |
| Network | `ppd-network` + `ppd-shared` (external) | `docker/docker-compose.yml` |

### Mac Mini (SwingVision)

| Config | Value | Source |
|---|---|---|
| Worker daemon | launchd | `infra/launchd/` |
| R2 lifecycle | Configured | `infra/r2-lifecycle.json` |
| Devices | 5 iPhone SE | Pipeline docs (not config file) |

## What this document does not claim

- Whether any deployment is currently live and healthy (unverified).
- Actual environment variable values (secrets are not inspected).
- Network firewall rules or security group configuration.
- Whether the `STRAVA_*` env vars in `render.yaml` are still used or stale (DG-05).
- Whether the Python AI agent and Vision service have their own deployment configs (unconfirmed).
