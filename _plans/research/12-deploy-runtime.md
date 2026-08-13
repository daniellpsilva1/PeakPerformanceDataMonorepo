# Research Dossier 12 — Build, Deploy & Runtime (`ppp_ai_agent` vs `ppd_backend`)

**Scope:** Read-only analysis of how `PeakPerformanceData/ppp_ai_agent` is built, shipped, and run, compared to the sibling Python service `PeakPerformanceData/ppd_backend`, and to the Traefik/Hetzner stack that actually owns `api.wearablesync.app`.

**Primary sources (read in full):**

| File | Role |
|------|------|
| `PeakPerformanceData/ppp_ai_agent/Dockerfile` | Image build + gunicorn CMD |
| `PeakPerformanceData/ppp_ai_agent/docker-compose.yml` | Compose service, Traefik labels, healthcheck |
| `PeakPerformanceData/ppp_ai_agent/run.py` | Local-dev uvicorn entrypoint |
| `PeakPerformanceData/ppp_ai_agent/.gitignore` | Secrets / venv ignore rules |
| `PeakPerformanceData/ppp_ai_agent/.env.example` | Declared runtime secrets |
| `PeakPerformanceData/ppd_backend/Dockerfile` | Sibling image pattern |
| `PeakPerformanceData/ppd_backend/docker-compose.yml` | Sibling Traefik + Redis pattern |
| `PeakPerformanceData/ppd_backend/scripts/deploy.sh` | Hetzner bootstrap (Caddy path) |
| `PeakPerformanceData/ppd_backend/scripts/auto_deploy.sh` | Cron pull/rebuild |
| `PeakPerformanceData/ppd_backend/README.md` | Stale Render note |
| `PeakPerformanceData/ppd_backend/render.yaml` | Legacy Render blueprint |
| `PeakPerformanceData/ppd_backend/.github/workflows/ci.yml` | Sibling CI |
| `PeakPerformanceData/ppd_extraction_backend/docker/docker-compose.yml` | Traefik owner + `ppd-shared` |
| `PeakPerformanceData/ppd_extraction_backend/docker/traefik/traefik.yml` | Traefik static config |
| `PeakPerformanceData/ppd_extraction_backend/docker/traefik/dynamic/routes.yml` | Host/path routing |
| `PeakPerformanceData/ppd_extraction_backend/scripts/deploy.sh` | WearableSync Hetzner bootstrap |

**Supporting context:**

- `PeakPerformanceData/ppp_ai_agent/requirements.txt`, `api/main.py`, `api/routes/insights.py`, `config/settings.py`, `agent/nightly_batch.py`
- `PeakPerformanceData/peak_performance_data/src/app/api/ai-agent/proxy/route.ts` (`maxDuration = 60`)
- Monorepo search: `traefik`, `hetzner`, `wearablesync`, `deploy.sh`, `.github/workflows`

**Date of analysis:** 2026-08-02  
**Constraint:** No code changes; no docker runs.

---

## 1. `ppp_ai_agent` image build

### Base image & Python version

```1:1:PeakPerformanceData/ppp_ai_agent/Dockerfile
FROM python:3.10-slim
```

- **Base:** official `python:3.10-slim` (Debian slim).
- **Python:** 3.10 (pinned by image tag, not by `pyproject`/runtime.txt).
- Sibling `ppd_backend` is identical: `FROM python:3.10-slim` (`ppd_backend/Dockerfile` L1).
- Note: `ppd_backend` CI uses Python **3.11** (`.github/workflows/ci.yml` L21) while the image is 3.10 — version skew exists on the sibling too.

### Dependency install strategy & layer caching

```5:16:PeakPerformanceData/ppp_ai_agent/Dockerfile
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY api/ ./api/
COPY config/ ./config/
COPY schemas/ ./schemas/
COPY tools/ ./tools/
```

| Aspect | Assessment |
|--------|------------|
| Requirements-before-code COPY | Good — `requirements.txt` layer caches until deps change |
| `--no-cache-dir` on pip | Good — smaller layers |
| apt cleanup | Good — lists removed |
| `build-essential` kept in final image | **Concern** — compiler toolchain stays in runtime image (no multi-stage build). Same as `ppd_backend`. For this lean deps list it may be unnecessary if wheels are available for all packages |
| Multi-stage / distroless | Absent |
| Non-root `USER` | **Absent** — process runs as root |
| `.dockerignore` | Not present in tree (not verified as file; no evidence of one) |

