# 78 — Delivery Channels Inventory & Architecture Recommendation

**Status:** Read-only research dossier  
**Date:** 2026-08-02  
**App root:** `PeakPerformanceData/peak_performance_data`  
**Scope:** Every notification and messaging delivery channel the multi-agent AI system can reuse. No application code was modified; this file is the only write.

**Related dossiers:** `29-ui-surfaces.md` (UI surfaces), `04-nightly-batch.md` (batch generation), `03-insight-schema.md` / `17-supabase-ai-schema.md` (insights tables), `65-proactive-agent-design.md` (when to notify).

---

## Executive verdict

| Channel | Exists? | Production-ready for proactive agent? |
|---------|---------|----------------------------------------|
| In-app messaging (`conversations` / `messages`) | **Yes** | Partially — no bot identity; AI sends as logged-in human |
| In-app alerts (`user_alerts` + AlertEngine) | **Yes** | Fragile — shape mismatch + broken mark-read/dismiss HTTP from UI |
| Web Push (VAPID + SW) | **Yes** | Yes for interruptive tier — wired for messages, training, court plan |
| Email (Resend) | **Yes** | Auth/ops only — no insight/digest templates |
| WhatsApp (WaSender) | **Ops-only** | Feedback alerts to admin — not end-user delivery |
| Supabase Realtime | **Messages only** | Insert into `messages` reaches clients; alerts/insights do not |
| Digest / scheduled summary to users | **No** | Nightly batch exists but is unwired; only cron is conversation cleanup |
| Notification preferences | **No** | Gap — required for proactive agent |
| Quiet hours / user timezone | **No** | Only `preferred_language` on profiles; no IANA timezone |

**Bot-identity verdict:** Every message requires a real `profiles.id` as `sender_id` (NOT NULL FK). There is no system/bot sender today. The AI `sendMessageTool` passes `senderId: userId` (the logged-in coach/parent), so AI-authored messages **impersonate the human**. A bot identity requires a dedicated `profiles` row (or nullable sender + metadata) plus UI attribution.

---

## 1. In-app messaging

### 1.1 Data model (from generated types)

Source of truth: `src/lib/supabase/database.types.ts` (tables exist in live schema; CREATE TABLE not present in tracked migrations under `supabase/migrations/` — messaging was established before the current migration set).

#### `conversations` (L701–751)

| Column | Type | Notes |
|--------|------|-------|
| `id` | string (uuid) | PK |
| `organization_id` | string | FK → `organizations` |
| `created_by` | string | FK → `profiles` |
| `type` | string | App types: `announcement` \| `direct` \| `group` (`src/lib/types/messaging.ts` L5) |
| `title` | string \| null | |
| `last_message_at` | string \| null | |
| `last_message_preview` | string \| null | |
| `created_at` / `updated_at` | string \| null | |

#### `conversation_participants` (L656–700)

| Column | Type | Notes |
|--------|------|-------|
| `id` | string | PK |
| `conversation_id` | string | FK → `conversations` |
| `user_id` | string | FK → `profiles` — **required real user** |
| `role` | string | App: `admin` \| `club_admin` \| `coach` \| `parent` (`messaging.ts` L7) |
| `joined_at` | string \| null | |
| `last_read_at` | string \| null | Unread = messages after this |
| `muted` | boolean \| null | Present in schema; light UI use |

#### `messages` (L1376–1425)

| Column | Type | Notes |
|--------|------|-------|
| `id` | string | PK |
| `conversation_id` | string | FK → `conversations` |
| `sender_id` | string | **NOT NULL**, FK → `profiles.id` via `messages_sender_id_fkey` |
| `content` | string \| null | |
| `message_type` | string | `image` \| `mixed` \| `text` \| `video` |
| `is_deleted` / `deleted_at` | bool / timestamptz | Soft delete |
| `created_at` / `updated_at` | string \| null | |

**Critical:** `sender_id` is required and always references `profiles`. There is **no** `is_system`, `sender_type`, or nullable sender. A non-human sender is only possible by inserting a **real profile row** that represents the bot (or by a schema change).

