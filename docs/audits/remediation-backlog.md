---
id: PPD-PORTFOLIO-AUDIT-REMEDIATION-BACKLOG
last_reviewed: 2026-10-11
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
- **Correction (2026-10-11):** The courtviz submodule *is* installed, at `7bad49b`. The 251-byte stub `integration/css/ppd-variables.css` is committed upstream in that revision. It defines only `--ppd-primary/secondary/accent/bg/surface/text/muted`, and none of them is referenced in `peak_performance_data/src` or `tailwind.config.js`, so the import is currently a no-op. Decide-ready recommendation: declare `globals.css` the source of truth and remove the import. See `peak_performance_data/docs/evidence/design-ux-audit-2026-10-11.md` §8.

### RG-36: GET /api/injuries returns sensitive injury fields to coaches

- **Source:** 2026-10-28 design-system overhaul (Wave 4.3 athlete detail)
- **Risk:** Medium
- **Status:** Open
- **Description:** `peak_performance_data/src/app/api/injuries/route.ts` GET authorizes any `coach` role (no assignment check beyond role) and selects `diagnosis`, `symptoms`, `treatment`, and `notes` — fields the app's BodyViz policy classifies as athlete/admin-only. The new coach athlete-detail Health tab deliberately avoids this endpoint and renders only public fields (active flag, type, severity) from the readiness matrix plus the coach-authorized `injury-risk` endpoint, but the endpoint itself still over-shares sensitive health data.
- **Owner action required:** Decide whether to restrict the sensitive columns to self/admin responses (or split the endpoint), and verify the coach assignment check.

### RG-37: Coach mobile UX branch lacks signed-in browser verification

- **Source:** 2026-10-02 coach mobile UX effort (branch `fix/coach-mobile-ux-2026-10`, app commits `8b1b8a6a..35f32998`)
- **Risk:** Medium
- **Status:** Open
- **Description:** Signed-in browser verification at 390px and 1440px is still outstanding for the coach UX branch. Baseline screenshots and Server-Timing numbers (plan items P0.1/P0.2) were deferred because no QA coach login was available. Verification so far is unit tests, typecheck, and lint only.
- **Owner action required:** Provide a QA coach account (or approve a seeded fixture) so the deferred screenshot and Server-Timing baselines can be captured before merge.
- **Update (2026-10-11):** The design/UX audit (`peak_performance_data/docs/evidence/design-ux-audit-2026-10-11.md`) captured only fixture-backed `/design/preview` surfaces and public auth pages, because the owner chose a static audit. Signed-in role routes, the BCN tenant, blocked-API and throttled states, open dialogs, and the keyboard-open assistant all remain uncaptured. The item stays open. It now needs coach, player, and parent QA logins plus a BCN-org account.

### RG-38: Protected-route middleware getUser() round trip is unmeasured

- **Source:** 2026-10-02 coach mobile UX effort (branch `fix/coach-mobile-ux-2026-10`)
- **Risk:** Low
- **Status:** Resolved (superseded — see correction)
- **Description:** The protected-route middleware's `getUser()` network round trip was kept on purpose (owner decision). It adds a Supabase call to every protected navigation and has never been measured on this branch.
- **Correction (2026-10-08):** Owner decision — protected-route validation in `src/middleware.ts` and `src/middleware/auth.ts` switched from `getUser()` to `getClaims()` (local JWT signature verification via JWKS once asymmetric signing keys are enabled, GoTrue fallback while HS256). Revocation is detected at token expiry; sensitive writes keep `withAuth` `verifyUser`. The getUser round-trip measurement question is moot for the middleware path.
- **Owner action required:** Measure the round trip's contribution to navigation latency (e.g., Server-Timing or tracing) and decide whether it stays, is cached, or is restructured.

### RG-39: Prefetch URLs with no exact-key SWR consumer

