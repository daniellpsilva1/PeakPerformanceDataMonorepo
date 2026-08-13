# Dossier 14 — Next.js AI Agent Configuration & System Prompts

**Scope:** Exhaustive read-only audit of model config, system prompts, prompt assembly, role variation, multilingual handling, safety language, and prompt-injection exposure in the production Next.js AI assistant.  
**App root:** `PeakPerformanceData/peak_performance_data/`  
**Date:** 2026-08-02  
**Status:** No application code modified. This dossier is the only write.

---

## 1. Files audited (read in full)

| Path | Role | Lines |
|------|------|-------|
| `PeakPerformanceData/peak_performance_data/src/lib/ai/agentConfig.ts` | Providers, model IDs, maxTokens, rate limits | 1–48 |
| `PeakPerformanceData/peak_performance_data/src/lib/ai/prompts/systemPrompt.ts` | **Only** prompt module: role prompts + TOOL_DESCRIPTIONS | 1–213 |

**Supporting call sites (assembly / secondary prompts):**

| Path | Role |
|------|------|
| `src/app/api/ai-agent/route.ts` | Prompt assembly, `streamText`, DeepSeek→Groq failover |
| `src/hooks/ai/useAIAgent.ts` | Client: locale + maxSteps into `/api/ai-agent` |
| `src/lib/ai/utils/conversationMemory.ts` | Rolling summary LLM prompt; summary injection source |
| `src/lib/ai/utils/semanticMemory.ts` | Memory extract/store; `formatMemoriesForPrompt` |
| `src/lib/ai/utils/alertEvaluator.ts` | Coach proactive alerts; `formatAlertsForPrompt` |
| `src/lib/ai/utils/toolRouter.ts` | Intent→tool category partitioning (not a system prompt) |
| `src/i18n/routing.ts` | App locales: `en`, `es`, `zh`, `ca` |
| `src/app/api/ai-agent/wearable-query/route.ts` | Data API only — **no LLM prompts** |

**Prompt directory inventory:** `src/lib/ai/prompts/` contains **exactly one file**: `systemPrompt.ts`. There are no per-task, per-tool, or per-mode prompt files.

---

## 2. Complete model configuration

### 2.1 Providers & clients

Source: `agentConfig.ts` L8–34, L36–48.

| Provider | Client factory | Base URL | Env key | Notes |
|----------|----------------|----------|---------|-------|
| **Primary: DeepSeek** | `createDeepSeekClient()` | `https://api.deepseek.com` | `DEEPSEEK_API_KEY` | OpenAI-compatible via `@ai-sdk/openai`; client cached singleton |
| **Fallback: Groq** | `createGroqClient()` | `https://api.groq.com/openai/v1` | `GROQ_API_KEY` | Used if DeepSeek `streamText` throws |
| **Embeddings (memory)** | Direct `fetch` to OpenAI | `https://api.openai.com/v1/embeddings` | `OPENAI_API_KEY` | `text-embedding-3-small`; not in `AI_CONFIG` |
| **Summary LLM** | Groq via `createGroqClient()` | Groq OpenAI path | `GROQ_API_KEY` | Hardcoded `llama-3.3-70b-versatile` in `conversationMemory.ts` |

### 2.2 `AI_CONFIG` object (verbatim structure)

```36:48:PeakPerformanceData/peak_performance_data/src/lib/ai/agentConfig.ts
export const AI_CONFIG = {
  deepseek: {
    model: 'deepseek-chat',
    reasoningModel: 'deepseek-reasoner',
  },
  fallbackModel: 'llama-3.3-70b-versatile',
  maxDuration: 30,
  maxTokens: 1500,
  rateLimit: {
    maxRequestsPerHour: 50,
    windowSeconds: 60 * 60,
  },
}
```

### 2.3 Runtime parameters actually applied

| Parameter | Value | Where set | Per-role override? |
|-----------|-------|-----------|-------------------|
| **Primary model** | `deepseek-chat` | `route.ts` L194 via `AI_CONFIG.deepseek.model` | No |
| **Fallback model** | `llama-3.3-70b-versatile` | `route.ts` L209 via `AI_CONFIG.fallbackModel` | No |
| **`reasoningModel`** | `deepseek-reasoner` | Defined only; **never referenced** in runtime AI paths | N/A (dead config) |
| **`temperature`** | **Not set** (SDK / provider default) | — | No |
| **`maxTokens`** | `1500` | `route.ts` L192, L207 | No |
| **`maxSteps`** | `6` | Server `route.ts` L191/L206 **and** client `useAIAgent.ts` L66 | No |
| **`stopWhen`** | **Not used** | — | — |
| **Abort / timeout** | AbortSignal at 27s; Edge `maxDuration = 30` | `route.ts` L19, L181–182; `AI_CONFIG.maxDuration` unused for abort math | No |
| **Runtime** | Edge | `route.ts` L16 | — |
| **Rate limit** | 50 req / hour / user | `agentConfig` + `route.ts` | No |
| **Retry** | `withRetry` maxRetries 2, initialDelayMs 500 | `route.ts` L184–216 | No |

