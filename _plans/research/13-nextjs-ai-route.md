# Research Dossier 13 — Next.js AI Chat Route (`/api/ai-agent`)

**Scope:** Read-only, exhaustive analysis of the production AI assistant endpoint in `PeakPerformanceData/peak_performance_data`, preparing for a thin streaming proxy that moves the “brain” to `PeakPerformanceData/ppp_ai_agent`.

**Primary file:** `PeakPerformanceData/peak_performance_data/src/app/api/ai-agent/route.ts` (297 lines)

**Date of analysis:** 2026-08-02

---

## Sources analyzed

| File | Role | Depth |
|------|------|-------|
| `src/app/api/ai-agent/route.ts` | Main POST handler | full |
| `src/lib/ai/agentConfig.ts` | Providers, model names, token/rate limits | full |
| `src/lib/ai/prompts/systemPrompt.ts` | Role-based system prompt assembly | full |
| `src/lib/ai/utils/toolRouter.ts` | Intent classification + dynamic tool partitioning | full |
| `src/lib/ai/utils/rateLimit.ts` | In-memory rate limiting | full |
| `src/lib/ai/utils/auditLog.ts` | `ai_audit_logs` writes + stream telemetry | full |
| `src/lib/ai/utils/conversationMemory.ts` | `ai_conversations` load/save/summarize | full |
| `src/lib/ai/utils/semanticMemory.ts` | `ai_memories` retrieve/store/extract | full |
| `src/lib/ai/utils/alertEvaluator.ts` | Coach proactive alerts for prompt injection | full |
| `src/lib/ai/utils/retry.ts` | Retry wrapper around model calls | full |
| `src/lib/ai/tools/index.ts` | Tool barrel (~121 exported tool factories) | full |
| `src/lib/api/with-auth.ts` | `withCacheHeaders` wrapper used by route | relevant sections |
| `src/lib/supabase/server.ts` | `createRouteClient` (cookie session) | relevant sections |
| `src/hooks/ai/useAIAgent.ts` | Client `useChat` caller (request body shape) | full |
| `src/lib/ai/tools/specialistTools.ts` | Already proxies some tools to Python agent | partial |
| Installed `ai@4.3.19`, `@ai-sdk/ui-utils@1.2.11` | Data Stream Protocol wire format | package internals |

**Sibling routes (context only, not the main chat brain):**

- `src/app/api/ai-agent/wearable-query/route.ts` — `nodejs` runtime; tool-side helper
- `src/app/api/ai-agent/usage/route.ts` — usage dashboard

---

## 1. Runtime, duration, streaming contract

### Runtime & duration

```15:19:PeakPerformanceData/peak_performance_data/src/app/api/ai-agent/route.ts
// PERFORMANCE: Use Edge runtime for faster cold starts
export const runtime = 'edge'

// Must be a static literal for Next.js to analyze at build time
export const maxDuration = 30
```

- **Runtime:** `edge` (not Node.js).
- **`maxDuration`:** `30` seconds (Vercel/platform hard limit for this route).
- Soft abort: `AbortController` fires at **27_000 ms** so the stream can fail gracefully before the platform kill (route L180–182).

### Vercel AI SDK versions

| Package | Declared (`package.json`) | Installed (`node_modules`) |
|---------|---------------------------|----------------------------|
| `ai` | `^4.0.0` | **4.3.19** |
| `@ai-sdk/openai` | `^1.0.0` | **1.3.24** |
| `@ai-sdk/react` | `^1.0.0` | **1.2.12** |
| `@ai-sdk/ui-utils` (transitive via `ai`) | — | **1.2.11** |

Providers are **not** `@ai-sdk/deepseek` / `@ai-sdk/groq`. Both are OpenAI-compatible clients via `createOpenAI` from `@ai-sdk/openai` with custom `baseURL` (`agentConfig.ts` L11–34).

### Streaming API surface (exact)

Dynamic import + call sites:

```110:113:PeakPerformanceData/peak_performance_data/src/app/api/ai-agent/route.ts
    const [{ streamText }, tools] = await Promise.all([
      import('ai'),
      import('@/lib/ai/tools'),
    ]);
```

```189:197:PeakPerformanceData/peak_performance_data/src/app/api/ai-agent/route.ts
          return await streamText({
            abortSignal: abortController.signal,
            maxSteps: 6,
            maxTokens: AI_CONFIG.maxTokens,
            messages,
            model: deepseek(AI_CONFIG.deepseek.model),
            system: systemPrompt,
            tools: aiTools,
          })
```

