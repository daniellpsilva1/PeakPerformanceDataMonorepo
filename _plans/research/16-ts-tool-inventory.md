# 16 — TypeScript AI Tool Inventory & Migration Taxonomy

**Status:** Read-only research dossier  
**Date:** 2026-08-02  
**Scope:** Authoritative index of the Next.js AI tool layer under `PeakPerformanceData/peak_performance_data/src/lib/ai/tools/`. Counts, conventions, mutating set, confirmation, role gates, helpers, dead/duplicated surface, migration tiers.  
**Method:** Full read of `index.ts` and `confirmationTools.ts`; registry wiring via `src/lib/ai/utils/toolRouter.ts`; per-module export scan + write-marker classification (no deep execute-path audits — sibling dossiers cover domain groups).

**Primary paths:**

| Path | Role |
|------|------|
| `.../src/lib/ai/tools/index.ts` | Coach/shared barrel (91 tool factories) |
| `.../src/lib/ai/tools/*Tools.ts` | Tool factories |
| `.../src/lib/ai/tools/messagingSupport.ts` | Shared messaging helpers |
| `.../src/lib/ai/tools/playerSupport.ts` | Shared player-create helpers |
| `.../src/lib/ai/utils/toolRouter.ts` | Role + intent category assembly |

---

## 1. Exact counts (corrects “~115”)

| Scope | Count |
|-------|------:|
| **All exported `*Tool` factories in `tools/`** | **121** |
| Exported from `index.ts` (coach/shared barrel) | 91 |
| `athleteTools.ts` (not in `index.ts`; wired by role) | 18 |
| `parentTools.ts` (not in `index.ts`; wired by role) | 6 |
| `specialistTools.ts` (not in `index.ts`; HTTP proxy to Python) | 6 |
| Shared helpers (not tools) | 2 files (`messagingSupport.ts`, `playerSupport.ts`) |

**Classification (every tool):**

| Class | Count | Definition used |
|-------|------:|-----------------|
| **Read-only** | **57** | Selects / fetches only |
| **Mutating** | **61** | DB insert/update/delete/upsert, `storeMemory`, messaging sends, invite/create-player side effects |
| **Side-effect export** | **2** | Excel report generation (no DB write / no message send) |
| **Meta** | **1** | `confirmActionTool` (returns a confirmation payload; no persistence) |

> **True tool count = 121** (not ~115).  
> **Mutating-tool count = 61** (risky set; enumerated in §4 and the full table).

---

## 2. Per-module counts & line sizes

| Module | Tools | Lines | Notes |
|--------|------:|------:|-------|
| `achievementTools.ts` | 1 | 90 | Coach read |
| `alertTools.ts` | 2 | 127 | 1 read + 1 mutate |
| `analyticsTools.ts` | 2 | 427 | Coach analytics reads |
| `athleteMemoryTools.ts` | 3 | 172 | Memory CRUD |
| `athleteTools.ts` | 18 | 1003 | Player role set (not in index) |
| `competitionTools.ts` | 2 | 155 | Results |
| `confirmationTools.ts` | 1 | 79 | Meta confirmation |
| `filterAthleteTools.ts` | 1 | 125 | Coach filter |
| `garminActivityTools.ts` | 1 | 112 | Wearable read |
| `goalTools.ts` | 4 | 326 | Coach goals CRUD |
| `hiitTrainingTools.ts` | 2 | 171 | HIIT |
| `injuryTools.ts` | 4 | 340 | Injury CRUD |
| `invitationTools.ts` | 4 | 326 | Invites + assignments |
| `messagingTools.ts` | 6 | 433 | Coach messaging |
| `observationTools.ts` | 4 | 276 | Observations CRUD |
| `parentTools.ts` | 6 | 448 | Parent role set (not in index) |
| `periodizationTools.ts` | 6 | 476 | Shock / transition |
| `playerGroupTools.ts` | 6 | 371 | Groups CRUD |
| `queryTools.ts` | 10 | 619 | Roster + tests + notes |
| `reportExportTools.ts` | 2 | 158 | Excel export side effects |
| `seriesTrainingTools.ts` | 2 | 204 | Series training |
| `sessionFeedbackTools.ts` | 2 | 165 | Coach feedback |
| `specialistTools.ts` | 6 | 143 | Already HTTP→Python |
| `tournamentTools.ts` | 7 | 892 | Largest write surface |
| `trainingPlanTools.ts` | 5 | 740 | Plans + generation |
| `trainingReportTools.ts` | 5 | 468 | Reports + auto-summarize |
| `trainingSessionTools.ts` | 5 | 322 | Sessions + attendance |
| `wearableInsightTools.ts` | 2 | 213 | Insights / leaderboard |
| `wellnessTools.ts` | 2 | 165 | PSE |
| `messagingSupport.ts` | 0 | 453 | Helper |
| `playerSupport.ts` | 0 | 290 | Helper |
| `index.ts` | 0 | 155 | Barrel only |
| **TOTAL tool factories** | **121** | — | — |
| **Approx. tool-layer LOC** | — | **~10.3k** | Including helpers + barrel |