#### `message_attachments` (L1322–1374)

| Column | Type |
|--------|------|
| `id`, `message_id`, `file_type`, `file_url`, `storage_key`, `file_name`, `file_size`, `thumbnail_url`, `width`, `height`, `duration`, `created_at` | as typed |

App-level TypeScript mirrors: `src/lib/types/messaging.ts` L14–60.

### 1.2 API routes

| Method | Path | File |
|--------|------|------|
| GET/POST | `/api/conversations` | `src/app/api/conversations/route.ts` |
| GET | `/api/conversations/list` | `…/conversations/list/route.ts` |
| GET/PATCH/DELETE | `/api/conversations/[id]` | `…/conversations/[id]/route.ts` |
| GET/POST | `/api/conversations/[id]/messages` | `…/messages/route.ts` (**nodejs** runtime for web-push) |
| GET | `/api/conversations/[id]/messages/list` | `…/messages/list/route.ts` |
| PATCH/DELETE | `/api/conversations/[id]/messages/[messageId]` | `…/messages/[messageId]/route.ts` |
| POST | `/api/conversations/[id]/read` | `…/read/route.ts` |
| participants | `/api/conversations/[id]/participants` | `…/participants/route.ts` |
| GET | `/api/messages/unread-count` | `src/app/api/messages/unread-count/route.ts` |
| GET | `/api/messages/contacts` | `src/app/api/messages/contacts/route.ts` |
| Cron | `/api/cron/cleanup-conversations` | `src/app/api/cron/cleanup-conversations/route.ts` |

**Send path sets human sender** — `messages/route.ts` L229–236:

```ts
.insert({
  content: content || null,
  conversation_id: conversationId,
  message_type,
  sender_id: user.id,  // authenticated user only
})
```

After insert, non-blocking push to other participants (L324–336) via `sendConversationNotification`.

### 1.3 Hooks & realtime

| Hook | File | Behavior |
|------|------|----------|
| `useConversationRealtime` | `src/hooks/data/useConversationRealtime.ts` L94–214 | Channel `conversation:{id}`; `postgres_changes` INSERT/UPDATE on `messages` filtered by `conversation_id` |
| `useConversationsRealtime` | same file L227–285 | Channel `user-conversations:{userId}`; INSERT/UPDATE on `conversation_participants` filtered by `user_id` → throttled unread revalidation |
| `useUnreadMessages` | `src/hooks/data/useUnreadMessages.ts` L28–103 | SWR `/api/messages/unread-count` + realtime; Badging API `setAppBadge` / `clearAppBadge` (L86–95) |
| `useConversations` / `useMessages` | `src/hooks/data/useConversations.ts`, `useMessages.ts` | List/thread SWR caches updated by realtime helpers |

Realtime client: `@/lib/supabase/client` → `supabase.channel(...).on('postgres_changes', …)`.

**Implication for insights:** An insert into a hypothetical `insights` table would **not** automatically reach clients. Only tables with (1) Realtime publication enabled and (2) an active client subscription deliver live updates. Today, client subscriptions exist for **`messages`** and **`conversation_participants`** only (grep of `postgres_changes` under `src/` finds solely `useConversationRealtime.ts`).

### 1.4 UI components

Under `src/components/messaging/`:

- `MessagesPageClient.tsx`, `MessagingView.tsx`, `ConversationList.tsx`, `ConversationThread.tsx`
- `MessageBubble.tsx`, `MessageInput.tsx`, `AttachmentUpload.tsx`, `MediaViewer.tsx`
- `NewConversationDialog.tsx`, `AddParticipantsDialog.tsx`
- `NotificationPermissionBanner.tsx` — prompts Web Push opt-in via `usePushNotifications`

Pages: `[locale]/{coach,parent,player,club-admin}/messages/page.tsx`.

### 1.5 Agent messaging tools — bot impersonation confirmed

