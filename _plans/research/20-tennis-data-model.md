# 20 — Tennis Match Data Model & Analytics

**Status:** Read-only research dossier  
**Date:** 2026-08-02  
**Scope:** Complete tennis match schema, derived metrics, evolution API, AI-agent exposure gaps, and prioritized Python specialist tools.  
**Method:** Migrations + live Postgres (`PeakPerformanceDataV2` / `bcfwtgqvusjhlrqsztod`) information_schema + row aggregates; product TS analytics code; Python `tools/tennis.py` + TS `specialistTools.ts` / `athleteTools.ts`.  
**Related:** `_plans/research/08-tools-athletes-training-tennis.md` (tool-layer gap analysis).

**Authority note:** `src/lib/supabase/database.types.ts` is **stale** for tennis (missing scorekeeper columns, `tennis_match_participants`, `tennis_match_pauses`, `sv_archive_key`, etc.). Live DB + migrations below are authoritative.

---

## 1. Table inventory

| Table | Created / extended | Role |
|-------|-------------------|------|
| `tennis_matches` | `20260405_create_tennis_match_tables.sql` L9–29; drift `20260411_*`; scorekeeper `20260426_tennis_scorekeeper_extensions.sql` L19–39 | Match header |
| `tennis_match_sets` | `20260405_*` L46–61 | Per-set scores |
| `tennis_match_games` | `20260405_*` L70–84 | Per-game server/winner |
| `tennis_match_points` | `20260405_*` L94–114; scorekeeper L127–142 | Point log |
| `tennis_match_shots` | `20260405_*` L126–155; scorekeeper L156–165 | Shot analytics (primary dense table) |
| `tennis_match_stats` | `20260405_*` L179–188 | SwingVision Stats sheet KV (per player × set) |
| `tennis_match_uploads` | `20260405_*` L198–212 | Import job tracker |
| `tennis_match_pauses` | `20260426_*` L75–82 | Live pause intervals |
| `tennis_match_participants` | `20260426_*` L97–108 | Named sides / doubles slots |
| `tennis_match_share_links` | `20260612_create_tennis_match_share_links.sql` L7–20 | Guest watch tokens |
| `tennis_specific_tests` | Pre-dates match tables (no create migration in repo; columns from live DB + `database.types.ts` L2866–2893) | Court fitness battery |
| `tennis_bench_features` | Live only (no migration in this repo) | Public Tennis Bench feature cards |

**Live row totals (2026-08-02):** 72 matches · 36,240 shots · 6,108 points · 935 games · 110 sets · 7,620 stats · 12 participants · 3 pauses · 14 uploads · 4 share links · 52 tennis tests · 3 bench features.

---

## 2. Full column definitions

Sources: migrations cited + live `information_schema.columns`. CHECK constraints from migrations where present.

### 2.1 `tennis_matches`

| Column | Type | Null | Default / notes |
|--------|------|------|-----------------|
| `id` | uuid PK | NO | `gen_random_uuid()` |
| `cloudflare_video_key` | text | YES | R2 key |
| `created_at` | timestamptz | YES | `now()` |
| `end_time` | text | YES | SV wall-clock string |
| `games_per_set` | int | YES | |
| `has_ad_scoring` | bool | YES | default true |
| `has_match_tiebreak` | bool | YES | default false |
| `location` | text | YES | |
| `match_date` | date | NO | |
| `opponent_name` | text | NO | |
| `sets_per_match` | int | YES | |
| `start_time` | text | YES | |
| `total_games` | int | YES | |
| `total_points` | int | YES | |
| `total_sets` | int | YES | |
| `updated_at` | timestamptz | YES | trigger |
| `user_id` | uuid | NO | → `auth.users`; athlete owner |
| `video_upload_status` | text | NO | `none\|uploading\|ready\|failed` |
| `swingvision_url` | text | YES | `20260411` |
| `video_embed_url` | text | YES | `20260411` |
| `video_file_size_bytes` | bigint | YES | `20260411` |
| `source` | text | NO | default `swingvision`; mig CHECK: `swingvision\|manual_scorekeeper\|vision\|imported_other` — **live also has `youtube` rows** (constraint drift) |
| `is_doubles` | bool | NO | default false |
| `match_format` | jsonb | YES | sets/games/ad/tiebreak config |
| `surface` | text | YES | `hard\|clay\|grass\|carpet\|other` |
| `indoor` | bool | YES | |
| `tournament_name` | text | YES | |
| `tournament_round` | text | YES | |
| `live_status` | text | NO | `in_progress\|paused\|completed\|abandoned` |
| `started_at` / `finished_at` | timestamptz | YES | |
| `duration_active_sec` / `duration_total_sec` | numeric | YES | |
| `host_player_ids` / `guest_player_ids` | uuid[] | YES | |
| `host_player_names` / `guest_player_names` | text[] | YES | |
| `scorekeeper_user_id` | uuid | YES | → `auth.users` |
| `sv_archive_key` | text | YES | live only (pipeline archive) |

