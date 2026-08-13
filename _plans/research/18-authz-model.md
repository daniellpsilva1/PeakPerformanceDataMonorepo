# Research Dossier 18 — Identity & Authorization Model

**Scope:** Read-only audit of the Peak Performance Data identity, multi-tenancy, and authorization model for a multi-agent system that must act on behalf of `player`, `coach`, `parent`, `club_admin`, and `admin` users.

**Primary surfaces:** Supabase schema/RLS, Next.js middleware + API auth wrappers, AI agent tool router, Python `ppp_ai_agent` auth middleware.

**Date of analysis:** 2026-08-02

**Constraint:** No application code was modified. This file is the only write.

---

## Sources analyzed

| Path | Role |
|------|------|
| `src/lib/utils/roleUtils.ts` | Canonical role enum |
| `src/lib/supabase/database.types.ts` | Generated table/column schema |
| `src/middleware.ts`, `src/middleware/auth.ts`, `src/middleware/authorization.ts` | Edge authz / org isolation |
| `src/lib/api/with-auth.ts` | API route auth wrappers |
| `src/lib/supabase/server.ts`, `admin-client.ts`, `service.ts` | Session vs service-role clients |
| `src/hooks/auth/useUser.ts` | Client identity hook |
| `src/app/api/ai-agent/route.ts`, `src/lib/ai/utils/toolRouter.ts` | AI coach scoping |
| `src/lib/ai/tools/{queryTools,filterAthleteTools,parentTools}.ts` | Tool-level scope filters |
| `src/lib/supabase/queries/organizationAwareQueries.ts` | UI assignment helpers |
| `src/lib/api/parent-child-auth.ts`, `src/lib/tennis/match-access.ts` | Parent/coach resource checks |
| `supabase/migrations/20260221_fix_*_rls*.sql` | Core RLS rewrite |
| `supabase/migrations/20260202_get_full_user_context.sql` | Role context RPC |
| `supabase/migrations/20260426_minor_account_support.sql` | Managed/minor players |
| `PeakPerformanceData/ppp_ai_agent/api/middleware/auth.py` | Python JWT verification |

---

## 1. Role enum (exact)

Canonical list in `src/lib/utils/roleUtils.ts` L28:

```ts
export const VALID_ROLES = ['player', 'parent', 'coach', 'club_admin', 'admin'] as const;
```

Legacy alias: `athlete` → `player` via `normalizeRole()` (L9–22).

Stored on:

| Location | Field | Notes |
|----------|-------|-------|
| `profiles.role` | `string \| null` | **DB source of truth** (middleware comment L18–20 of `authorization.ts`) |
| JWT `user.user_metadata.role` | string | Snapshot; can be stale after role change |
| JWT `user.user_metadata.organization_id` | uuid string | Used heavily by RLS |
| JWT `user.user_metadata.is_club_admin` / `is_organization_admin` | boolean | Used by some RLS / middleware |
| JWT `user.user_metadata.available_roles` | string[] | Multi-role switcher |
| `profiles.is_club_admin` | boolean \| null | Parallel flag; not the primary role enum |

There is **no Postgres enum type** in migrations audited; role is free-form `text` constrained by app code.

### What each role can see / do (intended product model)

| Role | Home surface | Athlete visibility | Org scope |
|------|--------------|--------------------|-----------|
| `player` | `/player/*` | Self only | Own `profiles.organization_id` |
| `parent` | `/parent/*` | Approved children only | Own org; children usually same org |
| `coach` | `/coach/*` | **Assigned players** via `coach_player_assignments` | Own org; UI is assignment-scoped |
| `club_admin` | `/club-admin/*`, `/management/*` | All players in org | Org-wide |
| `admin` | `/admin/*` | Cross-org (system) | Exempt from brand org isolation |

Path gates (`src/middleware/authorization.ts`):

- `/admin`, `/admin-test` → `admin` only (L42–47)
- `/club-admin` → `club_admin` only (L51–56)
- `/parent` → `parent` (L61–66)
- `/player` → `player` (L70–75)
- `/coach` → `coach` (L79–84)

