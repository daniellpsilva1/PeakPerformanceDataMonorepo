# 11 — Python AI Agent Pytest Suite Audit

**Scope:** `PeakPerformanceData/ppp_ai_agent` (read-only)  
**Date:** 2026-08-02  
**Tests audited:** all files under `tests/`, plus root `conftest.py`, `pytest.ini`, `requirements-dev.txt`  
**Constraint:** no tests were executed; findings are from static reading only.

---

## Executive verdict

The suite is **strong on pure scoring/parsing math and string-level safety constants**, and **weak-to-absent on everything that matters for a multi-agent production service**: real tool I/O, FastAPI routes, JWT/session auth, org tenancy, LLM tool selection, and end-to-end faithfulness of generated insights.

**~171 `def test_*` methods** exist. Many are meaningful unit tests (CGM scores, genetic parser, optimal zones). A large share are **registry presence checks**, **disclaimer substring checks**, or **tautological red-team prompt audits** that never invoke an agent.

**Key question answer:** No test in this suite would catch an LLM hallucinating a number in a live response, calling the wrong tool, or leaking cross-tenant athlete data. The faithfulness helper *could* catch a hallucinated evidence value *if wired to real tool traces*, but today it only runs against hand-built fixtures. Wrong-tool and cross-tenant paths are completely untested.

---

## 1. Per-file table

Counts = number of `def test_*` / `async def test_*` method definitions. Parametrized expansions noted separately. Verdict = meaningful vs trivial/smoke.

| File | What it tests | # test fns | Meaningful? | Notes |
|------|---------------|------------|-------------|-------|
| `tests/__init__.py` | (empty) | 0 | n/a | Empty package marker |
| `tests/test_cgm.py` | Pure CGM scoring (`compute_spike_score`, `compute_stability_score`, `compute_time_in_range`, `compute_fasting_baseline`); disclaimer strings; medical-overreach regex; registry schema for CGM tools | **25** (param adds +3 → ~28 collected) | **Mostly meaningful** | Scoring assertions are real (exact/bounded). Disclaimer + registry bits are smoke. Does **not** call async `get_cgm_scores` / ClickHouse |
| `tests/test_genetic_parser.py` | `parse_23andme_raw`, `parse_report_json`, `match_genotype_to_feature`, `extract_traits`; safety (no raw genotypes, blocked tiers) | **26** | **Meaningful** | Best unit-test file in the suite. Does **not** cover async `parse_genetic_report` / `fetch_trait_catalog` (DB) |
| `tests/test_biomarkers.py` | `classify_biomarker`, `compute_delta_from_optimal`, `summarize_panel`; biomarker system-prompt substrings; registry schemas | **27** | **Mixed** | Zone engine tests are meaningful. Specialist prompt + registry = smoke. Does **not** call `tools/biomarkers.py` async tools or `analyze_biomarkers` |
| `tests/test_auth.py` | `AuthMiddleware` on a **toy** FastAPI app: public `/health`, 401 without auth, internal secret accept/reject/empty | **5** | **Narrow but real** | Only internal-service header path. JWT/Supabase path untested. Unused `AsyncMock`/`MagicMock`/`patch` imports (L3) |
| `tests/test_cgm_specialist.py` | Deterministic `_build_fallback_insight`; `CGM_NIGHTLY_SYSTEM` substrings; overreach regex | **10** (param +4 → ~14 collected) | **Mixed** | Fallback insight logic is meaningful. LLM path `generate_cgm_nightly_insight` untested |
| `tests/test_tools_and_providers.py` | Tool registry name/schema smoke; `get_available_providers` / `with_failover` with monkeypatched keys | **11** | **Mixed** | Failover logic is meaningful (mocked callables, no network). Registry half is smoke |
| `tests/test_genetics.py` | `build_genetics_context` filtering; disclaimer constants; registry schemas; “red-team” prompts | **16** (param +6 → ~22 collected) | **Mixed / partly tautological** | Context builder is meaningful. `TestGeneticsEvalRedTeam.test_genetics_overreach_prompts_contain_blocked_concepts` (L135–139) only asserts the **prompt fixture itself** contains blocked words — never runs an agent |
| `tests/test_tennis.py` | Tennis tool names + schemas in registry; full registry inventory (≥16 tools) | **6** | **Trivial smoke** | Zero execution of `tools/tennis.py` functions |
| `tests/test_insight_schema.py` | Pydantic `Insight` / `EvidenceChip` / `InsightAction` validation | **10** | **Meaningful** | Schema unit tests only; no persistence/API round-trip |
| `tests/test_integration.py` | Registry structural integrity; domain categorization; description-string safety; overreach regex on canned strings | **22** | **Misnamed smoke** | **Not** an app integration test (see §6) |
| `tests/test_eval.py` | `check_faithfulness`, `check_medical_overreach`, `make_test_insight`; nightly system-prompt substrings | **13** (param +8 → ~21 collected) | **Mixed** | Harness unit tests are real. Never connected to live LLM output. “Safety refusal” class only checks prompt text presence |

