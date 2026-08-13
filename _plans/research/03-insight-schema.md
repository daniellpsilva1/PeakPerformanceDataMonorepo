# 03 — Structured Insight Schema (Agent ↔ Product Contract)

**Status:** Read-only research dossier  
**Date:** 2026-08-02  
**Canonical definition:** `PeakPerformanceData/ppp_ai_agent/schemas/insight.py`  
**Package export:** `PeakPerformanceData/ppp_ai_agent/schemas/__init__.py` is **empty** (0 bytes) — consumers import `from schemas.insight import ...` directly.

---

## 1. Schema inventory (exact)

Source: `PeakPerformanceData/ppp_ai_agent/schemas/insight.py` (lines 1–82).

### 1.1 Design intent (module docstring, L1–12)

- `claim`: single declarative sentence the athlete/coach sees  
- `evidence[]`: metric chips with source citations (no hallucinated numbers)  
- `confidence`: model’s self-assessed confidence level  
- `actions[]`: concrete CTAs, gated by `requires_coach_review`  
- `requires_coach_review`: if True, card goes to coach inbox, not athlete DM  

### 1.2 `ConfidenceLevel` (`str, Enum`) — L20–23

| Member | Value |
|--------|-------|
| `HIGH` | `"high"` |
| `MEDIUM` | `"medium"` |
| `LOW` | `"low"` |

### 1.3 `InsightCategory` (`str, Enum`) — L26–37

| Member | Value |
|--------|-------|
| `RECOVERY` | `"recovery"` |
| `TRAINING_LOAD` | `"training_load"` |
| `SLEEP` | `"sleep"` |
| `NUTRITION` | `"nutrition"` |
| `INJURY_RISK` | `"injury_risk"` |
| `PERFORMANCE` | `"performance"` |
| `WEARABLE` | `"wearable"` |
| `LABS` | `"labs"` |
| `GENETICS` | `"genetics"` |
| `COMPETITION` | `"competition"` |
| `GENERAL` | `"general"` |

### 1.4 `EvidenceChip` (`BaseModel`) — L40–47

| Field | Type | Required / default | Description |
|-------|------|--------------------|-------------|
| `metric` | `str` | required (`...`) | Metric name (e.g. HRV, ACWR) |
| `source` | `str` | required (`...`) | Free-text data source (e.g. `"ClickHouse ow_sleep_summaries"`) |
| `unit` | `Optional[str]` | default `None` | Unit of measurement |
| `value` | `Optional[float]` | default `None` | Current value |
| `trend` | `Optional[str]` | default `None` | Docstring suggests `'up' \| 'down' \| 'stable'` — **not enforced as enum** |
| `timestamp` | `Optional[str]` | default `None` | ISO timestamp of the data point |

**Validators:** none (`model_validator` / `field_validator` / `ConfigDict` absent).

### 1.5 `InsightAction` (`BaseModel`) — L50–55

| Field | Type | Required / default | Description |
|-------|------|--------------------|-------------|
| `action_type` | `str` | required | Free-text type (e.g. `adjust_load`) |
| `description` | `str` | required | Human-readable action |
| `priority` | `str` | default `"medium"` | Docstring suggests `'low' \| 'medium' \| 'high'` — **not enforced as enum** |
| `requires_coach_approval` | `bool` | default `False` | Action-level coach gate (distinct from insight-level review) |

**Validators:** none.

### 1.6 `Insight` (`BaseModel`) — L58–82

| Field | Type | Required / default | Description |
|-------|------|--------------------|-------------|
| `id` | `Optional[str]` | default `None` | Unique ID (assigned on storage) |
| `athlete_id` | `str` | required | Athlete user ID |
| `organization_id` | `str` | required | Org scoping |
| `claim` | `str` | required | Single declarative sentence |
| `category` | `InsightCategory` | default `InsightCategory.GENERAL` | Routing / UI |
| `confidence` | `ConfidenceLevel` | default `ConfidenceLevel.MEDIUM` | Model confidence |
| `evidence` | `List[EvidenceChip]` | `default_factory=list` | Metric citations |
| `actions` | `List[InsightAction]` | `default_factory=list` | CTAs |
| `requires_coach_review` | `bool` | default `False` | Coach inbox before athlete |
| `coach_id` | `Optional[str]` | default `None` | Assigned coach for review |
| `created_at` | `Optional[str]` | default `None` | ISO timestamp (assigned on creation) |
| `source` | `str` | default `"orchestrator"` | Producer name (specialist / mode) |
| `trigger` | `str` | default `"chat"` | Docstring: `'chat' \| 'nightly' \| 'event'` — **not enforced as enum** |