- **Source:** 2026-10-02 SWR cache-scoping audit (app commit `35f32998`)
- **Risk:** Low
- **Status:** In progress
- **Description:** These prefetched URLs have no SWR consumer reading the exact key, so each warm is a wasted request: `/api/observations`, `/api/performance-tests`, `/api/training-sessions` (`useTrainingSessions` is defined but never called), `/api/dashboard/admin/executive-metrics` (`useAdminExecutiveMetrics` is defined but never called), `/api/tennis/matches` and `/api/tennis/matches?limit=12` (the consumer is `useSWRInfinite`, which caches under `$inf$`-namespaced keys), and `/api/tennis/matches/evolution` for coach/parent views (the consumer appends `?playerId=`). Locations: `peak_performance_data/src/lib/navigation/prefetch-map.ts`, `peak_performance_data/src/components/navigation/Sidebar/navigationItems.tsx`, `peak_performance_data/src/lib/auth/loginPrefetch.ts`.
- **Progress (2026-10-11):** Owner-approved plan item P1 (uncommitted): removed `/api/observations`, `/api/performance-tests` (navigation map and login prefetch) and `/api/tennis/matches?limit=12`. The exact-key consumer check kept `/api/tennis/matches/evolution`, `/api/dashboard/admin/executive-metrics` and the login `/api/training-sessions` prefetch; whether those consumers fire for coach/parent views is still to be re-checked with an authenticated run.
- **Owner action required:** Decide per URL whether to remove the prefetch or align the consumer key so the warm actually lands.

### RG-40: Module-level SWR helpers wrote to the wrong cache (fixed, needs observation)

- **Source:** 2026-10-02 SWR cache-scoping audit (app commit `35f32998`)
- **Risk:** Medium
- **Status:** Open
- **Description:** Before `35f32998`, module-level SWR helpers (`invalidateCacheByPrefix`, the `useApiMutation` revalidate list, the optimistic helpers in `peak_performance_data/src/hooks/api/useSWR.ts`, and the conversation/message cache updaters in `peak_performance_data/src/hooks/data/useConversations.ts` and `peak_performance_data/src/hooks/data/useMessages.ts`) called the global `mutate`, which only writes SWR's default cache — AuthContext wraps the app in a keyed per-user `SWRConfig` provider, so every one of those calls was a silent no-op. The branch fixed this via `peak_performance_data/src/lib/swr/scoped-mutate.ts` (`appMutate` routed through a registered scoped mutator). Newly live paths — optimistic conversation/message updates and prefix invalidation — now actually write and revalidate, and need production observation for behavior that was previously dead code.
- **Owner action required:** Watch optimistic messaging updates and post-mutation refetches in production (or staging) after merge; report any double-write or flicker regressions.

### RG-41: PPC backend Render service runs in Oregon while functions moved to lhr1

- **Source:** 2026-10 UX/perf improvement wave (branch `improve/ux-perf-wave-2026-10`); Vercel `regions: ["lhr1"]` and edge `preferredRegion = 'lhr1'` pinning
- **Risk:** Medium
- **Status:** Closed (invalid — see correction)
- **Description:** The PPC backend Render service `ppc-backend-8ow2` runs in Oregon. With Vercel functions and edge routes now pinned to `lhr1` (next to Supabase in eu-west-2), every graph/extraction call from those functions still crosses the Atlantic to Oregon, so the latency gain from the region move is partially lost on backend-dependent routes.
- **Correction (2026-10-09):** The Oregon/Render premise was wrong — it was derived from a stale CORS origin (`ppc-backend-8ow2.onrender.com` in `src/middleware/cors.ts`). Render is no longer used (owner statement 2026-10-09). The PPC graph backend actually runs as Docker service `ppc-api` on the Hetzner "Wearables-Data-Extraction" server (CX33, 116.202.100.150, Falkenstein, Germany, eu-central), behind the shared Traefik of the extraction stack at `https://api.wearablesync.app/ppc` (`/ppc/health` returned 200 healthy on 2026-10-09). Production app env is `NEXT_PUBLIC_PPC_API_URL=https://api.wearablesync.app/ppc`. The graph path is browser → Vercel lhr1 → Hetzner Falkenstein — already intra-EU, so no move is needed.
- **Owner action required:** None — no relocation needed.

### RG-42: Supabase asymmetric JWT signing keys not enabled — getClaims() falls back to Auth network call

