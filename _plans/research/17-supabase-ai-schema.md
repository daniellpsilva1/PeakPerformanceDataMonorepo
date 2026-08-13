# 17 — Supabase AI / Agent Schema Dossier

**Status:** Read-only research  
**Date:** 2026-08-02  
**Live project:** `PeakPerformanceDataV2` (`bcfwtgqvusjhlrqsztod`, eu-west-2, Postgres 15.8)  
**Migration roots searched:**
- `PeakPerformanceData/peak_performance_data/supabase/migrations/` (primary)
- `PeakPerformanceData/swingvision-pipeline/supabase/migrations/` (no AI tables)
- No SQL migrations under `PeakPerformanceData/ppp_ai_agent/`

**Evidence sources:** migration SQL (verbatim), live `information_schema` / `pg_policies` / `pg_indexes` / `pg_proc` via Supabase MCP, `src/lib/supabase/database.types.ts`, `supabase_migrations.schema_migrations`.

**No code or migrations were modified.**

---

## 0. Applied vs migration-only (executive matrix)

| Artifact | Migration file(s) | In `database.types.ts` | Live DB (`PeakPerformanceDataV2`) | Notes |
|----------|-------------------|------------------------|-----------------------------------|-------|
| `ai_conversations` | `20260129_ai_voice_agent_tables.sql` + alters in `20260311_…` | **Yes** | **Applied** (0 rows) | Telemetry cols present |
| `ai_audit_logs` | `20260129_…` + telemetry in `20260311_…` + RLS fix `20260221_…part1` | **Yes** | **Applied** (5 rows) | Live SELECT policy = JWT consolidate, not original names |
| `ai_memories` + HNSW + `vector` | `20260311_ai_telemetry_and_memory.sql` | **Yes** (no `athlete_id`) | **Applied** (0 rows); `vector` **0.8.0**; embedding `vector(1536)` | |
| `ai_memories.athlete_id` | `20260331_add_athlete_id_to_ai_memories.sql` | **Absent** | **Not applied** | Code writes `athlete_id` → runtime failure risk |
| RPCs `match_ai_memories`, `get_recent_ai_context`, `cleanup_old_ai_data` | `20260311_…` | **Yes** | **Applied**, all `SECURITY DEFINER`, `EXECUTE` to `PUBLIC`/`anon`/`authenticated` | |
| `cleanup_old_ai_conversations` | `20260129_…` | **Yes** | **Applied**, `SECURITY DEFINER`, `search_path=public` | |
| `insights`, `feedback_events`, `coach_reviews`, `preference_memory` | `20260727_insight_store.sql` (**untracked** `??`) | **Absent** | **Not applied** | Referenced by Python agent; cannot persist |
| `lab_panels`, `lab_biomarkers`, `lab_reference_ranges` | `20260727_lab_panels.sql` (**untracked**) | **Absent** | **Not applied** | |
| `genetic_reports`, `genetic_traits`, `genetic_trait_catalog` | `20260727_genetics.sql` (**untracked**) | **Absent** | **Not applied** | |
| `user_feedback` (+ attachments) | `20260421_user_feedback.sql` | **Yes** | **Applied** | Product bug-report feedback, not agent `feedback_events` |

**Journal note:** There is no local Supabase migration journal file (`config.toml` missing under `peak_performance_data/supabase/`). Live history lives in `supabase_migrations.schema_migrations`. AI-relevant applied names include `enable_pgvector_and_create_ai_memories`, `create_ai_memory_rpc_functions`, `add_telemetry_columns_to_audit_logs`, RLS consolidations for `ai_audit_logs` / `ai_conversations`. There is **no** journal entry for `add_athlete_id_to_ai_memories` or any `20260727_*` migration.

**Code vs types gaps:**
- TS `storeMemory` / athlete memory tools write/filter `athlete_id` — column missing live and in types.
- Python agent (`ppp_ai_agent`) references `insights`, `coach_reviews`, `feedback_events`, `lab_*`, `genetic_*` — none in types, none live.

