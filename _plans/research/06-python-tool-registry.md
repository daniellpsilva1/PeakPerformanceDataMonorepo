# 06 — Python tool registry (`ppp_ai_agent`)

Research dossier for upgrading `PeakPerformanceData/ppp_ai_agent` into a multi-agent system. **Read-only survey; no code was changed.**

Primary sources (read in full):

- [`tools/registry.py`](../../PeakPerformanceData/ppp_ai_agent/tools/registry.py) (L1–133)
- [`tools/__init__.py`](../../PeakPerformanceData/ppp_ai_agent/tools/__init__.py) (empty)
- [`tests/test_tools_and_providers.py`](../../PeakPerformanceData/ppp_ai_agent/tests/test_tools_and_providers.py) (L1–134)

Supporting: every module under `tools/`, plus runtime callers in `agent/`, `api/routes/insights.py`, `api/middleware/auth.py`, `tests/test_integration.py`.

---

## 1. Registry mechanism (exact)

### What it is

A **static Python dict**, hand-maintained, with two thin helpers. **Not** a decorator, **not** dynamic import / plugin discovery, **not** OpenAI/Anthropic JSON Schema tool definitions.

```17:114:PeakPerformanceData/ppp_ai_agent/tools/registry.py
TOOL_REGISTRY = {
    "get_athletes": {
        "fn": get_athletes,
        "description": "List athletes in an organization, optionally scoped to assigned players.",
        "required": ["organization_id"],
        "optional": ["assigned_player_ids", "limit"],
    },
    # ... 15 more entries ...
}
```

Entry shape (convention, not typed):

| Key | Type | Meaning |
|-----|------|---------|
| `fn` | async callable | Implementation reference |
| `description` | `str` | Human one-liner for (intended) LLM / docs |
| `required` | `list[str]` | Param names that must be supplied |
| `optional` | `list[str]` | Param names that may be supplied |

Helpers:

| Function | Lines | Behavior |
|----------|-------|----------|
| `get_available_tools()` | L117–119 | `list(TOOL_REGISTRY.keys())` |
| `get_tool_schema(name)` | L122–132 | Returns `{name, description, required, optional}` or `None` |

Imports at top of `registry.py` (L7–14) eagerly bind callables from domain modules. `tools/__init__.py` is **empty** — no re-exports, no package-level registration.

### How tools are described to an LLM

**Today: barely.**

- Registry descriptions are plain English strings (not JSON Schema, not Pydantic models, not OpenAI `tools=[{type:"function",...}]` format).
- `get_tool_schema` returns name + description + required/optional **name lists only** — no types, no defaults, no enums, no output schema.
- Function **docstrings** exist on implementations and document return shape in prose (e.g. `Returns: {"athletes": [...], "count": int, "success": bool}`), but nothing converts docstrings → LLM tool schemas.
- No code path serializes `TOOL_REGISTRY` into a provider tool-calling payload.

### Test coverage of the registry

[`tests/test_tools_and_providers.py`](../../PeakPerformanceData/ppp_ai_agent/tests/test_tools_and_providers.py) L15–34 asserts a subset of names + schema shape for `get_athletes`. Broader integrity lives in [`tests/test_integration.py`](../../PeakPerformanceData/ppp_ai_agent/tests/test_integration.py) L10–96 (every entry has `fn`/description/required/optional; all `fn` are async; domain sets of 16 tools).

---

## 2. Is the registry wired to LLM tool-calling?

**No. Explicit finding: `TOOL_REGISTRY` is unused scaffolding for orchestration/tool-calling.**

Evidence:

1. **No production import of `TOOL_REGISTRY` / `get_tool_schema` / `get_available_tools` outside tests.** Runtime code imports tool modules directly:
   - `agent/nightly_batch.py` → `get_athletes`, `get_training_sessions`, `get_wearable_*`
   - `agent/biomarker_specialist.py` → `analyze_lab_panel`
   - `agent/cgm_specialist.py` → `get_cgm_scores`
   - `api/routes/insights.py` → biomarkers, genetics, cgm, tennis, `parse_genetic_report`
