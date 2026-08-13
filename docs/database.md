# Database Schema

The platform uses two database systems:

1. **Supabase (PostgreSQL)** — Auth, profiles, organizations, training, tennis, AI conversations, achievements, alerts, messaging
2. **ClickHouse** — Wearable timeseries data, workout records, sleep sessions, activity summaries, health metrics

---

## Supabase (PostgreSQL)

**URL**: `https://bcfwtgqvusjhlrqsztod.supabase.co`
**Migrations**: `PeakPerformanceData/peak_performance_data/supabase/migrations/` (56 SQL files)
**Type definitions**: `PeakPerformanceData/peak_performance_data/src/lib/supabase/database.types.ts` (4373 lines)

### Core Tables

#### profiles

User profiles. Central to the entire system.

| Column | Type | Notes |
|--------|------|-------|
| id | uuid (PK) | References `auth.users` |
| email | text | |
| first_name | text | |
| last_name | text | |
| role | text | `player`, `coach`, `parent`, `club_admin` |
| organization_id | uuid (FK) | → organizations.id |
| is_club_admin | bool | |
| created_at | timestamptz | |
| updated_at | timestamptz | |

**Relationships**: Referenced by nearly every other table via `athlete_id`, `coach_id`, `player_id`, `sender_id`, `user_id`, etc.

#### organizations

Multi-tenant organization (academy/club).

| Column | Type | Notes |
|--------|------|-------|
| id | uuid (PK) | |
| name | text | |
| slug | text | URL-friendly identifier |
| domain | text | Custom domain for brand resolution |
| type | text | |
| admin_user_id | uuid (FK) | → profiles.id |
| brand_colors | json | Custom brand colors |
| logo_url | text | |
| is_personal | bool | Personal vs. org account |
| created_at | timestamptz | |
| updated_at | timestamptz | |

### Training & Performance Tables

#### group_training_sessions

| Column | Type | Notes |
|--------|------|-------|
| id | uuid (PK) | |
| name | text | |
| organization_id | uuid (FK) | → organizations.id |
| coach_id | uuid (FK) | → profiles.id |
| session_date | date | |
| start_time | text | |
| end_time | text | |
| session_type | text | |
| level | text | |
| location | text | |
| max_participants | int | |
| status | text | |
| is_cancelled | bool | |
| created_by | uuid (FK) | → profiles.id |
| created_at | timestamptz | |
| updated_at | timestamptz | |

#### group_training_attendance

| Column | Type | Notes |
|--------|------|-------|
| id | uuid (PK) | |
| session_id | uuid (FK) | → group_training_sessions.id |
| player_id | uuid (FK) | → profiles.id |
| attendance_status | text | |
| performance_rating | int | |
| effort_rating | int | |
| behavior_rating | int | |
| minutes_played | int | |
| injuries_reported | text[] | |
| coach_notes | text | |
| player_feedback | text | |

#### hiit_trainings

| Column | Type | Notes |
|--------|------|-------|
| id | uuid (PK) | |
| athlete_id | uuid (FK) | → profiles.id |
| training_date | date | |
| workout_name | text | |
| workout_type | text | |
| duration_minutes | int | |
| intensity_level | text | |
| perceived_effort | int | |
| heart_rate_avg | int | |
| heart_rate_max | int | |
| calories_burned | int | |
| recovery_time_minutes | int | |
| created_by | uuid (FK) | → profiles.id |

#### injuries

| Column | Type | Notes |
|--------|------|-------|
| id | uuid (PK) | |
| athlete_id | uuid (FK) | → profiles.id |
| injury_date | date | |
| injury_type | text | |
| body_part | text | |
| severity | text | |
| diagnosis | text | |
| symptoms | text | |
| treatment | text | |
| recovery_status | text | |
| recovery_start_date | date | |
| recovery_end_date | date | |
| created_by | uuid (FK) | → profiles.id |

#### performance_tests

| Column | Type | Notes |
|--------|------|-------|
| id | uuid (PK) | |
| athlete_id | uuid (FK) | → profiles.id |
| test_date | date | |
| test_type | text | |
| thousand_m_time | text | |
| thousand_m_pace | text | |
| v2_velocity | float | |
| v4_velocity | float | |
| aerobic_threshold_hr | int | |
| aerobic_threshold_pace_power | text | |
| anaerobic_threshold_hr | int | |
| anaerobic_threshold_pace_power | text | |
| lactate_1000m | float | |

#### lactate_test_points