| Tool | File | Sender |
|------|------|--------|
| `sendMessageTool` | `src/lib/ai/tools/messagingTools.ts` L12–46 | `senderId: userId` |
| `sendGroupMessageTool` | same L217–291 | `senderId: userId` |
| `announceToAllTool` | same L293–337 | `senderId: userId` |
| `broadcastToParentsTool` | same L339–433 | `senderId: userId` |

Shared insert path: `src/lib/ai/tools/messagingSupport.ts`

- `createMessageRecord` L141–163: `sender_id: args.senderId`
- `createConversationRecord` L96–139: `created_by: args.senderProfile.id`; participants include sender + recipients, all real profile IDs
- Sender resolved via `findConversationProfile(profileId)` — must exist in `profiles`

**Players cannot be DM recipients** (tool descriptions + `listMessagingContacts` filters to `admin|club_admin|coach|parent`).

**Gap vs HTTP send:** AI `createConversationMessage` does **not** call `sendConversationNotification` / web-push. Agent-sent messages update DB (+ realtime for open threads) but skip the push fan-out that the REST POST path performs.

### 1.6 What a bot identity would require

Minimum viable (schema-compatible, no migration):

1. **Service profile** — insert a `profiles` row per org (or one global) e.g. `full_name: "Peak Performance AI"`, `role: 'admin'` or a new role, `email` null / system email.
2. **Always send as that profile** from agent tools / server jobs — never `userId` of the invoking coach.
3. **Participant membership** — bot must be a `conversation_participants` row in threads it writes to (or create dedicated AI ↔ user DMs).
4. **UI attribution** — `MessageBubble` / realtime builder join `profiles` by `sender_id`; bot avatar/name will show if profile is set. Optionally add `is_bot` on profiles for badge styling.
5. **Push title** — REST path uses sender `full_name` as push title (`messages/route.ts` L327–333); bot name would appear correctly if sender is bot.
6. **Wire push** into `messagingSupport.ts` after insert (parity with REST).

Stronger model (migration):

- `messages.sender_id` nullable OR `sender_kind` enum (`user` \| `system` \| `agent`)
- `messages.agent_run_id` / `insight_id` for audit
- RLS policies for service-role inserts
- Never allow coach JWT to forge bot sender without service role

**Do not** continue sending as the logged-in coach — that attributes AI text to a human in legal, trust, and conversation-history senses.

---

## 2. Alerts (`user_alerts` + AlertEngine)

### 2.1 Schema

Migration: `supabase/migrations/20260130_dashboard_enhancement_tables.sql` L197–254  
Types: `database.types.ts` L289–310 (`alert_definitions`), L3488–3528 (`user_alerts`)

#### `alert_definitions`

| Column | Notes |
|--------|-------|
| `id` TEXT PK | e.g. `court_assignment` |
| `name`, `category` | category ∈ training/health/performance/administrative |
| `trigger_metric`, `trigger_operator`, `trigger_threshold`, `evaluation_period` | Rule engine inputs |
| `notify_roles[]`, `notify_athlete`, `notify_parent`, `notify_coach` | Fan-out flags |
| `priority` | low/medium/high/urgent |
| `channels[]` | default `['in_app']`; also `push`, `email` in engine types |
| `title_template`, `body_template`, `action_url_template` | `{{placeholder}}` |
| `cooldown_hours`, `enabled`, `created_at` | |

Seeded example: `court_assignment` in `20260510_court_coordination_foundation.sql` L157–184 (`channels: in_app+push`).

#### `user_alerts`

| Column | Type |
|--------|------|
| `id` | UUID PK |
| `user_id` | UUID → profiles (recipient) |
| `alert_definition_id` | TEXT → alert_definitions |
| `subject_athlete_id` | UUID nullable |
| `organization_id` | UUID nullable |
| `title`, `body` | TEXT NOT NULL |
| `action_url` | TEXT |
| `priority` | TEXT |
| `trigger_value`, `trigger_data` | numeric / jsonb |
| `read_at`, `dismissed_at`, `actioned_at` | timestamptz |
| `channels_sent[]`, `push_sent_at`, `email_sent_at` | delivery bookkeeping |
| `created_at`, `expires_at` | |

