# 21 — ClickHouse Wearables Data Model & Query Patterns

**Scope:** Read-only reconstruction of ClickHouse wearables schema and every query pattern used against it, derived from DDL migrations, transformers, graph loaders, and AI-agent tools. No live DB inspection.

**Primary sources:**
- DDL: `PeakPerformanceData/ppd_extraction_backend/migrations/000`–`010_*.sql`
- Ingest: `ppd_extraction_backend/src/openwearables/`
- Reads: `ppd_backend/data_processing/base/graph_data_processor.py`, graph generators
- AI agent: `ppp_ai_agent/tools/wearables.py`, `tools/cgm.py`, `tools/db.py`
- Next.js: proxies to `ppd_backend` (no direct ClickHouse client in `src/`)

---

## 1. Databases

| Database | Purpose | Created / referenced |
|----------|---------|----------------------|
| `openwearables_data` | Canonical multi-provider OW pipeline (Garmin, Whoop, Polar, Suunto, planned Apple Health) | `migrations/000_create_database.sql` L5; client default via `CLICKHOUSE_OW_DATABASE` (`settings.py` L30 → `"openwearables_data"`) |
| `wearables_data` | Legacy Garmin Connect scrape tables + user credential store | Default CH client DB in `ppd_backend/config/database.py` L28 and `ppp_ai_agent/config/settings.py` L26 (`"wearables_data"`); DDL sketch in `memory_bank/garmin_clickhouse_schema.sql`; users in `migrations/009_create_users.sql` |

**Important:** Almost all production graph/AI queries fully-qualify `openwearables_data.ow_*`. The client `database=` param is often `wearables_data` and is unused for those fully-qualified queries (`_plans/research/07-python-data-access.md` L113).

---

## 2. Table inventory (`openwearables_data`)

Confidence legend:
- **DDL-confident:** column exists in a `CREATE TABLE` migration.
- **Write-confident:** transformers / webhook processor insert that column.
- **Inferred:** only seen in a query alias or comment; may be wrong (flagged).

### 2.1 `ow_workouts` — DDL-confident

**File:** `migrations/001_create_ow_workouts.sql` L7–85  
**Engine:** `ReplacingMergeTree(synced_at)`  
**ORDER BY:** `(app_id, org_id, user_id, provider, id)`  
**PARTITION BY:** `(toYYYYMM(start_time), app_id)`

| Column | Type | Notes |
|--------|------|-------|
| `app_id`, `org_id`, `user_id` | String | Tenant keys |
| `id` | UUID | Internal workout id |
| `provider` | LowCardinality(String) | `apple_health`, `garmin`, `polar`, `suunto`, `whoop` (comment L15) |
| `provider_workout_id` | String | |
| `device` | Nullable(String) | |
| `workout_type` | LowCardinality(String) | Unified type |
| `provider_workout_type` | Nullable(String) | |
| `name` | Nullable(String) | |
| `start_time`, `end_time` | DateTime64(3) | |
| `duration_seconds` | UInt32 | |
| `moving_time_seconds` | Nullable(UInt32) | |
| `calories_kcal`, `active_calories_kcal` | Nullable(Float32) | |
| `distance_meters` | Nullable(Float32) | |
| `avg_pace_sec_per_km`, `max_pace_sec_per_km` | Nullable(UInt16) | |
| `avg_speed_mps`, `max_speed_mps` | Nullable(Float32) | |
| `avg_heart_rate_bpm`, `max_heart_rate_bpm`, `min_heart_rate_bpm` | Nullable(UInt16) | |
| elevation / cadence / stride / GCT / VO / power / swim fields | various Nullable | L47–69 |
| `steps` | Nullable(UInt32) | |
| `training_effect_aerobic`, `training_effect_anaerobic`, `training_load` | Nullable(Float32) | |
| `has_gps` | Bool | |
| `raw_data` | String | |
| `synced_at` | DateTime64(3) | ReplacingMergeTree version |

**Written by:** `transformers/workouts.py` via `OpenWearablesSyncService` for all providers that return workout events.  
**Read by:** `graph_data_processor._load_ow_activity_data` (L318–385), `ppp_ai_agent/tools/wearables.get_wearable_activities` (L28–68), `graphs.py` provider discovery (L221–222).

### 2.2 `ow_sleep_sessions` — DDL-confident

