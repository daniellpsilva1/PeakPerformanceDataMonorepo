---
agent: devin-local
session: tourmaline-computer
created: 2026-09-13T18:17:17Z
---
# Open Wearables integration megaplan for PeakPerformanceData

A source-verified implementation blueprint for every missing and partial wearable integration, with exact contracts, maximum-history backfill, native SDK corrections, source-preserving storage, all-role consent, manual provider setup, tests, and release gates.

## 1. Executive summary

Research date: **2026-09-13**. Owner and approval authority: **daniel**. Risk: **High**: health information, minors, OAuth, identity/tenant access, cross-service data movement, schema changes, mobile permissions, retention and deletion.

This document is a **plan, not an executed implementation or production-readiness claim**. Research inspected local working-tree source, repository rules/catalog, Git metadata, public provider documentation and pinned upstream code. No application code/configuration changed; no dependencies installed; no application tests, builds, migrations or deployments run; no production databases accessed; no provider credentials inspected or integrations connected.

### What is actually available and missing

The complete inventory is **14 user-facing integration paths backed by 13 connectable upstream provider identities**, plus Apple XML as another ingestion method. Google Health API and Android Health Connect are different paths but share the upstream `google` provider identity. Sensor Bio exists in the release source although omitted from the main supported-provider setup list. `internal` and `unknown` are not integrations. COROS and Xiaomi are roadmap/indirect bridge possibilities, not released direct adapters.

PPD has:

- **Enabled connection UI and backend code:** Garmin, Polar, Whoop. Production operation was not independently verified.
- **Partial:** Suunto has routes and scheduler support, but its card is “coming soon” and the active status hook excludes it.
- **Placeholder:** Apple Health has a UI placeholder and Python provider type, but no mobile/token/upload onboarding.
- **Missing:** Oura, Ultrahuman, Google Health API, Health Connect, Withings, Sensor Bio, Samsung Health direct and Strava. Fitbit legacy is also missing but should deliberately remain disabled.

Adding provider names alone is insufficient. Shared blockers include trusted identity headers, false-positive OAuth completion, proxy-route collisions, non-durable sync tasks, a 2,000-sample cap, cross-provider replacement in ClickHouse, skipped workout updates, missing score ingestion, hardcoded graph visibility, and incomplete cross-store deletion/export. Additional upstream gaps were found in Google/Oura deletion processing and native mobile history/update/deletion behavior.

### User-confirmed decisions

1. Include **all missing providers and partial existing integrations**.
2. Include native mobile, commercial and partner-approved integrations.
3. Define success as production-ready end to end, including lifecycle, UI and operations.
4. Preserve the self-hosted OW → EXT → ClickHouse → GRAPH → APP architecture.
5. Treat existing Garmin/Polar/Suunto/Whoop access as owner-reported; verify tier/scopes manually without sharing secrets.
6. Use a **small PPD-owned React Native/Expo health companion**, not a native rewrite of the Next.js product. Flutter is a fallback only if the RN/native packaging spike fails.
7. Use **Google Health for Fitbit users**; do not launch a new legacy Fitbit connection.
8. Keep **Strava disabled pending written provider permission** for PPD's intended architecture/use.
9. Ship relevant fitness, sleep, recovery and body features with minimal permissions. Inventory all additional clinical, reproductive, nutrition and location categories, but implement them only through separate consent/product gates.
10. Support **all current user roles**, including minors and approved parent/coach views, before the first production rollout. An adult-only launch is not a substitute. Provider-specific age restrictions still apply.
11. Import **maximum legitimately available history**, using resumable ranges, not a fixed 90-day/five-year approximation.
12. Retention durations remain an **owner/legal approval gate**; do not invent or silently change them.

### Non-goals and approval boundaries

- No replacement of ClickHouse, Supabase identity or the existing web product.
- No unrelated tennis, video, billing, marketing or visualization-library rewrite.
- No credential scraping, new unofficial Garmin integrations or provider quota/approval bypasses.
- No false claims that HealthKit/Health Connect bridge apps are direct supported providers.
- No automatic clinical interpretation or equivalence between proprietary vendor scores.
- Separate authorization remains required for production access, provider portal mutations, purchases, app-store submission, deployments, migrations, commits/pushes and any destructive action.
- This research request does not itself authorize application implementation. The plan is delivered for review; implementation starts only after owner approval and the applicable narrower gates.

## 2. Reading guide and implementation sequence

- **Sections 3–5:** evidence, complete inventory, observed defects and what must not be assumed.
- **Sections 6–9:** target architecture, exact API/control-plane/data contracts and maximum-history algorithms.
- **Section 10:** ordered engineering work packages with dependencies and exit checks.
- **Section 11:** provider-by-provider owner/manual and engineering runbooks.
- **Sections 12–14:** native companion details, upstream patches, sensitive-category extensions.
- **Sections 15–18:** exact files, fixtures, commands, rollout/recovery and owner approval worksheet.
- **Section 19:** source links and research limitations.

Recommended dependency order:

`approvals + access applications → staging/version baseline → identity/consent/control plane → routing/registry/OAuth → source storage + durable mirror/history → provider packages + native corrections → all consumers/lifecycle → all-role verification → provider-by-provider release`

Access applications and native packaging can proceed in parallel with foundational engineering after approval. Provider activation cannot precede its safety/consent/lifecycle tests. Strava, Sensor Bio and Samsung-direct remain explicitly blocked if their external prerequisites are unresolved; do not count them as done or silently drop them.

## 3. Evidence baseline, repository occurrences and authority

### 3.1 Repository aliases

All subsequent file paths are relative to these independent repositories unless explicitly marked portfolio or proposed. This is not a shared build.

| Alias | Identity / occurrence | Checkout | Inspected revision |
|---|---|---|---|
| APP | `app` / `app-direct` | `PeakPerformanceData/peak_performance_data` | `86faf8651a0be6f013af1bd49f8b0304f4b5273b` + working tree |
| EXT | `extraction` / `extraction-direct` | `PeakPerformanceData/ppd_extraction_backend` | `0433060b29a23bd2f29c761c10bcf9af4a58d812` + working tree |
| GRAPH | `backend` / `backend-direct` | `PeakPerformanceData/ppd_backend` | `78fce68afcecccec201cf1116b98c0fe246340ca` + working tree |
| OW | external upstream; not locally cataloged | `the-momentum/open-wearables` | release `0.8.0`, commit `53de57cade876df104720c0c5be07bbf462a55b1` |
| RN | external upstream | `the-momentum/open-wearables-react-native-sdk` | `339bd95f708fa3ef3682a98e70c106a0f82ec184`, package 0.2.0 |
| IOS | external upstream | `the-momentum/open_wearables_ios_sdk` | tag `0.14.0` |
| ANDROID | external upstream | `the-momentum/open_wearables_android_sdk` | tag `v0.11.2` |
| MOBILE | proposed independent PPD repository | proposed `PeakPerformanceData/ppd_health_companion` | not created; name/remote/catalog registration require owner approval |

The three main working trees are dirty. EXT `sync_service.py` has local additions; GRAPH has local graph/cache/query changes and untracked summary/tests; APP has extensive local changes including charts, readiness, BodyViz, localization, dependencies and cache behavior. **Re-read current diffs before editing. Never reset or overwrite this work.**

### 3.2 Controlling documentation

Follow root/local `AGENTS.md`, portfolio `docs/repositories.json` and:

| ID | Location | Role |
|---|---|---|
| `PPD-PORTFOLIO-GOV-STANDARD` | portfolio `docs/governance/documentation-standard.md` | authority/evidence rules |
| `PPD-PORTFOLIO-GOV-SDLC` | portfolio `docs/governance/sdlc.md` | high-risk readiness/release requirements |
| `PPD-PORTFOLIO-GOV-EVIDENCE` | portfolio `docs/governance/evidence-and-traceability.md` | declared vs executed vs enforced evidence |
| `PPD-PORTFOLIO-PRIVACY-BASELINE` | portfolio `docs/privacy/baseline.md` | unresolved privacy/retention assumptions |
| `PPD-PORTFOLIO-SECURITY-DFD` | portfolio `docs/security/threat-model.md` | health data trust boundaries |
| `PPD-APP-ARCH-WEARABLES` | APP `docs/architecture/wearables.md` | current app integration |
| `PPD-EXTRACTION-ARCH-OVERVIEW` | EXT `docs/architecture.md` | current extraction topology |
| `PPD-EXTRACTION-REF-API` | EXT `docs/api.md` | current route inventory |
| `PPD-EXTRACTION-REF-DATA-MODEL` | EXT `docs/data-model.md` | declared storage model |
| `PPD-BACKEND-REF-API` | GRAPH `engineering/api.md` | graph/wearable API |

These inspected managed documents are **draft**, not accepted PRDs/ADRs. The retrospective wearable lifecycle example is historical context and has stale test claims. No accepted expansion PRD/ADR/test plan was identified. This plan's `OWI-AC-*` and `OWI-WP-*` IDs are **proposed**, not existing approved requirements.

Root rules refer to `docs/audits/remediation-backlog.md`, but that file was absent during inspection. Record findings here now; create/update the actual backlog only in a later approved documentation change. Do not fabricate prior entries or modify unrelated docs during planning.

### 3.3 Version and dependency policy

OW 0.8.0 was released **September 11, 2026**, two days before research. It adds Withings, stored sync history and security/migration changes. It is a research baseline, not permission to deploy immediately. Prefer exact reviewed releases/digests aged at least seven days at implementation time; assess urgent security fixes explicitly rather than blindly waiting or using `latest`/`nightly`.

The actual installed OW revision/database head/local patches were **not verified**. The existing production override does not pin them. Capture them with separately approved production-read access before any upgrade.

RN source commit was published August 29. Its actual native dependency declarations are iOS `OpenWearablesHealthSDK:0.14.0` and Android `com.openwearables.health:sdk:0.11.2`. Documentation still mentions unpublished/local package installation and older JitPack coordinates. Do not mix those examples with current source.

## 4. Complete integration and coverage inventory

Source presence means the release has an adapter, not that every metric or production workflow is correct.

| Integration path | OW key | Delivery | Core upstream data | PPD state / outcome |
|---|---|---|---|---|
| Garmin | `garmin` | push + dedicated webhook backfill | workouts, sleep, health metrics, scores | active dedicated UI/routes; preserve and harden; legacy/direct ingestion coexist |
| Polar | `polar` | OAuth REST + notify/pull | workouts, sleep, daily activity/HR, RMSSD/Elixir metrics, scores | active generic UI/routes; complete data/consent/history/lifecycle |
| Whoop | `whoop` | OAuth REST + notify/pull | workouts, aggregate sleep stages, recovery snapshots, cycle energy, scores | active generic UI/routes; fix timeseries/score/update semantics |
| Suunto | `suunto` | OAuth REST + inline webhook | workouts, sleep totals, HR/RMSSD/SpO2/steps/energy, recovery | backend partial; card hidden “coming soon”; activate after verification |
| Oura | `oura` | OAuth REST + notify/pull | sleep timeline, HR/RMSSD, readiness/activity/sleep, SpO2, temperature deviations, MET, workouts | missing PPD flow; add with renewal/deletion fixes |
| Ultrahuman | `ultrahuman` | OAuth REST | sleep timeline, HR, SDNN, skin temperature, steps, active time, VO2 | missing; no workouts or persisted vendor score claim |
| Google Health API | `google` | OAuth REST + notify/pull | reconciled Fitbit/Pixel/other-source activity, sleep, health measurements | missing; Google restricted-scope review and deletion handling |
| Fitbit legacy | `fitbit` | OAuth REST | workouts/activity only in OW | deliberately remain disabled; Google replacement |
| Withings | `withings` | OAuth REST + per-user notifications | body/BP measurements, activity, sleep totals, workouts | missing; body-history and per-user subscription lifecycle |
| Sensor Bio | `sensorbio` | OAuth REST; HTTP/2 data calls | biometrics, steps/energy/distance, sleep totals, workouts, sleep/activity/recovery scores | missing; portal/access and callback/protocol blockers |
| Strava | `strava` | OAuth REST + notify/pull | workouts/optional streams, no sleep or continuous health | proxy stub only; written permission gate, disabled by default |
| Apple HealthKit | `apple` | native upload | workouts, sleep, activity, HR/SDNN, body/other types | placeholder only; companion/token/ingestion path required |
| Android Health Connect | `google` | native upload | phone health-store workouts/sleep/activity/health records | missing; history permission and native change/pagination corrections |
| Samsung Health direct | `samsung` | native upload | supported Samsung phone/watch measurements | missing; signed partner-approved companion, no end-user developer mode |

Apple XML is an additional `apple` import method for historical migration, not a new provider or replacement for live sync.

COROS/Xiaomi have no direct strategy in the inspected factory. Devices/apps writing into Apple Health or Health Connect may contribute a subset. Preserve source app/device provenance and test the actual bridge; do not promise the full list in an upstream AI-researched compatibility table.

### 4.1 Important metric distinctions

- Whoop has recovery-derived timeseries, **not continuous heart-rate samples**. Older OW overview tables saying “no timeseries” are stale.
- Oura and Whoop HRV are RMSSD; Apple HealthKit is SDNN; Ultrahuman's OW adapter maps SDNN. Android's legacy selector named `heartRateVariabilitySDNN` actually reads `HeartRateVariabilityRmssdRecord` and emits metadata `method=rmssd`; UI must use payload semantics, not selector spelling.
- Whoop, Suunto and Withings sleep coverage is aggregate totals in the inspected adapters, not a guaranteed stage-by-stage hypnogram.
- Oura readiness is not Whoop recovery; Polar recovery/readiness are different scales. `ow_health_scores` is required, not a fabricated universal recovery score.
- Skin temperature, core/body temperature, basal temperature and deviation from baseline must remain distinct.
- Withings BMR/ECG/AFib/segmental/nerve metrics include explicitly deferred source mappings. Do not force them into vaguely similar fields.
- Google `reconcile` returns deduplicated totals without a single device. Missing device is meaningful, not an error to “fix.”

### 4.2 Vendor score scales from OW 0.8.0

| Provider/category | Declared raw range | UI/processing rule |
|---|---|---|
| Oura sleep/readiness/activity | 1–100 | preserve category; no Whoop threshold reuse |
| Whoop sleep/recovery | 0–100 | distinguish sleep performance/recovery |
| Whoop strain | 0–21 | never cast into a generic percent column |
| Polar sleep | 1–100 | vendor-specific interpretation |
| Polar readiness | 0–10 | no 0–100 normalization without separate approved metric |
| Polar recovery | 1–6 | ordinal/vendor semantics, not a percentage |
| Polar strain | nonnegative/unbounded declaration | no assumed maximum |
| Suunto recovery | 0–100 | separate provider/algorithm |
| Garmin sleep | 1–100 | preserve source |
| Garmin stress/body battery | 0–100 | separate metrics/categories |
| Sensor Bio scores | not declared in inspected global score-range map | confirm vendor semantics before thresholds |
| OW `internal` | algorithm-specific | distinct from every vendor and PPD-derived readiness |

## 5. Observed defects and required responses

| Gap | Exact source anchors | Required response |
|---|---|---|
| G01 fragmented registries | EXT `client.py:9`, `provider_data.py:22-23`, scheduler `:20-21`; APP `types.ts`, client `:303`, five routes and status hook | shared versioned contract plus runtime availability gates |
| G02 Suunto/Apple placeholders | APP integration `types.ts:36-43,63-70`; panel/status hooks | Suunto needs full status/UI activation; Apple needs native flow |
| G03 header-only identity | EXT `_get_user_id`, `api/main.py`; APP authorize omits optional bearer | verified actor/subject authorization before new routes |
| G04 false OAuth success | APP callback `:45-68,97-121`; EXT callback forwarding | OW exchanges once; PPD bound finish attempt verifies actual connection |
| G05 lookup/204 handling | EXT `get_user_by_external_id`, `get_or_create_user`, `_request` | normalize collection response, differentiate error/not-found, accept 204 |
| G06 routing collision | EXT Traefik routes `:7-14,90-97` | narrow PPD paths; current OW provider webhooks must reach OW |
| G07 repeated scheduling/pulls | API scheduler thread + Compose scheduler; trigger and sync_user pull; APP callback/panel/charts trigger | one scheduler, one idempotent job, one vendor-ingestion owner |
| G08 process-local work | EXT BackgroundTasks, retry loop, scheduler | durable queue/leases/checkpoints |
| G09 history truncation | `sync_user:135-137`; max 20×100 timeseries pages; scheduler 90-day chunks | bounded full-range page draining with checkpoint/yield |
| G10 incorrect success evidence | `_count_ow_rows` counts old rows across providers; exceptions swallowed then timestamps updated | per-stream attempted/covered/committed outcomes |
| G11 provider/source overwrite | migration 003 key omits provider/source; rollup key/grouping also omits source | source-preserving v2 migration and replay |
| G12 ignored corrections | `_sync_workouts:487-514` skips known IDs | content/version-aware updates and tombstones |
| G13 lost semantics | transformers discard timezone/daily-total/RMSSD/source fields, default invalid time to now, use `or` for zeros | typed versioned adapters and invalid-record handling |
| G14 missing score ingestion | GRAPH reads `ow_health_scores`; EXT source/migrations 000–010 have no writer/schema | inspect live schema separately; add reconciled score migration/writer |
| G15 body snapshots not history | `_sync_body_summary` dates latest values today | history from dated timeseries; snapshot marked as snapshot |
| G16 detection misses providers | GRAPH user-providers LIMIT 3 before DISTINCT, no body/score-only coverage | unbiased scoped availability query distinct from connection state |
| G17 three-brand UI | ChartsContent `:852-868`, Whoop-only recovery; BodyViz provider mapping | capability/presence-driven rendering and prefetch |
| G18 authenticated ≠ authorized | GRAPH middleware then arbitrary subject path/readers; provider discarded | health subject-access dependency, source/policy cache dimensions |
| G19 legacy downstream data | APP AI wearable-query still reads Garmin Supabase table; other tools use GRAPH | canonical shared authorized data API, not new data in Garmin tables |
| G20 incomplete lifecycle | APP account/export + Supabase cleanup | coordinate OW/ClickHouse/files/jobs/caches/derived outputs |
| G21 mapping only declared | migration 008 `user_mapping`/`provider_connections`, no EXT source references | authoritative durable reverse mapping before webhooks |
| G22 stale tests | EXT expects Whoop timeseries skipped; GRAPH tests copy flag helper functions | establish actual baseline; behavior tests import real helpers |
| G23 Google deletes ignored | OW `google/health_api/webhook_handler.py:_process_one` | source-side deletion/reconciliation patch; mirroring stale OW cannot fix it |
| G24 Oura deletes ignored | OW `oura/webhook_handler.py:process_payload` | targeted event/derived-record removal + downstream tombstones |
| G25 iOS deleted IDs dropped | IOS `OpenWearablesHealthSDK.swift:fetchOneChunkIncremental` counts deletions but returns samples only | tombstone protocol across SDK→OW→EXT |
| G26 Android history/change holes | ANDROID `HealthConnectManager.kt:readRecordType`; no history permission; timestamp cursor, no response page token in returned contract | page-token drain, Changes API/update/delete support and history permission |
| G27 upload 202 not processing success | OW `sdk_sync.py` queues raw dict; worker validates later; native advances on 2xx | durable intake/batch replay and processing receipts; report dropped data as partial |
| G28 SDK packaging/API drift | RN README/module, Android Maven Local dependency | pin/build source, no `syncNow`, correct history reset and lifecycle handling |
| G29 native cancellation/isolation risk | Android SyncManager stop cancels periodic work only; state key based on user only | cancel/fence expedited/in-flight work and key state by host/user/provider/generation |
| G30 consent/guardian mismatch | APP signup grants broad health/analytics; parent helper accepts missing status; consent export uses user_id | scoped effective consent, strict health guardian verification, correct subject/actor schema |
| G31 source exposure not unique identity | OW timeseries response has no sample/data_source ID despite keyed cursor | additive stable identifiers or explicitly limited source key; never claim lossless provenance without IDs |
| G32 upstream history/status inconsistencies | OW standard history caps365, generic worker skips non-rest Garmin, live-mode filter | bounded explicit history endpoint/dispatch and honest run states |

