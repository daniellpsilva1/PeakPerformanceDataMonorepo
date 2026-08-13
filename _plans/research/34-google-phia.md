# 34 — Google PHIA (Personal Health Insights Agent)

External research dossier for Peak Performance Data’s multi-agent design.  
**Constraint:** LLM must never do arithmetic on or invent physiological numbers.  
**Question:** Is a sandboxed code-execution agent (PHIA-style) worth the infra cost vs. a fixed library of deterministic metric functions?

Research date: **2026-08-02**. Prioritize Nature Communications (Jan 2026) + arXiv + Google Research blog + open-source repo. Flag stale items.

---

## Sources (primary)

| Source | URL | Status |
|--------|-----|--------|
| **Nature Communications (peer-reviewed)** | https://www.nature.com/articles/s41467-025-67922-y | **Current.** Received 2024-07-08, accepted 2025-12-11, published **2026-01-12**, VoR 2026-01-29. Cite as: Merrill et al., Nat Commun 17, 1143 (2026). DOI: 10.1038/s41467-025-67922-y |
| **arXiv preprint** | https://arxiv.org/abs/2406.06464 | HTML: https://arxiv.org/html/2406.06464 — PDF: https://arxiv.org/pdf/2406.06464. First posted ~2024-06; still the preprint twin of the Nature paper. Prefer Nature for citation; numbers below match both. |
| **Google Research blog** | https://research.google/blog/advancing-personal-health-and-wellness-insights-with-ai/ | Dated **2024-06-11**. Covers PHIA + companion PH-LLM paper. **Slightly stale framing** (Gemini Ultra 1.0 era) but accurate on architecture and headline metrics. |
| **Official open-source repo** | https://github.com/yahskapar/personal-health-insights-agent | Prompt templates, `phia_agent.py`, few-shots, synthetic/real wearable users, 4000 objective + 172 open-ended queries. License: CC BY-NC 4.0. |
| Companion PH-LLM (related, not PHIA) | Nature Medicine 2025; blog section on same page | Fine-tuned Gemini for coaching over *aggregated* summaries — useful contrast (0% on PHIA objective numeric tasks). |

Secondary summaries (Argmin AI dashboard, etc.) were **not** used as evidence.

---

## 1. What PHIA is

PHIA is an LLM agent that answers personal health questions over wearable time-series by:

1. Planning in a **ReAct** loop (Thought → Act → Observe),
2. Running **Python/Pandas** against pre-loaded athlete tables in a sandbox,
3. Optionally calling **web search** for population norms / domain knowledge,
4. Emitting a final natural-language answer via a `finish` tool.

Base model in the published eval: **Gemini 1.0 Ultra** (fixed across PHIA and code-gen baseline so gains are attributable to the agent loop, not a stronger model).

**Stale flag:** Gemini 1.0 Ultra is obsolete in 2026. Absolute accuracy numbers may shift with newer models; the *relative* finding (text-only numeric reasoning fails; iterative code agents beat one-shot code gen) is the transferable claim.

---

## 2. Exact agent architecture & control flow

### 2.1 ReAct cycle (paper §3 / Nat Commun Methods)

```
User query
    │
    ▼
┌─────────────────────────────────────────────────────────┐
│  Thought  — plan next step from query + history         │
│      │                                                  │
│      ▼                                                  │
│  Act      — call EXACTLY ONE tool:                      │
│             • tool_code (Python)  OR                    │
│             • search (web)        OR                    │
│             • finish (final answer)                     │
│      │                                                  │
│      ▼                                                  │
│  Observe  — tool stdout / search snippets / answer      │
│      │                                                  │
│      └──── loop until finish or max_steps ─────────────►│
└─────────────────────────────────────────────────────────┘
```

Open-source agent config (`phia_agent.py`):

- `max_steps=10`
- Tools: `tool_code`, `search`, `finish`
- Prompt instruction: **one tool at a time**
- Framework: Google OneTwo `ReActAgent` + Jinja2 `ReActPromptJ2`

### 2.2 How tools interleave (canonical example from paper Fig. 2 / Nat Commun Fig. 5-style traces)

Query: *“I’m worried about my sleep relative to others in my age group. What is my average sleep in the past 30 days?”*