RLS: select/update/delete where `user_id = auth.uid()` (migration L370–377). Inserts typically via service role / server clients.

### 2.2 AlertEngine

File: `src/services/alerts/AlertEngine.ts`  
Export: `src/services/alerts/index.ts`

| Method | Lines | Role |
|--------|-------|------|
| `evaluateAthlete` | L64–99 | Load definitions + metrics; create alerts if threshold + cooldown |
| `evaluateAllAthletes` | L101+ | Org-wide batch |
| `createAlert` (private) | L300–361 | Render templates; insert `user_alerts` rows; optionally push/email |
| `getAlertsForUser` | L446–474 | Select `body`, `read_at`, `dismissed_at`, … |
| `markAlertAsRead` | L476–484 | Sets `read_at` |
| `dismissAlert` | L486–494 | Sets `dismissed_at` |
| `getUnreadCount` | L496–505 | `read_at` IS NULL AND `dismissed_at` IS NULL |
| `sendPushNotifications` | L409–421 | **TODO stub** — logs only; does **not** call `web-push.ts` |
| `sendEmailNotifications` | L423–434 | **TODO stub** — logs only |

### 2.3 API routes

| Method | Path | File |
|--------|------|------|
| GET | `/api/alerts` | `src/app/api/alerts/route.ts` L8–34 — returns `{ alerts, unreadCount }` |
| **PUT** | `/api/alerts/[id]/read` | `…/read/route.ts` L8 |
| **PUT** | `/api/alerts/[id]/dismiss` | `…/dismiss/route.ts` L8 |
| POST/GET | `/api/alerts/evaluate/[athleteId]` | `…/evaluate/[athleteId]/route.ts` |

There is **no** `DELETE /api/alerts/[id]` handler.

### 2.4 UI + verified bugs

Components:

- `src/components/dashboard/alerts/AlertCard.tsx` — expects `AlertData` with **`message`** and **`read`** (L10–18)
- `AlertsDropdown.tsx`, `AlertsList.tsx` (list exported but not mounted on a page per `29-ui-surfaces.md`)
- Wired from `src/components/ui/NavBar.tsx` L96–129, L239–244

**Bug A — column/shape mismatch**

| API / DB field | UI `AlertData` field |
|----------------|----------------------|
| `body` | `message` |
| `read_at` (timestamptz \| null) | `read` (boolean) |
| (category via join / definition) | `type` (string) |

NavBar passes API rows straight into `AlertCard` without mapping. Titles may render; body text and unread styling break.

**Bug B — mark-read wrong HTTP method**

- NavBar L121: `POST /api/alerts/${id}/read`
- Route exports **`PUT`** only (`read/route.ts` L8)

Result: mark-read fails (405) after optimistic local update.

**Bug C — dismiss wrong method and path**

- NavBar L128: `DELETE /api/alerts/${id}`
- Actual route: **`PUT /api/alerts/[id]/dismiss`**
- No DELETE handler under `[id]`

Result: dismiss fails server-side; optimistic removal makes UI look successful until refresh.

**Bug D — View all dead link**

- NavBar L243: `router.push('/notifications')` — no `[locale]/notifications` page found.

**Correction to prior dossier:** `29-ui-surfaces.md` §5.4 claimed mark-read POST was correct; it is **not** — both read and dismiss are broken from the NavBar client.

### 2.5 Producers of `user_alerts` (reuse for agent)

| Producer | File | Notes |
|----------|------|-------|
| AlertEngine rules | `AlertEngine.ts` | Metric thresholds |
| Court plan publish | `src/app/api/court-plan/publish/route.ts` L249–281 | In-app + separate real push fan-out L230+ |
| Gamification | `src/services/gamification/AchievementSystem.ts` L101–110 | `performance_milestone` definition id |
| Parent communications read path | `src/app/api/dashboard/parent/communications/route.ts` | Surfaces alerts + messages |
| Parent dashboard init | `src/app/api/dashboard/parent/init/route.ts` | Reads alerts |