---

## 1. `ai_conversations`

### 1.1 Migration provenance
| File | Lines | Change |
|------|-------|--------|
| `…/20260129_ai_voice_agent_tables.sql` | L7–41 | CREATE TABLE, indexes, RLS |
| `…/20260311_ai_telemetry_and_memory.sql` | L17–21 | `summary`, `message_count`, `total_tokens` |

### 1.2 Columns (migration + live)

| Column | Type | Nullable | Default | Constraints |
|--------|------|----------|---------|-------------|
| `id` | `UUID` | NO | `gen_random_uuid()` | PRIMARY KEY |
| `user_id` | `UUID` | NO | — | FK → `auth.users(id)` **NO ACTION** |
| `organization_id` | `UUID` | YES | — | FK → `organizations(id)` **NO ACTION** |
| `session_id` | `UUID` | NO | — | `UNIQUE (session_id)` |
| `messages` | `JSONB` | NO | `'[]'` | |
| `created_at` | `TIMESTAMPTZ` | YES | `NOW()` | |
| `updated_at` | `TIMESTAMPTZ` | YES | `NOW()` | |
| `summary` | `TEXT` | YES | — | added 20260311 |
| `message_count` | `INTEGER` | YES | `0` | added 20260311 |
| `total_tokens` | `INTEGER` | YES | `0` | added 20260311 |

### 1.3 Indexes (live)
- `ai_conversations_pkey` UNIQUE btree `(id)`
- `unique_session` UNIQUE btree `(session_id)`
- `idx_ai_conversations_user` btree `(user_id)` — migration L20
- `idx_ai_conversations_org` btree `(organization_id)` — L21
- `idx_ai_conversations_updated` btree `(updated_at)` — L22

No vector indexes.

### 1.4 RLS (migration L25–41; live matches intent)

RLS enabled. Live policies (roles `{public}`):

| Policy | Cmd | Qual / With Check |
|--------|-----|-------------------|
| `Users can view own conversations` | SELECT | `(SELECT auth.uid()) = user_id` |
| `Users can insert own conversations` | INSERT | WITH CHECK `(SELECT auth.uid()) = user_id` |
| `Users can update own conversations` | UPDATE | `(SELECT auth.uid()) = user_id` |
| `Users can delete own conversations` | DELETE | `(SELECT auth.uid()) = user_id` |

**Assessment:** Owner-scoped; **no cross-org SELECT leak** via RLS (users only see own rows). Gaps: no DELETE/UPDATE for service role needed (service bypasses RLS); `organization_id` not enforced on INSERT (user can write any org id on their own row). No admin org-wide read policy.

### 1.5 Foreign keys / cascade
- `user_id` → `auth.users(id)` NO ACTION  
- `organization_id` → `organizations(id)` NO ACTION  
Referenced by (migration-only, unapplied): `feedback_events.conversation_id` ON DELETE SET NULL.

### 1.6 Consumers
- `src/lib/ai/utils/conversationMemory.ts`
- Cron `src/app/api/cron/cleanup-conversations/route.ts` (direct DELETE via service role, not RPC)

---

## 2. `ai_audit_logs`

### 2.1 Migration provenance
| File | Lines | Change |
|------|-------|--------|
| `…/20260129_ai_voice_agent_tables.sql` | L47–91 | CREATE, indexes, original RLS |
| `…/20260311_ai_telemetry_and_memory.sql` | L6–15 | telemetry columns + index |
| `…/20260221_fix_all_tables_rls_recursion_part1.sql` | L8–16 | JWT-based SELECT policy `ai_audit_logs_public_select` |

### 2.2 Columns

