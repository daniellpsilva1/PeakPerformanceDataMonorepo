# Research Dossier 30 — CI/CD, Quality Gates & Secrets Management

**Date:** 2026-08-02  
**Scope:** Read-only inventory of CI/CD, quality gates, deploy mechanisms, and secrets handling across the monorepo root and target submodules: `peak_performance_data`, `ppd_backend`, `ppd_extraction_backend`, `ppd_vision`, `swingvision-pipeline`, `ppp_ai_agent`, `ppd_research_papers`.  
**Constraint:** No code changes; no secret values printed. Locations and key *names* only.  
**Audience:** Engineering the new multi-agent Python service (`ppp_ai_agent` / successor) so it fits the existing pipeline.

---

## 0. Executive map

| Repo | Workflows | Quality bar | Deploy | Secrets live in |
|------|-----------|-------------|--------|-----------------|
| Monorepo root | **None** | N/A | N/A (pointer commits only) | N/A |
| `peak_performance_data` | `.github/workflows/ci.yml` | ESLint + Vitest + Next build + (WIP) bundle budgets; Husky lint-staged | **Vercel** (Git-connected + optional `deploy.sh`) | Vercel env + GitHub Actions secrets + local `.env*` |
| `ppd_backend` | `.github/workflows/ci.yml` | `ruff check` + `pytest` (no coverage gate) | **Hetzner** Docker + cron `auto_deploy.sh` (legacy `render.yaml` present) | Host `.env` on Hetzner |
| `ppd_extraction_backend` | `.github/workflows/ci.yml` | Same pattern as backend | **Hetzner** Docker/Traefik; `auto_deploy.sh` exists (cron not wired in `deploy.sh`) | Host `.env` |
| `ppd_vision` | **None** | Ad-hoc (`requirements.txt`, tests dir) | Hetzner Docker/Traefik (`docker/docker-compose.yml`); no deploy script in repo | Host `.env` |
| `swingvision-pipeline` | `.github/workflows/ci.yml` | `tsc` + ESLint + Vitest + Next build | Dashboard: **Vercel**; workers: **Mac Mini launchd** | Vercel env + Mac Mini `.env` |
| `ppp_ai_agent` | **None** | Local: `ruff` in `requirements-dev.txt`, `pytest.ini`, offline eval helpers | Intended: Hetzner Traefik on `ppd-shared` (`docker-compose.yml`) | Host `.env` (templated by `.env.example`) |
| `ppd_research_papers` | **None** | Docs only | N/A | N/A |

**Merge blocking reality:** `gh api …/branches/main/protection` returns **404 Branch not protected** for `PeakPerformanceDataV2`, `PPD_Backend`, `PPD_Extraction_Backend`, `swingvision-pipeline`, and `ppp_ai_agent`. Rulesets are empty (`[]`). CI workflows therefore run on PRs but **do not currently enforce merge blocking** via GitHub required checks. Treat them as soft gates unless branch protection is enabled later.

**No Doppler / Vault / 1Password Secrets Manager** usage found in deploy scripts or runtime configs. Mentions of “secrets manager” appear only as aspirational notes in extraction memory-bank docs.

---

## 1. Workflow inventory (exact)

### 1.1 Root monorepo

- Path: no `.github/` directory.
- Submodule orchestration is documented in root `README.md` (L66–88): changes land in the child repo first; root records a new submodule SHA.

### 1.2 `peak_performance_data` — `.github/workflows/ci.yml`

**File:** `PeakPerformanceData/peak_performance_data/.github/workflows/ci.yml`  
**Working-tree note (2026-08-02):** Uncommitted diff adds a `bundle-budgets` job after `build` (not yet on remote HEAD at investigation time). HEAD already had lint/test/build; typecheck was **removed** in commit `3f73a7c3` (“Remove typecheck job from CI workflow”, 2026-04-01).

| Field | Value |
|-------|--------|
| Name | `CI` (L1) |
| Triggers | `pull_request` → `main`, `development` (L3–5); `push` → `development` (L6–7) |
| Concurrency | `group: ${{ github.workflow }}-${{ github.ref }}`, `cancel-in-progress: true` (L9–11) |

