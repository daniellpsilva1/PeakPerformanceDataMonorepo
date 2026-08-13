# Research Dossier 09 — Sensitive Health Domain Tools

**Scope:** Read-only analysis of biomarker, genetics, CGM, optimal-zone, and alert tool modules in `PeakPerformanceData/ppp_ai_agent`.  
**Mandate:** Exhaustive documentation of exported contracts, scoring determinism, reference sources, genetics data path, guardrails, consent, and Supabase table existence.

**Sources analyzed in full:**

| File | Role |
|------|------|
| `PeakPerformanceData/ppp_ai_agent/tools/biomarkers.py` | Lab panel / biomarker read tools |
| `PeakPerformanceData/ppp_ai_agent/tools/genetics.py` | Evidence-tiered genetics read tools |
| `PeakPerformanceData/ppp_ai_agent/tools/genetic_parser.py` | DTC upload → trait extraction pipeline |
| `PeakPerformanceData/ppp_ai_agent/tools/optimal_zones.py` | Deterministic zone classification engine |
| `PeakPerformanceData/ppp_ai_agent/tools/cgm.py` | ClickHouse CGM scoring tools |
| `PeakPerformanceData/ppp_ai_agent/tools/alerts.py` | User alerts read tool |
| `PeakPerformanceData/ppp_ai_agent/tests/test_biomarkers.py` | Optimal-zone + specialist prompt tests |
| `PeakPerformanceData/ppp_ai_agent/tests/test_genetics.py` | Genetics context + red-team concept tests |
| `PeakPerformanceData/ppp_ai_agent/tests/test_genetic_parser.py` | Parser unit tests |
| `PeakPerformanceData/ppp_ai_agent/tests/test_cgm.py` | CGM scoring + disclaimer tests |

**Supporting context (cited where relevant):**

- `PeakPerformanceData/peak_performance_data/supabase/migrations/20260727_lab_panels.sql`
- `PeakPerformanceData/peak_performance_data/supabase/migrations/20260727_genetics.sql`
- `PeakPerformanceData/peak_performance_data/supabase/migrations/20260130_dashboard_enhancement_tables.sql` (`user_alerts`)
- `PeakPerformanceData/ppp_ai_agent/tools/db.py` (service-key REST; bypasses RLS)
- `PeakPerformanceData/ppp_ai_agent/tools/registry.py`
- `PeakPerformanceData/ppp_ai_agent/agent/biomarker_specialist.py`
- `PeakPerformanceData/ppp_ai_agent/agent/cgm_specialist.py`
- `PeakPerformanceData/ppp_ai_agent/api/routes/insights.py`
- `PeakPerformanceData/peak_performance_data/src/app/api/ai-agent/genetics/upload/route.ts`
- `PeakPerformanceData/ppp_ai_agent/eval/harness.py` (`check_medical_overreach`)
- `PeakPerformanceData/ppd_extraction_backend/migrations/003_create_ow_timeseries.sql`

**Date of analysis:** 2026-08-02

---

## Executive verdict

| Layer | Status |
|-------|--------|
| **Deterministic scoring (Python)** | Real for labs zones, CGM scores, genetics genotype→feature matching |
| **Supabase schema for labs/genetics** | Migrations exist (`20260727_*.sql`); seeded ranges + catalog |
| **Tool ↔ DB wiring** | Code paths exist; service key bypasses RLS |
| **Consent enforcement in tools** | Genetics only (application-level). Labs/CGM/alerts: none in tool queries |
| **Raw genetics → LLM** | Not via designed path; minimized features only. Parser never calls LLM |
| **Production output validation** | Eval-only (`check_medical_overreach`); specialists do not validate after LLM |
| **Alerts tool** | Schema-mismatched vs live `user_alerts` — effectively broken |
| **Genetics upload end-to-end** | Schema drift + `PATCH` unsupported in `db.py` — parse pipeline incomplete |

---

## 1. `tools/biomarkers.py`

**Path:** `PeakPerformanceData/ppp_ai_agent/tools/biomarkers.py` (L1–200)

### Exported functions

#### `async get_lab_panels(organization_id, athlete_id=None, days_back=90, limit=10) -> dict` — L18–58