| Column | Type | Notes |
|--------|------|-------|
| id | uuid (PK) | |
| performance_test_id | uuid (FK) | → performance_tests.id |
| speed | float | |
| heart_rate | int | |
| lactate | float | |

### Competition & Tournament Tables

#### competitions

| Column | Type | Notes |
|--------|------|-------|
| id | uuid (PK) | |
| athlete_id | uuid (FK) | → profiles.id |
| competition_date | date | |
| ten_km_time | text | |
| ten_km_pace | text | |
| half_marathon_time | text | |
| half_marathon_pace | text | |
| marathon_time | text | |
| marathon_pace | text | |
| notes | text | |
| created_by | uuid (FK) | → profiles.id |

### Tennis Tables

Tennis match tracking with full scorekeeper support. Created via migrations including tennis match tables, tennis scorekeeper extensions.

**Key tables** (from database.types.ts and migrations):
- `tennis_matches` — Match metadata, players, score, status
- `tennis_sets` — Set-level scores
- `tennis_games` — Game-level scores
- `tennis_points` — Point-by-point scoring
- `tennis_shots` — Shot-level detail (shot type, result, location)
- `tennis_match_stats` — Aggregated match statistics

### AI Tables

#### ai_audit_logs

| Column | Type | Notes |
|--------|------|-------|
| id | uuid (PK) | |
| user_id | uuid | |
| organization_id | uuid (FK) | → organizations.id |
| action_type | text | |
| tool_name | text | |
| model_provider | text | |
| tokens_used | int | |
| prompt_tokens | int | |
| completion_tokens | int | |
| ttft_ms | int | Time to first token |
| duration_ms | int | |
| result_status | text | |
| error_message | text | |
| parameters | json | |
| created_at | timestamptz | |

#### ai_conversations

| Column | Type | Notes |
|--------|------|-------|
| id | uuid (PK) | |
| user_id | uuid | |
| organization_id | uuid (FK) | → organizations.id |
| session_id | text | Conversation session identifier |
| messages | json | Full message history |
| message_count | int | |
| total_tokens | int | |
| summary | text | |
| created_at | timestamptz | |
| updated_at | timestamptz | |

#### ai_memories

| Column | Type | Notes |
|--------|------|-------|
| id | uuid (PK) | |
| user_id | uuid | |
| organization_id | uuid (FK) | → organizations.id |
| memory_type | text | |
| content | text | |
| importance | int | |
| embedding | text | |
| source | text | |
| last_accessed_at | timestamptz | |
| created_at | timestamptz | |
| updated_at | timestamptz | |

### Achievement System

#### achievement_definitions

| Column | Type | Notes |
|--------|------|-------|
| id | uuid (PK) | |
| name | text | |
| description | text | |
| category | text | |
| icon | text | |
| color | text | |
| rarity | text | |
| points | int | |
| criteria_type | text | |
| criteria_metric | text | |
| criteria_target | int | |
| criteria_timeframe | text | |
| unlock_next | uuid (FK) | → achievement_definitions.id (chain) |
| secret | bool | |
| account_mode | text | |

#### player_achievements

| Column | Type | Notes |
|--------|------|-------|
| id | uuid (PK) | |
| player_id | uuid (FK) | → profiles.id |
| achievement_id | uuid (FK) | → achievement_definitions.id |
| achieved_at | timestamptz | |
| progress_at_achievement | int | |
| notified | bool | |

### Alert System

#### alert_definitions

| Column | Type | Notes |
|--------|------|-------|
| id | uuid (PK) | |
| name | text | |
| category | text | |
| priority | text | |
| trigger_metric | text | |
| trigger_operator | text | |
| trigger_threshold | int | |
| title_template | text | |
| body_template | text | |
| channels | text[] | |
| notify_coach | bool | |
| notify_athlete | bool | |
| notify_parent | bool | |
| cooldown_hours | int | |
| enabled | bool | |

### Communication Tables

#### conversations

| Column | Type | Notes |
|--------|------|-------|
| id | uuid (PK) | |
| organization_id | uuid (FK) | → organizations.id |
| created_by | uuid (FK) | → profiles.id |
| type | text | `direct`, `group` |
| title | text | |
| last_message_at | timestamptz | |
| last_message_preview | text | |

#### conversation_participants

| Column | Type | Notes |
|--------|------|-------|
| id | uuid (PK) | |
| conversation_id | uuid (FK) | → conversations.id |
| user_id | uuid (FK) | → profiles.id |
| role | text | |
| joined_at | timestamptz | |
| last_read_at | timestamptz | |
| muted | bool | |

#### messages

