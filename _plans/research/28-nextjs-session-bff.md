# Research Dossier 28 — Next.js Session, Locale & BFF Proxy Pipeline

**Scope:** Read-only analysis of how the Next.js 15 app (`PeakPerformanceData/peak_performance_data`) handles locale routing, Supabase session cookies, route protection, and existing backend proxies — to design the BFF layer that will authenticate users and stream to the Python AI agent (`ppp_ai_agent`).

**Date of analysis:** 2026-08-02  
**Constraint:** No application code changes; this dossier only.

---

## Sources analyzed

| File | Role | Depth |
|------|------|-------|
| `src/middleware.ts` | Edge orchestrator | full |
| `src/middleware/intl.ts` | next-intl locale redirects | full |
| `src/middleware/auth.ts` | Session refresh, org isolation, auth redirects | full |
| `src/middleware/authorization.ts` | Role-based path guards | full |
| `src/lib/supabase/server.ts` | `createRouteClient`, `getRouteUserFast`, `createServerClient` | full |
| `src/lib/supabase/server-client.ts` | Server Component helper + `getServerUser` | full |
| `src/lib/supabase/client.ts` | Browser client | full |
| `src/lib/supabase/service.ts` | Service-role client (no user session) | full |
| `src/lib/api/with-auth.ts` | API auth wrappers (`withAuth`, etc.) | full |
| `src/lib/auth/auth.ts`, `index.ts` | `getUser`, `getUserFromRouteHandler` | relevant |
| `src/hooks/auth/useUser.ts` | Client profile via UserContext | full |
| `src/lib/auth/loginPrefetch.ts` | Post-login SWR cache warm | full |
| `src/i18n/routing.ts`, `request.ts` | Locale catalog + RSC messages | full |
| `src/app/api/ai-agent/route.ts` | In-process AI (edge, `maxDuration=30`) | full |
| `src/app/api/ai-agent/proxy/route.ts` | Existing BFF → Python agent | full |
| Sibling `ai-agent/*` proxy routes | Insights/labs/events/etc. | sampled |
| `src/app/api/vision-proxy/[...path]/route.ts` | API-key BFF pattern | full |
| `src/app/api/garmin-connect/sync/[jobId]/progress/route.ts` | Homegrown SSE | full |
| `src/lib/core/config.ts` | `API_URL`, `PPC_API_URL`, WearableSync | full |
| `src/hooks/ai/useAIAgent.ts` | Client locale + body shape | full |
| `src/lib/ai/prompts/systemPrompt.ts` | Locale in system prompt | relevant |
| `ppp_ai_agent/api/middleware/auth.py` | Python token verification | full |
| `vercel.json`, `next.config.js` | Rewrites / platform config | relevant |

**Note on “middleware client”:** There is no dedicated `src/lib/supabase/middleware-client.ts`. Middleware builds `@supabase/ssr` `createServerClient` inline in `middleware.ts` (L101–119) and again as a fallback in `middleware/auth.ts` (L208–226). Cookie `setAll` writes refreshed tokens onto the middleware `NextResponse`.

---

## 1. `middleware.ts` — order of operations

Documented intent (L15–23) and actual flow:

| Step | What | Lines |
|------|------|-------|
| 1 | **Locale (next-intl)** via `handleIntl` — early return on redirect | L28–33, `middleware/intl.ts` L30–41 |
| 2 | **CORS** via `handleCors` — OPTIONS / rejection | L38–42 |
| 2b | **Social crawler rewrites** for `/watch/*` and `/tennis-bench/*` → `/api/.../social` | L44–62 |
| 3 | **Static / API early return** — **skips all auth** for `/api/`, `/_next`, `/_vercel`, dotted paths | L64–73 |
| 4 | Path classification + optional session prefetch | L79–95 |
| 4–5 | Parallel **brand** + `getSession()`; optional `getUser()` with 30‑min marker cookie | L99–192 |
| 5 | **Auth** (`handleAuth`) — redirects, org isolation, role dashboards | L188–196 |
| 6 | **Authorization** (`handleAuthorization`) — role path guards | L206–210 |
| — | Return `intlResponse` with cookies/headers mutated | L230 |