- **Source:** 2026-10 UX/perf improvement wave (branch `improve/ux-perf-wave-2026-10`); `peak_performance_data/src/middleware.ts`, `peak_performance_data/src/middleware/auth.ts`
- **Risk:** Medium
- **Status:** Open
- **Description:** Protected-route middleware now validates sessions with `auth.getClaims()`. The Supabase project still uses symmetric HS256 JWT signing, so `getClaims()` cannot verify locally via JWKS and falls back to a GoTrue Auth network call — keeping a round trip on every protected navigation. Enabling asymmetric signing keys (Supabase dashboard: JWT Settings → signing keys) lets `getClaims()` verify locally.
- **Owner action required:** Enable asymmetric JWT signing keys for project `bcfwtgqvusjhlrqsztod` (new key + rotate), then verify middleware `getClaims()` resolves without an Auth network call.

### RG-43: Semantic level/status text colors fail WCAG AA contrast

- **Source:** 2026-10-11 design/UX audit (`peak_performance_data/docs/evidence/design-ux-audit-2026-10-11.md`, issue 1)
- **Risk:** Medium
- **Status:** Open
- **Description:** Measured on a white card in light theme, `--level-excellent` is 2.59:1 and `--level-average` is 2.13:1. In dark theme, `--level-poor` is 2.83:1. All are below the 4.5:1 body-text minimum. These tokens are used as text 410 times across 115 product files: readiness chips, deltas, and test levels. axe reports `color-contrast` on the coach-home, fitness-tests, and tennis-analytics preview surfaces.
- **Owner action required:** Approve text-only `-fg` token variants (DESIGN.md amendment A2) and the token-level fix.

### RG-44: Training session/plan create and edit skip cache revalidation

- **Source:** 2026-10-11 design/UX audit (issue 4)
- **Risk:** Medium
- **Status:** Open
- **Description:** `peak_performance_data/src/components/management/training/GroupTrainingSchedule.tsx` creates and updates sessions through raw `fetch` and patches only local component state. It fabricates an `attendance` array for the count and shows no success toast. Only delete calls `globalMutate('/api/training-sessions')`. `IndividualTrainingPlans.tsx` follows the same pattern. As a result, coach overview "Today's court", `CourtsBoard`, and other SWR consumers can show stale data after a create or edit until their own revalidation runs.
- **Owner action required:** Approve routing these mutations through `useApiMutation` / `appMutate` prefix invalidation, observing RG-40 for double-write or flicker.

### RG-45: Charts lack text alternatives and accessible names

- **Source:** 2026-10-11 design/UX audit (issue 6)
- **Risk:** Low
- **Status:** Open
- **Description:** 12 of 13 recharts-based components in `peak_performance_data/src/components` expose no accessible name and no data-table alternative. Only `GraphContainerRecharts.tsx` sets `role="img"` and `aria-label`. The fitness radar renders `polygon[role=button]` without names (axe `aria-command-name`). The DESIGN.md §12 analysis template requires a data table.
- **Owner action required:** Approve a shared `ChartFrame` (figure, caption, sr-only table) and the chart rules in DESIGN.md amendment A5.

### RG-46: Graph prewarm cache keys never match app chart requests

- **Source:** 2026-10-11 request/data-path latency investigation (`peak_performance_data/docs/evidence/speed-baseline-2026-10-11.md`, static finding 5); extends RG-25
- **Risk:** Medium
- **Status:** In progress
- **Description:** `ppd_backend/background_jobs/graph_prewarm.py` caches priority graphs for a 30-day explicit `start_date`/`end_date` window. The app's charts SSR seed and client batches request a 90-day window by default (`peak_performance_data/src/lib/chart-defaults.ts` `DEFAULT_CHART_DAYS_BACK = 90`). Explicit dates are part of the canonical cache key (`utils/core/caching.py` `build_cache_key_params`), so prewarmed entries are never read by default chart loads. `graph_cache` TTL is 2 hours and prewarm runs at 01:00, so entries expire by 03:00 anyway. The scheduler starts from the FastAPI `startup` event under `gunicorn --workers 2`, so two scheduler threads probably run (not verified). Prewarm selects only `role = player` (limit 500). Even if RG-25 shows the job running, it gives no cache benefit as written.
- **Progress (2026-10-11):** Plan item P3 (uncommitted in `ppd_backend`, not deployed): prewarm now uses a 90-day explicit window and normalized `build_cache_key_params` keys (the old raw params also missed the normalized API keys), runs separately at 06:00 UTC, and each scheduled job takes a Redis `SET NX EX 6h` daily lock. TTL unchanged (2 h). Deploy and production hit-rate check remain owner actions (RG-25).
- **Owner action required:** Decide whether to align prewarm to the app's default window and the active-hours TTL (or schedule it shortly before peak use), run a single scheduler instance, or remove prewarm. Pair with RG-25 production hit-rate measurement.