2. **LLM calls use chat completions + `response_format: json_object`, not tools/functions.** Example pattern in `agent/nightly_batch.py` (~L90–113): POST `{provider.base_url}/chat/completions` with system/user messages and hardcoded JSON schema instructions in the system prompt. Same pattern in biomarker and CGM specialists.
3. **No dispatcher** that looks up `TOOL_REGISTRY[name]["fn"]` and invokes it from model `tool_calls`.
4. Module docstring at `registry.py` L1–4 claims *"The orchestrator uses this registry to dispatch tool calls"* — that orchestrator **does not exist** in this package yet.

**What *is* wired:** tools as ordinary Python async functions, called by specialists/API/batch jobs; LLM receives **pre-fetched data** stuffed into the user prompt.

---

## 3. Metadata today vs what a sophisticated agent needs

| Capability | Present today? | Notes |
|------------|----------------|-------|
| Human-readable description for model | Partial | Static string on registry entry only |
| Input schema (types, defaults, enums) | **No** | Only param name lists; defaults live in Python signatures only |
| Output schema | **No** | Docstring prose / informal dicts; internal dataclasses (`CGMScores`, `BiomarkerAnalysis`) not exposed as schemas |
| Side-effect classification (read/write) | **No** | Docstrings say “read-only”; not encoded; write path exists outside registry (`parse_genetic_report`) |
| Required scopes / permissions | **No** | Optional `assigned_player_ids` is a soft filter, not a scope claim |
| Cost / latency hints | **No** | — |
| Rate limits | **No** | httpx timeout 15s on Supabase client (`db.py` L50) only |
| Idempotency | **No** | — |
| Error taxonomy | **No** | Ad hoc `success: bool` + `error: str` |
| Examples / few-shot | **No** | — |
| Provider-native tool JSON (OpenAI/Anthropic) | **No** | — |
| Versioning / deprecation | **No** | — |
| Domain / specialist tags | Implicit | Only in tests (`CORE_TOOLS`, `BIOMARKER_TOOLS`, …) |

Gap summary for multi-agent upgrade: need real JSON Schema (or Pydantic) per tool, side-effect flags, authz scopes, structured errors, and a runtime dispatcher that feeds provider tool APIs.

---

## 4. Authorization (critical)

### API layer

[`api/middleware/auth.py`](../../PeakPerformanceData/ppp_ai_agent/api/middleware/auth.py):

- Public paths skip auth (L24, L32–33).
- **Internal service** (`x-internal-service` == secret): sets `user_id` / `organization_id` / `role` to **`None`** (L37–42) — full trust of request body/query IDs.
- **Session JWT**: verifies Supabase user and loads `organization_id` + `role` into `request.state` (L44–54, L63–111).

Comment at L7–8 says identity is attached *"for downstream tools"* — **tools never read `request.state`.**

### Tool layer: trust the caller

Tools accept `organization_id` / `athlete_id` / `user_id` / `panel_id` / `match_id` as **plain arguments** and query with the **Supabase service key** (`db.py` L42–67) or ClickHouse service credentials. There is **no** check that:

- the authenticated user’s org matches `organization_id`,
- the user may access `athlete_id`,
- coach `assigned_player_ids` are actually assigned (caller supplies the list),
- `panel_id` / `match_id` belong to the caller’s org.

[`api/routes/insights.py`](../../PeakPerformanceData/ppp_ai_agent/api/routes/insights.py) passes query/body IDs straight into tools (e.g. L256–261 labs, L326–328 CGM, L343–347 tennis) without comparing to `request.state.organization_id`. Only feedback/review endpoints require `request.state.user_id` (L174–176, L219–223).

### Per-tool authz nuances