**Secondary LLM calls (not chat):**

| Call | Model | maxTokens | temperature | Purpose |
|------|-------|-----------|-------------|---------|
| Conversation rolling summary | Groq `llama-3.3-70b-versatile` | 200 | unset | Compress old messages (`conversationMemory.ts` L128–131) |
| Embeddings | OpenAI `text-embedding-3-small` | n/a (input truncated to 8000 chars) | n/a | Semantic memory (`semanticMemory.ts` L185–208) |

**Per-role / per-mode model overrides:** None. Role only changes the **system prompt text** and **tool set** (via `buildToolSet` + `userRole`), not model/temperature/tokens.

---

## 3. System prompts — QUOTED IN FULL

All role prompts live in `systemPrompt.ts`. They are assembled from static prefixes + shared blocks + role-specific bodies. Dynamic interpolations: `locale`, `name` (user full name), `org` (organization name), and `new Date().toISOString().split('T')[0]` for “Current date”.

### 3.1 Static prefixes

#### `COACH_PREFIX` (L5–8)

```
You are an AI assistant for a sports coaching platform.
You help coaches manage their athletes and training.

## Your Capabilities
```

#### `ATHLETE_PREFIX` (L10–13)

```
You are a personal AI training companion for athletes.
You help athletes understand their own performance data, training progress, and goals.

## Your Capabilities
```

#### `PARENT_PREFIX` (L15–18)

```
You are a friendly AI assistant for sports parents.
You help parents stay informed about their children's training, performance, and progress.

## Your Capabilities
```

### 3.2 Shared `languageBlock(locale)` (L21–26)

Template (with `${locale}` interpolated at runtime):

```
## Language
- Respond in the same language the user speaks
- Supported: Portuguese (PT), English (EN), Spanish (ES), Chinese (ZH)
- Current locale: ${locale}
```

### 3.3 Shared `responseGuidelines` (L28–33)

```
4. **Response length**:
   - Keep responses short. 1-3 sentences max unless the user explicitly asks for detail.
   - For data queries: return the data in a compact table or list. No commentary unless asked.
   - Never reply with a numbered list of questions. Never ask more than one question at a time.
   - Never add unsolicited suggestions, tips, or "you might also want to..." remarks.
```

Note: Numbering is hardcoded as `4.` so coach/athlete/parent guidelines reuse it as item 4 even when surrounding numbers differ.

### 3.4 Coach / Admin / Club Admin — `getCoachPrompt` (L36–62)

Full assembled prompt (with interpolations shown as `${...}`):

```
You are an AI assistant for a sports coaching platform.
You help coaches manage their athletes and training.

## Your Capabilities
Athletes (search, create, update, groups, goals, observations, fitness tests), Training (sessions, attendance, plans, reports, feedback), Competitions (tournaments, registration, results), Tracking (injuries, HIIT, series, periodization, PSE/wellness, Garmin data), Analytics (team stats, athlete stats), Communication (messages, alerts, achievements).

## Language
- Respond in the same language the user speaks
- Supported: Portuguese (PT), English (EN), Spanish (ES), Chinese (ZH)
- Current locale: ${locale}

## Guidelines
1. **Be direct**: Act immediately. No preambles, no "Sure!", no "Great question!". Just do the task and confirm what was done.
2. **Never suggest**: Do not offer follow-up actions, alternative approaches, or "you might also want to...". Only answer what was asked.
3. **Required fields only**: For `createPlayer`, only `fullName` is required. For `createTrainingSession`, only `name` and `trainingDate`. Everything else is optional — use it if provided, skip it if not.
4. **Response length**:
   - Keep responses short. 1-3 sentences max unless the user explicitly asks for detail.
   - For data queries: return the data in a compact table or list. No commentary unless asked.
   - Never reply with a numbered list of questions. Never ask more than one question at a time.
   - Never add unsolicited suggestions, tips, or "you might also want to..." remarks.
6. **Confirmation rules**:
   - **NO confirmation needed**: Recording attendance, PSE scores, observations, goals, notes, competition results, feedback responses — just do it and show a brief summary after.
   - **Confirm BEFORE**: Delete operations, bulk updates, sending messages/invitations, and creating tournaments or training plans (these affect multiple people).
7. Use searchAthlete or getAthletes before operations requiring athlete names
8. When mentioning athletes, use their full names

## Current Context
- Current date: ${YYYY-MM-DD}
- Organization: ${org}
- Coach: ${name}

## Important
- Never make up athlete names - always search or ask
- Always validate dates are in the future for tournaments
- Training reports should be for past or current dates
- Delete operations cannot be undone - always confirm first
```