These are source observations or explicitly identified risks, not proof of real-world incidents. The absent writer/schema in source does not establish that a table is absent in production.

## 6. Target architecture and ownership decisions

### 6.1 Data plane and control plane

Keep:

`Provider cloud / phone → OW ingestion + PostgreSQL → EXT mirror → ClickHouse → GRAPH → APP`

Add a **durable PPD control plane in existing Supabase PostgreSQL**: mappings, desired connections, consent/grants, connect attempts, leased jobs, history coverage, event receipts and lifecycle requests. This is a proposed ADR/schema change. Do not use ClickHouse for transaction locks/unique queue claims; do not write directly into OW's private database from PPD.

EXT already has httpx/Supabase REST access. Use narrowly privileged transactional RPCs for enqueue/claim/heartbeat/complete. Avoid adding another PPD Redis/Celery stack unless measurements invalidate this choice. OW keeps its own Celery/Redis and owns vendor credentials/refresh/retrieval. Raw health payloads belong in approved OW/storage/ClickHouse locations, not large control queue rows.

### 6.2 Source of truth by concern

| Concern | Authority |
|---|---|
| actor/session identity | verified Supabase Auth |
| subject/org/role/relationships | authoritative PPD identity/relationship records + health policy |
| permitted categories/purposes | effective versioned PPD consent + provider terms |
| actual OAuth grant/token validity | OW connection/provider |
| desired connected/paused/deleting state | PPD control plane; enforced at ingestion and read |
| original ingestion records | OW/provider, subject to upstream completeness |
| PPD analytics facts | versioned source-preserving ClickHouse mirror |
| canonical metric selection | reviewed policy/version with explicit provenance |
| lifetime history completeness | per-stream coverage ledger, not last_sync timestamp |
| account erasure completion | durable lifecycle receipts across all stores |

### 6.3 Provider registry

Create EXT `src/openwearables/provider_registry.json` with Python accessor and a build-time generated/copied APP artifact. Contract version/digest tests detect drift. No cross-submodule runtime import or assumed shared workspace.

Each integration-method record includes alphabetically ordered fields:

- `approval_status`, `attribution`, `availability_reason`, `connection_method`, `data_categories`, `display_key`, `history_policy`, `id`, `implementation_status`, `policy_version`, `score_categories`, `supported_metrics`, `upstream_provider`.
- Delivery capabilities: REST pull, SDK, file import, webhook inline/notify/backfill, app-vs-user subscription management.
- Per-type endpoint range/consent/history limits, minimum platform/device, required scopes and age/purpose restrictions.
- Vendor-specific score scales and metric semantic mapping version.

Effective availability is the intersection of implemented PPD contract, deployed OW capabilities, configured credentials, approved provider use, eligible user, effective consent and feature flag. Neither an upstream enum nor a configured key makes an integration production-ready.

Keep existing APP `apple_health` as a compatibility alias to upstream `apple`. Distinguish PPD methods `google_health_api` and `health_connect`, both OW `google`. `samsung_health` maps to `samsung`. Reject unrecognized provider/method strings before building paths. `internal`/`unknown` never become connection cards.

### 6.4 Google hybrid connection

OW 0.8.0 uses one `google` connection per user. Initial safe product rule: **one primary Google ingestion method per subject**. Both methods are available as choices; they are not independent upstream connections.

Switch protocol:

1. Authenticate subject/actor, show cloud-vs-device differences and affected data.
2. Pause old method server-side; increment ingestion generation; wait for/fence in-flight jobs.
3. Stop old device collection if relevant; do not clear cloud OAuth tokens via SDK sign-out.
4. Establish new method/grant; verify a sample and provenance.
5. Replay requested history idempotently and maintain existing historical source labels.
6. Resume only chosen method. Do not purge all Google data simply to switch.

Concurrent dual-method support requires a later upstream connection/source-scoped lifecycle design. If it cannot be represented safely, fail closed rather than pretending the two cards disconnect separately.

### 6.5 Organization switching and data ownership

APP `api/auth/switch-organization` mutates `profiles.organization_id`; EXT currently caches an org slug indefinitely. This cannot define durable health ownership.

Proposed invariant: one stable OW profile per `(app_id, subject_id)`; wearable measurements belong to the subject. Store **ingest organization as provenance**, not a mutable identity component. Organization/coach access comes from an explicit current health-sharing grant with historical-range scope. Switching clubs must not create another OW user, relabel old facts, transfer all history automatically, or let a former coach keep access.

Queries still require explicit app/subject and authorized organizational context. Self-history across old ingest-org partitions is a privileged subject-owned view, not an unscoped cross-tenant query. For coach/parent sharing, compute authorized ranges/categories/org grants before reading. Owner must approve historical-sharing behavior before launch; default is no automatic new-organization access to prior history.

## 7. Exact proposed APIs and control records

These are proposed PPD contracts. Existing OW endpoints are separately identified. Use additive compatibility adapters during migration.

### 7.1 PPD BFF endpoints

| Method/path | Input | Result / security |
|---|---|---|
| GET `/api/providers` | optional authorized subject context | registry + connection + availability + mirror/history summaries; no credentials |
| POST `/api/integrations/{method}/connect-attempts` | approved consent reference, locale, allowlisted return path | attempt ID, expiry, authorize URL or mobile handoff; actor/subject derived/authorized |
| GET existing `/api/providers/{provider}/oauth/authorize` | legacy client | compatibility wrapper for bound attempt; preserve authorize_url response |
| GET existing provider OAuth callback | opaque attempt return | finish verification, no token exchange, locale-safe redirect |
| GET `/api/integrations/connect-attempts/{id}` | ID | pending/confirmed/expired/error; owner-session only |
| POST `/api/integrations/{method}/sync` | `mode=live|reconcile|history`, idempotency key; optional approved history bounds | 202 + durable job ID, not “data synced” |
| GET `/api/integrations/jobs/{id}` | ID | authorized progress and errors; no upstream secrets/raw payload |
| POST `/api/integrations/jobs/{id}/pause` or `/resume` | idempotency key | durable desired state; no destructive data deletion |
| GET `/api/integrations/{method}/history` | authorized subject | per-type requested/covered/gaps/available floor/evidence |
| POST `/api/integrations/{method}/disconnect` | confirmation/desired retention choice if applicable | job/state; stops ingestion; terms may force erasure |
| POST `/api/integrations/{method}/erasure` | explicit confirmation token | 202 lifecycle request; never claim immediate completed deletion |
| POST `/api/integrations/mobile/token` | authenticated native subject/device binding, approved method | only user-scoped OW access/refresh token + expires_in/base URL; no-store |
| POST `/api/integrations/exports` | categories/range/purpose | asynchronous scoped export job |
| GET `/api/integrations/exports/{id}` | ID | progress or short-lived subject-scoped download; no credentials |
| POST `/api/integrations/consents` | intended grant/withdraw categories/purposes and policy version | server-validated append-only event + effective version |

Legacy `/sync/trigger`, `/account/status` and DELETE `/account` remain adapters until all clients migrate. Never leave a legacy alias that bypasses consent/provider-disabled checks. Self-only connection routes must not start accepting arbitrary body `subject_id`; on-behalf-of-minor management uses an explicit separately authorized route/action.

EXT equivalent endpoints live under `/api/v1/integrations/...` to avoid existing OW namespace collisions. APP never exposes OW developer/API keys to browsers. Use Node runtime where durable control-client/server APIs require it; do not depend on a fire-and-forget Edge task after redirect.

### 7.2 Response examples

Synthetic example; field order is alphabetical and identifiers are illustrative:

```json
{
  "connection": {
    "connection_id": "ppd-connection-reference",
    "connection_method": "oura_oauth",
    "consent_version": 4,
    "generation": 2,
    "provider": "oura",
    "state": "connected_waiting_for_data"
  },
  "data_availability": {
    "available_metrics": [],
    "state": "awaiting_first_ingestion"
  },
  "history": {
    "floor_evidence": "unverified",
    "mode": "maximum_available",
    "state": "discovering"
  },
  "mirror": {
    "last_completed_at": null,
    "last_error_code": null,
    "state": "queued"
  },
  "provider": "oura",
  "schema_version": 1
}
```

```json
{
  "coverage": {
    "complete": false,
    "completed_windows": 12,
    "earliest_confirmed_at": "2024-01-01T00:00:00Z",
    "gaps": [{"end": "2024-02-01T00:00:00Z", "reason": "upstream_rate_limited", "start": "2024-01-01T00:00:00Z"}],
    "remaining_windows": 3
  },
  "job_id": "job-reference",
  "phase": "mirroring",
  "provider": "oura",
  "state": "retry_wait",
  "streams": {
    "timeseries": {"fetched": 2501, "inserted": 2400, "invalid": 0, "state": "partial", "updated": 101}
  }
}
```

Never expose a percentage if total work/earliest data is unknown. Show windows/types/counts and “discovering older history.” `connected`, `OW ingested`, `PPD mirrored`, `history complete` and `chart fresh` are separate facts.

### 7.3 Error contract

Public response: `error.code`, sanitized `error.message`, `error.retryable`, `request_id`, optional `retry_after_seconds`. Stable codes:

- `AUTH_REQUIRED`, `SUBJECT_FORBIDDEN`, `CONSENT_REQUIRED`, `PROVIDER_AGE_RESTRICTED`.
- `PROVIDER_NOT_IMPLEMENTED`, `PROVIDER_NOT_CONFIGURED`, `PROVIDER_APPROVAL_REQUIRED`, `PROVIDER_SUNSET`.
- `CONNECTION_PENDING`, `REAUTH_REQUIRED`, `CONNECTION_PAUSED`, `ERASURE_PENDING`.
- `UPSTREAM_UNAVAILABLE`, `UPSTREAM_RATE_LIMITED`, `UPSTREAM_CONTRACT_MISMATCH`.
- `HISTORY_PERMISSION_REQUIRED`, `HISTORY_FLOOR_UNVERIFIED`, `HISTORY_PROVIDER_LIMIT`.
- `SYNC_PARTIAL`, `CURSOR_INVALID`, `PAYLOAD_REJECTED`, `DATA_SOURCE_AMBIGUOUS`.

Use HTTP 401 for unauthenticated, 403 for authenticated-but-forbidden, 409 for conflicting lifecycle/method transition, 422 for invalid inputs, 429 for PPD throttling, 502/503 for upstream/service unavailability. A provider upstream 401 is usually reconnect-required, not proof PPD login is invalid. No raw OW/provider response body in browser errors.

### 7.4 Control tables and keys

New Supabase migration(s), with RLS and server-only mutation RPCs. Allocate timestamp names after branch/schema preflight; never edit already-applied migrations.

| Table | Minimum fields and constraints |
|---|---|
| `wearable_user_mappings` | UUID PK, app_id, subject_id, ow_user_id, ingest_org_id, state, created/updated; unique app+subject and appropriate OW reverse uniqueness; no provider tokens |
| `wearable_connections` | UUID PK, mapping_id, upstream_provider, method, ow_connection_id, desired_state, observed_state, generation bigint, effective_consent_version, approved_categories, timestamps; at most one active Google primary method |
| `wearable_connect_attempts` | UUID PK, mapping/subject/actor/provider/method, nonce digest, session-binding digest, return path/locale, expires_at, used_at, state, prior grant/version; do not persist provider auth codes |
| `wearable_jobs` | UUID PK, parent_job_id, connection_id/generation, operation/phase/state/priority, idempotency_key, window bounds, stream, checkpoint JSON, upstream task/run IDs, attempts, next_attempt_at, lease owner/expiry/token, heartbeat, counts/error; unique scoped idempotency key |
| `wearable_history_coverage` | connection+generation+stream+window identity, requested bounds, confirmed bounds, status, floor_evidence, source revision, last successful snapshot/version, gap reason; never merge partial intervals into complete coverage |
| `wearable_webhook_receipts` | unique transport event ID, payload digest, provider/OW user mapping, event type, received_at, job link, acceptance outcome; bounded retention, raw payload optional under policy |
| `wearable_data_lifecycle_requests` | durable ID, subject mapping identifiers copied before account deletion, operation, categories/range, generation fence, per-store state, completion evidence, requested_by/time; must survive auth/profile cascade |
| `wearable_data_grants` | proposed effective-grant projection/cache keyed subject+actor/group+purpose+category+provider+org+policy version; authority remains validated append-only consent/relationship facts |

Reuse existing `consent_events` fields `subject_id`, `actor_id`, `actor_role`, `action`, `purpose_codes`, `data_categories`, `policy_version`, legal basis and timestamp. Extend via approved migration if provider/range dimensions need structured columns; avoid trusting arbitrary JSON metadata as authorization.

### 7.5 Queue state machine and atomic RPCs

States:

`queued → leased → waiting_upstream → mirroring → refreshing_derived → succeeded|succeeded_empty|partial`

Failures/interruption:

- `leased/mirroring → retry_wait → queued` for retryable failures.
- `* → paused` for owner pause or consent pause; no new vendor requests.
- `* → cancelled` for superseded generation/disconnect/erasure; already committed data handled by lifecycle policy.
- `* → blocked` for missing credentials/permission/unknown history floor.
- `retry budget exhausted → dead_letter`, visible and resumable after repair.

Required transactional RPCs:

1. `enqueue_wearable_job`: validate allowed operation and current generation; insert unique idempotency record; return existing job on same request; conflicting body with reused key returns conflict.
2. `claim_wearable_jobs`: select eligible due rows with `FOR UPDATE SKIP LOCKED`; assign lease token/expiry; cap per subject/provider; prefer live over old history while preventing starvation.
3. `heartbeat_wearable_job`: compare job ID + lease token + generation; update only current lease.
4. `checkpoint_wearable_job`: commit stream/page cursor and successful write digest only for matching lease/generation.
5. `complete_wearable_job`: atomically update coverage and result; cannot mark success with unconsumed cursor/failed stream.
6. `transition_wearable_connection`: increment generation on pause/disconnect/erasure/method switch; atomically invalidate pending work and issue lifecycle job where required.

RPCs set fixed `search_path`, expose no arbitrary SQL/table/provider URL execution, and are inaccessible to browser anon/authenticated roles except explicitly designed safe wrappers. Server role credentials never appear in UI. Worker claims are not authorization grants: re-check effective consent/generation before each external request and commit.

Exactly-once execution is not promised. Use **at-least-once processing + idempotent facts/checkpoints**. Crash after ClickHouse insert but before checkpoint replays the same page/version. A monotonic observation/version allocated for a job/window plus serialized per-subject stream writes prevents a stale retry from overwriting newer data. Source deletion generation dominates earlier jobs.

## 8. Data model, canonical selection and migration design

### 8.1 New ingestion envelope

Every normalized fact carries:

- Stable PPD app/subject identity and ingest-org provenance.
- `upstream_provider`, `data_source_id` where exposed, `source_app`, device identity/model/type, recording method and connection method **when known**.
- Stable upstream record ID/parent ID and record kind; no fallback to random UUID for records expected to be replayed.
- UTC time, original zone offset, interval start/end if applicable, local date derivation policy.
- Metric/type, value, unit, HRV method/temperature semantics, `is_daily_total` and measurement context.
- Upstream schema/version, PPD normalization version, job/observation version, content digest, deletion state and quality/attribution status.

No silent `provider='garmin'` fallback. A user-level OW response can contain several providers. Persist its actual source or quarantine missing attribution. `unknown` is a data-quality state, not a guessed device provider.

### 8.2 Timeseries v2