1. **Thought:** Need recommended sleep for age group → use Search.  
2. **Act:** `search("Recommended sleep duration for adults")`  
3. **Observe:** “7 or more hours…”  
4. **Thought:** Now compute user’s average sleep over 30 days.  
5. **Act:** `tool_code` → `summary_df['sleep_minutes'].mean()`  
6. **Observe:** `463.56`  
7. **Thought / Finish:** Convert to hours, compare to guideline, write answer.

Open-ended energy/cardio examples (Nat Commun Fig. 6 / paper tables) show the same pattern: search ↔ code interleaved; code may run **multiple times** (BMI + AZM, then activity-type mode).

### 2.3 Contrast to baselines (critical for interpreting “gains”)

| Method | Data exposure | Computation | Iteration | Search |
|--------|---------------|-------------|-----------|--------|
| **Numerical Reasoning** | Markdown table of raw daily rows **in the prompt** | LLM does arithmetic in tokens | No | No |
| **Code Generation** | Schema described; code runs once | One-shot Python | No (no Thought recovery) | No |
| **PHIA** | Schema in preamble; **only aggregates/stdout** return to LLM | Multi-step Python | Yes, up to 10 steps | Yes |
| **PH-LLM** | Aggregated coaching summaries | In-model | No tools | No |
| **GPT-4 CoT (Englhardt-style)** | Time-series as text | In-model | Prompted CoT only | No |

---

## 3. How athlete data is exposed to the code interpreter

**This is the most transferable detail.**

### 3.1 Mechanism: in-memory Pandas DataFrames (not a query API)

PHIA does **not** give the LLM a SQL/ClickHouse API. At session start, two (plus profile) tables are loaded into the Python sandbox globals. The LLM writes Pandas against named DataFrames; the executor returns **stdout / expression results only**.

From open-source `phia_agent.py`:

```python
sandbox_globals = {
    "pd": pd,
    "np": np,
    "summary_df": summary_df,
    "activities_df": activities_df,
    "profile": profile_df,
}
```

Libraries allowed (preamble): **`pd`, `np` only** — explicitly **no matplotlib** or other libs.

Paper privacy claim: the LLM “only ever encounters the analysis outcome, which is generally aggregated information or trends” — raw rows are not dumped back into the chat context (unlike the Numerical Reasoning baseline).

### 3.2 Schema (from published `AGENT_PREAMBLE` in `prompt_templates.py`)

**`summary_df`** — one row per day (~31 days in their synthetic eval window):

| Column | Type / meaning |
|--------|----------------|
| `datetime` | date |
| `resting_heart_rate` | bpm |
| `heart_rate_variability` | HRV |
| `fatburn_active_zone_minutes`, `cardio_active_zone_minutes`, `peak_active_zone_minutes`, `active_zone_minutes` | minutes |
| `steps` | daily steps |
| `rem_sleep_minutes`, `deep_sleep_minutes`, `awake_minutes`, `light_sleep_minutes`, `sleep_minutes` | minutes |
| `bed_time`, `wake_up_time` | datetime |
| `stress_management_score` | score |
| `deep_sleep_percent`, `rem_sleep_percent`, `awake_percent`, `light_sleep_percent` | % |

**`activities_df`** — event table (workouts):

| Column | Meaning |
|--------|---------|
| `startTime`, `endTime` | activity window |
| `activityName` | e.g. Run, Walk, Yoga, Treadmill, … |
| `distance` | miles |
| `duration` | minutes |
| `elevationGain` | meters |
| `averageHeartRate` | bpm |
| `calories`, `steps`, `activeZoneMinutes`, `speed` | activity metrics |

**`profile`** (dict-like): `age`, `gender`, `averageDailySteps`, `elderly`, `height_cm`, `weight_kg`.

Synthetic data provenance: CPAR model trained on **30,000** consented Fitbit/Pixel Watch users (Oct 2023 window, ≥10 days); **56** synthetic users generated; **4** used in published eval. Schema also documented in paper Supplement H.1.

**Grain:** daily aggregates + discrete exercise events — **not** second-level HR streams. That choice keeps sandboxes small and Pandas tractable.

---

## 4. Prompt structure & tool scaffolding

### 4.1 Layers