Production deps (`requirements.txt` L1–11) are lean vs sibling:

```
fastapi, uvicorn, gunicorn, pydantic, pydantic-ai, httpx, python-dotenv,
supabase, clickhouse-connect, redis
```

Dev tools live in `requirements-dev.txt` (pytest, pytest-asyncio, ruff) and are **not** installed in the image — good.

### Image size concerns

- Slim base + lean requirements → relatively small vs `ppd_backend` (which pulls pandas/numpy/plotly/kaleido/boto3).
- Residual bloat: `build-essential` in final image; no multi-stage strip.
- **Critical COPY gap (broken image):** Dockerfile copies `api/`, `config/`, `schemas/`, `tools/` only. It does **not** copy `agent/`. But `api/routes/insights.py` imports `agent.biomarker_specialist` and `agent.nightly_batch` (L17–18). A freshly built image will fail at import/startup for the business routes (or at first request depending on import timing — here imports are module-level, so **app boot fails** once `insights` is loaded via `api/main.py` L15).

Compare sibling which copies all runtime packages including `background_jobs/` and `run.py` (`ppd_backend/Dockerfile` L16–22).

### Healthcheck in image vs compose

- Dockerfile: **no** `HEALTHCHECK` instruction.
- Compose: yes (see §3).

### Server command (production CMD)

```24:24:PeakPerformanceData/ppp_ai_agent/Dockerfile
CMD gunicorn api.main:app --workers 2 --preload --worker-class uvicorn.workers.UvicornWorker --bind 0.0.0.0:$PORT --timeout 120 --graceful-timeout 30 --worker-tmp-dir /dev/shm --max-requests 1000 --max-requests-jitter 50
```

| Flag | Value | Implication for long agent turns |
|------|-------|----------------------------------|
| Server | **gunicorn** (not bare uvicorn) | Production process manager |
| Worker class | `uvicorn.workers.UvicornWorker` | Async ASGI workers |
| Workers | **2** | Two processes; concurrency is async-within-worker, but CPU/LLM-bound work still contended |
| `--preload` | on | App imported once in master then forked — faster boot, shared read-only memory; mutable global state must be fork-safe |
| `--timeout` | **120** | Gunicorn kills a worker silent for 120s. With UvicornWorker heartbeats this is less brutal than sync workers, but it is still the configured kill window and is **too short** for multi-step multi-agent LLM turns (tool loops easily exceed 2 minutes) |
| `--graceful-timeout` | **30** | On reload/stop, in-flight requests get 30s then hard kill — **will cut** long agent turns during deploys |
| `--max-requests` / jitter | 1000 / 50 | Worker recycling; graceful window again 30s |
| `--worker-tmp-dir` | `/dev/shm` | Avoids disk for heartbeat files (good on Docker) |
| Bind | `0.0.0.0:$PORT` | `PORT` default 8001 (L20) |

**Identical CMD** to `ppd_backend/Dockerfile` L36 (only port differs: 8000 vs 8001). That CMD was tuned for graph APIs, **not** for LLM orchestration.

### Local-dev command

```1:7:PeakPerformanceData/ppp_ai_agent/run.py
"""Entrypoint for local development."""

import uvicorn
from config.settings import PORT

if __name__ == "__main__":
    uvicorn.run("api.main:app", host="0.0.0.0", port=PORT, reload=True)
```

Single-process uvicorn with reload — no gunicorn timeout locally.

### Timeout stack beyond gunicorn (critical for multi-agent)

| Layer | Timeout | Source |
|-------|---------|--------|
| Gunicorn worker timeout | **120s** | `Dockerfile` L24 |
| Gunicorn graceful shutdown | **30s** | `Dockerfile` L24 |
| Next.js BFF `maxDuration` | **60s** | `peak_performance_data/.../proxy/route.ts` L6 |
| Specialist LLM `httpx` calls | **30s** | e.g. `agent/nightly_batch.py` ~L93, `agent/biomarker_specialist.py` ~L87, `agent/cgm_specialist.py` ~L81 |
| Auth JWKS/`httpx` | **10s** | `api/middleware/auth.py` ~L73 |
| Supabase REST client | **15s** | `tools/db.py` ~L50 |
| Traefik forwarding timeouts | **not configured** | `ppd_extraction_backend/docker/traefik/traefik.yml` has no `transport.respondingTimeouts` — Traefik defaults apply (often generous, but not explicitly set for long streams) |
| Compose healthcheck probe | 5s | Does not affect request lifetime |

