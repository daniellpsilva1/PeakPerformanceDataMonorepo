# Setup Guide

## Prerequisites

| Tool | Version | Purpose |
|------|---------|---------|
| Node.js | >= 18.x | Frontend |
| npm | >= 10.x | Package manager (frontend uses npm) |
| Python | 3.10+ (ppd_backend), 3.13+ (ppd_extraction_backend) | Backends |
| pip | latest | Python package management |
| Docker | latest | Containerized deployment |
| Docker Compose | v2+ | Multi-container orchestration |
| ClickHouse | latest | Timeseries database (native install or Docker) |
| Supabase CLI | latest | Database migrations |

---

## 1. Frontend (`peak_performance_data/`)

### Install dependencies

```bash
cd PeakPerformanceData/peak_performance_data
npm install
```

### Environment variables

Create `.env.local` in `PeakPerformanceData/peak_performance_data/`:

```env
# API URLs
NEXT_PUBLIC_API_URL=http://localhost:8000
NEXT_PUBLIC_PPC_API_URL=http://localhost:8001/ppc
WEARABLE_SYNC_API_URL=http://localhost:8001
NEXT_PUBLIC_APP_URL=http://localhost:3000

# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://bcfwtgqvusjhlrqsztod.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<your-anon-key>
SUPABASE_SERVICE_ROLE_KEY=<your-service-key>

# AI
DEEPSEEK_API_KEY=<your-deepseek-key>
GROQ_API_KEY=<your-groq-key>

# Garmin
GARMIN_CONSUMER_KEY=<your-garmin-consumer-key>
GARMIN_CONSUMER_SECRET=<your-garmin-consumer-secret>
GARMIN_WEBHOOK_VERIFICATION_TOKEN=<your-verification-token>

# Other
CRON_API_KEY=<your-cron-key>
CRON_SECRET_KEY=<your-cron-secret>
ADMIN_EMAIL=admin@example.com
```

See `PeakPerformanceData/ppd_extraction_backend/.env.example` for extraction backend env vars.

### Run development server

```bash
npm run dev
```

Server starts at `http://localhost:3000`. Locale-prefixed routes: `/en/`, `/es/`, `/zh/`, `/ca/`.

### Build for production

```bash
npm run build
npm start
```

### Run tests

```bash
npm test              # Run all tests (Vitest)
npm run test:watch    # Watch mode
npm run lint          # ESLint
npm run typecheck     # TypeScript type checking
```

Test config: `PeakPerformanceData/peak_performance_data/vitest.config.ts` (jsdom environment, setup file at `tests/setup.ts`).

### Supabase migrations

```bash
cd PeakPerformanceData/peak_performance_data
npx supabase db push          # Apply migrations to remote Supabase
# Or locally:
npx supabase start            # Start local Supabase stack
npx supabase db reset         # Reset and apply all migrations
```

Migration files: `PeakPerformanceData/peak_performance_data/supabase/migrations/` (56 files).

### Deploy to Vercel

```bash
cd PeakPerformanceData/peak_performance_data
./deploy.sh                   # Interactive deploy script
# Or manually:
vercel --prod
```

**Config**: `PeakPerformanceData/peak_performance_data/vercel.json`
- Scheduled cron jobs (garmin sync, data processing)
- API route headers
- Regions: `sfo1`, `iad1`
- Redirects and rewrites for presentation content

---

## 2. Graph Backend (`ppd_backend/`)

### Install dependencies

```bash
cd PeakPerformanceData/ppd_backend
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt
pip install -r requirements-dev.txt   # Dev: pytest, jupyter, matplotlib, scikit-learn
```

### Environment variables

Create `.env` in `PeakPerformanceData/ppd_backend/`:

```env
SUPABASE_URL=https://bcfwtgqvusjhlrqsztod.supabase.co
SUPABASE_SERVICE_ROLE_KEY=<your-service-key>
SUPABASE_ANON_KEY=<your-anon-key>

CLICKHOUSE_WEARABLES_HOST=localhost
CLICKHOUSE_WEARABLES_PORT=8123
CLICKHOUSE_WEARABLES_DATABASE=wearables_data
CLICKHOUSE_WEARABLES_USER=default
CLICKHOUSE_WEARABLES_PASSWORD=

INTERNAL_SERVICE_SECRET=<your-secret>

# Airtable (optional)
AIRTABLE_API_KEY=<your-airtable-key>
AIRTABLE_BASE_ID=<your-base-id>

# AWS S3 (optional)
AWS_ACCESS_KEY_ID=<your-key>
AWS_SECRET_ACCESS_KEY=<your-secret>
AWS_S3_BUCKET=<your-bucket>
```