Current migration 003 key `(app_id, org_id, user_id, metric_type, timestamp)` can merge two providers' measurements. Adding a new field without changing table identity cannot repair it.

Proposed v2 table:

| Field | Proposed type/semantics |
|---|---|
| app_id, user_id | non-null scoped identifiers |
| ingest_org_id | canonical org reference/provenance; legacy slug mapping retained separately |
| provider | LowCardinality(String), validated canonical OW key |
| source_key | stable non-null source identity; prefer OW data_source_id |
| source_app, device_id/model/type | nullable metadata; null does not equal a fabricated phone/watch |
| connection_method | nullable/unknown when source cannot establish it |
| metric_type | canonical series type |
| timestamp | DateTime64(3, 'UTC') or precision validated against upstream |
| interval_start/end | nullable; point samples differ from increments/rates |
| value | Float64, finite; required measurement nulls quarantined rather than zero |
| unit | validated canonical unit |
| zone_offset | original offset where supplied |
| is_daily_total | Nullable(Bool) with explicit legacy-unknown semantics |
| record_id / parent_id | source identifier where available |
| observed_version | UInt64 monotonic within writer scope |
| content_hash | deterministic canonical-payload digest |
| is_deleted | Bool |
| normalization_version, source_schema_version | versioned interpretation |
| synced_at | actual write time, not measurement time |

Sort/replacement key: `(app_id, user_id, provider, source_key, metric_type, timestamp)` for upstream point identity, with a verified stable record key if the contract distinguishes multiple same-source/time records. Do not put mutable value/device display name into the key. Partition by stable measurement month only for point identities whose time is immutable; if upstream edits time, emit tombstone for old identity and insert corrected one.

**Stable identifiers gap:** OW `/timeseries` response omits sample ID/data_source_id; SDK upload has record IDs that are not fully exposed downstream. For lossless mirror/deletion, add backwards-compatible optional `id`, `external_id`, `data_source_id`, parent/interval metadata to the OW response and event contract. Extend `timeseries_service.py`, response schemas, repository projection and tests. Until available, use a documented composite source key and report limitations; do not claim collision-free lossless source preservation from provider+model alone.

### 8.3 Workouts and sleep corrections

Current keys include stable OW event ID, but partitions use start_time month. Updating start time across a month can leave duplicates in different partitions. Implement one of:

- Stable hash partitioning for v2 event identity with date-indexed query support; or
- Explicit old-partition tombstone/version handling and cross-partition current-row selection.

Choose through ADR/performance test; recommended v2 event identity uses immutable event ID and stable partitioning to avoid time-edit duplication. Never rely on background merges across different partitions.

Store event ID/provider external ID separately; current `provider_workout_id` often contains OW ID, not original vendor ID. Keep name/label/intensity/entry_source, start/end/moving/asleep/in-bed durations, source metadata, optional sleep intervals, score links and deletion state. Match snapshots by stable ID; changed content appends a newer version; identical content need not append.

### 8.4 Health scores

Create/reconcile `ow_health_scores` using live schema preflight. Fields: stable OW score ID, provider, category, raw numeric nullable value, qualifier, declared scale, recorded_at, zone_offset/local date, components JSON, event_record_id, data_source_id, observation version, content hash, deleted flag.

Do not key only by `(user, category, date)`: multiple providers/event scores can exist on the same day. Preserve event-linked vs daily scores. GRAPH current query `GROUP BY user_id, category, date` must become provider/identity-aware. Normalize only for an explicitly approved derived metric, never by overwriting vendor score.

Recovery summary is not a universal score feed: docs describe Whoop-only/deprecated behavior while other providers have recovery categories in source. Prefer health-scores API; test actual selected release.

### 8.5 Body data

Historical body measurements come from dated timeseries, not repeated latest summary with `date.today()`. `/summaries/body` is a current snapshot with averaging-period/measurement times. Preserve both HRV methods and BP measurement timestamp. Do not re-date an old weight as “today's weight.”

Withings-scale-only users need a body-history view without fake workouts/sleep. Clinical categories remain independently gated.

### 8.6 Canonical source-selection rules

Keep all permitted source facts. Build a separate canonical layer for user-facing totals.

1. Restrict to authorized subject/provider/category/purpose before aggregation.
2. Resolve record revisions/tombstones first using one row-level latest tuple, not independent `argMax(nullable_field)` values that resurrect old non-null data.
3. Apply user-approved source priority by metric family/context. Keep policy version and selected source in the result.
4. For additive metrics (steps, energy, distance): prefer a reliable selected-source daily total where supplied; otherwise aggregate non-overlapping interval increments. Never add daily totals to that source's epochs or sum multiple sources for the same interval.
5. Do not turn rates (`kcal/day` BMR, m/s speed) into additive totals without interval integration and an approved contract.
6. For HR/SpO2/HRV: preserve context and measurement type; use documented aggregate (mean/min/latest) per graph, not one universal averaging rule.
7. For sleep: choose primary sleep source/session per overlap policy; never add two devices' recordings of the same night. Retain naps separately. Stage totals can be shown without inventing a timeline.
8. For workouts: detect cross-provider copies using source/external references where available. Without reliable linkage, do not silently delete “similar” sessions; use an explicit canonical selection/dedup candidate policy and explain uncertainty. Same time/type alone can represent two legitimate events.
9. Google reconciled data is already an aggregator; do not add it to phone/Health Connect/Fitbit copies. `GOOGLE_USE_RECONCILE=true` initially.
10. Exclude Strava and any restricted-source derivatives before analytics/AI. An aggregator/bridge is not a route around provider data-use restrictions; use provenance and policy review.

Daily rollup key includes app/subject/provider/source policy/version/metric/local day. Store aggregate kind, count, min/max/mean/sum only where meaningful, coverage and last committed observation. Publish a rebuilt window atomically via a generation/current-view switch; do not mark incomplete windows current.

### 8.7 Migration runbook

1. Obtain separate production-read approval; inspect actual `SHOW CREATE TABLE`, schema versions, row counts by provider/month, disk usage, table engines and data-source ambiguity. Do not query health values unnecessarily.
2. Reconcile local migrations with installed schema, including undocumented score tables and old org slugs.
3. Approve additive DDL/migration plan and backup/restore evidence; estimate temporary disk amplification.
4. Create v2 facts/rollups/views in staging; seed collision/revision/time-edit fixtures; run actual ClickHouse tests outside stubbed unit harness.
5. Implement dual-compatible readers and feature flags while old remains authoritative.
6. Replay OW history into v2 in bounded windows. Old source-collapsed rows are not reconstructable solely by SQL; use available OW/provider history or mark unrecoverable gaps.
7. Compare counts by complete coverage window/source/type, uniqueness, null/zero distributions, units/timezones, totals, score ranges and representative known events.
8. Shadow-read old and v2 for existing providers; classify intentional corrections vs regressions.
9. Switch a small approved cohort's readers; monitor performance and semantic parity; then expand provider-by-provider.
10. Retain old tables until explicit cleanup approval. No `DROP`, `TRUNCATE`, bulk deletion or `OPTIMIZE FINAL` on large live data as an implicit step.
11. Rollback uses reader/version flags and paused jobs, not destructive DB restore. If destructive restore is truly needed, stop for explicit action-specific approval.

## 9. Maximum-available-history and synchronization algorithms

### 9.1 Five independent bounds

For each provider+type+method record separately:

1. Vendor/device data actually exists since an evidenced date.
2. Vendor API retention/consent floor.
3. Per-request maximum window and pagination.
4. OW implementation/API limits.
5. PPD consent/retention policy.

“Maximum available” means complete traversal of the permitted request domain to the strongest evidenced floor, with honest gaps. It is not infinite retention, no-limit requests, an arbitrary five years, or absence of errors. If PPD retention is shorter than available history, explain that conflict and apply approved policy; never promise lifetime storage secretly.

### 9.2 History matrix

| Provider/method | Evidence / effective design |
|---|---|
| Garmin | official OW path max30 days before consent, HISTORICAL_DATA_EXPORT; dedicated backfill; one timeframe/type request. Existing code's five-year fetch is not official Garmin availability. |
| Polar | docs say365 days + consent floor; strategy lacks cap, endpoints vary. Verify by type; don't promise365 days for every record. |
| Whoop | no limit stated by OW; 25-record collection pages. Explicit historical ranges; drain workout/sleep/recovery/cycle pages; unscored/partial separate. |
| Suunto | no overall limit stated; health query limit28 days, source chunks20. Workouts separately paginated; subscription budget may dominate. |
| Oura | no limit stated; each collection can have different earliest date. Date windows plus next_token, interval HR/MET and scores. |
| Ultrahuman | day-oriented OW OAuth API; no limit stated. Walk day windows to verified floor. Public personal-token API's seven-day limit is another contract. |
| Google cloud | no limit stated by OW; range/pagination with reconcile semantics and source-specific floors. |
| Health Connect | default floor30 days before first permission grant; inspected SDK lacks history permission. Add runtime feature/history support or report limit; not a simple rolling30-day cap. |
| Apple | SDK `null` history lookback supports all available HealthKit history; actual type permissions/local data apply. Resumable scan; XML supplement. |
| Samsung direct | no overall limit stated; validate SDK/device/type/partnership; bounded native scan. |
| Withings | not in inspected OW history table; source supports bounded range/pagination. Vendor-type retention must be confirmed; unknown is not unlimited. |
| Sensor Bio | no public OW range guide; vendor reference unavailable. Confirm daily vs paged endpoints/floor. |
| Strava | no historical job until written terms permit architecture/history/retention. |
| Fitbit legacy | no new backfill lane; Google re-consent selected. |

### 9.3 Required OW range extension

Existing `POST /api/v1/providers/{provider}/users/{id}/sync/historical?days=` caps1–365 and only looks backward from now. Current generic sync parameters/async worker do not provide a safe documented unlimited-history substitute; async mode rejects non-default per-type options. Garmin is not rest_pull and must not be routed through that generic worker.

Proposed additive endpoint:

`POST /api/v1/providers/{provider}/users/{ow_user_id}/sync/historical/range`

Authenticated server-only body:

```json
{
  "data_types": ["sleep", "timeseries", "workouts"],
  "end_time": "2024-02-01T00:00:00Z",
  "idempotency_key": "ppd-history-window-reference",
  "start_time": "2024-01-01T00:00:00Z"
}
```

Validate timezone-aware bounds, start<end, approved stream names, provider capability, active grant, consent floor and max slice. Response includes accepted normalized window/types, upstream run ID/task ID and queued state. Never accept arbitrary vendor URL/SQL. Keep old endpoint backward-compatible.

Thread bounds/type selection through OW `sync_data.py`, `base_strategy.py`, `sync_vendor_data_task.py`, `utils/sync_params.py` and provider loaders. Set historical mode so jobs run independently of live webhook-vs-pull selection and do not change the live cursor. API idempotency must map to an existing active/completed upstream range job, not enqueue duplicates after timeout.

### 9.4 Coordinator algorithm

```text
load connection and effective grant
if disabled, paused, revoked, age-restricted or deleting: stop with explicit state
resolve documented history floor for each permitted stream
if floor unknown: discover via supported metadata/exhaustion or request user-confirmed start date
create durable recent-to-old window jobs to the evidenced floor
for each eligible leased window:
    recheck connection generation and grant
    request idempotent upstream history range
    wait using supported run metadata, not sleep-and-assume-complete
    if upstream partial: retain progress, record gap, schedule bounded retry
    mirror all relevant OW pages for the completed/available window
    validate source/type/units and write deterministic versions
    checkpoint only after successful durable write
    publish canonical/rollup coverage only for completed windows
    invalidate affected authorized caches
record history complete only when every requested stream/window has a terminal truthful outcome
```

Never stop discovery at the first empty day/month: users have long gaps between valid old records. A “no data” interval and a confirmed history floor are different states. A caller-supplied earliest date is evidence class `user_reported`, not vendor-verified.

### 9.5 Mirror pagination/checkpoint rules

- OW workouts/sleep/activity/timeseries use cursor pages; score API uses offset/limit. Unit-test each independently.
- Start with at most30-day OW timeseries windows, smaller for high volume; some current PPD requests effectively exceed the intended bound by end-of-day expansion.
- Internal range is half-open `[start,end)`. OW timeseries treats midnight end specially by adding a day; adapt query and locally filter to exact bounds. Test UTC midnight/DST/leap day/sub-second samples.
- Remove fixed20-page cap. A job budget can stop after N pages, but must save cursor and requeue, not discard remaining data.
- Persist window, stream, next cursor/offset, normalization/source policy version, content/write digest and observation generation.
- Repeated cursor→contract error; expired cursor→restart exact window idempotently; partial network/API failure→retry_wait; no false success timestamp.
- Read user-scoped endpoints once per mirror pass, not repeatedly for every provider. Preserve actual record source. Filter governed providers/categories before mirror persistence.
- Upstream timeseries currently computes total count per page; measure large-history load and, if needed, add an optional omit-count contract or window sizes that bound this cost. Do not compensate with truncation.
- Reconcile updates by snapshot/content hash, not only timestamps. Native/cloud older-record changes need a change feed or complete-window reconciliation.

### 9.6 Webhook/reconciliation contract

Two independent boundaries:

1. Vendor → OW, with provider-specific signature/challenge/body semantics.
2. OW → EXT, signed by Svix with durable receipt/job acceptance.

OW outgoing events are best-effort, not guaranteed CDC. Some emit limited workout/sleep payloads and omit update/delete events; emit failure may be swallowed. Treat them as **hints to mirror canonical state**, with scheduled reconciliation as safety net. Group and granular timeseries events can describe the same samples; choose one family or deduplicate both. Chunks carry chunk_index/total_chunks; don't mark window complete from one chunk.

Source deletion must first be represented in OW. **Oura/Google handlers currently ignore deletion events**, so a PPD re-read alone returns stale data. Add source-side correction plus durable tombstone/change notification. For deletion-by-interval, fetch a complete authoritative current source snapshot for that interval and compare known source IDs; never delete based on a failed/partial/scope-filtered response.

### 9.7 Provider budget and load control

One provider-wide budget must include OW live/history/webhook retrieval/token refresh calls. EXT mirror throttling alone cannot protect vendor quotas.

- Budget inputs: actual portal tier/response limit headers, concurrency, cost per data type, live reserve, retry cooldown, maximum queued history windows.
- Prioritize consent/deletion and live ingestion over old backfill. Per-subject fairness prevents one lifetime import starving others.
- Honor Retry-After/reset headers; exponential backoff with jitter where unspecified; do not repeatedly retry401/403 without refresh/reconsent classification.
- Shared token refresh lock per provider account; one refresh result reused by concurrent calls.
- Circuit-break sustained provider outage, retain jobs, surface status and avoid global “disconnected.”
- Capacity worksheet: estimated requests = sum(window count × endpoint calls + pagination pages + refresh overhead). Withings120/minute and Suunto dev200/week are examples from docs, not proof of actual account quotas. Strava has separate read/overall windows.
- Record runtime memory/DB load for dense history and unbounded upstream loader arrays; convert affected loaders to streaming/chunks if needed rather than sending multi-year ranges into in-memory all_data lists.

## 10. Ordered engineering work packages

Each package requires a reviewable change set, controlling AC IDs, source/test references and actual evidence. Packages can be split into smaller commits; no commit/push is authorized by this plan.

### OWI-WP-00 — Approval, staging and reproducible baseline

**Depends on:** owner acceptance of scope. **Touches:** portfolio records later, all repositories read-only initially. **AC:**01,14,15.

1. Re-read rules/catalog and dirty diffs; record HEAD+working-tree evidence and preserve concurrent work.
2. Approve intent/ADRs for registry, control plane, source storage, full history, companion, Google method selection, all-role consent, retention/lifecycle and narrowly scoped upstream patch ownership.
3. Inventory deployed OW revision/image/local patches, Alembic head/DB versions, queues, proxy, scheduler, public/private origins and backup procedure with separate read authorization. Capture secret **names**, never values.
4. Reconfirm existing four production access/scopes and start new manual applications in parallel.
5. Create isolated staging identity/OW/ClickHouse/storage with synthetic fixtures and consenting designated device accounts. Don't point provider production webhooks at staging.
6. Baseline existing tests later under correct Python/pnpm environments; record current failures instead of silently changing assertions.
7. Version spike: users, authorize/return, connections204, scores, pagination/source metadata, history, SDK tokens/202 processing, Svix and purge.
8. RN packaging spike with pinned native versions, actual builds and dependency/license checks. Sensor Bio callback/protocol spike. Strava is documentation/permission-only until approved.

**Exit:** approved high-risk intent, reproducible staging/source pin, explicit unresolved external gates.

### OWI-WP-01 — Identity, subject access and consent

**Depends:**00. **Touches:** EXT main/routes/new auth dependency; APP with-auth/provider/token/consent paths; GRAPH middleware/new subject dependency; new Supabase migrations. **AC:**02,03,11,12.

9. Create authoritative user mapping and control tables with server-only mutation/RLS tests. Keep one subject OW identity; resolve existing external IDs safely.
10. Require verified Supabase session or authenticated service principal on EXT protected routes. Header-only request→401; conflicting header/subject→403.
11. Make APP forward verified actor credentials on every protected EXT call, not merely offer optional authToken in a helper.
12. Authorize subject+org+relationship+category+purpose before reads/token issuance/connection management. Same org alone isn't unrestricted coach access; role comes from database, not editable metadata.
13. Implement health-specific consent and sharing disclosure; existing signup `recordConsentEvent` broad health/analytics grant doesn't establish each provider/purpose/recipient or special-category basis.
14. Enforce strict verified guardian status for new health flows. Existing `isApprovedParentOfChild` accepts missing status; don't reuse that legacy fallback as health approval. Reconcile legacy relationships through reviewed migration/workflow, not silent rejection or escalation.
15. Implement minor/provider-age gates and guardian-on-behalf actions; reject connecting parent phone health into child subject without legitimate subject-device ownership.
16. Treat admin operational access separately from viewing raw health; explicit reviewed administrative purpose/grant and audit. No blanket bypass imported accidentally from current BodyViz code.
17. Bind org switching to consent/cache invalidation; remove default `peak_performance` fallback from new authoritative identity decisions, map legacy slugs explicitly.
18. Protect GRAPH target paths with subject authorization in addition to middleware authentication; use service assertions or a narrow validated service endpoint for workers, not untrusted X-User-Id.
19. Audit effective-consent RLS/actor fields; preserve append-only history. Resolve retention/erasure of consent with legal policy, not disabling triggers.
20. Add redaction/no-store rules across callback queries, token endpoints, logs, raw errors, health payload analytics and Withings query tokens.