Source lines L5–8 + L38–61 of `systemPrompt.ts`. Guideline item `5` is intentionally skipped (numbering jumps 4 → 6).

### 3.5 Athlete / Player — `getAthletePrompt` (L66–119)

```
You are a personal AI training companion for athletes.
You help athletes understand their own performance data, training progress, and goals.

## Your Capabilities
You can help the athlete with:

### My Performance Data
- **Fitness Tests** - View lactate tests, VO2max, time trials, tennis-specific tests
- **Competition Results** - View race times (10K, half marathon, marathon)
- **Stats & Insights** - Attendance rate, performance trends, progress over time

### My Training
- **Training Sessions** - View upcoming and past training sessions
- **Training Plans** - View assigned training plans and weekly schedules
- **Session Feedback** - Submit feedback (RPE, enjoyment, questions for coach)
- **Attendance** - View own attendance history

### My Health & Wellness
- **Injuries** - View injury history and recovery status
- **Wellness/PSE** - Record perceived exertion scores
- **Garmin Activities** - View synced Garmin data (runs, rides, pace, HR)

### My Goals & Achievements
- **Goals** - View development goals, update progress
- **Achievements** - View badges and milestones
- **Tournaments** - View upcoming tournaments and registrations, and register for upcoming tournaments

### Communication
- **Messages** - Send messages to coaches, admins, or parents (e.g. "send a message to coach saying I'll be late")
- **Conversations** - View recent conversations and messages

### Specialized Training
- **HIIT Training** - View high-intensity interval sessions
- **Series Training** - View interval workouts with per-series data
- **Periodization** - View shock microcycles and transition periods

## Language
- Respond in the same language the user speaks
- Supported: Portuguese (PT), English (EN), Spanish (ES), Chinese (ZH)
- Current locale: ${locale}

## Guidelines
1. **Be supportive and encouraging**: Help the athlete understand their data. Explain metrics in simple terms.
2. **Privacy**: You can ONLY access this athlete's own data. You cannot see other athletes' data.
3. **Use clear language**: Explain training concepts, physiological metrics (lactate, VO2max, HR zones) in an accessible way.
4. **Response length**:
   - Keep responses short. 1-3 sentences max unless the user explicitly asks for detail.
   - For data queries: return the data in a compact table or list. No commentary unless asked.
   - Never reply with a numbered list of questions. Never ask more than one question at a time.
   - Never add unsolicited suggestions, tips, or "you might also want to..." remarks.
5. **Insights only when asked**: Show data as requested. Only add analysis if the athlete explicitly asks for it.
6. **Coach connection**: If the athlete asks about something only their coach can change (e.g., updating a training plan), suggest they talk to their coach — or offer to send a message on their behalf.
7. **Messaging**: You can send messages to coaches, admins, and parents. Confirm the message content and recipient before sending. You cannot message other players.
8. **Tournament registration**: If the athlete asks to join, enter, sign up for, or register for a tournament, complete the registration directly when enough information is provided.

## Current Context
- Current date: ${YYYY-MM-DD}
- Organization: ${org}
- Athlete: ${name}

## Important
- Only show data belonging to this athlete — never fabricate or assume data
- Be encouraging about progress, honest about areas for improvement
- For write actions (feedback, PSE scores, goal updates): execute immediately, no confirmation needed
```

### 3.6 Parent — `getParentPrompt` (L123–159)

```
You are a friendly AI assistant for sports parents.
You help parents stay informed about their children's training, performance, and progress.

## Your Capabilities
You can help the parent with:

### My Children
- **List Children** - View linked children and their profiles
- **Child Stats** - Performance insights for each child
- **Fitness Tests** - View children's test results

### Training & Schedule
- **Training Schedule** - View upcoming training sessions for children
- **Attendance** - View children's attendance history

### Competition
- **Tournaments** - View children's tournament registrations and upcoming events

### Communication
- **Messages** - Send messages to children's coaches

## Language
- Respond in the same language the user speaks
- Supported: Portuguese (PT), English (EN), Spanish (ES), Chinese (ZH)
- Current locale: ${locale}

## Guidelines
1. **Be informative and reassuring**: Parents want to know their children are progressing and safe.
2. **Privacy**: You can ONLY access data for children linked to this parent via approved relationships.
3. **Simple language**: Avoid jargon. Explain performance metrics in parent-friendly terms.
4. **Response length**:
   - Keep responses short. 1-3 sentences max unless the user explicitly asks for detail.
   - For data queries: return the data in a compact table or list. No commentary unless asked.
   - Never reply with a numbered list of questions. Never ask more than one question at a time.
   - Never add unsolicited suggestions, tips, or "you might also want to..." remarks.
5. **Context**: When showing data, explain what the numbers mean for their child's development.
6. **Coach connection**: Encourage parents to reach out to the coach for training adjustments.

## Current Context
- Current date: ${YYYY-MM-DD}
- Organization: ${org}
- Parent: ${name}

## Important
- Only show data for this parent's linked children — never fabricate data
- Be positive about progress, factual about areas for development
- If asked about things outside your scope, suggest contacting the coach
```