1. **`AGENT_PREAMBLE`** — Fitbit context; pandas/numpy available; schema dump for `summary_df` / `activities_df` / profile; ReAct discipline.  
2. **`PHIA_REACT_PROMPT_TEXT`** — tool list (`name`, `description`, optional example); few-shot ReAct exemplars; current state rendering (`[Question]`, `[Thought]`, `[Act]`, `[Observe]`, `[Finish]`).  
3. **`QUESTION_PREFIX`** — use tools; refuse non-health; tolerate typos; format final answer; use user data when relevant.  
4. **Few-shots** — 20 exemplars selected via sentence-T5 embedding + K-means on query set; each is a full Thought→Act→Observe notebook trajectory (`few_shots/`).

### 4.2 Tool signatures (open-source)

| Tool | Name | Args | Returns |
|------|------|------|---------|
| Python | `tool_code` | `code: str` (markdown-formatted in ReAct) | Captured stdout / last-expression string, or `Error executing code: …` |
| Search | `search` | `query: str` | Top results (paper: Google Search over reputable domains; OSS demo uses **Tavily**, max 5, advanced depth) |
| Finish | `finish` | `answer: str` | Final user-facing text |

Executor behavior (OSS): `exec`/`eval` with stdout redirect; errors returned as strings so the next Thought can recover — this is how the **11.4% recovery** rate is possible.

---

## 5. Benchmark suite & evaluation methodology

### 5.1 Objective Personal Health Insights Queries (automatic)

- **N = 4,000** template-generated questions with ground-truth code answers.  
- Templates by domain experts: metrics × analytic ops × time windows (custom `during()` helper in their DSL).  
- Metric: exact match to **two digits of precision**.  
- Manual review of templates for precision/comprehensibility.

Examples: step count yesterday; yoga session count; mean deep-sleep minutes over 14 days; swim time for sessions ≤40 min; light-sleep % on most recent treadmill day.

### 5.2 Open-Ended Personal Health Insights Queries (human)

- ~3,000 survey queries → stratified sample → **172** final (9 types: Correlation, General Knowledge, Problematic, Min/Max/Avg, Trend, Summary, Compare Time Periods, Compare to Cohort, Anomaly).  
- Held out from agent development.

### 5.3 Human / expert evaluation (~650 hours)

| Track | Who | What | Volume |
|-------|-----|------|--------|
| Reasoning quality | 12 annotators familiar with wearable sleep/fitness | Relevance, interpretation, personalization, domain knowledge, logic, harm, clarity, overall Likert 1–5; ≥3 raters/response; blind | >5,500–6,000 responses; ~600 h |
| Code quality | 7 data scientists (mean ~9 y wearable DS) | Hallucination, column usage, time indexing, interpretation, personalization, overall; raw code+Thoughts+errors shown; ≥3 raters | 595 responses; ~50 h |
| Error taxonomy | 2 experts open-coding | Hallucination, General Code Errors, Misinterpretation of Data, Pandas Operations, Other | Open-ended set |

Scores mapped to 0–100 for reporting. Python translated to English for non-programmer reasoning raters (Gemini Ultra translation pipeline — authors note possible noise).

### 5.4 Synthetic + real data

Synthetic users for main eval; repo also ships deidentified `real_wearable_users`; paper Supplement I mentions additional real-user reasoning eval.

---

## 6. Quantified results (the numbers that matter)

### 6.1 Objective numeric accuracy (4,000 queries, 2-dp exact match)

| System | Accuracy |
|--------|----------|
| **PHIA (ReAct + code + search)** | **84%** (figure bar ~**84.2%**) |
| Code Generation (one-shot Python, same base LM) | **74%** (~**74.4%**) |
| Numerical Reasoning (LLM arithmetic on Markdown table) | **22%** (~**21.6%**) |
| GPT-4 custom CoT over wearable text | **53.6%** |
| PH-LLM (fine-tuned coaching model) | **0%** (cannot handle long daily tables) |

**Relative gains (paper Discussion):**

- vs Numerical Reasoning: **+282%** relative ((84−22)/22), absolute **+62 pp**
- vs Code Generation: **+14%** relative ((84−74)/74), absolute **+10 pp**

**Interpretation for PPD:** Moving from “LLM does math in tokens” → “any code execution” is the huge jump (~22% → ~74%). Adding a multi-step ReAct loop on top of code is a smaller but real lift (~74% → ~84%), plus error recovery.

### 6.2 Open-ended quality (172 queries)