---

## 3. Tool definition convention

**Yes — Vercel AI SDK `tool()` + Zod `parameters`.**

Universal pattern across all modules:

1. `import { tool } from 'ai'`
2. `import { z } from 'zod'`
3. Factory: `(organizationId, supabase, userId?) => tool({ description, execute, parameters })`
4. Schema field name is **`parameters`** (AI SDK v4 style), not `inputSchema`
5. `execute` is async; returns plain JSON-ish objects (`{ success, error?, ... }`)

### Representative example (full)

From `achievementTools.ts` — canonical shape to mirror in Python:

```typescript
import { tool } from 'ai'
import { SupabaseClient } from '@supabase/supabase-js'
import { z } from 'zod'

export const getAchievementsTool = (
  organizationId: string,
  supabase: SupabaseClient
) => tool({
  description: `Get achievements/badges earned by an athlete. Use this to view what milestones
    an athlete has reached, their rarity, and when they were earned.`,
  execute: async ({
    athleteName,
    category,
    limit,
  }) => {
    // Find the athlete
    const { data: athlete, error: searchError } = await supabase
      .from('profiles')
      .select('id, full_name')
      .eq('organization_id', organizationId)
      .eq('role', 'player')
      .ilike('full_name', `%${athleteName}%`)
      .single()

    if (searchError || !athlete) {
      return {
        error: `Athlete "${athleteName}" not found. Use searchAthlete to find the correct name.`,
        success: false,
      }
    }

    const query = supabase
      .from('player_achievements')
      .select(`
        id, achieved_at, progress_at_achievement,
        achievement_definitions(id, name, description, category, icon, color, rarity, points, criteria_target)
      `)
      .eq('player_id', athlete.id)
      .order('achieved_at', { ascending: false })
      .limit(limit)

    const { data: achievements, error } = await query

    if (error) {
      return { error: error.message, success: false }
    }

    const achievementItems = achievements?.map(a => {
      const def = a.achievement_definitions as unknown as {
        category: string
        color: string
        criteria_target: number
        description: string
        icon: string
        id: string
        name: string
        points: number
        rarity: string
      } | null

      return {
        achievedAt: a.achieved_at,
        category: def?.category || 'unknown',
        color: def?.color,
        description: def?.description,
        icon: def?.icon,
        id: a.id,
        name: def?.name || 'Unknown',
        points: def?.points || 0,
        progressAtAchievement: a.progress_at_achievement,
        rarity: def?.rarity || 'common',
      }
    }).filter(a => !category || a.category === category) || []

    const totalPoints = achievementItems.reduce((sum, a) => sum + a.points, 0)

    return {
      achievements: achievementItems,
      athlete: athlete.full_name,
      count: achievementItems.length,
      success: true,
      totalPoints,
    }
  },
  parameters: z.object({
    athleteName: z.string().describe('Name of the athlete'),
    category: z.string().optional().describe('Filter by category (training, performance, social, milestone)'),
    limit: z.number().default(20).describe('Maximum number of results'),
  }),
})
```

**Python mirror notes:** keep factory closure over `organization_id` / `user_id` / client; expose LLM-visible name without `Tool` suffix (router already maps `getAchievementsTool` → `getAchievements`); preserve `{ success, error? }` envelope.

---

## 4. Mutating set (exact — 61 tools)

These write to the database and/or send messages/notifications. **Riskiest migration surface.**

### Coach / admin (from `index.ts` + specialist excluded)