### Matcher (`config.matcher`, L236–245)

```236:245:PeakPerformanceData/peak_performance_data/src/middleware.ts
export const config = {
  matcher: [
    '/',
    '/(en|es|zh|ca)/:path*',
    '/((?!api|_next|_vercel|favicon\\.ico|assets|presentation|.*\\.(?:png|jpg|jpeg|svg|ico|gif|webp|css|js|woff2?|ttf|otf|eot|map|json|mp4|webm|mov|m4v|mp3|wav)).*)',
  ],
}
```

**Critical implication for BFF design:** `/api/*` is excluded from the matcher **and** short-circuited again at L68. **API routes never receive middleware session refresh or `x-middleware-user-*` headers.** Each API route must authenticate itself via cookie → Supabase client.

Comments in `with-auth.ts` (L109–111) and `lib/auth/index.ts` (L4–6) claiming “middleware already validates before API routes” are **incorrect for `/api/*`**. They are accurate for page navigations under protected paths.

### Locale routing (next-intl)

- Wrapper: `createMiddleware(routing)` in `middleware/intl.ts` L7, L33.
- Locales: `en`, `es`, `zh`, `ca`; default `en` — `src/i18n/routing.ts` L4–10.
- Redirects (e.g. `/` → `/en`) return immediately (`shouldReturn: true` when `location` header set).
- Helpers: `getPathnameWithoutLocale` (strip prefix for auth path checks), `getCurrentLocale` (segment or default).

### Session refresh

When `needsSession` (auth cookie present **and** path is protected / auth / root / non-public):

1. Build SSR client with request cookies; `setAll` writes onto response cookies (L101–119) — this is the **session refresh** path for page navigations.
2. `supabase.auth.getSession()` in parallel with brand (L122–125).
3. For protected routes, optionally `getUser()` (GoTrue round-trip) unless cookie `ppd-session-validated` matches user id within **1800s** (L136–177).

Cookie name patterns for “has session” (L87–90, also `auth.ts` L172–175):

- `sb-*-auth-token`
- `supabase-auth-token`

### Route protection

**Protected prefixes** (middleware.ts L80; subset also in `auth.ts` L14 — note drift: main file adds `/management`, `/settings`, `/feedback`, `/performance-tests`, `/tennis-scorekeeper`):

`/overview`, `/profile`, `/admin`, `/admin-test`, `/coach`, `/stats`, `/charts`, `/exploration`, `/chat`, `/history`, `/club-admin`, `/parent`, `/player`, (+ management/settings/… in main middleware path flags).

**Auth-only:** `/login`, `/signup`.  
**Public:** `/`, invitations, password flows, `/watch`, `/tennis-bench`, etc. (L82).

Unauthenticated → `/{locale}/login?redirect=…`. Authenticated on auth paths → role dashboard. Org mismatch → login `error=wrong_organization` + cookie clear. Role gates in `authorization.ts` for `/admin`, `/club-admin`, `/coach`, `/parent`, `/player`.

Downstream headers when authenticated: `x-middleware-user-id`, `-email`, `-role`, `-org`, `-org-name`, `-org-admin`, `-roles`, `-meta` (`auth.ts` L120–151).

---

## 2. Supabase session helpers — which to use where

| Helper | File | Use case | Auth call |
|--------|------|----------|-----------|
| Inline `createServerClient` in middleware | `middleware.ts` L101 | Edge cookie refresh | `getSession` / `getUser` |
| `createRouteClient()` | `server.ts` L35–58 | **API route handlers** (preferred) | caller chooses |
| `getRouteUserFast()` | `server.ts` L68–72 | API: cookie user, no GoTrue | `getSession` |
| `createServerClient()` (cached) | `server.ts` L76–100 | Server Components / shared | — |
| `getServerUserFast()` | `server.ts` L14–28 | RSC fast path | `getSession` |
| `createServerSupabaseClient` / `getServerUser` | `server-client.ts` | RSC convenience | `getSession` |
| `createClient` / `supabase` Proxy | `client.ts` | Browser | SDK cookie jar |
| `supabaseServiceRole` / `createAdminClient` | `service.ts` / `admin.ts` | Privileged server, **not** user JWT | service role key |
| `withAuth` / `withAuthAndProfile` / … | `with-auth.ts` | Wrapper around `createRouteClient` + `getSession` | `getSession` |
| `getUserFromRouteHandler()` | `auth.ts` L361–365 | Legacy alias | `getSession` |