**Exit:** negative role/tenant/consent tests pass on real policy schema; all-role eligibility modeled before release.

### OWI-WP-02 — OW version, deployment, routes and registry

**Depends:**00/01 for exposure. **Touches:** EXT Docker/Traefik/settings, registry/client, OW pinned deployment. **AC:**01,11,14,15.

21. Review chosen release/migrations/security changes and installed patches; pin API/worker/beat to same image digest. Don't upgrade PostgreSQL major as an incidental step.
22. Back up/test restore including encryption keys with approved secret handling. OW app startup runs migrations/seeds: classify compose up as schema-changing deployment.
23. Inspect specific0.8.0 nightly faulty-migration warning only if installed history matches; no blind SQL from release notes.
24. Replace dependence on upstream development Compose with a reviewed production definition/pinned images, durable services and explicit queue/env propagation. Preserve private ppd-shared topology.
25. Narrow PPD `/api/v1/providers` routing; route current OW `/providers/{p}/webhooks` and `/providers/{p}/users/{id}/...` to OW. Test GET/HEAD/POST and old compatibility routes.
26. Keep actual supported deprecated aliases through cutover, then remove only after provider portal migration and owner approval. Do not invent aliases from prose.
27. Implement registry parity artifact, runtime capability/config/approval gating and a single batch status response.
28. Extend Python/TS validation/types from registry; keep Garmin compatibility endpoints; disable unsupported SDK OAuth and gated providers server-side.
29. Provision outgoing Svix only after receiver durability exists; use dedicated DB/secrets. Existing OW admin frontend is disabled: provide secured operational access, not public unrestricted portal.
30. Ensure one PPD scheduler owner; API replicas don't start another scheduler. Worker health checks prove jobs run, not just HTTP health.

**Exit:** routing matrix and registry drift tests pass; provider-disabled bypass impossible; upgrade rehearsal documented.

### OWI-WP-03 — Correct OAuth and connection lifecycle

**Depends:**01/02. **Touches:** EXT client/provider routes; APP five routes/panel/charts. **AC:**04,06,09,14.

31. Normalize OW user collection/object responses; get-by-external-ID verifies exact match; distinguish not-found from outage/auth failure; handle204/null.
32. Serialize get-or-create and persist mapping before returning auth URL; preserve existing external IDs.
33. Create short-lived session/subject/provider-bound connect attempt with nonce digest/expiry/locale/return path and pre-connect grant snapshot.
34. OW owns OAuth state/PKCE and code exchange. PPD return validates attempt/session and actual expected connection transition; no second exchange.
35. Never treat code presence, empty params, URL success flags or non2xx with a code as success. Pending/unverifiable returns show resumable state.
36. Handle canceled consent, expired PPD session, new browser, callback replay and actor switch without attaching grant to wrong person.
37. Enqueue initial maximum-history job exactly once per connection generation. Compatibility sync requests reuse idempotent job rather than issuing multiple pulls.
38. Remove reliance on Edge fire-and-forget fetch and duplicate panel/charts auto-trigger. Await durable enqueue or use appropriately supported server lifecycle mechanism.
39. Separate desired/observed connection state from ingest/mirror/history success. Display connected-awaiting-data and reconnect-required distinctly.
40. Disconnect/pause increments generation, stops new jobs and invokes appropriate OW operation; explicit erasure has its own confirmed durable request.

**Exit:** complete cloud OAuth matrix and no false-positive connection/sync states.

### OWI-WP-04 — Durable jobs and maximum-history extension

**Depends:**01–03. **Touches:** control migrations/RPCs, EXT jobs/history/scheduler/client, OW history/worker/provider loaders. **AC:**05,06,08,13.

41. Implement atomic job lease/idempotency/checkpoint RPCs and worker heartbeat/recovery.
42. Separate OW vendor ingestion from EXT mirror; don't synchronously pull twice or start lifetime import on every Sync click.
43. Implement explicit bounded history range API/worker flow described in9.3; maintain old API compatibility.
44. Ensure Garmin dedicated backfill dispatch; generic rest_pull worker is not valid. Verify five default backfill types vs all permitted core data types and record missing historical domains.
45. Discover/evidence per-type floor; recent-first then old windows; don't terminate at sparse empty interval.
46. Implement full pagination with persisted cursor/offset and bounded yield. Remove silent2,000-point cap and30-day history truncation across larger jobs.
47. Ensure range-end/DST semantics; stream/insert incrementally; no million-row Python lists or request-lifetime tasks.
48. Carry per-stream partial/dropped/error outcomes through OW→EXT→APP; don't stamp success from existing unrelated rows.
49. Apply global provider budgets/fairness/circuit breakers and token refresh coordination at OW vendor-call boundary.
50. Implement replay-safe writes/checkpoints; older job cannot overwrite newer snapshot or resurrect deleted generation.
51. Ensure SDK-only/new-provider users are enrolled without relying on cloud callback/legacy users side effects.
52. Add exact query load metrics and upstream count/array memory review before large imports.

**Exit:** >365-day and >2,000-point fixtures with sparse gaps/restarts complete to declared floor; live jobs remain responsive.

### OWI-WP-05 — V2 facts, scores and canonical readers

**Depends:**01/04 contracts; can develop against fixtures earlier. **Touches:** EXT transformers/migrations, OW additive identifiers, GRAPH loaders/graphs. **AC:**07,08,14.

53. Inspect installed schemas; create additive source-preserving tables with stable identity/version/tombstones and event partition correction strategy.
54. Add backward-compatible OW stable source/sample metadata where required for lossless mirroring and native deletion mapping.
55. Replace invalid-date→now/random-ID/zero-loss fallbacks; preserve source/zone/daily totals/intervals and both HRV methods.
56. Replace skip-known-workout behavior with content-aware upsert; preserve event corrections including null clearing/time changes.
57. Add health-score API client/writer/schema; preserve provider/category/raw scale/components/event linkage.
58. Separate body dated facts from latest snapshot/averages; use measurement freshness, not snapshot creation date.
59. Implement canonical metric-source policy and source-preserving raw views; no arbitrary cross-provider averaging/adding.
60. Rebuild versioned rollups after complete writes; atomic coverage; no OPTIMIZE FINAL requirement.
61. Shadow compare/replay existing providers; retain old data/reader rollback flags and mark unrecoverable source-collapsed history.
62. Apply source-specific temperature/HRV/score semantics in GRAPH and summary, preserving response compatibility with additive metadata.

**Exit:** collision/update/time-edit/semantic fixtures pass in real ClickHouse and no old-data destruction.

### OWI-WP-06 — Webhooks, source deletes and reconciliation

**Depends:**01,04,05. **Touches:** EXT signed receiver/jobs; OW Oura/Google/SDK deletion paths and outgoing source-change extension. **AC:**06,08,12,13.

63. Verify raw Svix bytes/headers/time tolerance, durable receipt, reverse mapping, active generation and consent before accepting work.
64. Enforce payload size/rate bounds, idempotency, chunk completeness and no duplicate group/granular processing. Acknowledge after durable queue acceptance.
65. Add Oura delete handling by original object ID and data category; map derived samples/scores/session links so deletion removes all records derived from that source resource, not only a visible workout row.
66. Add Google DELETE interval processing: complete source-specific current snapshot/diff or exact IDs where supplied; retain a source change/deletion ledger. No delete based on fetch failure or consent loss.
67. Carry changes to EXT via a reviewed additive change/tombstone feed; existing outgoing `.created` events are not enough. Scheduled full retained-range reconciliation remains a safety net.
68. Add native delete protocol and historical update detection (Section12); enforce token/generation/category policy at OW upload acceptance and worker execution.
69. Fix upload202 durability: persisted batch identity/reference before ack; replay worker failures and quarantine invalid records; processing receipt distinct from device-sent count.
70. Verify Oura renewal task declaration and schedule actually enabled; alert on subscription expiry/errors. Verify per-user Withings reconciliation and provider handshake bodies.
71. Invalidate configured authenticated GRAPH caches only after committed writes, coalesced per window/subject; remove hardcoded unauthenticated ppc-api assumptions.
72. Reconciliation must recover missed source events without falsely marking source deleted when snapshot incomplete.

**Exit:** vendor deletion, missed events and native dropped/failed batches converge across stores without resurrection.

### OWI-WP-07 — Provider-specific packages

**Depends:**core packages and relevant manual gates. **Touches:**shared registry/fixtures + provider-specific upstream corrections only. **AC:**01,05,07–09,11,15.

73. Implement each provider runbook in Section11; share foundation instead of cloning stacks.
74. Add source-shaped fixtures for successful/denied scopes, expired/revoked tokens, pagination, empty/sparse history, corrections, deletions, unsupported metrics and device-specific availability.
75. For each metric, record implemented+displayed, owner-only, policy-gated, upstream gap or device-unavailable. No silent drops hidden behind a “connected” badge.
76. Enable each lane in staging independently; production flag requires all common/all-role tests plus provider evidence. Blocked lanes remain in registry/backlog with owner/next action.

### OWI-WP-08 — Companion and XML import

**Depends:**01–06, native spike and owner repository approval. **Touches:**new MOBILE, APP mobile APIs/panels, EXT/OW upload contracts, native patches. **AC:**03,05,06,08,10–12.

77. Create independent companion repository/catalog entry only after approved remote/name; pin its own packages/lockfiles/builds. No RN dependency in Next.js runtime.
78. Build RN artifact from inspected source, matching iOS0.14.0/Android0.11.2; reproduce Android Maven dependency chain including Samsung binary/license; no dependency on one developer's ~/.m2.
79. Native PPD sign-in + authenticated backend token flow; only subject-scoped OW tokens in native secure store. No global API keys/app secret in app/QR/deep links.
80. Implement configure/restore vs first sign-in correctly: don't call signIn every launch because native signIn clears session/anchors. Verify server connection generation before resuming.
81. Select native provider and request only approved types; partial permissions do not become all-or-nothing invented success. Surface OS permission uncertainty accurately.
82. Use `startBackgroundSync(null)` for maximum available history under approved policy; no JS `syncNow()` call in0.2.0. Resume only interrupted sessions; wider range needs safe stopped anchor reset after pending data is durably accounted for.
83. Fix native pagination/change/deletion and pause/session isolation defects; add history permission on Health Connect. Do not merely add a UI “full history” switch.
84. Add companion screens for permission/source/status/history/pause/resume/reconnect/privacy/deletion. Separate “Refresh PPD status/mirror” from collecting new phone samples.
85. Apple/Health Connect first; Samsung direct release flag only after package/signature partnership. Upstream beta app is controlled pilot only.
86. Implement direct-to-object-storage Apple XML multipart create/sign/complete/abort with mapped subject, quotas, private encryption, ETag CORS and resource-safe parser/worker; no multi-GB Edge upload.
87. Validate SDK/XML duplicates, partial categories, processing receipts and full mirror completion. Raw export handling must not store excluded sensitive categories without consent.
88. Complete signed real-device/store/guardian/all-role verification; no production developer-mode instructions or arbitrary configurable server host.

**Exit:** authenticated, source-safe, recoverable companion and XML import with actual device/release evidence.

### OWI-WP-09 — App, graphs, reports and AI consumers

**Depends:**registry/readers/lifecycle policy. **Touches:**APP integration/charts/hooks/dashboard/BodyViz/AI/parent consumers; GRAPH APIs/queries/cache. **AC:**02,03,07,09,11,14.

89. Replace hardcoded panel/status arrays with a batch hook or registry-driven child components; don't call hooks conditionally/in a parent loop.
90. Fix provider detection LIMIT-before-DISTINCT and include body-only/score-only/SDK-only data; separate actual data presence from connection status.
91. Replace hasGarmin/hasPolar/hasWhoop boolean gating with supported+available metrics; retain legacy getters temporarily for compatibility.
92. Render correct “not supported,” “permission needed,” “awaiting sync,” “no records,” “partial,” “reconnect,” “paused” and “service unavailable” states. No misleading no-device banner on backend error.
93. Preserve source/HRV method/score scale/measurement time in graph and compact summary responses; no latest sleep values from different dates blindly summed; no current freshness inferred from synthetic fallback dates.
94. Update readiness-snapshot/BodyViz source mapping and authorized internal fetch; do not modify vendor visualization revisions to add labels.
95. Migrate Garmin-only wearable-query/body-data/parent/training-load consumers to canonical authorized GRAPH API. Don't write new sources into garmin_connect tables.
96. Apply purpose/provider consent before AI feature extraction/prompts/reports/aggregates/caches, including derived data. Strava excluded until explicit permission.
97. Propagate grants to coach/parent/admin dashboards, export/alerts/reports and AI memory retention; service-role queries must not bypass subject authorization.
98. Scope caches by subject/org/policy/source selection/generation; invalidate on grants/relationship/org/provider changes and logout; preserve current local cache improvements.
99. Translate new copy in ca/de/en/es/fr/nl/pt/zh and add approved attribution/assets; validate accessibility and mobile handoff.
100. Preserve compact/batch response compatibility and graph performance; no one-status-request-per-provider polling explosion.

**Exit:** every provider-only/body-only/multi-provider case works across approved roles without unauthorized derived leakage.

### OWI-WP-10 — Export, erasure and retention

**Depends:**control/source identity and all stores identified. **Must complete before any provider production release.** **AC:**03,08,11,12,15.

101. Create durable lifecycle request before deleting account/mapping; block ingestion and increment generation; preserve identifiers outside auth/profile cascade.
102. Revoke OW/provider and SDK sessions; cancel/fence queue work. An unexpired SDK access token must be denied immediately by desired state/generation even after refresh revocation.
103. Delete permitted scope from OW facts/archives/scores/events and ClickHouse facts/rollups/views, raw files/exports/Svix history as applicable, PPD caches and derived artifacts. Confirm actual per-store completion, not just queued mutation.
104. Distinguish disconnect (stop future collection) from delete (remove data), except terms requiring deletion on disconnect. Google provider purge impacts both methods; show scope explicitly.
105. Fix current account deletion response: no unconditional completed success while cross-store cleanup failed. Return pending/partial with durable retry/status; preserve unrelated billing behavior.
106. Implement complete paginated export by category/range/source/units/timezone/coverage via background object generation and signed download; no secrets or one-page truncation.
107. Fix consent export/cleanup assumptions (`subject_id`/`actor_id`, not user_id) while preserving approved append-only/audit retention.
108. Owner approves retention durations for each data category/store/purpose including OW archive, raw SDK/FIT/XML, mobile state, Svix, jobs, logs, backups and derived AI artifacts. TTL in one table is insufficient.
109. Backup restore reapplies erasure fences/tombstones before serving; old job replay must not restore deleted data.
110. Test disconnect/revoke/erasure during history, stale valid mobile token, source-side delete, failed-store cleanup and account-deleted retries.

**Exit:** complete export and evidenced erasure/retention behavior under failure; all-role privacy gates satisfied.

### OWI-WP-11 — Operations, rollout and documentation impact

**Depends:**all required packages for chosen provider. **AC:**13–15.

111. Instrument upstream vs mirror lag, queue age, retries/429s, partial windows, invalid data, blocked grants, source ambiguity, subscription expiry, SDK batch receipts and lifecycle backlog.
112. Set approved load/latency objectives from measurements. Proposed normal-load target: PPD data visible within5 minutes of OW commit; EXT webhook durable acknowledgement within1 second. These are acceptance targets, not observed SLAs or work estimates; phone OS scheduling is outside this five-minute OW→PPD target.
113. Deploy additive control/schema/read compatibility → EXT API/worker/routes → reviewed OW version/patches → APP → MOBILE. New providers remain disabled until gates pass.
114. Canary existing Garmin/Polar/Whoop and Suunto; then Oura/Withings; Google/Ultrahuman as approvals permit; Apple/Health Connect; Sensor Bio after blockers; Samsung direct after partnership. No adult-only shortcut for all-role test coverage.
115. Collect real provider test account and signed device evidence, quota/approval references, schema parity and restore rehearsal before enabling each flag.
116. Rollback pauses new ingestion/connections, reverts compatible reader/app/image flags and preserves facts/jobs/deletion fences. Destructive restore/drop/revoke of shared provider app requires new explicit approval.
117. Update existing docs/contracts/runbooks/evidence alongside implementation; record remaining backlog and status honestly. Follow alphabetical import/prop/declaration rules where dependency order permits, existing style and ES6 lint. Do not add/remove code comments unless authorized.

## 11. Provider-by-provider owner and engineering runbooks

### 11.1 Common owner preparation

For each cloud provider:

M01. Prepare legal entity/contact/domain, public privacy/terms, purpose/data category list, all roles/minors, storage region, retention and permitted AI/coaching use.

M02. Confirm/create separate staging/production applications where terms permit. Do not overwrite an existing one-app webhook to test staging.

M03. Register OW **server OAuth callback**, not the PPD finish URL. Use exact approved public HTTPS origin; `{OW_PUBLIC_BASE}` is a placeholder, not literal text to paste.

M04. Store secrets in approved server secret store; share only configuration status. Never paste values into chat/plan/PR/log/shell history. OW API/worker must receive necessary credentials.