**Approximate total:** 171 test method definitions; ~190+ collected cases with parametrize.

---

## 2. Mocking strategy

### Summary

| Dependency | How mocked? | Real network calls in tests? |
|------------|-------------|------------------------------|
| **Supabase** | **Not mocked.** Never called by any test. JWT path (`verify_supabase_token`) never exercised | **No** (also: no coverage) |
| **ClickHouse** | **Not mocked.** Async CGM/wearable tools that call `get_clickhouse_client()` never invoked | **No** |
| **LLM providers** | Keys monkeypatched on `config.settings.*`; `with_failover` given local `async def mock_fn` — no HTTP to OpenAI/DeepSeek/Groq | **No** |
| **Auth secret** | `monkeypatch.setattr("api.middleware.auth.INTERNAL_SERVICE_SECRET", ...)` | **No** |

There is **no** shared fixture that stubs `tools.db.supabase_rpc`, `get_clickhouse_client`, or httpx. Tests avoid network by simply **never calling** I/O-bound production code.

### Quoted fixtures / mocking patterns

**Root conftest — path only, no mocks:**

```1:6:PeakPerformanceData/ppp_ai_agent/conftest.py
"""Pytest configuration — ensures project root is on sys.path."""

import sys
import os

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
```

**Auth app fixture (toy app, not `api.main:app`):**

```12:25:PeakPerformanceData/ppp_ai_agent/tests/test_auth.py
@pytest.fixture
def app():
    app = FastAPI()

    @app.get("/health")
    async def health():
        return {"status": "healthy"}

    @app.get("/secure")
    async def secure():
        return {"message": "authenticated"}

    app.add_middleware(AuthMiddleware)
    return app
```

**Internal secret monkeypatch:**

```39:43:PeakPerformanceData/ppp_ai_agent/tests/test_auth.py
    def test_internal_service_secret(self, app, monkeypatch):
        monkeypatch.setattr("api.middleware.auth.INTERNAL_SERVICE_SECRET", "test-secret")
        client = TestClient(app)
        resp = client.get("/secure", headers={"x-internal-service": "test-secret"})
        assert resp.status_code == 200
```

**Provider / failover mocking (no LLM HTTP):**

```75:87:PeakPerformanceData/ppp_ai_agent/tests/test_tools_and_providers.py
    @pytest.mark.asyncio
    async def test_with_failover_success_first(self, monkeypatch):
        monkeypatch.setattr("config.settings.DEEPSEEK_API_KEY", "ds-test")
        monkeypatch.setattr("config.settings.GROQ_API_KEY", "gq-test")
        monkeypatch.setenv("LLM_PRIMARY", "deepseek")
        monkeypatch.setenv("LLM_FALLBACK", "groq")

        async def mock_fn(provider, *args, **kwargs):
            return {"provider": provider.name, "result": "ok"}

        result = await with_failover(mock_fn)
        assert result["provider"] == "deepseek"
        assert result["result"] == "ok"
```

**Genetic parser catalog is an in-file constant** (`CATALOG` at `tests/test_genetic_parser.py` L15–58), not a fixture and not a DB mock.

