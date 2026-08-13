# 29 — UI Surfaces for Agent Output

**Status:** Read-only research dossier  
**Date:** 2026-08-02  
**App root:** `PeakPerformanceData/peak_performance_data`  
**Scope:** Inventory every product surface where multi-agent output can land (or is intended to), with wiring status, data shapes, and gaps. No code was modified except this file.

---

## Executive verdict

| Surface family | Status |
|----------------|--------|
| Chat (FAB + modal + streaming) | **Real / working** — primary agent UX today |
| Tool-result cards in chat | **Partial** — post-result only; no pending/"calling tool X" |
| Confirmation / mid-stream approval | **Scaffolded** — tool + dialog exist; dialog never mounted |
| Structured InsightCard / CoachInbox / PriorityPanel | **Missing** — no components; BFF proxies exist; DB migration unapplied |
| Feedback (thumbs / coach review UI) | **Missing UI** — BFF + schema designed; zero client callers |
| `user_alerts` bell dropdown | **Real but fragile** — live poll; shape mismatch + broken dismiss/view-all |
| Human messaging (agent as participant) | **Real channel** — agent can send *as the logged-in user*; no bot identity |
| Dashboard home cards | **Real product slots** — rule/metric driven; not agent insight feed |
| Chart / tennis "insights" | **Real, domain-local** — not the agentic `Insight` schema |
| Realtime push of new insights | **Missing** — messaging realtime only; alerts poll; no `insights` subscription |

---

## 1. Named insight components (search results)

Searched `src/components/` for `InsightCard`, `CoachInbox`, `InsightStrip`, `InsightsStrip`, `PriorityPanel`.

| Name | Result |
|------|--------|
| `InsightCard` | **Does not exist** |
| `CoachInbox` | **Does not exist** |
| `InsightStrip` | **Does not exist** |
| `PriorityPanel` | **Does not exist** |
| `InsightsStrip` | **Private helper** inside chart UI only (not agent) |

### 1.1 `InsightsStrip` (chart metadata chips — not agent)

**File:** `src/components/charts/GarminConnectGraphs/GraphContainerRecharts.tsx`

```672:716:PeakPerformanceData/peak_performance_data/src/components/charts/GarminConnectGraphs/GraphContainerRecharts.tsx
interface InsightChip {
  /** Optional accent colour for the dot / value */
  accent?: 'danger' | 'info' | 'muted' | 'success' | 'warning'
  label: string
  value: string
}
// ...
function InsightsStrip({ chips }: { chips: InsightChip[] }) {
```

- **Renders:** Up to 3 label/value chips (+ overflow popover) above wearable charts.
- **Data shape:** `{ label, value, accent? }` — computed from graph metadata locally.
- **Wiring:** Live chart data, **not** `/api/ai-agent/insights` or `insights` table.
- **Assessment:** Candidate visual pattern for evidence chips; **not** an agent surface.

### 1.2 Related non-agent "insight" UIs

| Component | Path | Role |
|-----------|------|------|
| `InsightBadge` | `src/components/charts/enhanced/InsightBadge.tsx` L44– | Chart anomaly/PR/streak badges (`ChartInsight`) |
| Tennis `InsightsTab` | `src/components/tennis-analytics/TennisAnalyticsInsightsTab.tsx` L382+ | Deterministic match-stat narratives + severity chips |
| Chart insight detector | `src/components/charts/enhanced/utils/insights-detector` (via index) | Client-side trend detection |

These consume tennis/wearable metrics, **not** the Pydantic `Insight` contract from `_plans/research/03-insight-schema.md`.

### 1.3 Intended agent insight contract (backend only)

From research `03-insight-schema.md` / migration `supabase/migrations/20260727_insight_store.sql`:

- **Shape:** `claim`, `category`, `confidence`, `evidence[]` (metric/source/value/trend), `actions[]`, `requires_coach_review`, `coach_review_status`, …
- **Tables:** `insights`, `feedback_events`, `coach_reviews`, `preference_memory` — migration present, **not applied live** (see `17-supabase-ai-schema.md`).
- **UI for this contract:** **none**.

---

## 2. Chat UI (primary agent surface)

### 2.1 Entry points (FAB + modal)