Agent tools (`src/lib/ai/tools/alertTools.ts`): **read/dismiss only** — do not create alerts.

### 2.6 Alerts delivery channels declared vs implemented

`alert_definitions.channels` can include `push` / `email`, but AlertEngine’s private senders are stubs. Court-plan publish correctly uses `sendPushToUsers` from `web-push.ts` **outside** AlertEngine. Prefer that pattern for agent urgent alerts until AlertEngine is wired.

---

## 3. Push notifications (Web Push — exists)

### 3.1 Verdict

**Web Push exists and is partially production-wired.** Not FCM/APNs native SDKs; browser Web Push via VAPID + `web-push` npm package. PWA service worker present.

### 3.2 Infrastructure

| Piece | Path |
|-------|------|
| Send helpers | `src/lib/notifications/web-push.ts` — `sendPushNotification`, `sendPushToUser`, `sendPushToUsers`, `sendConversationNotification`, `savePushToken`, `removePushToken` |
| Token table | `push_notification_tokens` (`database.types.ts` L2059–2093): `id`, `user_id`→profiles, `token` (JSON subscription string), `platform`, timestamps |
| Subscribe API | `POST/DELETE /api/notifications/push-token` — `src/app/api/notifications/push-token/route.ts` |
| VAPID public key API | `src/app/api/notifications/vapid-key/route.ts` |
| Client hook | `src/hooks/data/usePushNotifications.ts` — registers `/sw.js`, `pushManager.subscribe`, posts token |
| Push SW handlers | `public/push-sw.js` — `push`, `notificationclick`, `notificationclose`, `pushsubscriptionchange` |
| Main SW | `next-pwa` → `public/sw.js` with `importScripts: ['/push-sw.js', '/cache-warm-sw.js']` (`next.config.js` L5–24) |
| Registration | `src/components/pwa/ServiceWorkerRegistration.tsx` L51–52 registers `/sw.js` |
| Manifest | Dynamic `GET /api/manifest` (`src/app/api/manifest/route.ts`) — PWA install metadata |
| Key gen script | `scripts/generate-vapid-keys.js` |
| Env | `VAPID_SUBJECT`, `NEXT_PUBLIC_VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY` — missing → push disabled (`web-push.ts` L22–28) |

### 3.3 Call sites that actually send

| Caller | Uses real web-push? |
|--------|---------------------|
| `POST …/messages` | Yes — `sendConversationNotification` |
| `POST …/conversations` (invite) | Yes — `sendPushToUsers` |
| Training session updates | Yes — `training-sessions/[id]/route.ts` |
| Court plan publish | Yes — `sendPushToUsers` |
| AlertEngine | **No** — console.log stub |
| AI messagingSupport | **No** |

### 3.4 Not present

- Firebase Cloud Messaging / APNs native mobile SDKs
- Generic `/api/notifications` list route (hook in `useSWR.ts` L527 references it; **no** `api/notifications/route.ts` found)

---

## 4. Email

### 4.1 Provider

**Resend** (`resend` package). Lazy client in:

- `src/lib/communication/email.ts` — transactional product emails
- `src/lib/communication/feedbackEmail.ts` — internal feedback notifications

From address pattern: `{organizationName} <noreply@peakperformancedata.app>` (`email.ts` L207).

Templating: inline HTML builders + `emailTranslations.ts` (en/es/ca/zh) with `replacePlaceholders`. Not React Email / MJML.

### 4.2 Templates that exist today

| Function | Purpose |
|----------|---------|
| `sendInvitationEmail` | Org invite |
| `sendPasswordResetEmail` | Password reset |
| `sendEmailConfirmation` | Signup confirm |
| `sendClaimAccountEmail` | Player claim |
| `sendMatchInviteEmail` | Guest match watch link |
| Feedback email (feedbackEmail.ts) | Admin ops alert for product feedback |

**No** daily brief, roster digest, insight, or alert email templates. AlertEngine email path is stubbed.

Supabase Auth may also send its own auth emails depending on project config (separate from Resend app templates). Nodemailer / SendGrid: not used in app code paths found.