**Unused imports in auth tests:** `AsyncMock`, `MagicMock`, `patch` are imported (`test_auth.py` L3) but never used — evidence that JWT mocking was planned and abandoned.

---

## 3. `conftest.py` — setup and env isolation

| Concern | Status |
|---------|--------|
| `sys.path` insert so imports resolve from service root | Yes (L6) |
| Autouse fixtures | **None** |
| Env var isolation / clearing of `SUPABASE_*`, `CLICKHOUSE_*`, API keys | **None** |
| Blocking outbound network | **None** |
| Shared DB/LLM mocks | **None** |
| Markers registration | **None** |

**Verdict:** conftest does **not** isolate env vars. Tests that touch settings use ad-hoc `monkeypatch` only inside provider/auth tests. If a developer later adds a test that accidentally constructs `get_clickhouse_client()` or `supabase_rpc`, nothing in conftest would prevent real network I/O against whatever is in the process environment / `.env`.

---

## 4. `pytest.ini` and `requirements-dev.txt`

### `pytest.ini` (full file)

```1:4:PeakPerformanceData/ppp_ai_agent/pytest.ini
[pytest]
asyncio_mode = auto
testpaths = tests
python_files = test_*.py
```

| Setting | Value | Notes |
|---------|-------|-------|
| `asyncio_mode` | `auto` | Enables pytest-asyncio without per-test markers |
| `testpaths` | `tests` | Only `tests/` |
| `python_files` | `test_*.py` | Standard |
| **Markers** | **None defined** | No `unit` / `integration` / `slow` / `network` |
| **Coverage** | **None** | No `--cov`, no `pytest-cov` plugin |
| `addopts` | absent | No strict markers, no fail-under |

### `requirements-dev.txt` (full file)

```1:4:PeakPerformanceData/ppp_ai_agent/requirements-dev.txt
# Development dependencies
pytest==8.1.1
pytest-asyncio==0.23.6
ruff==0.3.4
```

No `pytest-cov`, `respx`/`httpx` mock helpers, `freezegun`, or golden-file tooling.

---

## 5. Production module coverage cross-reference

Legend:
- **Covered** = at least one production symbol from the module is imported and exercised with assertions beyond “name exists in registry”
- **Partial** = only constants/prompts/pure helpers; async I/O or main entrypoints untested
- **Zero** = never imported by tests (or only pulled transitively via registry import without calling module functions)

### `agent/`

| Module | Coverage | What tests touch |
|--------|----------|------------------|
| `agent/cgm_specialist.py` | **Partial** | `_build_fallback_insight`, `CGM_NIGHTLY_SYSTEM` string. **Not:** `generate_cgm_nightly_insight` (LLM + `get_cgm_scores`) |
| `agent/biomarker_specialist.py` | **Partial** | `PANEL_LANDED_SYSTEM` substrings only. **Not:** `generate_panel_landed_insight`, `_build_fallback_insight` |
| `agent/nightly_batch.py` | **Partial** | `ATHLETE_BRIEF_SYSTEM` substrings only. **Not:** `generate_athlete_brief`, `store_insight`, `run_nightly_batch` |
| `agent/__init__.py` | Zero / n/a | Empty package |

### `api/`

| Module | Coverage | What tests touch |
|--------|----------|------------------|
| `api/middleware/auth.py` | **Partial** | `AuthMiddleware` internal-secret + public paths on toy app. **Not:** `verify_supabase_token`, Bearer JWT success/failure, request.state org/role attachment under session auth |
| `api/main.py` | **Zero** | App never mounted with TestClient |
| `api/routes/health.py` | **Zero** | Toy `/health` in auth test ≠ this router |
| `api/routes/insights.py` | **Zero** | No tests for `/batch/nightly`, `/events/hook`, insight CRUD, coach review, feedback, genetics parse, CGM/tennis route proxies |
| `api/__init__.py`, `api/middleware/__init__.py`, `api/routes/__init__.py` | Zero / n/a | Package markers |

### `tools/`