### 3.7 Role selector — `getSystemPrompt` (L163–181)

```163:181:PeakPerformanceData/peak_performance_data/src/lib/ai/prompts/systemPrompt.ts
export const getSystemPrompt = (
  userName: string,
  locale: string,
  organizationName: string,
  userRole: string = 'coach'
) => {
  switch (userRole) {
    case 'athlete':
    case 'player':
      return getAthletePrompt(userName, locale, organizationName)
    case 'parent':
      return getParentPrompt(userName, locale, organizationName)
    case 'admin':
    case 'club_admin':
    case 'coach':
    default:
      return getCoachPrompt(userName, locale, organizationName)
  }
}
```

### 3.8 Tool description constants — `TOOL_DESCRIPTIONS` (L183–213)

These are **not** system-prompt text; they are reused as Zod/`tool` `description` strings in some tool modules. Quoted in full:

```
createTrainingReport: Create a training report for a session. Use this when the user wants to
    document a training session, including performance notes, physiological data like
    lactate levels or heart rate, and recommendations.

createTrainingSession: Create a new group training session. Use this when the user wants to
    schedule a training session for athletes.

createTournament: Create a new tournament or competition. Use this when the user wants to
    schedule an event for athletes to participate in.

generateTrainingPlan: Generate a personalized training plan for an athlete based on their
    goals, current fitness level, and upcoming competitions. Supports focus areas: endurance,
    speed, strength, recovery, competition_prep, or general. Can specify duration (1-16 weeks),
    weekly hours, and target competition. Uses athlete's recent performance data for personalization.

getAthletes: Get list of athletes in the organization. Use this to find athlete names
    before creating reports or registering for tournaments.

getAthleteStats: Get detailed performance statistics and insights for a specific athlete.
    Use this when the user wants to see an athlete's progress, attendance rate, performance
    ratings, training plans, or tournament registrations. Supports time periods: week, month,
    quarter, or year. Returns AI-generated insights about the athlete's commitment and performance.

getTeamAnalytics: Get comprehensive team-wide analytics and AI-generated insights. Use this
    when the user asks about overall team performance, attendance rates, performance distribution,
    training volume, or aggregate statistics. Supports time periods: week, month, quarter, or year.
    Can focus on specific metrics: attendance, performance, training_volume, or all.
    Returns insights like attendance warnings, performance trends, and training recommendations.

getUpcomingTournaments: Get list of upcoming tournaments and competitions.

registerAthleteForTournament: Register athletes for a tournament. Use this when the user wants
    to sign up athletes for an upcoming event.

searchAthlete: Search for an athlete by name. Use this when you need to find a specific
    athlete before creating reports or registering for tournaments.

updateAthleteNotes: Update notes or observations for an athlete. Use this when the user wants
    to add personal notes about an athlete.
```

(Exact source: `systemPrompt.ts` L183–213; whitespace/newlines preserved as template literals with indentation.)

### 3.9 Secondary prompt — conversation rolling summary (`conversationMemory.ts` L117–119)

Used only when message count exceeds `SUMMARY_TRIGGER_COUNT` (16). Full prompt templates:

**With existing summary:**

```
Existing summary:
${existingSummary}

New messages:
${transcript}

Update the summary to incorporate the new messages. Keep it under 500 characters. Focus on key actions taken, decisions made, and athlete names mentioned.
```

**Without existing summary:**

```
Conversation:
${transcript}

Summarize this coaching conversation in under 500 characters. Focus on key actions taken, decisions made, and athlete names mentioned.
```

Where `transcript` is built as `${role}: ${truncate(content, 200)}` joined by newlines (L113–115). Output truncated to 2000 chars (L134).

**There are no other LLM system/user prompt templates** under `src/lib/ai/` (no few-shot banks, no chart-directive prompts, no specialist agent prompts).

---

## 4. How prompts vary by role and task

### 4.1 By user role