| Column | Type | Nullable | Default |
|--------|------|----------|---------|
| `id` | `UUID` | NO | `gen_random_uuid()` PK |
| `user_id` | `UUID` | NO | — FK `auth.users` NO ACTION |
| `organization_id` | `UUID` | YES | — FK `organizations` NO ACTION |
| `action_type` | `VARCHAR(50)` | NO | — |
| `tool_name` | `VARCHAR(100)` | YES | — |
| `parameters` | `JSONB` | YES | — |
| `result_status` | `VARCHAR(20)` | YES | — |
| `error_message` | `TEXT` | YES | — |
| `duration_ms` | `INTEGER` | YES | — |
| `tokens_used` | `INTEGER` | YES | — |
| `created_at` | `TIMESTAMPTZ` | YES | `NOW()` |
| `model_provider` | `VARCHAR(50)` | YES | — (20260311) |
| `prompt_tokens` | `INTEGER` | YES | — |
| `completion_tokens` | `INTEGER` | YES | — |
| `ttft_ms` | `INTEGER` | YES | — |

### 2.3 Indexes (live = migration)
- PK; `idx_ai_audit_user`, `_org`, `_created (created_at DESC)`, `_tool` (partial `tool_name IS NOT NULL`), `_status`, `_model_provider` (partial)

### 2.4 RLS

**Original migration (L74–91):**
```sql
CREATE POLICY "Users can view own audit logs"
  ON ai_audit_logs FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Admins can view org audit logs"
  ON ai_audit_logs FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() 
      AND profiles.organization_id = ai_audit_logs.organization_id
      AND profiles.role IN ('admin', 'club_admin')
    )
  );

CREATE POLICY "System can insert audit logs"
  ON ai_audit_logs FOR INSERT
  WITH CHECK (true);
```

**Live (authoritative):**
```sql
-- SELECT
CREATE POLICY "ai_audit_logs_public_select" ON public.ai_audit_logs FOR SELECT USING (
  ((SELECT auth.uid() AS uid) = user_id)
  OR (
    organization_id = ((auth.jwt() -> 'user_metadata' ->> 'organization_id')::uuid)
    AND (auth.jwt() -> 'user_metadata' ->> 'role') = ANY(ARRAY['admin', 'club_admin'])
  )
);

-- INSERT
CREATE POLICY "System can insert audit logs"
  ON ai_audit_logs FOR INSERT
  WITH CHECK (true);
```

No UPDATE/DELETE policies for authenticated users (cron uses service role).

**Assessment:**
- SELECT org scoping via JWT `organization_id` is **reasonable** if JWT claims stay in sync with `profiles`. Risk: stale/spoofable `user_metadata` (client-writable in some Auth setups) could allow **cross-org admin reads** if a user can set `role`/`organization_id` in metadata. Prefer claims from custom access token hook / `profiles` with recursion-safe helpers.
- **INSERT `WITH CHECK (true)`:** any role subject to RLS (including `authenticated`) can insert rows with **arbitrary `user_id` / `organization_id` / parameters** — spoofed telemetry / log pollution. Should be `service_role` only or `WITH CHECK (auth.uid() = user_id)`.

### 2.5 Consumers
- `src/lib/ai/utils/auditLog.ts`
- Cleanup cron deletes logs >90d via service role

---

## 3. `ai_memories` (+ pgvector)

### 3.1 Migration provenance
| File | Lines | Change |
|------|-------|--------|
| `…/20260311_ai_telemetry_and_memory.sql` | L23–74 | `CREATE EXTENSION vector`; table; HNSW; RLS |
| `…/20260331_add_athlete_id_to_ai_memories.sql` | L1–8 | `athlete_id` + indexes — **NOT applied live** |

### 3.2 Columns (live)