| Module | Coverage | What tests touch |
|--------|----------|------------------|
| `tools/cgm.py` | **Partial** | Pure scorers + `CGM_DISCLAIMER`. **Not:** `get_cgm_scores`, `get_glucose_training_context` (ClickHouse) |
| `tools/genetic_parser.py` | **Partial** | Pure parse/extract helpers. **Not:** `fetch_trait_catalog`, `parse_genetic_report`, `_update_parse_error` |
| `tools/genetics.py` | **Partial** | `build_genetics_context`, `GENETICS_DISCLAIMER`, `BLOCKED_TIERS`. **Not:** `get_genetic_traits`, `get_genetic_trait_catalog` (Supabase) |
| `tools/optimal_zones.py` | **Partial** | `classify_biomarker`, `compute_delta_from_optimal`, `summarize_panel`. **Not:** `get_reference_ranges`, `analyze_biomarkers` |
| `tools/registry.py` | **Covered** | Presence, schemas, structural integrity, async fn checks |
| `tools/db.py` | **Zero** | `get_clickhouse_client`, `supabase_rpc` never tested |
| `tools/athletes.py` | **Zero** | Only registry name smoke |
| `tools/alerts.py` | **Zero** | Only registry name smoke |
| `tools/training.py` | **Zero** | Only registry name smoke |
| `tools/wearables.py` | **Zero** | Only registry name smoke |
| `tools/biomarkers.py` | **Zero** | Async lab tools never called (`get_lab_panels`, `analyze_lab_panel`, etc.) |
| `tools/tennis.py` | **Zero** | Only registry name/schema smoke |
| `tools/__init__.py` | Zero / n/a | |

### `config/`

| Module | Coverage | What tests touch |
|--------|----------|------------------|
| `config/provider_router.py` | **Covered** | Provider list, primary, failover success/fail/empty |
| `config/settings.py` | **Zero as unit** | Patched attributes only; no validation/default tests |
| `config/__init__.py` | Zero / n/a | |

### `schemas/`

| Module | Coverage | What tests touch |
|--------|----------|------------------|
| `schemas/insight.py` | **Covered** | Full Pydantic validation suite |
| `schemas/__init__.py` | Zero / n/a | |

### `eval/`

| Module | Coverage | What tests touch |
|--------|----------|------------------|
| `eval/harness.py` | **Covered (unit)** | `check_faithfulness`, `check_medical_overreach`, `make_test_insight`, `MEDICAL_OVERREACH_PROMPTS` size/content |
| `eval/__init__.py` | Zero / n/a | |

### Explicit uncovered list (modules with ZERO behavioral test coverage)

These production modules have **no** test that imports and exercises their primary callables:

1. `PeakPerformanceData/ppp_ai_agent/tools/db.py`
2. `PeakPerformanceData/ppp_ai_agent/tools/athletes.py`
3. `PeakPerformanceData/ppp_ai_agent/tools/alerts.py`
4. `PeakPerformanceData/ppp_ai_agent/tools/training.py`
5. `PeakPerformanceData/ppp_ai_agent/tools/wearables.py`
6. `PeakPerformanceData/ppp_ai_agent/tools/biomarkers.py`
7. `PeakPerformanceData/ppp_ai_agent/tools/tennis.py`
8. `PeakPerformanceData/ppp_ai_agent/api/main.py`
9. `PeakPerformanceData/ppp_ai_agent/api/routes/health.py`
10. `PeakPerformanceData/ppp_ai_agent/api/routes/insights.py`

Plus **critical uncovered entrypoints inside otherwise-partial modules:**

- `api/middleware/auth.py` → `verify_supabase_token`
- `agent/nightly_batch.py` → `run_nightly_batch`, `generate_athlete_brief`, `store_insight`
- `agent/biomarker_specialist.py` → `generate_panel_landed_insight`
- `agent/cgm_specialist.py` → `generate_cgm_nightly_insight`
- `tools/cgm.py` → `get_cgm_scores`, `get_glucose_training_context`
- `tools/genetics.py` → `get_genetic_traits`, `get_genetic_trait_catalog`
- `tools/genetic_parser.py` → `parse_genetic_report`, `fetch_trait_catalog`
- `tools/optimal_zones.py` → `get_reference_ranges`, `analyze_biomarkers`

---

## 6. Is `test_integration.py` a real integration test?