```263:271:PeakPerformanceData/peak_performance_data/src/app/api/ai-agent/route.ts
    const response = result.toDataStreamResponse()
    
    // Add rate limit headers
    const headers = getRateLimitHeaders(userId)
    for (const [key, value] of Object.entries(headers)) {
      response.headers.set(key, value)
    }
    
    return response
```

**Contract the Python replacement must satisfy for the existing client (`useChat` from `@ai-sdk/react`):**

| Aspect | Value |
|--------|--------|
| Response method | `StreamTextResult.toDataStreamResponse()` (AI SDK 4) |
| Protocol | **Vercel AI Data Stream Protocol v1** |
| Header | `X-Vercel-AI-Data-Stream: v1` |
| Content-Type | `text/plain; charset=utf-8` |
| Framing | Newline-delimited lines: `<code>:<JSON>\n` |

Wire codes (from `@ai-sdk/ui-utils@1.2.11` `data-stream-parts.ts`):

| Code | Name | Value shape |
|------|------|-------------|
| `0` | `text` | `string` (text delta) |
| `2` | `data` | `array` |
| `3` | `error` | `string` |
| `8` | `message_annotations` | `array` |
| `9` | `tool_call` | `{ toolCallId, toolName, args }` |
| `a` | `tool_result` | `{ toolCallId, result }` |
| `b` | `tool_call_streaming_start` | `{ toolCallId, toolName }` |
| `c` | `tool_call_delta` | `{ toolCallId, argsTextDelta }` |
| `d` | `finish_message` | `{ finishReason, usage? }` |
| `e` | `finish_step` | `{ finishReason, isContinued, usage? }` |
| `f` | `start_step` | `{ messageId }` |
| `g` | `reasoning` | `string` |
| `h` | `source` | object |
| `i` | `redacted_reasoning` | `{ data }` |
| `j` | `reasoning_signature` | `{ signature }` |
| `k` | `file` | `{ data, mimeType }` |

Example text delta line: `0:"Hello"\n`

Tool-call multi-step loops are handled **server-side** by `streamText({ maxSteps: 6 })` — the client also sets `maxSteps: 6` in `useChat` (client L66), but tool execution for this route happens in the Edge handler via AI SDK tool `execute` functions.

**Also returned on success (non-stream JSON error paths differ):** rate-limit headers:

- `X-RateLimit-Limit`
- `X-RateLimit-Remaining`
- `X-RateLimit-Reset` (unix seconds)

---

## 2. Request & response shapes

### Request body (what the server actually reads)

```25:25:PeakPerformanceData/peak_performance_data/src/app/api/ai-agent/route.ts
    const { locale, messages, sessionId: clientSessionId } = await req.json()
```

| Field | Required | Type / notes |
|-------|----------|--------------|
| `messages` | **Yes** | Array; empty → `400` `{ error: 'Messages array is required' }` |
| `locale` | No | Passed into `getSystemPrompt` for language block |
| `sessionId` | No | Aliased `clientSessionId`; falls back to `userId` (L145) |

### Request body (what the client still sends, but server ignores)

From `src/hooks/ai/useAIAgent.ts` L55–63:

```ts
useChat({
  api: '/api/ai-agent',
  body: {
    locale,
    organizationId: user?.organization_id,  // IGNORED by route
    sessionId: chatId,
    userId: user?.id,                        // IGNORED by route
    userRole: user?.role,                    // IGNORED by route
  },
  ...
})
```

`useChat` also automatically POSTs the full `messages` array (AI SDK UI protocol). Client `id` / `sessionId` is `user.id` (or sanitized React `useId`).

### Success response

- HTTP 200 streaming `Response` from `toDataStreamResponse()`.
- Body = Data Stream Protocol v1 (not JSON).
- Extra headers: rate-limit trio above.
- Wrapped by `withCacheHeaders` — for non-`NextResponse` `Response` objects the wrapper returns the stream **unchanged** (no Cache-Control applied):

```91:101:PeakPerformanceData/peak_performance_data/src/lib/api/with-auth.ts
export function withCacheHeaders(
  handler: (...args: any[]) => Promise<NextResponse | Response>,
  cacheOptions?: CacheOptions
) {
  return async (request: NextRequest, ...rest: any[]) => {
    const response = await handler(request, ...rest)
    if (response instanceof NextResponse) {
      return applyCacheHeaders(request, response, cacheOptions)
    }
    return response
  }
}
```