| Tool | Module | Write kind |
|------|--------|------------|
| `dismissAlertTool` | alertTools | update `user_alerts` |
| `rememberAboutAthleteTool` | athleteMemoryTools | `storeMemory` |
| `forgetAthleteMemoryTool` | athleteMemoryTools | delete memory |
| `createCompetitionResultTool` | competitionTools | insert competitions |
| `createAthleteGoalTool` | goalTools | insert |
| `updateAthleteGoalTool` | goalTools | update |
| `deleteAthleteGoalTool` | goalTools | delete |
| `createHIITTrainingTool` | hiitTrainingTools | insert |
| `createInjuryTool` | injuryTools | insert |
| `updateInjuryTool` | injuryTools | update |
| `deleteInjuryTool` | injuryTools | delete (**confirmed gate**) |
| `sendInvitationTool` | invitationTools | insert invitation (+ email path) |
| `assignPlayerToCoachTool` | invitationTools | insert/update assignments |
| `sendMessageTool` | messagingTools | messages |
| `sendGroupMessageTool` | messagingTools | messages |
| `announceToAllTool` | messagingTools | announcement messages |
| `broadcastToParentsTool` | messagingTools | parent broadcast |
| `createObservationTool` | observationTools | insert |
| `updateObservationTool` | observationTools | update |
| `deleteObservationTool` | observationTools | delete |
| `createShockMicrocycleTool` | periodizationTools | insert |
| `updateShockMicrocycleTool` | periodizationTools | update |
| `createTransitionPeriodTool` | periodizationTools | insert |
| `updateTransitionPeriodTool` | periodizationTools | update |
| `createPlayerGroupTool` | playerGroupTools | insert |
| `addPlayersToGroupTool` | playerGroupTools | insert members |
| `removePlayersFromGroupTool` | playerGroupTools | delete members |
| `updatePlayerGroupTool` | playerGroupTools | update |
| `deletePlayerGroupTool` | playerGroupTools | delete |
| `createPlayerTool` | queryTools | `createManagedPlayer` (auth + profile + invite) |
| `createPerformanceTestTool` | queryTools | insert |
| `updateAthleteNotesTool` | queryTools | update profiles |
| `updatePlayerTool` | queryTools | update profiles |
| `deletePlayerTool` | queryTools | soft-unassign (**confirmed gate**) |
| `updatePlayerDetailsTool` | queryTools | upsert `player_details` |
| `createSeriesTrainingTool` | seriesTrainingTools | insert |
| `respondToFeedbackTool` | sessionFeedbackTools | update feedback |
| `createTournamentTool` | tournamentTools | insert tournament |
| `updateTournamentTool` | tournamentTools | update tournament |
| `deleteTournamentTool` | tournamentTools | delete tournament + regs |
| `registerAthleteTool` | tournamentTools | insert registrations |
| `registerMeForTournamentTool` | tournamentTools | self-register (also athlete-wired) |
| `unregisterAthleteTool` | tournamentTools | delete/update regs |
| `generateTrainingPlanTool` | trainingPlanTools | insert plan |
| `generatePlanFromDescriptionTool` | trainingPlanTools | insert plan (**confirmed gate**) |
| `updateTrainingPlanTool` | trainingPlanTools | update |
| `deleteTrainingPlanTool` | trainingPlanTools | delete |
| `createTrainingReportTool` | trainingReportTools | insert |
| `autoSummarizeSessionTool` | trainingReportTools | insert draft report |
| `updateTrainingReportTool` | trainingReportTools | update |
| `deleteTrainingReportTool` | trainingReportTools | delete (**confirmed gate**) |
| `createTrainingSessionTool` | trainingSessionTools | insert |
| `updateTrainingSessionTool` | trainingSessionTools | update |
| `deleteTrainingSessionTool` | trainingSessionTools | delete |
| `recordAttendanceTool` | trainingSessionTools | upsert attendance |
| `createPSEScoreTool` | wellnessTools | insert |

**Coach mutating subtotal: 56**

### Athlete role mutators (`athleteTools.ts`)

| Tool | Write kind |
|------|------------|
| `submitSessionFeedbackTool` | insert `session_feedback` |
| `updateMyGoalProgressTool` | update goals |
| `recordMyPSEScoreTool` | insert PSE |
| `sendMyMessageTool` | messages |

**Athlete mutating subtotal: 4**

