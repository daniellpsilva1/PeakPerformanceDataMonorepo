# Research Dossier 31 — Secondary AI-Adjacent API Routes

**Scope:** Read-only inventory of every AI-adjacent Next.js API route under `PeakPerformanceData/peak_performance_data/src/app/api/` **other than** the main chat brain at `api/ai-agent/route.ts` (covered by dossier 13). Includes LLM call sites outside `api/`, and a consolidation recommendation for the Python agent move.

**Date of analysis:** 2026-08-02  
**App root:** `PeakPerformanceData/peak_performance_data`

---

## Sources analyzed

| File | Role | Depth |
|------|------|-------|
| `src/app/api/ai-agent/wearable-query/route.ts` | Constrained wearable metric API | full |
| `src/app/api/ai-agent/usage/route.ts` | Usage stats for UI | full |
| `src/app/api/ai-agent/proxy/route.ts` | Intended thin BFF → Python `/chat` | full |
| `src/app/api/ai-agent/feedback/route.ts` | BFF → Python `/feedback` | full |
| `src/app/api/ai-agent/insights/route.ts` | BFF → Python `/insights` | full |
| `src/app/api/ai-agent/insights/[insightId]/review/route.ts` | BFF → Python review | full |
| `src/app/api/ai-agent/events/route.ts` | BFF → Python `/events/hook` | full |
| `src/app/api/ai-agent/labs/route.ts` | BFF → Python `/labs` (broken trend branch) | full |
| `src/app/api/ai-agent/labs/trend/route.ts` | BFF → Python `/biomarker-trend` | full |
| `src/app/api/ai-agent/genetics/upload/route.ts` | Supabase row + Python parse | full |
| `src/app/api/transcribe/route.ts` | Groq Whisper STT | full |
| `src/lib/ai/tools/wearableInsightTools.ts` | Sole caller of wearable-query | full |
| `src/lib/ai/tools/garminActivityTools.ts` | Parallel path (direct to ppd_backend) | partial |
| `src/lib/ai/tools/specialistTools.ts` | Direct Python labs/genetics/cgm (bypasses BFF) | partial |
| `src/lib/ai/utils/conversationMemory.ts` | Groq `generateText` summarizer (lib, not route) | relevant |
| `src/lib/ai/utils/semanticMemory.ts` | OpenAI embeddings (lib, not route) | relevant |
| `src/lib/ai/utils/auditLog.ts` | `getAIUsageStats` response shape | relevant |
| `src/components/insights/{CoachInbox,InsightStrip}.tsx` | BFF consumers | partial |
| `src/hooks/ai/useSpeechRecognition.ts` | Transcribe caller | partial |
| `src/middleware.ts` | Confirms `/api` excluded from middleware | matcher |
| `PeakPerformanceData/ppp_ai_agent/api/routes/insights.py` | Upstream contract for BFF proxies | full |
| `PeakPerformanceData/ppp_ai_agent/api/middleware/auth.py` | Internal vs JWT auth | full |
| `PeakPerformanceData/ppd_backend/api/routes/wearables.py` | ClickHouse activities source | full |
| `PeakPerformanceData/ppd_backend/api/main.py` | No inbound auth on wearables | relevant |

**Grep coverage:**
- Entire `src/app/api/` for `deepseek|groq|openai|streamText|generateText|generateObject|embedding|anthropic`
- Entire `src/` for the same + `"use server"` (no server-action LLM usage found)

---

## Executive inventory