| Field | Detail |
|-------|--------|
| **Signature** | `async def get_lab_panels(organization_id: str, athlete_id: Optional[str] = None, days_back: int = 90, limit: int = 10) -> dict` |
| **Return shape** | Success: `{"panels": [{id, athlete_id, panel_type, lab_name, drawn_at, received_at, notes}], "count": int, "success": True}` · Failure: `{"panels": [], "count": 0, "error": str, "success": False}` |
| **Data source** | Supabase REST `lab_panels` via `supabase_rpc` (L42) |

#### `async get_panel_biomarkers(panel_id) -> dict` — L61–91

| Field | Detail |
|-------|--------|
| **Signature** | `async def get_panel_biomarkers(panel_id: str) -> dict` |
| **Return shape** | `{"biomarkers": [{id, biomarker_key, display_name, value, unit, ref_low, ref_high, status, provenance}], "count", "success"}` (+ `error` on failure) |
| **Data source** | Supabase `lab_biomarkers` (L73) |

#### `async analyze_lab_panel(panel_id, activity_context="general") -> dict` — L94–145

| Field | Detail |
|-------|--------|
| **Signature** | `async def analyze_lab_panel(panel_id: str, activity_context: str = "general") -> dict` |
| **Return shape** | `{"panel": {id, athlete_id, organization_id, panel_type, lab_name, drawn_at}, "summary": <summarize_panel output>, "success": True}` or `{"error", "success": False}` |
| **Data source** | `lab_panels` + `get_panel_biomarkers` + `analyze_biomarkers` / `summarize_panel` from `optimal_zones` |

#### `async get_biomarker_trend(organization_id, athlete_id, biomarker_key, days_back=365) -> dict` — L148–200

| Field | Detail |
|-------|--------|
| **Signature** | `async def get_biomarker_trend(organization_id: str, athlete_id: str, biomarker_key: str, days_back: int = 365) -> dict` |
| **Return shape** | `{"trend": [{date, value, unit, status}], "count", "success"}` |
| **Data source** | `lab_panels` (up to 50) then `lab_biomarkers` with `panel_id=in.(...)` |

### Scoring / zone logic

**Delegated to `optimal_zones` — fully deterministic in Python.** This module does not call an LLM. Classification happens at L127–132:

```127:132:PeakPerformanceData/ppp_ai_agent/tools/optimal_zones.py
    analyses = await analyze_biomarkers(
        biomarkers_resp["biomarkers"],
        activity_context=activity_context,
    )

    summary = summarize_panel(analyses)
```

(Caller is `biomarkers.analyze_lab_panel` L127–132.)

### Consent

**None in this module.** Queries do not filter on `consent_research`, `consent_athlete_visible`, `consent_coach_visible`, or `consent_org_admin_visible`. Because `supabase_rpc` uses the **service key** (`tools/db.py` L43–56), Postgres RLS consent policies are bypassed.

### Registry

Registered: `get_lab_panels`, `analyze_lab_panel`, `get_biomarker_trend` (`registry.py` L54–70).

---

## 2. `tools/optimal_zones.py`

**Path:** `PeakPerformanceData/ppp_ai_agent/tools/optimal_zones.py` (L1–237)

### Exported symbols

#### `BiomarkerAnalysis` dataclass — L29–43

Fields: `biomarker_key`, `display_name`, `value`, `unit`, `status`, `ref_low`, `ref_high`, `optimal_low`, `optimal_high`, `optimal_zone_label`, `delta_from_optimal`, `trend`.

#### `classify_biomarker(value, ref_low=None, ref_high=None, optimal_low=None, optimal_high=None) -> str` — L46–79

**Deterministic.** Key computation:

```64:79:PeakPerformanceData/ppp_ai_agent/tools/optimal_zones.py
    if ref_low is not None and value < ref_low:
        return "below_normal"
    if ref_high is not None and value > ref_high:
        return "above_normal"

    # Within normal range — check optimal zone
    if optimal_low is not None and optimal_high is not None:
        if value < optimal_low:
            return "below_optimal"
        if value > optimal_high:
            return "above_optimal"
        return "optimal"

    # No optimal zone defined — just normal
    return "normal"
```

Status hierarchy (docstring L11–17): `below_normal` / `above_normal` beat optimal sub-states; else optimal zone; else `normal`.

#### `compute_delta_from_optimal(value, optimal_low, optimal_high) -> Optional[float]` — L82–102