| Column | Type | Nullable | Default | Constraints |
|--------|------|----------|---------|-------------|
| `id` | `UUID` | NO | `gen_random_uuid()` | PK |
| `user_id` | `UUID` | NO | — | FK `auth.users` NO ACTION |
| `organization_id` | `UUID` | YES | — | FK `organizations` NO ACTION |
| `memory_type` | `VARCHAR(30)` | NO | — | CHECK ∈ `preference,fact,workflow,correction,summary` |
| `content` | `TEXT` | NO | — | |
| `embedding` | `vector(1536)` | YES | — | |
| `importance` | `SMALLINT` | YES | `5` | CHECK 1–10 |
| `source` | `VARCHAR(50)` | YES | `'conversation'` | |
| `last_accessed_at` | `TIMESTAMPTZ` | YES | `NOW()` | |
| `created_at` | `TIMESTAMPTZ` | YES | `NOW()` | |
| `updated_at` | `TIMESTAMPTZ` | YES | `NOW()` | |
| `athlete_id` | — | — | — | **Missing live** (migration would: FK `profiles(id)` ON DELETE CASCADE) |

### 3.3 Indexes (live)
- PK; `idx_ai_memories_user`, `_org`, `_type`, `_importance (importance DESC)`
- **HNSW vector index** `idx_ai_memories_embedding`:  
  `USING hnsw (embedding vector_cosine_ops) WITH (m='16', ef_construction='64')`  
  (migration L53–55)
- **Not live:** `ai_memories_athlete_id_idx`, `ai_memories_user_athlete_idx` (from 20260331)

No IVFFlat indexes.

### 3.4 Extension
- Live: `vector` **0.8.0** (`CREATE EXTENSION IF NOT EXISTS vector` at `20260311` L24)

### 3.5 RLS (migration L57–74 = live)

| Policy | Cmd | Expression |
|--------|-----|------------|
| `Users can view own memories` | SELECT | `auth.uid() = user_id` |
| `System can insert memories` | INSERT | `WITH CHECK (true)` |
| `System can update memories` | UPDATE | `USING (true)` |
| `Users can delete own memories` | DELETE | `auth.uid() = user_id` |

**Assessment — HIGH RISK:**
- INSERT/UPDATE open to all authenticated clients → **any user can insert/update any memory row** (including rewriting another user’s content/embeddings if they know/guess UUIDs; UPDATE has no column restriction).
- SELECT/DELETE correctly owner-scoped.
- No org isolation on SELECT beyond owner (OK if memories are personal to coach/user).
- **Cross-org:** UPDATE/INSERT policies do not check `organization_id` at all.

### 3.6 Code dependency on missing column
`semanticMemory.ts` `storeMemory` inserts `athlete_id`; `athleteMemoryTools.ts` filters `.eq('athlete_id', …)`. Until `20260331` is applied, these paths error against PostgREST.

---

## 4. RPCs / functions

All below exist live, appear in `database.types.ts`, and grant **`EXECUTE` to `PUBLIC`, `anon`, `authenticated`, `service_role`, `postgres`**.

### 4.1 `match_ai_memories` — `SECURITY DEFINER`

**Migration:** `20260311_ai_telemetry_and_memory.sql` L77–109  
**Live body** (cast similarity to FLOAT; otherwise same):

```sql
CREATE OR REPLACE FUNCTION public.match_ai_memories(
  query_embedding vector,
  match_user_id uuid,
  match_org_id uuid DEFAULT NULL,
  match_count integer DEFAULT 5,
  match_threshold double precision DEFAULT 0.7
)
RETURNS TABLE(id uuid, content text, importance smallint, memory_type varchar, similarity float)
LANGUAGE plpgsql SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT m.id, m.content, m.importance, m.memory_type,
         (1 - (m.embedding <=> query_embedding))::FLOAT AS similarity
  FROM ai_memories m
  WHERE m.user_id = match_user_id
    AND (match_org_id IS NULL OR m.organization_id = match_org_id)
    AND m.embedding IS NOT NULL
    AND 1 - (m.embedding <=> query_embedding) > match_threshold
  ORDER BY m.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;
```