| # | Path | Method | Runtime | maxDuration | Calls LLM? | Role |
|---|------|--------|---------|-------------|------------|------|
| — | `/api/ai-agent` | POST | edge | 30 | **Yes** (DeepSeek→Groq) | Main chat — **out of scope** (dossier 13) |
| 1 | `/api/ai-agent/wearable-query` | POST | nodejs | *(unset)* | **No** | Constrained metric aggregator over ClickHouse via ppd_backend |
| 2 | `/api/ai-agent/usage` | GET | edge | *(unset)* | **No** | Reads `ai_audit_logs` stats |
| 3 | `/api/ai-agent/proxy` | POST | nodejs | **60** | Indirect (Python `/chat` — **endpoint does not exist yet**) | Future thin chat BFF |
| 4 | `/api/ai-agent/feedback` | POST | nodejs | *(unset)* | No (Python may later) | Insight/chat feedback BFF |
| 5 | `/api/ai-agent/insights` | GET | nodejs | *(unset)* | No | List insights BFF |
| 6 | `/api/ai-agent/insights/[insightId]/review` | POST | nodejs | *(unset)* | No | Coach review BFF |
| 7 | `/api/ai-agent/events` | POST | nodejs | *(unset)* | Indirect (Python specialist) | Event-hook BFF |
| 8 | `/api/ai-agent/labs` | GET | nodejs | *(unset)* | No | Lab panels BFF (+ broken `?trend=` branch) |
| 9 | `/api/ai-agent/labs/trend` | GET | nodejs | *(unset)* | No | Biomarker trend BFF |
| 10 | `/api/ai-agent/genetics/upload` | POST | nodejs | *(unset)* | Indirect (Python parse) | Genetic file upload + parse trigger |
| 11 | `/api/transcribe` | POST | edge | *(unset)* | **Yes** (Groq Whisper) | Speech-to-text for AI voice UX |

**Only secondary routes that invoke an LLM/model provider in-process:** `/api/transcribe` (Whisper).  
**Lib helpers invoked by the main chat route (not separate HTTP endpoints):** Groq `generateText` in `conversationMemory.ts`, OpenAI embeddings in `semanticMemory.ts`.

---

## 1. `POST /api/ai-agent/wearable-query`

**File:** `PeakPerformanceData/peak_performance_data/src/app/api/ai-agent/wearable-query/route.ts` (145 lines)

```6:6:PeakPerformanceData/peak_performance_data/src/app/api/ai-agent/wearable-query/route.ts
export const runtime = 'nodejs'
```

- **Method:** `POST` only  
- **Runtime:** `nodejs` (required because Edge cannot / should not own this ClickHouse proxy path; also uses admin Supabase client)  
- **maxDuration:** not set (platform default)

### Approach classification (critical)

**This is NOT text-to-SQL. NOT a tool-calling loop. NOT NL→query.**

It is a **constrained metric query builder / aggregator**:

1. Client (or tool) sends a fixed JSON body with enum-like `metric` + `period`.
2. Route authz-checks the caller against Supabase `profiles`.
3. Route fetches **raw activities** from `ppd_backend` `GET /wearables/activities/{athleteId}` (parameterized ClickHouse SQL owned by Python — not model-generated).
4. Route maps activities → `{ date, value }` for the requested metric and computes `average`, `currentValue`, `trend`.

Caller that *is* model-driven is the **tool** `getAthleteWearableInsightTool` in `wearableInsightTools.ts`, which chooses `metric` / `period` from a Zod enum, then HTTP-calls this route. The LLM never sees SQL.

### Request shape

```16:23:PeakPerformanceData/peak_performance_data/src/app/api/ai-agent/wearable-query/route.ts
  const body = await req.json() as {
    athleteId: string
    metric: string
    organizationId: string
    period?: string
  }

  const { athleteId, metric, organizationId, period = '7d' } = body
```

| Field | Type | Notes |
|-------|------|-------|
| `athleteId` | string (UUID) | Target athlete |
| `metric` | string | Intended: `average_hr` \| `calories` \| `distance_km` \| `duration_min` \| `max_hr` (enforced only in the tool Zod schema, **not** in the route) |
| `organizationId` | string | Must match requester's org |
| `period` | optional string | `'7d'` (default) \| `'14d'` \| `'30d'`; anything else → 7 days |

### Response shape (success)

```129:138:PeakPerformanceData/peak_performance_data/src/app/api/ai-agent/wearable-query/route.ts
    return NextResponse.json({
      athleteId,
      average,
      currentValue,
      dataPoints,
      metric,
      period,
      success: true,
      trend,
    })
```

Empty-data variant (L72–80): `{ athleteId, dataPoints: [], message, metric, period, success: true }`.  
Errors: `401 Unauthorized`, `403 Forbidden`, `502` with `error` string.

