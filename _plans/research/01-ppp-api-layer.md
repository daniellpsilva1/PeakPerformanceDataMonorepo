# Research Dossier 01 — `ppp_ai_agent` HTTP API Layer

**Scope:** Read-only analysis of the FastAPI HTTP surface for `PeakPerformanceData/ppp_ai_agent`.  
**Sources analyzed in full:**

| File | Role |
|------|------|
| `PeakPerformanceData/ppp_ai_agent/api/main.py` | App factory, middleware, router mounts, root route |
| `PeakPerformanceData/ppp_ai_agent/api/routes/health.py` | Health check |
| `PeakPerformanceData/ppp_ai_agent/api/routes/insights.py` | All business endpoints |
| `PeakPerformanceData/ppp_ai_agent/api/routes/__init__.py` | Empty package marker |
| `PeakPerformanceData/ppp_ai_agent/api/middleware/auth.py` | Auth middleware |
| `PeakPerformanceData/ppp_ai_agent/api/middleware/__init__.py` | Empty package marker |
| `PeakPerformanceData/ppp_ai_agent/api/__init__.py` | Empty package marker |
| `PeakPerformanceData/ppp_ai_agent/run.py` | Local-dev uvicorn entrypoint |

**Supporting context (not in the mandated file list, cited where relevant):**

- `PeakPerformanceData/ppp_ai_agent/config/settings.py` — env defaults (`PORT=8001`, secrets)
- `PeakPerformanceData/ppp_ai_agent/docker-compose.yml` — Traefik path prefix `/ai`
- `PeakPerformanceData/peak_performance_data/src/lib/ai/tools/specialistTools.ts` — current Next.js BFF caller
- `PeakPerformanceData/ppp_ai_agent/tests/test_auth.py` — auth behavior tests

**Date of analysis:** 2026-08-02  
**Service version (declared):** `0.1.0` (`api/main.py` L20–24)

---

## 1. Entrypoints & process model

### `run.py` (local development)

```1:7:PeakPerformanceData/ppp_ai_agent/run.py
"""Entrypoint for local development."""

import uvicorn
from config.settings import PORT

if __name__ == "__main__":
    uvicorn.run("api.main:app", host="0.0.0.0", port=PORT, reload=True)
```

- Binds `0.0.0.0`, port from `PORT` (default **8001**).
- Uses import string `"api.main:app"` with `reload=True`.

### `api/main.py` `__main__` block (alternate)

```56:60:PeakPerformanceData/ppp_ai_agent/api/main.py
if __name__ == "__main__":
    import uvicorn
    from config.settings import PORT

    uvicorn.run(app, host="0.0.0.0", port=PORT)
```

- Same host/port; no reload; passes the app object directly.

### Production (from `docker-compose.yml`, supporting)

- Traefik: `Host(api.wearablesync.app) && PathPrefix(/ai)` with strip-prefix `/ai`.
- Public base URL shape: `https://api.wearablesync.app/ai/...` → service sees `/...`.
- Healthcheck hits `http://localhost:8001/health`.
- Gunicorn + UvicornWorker (Dockerfile; outside mandated files).

---

## 2. App construction & middleware ordering

### Construction (`api/main.py` L17–45)

1. `logging.basicConfig(level=logging.INFO)` (L17–18)
2. `FastAPI(title=..., description=..., version="0.1.0")` (L20–24)
3. Middleware adds (L26–42)
4. Routers: `health.router`, `insights.router` (L44–45)
5. Inline root route `GET /` (L48–53)

### Middleware registration order (source order)

| Order of `add_middleware` | Class | Lines |
|---------------------------|-------|-------|
| 1st (first call) | `GZipMiddleware(minimum_size=500)` | L26 |
| 2nd | `AuthMiddleware` | L28 |
| 3rd (last call) | `CORSMiddleware` | L30–42 |

### Runtime stack (FastAPI / Starlette)

Starlette builds middleware as a **stack**: the **last** `add_middleware` call becomes the **outermost** layer (runs first on the request, last on the response).

**Request path (outer → inner):**

```
CORSMiddleware → AuthMiddleware → GZipMiddleware → route handler
```