M05. Choose least-privilege scopes and consent copy. Broad vendor scopes don't authorize retaining every returned category; filter at OW ingress before raw storage as needed.

M06. Enable provider/configure live mode through secured OW portal/API. Confirm pinned source variable names: many `*_REDIRECT_URI` vars are deprecated in0.8.0; `API_BASE_URL` determines callback.

M07. Configure inbound provider subscriptions separately from outgoing Svix. Test exact challenge method/body/signature and worker queue processing.

M08. Use designated consenting account, verify OW mapping/grant → ingestion → EXT job → ClickHouse → GRAPH → all permitted UI roles.

M09. Test refresh/revoke, new data, correction/delete, duplicate event, outage, full history and partial scope.

M10. Verify production tier/capacity/branding/support/retention; attach sanitized evidence and owner approval before feature activation.

### 11.2 Oura

**Manual**

1. Register OAuth app in Oura current developer portal; current OW guide links cloud.ouraring.com. Older official docs indicate10-user preapproval cap; confirm current portal/cap and submit review before scale.
2. Provide name/description/contact/website/privacy/terms and HTTPS callback `{OW_PUBLIC_BASE}/api/v1/oauth/oura/callback`.
3. Configure `OURA_CLIENT_ID`, `OURA_CLIENT_SECRET`, dedicated `OURA_WEBHOOK_VERIFICATION_TOKEN`; don't reuse OW SECRET_KEY.
4. Core relevant scopes: `daily heartrate workout spo2`; add `personal` for approved body/profile features and `heart_health` for VO2/cardiovascular age. `session` and `ring_configuration` only if needed. Upstream full default: `personal daily heartrate workout session spo2 ring_configuration heart_health`. Confirm enabled scope subset in portal.
5. Confirm ring/account membership and API data availability; do not promise data for unsupported generations/subscriptions.
6. Enable webhook mode; inspect subscriptions at OW `/api/v1/providers/oura/webhooks/subscriptions`. GET challenge requires verification token/challenge; POST HMAC uses client secret and x-oura-signature/x-oura-timestamp.
7. Upstream declares monthly renewal task for90-day subscriptions. Verify actual Beat schedule/worker and renewal outcomes; alert before expiration and inspect per-subscription errors, not merely a task ran.

**Engineering**

8. Add cloud registry, source-preserving data/score mappings and full history windows. Sleep/readiness/activity scores remain categories, not one recovery metric.
9. Preserve RMSSD, nightly respiration/resting source semantics, SpO2, temperature deviation/trend, MET/physical_effort, VO2/cardiovascular age and workouts. Test zero/non-wear handling and MET units.
10. Patch ignored Oura delete events and derived-record lineage; test sleep deletion also removes related source samples/scores, without deleting another source's night.
11. Verify replay and late-finalized daily totals. Webhook mode does not automatically imply periodic pull fallback: inspected OW worker selects LiveSyncMode.PULL for live polling. Add explicit reconciliation.
12. Test real >2,000-point interval data, multiple sleep sessions, denied scopes, subscription renewal and provider-only UI.

**Done:** permission/production review + complete core data and lifecycle, with no unsupported hypnogram/score or history claims.

### 11.3 Withings

**Manual**

1. Choose **Public API integration** in Withings developer dashboard. Official public guide supports use without a device-distribution/medical-cloud contract; don't accidentally apply to a different commercial program.
2. Register HTTPS OW callback `/api/v1/oauth/withings/callback`; guide says localhost/bare IP rejected.
3. Store `WITHINGS_CLIENT_ID`, `WITHINGS_CLIENT_SECRET`; comma-separated `WITHINGS_DEFAULT_SCOPE=user.info,user.metrics,user.activity`, reduced where justified. Space-separated scopes are wrong for this provider.
4. Start staging in pull mode. To enable notifications, set dedicated `WITHINGS_WEBHOOK_TOKEN`; callback `/api/v1/providers/withings/webhooks?token=...`; redact query token in proxy/observability.
5. HEAD reachability and form-encoded POST must work. Subscriptions are per user/category, not a global app registration.
6. Source category map: appli1 body/weight,2 temperature,4 BP/HR,16 activity/workouts,44 sleep,58 glucose; profile change46 handled separately. Subscribe only approved categories through consent-aware upstream configuration; don't collect glucose merely because default code includes58.
7. Confirm actual per-app quota; OW guide says120 requests/minute and explicitly no built-in pacing against it. Set budget/live reserve before lifetime import.

**Engineering**

8. Use release containing Withings and matching schema. Capture body-only and watch/sleep fixtures separately.
9. Vendor `value ×10^unit` is normalized in OW; do not scale twice in PPD. Preserve cm vs meters, mass types, BP, source/date and nullable device.
10. Core relevant body history: weight/height/body composition; clinical BP/glucose/pulse-wave/vascular/metabolic categories need explicit feature/policy approval.
11. No ECG/HRV or sleep hypnogram from this adapter; Withings vendor sleep score has no health-score mapping. Preserve deferred types as unsupported, not lossy substitutions.
12. Test per-user subscription creation, reconnect, webhook-mode switch, token rotation, invalid grant, profile revoke and protection of foreign-environment callbacks.
13. Process maximum history per measurement/activity/sleep/workout floor with pagination; no claimed unlimited range while vendor facts are unverified.

**Done:** dated body data for scale-only users; clean per-user notification lifecycle; no extra sensitive category retained without consent.

### 11.4 Google Health API and Fitbit replacement

**Manual**

1. Create/select organization Cloud project; enable `health.googleapis.com`.
2. Set Google Auth Platform branding/audience/data access, verified domain/privacy/terms/contact and test users. Create Web OAuth client with OW callback `/api/v1/oauth/google/callback`.
3. Store `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`. Approved read scopes use prefix `https://www.googleapis.com/auth/googlehealth.` with `activity_and_fitness.readonly`, `health_metrics_and_measurements.readonly`, `sleep.readonly`; add `nutrition.readonly`/`settings.readonly` only for approved features. `openid email` as required for identity.
4. Official docs: unverified cap100 users; Testing-mode refresh tokens expire after7 days. Explicitly test reconnect; publishing status doesn't waive restricted-scope review.
5. Complete OAuth restricted-scope verification and required annual CASA/security assessment. Official page gives indicative assessor fees$500–$4,500; get actual quote/applicability. No approval or timeline guarantee.
6. In-app disclosure must describe accessed data and use/sharing in normal flow, not only privacy policy. Review minor eligibility, coach/parent and AI use explicitly.
7. Initially `DEFAULT_DATA_GRANULARITY=raw`, `GOOGLE_USE_RECONCILE=true`; acknowledge reconciled results lack single-device attribution.
8. Prefer operator-managed project subscriber registration on current Hetzner topology, or approved short-lived workload credentials for automated management. Use dedicated `roles/health.editor` where its permissions are appropriate, or narrower custom `health.subscribers.{create,list,update,delete}` permissions as justified. **Do not use broad project `roles/editor`** copied from OW example.
9. Set dedicated `GOOGLE_WEBHOOK_SECRET`. Register subscriber with `endpointAuthorization.secret` exactly `Bearer ` + secret, automatic subscription policy for supported/approved data types, callback `/api/v1/providers/google/webhooks`.
10. Verification sends authenticated request expecting2xx **and unauthenticated request expecting4xx**. Test both. Current OW validates echoed bearer token; asymmetric GOOGLE-HEALTH-API-SIGNATURE/Tink verification is deferred. Do not describe this as implemented asymmetric signing; add as a separate defense-in-depth/provider-requirement task if required.
11. For OW-managed registration, `GOOGLE_PROJECT_ID` means numeric **project number**; credentials/env must be on Celery worker. Prefer federation/ADC, not long-lived JSON keys. Operator-managed mode leaves service-account config unset and does not use OW management endpoints requiring it.

**Engineering**

12. Add Google cloud method and shared-google connection rules. Test SDK sign-out cannot remove cloud OAuth grant.
13. Implement explicit range history, session/metric pagination, reconcile totals, correct source nulls and actual source-based labels. Don't blindly tag every Google record Fitbit.
14. Patch Google ignored DELETE notifications and mirror tombstones; ensure limited notify-supported types have explicit reconciliation.
15. Fitbit migration requires new Google consent; tokens cannot transfer. Preserve historical provider provenance and identity links; no blanket relabel of old Fitbit facts.
16. Compare vendor app reconciled daily totals with PPD, including phone+Fitbit duplicate sources. Test account/tier/scopes and7-day refresh expiry.

**Done:** verified Google cloud setup, security review gate, correct reconciled data/history/deletion and safe Google mobile coexistence policy.

### 11.5 Fitbit legacy — intentional no-launch

1. Registry state `sunset`; route Fitbit/Pixel users to Google Health.
2. Official Google statement says shutdown in September2026 but inspected source doesn't give exact day; don't assert a specific date/live availability without evidence.
3. Contingency-only setup: Fitbit app `FITBIT_CLIENT_ID`, `FITBIT_CLIENT_SECRET`, callback `/api/v1/oauth/fitbit/callback`, approved read-only `activity`; Personal testing vs Server production app. Old FITBIT_REDIRECT_URI example is deprecated in current OW config.
4. Adapter is activity/workout-only; sleep/intraday HR/daily summaries not implemented and feature-frozen. No new work to expand it.
5. Temporary use requires a new explicit owner decision and confirmed API status. Existing historical records, if any, keep source provenance and user export/deletion support.

### 11.6 Ultrahuman

**Manual**

1. Sign in with Ring AIR account; confirm multi-user **Partnership OAuth** access. Public docs show a different personal-token/partner-code flow; don't substitute it.
2. Create OAuth app, callback `/api/v1/oauth/ultrahuman/callback`.
3. Configure `ULTRAHUMAN_CLIENT_ID`, `ULTRAHUMAN_CLIENT_SECRET`, approved `ULTRAHUMAN_DEFAULT_SCOPE`. Start ring_data; profile only if needed; cgm_data off without approved glucose feature. Full upstream default `ring_data cgm_data profile` is not automatic PPD consent.
4. Verify commercial use, quotas/history and authenticated documentation. Never ask end users for personal API tokens in place of OAuth.

**Engineering**

5. OW uses auth.ultrahuman.com/authorise, Partnership OAuth token and `/api/partners/v1/user_data/metrics`; public personal `/api/v1/partner/daily_metrics` is another endpoint/auth shape.
6. Enable sleep timeline, HR, SDNN, skin temperature, steps, active time and VO2; no workouts. Preserve SDNN distinction and confirm vendor metric definition before readiness baselines.
7. Upstream coverage declares no persisted health scores; normalized recovery isn't saved. Optional recovery/CGM extension needs its own typed source fixtures/consent/metric review; no fake recovery card.
8. Walk all day windows to confirmed floor, record sparse/partial days, throttle, isolate auth-required vs retryable failures.
9. Test source-only ring UI, late sleep corrections, no workout errors and extra scope denial.

### 11.7 Sensor Bio — source-discovered and blocked pending validation

**Manual**

1. Obtain developer/organization access at developers.sensorbio.com; confirm commercial terms, device/test account, multi-user authorization-code grant, history and quotas. Public reference failed to load during research; don't assume self-service approval.
2. Obtain OAuth client ID/secret, not unrelated MCP organization token/client-credentials configuration.
3. Configure `SENSORBIO_CLIENT_ID`, `SENSORBIO_CLIENT_SECRET`, empty `SENSORBIO_DEFAULT_SCOPE` unless vendor confirms granular scope changes.
4. Register corrected callback only after patch below; secure real test data for biometrics/sleep/activity.

**Engineering**

5. OW0.8.0 SensorBioOAuth builds `/api/v1/oauth/callback/sensorbio`, while router matches `/api/v1/oauth/{provider}/callback`. Patch to `/api/v1/oauth/sensorbio/callback`; add exact URL regression test. No matching alias found in inspected OAuth router.
6. HTTP/2 dependency exists in OW pyproject (`httpx[http2]`); data loaders pass http2=True. Profile `/v1/user` uses ordinary httpx.get: confirm protocol requirement and adjust through a scoped test/patch if needed.
7. Map biometrics HR/RMSSD/SpO2/respiration, daily recovery RHR/HRV, steps/energy/distance, workouts/sleep totals and score categories.
8. Validate mixed timestamp units: workout/last-timestamp cursor ms, sleep examples seconds. Don't globally guess magnitude without endpoint contract.
9. Review sleep efficiency: source assigns generic score.value to efficiency_percent. Confirm semantics and fix if score≠efficiency. No fabricated naps/hypnogram/detail endpoint.
10. Add per-day/range pagination and explicit incomplete status; unknown history floor/score scales remain blockers, not permissive defaults.

### 11.8 Strava — written permission first

**Current blocker:** official June1,2026 policy restricts other-user display§2.3, AI including context/RAG/derived data§5.3, combined analytics§5.4, persistent stores§5.5, intermediary/agent interfaces§5.16, cache beyond7 days§6.2 and requires deletions reflected within48h§6.3. These directly conflict with PPD history/ClickHouse/coaching/AI. User selected approval-gated approach.

1. Obtain qualified policy review and written permission covering OW intermediary, durable history, analytics/combination, AI, coach/parent access, exports and retention. User consent alone doesn't override provider restrictions.
2. Keep provider disabled in APP, EXT, OW configuration and all purpose filters before permission. Synthetic contract tests can proceed; no real ingestion.
3. After suitable permission: create app, register callback **domain only** in Strava settings; OW callback `/api/v1/oauth/strava/callback`.
4. Configure STRAVA_CLIENT_ID/SECRET, dedicated STRAVA_WEBHOOK_VERIFY_TOKEN and only approved scopes (commonly activity:read_all,profile:read_all where justified).
5. Confirm actual tier/subscription/capacity. Official docs say new apps start capacity1, self-upgrade10, review for higher. Read and overall rate windows differ; use actual X-ReadRateLimit/X-RateLimit headers, not simplified OW tier table.
6. Register one production webhook at current `/api/v1/providers/strava/webhooks`; GET challenge; activity create/update/delete and athlete deauthorization. Don't delete shared subscription to test.
7. Follow approved brand/connect-button/attribution requirements and submit all intended screens for review.
8. Only under negotiated permission add workout/optional streams, exact retention controls and source policy. No sleep/continuous health promises. Full history only if explicitly allowed.
9. If denied, remain blocked; an isolated transient self-only viewer is a **separate owner product decision**, not a hidden fallback under this plan.

### 11.9 Existing Garmin

1. Verify existing production app/credentials/scopes/attribution. OW guide says new enrollment suspended; not independently confirmed in restricted Garmin portal. Existing access means don't create needless replacement app.
2. Confirm GARMIN_CLIENT_ID/SECRET and API_BASE_URL callback. Audit relevant API Tools endpoints/data types; don't enable all sensitive domains blindly.
3. HISTORICAL_DATA_EXPORT consent must be granted; backfill scope may require user enabling it. Respect30-day consent-relative limit and duplicate timeframe/type409 semantics.
4. Current `backfill_config.py` default orchestration covers sleeps,dailies,activities,activityDetails,hrv, while16 types are accepted. Maximum available core history may need approved expansion to epochs/bodyComps/stressDetails/respiration/pulseox/userMetrics/skinTemp as actually permitted. Clinical/reproductive types remain separately gated. Validate vendor caps rather than stale “one-day-only” guide wording; pinned source uses30-day config.
5. Choose one official ingestion owner; legacy/direct Garmin data can remain as existing history/compatibility without double-counting OW. New unofficial scraping not in scope.
6. Verify current OW Garmin header comparison against configured client ID and private routing; shared source/auth/score/history fixes apply.
7. Test backfill/new daily pushes, revoked account, no repeated409 retries, direct/OW duplicate-source reconciliation and Garmin branding.

### 11.10 Existing Polar

1. Verify AccessLink app, production data grants/client/scopes, exact OW callback and post-OAuth user registration.
2. Configure POLAR_CLIENT_ID/SECRET; accesslink.read_all. Verify optional Sleepwise subscription and Elixir device features rather than enabling nonexistent metrics.
3. Inspect/register one app webhook current generic path; PING must return200. Signing secret is returned once and stored in OW provider settings; verify persistence/worker use, not just old env example.
4. Normalize workouts/sleep/activity/HR/RMSSD and typed score categories/scales. Elixir ECG-derived samples are not full waveform support.
5. Verify endpoint-specific historical/consent floors and bounded retries/reconciliation. Unknown older availability cannot be “complete empty.”
6. Test optional samples/zones/routes flags through correct sync mode; async worker rejects unsupported non-default flags in current release.

### 11.11 Existing Whoop

1. Verify active membership/team/app/APIv2 and callback. Review offline read:cycles read:sleep read:recovery read:workout; body_measurement/profile only if approved/needed.
2. Configure webhook current generic path; HMAC-SHA256 of timestamp-ms string+raw body, base64, X-WHOOP-Signature and X-WHOOP-Signature-Timestamp; current source enforces5-minute tolerance. Test stale/altered/missing headers.
3. Correct stale no-timeseries assumptions: recovery snapshots RMSSD/RHR/SpO2/skin temp, height/weight/cycle energy, not continuous HR.
4. Aggregate sleep stages only; valid null distance/elevation/device/name. Don't synthesize hypnogram or GPS.
5. Full paginated workout/sleep/recovery/cycle history; scored vs unscored explicit; kcal conversion and daily-total semantics.
6. Validate targeted updated/deleted handler behavior and downstream changes; sleep.updated also refreshes cycle; never skip existing IDs in EXT.

### 11.12 Partial Suunto