### Auth & authorization

```8:41:PeakPerformanceData/peak_performance_data/src/app/api/ai-agent/wearable-query/route.ts
export async function POST(req: Request) {
  const supabase = await createRouteClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  // ...
  if (!requester || !requester.organization_id || requester.organization_id !== organizationId) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const isCoachOrAdmin = ['admin', 'club_admin', 'coach'].includes(requester.role ?? '')
  if (!isCoachOrAdmin && user.id !== athleteId) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
```

- Cookie session via `createRouteClient` + **`getUser()`** (network round-trip to Supabase Auth).
- Org match required.
- Players may only query **themselves**; coach / club_admin / admin may query any athlete in-org.
- **Does not** accept or validate `x-internal-service`. Middleware excludes `/api/*` entirely (`middleware.ts` L237–244), so this route is the sole gate.

### Model / provider / prompt

**None.** No LLM.

### Metric extraction & trend (what it does that main chat does not)

Main chat does not own ClickHouse access on Edge. This Node route + tool exist so the Edge agent can get wearable aggregates without shipping CH credentials to Edge.

```43:127:PeakPerformanceData/peak_performance_data/src/app/api/ai-agent/wearable-query/route.ts
  const days = period === '30d' ? 30 : period === '14d' ? 14 : 7

  // Fetch activities from ppd_backend (ClickHouse ow_workouts)
  const ppcBaseUrl = process.env.PPD_BACKEND_URL || 'http://localhost:8000'
  try {
    const res = await fetch(
      `${ppcBaseUrl}/wearables/activities/${athleteId}?days_back=${days}&limit=${days * 3}`,
      {
        headers: {
          'x-internal-service': process.env.INTERNAL_SERVICE_SECRET || '',
        },
      }
    )
    // ...
    const extractValue = (a: ActivityRow, m: string): number | null => {
      switch (m) {
        case 'average_hr': return a.average_hr
        case 'calories': return a.calories
        case 'distance_km': return a.distance ? Math.round(Number(a.distance) / 100) / 10 : null
        case 'duration_min': {
          const dur = a.moving_duration ?? a.duration
          return dur ? Math.round(Number(dur) / 60 * 10) / 10 : null
        }
        case 'max_hr': return a.max_hr
        default: return null
      }
    }
    // trend: compare first half vs second half of values; ±5% → up/down
```

Upstream ClickHouse SQL is **fixed and parameterized** in `ppd_backend`:

```42:89:PeakPerformanceData/ppd_backend/api/routes/wearables.py
        query = """
            SELECT
                user_id,
                id                          AS activity_id,
                ...
            FROM (
                SELECT
                    ...
                FROM openwearables_data.ow_workouts
                WHERE user_id = %(uid)s
                  AND start_time >= %(s)s
                  AND start_time <= %(e)s
                GROUP BY app_id, org_id, user_id, provider, id
            )
            ORDER BY start_time_max DESC
            LIMIT %(lim)s
        """

        result = ch.query(query, parameters={
            "uid": user_id,
            "s": start_dt.strftime("%Y-%m-%d %H:%M:%S"),
            "e": end_dt.strftime("%Y-%m-%d %H:%M:%S"),
            "lim": limit,
        })
```

### Sandboxing / validation / security assessment

| Control | Status | Detail |
|---------|--------|--------|
| Model-generated SQL | **N/A — does not exist** | No NL→SQL; no query execution of model text |
| Metric allowlist in route | **Weak** | Unknown `metric` → all values `null` → empty `dataPoints` (fail-closed for data, not 400) |
| Metric allowlist in tool | **Strong** | Zod `z.enum(SUPPORTED_METRICS)` in `wearableInsightTools.ts` L5, L104–107 |
| Period allowlist | **Partial** | Only three strings widen the window; others collapse to 7d |
| Athlete ID | Client-supplied UUID after org/role check | No ownership check that athlete is in-org beyond coach role (coach can query any UUID; CH returns empty if unknown) |
| `x-internal-service` to ppd_backend | **Sent but ignored** | `ppd_backend` has **no inbound auth** (dossier 22). Header is cosmetic today |
| Network exposure of CH path | **Significant** | Anyone who can reach `PPD_BACKEND_URL` can `GET /wearables/activities/{any_user_id}` without secrets |
| Tool → route auth mismatch | **Bug** | Tool calls this route with only `x-internal-service` and **no cookies** (`wearableInsightTools.ts` L48–59). Route requires cookie `getUser()` → tool path returns **401** unless somehow run in a cookie-bearing context |