| Tool / area | Takes IDs? | Verifies caller access? |
|-------------|------------|-------------------------|
| `get_athletes` / `search_athlete` | `organization_id`; optional `assigned_player_ids` | **Trusts caller.** Filter is optional soft scope if caller passes IDs. |
| `get_training_sessions`, `get_lab_panels`, `get_biomarker_trend`, `get_genetic_traits` | org + optional/required athlete | Filters by those IDs in SQL/REST params only — **no caller check**. |
| `get_alerts` | `organization_id` + `user_id` | Trusts both. |
| Wearables / CGM | `user_id` only | **No org filter.** Any caller who can invoke the tool can query any wearable user_id in ClickHouse. |
| `analyze_lab_panel` | `panel_id` only | **IDOR-prone:** fetches panel by id with service key; no org/athlete gate. |
| `get_match_summary` | `match_id` only | Same IDOR pattern. |
| Tennis list/evolution | signature has `organization_id` | **`organization_id` is unused in the query** (`tennis.py` L16–50, L120–137) — filters only by `user_id`/`athlete_id`. |
| `get_genetic_traits` | org + athlete | Soft **consent** gate (athlete+coach consent) and evidence-tier filter — **not** caller authorization. |
| `parse_genetic_report` (not registered) | `report_id` | Writes with service key; no authz. |

**Bottom line:** authorization is (at best) at the HTTP edge for “is this request authenticated,” then tools **trust whatever IDs they are given**. Service-role Supabase + ClickHouse means RLS is bypassed. For a multi-agent system this is a **hard blocker** until tools take a principal context and enforce org/athlete/coach scopes.

---

## 5. Consistency: returns, empty data, errors

### Return shapes

- **Convention:** plain `dict` with `success: bool`.
- Domain payload key varies: `athletes`, `sessions`, `activities`, `summaries`, `alerts`, `panels`, `trend`, `traits`, `catalog`, `scores`, `context`, `matches`, `summary`, `evolution`.
- Usually also `count` for list tools.
- Internal helpers may return dataclasses (`CGMScores`, `BiomarkerAnalysis`) but registered tools serialize to dicts (`scores.__dict__`, `summarize_panel` dict).
- **No Pydantic models** on tool boundaries.

### “No data”

| Pattern | Examples |
|---------|----------|
| Empty list + `success: True` | Most list tools |
| `scores: None`, `has_data: False`, `success: True` | `get_cgm_scores` L163 |
| `context: None`, `has_data: False` | `get_glucose_training_context` L209–210 |
| `consent_required: True` with empty traits | `get_genetic_traits` L61–62 |
| `error: "Panel/Match not found"`, `success: False` | `analyze_lab_panel` L117–118; `get_match_summary` L66 |

### Errors

- Typical: `try/except` → log → `{"…": [], "count": 0, "error": str(e), "success": False}`.
- Exceptions are stringified; **no error codes**, no retryable vs fatal, no HTTP status mapping inside tools.
- LLM-facing specialists often treat `success: False` / empty data as “skip” rather than structured tool errors.

**Would an LLM understand them?** Partially for humans reading prompts; poorly for tool-calling agents without a stable schema. Inconsistent keys (`error` vs missing, `has_data` vs empty lists) would confuse automatic parsers.

### Notable infra quirks

- `supabase_rpc` annotated `-> dict` but PostgREST GET returns a **list**; callers treat it as a list. Supports only `GET` and `POST` (`db.py` L58–64).
- `genetic_parser.py` calls `method="PATCH"` (L201, L249, L268) — **unsupported** by `supabase_rpc` (would raise `ValueError`). Write path is fragile.
- Registry docstring promises structured dicts “never natural language”; that is an intent, not an enforced contract.

---

## 6. Module catalogue (exported surface)

Paths under `PeakPerformanceData/ppp_ai_agent/tools/`.

### `registry.py` — registration + schema helpers