| Metric | PHIA | Code Gen baseline |
|--------|------|-------------------|
| Overall reasoning (scaled Likert) | **68** | **52** |
| Domain knowledge | **63** | **38** |
| Responses ≥ “Fair” (Likert ≥3) | **83%** | (lower; not headline) |
| “Excellent” rate | **2×** baseline | — |
| Significant wins | 9 of 14 axes (blog); paper: all but personalization & harm | — |
| Harm avoidance | Saturated; harm &lt; **0.1%** of cases | Similar saturation |

Largest gains by query type: **General Knowledge** and **Compare to Cohort** (search + iterative reasoning). Near-zero gain on **Personal Min/Max/Avg** (one-shot code already enough).

### 6.3 Code reliability

| Metric | PHIA | Code Gen |
|--------|------|----------|
| Code error rate | **0.192** (19.2%) | **0.395** (39.5%) |
| Recovery after fatal code error | **11.4%** | **0%** |

Error categories reduced under PHIA: hallucinations, misinterpretation, Pandas ops (joins / time indexing), general code errors.

---

## 7. Failure modes

What still goes wrong (even with code):

1. **Wrong column / hallucinated metrics** — references nonexistent columns (annotators called this out explicitly).  
2. **Time-window mistakes** — incorrect date indexing / period selection (expert rubric: “time usage”; not always significantly better than one-shot code).  
3. **Pandas join / multi-table bugs** — reduced but not eliminated.  
4. **Syntax / import / inaccessible library** — sandbox rejects; PHIA can retry (~11% recover).  
5. **Semantic misinterpretation** of the user question (selects wrong analysis).  
6. **Open-ended advice quality** — no medical-expert validation of recommendation *veracity*; not outcome-validated.  
7. **Residual ~16%** wrong on objective numeric tasks — code agents are not “solved.”  
8. **Scope risks** — paper warns against using wearable agents for clinical diagnosis (e.g., cardio advice inappropriate for CHF).

**Implication:** Auditable computation + deterministic metric library still needed even if you adopt a code sandbox; the agent can still write *wrong-but-runnable* code.

---

## 8. Latency, cost, sandboxing — published vs. missing

### Published

| Topic | What’s known |
|-------|----------------|
| Sandbox | “Customized sandbox runtime”; Pandas; OSS: restricted globals (`pd`, `np`, three frames); `exec` with stdout capture; errors returned as strings |
| Privacy design intent | Return aggregates, not raw series, to the LLM context |
| Step budget | OSS `max_steps=10` |
| Eval cost | **650 human hours** cited as reason they didn’t re-run on other LMs |
| Search | Paper: Google Search + reputable domains; OSS demo: Tavily |

### Not published (gap — treat as unknown)

- End-to-end wall-clock latency per query  
- Token / $ cost per query or per ReAct step  
- Isolation tech (gVisor, firecracker, WASM, container limits, CPU/mem quotas)  
- Network egress policy for the sandbox  
- Production rate limits / multi-tenant hardening  

**Stale / demo caveat:** The public repo’s `simple_python_executor` is **not** a production sandbox (plain `exec`). Do not copy that for PPD.

---

## 9. Adoption specification for Peak Performance Data

### 9.1 Equivalent “athlete dataframe” pack

Mirror PHIA’s **two-grain** model (daily summary + event table + profile), assembled **server-side** before the sandbox opens. Do **not** let the LLM query ClickHouse/Postgres directly.

#### A. `athlete_daily_df` (ClickHouse wearables → daily grain)

Suggested columns (adapt to existing CH metrics):

- Keys: `athlete_id`, `date`  
- Sleep: `sleep_minutes`, stage minutes/%, `bed_time`, `wake_time`, sleep score if available  
- Cardiac: `resting_hr`, `hrv_rmssd` (or whatever CH stores), overnight HR summaries  
- Load/activity: `steps`, `active_minutes`, zone minutes, `calories`, training-readiness proxies  
- Coverage flags: `has_sleep`, `has_hrv`, `wear_time_hours` (critical so the agent doesn’t invent missing days)

Window: default **28–42 days** (PHIA used ~31). Cap rows explicitly.

#### B. `sessions_df` (Postgres training + tennis matches → event grain)

Union or parallel frames:

- Training sessions: `start_ts`, `end_ts`, `session_type`, `duration_min`, `rpe`, `planned_load`, `completed`, group/individual flags  
- Matches: `match_id`, `start_ts`, `opponent`, `surface`, `result`, sets/games, serve/rally aggregates you already compute  
- Optional wearable-linked workouts if CH has exercise segments  

#### C. `profile` / `context`

Age/sex bucket, dominant hand, academy id, coach-visible goals, injury flags (boolean, not free text diagnosis), units preference.

#### D. Optional slim frames (only if needed for a query class)

- `match_points_df` — heavy; load **only** when the router selects a tennis-analytics path and with row caps  
- Never load raw second-level HR into the sandbox by default

**Assembly rule:** deterministic ETL job or tool `load_athlete_analysis_pack(athlete_id, start, end)` returns frozen Parquet/Arrow into the sandbox. Log content hash + query window for audit.

### 9.2 Sandbox bounds (PPD must be stricter than PHIA OSS)

| Control | Spec |
|---------|------|
| Isolation | Separate process/container or WASM; no host FS, no network, no credentials |
| Imports | Allowlist: `pandas`, `numpy`, maybe `math`, `statistics`; deny `os`, `subprocess`, `socket`, `requests`, `clickhouse`, `supabase` |
| Time / memory | e.g. 2–5 s CPU, 256–512 MB, max output 32–64 KB |
| Data | Only preloaded frames; read-only copies |
| Side effects | No writes; no plotting files unless explicitly designed |
| Multi-tenancy | One athlete pack per session; never mix org data |
| Tool policy | One tool call per turn; max 6–10 steps; abort + safe message on loop |

### 9.3 Recommended tool signature

Prefer a **hybrid** (see recommendation §10): fixed metrics first; free-form code second.

```typescript
// Fixed, preferred path — numbers from tested Python
run_metric({
  metric_id: "mean_hrv_7d" | "sleep_debt_14d" | "match_win_rate_90d" | ...,
  athlete_id: string,
  params?: { window_days?: number; ... }
}) → {
  value: number | null,
  unit: string,
  provenance: {
    computation_id: string,      // uuid
    metric_version: string,      // semver of function
    source_tables: string[],
    window: { start: string, end: string },
    row_counts: Record<string, number>,
    sql_or_code_hash: string
  }
}

// Escape hatch — PHIA-style, for novel aggregations
execute_analysis_code({
  code: string,                  // must assign RESULT = ...
  athlete_id: string,
  window?: { start: string, end: string }
}) → {
  ok: boolean,
  result: unknown,               // JSON-serializable only
  stdout: string,
  error?: string,
  provenance: {
    computation_id: string,
    code_hash: string,
    frames_loaded: string[],
    window: { start: string, end: string },
    duration_ms: number
  }
}
```

Prompt hard rules (align with PPD constraint):

- Never invent or recalculate physiological numbers in prose.  
- Every number in the final answer must cite a `computation_id`.  
- If `run_metric` / `execute_analysis_code` returns null/error, say data is missing — do not estimate.

### 9.4 Auditability — cite the computation that produced a figure

Store per insight:

```json
{
  "insight_id": "...",
  "figures": [
    {
      "label": "avg_sleep_7d_hours",
      "value": 7.73,
      "computation_id": "cmp_01J...",
      "tool": "execute_analysis_code",
      "code": "RESULT = summary_df.tail(7)['sleep_minutes'].mean() / 60",
      "code_hash": "sha256:...",
      "frames": ["athlete_daily_df@sha256:...", "sessions_df@sha256:..."],
      "window": {"start": "2026-07-01", "end": "2026-07-31"},
      "observed_at": "2026-08-02T12:00:00Z"
    }
  ]
}
```

UI/coach view: “7.73 h avg sleep” → expand to code + window + row count. Replay: re-run `code_hash` against frozen pack → must match within epsilon.

For fixed metrics, same structure with `metric_version` instead of free-form code.

### 9.5 When to use search

PHIA’s biggest open-ended gains were **General Knowledge** and **Compare to Cohort**. For an academy product:

- Prefer an **internal knowledge base** (ITF/coach protocols, your own normative tables) over open web.  
- If web search is enabled: domain allowlist, citation required, never override measured numbers.

---

## 10. Build vs. skip — honest assessment

### Case for a PHIA-style code-execution agent