Migration refs: `20260405_create_tennis_match_tables.sql` L9–28; `20260411_fix_tennis_matches_schema_drift.sql` L1–3; `20260426_tennis_scorekeeper_extensions.sql` L19–39.

### 2.2 `tennis_match_sets`

| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid PK | |
| `created_at` | timestamptz | |
| `duration_sec` | numeric | |
| `guest_score` / `host_score` | int | games won in set |
| `guest_tiebreak` / `host_tiebreak` | int | default 0 |
| `is_super_tiebreak` | bool | default false |
| `match_id` | uuid FK → matches CASCADE | |
| `set_number` | int | UNIQUE with match_id |
| `set_winner` | text | `host\|guest` |
| `start_time` | text | |
| `video_time_sec` | numeric | |

`20260405_*` L46–61.

### 2.3 `tennis_match_games`

| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid PK | |
| `created_at` | timestamptz | |
| `duration_sec` | numeric | |
| `game_number` | int | |
| `game_winner` | text | `host\|guest` |
| `guest_set_score` / `host_set_score` | int | scoreboard at game |
| `match_id` | uuid FK | |
| `server` | text | `host\|guest` |
| `set_number` | int | UNIQUE `(match_id, set_number, game_number)` |
| `start_time` | text | |
| `video_time_sec` | numeric | |

`20260405_*` L70–84.

### 2.4 `tennis_match_points`

| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid PK | |
| `break_point` | bool | default false |
| `created_at` | timestamptz | |
| `detail` | text | free-text ending (“Ace”, “Forehand Winner”, …) |
| `duration_sec` | numeric | |
| `favorited` | bool | |
| `game_number` | int | |
| `guest_game_score` / `host_game_score` | text | “0/15/30/40” etc. |
| `match_id` | uuid FK | |
| `match_server` | text | `host\|guest` |
| `point_number` | int | UNIQUE with set/game |
| `point_winner` | text | `host\|guest` |
| `serve_state` | text | `first\|second` |
| `set_number` | int | |
| `set_point` | bool | |
| `start_time` / `video_time_sec` | text / numeric | |
| **Scorekeeper adds:** | | `20260426_*` L127–142 |
| `match_point` / `deuce` / `tiebreak` / `super_tiebreak` | bool | |
| `server_side` | text | `deuce\|ad` |
| `serve_attempt` | int | 1 or 2 |
| `rally_length` | int | |
| `ended_by` | text | `ace\|service_winner\|double_fault\|winner\|forced_error\|unforced_error\|let_replayed\|other` |
| `scored_by_user_id` | uuid | |

### 2.5 `tennis_match_shots` (dense analytics table)

| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid PK | |
| `bounce_depth` | text | `deep\|short\|out` |
| `bounce_side` | text | `near\|far\|net` |
| `bounce_x` / `bounce_y` | numeric | metres; Y≈0 near baseline, ≈11.89 net, ≈23.77 far |
| `bounce_zone` | text | |
| `created_at` | timestamptz | |
| `direction` | text | “Cross Court”, “Down the Line”, “Out Wide”, … |
| `favorited` | bool | |
| `game_number` | int | |
| `hit_depth` / `hit_side` | text | |
| `hit_x` / `hit_y` / `hit_z` | numeric | contact 3D; `hit_z` height m |
| `hit_zone` | text | |
| `match_id` | uuid FK | |
| `player` | text | `host\|guest` (host = platform athlete) |
| `point_number` | int | |
| `result` | text | `In\|Out\|Net` |
| `set_number` | int | |
| `shot_number` | int | UNIQUE with match/set/game/point/player |
| `speed_kmh` | numeric | |
| `spin` | text | `Topspin\|Slice\|Flat\|Kick` |
| `start_time` / `video_time_sec` | text / numeric | |
| `stroke` | text | `Forehand\|Backhand\|Serve\|Volley\|Overhead\|Feed` |
| `type` | text | e.g. `first_serve`, `first_return`, `second_serve`, `second_return` |
| **Scorekeeper adds:** | | `20260426_*` L156–165 |
| `player_user_id` | uuid | doubles partner |
| `team_slot` | int | 0 or 1 |
| `placement_zone` | text | 3×3 grid / miss labels |
| `is_terminal` | bool | point-ending shot |
| `shot_attribution` | text | `ace\|winner\|forced_error\|unforced_error\|fault\|service_winner\|rally` |