**File:** `migrations/002_create_ow_sleep_sessions.sql` L7–58  
**Engine / keys:** same tenant ORDER BY pattern as workouts; partition on `start_time`.

Columns include sleep stages (awake/light/deep/rem minutes), efficiency, score, latency, interruptions, sleep HR/HRV/RR/SpO2, skin temp deviation, nap flag. SpO2 slots: `avg_spo2_percent`, `min_spo2_percent` (L43–44).

**Written by:** `transformers/sleep.py` during sync.  
**Read by:** status counts in `provider_data.py` L448; **not** used by ppd_backend graph loaders (those use `ow_sleep_summaries`).

### 2.3 `ow_timeseries` — DDL-confident (metric keyed by string)

**File:** `migrations/003_create_ow_timeseries.sql` L7–27  
**Engine:** `ReplacingMergeTree(synced_at)`  
**ORDER BY:** `(app_id, org_id, user_id, metric_type, timestamp)`  
**PARTITION BY:** `(toYYYYMM(timestamp), app_id)`

| Column | Type | Role |
|--------|------|------|
| `app_id`, `org_id`, `user_id` | String | Tenant |
| `provider` | LowCardinality(String) | |
| `device` | Nullable(String) | |
| `metric_type` | LowCardinality(String) | **Primary metric key** (not separate tables) |
| `timestamp` | DateTime64(3) | Sample time |
| `value` | Float64 | |
| `unit` | LowCardinality(String) | |
| `source` | Nullable(String) | e.g. webhook source tag |
| `context` | Nullable(String) | e.g. `systolic`/`diastolic`, `resting` |
| `raw_data` | String | |
| `synced_at` | DateTime64(3) | Version |

**Sampling resolution:** OW API supports `resolution ∈ {1hour, 1min, 5min, 15min, raw}` (`client.py` L11). Sync pulls timeseries with `resolution="raw"` (`sync_service.py` L335). Actual native sample rates are provider-dependent; stored as one row per `(metric_type, timestamp)` after ReplacingMergeTree dedupe via `argMax(..., synced_at)`.

**Retention:** **No TTL** on `ow_timeseries` (or other `ow_*` fact tables). Only `audit_log` has `TTL … + INTERVAL 90 DAY` (`006_create_ow_audit_log.sql` L16). Legacy Garmin intraday tables in the memory-bank schema optionally use `TTL … + INTERVAL 2 YEAR` — that is **not** applied to `openwearables_data`.

### 2.4 Summary tables — DDL-confident

**File:** `migrations/004_create_ow_summaries.sql`

| Table | Grain | Notable columns |
|-------|-------|-----------------|
| `ow_activity_summaries` L8–33 | `(app_id, org_id, user_id, provider, date)` | `steps`, `distance_meters`, `floors_climbed`, `elevation_meters`, `active_calories_kcal`, `total_calories_kcal`, `active_minutes`, `sedentary_minutes`, intensity light/moderate/vigorous, `hr_avg_bpm`/`hr_max_bpm`/`hr_min_bpm` |
| `ow_sleep_summaries` L38–65 | same + date | duration/stages/efficiency, `avg_heart_rate_bpm`, `avg_hrv_sdnn_ms`, `avg_respiratory_rate`, `avg_spo2_percent` |
| `ow_body_summaries` L70–97 | same + date | weight/BMI/body fat, RHR, HRV, **BP avg/max/min systolic & diastolic**, `bp_reading_count`, basal temp |
| `ow_recovery_summaries` L102–119 | same + date | sleep metrics + `recovery_score` |

All: `ReplacingMergeTree(synced_at)`, partition `(toYYYYMM(date), app_id)`.

**Write status:** activity/sleep/body synced from OW (`sync_service.py` L142–143, L237). Recovery table exists in DDL; ingest usage is thinner (transformers exist in `transformers/summaries.py`).

**Read status:** activity + sleep heavily used by graphs. **No ppd_backend/ppp_ai_agent SELECT against `ow_body_summaries` or `ow_recovery_summaries` found.**

### 2.5 Aggregates / rollups

| Object | File | Notes |
|--------|------|-------|
| `ow_timeseries_daily_mv` | `005_create_ow_materialized_views.sql` L6–21 | Materialized view → AggregatingMergeTree daily avg/min/max/count |
| `ow_timeseries_daily_rollups` | `010_create_ow_timeseries_daily_rollups.sql` L1–15 | Explicit table refreshed by `_refresh_timeseries_daily_rollups` (`sync_service.py` L363–425); preferred by `load_timeseries_daily_avg` |