### 4.3 Adjacent: WhatsApp (not end-user)

`src/lib/communication/feedbackWhatsApp.ts` + `wasender` — admin feedback alerts only. Not a user-facing delivery channel for coaches/athletes/parents.

---

## 5. Realtime

### 5.1 Configured client subscriptions

Only messaging tables (see §1.3). No `user_alerts` realtime. No `insights` realtime.

### 5.2 Publication / migrations

No `supabase_realtime` / `ALTER PUBLICATION` statements found under `supabase/migrations/`. Messaging realtime works in practice (app depends on it), so those tables are almost certainly added to the Supabase Realtime publication in the hosted project. Treat “enable realtime for table X” as a **dashboard/migration step** when adding insight push.

### 5.3 Would an insights insert reach a subscribed client?

**Only if:**

1. Table is in the `supabase_realtime` publication,
2. RLS allows the user to receive the row change,
3. A client hook subscribes with `postgres_changes` on that table (does not exist today).

Otherwise: poll (NavBar alerts pattern) or map high-priority rows into `user_alerts` / push / messages.

Alerts today: **60s SWR poll** in NavBar when connection is fast — not realtime.

---

## 6. Digest / summary delivery

| Mechanism | Status |
|-----------|--------|
| Vercel cron | Only `0 3 * * *` → `/api/cron/cleanup-conversations` (`vercel.json` L2–6) — **retention**, not user digest |
| Nightly athlete briefs | `ppp_ai_agent` `nightly_batch.py` — **unwired** to production scheduler (`04-nightly-batch.md`); targets `insights` table not live in prod |
| Court “digest” | Per-coach court assignment text in publish flow (`court-plan/publish`) — operational assignment notice, not AI roster digest |
| Email digests | None |
| Scheduled report emails | None found |

**Gap:** No user-facing daily/weekly digest pipeline. Agent proactive delivery must build scheduling + preference gating; generation stubs exist in `ppp_ai_agent` but delivery does not.

---

## 7. Notification preferences

**None found.**

- No `notification_preferences` (or similar) table in `database.types.ts`
- No settings UI for channels / quiet hours / categories
- `conversation_participants.muted` is per-thread mute only
- `alert_definitions` has role-level notify flags (system config), not per-user opt-in
- Push opt-in is browser permission + token presence only (`NotificationPermissionBanner` + localStorage dismiss key)

**This is a hard requirement** before scaling proactive agent notifications (see `65-proactive-agent-design.md`).

---

## 8. Quiet hours / timezone

**No user timezone stored.**

`profiles` columns (`database.types.ts` L1968–1993) include `preferred_language` but **no** `timezone` / `time_zone` / IANA field. Organizations also lack a timezone field in types grep.

Implication: cannot safely schedule “morning brief” or suppress 3am push without adding timezone (user and/or org default) and quiet-hours preferences.

---

## 9. Channel inventory (quick reference)

```
┌──────────────────────────┬────────────────────────────────────────────┐
│ Channel                  │ Status                                     │
├──────────────────────────┼────────────────────────────────────────────┤
│ Human messaging          │ LIVE — realtime + push on REST send        │
│ AI → messaging           │ LIVE but impersonates user; no push        │
│ user_alerts bell         │ LIVE / FRAGILE — poll; UI bugs             │
│ AlertEngine rules        │ LIVE insert; push/email stubs              │
│ Web Push (VAPID)         │ LIVE for msgs/training/court plan          │
│ PWA SW + manifest        │ LIVE                                       │
│ Resend email             │ LIVE auth/ops templates only               │
│ WhatsApp                 │ Ops feedback only                          │
│ Insights table delivery  │ NOT LIVE (migration unapplied / unwired)   │
│ Digest cron to users     │ MISSING                                    │
│ Prefs / quiet hours / TZ │ MISSING                                    │
└──────────────────────────┴────────────────────────────────────────────┘
```

---

## 10. Delivery architecture recommendation