**Validators:** none. Invalid enum strings for `confidence` / `category` fail via Pydantic enum coercion (covered in tests).

### 1.7 Unit tests — `tests/test_insight_schema.py`

| Class | Coverage |
|-------|----------|
| `TestEvidenceChip` | minimal + full chip; defaults for optional fields |
| `TestInsightAction` | defaults (`priority=medium`, `requires_coach_approval=False`); high-priority + coach approval |
| `TestInsight` | minimal defaults; full evidence/actions; `ValidationError` on missing `organization_id`/`claim`; invalid confidence/category |

Related: `tests/test_eval.py` (`TestSchemaValidation`), `tests/test_cgm_specialist.py`, `eval/harness.py` (`make_test_insight`, `check_faithfulness`).

---

## 2. Serialization

There is **no** shared `Insight.model_dump()` / JSON Schema export used as the wire format. Producers **manually project** fields into a Supabase REST body:

```python
{
  "athlete_id": insight.athlete_id,
  "organization_id": insight.organization_id,
  "coach_id": insight.coach_id,
  "claim": insight.claim,
  "category": insight.category.value,      # enum → str
  "confidence": insight.confidence.value,  # enum → str
  "evidence": [e.model_dump() for e in insight.evidence],
  "actions": [a.model_dump() for a in insight.actions],
  "requires_coach_review": insight.requires_coach_review,
  "source": insight.source,
  "trigger": insight.trigger,
}
```

Locations:

| File | Lines | Notes |
|------|-------|-------|
| `ppp_ai_agent/agent/nightly_batch.py` | `store_insight` L167–186 | Primary persist helper |
| `ppp_ai_agent/api/routes/insights.py` | L84–96 | Lab ingest event hook |

Transport: `tools/db.py` `supabase_rpc()` → `POST {SUPABASE_URL}/rest/v1/insights` with service key.

**Not serialized from the Pydantic model at write time:**

- `id` — DB `gen_random_uuid()`
- `created_at` — DB `NOW()` (producers never set `Insight.created_at`)
- `coach_review_status` — **DB-only** (not on Pydantic `Insight`)
- `updated_at` — **DB-only**

Read path returns raw Supabase JSON (not re-validated into `Insight`):

- `GET /insights` select list: L123 in `api/routes/insights.py`  
  includes `coach_review_status` + `created_at`
- `GET /insights/{id}` select `*`

---

## 3. Persistence (Supabase)

### 3.1 Migration

**File:** `PeakPerformanceData/peak_performance_data/supabase/migrations/20260727_insight_store.sql`

#### Table `insights` (L12–32)

| Column | SQL type | Default / notes |
|--------|----------|-----------------|
| `id` | `UUID PK` | `gen_random_uuid()` |
| `athlete_id` | `UUID` → `auth.users` | `NOT NULL` |
| `organization_id` | `UUID` → `organizations` | `NOT NULL` |
| `coach_id` | `UUID` → `auth.users` | nullable |
| `claim` | `TEXT` | `NOT NULL` |
| `category` | `TEXT` | `DEFAULT 'general'` — **no CHECK vs enum** |
| `confidence` | `TEXT` | `DEFAULT 'medium'` — **no CHECK vs enum** |
| `evidence` | `JSONB` | `DEFAULT '[]'` |
| `actions` | `JSONB` | `DEFAULT '[]'` |
| `requires_coach_review` | `BOOLEAN` | `DEFAULT FALSE` |
| `coach_review_status` | `TEXT` | `NULL` — not on Pydantic model |
| `source` | `TEXT` | `DEFAULT 'orchestrator'` |
| `trigger` | `TEXT` | `DEFAULT 'chat'` |
| `created_at` | `TIMESTAMPTZ` | `DEFAULT NOW()` |
| `updated_at` | `TIMESTAMPTZ` | `DEFAULT NOW()` + trigger L215–218 |

Indexes: athlete, org, coach, review_status (partial), created_at DESC (L34–38).  
RLS: athlete SELECT own; coaches via `coach_id` or `coach_player_assignments`; admins/org; service INSERT; coach/admin UPDATE (L40–83).

#### Related tables (same migration)

| Table | Purpose | Key columns |
|-------|---------|-------------|
| `feedback_events` | Thumbs / flag on insight or chat | `insight_id`, `conversation_id`, `feedback_type` CHECK, `reason_codes` |
| `coach_reviews` | Approve / edit / reject | `action` CHECK, `edited_claim`, `edited_actions` JSONB |
| `preference_memory` | Preference extraction from feedback | `preference_type` CHECK including `language` |