`20260405_*` L126–174.

### 2.6 `tennis_match_stats`

| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid PK | |
| `created_at` | timestamptz | |
| `match_id` | uuid FK | |
| `player` | text | `host\|guest` |
| `set_number` | int | **0 = match totals**; >0 = per-set |
| `stat_name` | text | SwingVision label (see §4.1) |
| `stat_value` | numeric | |
| UNIQUE | `(match_id, player, set_number, stat_name)` | |

`20260405_*` L179–188.

### 2.7 `tennis_match_uploads`

| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid PK | |
| `cloudflare_video_key` | text | |
| `created_at` / `updated_at` | timestamptz | |
| `csv_parse_error` | text | |
| `csv_parsed_at` | timestamptz | |
| `filename` | text | |
| `match_id` | uuid FK SET NULL | |
| `status` | text | `pending\|processing\|complete\|failed` |
| `user_id` | uuid | |
| `video_upload_status` | text | same enum as matches |

`20260405_*` L198–212.

### 2.8 `tennis_match_pauses`

| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid PK | |
| `match_id` | uuid FK CASCADE | |
| `paused_at` | timestamptz NO | |
| `resumed_at` | timestamptz | NULL = open pause |
| `reason` | text | |
| `created_at` | timestamptz | |

`20260426_*` L75–82.

### 2.9 `tennis_match_participants`

| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid PK | |
| `match_id` | uuid FK | |
| `user_id` | uuid → profiles | nullable |
| `display_name` | text NO | |
| `side` | text | `host\|guest` |
| `team_slot` | int | 0 or 1; UNIQUE `(match_id, side, team_slot)` |
| `serve_order` | int | doubles rotation 0..3 |
| `is_self` | bool | athlete whose `user_id` owns match |
| `created_at` | timestamptz | |

`20260426_*` L97–108. Singles → 2 rows; doubles → 4.

### 2.10 `tennis_match_share_links`

| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid PK | |
| `created_at` | timestamptz | |
| `created_by` | uuid → profiles | |
| `expires_at` | timestamptz | default now()+7d |
| `invitee_email` / `invitee_name` | text | |
| `last_viewed_at` | timestamptz | |
| `match_id` | uuid FK CASCADE | |
| `organization_id` | uuid | |
| `revoked_at` | timestamptz | |
| `token` | text UNIQUE | `/watch/{token}` |
| `view_count` | int | default 0 |

`20260612_*` L7–20.

### 2.11 `tennis_specific_tests`

Live + `database.types.ts` L2866–2893:

| Column | Type | Typical unit (product) |
|--------|------|------------------------|
| `id` | uuid PK | |
| `athlete_id` | uuid → profiles | |
| `test_date` | date | |
| `two_point_four_km_time` | varchar | mm:ss style |
| `sit_and_reach` / flex fields | int | cm |
| `hip_flexor_flex`, `hamstring_flex`, `quadriceps_flex`, `internal_shoulder_flex` | int | |
| `first_step_30sec` | int | reps |
| `hexagon_time`, `eighteen_m_sprint`, `sideways_time` | numeric | seconds |
| `vertical_jump` | numeric | cm |
| `med_ball_forehand/backhand/overhead/reverse` | numeric | m |
| `sit_ups`, `push_ups` | int | count |
| `plank_time` | numeric | seconds |
| `notes` | text | |
| `created_by` | uuid | |
| `created_at` / `updated_at` | timestamptz | |

### 2.12 `tennis_bench_features` (live only)

`id`, `match_id`, `slug`, `headline`, `subheadline`, `summary_md`, `is_published`, `anonymize_players`, `host_alias`, `guest_alias`, `hero_stat_keys` (jsonb), `tags` (text[]), `featured_rank`, `published_at`, `created_by`, `created_at`, `updated_at`. Not required for specialist match analytics.