Assumptions: reuse infrastructure; tier interruptiveness per `65-proactive-agent-design.md`; never impersonate humans.

### 10.1 Bot identity model (recommended)

1. Create **org-scoped system profiles** (or one global + org membership):  
   `id` fixed/service-managed, `full_name = "PPD Assistant"`, distinct avatar, flag `is_system_agent` (new column) or reserved role.
2. All agent-authored `messages.sender_id` = bot profile id (service role insert).
3. Conversations: either AI DM threads (bot + user participants) or announcement-type “AI Briefs” group where bot is a participant.
4. Audit: store `agent_run_id` / `insight_id` in message metadata (new jsonb column) or parallel `insight_deliveries` table.
5. UI: badge “AI” on bubbles when `is_system_agent`; never show coach name on AI text.
6. Human coach messages remain coach `sender_id` only when the coach explicitly sends (or confirms a draft).

### 10.2 Per output type

| Output | Primary channel (existing) | Secondary | Must build |
|--------|---------------------------|-----------|------------|
| **Nightly athlete brief** | Passive `insights` row → home card / ReadinessCard slot (passive) | Optional `user_alerts` (low/medium) if newsworthy | Apply insight schema; InsightCard UI; schedule job; timezone; prefs; rate limits |
| **Coach roster digest** | Morning passive surface: AttentionListCard / new digest panel fed by `insights` | Soft: `user_alerts` pin; email digest later | Digest aggregator; coach home binding; ≤7 items; prefs |
| **Urgent alert** | `user_alerts` (priority urgent/high) + **real** `sendPushToUsers` | Optional bot message to coach DM for audit trail | Fix AlertCard mapping + NavBar HTTP; wire AlertEngine push to `web-push.ts`; quiet-hours gate; never email unless opted-in |
| **Insight card** | Dashboard home / tennis-analytics slot reading `insights` | Chat ToolResultCard only when user asked in session | InsightCard component; poll or realtime on `insights` |
| **Chat reply** | Existing `/api/ai-agent` stream in VoiceAssistantModal | — | Keep; do not dump proactive briefs into chat by default |
| **Coach-authored outreach AI drafts** | Messaging as **coach** only after explicit confirm | — | HITL confirmation; until then bot identity for unattended sends |

### 10.3 Preferred stack by tier

| Tier | Channel |
|------|---------|
| 0 Silent | Store detection / insight unpublished |
| 1 Passive | `insights` → home cards |
| 2 Soft | `user_alerts` (fixed UI) + digest panel |
| 3 Interruptive | Web Push via `web-push.ts` + urgent `user_alerts` |
| Messaging | Bot-attributed threads for conversational follow-ups / explanations — **not** the default for nightly volume |

### 10.4 Build order (minimal)

1. Fix alerts UI bugs (mapper + PUT paths) so `user_alerts` is trustworthy.
2. Add bot profile + change messaging tools to use it; add push to `messagingSupport`.
3. Add `profiles.timezone` (or org default) + `notification_preferences` table/UI.
4. Apply insight store; wire nightly batch → insights → home cards.
5. Urgent path: insight/rule → `user_alerts` + `sendPushToUsers` with quiet-hours check.
6. Email digests last (new Resend templates); optional.

---

## 11. File index (absolute)

### Messaging
- `/Users/danielsilva/Desktop/PeakPerformanceDataMonorepo/PeakPerformanceData/peak_performance_data/src/lib/types/messaging.ts`
- `/Users/danielsilva/Desktop/PeakPerformanceDataMonorepo/PeakPerformanceData/peak_performance_data/src/lib/supabase/database.types.ts` (conversations L701, participants L656, messages L1376, attachments L1322)
- `/Users/danielsilva/Desktop/PeakPerformanceDataMonorepo/PeakPerformanceData/peak_performance_data/src/app/api/conversations/[id]/messages/route.ts`
- `/Users/danielsilva/Desktop/PeakPerformanceDataMonorepo/PeakPerformanceData/peak_performance_data/src/hooks/data/useConversationRealtime.ts`
- `/Users/danielsilva/Desktop/PeakPerformanceDataMonorepo/PeakPerformanceData/peak_performance_data/src/hooks/data/useUnreadMessages.ts`
- `/Users/danielsilva/Desktop/PeakPerformanceDataMonorepo/PeakPerformanceData/peak_performance_data/src/lib/ai/tools/messagingTools.ts`
- `/Users/danielsilva/Desktop/PeakPerformanceDataMonorepo/PeakPerformanceData/peak_performance_data/src/lib/ai/tools/messagingSupport.ts`
- `/Users/danielsilva/Desktop/PeakPerformanceDataMonorepo/PeakPerformanceData/peak_performance_data/src/components/messaging/`