Note: `/management` is **not** in `authorization.ts` role gates. Access is enforced at page/API level (e.g. families page allows `admin|club_admin|coach` at L33–36 of `management/families/page.tsx`). Shared tools like `/charts`, `/exploration` are protected-auth but not role-prefixed.

---

## 2. Identity derivation (Next.js)

### Middleware (pages)

`src/middleware.ts` orchestrates:

1. intl → CORS → skip `/api/*` and static (L64–72) — **API routes do their own auth**
2. Brand resolution + `supabase.auth.getSession()` in parallel
3. Optional `getUser()` every 30 min (`ppd-session-validated` cookie, L136–141)
4. Profile cache / JWT metadata / DB profile for `role` + `organization_id` (`middleware/auth.ts` L264–295)
5. Org isolation: non-`admin` users whose org ≠ brand org are redirected (`auth.ts` L303–332)
6. Role path checks (`handleAuthorization`)
7. Downstream headers: `x-middleware-user-id`, `-role`, `-org`, `-org-name`, `-org-admin`, `-roles` (`auth.ts` L120–151)

### Server Components

`getServerUserFast()` (`src/lib/supabase/server.ts` L14–28): cookie session via `getSession()` — no network round-trip. Relies on middleware having validated recently.

### API routes

| Helper | File | Behavior |
|--------|------|----------|
| `createRouteClient()` | `server.ts` L35–58 | Anon key + cookies (RLS applies) |
| `getRouteUserFast()` | `server.ts` L68–72 | Session user from cookie |
| `withAuth` | `with-auth.ts` L146–167 | Requires session user |
| `withAdminAuth` | L183–211 | JWT metadata `role === 'admin'` |
| `withCoachAuth` | L228–258 | metadata role in `admin\|club_admin\|coach` |
| `withOrgMemberAuth` | L281+ | Loads `profiles` and checks `organization_id` or `admin` |

AI chat route derives identity **server-side only** from session + `profiles` (`ai-agent/route.ts` L36–70) — does not trust body for `userId` / `organizationId` / `role`.

### Client

`useUser()` (`src/hooks/auth/useUser.ts`) reads `UserContextProvider` (role, org, profile). Not authoritative for authorization.

---

## 3. Relationship tables (exact join conditions)

### 3.1 Coach → athletes

**Table:** `public.coach_player_assignments`

| Column | Type (generated) | Purpose |
|--------|------------------|---------|
| `id` | uuid | PK |
| `coach_id` | uuid \| null → `profiles.id` | Coach |
| `player_id` | uuid \| null → `profiles.id` | Athlete |
| `organization_id` | uuid \| null → `organizations.id` | Tenant |
| `assigned_by` | uuid \| null → `profiles.id` | Who created link |
| `active` | boolean \| null | Soft enable |
| `created_at` | timestamptz | |

**Canonical join for “athletes this coach can see”:**

```sql
SELECT cpa.player_id
FROM coach_player_assignments cpa
WHERE cpa.coach_id = :coach_id
  AND cpa.active = true          -- UI / RLS / RPCs use this
  AND cpa.organization_id = :organization_id  -- preferred when available
```

Evidence:

- UI players page: `.eq('coach_id', coachId).eq('active', true)` — `coach/players/page.tsx` L38–53
- Query helper: `getAssignedAthletes` — `organizationAwareQueries.ts` L92–112
- RPC `get_full_user_context`: `cpa.coach_id = p_user_id AND cpa.active = true` — migration L145
- Tennis access: `.eq('coach_id', userId).eq('player_id', match.user_id).eq('active', true)` — `match-access.ts` L33–38
- RLS examples: `cpa.coach_id = auth.uid() AND cpa.player_id = <athlete> AND cpa.active = true` — e.g. `hiit_trainings` part2 L42–47