### RG-47: Every authenticated API request repeats a GoTrue round trip and a profiles query

- **Source:** 2026-10-11 request/data-path latency investigation (static finding 1); multiplier of RG-42
- **Risk:** Medium
- **Status:** In progress
- **Description:** Middleware does not run for `/api/*`, so the `with*Auth` wrappers in `peak_performance_data/src/lib/api/with-auth.ts` call `auth.getClaims()` on every request. 84 route files use these wrappers. While HS256 is in use (RG-42), `getClaims()` falls back to a GoTrue `getUser()` network call. The role-checking wrappers also query `profiles` on every call with no cache. A dashboard load pays one GoTrue call per client API request in addition to the middleware call for the navigation. Not measured: no authenticated capture exists (RG-37).
- **Progress (2026-10-11):** Plan item P4 (uncommitted): `with-auth.ts` `getUserProfile` now has a per-instance LRU (500 entries, 60 s TTL; errors and null rows not cached), with header/cookie bypass and `invalidateApiProfileCache` called from update-user-role, update-coach-request, switch-role, switch-organization and invitation accept. A role change made on another instance takes up to 60 s to apply. The GoTrue round trip remains until RG-42.
- **Owner action required:** Prioritize RG-42 (removes the GoTrue call from every request without weakening verification). Decide whether a short per-instance profile cache, like the middleware LRU, is acceptable for API role checks. Measure with `PPD_TIMING=1` once an authenticated harness run is possible.

### RG-48: Charts SSR seed blocks non-recovery groups on recovery graphs

- **Source:** 2026-10-11 request/data-path latency investigation (static finding 4)
- **Risk:** Low
- **Status:** In progress
- **Description:** `peak_performance_data/src/app/[locale]/charts/page.tsx` holds the HTML for up to 1,500 ms (`SERVER_SEED_TIMEOUT_MS`) while seeding graphs. For every group other than recovery, it seeds `hrv_trends` and `resting_heart_rate`, both recovery-group graphs (`src/lib/charts/metric-catalog.ts`). `/charts?group=sleep` and the other groups wait on graphs that are not their first visible content.
- **Progress (2026-10-11):** Plan item P2 (uncommitted): `getSsrSeedGraphTypes(group)` seeds only the group's `allProviders` graphs (max 4); groups with none (sleep) skip the blocking seed.
- **Owner action required:** Approve seeding the requested group's own priority graphs, or skipping the blocking seed for non-recovery groups.

### RG-49: Charts preconnect header is ineffective and covers only four locales

- **Source:** 2026-10-11 request/data-path latency investigation (static finding 6)
- **Risk:** Low
- **Status:** In progress
- **Description:** `peak_performance_data/next.config.js` sends `Link: <https://api.wearablesync.app>; rel=preconnect` only for `/:locale(en|es|zh|ca)/charts/:path*`, which misses `nl`, `de`, `fr` and `pt`. The browser never connects to `api.wearablesync.app`, though: all PPC traffic goes through same-origin `/api/ppc-proxy` and server-side fetches. Widening the locale list would gain nothing. The header is dead configuration.
- **Progress (2026-10-11):** Plan item P8 (uncommitted): header rule removed; verified absent on `/en/charts` and `/nl/charts` on a local build.
- **Owner action required:** Approve removing the header (preferred) rather than widening it.

### RG-50: Role routes ship 35–67% of the full message bundle in the RSC payload