**Recommendation for BFF API routes:**  
`const supabase = await createRouteClient()` then either:

- **Fast path (current majority):** `supabase.auth.getSession()` → `session.user` (used by `/api/ai-agent`, `/api/ai-agent/proxy`, `withAuth`).
- **Strict path (when middleware did not run):** `supabase.auth.getUser()` to validate JWT with GoTrue (already used by `wearable-query` L10 and Garmin SSE progress L23).

Because `/api` skips middleware, **prefer `getUser()` on the BFF chat proxy** (or validate once then use session). Cookie-only `getSession()` trusts an unvalidated JWT for that request.

### Client hooks (context only)

- `useUser()` (`hooks/auth/useUser.ts`): reads `UserContextProvider` — profile/org, not raw JWT.
- `loginPrefetch.ts`: after login, `fetch(..., credentials: 'include')` to warm SWR (`/api/auth/user-context-lite`, dashboard init). Confirms cookie session is the browser credential model.

---

## 3. Obtaining a JWT for the Python service

### How to get the access token server-side

```ts
const supabase = await createRouteClient()
const { data: { session } } = await supabase.auth.getSession()
// session.access_token  — raw JWT
// session.refresh_token — do NOT forward to Python
```

There is **no** existing production path that forwards `session.access_token` to `ppp_ai_agent`. Grep of app `src` shows `access_token` only in invitation acceptance and DB types, not BFF headers.

### Can Python verify offline (JWKS / shared secret)?

**In this monorepo today: no offline JWKS path and no wired `SUPABASE_JWT_SECRET`.**

Python agent auth (`ppp_ai_agent/api/middleware/auth.py`):

1. **`x-internal-service`** == `INTERNAL_SERVICE_SECRET` → trust caller; **identity must be in body** (`user_id` etc. stay `None` on `request.state` for internal auth — L37–41).
2. **`Authorization: Bearer <jwt>`** → **online** verification via `GET {SUPABASE_URL}/auth/v1/user` with that Bearer + `apikey: SUPABASE_SERVICE_KEY` (L74–81). Then loads `profiles` via service role (L90–110).

So:

| Method | Offline? | Status in repo |
|--------|----------|----------------|
| Shared JWT secret (legacy HS256) | Yes, if secret available | **Not configured / unused** in Next or agent |
| JWKS (asymmetric) | Yes, after fetch/cache | **Not implemented** |
| GoTrue `/auth/v1/user` | No (network) | **Implemented** in Python |
| Internal service secret | N/A (shared HMAC-like secret) | **Implemented**; used by Next BFF proxies |

**Auth design implication:** The established pattern is **BFF cookie auth → inject identity into body → `x-internal-service`**. Optional Bearer forward is supported by Python but adds a GoTrue hop per request unless Python later adds JWKS. Do **not** assume offline JWT verify without adding JWKS or JWT secret to the agent.

---

## 4. Locale system

| Item | Detail |
|------|--------|
| Locales | `en`, `es`, `zh`, `ca` (`i18n/routing.ts` L6) |
| Default | `en` |
| Determination (edge) | Path prefix via next-intl; `getCurrentLocale(pathname)` |
| Determination (RSC) | `requestLocale` in `i18n/request.ts`; fallback default |
| Determination (AI client) | `useLocale()` from `next-intl` in `useAIAgent.ts` L39, L58–59 |
| Passed to AI today | JSON body field `locale` on `POST /api/ai-agent` (`route.ts` L25; into `getSystemPrompt(..., locale, ...)`) |
| Prompt languages called out | PT, EN, ES, ZH — **Catalan (`ca`) not listed** in `systemPrompt.ts` L21–25 |

**Passing locale to the agent:** Forward the client `locale` (and optionally `Accept-Language`) in the BFF JSON body. Do not infer from URL for `/api` (no locale segment). Prefer server trust of `useLocale()` value after validating against `routing.locales`.