| Piece | Path | Lines | Notes |
|-------|------|-------|-------|
| Desktop FAB | `src/components/ai/VoiceAssistantButton.tsx` | L21–79 | Fixed bottom-right; gated by `NEXT_PUBLIC_ENABLE_AI_VOICE_ASSISTANT`; hidden on public + `/messages` |
| Mobile FAB | `src/components/navigation/BottomNav.tsx` | L140–164, L298–312 | Center `AIAssistantFAB` opens same modal |
| Shell mount | `src/components/layouts/AppShell.tsx` | ~L166 | `LazyVoiceAssistantButton` |
| Layout lazy | `src/components/layouts/LazyLayoutExtras.tsx` | L178–203 | Dynamic import |
| Modal shell | `src/components/ai/VoiceAssistantModal.tsx` | L53–289 | Message list, quick actions, voice + text input |
| Barrel | `src/components/ai/index.ts` | L1–10 | Exports all AI widgets |

**Renders:** Welcome + role-based copy, `QuickActions` chips, streaming message bubbles, generic "thinking…" dots while `isLoading`, error banner, voice transcript affordances.

**Live data:** Yes — streams from `POST /api/ai-agent` via `useAIAgent` → `useChat`.

### 2.2 Hook: `useAIAgent` / `useChat`

**File:** `src/hooks/ai/useAIAgent.ts`

| Concern | Detail | Lines |
|---------|--------|-------|
| SDK | `@ai-sdk/react` `useChat` | L4, L55–71 |
| API | `api: '/api/ai-agent'` | L57 |
| Body | `locale`, `organizationId`, `sessionId`, `userId`, `userRole` (identity also re-derived server-side) | L58–63 |
| Steps | `maxSteps: 6` | L66 |
| Throttle | `experimental_throttle: 100` | L64 |
| Message filter | Keeps user + assistant with content or `toolInvocations` | L85–91 |
| `stop` | Exposed from `useChat` but **not wired** in modal UI | L34, L54, L102 |

### 2.3 Message + tool rendering

**File:** `src/components/ai/MessageBubble.tsx`

| Behavior | Lines |
|----------|-------|
| User plain text / assistant lightweight markdown → `dangerouslySetInnerHTML` | L30–54, L84–91 |
| Tool cards only when `tool.state === 'result'` | L94–102 |
| **Pending tool invocations ignored** | L94–96 — no "calling tool X" UI |

**File:** `src/components/ai/ToolResultCard.tsx` L24–49

- **Shape expected:** `{ success?: boolean; message?: string; error?: string }` (cast from `unknown`).
- **Renders:** Green/red card with icon mapped for a small set of tool names (`getAthletes`, `createTrainingReport`, etc.); falls back to `FileText`.
- **Generative UI:** **No** — no dynamic components, charts, or structured Insight cards from tool output. Free-text assistant markdown + simple success/error cards only.

### 2.4 Confirmation dialog (scaffolded, unwired)

| Piece | Path | Status |
|-------|------|--------|
| UI | `src/components/ai/ConfirmationDialog.tsx` L42–94 | Exported; **never imported** by modal or FAB |
| Tool | `src/lib/ai/tools/confirmationTools.ts` L4–62 | `confirmAction` returns `{ requiresConfirmation: true, … }` |
| Router | `src/lib/ai/utils/toolRouter.ts` L184 | Tool registered |
| Client bridge | — | **Missing** — no `isConfirmationResult` handling in chat UI |

Mid-stream interrupt / human-in-the-loop approval for writes is therefore **prompt-level only**, not a product flow.

### 2.5 Ancillary chat widgets

| Widget | Path | Mounted? |
|--------|------|----------|
| `QuickActions` | `src/components/ai/QuickActions.tsx` L32–54 | Yes — empty-state chips (role-keyed i18n prompts) |
| `VoiceInputButton` | `src/components/ai/VoiceInputButton.tsx` | Yes — in modal |
| `MicrophonePermissionDialog` | `src/components/ai/MicrophonePermissionDialog.tsx` | Available |
| `OfflineBanner` | `src/components/ai/OfflineBanner.tsx` L9–39 | Exported; **not mounted** in modal |
| `UsageDashboard` | `src/components/ai/UsageDashboard.tsx` L21– | Fetches `/api/ai-agent/usage`; **no page mounts it** |