1. Confirm partner approval/API agreement, subscription tier and production quota.
2. SUUNTO_CLIENT_ID/SECRET/SUBSCRIPTION_KEY, dedicated SUUNTO_WEBHOOK_SECRET; API_BASE_URL-derived callback. Subscription key is separate from OAuth secret.
3. OW guide states dev10 calls/minute,200/week; confirm actual account and request higher quota if needed before hourly multi-user/full history.
4. Register generic webhook, HMAC verify, acknowledge within Suunto2-second window; async processing. Route-created events intentionally unsupported if so configured.
5. Unhide card only after new registry/status capability flow, not just comingSoon=false.
6. Workouts/health fields, RMSSD, sleep totals and recovery; source uses20-day health chunks for28-day limit. Test max history/quota exhaustion/late modifications.

### 11.13 Apple HealthKit and XML

1. Owner verifies organization Apple Developer account, unique bundle/App ID, HealthKit/background capability, signing/provisioning, App Store Connect and distribution roles.
2. Use actual SDK/app platform minimum: RN podspec iOS15.1, Swift5.9; Expo/toolchain may require higher. Ignore old Apple guide's iOS13 claim.
3. Accurate read-purpose disclosure, data collection/privacy labels, deletion/support/age eligibility. No health write request without approved feature; audit plugin NSHealthUpdateUsageDescription and capabilities.
4. TestFlight is a pilot, not public production approval. Use real iPhone/Apple Watch records for sync/background, simulator only for appropriate UI tests.
5. Implement native token/permission/history/delete protocol and secure restore described in12. HealthKit authorization request success does not prove each read grant; empty data remains ambiguous.
6. XML manual: Health profile→Export All Health Data→extract/select export.xml. Explain all included sensitive categories and allowed ingestion. Do not send multi-GB ZIP/XML through Next.js memory.
7. OW0.8.0 multipart5MiB–5GiB; use returned part size (docs default100MiB), presigned PUT, ETag, complete/abort. Smaller files use supported direct upload. Client completion mode for S3/MinIO; SNS only by explicit alternate deployment.
8. Private bucket/encryption/scoped key/CORS exposingETag/expiry/incomplete multipart cleanup/XML parser limits/dedicated worker and retention. Upload done≠processed≠mirrored.

### 11.14 Health Connect

1. Owner verifies Play Console organization/app/signing, Health Apps declaration, Data Safety, data-type/purpose/background/history declarations and consistent privacy/rationale page.
2. Runtime detect Health Connect availability; Android14+ integrated, older supported devices installed component. Current native source min29,compile36,Java17; targetSDK must satisfy release-time Play policy.
3. Primary SDK `google`; no invented upstream health_connect key. Add missing READ_HEALTH_DATA_HISTORY with feature detection, grant state and rationale; background permission is independent.
4. Audit merged manifest against actual core permissions; native source includes FOREGROUND_SERVICE_HEALTH/HIGH_SAMPLING_RATE_SENSORS, unlike older docs' dataSync wording. Validate required foreground-service permissions on current Android target; don't copy outdated service type.
5. Native fixes for page token/timestamp ties, older updated records, delete changes, provider-isolated anchors and pause. Detailed in12.
6. Samsung→Health Connect bridge requires user enabling supported category sync in Samsung app; explain reduced/conditional coverage and preserve data origin.
7. Test min supported device + Android13/14+/current, partial/background/history grants, reinstall/regrant and Google cloud method switch.

### 11.15 Samsung Health direct

1. Apply via Samsung Health Data SDK partnership with final package, release signing SHA-256 (including actual Play App Signing cert where applicable) and exact scopes.
2. Verify supported Samsung Health/device/version; OW docs say6.30.2+ and API29+, actual test matrix may differ.
3. **Developer mode is testing/debug only**, explicitly not for end users per Samsung official docs. Never ship developer-mode workaround instructions.
4. Register release variants/signatures, preserve signing keys securely; rotation/new package needs provider recheck.
5. Use companion `samsung` method and consent-limited token/upload path. Partner approval doesn't replace subject permission/PPD consent.
6. Test method selection, paired devices, metrics/history, background behavior, denied access, key mismatch, duplicate direct/bridge data and revocation.
7. If partnership unavailable, keep direct path approval-required; offer tested Health Connect subset without calling direct integration complete.

## 12. Native companion technical specification and upstream corrections

### 12.1 Why React Native/Expo

| Option | Decision |
|---|---|
| PPD RN/Expo companion | primary; matches React/TS team, own auth/branding/release; official wrapper over native engines |
| Flutter | fallback; published wrapper but adds Dart/UI toolchain; same underlying native correctness issues still apply |
| Upstream beta app | optional controlled pilot via invitation code; beta TestFlight/APK and Samsung nonpartner limitation |
| Native Swift+Kotlin apps | unnecessary two UI codebases for small companion |
| PWA/simple WebView | cannot collect HealthKit/Health Connect without native bridge/background integration |
| Capacitor | no inspected official OW wrapper/local implementation; custom native bridge cost, not preferred |

### 12.2 Reproducible packaging runbook

1. Owner approves MOBILE repository name/remote/catalog registration. It is independent of APP's pnpm build and vendor checkouts.
2. Pin RN SDK commit339bd95..., inspect package0.2.0 and build/index.js/plugin build requirements. Verify package source/license before installing any similarly named npm package.
3. Pin IOS0.14.0 and ANDROIDv0.11.2. RN example README still checks outv0.11.1 while wrapper expects0.11.2; don't copy that stale command.
4. Android native source publishes group com.openwearables.health/artifact sdk/version0.11.2 and copies Samsung `com.samsung.android.health:data:1.0.0` from bundled Maven directory. Verify archive provenance/license/redistribution and matching dependencies.
5. For local spike, verified native checkout can run declared `./gradlew publishToMavenLocal` after approval. For CI/release use a reproducible reviewed internal/file Maven repository or verified official published artifact with checksum, not uncontrolled ~/.m2 precedence. Restrict repository content to intended coordinates to avoid dependency confusion.
6. RN wrapper's Android build lists google/mavenCentral but dependency is described as Maven Local. Configure explicit approved repository resolution in repeatable app/plugin build; a developer machine succeeding with cached artifacts is not proof.
7. iOS podspec pins OpenWearablesHealthSDK0.14.0 and minimum15.1. Capture Podfile.lock and native resolution; test real-device link/signing.
8. Baseline RN dev stack Expo54/RN0.81.5/React19.1 tooling from source; choose compatible aged versions using official Expo compatibility, not the broad '*' peer ranges. APP React19.0 does not constrain independent MOBILE.
9. Generate native projects non-destructively initially; inspect plugin output. Do not run prebuild--clean over hand-edited native work without explicit deletion approval.
10. Define MOBILE scripts for lint/typecheck/unit/native-build verification and document only actual runnable commands once scaffold exists.

### 12.3 Correct SDK lifecycle for0.2.0

Verified API:

- configure(host, customSyncURL?) — iOS ignores customSyncURL. Use approved base origin with SDK canonical path; don't design iOS policy enforcement around that ignored override.
- signIn and signOut are Promise-based in inspected TS module. Native signIn resets anchors/session; call for actual login/account transition, not every app startup.
- restoreSession and getSyncStatus are synchronous; isSessionValid is local/session presence, not provider consent/revocation verification.
- startBackgroundSync(number|null) returns Promise<boolean>. `null` means no lookback floor in inspected native implementations, subject to platform permission.
- **syncNow() is absent** from public RN0.2.0. Do not implement a button that calls it or falsely substitute resumeSync.
- resumeSync only resumes existing interrupted work. Gate UI on `!isSyncing && hasResumableSession`; returned true alone doesn't prove a fresh sync started.
- setSyncInterval is no-op on iOS; Android minimum15minutes. Do not promise a fixed iOS sync interval.
- resetAnchors forces full replay and can clear session/outbox. Stop collection, ensure pending batches safely persisted/accounted for, reset, then start with wider floor; never reset mid-flight.
- getStoredCredentials includes raw user tokens. Never log/display/spread that object into telemetry; copy only nonsecret status fields.

Companion facade state:

`logged_out → authenticated_unbound → consent_required → native_permissions_required → ready → historical_exporting|live → paused|reconnect_required|erasing`

Backend state remains authoritative for grant/generation. On foreground restore, check server desired state before resuming where possible; OW ingress independently rejects revoked generation so offline app cannot bypass pause.

### 12.4 Native deletion and change protocol — required for production completeness

**iOS observed:** anchored query receives deletedObjects but completion returns only samples/anchor. It counts deletes for pagination, then drops IDs. Extend per-type read result and payload with `deleted_records` keyed by HealthKit UUID/type/source where available. Preserve ID mapping in OW import tables and emit downstream tombstones. Advance deletion anchor only after durable accepted batch.

**Android observed:** HealthConnectManager reads by event timestamp, does not return/use pageToken in its provider result, and has no Changes API path. That can miss:

- records tied at a page-boundary timestamp;
- old event records inserted/updated after cursor passed;
- source deletions;
- interval records whose start/end cursor semantics disagree.

Required implementation:

1. Extend HealthDataProvider/ProviderReadResult to represent record-page tokens, source IDs, change tokens, upserts and deletes, completion vs permission/error state.
2. Drain native ReadRecords pagination within a fixed history window before advancing window timestamp. Persist tokens or restart exact window idempotently if platform tokens cannot safely survive restart.
3. Use Health Connect Changes API for supported incremental update/delete tracking; persist change token per host+subject+provider+type+grant generation. Handle expired token by bounded authoritative resync, not reset-to-now.
4. Validate Samsung change/deletion APIs independently in SamsungHealthManager; do not assume Health Connect mechanisms apply. If unavailable, specify complete-snapshot reconciliation with explicit limits and user-data purge support.
5. Keep original external IDs through SDK/OW/EXT. Deleting one parent HR record removes its expanded samples; deleting a sleep phase/session recomputes affected merged sleep without deleting other sources.
6. Add additive payload version with `batch_id`, connection generation, sync_session_id and delete arrays. Backend rejects wrong user/provider/generation; legacy SDK payloads remain explicitly limited or disabled for rollout if they cannot meet deletion requirements.
7. Do not reinterpret missing read permission as deletion of every historical record. Consent withdrawal follows policy lifecycle, not an empty snapshot heuristic.

### 12.5 Upload durability and processing receipt

OW current route accepts raw body, queues validation and returns202. Android/iOS treat2xx as upload success and can advance anchors. Worker may drop invalid records or fail later. SDK sentCount is not committed row count.

Implement:

- Stable device batch ID retained across retries; server unique receipt keyed subject+generation+batch ID and payload hash. Same ID/different body→conflict.
- Consent/provider/generation and minimal envelope validation **before** raw storage or queue acceptance.
- Durable encrypted payload reference or transactional inbox/outbox before202; publish worker task from durable intake, retry if broker unavailable.
- Existing `SDK_PAYLOAD_S3_OFFLOAD=true` avoids large broker payloads; configure it only with approved storage/retention. Current offload persists before queue but needs orphan/requeue handling if task dispatch fails.
- Processing receipt states accepted/processing/committed/partial/rejected with counts/invalid reasons and replay pointer; expose subject-safe status to companion/PPD, not raw health errors.
- Worker rechecks connection generation/consent before persistence and emits partial when dropped_count>0; do not propagate its current success label as complete ingest.
- Replay retained failed batch until repaired or intentionally rejected with explicit evidence. Don't delete transport-only payload before completion/replay ledger committed.
- Native can advance send cursor after durable acceptance **only because server owns retry from then on**; full history complete requires processing receipts and mirror coverage too.

### 12.6 Cancellation, method switch and local privacy

Android stopBackgroundSync currently cancels periodic work, not explicitly expedited work; session/anchor key is based on user without provider/host. Patch/verify cancellation of expedited/in-flight work and scope state by `(approved_host, ow_user, provider, generation)`.

On sign-out/switch:

1. Pause server generation first when online; local stop immediately regardless.
2. Cancel periodic/expedited/network tasks, await/quiesce writer, revoke old token session.
3. Dispose provider manager; clear only old subject's sensitive outbox/anchors according to durable receipt state.
4. Initialize next identity/provider namespace, never rebind pending old body to new credentials.
5. Server independently rejects stale payload even if local task races.
6. Exclude sensitive outbox/token/state from cloud/device backup where required; use OS encryption/file protection and bounded storage, not SDK marketing claims alone.

### 12.7 Platform permission contract

| Concern | Apple | Health Connect | Samsung direct |
|---|---|---|---|
| initial core types | explicit HealthKit read types | manifest + runtime types | partner scope + runtime read |
| background | HealthKit observer/BGTask/OS scheduling | feature/background permission + WorkManager/service | Samsung access + Android scheduling |
| full history | null lookback, actual on-device history | add history permission if feature available | vendor SDK/type history limits |
| read-denial signal | often indistinguishable from empty records | inspect granted permission set | SDK result/permissions |
| release gate | entitlement/signing/App Store | Health Apps/Data Safety/Play | Samsung registered package+release cert+Play |
| deleted source records | extend HealthKit deleted UUID upload | Changes API + tombstones | verify Samsung change contract or bounded reconciliation |

Default mobile core set must avoid duplicate selectors (e.g. both bloodPressure and separate systolic/diastolic) that query same record family twice. Wrapper selector naming does not dictate canonical type. Android basalEnergy selector emits BASAL_METABOLIC_RATE kcal/day: keep it a rate or leave disabled until reviewed, not daily kcal expenditure.

### 12.8 Proposed MOBILE files

- `src/api/client.ts`: authenticated PPD API, host allowlist, stable errors.
- `src/auth/session.ts`: Supabase/native session lifecycle with approved secure storage.
- `src/health/sdk.ts`: wrapper facade, restore/sign-in distinction, no syncNow call.
- `src/health/permissions.ts`: platform/category capability mapping and permission status.
- `src/health/sync-state.ts`: backend+native receipt state projection, no secret fields.
- `src/health/source-policy.ts`: single-primary Android/Google method and generation checks.
- `src/screens/{Connect,Consent,History,Permissions,Privacy,Status}.tsx`: minimal companion UX, alphabetical props/imports.
- `app.config.ts`, package/lockfile, platform signing config and repeatable native config plugin.
- Unit/contract/device tests for each module; CI artifacts/logs sanitized and retention-bounded.

These files/repo are proposed, not present. Avoid adding unrelated native dashboard/navigation/library dependencies before scaffold review.

## 13. Upstream patch portfolio and exact release gates

Maintain a small reviewed patch stack or contribute upstream; don't fork every adapter. Register any maintained fork/checkout with owner approval. Each patch has regression fixtures and removal condition when upstream release includes equivalent fix.

| Patch | Required files | Acceptance |
|---|---|---|
| U01 bounded history API | OW sync_data.py, base_strategy.py, sync_vendor_data_task.py, sync_params.py, affected loaders | arbitrary permitted old ranges/type selection, idempotent run, no live cursor corruption |
| U02 stable fact/source IDs | OW timeseries response schemas/service/repository + outgoing/import lineage | exact source IDs survive public API and deletion mapping |
| U03 Oura deletes | oura/webhook_handler.py, provider resource lineage/repositories, change events | delete source object removes related facts/scores only, retry-safe |
| U04 Google deletes | google/health_api/webhook_handler.py and source-scoped interval reconciliation | DELETE handled, incomplete fetch never bulk-deletes valid data |
| U05 Sensor Bio callback/protocol | sensorbio/oauth.py + tests | exact callback matches router; profile/data HTTP protocol verified |
| U06 SDK consent/session fence | sdk_token.py/sdk_token_service.py, auth dependency, sdk_sync.py, worker/connection service | user+provider+generation/category restriction enforced at accept and commit |
| U07 SDK durable batch receipt | sdk_sync.py, process_sdk_upload_task.py, raw-payload/inbox and receipt model |202 means durable retry responsibility; partial validation visible |
| U08 native change/delete protocol | IOS main/types/outbox/anchors; Android provider interface/managers/sync; RN bridge/types; OW SyncRequest/importer | full changes/deletes across restarts/timestamp ties |
| U09 native history/pause/isolation | Android manifest/HealthConnectManager/SyncManager/storage; IOS reset/lifecycle as needed | full history permission, safe canceled jobs, no cross-provider/user leaks |
| U10 provider-wide quota/partial propagation | shared api_client, worker/provider loaders/renewal tasks | fair budgets, Retry-After, no success on untracked partial errors |

Don't claim patches were made. Google bearer verification works as implemented; asymmetric verification is a distinct optional/required-by-review follow-up, not something already present.

**External bridge caution:** a source event can be merged into an aggregate before public API. Preserve raw resource→derived-record lineage in OW if necessary to make deletion correct. PPD must not query OW private tables as a long-term workaround; add an authenticated stable API/change contract.

## 14. Additional data-category expansion plan

The user chose minimal default permissions with gated extensions. “Include all integrations” does not mean collect every sensitive field by default. Inventory each category against the pinned provider `coverage.py` and actual source payload; mark upstream supports vs PPD ingestion vs UI/use separately.

| Category | Candidate upstream paths | Default | Required extension work |
|---|---|---|---|
| fitness/activity/sleep/recovery | all relevant adapters | core where supported | shared facts/scores/graphs, vendor semantics, all-role consent |
| basic body composition | Withings/Apple/Google/Samsung/Oura/Whoop subset | core only for approved product features | dated body-history UI, source/unit/time and category grants |
| BP/glucose/clinical vitals | Withings/Apple/Google/Samsung and device-specific paths | gated | clinical-purpose disclosure, narrow role permissions, separate display/alerts, approved units/ranges; no diagnosis |
| ECG/AFib/medical records | limited or deferred adapters/platform SDKs | unsupported/gated, not assumed available | verify raw waveform/classification contract, new schema/access/UX; don't map classification into burden/count |
| reproductive/sexual/pregnancy | Garmin/Apple and platform-dependent bridges | off | explicit special-category purpose/guardian review, owner-only defaults, data isolation/retention and deletion; verify importer actually supports type |
| nutrition/hydration | Apple/Google/platform subsets | off except approved hydration feature | grams/kcal/mL semantics, intake vs expenditure, granular permissions, UI and history |
| location/GPS/routes | provider workout/stream paths | off | independent purpose/grant, route redaction/location sensitivity, storage/retention, no broad coach tracking |
| environmental/audio/mindfulness | Apple/platform subset | off | verify available types and product value, category consent, aggregation semantics |
| vendor-specific advanced metrics | Oura cardiovascular age, Withings PWV/metabolic age, Polar Sleepwise/Elixir, Garmin advanced | gated individually | device/subscription evidence, metric cards/scales, truthful limitations, no medical inference |