For POST, default cache profile would be `no-store` if a `NextResponse` were returned; streaming success bypasses that.

### Error responses (JSON)

| Status | Body | When |
|--------|------|------|
| 400 | `{ error: 'Messages array is required' }` | empty/missing messages |
| 401 | `{ error: 'Authentication required' }` | no Supabase session |
| 404 | `{ error: 'User profile not found' }` | profile query fails |
| 403 | `{ error: 'User is not associated with an organization' }` | `organization_id` null |
| 429 | `{ error: 'Rate limit exceeded. Please try again later.' }` + rate headers | over limit |
| 500 | `{ error: <message> }` | uncaught exception |

Client UX (`VoiceAssistantModal.tsx`): shows `error.message` or i18n `errorGeneric` when `useChat` surfaces an error.

---

## 3. Authentication & authorization — body vs session (verdict)

### Verdict: **identity is derived server-side from the Supabase session. The prior “trusted from body” security bug is REFUTED for the current server code.**

Evidence — server comments and implementation:

```36:70:PeakPerformanceData/peak_performance_data/src/app/api/ai-agent/route.ts
    // ── Server-side auth: derive identity from session cookie, not body ──
    const { data: { session }, error: sessionError } = await supabase.auth.getSession()
    if (sessionError || !session?.user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      )
    }

    const userId = session.user.id

    // Fetch profile to get organization_id and role (server-side, not trusted from body)
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('full_name, organization_id, role')
      .eq('id', userId)
      .single()
    ...
    const organizationId = profile.organization_id
    ...
    const userRole = profile.role || 'player'
    const userName = profile.full_name || 'User'
```

| Claim | Status |
|-------|--------|
| `userId` from request body | **False** — from `session.user.id` (L45) |
| `organizationId` from request body | **False** — from `profiles.organization_id` (L61) |
| `userRole` from request body | **False** — from `profiles.role` (L69) |
| Body still contains those fields from client | **True** — dead fields; ignored by destructuring |

### How the session is established

1. `createRouteClient()` (`src/lib/supabase/server.ts` L35–58) builds a Supabase SSR client from **cookies** (`NEXT_PUBLIC_SUPABASE_URL` + anon key).
2. Route calls `supabase.auth.getSession()` (cookie JWT read; no `getUser()` network round-trip).
3. Comments elsewhere (`with-auth.ts` L108–111, `server.ts` L64–66) state middleware already validates the session before API routes.

### Authorization nuances

- Must have a `profiles` row; else 404.
- Must have non-null `organization_id`; else 403.
- Role gates **tool sets** and **proactive alerts**, not the ability to call the endpoint (any org member with a profile can chat).
- Coaches: `coach_player_assignments` scopes athlete discovery tools (`assignedPlayerIds`) — route L119–128, toolRouter L176–179.
- Parents / athletes get restricted tool builders (`buildParentToolSet` / `buildAthleteToolSet`).

### Residual trust surface (not the identity bug, but real)

- **`sessionId`** comes from the body (or defaults to `userId`). A client can choose any string; persistence keys off that. Default client uses `user.id`, so conversations are effectively per-user unless spoofed.
- **`messages`** and **`locale`** are fully client-controlled (expected for chat).
- Client still *sends* `userId` / `organizationId` / `userRole` — harmless today, but confusing; remove when proxying to avoid reintroducing trust mistakes.

---

## 4. Model configuration

From `src/lib/ai/agentConfig.ts` + route `streamText` options:

| Setting | Value | Source |
|---------|-------|--------|
| Primary provider | DeepSeek via OpenAI-compatible API (`https://api.deepseek.com`) | `createDeepSeekClient` |
| Primary model | `deepseek-chat` | `AI_CONFIG.deepseek.model` |
| Reasoning model (config only) | `deepseek-reasoner` | **not used by this route** |
| Fallback provider | Groq OpenAI-compatible (`https://api.groq.com/openai/v1`) | `createGroqClient` |
| Fallback model | `llama-3.3-70b-versatile` | `AI_CONFIG.fallbackModel` |
| `maxTokens` | **1500** | `AI_CONFIG.maxTokens` |
| `maxSteps` | **6** | hardcoded in both primary + fallback `streamText` |
| `temperature` | **not set** (provider default) | absent from both `streamText` calls |
| Abort | `abortSignal` at 27s | route |
| Retry | `withRetry(..., { initialDelayMs: 500, maxRetries: 2 })` around the whole DeepSeek→Groq attempt | route L184–216 |
| Env keys | `DEEPSEEK_API_KEY`, `GROQ_API_KEY` (required when that client is constructed) | agentConfig |