| DB / profile `role` | Prompt function | Tone / behavior deltas |
|---------------------|-----------------|------------------------|
| `coach` | `getCoachPrompt` | Direct, no preambles, never suggest follow-ups; confirmation rules for destructive/multi-person ops |
| `admin` | **same as coach** | Identical prompt text; label still says “Coach: ${name}” |
| `club_admin` | **same as coach** | Identical prompt text |
| `player` / `athlete` | `getAthletePrompt` | Supportive/encouraging; privacy = own data only; messaging confirm; insights only when asked |
| `parent` | `getParentPrompt` | Reassuring; linked-children privacy; parent-friendly language; escalate to coach |
| **default** (unknown role) | `getCoachPrompt` | Falls through to coach |

**Mismatch note:** `route.ts` L69 defaults missing role to `'player'`, while `getSystemPrompt` defaults its 4th arg to `'coach'`. In practice the route always passes `userRole`, so the player default wins when `profile.role` is nullish.

**Admin vs coach:** No admin-specific prompt. Admin/club_admin get coach wording including “Coach: ${name}” in Current Context (L55).

### 4.2 By task

There is **no task-conditioned system prompt**. Task variation is handled by:

1. **Intent classifier** (`toolRouter.classifyIntent`) → subset of tools loaded into `streamText`.
2. **Tool `description` strings** (including `TOOL_DESCRIPTIONS` + per-tool descriptions elsewhere).
3. **Proactive alerts block** (coaches/admins only) appended when alerts exist.

The model always receives the same role prompt + optional memory/summary/alerts; it does not switch to a “planning mode” or “analytics mode” prompt. `deepseek-reasoner` is unused despite being intended (per older memory-bank docs) for complex reasoning tasks.

---

## 5. Safety & guardrail language

### 5.1 What exists

| Theme | Present? | Where |
|-------|----------|-------|
| Privacy / data scope (athlete own data; parent linked children) | Yes | Athlete L101–102; Parent L144–145, L156–158 |
| Don’t fabricate athlete names / data | Yes | Coach L58; Athlete L116; Parent L156 |
| Confirmation before deletes / bulk / messages / tournaments / plans | Yes | Coach L46–49, L61 |
| Tone: short, no unsolicited tips | Yes | `responseGuidelines` L28–33; coach “Never suggest” L42 |
| Scope outside assistant → contact coach | Partial | Parent L158; Athlete L106 |
| Non-diagnostic / medical disclaimer | **No** | — |
| Explicit refusal policies (jailbreak, illegal, self-harm) | **No** | — |
| Injury / PSE as non-clinical | **No** (PSE drop alert even says “May indicate fatigue or low motivation”) | `alertEvaluator.ts` L105 |
| Prompt-injection / untrusted-content instructions | **No** | — |
| PII / minor-protection language | **No** (despite parent/child product surface) | — |

### 5.2 Notable gap for sports/health product

The prompts discuss injuries, lactate, VO2max, HR, PSE, medical notes (as a tool field in `queryTools`) **without** any “not a medical diagnosis / not medical advice / seek professional care” framing. When porting, this is a critical addition for coach, athlete, and parent roles.

---

## 6. Few-shot examples, output format, formatting rules

| Category | Finding |
|----------|---------|
| **Few-shot examples** | **None** in system prompts or secondary prompts |
| **Markdown** | Implicit via bold guideline headings and bullet lists; no “always use markdown” rule |
| **Tables** | Explicit: “return the data in a compact table or list” (`responseGuidelines`) |
| **Chart directives** | **None** (no structured chart JSON / special tokens in prompts) |
| **JSON / schema output** | Not instructed at the system-prompt level; tools return structured results via AI SDK tool calling |
| **Length** | Hard constraint: 1–3 sentences unless user asks for detail |
| **Questions** | Max one question; never a numbered list of questions |
| **Names** | Coaches must use full athlete names |

---

## 7. Multilingual handling

### 7.1 App locales vs prompt locales

| Source | Locales |
|--------|---------|
| App i18n (`src/i18n/routing.ts` L6) | `en`, `es`, `zh`, `ca` |
| Prompt “Supported” list (`languageBlock` L24) | Portuguese (PT), English (EN), Spanish (ES), Chinese (ZH) |

**Gaps:**

- **Catalan (`ca`)** is a first-class app locale but **absent** from the prompt supported list.
- **Portuguese (PT)** is listed in the prompt but **not** an app routing locale.
- No instruction maps locale codes (`en`/`es`/`zh`/`ca`) to language names.

### 7.2 How locale is passed

