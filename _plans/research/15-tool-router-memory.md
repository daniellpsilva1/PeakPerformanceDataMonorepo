# 15 — Tool Router & Memory Subsystem Dossier

**Scope:** Production AI assistant in `PeakPerformanceData/peak_performance_data` — how tools are selected and how long-term memory is stored/retrieved.  
**Status:** Read-only research. No application code was modified.  
**Date:** 2026-08-02

**Primary sources (read in full):**
- `PeakPerformanceData/peak_performance_data/src/lib/ai/utils/toolRouter.ts` (392 lines)
- `PeakPerformanceData/peak_performance_data/src/lib/ai/utils/semanticMemory.ts` (241 lines)
- `PeakPerformanceData/peak_performance_data/src/lib/ai/tools/athleteMemoryTools.ts` (172 lines)
- `PeakPerformanceData/peak_performance_data/src/lib/ai/utils/conversationMemory.ts` (170 lines)
- Remaining utils: `rateLimit.ts`, `retry.ts`, `alertEvaluator.ts`, `auditLog.ts` (supporting; not memory/router core)
- `PeakPerformanceData/peak_performance_data/src/app/api/ai-agent/route.ts` (live request path)
- Migrations:
  - `supabase/migrations/20260311_ai_telemetry_and_memory.sql`
  - `supabase/migrations/20260331_add_athlete_id_to_ai_memories.sql`

**Supporting sources:**
- `src/lib/ai/tools/index.ts` (tool barrel exports)
- `src/lib/ai/agentConfig.ts` (chat models: DeepSeek / Groq — **not** embeddings)
- `src/lib/supabase/database.types.ts` (`ai_memories`, `match_ai_memories`)
- Grep across `src/` and `supabase/migrations/` for `ai_memories`, `embedding`, `pgvector`, `match_memories`, `extractAndStoreMemories`, `OPENAI_API_KEY`

---

## Verdict (TL;DR)

| Question | Answer |
|---|---|
| How does the tool router work? | **Keyword substring match** on the last user message (`String.includes`). No regex classifier, no embeddings, no LLM. Always includes `core`; on miss, also loads `athletes` + `training`. |
| Is memory **write** wired in the live path? | **Yes — called**, but **functionally broken on first turn** and uses **stale assistant text** on later turns. Explicit coach tool `rememberAboutAthlete` is a second, working write path. |
| Do embeddings work? | **Only if `OPENAI_API_KEY` is set** in the Edge runtime. Chat uses `DEEPSEEK_API_KEY` / `GROQ_API_KEY`. Missing/failing OpenAI key → silent `null` → ILIKE text fallback. Writes still insert rows with `embedding: null`. |
| Memory typing | Flat `ai_memories` table with `memory_type ∈ {preference, fact, workflow, correction, summary}`. **Not** episodic/semantic/procedural. |
| Scoping | Primarily **per coach user_id + organization_id**. Optional `athlete_id` for tool-written athlete notes. Retrieval RPC does **not** filter by athlete. |
| Dedup / decay / contradiction / compaction | **Absent** in app logic. SQL `cleanup_old_ai_data` exists but is **never called** from `src/`. |

---

## 1. Tool router — algorithm in detail

### 1.1 Confirmed mechanism: keyword lists + substring match

**Confirmed:** Prior notes calling this a keyword-based intent router are correct. It is **not** regex-based classification, **not** embedding similarity, and **not** an LLM classifier.

Core logic (`toolRouter.ts` L131–149):

```131:149:PeakPerformanceData/peak_performance_data/src/lib/ai/utils/toolRouter.ts
export function classifyIntent(lastUserMessage: string): Set<ToolCategory> {
  const categories = new Set<ToolCategory>(['core'])
  const lower = lastUserMessage.toLowerCase()

  for (const [keyword, cats] of Object.entries(INTENT_CATEGORY_MAP)) {
    if (lower.includes(keyword)) {
      for (const c of cats) {
        categories.add(c)
      }
    }
  }

  // If no specific intent detected, load the most common categories
  if (categories.size <= 1) {
    categories.add('athletes')
    categories.add('training')
  }

  return categories
}
```

`INTENT_CATEGORY_MAP` (L24–125) is a flat `Record<string, ToolCategory[]>` of English keywords/phrases → one or more of:

`admin | analytics | athletes | communication | competition | core | specialized_training | training`

Examples:
- `'training'` → `['training', 'core']`
- `'remember'` / `'memory'` / `'forget'` → `['athletes', 'core']`
- `'serve'` / `'match'` → `['analytics', 'core']`
- Multi-word keys work only as literal substrings (`'sign up'`, `'heart rate'`, `'break point'`)