**Risk:** No `auth.uid() = match_user_id` check → **IDOR**: any caller can search another user’s memories by UUID. `match_org_id NULL` skips org filter.

### 4.2 `get_recent_ai_context` — `SECURITY DEFINER`

**Migration:** L112–138  
**Live:** identical. Returns `messages, session_id, summary, updated_at` for `p_user_id` + `p_org_id`.

**Risk:** No caller auth check → **IDOR** read of conversation JSONB (full chat history).

### 4.3 `cleanup_old_ai_data` — `SECURITY DEFINER`

**Migration:** L141–164  
**Live:** identical. Deletes old conversations + low-importance memories (`importance <= 2`).

**Risk:** Callable by `anon`/`authenticated` → **global destructive delete** (bypasses RLS).

### 4.4 `cleanup_old_ai_conversations` — `SECURITY DEFINER`

**Migration:** `20260129` L97–109  
**Live:** same + `SET search_path TO 'public'`.

**Risk:** Same as above — global DELETE of conversations.

**Hardening guidance (not applied):** revoke from `PUBLIC`/`anon`/`authenticated`; grant to `service_role` only; add `auth.uid()` guards inside DEFINER functions; set `search_path` on all DEFINER funcs.

---

## 5. Unapplied agentic store — `20260727_insight_store.sql`

**Path:** `PeakPerformanceData/peak_performance_data/supabase/migrations/20260727_insight_store.sql`  
**Git:** untracked (`??`); **not** in live `schema_migrations`; **not** in `database.types.ts`; **tables absent** live.

Depends on helper `update_updated_at()` (defined in this file L207–213) — also required by lab/genetics migrations.

### 5.1 `insights` (L12–83)

| Column | Type | Null | Default |
|--------|------|------|---------|
| `id` | UUID PK | NO | `gen_random_uuid()` |
| `athlete_id` | UUID → `auth.users` | NO | — |
| `organization_id` | UUID → `organizations` | NO | — |
| `coach_id` | UUID → `auth.users` | YES | — |
| `claim` | TEXT | NO | — |
| `category` | TEXT | NO | `'general'` (no CHECK vs product enum) |
| `confidence` | TEXT | NO | `'medium'` (no CHECK) |
| `evidence` | JSONB | NO | `'[]'` |
| `actions` | JSONB | NO | `'[]'` |
| `requires_coach_review` | BOOLEAN | NO | FALSE |
| `coach_review_status` | TEXT | YES | NULL |
| `source` | TEXT | NO | `'orchestrator'` |
| `trigger` | TEXT | NO | `'chat'` |
| `created_at` / `updated_at` | TIMESTAMPTZ | YES | NOW(); trigger `trg_insights_updated` |

Indexes: athlete, org, coach, partial `coach_review_status`, `created_at DESC`.

**RLS (verbatim policies):**
- SELECT athlete: `auth.uid() = athlete_id`
- SELECT coaches: `coach_id = auth.uid()` OR active `coach_player_assignments`
- SELECT admins: `profiles` same org + role ∈ admin/club_admin
- INSERT: `"Service can insert insights"` **`WITH CHECK (true)`**
- UPDATE: coach_id = uid OR org admin/club_admin

**RLS risks if applied as written:**
- Open INSERT → any client can plant insights for any athlete/org.
- Coach UPDATE does not require active assignment if `coach_id` is null and user is admin only — OK; non-assigned coaches cannot UPDATE (only SELECT via assignment). Good.
- Admin SELECT uses `profiles` subquery (recursion history elsewhere — watch for reintroducing recursion).
- No parent SELECT policy.
- No DELETE policy.

FK cascade: default NO ACTION on user/org FKs.

### 5.2 `feedback_events` (L87–125)