### Parent role mutators (`parentTools.ts`)

| Tool | Write kind |
|------|------------|
| `sendMessageToCoachTool` | direct message |

**Parent mutating subtotal: 1**

### Not counted as mutating (by stated definition)

| Tool | Why |
|------|-----|
| `confirmActionTool` | Meta only |
| `generateProgressReportTool` | Excel side effect |
| `generateClubOverviewReportTool` | Excel side effect |

---

## 5. Human confirmation today

### 5.1 Soft confirmation — `confirmActionTool`

**File:** `.../tools/confirmationTools.ts`  
**Wired into coach core set** in `toolRouter.ts` as `confirmAction`.

Mechanism:

1. LLM is instructed (via tool description) to call `confirmAction` **before** create/update/delete.
2. Tool does **not** perform the write. It returns:

```ts
{
  confirmationPrompt: `Please confirm: ${summary}`,
  details,
  instructions: 'Wait for user to confirm or cancel before executing the actual action.',
  requiresConfirmation: true,
  summary,
  type: actionType,
}
```

3. `isConfirmationResult(result)` type-guard checks `requiresConfirmation === true`.
4. `actionType` is a Zod enum of ~33 action labels (subset of mutators — missing goals, observations, memories, periodization deletes, invitations, etc.).

**Gap / dead wiring:**

- `isConfirmationResult` is exported from `index.ts` but **not referenced** by the AI API route or chat UI.
- `ConfirmationDialog` (`src/components/ai/ConfirmationDialog.tsx`) exists and is re-exported from `components/ai/index.ts`, but **no production import** uses it (only the barrel). Soft confirmation is therefore **prompt-enforced only**, not UI-gated.

### 5.2 Hard confirmation — `confirmed: boolean` parameter

Five tools refuse the write unless `confirmed === true` (default `false`; first call returns a preview / ask-again payload):

| Tool | Module |
|------|--------|
| `deletePlayerTool` | queryTools |
| `deleteInjuryTool` | injuryTools |
| `deleteTrainingReportTool` | trainingReportTools |
| `forgetAthleteMemoryTool` | athleteMemoryTools |
| `generatePlanFromDescriptionTool` | trainingPlanTools |

Descriptions explicitly say: call with `confirmed=false` first; only pass `true` after the user says yes.

### 5.3 Implication for Python migration

Port the **hard gates** as first-class policy. Treat `confirmActionTool` as optional UX meta — either re-implement as a proper HITL interrupt or delete and replace with server-side confirmation for all mutators.

---

## 6. Role restriction — how it is expressed

Restriction is **not** inside most tool factories. It is applied in `toolRouter.buildToolSet(...)` by assembling different tool maps:

| `userRole` | Builder | Tool surface |
|-------------|---------|--------------|
| `athlete` / `player` | `buildAthleteToolSet` | `athleteTools.*` + `registerMeForTournament` + specialist reads |
| `parent` | `buildParentToolSet` | 6 parent tools only (no category split) |
| `coach` / `admin` / `club_admin` (default) | main `buildToolSet` | Intent categories + core |

**Additional coach scoping:**

- `assignedPlayerIds: string[] | null` passed into `getAthletesTool`, `searchAthleteTool`, `filterAthletesTool`.
- Coaches get a non-null ID list → discovery tools are roster-scoped.
- Admins / club_admins keep `null` → org-wide.

**Intent categories** (`ToolCategory`): `core`, `athletes`, `training`, `competition`, `analytics`, `communication`, `specialized_training`, `admin`. Keyword classifier on last user message; always includes `core`; if nothing matches, also loads `athletes` + `training`.

**Not role-restricted inside tools:** most writes trust the closed-over `organizationId` / `userId` and Supabase RLS of the caller client. Specialist tools ignore `_supabase` and call Python with org id + athlete id.

---

## 7. Shared helpers

### `messagingSupport.ts` (453 lines)

Exports:

| Function | Purpose |
|----------|---------|
| `listMessagingContacts` | List coach/admin/parent contacts in org |
| `resolveMessagingProfilesByNames` | Name → profile resolution with ambiguity |
| `createConversationMessage` | Create conversation + participants + message (admin client) |
| `createDirectConversationMessage` | Direct 1:1 convenience wrapper |

Used by: `messagingTools`, `athleteTools.sendMyMessageTool`, `parentTools.sendMessageToCoachTool`.

