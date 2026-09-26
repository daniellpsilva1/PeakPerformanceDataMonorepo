---
id: PPD-PORTFOLIO-AUDIT-REMEDIATION-BACKLOG
last_reviewed: 2026-09-23
owner: daniel
related:
  - docs/audits/documentation-baseline.md
  - docs/quality/verification-matrix.md
schema_version: 1
status: draft
title: Remediation backlog
type: reference
visibility: internal
---

# Remediation backlog

This backlog tracks runtime, assurance, and code-level gaps discovered during documentation work. These items are **not** documentation deliverables and are not resolved as part of the documentation rollout. They require separate owner approval and engineering work.

## How to read this backlog

Each item has:

- **ID:** `RG-NN` (remediation gap)
- **Source:** Where the gap was discovered
- **Risk:** Low / Medium / High
- **Status:** Open / Acknowledged / In progress / Resolved
- **Owner action required:** What the owner needs to decide or authorize

## Open items

### RG-01: Strava env vars in backend render.yaml

- **Source:** `docs/audits/documentation-baseline.md` (DG-05)
- **Risk:** Medium
- **Status:** Open
- **Description:** `render.yaml` declares Strava-related env vars, but the wearable integration has migrated to OpenWearables. It is unclear whether Strava is still active or these are stale.
- **Owner action required:** Confirm whether Strava is still integrated. If not, authorize removal of stale env vars from `render.yaml`.

### RG-02: ACWR band labeling disagreement

- **Source:** `docs/audits/documentation-baseline.md` (DG-23)
- **Risk:** Medium
- **Status:** Open
- **Description:** Research documents question the validity of ACWR "safe zones," while application code labels ranges "optimal" or "danger." This is a scientific claim disagreement, not a documentation issue.
- **Owner action required:** Decide whether to update code labels, update research claims, or document the disagreement as accepted.

### RG-03: Legacy extraction lifecycle

- **Source:** `docs/audits/documentation-baseline.md` (DG-02)
- **Risk:** Medium
- **Status:** Open
- **Description:** The legacy extraction repository's role is unclear. It may be retired, in maintenance, or still serving a fallback.
- **Owner action required:** Confirm lifecycle status and authorize disposition (retire, maintain, or document as active).

### RG-04: SQL security CI is non-blocking

- **Source:** `docs/audits/documentation-baseline.md` (DG-19)
- **Risk:** High
- **Status:** Open
- **Description:** The SQL security CI job is explicitly non-blocking and notes an incomplete local schema. It should not be presented as proven security coverage.
- **Owner action required:** Decide whether to promote to blocking, complete the local schema, or document the limitation as accepted.

### RG-05: Playwright dependency not confirmed for Courtviz/BodyViz galleries

- **Source:** `docs/quality/verification-matrix.md`
- **Risk:** Low
- **Status:** Open
- **Description:** Courtviz and BodyViz declare `pnpm gallery` commands that require Playwright, but Playwright is not confirmed as a declared dependency in their manifests.
- **Owner action required:** Confirm whether Playwright is installed and the gallery command runs, or mark the command as unverified.

### RG-06: Database migration drift check methodology

- **Source:** `docs/audits/documentation-baseline.md` (DG-20)
- **Risk:** Medium
- **Status:** Open
- **Description:** The existing drift check compares full migration filenames with database version IDs, while Supabase's CLI treats version and name separately. Output may not be reliable.
- **Owner action required:** Validate the drift check methodology or replace with a Supabase CLI-based check.

### RG-07: AI Videos repository purpose

- **Source:** `docs/audits/documentation-baseline.md` (DG-24)
- **Risk:** Low
- **Status:** Open
- **Description:** The AI Videos repository's purpose and relationship to other marketing repos is unclear.
- **Owner action required:** Confirm purpose and intended use, or mark as deprecated.

### RG-08: AI write actions lack enforced confirmation