Fallback behavior: **inner try/catch** — if DeepSeek `streamText` throws *before* returning a stream, catch and try Groq. Note: once a stream starts successfully, mid-stream DeepSeek failures are not swapped to Groq. Outer `withRetry` retries the whole fn on retryable errors (skips invalid key / rate limit / unauthorized / validation — `retry.ts` L19–29).

Embeddings for memories use separate **OpenAI** `text-embedding-3-small` if `OPENAI_API_KEY` is set (`semanticMemory.ts` L185–208). Conversation rolling summary uses Groq `generateText` (`conversationMemory.ts` L122–132).

---

## 5. Tools: registration, counts, dynamic filtering

### Registration pipeline

1. Dynamic `import('@/lib/ai/tools')` — barrel of ~**121** exported `*Tool` factories across 32 modules (`tools/index.ts`).
2. `classifyIntent(lastUserMsg)` → `Set<ToolCategory>` (`toolRouter.ts` L131–149).
3. `buildToolSet(tools, categories, organizationId, supabase, userId, userRole, assignedPlayerIds)` → concrete AI SDK `tool()` instances with closed-over Supabase + IDs.
4. Passed as `tools: aiTools` to `streamText`.

### Categories

`admin | analytics | athletes | communication | competition | core | specialized_training | training`

Intent map: keyword `includes` scan on lowercased last user message (`INTENT_CATEGORY_MAP`, toolRouter L24–125). Always starts with `'core'`. If only `core` matches → also add `athletes` + `training` (default fallback, L143–147).

### Counts per role (from `toolRouter.ts` registrations)

| Role path | Max tools if all categories match | Notes |
|-----------|-----------------------------------|-------|
| Coach / admin / club_admin | **96** unique tools | Core always: `confirmAction`, `getAthletes`, `searchAthlete` |
| Athlete / player | **25** | Personal `getMy*` tools + specialist proxies |
| Parent | **6** | Small fixed set; no intent partitioning |

Default coach turn (no keyword): `core + athletes + training` ≈ **3 + 24 + 19 = 46** tools (order-of-magnitude; exact depends on category overlap).

**Yes — dynamic filtering exists.** Full catalog is never intended to be sent every turn; intent + role partition reduces prompt tool schemas. Specialist analytics tools (`getLabPanels`, `getBiomarkerTrend`, `getGeneticTraits`, `getCgmScores`, `getTennisEvolution`, `getTennisMatches`) already HTTP-proxy to `PPP_AI_AGENT_URL` with `x-internal-service` (`specialistTools.ts`).

Tool `execute` functions run **inside this Edge route** (Supabase RLS via user cookie client), except specialist tools which call Python HTTP.

---

## 6. System prompt assembly

```162:174:PeakPerformanceData/peak_performance_data/src/app/api/ai-agent/route.ts
    let systemPrompt = getSystemPrompt(userName, locale, orgName, userRole)
    if (conversationCtx.summary) {
      systemPrompt += `\n\n## Previous Conversation Summary\n${conversationCtx.summary}\n`
    }
    const memoryBlock = formatMemoriesForPrompt(memories)
    if (memoryBlock) {
      systemPrompt += memoryBlock
    }
    const alertBlock = formatAlertsForPrompt(proactiveAlerts)
    if (alertBlock) {
      systemPrompt += alertBlock
    }