| Job | Lines | Steps | Gates |
|-----|-------|-------|-------|
| `lint` | L14–24 | checkout@v4, setup-node@v4 (Node 20, npm cache), `npm ci`, `npm run lint` | ESLint via `next lint` |
| `test` | L26–36 | same install, `npm run test -- --run --reporter=verbose` | Vitest unit tests |
| `build` | L38–52 | needs `[lint, test]`; env `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` from **GitHub secrets**; `npm run build` | Production Next build |
| `bundle-budgets` (working tree) | L54–69 | needs `[build]`; same Supabase secrets; `npm run build:analyze` then `npm run check-bundle-budgets` | First-Load JS budgets in `scripts/check-bundle-budgets.js` |

**Blocks merge?** Only if branch protection later requires these jobs. Currently: **no**.

**CI ↔ secrets mismatch:** Workflow expects `secrets.NEXT_PUBLIC_SUPABASE_URL` and `secrets.NEXT_PUBLIC_SUPABASE_ANON_KEY` (L43–44, L59–60). `gh secret list -R daniellpsilva1/PeakPerformanceDataV2` shows `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, Strava/Garmin/CRON keys — **not** those `NEXT_PUBLIC_*` names. Build may receive empty public Supabase env unless org/environment secrets exist outside the listed set.

### 1.3 `ppd_backend` — `.github/workflows/ci.yml`

**File:** `PeakPerformanceData/ppd_backend/.github/workflows/ci.yml`

| Field | Value |
|-------|--------|
| Triggers | PR → `main`/`development`; push → `development` (L3–7) |
| Concurrency | Same pattern as frontend (L9–11) |
| Job | Single `lint-and-test` (L14–30) |
| Python | **3.11** (L21) — note Docker image is **3.10** (`Dockerfile` L1) |
| Steps | `pip install -r requirements.txt` → `pip install ruff` → `ruff check .` → `pytest -v --tb=short` with `TESTING=true` |

**GitHub secrets:** none listed for `PPD_Backend`.  
**Blocks merge?** Soft only (no branch protection).

### 1.4 `ppd_extraction_backend` — `.github/workflows/ci.yml`

**File:** `PeakPerformanceData/ppd_extraction_backend/.github/workflows/ci.yml`

Identical shape to `ppd_backend`, except Python **3.12** (L21). Same ruff + pytest invocation (L24–30). `pytest`/`pytest-cov` are in `requirements.txt` (L36–38) but CI does **not** pass `--cov` or a fail-under threshold.

**GitHub secrets:** none listed.  
**Blocks merge?** Soft only.

### 1.5 `swingvision-pipeline` — `.github/workflows/ci.yml`

**File:** `PeakPerformanceData/swingvision-pipeline/.github/workflows/ci.yml`

| Field | Value |
|-------|--------|
| Triggers | `push`/`pull_request` → `main` only (L3–7) |
| Job | Single `check` (L10–38) |
| Steps | `npm ci` → `npx tsc --noEmit` → `npm run lint` → `npm test` → `npm run build` with **dummy** Supabase env hardcoded (L36–38) |

**GitHub secrets:** none listed (build uses placeholders).  
**Blocks merge?** Soft only.

### 1.6 Repos with no workflows

- `ppd_vision` — no `.github/workflows/`
- `ppp_ai_agent` — no `.github/`
- `ppd_research_papers` — no `.github/`

---

## 2. Python quality bar — `ppd_backend` (copy this pattern)

### 2.1 What CI actually runs

```24:30:PeakPerformanceData/ppd_backend/.github/workflows/ci.yml
      - run: pip install ruff
      - name: Lint with ruff
        run: ruff check .
      - name: Run tests
        run: pytest -v --tb=short
        env:
          TESTING: "true"