- **Source:** AI-native planning session (2026-09-19), app `f4c9b736`
- **Risk:** High
- **Status:** In progress
- **Description:** `src/lib/ai/pending-actions.ts` (server-held pending actions) is dead code — never imported outside its own test. `components/ai/ConfirmationDialog.tsx` is never rendered. `confirmActionTool` only emits text; write tools (`createTrainingSessionTool`, `createObservationTool`, `createTrainingReportTool`, `recordAttendanceTool`, etc.) execute immediately, and several accept an LLM-supplied `confirmed:boolean`, which is not proof of consent. This contradicts `docs/agents/runtime-knowledge-contract.md` ("data modification: denied without per-action approval").
- **Owner action required:** Approve the proposal/approval model (`ai_proposals` table + approve route) so writes require explicit per-action approval.

### RG-09: Ambiguous athlete-name resolution in AI tools

- **Source:** AI-native planning session (2026-09-19), app `f4c9b736`
- **Risk:** High
- **Status:** In progress
- **Description:** Tools resolve athlete names inconsistently: `createObservationTool` uses `ilike(...).single()` (fails on >1 match), `createTrainingReportTool` silently takes the first fuzzy match, `recordAttendanceTool` requires exact `full_name`. None are accent-insensitive or use coach context. A wrong "Martin" silently writes to the wrong athlete.
- **Owner action required:** Approve the deterministic entity-resolution module (accent-insensitive, context-ranked, returns candidates for disambiguation).

### RG-10: Coach AI scope was org-wide, not assignment-scoped

- **Source:** AI-native planning session (2026-09-19), app `f4c9b736`
- **Risk:** High
- **Status:** Resolved (pending owner review)
- **Description:** `/api/ai-agent` passed `assignedPlayerIds=null` to `buildToolSet`, giving coaches org-wide athlete tools while the UI scopes coaches to `coach_player_assignments`. Fixed by wiring `resolvePlayerScope` (roster-grounding) into the route; coaches now get their assigned athlete IDs, admins keep org-wide.

### RG-11: Primary LLM (DeepSeek) lacks EU DPA while processing minors' data

- **Source:** AI-native planning session (2026-09-19), `src/lib/ai/agentConfig.ts`
- **Risk:** High
- **Status:** Open
- **Description:** The agent primary model is DeepSeek (`deepseek-chat`) with Groq fallback. DeepSeek offers no EU data-processing agreement; the platform processes minors' training/health-adjacent data. Voice captures will add transcripts of coach speech.
- **Owner action required:** Choose primary provider via the model-router bake-off; require DPA/EU processing before selecting.

### RG-12: Speech-to-text paths diverge per platform

- **Source:** AI-native planning session (2026-09-19), `src/hooks/ai/useSpeechRecognition.ts`
- **Risk:** Medium
- **Status:** In progress
- **Description:** Three code paths (Web Speech desktop, Web Speech Android with auto-restart, MediaRecorder+Whisper iOS with an 800ms sliding-window that issues many interim transcription calls). Transcripts differ per device and the iOS path wastes API calls. Replacing with a single MediaRecorder→provider path behind an STT interface.

### RG-13: Genetics raw-file retention unverified; no consent revocation path

- **Source:** Mobile UX implementation (2026-09-19), `src/app/api/ai-agent/genetics/upload/route.ts`, `_plans/MobileUXMegaplan.md` H-03
- **Risk:** High
- **Status:** Open
- **Description:** The genetics upload route inserts `genetic_reports` with `file_path: file.name`, `athlete_consent: true`, `coach_consent`, then POSTs the file bytes to `PPP_AI_AGENT_URL/genetics/parse`. The previous UI notice claimed raw genotypes are minimized before persistence and that consent can be revoked with deletion — both claims are unverified from APP: raw-file retention depends on `ppp_ai_agent` (not audited), and no revoke/delete UI or API route exists. The unverified notice was removed in WP-7; the underlying assurance gap remains.
- **Owner action required:** Verify `ppp_ai_agent` genetics raw-file retention behavior, then approve and implement a consent revocation/deletion path (API route + UI) before restoring any retention or revocation claims in copy.