Rollup columns: `app_id, org_id, user_id, metric_type, day, avg_value, min_value, max_value, sample_count, refreshed_at`.

### 2.6 Tenancy / mapping / audit

| Table | File | Columns (DDL-confident) |
|-------|------|-------------------------|
| `apps` | `007` L7–17 | `app_id`, `app_name`, `app_slug`, `api_key_hash`, `webhook_secret`, `settings`, timestamps |
| `organizations` | `007` L20–32 | `org_id`, `app_id`, `org_name`, `org_slug`, `domain`, theming, `settings` |
| `user_mapping` | `008` L7–16 | `app_id, org_id, user_id, ow_user_id, email, …` maps PPD user → OW internal id |
| `provider_connections` | `008` L23–35 | per-user provider status / last sync |
| `audit_log` | `006` L5–16 | event stream; **90-day TTL** |
| `schema_migrations` | `scripts/migrate_schema.py` L35 | migration bookkeeping |

### 2.7 `wearables_data` (legacy Garmin)

**Users / extraction:** `migrations/009_create_users.sql` — `wearables_data.users`, `wearables_data.user_extraction_status` (no `org_id`).

**Fact tables (memory-bank DDL, write-confident via extractors):** dozens of Garmin Connect tables (`activities`, `hrv_data`, `spo2_data`, `blood_pressure`, `sleep_sessions`, intraday HR/steps/stress, etc.) in `memory_bank/garmin_clickhouse_schema.sql`. Still queried for:
- unofficial activity path: `FROM activities` (default DB `wearables_data`) in `graph_data_processor.load_activity_data` when `data_source != 'official'` (L212–248)
- HRV fallback: `wearables_data.hrv_data` (L791–807)

These legacy tables are **user-scoped only** (no `app_id`/`org_id`).

---

## 3. Timeseries model

### 3.1 Metric keying

**Single wide table** with `metric_type` string — not one table per metric (`003_create_ow_timeseries.sql` L16).

Canonical unit map (OW official types + Garmin wellness): `transformers/timeseries.py` `METRIC_UNITS` L12–81.

**Apple Health–oriented types (planned / OW-normalized):**  
`blood_glucose`, `blood_pressure_systolic`, `blood_pressure_diastolic`, `oxygen_saturation`, `respiratory_rate`, `heart_rate`, `heart_rate_variability_sdnn` / `_rmssd`, `resting_heart_rate`, `body_temperature`, `vo2_max`, `recovery_score`, steps/energy/distance family, etc.

**Garmin webhook–specific types** (written by `health_data_processor.py`, often with `garmin_` prefix):  
`garmin_body_battery`, `garmin_stress_level`, `garmin_spo2`, `garmin_respiration_rate`, `garmin_skin_temperature`, `garmin_blood_pressure` (context=`systolic`|`diastolic`), `garmin_vo2max`, `garmin_fitness_age`, `garmin_hrv_status`, `training_readiness`, `recovery_time`, `training_load`, `aerobic_training_effect`, `anaerobic_training_effect`, `menstrual_cycle_day` / `_length` / `_phase`, `course_distance`, `course_elevation`, …

**Normalization reality:** providers are normalized into the same tables with a `provider` column and shared column names for workouts/sleep/summaries. Timeseries metric names are **not fully unified** — e.g. SpO2 may appear as `oxygen_saturation` (Whoop/OW) vs `garmin_spo2` (webhook). Graphs pick a primary metric and sometimes fall back to summary columns.

### 3.2 Dedupe pattern

All readers that care about correctness use:

```sql
argMax(value, synced_at) ... GROUP BY app_id, org_id, user_id, metric_type, timestamp
```

(or tuple-`argMax` for wide rows). Matches `ReplacingMergeTree(synced_at)` before `OPTIMIZE` / `FINAL`.

---

## 4. Provider → table mapping