- **Source:** 2026-10-11 request/data-path latency investigation (payload table)
- **Risk:** Low
- **Status:** In progress
- **Description:** The full `en` messages serialize to 371,160 B. Shell plus route-provider messages are 249,728 B for `/player`, 223,224 B for every `/coach/*` route (route messages are keyed by top-level segment), 199,060 B for `/parent`, 150,283 B for `/charts` and 130,047 B for `/performance-tests` (uncompressed). These bytes go into every full load of the route.
- **Progress (2026-10-11):** Plan item P5 (uncommitted): `/coach` messages are now emitted per sub-route by `scripts/generate-route-namespaces.js`, and each sub-route mounts its own provider. Serialized `en` route sets are now 42,691–96,881 B (previously 179,512 B), with a byte-budget test at 150,000 B. Other segments unchanged.
- **Owner action required:** Approve narrowing `route-namespaces` to the namespaces each sub-route renders (for example `/coach/players` versus `/coach/reports`), with a byte budget test.

### RG-51: Some private API responses are still cached by the service worker

- **Source:** 2026-10-11 request/data-path latency investigation (static finding 7)
- **Risk:** Medium
- **Status:** In progress
- **Description:** The WP-02.8 / P4.6 policy makes personalized APIs `NetworkOnly`. These personalized routes still use shared SW caches in `peak_performance_data/next.config.js`: `/api/parent/*` (`NetworkFirst`, 1 h), `/api/organizations/*` (`StaleWhileRevalidate`, 1 h), `/api/training-*` (`NetworkFirst`, 30 min), `/api/management/*` (`StaleWhileRevalidate`, 15 min), `/api/admin/*` (`NetworkFirst`, 1 min), and Supabase REST (`NetworkFirst`, 1 h). Caches are purged on `SIGNED_OUT` (`src/lib/pwa/cacheInvalidation.ts`). They are not purged on token expiry without sign-out, or on an account switch that does not emit `SIGNED_OUT`. `StaleWhileRevalidate` also shows data up to 15–60 minutes old on first paint. Whether any of this is intentional offline support was not confirmed.
- **Progress (2026-10-11):** Plan item P6 (uncommitted): all six rules switched to `NetworkOnly`; the retired cache names are kept in `PRIVATE_CACHE_NAMES` and added to the SW activation purge list.
- **Owner action required:** Decide per route between `NetworkOnly` (privacy and freshness) and offline support. Confirm the purge triggers cover account switches.

### RG-52: Login redirect drops the original query string

- **Source:** 2026-10-11 request/data-path latency investigation (middleware probe)
- **Risk:** Low
- **Status:** In progress
- **Description:** An unauthenticated request to `/en/charts?group=recovery` redirects to `/en/login?redirect=%2Fen%2Fcharts`. The `group` parameter is lost, so after sign-in the user lands on the default view and needs another navigation.
- **Progress (2026-10-11):** Plan item P9 (uncommitted): redirect now carries path plus query; verified on a local build (`redirect=%2Fen%2Fcharts%3Fgroup%3Drecovery`).
- **Owner action required:** Approve preserving a validated same-origin path plus query in `redirect`.

### RG-53: Landing page transfers about 7.3 MB per load

- **Source:** 2026-10-11 request/data-path latency investigation (`perf-audit-unauth-sw-{on,off}-2026-10-10.json`)
- **Risk:** Low
- **Status:** Open
- **Description:** `/en` transferred 7,252–7,278 KB on every measured load (10 runs, SW on and off) on a local production build of an uncommitted tree. The source is probably the hero video (`HeroVideoShowcase`), which also has uncommitted changes from another workstream. There is no per-resource breakdown yet.
- **Progress (2026-10-11):** Per-resource measurement on a local build: `videos/ppd-consumer.mp4` is 7.37 MB of the cold `/en` load; LCP p50 about 560 ms. No code change made (the landing files belong to another in-flight workstream).
- **Owner action required:** Re-measure on the committed revision with a per-resource breakdown, then decide on poster-first/lazy video loading.
- **Update (2026-10-11, runtime-perf baseline):** Per-resource breakdown at `4bceb9ef`: in 8 s unthrottled at 390 px, `/en` received 5.8 MB of `/videos/ppd-consumer.mp4` (HTTP 206). `autoPlay` plus `tryPlay()` on mount override `preload="metadata"`. Fix proposed as P1-5 in `peak_performance_data/docs/evidence/runtime-perf-baseline-2026-10-11.md`.
- **Update (2026-10-11, P1-5 implemented, uncommitted):** The video gets a source only after intersection, never on Save-Data or reduced motion, and a 540w mobile rendition is used under 768 px. On a local build of HEAD plus the patch, `/en` at 390 px fetched 1,682 KB of video instead of 7,168 KB. Desktop still uses the 1080p files. Close this item once the change is committed and re-measured on a deploy.