### 2.6 Chat BFF (streaming)

**File:** `src/app/api/ai-agent/route.ts`

- Edge runtime, `streamText`, DeepSeek → Groq fallback, dynamic tool set, memory + proactive coach alerts injected into system prompt (L149–174), `toDataStreamResponse()` (L263).
- Proactive alerts from `evaluateCoachAlerts` (`src/lib/ai/utils/alertEvaluator.ts`) are **prompt context**, not a separate UI card feed.

---

## 3. BFF routes under `src/app/api/ai-agent/`

| Route | Methods | Purpose | UI consumer? |
|-------|---------|---------|--------------|
| `/api/ai-agent` | `POST` | Main chat stream (`route.ts`) | **Yes** — `useAIAgent` |
| `/api/ai-agent/proxy` | `POST` | Auth BFF → `ppp_ai_agent` orchestrator | **No** client found |
| `/api/ai-agent/insights` | `GET` | Proxy list insights → Python | **No** |
| `/api/ai-agent/insights/[insightId]/review` | `POST` | Proxy coach review body → Python | **No** |
| `/api/ai-agent/feedback` | `POST` | Proxy feedback → Python | **No** |
| `/api/ai-agent/events` | `POST` | Event hook → `/events/hook` | Server/event producers only |
| `/api/ai-agent/labs` | `GET` | Lab panels proxy | **No** UI found |
| `/api/ai-agent/labs/trend` | `GET` | Biomarker trend | **No** UI found |
| `/api/ai-agent/genetics/upload` | `POST` | Genetic report upload + trigger parse | **No** UI found |
| `/api/ai-agent/wearable-query` | `POST` | Wearable metric query (Node) | Tool/backend path |
| `/api/ai-agent/usage` | `GET` | Usage stats from audit log | Only unused `UsageDashboard` |

Grep for `/api/ai-agent/insights` and `/api/ai-agent/feedback` under `src/` returned **zero** client calls.

### 3.1 Insights + feedback BFF contracts (wire only)

**List:** `src/app/api/ai-agent/insights/route.ts` L11–54 — session auth, injects `organization_id`, forwards query string to `${PPP_AI_AGENT_URL}/insights`.

**Review:** `…/insights/[insightId]/review/route.ts` L11–48 — forwards JSON body to `/insights/{id}/review`. Expected review actions (DB): `approve` \| `edit` \| `reject` (`coach_reviews.action` CHECK in migration L134).

**Feedback:** `…/feedback/route.ts` L11–56 — forwards body to `/feedback`. Schema CHECK: `thumbs_up` \| `thumbs_down` \| `edit` \| `flag` (`feedback_events` L95).

---

## 4. Feedback UI & coach approval queue

### 4.1 Thumbs up/down on chat or insights

| Layer | Status |
|-------|--------|
| DB `feedback_events` | Designed in `20260727_insight_store.sql` L87–99; **unapplied live** |
| BFF `POST /api/ai-agent/feedback` | Exists |
| Chat UI thumbs controls | **Absent** — `MessageBubble` has no rating controls |
| Writes from UI | **None** |

Product `user_feedback` / `FeedbackPageClient` / `AdminFeedbackClient` are **bug-report / product feedback**, not agent insight feedback (`17-supabase-ai-schema.md`).

### 4.2 Coach approve / edit / reject queue

| Layer | Status |
|-------|--------|
| DB `coach_reviews` + `insights.coach_review_status` | Migration only |
| BFF review proxy | Exists |
| `CoachInbox` / queue page / approve UI | **Does not exist** |
| Functional end-to-end | **No** |

**Verdict:** Coach approval queue is **schema + proxy scaffold**, not a functioning product surface.

---

## 5. Alerts system (`user_alerts`)

### 5.1 Data model (live)

`database.types.ts` L3488–3575 — `user_alerts` with `title`, `body`, `priority`, `read_at`, `dismissed_at`, `action_url`, `subject_athlete_id`, `trigger_data`, FK to `alert_definitions`.

### 5.2 Engine + APIs