```

### Base prompt (`getSystemPrompt`)

Role switch (`systemPrompt.ts` L163–180):

| `userRole` | Prompt builder |
|------------|----------------|
| `athlete` / `player` | Athlete companion |
| `parent` | Parent assistant |
| `admin` / `club_admin` / `coach` / default | Coach prompt |

Injected context in every base prompt:

- **Current date** (`new Date().toISOString().split('T')[0]`)
- **Organization name** (from `organizations.name`)
- **User display name** (coach/athlete/parent label)
- **Locale** language guidance (PT/EN/ES/ZH)

Static capability lists differ by role (athletes CRUD vs personal data vs children-scoped). DeepSeek prompt-caching comment: static prefixes (`COACH_PREFIX` etc.) placed first.

### Augmentations (parallel fetch, route L149–160)

| Block | Source | Who |
|-------|--------|-----|
| Previous Conversation Summary | `ai_conversations.summary` via `loadConversationContext` | all |
| Remembered Context | `retrieveRelevantMemories` → `match_ai_memories` RPC or text fallback; formatted as `## Remembered Context` | all |
| Proactive Alerts | `evaluateCoachAlerts` (inactivity, PSE drop, stale injuries, unregistered tournaments, missing tests) | `admin` / `club_admin` / `coach` only |

### Important gap: DB recent messages not fed to the model

`loadConversationContext` returns `{ recentMessages, summary }`, but the route **only appends `summary`**. `recentMessages` is unused. The model’s chat history is solely the client-supplied `messages` array from `useChat` (browser state), not the DB window.

Org name fetch: `organizations` select by `organizationId` (route L99–105).

---

## 7. Conversation persistence lifecycle

### Tables

| Table | Operations | When |
|-------|------------|------|
| `ai_audit_logs` | insert | (1) fire-and-forget `conversation_started` after auth (L92–97); (2) `rate_limited` before 429; (3) post-stream `conversation_ended` (+ per-tool `tool_executed` if telemetry had tool calls — currently `toolCalls` array is never populated in this route); (4) catch-block `error` with `userId: 'unknown'` |
| `ai_conversations` | select / upsert update or insert | After stream: `result.usage.then(...)` → `saveConversationMessages` |
| `ai_memories` | select/update `last_accessed_at`; insert on extract | Retrieve before stream; extract/store after stream in same `usage` then |

### Post-stream deferred work (route L224–261)

Tied to `result.usage` promise resolving after the client consumes the stream:

1. `logStreamComplete` → `conversation_ended` audit row with token counts / duration / provider.
2. `saveConversationMessages` — last ≤4 user/assistant messages from the **request** `messages` (not the newly streamed assistant text!). Upsert by `session_id`; if count > 16, compress older into summary via Groq (or text fallback), keep last 10.
3. `extractAndStoreMemories` — regex heuristics on user message (preference / correction / fact); stores into `ai_memories` with embeddings when OpenAI key present.

**Implication:** persistence of the *assistant reply for the current turn* is incomplete — `newMessages` is sliced from the inbound client history, so the just-generated assistant content is typically **not** what gets saved unless the client already had it (it doesn’t for the current turn). Memory extraction similarly pairs last user + last assistant **already in the request**, not the new stream. This is a lifecycle bug/limitation for any Python migration that must “do it right.”

### Rate limit increment

`incrementRateLimit(userId)` runs when streaming starts successfully (L221–222), **before** stream completion — failed streams after start still consume quota.

---

## 8. Error handling, timeouts, user-visible failures

| Layer | Behavior |
|-------|----------|
| Validation / auth | JSON errors 400/401/403/404/429 as above |
| Soft timeout | Abort at 27s → aborted `streamText` → likely caught → 500 JSON **if** abort happens before `toDataStreamResponse` returns; mid-stream abort behavior depends on AI SDK |
| Hard timeout | Platform kill at `maxDuration = 30` |
| DeepSeek failure | Log + Groq fallback (pre-stream throw only) |
| Retry | Up to 2 retries, 500ms initial backoff, ×2, max 10s delay |
| Outer catch | `console.error`; best-effort audit `error`; `{ error: message }` status 500 |
| Audit failure | Swallowed (`catch (() => {})` / try/catch inside `logAIAction`) |
| Client | `useChat.onError` logs; UI shows `error.message` |

No structured stream-level `3:"..."` error injection is customized (`toDataStreamResponse()` called with no options).

---

## 9. Rate limiting & abuse protection

**Present, but weak for multi-instance Edge.**

`src/lib/ai/utils/rateLimit.ts`:

- In-memory `Map` keyed `ai-agent:${userId}`
- **50 requests / 60 minutes** (aligned with `AI_CONFIG.rateLimit`)
- Check before work; increment on successful `streamText` return
- Comment admits upgrade path to Vercel KV; store resets on deploy / per isolate
- No IP limiting, no body-size limit, no CAPTCHA, no cost-based throttling
- `cleanupExpiredEntries` exists but is never scheduled from the route