### 3.2 Generated TypeScript DB types

`insights` / `coach_reviews` / `feedback_events` / `preference_memory` do **not** appear in:

- `src/lib/supabase/database.types.ts`
- `src/lib/supabase/types.ts`

→ Migration exists in repo; client types not regenerated (or table not applied to the typed project).

### 3.3 `ppd_backend`

No production/consumption of this Pydantic schema. Mentions of “insights” are Garmin chart metadata / notebooks / docs only.

---

## 4. Producers (where `Insight` is built)

| Producer | Path | `source` | `trigger` | Persist? |
|----------|------|----------|-----------|----------|
| Nightly athlete brief | `agent/nightly_batch.py` `generate_athlete_brief` L58–164, `store_insight` L167–186, `run_nightly_batch` L189–229 | `"nightly_batch"` | `"nightly"` | Yes via `store_insight` |
| Biomarker / panel landed | `agent/biomarker_specialist.py` `generate_panel_landed_insight` + `_build_fallback_insight` | `"biomarker_specialist"` | `"event"` | Yes via event hook POST in `api/routes/insights.py` L69–99 |
| CGM nightly | `agent/cgm_specialist.py` `generate_cgm_nightly_insight` + fallback | `"cgm_specialist"` | `"nightly"` | **Built only** — no call site stores it in nightly_batch yet |
| Eval harness | `eval/harness.py` `make_test_insight` L21–52 | default `"orchestrator"` | default `"chat"` | Test-only |
| Unit tests | `tests/test_insight_schema.py`, `tests/test_cgm_specialist.py`, `tests/test_eval.py` | — | — | — |

**API surface (`api/routes/insights.py`):**

| Endpoint | Role |
|----------|------|
| `POST /batch/nightly` | Trigger batch |
| `POST /events/hook` | Event-driven generation (only `lab_ingest` implemented) |
| `GET /insights`, `GET /insights/{id}` | List / get |
| `POST /insights/{insight_id}/review` | Coach review → updates `coach_review_status` + inserts `coach_reviews` |
| `POST /feedback` | Inserts `feedback_events` |

Router mounted in `api/main.py` L45.

**Not produced as this schema:** genetics tools, tennis tools, interactive chat structured payload (plan mentions chat; no chat→`Insight` builder found).

---

## 5. Consumers (Next.js product UI)

### 5.1 Near-mirror of the contract (hand-written TS, not Zod)

**`src/components/insights/InsightCard.tsx` L16–41 — `InsightData`:**

```ts
export interface InsightData {
  id: string;
  athlete_id: string;
  athlete_name?: string;           // UI-only; not in Pydantic/DB
  claim: string;
  category: string;                // not InsightCategory enum
  confidence: 'high' | 'medium' | 'low';
  evidence: Array<{ metric; source; value?; unit?; trend? }>;  // no timestamp
  actions: Array<{ action_type; description; priority; requires_coach_approval? }>;
  requires_coach_review: boolean;
  coach_review_status?: string | null;  // DB/API only; not on Pydantic Insight
  source: string;
  trigger: string;
  created_at: string;              // required in UI; optional on Pydantic
}
```

UI category icons (L57–67) cover: `general`, `injury_risk`, `labs`, `nutrition`, `performance`, `recovery`, `sleep`, `training_load`, `wearable` — **missing** `genetics`, `competition`.

### 5.2 UI / BFF wiring

| Path | Role |
|------|------|
| `src/components/insights/CoachInbox.tsx` | Fetches `/api/ai-agent/insights`, review + feedback |
| `src/components/insights/InsightStrip.tsx` | Athlete strip; fetches `/api/ai-agent/proxy` (likely wrong list path); **no import sites found** |
| `src/app/[locale]/coach/insights/page.tsx` | Renders `CoachInbox` |
| `src/app/api/ai-agent/insights/route.ts` | BFF → `{PPP_AI_AGENT_URL}/insights` |
| `src/app/api/ai-agent/insights/[insightId]/review/route.ts` | BFF → review |
| `src/app/api/ai-agent/feedback/route.ts` | BFF → `/feedback` |

**No Zod schema** under `src/components/insights` or `src/app/api/ai-agent` for this contract.

### 5.3 Divergent “Insight” types (same name, different contracts)

These are **not** the agent artifact and must not be confused with it:

| Location | Shape |
|----------|-------|
| `src/lib/ai/tools/analyticsTools.ts` L92–98 | `{ action?, category: attendance\|performance\|training_volume, level, message, value? }` — heuristic coach analytics |
| `src/components/tennis-analytics/TennisAnalyticsInsightsTab.tsx` L39–49 | `{ title, action, data, detail, severity, key?, metric? }` — client-side tennis rules |
| `src/components/charts/enhanced/types.ts` L13–21 `ChartInsight` | Chart badge annotations |
| `src/components/charts/GarminConnectGraphs/GraphContainerRecharts.tsx` L672+ `InsightChip` | Wearable graph metadata chips |
| Garmin `/data/insights` + `wearablesync-client.ts` | WearableSync API, unrelated |

---

## 6. Capability matrix (sophisticated multi-agent needs)

| Capability | Supported? | Notes |
|------------|------------|-------|
| Provenance / citations to **specific data rows** | **Partial / weak** | `EvidenceChip.source` is free text; no `table`, `row_id`, `query_id`, `panel_id`, match ID, or ClickHouse primary key |
| Tool-call traces | **No** | Faithfulness eval compares chip values to a caller-supplied `tool_results` dict; traces are not stored on the artifact |
| Uncertainty quantification | **Minimal** | Ternary `ConfidenceLevel` only; no numeric confidence, intervals, or calibrated scores |
| Schema versioning | **No** | No `schema_version` / `artifact_version` field or migration strategy on the model |
| Generation / trace IDs | **No** | Only storage `id` (UUID); no `generation_id`, OpenTelemetry trace/span, request ID |
| Model attribution | **No** | `source` = specialist name (`nightly_batch`, `biomarker_specialist`); no provider/model/temperature |
| Cost / token accounting | **No** | Not on artifact (may exist elsewhere for chat telemetry — not linked) |
| Locale / i18n of claim | **No** | Single `claim` string; no `locale`, no `claim_i18n` map; `preference_memory` has `language` preference but unused here |
| Expiry / staleness | **No** | No `expires_at`, `valid_until`, `data_as_of`, or freshness window |
| Dedup keys | **No** | No `dedup_key` / content hash; nightly can re-insert duplicates |
| Severity | **No** on insight | Only `InsightAction.priority` (free string). Tennis UI has its own severity enum — unrelated |
| Target audience (athlete / coach / parent) | **Partial** | Binary `requires_coach_review` + optional `coach_id`; no `audience` / role targeting |
| Links to source metrics | **Partial** | Metric name + free-text source + optional value/unit/trend/timestamp; no deep-link URL or chart route |

### What *is* present and useful

- Scoped identity: `athlete_id`, `organization_id`, `coach_id`  
- Human claim + category routing  
- Evidence chips (metric citations) as a product UI primitive  
- Actions with optional coach approval  
- Coach review gate + separate DB review/feedback tables  
- Trigger provenance at a coarse grain (`chat` / `nightly` / `event`)  
- Eval harness faithfulness check against tool results (offline, not persisted)

---

## 7. Gaps for a production insight artifact

1. **Contract drift across layers**  
   Pydantic ↔ Supabase ↔ `InsightData` TS are close but not identical (`coach_review_status`, `updated_at`, `athlete_name`, required `created_at` / `id` on UI, missing `timestamp` on UI evidence). Empty `schemas/__init__.py`; no shared OpenAPI/JSON Schema/Zod generation.

2. **Weak provenance**  
   Cannot deep-link or audit a chip back to a concrete row/query. Faithfulness is string-contains over tool JSON — fragile.

3. **No observability on the artifact**  
   Missing model name, tokens, latency, cost, generation/trace IDs — hard to debug multi-agent runs or attribute regressions.

4. **No schema versioning**  
   Evolving nested `evidence`/`actions` JSONB without a version field risks silent UI breakage.

5. **No lifecycle fields**  
   Staleness, expiry, supersedes/superseded_by, dedup key, severity, audience — needed for inbox UX and nightly idempotency.

6. **Incomplete producer→store wiring**  
   CGM specialist builds `Insight` but is not hooked into `run_nightly_batch` storage. Event hook only implements `lab_ingest`. Coach roster digest described in `nightly_batch` docstring is not implemented in the loop. Chat mode default `trigger="chat"` has no structured chat emitter found.

7. **Loose string fields**  
   `trend`, `priority`, `action_type`, `trigger`, `source` are unconstrained; DB `category`/`confidence` lack CHECK constraints matching enums.

8. **No TypeScript/Zod mirror as SSoT**  
   Hand-maintained `InsightData` will diverge. Generated Supabase types omit `insights` entirely.

9. **i18n**  
   Product is multi-locale (`messages/*.json`); claims are monolingual opaque strings.