### 1.2 Live wiring

In `src/app/api/ai-agent/route.ts`:

```115:138:PeakPerformanceData/peak_performance_data/src/app/api/ai-agent/route.ts
    const lastUserMsg = messages[messages.length - 1]?.content || ''
    const categories = classifyIntent(lastUserMsg)
    // ...
    const aiTools = buildToolSet(
      tools as any,
      categories,
      organizationId,
      supabase as any,
      userId,
      userRole,
      assignedPlayerIds,
    )
```

`buildToolSet` (L157–305) then **materializes only the tool factories** for selected categories. It does not return a ranked shortlist of N tools for the LLM to pick among — it returns a **category-partitioned tool object**. The LLM (`streamText` with `maxSteps: 6`) still chooses which tool(s) to call among those loaded.

### 1.3 How many tools are selected?

| Role | Behavior | Approx. tool count |
|---|---|---|
| **Parent** | Ignores categories; always returns fixed set | **6** (`buildParentToolSet` L384–391) |
| **Athlete / player** | Builds personal tools, but nearly every branch is `categories.has(X) \|\| categories.has('core')` and `core` is always present → **classifier is effectively a no-op** | ~20+ always |
| **Coach / admin / club_admin** | Core always (3 tools: `confirmAction`, `getAthletes`, `searchAthlete`) + category blocks | Variable |

Coach category block sizes (approximate counts from `buildToolSet`):

| Category | ~Tools added |
|---|---|
| core (always) | 3 |
| athletes | ~25 (incl. memory CRUD + groups) |
| training | ~19 |
| competition | 8 |
| analytics | 11 (incl. specialist proxies) |
| communication | 8 |
| specialized_training | 18 |
| admin | 5 |

**On miss** (no keyword hit): `categories = {core, athletes, training}` → roughly **3 + 25 + 19 ≈ 47 tools**, not a tiny fallback. The miss path is intentionally broad (“most common categories”), not fail-closed.

**On multi-hit:** Categories are a `Set` — union of all matched keyword mappings. A message like *"send training report"* can load `communication` + `training` + `core`.

### 1.4 Brittleness assessment

**Very brittle for multilingual / paraphrase.**

| Failure mode | Why |
|---|---|
| **Spanish / Catalan / Chinese** | Keywords are almost entirely English (`training`, `tournament`, `remember`, `injury`, …). Locales supported by the app UI will not match unless the user happens to use English terms or cognates that substring-match (e.g. Catalan *session* unlikely; Spanish *entrenamiento* ≠ `training`). |
| **Paraphrase** | `"How is João doing physically?"` may miss `analytics` / `athletes` keywords → falls into miss path (athletes+training), which is OK-ish, but `"Show me his blood work"` needs `blood`/`lab` — `"labs from last week"` works; `"analytical panel results"` may miss. |
| **False positives** | Substring match: `"message"` inside unrelated words; `"enter"` matches competition; `"who"` maps to athletes; `"plan"` always pulls training. |
| **Substring collisions** | `'gene'` matches inside `"general"`, `"generate"` already has its own key for training — overlapping intent noise. |
| **Athlete role** | Partitioning defeated by `\|\| categories.has('core')` in `buildAthleteToolSet` (L327–369). |
| **No stemming / locale** | Only `toLowerCase()`; no Unicode normalization beyond that. |

There is **no confidence score**, no secondary classifier, and no logging of category decisions in production (dev-only `console.log` at route L140–142).

---

## 2. Memory system end-to-end

### 2.1 Architecture overview

```
User message
    │
    ├─► retrieveRelevantMemories()  ──► generateEmbedding(query)
    │         │                              │
    │         │                         OPENAI text-embedding-3-small
    │         │                              │
    │         ├─ success ──► RPC match_ai_memories (pgvector cosine)
    │         └─ fail/empty ──► fallbackTextSearch (ILIKE on content)
    │
    └─► formatMemoriesForPrompt() ──► injected into system prompt

After stream (deferred on result.usage):
    extractAndStoreMemories() ──► regex on userMessage ──► storeMemory()
                                                          └─► generateEmbedding(content)
                                                          └─► INSERT ai_memories

Explicit tool path (coach, athletes category):
    rememberAboutAthlete / getAthleteMemories / forgetAthleteMemory
```

Separate from semantic memory: **conversation memory** (`conversationMemory.ts`) stores short-term chat in `ai_conversations` (JSON messages + rolling Groq summary). That is session context, not the `ai_memories` table.

### 2.2 What gets stored — table & columns