### RG-14: Club-admin signup unreachable on non-platform brands

- **Source:** Mobile UX final gate (2026-09-20), `src/app/[locale]/signup/page.tsx`, `src/lib/auth/signup-schema.ts`
- **Risk:** Medium
- **Status:** Open
- **Description:** `createSignupSchema` requires `dateOfBirth` unconditionally, but the page only renders the `DateField` when `selectedRole === 'player' || (isPlatform && selectedRole !== 'parent')`. On academy/branded sites (`brand.type !== 'platform'`) the role selector is shown yet date of birth stays hidden for `coach`, `club_admin`, and `parent`, so their submissions always fail zod validation — coach/club-admin signup cannot complete. On platform sites the role selector is hidden entirely (player-only), so `club_admin` cannot be selected there either. The stale signup test asserting club-admin submission was skipped with a note; no invitation-based alternative is documented in the signup UI.
- **Owner action required:** Decide the intended club-admin/coach onboarding path on branded sites (show DoB for all non-parent roles, make DoB conditional in the schema, or direct them to the invitation flow), then approve the fix.

### RG-15: PSE tool writes columns absent from generated types

- **Source:** AI-native implementation session (2026-09-19), `src/lib/ai/tools/wellnessTools.ts` vs `src/lib/supabase/database.types.ts`
- **Risk:** Medium
- **Status:** Open
- **Description:** `createPSEScoreTool` inserts `rpe`, `score_date`, `srpe`, `created_by` into the PSE table, but the generated types expose `assessment_date`, `assessment_type`, `organization_id`, `player_id`, `pse_score`. Either the tool's writes silently fail (PostgREST rejects unknown columns) or the generated types are stale. The new proposal executor uses the generated-types column set.
- **Owner action required:** Verify actual `pse_scores` table columns in production; fix whichever side is stale.

## What this backlog does not claim

- That any item has been resolved (all are open).
- That this backlog is exhaustive (new gaps may be discovered).
- That documentation work will resolve these items (it will not).

### RG-16: Claim-account duplicate-email check can never fire

- **Source:** Stale-test remediation (2026-09-20), `src/app/api/claim-account/route.ts` vs `supabase/migrations/20260125_add_complete_account_claim.sql`
- **Risk:** Medium
- **Status:** Open
- **Description:** The route guards duplicate auth users with `if (authUserExists && Array.isArray(authUserExists) && authUserExists[0]?.user_exists === true)`, but `check_auth_user_exists` `RETURNS BOOLEAN` and the adjacent comment even states "The RPC returns a boolean directly". `Array.isArray(true)` is always false, so the 409 conflict path is dead code: an email that exists in `auth.users` without a profile proceeds to `auth.admin.createUser` and fails with a provider error instead of the intended 409 message. The covering test was updated to `it.fails` and documents the intended contract.
- **Owner action required:** Approve fixing the check to handle the boolean contract (e.g. `authUserExists === true || (Array.isArray(authUserExists) && authUserExists[0]?.user_exists === true)`), then flip the test back to `it`.

### RG-17: Backend tests stale against ClickHouse/auth migrations

- **Source:** WP-08 verification run (2026-09-20), `ppd_backend/tests/test_api/test_graphs.py` and `tests/test_data_processing/test_base/test_graph_data_processor.py` vs `AuthMiddleware` and the ClickHouse data path
- **Risk:** Medium
- **Status:** Resolved (2026-09-20)
- **Description:** Two backend test files encoded superseded contracts. `test_graphs.py` had 14 failures because unauthenticated `TestClient` requests now 401 under `AuthMiddleware` (tests predated auth). `test_graph_data_processor.py` had 9 failures because tests mocked the old Supabase query chain while the processor now reads ClickHouse. Both files were rewritten against the current contracts: the test client authenticates via a mocked `verify_supabase_token` Bearer session; processor tests mock `get_clickhouse_wearables_client` and the normalized `ow_workouts` schema, and Supabase tests use the lazy `_get_supabase_client` + `athlete_id` column contract. Both files pass (18 + 18 tests).
- **Owner action required:** None — remediated. See RG-18 for the remaining wider drift.