---

## 3. Row-count characteristics (agent context sizing)

Live aggregates over matches that have child rows:

| Grain | Avg | P50 | P90 | Max | Implication |
|-------|----:|----:|----:|----:|-------------|
| **Shots / match** | 636 | 699 | 887 | 909 | **Never send raw shots to an LLM** (~700×~20 fields ≈ 100–200 KB+ JSON) |
| **Points / match** | 107 | 115 | 136 | 169 | Full point log is borderline; prefer aggregates |
| **Games / match** | 17 | — | — | — | Small |
| **Stats rows / match** | ~181 | — | — | — | Many name×player×set rows; filter `set_number=0` + host |

By `source`:

| Source | Matches | Avg shots | Avg points |
|--------|--------:|----------:|-----------:|
| `swingvision` | 54 | **671** | **113** |
| `youtube` | 12 | 0 (no shot rows) | 0 |
| `manual_scorekeeper` | 6 | **3** (terminal shots only) | **4** (tiny/demo matches) |

**Rule for agents:** Always work on pre-aggregated metrics (`computeMatchMetrics` shape or Stats sheet). Optionally return binned zone counts (≤20 buckets), never coordinate clouds.

Detail loader itself notes fetching unused shot columns wastes ~50 KB/match (`match-detail.ts` L464–468).

---

## 4. Derived metrics — what the product computes and where

### 4.1 Authoritative SwingVision `stat_name` keys (`set_number = 0`)

Observed on host match totals (n=42 matches with stats):

`1st Serves`, `1st Serves In`, `1st Serves Won`, `2nd Serves`, `2nd Serves In`, `2nd Serves Won`, `1st Returns`, `1st Returns Won`, `2nd Returns`, `2nd Returns Won`, `Aces`, `Service Winners`, `Forehand Winners`, `Backhand Winners`, `Forehand Unforced Errors`, `Backhand Unforced Errors`, `Forehand Forced Errors`, `Backhand Forced Errors`, `Break Points`, `Break Points Won`, `Break Point Opportunities`, `Break Points Saved`, `Set Points Won`, `Set Point Opportunities`, `Set Points Saved`, `Total Points`, `Total Points Won`, `Distance Run (KM)`, `Calories Burned (kCAL)`, `Average Heart Rate (BPM)`.

### 4.2 `computeMatchMetrics` — longitudinal / progress authority

**File:** `PeakPerformanceData/peak_performance_data/src/lib/tennis/progress-metrics.ts`  
**Export:** `computeMatchMetrics` L281–498  
**Fallback:** `deriveStatsFromPlay` L530–663 when Stats sheet empty  
**Server attribution:** `buildServerLookups` L183–237, `attributeShots` L239–275  
**Shot primitives:** imports from `shot-metrics.ts` L11–17

| Metric field | How computed | Lines |
|--------------|--------------|-------|
| `result`, `score`, `games_won_pct` | Sets winners / host+guest games | L284–296 |
| `first_serve_pct`, `second_serve_pct` | Stats `1st/2nd Serves In ÷ Serves` else derive | L369–378, L407–410 |
| `aces`, `double_faults` | Stats Aces; DF = 2nd Serves − 2nd In | L379–380 |
| `service_points_won_pct` | `(1st Won + 2nd Won) / 1st Serves` (SV shortcut) | L381 |
| `return_points_won_pct` | returns won / returns | L390–397 |
| `break_points_converted_pct` | BP Won / BP Opportunities | L398 |
| `break_points_saved_pct` | BP Saved / Break Points | L399 |
| `winners` / `unforced_errors` | FH+BH+Service winners; FH+BH UE | L401–406 |
| `fh_winners`, `bh_winners`, `fh_errors`, `bh_errors` | Named stats | L401–406 |
| `winner_error_ratio` | winners / UE | L433–435 |
| `first_serve_speed`, `second_serve_speed`, `fh_speed`, `bh_speed` | avg `speed_kmh` on attributed host shots | L303–310, L165–169, L466–482 |
| `accuracy_pct` | host In / host shots | L312–313, L449 |
| `spin_*_pct` | Flat/Kick/Slice/Topspin mix | L315–323, L489–492 |
| `avg_rally_length` | mean shots per point key | L325–335 |
| `depth_deep_pct` | `computeDepthStats` | L438, L457 |
| `direction_aggression_pct`, `direction_cc_dl_ratio` | `computeDirectionStats` | L439, L458–459 |
| `last_shot_error_pct` | `computeLastShotStats` | L440, L470 |
| `fh_usage_pct` | `computeUsageStats` | L441, L463 |
| `return_fh_pct`, `return_in_pct` | `computeReturnSelection` | L442–447, L475–476 |
| Weighted attempt counts | for period averages | L383–397, L467–487 |