Quoted tool call (broken for session auth):

```46:59:PeakPerformanceData/peak_performance_data/src/lib/ai/tools/wearableInsightTools.ts
    try {
      const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
      const res = await fetch(`${baseUrl}/api/ai-agent/wearable-query`, {
        body: JSON.stringify({
          athleteId: athlete.id,
          metric,
          organizationId,
          period,
        }),
        headers: {
          'Content-Type': 'application/json',
          'x-internal-service': process.env.INTERNAL_SERVICE_SECRET || '',
        },
        method: 'POST',
      })
```

**Contrast:** `getTeamActivityLeaderboardTool` and `getGarminActivitiesTool` call `ppd_backend` **directly**, skipping this route — duplicating aggregation logic and bypassing the route’s org/role gate (they still resolve athletes via org-scoped Supabase queries).

### Duplication

- Overlaps `garminActivityTools.ts` (raw activities) and `getTeamActivityLeaderboardTool` (same metric switch + CH fetch).
- Python agent already has / will have wearable tools (`ppp_ai_agent/tools/wearables.py` per dossier 21) — this Next helper becomes redundant once tools move.

### Consolidation

**Absorb capability into Python agent** (metric enum + aggregation as a tool). **Delete** the Next.js route after tools stop calling it. Do not keep a BFF that only re-aggregates what ppd_backend/Python already can return.

---

## 2. `GET /api/ai-agent/usage`

**File:** `src/app/api/ai-agent/usage/route.ts` (58 lines)

```7:8:PeakPerformanceData/peak_performance_data/src/app/api/ai-agent/usage/route.ts
// PERFORMANCE: Use Edge runtime for faster cold starts
export const runtime = 'edge'
```

- **Method:** `GET`  
- **Runtime:** `edge`  
- **maxDuration:** unset  
- **LLM:** none  

### Request / response

- Query: `?userId=<uuid>` (required).
- Response: `{ errorCount, successCount, toolUsage, totalRequests, totalTokens }` from `getAIUsageStats` (`auditLog.ts` L154–205), last 30 days of `ai_audit_logs`.
- Cache-Control: `private, max-age=60, stale-while-revalidate=120`.

### Auth

- `getRouteUserFast()` — session required.
- Caller may only read **own** `userId`, unless `profile.role === 'admin'`.

### Callers

- `UsageDashboard.tsx` via SWR (`credentials: 'include'`).

### vs main chat

Main chat **writes** audit logs; this route **reads** them for UI. Not a brain capability.

### Consolidation

**Stay in Next.js** (or move stats to a simple Supabase query from the client with RLS). Not part of the Python agent brain. Keep until/unless audit logging moves.

---

## 3. `POST /api/ai-agent/proxy`

**File:** `src/app/api/ai-agent/proxy/route.ts` (86 lines)

```5:6:PeakPerformanceData/peak_performance_data/src/app/api/ai-agent/proxy/route.ts
export const runtime = 'nodejs'
export const maxDuration = 60
```

### Purpose (stated)

Thin BFF: cookie auth → inject `userId` / `organizationId` / `userRole` → forward to `PPP_AI_AGENT_URL/chat`, stream SSE if returned.

### Request / response

- Body: opaque JSON spread into Python payload plus identity fields (L44–50).
- Response: SSE passthrough (`text/event-stream`) or JSON.

### Auth

- `getSession()` + profile must have `organization_id`.
- Forwards `x-internal-service: INTERNAL_SERVICE_SECRET`.

### Model / prompt

None in Next. Intended LLM orchestration is in Python — **but `ppp_ai_agent` has no `/chat` route today** (only insights/labs/genetics/events/batch in `insights.py`). This BFF is **scaffolding ahead of the consolidation**.