**Response path (inner → outer):**

```
route handler → GZipMiddleware → AuthMiddleware → CORSMiddleware
```

### Is this ordering correct?

**Yes — CORS outermost is correct.**

- Browser CORS preflight (`OPTIONS`) is handled by `CORSMiddleware` before `AuthMiddleware` sees the request. If Auth were outermost, unauthenticated preflights would get bare `401` without CORS headers and browsers would fail cross-origin calls.
- Auth sits outside GZip: unauthorized responses skip body compression (minor win); more importantly, identity is established before handlers run.
- GZip closest to the app compresses successful JSON responses ≥ 500 bytes.

**No reordering recommended for CORS/Auth.** Optional refinement later: request-ID middleware outermost (even outside CORS) so every response including 401s/preflights can carry a correlation ID.

---

## 3. CORS configuration

**File:** `api/main.py` L30–42

| Setting | Value |
|---------|-------|
| `allow_origins` | `https://peakperformancedata.app`, `https://www.peakperformancedata.app`, `http://peakperformancedata.app`, `http://www.peakperformancedata.app`, `http://localhost:3000` |
| `allow_credentials` | `True` |
| `allow_methods` | `["*"]` |
| `allow_headers` | `["*"]` |

### Risks

1. **Cleartext origins for production hostnames** (`http://peakperformancedata.app`, `http://www...`) weaken HSTS assumptions and allow cookie/credentialed requests over non-TLS if a client is coaxed onto HTTP.
2. **`localhost:3000` always allowed** — fine for local BFF/browser testing; if the agent is internet-reachable, any local attacker with that origin can call it from a browser (still needs a valid secret/JWT). Prefer env-gated origins by `ENVIRONMENT`.
3. **No staging / preview origins** (e.g. Vercel preview URLs) — previews must use the BFF (server-side) or fail CORS if calling the agent from the browser.
4. **`allow_credentials=True` + `allow_headers=["*"]` + `allow_methods=["*"]`** is broad. Acceptable if the agent is **never** called directly from browsers and only via Next.js BFF (same-origin to the app). Today’s primary caller (`specialistTools.ts`) is server-side `fetch`, so CORS is largely irrelevant for that path — but the config still invites future browser-direct misuse.
5. **Missing** `https://api.wearablesync.app` itself is not an origin issue (API host ≠ browser origin); no change needed there.

---

## 4. Authentication scheme (`api/middleware/auth.py`)

### Public (auth-exempt) paths

```23:24:PeakPerformanceData/ppp_ai_agent/api/middleware/auth.py
# Paths that don't require auth
PUBLIC_PATHS = {"/health", "/", "/docs", "/openapi.json", "/redoc"}
```

Exact path match only (`request.url.path in PUBLIC_PATHS`). Trailing slashes, query strings, or prefixed deploy paths before strip would not match.

| Path | Why exempt |
|------|------------|
| `/health` | Liveness/health probes |
| `/` | Root metadata |
| `/docs`, `/openapi.json`, `/redoc` | OpenAPI UI/schema |

**Security note:** Exposing `/docs` and `/openapi.json` without auth publishes the full route inventory and schemas to the public internet (especially behind Traefik on `api.wearablesync.app/ai/docs`).

### Path A — Internal service secret

| Aspect | Detail | Lines |
|--------|--------|-------|
| Header | `x-internal-service` | L36 |
| Secret source | `INTERNAL_SERVICE_SECRET` from `config.settings` (env) | L19, settings L14 |
| Validation | Non-empty header **and** non-empty configured secret **and** `internal_header == INTERNAL_SERVICE_SECRET` | L37 |
| On success | `request.state.auth_method = "internal"`; `user_id`, `organization_id`, `user_role` all set to `None` | L38–41 |
| On empty secret config | Internal path cannot succeed (short-circuit requires truthy `INTERNAL_SERVICE_SECRET`) — **fail closed** | L37; tested in `tests/test_auth.py` L51–55 |

### Path B — Supabase JWT (session)