### RG-18: Broader backend test drift beyond RG-17

- **Source:** RG-17 full-suite verification run (2026-09-20), `ppd_backend` `pytest tests/` — 57 failures + 18 collection errors across `test_graph_factory.py`, pace/volume graph-generator tests, and `test_airtable*.py`
- **Risk:** Medium
- **Status:** Open
- **Description:** Same migration-era debt as RG-17 but in files outside its scope. `test_graph_factory.py` patches `data_processing.factories.graph_factory.GraphDataProcessor`, which no longer exists at module level after the lazy-import refactor (commit `f81839af`). Graph-generator tests (pace_over_time, pace_relativization, weekly_velocity, volume_pace_markers, volume_graphs) mock superseded Supabase/processor paths. `test_airtable*.py` target the legacy Airtable upload pipeline. None of these files' production code was touched by WP-01–WP-08.
- **Owner action required:** Approve a dedicated migration-test-debt pass (rewrite mocks against ClickHouse/lazy-factory contracts) or quarantine the files until scheduled.

### RG-19: Remote `profiles` behind committed migrations (subscription/notification columns)

- **Source:** 2026-09-20 — `database.types.ts` regeneration against project `bcfwtgqvusjhlrqsztod` (PeakPerformanceDataV2) during the AI-proposal migration application
- **Risk:** Medium
- **Status:** Resolved (2026-09-20)
- **Description:** The remote `public.profiles` table lacked `subscription_status`, `subscription_tier`, and `notification_preferences`, although committed migrations defined them (`supabase/migrations/20260817_add_subscription_columns_to_profiles.sql`, `20260902_add_notification_preferences_to_profiles.sql`) and the previously committed `database.types.ts` contained them. **Resolution:** both migrations were applied remotely (8 subscription columns, 2 CHECK constraints, 4 partial indexes; the `set_updated_at` trigger block was omitted because remote `profiles` already has `update_profiles_updated_at` via `update_updated_at_column()`), and `database.types.ts` was regenerated wholesale. The regen also picked up remote-only tables the committed file had been missing (`garmin_connect_*`, `match_post_decks`, `match_post_jobs`). `tsc --noEmit` is clean against the regenerated file.

## 2026-09-23 ClickHouse incident and deploy hardening

Entries RG-20 through RG-24 record remediations applied during the 2026-09-23 ClickHouse OOM incident and the associated backend/frontend deploy. Entries RG-25 through RG-34 are open follow-ups discovered during the same work.

### RG-20: ClickHouse OOM on ds-wearables-extract (116.202.100.150)

- **Source:** 2026-09-23 incident on ds-wearables-extract; evidence bundle on host at `/root/ch-incident-2026-09-23/{before,after,after3,after4,after5}.txt`
- **Risk:** High
- **Status:** Resolved (2026-09-23)
- **Description:** The kernel OOM-killed `clickhouse-server` twice. Diagnostic log tables had grown unbounded — `text_log` 5.66GB / 67M rows at trace level, `metric_log` 3.95GB, `trace_log` 883MB, plus 13 orphaned `_N`-renamed log tables (including `asynchronous_metric_log_1` with 287M rows) — consuming memory/disk and driving ~30 concurrent merges. **Resolution:** all bloated system logs dropped/truncated; new `config.d/memory-tuning.xml` (text_log at warning level, metric_log and trace_log removed, `background_pool_size` 8 with merges_mutations ratio 4, merges memory capped at 25% of RAM, RAM ratio 0.75, caches capped at 256MB/0/64MB/128MB, max 50 concurrent queries); conflicting duplicate `max_server_memory_usage` entries deduplicated in `config.xml` and `config.d/memory.xml` removed; 4GiB swapfile added (fstab, `swappiness=10`); empty `clickhouse-dev` container stopped (`restart=no`); `/etc/cron.d/ch-health` now logs MemoryTracking/Merge/OSMemoryAvailable every 5 minutes to `/var/log/ch-health.log` (logrotate weekly × 12).
- **Owner action required:** None for the fix itself. Watch item: jemalloc-tracked memory floor was ~5.25GiB (structural, not parts metadata) and dropped to ~3GiB after config reload — monitor via the health log. RAM headroom tracked as RG-31.