### RG-54: Named athlete report served from `public/` and precached by the service worker

- **Source:** 2026-10-11 runtime-perf baseline (SW precache audit)
- **Risk:** Medium
- **Status:** Open
- **Description:** `peak_performance_data/public/reports/ben-wiesel-2026-06-11/index.html` and `public/reports/ben-wiesel--11-06-2026/index.html` are tracked in git, served at public URLs with no auth, and listed in the `public/sw.js` precache manifest. Every installed PWA downloads them. Nothing in `src/` references them. Whether this is intentional (a shared report link) and whether consent covers public hosting was not confirmed.
- **Owner action required:** Confirm intent and consent. If unintended, approve removing them from `public/` (and from git history if needed) and adding `reports/**` to `publicExcludes`.
- **Owner decision (2026-10-11):** Not intended. `reports/**` is added to `publicExcludes` as part of runtime-perf plan item P0-1, so installed PWAs stop precaching the files. The files are still served publicly. Removing them from `public/` (or moving them behind auth), and deciding whether to purge them from git history, is a separate change that still needs approval.

### RG-55: Service worker precaches every `_next` chunk in the app

- **Source:** 2026-10-11 runtime-perf baseline
- **Risk:** Low
- **Status:** Open
- **Description:** next-pwa's default build manifest precaches all 9.2 MB of `/_next/static/chunks` (every route, including admin, design and BodyViz chunks) on install and after every deploy (`skipWaiting: true`). The offline scope (which routes must work offline) is not documented, so the precache cannot be narrowed safely.
- **Owner action required:** Decide the offline route scope, then approve restricting `buildExcludes`/precache to those routes' chunks.

### RG-56: Optimized images bypass the service worker image cache

- **Source:** 2026-10-11 runtime-perf baseline
- **Risk:** Low
- **Status:** Open
- **Description:** The `static-images-v3` runtime rule in `peak_performance_data/next.config.js` matches `/\.(?:png|jpg|jpeg|svg|gif|webp|ico)$/i`. `next/image` URLs (`/_next/image?url=…&w=…`) end in a query string, so they never match, and the custom `runtimeCaching` replaces next-pwa's default `next-image` rule. Optimized images (logos, avatars) are therefore not cached by the SW. The impact on repeat visits was not measured.
- **Owner action required:** Approve adding a `/_next/image` rule, or confirm that HTTP caching is sufficient.

### RG-57: Barlow Condensed rendered with synthetic bold on tennis-bench

- **Source:** 2026-10-11 runtime-perf baseline (font audit)
- **Risk:** Low
- **Status:** Open
- **Description:** `src/lib/fonts.ts` loads Barlow Condensed weight 600 only. `src/components/tennis-bench/*` (`MatchScoreboard`, `StorySummaryDashboard`, `StatPill`) use `font-bold`/`font-extrabold` with that family, so browsers synthesize bold. This is a design-fidelity issue on a marketing surface, not a performance one.
- **Owner action required:** Choose to load weights 700/800 for tennis-bench only, or change those classes to `font-semibold`.

### RG-58: Mobile sheet exit animations never run

- **Source:** 2026-10-11 runtime-perf baseline (T1 review)
- **Risk:** Low
- **Status:** Open
- **Description:** `src/components/mobile/MobileSheetContent.tsx` sets framer-motion `exit` props. `ResponsiveDialogContent` returns `null` when closed and is not wrapped in `AnimatePresence`, so the sheet unmounts instantly. Related: the comment in `src/components/navigation/LazyBottomNav.tsx` says the dynamic import "removes framer-motion", but `BottomNav` does not import framer-motion.
- **Owner action required:** Decide whether sheets should animate out. If they should, the preferred fix is CSS / Radix `data-state` animations, which also drops the 41 KB framer chunk on first open. Approve the comment correction.