| Aspect | Detail | Lines |
|--------|--------|-------|
| Header | `Authorization: Bearer <access_token>` | L45–47 |
| Verify | `GET {SUPABASE_URL}/auth/v1/user` with Bearer token + `apikey: SUPABASE_SERVICE_KEY` | L75–81 |
| Profile | `GET {SUPABASE_URL}/rest/v1/profiles?id=eq.{user_id}&select=organization_id,role` using **service key** as Bearer | L91–98 |
| On success | `auth_method="session"`, `user_id`, `organization_id`, `user_role` (default `"player"`) | L50–54, L107–111 |
| On failure / misconfig | Returns `None`; middleware falls through to 401 | L68–70, L82–83, L99–104, L112–114 |

### Failure response

```56:60:PeakPerformanceData/ppp_ai_agent/api/middleware/auth.py
        # No valid auth
        return JSONResponse(
            status_code=401,
            content={"error": "Authentication required"},
        )
```

- No `WWW-Authenticate` header.
- No distinction between “missing header”, “bad secret”, and “invalid JWT”.
- Handler never runs; `call_next` not invoked.

### Security weaknesses

| Weakness | Severity | Detail |
|----------|----------|--------|
| **Non-constant-time secret compare** | Medium | `internal_header == INTERNAL_SERVICE_SECRET` (L37) is vulnerable to timing side-channels in theory. Use `hmac.compare_digest`. |
| **No org / athlete scoping in middleware** | High | Session auth attaches `organization_id` / `user_id` / `role`, but **no route enforces** that query/body `organization_id` / `athlete_id` match `request.state`. A valid JWT for Org A can request Org B’s labs/insights if IDs are known. |
| **Internal auth is a god-mode key** | High | With `x-internal-service`, `user_id`/`organization_id` are `None` (L39–41). All identity for data access comes from **client-supplied** query/body fields. Secret leak = full cross-tenant read/write via this API. |
| **Trusting client-supplied identity in body/query** | High | `EventHookPayload.athlete_id` / `organization_id` (insights.py L49–50), `list_insights` filters (L115–118), `/labs`, `/biomarker-trend`, genetics, tennis, CGM — all accept IDs from the caller without binding to session org. |
| **Coach review / feedback vs internal auth** | Medium | `coach_review` and `submit_feedback` require `request.state.user_id` (insights.py L174–176, L219–223). Internal BFF auth sets `user_id=None` → **401** even with a valid secret. BFF cannot use internal auth for these without also forwarding a user JWT (or changing middleware). |
| **Public OpenAPI** | Medium | `/docs`, `/openapi.json`, `/redoc` unauthenticated (auth.py L24). |
| **Service-key profile fetch** | Low–Med | Profile read uses service role (auth.py L95–97), bypassing RLS — expected for server auth, but means agent must implement its own authorization (currently does not). |
| **Network round-trip per JWT request** | Operational | Every session request hits Auth + Profiles (no JWKS local verify, no cache). Latency + dependency on Supabase availability. |
| **No role checks** | High | `user_role` is attached but never consulted by routes. Players could approve insights if they have a JWT and know an `insight_id`. |
| **Unused import** | N/A | `HTTPException` imported in auth.py L15 but unused. |

---

## 5. Endpoint catalog

Unless noted, routers mount at **root** (no prefix). All non-public routes require Auth middleware (401 if neither internal secret nor valid JWT).

Response models are largely **ad hoc `JSONResponse` dicts**, not Pydantic response models. FastAPI will still document request bodies where `BaseModel` is used.

### 5.1 Root & health

#### `GET /`

| Field | Value |
|-------|-------|
| File / lines | `api/main.py` L48–53 |
| Auth | Public (`PUBLIC_PATHS`) |
| Request model | None |
| Response | `200` `{"message": "PPD AI Agent service", "docs": "/docs"}` |
| Status codes | `200` (implicit) |

#### `GET /health`

| Field | Value |
|-------|-------|
| File / lines | `api/routes/health.py` L8–10 |
| Auth | Public |
| Request model | None |
| Response | `200` `{"status": "healthy", "service": "ppp_ai_agent"}` |
| Status codes | `200` only |
| Notes | Process liveness only — does **not** check Supabase, ClickHouse, Redis, or LLM keys. No readiness probe. |