### RG-21: Demo wearables clone tool and daily refresh

- **Source:** 2026-09-23 demo data refresh; `ppd_extraction_backend/scripts/clone_demo_wearables.py` (commit `e4fc614`), `scripts/demo_wearables_targets.json`
- **Risk:** Medium
- **Status:** Resolved (2026-09-23)
- **Description:** The clone script was rewritten with `dry-run` / `replace` / `refresh` modes. Source is Whoop user `573c3d0b-7a88-47f2-875d-e74316995432`; 16 targets in `demo_wearables_targets.json` (9 academy demo players + BCNPTA Player + 6 stale whoop ids). The 2026-09-23 `replace` run backed up to `Disk('backups','pre_whoop_clone_*.zip')`, deleted ~7.5k stale rows, and inserted 18,288 rows; all targets verified matching source ranges. A daily `refresh` cron runs at 05:30 UTC via `/etc/cron.d/demo-wearables-refresh` → `/usr/local/bin/demo-wearables-refresh.sh` (log `/var/log/demo-wearables-refresh.log`, logrotated); the job runs inside the `ppd-api` container (which has `clickhouse_driver`) and the wrapper `docker cp`s the script and targets file each run. Documented gotcha: `clickhouse_driver.execute()` silently drops the SELECT half of `INSERT INTO ... SELECT`, so the script uses SELECT + VALUES inserts.
- **Owner action required:** None for the tool itself. Related open items: consent/privacy (RG-28), stalled upstream provider syncs (RG-27).

### RG-22: Backend error surfacing for ClickHouse failures

- **Source:** 2026-09-23 deploy; `ppd_backend` commit `734cac5b`, deployed to prod `/opt/ppd-backend`
- **Risk:** Medium
- **Status:** Resolved (2026-09-23)
- **Description:** Loaders now raise `GraphDataUnavailableError` on query failure and routes return `503 {error: "data_unavailable", retryable: true}` instead of a fake "No Data" state; multi-source generator fallbacks are preserved. `ow_health_scores` was removed from provider-discovery UNIONs (the table does not exist). The ClickHouse client gained `send_receive_timeout=20` and `max_execution_time=15`.
- **Owner action required:** None. Residual gap (missing `ow_health_scores` table vs `load_health_scores`) tracked as RG-32.

### RG-23: Frontend error state for data_unavailable

- **Source:** 2026-09-23 deploy; `peak_performance_data` commit `8b013daa`
- **Risk:** Medium
- **Status:** Resolved (2026-09-23)
- **Description:** Added `GraphFetchError` / `isDataUnavailable` handling: the UI shows "Unable to load" + Retry instead of "No Data" for `data_unavailable` responses, errored payloads are never seeded into batch/SWR caches, and polling stops on a confirmed error.
- **Owner action required:** None.

### RG-24: INTERNAL_SERVICE_SECRET never configured in production

- **Source:** 2026-09-23 deploy incident; `/opt/ppd-backend/.env`, Vercel project `prj_6P8wpuuVUxYrpPMh04hx66vB4QPN`
- **Risk:** High
- **Status:** Resolved (2026-09-23)
- **Description:** `INTERNAL_SERVICE_SECRET` was never set on the backend `.env` or in Vercel. It went unnoticed because the previously deployed prod commit predated `AuthMiddleware`. A new 64-hex secret was rotated into `/opt/ppd-backend/.env` **and** the Vercel production environment. Note: a Vercel env change requires a new deployment to take effect.
- **Owner action required:** None for production. Preview/development coverage tracked as RG-33; deploy-drift monitoring tracked as RG-34.