| Piece | Path |
|-------|------|
| Engine | `src/services/alerts/AlertEngine.ts` — insert L349; list L452–473; mark read L476; dismiss L486 |
| List API | `GET /api/alerts` → `src/app/api/alerts/route.ts` L8–34 |
| Mark read | `POST /api/alerts/[id]/read` |
| Dismiss | `PUT /api/alerts/[id]/dismiss` |
| Evaluate | `…/alerts/evaluate/[athleteId]` |

### 5.3 UI components

| Component | Path | Expected `AlertData` (L10–18 `AlertCard.tsx`) |
|-----------|------|-----------------------------------------------|
| `AlertCard` | `…/dashboard/alerts/AlertCard.tsx` | `{ id, title, message, priority, type, created_at, read }` |
| `AlertsDropdown` | `…/AlertsDropdown.tsx` | Wired in `NavBar.tsx` L239–244 |
| `AlertsList` | `…/AlertsList.tsx` | **Exported but never mounted** on a page |

### 5.4 Wiring quality

**NavBar** (`src/components/ui/NavBar.tsx`):

- Polls `/api/alerts` every 60s when connection is fast (L96–108) — **not** Supabase realtime.
- Mark-read → `POST /api/alerts/${id}/read` (L118–122) — correct.
- Dismiss → `DELETE /api/alerts/${id}` (L125–128) — **wrong**: dismiss route is `PUT …/dismiss`; no `DELETE` handler under `[id]/`.
- View all → `router.push('/notifications')` (L243) — **no** `notifications` page under `src/app/[locale]/`.

**Shape mismatch:** API returns raw engine rows (`body`, `read_at`, …) while `AlertCard` reads `message`, `read`, `type`. Titles may show; body/unread styling likely wrong without a mapper.

### 5.5 Agent tools

`src/lib/ai/tools/alertTools.ts`:

- `getAlertsTool` L7–74 — reads `user_alerts` for coach.
- `dismissAlertTool` L76–127 — marks read / dismisses.

Agent can **read/dismiss** alerts in chat; it does **not** create structured agent Insights into the bell.

### 5.6 Other producers of `user_alerts`

- `AlertEngine` rule evaluation  
- Court plan publish (`src/app/api/court-plan/publish/route.ts` L256–278)  
- Gamification (`AchievementSystem.ts`)  
- Parent communications API also reads alerts (`…/parent/communications/route.ts`)

---

## 6. Messaging (agent as participant?)

### 6.1 Components

Under `src/components/messaging/`: `MessagingView`, `ConversationList`, `ConversationThread`, `MessageBubble`, `MessageInput`, `MessagesPageClient`, attachments, etc. — full human chat product.

### 6.2 Realtime

| Hook | Path | Behavior |
|------|------|----------|
| `useConversationRealtime` | `src/hooks/data/useConversationRealtime.ts` L94–214 | Supabase `postgres_changes` on `messages` INSERT/UPDATE for one conversation |
| `useConversationsRealtime` | same file L227–285 | Participant-row updates → unread badge |
| `useUnreadMessages` | `src/hooks/data/useUnreadMessages.ts` L28–103 | SWR `/api/messages/unread-count` + realtime; app badge |

### 6.3 Agent delivery path

`sendMessageTool` (`src/lib/ai/tools/messagingTools.ts` L12–46):

- Sends via `createConversationMessage` with **`senderId: userId`** (the coach/parent using the assistant).
- Creates normal `conversations` / `messages` rows → realtime + push fire as for any human message.
- Players cannot be DM recipients (tool description L21–23).

**Implication:** Agent can deliver content **into messaging**, but **as the human user**, not as a distinct agent/bot participant. No system sender, no insight-card message type, no structured payload in `MessageBubble`.

Parent tool `sendMessageToCoachTool` (`parentTools.ts` L395+) same pattern (`senderId: parentId`).

---

## 7. Dashboard home cards (proactive insight slots)

Directory: `src/components/dashboard/home/cards/`  
Shared types: `src/components/dashboard/home/types.ts`.