---

### 5.2 Batch

#### `POST /batch/nightly`

| Field | Value |
|-------|-------|
| File / lines | `api/routes/insights.py` L33–41 |
| Auth | Required (middleware). Docstring says “internal service auth” but **any** valid JWT also works. |
| Request model | None (body unused) |
| Query params | `organization_id` optional (`str`) — L39 |
| Response | `200` — opaque `result` from `run_nightly_batch` via `JSONResponse(content=result)` |
| Status codes | Implicit `200`; exceptions bubble as unhandled 500 (no local try/except) |
| Auth / ID trust | Optional org filter is **client-supplied**; internal auth has no org binding. |

---

### 5.3 Events

#### Request model: `EventHookPayload` (L46–51)

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| `event_type` | `str` | yes | Documented: `lab_ingest`, `high_load`, `alert_engine`, `poor_recovery` |
| `athlete_id` | `str` | yes | Client-supplied athlete user ID |
| `organization_id` | `str` | yes | Client-supplied org ID |
| `data` | `Dict[str, Any]` | no (default `{}`) | e.g. `panel_id`, `coach_id`, `activity_context` for lab ingest |

#### `POST /events/hook`

| Field | Value |
|-------|-------|
| File / lines | `api/routes/insights.py` L54–107 |
| Auth | Required |
| Request model | `EventHookPayload` |
| Response `200` | `{"acknowledged": true, "event_type", "athlete_id", "insight_id", "timestamp"}` |
| Status codes | Always `200` on happy path even if insight generation/storage fails (`insight_id` may be `null`); storage errors logged only (L98–99) |
| Implemented behavior | Only `lab_ingest` with `data.panel_id` triggers `generate_panel_landed_insight` + Supabase insert. Other `event_type` values acknowledge with `insight_id: null`. |
| ID trust | Full trust of body `athlete_id` / `organization_id`. |

---

### 5.4 Insights CRUD / review / feedback

#### `GET /insights`

| Field | Value |
|-------|-------|
| File / lines | L112–142 |
| Auth | Required |
| Query params | `athlete_id?`, `organization_id?`, `coach_id?`, `review_status?`, `limit=20` (capped at 100) |
| Request model | None |
| Response `200` | `{"insights": [...], "count": N, "success": true}` |
| Response `500` | `{"error": "<str>", "success": false}` |
| Pagination | Soft `limit` only — **no cursor/offset**, no `next_page` |
| Scoping | Filters optional and client-chosen; unscoped list possible if caller omits filters (depends on Supabase/RLS — agent uses **service key**, so RLS is bypassed) |

#### `GET /insights/{insight_id}`

| Field | Value |
|-------|-------|
| File / lines | L145–159 |
| Auth | Required |
| Path | `insight_id: str` |
| Response `200` | `{"insight": {...}, "success": true}` |
| Response `404` | `{"error": "Insight not found", "success": false}` |
| Response `500` | `{"error": "<str>", "success": false}` |
| Scoping | No org membership check — IDOR if IDs are enumerable/leaked. |

#### Request model: `CoachReviewPayload` (L164–168)

| Field | Type | Required |
|-------|------|----------|
| `action` | `str` | yes (`approve` / `edit` / `reject`) |
| `edited_claim` | `Optional[str]` | no |
| `edited_actions` | `Optional[List[Dict]]` | no |
| `comment` | `Optional[str]` | no |

#### `POST /insights/{insight_id}/review`

| Field | Value |
|-------|-------|
| File / lines | L171–203 |
| Auth | Middleware **plus** handler check: `request.state.user_id` must be set → **session JWT required**; internal secret alone → **401** (L174–176) |
| Request model | `CoachReviewPayload` |
| Response `200` | `{"success": true, "review_status": "approved"|"rejected"|"edited"}` |
| Response `401` | `{"error": "Authentication required", "success": false}` |
| Response `500` | `{"error": "<str>", "success": false}` |
| Notes | Maps action→status (L180). Persists via `supabase_rpc("insights", method="POST", ...)` and `coach_reviews` insert. No validation that `action` is one of the three values (unknown → `"edited"`). No role check that user is a coach. |