### RG-25: Redis L2 graph cache prewarm unverified

- **Source:** 2026-09-23 deploy; compose service `ppc-redis`
- **Risk:** Medium
- **Status:** Open
- **Description:** The Redis L2 graph cache and prewarm path are now live via the `ppc-redis` compose service, but whether the prewarm job actually runs and what hit rates look like in production is unverified.
- **Owner action required:** Verify the prewarm job executes on schedule and measure cache hit rates; document or adjust TTL/warming scope accordingly.

### RG-26: body_summaries fallbacks and primary-key-aware loader queries

- **Source:** 2026-09-23 backend hardening review; `ppd_backend` loaders
- **Risk:** Medium
- **Status:** Open
- **Description:** Loaders should get `body_summaries` fallbacks and primary-key-aware queries that use the `(app_id, org_id, user_id)` key prefix so ClickHouse can prune efficiently. Currently queries do not exploit the primary key prefix.
- **Owner action required:** Approve the loader query changes (fallback source + key-prefix filters) and a verification pass against production query logs.

### RG-27: Six stale Whoop users + BCNPTA Player stopped syncing upstream ~July

- **Source:** 2026-09-23 demo clone run; `scripts/demo_wearables_targets.json` labels vs live data
- **Risk:** Medium
- **Status:** Open
- **Description:** Six Whoop targets and the BCNPTA Player had not received upstream provider data since roughly July; their demo data was overwritten by the clone copy, so evidence for why provider syncs stalled is most likely in `provider_connections` state or extraction API logs, not in the wearables tables themselves.
- **Owner action required:** Authorize an investigation into why provider syncs stalled for these users (provider_connections rows, extraction logs on ds-wearables-extract).

### RG-28: Demo-data consent — real athlete Whoop data copied into 16 demo accounts

- **Source:** 2026-09-23 demo clone run; `clone_demo_wearables.py` source user `573c3d0b-7a88-47f2-875d-e74316995432`
- **Risk:** High
- **Status:** Open
- **Description:** The clone tool copies a real athlete's Whoop data (body summaries, timeseries, sleep, workouts) into 16 demo accounts across academies. Consent/privacy acknowledgement for using this individual's data as demo content has not been recorded.
- **Owner action required:** Acknowledge or replace the demo data source; decide whether a synthetic/anonymized dataset is required.

### RG-29: Orphan ppc-api container on ds-wearables-process (89.167.47.236)

- **Source:** 2026-09-23 infrastructure review
- **Risk:** Low
- **Status:** Open
- **Description:** A `ppc-api` container runs on ds-wearables-process with `CLICKHOUSE_WEARABLES_HOST=host.docker.internal`, but no ClickHouse runs on that host and nothing routes to the container. It consumes resources while serving no traffic.
- **Owner action required:** Decide whether to decommission the container or fix its ClickHouse target and routing.

### RG-30: Dead host 37.27.198.42 references

- **Source:** 2026-09-23 infrastructure review; `ppd_extraction_backend/memory_bank/open-wearables.md:775`
- **Risk:** Low
- **Status:** Open
- **Description:** Host 37.27.198.42 was rebuilt with a different SSH key and its ClickHouse ports are closed. The MCP config and IDE data source were repointed to 116.202.100.150, but stale references remain — at minimum `ppd_extraction_backend/memory_bank/open-wearables.md:775` and possibly other docs.
- **Owner action required:** Approve a sweep for remaining 37.27.198.42 references and update or annotate them.

### RG-31: RAM headroom on the ClickHouse host