| Card | Path | Data | Agent-ready? |
|------|------|------|--------------|
| `GreetingCard` | `GreetingCard.tsx` | `NextAction` (court/session/tournament/idle) | Slot for CTA; not insight feed |
| `ReadinessCard` | `ReadinessCard.tsx` L64+ | `ReadinessSnapshot` (score, level, recommendation, HRV, sleep, battery) from init/PPC graphs | **Strong slot** — already shows narrative `recommendation` from rule calc (`readiness-snapshot.ts` / `getTrainingRecommendation`), not LLM |
| `AttentionListCard` | `AttentionListCard.tsx` L31+ | `AttentionAthlete[]` (score, reason, injury, readiness) | **Strong coach slot** for ranked agent claims |
| `FocusedAthletePanel` | `FocusedAthletePanel.tsx` L64+ | Per-athlete readiness + tennis + fitness | Container for focused insight |
| `RosterHero` / `RosterPulseStrip` | respective files | Org pulse counts | Aggregate KPI strip |
| `TennisHighlightCard` | `TennisHighlightCard.tsx` L49+ | Latest match via `/api/tennis/matches` | Match summary, not agent |
| `FitnessTestSnapshotCard` | file | Latest test deltas | Metric snapshot |
| `UpcomingTournamentCard` | file | Tournament schedule | Calendar |
| `ConnectWearableCard` | file | Connection CTA | Onboarding |
| `CoachCommunicationsTeaser` | `CoachCommunicationsTeaser.tsx` L30+ | Coach observations (last 30d) | Human observations, not agent |
| `PendingRequestsCard` | file | Member/coach request approve/reject | Org admin, not insight review |
| `TodayStripCard`, `Child*`, `AssignedCoachCard` | files | Role-specific logistics | Not insight |

**Assessment:** Home is a **rich composition of live product data**. Best candidate landing zones for proactive agent insights: `AttentionListCard`, `ReadinessCard` recommendation area, and a new card (e.g. InsightStrip / PriorityPanel) — **none currently fetch `/api/ai-agent/insights`**.

---

## 8. Streaming tool UX & generative UI

| Capability | Present? | Evidence |
|------------|----------|----------|
| Streamed assistant text | Yes | `useChat` + markdown bubble |
| "Thinking…" spinner | Yes | `VoiceAssistantModal.tsx` L227–236 |
| "Calling tool X…" pending state | **No** | `MessageBubble` skips `state !== 'result'` |
| Tool result generative UI | **Minimal** | `ToolResultCard` success/error only |
| Structured Insight render in chat | **No** | — |
| Citation / evidence chips | **No** (except chart `InsightsStrip` / tennis chips) | — |
| Confidence display | **No** | Schema field only |
| Streaming reasoning / chain-of-thought UI | **No** | — |
| Mid-stream interrupt / approval prompt | **Scaffold only** | `ConfirmationDialog` unwired; `stop()` unused in modal |
| Multi-step progress UI | **No** | `maxSteps: 6` server-side only |

---

## 9. Realtime for insights / alerts

| Channel | Mechanism | Can push new agent insight? |
|---------|-----------|------------------------------|
| Messages | Supabase realtime on `messages` / `conversation_participants` | Only if agent inserts a **message** (as user) |
| Alerts | SWR poll 60s in NavBar | Soft push; **no** `user_alerts` realtime subscription |
| Insights table | — | **No** subscription; table not live |
| Chat stream | SSE/data stream from `/api/ai-agent` | In-session only |

There is **no** Supabase realtime channel that pushes a new structured insight to a live dashboard client.

---

## 10. Gap list for a richer agent product

Missing relative to the Insight schema (`03-insight-schema.md`) and multi-agent goals:

1. **`InsightCard` / strip / priority panel** components bound to `Insight` JSON (`claim`, `evidence`, `confidence`, `actions`).
2. **Coach inbox / approval queue** UI calling `POST …/insights/:id/review` (`approve`/`edit`/`reject`).
3. **Thumbs feedback** on chat turns and insight cards → `POST …/feedback`.
4. **Wire ConfirmationDialog** (or AI SDK human-in-the-loop) for write tools; expose **Stop**.
5. **Pending tool-call UX** ("Looking up athletes…") and richer generative UI for tool payloads.
6. **Citation / evidence chips + confidence** rendering (reuse chart `InsightsStrip` pattern).
7. **Streaming reasoning / multi-step progress** (optional).
8. **Apply** `20260727_insight_store.sql` and subscribe or poll insights for home surfaces.
9. **Realtime or push** when nightly/event agents insert insights (or map high-priority insights into `user_alerts` with correct AlertData mapping).
10. Fix alerts UI: map `body`→`message`, `read_at`→`read`; fix dismiss URL; ship notifications page or remove View all; optionally mount `AlertsList`.
11. Optional: **bot participant** identity in messaging if agent DMs should not appear as the coach.