**Verdict:** Current config **will kill or truncate** long-running agent turns. The Next BFF alone caps at 60s; gunicorn caps at 120s; individual LLM HTTP calls are 30s each (failover can stack). There is no streaming chat endpoint implemented in `api/routes/insights.py` yet, but the BFF already expects SSE (`proxy/route.ts` L68–75) and posts to `/chat` (L44) which is **not** defined on the Python service today.

---

## 2. `ppp_ai_agent` docker-compose runtime

Full file: `PeakPerformanceData/ppp_ai_agent/docker-compose.yml` (36 lines).

### Services

| Service | Image/build | Notes |
|---------|-------------|-------|
| `ppp-ai-agent` | build `.` / `Dockerfile` | Only service |

**No Redis service.**  
**No scheduler / nightly-batch worker service.**  
**No Traefik service** (expects external Traefik on `ppd-shared`).

### Networks

```33:35:PeakPerformanceData/ppp_ai_agent/docker-compose.yml
networks:
  ppd-shared:
    external: true
```

Must pre-exist (`docker network create ppd-shared`), created by extraction deploy (`ppd_extraction_backend/scripts/deploy.sh` L134–138).

### Volumes

- **None** declared for the agent (no log volume, no data volume).
- Sibling `ppd_backend` declares `ppc-logs` and `ppc-redis-data` (`ppd_backend/docker-compose.yml` L61–63).

### Restart & healthcheck

```7:7:PeakPerformanceData/ppp_ai_agent/docker-compose.yml
    restart: unless-stopped
```

```27:31:PeakPerformanceData/ppp_ai_agent/docker-compose.yml
    healthcheck:
      test: ["CMD", "python", "-c", "import urllib.request; urllib.request.urlopen('http://localhost:8001/health')"]
      interval: 30s
      retries: 3
      start_period: 10s
      timeout: 5s
```

Health route exists: `api/routes/health.py` L8–10 → `{"status": "healthy", "service": "ppp_ai_agent"}`.

### Traefik labels (intended public surface)

```13:23:PeakPerformanceData/ppp_ai_agent/docker-compose.yml
    labels:
      - "traefik.enable=true"
      - "traefik.docker.network=ppd-shared"
      - "traefik.http.routers.ppp-ai-agent.rule=Host(`api.wearablesync.app`) && PathPrefix(`/ai`)"
      - "traefik.http.routers.ppp-ai-agent.entrypoints=websecure"
      - "traefik.http.routers.ppp-ai-agent.priority=20"
      - "traefik.http.routers.ppp-ai-agent.tls=true"
      - "traefik.http.routers.ppp-ai-agent.tls.certresolver=letsencrypt"
      - "traefik.http.middlewares.ai-strip.stripprefix.prefixes=/ai"
      - "traefik.http.routers.ppp-ai-agent.middlewares=ai-strip"
      - "traefik.http.services.ppp-ai-agent.loadbalancer.server.port=8001"
```

Public URL shape: `https://api.wearablesync.app/ai/...` → strip `/ai` → app sees `/health`, `/insights`, etc.

Priority `20` beats OpenWearables (`10`) and ppd-api catch-all (`1`) in `dynamic/routes.yml`, and matches `/ppc` priority on `ppc-api`.

### Environment / ClickHouse / Redis wiring gaps

```8:12:PeakPerformanceData/ppp_ai_agent/docker-compose.yml
    env_file:
      - .env
    environment:
      - PORT=8001
      - PYTHONUNBUFFERED=1
```

Compared to `ppd_backend/docker-compose.yml` L25–34:

- Sibling sets `CLICKHOUSE_WEARABLES_HOST=host.docker.internal`, `REDIS_URL=redis://redis:6379/0`, `extra_hosts: host.docker.internal:host-gateway`, and `depends_on: redis`.
- Agent sets **none** of these. `.env.example` defaults ClickHouse to `localhost` and Redis to `redis://localhost:6379/0` — both wrong inside a container on the WearableSync host (ClickHouse is native on host per extraction compose comments L46–47).
- `REDIS_URL` is loaded in `config/settings.py` L31 but **no code imports/uses redis** (only settings + requirements). Declared dependency without compose service or runtime usage.

### Resource limits

- No `mem_limit` / `deploy.resources` / CPU caps on agent or sibling compose files.

---

## 3. How `ppd_backend` is actually deployed (and what the agent must mirror)

There are **three** narratives; only one matches the live Traefik path-routing pattern the agent already labels for.

### A. Intended / current shared-host pattern (Traefik + `ppd-shared`) — **mirror this**

Owned by **`ppd_extraction_backend`** on Hetzner:

| Fact | Evidence |
|------|----------|
| Host | Hetzner CX33 `116.202.100.150` (Helsinki) | `ppd_extraction_backend/scripts/deploy.sh` L5–9 |
| Domain | `api.wearablesync.app`, `webhooks.wearablesync.app` | Traefik routes + deploy script L207–208 |
| Reverse proxy | Traefik v3.3 container | `docker/docker-compose.yml` L5–21 |
| Shared network | external `ppd-shared` | L100–104; created in deploy L134–138 |
| ClickHouse | Native on host, not Docker | compose comment L46–47 |
| Path routing for PPC | `Host(api.wearablesync.app) && PathPrefix(/ppc)` + strip `/ppc` | `ppd_backend/docker-compose.yml` L38–44 |
| Catch-all for extraction API | `Host(...) && !PathPrefix(/ppc)` priority 1 | extraction compose L70–71 |

`ppp_ai_agent` compose already mirrors the **/ppc** pattern as **/ai** (priority 20, strip prefix, same host/certresolver/network). That is the correct production shape.

**What the agent still needs to mirror operationally:**

1. Clone/run on the **same** Hetzner host with `ppd-shared` already up (Traefik from extraction stack).
2. Host `.env` with production secrets (see §5).
3. `extra_hosts` + ClickHouse host override like `ppc-api`.
4. Either share `ppc-redis` / declare Redis or drop unused Redis.
5. `scripts/deploy.sh` + `scripts/auto_deploy.sh` (or document attaching to existing cron) — **absent today**.
6. Fix Dockerfile `COPY agent/`.
7. Point Next.js `PPP_AI_AGENT_URL` at `https://api.wearablesync.app/ai` (or internal `http://ppp-ai-agent:8001` if BFF can reach Docker network — today Vercel/Next likely needs the public Traefik URL).

### B. Alternate / legacy PPC bootstrap (Caddy + dedicated domain)

`ppd_backend/scripts/deploy.sh`:

- Target: Hetzner CX23 `89.167.47.236` (L5)
- Domain: `ppc.peakperformancedata.app` (L27)
- Proxy: **Caddy** (explicitly “simpler than Traefik for single-service”, L55)
- Install path: `/opt/ppc-backend`
- Auto-deploy cron every 5 minutes via `auto_deploy.sh` (L195)

This conflicts with compose Traefik labels pointing at `api.wearablesync.app`. Treat Caddy/`ppc.peakperformancedata.app` as an **older or alternate** path; the compose labels are the WearableSync co-location pattern.

### C. Stale Render docs

- `ppd_backend/README.md` L56–58: “configured for deployment on Render”
- `ppd_backend/render.yaml` — Docker web service, `healthCheckPath: /health`
- Not aligned with Traefik/Hetzner compose. Do **not** use Render as the model for the agent (plan also says Hetzner — `ppp_ai_agent/_plans/...plan.md` L212).

### No systemd units / Makefile

- Neither `ppp_ai_agent` nor `ppd_backend` ships `.service` units or a `Makefile`.
- Process supervision = Docker `restart: unless-stopped` + cron auto-deploy on siblings.
- Traefik/Caddy themselves may be systemd-managed on host (Caddy via `systemctl` in deploy.sh L172); Traefik is a Docker container.

---

## 4. CI status

| Repo / submodule | CI |
|------------------|----|
| `ppd_backend` | **Yes** — `.github/workflows/ci.yml`: ruff + pytest on PR to `main`/`development`, push to `development`; Python 3.11 |
| `ppp_ai_agent` | **ABSENT** — no `.github/` directory at all (`ls` confirms; no workflows) |