#### Request model: `FeedbackPayload` (L208–213)

| Field | Type | Required |
|-------|------|----------|
| `feedback_type` | `str` | yes (`thumbs_up` / `thumbs_down` / `edit` / `flag`) |
| `insight_id` | `Optional[str]` | no |
| `conversation_id` | `Optional[str]` | no |
| `reason_codes` | `List[str]` | no (default `[]`) |
| `comment` | `Optional[str]` | no |

#### `POST /feedback`

| Field | Value |
|-------|-------|
| File / lines | L216–242 |
| Auth | Middleware + `request.state.user_id` required (session JWT); internal-only → 401 |
| Request model | `FeedbackPayload` |
| Response `200` | `{"success": true, "feedback_id": <id or null>}` |
| Response `401` | `{"error": "Authentication required", "success": false}` |
| Response `500` | `{"error": "<str>", "success": false}` |
| Notes | Uses `request.state.organization_id` for storage (may be `null` if profile missing org). No enum enforcement on `feedback_type`. |

---

### 5.5 Labs / biomarkers

#### `GET /labs`

| Field | Value |
|-------|-------|
| File / lines | L247–262 |
| Auth | Required (middleware only — no session-user check) |
| Query | `organization_id` **required**, `athlete_id?`, `days_back=90`, `limit=20` |
| Response | Pass-through dict from `get_lab_panels` (typically `panels`/`count`/`success`) |
| Status codes | Implicit 200; tool errors may return `success: false` in body without HTTP 5xx |

#### `GET /biomarker-trend`

| Field | Value |
|-------|-------|
| File / lines | L265–280 |
| Auth | Required |
| Query | `organization_id`, `athlete_id`, `biomarker_key` required; `days_back=365` |
| Response | Pass-through from `get_biomarker_trend` |

---

### 5.6 Genetics

#### `GET /genetic-traits`

| Field | Value |
|-------|-------|
| File / lines | L285–296 |
| Auth | Required |
| Query | `organization_id`, `athlete_id` required |
| Response | Pass-through from `get_genetic_traits` |

#### Request model: `GeneticParsePayload` (L299–302)

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| `report_id` | `str` | yes | |
| `file_content` | `List[int]` | yes | Byte array as JSON integers — large payload risk |
| `file_type` | `str` | no | default `"dtc_raw"` |

#### `POST /genetics/parse`

| Field | Value |
|-------|-------|
| File / lines | L305–314 |
| Auth | Required |
| Request model | `GeneticParsePayload` |
| Response | Pass-through from `parse_genetic_report` |
| Risks | Accepts full file as JSON int array (memory/DoS); no size limit; no org/athlete binding in payload |

---

### 5.7 CGM

#### `GET /cgm-scores`

| Field | Value |
|-------|-------|
| File / lines | L319–330 |
| Auth | Required |
| Query | `athlete_id` required, `days_back=7` |
| Response | Pass-through from `get_cgm_scores` |
| Notes | No `organization_id` parameter — cross-org if athlete IDs known |

---

### 5.8 Tennis

#### `GET /tennis-matches`

| Field | Value |
|-------|-------|
| File / lines | L335–348 |
| Auth | Required |
| Query | `organization_id`, `athlete_id` required; `limit=10` |
| Response | Pass-through from `get_tennis_matches` |

#### `GET /tennis-evolution`

| Field | Value |
|-------|-------|
| File / lines | L351–364 |
| Auth | Required |
| Query | `organization_id`, `athlete_id` required; `matches_back=10` (mapped to tool `limit`) |
| Response | Pass-through from `get_tennis_evolution` |

#### Not exposed over HTTP

- `get_match_summary` is **imported** in `insights.py` L24 but **never registered** as a route. Dead import for the HTTP layer.

---

## 6. Endpoint summary table