### Callers / bugs

- `InsightStrip.tsx` incorrectly uses `GET/POST /api/ai-agent/proxy` as a generic insights/feedback router (L25, L42–48). Proxy only implements **POST → `/chat`**. Strip is miswired vs `CoachInbox` (which uses dedicated routes).

### vs main chat

Duplicates the **auth + identity injection** portion of `route.ts`, but does not implement tools/prompts. Intended **replacement** for main chat once Python owns the loop.

### Consolidation

**Stay / evolve into the sole chat BFF** once Python `/chat` exists; then delete or shrink `route.ts`. Do not absorb “into Python” as a Next route — it *is* the Next shim.

---

## 4. `POST /api/ai-agent/feedback`

**File:** `src/app/api/ai-agent/feedback/route.ts` (56 lines)  
**Runtime:** `nodejs` · **maxDuration:** unset · **LLM:** none in Next

### Auth

Session + profile with `organization_id`. Body forwarded **as-is** to Python `POST /feedback` with internal secret only.

### Request / response (from UI + Python)

UI (`CoachInbox.tsx` L66–72):

```json
{ "insight_id": "<uuid>", "feedback_type": "thumbs_up" | "thumbs_down" }
```

Python `FeedbackPayload` also accepts `conversation_id`, `reason_codes`, `comment`.  
Python response: `{ success, feedback_id }` or error.

### Critical identity gap

Python `submit_feedback` requires `request.state.user_id` (L219–223 of `insights.py`). Internal-service auth sets `user_id = None` (`auth.py` L37–41). BFF **does not** inject `user_id` / `organization_id` into the body. → Feedback via BFF likely **401s inside Python** even when Next auth succeeds.

### Consolidation

**Stay as thin BFF** (or fix by forwarding identity). Capability already lives in Python; Next must not reimplement storage.

---

## 5. `GET /api/ai-agent/insights`

**File:** `src/app/api/ai-agent/insights/route.ts` (54 lines)  
**Runtime:** `nodejs` · **LLM:** none

### Auth / behavior

- Session + org required.
- Forwards query string; **overwrites** `organization_id` with session profile’s org (L34–35) — good tenancy guard.
- Proxies to `GET {PPP_AI_AGENT_URL}/insights?...`.

### Request / response

Query filters used by CoachInbox: `coach_id`, `organization_id`, `limit`, `review_status` (`null` \| `approved` \| `rejected`).  
Python returns `{ insights, count, success }`.

### Consolidation

**Stay as BFF.** List/read is not “brain”; keep session boundary in Next.

---

## 6. `POST /api/ai-agent/insights/[insightId]/review`

**File:** `src/app/api/ai-agent/insights/[insightId]/review/route.ts` (48 lines)  
**Runtime:** `nodejs` · **LLM:** none

### Auth / body

- Session required (does **not** check coach role in Next).
- Body forwarded as-is; no `coach_id` injection.
- Python `coach_review` uses `request.state.user_id` — again **null under internal auth** → same identity gap as feedback.

UI body: `{ action: 'approve' | 'edit' | 'reject' }` (+ optional edited fields per Python schema).

### Consolidation

**Stay as BFF**; fix identity forwarding. Do not delete.

---

## 7. `POST /api/ai-agent/events`

**File:** `src/app/api/ai-agent/events/route.ts` (45 lines)  
**Runtime:** `nodejs` · **LLM:** none in Next; Python may call specialists (e.g. biomarker) on `lab_ingest`

### Auth / body

- Session required; body forwarded to `POST /events/hook`.
- Expected Python shape: `{ event_type, athlete_id, organization_id, data }`.
- Response: `{ acknowledged, event_type, athlete_id, insight_id, timestamp }`.

### Callers

No in-repo frontend callers found under `src/`. Likely intended for server/cron/lab ingest.

### Consolidation

**Absorb trigger path into Python / schedulers** where possible; if browsers/Next jobs must fire events, **keep thin BFF**. Prefer direct internal calls from trusted jobs with secret, not user-session BFF, for system events.

---

## 8. `GET /api/ai-agent/labs`