Agent has local pytest suite (`tests/`, `pytest.ini`, `requirements-dev.txt`) but nothing runs in GitHub Actions.

---

## 5. Secrets path today

### Declared secrets (`.env.example` L1–23)

| Variable | Purpose |
|----------|---------|
| `PORT`, `ENVIRONMENT` | Service |
| `INTERNAL_SERVICE_SECRET` | Service-to-service auth from Next BFF |
| `SUPABASE_URL`, `SUPABASE_SERVICE_KEY` | DB / RPC |
| `OPENAI_API_KEY`, `DEEPSEEK_API_KEY`, `GROQ_API_KEY` | LLM providers |
| `CLICKHOUSE_WEARABLES_*` | Wearables OLAP |
| `REDIS_URL` | Declared; unused in code |

### How they reach the container

1. Host file `.env` (gitignored — `.gitignore` L15–16).
2. Compose `env_file: - .env` (`docker-compose.yml` L8–9).
3. `config/settings.py` calls `load_dotenv()` then `os.getenv(...)`.

No Docker secrets, Vault, SSM, or Swarm/K8s secret mounts. Same pattern as `ppd_backend` / extraction (`env_file: ../.env`). Bootstrap scripts copy `.env.example` → `.env` and warn to edit manually.

Next.js side: `PPP_AI_AGENT_URL` + `INTERNAL_SERVICE_SECRET` in the Vercel/app env (see `specialistTools.ts`, `proxy/route.ts`).

---

## 6. Missing production concerns checklist

| Concern | `ppp_ai_agent` today | Sibling / stack reference |
|---------|----------------------|---------------------------|
| Graceful shutdown for long requests | `--graceful-timeout 30` only; too short for agents | Same on `ppd_backend` (OK for graphs, not agents) |
| Log shipping | stdout only; no log volume | `ppc-logs`, extraction `../logs` |
| Metrics endpoint | None (`/health` only) | `ppd_backend` `/health` only; no Prometheus |
| Resource limits | None | None on sibling compose either |
| Restart policy | `unless-stopped` | Same |
| Migration step | None (uses remote Supabase; no Alembic) | N/A for both |
| Background worker separate from web | **Missing** — nightly batch is `POST /batch/nightly` on the web process (`insights.py` L33–41) or `python -m agent.nightly_batch` CLI; no compose service like `ppd-scheduler` | Extraction has dedicated `ppd-scheduler` container |
| Deploy scripts | **Missing** | `ppd_backend/scripts/deploy.sh`, `auto_deploy.sh` |
| CI | **Missing** | `ppd_backend/.github/workflows/ci.yml` |
| Non-root user | Runs as root | Same |
| Dockerfile completeness | **Missing `COPY agent/`** | Sibling copies all packages |
| Redis | Dep + env, no service, unused | Sibling runs `redis:7-alpine` |
| ClickHouse from Docker | No `host.docker.internal` | Sibling sets it |
| Traefik long-timeout / SSE | Not configured | Needed for streaming agent turns |
| Upstream BFF timeout | Next `maxDuration = 60` | Must raise or move long work off request path |
| README | None in service root | Sibling README exists (partly stale) |

---

## 7. Side-by-side summary

| Dimension | `ppp_ai_agent` | `ppd_backend` |
|-----------|----------------|---------------|
| Base image | `python:3.10-slim` | Same |
| Dep strategy | requirements.txt + cache layer | Same |
| Gunicorn | 2 × UvicornWorker, timeout 120, graceful 30 | **Identical** flags |
| Port | 8001 | 8000 |
| Compose Traefik | `/ai` on `api.wearablesync.app` | `/ppc` on same host |
| Redis in compose | No | Yes (`ppc-redis`) |
| Log volume | No | Yes |
| Deploy scripts | No | Yes (Caddy/CX23 narrative) |
| CI | **No** | Yes (ruff/pytest) |
| Runs as root | Yes | Yes |
| Healthcheck | Compose only | Compose only |
| Background worker | None | background_jobs in image; no separate compose worker (extraction has scheduler) |
| Image COPY completeness | **Broken** (no `agent/`) | Complete for its tree |

---

## 8. What must change to host a long-running multi-agent service