### 4.3 Shot metric primitives

**File:** `src/lib/tennis/shot-metrics.ts`

| Function | Lines | Output |
|----------|------:|--------|
| `computeDepthStats` | 99–128 | deep/mid/short counts + % (rally In, bounce_y) |
| `computeDirectionStats` | 144–172 | CC/DL/IO/II, aggression %, CC:DL |
| `computeLastShotStats` | 184–207 | last-shot error % |
| `computeReturnSelection` | 221–262 | FH return %, return In % |
| `computeUsageStats` | 275–291 | FH usage % |

Re-exported for UI via `tennisAnalyticsShared.ts` L593–613.

### 4.4 Per-match UI analytics

| Concern | Primary location | Notes |
|---------|------------------|-------|
| Match stats scoreboard | `TennisAnalyticsDetail.tsx` ~L779–969 | Stats sheet first; points/shots fallback; aces/breaks |
| Winners / UE / FE | `tennisAnalyticsShared.ts` `computeWinnersErrors` L469–542 | Used by Match Stats, Play Patterns, Insights |
| Serve % / DF / aces (shot-derived) | `computeServeStats` L162–314 | ShotStats + Insights tabs |
| Shot speeds, stroke In%, serve placement, spin bars, heatmaps | `TennisAnalyticsShotStatsTab.tsx` | Uses `computeServeStats`, `CourtHeatmap`, `ShotDistributionChart`, `ShotBreakdown` |
| Depth / direction / court plots / serve zones tee·body·wide | `TennisAnalyticsPlayPatternsTab.tsx` | `classifyServeZone` L63–69; `computeDirectionStats`, `computeWinnersErrors` |
| Narrative insights (rally buckets, BP, UE edge, W/UE ratio) | `TennisAnalyticsInsightsTab.tsx` ~L459–1036 | Client-side from shots+points+stats |
| Points history | `TennisAnalyticsPointsHistoryTab.tsx` | Point list UI |
| Live scorekeeper aggregates | `src/lib/tennis/scorekeeper/stats.ts` `computeStats` L98+ | Aces, BP, first-serve %, winners by stroke, rally avg/max |
| Detail load + repair | `src/lib/tennis/match-detail.ts` | Games/points/shots repair before UI |

### 4.5 Progress / longitudinal (client)

**API data:** `/api/tennis/matches/evolution` → `ProgressMatchMetrics[]`  
**Insights:** `src/lib/tennis/progress-insights.ts`

| Helper | Lines | Purpose |
|--------|------:|---------|
| `computePeriodAverages` | 121+ | early vs recent thirds |
| `computeBiggestMovers` | 165+ | metric deltas |
| `buildSkillProfile` | 227+ | radar axes |
| `computeRollingWinRate` | 326+ | form strip |
| `computeWinCorrelations` | 404+ | metric vs win |
| `computeProgressFindings` | 439+ | narrative findings |
| `computeFirstVsLatestComparison` | 595+ | first vs latest match |

UI filters (client, not API): source (`swingvision` vs `live`), surface, month range — `TennisProgressContent.tsx` L96–137.

---

## 5. Product API routes (`src/app/api/tennis/`)

| Route | Role |
|-------|------|
| `GET matches/route.ts` | Auth’d list + sets (`getTennisMatchListForUser`) |
| `GET matches/[id]/route.ts` | Full detail via `loadTennisMatchDetail` |
| `GET matches/evolution/route.ts` | Progress time series (§6) |
| `matches/[id]/video*`, `video-access` | Video |
| `matches/[id]/share-links*` | Share links |
| `import/route.ts` | SwingVision XLSX → tables |
| `video-upload*`, `video-cleanup` | R2 upload lifecycle |
| `scorekeeper/matches*` | Live create/get/points/pause/resume/finish |

---

## 6. Evolution / progress endpoint