**File:** `src/app/api/ai-agent/labs/route.ts` (57 lines)  
**Runtime:** `nodejs` · **LLM:** none

### Behavior

- Session + org; injects `organization_id`.
- Proxies to `/labs` **or** wrongly to `/labs/trend` if `?trend=` is set (L35) — Python has **`/biomarker-trend`**, not `/labs/trend`. Dead/broken branch.
- Dedicated `labs/trend` route (below) is the correct path.

### Duplication

`specialistTools.ts` `getLabPanelsTool` already calls Python `/labs` **directly** with internal secret (bypasses this BFF).

### Consolidation

**Stay** for any UI that needs cookie-auth lab reads; **or delete** if only tools use labs (tools already go direct). Fix or remove the `?trend=` branch.

---

## 9. `GET /api/ai-agent/labs/trend`

**File:** `src/app/api/ai-agent/labs/trend/route.ts` (42 lines)  
**Runtime:** `nodejs` · **LLM:** none

### Behavior

- Session required.
- Forwards query params to `GET /biomarker-trend` **without** injecting `organization_id` from profile (unlike sibling labs route) — tenancy relies on client honesty + Python.
- Duplicated by `getBiomarkerTrendTool` in `specialistTools.ts`.

### Consolidation

Same as labs: **stay for UI BFF** or **delete** if unused by UI (no `src/` callers found for `/api/ai-agent/labs*`).

---

## 10. `POST /api/ai-agent/genetics/upload`

**File:** `src/app/api/ai-agent/genetics/upload/route.ts` (112 lines)  
**Runtime:** `nodejs` · **LLM:** none in Next; Python `parse_genetic_report` may use heuristics/ML later

### Request

`multipart/form-data`: `file`, `athlete_id`, optional `file_type` (default `dtc_raw`).

### Auth

- Session + org.
- Own data **or** coach/admin/club_admin.
- Inserts `genetic_reports` row in Supabase (RLS/user client), then POSTs bytes as `number[]` to Python `/genetics/parse`.

### Response

`{ report_id, success, traits_extracted }` or upload-ok / parse-fail variants with `report_id`.

### vs main chat

Upload + consent flags + storage orchestration — chat tools only **read** traits via `getGeneticTraitsTool` → `/genetic-traits`.

### Callers

No `src/` UI caller found yet (route exists for upcoming genetics UX).

### Consolidation

**Stay in Next** for multipart + Supabase row creation (browser upload boundary). Parsing already in Python — do not move file upload into the agent process if avoidable (memory: full file as JSON int array is heavy).

---

## 11. `POST /api/transcribe`

**File:** `src/app/api/transcribe/route.ts` (57 lines)

```3:4:PeakPerformanceData/peak_performance_data/src/app/api/transcribe/route.ts
// PERFORMANCE: Use Edge runtime for faster cold starts
export const runtime = 'edge'
```

- **Method:** `POST` (wrapped in `withCacheHeaders` only — **not** `withAuth`)  
- **Runtime:** `edge`  
- **maxDuration:** unset  
- **LLM/model:** **Groq `whisper-large-v3-turbo`** via `groq-sdk`

### Request / response

- `multipart/form-data`: `audio` (File), optional `language` (default `pt`).
- Response: `{ language, model: 'groq-whisper-large-v3-turbo', text }`.

### Prompt (Whisper priming vocabulary)

```9:15:PeakPerformanceData/peak_performance_data/src/app/api/transcribe/route.ts
const WHISPER_PROMPTS: Record<string, string> = {
  ca: 'Informe d\'entrenament, esportista, freqüència cardíaca, torneig, competició, lactats, recuperació, sessió',
  en: 'Training report, athlete, heart rate, tournament, competition, lactate, recovery, session',
  es: 'Informe de entrenamiento, deportista, frecuencia cardíaca, torneo, competición, lactato, recuperación, sesión',
  pt: 'Relatório de treino, atleta, frequência cardíaca, torneio, competição, lactato, recuperação, sessão',
  zh: '训练报告, 运动员, 心率, 锦标赛, 比赛, 乳酸, 恢复, 训练课',
}
```

### Auth — security note