| Callable | Signature | Purpose |
|----------|-----------|---------|
| `get_available_tools` | `() -> list[str]` | List registered tool names |
| `get_tool_schema` | `(name: str) -> dict \| None` | Description + required/optional param names |

Constant: `TOOL_REGISTRY` (16 tools).

### `db.py` — infrastructure (not registered)

| Callable | Signature | Purpose |
|----------|-----------|---------|
| `get_clickhouse_client` | `()` | Lazy ClickHouse singleton |
| `supabase_rpc` | `(path, method="GET", params=None, json_body=None) -> dict` | Service-key REST to Supabase |

### `alerts.py` — registered: `get_alerts`

| Callable | Signature | Purpose |
|----------|-----------|---------|
| `get_alerts` | `(organization_id, user_id, unread_only=True, limit=20) -> dict` | List user alerts from Supabase `user_alerts` |

### `athletes.py` — registered: both

| Callable | Signature | Purpose |
|----------|-----------|---------|
| `get_athletes` | `(organization_id, assigned_player_ids=None, limit=20) -> dict` | List org players, optional ID filter |
| `search_athlete` | `(organization_id, query, assigned_player_ids=None) -> dict` | ilike name search |

### `training.py` — registered: `get_training_sessions`

| Callable | Signature | Purpose |
|----------|-----------|---------|
| `get_training_sessions` | `(organization_id, athlete_id=None, days_back=7, limit=20) -> dict` | List training sessions |

### `wearables.py` — registered: both

| Callable | Signature | Purpose |
|----------|-----------|---------|
| `get_wearable_activities` | `(user_id, days_back=7, limit=50) -> dict` | Workouts from ClickHouse `ow_workouts` |
| `get_wearable_summary` | `(user_id, days_back=7) -> dict` | Daily summaries from `ow_activity_summaries` |

### `biomarkers.py` — registered: 3 of 4

| Callable | Signature | Purpose |
|----------|-----------|---------|
| `get_lab_panels` | `(organization_id, athlete_id=None, days_back=90, limit=10) -> dict` | List lab panels |
| `get_panel_biomarkers` | `(panel_id) -> dict` | Biomarkers for one panel (**not in registry**) |
| `analyze_lab_panel` | `(panel_id, activity_context="general") -> dict` | Optimal-zone panel analysis |
| `get_biomarker_trend` | `(organization_id, athlete_id, biomarker_key, days_back=365) -> dict` | Historical values for one key |

### `optimal_zones.py` — helpers (not registered)

| Callable | Signature | Purpose |
|----------|-----------|---------|
| `classify_biomarker` | `(value, ref_low=None, …) -> str` | Status classification |
| `compute_delta_from_optimal` | `(value, optimal_low, optimal_high) -> Optional[float]` | Distance from optimal zone |
| `get_reference_ranges` | `(biomarker_keys, activity_context="general") -> Dict` | Fetch ranges from Supabase |
| `analyze_biomarkers` | `(biomarkers, activity_context="general") -> List[BiomarkerAnalysis]` | Batch analysis |
| `summarize_panel` | `(analyses) -> dict` | Flags + features summary |

### `cgm.py` — registered: 2; helpers private to scoring

| Callable | Signature | Purpose |
|----------|-----------|---------|
| `compute_spike_score` | `(readings) -> float` | Spike score 0–100 |
| `compute_stability_score` | `(readings) -> float` | Stability / CV score |
| `compute_time_in_range` | `(readings) -> Dict[str,float]` | TIR percentages |
| `compute_fasting_baseline` | `(readings: List[tuple]) -> Optional[float]` | Morning median |
| `get_cgm_scores` | `(user_id, days_back=7) -> dict` | Scores from CH glucose (no raw series) |
| `get_glucose_training_context` | `(user_id, days_back=3) -> dict` | Fueling context from scores |

Constant: `CGM_DISCLAIMER`.

### `genetics.py` — registered: 2