| Column | Type | Notes |
|--------|------|-------|
| `id` | UUID PK | |
| `insight_id` | UUID → `insights` **ON DELETE CASCADE** | nullable |
| `conversation_id` | UUID → `ai_conversations` **ON DELETE SET NULL** | |
| `user_id` | UUID → `auth.users` NOT NULL | |
| `organization_id` | UUID → `organizations` NOT NULL | |
| `feedback_type` | TEXT | CHECK ∈ thumbs_up/down, edit, flag |
| `reason_codes` | TEXT[] | default `'{}'` |
| `comment` | TEXT | |
| `created_at` | TIMESTAMPTZ | NOW() |

RLS: own SELECT/INSERT (`auth.uid() = user_id`); admin org SELECT via `profiles`.

**Risks:** INSERT does not verify `organization_id` matches user’s org or that `insight_id` is visible; can attach feedback to foreign insights. No UPDATE/DELETE policies.

### 5.3 `coach_reviews` (L129–166)

| Column | Type | Notes |
|--------|------|-------|
| `id` | UUID PK | |
| `insight_id` | UUID → `insights` **ON DELETE CASCADE** NOT NULL | |
| `coach_id` | UUID → `auth.users` NOT NULL | |
| `action` | TEXT | CHECK ∈ approve/edit/reject |
| `edited_claim` | TEXT | |
| `edited_actions` | JSONB | |
| `comment` | TEXT | |
| `created_at` | TIMESTAMPTZ | |

RLS: coach SELECT/INSERT where `coach_id = auth.uid()`; admin SELECT via insight’s org.

**Risk:** INSERT only checks `coach_id = auth.uid()`, **not** that the coach may access the insight → cross-org review spam if insight UUIDs leak.

### 5.4 `preference_memory` (L171–204)

| Column | Type | Notes |
|--------|------|-------|
| `id` | UUID PK | |
| `user_id` / `organization_id` | UUID FKs NOT NULL | |
| `preference_type` | TEXT | CHECK tone/detail_level/language/metric_priority/safety_boundary/other |
| `preference_value` | TEXT NOT NULL | |
| `source` | TEXT | default `'feedback'` |
| `created_at` / `updated_at` | TIMESTAMPTZ | trigger |

RLS: own SELECT/INSERT/UPDATE; plus `"Service can insert preferences" WITH CHECK (true)`.

**Risk:** open service INSERT duplicates the memories anti-pattern.

---

## 6. Unapplied labs — `20260727_lab_panels.sql`

**Git untracked; not live; not in types.** Depends on `update_updated_at()` from insight migration (ordering: insight store should run first, or extract the function).

### 6.1 `lab_panels` (L15–110)

Columns: `id`, `athlete_id`→auth.users, `organization_id`→orgs, `panel_type` default `performance_monitoring`, `lab_name`, `drawn_at` NOT NULL, `received_at` default NOW(), Art.9 consent flags (`consent_research` default false; `consent_athlete_visible` default true; `consent_coach_visible` default false; **`consent_org_admin_visible` default TRUE**), `notes`, timestamps.

Indexes: athlete, org, drawn DESC, type.

RLS SELECT gated by consent + athlete / assigned coach / org admin. INSERT/UPDATE: athlete own + org admin/club_admin.

**Risks:** default org-admin visibility true for special-category health data; no parent policies; no DELETE; no service INSERT policy (agents using service key bypass RLS anyway).

### 6.2 `lab_biomarkers` (L114–190)

FK `panel_id` → `lab_panels` **ON DELETE CASCADE**. Status CHECK; provenance default `lab_report`.

RLS SELECT inherits panel consent. **INSERT `"Service can insert biomarkers" WITH CHECK (true)`** — open to all roles.

### 6.3 `lab_reference_ranges` (L195–301)

Global catalog; UNIQUE `(biomarker_key, activity_context, sex)`. Seed INSERT L264–301 (ferritin, CBC, vit D, thyroid, cortisol, testosterone, CMP, CK, hs-CRP).