```98:102:PeakPerformanceData/ppp_ai_agent/tools/optimal_zones.py
    if value < optimal_low:
        return value - optimal_low  # negative
    if value > optimal_high:
        return value - optimal_high  # positive
    return 0.0
```

#### `async get_reference_ranges(biomarker_keys, activity_context="general") -> Dict[str, dict]` — L105–125

| Field | Detail |
|-------|--------|
| **Return** | `{biomarker_key: row}` from Supabase |
| **Data source** | `lab_reference_ranges` filtered by `biomarker_key in (...)` and `activity_context` |

**Not sex- or age-aware in the query** despite schema columns `min_age`, `max_age`, `sex` (migration L214–217). Only `activity_context` is applied (L116).

#### `async analyze_biomarkers(biomarkers, activity_context="general") -> List[BiomarkerAnalysis]` — L128–178

Loads ranges, then for each biomarker runs `classify_biomarker` + `compute_delta_from_optimal`.

#### `summarize_panel(analyses) -> dict` — L181–237

Return:

```python
{
  "total": int,
  "optimal": int,
  "suboptimal": int,   # total - optimal - abnormal
  "abnormal": int,     # below_normal | above_normal
  "flags": [{biomarker, status, value, unit, severity}],  # high for abnormal, medium for suboptimal
  "features": [{biomarker, display_name, value, unit, status, delta_from_optimal, optimal_zone}],
}
```

### Reference ranges / optimal zones — provenance

| Question | Finding |
|----------|---------|
| **Where do numbers come from?** | DB table `lab_reference_ranges`, seeded in `20260727_lab_panels.sql` L264–301 |
| **Hardcoded in Python?** | No thresholds in Python; classification math is hardcoded; bounds come from DB (or from per-row `ref_*` on biomarkers if present — note: `analyze_biomarkers` **ignores** biomarker-row `ref_low`/`ref_high` and uses `lab_reference_ranges` only, L145–151) |
| **Cited?** | Seed `source` column default `'insideTracker_style'` (migration L220, L264). Notes say “educational… NOT diagnostic” (L261–262). No peer-reviewed citations / URLs |
| **Activity-aware?** | Yes — `activity_context` ∈ seed data: `'general'`, `'endurance'` (and docstring mentions `'strength'` at L136, but seed has no strength rows) |
| **Sex-aware?** | Schema supports `sex`; seed defaults all to `'any'`; **tool query never filters sex** |
| **Age-aware?** | Schema has `min_age`/`max_age`; **unused by tools** |

Seed examples (migration): ferritin endurance optimal 50–150; vitamin_d 40–60; hs_crp 0–1; testosterone note “Male reference; female ranges differ” but no female seed row.

### LLM involvement

**None in this module.** Downstream `biomarker_specialist` may narrate the structured summary; math is already done.

---

## 3. `tools/genetics.py`

**Path:** `PeakPerformanceData/ppp_ai_agent/tools/genetics.py` (L1–155)

### Constants

- `BLOCKED_TIERS = {"do_not_act"}` — L21
- `GENETICS_DISCLAIMER` — L24–28:

> "Genetic traits are research-level associations with small effect sizes. Phenotype, training load, and environment override genetic predisposition. Do not make training, selection, or health decisions based solely on genetic information."

### Exported functions

#### `async get_genetic_traits(organization_id, athlete_id, include_insufficient=True) -> dict` — L31–95

| Field | Detail |
|-------|--------|
| **Return** | `{"traits": [{trait_key, display_name, evidence_tier, feature_label, description, disclaimer, source}], "count", "success"}` · empty + `consent_required: True` if reports exist but dual consent missing (L62) |
| **Data source** | `genetic_reports` then `genetic_traits` |

**Consent check (application-level)** — L44–62:

```44:62:PeakPerformanceData/ppp_ai_agent/tools/genetics.py
        reports_resp = await supabase_rpc("genetic_reports", params={
            "athlete_id": f"eq.{athlete_id}",
            "organization_id": f"eq.{organization_id}",
            "parse_status": "eq.parsed",
            "select": "id,athlete_consent,coach_consent",
        })
        ...
        consented_report_ids = [
            r["id"] for r in reports_resp
            if r.get("athlete_consent") and r.get("coach_consent")
        ]

        if not consented_report_ids:
            return {"traits": [], "count": 0, "success": True, "consent_required": True}
```