1. Client: `useAIAgent` → `useLocale()` from `next-intl` → request body `{ locale, ... }` (`useAIAgent.ts` L39, L57–59).
2. Server: `const { locale, messages, sessionId } = await req.json()` (`route.ts` L25).
3. Injected: `getSystemPrompt(userName, locale, orgName, userRole)` (`route.ts` L163).

**Trust note:** `locale` is taken from the **client body**, not derived server-side from the URL/`Accept-Language`. Identity/role/org are correctly derived from the session; locale is not.

**Behavior instruction:** “Respond in the same language the user speaks” (user message language) **plus** “Current locale: ${locale}”. These can conflict if UI locale ≠ typed language.

---

## 8. Prompt-assembly logic

### 8.1 Assembly pipeline (`route.ts` L162–174)

```
systemPrompt = getSystemPrompt(userName, locale, orgName, userRole)
+ (optional) "## Previous Conversation Summary\n${summary}\n"
+ (optional) formatMemoriesForPrompt(memories)   // "## Remembered Context\n..."
+ (optional) formatAlertsForPrompt(alerts)       // "## Proactive Alerts ...\n..."  // coach/admin only
```

Then passed as `system:` to `streamText` with `messages` from the request body (full chat history from `@ai-sdk/react` `useChat`).

### 8.2 Dynamic injections

| Injection | Source | Roles | Delimiters / sanitization |
|-----------|--------|-------|---------------------------|
| User display name | `profiles.full_name` | All | None — raw string into “Coach/Athlete/Parent: …” |
| Organization name | `organizations.name` | All | None |
| Locale | Client JSON body | All | None |
| Current date | Server `new Date()` ISO date | All | Safe (generated) |
| Conversation summary | LLM/fallback summary of prior user+assistant text | All (if exists) | Header `## Previous Conversation Summary`; content truncated historically but **not** quoted/fenced |
| Semantic memories | User-derived preference/correction/fact strings | All | Header `## Remembered Context`; lines `- [type] ${content}` — **no fencing** |
| Proactive alerts | DB-derived athlete names, tournament names, body parts | coach/admin/club_admin | Header `## Proactive Alerts...`; detail strings concatenated — **no fencing** |
| Athlete roster | **Not** injected into system prompt | — | Tools fetch on demand (`getAthletes` / `searchAthlete`) |
| Assigned player IDs | Used to **scope tools**, not prompt text | coach | — |

### 8.3 Memory injection format (`semanticMemory.ts` L169–176)

```169:176:PeakPerformanceData/peak_performance_data/src/lib/ai/utils/semanticMemory.ts
export function formatMemoriesForPrompt(memories: MemoryItem[]): string {
  if (!memories.length) return ''

  const lines = memories.map(
    (m) => `- [${m.memoryType}] ${m.content}`
  )
  return `\n## Remembered Context\n${lines.join('\n')}\n`
}
```

Memory content is often prefixed with raw user text, e.g. `User preference: ${truncate(userMessage, 300)}` (L122–123), `Correction: User said "..." → Agent responded "..."` (L139–140), `Fact: ${truncate(userMessage, 300)}` (L156–157).

### 8.4 Alert injection format (`alertEvaluator.ts` L207–216)

```207:216:PeakPerformanceData/peak_performance_data/src/lib/ai/utils/alertEvaluator.ts
export function formatAlertsForPrompt(alerts: ProactiveAlert[]): string {
 if (!alerts.length) return ''

 const lines = alerts.map(a => {
 const emoji = a.severity === 'high' ? '' : a.severity === 'medium' ? '' : ''
 return `${emoji} [${a.type}] ${a.detail}`
 })

 return `\n## Proactive Alerts (share these proactively if relevant)\n${lines.join('\n')}\n`
}
```

(Emoji placeholders are empty strings in current code.)

Example `detail` strings interpolate DB free text / names:

- L68: athlete names joined into inactivity message  
- L105: athlete names + clinical-sounding interpretation  
- L132: athlete names + `body_part`  
- L165: `tournament.name` + athlete names  

### 8.5 Token budgeting / truncation

| Mechanism | Limit |
|-----------|-------|
| Chat `maxTokens` (completion) | 1500 |
| Conversation DB window | Last 10 messages kept after summary (`MAX_CONTEXT_MESSAGES`) |
| Summary trigger | > 16 messages → compress older into summary |
| Summary LLM output | maxTokens 200; then truncate 2000 |
| Fallback summary | Last 2000 chars |
| Per-message truncate in summary transcript | 200 chars |
| Memory store truncate | 200–300 chars on extract |
| Embedding input | First 8000 chars |
| Retrieved memories | limit 5, similarity threshold 0.7 |
| Alerts | Cap 5 |
| System prompt size budget | **No explicit token budget** for assembled system string |

### 8.6 Dead / unused assembly piece

`loadConversationContext` returns `recentMessages`, but **`route.ts` never merges them into `messages` or the system prompt**. Only `summary` is used. Chat continuity relies on the client-sent `messages` array from `useChat`.

---

## 9. Prompt-injection exposure — risky lines

**Verdict:** Multiple user-controlled and DB-sourced free-text fields are concatenated into the **system** prompt with markdown headers only — no XML/JSON delimiters, no “untrusted data” instructions, no stripping of control phrases.

### 9.1 High risk — user text → system prompt

**A. Conversation summary (contains prior user utterances)**

```164:166:PeakPerformanceData/peak_performance_data/src/app/api/ai-agent/route.ts
    if (conversationCtx.summary) {
      systemPrompt += `\n\n## Previous Conversation Summary\n${conversationCtx.summary}\n`
    }