Auth (session cookie) is the primary abuse gate; rate limit is a soft secondary.

---

## 10. What breaks if the brain moves to Python

Anything that today lives **inside this Edge handler** must be re-homed or the Next route must keep doing it:

1. **Streaming contract** — Python (or the thin proxy) must emit AI SDK Data Stream Protocol v1 (`X-Vercel-AI-Data-Stream: v1`, `0:`/`9:`/`a:`/`d:`/`e:`/`f:` lines) or the `@ai-sdk/react` `useChat` client breaks.
2. **Tool loop** — `maxSteps: 6` + tool `execute` currently runs in Next with the user’s Supabase cookie client. Moving the brain alone without tool execution means either:
   - Python implements tools + data access, or
   - Next stays as tool executor (proxy pattern: stream from Python but execute tools locally), or
   - Client-side tools (not current architecture).
3. **Identity** — Must continue deriving `userId` / `organizationId` / `role` from session/profile server-side; do not start trusting body fields the client still sends.
4. **Intent + tool partitioning** — ~96 coach tools cannot all be bound every turn; port `classifyIntent` / `buildToolSet` or an equivalent.
5. **System prompt assembly** — role prompts, org name, memories, coach alerts, conversation summary.
6. **Persistence side effects** — `ai_conversations` / `ai_memories` / `ai_audit_logs` lifecycle; currently hooked to `result.usage` after stream consume.
7. **Env / keys** — `DEEPSEEK_API_KEY`, `GROQ_API_KEY`, optional `OPENAI_API_KEY`; specialist tools already need `PPP_AI_AGENT_URL` + `INTERNAL_SERVICE_SECRET`.
8. **Edge constraints** — current design optimizes cold start via dynamic imports of `ai` + tools; a Node proxy or pure Python path changes latency/deploy topology.
9. **In-memory rate limit** — does not survive a move unless reimplemented (Redis/KV) shared across instances.
10. **Coach scoping** — `coach_player_assignments` must remain enforced for athlete tools.
11. **Client maxSteps** — client `useChat({ maxSteps: 6 })` expects multi-step tool UI messages; stream must include tool_call / tool_result parts.
12. **Existing specialist proxy** — `specialistTools.ts` already calls Python for labs/genetics/CGM/tennis; consolidating the brain means avoiding double-hop or duplicate auth models.

### What can stay as a thin Next proxy

- Cookie session auth + profile lookup
- Forward authenticated context (server-derived IDs) to Python over internal auth
- Pass-through / reshape stream to Data Stream Protocol if Python uses a different native stream
- Optionally keep tool execution local while Python only plans / calls tools via a callback protocol

---

## 11. End-to-end request lifecycle (summary diagram)

```
Client useChat POST /api/ai-agent
  body: { messages, locale, sessionId, userId?, organizationId?, userRole? }
        └─ only messages/locale/sessionId used
    → Edge runtime
    → createRouteClient (cookies) → getSession → profiles → organizations
    → checkRateLimit (in-memory)
    → audit conversation_started (async)
    → dynamic import ai + tools
    → classifyIntent → buildToolSet (role + categories + coach scope)
    → parallel: conversation summary, memories, coach alerts
    → assemble systemPrompt
    → AbortController 27s
    → withRetry: streamText(DeepSeek) catch→ streamText(Groq)
    → incrementRateLimit
    → defer on result.usage: audit end + save conversation + extract memories
    → toDataStreamResponse() + rate limit headers
    → client parses Data Stream v1
```

---

## 12. Definitive answers (checklist)

| Question | Answer |
|----------|--------|
| Edge vs Node? | **`export const runtime = 'edge'`** |
| maxDuration? | **30** |
| Streaming? | **`ai@4.3.19` `streamText` → `toDataStreamResponse()`**, Data Stream **v1** |
| Body identity bug? | **Refuted for server.** `userId`/`organizationId`/`role` from session + `profiles`. Client still sends unused body fields. |
| Primary / fallback models? | DeepSeek `deepseek-chat` → Groq `llama-3.3-70b-versatile` |
| maxTokens / maxSteps / temperature? | **1500 / 6 / unset** |
| Tool filtering? | **Yes** — intent keywords + role builders; coach max ~96, not all every turn |
| Tables written? | `ai_audit_logs`, `ai_conversations`, `ai_memories` |
| Rate limit? | **50/hour/user**, in-memory only |

---

*End of dossier 13.*