---

## 5. Existing proxy / rewrite patterns

### Env / config URLs (`src/lib/core/config.ts`)

| Constant | Env | Prod default |
|----------|-----|--------------|
| `API_URL` | `NEXT_PUBLIC_API_URL` | `https://api.wearablesync.app` |
| `PPC_API_URL` | `NEXT_PUBLIC_PPC_API_URL` | `https://api.wearablesync.app/ppc` |
| `WEARABLE_SYNC_API_URL` | `WEARABLE_SYNC_API_URL` | `https://api.wearablesync.app` |
| Agent | `PPP_AI_AGENT_URL` | (code default `http://localhost:8001`) |
| Internal auth | `INTERNAL_SERVICE_SECRET` | header `x-internal-service` |

Local `.env.local` sample: `NEXT_PUBLIC_PPC_API_URL=http://localhost:8001/ppc`, `NEXT_PUBLIC_API_URL=http://localhost:8000`.

### Next.js rewrites

- **`next.config.js`:** no backend API rewrites (headers only around L449+).
- **`vercel.json` rewrites:** presentation static assets only (L58–70) — **not** AI/PPC.
- **Middleware rewrites:** social OG HTML for watch/bench crawlers only.

### In-app BFF / proxy examples

| Pattern | Location | Auth to upstream |
|---------|----------|------------------|
| AI chat BFF | `api/ai-agent/proxy/route.ts` | `x-internal-service` + body identity |
| Insights/labs/events/feedback/genetics | `api/ai-agent/*/route.ts` | same |
| Specialist tools (in-process AI) | `lib/ai/tools/specialistTools.ts` | `x-internal-service` |
| Wearable query → ppd_backend | `api/ai-agent/wearable-query` | `x-internal-service` |
| Vision proxy | `api/vision-proxy/[...path]` | `X-Api-Key` + optional `X-User-Id` |
| PPC graphs | charts page / readiness / parent progress | direct `fetch(PPC_API_URL/...)` (often no user JWT) |
| NDJSON stream consume | `charts/page.tsx` L150+ | client/server fetch to PPC stream |

---

## 6. Edge vs Node runtime

Rough census under `src/app/api`:

- **`export const runtime = 'edge'`:** ~164 route files (majority).
- **`export const runtime = 'nodejs'`:** ~31 files, including **all** `ai-agent/*` proxies except the in-process chat route.

| Route | Runtime | `maxDuration` |
|-------|---------|---------------|
| `/api/ai-agent` (in-process LLM) | `edge` | **30** |
| `/api/ai-agent/proxy` | `nodejs` | **60** |
| `/api/tennis/matches/[id]/media` | `nodejs` | **60** |
| Other AI proxy siblings | `nodejs` | (platform default) |

**Constraints:**

- Edge: faster cold start; no Node APIs; AI SDK tools currently run here for main chat.
- Node: needed for heavy deps / longer duration; Vercel Pro typically allows higher `maxDuration` (proxy already at 60).
- Streaming through Node BFF is the right home for Python agent proxy (already chosen).

---

## 7. Streaming & timeout patterns

### In-process AI (`/api/ai-agent`)

- `streamText` → `result.toDataStreamResponse()` (Vercel AI SDK Data Stream Protocol) — L189–263.
- Soft abort: `AbortController` at **27s**, hard `maxDuration = 30` — L180–182, L19.
- Client: `@ai-sdk/react` `useChat` against `/api/ai-agent`.

### Existing Python BFF stream pipe (`/api/ai-agent/proxy`)

```66:76:PeakPerformanceData/peak_performance_data/src/app/api/ai-agent/proxy/route.ts
    const contentType = res.headers.get('content-type') || ''
    if (contentType.includes('text/event-stream')) {
      return new Response(res.body, {
        headers: {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          Connection: 'keep-alive',
        },
      })
    }
```

Pipes upstream `ReadableStream` without buffering. `maxDuration = 60`. No soft abort yet.

### Homegrown SSE