**File:** `PeakPerformanceData/peak_performance_data/src/app/api/tennis/matches/evolution/route.ts`

| Aspect | Behavior | Lines |
|--------|----------|------:|
| Auth | Session required; coach any `playerId`; parent via `parent_child_relationships` | L9–38 |
| Aggregation window | **Last 50 matches** by `match_date` DESC (`MAX_EVOLUTION_MATCHES = 50`), then reversed oldest→newest | L41–59 |
| Grain | **One object per match** (not calendar weeks/months) | L103–110 |
| Loads | games, points, sets, shots, host `stats` `set_number=0` | L63–86 |
| Compute | `computeMatchMetrics(...)` per match | L103–110 |
| Response | `{ data: ProgressMatchMetrics[] }` | L112–114 |
| Cache | `private, max-age=60, stale-while-revalidate=300` | L113 |

**Response shape** (`ProgressMatchMetrics`, `progress-metrics.ts` L92–142):  
`match_id`, `match_date`, `opponent_name`, `result`, `score`, `source`, `surface`, serve/return/break %, aces/DF, winners/UE + FH/BH splits, speeds, spin %, depth/direction/usage/return/last-shot %, `avg_rally_length`, `accuracy_pct`, `games_won_pct`, `winner_error_ratio`, plus raw attempt/won counts for weighted period averages.

**Not calendar-bucketed.** Client may filter by months (`RANGE_MONTHS` in progress UI) after fetch.

---

## 7. AI agent exposure today

### 7.1 Python (`PeakPerformanceData/ppp_ai_agent/tools/tennis.py`)

| Tool | Lines | Exposed metrics | Gap vs product |
|------|------:|-----------------|----------------|
| `get_tennis_matches` | 16–50 | id, date, opponent, source, surface | No score/result/live_status |
| `get_match_summary` | 53–117 | result, score, sets won/lost, first_serve_pct, aces, DF, winners, UE, BP converted/opportunities (raw) | No shot speeds, spin, depth, direction, rally, return In, BP%, W/UE ratio; no points/shots fallback |
| `get_tennis_evolution` | 120–204 | thin serve/winner/error/BP/SPW/RPW series from **stats sheet only** | Missing most `ProgressMatchMetrics`; no shots/points; BP raw counts |

Registry: `tools/registry.py` L96–113.

### 7.2 TypeScript specialist proxies

`src/lib/ai/tools/specialistTools.ts` L106–143:

- `getTennisMatchesTool` → HTTP `GET {PPP_AI_AGENT_URL}/tennis-matches`
- `getTennisEvolutionTool` → `/tennis-evolution`

Wired in `toolRouter.ts` L260–261, L351–352 for coach/admin specialist intents.  
**No** TS tool for `get_match_summary` (Python-only registry).  
Descriptions claim “score and outcome” for matches list, but Python list does **not** return them.

### 7.3 TypeScript athlete/parent tools

`athleteTools.ts` L36–66 / `parentTools.ts` ~L220–260: read `tennis_specific_tests` only — **and map nonexistent columns** (`agility_505`, `serve_speed`, `sprint_20m`, `yoyo_test`) while real columns are med-ball / hexagon / 18 m sprint / etc. Match analytics **not** in these tools.

### 7.4 Coverage matrix (product metric → agent)

| Product metric family | Product compute | Python agent | TS agent |
|----------------------|-----------------|:------------:|:--------:|
| Match list + score/result | list API + sets | Partial (no score) | Proxy (same) |
| Serve % / aces / DF | stats + `computeMatchMetrics` | Partial (stats only) | Proxy evolution |
| Winners / UE | stats / derive | Partial | Proxy |
| BP conversion % | progress-metrics | Raw counts only | Proxy |
| Service/return points won % | progress-metrics | Evolution only | Proxy |
| Speeds (serve/FH/BH) | shots | **No** | **No** |
| Spin / depth / direction / placement | shot-metrics + tabs | **No** | **No** |
| Rally length | progress-metrics / insights | **No** | **No** |
| Play-pattern heatmaps | UI only | **No** | **No** |
| Progress insights (movers, skill radar) | progress-insights.ts | **No** | **No** |
| Tennis specific tests | DB + dashboards | **No** | Broken field map |
| Participants / pauses / video / share | scorekeeper / share APIs | **No** | **No** (ok) |

---

## 8. Prioritized Python tennis-specialist tools

Design constraints:

1. Pre-aggregate with the same formulas as `computeMatchMetrics` / `shot-metrics` / `computeWinnersErrors`.  
2. Cap series (≤20–50 matches).  
3. Never return raw `tennis_match_shots` rows or bounce coordinate lists.  
4. Label units in keys (`*_pct`, `*_kmh`) and include `break_points_converted_pct` so the LLM does no division.  
5. Verify `athlete_id` owns `match.user_id` (and org membership) despite service role.

### P0 — Close the product↔agent gap

#### P0.1 `get_tennis_matches_enriched`

```python
async def get_tennis_matches_enriched(
    organization_id: str,
    athlete_id: str,
    days_back: int = 90,
    limit: int = 20,
    source: Optional[str] = None,   # swingvision | live | all
    surface: Optional[str] = None,
) -> dict
```

**Return:**
```json
{
  "matches": [{
    "match_id": "…", "match_date": "2026-07-20", "opponent_name": "…",
    "source": "swingvision", "surface": "clay", "live_status": "completed",
    "result": "win", "score": "6-4, 6-2", "sets_won": 2, "sets_lost": 0,
    "total_points": 112
  }],
  "count": 1, "success": true
}
```

#### P0.2 `get_match_metrics` (replace/extend `get_match_summary`)

```python
async def get_match_metrics(
    organization_id: str,
    athlete_id: str,
    match_id: str,
) -> dict
```

**Return:** single `ProgressMatchMetrics`-shaped object (all fields in §6) under `"metrics"`, plus optional `"opponent_snapshot"` (guest winners/UE/aces from stats). Uses stats sheet when present else points+shots fallback. **No shot arrays.**

#### P0.3 `get_tennis_evolution_full`

```python
async def get_tennis_evolution_full(
    organization_id: str,
    athlete_id: str,
    limit: int = 20,          # hard max 50
    source: Optional[str] = None,
    surface: Optional[str] = None,
) -> dict
```

**Return:** `{ "evolution": ProgressMatchMetrics[], "count", "success" }` — parity with `GET /api/tennis/matches/evolution` (port `computeMatchMetrics`). Deprecate thin `get_tennis_evolution` or make it call this.

#### P0.4 `get_match_shot_stats`

```python
async def get_match_shot_stats(
    organization_id: str,
    athlete_id: str,
    match_id: str,
    side: str = "host",
) -> dict
```

**Return (pre-aggregated):**
```json
{
  "shot_stats": {
    "serve": {
      "first_serve_pct": 62, "second_serve_pct": 91,
      "aces": 4, "double_faults": 2,
      "first_serve_speed_kmh_avg": 178, "first_serve_speed_kmh_max": 201,
      "second_serve_speed_kmh_avg": 145,
      "placement": {"tee_pct": 34, "body_pct": 28, "wide_pct": 38}
    },
    "groundstrokes": {
      "fh": {"count": 120, "in_pct": 72, "avg_speed_kmh": 98, "winners": 12, "unforced_errors": 9},
      "bh": {"count": 95, "in_pct": 68, "avg_speed_kmh": 91, "winners": 7, "unforced_errors": 11}
    },
    "spin_pct": {"topspin": 55, "slice": 20, "flat": 20, "kick": 5},
    "stroke_mix_pct": {"forehand": 48, "backhand": 38, "serve": 10, "volley": 3, "overhead": 1},
    "accuracy_pct": 71
  },
  "success": true
}
```

Port `computeServeStats` + Shot Stats tab aggregations; zone counts only (not coords).

#### P0.5 `get_match_play_patterns`

```python
async def get_match_play_patterns(
    organization_id: str,
    athlete_id: str,
    match_id: str,
    side: str = "host",
) -> dict
```

**Return:**
```json
{
  "play_patterns": {
    "depth": {"deep_pct": 41, "mid_pct": 35, "short_pct": 24, "n": 180},
    "direction": {
      "aggression_pct": 22, "cc_dl_ratio": 2.1,
      "crosscourt_pct": 48, "down_the_line_pct": 23,
      "inside_out_pct": 18, "inside_in_pct": 4
    },
    "last_shot_error_pct": 38,
    "return": {"fh_return_pct": 61, "return_in_pct": 74},
    "fh_usage_pct": 56,
    "winners_errors": {
      "winners": 28, "unforced_errors": 19, "forced_errors": 8,
      "winner_error_ratio": 1.47
    },
    "bounce_zone_counts": {"1": 12, "2": 30, "3": 18},
    "avg_rally_length": 4.2, "longest_rally": 18
  },
  "success": true
}
```