### `playerSupport.ts` (290 lines)

Exports:

| Function | Purpose |
|----------|---------|
| `createManagedPlayer` | Full invite/create flow: admin auth user (optional), profile upsert, `player_details`, `coach_player_assignments`, `organization_invitations`, optional `sendInvitationEmail` |

Used by: `queryTools.createPlayerTool`.

**Migration note:** both helpers depend on Next.js admin Supabase client + email stack — strong candidates for **HTTP bridge**, not naive Python reimplementation.

---

## 8. Dead, duplicated, or superseded

| Finding | Evidence | Recommendation |
|---------|----------|----------------|
| Soft confirmation UI unwired | `ConfirmationDialog` unused; `isConfirmationResult` unused outside barrel | Drop or rewire as real HITL |
| `confirmAction` action enum incomplete | Many mutators absent from enum | Don’t treat as source of truth |
| Role “getMy*” duplicates | `athleteTools` mirrors coach getters with `userId` scope | One Python implementation + role scoping; keep thin aliases |
| Parent child getters | Parallel to coach athlete reads | Same — parameterized by child IDs |
| `specialistTools` already bridged | HTTP to `PPP_AI_AGENT_URL` with `x-internal-service` | **Do not re-port**; fix/complete Python routes |
| Index vs runtime asymmetry | `index.ts` omits athlete/parent/specialist | Inventory must include all 121, not just barrel 91 |
| Possible low-value niche | Shock microcycle / transition period tools (6) | Validate product usage before port |

Nothing in the directory is fully orphaned except the confirmation UI path. Role-specific modules are live via `toolRouter`.

---

## 9. Recommended migration tiering

### Tier A — High-value, port first (Python brain)

Read-heavy, high-frequency coach analytics + roster discovery. Already partially represented in `ppp_ai_agent`.

- `getAthletes`, `searchAthlete`, `filterAthletes`, `getCoaches`
- `getAthleteStats`, `getTeamAnalytics`, `getAchievements`
- `getGarminActivities`, `getAthleteWearableInsight`, `getTeamActivityLeaderboard`
- `getTrainingSessions`, `getTrainingPlans`, `getTrainingReports`, `getSessionFeedback`
- `getUpcomingTournaments`, `getCompetitionResults`, `getInjuries`, `getPSEScores`, `getPerformanceTests`
- `getAthleteGoals`, `getObservations`, `getAthleteMemories`, `getAlerts`
- Specialist suite (already Python): labs / biomarker / genetics / CGM / tennis matches / evolution
- Athlete/parent **read** equivalents as scoped wrappers over the same functions

**Why:** powers daily Q&A; low blast radius; aligns with existing Python registry work (`06`, `08`).

### Tier B — Stay in TypeScript behind HTTP bridge

Mutators and Next-coupled side effects.

- All messaging (`send*`, `announce*`, `broadcast*`, athlete/parent send)
- `createPlayer` / invitations / `assignPlayerToCoach` (`playerSupport` + email)
- Tournament create/update/delete/register/unregister
- Training session/plan/report writes + attendance + auto-summarize
- Injury/goal/observation/group/periodization/HIIT/series/PSE writes
- Excel report exporters (`ReportGenerator`)
- Hard-confirmed deletes (bridge with confirmation policy)

**Why:** admin client, email, storage URLs, Realtime messaging, confirmation UX stay closer to the Next app; Python orchestrator calls TS endpoints with service auth.

### Tier C — Drop or collapse

- `confirmActionTool` as currently implemented (prompt-only meta) — replace with real policy
- Duplicate athlete/parent tool **implementations** (keep names if needed for prompts; collapse code)
- Periodization / HIIT / series **if** product analytics show near-zero usage (confirm before delete)
- Any specialist TS wrapper that merely proxies Python once the agent owns tool-calling directly (optional later cleanup)

---

## 10. Full per-tool table

Columns: **RW** = read-only · **MU** = mutating · **SX** = side-effect export · **META** = meta.  
**Role:** C = coach/admin set · A = athlete set · P = parent set · S = specialist (C+A analytics).  
**Confirm:** `soft` = listed in `confirmAction` enum · `hard` = `confirmed` param · `—` = none.