10. **Parent audience**  
    No parent visibility model on the artifact or RLS path for guardians.

---

## 8. Cross-repo file index (absolute paths)

### Canonical + tests
- `/Users/danielsilva/Desktop/PeakPerformanceDataMonorepo/PeakPerformanceData/ppp_ai_agent/schemas/insight.py`
- `/Users/danielsilva/Desktop/PeakPerformanceDataMonorepo/PeakPerformanceData/ppp_ai_agent/schemas/__init__.py` (empty)
- `/Users/danielsilva/Desktop/PeakPerformanceDataMonorepo/PeakPerformanceData/ppp_ai_agent/tests/test_insight_schema.py`
- `/Users/danielsilva/Desktop/PeakPerformanceDataMonorepo/PeakPerformanceData/ppp_ai_agent/tests/test_eval.py`
- `/Users/danielsilva/Desktop/PeakPerformanceDataMonorepo/PeakPerformanceData/ppp_ai_agent/tests/test_cgm_specialist.py`
- `/Users/danielsilva/Desktop/PeakPerformanceDataMonorepo/PeakPerformanceData/ppp_ai_agent/eval/harness.py`

### Producers / API / store
- `/Users/danielsilva/Desktop/PeakPerformanceDataMonorepo/PeakPerformanceData/ppp_ai_agent/agent/nightly_batch.py`
- `/Users/danielsilva/Desktop/PeakPerformanceDataMonorepo/PeakPerformanceData/ppp_ai_agent/agent/biomarker_specialist.py`
- `/Users/danielsilva/Desktop/PeakPerformanceDataMonorepo/PeakPerformanceData/ppp_ai_agent/agent/cgm_specialist.py`
- `/Users/danielsilva/Desktop/PeakPerformanceDataMonorepo/PeakPerformanceData/ppp_ai_agent/api/routes/insights.py`
- `/Users/danielsilva/Desktop/PeakPerformanceDataMonorepo/PeakPerformanceData/ppp_ai_agent/api/main.py`
- `/Users/danielsilva/Desktop/PeakPerformanceDataMonorepo/PeakPerformanceData/ppp_ai_agent/tools/db.py`
- `/Users/danielsilva/Desktop/PeakPerformanceDataMonorepo/PeakPerformanceData/peak_performance_data/supabase/migrations/20260727_insight_store.sql`

### Next.js consumers
- `/Users/danielsilva/Desktop/PeakPerformanceDataMonorepo/PeakPerformanceData/peak_performance_data/src/components/insights/InsightCard.tsx`
- `/Users/danielsilva/Desktop/PeakPerformanceDataMonorepo/PeakPerformanceData/peak_performance_data/src/components/insights/CoachInbox.tsx`
- `/Users/danielsilva/Desktop/PeakPerformanceDataMonorepo/PeakPerformanceData/peak_performance_data/src/components/insights/InsightStrip.tsx`
- `/Users/danielsilva/Desktop/PeakPerformanceDataMonorepo/PeakPerformanceData/peak_performance_data/src/app/[locale]/coach/insights/page.tsx`
- `/Users/danielsilva/Desktop/PeakPerformanceDataMonorepo/PeakPerformanceData/peak_performance_data/src/app/api/ai-agent/insights/route.ts`
- `/Users/danielsilva/Desktop/PeakPerformanceDataMonorepo/PeakPerformanceData/peak_performance_data/src/app/api/ai-agent/insights/[insightId]/review/route.ts`
- `/Users/danielsilva/Desktop/PeakPerformanceDataMonorepo/PeakPerformanceData/peak_performance_data/src/app/api/ai-agent/feedback/route.ts`

### Plan reference
- `/Users/danielsilva/Desktop/PeakPerformanceDataMonorepo/PeakPerformanceData/ppp_ai_agent/_plans/ppd_agentic_layer_0167692b.plan.md` (Phase 1 item 5: shared schema; Phase 2: store + coach inbox)

---

## 9. Verdict

The shared contract is a **small, UI-oriented Pydantic card** (`claim` + evidence chips + confidence + actions + coach-review gate), persisted as a Supabase `insights` row with JSONB nests, and loosely mirrored by hand-written `InsightData` on the Next.js coach inbox. It is **not yet** a production multi-agent insight artifact: missing row-level provenance, tool traces, schema/version IDs, model/cost attribution, locale, staleness/dedup, severity, and audience targeting. Several same-named “Insight” types elsewhere in the frontend are unrelated heuristics. Closing the gap requires elevating this schema (and regenerating TS/Zod + DB types from one SSoT) before scaling specialists.