Port `shot-metrics.ts` + Play Patterns / Insights rally buckets. `bounce_zone_counts` = discrete bins only.

### P1 — Longitudinal coaching answers

#### P1.1 `get_tennis_progress_insights`

```python
async def get_tennis_progress_insights(
    organization_id: str,
    athlete_id: str,
    limit: int = 30,
    source: Optional[str] = None,
    surface: Optional[str] = None,
) -> dict
```

**Return:** period averages, biggest movers, skill profile axes, rolling win rate, win correlations, findings — port `progress-insights.ts` over the same series as P0.3. LLM gets labelled deltas, not raw series arithmetic.

#### P1.2 `compare_tennis_matches`

```python
async def compare_tennis_matches(
    organization_id: str,
    athlete_id: str,
    match_id_a: str,
    match_id_b: str,
) -> dict
```

**Return:** `{ "a": metrics, "b": metrics, "deltas": { "first_serve_pct": +4, … } }` with signed deltas precomputed.

#### P1.3 `get_match_point_pressure`

```python
async def get_match_point_pressure(
    organization_id: str,
    athlete_id: str,
    match_id: str,
) -> dict
```

**Return aggregates only:** BP/SP/MP opportunities & conversion %, deuce points won %, favorited count, serve-state outcomes — **not** the full ~100-point log.

#### P1.4 Harden existing tools

- Enforce org + ownership on all tennis tools.  
- Round pcts to integers; always emit `*_pct` not raw BP fractions.  
- Fix FastAPI routes for `/tennis-matches` and `/tennis-evolution` if TS BFF still calls them (see dossier 08).

### P2 — Adjacent / optional

| Tool | Signature sketch | Return |
|------|------------------|--------|
| `get_tennis_specific_tests` | `(organization_id, athlete_id, limit=20)` | Unit-labelled fitness battery (real columns) |
| `get_per_set_stats` | `(…, match_id)` | Host+guest stats for `set_number > 0` + set scores |
| `get_match_opponent_comparison` | `(…, match_id)` | Side-by-side host vs guest headline metrics |
| `get_match_participants` | `(…, match_id)` | Doubles names/slots |
| Surface/source filters | on evolution/list | Already params on P0 tools |

**Explicitly out of scope for LLM tools:** raw shot dumps, video/R2 keys, share tokens, scorekeeper writes, upload pipeline ops.

---

## 9. Recommended implementation path

1. Port `computeMatchMetrics` + `shot-metrics` to Python (or call a shared SQL view / RPC that materializes the same JSON).  
2. Ship P0.2 + P0.3 first (unlocks almost all progress UI answers).  
3. Add P0.4 + P0.5 for single-match coaching depth.  
4. Wire TS `specialistTools` to new agent paths (or call Supabase directly with the same shapes).  
5. Fix `athleteTools` tennis-test field mapping independently.

---

## 10. Key file index

| Path | Role |
|------|------|
| `…/supabase/migrations/20260405_create_tennis_match_tables.sql` | Core schema |
| `…/supabase/migrations/20260411_fix_tennis_matches_schema_drift.sql` | Video URL columns |
| `…/supabase/migrations/20260426_tennis_scorekeeper_extensions.sql` | Live scoring columns + pauses/participants |
| `…/supabase/migrations/20260612_create_tennis_match_share_links.sql` | Share links |
| `…/src/lib/tennis/progress-metrics.ts` | `computeMatchMetrics` |
| `…/src/lib/tennis/shot-metrics.ts` | Depth/direction/usage/return/last-shot |
| `…/src/lib/tennis/progress-insights.ts` | Progress page insights |
| `…/src/lib/tennis/match-detail.ts` | Detail loader |
| `…/src/lib/tennis/scorekeeper/stats.ts` | Live scorekeeper aggregates |
| `…/src/app/api/tennis/matches/evolution/route.ts` | Evolution API |
| `…/src/components/tennis-analytics/*` | UI tabs |
| `…/src/lib/ai/tools/specialistTools.ts` | TS→Python tennis proxies |
| `PeakPerformanceData/ppp_ai_agent/tools/tennis.py` | Current thin agent tools |

---

*End of dossier 20.*