| # | Tool export | Module | Class | Role | Confirm | Migration tier |
|--:|-------------|--------|:-----:|:----:|---------|----------------|
| 1 | `getAchievementsTool` | achievementTools | RW | C | — | A |
| 2 | `getAlertsTool` | alertTools | RW | C | — | A |
| 3 | `dismissAlertTool` | alertTools | MU | C | soft | B |
| 4 | `getAthleteStatsTool` | analyticsTools | RW | C | — | A |
| 5 | `getTeamAnalyticsTool` | analyticsTools | RW | C | — | A |
| 6 | `rememberAboutAthleteTool` | athleteMemoryTools | MU | C | — | B |
| 7 | `getAthleteMemoriesTool` | athleteMemoryTools | RW | C | — | A |
| 8 | `forgetAthleteMemoryTool` | athleteMemoryTools | MU | C | hard | B |
| 9 | `getMyPerformanceTestsTool` | athleteTools | RW | A | — | A (wrapper) |
| 10 | `getMyStatsTool` | athleteTools | RW | A | — | A (wrapper) |
| 11 | `getMyCompetitionResultsTool` | athleteTools | RW | A | — | A (wrapper) |
| 12 | `getMyTrainingSessionsTool` | athleteTools | RW | A | — | A (wrapper) |
| 13 | `getMyTrainingPlanTool` | athleteTools | RW | A | — | A (wrapper) |
| 14 | `getMyGoalsTool` | athleteTools | RW | A | — | A (wrapper) |
| 15 | `getMyInjuriesTool` | athleteTools | RW | A | — | A (wrapper) |
| 16 | `getMyWellnessScoresTool` | athleteTools | RW | A | — | A (wrapper) |
| 17 | `getMyGarminActivitiesTool` | athleteTools | RW | A | — | A (wrapper) |
| 18 | `getMyAchievementsTool` | athleteTools | RW | A | — | A (wrapper) |
| 19 | `getMyTournamentsTool` | athleteTools | RW | A | — | A (wrapper) |
| 20 | `getMySeriesTrainingsTool` | athleteTools | RW | A | — | A (wrapper) |
| 21 | `getMyHIITTrainingsTool` | athleteTools | RW | A | — | A (wrapper) |
| 22 | `submitSessionFeedbackTool` | athleteTools | MU | A | — | B |
| 23 | `updateMyGoalProgressTool` | athleteTools | MU | A | — | B |
| 24 | `recordMyPSEScoreTool` | athleteTools | MU | A | — | B |
| 25 | `sendMyMessageTool` | athleteTools | MU | A | soft* | B |
| 26 | `getMyConversationsTool` | athleteTools | RW | A | — | A (wrapper) |
| 27 | `createCompetitionResultTool` | competitionTools | MU | C | soft | B |
| 28 | `getCompetitionResultsTool` | competitionTools | RW | C | — | A |
| 29 | `confirmActionTool` | confirmationTools | META | C | n/a | C (replace) |
| 30 | `filterAthletesTool` | filterAthleteTools | RW | C | — | A |
| 31 | `getGarminActivitiesTool` | garminActivityTools | RW | C | — | A |
| 32 | `createAthleteGoalTool` | goalTools | MU | C | — | B |
| 33 | `getAthleteGoalsTool` | goalTools | RW | C | — | A |
| 34 | `updateAthleteGoalTool` | goalTools | MU | C | — | B |
| 35 | `deleteAthleteGoalTool` | goalTools | MU | C | — | B |
| 36 | `createHIITTrainingTool` | hiitTrainingTools | MU | C | soft | B / C? |
| 37 | `getHIITTrainingsTool` | hiitTrainingTools | RW | C | — | A / C? |
| 38 | `createInjuryTool` | injuryTools | MU | C | soft | B |
| 39 | `getInjuriesTool` | injuryTools | RW | C | — | A |
| 40 | `updateInjuryTool` | injuryTools | MU | C | soft | B |
| 41 | `deleteInjuryTool` | injuryTools | MU | C | hard | B |
| 42 | `sendInvitationTool` | invitationTools | MU | C | — | B |
| 43 | `getPendingInvitationsTool` | invitationTools | RW | C | — | B |
| 44 | `assignPlayerToCoachTool` | invitationTools | MU | C | — | B |
| 45 | `getCoachAssignmentsTool` | invitationTools | RW | C | — | B |
| 46 | `sendMessageTool` | messagingTools | MU | C | soft | B |
| 47 | `getConversationsTool` | messagingTools | RW | C | — | B |
| 48 | `getConversationThreadTool` | messagingTools | RW | C | — | B |
| 49 | `sendGroupMessageTool` | messagingTools | MU | C | — | B |
| 50 | `announceToAllTool` | messagingTools | MU | C | — | B |
| 51 | `broadcastToParentsTool` | messagingTools | MU | C | — | B |
| 52 | `createObservationTool` | observationTools | MU | C | — | B |
| 53 | `getObservationsTool` | observationTools | RW | C | — | A |
| 54 | `updateObservationTool` | observationTools | MU | C | — | B |
| 55 | `deleteObservationTool` | observationTools | MU | C | — | B |
| 56 | `getMyChildrenTool` | parentTools | RW | P | — | A (wrapper) |
| 57 | `getChildStatsTool` | parentTools | RW | P | — | A (wrapper) |
| 58 | `getChildPerformanceTestsTool` | parentTools | RW | P | — | A (wrapper) |
| 59 | `getChildTrainingScheduleTool` | parentTools | RW | P | — | A (wrapper) |
| 60 | `getChildTournamentsTool` | parentTools | RW | P | — | A (wrapper) |
| 61 | `sendMessageToCoachTool` | parentTools | MU | P | — | B |
| 62 | `createShockMicrocycleTool` | periodizationTools | MU | C | soft | B / C? |
| 63 | `getShockMicrocyclesTool` | periodizationTools | RW | C | — | A / C? |
| 64 | `updateShockMicrocycleTool` | periodizationTools | MU | C | soft | B / C? |
| 65 | `createTransitionPeriodTool` | periodizationTools | MU | C | soft | B / C? |
| 66 | `getTransitionPeriodsTool` | periodizationTools | RW | C | — | A / C? |
| 67 | `updateTransitionPeriodTool` | periodizationTools | MU | C | soft | B / C? |
| 68 | `createPlayerGroupTool` | playerGroupTools | MU | C | soft | B |
| 69 | `getPlayerGroupsTool` | playerGroupTools | RW | C | — | A |
| 70 | `addPlayersToGroupTool` | playerGroupTools | MU | C | — | B |
| 71 | `removePlayersFromGroupTool` | playerGroupTools | MU | C | — | B |
| 72 | `updatePlayerGroupTool` | playerGroupTools | MU | C | soft | B |
| 73 | `deletePlayerGroupTool` | playerGroupTools | MU | C | soft | B |
| 74 | `getAthletesTool` | queryTools | RW | C | — | A |
| 75 | `searchAthleteTool` | queryTools | RW | C | — | A |
| 76 | `createPlayerTool` | queryTools | MU | C | soft | B |
| 77 | `createPerformanceTestTool` | queryTools | MU | C | — | B |
| 78 | `updateAthleteNotesTool` | queryTools | MU | C | soft | B |
| 79 | `updatePlayerTool` | queryTools | MU | C | soft | B |
| 80 | `deletePlayerTool` | queryTools | MU | C | hard+soft | B |
| 81 | `getPerformanceTestsTool` | queryTools | RW | C | — | A |
| 82 | `updatePlayerDetailsTool` | queryTools | MU | C | soft | B |
| 83 | `getCoachesTool` | queryTools | RW | C | — | A |
| 84 | `generateProgressReportTool` | reportExportTools | SX | C | — | B |
| 85 | `generateClubOverviewReportTool` | reportExportTools | SX | C | — | B |
| 86 | `createSeriesTrainingTool` | seriesTrainingTools | MU | C | soft | B / C? |
| 87 | `getSeriesTrainingsTool` | seriesTrainingTools | RW | C | — | A / C? |
| 88 | `getSessionFeedbackTool` | sessionFeedbackTools | RW | C | — | A |
| 89 | `respondToFeedbackTool` | sessionFeedbackTools | MU | C | — | B |
| 90 | `getLabPanelsTool` | specialistTools | RW | S | — | A (already Python) |
| 91 | `getBiomarkerTrendTool` | specialistTools | RW | S | — | A (already Python) |
| 92 | `getGeneticTraitsTool` | specialistTools | RW | S | — | A (already Python) |
| 93 | `getCgmScoresTool` | specialistTools | RW | S | — | A (already Python) |
| 94 | `getTennisMatchesTool` | specialistTools | RW | S | — | A (already Python) |
| 95 | `getTennisEvolutionTool` | specialistTools | RW | S | — | A (already Python) |
| 96 | `createTournamentTool` | tournamentTools | MU | C | soft | B |
| 97 | `getUpcomingTournamentsTool` | tournamentTools | RW | C | — | A |
| 98 | `updateTournamentTool` | tournamentTools | MU | C | soft | B |
| 99 | `deleteTournamentTool` | tournamentTools | MU | C | soft | B |
| 100 | `unregisterAthleteTool` | tournamentTools | MU | C | soft | B |
| 101 | `registerAthleteTool` | tournamentTools | MU | C | soft | B |
| 102 | `registerMeForTournamentTool` | tournamentTools | MU | C+A | — | B |
| 103 | `getTrainingPlansTool` | trainingPlanTools | RW | C | — | A |
| 104 | `updateTrainingPlanTool` | trainingPlanTools | MU | C | soft | B |
| 105 | `deleteTrainingPlanTool` | trainingPlanTools | MU | C | soft | B |
| 106 | `generateTrainingPlanTool` | trainingPlanTools | MU | C | soft | B |
| 107 | `generatePlanFromDescriptionTool` | trainingPlanTools | MU | C | hard | B |
| 108 | `getTrainingReportsTool` | trainingReportTools | RW | C | — | A |
| 109 | `updateTrainingReportTool` | trainingReportTools | MU | C | soft | B |
| 110 | `deleteTrainingReportTool` | trainingReportTools | MU | C | hard+soft | B |
| 111 | `createTrainingReportTool` | trainingReportTools | MU | C | soft | B |
| 112 | `autoSummarizeSessionTool` | trainingReportTools | MU | C | — | B |
| 113 | `getTrainingSessionsTool` | trainingSessionTools | RW | C | — | A |
| 114 | `updateTrainingSessionTool` | trainingSessionTools | MU | C | soft | B |
| 115 | `deleteTrainingSessionTool` | trainingSessionTools | MU | C | soft | B |
| 116 | `createTrainingSessionTool` | trainingSessionTools | MU | C | soft | B |
| 117 | `recordAttendanceTool` | trainingSessionTools | MU | C | soft | B |
| 118 | `getAthleteWearableInsightTool` | wearableInsightTools | RW | C | — | A |
| 119 | `getTeamActivityLeaderboardTool` | wearableInsightTools | RW | C | — | A |
| 120 | `createPSEScoreTool` | wellnessTools | MU | C | soft | B |
| 121 | `getPSEScoresTool` | wellnessTools | RW | C | — | A |