- Text-only numeric reasoning is **catastrophically bad** (~22%). Your hard constraint (“LLM never does arithmetic”) is empirically correct.  
- One-shot code already reaches ~74%; iterative ReAct adds ~10 pp accuracy, halves code errors, enables recovery — valuable for ad-hoc coach questions (“sleep on nights after 3-set matches?”).  
- Tennis + wearables + training create **combinatorial** questions you will never fully pre-register as metrics.  
- Privacy-shaped design (aggregates back to LLM) fits academy multi-tenant concerns if sandboxed properly.

### Case against (esp. for a platform of PPD’s size)

- PHIA still **wrong 16%** of the time on objective numeric tasks — unacceptable for coach-facing physiology without audit/replay.  
- Wrong-but-runnable Pandas is a silent failure mode; fixed metric libraries + tests catch this.  
- Production sandboxing, pack assembly from CH+Postgres, audit store, and eval harness are **real eng cost**; Google’s public demo `exec` is not that system.  
- Latency/cost of 5–10 LLM rounds + code + optional search is heavy for interactive chat vs. one `run_metric` call.  
- Paper gains on open-ended quality partly from **web search**, not code; for academies, curated knowledge may replace search cheaper.  
- Many high-value academy queries *are* Min/Max/Avg/Trend — where PHIA ≈ one-shot code.  
- You already need (or will need) a deterministic metric layer for dashboards, nightly insights, and regression tests — that layer alone solves the “no arithmetic in tokens” constraint for the 80% path.

### Recommendation

**Do not build full PHIA as v1.**  

**Build this sequence:**

1. **Now:** Fixed library of deterministic Python metric functions (`run_metric`) over ClickHouse/Postgres, with `computation_id` provenance on every figure. This satisfies the hard numeric constraint with testable correctness.  
2. **Soon:** Thin “analysis pack” materialization (daily + sessions DataFrames) used **inside those functions**, not by the LLM.  
3. **Later / optional:** Add sandboxed `execute_analysis_code` as an escape hatch for novel coach questions, behind feature flag, with max steps, audit replay, and a small objective eval suite adapted from PHIA’s 4000-query idea (tennis/wearable templates). Require that free-form code assign `RESULT` and that the final answer only quote audited numbers.  
4. **Skip for now:** Open-web search in the agent loop; use internal norms docs instead.

**Verdict:** Code execution is **worth having eventually** as a constrained tool, but **not** as the primary architecture. A fixed metric library is sufficient (and safer) for a sports-performance platform of this size until ad-hoc query volume and eval maturity justify the sandbox. The PHIA paper’s strongest lesson for PPD is not “copy ReAct+search” — it is **never let the LLM touch raw arithmetic; expose a small tabular pack; return only computed observations; audit every figure.**

---

## 11. Quick reference — control-flow reproduction

```
system: preamble(schema of summary_df, activities_df, profile) + tool list + 20 few-shots
user: QUESTION_PREFIX + natural language question

loop i in 1..max_steps:
  model → Thought + single Act
  if Act == tool_code(code):
      Observe = sandbox.exec(code, globals={pd,np,summary_df,activities_df,profile})
  elif Act == search(q):
      Observe = search_api(q)   # PPD: prefer internal KB
  elif Act == finish(answer):
      return answer  # must only contain numbers seen in prior Observes / metric tools
  append Observe to state

if max_steps exceeded: force_finish or fail closed
```

---

## 12. Staleness checklist

| Item | Freshness |
|------|-----------|
| Nature Comm publication Jan 2026 | **Current** peer-reviewed source |
| Blog June 2024 | Architecture still valid; model names stale |
| Gemini 1.0 Ultra results | Absolute % may be outdated; relative pattern likely holds |
| Fitbit-centric schema | Transfer patterns, not columns |
| OSS Tavily + bare `exec` | Research demo — **not** production guidance |
| No published latency/$ | Unknown for capacity planning |

---

## Citation

Merrill, M.A., Paruchuri, A., Rezaei, N. et al. Transforming wearable data into personal health insights using large language model agents. *Nature Communications* **17**, 1143 (2026). https://doi.org/10.1038/s41467-025-67922-y  

Preprint: arXiv:2406.06464 — https://arxiv.org/abs/2406.06464  

Blog: https://research.google/blog/advancing-personal-health-and-wellness-insights-with-ai/  

Code: https://github.com/yahskapar/personal-health-insights-agent  