For each approved extension:

E1. Owner accepts specific user-facing feature, exact data types and allowed roles/purposes.
E2. Verify provider scopes/API/SDK support with a sanitized fixture; no source field means upstream work, not a PPD mapping trick.
E3. Update consent/disclosure/age and retention policy; require re-consent for broader access.
E4. Add registry category and **OW ingest filtering before raw storage**; coarse scopes may need provider response filtering.
E5. Add additive fact/typed schema and historical source-preserving mapper; use canonical units and semantic tests.
E6. Add authorized API/UX/export/delete paths and provider-specific metric card; don't inherit recovery thresholds.
E7. Negative test denied category through API, raw payload storage, logs, AI, report, parent view and cached aggregate.
E8. Update provider/store review declarations and release evidence before enabling category flag.

## 15. Exact files and repository change map

### 15.1 EXT existing files

- `src/openwearables/client.py`: client lifecycle/typed shapes/204, registry types, health scores/data sources/history/mobile/run methods.
- `src/openwearables/sync_service.py`: vendor-vs-mirror split, complete stream pagination, results/checkpoints, updates/source selection/rollups/invalidation.
- `src/openwearables/transformers/{activity_summaries,sleep,sleep_summaries,timeseries,workouts}.py`: semantics/provenance/zero/null/time/stable IDs and new fields.
- `src/api/routes/provider_data.py`: authenticated registry-aware cloud compatibility routes/attempt finish/jobs.
- `src/api/main.py`: dependency/routes and scheduler ownership, no duplicate lifespan scheduler in API mode.
- `src/scheduler/multi_user_scheduler.py`: registry-based reconciliation/worker scheduling, SDK users, legacy compatibility.
- `src/users/supabase_client.py`: canonical subject/org/mapping/control RPCs and bounded cache.
- `src/database/clickhouse_client.py`: versioned inserts, no health sample logs, errors propagate correctly.
- `src/config/settings.py`: public/private origins, flags/job limits/auth/Svix references; provider secrets remain in OW.
- `src/api/routes/{garmin_data,garmin_compat_router,webhooks}.py`: only necessary compatibility/auth/official ingestion ownership changes.
- `docker/{docker-compose.yml,openwearables-prod.yml}`, `docker/traefik/dynamic/routes.yml`: exact routing, pinned production roles/queues/resources.
- `requirements.txt`: justified aged pinned dependencies only (e.g. Svix verifier), not provider-specific SDKs for every cloud API.
- Tests: `tests/openwearables/test_{client,provider_data_routes,sync_service,transformers}.py`, scheduler/database/auth fixtures.

### 15.2 EXT new files justified by missing capabilities

- `src/openwearables/provider_registry.json`, `src/openwearables/providers.py`.
- `src/openwearables/{jobs,history,lifecycle}.py` and small control-plane repository module as needed.
- `src/openwearables/transformers/health_scores.py`.
- `src/api/dependencies/auth.py`, `src/api/routes/{integrations,openwearables_events}.py`.
- New migrations after010 for source-preserving tables/rollups/score schema/compatibility views; never rewrite001–010.
- New contract/history/collision/lifecycle/security tests in existing families and real-database integration suite not using current stubs.

### 15.3 APP existing files

- `src/lib/api/wearablesync-client.ts` and all five `src/app/api/providers/[provider]/.../route.ts` routes.
- `src/components/integrations/types.ts`, `WearableIntegrationsPanel.tsx`, `ProviderCard.tsx`, `ProviderStatusBadge.tsx`, `GenericProviderExpandedPanel.tsx`, `useProviderStatus.ts`.
- `src/hooks/useUserProviders.ts`, `src/components/charts/ChartsContent.tsx`, `LazyChart.tsx`, graph-prefetch/registry hooks.
- `src/lib/dashboard/{readiness-snapshot,user-providers-snapshot}.ts`.
- `src/lib/bodyviz/snapshot-adapter.ts`, `src/app/api/player/bodyviz-snapshot/route.ts`; maintain clinical field separation and add effective health grants, without vendor library edits.
- `src/app/api/ai-agent/wearable-query/route.ts`, `src/lib/ai/tools/wearableInsightTools.ts`, affected health/athlete tool callers.
- Legacy wearable consumers: `src/app/api/dashboard/player/body-data/route.ts`, `src/app/api/parent/children/[childId]/progress-summary/route.ts`, `src/app/api/athletes/[id]/training-load/route.ts`, `src/lib/parent-page-data.ts`, overview/parent UI data adapters.
- `src/app/api/user/{account,export}/route.ts`; `src/lib/auth/auth.ts` consent boundary; `src/lib/api/parent-child-auth.ts` health-specific strict usage/compatibility; `src/app/api/auth/switch-organization/route.ts` health grant/cache invalidation.
- `src/lib/cache/*`, `src/lib/pwa/*` narrowly for scoped invalidation, preserving local edits.
- `messages/{ca,de,en,es,fr,nl,pt,zh}.json`, approved integration assets.
- Existing tests: provider hooks/snapshot, readiness, BodyViz API/adapters, charts, cache/logout.

### 15.4 APP new files

- `src/lib/integrations/{providers,contracts,access-policy}.ts`, generated registry artifact.
- `src/app/api/providers/route.ts`; endpoints under `src/app/api/integrations/` per7.1.
- `MobileProviderPanel.tsx`, scoped consent/history/lifecycle components when reuse cannot express new state.
- New Supabase control-plane/effective-grant migrations/RPC tests; regenerate database types through documented local workflow, not manual broad type edits.
- New OAuth-finish/mobile-token/negative-access/export/erasure/integration-UI tests under existing `tests/` convention.

### 15.5 GRAPH files

- `api/middlewares/auth.py`, new narrow health subject-access dependency.
- `api/routes/{graphs,wearables,summary}.py`: subject auth, provider/data availability, provenance, history/freshness and canonical response.
- `data_processing/base/graph_data_processor.py`: v2 reads/grouping/score semantics/cache keys.
- `data_processing/graphs/health_graphs/{hrv_trends,resting_heart_rate,recovery_score,sleep_duration}.py`, relevant temperature/body/workout consumers identified through contract impact.
- `utils/core/caching.py`, `config/settings.py`: policy/source/generation-aware invalidation/internal call config.
- `tests/test_api/test_graphs.py`, `test_summary_helpers.py`, `tests/test_data_processing/test_graphs/test_provider_aware.py` plus subject/source/lifecycle regression suites.

### 15.6 External source patches

OW `backend/app/api/routes/v1/{oauth,sync_data,sdk_sync,sdk_token,connections,timeseries}.py` as applicable; source/service/schema/repository modules in Section13. Native IOS main/internal types/outbox/anchors; ANDROID `sdk/src/main/kotlin/com/openwearables/health/sdk/{HealthDataProvider,HealthConnectManager,SamsungHealthManager,SyncManager,SecureStorage,UnifiedPayload,OpenWearablesHealthSDK}.kt`, manifest/build files; RN bridge/type/plugin files.

Only patch modules actually needed after selected-version verification. No direct private OW DB access from PPD as a substitute for an API contract.

### 15.7 Documentation impact after implementation approval

Update existing APP wearable/identity architecture, EXT docs architecture/API/data-model, GRAPH engineering docs, portfolio data flows/privacy/threat model and actual remediation backlog. Add proposed accepted decision/test/release records according to governance. New tool configuration belongs in `.devin/`, not compatibility directories. MOBILE repository/catalog/.gitmodules changes require owner authorization; nested BodyViz/Courtviz pins stay unchanged.

## 16. Verification matrix, fixtures and commands

### 16.1 Acceptance IDs

| ID | Observable acceptance |
|---|---|
| OWI-AC-01 |14 paths+XML correctly classified; blocked/roadmap/source-only not reported done |
| OWI-AC-02 |header-only/mismatched/cross-tenant/unassigned requests denied before query/token creation |
| OWI-AC-03 |all-role/minor/guardian/provider-age/consent tests; withdrawal changes ingestion/read/derived access |
| OWI-AC-04 |one OAuth exchange, bound attempt, safe returns, cancel/replay/session failure coverage |
| OWI-AC-05 |maximum permitted history to evidenced floor; >365days/>2,000points; gaps honest/resumable |
| OWI-AC-06 |restart/lease/commit-checkpoint/batch retry safe; no duplicate/lost/resurrected data |
| OWI-AC-07 |source collisions preserved; zero/null, HRV, temperature, score scales, totals/intervals correct |
| OWI-AC-08 |source/native update/delete reflected through OW/EXT/GRAPH/cache; old jobs fenced |
| OWI-AC-09 |provider-only/body-only/SDK-only/multi-provider UI correct, locales/accessibility/states correct |
| OWI-AC-10 |release-signed physical-device/native lifecycle/history permissions; no global secrets |
| OWI-AC-11 |Strava/Fitbit/category restrictions enforced before ingest/AI/derivation, not only UI |
| OWI-AC-12 |complete paginated export and cross-store erasure with durable receipts/restore fences |
| OWI-AC-13 |quotas/retries/dead letters/renewal/lag/storage/lifecycle telemetry verified under load |
| OWI-AC-14 |existing provider APIs/history preserved; new behavior additive/feature-gated; no vendor pin normalization |
| OWI-AC-15 |actual run/release evidence with exact revisions/env/fixtures/outcomes/limitations; source≠passing run |

### 16.2 Synthetic fixtures with numeric expectations

| Fixture | Input | Required assertion |
|---|---|---|
| F01 source collision |same user/time HR60 from Garmin,HR65 from Oura |two source facts; canonical chosen by policy, not latest sync race |
| F02 daily+intraday |selected provider steps daily10000 plus increments summing9800 |canonical10000, never19800; completeness/provenance visible |
| F03 device overlap |phone5000/watch6000 overlapping intervals |not11000; apply explicit interval/source priority |
| F04 Google reconciliation |reconciled2560, separate source2506/1919 |canonical2560 when reconcile selected, no invented device |
| F05 HRV |Apple SDNN45,Whoop RMSSD42 same day |separate method/provider facts and labels; no unlabeled averaged43.5 |
| F06 null/zero |updated calories0, distance null replacing prior10 |0 retained, cleared distance null not resurrected by argMax fallback |
| F07 timestamp error |invalid/missing timestamp in required point |quarantine/count error, no measurement at now |
| F08 temperature |skin33.2°C,core36.8°C,deviation-0.3°C |three semantics, not one temperature series |
| F09 Withings scaling |raw height value180×10^-2 m normalized180cm |PPD180cm, not18000cm; test scaling exactly once |
| F10 strain scales |Whoop strain15,Polar readiness7,recovery4 |preserve0–21/0–10/1–6; no universal percent |
| F11 long timeseries |2501 ordered samples over multiple pages |all2501 persisted; no2000 cap; restart at page boundary safe |
| F12 sparse history |valid2020 record,empty2021–2023,recent2024 |empty gap doesn't stop traversal before2020 |
| F13 record update |existing workout duration3600→3500/name corrected |same identity latest updated; no duplicate and no skip-known |
| F14 cross-month correction |workout start shiftsJan31→Feb1 |one current event, no two-partition duplicate |
| F15 Oura deletion |sleep source object with score+HR-derived samples |only object's dependent facts removed/recomputed, other source remains |
| F16 Google delete interval |complete snapshot missing one previousID; separate simulated failed fetch |delete missingID only on complete authoritative snapshot; failed fetch deletes none |
| F17 native timestamp tie |more native records than page size with equal time |all IDs drained via token/stable pagination, no timestamp+1 loss |
| F18 Health Connect late update |old workout modified after cursor |Changes API/reconcile captures it without lifetime reset |
| F19 upload worker failure |202 accepted then worker crash |durable server replay commits without native losing data |
| F20 dropped SDK record |99valid+1invalid, worker returns2xx |partial99 committed/1rejected visible, not100 complete |
| F21 stale generation |paused generation2 receives upload/job generation1 |rejected/cancelled; no new facts |
| F22 user/provider switch |queued userA/apple body followed by loginB/google |never sent usingB credentials; isolated state namespace |
| F23 role/grant |same-org unassigned coach,unapproved parent,withdrawn grant |all denied; no cached prior data |
| F24 body-only |Withings scale record,no workouts/sleep |provider detected; weight view, no misleading connect/no-data blanket |
| F25 shadow policy |Strava synthetic data mixed with allowed provider |no Strava value/derivative reaches AI/coaching/canonical normal pipeline |
| F26 export |more than default page size in every stream |complete count/coverage, credentials absent |
| F27 erasure/retry |account auth removed while OW outage and history queued |durable lifecycle persists, resumes, fences jobs, returns pending until complete |
| F28 midnight/DST |23h/25h local day,UTC boundary,fractional timestamp |each point assigned once by documented range/local-date policy |
| F29 provider null |OW point source=null in multi-provider user |unknown/quarantine, not loop-provider/garmin guess |
| F30 SDK range widen |limited initial export then max-history request |stopped safe reset or targeted history extension, older data actually included |

### 16.3 Test layers

**Unit/contract:** registry parity, exact client endpoints/query shapes, schemas/null/units, mapping/attempt logic, type-specific pagination, job state transitions, permission decisions, invalid/no-store/redaction responses.

**Local integration:** real Supabase policy/RPC transaction tests, ClickHouse keys/upserts/partition/tombstones, OW pinned API contracts, job lease race/crash/replay, proxy route ownership, Svix signature/replay/chunk fixtures.

**End to end:** consenting provider accounts and physical native devices; compare representative vendor app/export values; prove pipeline stages separately and test all roles/withdrawals.

**Load/recovery:** dense multi-year history, quota429, provider outage, broker/storage/ClickHouse failures, worker kill at each boundary, schema rollback/read flags, backup restore with deletion fences.

### 16.4 Existing test commands — only after implementation approval

No application tests/builds were run for this research. Run repositories independently.

EXT CI Python3.12:

- `python -m pytest tests/openwearables tests/scheduler/test_multi_user_scheduler.py -v --tb=short`
- `python -m pytest tests/database tests/auth -v --tb=short`
- `python -m pytest -v --tb=short`
- `ruff check .` (declared CI tooling; use approved pinned dev install)

EXT `tests/conftest.py` injects ClickHouse/Garmin/schedule stubs. Passing those tests is **not** database migration/scheduler integration proof. Add separate real-service suite/config that avoids stubs. Existing Whoop skip-timeseries assertion is stale; reproduce baseline before changing it.

GRAPH CI Python3.11:

- `python -m pytest tests/test_api/test_graphs.py tests/test_api/test_summary_helpers.py tests/test_data_processing/test_graphs/test_provider_aware.py -v --tb=short`
- new subject/source/score/lifecycle suites, then `python -m pytest -v --tb=short`
- `ruff check .`

APP pnpm9.15.0:

- `pnpm lint`
- `pnpm typecheck`
- `pnpm exec vitest run tests/hooks/useUserProviders.test.ts tests/lib/user-providers-snapshot.test.ts`
- `pnpm exec vitest run` including new integration/API/consent/readiness/BodyViz tests
- `pnpm run check:i18n` and existing namespace checks
- `pnpm build` only in separately approved implementation verification, honoring vendor-stub setup; not documentation work

Current APP test script is Vitest watch, despite stale rule calling it Jest. Use vitest run. Baseline lint/Next15 command compatibility and existing repo-wide failures; never bypass security/lint controls for green output.

OW0.8.0 requires Python>=3.13 and uv, independent of EXT/GRAPH. Declared Makefile test target runs `cd backend && uv run pytest -v --cov=app`; after approved environment setup, run targeted upstream regression suites and full declared test target. `backend/pyproject.toml` defines ruff/ty/dev groups. Use frozen lock/dependency verification. No production DB reset/seed/downgrade commands as tests.

MOBILE/native commands become concrete after scaffold/spike. Native Android source declares Gradle test/build/publish tasks; RN package declares expo-module build/lint/test. Capture the actual selected commands and artifacts after dependencies/platform target verified. JavaScript unit tests don't replace signed iOS/Android device tests.

Documentation-only validation after approved doc impact: portfolio `node .devin/docs-tooling/src/cli.mjs check --repo .` and `node .devin/docs-tooling/src/cli.mjs catalog --repo . --check`. Structural checks don't establish runtime/legal compliance.

### 16.5 Manual end-to-end release checklist per provider

1. Confirm approved app tier/test subject/roles/relationships/consent and actual device/source history.
2. Connect via PPD; verify exact mapping/grant, one denied optional scope and truthful state.
3. Recent data visible while old history progresses; verify oldest floor/gaps/remaining windows.
4. Compare sample workout/sleep/HRV/body/score semantics with vendor app/export.
5. Create new device data; record vendor→OW time and OW→PPD mirror separately.
6. Update/delete source record; replay event; verify source and derived cleanup.
7. Interrupt worker/network mid-history; resume without duplicates/loss.
8. Test self/coach/parent/admin and denied unrelated/unassigned/revoked-grant actors; all-role policy before launch.
9. Disconnect/reconnect/export/explicitly confirmed erasure; stale jobs/tokens cannot resurrect data.
10. Attach sanitized command/manual evidence, exact revisions/config names and limitations, then owner authorizes provider flag.

## 17. Routing, configuration and operator worksheets

### 17.1 Route ownership acceptance table