RLS: any authenticated SELECT; admin/club_admin INSERT/UPDATE **without org scope** (shared global table — intentional, but any club_admin can mutate shared ranges).

Triggers: `trg_lab_panels_updated`, `trg_lab_reference_ranges_updated` calling `update_updated_at()`.

---

## 7. Unapplied genetics — `20260727_genetics.sql`

**Git untracked; not live; not in types.**

### 7.1 `genetic_reports` (L18–79)

Dual-consent columns; `parse_status` CHECK; `report_type` CHECK; file metadata; no admin SELECT policy; athlete CRUD-ish (SELECT/INSERT/UPDATE own); coach SELECT only if both consents and `coach_id = auth.uid()`.

### 7.2 `genetic_traits` (L84–142)

FK `report_id` → reports **ON DELETE CASCADE**. Stores `feature_label` (minimized), evidence tiers — **not raw genotypes in this table**. INSERT `WITH CHECK (true)`.

### 7.3 `genetic_trait_catalog` (L147–264)

UNIQUE `trait_key`; seed ACTN3, ACE, COL5A1, MCT1, CLOCK. Authenticated SELECT; admin/club_admin manage (no org scope).

---

## 8. Related but out-of-scope for agent memory: `user_feedback`

Applied (`20260421_user_feedback.sql`, journal `user_feedback`). Product UX feedback (bug/feature), **not** `feedback_events`. Types present. Documented here only to avoid conflation.

---

## 9. RLS risk summary (priority)

| Severity | Issue |
|----------|--------|
| **Critical** | `cleanup_old_ai_*` SECURITY DEFINER + EXECUTE for `anon`/`authenticated` → anyone can wipe conversations/memories |
| **Critical** | `match_ai_memories` / `get_recent_ai_context` SECURITY DEFINER without caller=subject check → IDOR across users |
| **High** | `ai_memories` INSERT/UPDATE `true`; `ai_audit_logs` INSERT `true` |
| **High** (if 20260727 applied as written) | `insights` / `lab_biomarkers` / `genetic_traits` / `preference_memory` open INSERT |
| **Medium** | `ai_audit_logs` admin SELECT trusts JWT `user_metadata` role/org |
| **Medium** | Unapplied `athlete_id` while app code depends on it |
| **Medium** | Lab default `consent_org_admin_visible = true`; genetics/labs special-category with service-key bypass in Python |
| **Low** | `ai_conversations` owner-only OK; no org admin analytics path |

**Cross-org leak assessment (applied tables):**
- Conversations/memories SELECT: owner-only → no org peer leak via SELECT.
- Memories UPDATE open → cross-user (hence cross-org) **write** leak.
- Audit SELECT: org-bounded **if** JWT claims honest.
- DEFINER RPCs: **cross-user** leak independent of org.

---

## 10. Gaps for a sophisticated multi-agent system

Nothing below exists as tables/RPCs in migrations or live DB today (beyond coarse `ai_audit_logs` token fields).