| Column | Type | Notes |
|--------|------|-------|
| id | uuid (PK) | |
| conversation_id | uuid (FK) | → conversations.id |
| sender_id | uuid (FK) | → profiles.id |
| content | text | |
| message_type | text | |
| is_deleted | bool | |
| created_at | timestamptz | |

#### message_attachments

| Column | Type | Notes |
|--------|------|-------|
| id | uuid (PK) | |
| message_id | uuid (FK) | → messages.id |
| file_type | text | |
| file_url | text | |
| file_name | text | |
| file_size | int | |
| storage_key | text | |

### Other Key Tables

| Table | Purpose |
|-------|---------|
| `coach_observations` | Coach observations on athletes (with linked sessions/tournaments) |
| `coach_player_assignments` | Coach-player mapping within organizations |
| `coach_requests` / `member_requests` | Role upgrade / membership requests |
| `consent_events` | GDPR consent tracking |
| `fetch_status` | Wearable data fetch progress |
| `garmin_connect_accounts` | Garmin account credentials (encrypted) |
| `garmin_sync_jobs` | Garmin sync job tracking |
| `job_status` | Generic background job status |
| `organization_invitations` | Org invite tokens |
| `parent_child_relationships` | Parent-child user mapping |
| `player_details` | Extended player profile (skill level, ratings, positions) |
| `player_goals` | Player goal tracking with badges |
| `admin_logs` | Admin action audit log |
| `auth_tokens` | Custom auth tokens (invitations, etc.) |

### Row Level Security (RLS)

56 migrations include RLS policy definitions. Key patterns:
- Organization-scoped tables enforce `organization_id = (select org_id from profiles where id = auth.uid())`
- Profile-scoped tables enforce `user_id = auth.uid()` or `athlete_id = auth.uid()`
- Coach/admin access via role checks on profiles
- Multiple migrations address RLS recursion fixes (6 parts)

---

## ClickHouse

**Host**: `host.docker.internal` (Docker) / `localhost` (local dev)
**Port**: 9000 (native) / 8123 (HTTP)
**Databases**: `wearables_data`, `openwearables_data`

### wearables_data database

**Migrations**: `PeakPerformanceData/ppd_extraction_backend/migrations/`

#### users

User management for Garmin extraction.

| Column | Type | Notes |
|--------|------|-------|
| user_id | String (PK) | |
| email | String | |
| garmin_email | String | |
| garmin_password_encrypted | String | Fernet encrypted |
| display_name | String | |
| is_active | UInt8 | |
| sync_enabled | UInt8 | |
| sync_frequency_minutes | UInt16 | Default 1440 (daily) |
| garmin_oauth_token | String | |
| garmin_oauth_token_expires | DateTime | |
| last_sync_at | DateTime | |
| full_name, birth_date, gender, weight, height | Various | Garmin profile data |

**Engine**: `ReplacingMergeTree(sync_timestamp)` ORDER BY `(user_id)`

#### user_extraction_status

| Column | Type | Notes |
|--------|------|-------|
| user_id | String | |
| table_name | String | |
| last_extraction_at | DateTime | |
| last_successful_extraction_at | DateTime | |
| last_extraction_status | Enum8 | success/failed/running/pending |
| last_error_message | String | |
| records_extracted | UInt32 | |
| extraction_duration_seconds | Float32 | |

**Engine**: `ReplacingMergeTree(sync_timestamp)` ORDER BY `(user_id, table_name)`

### openwearables_data database

#### ow_workouts

Multi-tenant workout data from all providers.

| Column | Type | Notes |
|--------|------|-------|
| app_id | String | Tenant key |
| org_id | String | Tenant key |
| user_id | String | Tenant key |
| id | UUID | Workout ID |
| provider | LowCardinality(String) | apple_health, garmin, polar, suunto, whoop |
| provider_workout_id | String | Original provider ID |
| workout_type | LowCardinality(String) | Unified type |
| start_time | DateTime64(3) | |
| end_time | DateTime64(3) | |
| duration_seconds | UInt32 | |
| distance_meters | Float32 | |
| avg_heart_rate_bpm | UInt16 | |
| max_heart_rate_bpm | UInt16 | |
| calories_kcal | Float32 | |
| avg_pace_sec_per_km | UInt16 | |
| avg_speed_mps | Float32 | |
| steps | UInt32 | |
| has_gps | Bool | |
| + 30+ more columns | | Running dynamics, cycling, swimming, training effect |

**Engine**: `ReplacingMergeTree(synced_at)` ORDER BY `(app_id, org_id, user_id, provider, id)` PARTITION BY `(toYYYYMM(start_time), app_id)`