**Schema drift (critical):** Generated types expose `active: boolean` only. Application AI/invitation code also reads/writes `status` (`'active'`) — e.g. `ai-agent/route.ts` L126 `.eq('status', 'active')`, `invitationTools.ts` L193–230. Treat **`active = true`** as the authoritative filter for the agent; treat `status` as drifted/optional until types are regenerated.

**Null `active`:** Some API paths treat null as active (`.or('active.eq.true,active.is.null')` — e.g. `graph-pool/route.ts` L49, coach dashboard comments). Prefer matching that OR semantics for compatibility.

### 3.2 Parent → children

**Table:** `public.parent_child_relationships`

| Column | Type (generated) | Purpose |
|--------|------------------|---------|
| `id` | uuid | PK |
| `parent_id` | uuid \| null → `profiles.id` | Parent |
| `child_id` | uuid \| null → `profiles.id` | Child athlete |
| `relationship_type` | string \| null | e.g. mother/father |
| `status` | string \| null | `pending` \| `approved` \| `rejected` |
| `approved` | boolean \| null | Legacy flag |
| `created_at` | timestamptz | |

**No `organization_id` column** — tenant is inferred via parent/child `profiles.organization_id`.

**Canonical join for “children this parent can see” (read/write of athlete data):**

```sql
SELECT pcr.child_id
FROM parent_child_relationships pcr
WHERE pcr.parent_id = :parent_id
  AND (
    pcr.status = 'approved'
    OR pcr.approved = true
    OR pcr.status IS NULL   -- legacy rows
  )
```

Authoritative helper: `isApprovedParentOfChild` — `src/lib/api/parent-child-auth.ts` L17–36.

AI parent tools use `.eq('status', 'approved')` only (`parentTools.ts` L20, L45, L70) — slightly stricter than the helper (ignores legacy null/`approved` flag).

**RLS note:** Parent SELECT on `parent_child_relationships` allows any row where caller is parent or child, **without** requiring `status = 'approved'` (part6 L18–22). App filters enforce approval for data access. Tennis RLS parent policies also omit status filter (scorekeeper fixes L28–33) — possible over-broad parent visibility at RLS layer for pending links.

### 3.3 Player groups (secondary roster structure)

| Table | Key columns |
|-------|-------------|
| `player_groups` | `id`, `name`, `organization_id` (required), `created_by` |
| `player_group_members` | `group_id` → `player_groups.id`, `player_id` → `profiles.id` |

Groups are **org-scoped**, not coach-assignment-scoped. Coaches/club_admins can manage via RLS role check (part3 L8–12, part6 L55–70). Agent must not treat group membership as a substitute for coach assignment when acting as a coach.

### 3.4 Invitations & managed / minor players

| Table / column | Purpose |
|----------------|---------|
| `organization_invitations` | `invitee_email`, `role`, `organization_id`, `token`, `status`, `invited_by`, `target_profile_id`, `accepted`, `expires_at` |
| `profiles.claim_token` / `claim_token_expires_at` | Claim placeholder accounts |
| `profiles.created_by_parent_id` | Parent-created minor placeholder (`20260426_minor_account_support.sql`) |
| `member_requests` | Self-serve join requests (`user_id`, `organization_id`, `role`, `status`) |
| `coach_requests` | Coach approval workflow (`user_id`, `organization_id`, `status`) |

Managed players: parent creates child profile (often without email) + auto-approved `parent_child_relationships`; later upgraded via claim or invitation `target_profile_id` → `complete_account_claim()`.

### 3.5 Membership model

There is **no** separate `organization_members` table in generated types. Membership = `profiles.organization_id` pointing at `organizations.id`. Org admin is `organizations.admin_user_id` (and/or role `club_admin` / `is_club_admin`).

---

## 4. Coach scoping verdict — UI vs AI vs RLS

### Prior claim

> “AI is org-wide while the UI is assignment-scoped.”

### Verdict (2026-08-02 evidence)

**Partially outdated. Nuanced:**