Requires **both** `athlete_consent` and `coach_consent`. Filters `do_not_act` tiers (L77–78). Optionally drops `insufficient` (L79–80).

**Select list never includes genotype / rsid** — L69: `trait_key,display_name,evidence_tier,feature_label,description,disclaimer,source`.

#### `async get_genetic_trait_catalog() -> dict` — L98–125

| Field | Detail |
|-------|--------|
| **Return** | `{"catalog": [{trait_key, display_name, evidence_tier, category, description, disclaimer, is_actionable}], "count", "success"}` |
| **Data source** | `genetic_trait_catalog` |
| **Consent** | None (educational catalog) |

#### `build_genetics_context(traits) -> dict` — L128–155

| Field | Detail |
|-------|--------|
| **Return** | `{"genetic_context": {research_associations, insufficient_evidence, global_disclaimer, is_actionable: False}}` |
| **Purpose** | Documented as “the ONLY way genetic information reaches the LLM” (L131) |

**Wiring gap:** `build_genetics_context` is **only referenced from tests** (`test_genetics.py`). There is **no genetics specialist** under `agent/`. Registry exposes `get_genetic_traits` / `get_genetic_trait_catalog` raw to the orchestrator — features/disclaimers, not genotypes, but **not** forced through `build_genetics_context`.

### Scoring

No numeric genetics scoring. Tier filtering is deterministic set membership. Genotype→label matching lives in `genetic_parser`.

---

## 4. `tools/genetic_parser.py`

**Path:** `PeakPerformanceData/ppp_ai_agent/tools/genetic_parser.py` (L1–274)

### Exported functions

#### `async fetch_trait_catalog() -> Dict[str, dict]` — L30–55

Source: `genetic_trait_catalog`. Returns `{trait_key: {display_name, evidence_tier, snp_rsids, possible_features, description, disclaimer, category, is_actionable}}`.

#### `parse_23andme_raw(content: str) -> Dict[str, str]` — L58–88

- Format: `rsid, chromosome, position, genotype` (tab or comma)
- Skips `#` comments, non-`rs*` ids, `--` missing genotypes
- Returns `{rsid: genotype}`

#### `parse_report_json(content: str) -> Dict[str, str]` — L91–122

Accepts:
1. Flat `{rsid: genotype}` if all keys start with `rs`
2. Nested arrays under keys `traits` / `variants` / `snps` / `results` with `rsid|rs_id|snp` + `genotype|genotype_pair`

Raises `ValueError` on invalid JSON.

#### `match_genotype_to_feature(genotype, possible_features) -> Optional[str]` — L125–143

Deterministic; matches genotype or reverse (unphased AG↔GA). Returns feature `label` only.

#### `extract_traits(genotypes, catalog) -> List[dict]` — L146–182

Deterministic catalog walk. Output trait dicts: `trait_key`, `display_name`, `evidence_tier`, `feature_label`, `description`, `disclaimer`, `source: "dtc_raw"`. **No genotype, no rsid** in output (verified by tests L213–223).

#### `async parse_genetic_report(report_id, file_content: bytes, file_type="dtc_raw") -> dict` — L185–262

| Field | Detail |
|-------|--------|
| **Return** | `{"traits_extracted": int, "success": bool, "error"?: str}` |
| **file_type** | `'dtc_raw'` → 23andMe text; `'dtc_report'` → JSON; else error |
| **Side effects** | PATCH status on `genetic_reports`; POST traits to `genetic_traits` |

#### `async _update_parse_error(report_id, error)` — L265–274 (private)

### File formats, size, streaming

| Concern | Finding |
|---------|---------|
| **Formats** | `dtc_raw` (23andMe-style txt/csv) and `dtc_report` (JSON). No VCF/BAM/PLINK |
| **Size limit in parser** | **None** — full `bytes` decoded to UTF-8 string (L216), then `splitlines()` |
| **Streaming** | **None** — loads entire file into memory |
| **Upload path** | Next.js route reads full `arrayBuffer`, posts `file_content: Array.from(fileBytes)` JSON to `/genetics/parse` — **no max size check** in upload route or API payload model |
| **Storage** | Migration expects `file_path` in Storage; upload route does **not** write to Storage; sends bytes inline |

### Critical: can raw genetic data reach an LLM prompt?

**Designed path: No.**

Data path:

```
Upload (raw bytes)
  → POST /genetics/parse (insights.py L305–314)
  → parse_genetic_report
  → parse_23andme_raw | parse_report_json   # genotypes in process memory only
  → extract_traits (catalog match)         # minimizes to feature_label
  → INSERT genetic_traits                  # no genotype columns in schema
  → get_genetic_traits                     # select excludes genotypes
  → (intended) build_genetics_context      # feature + disclaimer only
  → LLM
```

- `parse_genetic_report` has **zero LLM calls**.
- `genetic_traits` schema stores `feature_label`, not genotypes (`20260727_genetics.sql` L95–97).
- Tool select list and `build_genetics_context` omit genotypes.

**Residual risks (not “raw variants in prompt,” but real):**

1. Raw file bytes transit HTTP as JSON int array to the agent (internal secret).
2. If an orchestrator dumps entire tool JSON carelessly, it still only gets labels/descriptions — not rsids/genotypes — **unless** someone adds a new tool/select.
3. Upload route auto-sets `athlete_consent: true` and may set `coach_consent: true` when coach uploads for another athlete (`upload/route.ts` L60–61) — weakens dual-control.

### Pipeline breakage (implementation)

1. `supabase_rpc` supports only `GET`/`POST` (`db.py` L58–64). Parser calls `method="PATCH"` (L201, L249, L268) → **will raise `ValueError`**.
2. Upload insert uses `file_type` / `file_name` but migration requires `report_type` / `file_path` → **schema drift; insert likely fails** against applied migration.
3. PostgREST PATCH body shape used (`{"id": "eq....", ...}`) is incorrect even if PATCH were implemented (filters belong in query params).

**Verdict:** genetics parse path is **aspirational / unexercised end-to-end** despite solid unit tests on pure functions.

---

## 5. `tools/cgm.py`

**Path:** `PeakPerformanceData/ppp_ai_agent/tools/cgm.py` (L1–234)

### Constants — L22–32

```python
TARGET_RANGE_LOW = 70    # mg/dL
TARGET_RANGE_HIGH = 140  # mg/dL
FASTING_WINDOW_HOURS = 6  # declared but unused in compute_fasting_baseline
CGM_DISCLAIMER = (
  "Glucose scores are for lifestyle and fueling context only. "
  "They are not medical advice and do not diagnose diabetes or any metabolic condition. "
  "Consult a physician for medical concerns."
)
```

Hardcoded lifestyle targets — **not** sex/age/activity-aware; **not** cited to a standard (ADA/ISCGM TIR for diabetes is different; here explicitly non-diagnostic 70–140).

### Exported functions

#### `CGMScores` dataclass — L35–46

`spike_score`, `stability_score`, `time_in_range_pct`, `time_below_range_pct`, `time_above_range_pct`, `fasting_baseline`, `peak_post_meal`, `sample_count`, `disclaimer`.

#### `compute_spike_score(readings) -> float` — L49–67

**Deterministic.**

```58:67:PeakPerformanceData/ppp_ai_agent/tools/cgm.py
    above = sum(1 for r in readings if r > TARGET_RANGE_HIGH)
    pct_above = above / len(readings)
    max_excursion = max((r - TARGET_RANGE_HIGH for r in readings if r > TARGET_RANGE_HIGH), default=0)
    excursion_factor = min(max_excursion / 60.0, 1.0)
    score = 100.0 - (pct_above * 60 + excursion_factor * 40)
    return max(0.0, min(100.0, score))
```

Empty → 50.0.

#### `compute_stability_score(readings) -> float` — L70–89

CV = std/mean×100; `score = 100 - cv*2.5` clamped 0–100. Empty/single → 50.0.

#### `compute_time_in_range(readings) -> Dict[str, float]` — L92–106

`{in_range, below, above}` percentages vs 70–140.

#### `compute_fasting_baseline(readings: List[tuple]) -> Optional[float]` — L109–128

Median of values with `3 <= hour < 9`. (`FASTING_WINDOW_HOURS` unused.)

#### `async get_cgm_scores(user_id, days_back=7) -> dict` — L131–194

| Field | Detail |
|-------|--------|
| **Return** | `{"scores": CGMScores.__dict__ \| None, "success", "user_id", "has_data"?}` |
| **Data source** | ClickHouse `openwearables_data.ow_timeseries` where `metric_type = 'blood_glucose'` (L144–152) |