**Table:** `public.ai_memories`  
**Created in:** `supabase/migrations/20260311_ai_telemetry_and_memory.sql` L27–44  
**Extended in:** `20260331_add_athlete_id_to_ai_memories.sql`

| Column | Type | Notes |
|---|---|---|
| `id` | UUID PK | `gen_random_uuid()` |
| `user_id` | UUID → `auth.users` | **Owner** (typically the coach) |
| `organization_id` | UUID → `organizations` | Org scope |
| `athlete_id` | UUID → `profiles` | Added later; optional; used by athlete-memory tools |
| `memory_type` | VARCHAR CHECK | `'preference' \| 'fact' \| 'workflow' \| 'correction' \| 'summary'` |
| `content` | TEXT | Stored text |
| `embedding` | `vector(1536)` | Nullable; HNSW index `vector_cosine_ops` |
| `importance` | SMALLINT 1–10 | Default 5 |
| `source` | VARCHAR | Default `'conversation'`; tools use `'coach_note'` |
| `last_accessed_at` | timestamptz | Touched on vector retrieve |
| `created_at` / `updated_at` | timestamptz | |

**Types drift:** Generated `database.types.ts` `ai_memories.Row` (L239–251) does **not** include `athlete_id` — migration exists in repo, types not regenerated.

**pgvector:** `CREATE EXTENSION IF NOT EXISTS vector` + HNSW index (migration L23–55).

### 2.3 Embedding generation

```185:208:PeakPerformanceData/peak_performance_data/src/lib/ai/utils/semanticMemory.ts
async function generateEmbedding(text: string): Promise<number[] | null> {
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) return null

  try {
    const response = await fetch('https://api.openai.com/v1/embeddings', {
      body: JSON.stringify({
        input: text.slice(0, 8000),
        model: 'text-embedding-3-small',
      }),
      // ...
    })

    if (!response.ok) return null
    // ...
  } catch {
    return null
  }
}
```

| Aspect | Value |
|---|---|
| Provider | **OpenAI** (`https://api.openai.com/v1/embeddings`) |
| Model | **`text-embedding-3-small`** (1536 dims — matches column) |
| API key | **`process.env.OPENAI_API_KEY`** |
| Chat models | DeepSeek / Groq via `DEEPSEEK_API_KEY` / `GROQ_API_KEY` — **orthogonal** |
| Stale comment | L29 says “DeepSeek-compatible endpoint” — **incorrect**; code calls OpenAI |

Repo docs for the AI agent list `DEEPSEEK_API_KEY` and `GROQ_API_KEY` for Vercel; **`OPENAI_API_KEY` is not documented** in those setup checklists. No `.env*` files are committed. Conclusion from code: embeddings **work only when that separate key is present and valid in the Edge deployment**; otherwise they fail silently.

### 2.4 Retrieval

**Primary path — vector RPC** (`retrieveRelevantMemories` L17–64):

```36:42:PeakPerformanceData/peak_performance_data/src/lib/ai/utils/semanticMemory.ts
  const { data, error } = await supabase.rpc('match_ai_memories', {
    match_count: limit,
    match_org_id: organizationId,
    match_threshold: threshold,
    match_user_id: userId,
    query_embedding: embedding,
  })
```

SQL (`match_ai_memories`, migration L77–108):
- Similarity: `1 - (embedding <=> query_embedding)` (cosine distance → similarity)
- Filter: `user_id`, optional `organization_id`, `embedding IS NOT NULL`, similarity `> threshold`
- Order by distance, `LIMIT match_count`
- Marked **`SECURITY DEFINER`** — bypasses RLS; trust is placed in caller-supplied `match_user_id`

**Defaults:**

| Param | Default | Meaning |
|---|---|---|
| `limit` / `match_count` | **5** | top-k |
| `threshold` / `match_threshold` | **0.7** | min cosine similarity |
| Route call | uses defaults | `route.ts` L152–156 passes only `organizationId`, `query`, `userId` |

**Fallback — keyword ILIKE** (`fallbackTextSearch` L211–236):
- `.eq('user_id').eq('organization_id').ilike('content', `%${query.slice(0, 50)}%`)`
- Order by `importance` DESC, `limit`
- `similarity` forced to `0`
- Used when: no API key, OpenAI error, RPC error, or empty RPC result

**Prompt injection** (`formatMemoriesForPrompt` L169–176):

```
## Remembered Context
- [fact] ...
```

Wired at `route.ts` L152–170 (parallel with conversation context + alerts).

### 2.5 What content is auto-extracted?

`extractAndStoreMemories` (L101–164) runs **regex on the user message only** (plus Portuguese preference/correction variants):