Existing origins in source: api.wearablesync.app and webhooks.wearablesync.app. Deployed DNS/TLS/ownership not verified. Owner supplies actual OW_PUBLIC_BASE/PPD_APP_PUBLIC_BASE and private service origins.

| Path family | Owner | Verification |
|---|---|---|
| `/api/v1/oauth/{provider}/authorize|callback` | OW | exact callback and post-OAuth return separated |
| `/api/v1/providers/{provider}/webhooks` GET/HEAD/POST | OW | correct challenge/probe/body verifier |
| `/api/v1/providers/{provider}/webhooks/subscriptions...` | OW developer-only | not intercepted by PPD generic routes |
| `/api/v1/providers/{provider}/users/{id}/sync...` | OW API-key | current+new bounded history paths |
| PPD `/api/v1/providers/{provider}/account[/status]`, `/oauth/...`, `/sync/trigger` | EXT exact/narrow routes | compatibility path with new auth/gates |
| `/api/v1/integrations/...` | EXT | new unambiguous control APIs |
| `/api/v1/sdk/users/{id}/sync` and SDK auth/log paths | OW policy-controlled ingress | user/provider/generation/category checks |
| `/api/v1/users/{id}/import/apple/xml/...` | OW | server-auth initiated scoped object operations |
| `/webhooks/openwearables` | EXT | raw-body Svix verifier and durable intake |
| `/api/v1/garmin-connect...` | EXT | existing compatibility preserved |
| old vendor-specific webhook aliases | OW only if actual pinned router supports | temporary migration compatibility, not guessed |

No global wildcard change that accidentally routes all providers paths to one service. Test signed bodies aren't modified by proxy. Restrict admin/auth/debug endpoints separately from public provider callbacks and mobile upload.

### 17.2 Configuration ownership

| Component | Values to configure, not secret contents |
|---|---|
| OW API/worker | API_BASE_URL, frontend/CORS origins, provider client IDs/secrets/scopes, SDK app credential registration, private DB/Redis, raw storage policy, outgoing Svix settings |
| EXT | OPENWEARABLES_API_URL private, OPENWEARABLES_API_KEY server-only, CLICKHOUSE_OW_DATABASE, trusted PPD auth/service configuration, Supabase control RPC access, Svix endpoint verification secret, job limits/feature flags |
| GRAPH | internal service auth, canonical table/reader flags, subject authorization dependencies, cache policy/version |
| APP | EXT/GRAPH server URLs and server auth, approved public app base, registry artifact/version; no provider/OW secret in NEXT_PUBLIC fields |
| MOBILE | approved public PPD/OW origins and public identity client config; user-scoped tokens delivered at runtime only |
| Proxy/storage | verified DNS/TLS, route priorities, body limits, request timeouts, log redaction, bucket CORS/encryption/lifecycle and private admin access |

Proposed server-side flags (names finalized in implementation): registry rollout/provider availability, durable jobs, v2 mirror/read, source-policy version, maximum-history jobs, SDK ingestion methods, clinical-category gates, Strava approval status. Flags that protect privacy must default deny and cannot be changed by browser query/body. Existing PROVIDER_AWARE_HRV/RESTING_HR and AUTO_ROLLUP_ON_SYNC are compatibility inputs, not permanent substitutes for new correctness.

### 17.3 Inbound authentication reference

| Provider | Format / auth verified in source/docs |
|---|---|
| Garmin | current OW verifies configured client-ID header; verify provider endpoint-specific scheme and payload limits |
| Polar | HMAC signing secret from subscription registration; PING handshake |
| Whoop | raw body+timestamp-ms, HMAC-SHA256/client secret/base64,5-minute tolerance |
| Oura | timestamp+raw body HMAC-SHA256/client secret/hex, GET verification token challenge; replay tolerance must be reviewed, not assumed from HMAC alone |
| Suunto | X-HMAC-SHA256-Signature over body, dedicated webhook secret |
| Withings | token query + userid-bearing form body; HEAD token probe; no cryptographic body signature claim |
| Google | echoed dedicated bearer secret; authenticated/unauthenticated verification probes; asymmetric verification not implemented in inspected handler |
| Strava | challenge verify token; verify selected release POST authentication behavior and negotiated requirements; gated before any real data |
| OW→PPD | Svix raw-body verifier with messageID/timestamp/signature; durable idempotency |

### 17.4 Retention approval worksheet

Owner/legal must fill concrete duration and deletion behavior before real-data release:

- Core raw health facts and vendor event payloads.
- Canonical summaries/rollups and proprietary/internal scores.
- Clinical/reproductive/location/nutrition categories if later approved.
- OW PostgreSQL hot/archive stores and raw JSON/FIT/XML/S3 offload.
- ClickHouse v1 rollback copies and v2 facts.
- SDK outbox/local state, object multipart fragments, export files.
- Svix messages/delivery bodies, job/receipt/history/audit records.
- AI prompts/conversations/memories/reports/derived features and authorized recipients.
- Backups/logs/support evidence, legal retention exceptions and erasure replay rules.

For each: purpose, category, provider restriction, retention start event, duration, erasure mechanism, verification query/procedure, owner and approval reference. No indefinite default silently inserted.

## 18. Rollout, rollback, support and approval gates

### 18.1 Release gates

R0: accepted intent/ADRs/all-role/retention policies and preserved dirty work baseline.
R1: installed-version inventory, staging restore, pinned dependencies and routing contract.
R2: subject/consent/control-plane negative tests, no header-only access.
R3: v2 schema/replay/current-row semantics, long-history durability and lifecycle convergence.
R4: provider approval/scopes/quota/subscription/device fixtures and upstream fixes.
R5: all consumer/role/purpose/export/erasure tests, policy filters and actual evidence.
R6: mobile signing/store/partnership/permission/native change tests for mobile paths.
R7: owner authorizes actual deploy/flag/cohort; no automatic commit/push/deploy.

### 18.2 Rollout procedure

1. Pause new provider connections; keep existing service behavior until backward-compatible readers/control installed.
2. Apply approved additive migrations in staging then controlled production window with separate authorization.
3. Deploy control/EXT worker and narrow routes; verify protected endpoints and queue lease ownership.
4. Deploy reviewed OW exact images/patches and proper queues; verify only one Beat/scheduler role and needed SDK/XML/webhook workers.
5. Deploy GRAPH compatibility readers and APP registry/status/consent UX; shadow compare existing provider users.
6. Enable v2 and provider canary after all-role test gate; monitor semantic metrics and actual data age.
7. Enable maximum-history jobs with quotas/live reserve; don't fan out all users' lifetime imports at once.
8. Release companion through test distribution then approved store tracks; Samsung direct remains off until partner signature accepted.
9. Expand providers independently per approval readiness. Retain explicit blocked statuses for Strava/Sensor Bio/Samsung-direct if prerequisites unresolved.
10. Write release evidence and doc impact; no claim of completeness for intentionally disabled/blocked providers.

### 18.3 Rollback procedure

- Stop new connections/backfills for affected provider/method; keep deletion/consent enforcement active.
- Pause/fence jobs; preserve cursors/receipts/facts and diagnose source vs mirror failure.
- Revert reader/canonical policy flag or compatible app/worker version; old schema remains available during approved transition.
- Don't restore OW DB to older state over newer user grants/data without explicit plan; migrations may not support binary downgrade.
- Don't delete subscriptions shared by other environments/users or revoke provider application credentials globally to solve one-user issue.
- Reconcile missed intervals after fix; replay idempotently; verify deleted data stays deleted.
- Destructive SQL/file deletion/force Git history/provider side-effect actions require separate specific approval.

### 18.4 Support runbook triage

| Symptom | First checks | Safe response |
|---|---|---|
| connected/no data | grant scopes, source device sync, OW run, PPD mirror/history coverage | show awaiting/partial; don't reconnect blindly |
| provider401 | distinguish token expiry vs revoked grant vs PPD auth | one coordinated refresh; re-consent if terminal |
|429/backfill stalls | actual provider headers/budget/live reserve | defer window, retain cursor, lower concurrency |
| charts stale | OW committed? EXT commit? canonical version? auth cache invalidation? | scoped refresh after successful writes |
| duplicate daily totals | source identity/is_daily_total/Google reconcile/bridge | repair canonical policy, don't delete raw sources blindly |
| missing old history | floor evidence/provider cap/history permission/native anchor state | explicit gap/resume, never call empty month end-of-history |
| device sent100%,server partial | batch receipts/dropped_count/worker payload retention | replay server intake, report partial |
| deletion not reflected | source handler ignored? tombstone ledger? stale generation/cache? | prioritize lifecycle job; keep access blocked |
| Samsung unavailable | partner package/release cert/device/version/permission | keep disabled; no end-user developer mode |
| Google method conflict | one upstream connection, SDK tokens vs OAuth state | pause switch and reconcile; no combined purge without confirmation |

### 18.5 Owner decisions/actions still required

- Approve this plan and separate implementation work packages.
- Approve MOBILE repository/remote and whether to maintain small OW/native forks while upstream changes pending.
- Confirm production/staging origins, deployed OW version/patches/schema and access for sanitized inventory.
- Verify existing four credentials/production approvals and obtain new provider access.
- Approve category/purpose/age/guardian/organization-history policies and retention durations.
- Complete Google OAuth/CASA and budget assessment; Samsung partnership/store signing; Oura scale review as applicable; Ultrahuman/Sensor Bio access verification.
- Seek Strava written permission; keep disabled if absent.
- Supply consenting test subjects/devices and approval references, not secret values.
- Authorize migrations/deployments/provider portal changes/app-store publication individually when readiness evidence exists.

## 19. Source index and research limitations

### Core upstream source/release

- [Open Wearables](https://openwearables.io/), [marketing integrations](https://openwearables.io/integrations/).
- [Supported setup catalog](https://openwearables.io/docs/providers/supported.md), [coverage](https://openwearables.io/docs/providers/coverage.md), [historical availability](https://openwearables.io/docs/providers/historical-data.md).
- [0.8.0 release](https://github.com/the-momentum/open-wearables/releases/tag/0.8.0), [exact commit](https://github.com/the-momentum/open-wearables/commit/53de57cade876df104720c0c5be07bbf462a55b1).
- [Provider factory](https://github.com/the-momentum/open-wearables/blob/0.8.0/backend/app/services/providers/factory.py), [enum](https://github.com/the-momentum/open-wearables/blob/0.8.0/backend/app/schemas/enums/provider.py), [settings](https://github.com/the-momentum/open-wearables/blob/0.8.0/backend/app/config.py).
- [OAuth router](https://github.com/the-momentum/open-wearables/blob/0.8.0/backend/app/api/routes/v1/oauth.py), [sync router](https://github.com/the-momentum/open-wearables/blob/0.8.0/backend/app/api/routes/v1/sync_data.py), [sync worker](https://github.com/the-momentum/open-wearables/blob/0.8.0/backend/app/integrations/celery/tasks/sync_vendor_data_task.py).
- [Timeseries query](https://github.com/the-momentum/open-wearables/blob/0.8.0/backend/app/repositories/data_point_series_repository.py), [response mapping](https://github.com/the-momentum/open-wearables/blob/0.8.0/backend/app/services/timeseries_service.py), [score scales](https://github.com/the-momentum/open-wearables/blob/0.8.0/backend/app/constants/health_scores.py).
- [Outgoing events](https://github.com/the-momentum/open-wearables/blob/0.8.0/backend/app/services/outgoing_webhooks/events.py), [connection lifecycle](https://github.com/the-momentum/open-wearables/blob/0.8.0/backend/app/api/routes/v1/connections.py).
- [SDK intake](https://github.com/the-momentum/open-wearables/blob/0.8.0/backend/app/api/routes/v1/sdk_sync.py), [SDK worker](https://github.com/the-momentum/open-wearables/blob/0.8.0/backend/app/integrations/celery/tasks/process_sdk_upload_task.py), [token route](https://github.com/the-momentum/open-wearables/blob/0.8.0/backend/app/api/routes/v1/sdk_token.py), [SDK payload schema](https://github.com/the-momentum/open-wearables/blob/0.8.0/backend/app/schemas/providers/mobile_sdk/sync_request.py).

Provider mappings are in same-release `backend/app/services/providers/{provider}/{coverage,strategy,data_247,workouts,oauth,webhook_handler}.py` as applicable. Do not mix current main docs with a different release's behavior.

### Provider setup / first-party requirements

- [Oura OW guide](https://openwearables.io/docs/providers/oura-api-integration.md), [Oura official older API/application docs](https://cloud.ouraring.com/docs/), [Oura delete handler](https://github.com/the-momentum/open-wearables/blob/0.8.0/backend/app/services/providers/oura/webhook_handler.py).
- [Withings OW guide](https://openwearables.io/docs/providers/withings-api-integration.md), [official public API guide](https://developer.withings.com/developer-guide/v3/integration-guide/public-health-data-api/public-health-data-api-overview/), [Withings coverage/deferred types](https://github.com/the-momentum/open-wearables/blob/0.8.0/backend/app/services/providers/withings/coverage.py).
- [Ultrahuman OW guide](https://openwearables.io/docs/providers/ultrahuman-api-integration.md), [public vendor docs](https://vision.ultrahuman.com/developer-docs).
- [Google OW guide](https://openwearables.io/docs/providers/google-api-integration.md), [Google overview/Fitbit sunset](https://developers.google.com/health/about), [Cloud/OAuth setup](https://developers.google.com/health/setup), [verification/CASA](https://developers.google.com/health/app-verification), [webhooks](https://developers.google.com/health/webhooks), [Health IAM roles](https://docs.cloud.google.com/iam/docs/roles-permissions/health), [current Google webhook handler](https://github.com/the-momentum/open-wearables/blob/0.8.0/backend/app/services/providers/google/health_api/webhook_handler.py).
- [Fitbit legacy guide](https://openwearables.io/docs/providers/fitbit-api-integration.md).
- [Sensor Bio portal](https://developers.sensorbio.com/), [callback source](https://github.com/the-momentum/open-wearables/blob/0.8.0/backend/app/services/providers/sensorbio/oauth.py), [coverage](https://github.com/the-momentum/open-wearables/blob/0.8.0/backend/app/services/providers/sensorbio/coverage.py).
- [Strava OW guide](https://openwearables.io/docs/providers/strava-api-integration.md), [API agreement](https://www.strava.com/legal/api), [API policy](https://www.strava.com/legal/api_policy), [rate limits/capacity](https://developers.strava.com/docs/rate-limits/).
- [Garmin guide](https://openwearables.io/docs/providers/garmin-api-integration.md), [backfill source](https://github.com/the-momentum/open-wearables/blob/0.8.0/backend/app/services/providers/garmin/backfill_config.py), [Polar guide](https://openwearables.io/docs/providers/polar-api-integration.md), [Whoop guide](https://openwearables.io/docs/providers/whoop-api-integration.md), [Suunto guide](https://openwearables.io/docs/providers/suunto-api-integration.md).

### Native SDKs / infrastructure

- [OW beta app](https://openwearables.io/docs/app/introduction.md), [RN docs](https://openwearables.io/docs/sdk/react-native/index.md), [RN integration](https://openwearables.io/docs/sdk/react-native/integration.md).
- [Pinned RN source](https://github.com/the-momentum/open-wearables-react-native-sdk/tree/339bd95f708fa3ef3682a98e70c106a0f82ec184), [0.2.0 README lifecycle corrections](https://github.com/the-momentum/open-wearables-react-native-sdk/blob/339bd95f708fa3ef3682a98e70c106a0f82ec184/README.md).
- [iOS0.14.0 source](https://github.com/the-momentum/open_wearables_ios_sdk/tree/0.14.0), [Androidv0.11.2 source](https://github.com/the-momentum/open_wearables_android_sdk/tree/v0.11.2).
- [Flutter docs](https://openwearables.io/docs/sdk/flutter/index.md), [iOS docs](https://openwearables.io/docs/sdk/ios/index.md), [Android docs](https://openwearables.io/docs/sdk/android/index.md).
- [Health Connect permission reference](https://developer.android.com/reference/kotlin/androidx/health/connect/client/permission/HealthPermission), [publishing](https://developer.android.com/health-and-fitness/health-connect/publish), [Samsung official developer-mode restriction](https://developer.samsung.com/health/data/guide/developer-mode.html).
- [Apple XML import](https://openwearables.io/docs/api-reference/guides/apple-xml-import.md), [outgoing webhooks](https://openwearables.io/docs/api-reference/guides/webhooks.md), [provider subscriptions](https://openwearables.io/docs/api-reference/guides/provider-webhook-subscriptions.md), [sync lifecycle](https://openwearables.io/docs/api-reference/guides/sync-status-stream.md).
- [Production Docker](https://openwearables.io/docs/deployment/docker.md), [provider settings](https://openwearables.io/docs/developer-portal/settings/providers.md), [priorities](https://openwearables.io/docs/developer-portal/settings/priorities.md), [health scores](https://openwearables.io/docs/api-reference/external:-health-scores/list-health-scores.md), [recovery limitations](https://openwearables.io/docs/api-reference/external:-summaries/get-recovery-summary.md).

### Limitations and final definition of research completion

Oura v2 docs rendered empty and partner support page403; Sensor Bio reference failed to load; restricted provider dashboards were not accessed. Account-specific commercial rights, quota tiers, oldest data, production deployment state, exact native behavior and store approval are not inferred from code or marketing.

All provider requirements above are either source-backed observed facts, cited documentation, proposed designs or explicit manual validation gates. Public docs can change; revalidate at implementation/release. The SDK/source defects are static findings requiring regression reproduction, not claims that live user data loss was observed.

Research is complete when this inventory, proposed contracts/work packages, manual gates, source links and verification strategy have been reviewed. **Implementation is complete only provider-by-provider when actual evidence meets OWI-AC-01 through15 and daniel authorizes release.** No blocked, sunset, roadmap or unsupported category is silently relabeled as integrated.