**No.**

Evidence:

1. Docstring claims “Integration tests for tool registry dispatch and safety boundaries” (`tests/test_integration.py` L1) but **no tool is dispatched** — no `await TOOL_REGISTRY[name]["fn"](...)`.
2. **No** `TestClient`, **no** `api.main.app`, **no** ASGI lifespan, **no** DB, **no** HTTP.
3. `asyncio` is imported (L3) and unused.
4. Actual verification:
   - Registry dict shape (`fn`, `description`, `required`, `optional`)
   - All tool fns are async coroutines
   - Expected tool name sets per domain
   - Description strings contain lifestyle/evidence language and avoid “diagnos” / “natural language”
   - `check_medical_overreach` on hardcoded strings

This is a **registry + string-lint smoke suite**, not an integration test of the running service.

---

## 7. `test_auth.py` — security properties

### Asserted

| Property | Where |
|----------|-------|
| Public path `/health` skips auth (200) | L29–32 |
| Secure path without credentials → 401 | L34–37 |
| Matching `x-internal-service` header → 200 | L39–43 |
| Wrong internal secret → 401 | L45–49 |
| Empty configured secret rejects any header value → 401 | L51–55 |

### Not asserted (gaps)

| Missing property | Why it matters |
|------------------|----------------|
| Valid Supabase Bearer JWT accepted | Second auth path in production (`auth.py` L44–54) |
| Invalid / expired JWT rejected | Forgery resistance |
| `verify_supabase_token` profile lookup failure → 401 | Partial auth failures |
| `request.state.user_id` / `organization_id` / `user_role` set correctly | Downstream authorization depends on this |
| Caller **cannot read another organization's athlete** | **No tenancy test anywhere in the suite** |
| Internal auth with `user_id=None` / `organization_id=None` cannot escalate into arbitrary org data via query params | Internal secret path explicitly nulls identity (`auth.py` L38–41) — dangerous if routes trust body `organization_id` |
| Auth on real routes (`/batch/nightly`, `/insights`, `/events/hook`) | Only toy `/secure` endpoint |
| Authorization header without `Bearer ` prefix | Edge case |
| Service mounted as in `api/main.py` (CORS, GZip, routers) | Production wiring untested |

---

## 8. Would any test catch hallucination / wrong tool / cross-tenant leak?

### LLM hallucinating a number

| Mechanism | Present? | Would catch live hallucination? |
|-----------|----------|----------------------------------|
| `check_faithfulness(insight, tool_results)` | Yes, unit-tested in `test_eval.py` L24–52 | **Only if** CI ran it on real agent outputs with real tool traces. Today inputs are hand-built (`make_test_insight` + fake `tool_results`). **Does not catch live hallucinations.** |
| String substring in claim vs tool data | No | — |
| Snapshot/golden LLM traces | No | — |

Caveat: faithfulness is a **substring search** of `json.dumps(tool_results)` for the evidence value (`eval/harness.py` L123–136). It can false-pass if the hallucinated number coincidentally appears elsewhere in the blob, and it does not validate metric–source binding (any tool result may “justify” any chip).

### Calling the wrong tool

| Mechanism | Present? |
|-----------|----------|
| Assert expected tool name sequence for a prompt | **No** |
| Mocked orchestrator tool-router tests | **No** |
| Golden tool-trace suites (mentioned in harness docstring L9–10) | **Not implemented** |

Registry tests only check that tools *exist*, not that the agent *selects* them correctly.

### Leaking cross-tenant data

| Mechanism | Present? |
|-----------|----------|
| Two-org fixture; org-A token must not fetch org-B athlete | **No** |
| Tool-level `organization_id` filter assertions | **No** (DB tools untested) |
| Route-level check that `request.state.organization_id` matches payload | **No** |
| Internal-service auth scoped to a caller org | **No** (internal auth clears org identity) |

**Verdict:** the suite **cannot** currently catch hallucinated numbers in production responses, wrong tool calls, or cross-tenant data leaks.

---

## 9. What the suite *does* catch well