`withCacheHeaders` **does not authenticate** (`with-auth.ts` L91–102). Middleware **excludes** `/api`. → **Anyone who can hit the deployment can spend Groq Whisper quota** unless an edge/network layer blocks it. Caller `useSpeechRecognition.ts` assumes a logged-in browser session but the API does not enforce it.

### vs main chat

Input modality only; chat route receives already-transcribed text. Not part of the reasoning brain.

### Consolidation

**Stay in Next** (or move to a dedicated STT microservice). Do **not** absorb into the Python chat agent unless you want one hop for voice; if absorbed, keep it a separate `/transcribe` endpoint, not inside the tool loop. **Add auth** before production hardening of the Python move.

---

## LLM / AI usage outside `api/` (not separate routes)

| Location | Provider | Model | When |
|----------|----------|-------|------|
| `src/lib/ai/utils/conversationMemory.ts` L108–132 | Groq via `createGroqClient` | `llama-3.3-70b-versatile` | Rolling conversation summary (`generateText`, maxTokens 200) — invoked from **main** chat route persistence |
| `src/lib/ai/utils/semanticMemory.ts` L185–205 | OpenAI | `text-embedding-3-small` | Memory retrieve/store — main chat path |
| `src/hooks/ai/useSpeechRecognition.ts` | — | — | Client → `/api/transcribe` |
| Server Actions (`"use server"`) | — | — | **None found** under `src/` |
| Server Components | — | — | No direct LLM SDK usage found |

These are capabilities of the **main agent stack**, not secondary HTTP brains. Absorb summarizer + embeddings into Python with the main chat move.

---

## Cross-cutting findings

### A. Two “AI agent” stacks coexist

1. **Production chat:** Edge `route.ts` + DeepSeek/Groq + TS tools.  
2. **Python insight/lab/genetics service:** BFF routes under `ai-agent/{insights,feedback,labs,events,genetics,proxy}` + `specialistTools` direct calls.

`proxy` is the intended unification point but `/chat` is missing in Python.

### B. BFF identity forwarding is incomplete

Internal auth clears `user_id` / `organization_id` on Python. Routes that rely on `request.state.user_id` (feedback, review) need Next to pass identity in the JSON body (or forward the user JWT). Today they mostly do not.

### C. Duplicate data paths for wearables

| Path | Authz | Notes |
|------|-------|-------|
| Tool → `wearable-query` → ppd_backend | Intended strong; **tool call broken** (no cookies) | Aggregates in Next |
| Tool → ppd_backend direct (`garminActivityTools`, leaderboard) | Org athlete lookup only | Aggregates in tool |
| Future Python tools → ClickHouse / ppd_backend | TBD | Preferred consolidation target |

### D. `ppd_backend` wearables = no auth

Quoted implication from dossier 22 + confirmed: Next sends `x-internal-service`, backend ignores it. Constrained query builder is safe against SQL injection; **not** safe against IDOR if the backend URL is reachable.

---

## Consolidation recommendation

### Absorb into Python agent (capability; drop Next implementation)

| Capability | Today | Action |
|------------|-------|--------|
| Wearable metric insight + leaderboard aggregation | `wearable-query` + `wearableInsightTools` + parts of `garminActivityTools` | Implement as Python tools over CH / ppd_backend; **delete** Next `wearable-query` |
| Conversation summary + embeddings | `conversationMemory` / `semanticMemory` (main route helpers) | Move with main chat brain |
| Event-driven insight generation | Python already; Next `events` is optional shim | Prefer scheduler → Python direct |
| Lab/biomarker/genetic **reads** used by tools | Already Python via `specialistTools` | Keep in Python; Next BFF only if UI needs it |

### Stay in Next.js (thin BFF / non-brain)

| Route | Reason |
|-------|--------|
| `/api/ai-agent/proxy` | Session cookie → Python chat (once `/chat` exists); replace main `route.ts` |
| `/api/ai-agent/insights` | Cookie tenancy + list UI |
| `/api/ai-agent/insights/.../review` | Cookie boundary; fix identity inject |
| `/api/ai-agent/feedback` | Cookie boundary; fix identity inject |
| `/api/ai-agent/genetics/upload` | Multipart + Supabase row + consent |
| `/api/ai-agent/usage` | Audit dashboard; not brain |
| `/api/transcribe` | STT UX; add real auth; optional later move |