`garmin-connect/sync/[jobId]/progress/route.ts`: Edge `ReadableStream` emitting `data: …\n\n`, `Content-Type: text/event-stream`, cancel on `request.signal` — L32–105.

### PPC NDJSON

Charts page consumes `application/x-ndjson` from PPC with `getReader()` — not a Next proxy; server component / helper side.

### Vercel timeout notes

- Platform kills the function at `maxDuration` (static export required).
- Edge AI chat: **30s** budget; soft abort at 27s.
- Node proxy: **60s** — better for multi-step agent, still may be tight for long tool chains; consider raising if plan allows, plus AbortController ~3s before hard kill.
- Streaming keeps the function alive for the stream duration; idle TTFB still counts toward the limit.

---

## 8. Recommended BFF design (Next.js ↔ Python agent)

### Target flow

```
Browser (cookie session)
  → POST /api/ai-agent  (or promote /api/ai-agent/proxy)
      1. createRouteClient()
      2. getUser() (or getSession + getUser on first use) → 401 if missing
      3. Load profiles.organization_id + role from DB (never trust body identity)
      4. Validate locale ∈ {en,es,zh,ca}
      5. fetch(PPP_AI_AGENT_URL/chat, {
           headers: {
             'Content-Type': 'application/json',
             'x-internal-service': INTERNAL_SERVICE_SECRET,
             // optional defense-in-depth:
             // Authorization: Bearer ${session.access_token}
           },
           body: { ...clientBody, userId, organizationId, userRole, locale },
           signal: abortController.signal,
         })
      6. If upstream SSE/data-stream: return new Response(res.body, { headers… })
      7. Else JSON / error mapping (502 on connect fail)
```

### Auth choice (primary)

**Keep internal-service BFF as primary** — already implemented in `proxy/route.ts` and Python middleware. Next.js is the trust boundary: it alone reads cookies and mints the identity fields.

Optional: also forward `Authorization: Bearer ${session.access_token}` so Python can populate `request.state.user_*` without trusting body. Today internal auth leaves those `None`, so **body identity is mandatory** for internal calls — ensure Python `/chat` reads user fields from JSON, not only `request.state`.

**Do not** rely on offline JWT verification until JWKS or `SUPABASE_JWT_SECRET` is explicitly added to the agent. Current Bearer path is **online GoTrue**.

### Streaming & timeouts

| Setting | Recommendation |
|---------|----------------|
| Runtime | `nodejs` (match proxy) |
| `maxDuration` | **60** (or plan max); soft abort at `maxDuration - 3s` |
| Stream | Pipe `res.body`; preserve `Content-Type` from upstream (SSE or AI SDK stream) |
| Client | Point `useChat({ api })` at the BFF; keep sending `locale` |
| Rate limits / audit | Either keep in Next or move to Python; don’t double-count |

### Locale

Pass validated `locale` in the JSON body. System prompt on the Python side should honor it (parity with `getSystemPrompt` language block); include `ca` if Catalan UI is in scope.

### What not to do

- Do not depend on middleware session refresh for `/api` (it never runs).
- Do not forward `refresh_token` or service-role key to the browser or agent request body.
- Do not use next.config rewrites for authenticated AI (loses cookie→identity translation).
- Do not trust `userId` / `organizationId` / `userRole` from the client body (`useAIAgent` still sends them — server must overwrite).

### Migration note

In-process `/api/ai-agent` (`edge`, 30s) should become a thin alias of the Node proxy (or the client should switch `api: '/api/ai-agent/proxy'`) once Python owns the brain. The proxy file already documents this intent (L8–15).

---

## Quick reference — cookie → user in an API route

```ts
import { createRouteClient } from '@/lib/supabase/server'

export const runtime = 'nodejs'
export const maxDuration = 60

export async function POST(req: Request) {
  const supabase = await createRouteClient()
  const { data: { user }, error } = await supabase.auth.getUser()
  if (error || !user) return Response.json({ error: 'Authentication required' }, { status: 401 })

  const { data: { session } } = await supabase.auth.getSession()
  const accessToken = session?.access_token // optional Bearer forward

  // ... profile load, fetch agent with x-internal-service, pipe stream
}
```