\* `send_message` appears in `confirmAction` enum; athlete/parent sends are not separately listed.

`C?` = validate usage before investing; candidates for drop if unused.

---

## 11. Registry wiring summary (`toolRouter.ts`)

When all coach categories are loaded, approximate live keys:

- **Core (always):** `confirmAction`, `getAthletes`, `searchAthlete`
- **athletes:** goals, observations, player CRUD/notes, memories, filter, player groups (~24)
- **training:** sessions, plans, reports, feedback, attendance, exports, auto-summarize (~19)
- **competition:** tournaments + results (~8)
- **analytics:** stats, garmin, wearables, achievements + **6 specialist** (~12)
- **communication:** alerts + messaging (~8)
- **specialized_training:** injury, PSE, HIIT, series, periodization, performance tests (~18)
- **admin:** invitations, assignments, coaches (~5)

Athlete and parent sets are separate maps (see §6).

---

## 12. Bottom line for migration planners

1. **121 tools**, not ~115 — include athlete/parent/specialist modules outside `index.ts`.
2. **61 mutators** are the compliance/risk set; bridge them until Python has authz + confirmation parity.
3. Convention is **AI SDK `tool()` + Zod `parameters`**; mirror descriptions and success envelopes.
4. Confirmation is **split-brained**: soft meta tool (UI unwired) + 5 hard `confirmed` gates.
5. Role restriction is **router-level assembly**, plus coach roster scoping on discovery tools.
6. Port **reads first (Tier A)**; keep **writes/messaging/invites/reports in TS (Tier B)**; **collapse duplicates and soft confirm (Tier C)**.