- **Source:** 2026-09-23 OOM incident (RG-20)
- **Risk:** Medium
- **Status:** Open
- **Description:** The ClickHouse host on ds-wearables-extract was OOM-killing the server under merge load even before tuning. Config now caps merges and caches, and swap was added, but the box is shared and structural jemalloc usage sits around ~3GiB post-tuning.
- **Owner action required:** Decide whether to upgrade the host to 16GiB RAM or move ClickHouse off the shared box; monitor `/var/log/ch-health.log` in the interim.

### RG-32: load_health_scores still targets missing ow_health_scores table

- **Source:** 2026-09-23 backend fix (RG-22); `ppd_backend` `data_processing/metric_aggregator.py`
- **Risk:** Medium
- **Status:** Open
- **Description:** `metric_aggregator._query_providers` was fixed (the nonexistent `ow_health_scores` was removed from provider-discovery UNIONs), but `load_health_scores` still targets the missing `ow_health_scores` table, so that metric path cannot succeed.
- **Owner action required:** Decide whether to create the `ow_health_scores` table (migration + population path) or remove the `load_health_scores` metric path.

### RG-33: INTERNAL_SERVICE_SECRET coverage for preview/development environments

- **Source:** 2026-09-23 secret rotation (RG-24)
- **Risk:** Low
- **Status:** Open
- **Description:** The rotated `INTERNAL_SERVICE_SECRET` was set for production (backend `.env` + Vercel production env). Whether Vercel preview/development environments — or any other deployment surfaces — also need the secret is unverified.
- **Owner action required:** Confirm which environments call the backend service routes and set the secret where needed.

### RG-34: Deploy drift — prod backend was 13 commits behind

- **Source:** 2026-09-23 deploy; `/opt/ppd-backend` vs `ppd_backend` HEAD
- **Risk:** Medium
- **Status:** Open
- **Description:** The deployed production backend was 13 commits behind the repository HEAD, which is why the missing `INTERNAL_SERVICE_SECRET` (RG-24) went unnoticed — the deployed code predated `AuthMiddleware`. There is no deploy-drift check or monitoring.
- **Owner action required:** Approve adding a deploy-drift check/monitor (e.g., deployed-revision endpoint vs HEAD alert).

### RG-35: Design tokens live in globals.css fallback — courtviz token source is a stub

- **Source:** 2026-10-27 design-system overhaul (plan-df5a2eb3958a6821, Wave 2a)
- **Risk:** Low
- **Status:** Open
- **Description:** The app imports `vendor/courtviz/integration/css/ppd-variables.css`, but the vendored courtviz checkout is a stub file (submodule content not installed), so `@ppd/tokens` cannot be regenerated from source. The light/dark surface tokens (`--background` 0 0% 99%, `--card`/`--popover` 0 0% 100%, `--brand-*` fallbacks) were therefore updated directly in `peak_performance_data/src/app/globals.css`. If the real courtviz checkout is ever installed, the generated `ppd-variables.css` must be reconciled with these fallback values or it will silently override them.
- **Owner action required:** Decide whether to install the real vendored courtviz packages and port the token definitions into `vendor/courtviz/packages/tokens`, or remove the stub import and make globals.css the declared source of truth.

### RG-36: GET /api/injuries returns sensitive injury fields to coaches

- **Source:** 2026-10-28 design-system overhaul (Wave 4.3 athlete detail)
- **Risk:** Medium
- **Status:** Open
- **Description:** `peak_performance_data/src/app/api/injuries/route.ts` GET authorizes any `coach` role (no assignment check beyond role) and selects `diagnosis`, `symptoms`, `treatment`, and `notes` — fields the app's BodyViz policy classifies as athlete/admin-only. The new coach athlete-detail Health tab deliberately avoids this endpoint and renders only public fields (active flag, type, severity) from the readiness matrix plus the coach-authorized `injury-risk` endpoint, but the endpoint itself still over-shares sensitive health data.
- **Owner action required:** Decide whether to restrict the sensitive columns to self/admin responses (or split the endpoint), and verify the coach assignment check.
