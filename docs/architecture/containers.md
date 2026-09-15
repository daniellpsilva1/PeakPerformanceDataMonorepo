---
id: PPD-PORTFOLIO-ARCH-CONTAINERS
last_reviewed: 2026-09-13
owner: daniel
related:
  - PPD-PORTFOLIO-ARCH-SYSTEM-CONTEXT
  - PPD-PORTFOLIO-ARCH-DATA-FLOWS
schema_version: 1
source_refs:
  - path: package.json
    repo_id: app
    revision: 86faf8651a0be6f013af1bd49f8b0304f4b5273b
  - path: api/main.py
    repo_id: backend
    revision: 78fce68afcecccec201cf1116b98c0fe246340ca
  - path: src/api/main.py
    repo_id: extraction
    revision: 0433060b29a23bd2f29c761c10bcf9af4a58d812
  - path: api/main.py
    repo_id: agent
    revision: 335e5bc61e2063ab7d2d54050782f80488f4f106
status: draft
title: Container architecture (C4 L2)
type: explanation
visibility: internal
---

# Container architecture (C4 L2)

This diagram shows the major deployable containers within the PeakPerformanceData platform and their relationships.

## Diagram

```mermaid
flowchart TB
    subgraph App["Next.js Application (Vercel)"]
        BFF["BFF API Routes\n(auth, providers, AI agent, billing)"]
        UI["App Router UI\n(player, coach, parent, admin)"]
        UI --> BFF
    end

    subgraph Graph["Graph Backend (Render)"]
        GraphAPI["FastAPI\n/api/v1/graphs\n/api/weekly-km-pace"]
        WearablesAPI["FastAPI\n/wearables/activities"]
        GraphAPI --> GraphCache["Graph Cache"]
    end

    subgraph Extraction["Extraction Backend (Hetzner)"]
        ExtAPI["FastAPI\n/api/v1/providers"]
        Sync["Sync Service\nOpenWearables → ClickHouse"]
        Scheduler["Background Scheduler"]
        ExtAPI --> Sync
        Scheduler --> Sync
    end

    subgraph Agent["Python AI Agent"]
        AgentAPI["FastAPI\n/insights, /batch/nightly"]
        Tools["Specialist Tools\n(biomarkers, CGM, genetics, tennis)"]
        AgentAPI --> Tools
    end

    subgraph Vision["Vision Service"]
        VisionAPI["FastAPI\n/analysis"]
        VisionDB["PostgreSQL\n(analysis jobs)"]
        VisionAPI --> VisionDB
    end

    subgraph SwingVision["SwingVision Pipeline (Mac Mini)"]
        Dashboard["Next.js Dashboard"]
        Workers["Python Workers\n(launchd)"]
        Dashboard --> Workers
    end

    subgraph Stores["Data Stores"]
        Supabase[(Supabase PostgreSQL)]
        CH[(ClickHouse\nopenwearables_data)]
        R2[(Cloudflare R2)]
    end

    BFF --> GraphAPI
    BFF --> ExtAPI
    BFF --> AgentAPI
    BFF --> Supabase
    GraphAPI --> CH
    WearablesAPI --> CH
    Sync --> CH
    Workers --> R2
    Workers --> Supabase
```

## Container inventory

| Container | Repository | Runtime | Deployment | Evidence |
|---|---|---|---|---|
| Next.js BFF + UI | app | Node.js 22, Next.js 15.5 | Vercel (iad1) | `package.json`, `vercel.json` |
| Graph backend | backend | Python, FastAPI | Render (Docker) | `render.yaml`, `api/main.py` |
| Extraction backend | extraction | Python, FastAPI | Hetzner (Docker/Traefik) | `docker/docker-compose.yml` |
| Python AI agent | agent | Python, FastAPI | Unconfirmed | `api/main.py` |
| Vision service | vision | Python, FastAPI | Unconfirmed | `api/routes/analysis.py` |
| SwingVision dashboard | swingvision | Node.js, Next.js | Unconfirmed | `package.json` |
| SwingVision workers | swingvision | Python (launchd) | Mac Mini | `infra/launchd/` |

## Data stores

| Store | Engine | Owner | Content |
|---|---|---|---|
| Supabase PostgreSQL | Postgres | app (migrations) | Auth, profiles, orgs, billing, tennis, invitations |
| ClickHouse | ClickHouse | extraction (migrations) | Wearable timeseries, activity, sleep, summaries |
| Vision PostgreSQL | Postgres | vision (migrations) | Analysis jobs, ball positions, bounce events, shots |
| Cloudflare R2 | Object storage | swingvision | Raw, enhanced, canonical, archived video |

## What this diagram does not claim

- Production deployment health (unverified).
- Network topology and firewall rules (needs infrastructure evidence).
- Whether the Python AI agent and Vision service are deployed separately or together (unconfirmed).
- Complete internal component breakdown (see per-repository architecture docs).