| Type | Patterns (English / PT) | Importance |
|---|---|---|
| `preference` | `i always/prefer/like…`, `always use…`, `sempre uso/prefiro…` | 7 |
| `correction` | `no, i meant…`, `correction:`, `não, eu quis dizer…` | 8 |
| `fact` | `remember that/this`, `important:`, `lembrar que…` | 8 |

First match wins for preference/correction (`return` after store). Fact does not early-return after preference already returned. **No Spanish / Catalan / Chinese patterns.**

`workflow` and `summary` types exist in the CHECK constraint and Zod enum but are **never written** by auto-extract (only available via `rememberAboutAthlete` tool param).

### 2.6 Explicit athlete memory tools

`athleteMemoryTools.ts`:
1. **`rememberAboutAthlete`** — resolve player by `ilike` name in org → `storeMemory` with `athlete_id`, `source: 'coach_note'`
2. **`getAthleteMemories`** — list up to 20 rows filtered by `user_id` + `organization_id` + `athlete_id`
3. **`forgetAthleteMemory`** — delete by id with confirmation gate; scoped to `user_id` + `organization_id`

Loaded under the **`athletes`** category (and thus on miss path for coaches).

---

## 3. Is memory WRITE wired? — definitive answer

### Call sites of `extractAndStoreMemories`

| Location | Role |
|---|---|
| **Definition** | `semanticMemory.ts` L101 |
| **Import + call** | `src/app/api/ai-agent/route.ts` L10, L253–258 |
| **Other `src/` call sites** | **None** (grep confirmed) |

Prior notes claiming “exists but is never called” are **outdated / wrong**.

### Live path (wired)

```252:259:PeakPerformanceData/peak_performance_data/src/app/api/ai-agent/route.ts
        lastUserMessage && lastAssistantMessage
          ? extractAndStoreMemories(supabase as any, {
              assistantResponse: lastAssistantMessage.content,
              organizationId,
              userId,
              userMessage: lastUserMessage.content,
            })
          : Promise.resolve(),
```

Deferred inside `void result.usage.then(...).catch(() => {})` alongside telemetry and `saveConversationMessages`.

### Critical functional bugs (wired ≠ working)

1. **`messages` is the request body, not the newly streamed assistant reply.**  
   `newMessages = messages.filter(...).slice(-4)` (L227–229) never includes the response just generated.
2. **First turn:** only a user message → `lastAssistantMessage` is `undefined` → **`extractAndStoreMemories` is skipped entirely.** Preferences/facts said on turn 1 are not auto-stored.
3. **Later turns:** `lastAssistantMessage` is the **previous** assistant message from history, paired with the **current** user message — wrong pairing for correction logging; preference/fact extraction still keys only off `userMessage`, but they still require a prior assistant message to exist in the payload.

### Working write path

- **`rememberAboutAthlete` tool** → `storeMemory` — works when the LLM invokes it (requires athletes tools loaded + model cooperation).
- Auto path can still write on turn ≥2 when regex matches, despite stale assistant text.

**Definitive statement:** Memory writing **is wired** into the live AI agent POST handler. Automatic extraction is **partially broken** by using request history instead of the new completion. Explicit tool writes are the reliable path.

---

## 4. Do embeddings currently work? — failure path

```
generateEmbedding(text)
  ├─ !process.env.OPENAI_API_KEY  → return null          // silent
  ├─ fetch OpenAI embeddings
  │    ├─ !response.ok            → return null          // silent (no log)
  │    └─ json.data[0].embedding  → number[] | null
  └─ catch                        → return null          // silent
```

**Read path on null:** `fallbackTextSearch` (ILIKE).  
**Write path on null:** `storeMemory` still inserts with `embedding: null` (L85–94). Those rows are **invisible to `match_ai_memories`** (`AND m.embedding IS NOT NULL`) and only recoverable via ILIKE fallback or direct tool list queries.

**Incompatibility note:** Dimensions are consistent (`text-embedding-3-small` → 1536 ↔ `vector(1536)`). Failure mode is **missing/invalid key or network**, not dimension mismatch.

**Assessment:** Without a provisioned `OPENAI_API_KEY` on the Edge function, **vector memory is inert**; the system degrades quietly to brittle substring search. Chat can still work via DeepSeek/Groq alone.

---

## 5. Memory typing — episodic / semantic / procedural?

**Absent as a cognitive taxonomy.**

What exists is a **single flat table** with a coarse `memory_type` enum:

| Enum value | Used as |
|---|---|
| `preference` | Auto-extract + tool |
| `fact` | Auto-extract + tool (default) |
| `correction` | Auto-extract + tool |
| `workflow` | Tool enum only; no auto writer |
| `summary` | Tool enum only; no auto writer |