**Returns scores only** — raw series stay local; not in return payload (L9, L137).

#### `async get_glucose_training_context(user_id, days_back=3) -> dict` — L197–234

Builds lifestyle `fueling_note` from score thresholds (≥75 / ≥50 / else) — **template strings in Python**, not LLM. Includes `CGM_DISCLAIMER`.

### Consent

**None.** No consent flag checked before returning CGM scores.

### Downstream LLM

`cgm_specialist.generate_cgm_nightly_insight` feeds **scores + disclaimer** to LLM (`cgm_specialist.py` L63–75), never raw series. System prompt forbids diabetes/medical language (L22–29).

---

## 6. `tools/alerts.py`

**Path:** `PeakPerformanceData/ppp_ai_agent/tools/alerts.py` (L1–52)

### Exported function

#### `async get_alerts(organization_id, user_id, unread_only=True, limit=20) -> dict` — L14–52

| Field | Detail |
|-------|--------|
| **Return** | `{"alerts": [{id, type, title, message, severity, created_at, is_read}], "count", "success"}` |
| **Claimed data source** | Supabase `user_alerts` |

### Schema mismatch vs real table

Live migration `20260130_dashboard_enhancement_tables.sql` L228–255 defines:

| Tool expects | Actual column |
|--------------|---------------|
| `alert_type` | `alert_definition_id` (no `alert_type`) |
| `message` | `body` |
| `severity` | `priority` |
| `is_read` | `read_at` (timestamptz; unread = `read_at IS NULL`) |

**Table exists**, but this tool’s select/filter will fail or return empty against the real schema. **Unexercised / broken contract.** No consent logic (alerts are not special-category health data in the same sense).

---

## 7. Guardrails

### Language restrictions (in-code)

| Domain | Mechanism | Location |
|--------|-----------|----------|
| Genetics | `GENETICS_DISCLAIMER`; block `do_not_act`; `is_actionable: False` in context builder | `genetics.py` L21–28, L74–90, L148–154 |
| Genetics parser | Catalog-only extraction; no injury %; store but filter `do_not_act` | `genetic_parser.py` L6–11; tests |
| CGM | `CGM_DISCLAIMER`; lifestyle fueling notes | `cgm.py` L28–32, L214–232 |
| Labs | Specialist system prompt: never diagnose/prescribe; non-medical actions | `biomarker_specialist.py` L24–44 |
| CGM specialist | System prompt: no diabetes/insulin/meds | `cgm_specialist.py` L18–40 |

### Post-generation validation

| Check | Where used |
|-------|------------|
| `check_medical_overreach(response)` | `eval/harness.py` L92–102 — **tests/eval only** |
| Faithfulness (`check_faithfulness`) | Eval harness — not wired into specialists |

**Specialists (`biomarker_specialist`, `cgm_specialist`) do not call `check_medical_overreach` after LLM JSON is returned.** Guardrails are prompt + structured features + eval suite, not runtime output gates.

### Tests as guardrail documentation

- `test_biomarkers.py`: classification edges; specialist prompt contains “never diagnose” / “prescribe” / “non-medical”.
- `test_genetics.py`: no genotypes in context; `do_not_act` excluded; red-team prompts are **concept lists only** (parametrize does not call a model).
- `test_genetic_parser.py`: no genotype/rsid in extracted traits.
- `test_cgm.py`: disclaimer strings; `check_medical_overreach` on sample bad strings.

---

## 8. Consent matrix

| Tool / path | Consent check? | Notes |
|-------------|----------------|-------|
| `get_genetic_traits` | **Yes** — dual `athlete_consent` ∧ `coach_consent` | App-level; service key bypasses RLS |
| `get_genetic_trait_catalog` | No | Public educational catalog |
| `parse_genetic_report` | No (assumes report row exists) | Upload auto-sets consents |
| `get_lab_panels` / `analyze_lab_panel` / `get_biomarker_trend` | **No** | Schema has Art. 9 flags; tools ignore them; service key bypasses RLS |
| Lab UI insert (`LabPanelForm`) | Defaults only | Does not set consent fields; DB defaults `consent_coach_visible=false`, `consent_org_admin_visible=true` |
| `get_cgm_scores` / `get_glucose_training_context` | **No** | ClickHouse by `user_id` |
| `get_alerts` | N/A / broken schema | |