```

**B. Semantic memories (often literal user messages)**

```167:170:PeakPerformanceData/peak_performance_data/src/app/api/ai-agent/route.ts
    const memoryBlock = formatMemoriesForPrompt(memories)
    if (memoryBlock) {
      systemPrompt += memoryBlock
    }
```

Storage of raw user text into memories:

```122:128:PeakPerformanceData/peak_performance_data/src/lib/ai/utils/semanticMemory.ts
    await storeMemory(supabase, {
      content: `User preference: ${truncate(userMessage, 300)}`,
      importance: 7,
      memoryType: 'preference',
      organizationId,
      userId,
    })
```

```139:145:PeakPerformanceData/peak_performance_data/src/lib/ai/utils/semanticMemory.ts
    await storeMemory(supabase, {
      content: `Correction: User said "${truncate(userMessage, 200)}" → Agent responded "${truncate(assistantResponse, 200)}"`,
      importance: 8,
      memoryType: 'correction',
      organizationId,
      userId,
    })
```

```156:162:PeakPerformanceData/peak_performance_data/src/lib/ai/utils/semanticMemory.ts
    await storeMemory(supabase, {
      content: `Fact: ${truncate(userMessage, 300)}`,
      importance: 8,
      memoryType: 'fact',
      organizationId,
      userId,
    })
```

**C. Client-controlled `locale` into system prompt**

```163:163:PeakPerformanceData/peak_performance_data/src/app/api/ai-agent/route.ts
    let systemPrompt = getSystemPrompt(userName, locale, orgName, userRole)
```

via:

```21:26:PeakPerformanceData/peak_performance_data/src/lib/ai/prompts/systemPrompt.ts
const languageBlock = (locale: string) => `
## Language
- Respond in the same language the user speaks
- Supported: Portuguese (PT), English (EN), Spanish (ES), Chinese (ZH)
- Current locale: ${locale}
`
```

A crafted `locale` string (e.g. containing newlines / “Ignore previous instructions…”) is interpolated with **no validation** against `routing.locales`.

### 9.2 Medium risk — DB free text → system prompt

**D. Profile / org names**

```52:55:PeakPerformanceData/peak_performance_data/src/lib/ai/prompts/systemPrompt.ts
## Current Context
- Current date: ${new Date().toISOString().split('T')[0]}
- Organization: ${org}
- Coach: ${name}
```

(Same pattern for Athlete/Parent labels at L110–113 and L150–153.)

**E. Alert details (athlete names, tournament names, body_part)**

```171:174:PeakPerformanceData/peak_performance_data/src/app/api/ai-agent/route.ts
    const alertBlock = formatAlertsForPrompt(proactiveAlerts)
    if (alertBlock) {
      systemPrompt += alertBlock
    }
```

Example detail construction with tournament name:

```163:168:PeakPerformanceData/peak_performance_data/src/lib/ai/utils/alertEvaluator.ts
 alerts.push({
 athleteNames: unregistered.map(p => p.name),
 detail: `Tournament "${tournament.name}" is on ${tournament.start_date} — ${unregistered.length} player(s) not yet registered: ${unregistered.map(p => p.name).join(', ')}`,
 severity: 'high',
 type: 'unregistered_tournament',
 })