| Layer | Coach athlete scope | Evidence |
|-------|---------------------|----------|
| **UI roster / dashboards** | **Assignment-scoped** | `coach/players/page.tsx` L38–53; `getAssignedAthletes` L92–112; `get_full_user_context` coach branch L127–145 |
| **AI discovery tools** (`getAthletes`, `searchAthlete`, `filterAthletes`) | **Intended assignment-scoped** | `ai-agent/route.ts` L119–137 loads `assignedPlayerIds` for `userRole === 'coach'`; `toolRouter.ts` L176–179, L185–195; tools apply `.in('id', playerIds)` when non-null |
| **AI discovery load bug** | May collapse to **empty set** | Route filters `.eq('status', 'active')` (L126) but schema/types use boolean `active` — risk that coaches get `[]` scope (denies all) or, if query fails silently, inconsistent behavior |
| **AI non-discovery tools** | **Often org-wide in practice** | Tools like injuries/analytics filter by `organization_id` + athlete name only; `playerScope` is **not** passed into most factories (`toolRouter.ts` L188–302). RLS then decides: some tables assignment-scoped (`injuries`, `hiit_trainings`), many allow any JWT `role = 'coach'` (`performance_tests` part6 L36–38; `shock_microcycles` / `transition_periods` / `series_training_*` part3/5; `competitions` part1 L69–71) |
| **profiles RLS** | **Org-wide read for any same-org user** | `20260221_fix_profiles_rls_use_jwt_claims.sql` L11–14 — assignment clause is OR, not AND |
| **group_training / tournaments / training_plans RLS** | **Org-wide** for same JWT org | part2 L5–7; part4 L5–47 |
| **App routes using service role** | **Bypass RLS**; must re-implement checks | e.g. `graph-pool/route.ts` `canAccessAthlete` L80–104 — coach allowed if assigned **OR** same org (L93–96), then **any** same-org role at L102 |

**Bottom line for the agent system:** Replicate **UI assignment semantics** for coaches (`coach_player_assignments.active = true`), not the looser RLS/`role='coach'` policies. Do not assume RLS alone will keep coaches inside their roster — especially when using service role.

---

## 5. RLS vs application-level filtering

### Pattern

The app uses a **hybrid**:

1. **RLS** (JWT claims) as a backstop for anon/authenticated clients
2. **Application filters** (assignment / parent link / org id) as the product truth
3. **Service role** extensively for admin/invite/parent/AI support paths — **RLS bypassed**; app must authorize

### RLS themes (core athlete data)

| Table | SELECT pattern | Coach scope in RLS |
|-------|----------------|--------------------|
| `profiles` | self OR same JWT org OR assignment OR parent link | Org-wide |
| `coach_player_assignments` | coach, player, parent of player, admin, club_admin in org | N/A |
| `parent_child_relationships` | parent, child, or admin | N/A |
| `injuries`, `hiit_trainings` | self / admin / **assignment** | Assignment |
| `tennis_specific_tests` | assignment or admin | Assignment |
| `performance_tests` | self or `role = 'coach'` | **Org-wide by role** |
| `shock_microcycles`, `transition_periods`, `series_training_*` | self or `role = 'coach'`/`admin` | **Org-wide by role** |
| `group_training_*`, `tournaments`, `training_plans`, `training_reports`, `player_groups`, `player_pse_scores` | JWT `organization_id` match | Org-wide |
| `competitions` | self or `role in (coach, admin)` | Org-wide by role (no org_id on table) |
| `tennis_matches` (+ children) | owner; coach via assignment policies; parent via child link | Assignment / parent link |
| `player_details` | self or admin | Coaches may need service role / app path |

**Conclusion:** Do not rely on RLS for the agent authorization layer. Implement explicit `can()` checks. Prefer user-scoped Supabase clients when possible; when using service role, every query must be pre-authorized.

---

## 6. Service-role usage in the Next.js app (RLS bypass risk)

Factory:

- `createAdminClient()` — `src/lib/supabase/admin-client.ts` L15–32 (`SUPABASE_SERVICE_ROLE_KEY`)
- `supabaseServiceRole` proxy — `src/lib/supabase/service.ts` L11–49

**~100 files under `src/`** import/use service role (enumerated via ripgrep). High-risk categories:

| Category | Examples | Risk |
|----------|----------|------|
| Auth / invite / claim | `invitations/*`, `claim-account`, `invitationAccounts.ts`, `create-member-request`, `create-coach-request` | Necessary for user creation; must validate caller |
| Org admin mutations | `organizations/[id]/assignments`, `update-user-role`, `update-coach-request` | Privilege escalation if caller checks weak |
| Parent flows | `parent-child-relationships/*`, `parent/children/create`, `parent/available-players` | Cross-family leak if relationship not checked |
| AI tools | `playerSupport.ts`, `messagingTools.ts`, `messagingSupport.ts`, `queryTools.ts` (create path) | Agent can act beyond roster if tools skip checks |
| Tennis | `match-access.ts`, video upload/cleanup, share links, watch tokens | Token/assignment checks required |
| Dashboards / stats | `dashboard/admin/*`, `management/stats`, `organizations/current/{players,coaches,parents}` | Org filter must be explicit |
| Cron / jobs | `cron/cleanup-conversations`, `get-job-status` | Should use cron secret, not user JWT |
| Storage | `upload/logo`, feedback attachments | Bucket ACL bypass |
| Services | `AlertEngine`, `ReportGenerator`, `AchievementSystem`, `brand-service` | Background jobs; org scoping in code |

**Risk summary:** Any bug in app-level checks with service role = full DB access. The multi-agent system must **never** treat service-role success as authorization success.

---

## 7. Multi-tenancy / cross-org leakage

### Tables WITH `organization_id` (generated types sample)

`profiles`, `coach_player_assignments`, `player_groups`, `organization_invitations`, `tournaments`, `tournament_registrations`, `training_plans`, `training_reports`, `group_training_sessions`, `conversations`, `ai_*`, `coach_observations`, `coach_requests`, `member_requests`, `player_goals`, `player_pse_scores`, `user_alerts`, `user_feedback`, `tennis_match_share_links`, …

### Tables WITHOUT `organization_id` (leakage surface)

Including: `parent_child_relationships`, `performance_tests`, `injuries`, `hiit_trainings`, `competitions`, `tennis_matches` (+ child tables), `garmin_connect_accounts`, `series_training_*`, `shock_microcycles`, `transition_periods`, `player_details`, `player_group_members`, `messages`, `conversation_participants`, …

Tenant isolation for these depends on:

1. Joining through `profiles.organization_id`, or
2. RLS role/assignment predicates, or
3. App filters when using service role

### Concrete leakage vectors

1. **Service role + missing org filter** — list by athlete id alone (known issue in Python tennis tools per dossier 07).
2. **RLS `role = 'coach'` without org predicate** — any coach JWT can read all rows on those tables globally if PostgREST returns them (no org column to constrain).
3. **`profiles` same-org SELECT** — coaches can read all org profile rows even for unassigned players.
4. **`graph-pool` org fallback** — coaches allowed org-wide athlete access when using that API (`canAccessAthlete` L93–96, L102).
5. **Parent RLS without status** — pending relationships may grant tennis match visibility.
6. **Brand isolation** is middleware-only for pages; APIs skipped by middleware must re-check org.

---

## 8. How a Python service should authenticate a user

Existing implementation: `PeakPerformanceData/ppp_ai_agent/api/middleware/auth.py`.

### Supported paths

1. **Internal BFF secret** — header `x-internal-service: <INTERNAL_SERVICE_SECRET>`  
   - Sets `user_id` / `organization_id` / `role` to `None`  
   - Caller (Next.js) must pass actor context in the body and enforce authz itself