| Provider | Workouts | Sleep sessions | Activity summaries | Sleep summaries | Timeseries | Notes |
|----------|----------|----------------|--------------------|-----------------|------------|-------|
| Garmin (OAuth + Health webhooks) | `ow_workouts` | `ow_sleep_sessions` | `ow_activity_summaries` | `ow_sleep_summaries` | OW sync + webhook processor | Dual path: OW sync + `health_data_processor` hardcodes `app_id="ppd"`, `org_id="peak_performance"` (L1063–1068) |
| Whoop | yes | yes | yes | yes | `recovery_score`, `oxygen_saturation`, `body_temperature`, RHR, etc. | Webhook + forced sync (`client.py` L221–224) |
| Polar | yes | limited | yes | yes | partial | Same OW sync path |
| Suunto | yes (DDL comment) | yes (DDL) | via OW | via OW | via OW | Listed in `ProviderType` |
| Apple Health | planned | planned | planned | planned | types reserved in `METRIC_UNITS` | Client comment: pushed via SDK, not server sync (`client.py` L220) |
| Legacy Garmin Connect scrape | `wearables_data.activities` (+ many specialty tables) | `sleep_sessions` etc. | `daily_summaries` | — | per-table | Separate user_id mapping via OW API resolver |

---

## 5. User identity & multi-tenancy (critical)

### 5.1 What `user_id` means in `openwearables_data`

**Write path (`TenantContext`):**  
`user_id` = PPD / Supabase Auth UUID (`webhooks.py` L242–244, `provider_data.py` L483–484, `multi_user_scheduler.py` L363–364).  
`app_id` is hardcoded `"ppd"`.  
`org_id` = Supabase `organizations.slug` via `get_user_org_id` (`supabase_client.py` L17–60), fallback `"peak_performance"`.

Comment in loader: *“ow_workouts.user_id stores the Supabase Auth user_id directly (no resolver needed)”* — `graph_data_processor.py` L286.

**Separate mapping table:** `user_mapping.ow_user_id` stores OpenWearables internal UUID for API calls; fact tables still key by PPD `user_id`.

**Legacy `wearables_data`:** may store OW internal UUID or Supabase UUID; unofficial path resolves via `UserIdResolver` (`user_id_resolver.py` L1–11, L56–89) and queries `IN (resolved, original)`.

### 5.2 Multi-tenancy verdict

| Layer | Has `org_id`? | Used for read scoping? |
|-------|---------------|------------------------|
| DDL on every `ow_*` fact/summary/rollup | **Yes** — required column | N/A |
| Ingest writers | **Yes** — set from Supabase org slug (or hardcoded `"peak_performance"` for Garmin webhooks) | N/A |
| All ppd_backend / ppp_ai_agent SELECT patterns | Present in `GROUP BY` only | **No** — filters are `WHERE user_id = …` only |
| Next.js org checks | Org verified in Supabase before calling backend | **Not** passed into ClickHouse SQL |

**Verdict:** ClickHouse rows **do carry** `org_id` (and `app_id`) on every `openwearables_data` fact/summary/rollup row. **Organization scoping is not enforced at query time.** Isolation relies on knowing the athlete’s Supabase `user_id`. A reader with any user’s UUID can fetch their wearables without an `org_id` predicate. Legacy `wearables_data` tables have **no** org column at all.

This is intentional for single-app `"ppd"` today but is a multi-tenant footgun if org-level CH isolation is required.

---

## 6. Query patterns (distinct)

Default windows unless noted: graphs `days_back=90` (VO2/menstrual 120–180); AI tools `days_back=7`.