### Delete (or never ship / fix-then-delete)

| Route / code | Reason |
|--------------|--------|
| `/api/ai-agent/wearable-query` | After Python tools land; currently redundant + broken from tool caller |
| `/api/ai-agent/labs` `?trend=` branch | Wrong upstream path; dead |
| `/api/ai-agent/labs` + `/labs/trend` | If no UI consumers and tools stay direct — delete BFF to reduce surface |
| `InsightStrip` → `/proxy` usage | Miswired; point at `/insights` + `/feedback` or delete unused strip |
| Main Edge `route.ts` (eventually) | Replaced by `proxy` + Python `/chat` (dossier 13) — not this dossier’s delete list until cutover |

### Do not delete prematurely

- Feedback / insights / genetics upload — product surfaces for coach inbox and health domain even when chat brain moves.
- Transcribe — voice input independent of where the LLM loop runs.

---

## Suggested cutover order (secondary routes)

1. Fix BFF identity forwarding (`userId` / `organizationId` / role) on feedback + review.  
2. Land Python `/chat`; point `useAIAgent` at `/api/ai-agent/proxy`; retire Edge `route.ts`.  
3. Port wearable insight tools to Python; delete `wearable-query`.  
4. Add auth to `/api/transcribe` and internal-auth to `ppd_backend` `/wearables/*`.  
5. Prune unused labs BFF routes if UI never lands; keep genetics upload BFF.

---

## File index (absolute paths)

```
/Users/danielsilva/Desktop/PeakPerformanceDataMonorepo/PeakPerformanceData/peak_performance_data/src/app/api/ai-agent/wearable-query/route.ts
/Users/danielsilva/Desktop/PeakPerformanceDataMonorepo/PeakPerformanceData/peak_performance_data/src/app/api/ai-agent/usage/route.ts
/Users/danielsilva/Desktop/PeakPerformanceDataMonorepo/PeakPerformanceData/peak_performance_data/src/app/api/ai-agent/proxy/route.ts
/Users/danielsilva/Desktop/PeakPerformanceDataMonorepo/PeakPerformanceData/peak_performance_data/src/app/api/ai-agent/feedback/route.ts
/Users/danielsilva/Desktop/PeakPerformanceDataMonorepo/PeakPerformanceData/peak_performance_data/src/app/api/ai-agent/insights/route.ts
/Users/danielsilva/Desktop/PeakPerformanceDataMonorepo/PeakPerformanceData/peak_performance_data/src/app/api/ai-agent/insights/[insightId]/review/route.ts
/Users/danielsilva/Desktop/PeakPerformanceDataMonorepo/PeakPerformanceData/peak_performance_data/src/app/api/ai-agent/events/route.ts
/Users/danielsilva/Desktop/PeakPerformanceDataMonorepo/PeakPerformanceData/peak_performance_data/src/app/api/ai-agent/labs/route.ts
/Users/danielsilva/Desktop/PeakPerformanceDataMonorepo/PeakPerformanceData/peak_performance_data/src/app/api/ai-agent/labs/trend/route.ts
/Users/danielsilva/Desktop/PeakPerformanceDataMonorepo/PeakPerformanceData/peak_performance_data/src/app/api/ai-agent/genetics/upload/route.ts
/Users/danielsilva/Desktop/PeakPerformanceDataMonorepo/PeakPerformanceData/peak_performance_data/src/app/api/transcribe/route.ts
/Users/danielsilva/Desktop/PeakPerformanceDataMonorepo/PeakPerformanceData/peak_performance_data/src/lib/ai/tools/wearableInsightTools.ts
/Users/danielsilva/Desktop/PeakPerformanceDataMonorepo/PeakPerformanceData/ppp_ai_agent/api/routes/insights.py
/Users/danielsilva/Desktop/PeakPerformanceDataMonorepo/PeakPerformanceData/ppd_backend/api/routes/wearables.py
```