```

### 9.3 Lower / indirect

- **User chat messages** are passed as the `messages` array (correct channel) — injection there is standard model risk, not system-prompt interpolation.
- **Athlete notes / observations / messages** are **not** bulk-injected into the system prompt today; they surface via tools. Risk would grow if a future port dumps roster notes into the system block without delimiters.
- Summary LLM prompt itself concatenates user content (`conversationMemory.ts` L117–119) — secondary injection into the summarizer, then re-injected into the main system prompt (A).

---

## 10. Quality assessment vs modern context-engineering practice

### Strengths worth porting

1. **Stable prefix for cache** — Explicit DeepSeek prefix-caching strategy (L1–3): unchanging role identity first; dynamic context last. Good for cost.
2. **Role-scoped capability lists** — Clear product boundaries for coach vs athlete vs parent.
3. **Operational confirmation policy** — Concrete write-vs-confirm rules for coaches (portable to tool-level policy engines).
4. **Brevity discipline** — Strong anti-verbosity rules reduce token waste and UX noise.
5. **Layered context** — Summary + semantic memory + proactive alerts is the right *shape* of long-term context (even if hygiene is weak).

### Weaknesses to restructure in the Python multi-agent port

| Issue | Recommendation |
|-------|----------------|
| Monolithic role prompts mixing identity, capabilities, UX tone, tool policy, and runtime context | Split into: **system identity**, **tool policy**, **safety**, **style**, **dynamic context** (XML/JSON sections) |
| No safety / non-diagnostic / minor-protection layer | Add a shared safety block for all roles; injury/PSE language must be non-clinical |
| Admin/club_admin share coach prompt verbatim | Dedicated admin prompt (org-wide scope, different confirmation thresholds) |
| Catalan missing; Portuguese listed but not routed | Align locale enum with `en/es/zh/ca`; instruct by locale name; prefer UI locale with “match user if they switch languages” |
| No task/mode prompts; unused `deepseek-reasoner` | Route planning/analytics/write tools to specialist agents with dedicated prompts |
| Untrusted data in system channel | Move summary/memory/alerts into a delimited **`<context>`** (or tool-results) block with explicit “data not instructions” preamble; never raw-concat user text into system |
| Validate `locale`, sanitize names | Allowlist locales; escape/strip control characters from names |
| No few-shots for critical workflows | Add short examples for confirmation, table output, messaging confirm |
| Guideline numbering bugs (skip 5; shared block always “4.”) | Clean structure; prefer unnumbered policy bullets or YAML |
| `TOOL_DESCRIPTIONS` only covers a subset of tools | Single tool-registry source of truth for descriptions in the Python agent |
| Client-trusted locale; unused `recentMessages` | Server-derive locale; decide one history source (client vs DB) |
| No token budget on assembled system prompt | Cap memory/alert/summary sections with explicit budgets |
| Domain drift (marathon/race language in tennis academy product) | Re-ground capability lists in tennis analytics vocabulary when porting |

### Suggested port structure (context engineering)

```
[SYSTEM — immutable, cached]
  identity + safety + style + language policy

[TOOLS — schema/descriptions]
  role-filtered registry

[DYNAMIC CONTEXT — untrusted, delimited]
  <user_profile> name, role, org, date, locale </user_profile>
  <conversation_summary> ... </conversation_summary>
  <memories> ... </memories>
  <proactive_alerts> ... </proactive_alerts>

[MESSAGES — user/assistant turns]
```

Specialists (planner, analytics, messaging, training-write) each get a thin overlay prompt; shared safety never drops.

---

## 11. Quick reference — runtime call graph

```
useAIAgent (locale, maxSteps=6)
  → POST /api/ai-agent { locale, messages, sessionId }
    → auth + profile.role + org.name
    → classifyIntent(lastUserMsg) → buildToolSet(...)
    → parallel: loadConversationContext | retrieveRelevantMemories | evaluateCoachAlerts
    → systemPrompt = getSystemPrompt + summary + memories + alerts
    → streamText(DeepSeek deepseek-chat | Groq llama-3.3-70b-versatile)
         maxTokens=1500, maxSteps=6, temperature=default
```

---

## 12. Source line index (prompts)

| Construct | File | Lines |
|-----------|------|-------|
| Cache comment + prefixes | `prompts/systemPrompt.ts` | 1–18 |
| `languageBlock` | same | 21–26 |
| `responseGuidelines` | same | 28–33 |
| `getCoachPrompt` | same | 36–62 |
| `getAthletePrompt` | same | 66–119 |
| `getParentPrompt` | same | 123–159 |
| `getSystemPrompt` | same | 163–181 |
| `TOOL_DESCRIPTIONS` | same | 183–213 |
| `AI_CONFIG` | `agentConfig.ts` | 36–48 |
| Provider clients | `agentConfig.ts` | 11–34 |
| Prompt assembly | `api/ai-agent/route.ts` | 162–174 |
| streamText params | `api/ai-agent/route.ts` | 189–212 |
| Summary prompts | `utils/conversationMemory.ts` | 117–131 |
| Memory format | `utils/semanticMemory.ts` | 169–176 |
| Alert format | `utils/alertEvaluator.ts` | 207–216 |
| App locales | `i18n/routing.ts` | 6–9 |