| # | Pattern | Caller | Table(s) | Aggregation | Window | Expected row count |
|---|---------|--------|----------|-------------|--------|--------------------|
| Q1 | Official workouts list | `_load_ow_activity_data` L318–385; `get_wearable_activities` L28–68 | `ow_workouts` | `argMax` tuple / cols by `synced_at`; `GROUP BY app_id, org_id, user_id, provider, id`; `ORDER BY start_time`; `LIMIT 1000` (backend) / `limit` param default 50 (AI) | `start_time` range | ≤1000 workouts (backend); ≤`limit` (AI) |
| Q2 | Unofficial Garmin activities | `load_activity_data` L212–248 | `wearables_data.activities` | row select, no argMax | `start_time_gmt` range | ≤1000 |
| Q3 | Daily activity summaries | `load_activity_summaries` L557–587; AI `get_wearable_summary` L112–130 | `ow_activity_summaries` | `argMax` by day/provider | `date` / (AI wrongly uses `summary_date`) | ~1 row/day/provider ≈ `days_back` |
| Q4 | Daily sleep summaries | `load_sleep_summaries` L620–648 | `ow_sleep_summaries` | same | `date` range | ~1/day/provider |
| Q5 | Raw timeseries metric | `load_timeseries` L668–687; AI `get_cgm_scores` L144–152 | `ow_timeseries` | argMax per timestamp (backend); AI: no argMax, filter `metric_type` | timestamp range | CGM: hundreds–thousands/week; HR: can be 10k+/90d |
| Q6 | Daily timeseries rollup | `load_timeseries_daily_avg` L719–734 | `ow_timeseries_daily_rollups FINAL` | pre-aggregated | `day` range | ~1/day/metric |
| Q7 | Daily timeseries fallback | same L738–759 | `ow_timeseries` | argMax then `avg/min/max` by `toDate(timestamp)` | timestamp range | ~1/day |
| Q8 | Provider discovery | `graphs.get_user_providers` L219–233 | workouts ∪ sleep_summaries ∪ activity_summaries ∪ timeseries | `DISTINCT provider`, `LIMIT 3` per branch | none | ≤ ~12 then distinct |
| Q9 | Garmin HRV legacy | `load_hrv_from_garmin_table` L791–807 | `wearables_data.hrv_data` | `argMax(last_night_avg)` by date | date range | ~1/day |
| Q10 | Rollup refresh (write) | `sync_service._refresh_timeseries_daily_rollups` L373–412 | insert into rollups from timeseries | daily avg/min/max/count | sync window | 1 insert batch |
| Q11 | Existence counts | `provider_data.py` L446–450 | workouts / sleep_sessions / sleep_summaries | `count()` FINAL | none | 1 scalar each |

### Graph → metric mapping (Q5/Q6)

| Graph / tool | `metric_type` / table | File |
|--------------|----------------------|------|
| Body Battery | `garmin_body_battery` | `body_battery.py` L22–24 |
| Stress | `garmin_stress_level` | `stress_levels.py` L22–24 |
| Blood Oxygen | `oxygen_saturation` | `blood_oxygen.py` L35–36 |
| Recovery | `recovery_score` + SpO2 + `body_temperature` | `recovery_score.py` L45–52 |
| Resting HR | `resting_heart_rate` → fallback sleep `avg_heart_rate_bpm` | `resting_heart_rate.py` L38–44 |
| Respiration | `garmin_respiration_rate` → fallback sleep RR | `respiration_rate.py` L39–45 |
| HRV | sleep `avg_hrv_sdnn_ms` → `heart_rate_variability_sdnn` → `_rmssd` → legacy `heart_rate_variability` → `hrv_data` | `hrv_trends.py` L113–144 |
| VO2 Max | `vo2_max` → `garmin_vo2max` → workouts | `vo2_max_trends.py` L34–50 |
| HR zones | raw `heart_rate` | `hr_zone_distribution.py` L56 |
| Body temp | `body_temperature` | `body_temperature.py` L36 |
| Menstrual | `menstrual_cycle_day` | `menstrual_cycle.py` L27–29 |
| Steps / calories / intensity | `ow_activity_summaries` cols | `daily_steps.py`, `daily_calories.py`, `intensity_minutes.py` |
| Sleep graphs | `ow_sleep_summaries` | `sleep_duration.py`, `sleep_efficiency.py`, `sleep_stages.py` |
| Workout graphs | `ow_workouts` via load_activity_data | duration/calories/HR/load/consistency/pace… |
| CGM scores | `blood_glucose` | `ppp_ai_agent/tools/cgm.py` L144–152 |

### Next.js

No direct ClickHouse driver in `peak_performance_data/src/`. Wearable AI routes call `ppd_backend` HTTP (`wearable-query/route.ts` L45–49; `wearableInsightTools.ts` L47–60). Org scoping happens in Supabase before the proxy.

---

## 7. AI-agent schema drift (actionable for wearable specialist)

`ppp_ai_agent/tools/wearables.py` `get_wearable_summary` (L112–130) queries columns that **do not match DDL**:

| AI query column | Actual DDL (`004` / transformer) |
|-----------------|----------------------------------|
| `summary_date` | `date` |
| `calories_kcal` | `active_calories_kcal` / `total_calories_kcal` |
| `active_time_minutes` | `active_minutes` |
| `sedentary_time_minutes` | `sedentary_minutes` |
| `avg_heart_rate_bpm` | `hr_avg_bpm` |
| `max_heart_rate_bpm` | `hr_max_bpm` |
| `resting_heart_rate_bpm` | **not on activity summaries** (body summaries / timeseries) |