| Callable | Signature | Purpose |
|----------|-----------|---------|
| `get_genetic_traits` | `(organization_id, athlete_id, include_insufficient=True) -> dict` | Consent-gated, tier-filtered traits |
| `get_genetic_trait_catalog` | `() -> dict` | Educational catalog |
| `build_genetics_context` | `(traits) -> dict` | Safe LLM context block (**not registered**) |

### `genetic_parser.py` — write pipeline (not registered)

| Callable | Signature | Purpose |
|----------|-----------|---------|
| `fetch_trait_catalog` | `() -> Dict[str,dict]` | Catalog for parsing |
| `parse_23andme_raw` | `(content) -> Dict[str,str]` | Parse 23andMe text |
| `parse_report_json` | `(content) -> Dict[str,str]` | Parse DTC JSON |
| `match_genotype_to_feature` | `(genotype, possible_features) -> Optional[str]` | Map genotype → label |
| `extract_traits` | `(genotypes, catalog) -> List[dict]` | Catalog-matched traits |
| `parse_genetic_report` | `(report_id, file_content, file_type="dtc_raw") -> dict` | Parse + **write** traits (**HTTP-exposed**) |

### `tennis.py` — registered: all 3

| Callable | Signature | Purpose |
|----------|-----------|---------|
| `get_tennis_matches` | `(organization_id, athlete_id, days_back=90, limit=20) -> dict` | Recent matches (org unused in query) |
| `get_match_summary` | `(match_id) -> dict` | Sets + key stats for one match |
| `get_tennis_evolution` | `(organization_id, athlete_id, limit=20) -> dict` | Per-match trend metrics (org unused) |

---

## 7. Full inventory — registered tools (16)

| # | Tool name | Module | Signature (params) | R/W | Backend |
|---|-----------|--------|--------------------|-----|---------|
| 1 | `get_athletes` | `athletes.py` | `organization_id`, `assigned_player_ids?`, `limit?` | **Read** | Supabase `profiles` |
| 2 | `search_athlete` | `athletes.py` | `organization_id`, `query`, `assigned_player_ids?` | **Read** | Supabase `profiles` |
| 3 | `get_training_sessions` | `training.py` | `organization_id`, `athlete_id?`, `days_back?`, `limit?` | **Read** | Supabase `training_sessions` |
| 4 | `get_wearable_activities` | `wearables.py` | `user_id`, `days_back?`, `limit?` | **Read** | ClickHouse `ow_workouts` |
| 5 | `get_wearable_summary` | `wearables.py` | `user_id`, `days_back?` | **Read** | ClickHouse `ow_activity_summaries` |
| 6 | `get_alerts` | `alerts.py` | `organization_id`, `user_id`, `unread_only?`, `limit?` | **Read** | Supabase `user_alerts` |
| 7 | `get_lab_panels` | `biomarkers.py` | `organization_id`, `athlete_id?`, `days_back?`, `limit?` | **Read** | Supabase `lab_panels` |
| 8 | `analyze_lab_panel` | `biomarkers.py` | `panel_id`, `activity_context?` | **Read** | Supabase `lab_panels` + `lab_biomarkers` + `lab_reference_ranges` |
| 9 | `get_biomarker_trend` | `biomarkers.py` | `organization_id`, `athlete_id`, `biomarker_key`, `days_back?` | **Read** | Supabase lab tables |
| 10 | `get_genetic_traits` | `genetics.py` | `organization_id`, `athlete_id`, `include_insufficient?` | **Read** | Supabase `genetic_reports` + `genetic_traits` |
| 11 | `get_genetic_trait_catalog` | `genetics.py` | *(none)* | **Read** | Supabase `genetic_trait_catalog` |
| 12 | `get_cgm_scores` | `cgm.py` | `user_id`, `days_back?` | **Read** | ClickHouse `ow_timeseries` |
| 13 | `get_glucose_training_context` | `cgm.py` | `user_id`, `days_back?` | **Read** | ClickHouse (via `get_cgm_scores`) |
| 14 | `get_tennis_matches` | `tennis.py` | `organization_id`, `athlete_id`, `days_back?`, `limit?` | **Read** | Supabase `tennis_matches` |
| 15 | `get_match_summary` | `tennis.py` | `match_id` | **Read** | Supabase match/sets/stats |
| 16 | `get_tennis_evolution` | `tennis.py` | `organization_id`, `athlete_id`, `limit?` | **Read** | Supabase match + stats |