```

### 2.2 Ruff config

- **No** `ruff.toml`, `.ruff.toml`, or `[tool.ruff]` in `pyproject.toml` (no `pyproject.toml` at all).
- Effective bar = **Ruff defaults** + whatever version `pip install ruff` resolves on the runner (unpinned in CI).
- Contrast: `ppp_ai_agent/requirements-dev.txt` L3 pins `ruff==0.3.4` for local use, but no CI.

### 2.3 Pytest / coverage

| Item | Finding |
|------|---------|
| Invocation | `pytest -v --tb=short` |
| Coverage threshold | **None** in CI or config |
| `pytest.ini` / `pyproject` | **Absent** in `ppd_backend` |
| Dev deps | `requirements-dev.txt` L11–12: `pytest==7.4.4`, `pytest-asyncio==0.21.1` |
| CI install gap | CI installs only `requirements.txt`, which **does not** include pytest (L1–24 of `requirements.txt` are production deps). Pytest is expected via `requirements-dev.txt` locally; CI may rely on a transitive install or is fragile. **New service should install `requirements-dev.txt` (or an explicit CI deps file) in the workflow.** |

### 2.4 Format / type-check

- No Black/isort/mypy config in `ppd_backend`.
- No Makefile.
- No pre-commit hooks in the Python repos.

### 2.5 Pattern summary for the new agent service

Mirror:

1. Workflow on PR to `main`/`development` + push to `development`.
2. Python version pinned in workflow (prefer aligning with Dockerfile; backend currently skews 3.11 CI vs 3.10 image — **prefer one version**).
3. `pip install -r requirements.txt -r requirements-dev.txt` (fix the backend gap).
4. Pin `ruff` and run `ruff check .` (optionally add `ruff format --check` once a config exists).
5. `pytest -v --tb=short` with `TESTING=true` (or service-equivalent).
6. Do **not** invent coverage fail-under unless product decides to raise the bar above the current sibling.

---

## 3. TypeScript quality bar — `peak_performance_data`

### 3.1 Lint

| Artifact | Path | Notes |
|----------|------|-------|
| Flat ESLint config | `eslint.config.mjs` L12–25 | Extends `next/core-web-vitals` + `@typescript-eslint/recommended`; `no-explicit-any` off; unused-vars warn; `no-console` warn (allow warn/error) |
| Legacy JSON | `.eslintrc.json` L1–21 | Same rules; likely residual alongside flat config |
| Script | `package.json` L13 | `"lint": "next lint"` |
| Lint-staged | `package.json` L121–125 | `*.{ts,tsx}` → `next lint --fix --file` |
| Husky pre-commit | `.husky/pre-commit` L1 | `npx lint-staged` |
| Husky prepare | `package.json` L21 | Skips husky when `VERCEL`, `CI`, or `HUSKY=0` |

**No Biome. No Prettier config** in this app (formatting = ESLint/`next lint --fix` via lint-staged only).

### 3.2 Type-check

| Artifact | Path | In CI? |
|----------|------|--------|
| `tsconfig.json` | L1–29 | `strict: true`, `noEmit: true`, paths `@/*` → `./src/*` |
| Script | `package.json` L15 `"typecheck": "tsc --noEmit"` | **Not in CI** (explicitly removed) |
| SwingVision contrast | swingvision CI L24–25 runs `npx tsc --noEmit` | Yes |

### 3.3 Tests

| Artifact | Path | Notes |
|----------|------|-------|
| Vitest | `vitest.config.ts` L5–16 | jsdom, globals, `./tests/setup.ts`, `@` alias |
| Script | `package.json` L14 | `"test": "vitest"` |
| CI | `ci.yml` L36 | `npm run test -- --run --reporter=verbose` |

### 3.4 Build & bundle budgets

| Artifact | Path | Notes |
|----------|------|-------|
| Next build | `package.json` L9 | `next build`; `prebuild` may build vendored courtviz |
| Analyze | L10 | `ANALYZE=true next build` |
| Budgets | `scripts/check-bundle-budgets.js` L14–24 | Per-route First Load JS byte caps (e.g. charts 400KB, tennis-analytics 450KB) |
| Vercel | `vercel.json` L29–31 | `installCommand` / `buildCommand` with `HUSKY=0`; region `iad1` |

---

## 4. Deploy mechanisms (with evidence)

### 4.1 `peak_performance_data` → Vercel

| Evidence | Location |
|----------|----------|
| Vercel project linkage | `.vercel/project.json` (`projectId`, `orgId`) |
| `vercel.json` | crons, headers, build/install commands, rewrites to academies presentation |
| CLI helper | `deploy.sh` L1–63 — interactive `vercel --prod` after local build |
| Production path in code | `src/app/api/ppc-proxy/[...path]/route.ts` L139–140 hardcodes Hetzner Traefik `https://api.wearablesync.app/ppc` |
| Speed Insights dep | `package.json` L66 `@vercel/speed-insights` |

**Mechanism:** GitHub repo connected to Vercel (standard Vercel Git integration). `deploy.sh` is an optional manual CLI path. Env vars are expected in the **Vercel dashboard** (`deploy.sh` L53–55).

### 4.2 `ppd_backend` → Hetzner (primary), Render (legacy)

| Evidence | Location |
|----------|----------|
| Bootstrap SSH deploy | `scripts/deploy.sh` L1–12 — target Hetzner CX23 `89.167.47.236`; clone to `/opt/ppc-backend` |
| Repo URL in script | L26 `https://github.com/daniellpsilva1/PPC_Backend.git` (naming lag vs `PPD_Backend`) |
| Host `.env` | L109–145 — create from example or template; secrets stay on disk |
| Reverse proxy | Script installs **Caddy** for `ppc.peakperformancedata.app` (L155–173); compose also has **Traefik labels** for `api.wearablesync.app/ppc` (`docker-compose.yml` L35–45) |
| Auto-deploy | `scripts/auto_deploy.sh` L1–47 — cron every 5 min: `git fetch`/`pull` origin/main → `docker compose build` → `up -d` |
| Cron install | `deploy.sh` L188–201 wires the cron |
| Legacy Render | `render.yaml` L1–30 + README L56–58 — Docker web service blueprint; CORS still mentions `ppc-backend-8ow2.onrender.com` in frontend |

**Mechanism:** Manual one-time SSH bootstrap, then **polling auto-deploy from `main`** (not GitHub Actions deploy, not webhook). Secrets: **`.env` on the host**, never from GH secrets (repo has none).

### 4.3 `ppd_extraction_backend` → Hetzner

| Evidence | Location |
|----------|----------|
| Bootstrap | `scripts/deploy.sh` L1–15 — CX33 `116.202.100.150`, `/opt/ppd-extraction` |
| Traefik + Docker | `docker/docker-compose.yml` owns Traefik; ClickHouse native on host |
| Host `.env` | From `.env.example` (L116–127 of deploy.sh) |
| `auto_deploy.sh` | Exists (`scripts/auto_deploy.sh` L1–49) — same pull/rebuild pattern for `ppd-scheduler` + `ppd-api` |
| Cron wiring | **Not** installed by `deploy.sh` (unlike backend). Cron must be added manually if used. |

### 4.4 `ppd_vision` → Hetzner GPU (documented; no CI/deploy script)

| Evidence | Location |
|----------|----------|
| Compose + Traefik | `docker/docker-compose.yml` L27–59 — host `vision.wearablesync.app`, NVIDIA device reservation |
| Env | `.env` / `.env.example` — `DATABASE_URL` points at Hetzner Postgres host IP in the example template |
| Deploy script | **Absent** — deploy is manual `docker compose` on the GPU host |

### 4.5 `swingvision-pipeline` → Vercel + Mac Mini

| Evidence | Location |
|----------|----------|
| README | L29–37, L82–99 — Dashboard auto-deployed from GitHub on Vercel; workers via launchd |
| launchd | `infra/launchd/com.danielsilva.svp.mac-mini.worker.plist` — WorkingDirectory + `.venv` python module `workers.processing_worker` |
| CI | Dummy env for build only |

### 4.6 `ppp_ai_agent` → intended Hetzner Traefik peer

| Evidence | Location |
|----------|----------|
| Compose | `docker-compose.yml` L1–35 — Traefik labels `Host(api.wearablesync.app) && PathPrefix(/ai)`, network `ppd-shared` external |
| Dockerfile | Python 3.10-slim + gunicorn/uvicorn (same shape as `ppd_backend`) |
| Deploy script / CI | **None yet** — should copy `ppd_backend` auto-deploy pattern onto the wearables host that already runs Traefik |

---

## 5. Secrets management

### 5.1 Where secrets live (by environment)

| Environment | Mechanism | Evidence |
|-------------|-----------|----------|
| Vercel (Next apps) | Project Environment Variables | `deploy.sh` next-steps; swingvision README L87–99; `.vercel/project.json` |
| GitHub Actions | Repository secrets | `peak_performance_data` CI L43–44; `gh secret list` for PeakPerformanceDataV2 |
| Hetzner services | `.env` file on host under `/opt/...` | `ppd_backend`/`ppd_extraction_backend` deploy scripts |
| Mac Mini workers | Local `.env` + launchd env | swingvision README + plist `EnvironmentVariables` |
| Local dev | `.env.local` / `.env` (gitignored patterns) | Multiple `.gitignore` files |
| Doppler / Vault | **Not used** | No references in deploy/runtime paths |

### 5.2 GitHub Actions secrets (PeakPerformanceDataV2) — names only

From `gh secret list` (updated timestamps retained in GH; values never fetched):

- `CRON_SECRET`
- `GARMIN_API_KEY`
- `GARMIN_CONSUMER_KEY`
- `GARMIN_CONSUMER_SECRET`
- `NEXT_PUBLIC_APP_URL`
- `STRAVA_CLIENT_ID`
- `STRAVA_CLIENT_SECRET`
- `SUPABASE_SERVICE_ROLE_KEY`
- `SUPABASE_URL`
- `SYNC_ENDPOINT_URL`

Sibling Python / swingvision / `ppp_ai_agent` repos: **no** Actions secrets configured.

### 5.3 AI-relevant env vars referenced in code (names only)

#### Next app (`peak_performance_data`)

| Variable | Example reference |
|----------|-------------------|
| `DEEPSEEK_API_KEY` | `src/lib/ai/agentConfig.ts` L13–17 |
| `GROQ_API_KEY` | `agentConfig.ts` L26–30; `src/app/api/transcribe/route.ts` L30–33 |
| `OPENAI_API_KEY` | `src/lib/ai/utils/semanticMemory.ts` L186 |
| `INTERNAL_SERVICE_SECRET` | `wearableInsightTools.ts` L57, L138; `garminActivityTools.ts` L37; `wearable-query/route.ts` L52 |
| `PPD_BACKEND_URL` | `wearableInsightTools.ts` L137; `wearable-query/route.ts` L46 |
| `SUPABASE_SERVICE_ROLE_KEY` / `NEXT_PUBLIC_SUPABASE_*` | Widespread (`admin-client.ts`, `service.ts`, middleware, etc.) |
| `CRON_SECRET` / `CRON_SECRET_KEY` / `CRON_API_KEY` | cron cleanup route; `.env.production` key names |
| `VISION_API_URL` / `VISION_API_KEY` | `src/app/api/vision-proxy/[...path]/route.ts` L15–16 |
| `RESEND_API_KEY`, `WASENDER_API_KEY` | email / WhatsApp notifications |
| Cloudflare R2 keys | `src/lib/r2/client.ts`, storage helpers |

#### Python agent (`ppp_ai_agent`)

From `.env.example` L1–23 and `config/settings.py` L9–31:

- `INTERNAL_SERVICE_SECRET`
- `SUPABASE_URL`, `SUPABASE_SERVICE_KEY`
- `OPENAI_API_KEY`, `DEEPSEEK_API_KEY`, `GROQ_API_KEY`
- `LLM_PRIMARY` / `LLM_FALLBACK` (`config/provider_router.py` L63–64)
- `CLICKHOUSE_WEARABLES_*`
- `REDIS_URL`

#### Backend / extraction / vision

- `ppd_backend/config/database.py` L18–34: `SUPABASE_*`, `CLICKHOUSE_WEARABLES_*`, `OPENWEARABLES_API_KEY`
- Extraction `.env.example`: ClickHouse, Supabase, `ENCRYPTION_KEY`, `API_SECRET_KEY`, Garmin/OpenWearables keys
- Vision `.env.example`: `API_KEY`, `DATABASE_URL`

### 5.4 Committed-secret findings (locations only — values not printed)

| Location | Finding | Severity |
|----------|---------|----------|
| `peak_performance_data/.env.production` | **Tracked in git** despite `.gitignore` `.env*` rule (force-tracked override). Contains **28 keys** with non-placeholder lengths including `SUPABASE_SERVICE_ROLE_KEY`, `STRAVA_CLIENT_SECRET`, `GARMIN_CONSUMER_SECRET`, `CLOUDFLARE_R2_SECRET_ACCESS_KEY`, `GITHUB_PAT`, cron keys, authorized API keys. AI LLM keys are **not** among those 28. | **Critical — rotate & purge from history** |
| `ppd_extraction_backend/garmin_tokens/oauth1_token.json` | Tracked; nonempty OAuth token fields | **Critical** |
| `ppd_extraction_backend/garmin_tokens/oauth2_token.json` | Tracked; nonempty access/refresh tokens | **Critical** |
| `ppd_extraction_backend/.env.example` | Contains a real Supabase project URL host (not a private key); service key left empty | Medium (infra identifier) |
| `ppd_vision/.env.example` | Contains a Hetzner Postgres host IP in `DATABASE_URL` template | Medium |
| `swingvision-pipeline/.env.example` | Mostly placeholders (`<…>` markers); real-looking project URL host + UUID owner id; **not** JWT service keys | Low–medium |
| `ppp_ai_agent/.env.example` | Empty placeholders only | OK |
| Local untracked `.env` / `.env.local` on disk | Present under several checkouts; gitignored | OK if never `git add -f` |

**No Doppler/Vault.** Production Hetzner secrets are plain `.env` files on the VM.

---

## 6. Submodule workflow

### 6.1 How pointer updates work

Root `.gitmodules` lists each child with `path`, `url`, and usually `branch = main`.

Documented flow (`README.md` L74–88):

1. Commit & push **inside** the submodule remote.
2. In the monorepo root: `git add PeakPerformanceData/<submodule>` and commit the **new gitlink SHA**.
3. Push the root repo.

`git submodule update --remote --merge` pulls latest remote tips into checkouts; a root commit is still required to pin what others get on `--recursive` clone.

### 6.2 Does a `ppp_ai_agent` change require a root commit?

**Yes — if the monorepo pin should move.**

- Deploy of the service (once auto-deploy exists) follows the **submodule’s own `main`** on its GitHub remote (`daniellpsilva1/ppp_ai_agent`), not the monorepo root.
- Teammates cloning the monorepo with `--recursive` get the **pinned SHA**. Without a root pointer commit, their tree stays on the old agent revision even if `ppp_ai_agent` remote advanced.
- CI for the agent (when added) lives in the **agent repo**, not the monorepo root (root has no workflows).

---

## 7. Lint / formatter / type-check / hooks / Makefiles — negative inventory

| Tool | Present? |
|------|----------|
| Biome | No (target repos) |
| Prettier | No in PPD/swingvision apps (only marketing Remotion) |
| mypy | No config files |
| Makefile | No in target repos |
| pre-commit framework (`.pre-commit-config.yaml`) | No |
| Husky | Yes — `peak_performance_data` only |
| Ruff config file | No (defaults only) |
| Coverage fail-under | No in any CI |

---

## 8. Recommended CI for the new agent service

Fit the existing engineering pipeline; raise the bar only where agents introduce new risk (LLM cost + safety).

### 8.1 Required PR gate (cheap, no live LLM)

Add `PeakPerformanceData/ppp_ai_agent/.github/workflows/ci.yml` modeled on `ppd_backend`:

```yaml
# Recommended shape (not applied — dossier only)
name: CI
on:
  pull_request:
    branches: [main, development]
  push:
    branches: [development]
concurrency:
  group: ${{ github.workflow }}-${{ github.ref }}
  cancel-in-progress: true
jobs:
  lint-and-test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-python@v5
        with:
          python-version: "3.10"   # match Dockerfile
          cache: pip
      - run: pip install -r requirements.txt -r requirements-dev.txt
      - run: ruff check .
      - run: pytest -v --tb=short -m "not llm_live"
        env:
          TESTING: "true"
```

**Include offline eval in the default gate:** existing `tests/test_eval.py` + `eval/harness.py` (faithfulness, medical-overreach regex, schema) are already deterministic and **do not call LLMs**. Keep them unmarked / always-on.

**Also enable GitHub branch protection** (or rulesets) requiring this job — today nothing blocks merge.

### 8.2 LLM-eval gating (paid / keyed) — separate job

Live LLM evals need API keys and cost money. Do **not** put them on every PR by default.

| Approach | Recommendation |
|----------|----------------|
| Trigger | `workflow_dispatch` + optional `schedule` (nightly) + maybe `pull_request` labeled `run-llm-eval` |
| Secrets | Repo Actions secrets: `DEEPSEEK_API_KEY` and/or `GROQ_API_KEY` (prefer cheapest provider for CI); never commit |
| Cost controls | Cap dataset size; pin `max_tokens`; use cheap model; fail job if estimated spend env `LLM_EVAL_MAX_USD` exceeded; cache fixtures |
| Isolation | Pytest mark `@pytest.mark.llm_live`; default CI excludes the mark |
| Merge policy | **Non-blocking** until suite is stable; then make it required only on `main` merges or nightly with Slack/alert, not on every PR |
| Safety | Prefer offline red-team + mocked provider tests for PR; live eval for regression tracking |

### 8.3 Deploy alignment

- Ship with Traefik labels already in `docker-compose.yml` (`/ai` prefix on `api.wearablesync.app`).
- Add `scripts/auto_deploy.sh` + cron like `ppd_backend` (or join the same host’s deploy loop).
- Secrets only on host `.env` (from `.env.example`); never bake into the image.
- After deploy automation exists, still commit monorepo submodule pointer when the pin should advance.

### 8.4 Gaps to close while copying the pattern

1. Pin ruff version (agent already pins in `requirements-dev.txt`).
2. Align CI Python with Dockerfile (avoid backend’s 3.11 vs 3.10 skew).
3. Install dev requirements in CI (fix backend’s pytest packaging gap).
4. Enable branch protection so CI actually gates.
5. Treat committed secrets in sibling repos as a platform-wide incident (rotate keys referenced in §5.4).

---

## 9. Source index (primary files)

| Path | Role |
|------|------|
| `PeakPerformanceData/peak_performance_data/.github/workflows/ci.yml` | Frontend CI (+ WIP bundle budgets) |
| `PeakPerformanceData/ppd_backend/.github/workflows/ci.yml` | Python CI pattern |
| `PeakPerformanceData/ppd_extraction_backend/.github/workflows/ci.yml` | Extraction CI |
| `PeakPerformanceData/swingvision-pipeline/.github/workflows/ci.yml` | Pipeline dashboard CI |
| `PeakPerformanceData/peak_performance_data/package.json` | Scripts, husky, lint-staged |
| `PeakPerformanceData/peak_performance_data/eslint.config.mjs` | ESLint rules |
| `PeakPerformanceData/peak_performance_data/tsconfig.json` | Strict TS |
| `PeakPerformanceData/peak_performance_data/vercel.json` | Vercel runtime config |
| `PeakPerformanceData/peak_performance_data/deploy.sh` | Manual Vercel CLI deploy |
| `PeakPerformanceData/ppd_backend/scripts/deploy.sh` | Hetzner bootstrap |
| `PeakPerformanceData/ppd_backend/scripts/auto_deploy.sh` | Cron pull/rebuild |
| `PeakPerformanceData/ppd_backend/docker-compose.yml` | Traefik `/ppc` |
| `PeakPerformanceData/ppd_backend/render.yaml` | Legacy Render |
| `PeakPerformanceData/ppd_extraction_backend/scripts/deploy.sh` | WearableSync host bootstrap |
| `PeakPerformanceData/ppd_extraction_backend/scripts/auto_deploy.sh` | Cron pull/rebuild (manual cron) |
| `PeakPerformanceData/ppp_ai_agent/docker-compose.yml` | Intended `/ai` deploy |
| `PeakPerformanceData/ppp_ai_agent/.env.example` | Agent secret template |
| `PeakPerformanceData/ppp_ai_agent/eval/harness.py` | Offline eval helpers |
| `PeakPerformanceData/ppp_ai_agent/tests/test_eval.py` | Offline eval pytest gates |
| `README.md` (monorepo root) | Submodule pointer workflow |
| `.gitmodules` | Submodule remotes |

---

## 10. Verdict for the new multi-agent service

Copy **`ppd_backend`’s GitHub Actions skeleton** (ruff + pytest, PR/`development` triggers, concurrency), fix its packaging/version skew, and host deploy like **`ppd_backend`/`ppd_extraction_backend` on Hetzner** (host `.env` + Docker + Traefik on `ppd-shared`). Treat **`peak_performance_data`’s Vercel + Husky** as the frontend pattern only. Put **offline eval in the PR gate**; put **live LLM eval behind secrets, marks, and non-default triggers** with hard cost caps. Expect a **root-repo submodule pointer commit** whenever the monorepo pin for `ppp_ai_agent` should move — deploy follows the child remote, discovery follows the pin.