| Need | Why | Suggested direction |
|------|-----|---------------------|
| **Agent run / trace** | Orchestrator + specialists need a durable run id, parent/child spans, status, error | `agent_runs`, `agent_spans` (run_id, parent_span_id, agent_name, input/output hashes, status, started/finished) |
| **Tool-call logs** | `ai_audit_logs` is flat and optional; no correlation to run/message | `agent_tool_calls` FK → run/span; args/result redacted; latency; success |
| **Token / cost accounting** | Partial cols on audit logs; no pricing, model id, or per-tenant rollup | `ai_usage_events` (org_id, user_id, model, prompt/completion tokens, cost_usd, run_id) + daily rollup |
| **Checkpoint / durable workflow state** | Nightly batch is in-memory loop; no resume | `agent_checkpoints` (workflow_key, step, payload JSONB, version) or external Temporal |
| **Approval queues** | `coach_reviews` designed but **unapplied**; no generic HITL queue | Apply insight store **or** `approval_tasks` (resource_type/id, assignee, state, payload) |
| **Evaluation results** | Eval harness exists in Python; no persistence | `agent_eval_runs`, `agent_eval_cases` (suite, score, faithfulness, latency, git_sha) |
| **Prompt / version registry** | Prompts live in code only | `prompt_versions` (name, semver, content, hash, active_from) |
| **Per-tenant rate limits** | No counters | `ai_rate_limit_buckets` (org_id, window_start, tokens_used, requests) or Redis + audit |
| **Insight store + labs/genetics** | Python already coded against them | **Apply** (after RLS hardening) `20260727_*` and regenerate types |
| **`athlete_id` on memories** | Coach-scoped memory tools already written | **Apply** `20260331_add_athlete_id_to_ai_memories.sql`; extend `match_ai_memories` with optional `match_athlete_id` |
| **Message-level storage** | Entire thread in JSONB blob | Optional normalized `ai_messages` for search/PII redaction |
| **Org isolation helpers** | Repeated fragile `profiles` / JWT checks | Stable `SECURITY DEFINER` helpers with fixed `search_path` used by RLS |

---

## 11. Migration file index (AI-related)

| Absolute path | Role |
|---------------|------|
| `/Users/danielsilva/Desktop/PeakPerformanceDataMonorepo/PeakPerformanceData/peak_performance_data/supabase/migrations/20260129_ai_voice_agent_tables.sql` | `ai_conversations`, `ai_audit_logs`, `cleanup_old_ai_conversations` |
| `/Users/danielsilva/Desktop/PeakPerformanceDataMonorepo/PeakPerformanceData/peak_performance_data/supabase/migrations/20260221_fix_all_tables_rls_recursion_part1.sql` | `ai_audit_logs` SELECT policy JWT rewrite |
| `/Users/danielsilva/Desktop/PeakPerformanceDataMonorepo/PeakPerformanceData/peak_performance_data/supabase/migrations/20260311_ai_telemetry_and_memory.sql` | telemetry cols, pgvector, `ai_memories`, HNSW, RPCs |
| `/Users/danielsilva/Desktop/PeakPerformanceDataMonorepo/PeakPerformanceData/peak_performance_data/supabase/migrations/20260331_add_athlete_id_to_ai_memories.sql` | athlete scoping (**unapplied**) |
| `/Users/danielsilva/Desktop/PeakPerformanceDataMonorepo/PeakPerformanceData/peak_performance_data/supabase/migrations/20260727_insight_store.sql` | insights + feedback + reviews + prefs (**untracked, unapplied**) |
| `/Users/danielsilva/Desktop/PeakPerformanceDataMonorepo/PeakPerformanceData/peak_performance_data/supabase/migrations/20260727_lab_panels.sql` | labs (**untracked, unapplied**) |
| `/Users/danielsilva/Desktop/PeakPerformanceDataMonorepo/PeakPerformanceData/peak_performance_data/supabase/migrations/20260727_genetics.sql` | genetics (**untracked, unapplied**) |
| `/Users/danielsilva/Desktop/PeakPerformanceDataMonorepo/PeakPerformanceData/peak_performance_data/src/lib/supabase/database.types.ts` | Generated types: AI core + RPCs present; 20260727 tables absent; `athlete_id` absent on `ai_memories` |

---

## 12. Recommended apply order (when ready — do not run now)

1. Harden DEFINER grants + RLS open INSERT/UPDATE on existing AI tables.  
2. Apply `20260331_add_athlete_id_to_ai_memories.sql`.  
3. Commit + harden then apply `20260727_insight_store.sql` (defines `update_updated_at`).  
4. Apply `20260727_lab_panels.sql`, then `20260727_genetics.sql`.  
5. Regenerate `database.types.ts` from live schema.  
6. Add multi-agent observability tables (runs/spans/tool calls/usage) before scaling specialists.