1. **Deterministic scoring math** — CGM spike/stability/TIR/fasting; biomarker zone classification and panel summary.
2. **Genetic parse pipeline purity** — 23andMe/JSON parsing, genotype feature matching, no raw genotypes in extracted traits.
3. **Genetics context filtering** — `do_not_act` tiers excluded from LLM context.
4. **Pydantic insight schema** — required fields, invalid enums.
5. **Provider failover ordering** — with mocked callables.
6. **Static safety copy** — disclaimers and system prompts contain “never diagnose” / lifestyle language (regression if someone deletes the strings).
7. **Regex medical-overreach detector** — on canned response strings (useful as a post-hoc filter unit test, not as an agent gate).

---

## 10. Highest-priority coverage gaps (for multi-agent upgrade)

Ordered by risk:

1. **Tenancy / authz** — JWT path + org-scoped tool/route tests (two-tenant fixtures).
2. **Tool I/O with mocked Supabase/ClickHouse** — every `tools/*.py` async function that builds queries; assert filters include `organization_id` / athlete scope.
3. **Real FastAPI integration** — `TestClient(api.main.app)` for insights routes, nightly batch trigger, event hooks; auth required.
4. **Wire `check_faithfulness` to agent outputs** — offline replay / golden tool traces after specialist generation (even with stubbed LLM JSON).
5. **Tool-selection / routing evals** — assert the orchestrator requests the expected tool set for fixed prompts.
6. **LLM specialist paths** — `generate_*_insight` with stubbed provider returning adversarial JSON (medical language, wrong numbers).
7. **pytest-cov + env isolation in conftest** — fail-under threshold; autouse clear/block of network env.

---

## 11. File index (absolute paths)

| Path |
|------|
| `/Users/danielsilva/Desktop/PeakPerformanceDataMonorepo/PeakPerformanceData/ppp_ai_agent/conftest.py` |
| `/Users/danielsilva/Desktop/PeakPerformanceDataMonorepo/PeakPerformanceData/ppp_ai_agent/pytest.ini` |
| `/Users/danielsilva/Desktop/PeakPerformanceDataMonorepo/PeakPerformanceData/ppp_ai_agent/requirements-dev.txt` |
| `/Users/danielsilva/Desktop/PeakPerformanceDataMonorepo/PeakPerformanceData/ppp_ai_agent/tests/__init__.py` |
| `/Users/danielsilva/Desktop/PeakPerformanceDataMonorepo/PeakPerformanceData/ppp_ai_agent/tests/test_cgm.py` |
| `/Users/danielsilva/Desktop/PeakPerformanceDataMonorepo/PeakPerformanceData/ppp_ai_agent/tests/test_genetic_parser.py` |
| `/Users/danielsilva/Desktop/PeakPerformanceDataMonorepo/PeakPerformanceData/ppp_ai_agent/tests/test_biomarkers.py` |
| `/Users/danielsilva/Desktop/PeakPerformanceDataMonorepo/PeakPerformanceData/ppp_ai_agent/tests/test_auth.py` |
| `/Users/danielsilva/Desktop/PeakPerformanceDataMonorepo/PeakPerformanceData/ppp_ai_agent/tests/test_cgm_specialist.py` |
| `/Users/danielsilva/Desktop/PeakPerformanceDataMonorepo/PeakPerformanceData/ppp_ai_agent/tests/test_tools_and_providers.py` |
| `/Users/danielsilva/Desktop/PeakPerformanceDataMonorepo/PeakPerformanceData/ppp_ai_agent/tests/test_genetics.py` |
| `/Users/danielsilva/Desktop/PeakPerformanceDataMonorepo/PeakPerformanceData/ppp_ai_agent/tests/test_tennis.py` |
| `/Users/danielsilva/Desktop/PeakPerformanceDataMonorepo/PeakPerformanceData/ppp_ai_agent/tests/test_insight_schema.py` |
| `/Users/danielsilva/Desktop/PeakPerformanceDataMonorepo/PeakPerformanceData/ppp_ai_agent/tests/test_integration.py` |
| `/Users/danielsilva/Desktop/PeakPerformanceDataMonorepo/PeakPerformanceData/ppp_ai_agent/tests/test_eval.py` |