**Critical gap:** For labs, RLS would enforce visibility for user JWTs, but the agent uses **`SUPABASE_SERVICE_KEY`**, so **any caller who can invoke the agent tools can read lab panels without consent flags.** Genetics is the only domain with an explicit tool-layer gate.

---

## 9. Supabase / ClickHouse table existence

### Migrations found

| Table | Migration | Exists in repo? |
|-------|-----------|-----------------|
| `lab_panels` | `peak_performance_data/supabase/migrations/20260727_lab_panels.sql` L15 | **Yes** |
| `lab_biomarkers` | same L114 | **Yes** |
| `lab_reference_ranges` | same L195 + seed L264–301 | **Yes** |
| `genetic_reports` | `.../20260727_genetics.sql` L18 | **Yes** |
| `genetic_traits` | same L84 | **Yes** |
| `genetic_trait_catalog` | same L147 + seed L207–264 | **Yes** |
| `user_alerts` | `.../20260130_dashboard_enhancement_tables.sql` L228 | **Yes** (different columns) |
| `openwearables_data.ow_timeseries` | `ppd_extraction_backend/migrations/003_create_ow_timeseries.sql` | **Yes** (ClickHouse) |

### Not “missing tables” — but unexercised / mismatched code

- Labs/genetics tables **exist as migrations**. Whether applied to production was not verified via live DB in this pass.
- Frontend pages exist: `[locale]/labs`, `[locale]/genetics`, API upload routes — plan `b2c_consumer_transformation` notes routes “live but unlinked and un-gated.”
- Alerts tool column names **do not match** existing table → tool unusable as written.
- Genetics upload/parse **schema + PATCH** issues → parse pipeline likely never completed successfully against the migration as written.

### `database.types.ts`

No generated TypeScript types found for `lab_*` / `genetic_*` in a quick search — another signal these tables are new / not fully integrated into the typed client.

---

## 10. Registry surface (orchestrator)

From `tools/registry.py`:

| Tool name | Module |
|-----------|--------|
| `get_lab_panels` | biomarkers |
| `analyze_lab_panel` | biomarkers |
| `get_biomarker_trend` | biomarkers |
| `get_genetic_traits` | genetics |
| `get_genetic_trait_catalog` | genetics |
| `get_cgm_scores` | cgm |
| `get_glucose_training_context` | cgm |
| `get_alerts` | alerts |

**Not registered:** `parse_genetic_report`, `build_genetics_context`, pure classifiers (`classify_biomarker`, etc.). Parse is HTTP-only (`POST /genetics/parse`).

---

## 11. Real vs aspirational (summary table)

| Capability | Real (code + math + schema) | Aspirational / broken |
|------------|----------------------------|------------------------|
| Optimal-zone classification | Yes — unit tested | Sex/age filtering unused |
| Lab reference seed data | Yes — InsideTracker-style seed | Not peer-cited; strength context missing |
| Lab tools read path | Code complete | No consent filter under service key |
| Genetics minimize-to-feature | Pure functions solid | End-to-end parse/upload broken |
| Genetics dual consent | Checked in `get_genetic_traits` | Upload auto-grants; no genetics specialist |
| CGM scoring | Deterministic + CH table exists | Depends on `blood_glucose` data presence |
| CGM → LLM scores-only | Specialist implements | No runtime medical-overreach gate |
| Alerts tool | — | Column mismatch vs `user_alerts` |
| Post-LLM output validation | Eval harness | Not production-enforced |

---

## 12. Line-number quick index

| Module | Key lines |
|--------|-----------|
| biomarkers.py | exports L18, L61, L94, L148 |
| optimal_zones.py | classify L46–79; delta L82–102; ranges L105–125; analyze L128–178; summarize L181–237 |
| genetics.py | BLOCKED/DISCLAIMER L21–28; get_traits L31–95; catalog L98–125; build_context L128–155 |
| genetic_parser.py | 23andMe L58–88; JSON L91–122; match L125–143; extract L146–182; parse_report L185–262 |
| cgm.py | ranges/disclaimer L22–32; spike L49–67; stability L70–89; TIR L92–106; fasting L109–128; get_scores L131–194; training_context L197–234 |
| alerts.py | get_alerts L14–52 |
| db.py | service key L43–56; GET/POST only L58–64 |

---

*End of dossier 09.*