### Run development server

```bash
cd PeakPerformanceData/ppd_backend
python run.py
```

Server starts at `http://localhost:8000`. API docs at `http://localhost:8000/docs`.

### Run tests

```bash
cd PeakPerformanceData/ppd_backend
pytest tests/                    # All tests
pytest tests/test_data_processing/  # Data processing tests (22 items)
pytest tests/test_api/           # API tests
pytest tests/test_background_jobs/  # Background job tests
```

### Deploy with Docker

```bash
cd PeakPerformanceData/ppd_backend
docker build -t ppd-backend .
docker run -p 8000:8000 --env-file .env ppd-backend
```

### Deploy with Docker Compose (includes Redis)

```bash
cd PeakPerformanceData/ppd_backend
docker compose up -d
```

**Config**: `PeakPerformanceData/ppd_backend/docker-compose.yml` — Redis + backend API with Traefik labels.

### Deploy to Render

**Config**: `PeakPerformanceData/ppd_backend/render.yaml`
- Docker-based deployment
- Health check: `/health`
- Plan: starter

---

## 3. Extraction Backend (`ppd_extraction_backend/`)

### Install dependencies

```bash
cd PeakPerformanceData/ppd_extraction_backend
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt
```

### Environment variables

Copy `PeakPerformanceData/ppd_extraction_backend/.env.example` to `.env` and fill in:

```env
# ClickHouse
CLICKHOUSE_HOST=localhost
CLICKHOUSE_PORT=9000
CLICKHOUSE_DATABASE=wearables_data
CLICKHOUSE_OW_DATABASE=openwearables_data
CLICKHOUSE_USER=default
CLICKHOUSE_PASSWORD=

# Supabase (for org lookup)
SUPABASE_URL=https://bcfwtgqvusjhlrqsztod.supabase.co
SUPABASE_SERVICE_KEY=<your-service-key>

# OpenWearables
OPENWEARABLES_ENABLED=false
OPENWEARABLES_API_URL=http://localhost:8000
OPENWEARABLES_API_KEY=<your-ow-key>

# Garmin OAuth
GARMIN_CONSUMER_KEY=<your-key>
GARMIN_CONSUMER_SECRET=<your-secret>

# Encryption
ENCRYPTION_KEY=<fernet-key>  # Generate: python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"
API_SECRET_KEY=<your-api-secret>

# Webhook
WEBHOOK_BASE_URL=https://webhooks.wearablesync.app

# Extraction
EXTRACTION_TIMEZONE=UTC
BACKFILL_DAYS=30
MAX_RETRIES=3
```

### Run development server

```bash
cd PeakPerformanceData/ppd_extraction_backend
python -m uvicorn src.api.main:app --host 0.0.0.0 --port 8080 --reload
```

Server starts at `http://localhost:8080`. Health check at `/health`.

### Run scheduler

```bash
python main.py run-scheduler
```

### Run tests

```bash
cd PeakPerformanceData/ppd_extraction_backend
pytest tests/                           # All tests
pytest tests/extractors/                # Extractor tests (42 items)
pytest tests/openwearables/             # OpenWearables tests
pytest tests/scheduler/                 # Scheduler tests
pytest tests/database/                  # Database tests
```

### ClickHouse migrations

```bash
cd PeakPerformanceData/ppd_extraction_backend
python main.py migrate
```

Migration files: `PeakPerformanceData/ppd_extraction_backend/migrations/` (11 SQL files).

### Deploy with Docker (production)

```bash
# Prerequisites:
# 1. ClickHouse running on host
# 2. Create shared network: docker network create ppd-shared
# 3. OpenWearables stack running on ppd-shared network

cd PeakPerformanceData/ppd_extraction_backend/docker
docker compose up -d
```