| Method | Path | Auth | Request model | Notable status codes |
|--------|------|------|---------------|----------------------|
| `GET` | `/` | Public | — | 200 |
| `GET` | `/health` | Public | — | 200 |
| `GET` | `/docs` | Public | — | OpenAPI UI |
| `GET` | `/openapi.json` | Public | — | Schema |
| `GET` | `/redoc` | Public | — | Docs |
| `POST` | `/batch/nightly` | Secret or JWT | — (+ query `organization_id?`) | 200 / unhandled 500 |
| `POST` | `/events/hook` | Secret or JWT | `EventHookPayload` | 200 (always ack) |
| `GET` | `/insights` | Secret or JWT | query filters | 200, 500 |
| `GET` | `/insights/{insight_id}` | Secret or JWT | — | 200, 404, 500 |
| `POST` | `/insights/{insight_id}/review` | **JWT with user_id** | `CoachReviewPayload` | 200, 401, 500 |
| `POST` | `/feedback` | **JWT with user_id** | `FeedbackPayload` | 200, 401, 500 |
| `GET` | `/labs` | Secret or JWT | query | 200 |
| `GET` | `/biomarker-trend` | Secret or JWT | query | 200 |
| `GET` | `/genetic-traits` | Secret or JWT | query | 200 |
| `POST` | `/genetics/parse` | Secret or JWT | `GeneticParsePayload` | 200 |
| `GET` | `/cgm-scores` | Secret or JWT | query | 200 |
| `GET` | `/tennis-matches` | Secret or JWT | query | 200 |
| `GET` | `/tennis-evolution` | Secret or JWT | query | 200 |

**Empty packages:** `api/__init__.py`, `api/routes/__init__.py`, `api/middleware/__init__.py` — no exports, no side effects.

---

## 7. What is MISSING for a production agent service

Checked against the mandated API files (and confirmed no matches under `ppp_ai_agent` for streaming/telemetry keywords).

| Capability | Present? | Notes |
|------------|----------|-------|
| **Streaming chat (SSE / WebSocket)** | No | No chat/completions route at all. Chat lives in Next.js `/api/ai-agent` today. |
| **Chat / agent orchestrator HTTP endpoint** | No | This service is insight batch + specialist data tools + event hooks, not a conversational agent API. |
| **Rate limiting** | No | No middleware, no per-user/org quotas. Next.js BFF has its own `rateLimit.ts` for `/api/ai-agent`, not for calls into this service. |
| **Request / correlation IDs** | No | No `X-Request-Id` generation or propagation; logs lack structured request IDs. |
| **Global exception handlers** | No | No `@app.exception_handler`; many routes let exceptions become default FastAPI 500; some return ad hoc JSON. |
| **OpenTelemetry / metrics** | No | No OTel, Prometheus, or structured tracing hooks in API layer. |
| **Readiness vs liveness** | No | Only `/health` (always healthy if process up). No `/ready` checking Supabase/CH/Redis. Docker healthcheck uses the same shallow probe. |
| **Cursor pagination** | Partial | `limit` capped at 100 on insights list; no `offset`/`cursor`/`next`. Labs/tennis have limits only. |
| **Idempotency** | No | No `Idempotency-Key` for `POST /events/hook`, batch, review, feedback, genetics parse — retries can duplicate insights/reviews. |
| **AuthZ / tenancy enforcement** | No | AuthN only; org/role unused for authorization. |
| **Request body size limits** | No | Especially risky for `/genetics/parse` byte arrays. |
| **API versioning** | No | No `/v1` prefix (Traefik `/ai` strip is deploy routing, not versioning). |
| **mTLS / IP allowlist for internal secret** | No | Shared secret over HTTPS only. |
| **Audit log of API access** | No | Application logging only (`logger.info` on event hook). |
| **Webhook signature verification** | No | Event hooks authenticated only by shared secret/JWT, not HMAC payload signatures. |
| **DELETE/PATCH insight lifecycle** | No | Review via POST; no delete/archive endpoint. |
| **Match summary HTTP route** | No | Tool exists; not wired. |
| **Event types beyond lab_ingest** | Stub | Documented in docstring; not implemented. |

---

## 8. How a Next.js BFF would call this today

### Actual caller

`PeakPerformanceData/peak_performance_data/src/lib/ai/tools/specialistTools.ts`:

```5:21:PeakPerformanceData/peak_performance_data/src/lib/ai/tools/specialistTools.ts
const AGENT_URL = process.env.PPP_AI_AGENT_URL || 'http://localhost:8001'
const INTERNAL_SECRET = process.env.INTERNAL_SERVICE_SECRET || ''

async function agentFetch(path: string, params: Record<string, string>) {
  const url = new URL(`${AGENT_URL}${path}`)
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v))

  const res = await fetch(url, {
    headers: { 'x-internal-service': INTERNAL_SECRET },
  })
  // ...
}
```

### Call pattern

1. User chats with Next.js **`/api/ai-agent`** (streaming LLM + tools) — **not** this Python service.
2. Tool router registers specialist tools (`toolRouter.ts`) that wrap `specialistTools.ts`.
3. Each tool does **server-side** `GET` to `PPP_AI_AGENT_URL` + path with query params.
4. Auth header: **`x-internal-service: $INTERNAL_SERVICE_SECRET`** (shared with this service).
5. Org scoping is applied by the BFF closing over `organizationId` from the authenticated Next session when building the tool — **not** re-validated by `ppp_ai_agent`.

### Paths used by BFF today

| Tool | Agent path |
|------|------------|
| `getLabPanelsTool` | `GET /labs` |
| `getBiomarkerTrendTool` | `GET /biomarker-trend` |
| `getGeneticTraitsTool` | `GET /genetic-traits` |
| `getCgmScoresTool` | `GET /cgm-scores` |
| `getTennisMatchesTool` | `GET /tennis-matches` |
| `getTennisEvolutionTool` | `GET /tennis-evolution` |

**Not used by `specialistTools.ts` today:** `/batch/nightly`, `/events/hook`, `/insights*`, `/feedback`, `/genetics/parse`.

### Plausible production URL

- Local: `PPP_AI_AGENT_URL=http://localhost:8001`
- Deployed (Traefik): `PPP_AI_AGENT_URL=https://api.wearablesync.app/ai` (strip `/ai` → service paths as documented)

### Example request the BFF issues

```http
GET /labs?athlete_id=<uuid>&days_back=90&limit=20&organization_id=<org>
Host: localhost:8001
x-internal-service: <INTERNAL_SERVICE_SECRET>
```

### Gaps for BFF ↔ agent for multi-agent upgrade

- No streaming channel from Python agent to BFF.
- Review/feedback endpoints cannot use the same internal-secret pattern without forwarding `Authorization: Bearer <user JWT>` (or middleware changes to accept `X-User-Id` — which would worsen trust issues).
- BFF must keep owning chat orchestration until a chat/SSE surface exists here.

---

## 9. Decision-relevant conclusions

1. **Surface area is a specialist + insights API, not an agent runtime API.** Conversational intelligence remains in Next.js; Python exposes data tools, batch, and (partial) event hooks.
2. **AuthN exists; AuthZ does not.** Session org/role are attached then ignored; internal auth is cross-tenant by design.
3. **Middleware order (CORS → Auth → GZip) is correct** for browser clients; primary traffic is BFF-to-service anyway.
4. **Production gaps** that block a “sophisticated multi-agent” upgrade: streaming/chat endpoint, tenancy enforcement, rate limits, correlation IDs, readiness, idempotency, global errors, telemetry, and closing public OpenAPI.
5. **BFF integration path is already established** via `specialistTools.ts` + `x-internal-service` + `PPP_AI_AGENT_URL`; extend that pattern carefully, and do not treat body/query IDs as authenticated identity.

---

## 10. File index (line anchors)

| Topic | Path | Lines |
|-------|------|-------|
| App + middleware + CORS + root | `.../api/main.py` | 1–60 |
| Health | `.../api/routes/health.py` | 1–10 |
| All business routes + models | `.../api/routes/insights.py` | 1–364 |
| Auth middleware | `.../api/middleware/auth.py` | 1–114 |
| Local entry | `.../run.py` | 1–7 |
| Empty inits | `api/__init__.py`, `routes/__init__.py`, `middleware/__init__.py` | (empty) |