`get_wearable_activities` column names largely match `ow_workouts` DDL (good).  
`get_cgm_scores` matches `ow_timeseries` (`metric_type='blood_glucose'`) but skips ReplacingMergeTree dedupe/`argMax`.

Correct reference implementation: `graph_data_processor.load_activity_summaries` L557–587.

---

## 8. CGM / BP / SpO2 availability (planned Apple Health & CGM)

| Signal | Slot exists? | Where | Queried today? |
|--------|--------------|-------|----------------|
| Blood glucose (CGM) | **Yes** | `ow_timeseries.metric_type = 'blood_glucose'`, unit `mg/dL` (`timeseries.py` L45) | AI `get_cgm_scores` only; no graph generator |
| BP (Apple/OW style) | **Yes** | `blood_pressure_systolic` / `_diastolic` in METRIC_UNITS; also `ow_body_summaries.bp_*` columns | No graph/AI query found |
| BP (Garmin webhook) | **Yes** | `garmin_blood_pressure` + `context` systolic/diastolic (`health_data_processor.py` L675–707) | No graph |
| BP (legacy scrape) | **Yes** | `wearables_data.blood_pressure` | Extractors/tests only |
| SpO2 (normalized) | **Yes** | `oxygen_saturation` timeseries; sleep `avg_spo2_percent` | Blood Oxygen + Recovery graphs |
| SpO2 (Garmin webhook) | **Yes** | `garmin_spo2` | Not primary for Blood Oxygen graph (uses `oxygen_saturation`) |
| SpO2 (legacy) | **Yes** | `wearables_data.spo2_data` | Not in graph_data_processor |

**Implication for wearable specialist:** CGM/BP/SpO2 schema slots are already defined. CGM scoring code assumes mg/dL samples in `ow_timeseries`. Apple Health ingest should write the OW-normalized metric names (`blood_glucose`, `blood_pressure_*`, `oxygen_saturation`), not only Garmin-prefixed variants, or graphs/tools will miss data.

---

## 9. Confidence summary

| Claim | Confidence |
|-------|------------|
| Full column lists for `ow_workouts`, sleep sessions, timeseries, four summary tables, rollups, apps/orgs/mapping | **High** (DDL) |
| `user_id` on OW tables = Supabase Auth UUID | **High** (writer + comment) |
| Rows carry `org_id`; reads do not filter by it | **High** (DDL + every SELECT reviewed) |
| Metric inventory in `METRIC_UNITS` + webhook processor | **High** for listed strings; providers may emit additional types as `unknown`/passthrough |
| Legacy `wearables_data` full column lists | **Medium** (memory-bank SQL; extractors confirm table names; may drift from live) |
| Exact native sampling Hz per provider | **Low** — only know sync requests `raw` |
| Data retention for `ow_*` | **High that no TTL in migrations**; live ops may drop partitions manually (not in repo) |
| AI summary query works against prod | **Low** — column names contradict DDL |

---

## 10. File index (absolute paths)

```
/Users/danielsilva/Desktop/PeakPerformanceDataMonorepo/PeakPerformanceData/ppd_extraction_backend/migrations/
/Users/danielsilva/Desktop/PeakPerformanceDataMonorepo/PeakPerformanceData/ppd_extraction_backend/src/openwearables/
/Users/danielsilva/Desktop/PeakPerformanceDataMonorepo/PeakPerformanceData/ppd_backend/data_processing/base/graph_data_processor.py
/Users/danielsilva/Desktop/PeakPerformanceDataMonorepo/PeakPerformanceData/ppd_backend/utils/user_id_resolver.py
/Users/danielsilva/Desktop/PeakPerformanceDataMonorepo/PeakPerformanceData/ppd_backend/api/routes/graphs.py
/Users/danielsilva/Desktop/PeakPerformanceDataMonorepo/PeakPerformanceData/ppp_ai_agent/tools/wearables.py
/Users/danielsilva/Desktop/PeakPerformanceDataMonorepo/PeakPerformanceData/ppp_ai_agent/tools/cgm.py
/Users/danielsilva/Desktop/PeakPerformanceDataMonorepo/PeakPerformanceData/ppp_ai_agent/tools/db.py
/Users/danielsilva/Desktop/PeakPerformanceDataMonorepo/PeakPerformanceData/peak_performance_data/src/app/api/ai-agent/wearable-query/route.ts
```
