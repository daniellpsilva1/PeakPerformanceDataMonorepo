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
    subgraph HetznerWeb["Hetzner Falkenstein ppd-web — Coolify/Docker/Traefik"]
        App["Next.js App\n(Docker standalone image,\nGHCR via GitHub Actions)"]
        Cron["Host cron → /api/cron/cleanup-conversations\n(0 3 * * * with CRON_SECRET)"]
    end

    subgraph Hetzner["Hetzner Falkenstein — Docker/Traefik"]
        Traefik["Traefik v3.3\n(SSL, routing, webhooks)"]
        Backend["Graph Backend ppc-api\n(Docker, PathPrefix /ppc, health: /health)"]
        Extraction["Extraction Backend\n(uvicorn, 100MB max event)"]
        CHContainer["ClickHouse Container"]
        Traefik --> Backend
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

### Hetzner ppd-web (app) — added 2026-10-29

| Config | Value | Source |
|---|---|---|
| Host | `peak-performance-data` — Hetzner CX23, 188.245.233.118, Falkenstein | Verified live 2026-10-29 |
| Runtime | Docker `node:22` standalone image, managed by Coolify, Traefik + Let's Encrypt | `Dockerfile` (app repo) |
| Image | `ghcr.io/daniellpsilva1/ppd-web` (`latest`=main, `staging`=staging) | `.github/workflows/deploy.yml` |
| CI | GitHub Actions builds + pushes image, triggers Coolify via restricted SSH | `.github/workflows/deploy.yml` |
| Domains | `peakperformancedata.app`, `www.`, `staging.` | Coolify app config |
| Cron | host crontab calls the route with `CRON_SECRET` | `/usr/local/bin/ppd-cron` |
| Backups | nightly Supabase dump → age-encrypted → R2 `ppd-backups` | `/usr/local/bin/ppd-backup.sh` on `ds-wearables-process` |

Note (2026-10-29): the app moved off Vercel; `vercel.json` was removed in the app repo. The `/presentation/*` rewrites still proxy to the separate `ppd-academies-presentation` Vercel project, which stays on Vercel. Historical Vercel config: region `lhr1`, cron `cleanup-conversations` at `0 3 * * *`, redirects `/strava-auth-callback` and `/presentation/*`.

### Hetzner Falkenstein (graph backend)

| Config | Value | Source |
|---|---|---|
| Host | "Wearables-Data-Extraction" — Hetzner CX33, 116.202.100.150, Falkenstein, Germany (eu-central) | Owner-provided console screenshot, 2026-10-09 |
| Service | `ppc-api` Docker service | `ppd_backend/docker-compose.yml` |
| Proxy | Shared Traefik — router `ppc-api`, PathPrefix `/ppc`, stripprefix, port 8000, network `ppd-shared` | `ppd_backend/docker-compose.yml` |
| Public URL | `https://api.wearablesync.app/ppc` (`api.wearablesync.app` and `ppc.peakperformancedata.app` both resolve to 116.202.100.150; `/ppc/health` healthy 2026-10-09) | Owner verification, 2026-10-09 |
| Health check | `/health` | `api/main.py` |

Note: `render.yaml` is obsolete — Render is no longer used for this service (owner statement 2026-10-09). The stale `STRAVA_*` env-var question (DG-05) applied to `render.yaml` and is now moot for deployment config.

### Hetzner Helsinki (unverified)

| Config | Value | Source |
|---|---|---|
| Host | "Wearables-Data-Processing" — Hetzner CX23, 89.167.47.236, Helsinki, Finland (eu-central) | Owner-provided console screenshot, 2026-10-09 |
| Purpose | Unverified — `ppd_backend/scripts/deploy.sh` targets this server (Caddy, `ppc.peakperformancedata.app`), but DNS for that domain resolves to Falkenstein, so the script does not describe current production | `ppd_backend/scripts/deploy.sh` |

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