---

## 11. Surface map (quick reference)

```
┌─────────────────────────────────────────────────────────────────┐
│ PRODUCT SURFACES                                                │
├──────────────────┬──────────────┬───────────────────────────────┤
│ Chat FAB/Modal   │ LIVE         │ Only full agent I/O today     │
│ ToolResultCard   │ PARTIAL      │ Post-hoc success/error        │
│ ConfirmationDlg  │ DEAD CODE    │ Tool exists, UI unused        │
│ InsightCard etc. │ MISSING      │ Schema + BFF only             │
│ Coach review UI  │ MISSING      │ coach_reviews designed        │
│ Feedback thumbs  │ MISSING      │ feedback_events designed      │
│ Alerts bell      │ LIVE/FRAGILE │ user_alerts poll              │
│ Messaging        │ LIVE         │ Agent sends as human user     │
│ Home cards       │ LIVE SLOTS   │ Metrics/rules, not LLM        │
│ Chart/tennis     │ LIVE LOCAL   │ Non-agent "insights"          │
│ UsageDashboard   │ ORPHAN       │ Component unused              │
└──────────────────┴──────────────┴───────────────────────────────┘
```

---

## File index (absolute)

- `/Users/danielsilva/Desktop/PeakPerformanceDataMonorepo/PeakPerformanceData/peak_performance_data/src/hooks/ai/useAIAgent.ts`
- `/Users/danielsilva/Desktop/PeakPerformanceDataMonorepo/PeakPerformanceData/peak_performance_data/src/components/ai/VoiceAssistantModal.tsx`
- `/Users/danielsilva/Desktop/PeakPerformanceDataMonorepo/PeakPerformanceData/peak_performance_data/src/components/ai/VoiceAssistantButton.tsx`
- `/Users/danielsilva/Desktop/PeakPerformanceDataMonorepo/PeakPerformanceData/peak_performance_data/src/components/ai/MessageBubble.tsx`
- `/Users/danielsilva/Desktop/PeakPerformanceDataMonorepo/PeakPerformanceData/peak_performance_data/src/components/ai/ToolResultCard.tsx`
- `/Users/danielsilva/Desktop/PeakPerformanceDataMonorepo/PeakPerformanceData/peak_performance_data/src/components/ai/ConfirmationDialog.tsx`
- `/Users/danielsilva/Desktop/PeakPerformanceDataMonorepo/PeakPerformanceData/peak_performance_data/src/components/navigation/BottomNav.tsx`
- `/Users/danielsilva/Desktop/PeakPerformanceDataMonorepo/PeakPerformanceData/peak_performance_data/src/app/api/ai-agent/` (all subroutes listed in §3)
- `/Users/danielsilva/Desktop/PeakPerformanceDataMonorepo/PeakPerformanceData/peak_performance_data/src/components/dashboard/alerts/`
- `/Users/danielsilva/Desktop/PeakPerformanceDataMonorepo/PeakPerformanceData/peak_performance_data/src/lib/ai/tools/alertTools.ts`
- `/Users/danielsilva/Desktop/PeakPerformanceDataMonorepo/PeakPerformanceData/peak_performance_data/src/hooks/data/useConversationRealtime.ts`
- `/Users/danielsilva/Desktop/PeakPerformanceDataMonorepo/PeakPerformanceData/peak_performance_data/src/hooks/data/useUnreadMessages.ts`
- `/Users/danielsilva/Desktop/PeakPerformanceDataMonorepo/PeakPerformanceData/peak_performance_data/src/lib/ai/tools/messagingTools.ts`
- `/Users/danielsilva/Desktop/PeakPerformanceDataMonorepo/PeakPerformanceData/peak_performance_data/src/components/dashboard/home/cards/`
- `/Users/danielsilva/Desktop/PeakPerformanceDataMonorepo/PeakPerformanceData/peak_performance_data/supabase/migrations/20260727_insight_store.sql`
- Related dossiers: `_plans/research/03-insight-schema.md`, `13-nextjs-ai-route.md`, `17-supabase-ai-schema.md`