#### ow_sleep_summaries

Sleep session data. Similar tenant key structure.

#### ow_timeseries

Health metric timeseries (HR, stress, body battery, etc.).

#### ow_activity_summaries

Daily activity summaries (steps, calories, distance, intensity minutes).

#### ow_summaries

Aggregated daily summaries.

#### ow_timeseries_daily_rollups

Materialized daily rollups of timeseries data.

#### ow_organizations

Organization metadata in ClickHouse.

#### ow_audit_log

Audit log for OpenWearables operations.

#### user_mapping

Maps PPD users to OpenWearables users.

| Column | Type | Notes |
|--------|------|-------|
| app_id | String | |
| org_id | String | |
| user_id | String | PPD user ID |
| ow_user_id | String | OpenWearables user ID |
| email | Nullable(String) | |

**Engine**: `ReplacingMergeTree(updated_at)` ORDER BY `(app_id, org_id, user_id)`

#### provider_connections

Tracks which providers each user has connected.

| Column | Type | Notes |
|--------|------|-------|
| app_id | String | |
| org_id | String | |
| user_id | String | |
| provider | LowCardinality(String) | |
| ow_user_id | String | |
| status | LowCardinality(String) | active/inactive/disconnected/revoked |
| connected_at | DateTime64(3) | |
| last_sync_at | Nullable(DateTime64(3)) | |
| last_error | Nullable(String) | |

**Engine**: `ReplacingMergeTree(updated_at)` ORDER BY `(app_id, org_id, user_id, provider)`

---

## Migration Files

### Supabase Migrations

**Location**: `PeakPerformanceData/peak_performance_data/supabase/migrations/`
**Count**: 56 files

Key migrations (chronological):
1. Account claims and invitation system
2. AI voice agent tables
3. Dashboard enhancement functions
4. Alert and achievement batch definitions
5. Athletes readiness batches
6. Performance indexes
7. RLS recursion fixes (6 parts)
8. Tennis match tables and scorekeeper extensions
9. User feedback tables
10. Minor account support
11. Court coordination
12. Genetics tracking
13. Insight store
14. Lab panels

### ClickHouse Migrations

**Location**: `PeakPerformanceData/ppd_extraction_backend/migrations/`
**Count**: 11 files

| File | Description |
|------|-------------|
| `000_create_database.sql` | Creates `openwearables_data` database |
| `001_create_ow_workouts.sql` | Workouts table with 40+ columns |
| `002_create_ow_sleep_sessions.sql` | Sleep session data |
| `003_create_ow_timeseries.sql` | Health metric timeseries |
| `004_create_ow_summaries.sql` | Activity summaries |
| `005_create_ow_materialized_views.sql` | Materialized views for aggregation |
| `006_create_ow_audit_log.sql` | Audit logging |
| `007_create_ow_organizations.sql` | Organization metadata |
| `008_create_user_connections.sql` | User mapping + provider connections |
| `009_create_users.sql` | Users + extraction status tables |
| `010_create_ow_timeseries_daily_rollups.sql` | Daily rollup table |

---

## Entity Relationship Summary

```
organizations (1) ──< profiles (N)
profiles (1) ──< group_training_sessions (N) [as coach]
profiles (1) ──< group_training_attendance (N) [as player]
profiles (1) ──< coach_observations (N) [as coach, about athlete]
profiles (1) ──< coach_player_assignments (N) [as coach or player]
profiles (1) ──< hiit_trainings (N) [as athlete]
profiles (1) ──< injuries (N) [as athlete]
profiles (1) ──< performance_tests (N) [as athlete]
performance_tests (1) ──< lactate_test_points (N)
profiles (1) ──< competitions (N) [as athlete]
profiles (1) ──< player_achievements (N)
achievement_definitions (1) ──< player_achievements (N)
achievement_definitions (1) ──< achievement_definitions (1) [unlock_next chain]
organizations (1) ──< conversations (N)
conversations (1) ──< conversation_participants (N)
conversations (1) ──< messages (N)
messages (1) ──< message_attachments (N)
organizations (1) ──< organization_invitations (N)
profiles (1) ──< parent_child_relationships (N) [as parent or child]
profiles (1) ──< player_details (1)
profiles (1) ──< player_goals (N)
profiles (1) ──< ai_audit_logs (N)
profiles (1) ──< ai_conversations (N)
profiles (1) ──< ai_memories (N)
profiles (1) ──< garmin_connect_accounts (1)
garmin_connect_accounts (1) ──< garmin_sync_jobs (N)
```