### Alerts
- `/Users/danielsilva/Desktop/PeakPerformanceDataMonorepo/PeakPerformanceData/peak_performance_data/supabase/migrations/20260130_dashboard_enhancement_tables.sql` L197–377
- `/Users/danielsilva/Desktop/PeakPerformanceDataMonorepo/PeakPerformanceData/peak_performance_data/src/services/alerts/AlertEngine.ts`
- `/Users/danielsilva/Desktop/PeakPerformanceDataMonorepo/PeakPerformanceData/peak_performance_data/src/app/api/alerts/route.ts`
- `/Users/danielsilva/Desktop/PeakPerformanceDataMonorepo/PeakPerformanceData/peak_performance_data/src/app/api/alerts/[id]/read/route.ts`
- `/Users/danielsilva/Desktop/PeakPerformanceDataMonorepo/PeakPerformanceData/peak_performance_data/src/app/api/alerts/[id]/dismiss/route.ts`
- `/Users/danielsilva/Desktop/PeakPerformanceDataMonorepo/PeakPerformanceData/peak_performance_data/src/components/dashboard/alerts/AlertCard.tsx`
- `/Users/danielsilva/Desktop/PeakPerformanceDataMonorepo/PeakPerformanceData/peak_performance_data/src/components/ui/NavBar.tsx` L117–129
- `/Users/danielsilva/Desktop/PeakPerformanceDataMonorepo/PeakPerformanceData/peak_performance_data/src/lib/ai/tools/alertTools.ts`

### Push / PWA
- `/Users/danielsilva/Desktop/PeakPerformanceDataMonorepo/PeakPerformanceData/peak_performance_data/src/lib/notifications/web-push.ts`
- `/Users/danielsilva/Desktop/PeakPerformanceDataMonorepo/PeakPerformanceData/peak_performance_data/public/push-sw.js`
- `/Users/danielsilva/Desktop/PeakPerformanceDataMonorepo/PeakPerformanceData/peak_performance_data/next.config.js` L5–24
- `/Users/danielsilva/Desktop/PeakPerformanceDataMonorepo/PeakPerformanceData/peak_performance_data/src/hooks/data/usePushNotifications.ts`
- `/Users/danielsilva/Desktop/PeakPerformanceDataMonorepo/PeakPerformanceData/peak_performance_data/src/app/api/notifications/push-token/route.ts`
- `/Users/danielsilva/Desktop/PeakPerformanceDataMonorepo/PeakPerformanceData/peak_performance_data/src/app/api/manifest/route.ts`

### Email
- `/Users/danielsilva/Desktop/PeakPerformanceDataMonorepo/PeakPerformanceData/peak_performance_data/src/lib/communication/email.ts`
- `/Users/danielsilva/Desktop/PeakPerformanceDataMonorepo/PeakPerformanceData/peak_performance_data/src/lib/communication/emailTranslations.ts`
- `/Users/danielsilva/Desktop/PeakPerformanceDataMonorepo/PeakPerformanceData/peak_performance_data/src/lib/communication/feedbackEmail.ts`

### Cron / batch
- `/Users/danielsilva/Desktop/PeakPerformanceDataMonorepo/PeakPerformanceData/peak_performance_data/vercel.json`
- `/Users/danielsilva/Desktop/PeakPerformanceDataMonorepo/_plans/research/04-nightly-batch.md`