There is **no** distinction among:
- episodic (events that happened),
- semantic (stable athlete facts),
- procedural (coach workflow preferences),

beyond the loose labels above. Coach preferences and athlete facts share the same table and retrieval path.

---

## 6. Memory scoping & cross-tenant risk

### Intended scope

| Dimension | Auto-extract / vector retrieve | Athlete tools |
|---|---|---|
| User | `user_id` = session user (coach) | Same |
| Org | `organization_id` | Same |
| Athlete | **Not set** (`athlete_id` null); retrieve **does not filter** athlete | Set on write; list/delete filter by athlete |

Memories are **per coach user**, not shared across coaches in the same org. Athlete-tagged notes written by Coach A are not visible to Coach B (different `user_id`). Vector retrieve for Coach A can surface notes about any of their athletes interleaved — **no current-athlete filter** in `retrieveRelevantMemories`.

### Leakage / policy risks

1. **RLS INSERT `WITH CHECK (true)`** and **UPDATE `USING (true)`** (migration L64–70) — any DB role that can hit the table can insert/update arbitrary rows. SELECT/DELETE are `auth.uid() = user_id`.
2. **`match_ai_memories` is `SECURITY DEFINER`** and does **not** assert `auth.uid() = match_user_id`. If exposed to clients, a caller could pass another user’s UUID. App path currently passes session `userId`.
3. **Org filter is optional** in the RPC (`match_org_id IS NULL OR …`). App always passes org id.
4. Types/plans previously flagged these holes (`b2c_consumer_transformation` plan; improvements plan).

Cross-tenant **read** via the app path is unlikely if RLS + correct `userId` hold. Cross-tenant **write** via loose INSERT policy is a real schema risk.

---

## 7. Deduplication, decay, contradiction, compaction

| Capability | Present? | Evidence |
|---|---|---|
| Deduplication | **No** | `storeMemory` always inserts; no content hash / similarity check |
| Contradiction resolution | **No** | Corrections stored as new rows; old facts remain |
| Compaction / merging | **No** for `ai_memories` | Conversation rolling summary is separate (`conversationMemory.ts`) |
| Decay / pruning | **SQL only, unwired** | `cleanup_old_ai_data` deletes memories with `importance <= 2` AND `last_accessed_at` older than N days (default 90). **No caller in `src/`** |
| Access touch | **Partial** | Vector hits update `last_accessed_at` (fire-and-forget); ILIKE fallback does not |

---

## 8. Files inventory (`src/lib/ai/utils/`)

| File | Role vs this dossier |
|---|---|
| `toolRouter.ts` | Intent → categories → tool object |
| `semanticMemory.ts` | Long-term `ai_memories` R/W + embeddings |
| `conversationMemory.ts` | Short-term `ai_conversations` + Groq summary |
| `alertEvaluator.ts` | Proactive coach alerts into prompt (not memory) |
| `auditLog.ts` | Telemetry |
| `rateLimit.ts` | In-memory 50 req/hour |
| `retry.ts` | LLM call retries |

---

## 9. Implications for the Python multi-agent rebuild

1. **Do not port the keyword router as-is** for a multilingual product — replace with embedding/LLM routing or locale-aware intents.
2. **Memory write must attach the actual assistant completion**, not request history; first-turn auto-extract must not require a prior assistant message.
3. **Embeddings need an explicit, provisioned provider** (OpenAI or equivalent) with the same 1536-dim contract, or switch model + migrate vectors.
4. **Introduce real typing/scoping:** athlete vs coach-preference vs org; separate episodic events from durable facts; filter retrieve by active athlete.
5. **Close RLS / SECURITY DEFINER holes** before relying on memory for multi-tenant B2C.
6. **Add dedup + contradiction policy**; wire or replace `cleanup_old_ai_data` with a scheduled job.

---

## Appendix A — Exact defaults cheat sheet

| Setting | Value | File:line |
|---|---|---|
| top-k | 5 | `semanticMemory.ts:27` |
| similarity threshold | 0.7 | `semanticMemory.ts:27` / SQL default |
| embedding model | `text-embedding-3-small` | `semanticMemory.ts:193` |
| embedding key | `OPENAI_API_KEY` | `semanticMemory.ts:186` |
| embedding dims | 1536 | migration L36 |
| ILIKE query truncate | 50 chars | `semanticMemory.ts:223` |
| content truncate on store | 200–300 chars | extract patterns |
| conversation window | last 10 msgs | `conversationMemory.ts:13` |
| summary trigger | >16 messages | `conversationMemory.ts:14` |