2. **User access token (recommended for user-acting agents)**  
   - Client sends `Authorization: Bearer <supabase_access_token>`  
   - Server calls Supabase Auth: `GET {SUPABASE_URL}/auth/v1/user` with that bearer + `apikey`  
   - On success, load `profiles` for `organization_id` + `role` (service role REST)  
   - Evidence: `auth.py` L63–111

### Alternatives (available but not the current primary path)

| Method | Notes |
|--------|-------|
| Local JWT verify with `SUPABASE_JWT_SECRET` (HS256) | Faster; no `/auth/v1/user` round-trip; must keep secret synced |
| JWKS / asymmetric (`/.well-known/jwks.json`) | Only if project uses JWT signing keys; not implemented in current agent |
| Shared secret alone | Only for trusted machine-to-machine; **not** user identity |

**Recommendation for new multi-agent system:**

- Prefer verifying the user’s Supabase access token (either `/auth/v1/user` or local JWT verify with JWT secret).
- Always reload `profiles.role` + `profiles.organization_id` as source of truth (do not trust stale JWT metadata alone).
- Load scope sets: assigned player ids / approved child ids.
- Never accept client-supplied `organization_id` / `athlete_id` without `can()` checks — especially on internal-secret path.

---

## 9. Specification: agent authorization layer

### 9.1 Actor model

```ts
type Role = 'player' | 'parent' | 'coach' | 'club_admin' | 'admin'

type Actor = {
  userId: string                 // profiles.id / auth.users.id
  role: Role                     // from profiles.role (normalized)
  organizationId: string | null  // from profiles.organization_id
  assignedPlayerIds?: string[]   // coach: active assignments
  childIds?: string[]            // parent: approved children
  isSystemAdmin: boolean         // role === 'admin'
}
```

### 9.2 Resource model (minimum)

```ts
type Resource =
  | { type: 'organization'; id: string }
  | { type: 'athlete'; id: string; organizationId?: string }
  | { type: 'athlete_data'; athleteId: string; kind: DataKind; id?: string }
  | { type: 'conversation'; id: string; organizationId: string }
  | { type: 'invitation'; id: string; organizationId: string }
  | { type: 'player_group'; id: string; organizationId: string }
  | { type: 'tool'; name: string }

type Action =
  | 'read' | 'list' | 'create' | 'update' | 'delete'
  | 'invite' | 'assign' | 'message' | 'export' | 'admin'
```

### 9.3 Policy function

```ts
function can(actor: Actor, action: Action, resource: Resource): boolean
```

Required companion APIs:

```ts
async function resolveActor(accessToken: string): Promise<Actor>
async function assertCan(actor: Actor, action: Action, resource: Resource): Promise<void> // throws 403
function athleteScope(actor: Actor): 'self' | 'children' | 'assigned' | 'org' | 'global'
```

### 9.4 Exact scope rules (must match product)

| Actor role | `list athletes` | `read/write athlete_data` for athlete A |
|------------|-----------------|------------------------------------------|
| `player` | `{ self }` | A === actor.userId |
| `parent` | approved `child_id`s | A ∈ childIds (approved semantics) |
| `coach` | `player_id`s where `coach_id = actor` AND (`active = true` OR `active IS NULL`) AND preferably same `organization_id` | A ∈ assignedPlayerIds AND same org |
| `club_admin` | all `profiles` with `role='player'` and `organization_id = actor.organizationId` | A.organizationId === actor.organizationId |
| `admin` | global | allow (audit heavily) |

**Join recipes agents must use:**

Coach scope load:

```sql
-- preferred
SELECT player_id FROM coach_player_assignments
WHERE coach_id = :actor_id
  AND organization_id = :org_id
  AND (active = true OR active IS NULL);
```

Parent scope load:

```sql
SELECT child_id FROM parent_child_relationships
WHERE parent_id = :actor_id
  AND (status = 'approved' OR approved = true OR status IS NULL);
```

### 9.5 Where to enforce (per tool call, not just per request)