Prioritized deltas (no implementation in this dossier):

1. **Fix the image** — `COPY agent/` (and any future packages); consider multi-stage drop of `build-essential`; add non-root `USER`.
2. **Raise / redesign timeouts** — gunicorn `--timeout` (e.g. 600+) or prefer bare uvicorn with explicit keep-alive; set Traefik `respondingTimeouts` for long streams; raise Next `maxDuration` well above 60s, or move long work to **async job + poll/SSE from a durable worker**.
3. **Split web vs worker** — compose service for `python -m agent.nightly_batch` (cron/scheduler), keep HTTP workers free for interactive turns; do not run org-wide batch inside a single HTTP request under gunicorn timeout.
4. **Wire host networking** — `extra_hosts` + ClickHouse env like `ppc-api`; decide Redis (share `ppc-redis` on `ppd-shared` or remove).
5. **Ship deploy ops** — `deploy.sh` / `auto_deploy.sh` targeting `/opt/...` on the WearableSync Hetzner box; document `PPP_AI_AGENT_URL=https://api.wearablesync.app/ai`.
6. **Add CI** — mirror `ppd_backend` workflow (ruff + pytest); pin CI Python to image 3.10 or bump both.
7. **Observability** — log volume or stdout → host shipper; `/metrics` or structured request IDs; optional readiness that checks Supabase/CH.
8. **Resource limits & concurrency** — memory/CPU caps; more workers or async-only process model sized for concurrent LLM calls; avoid killing in-flight turns on `max-requests` recycles during peak.

---

## 9. File index (absolute paths)

- `/Users/danielsilva/Desktop/PeakPerformanceDataMonorepo/PeakPerformanceData/ppp_ai_agent/Dockerfile`
- `/Users/danielsilva/Desktop/PeakPerformanceDataMonorepo/PeakPerformanceData/ppp_ai_agent/docker-compose.yml`
- `/Users/danielsilva/Desktop/PeakPerformanceDataMonorepo/PeakPerformanceData/ppp_ai_agent/run.py`
- `/Users/danielsilva/Desktop/PeakPerformanceDataMonorepo/PeakPerformanceData/ppp_ai_agent/.gitignore`
- `/Users/danielsilva/Desktop/PeakPerformanceDataMonorepo/PeakPerformanceData/ppp_ai_agent/.env.example`
- `/Users/danielsilva/Desktop/PeakPerformanceDataMonorepo/PeakPerformanceData/ppd_backend/Dockerfile`
- `/Users/danielsilva/Desktop/PeakPerformanceDataMonorepo/PeakPerformanceData/ppd_backend/docker-compose.yml`
- `/Users/danielsilva/Desktop/PeakPerformanceDataMonorepo/PeakPerformanceData/ppd_backend/scripts/deploy.sh`
- `/Users/danielsilva/Desktop/PeakPerformanceDataMonorepo/PeakPerformanceData/ppd_backend/scripts/auto_deploy.sh`
- `/Users/danielsilva/Desktop/PeakPerformanceDataMonorepo/PeakPerformanceData/ppd_backend/README.md`
- `/Users/danielsilva/Desktop/PeakPerformanceDataMonorepo/PeakPerformanceData/ppd_backend/render.yaml`
- `/Users/danielsilva/Desktop/PeakPerformanceDataMonorepo/PeakPerformanceData/ppd_backend/.github/workflows/ci.yml`
- `/Users/danielsilva/Desktop/PeakPerformanceDataMonorepo/PeakPerformanceData/ppd_extraction_backend/docker/docker-compose.yml`
- `/Users/danielsilva/Desktop/PeakPerformanceDataMonorepo/PeakPerformanceData/ppd_extraction_backend/docker/traefik/traefik.yml`
- `/Users/danielsilva/Desktop/PeakPerformanceDataMonorepo/PeakPerformanceData/ppd_extraction_backend/docker/traefik/dynamic/routes.yml`
- `/Users/danielsilva/Desktop/PeakPerformanceDataMonorepo/PeakPerformanceData/ppd_extraction_backend/scripts/deploy.sh`
- `/Users/danielsilva/Desktop/PeakPerformanceDataMonorepo/PeakPerformanceData/ppd_extraction_backend/scripts/auto_deploy.sh`