**HTTP (non-LLM) write path outside registry:** `parse_genetic_report` → Supabase POST/PATCH on `genetic_traits` / `genetic_reports` (intended write; PATCH currently unsupported by `supabase_rpc`).

**No registered tool hits an external third-party HTTP product API** beyond Supabase REST and ClickHouse (both treated as data backends). LLM providers are called from `agent/*`, not from tools.

---

## 8. Conventions observed (definition style)

1. **Async** public tools; sync helpers for pure computation.
2. **Docstring** describes purpose + informal return dict.
3. **Try/except** at tool boundary; never raise to LLM layer.
4. **Service-key / privileged DB access** — RLS not in play.
5. **Manual registry sync** — adding a function does nothing until someone edits `TOOL_REGISTRY`.
6. **Safety messaging** in genetics/CGM descriptions and constants; enforced partly in code (tier filter, scores-only CGM) but not as registry metadata.
7. Port notes: several modules claim port from Next.js `src/lib/ai/tools/*` — parallel TypeScript tool surface may exist in the main app.

---

## 9. Implications for multi-agent upgrade

1. **Treat `TOOL_REGISTRY` as a stub** — build real OpenAI/Anthropic (or MCP) schemas + a dispatcher; do not assume tool-calling exists.
2. **Authz must move into tools or a wrapper** that injects principal + verifies org/athlete/coach assignment before privileged queries; stop trusting client-supplied IDs under service role.
3. **Fix IDOR surfaces** (`panel_id`, `match_id`, ClickHouse `user_id`) and unused `organization_id` on tennis tools.
4. **Unify envelopes** (`success`, `data`, `error: {code, message, retryable}`) and add output schemas.
5. **Register or deliberately exclude** write tools (`parse_genetic_report`) with side-effect flags; fix `PATCH` support if genetic parsing is kept.
6. **Tag tools by specialist** (core / biomarkers / genetics / cgm / tennis) in metadata for agent routing — today only tests encode this.

---

## Appendix A — Registry line map

| Tool | `registry.py` lines |
|------|---------------------|
| `get_athletes` | L18–23 |
| `search_athlete` | L24–29 |
| `get_training_sessions` | L30–35 |
| `get_wearable_activities` | L36–41 |
| `get_wearable_summary` | L42–47 |
| `get_alerts` | L48–53 |
| `get_lab_panels` | L54–59 |
| `analyze_lab_panel` | L60–65 |
| `get_biomarker_trend` | L66–71 |
| `get_genetic_traits` | L72–77 |
| `get_genetic_trait_catalog` | L78–83 |
| `get_cgm_scores` | L84–89 |
| `get_glucose_training_context` | L90–95 |
| `get_tennis_matches` | L96–101 |
| `get_match_summary` | L102–107 |
| `get_tennis_evolution` | L108–113 |
| Helpers | L117–132 |

## Appendix B — Runtime call graph (non-registry)

```
nightly_batch → get_athletes, get_wearable_*, get_training_sessions → LLM chat/completions (no tools)
biomarker_specialist → analyze_lab_panel → LLM chat/completions
cgm_specialist → get_cgm_scores → LLM chat/completions
insights API → get_lab_panels, get_biomarker_trend, get_genetic_traits,
               parse_genetic_report, get_cgm_scores, get_tennis_*  (direct HTTP, no registry)
```