| Enforcement point | Requirement |
|-------------------|-------------|
| HTTP/request middleware | Authenticate → `resolveActor` → attach to request context |
| **Every tool invocation** | Before DB/ClickHouse call: `assertCan(actor, action, resource)` with concrete `athleteId` / `organizationId` |
| Tool factories | Bind `actor` + scope ids; refuse tools outside role allow-list (`toolRouter` pattern) |
| Discovery tools | Hard-filter query with scope id list (`IN (...)`); empty list → empty result, not org-wide |
| Write tools | Resolve athlete by name **inside scope only**; never org-wide name search for coaches/parents |
| Service-role / internal secret path | Same `can()` — secret authenticates the **service**, not the user |
| Streaming multi-step agents | Re-check on each tool step (agent may invent new athlete ids mid-chain) |
| Memory / RAG retrieval | Filter by `organization_id` + athlete scope before injecting into prompt |

### 9.6 Tool category allow-list (align with current router)

Already partially implemented in `toolRouter.ts`:

- `player`/`athlete` → personal tools only
- `parent` → child tools only
- `coach` → full coach tool set + `playerScope`
- `club_admin`/`admin` → org-wide (`assignedPlayerIds = null`)

**Gaps to close in the new system:**

1. Pass `playerScope` into **all** coach tools that touch athlete-keyed data (injuries, stats, garmin, tennis, labs, goals, observations, reports, etc.), not only discovery tools.
2. Fix assignment load to filter `active` (boolean), not `status`.
3. Deny coach access to unassigned athletes even if RLS would allow.
4. On Python service-role queries, require `organization_id` AND athlete membership in scope for every path.
5. Treat `announceToAll` / org-wide messaging as `club_admin`/`admin` (or explicit permission), not default coach.

### 9.7 Suggested `can()` pseudocode

```ts
function can(actor: Actor, action: Action, resource: Resource): boolean {
  if (actor.isSystemAdmin) return true

  if (resource.type === 'organization') {
    return actor.organizationId === resource.id
  }

  if (resource.type === 'athlete' || resource.type === 'athlete_data') {
    const athleteId = resource.type === 'athlete' ? resource.id : resource.athleteId
    switch (actor.role) {
      case 'player':
        return athleteId === actor.userId
      case 'parent':
        return actor.childIds?.includes(athleteId) ?? false
      case 'coach':
        return actor.assignedPlayerIds?.includes(athleteId) ?? false
      case 'club_admin':
        return Boolean(actor.organizationId) // plus athlete.organizationId === actor.organizationId
      default:
        return false
    }
  }

  // invitations, groups, conversations: org membership + role matrix
  return false
}
```

Always verify athlete’s `profiles.organization_id === actor.organizationId` for non-admin roles (defense in depth for tables lacking `organization_id`).

---

## 10. Implementation checklist for the multi-agent authz module

1. `resolveActor(token)` via `/auth/v1/user` + `profiles` (+ optional JWT secret verify for latency).
2. Load scopes with the exact SQL above; cache per request only.
3. Central `can` / `assertCan` shared by TypeScript BFF and Python tools.
4. Enforce at **tool boundary** on every call.
5. Prefer user JWT PostgREST client when possible; if service role, mandatory `can()`.
6. Align AI discovery filter column to `active` boolean.
7. Add integration tests: coach cannot read unassigned teammate; parent cannot read non-child; cross-org denied for all non-admin.
8. Audit existing Python routes that accept bare `athlete_id` / `organization_id` query params (dossier 07) and gate them with the same policy.

---

## 11. Quick reference — assignment tables

| Question | Answer |
|----------|--------|
| Which athletes can this coach see? | `coach_player_assignments` where `coach_id = :uid` AND (`active = true` OR `active IS NULL`) [AND `organization_id = :org`] |
| Which children can this parent see? | `parent_child_relationships` where `parent_id = :uid` AND (`status = 'approved'` OR `approved = true` OR `status IS NULL`) |
| Are coaches org-wide? | **UI: no (assignment). AI discovery: intended assignment. Many AI tools + some RLS policies: effectively org-wide / role-wide. Agent must use assignment.** |