**Config**: `PeakPerformanceData/ppd_extraction_backend/docker/docker-compose.yml`
- Two containers: `ppd-api` (API+webhooks) and `ppd-scheduler` (background extraction)
- Traefik reverse proxy with TLS (Let's Encrypt)
- ClickHouse accessed via `host.docker.internal`
- Network: `ppd-shared` (external, shared with OpenWearables)

### Development Docker

```bash
cd PeakPerformanceData/ppd_extraction_backend/docker
docker compose -f docker-compose.dev.yml up -d
```

---

## 4. Marketing Assets (`PeakPerformanceDataMarketing/`)

### Remotion (Marketing Video)

```bash
cd PeakPerformanceDataMarketing/Remotion
npm install
npm run dev          # Studio at http://localhost:3000
npm run build        # Render video
```

### Manim (Tennis Visualization)

```bash
cd PeakPerformanceDataMarketing/Manim
pip install manim
manim -pql scenes/intro_scene.py IntroScene
python main.py       # Stitch all scenes
```

### ThreeJS (Digital Twin)

```bash
cd PeakPerformanceDataMarketing/ThreeJS
npm install
npm run dev
npm run build
```

### courtviz (Tennis Court Visualization)

```bash
cd PeakPerformanceDataMarketing/courtviz
npm install
npm run dev
npm run build
npm test             # Vitest
```

---

## Full Local Development Setup

1. **Start ClickHouse** (native or Docker):
   ```bash
   docker run -d --name clickhouse -p 8123:8123 -p 9000:9000 clickhouse/clickhouse-server
   ```

2. **Apply ClickHouse migrations**:
   ```bash
   cd PeakPerformanceData/ppd_extraction_backend
   python main.py migrate
   ```

3. **Start ppd_backend**:
   ```bash
   cd PeakPerformanceData/ppd_backend
   python run.py
   ```

4. **Start ppd_extraction_backend**:
   ```bash
   cd PeakPerformanceData/ppd_extraction_backend
   python -m uvicorn src.api.main:app --port 8080 --reload
   ```

5. **Start frontend**:
   ```bash
   cd PeakPerformanceData/peak_performance_data
   npm run dev
   ```

6. **Access the app**: `http://localhost:3000/en/`

---

## Environment Variable Reference

### Frontend (`peak_performance_data/.env.local`)

| Variable | Required | Description |
|----------|----------|-------------|
| `NEXT_PUBLIC_SUPABASE_URL` | Yes | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Yes | Supabase anon key |
| `SUPABASE_SERVICE_ROLE_KEY` | Yes | Supabase service role key (server-side only) |
| `NEXT_PUBLIC_API_URL` | Yes | ppd_backend URL |
| `NEXT_PUBLIC_PPC_API_URL` | Yes | ppd_backend PPC endpoint URL |
| `WEARABLE_SYNC_API_URL` | Yes | ppd_extraction_backend URL |
| `NEXT_PUBLIC_APP_URL` | Yes | Frontend public URL |
| `DEEPSEEK_API_KEY` | Yes | DeepSeek API key for AI agent |
| `GROQ_API_KEY` | No | Groq API key (AI fallback) |
| `GARMIN_CONSUMER_KEY` | Yes | Garmin Connect consumer key |
| `GARMIN_CONSUMER_SECRET` | Yes | Garmin Connect consumer secret |
| `GARMIN_WEBHOOK_VERIFICATION_TOKEN` | Yes | Garmin webhook verification |
| `CRON_API_KEY` | Yes | Cron job authentication |
| `CRON_SECRET_KEY` | Yes | Cron job secret |
| `ADMIN_EMAIL` | Yes | Admin email for notifications |

### ppd_backend (`.env`)

| Variable | Required | Description |
|----------|----------|-------------|
| `SUPABASE_URL` | Yes | Supabase URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Yes | Supabase service key |
| `SUPABASE_ANON_KEY` | Yes | Supabase anon key |
| `CLICKHOUSE_WEARABLES_HOST` | Yes | ClickHouse host |
| `CLICKHOUSE_WEARABLES_PORT` | Yes | ClickHouse HTTP port (8123) |
| `CLICKHOUSE_WEARABLES_DATABASE` | Yes | ClickHouse database name |
| `INTERNAL_SERVICE_SECRET` | Yes | Internal service auth secret |
| `AIRTABLE_API_KEY` | No | Airtable integration |
| `AWS_ACCESS_KEY_ID` | No | S3 for graph image uploads |
| `AWS_SECRET_ACCESS_KEY` | No | S3 secret |
| `AWS_S3_BUCKET` | No | S3 bucket name |

### ppd_extraction_backend (`.env`)

See `PeakPerformanceData/ppd_extraction_backend/.env.example` for complete reference.

---

## Deployment Summary

| Service | Platform | Config File | Health Check |
|---------|----------|-------------|--------------|
| Frontend | Vercel | `vercel.json` | Automatic |
| ppd_backend | Render | `render.yaml` | `/health` |
| ppd_extraction_backend | Docker (Hetzner) | `docker/docker-compose.yml` | `/health` |
| ClickHouse | Native (Hetzner host) | — | — |
| OpenWearables | Docker (Hetzner, separate stack) | External | — |
