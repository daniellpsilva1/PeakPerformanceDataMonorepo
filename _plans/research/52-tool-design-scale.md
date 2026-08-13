# 52 — Tool Design & Selection at Scale for LLM Agents

**Scope:** External research dossier on principled tool architecture for a multi-agent Python sports-performance system migrating from ~121 TypeScript tools (brittle English-keyword router; ~47–96 tools per request) to a smaller Python tool surface.  
**Method:** Web search + primary-source fetch only. No local codebase exploration.  
**Date:** 2026-08-02  
**Priority window:** 2025–2026 sources.

---

## Verdict (TL;DR)

| Question | Answer |
|---|---|
| Target tool count | **~20–28 consolidated tools** in the registry; **8–12 always loaded** per turn; long-tail via semantic tool search. Get from 121 → ~24 by collapsing per-metric / per-entity narrow tools into parameterized domain tools. |
| Selection strategy | Replace keyword routing with **multilingual embedding retrieval over tool descriptions** (+ optional BM25 hybrid), then hand the model a shortlist of **K≈5–10** (+ always-on core). Language-agnostic by construction. |
| Result envelope | Every tool returns `{ ok, status, data, error, meta }` with units/labels, empty-result handling, truncation + continuation hints, and actionable error codes. |
| Code-execution-over-tools? | **Defer as primary pattern.** Use it later for multi-step aggregation / large-result filtering in a sandbox. Keep Postgres/ClickHouse behind **parameterized Python tools** (not model-authored SQL). Prefer Tool Search + consolidation first. |

---

## 1. Anthropic: Writing Effective Tools for Agents

**Primary source:** [Writing effective tools for AI agents—using AI agents](https://www.anthropic.com/engineering/writing-tools-for-agents) (Sep 11, 2025).

Anthropic frames tools as contracts between **deterministic systems and non-deterministic agents**. Design for agent affordances (limited context, fuzzy intent), not for other developers wrapping REST endpoints 1:1.

### 1.1 Choosing which tools to implement

Concrete recommendations reproduced from the article:

- **More tools do not always improve outcomes.** Avoid wrapping every API endpoint as a tool.
- Build a **small set of high-impact workflow tools** matched to real evaluation tasks; scale up from there.
- Prefer tools that match how humans subdivide work (skip irrelevant context; don’t force brute-force scans of large lists).
- **Consolidate multi-step / always-chained operations** into one tool that does enrichment + composition under the hood.

Their before/after examples:

| Instead of… | Prefer… |
|---|---|
| `list_users` + `list_events` + `create_event` | `schedule_event` (finds availability and schedules) |
| `read_logs` (dump everything) | `search_logs` (relevant lines + surrounding context) |
| `get_customer_by_id` + `list_transactions` + `list_notes` | `get_customer_context` (compiled relevant context) |

Also: each tool needs a **clear, distinct purpose**. Overlapping tools distract agents from efficient strategies.

### 1.2 Naming & namespacing

- Namespace related tools under common prefixes by **service** (`asana_search`, `jira_search`) and/or **resource** (`asana_projects_search`, `asana_users_search`).
- Prefix vs suffix namespacing has **non-trivial effects on selection accuracy**; choose via your own evals (effects vary by model).
- Names should reflect natural task subdivisions so the model can pick without reading every description in depth.

Anthropic’s MCP/tool-design guide reinforces `verb_noun` clarity and sibling disambiguation in descriptions ([tool-design.md](https://raw.githubusercontent.com/anthropics/claude-plugins-official/main/plugins/mcp-server-dev/skills/build-mcp-server/references/tool-design.md)):

```
get_user — Fetch a user by ID. If you only have an email, use find_user_by_email.
find_user_by_email — Look up a user by email. Returns null if not found.
```

### 1.3 Descriptions as prompts

- Treat name + description + parameter docs as **prompt engineering** loaded every turn.
- Describe tools as you would to a **new hire**: niche terminology, query formats, resource relationships — make implicit knowledge explicit.
- Name parameters unambiguously (`user_id` not `user`).
- Small description refinements can yield large gains (Anthropic cites SWE-bench Verified improvements after precise tool-description edits on Claude Sonnet 3.5).
- MCP Directory guidance: descriptions must **not** instruct the model how to behave (“always do X”, override system prompt) — that is treated as prompt injection at review.

### 1.4 Token-efficient responses

- Prefer **high-signal fields**: `name`, `image_url`, `file_type` over opaque `uuid`, `256px_image_url`, `mime_type`.
- Resolve arbitrary UUIDs to **semantic names or 0-indexed IDs** when possible — Anthropic reports this **significantly improves retrieval precision** and reduces hallucinations.
- Expose a `response_format` enum (`concise` | `detailed`) so the agent can request IDs only when needed for follow-up calls. Their Slack example: detailed ~206 tokens vs concise ~72 tokens (~⅓).
- Implement **pagination, range selection, filtering, and/or truncation** with sensible defaults. Claude Code defaults to **~25,000 tokens** max tool response.
- On truncation, **steer** the agent: e.g. suggest narrower filters / paginated follow-ups rather than silent cutoffs.
- Response structure (JSON vs XML vs Markdown) is task-dependent; pick via evals.

### 1.5 Error message design

Anthropic’s concrete stance: **prompt-engineer errors**. Bad errors are opaque codes/tracebacks; good errors name the problem and the next action.

From their MCP tool-design reference:

```text
Item {id} not found. Use search_items to find valid IDs.
```

Unhelpful → helpful pattern (paraphrased from the Sep 2025 post):

| Unhelpful | Helpful |
|---|---|
| `Error: INVALID_ARGUMENT` | `start_date must be ISO-8601 (YYYY-MM-DD). You passed "08/01/2025". Example: "2025-08-01".` |
| Truncation with no hint | `Showing 10 of 847. Narrow with filters or request page=2.` |

### 1.6 Evaluate tools with agents

Anthropic’s recommended loop:

1. **Prototype** tools (local MCP / Desktop extension / direct API).
2. **Generate eval tasks** from real workflows — multi-step, realistic data; not toy sandboxes.
3. Pair each prompt with a **verifiable outcome** (string match or LLM judge; avoid over-strict format matching).
4. Optionally record expected tools, but **don’t overfit** — multiple valid paths exist.
5. Run simple agentic loops; collect accuracy, runtime, tool-call count, token use, error rates.
6. Instruct agents to emit **reasoning/feedback** (or use interleaved thinking) before/around tool calls.
7. **Feed transcripts back into Claude Code** to refactor descriptions/schemas/implementations.
8. Hold out a **test set** to avoid overfitting training evals.

Strong vs weak task examples (from the article):

- Strong: “Schedule a meeting with Jane next week about Acme; attach last planning notes; reserve a room.”
- Weak: “Schedule a meeting with jane@acme.corp next week.”

---

## 2. Evidence: How Many Tools Before Accuracy Degrades?

There is no single hard protocol limit. Degradation is empirical and driven by **context crowding + semantic overlap**.

### 2.1 Anthropic operational guidance

| Source | Guidance |
|---|---|
| [tool-design.md](https://raw.githubusercontent.com/anthropics/claude-plugins-official/main/plugins/mcp-server-dev/skills/build-mcp-server/references/tool-design.md) | **1–15** sweet spot; **15–30** workable (audit duplicates); **30+** switch to search + execute; keep top 3–5 dedicated |
| [Advanced tool use](https://www.anthropic.com/engineering/advanced-tool-use) (Nov 24, 2025) | Use Tool Search when definitions **>10K tokens**, **10+ tools**, or selection accuracy issues; keep **3–5** most-used always loaded |
| Same post | Example: 58 tools ≈ **55K tokens** before chat; Tool Search cut ~**77K → ~8.7K** (~85%) |
| Same post | MCP eval accuracy with Tool Search: **Opus 4: 49% → 74%**; **Opus 4.5: 79.5% → 88.1%** |

### 2.2 Measured selection accuracy vs catalog size

**HumanMCP** (arXiv [2602.23367](https://doi.org/10.48550/arxiv.2602.23367), Dec 2025 / Open MIND) — one correct tool + N−1 distractors; Top-1 hit rate:

| Model | 10 tools | 50 tools | 100 tools | Δ (10→100) |
|---|---:|---:|---:|---:|
| GPT-4o-mini | 98.2% | 92.4% | 88.2% | −10.0 |
| Claude 3.5 Haiku | 97.8% | 91.9% | 88.6% | −9.2 |
| Gemini 2.0 Flash | 98.4% | 93.6% | 88.2% | −10.2 |

Long-context scaling (Gemini 2.0 Flash): **87.4% @ 500 → 65% @ 2,000** tools. Sharpest drop between 1,000 and 2,000.

RAG mitigation at 2,000 tools (retrieve top-10, then Gemini selects):

| Retriever | Top-10 hit | End-to-end accuracy |
|---|---:|---:|
| SentenceTransformer | 87.6% | **76%** |
| TF–IDF | 75.2% | 68% |
| BM25 | 61.1% | 59% |
| Gemini alone (all 2,000) | — | 65% |

**Implication:** retrieval quality is the ceiling — LLM accuracy never exceeds Top-K hit rate; even with correct tool in shortlist, ~10–15% mis-selection remains.

**Semantic Tool Discovery for MCP** (arXiv [2603.20313](https://arxiv.org/html/2603.20313), 2026): dense retrieval shortlists **3–5** tools from 50–100+ catalogs; reported **99.6%** tool-token reduction, **97.1% hit@K=3**, **MRR 0.91** on 140 queries / **121 tools** (coincidentally our legacy count).

**How Many Tools Should an LLM Agent See?** (arXiv [2605.24660](https://arxiv.gg/abs/2605.24660), 2026): Bits-over-Random (BoR) for adaptive shortlist depth. On BFCL (370 tools), adaptive policy ≈ coverage of showing 50 tools (**90.3% vs 90.8%**) while presenting **~7** on average. Downstream with Claude Sonnet 4.6: shorter adaptive lists beat fixed-5 (**93.1% vs 87.1%** selection when correct tool present).

**ComplexFuncBench / multi-domain stress** (summarized in [How Tool Complexity Impacts Selection Accuracy](https://achan2013.medium.com/how-tool-complexity-impacts-ai-agents-selection-accuracy-a3b6280ddce5)): calendar scheduling accuracy for gpt-4o collapsed from **43%** (1 domain, 4 tools) to **2%** (7 domains, 51 tools); customer support from **58% → 26%** under the same expansion. Irrelevant tools + multi-domain noise hurt more than raw count alone.

**Scaling laws with context length** (clawRxiv [2604.01955](https://clawrxiv.io/abs/2604.01955), 2026): tool-selection accuracy follows roughly `acc(n) = a − b log n` across context lengths 4K–128K; mean accuracy ~**0.873 @ 8K** → ~**0.741 @ 64K**. Even when the gold schema is early in context, long contexts still hurt.

### 2.3 Practical takeaway for our ~47–96 tools/request problem

At **~50–100** tools in context, expect roughly **~10pp** selection degradation vs a 10-tool shortlist on modern mid-tier models, plus token tax of tens of thousands of tokens. Our legacy path (47–96 tools) sits squarely in the degradation zone. Target: **≤15 schemas in context per turn**, preferably **≤10**, via consolidation + retrieval.

---

## 3. Techniques for Large Tool Catalogs

### 3.1 Semantic tool retrieval / RAG over descriptions

Index each tool’s name + description (+ parameter summary, domain tags, example utterances in multiple languages). At request time:

1. Embed the user message (multilingual model).
2. Retrieve top-K tools (K=5–10).
3. Optionally hybridize with BM25 for exact entity/metric names (`HRV`, `VO2`, tournament codes).
4. Always union with a small **core** set (search athlete, resolve IDs, clarify, memory).
5. Pass only that shortlist’s full JSON schemas to the model.

Evidence above (HumanMCP, Semantic Tool Discovery, BoR paper) supports this as the default scaling strategy.

### 3.2 Hierarchical / namespaced tools

- Prefix by domain: `athlete_`, `training_`, `tennis_`, `wearable_`, `tournament_`, `admin_`.
- Optionally two-level: router agent picks a **namespace**, specialist sees only that namespace’s tools (multi-agent variant).
- Anthropic: namespacing improves selection when catalogs grow; evaluate prefix vs suffix.

### 3.3 Tool search as a meta-tool

Anthropic **Tool Search Tool** ([Advanced tool use](https://www.anthropic.com/engineering/advanced-tool-use), Nov 24, 2025):

- Register all tools with the API but set `defer_loading: true` on most.
- Model sees search tool + a few always-loaded tools.
- Model searches (regex / BM25 / custom embeddings); matched tools expand into context.
- Prompt-cache friendly: deferred tools excluded from initial prompt.
- Custom search tools can use embeddings — relevant for multilingual sports queries.

### 3.4 Progressive disclosure

Disclose tool surface in layers:

1. **Catalog index** — names + one-line summaries (~10–15 tokens each).
2. **Full schema** — loaded only for selected tools.
3. **Detailed response format** — IDs/raw rows only when `response_format=detailed`.

Anthropic’s code-execution MCP post also suggests a `search_tools` meta-tool with a **detail-level** parameter: name only → name+description → full schema.

### 3.5 Code execution instead of (many) tool calls

**Primary source:** [Code execution with MCP: building more efficient AI agents](https://www.anthropic.com/engineering/code-execution-with-mcp) (Nov 4, 2025). Closely related: **Programmatic Tool Calling** in [Advanced tool use](https://www.anthropic.com/engineering/advanced-tool-use) (Nov 24, 2025). Cloudflare’s “Code Mode” is cited as convergent.

#### The argument, carefully stated

Traditional tool calling has two scaling failures:

1. **Definition tax** — hundreds/thousands of tool schemas loaded up front (example: ~150K tokens).
2. **Intermediate-result tax** — every tool result returns into the model context; large payloads (transcripts, sheets, log dumps) are copied again into the next call’s arguments.

Anthropic’s pattern: **do not expose each MCP tool as a model-callable function**. Instead:

1. Generate a **filesystem of typed modules** (`servers/google-drive/getDocument.ts`, `servers/salesforce/updateRecord.ts`, …).
2. The agent **discovers** tools by listing/reading files (or `search_tools`).
3. The agent **writes code** that imports and composes those functions.
4. Code runs in a **sandbox**; intermediate data stays in the runtime.
5. Only what the code `console.log`s / returns enters model context.

Reported example: Drive → Salesforce workflow **150,000 → 2,000 tokens (98.7% reduction)**.

Additional benefits claimed:

- Filter/aggregate large tables in code (show 5 of 10,000 rows).
- Loops/conditionals without N inference round-trips.
- Privacy: PII can flow tool→tool with tokenization so the model never sees raw emails/phones.
- Persist intermediate files / reusable “skills”.

Costs Anthropic explicitly flags: sandboxing, resource limits, monitoring, operational complexity.

**Programmatic Tool Calling** (Nov 24) is the platformized cousin: model writes Python that calls your tools; tool results feed the **script**, not the model, until the script emits a summary. Example budget-compliance workflow: 20 people × expense rows stays out of context; model sees only who exceeded limits. Reported ~**37%** token reduction on complex research tasks in Anthropic’s numbers (secondary summary: 43,588 → 27,297).

---

## 4. Consolidation: Fewer Parameterized Tools Without Losing Precision

### 4.1 Principles

From Anthropic + OpenAI function-calling best practices ([OpenAI Function calling](https://developers.openai.com/api/docs/guides/function-calling)):

- Combine functions **always called in sequence**.
- Prefer one tool with **enums / structured params** over N near-duplicate tools.
- Keep **read vs write** separate (MCP Directory hard requirement).
- Avoid a single tool with `action: create|edit|delete` that morphs schema by mode — that creates conditional schemas models misuse. Prefer separate write tools, or a read tool + distinct mutation tools.
- Precision comes from **tight schemas** (enums, bounds, formats), not from tool sprawl.

### 4.2 Concrete before → after (generic)

**Before (12 tools):**
`get_hrv`, `get_rhr`, `get_sleep_score`, `get_readiness`, `get_strain`, `get_steps`, `get_vo2`, `get_calories`, `get_hr_zones`, `get_recovery`, `get_body_battery`, `get_stress`

**After (1 tool):**
`get_athlete_metrics(athlete_id, metrics: MetricEnum[], start, end, granularity, response_format)`

Where `MetricEnum = hrv | rhr | sleep_score | readiness | …` and the implementation fans out to ClickHouse/Postgres.

**Before:** `list_contacts` → agent scans thousands of rows.  
**After:** `search_contacts(query, limit=20)`.

**Before:** `get_customer_by_id` + `list_transactions` + `list_notes`.  
**After:** `get_customer_context(customer_id, include=[transactions, notes], lookback_days=90)`.

### 4.3 Sports-domain merge examples (recommended)

| Legacy cluster (illustrative) | Consolidated tool | Key parameters |
|---|---|---|
| 12× per-metric wearable getters | `wearable_get_metrics` | `athlete_id`, `metrics[]` enum, `start`, `end`, `granularity` |
| Separate tennis serve / rally / break / winners tools | `tennis_get_match_stats` | `match_id` \| search keys, `stat_groups[]` enum (`serve`, `return`, `rally`, `pressure`, …) |
| Per-chart / per-graph fetchers | `analytics_query` | `domain` enum, `chart_key` enum, date range, filters |
| Athlete search / get / roster variants | `athlete_resolve` + `athlete_get_profile` | resolve by name/fuzzy; profile with `sections[]` |
| Training plan list / session detail / attendance | `training_get` | `view` enum (`plan`, `session`, `attendance`, `load`), IDs + dates |
| Tournament list / draw / results | `tournament_get` | `view` enum, filters |
| Memory remember / recall / forget | `memory_manage` | `op` enum (`upsert`, `search`, `delete`) — *or* keep write ops separate if destructive |
| Message / notify / email | `comms_send` | `channel` enum, requires confirmation |
| Admin create/update/delete athlete | Split: `admin_upsert_athlete`, `admin_archive_athlete` | never mix with reads |

**Precision preservation tactics:**

- Enums for metric/stat/view keys (closed vocabulary).
- Server-side validation rejects unknown metrics with a list of valid ones.
- `sections` / `stat_groups` arrays let the model request only what it needs (GraphQL-like).
- Return **labeled series with units** so the model doesn’t invent “ms” vs “ms²” for HRV.

---

## 5. Output Design: Shaping Tool Results for Models

Synthesized from Anthropic writing-tools post + MCP tool-design reference + production practice.

### 5.1 What good results look like

- **Semantic labels** over raw column names (`sleep_score` not `col_17`).
- **Units in-band**: `{ "value": 62, "unit": "ms", "label": "rMSSD HRV" }`.
- **Stable entity handles** the model can reuse: prefer `athlete_ref` / slug / short id returned from a resolve step; document that IDs must come from prior tool output.
- **Empty results are first-class**, not exceptions: `status: "empty"` + suggestion (`widen date range`, `check athlete_id`).
- **Truncation with continuation**: `meta.truncated=true`, `meta.next_page`, `meta.hint`.
- **Errors that teach self-correction**: code + message + `recovery_hint` + optional `valid_values`.

### 5.2 Error taxonomy (model-actionable)

| Code | Meaning | Model should… |
|---|---|---|
| `VALIDATION_ERROR` | Bad/missing args | Fix args using `valid_values` / schema hint |
| `NOT_FOUND` | Entity missing | Search/resolve, then retry |
| `EMPTY_RESULT` | Query ok, no rows | Broaden filters or explain to user |
| `PERMISSION_DENIED` | AuthZ failure | Stop / ask user; do not invent data |
| `RATE_LIMITED` | Backoff | Retry later or reduce scope |
| `UPSTREAM_TIMEOUT` | DB/API timeout | Narrow range or retry once |
| `CONFIRMATION_REQUIRED` | Destructive pending | Ask user; resubmit with `confirm_token` |
| `INTERNAL_ERROR` | Unexpected | Report failure; don’t hallucinate |

### 5.3 Truncation pattern

```json
{
  "ok": true,
  "status": "partial",
  "data": { "rows": [/* first 50 */] },
  "error": null,
  "meta": {
    "truncated": true,
    "returned": 50,
    "total_estimate": 847,
    "next_page": 2,
    "hint": "Showing 50 of ~847. Pass page=2 or add filters (metric, date) to narrow."
  }
}
```

---

## 6. Tool Schema Design

### 6.1 JSON Schema vs Pydantic

| Layer | Role |
|---|---|
| **Pydantic models** (Python source of truth) | Validation, defaults, enums, OpenAPI/JSON Schema export, typed handlers |
| **JSON Schema** (wire format to the model) | What the LLM API actually consumes |

**Recommendation for our Python service:** define tools in **Pydantic** (or equivalent), export JSON Schema for the provider, and **re-validate** every model-produced argument server-side before execution. Strict mode (OpenAI `strict: true` / provider constrained decoding) reduces but does not replace server validation.

OpenAI guidance ([Function calling](https://developers.openai.com/api/docs/guides/function-calling)):

- Describe purpose of function and each parameter.
- Use enums/objects so invalid states are unrepresentable.
- Don’t ask the model for args you already know (inject `org_id` / `user_id` in code).
- Combine sequentially chained functions.
- Pass the “intern test”: could a new hire use this from the docs alone?

Anthropic MCP guidance: tight constraints (`enum`, `min`/`max`, regex for ID formats); describe every parameter.

### 6.2 Enums vs free strings

- **Enums** for closed sets: metrics, sports, surfaces, plan views, message channels.
- **Free strings** only for open text (search queries, note bodies).
- For semi-open sets (chart keys that grow), use enum of known keys **plus** server rejection that returns the current valid list — never silent ignore.

### 6.3 Preventing hallucinated IDs

Patterns that work in practice (Anthropic + OpenAI + agent literature):

1. **Resolve-then-act:** `athlete_resolve(name)` → returns canonical `athlete_id`; mutations/reads require that ID.
2. **Description sourcing rules:** “`athlete_id` MUST come from `athlete_resolve` or prior tool output; never invent UUIDs.”
3. **Format constraints:** regex / UUID format in schema; still validate existence in DB.
4. **Soft IDs:** return `athlete_ref` short codes (`A1`, `A2`) in concise mode within a session; map server-side.
5. **Server-side existence check** with `NOT_FOUND` + search hint.
6. **Don’t expose raw UUIDs in concise responses** unless needed for the next call (Anthropic `response_format` pattern).

---

## 7. Side-Effect Classification & Permissioning

### 7.1 MCP annotation vocabulary

From MCP tool annotations (spec + Anthropic Directory requirements + [Outreach annotations docs](https://developers.outreach.io/mcp-server/tool-annotations)):

| Annotation | Meaning | Typical host UX |
|---|---|---|
| `readOnlyHint: true` | No state change | May auto-approve |
| `destructiveHint: true` | Deletes/overwrites | Confirmation dialog |
| `idempotentHint: true` | Safe to retry | Auto-retry on transient errors |
| `openWorldHint: true` | Hits external systems | Network / trust indicator |

**Critical:** annotations are **hints, not a security boundary**. Clients must treat them as untrusted unless the server is trusted. Enforce real authZ in the tool runtime (org/role/athlete scope).

Anthropic Directory hard rules:

- Every tool must include `readOnlyHint`, `destructiveHint`, and `title`.
- **Read and write must be separate tools** — a GET+POST combo tool is rejected even if the description documents safety.

### 7.2 Confirmation patterns for destructive tools

Recommended pattern for our platform:

1. Classify tools: `read` | `write_additive` | `write_destructive` | `external_side_effect` (email/SMS).
2. Reads: auto-run under authZ.
3. Destructive / external: tool returns `CONFIRMATION_REQUIRED` with a **server-issued `confirm_token`** (TTL, bound to user, action hash, args hash) — **not** a model-invented flag.
4. Agent asks the user in natural language (any locale).
5. On user yes, agent re-invokes with `confirm_token`.
6. Idempotency keys on creates/sends to prevent double-send on retries.

System-prompt-only “please confirm” is insufficient alone; bind confirmation in the **tool layer**.

---

## 8. Benchmarks & Current Rankings (as of research date)

### 8.1 BFCL — Berkeley Function Calling Leaderboard V4

- **Site:** [gorilla.cs.berkeley.edu/leaderboard](https://gorilla.cs.berkeley.edu/leaderboard) (last updated **2026-04-12** on the official page).
- **Paper:** Patil et al., ICML 2025 — [The Berkeley Function Calling Leaderboard](https://gorilla.cs.berkeley.edu/leaderboard).
- V4 adds agentic evaluation: web search, memory backends, format sensitivity, hallucination resistance (relevance/irrelevance), plus classic single/multi-turn AST & state checks.

**Snapshot rankings (overall accuracy, FC = native tool calling)** — mirrored from [agentsdirectory BFCL V4](https://agentsdirectory.dev/benchmarks/bfcl) (April 2026 board; notes that newer 2026 frontier models may be absent):

| Rank | Model | Score |
|---:|---|---:|
| 1 | Claude Opus 4.5 (FC) | **77.47%** |
| 2 | Claude Sonnet 4.5 (FC) | 73.24% |
| 3 | Gemini 3 Pro (Prompt) | 72.51% |
| 4 | GLM 4.6 (FC, Thinking) | 72.38% |
| 5 | Claude Haiku 4.5 (FC) | 68.7% |
| 6 | Gemini 3 Pro (FC) | 68.14% |
| 7 | o3 (Prompt) | 63.05% |
| 8 | Kimi K2 0711 (FC) | 59.06% |
| 9 | DeepSeek V3.2 Exp (Prompt, Thinking) | 56.73% |
| 10 | Gemini 2.5 Flash (FC) | 56.24% |
| 11 | GPT-5.2 (FC) | 55.87% |
| 12 | GPT-5 Mini (FC) | 55.46% |

Secondary aggregators (e.g. [llm-stats BFCL-V4](https://llm-stats.com/benchmarks/bfcl-v4), July 2026) show partial boards led by Qwen3.7 Max (~75%) on a smaller evaluated subset — treat official Gorilla CSV as source of truth when comparing.

### 8.2 τ-bench family (τ / τ² / τ³)

- **Original τ-bench** (June 2024): tool–agent–user interaction; airline & retail; `pass^k` reliability.
- **τ²-bench** (June 2025): dual-control (user can also act); adds telecom — [paper](https://github.com/sierra-research/tau2-bench).
- **τ³-bench** (2026): task audits; **τ-knowledge** (banking + ~700-doc KB); **τ-voice** (full-duplex voice). Live board: [taubench.com](https://taubench.com/).

**Live leaderboard snapshots (Pass^1, from taubench.com as of fetch):**

| Track | #1 | #2 | #3 |
|---|---|---|---|
| τ³-Banking (text + knowledge) | GPT-5.5 **46.4%** | GPT-5.4 39.4% | GPT-5.2 32.2% |
| τ³-Voice | grok-voice-think-fast-1.0 **67.3%** | gemini-3.1-flash-live… 43.8% | gpt-realtime-2 42.4% |
| τ²-bench (Retail·Airline·Telecom) | GLM-5.2 **90.9%** | Qwen3.5-397B-A17B 87.9% | Gemini 3.0 Pro 85.4% |

**Note:** Do not merge τ / τ² / τ³ scores — tasks and simulators differ. Knowledge-intensive banking remains far harder than τ² retail/airline/telecom.

### 8.3 Other 2025–2026 successors / related

- **MCPToolBench++**, **MCP-Bench**, **MCP-AgentBench**, **TOUCAN** (1.5M trajectories), **HumanMCP** — MCP-era evals focused on realistic tool catalogs and retrieval.
- Anthropic internal MCP evals with Tool Search (accuracy lifts cited in §2.1).

---

## 9. Concrete Architecture Proposal for Peak Performance

### 9.1 Target tool count and migration path

**Target steady state**

| Layer | Count | Role |
|---|---:|---|
| Registry (implemented tools) | **20–28** | Consolidated, namespaced Python tools |
| Always loaded per turn | **8–12** | Core resolve/search + 1–2 domain hot paths |
| Retrieved / deferred | remainder | Semantic tool search shortlist |
| Hard ceiling in model context | **≤15** full schemas | Prefer **≤10** |

**Path from 121 → ~24**

1. **Inventory & cluster** legacy TS tools by resource × verb (athlete, wearable metric, tennis match, training, tournament, comms, admin, memory, analytics).
2. **Merge** per-metric and per-stat tools into parameterized getters (§4.3).
3. **Merge** “list everything” into search/context tools.
4. **Split** any read/write hybrids.
5. **Delete** tools that only exist because of REST wrapping and are unused in evals.
6. Keep a **escape-hatch** only if evals demand it — not by default.
7. Freeze a **gold eval set** (EN/ES/CA/ZH) before/after consolidation; Anthropic-style agent feedback loop on descriptions.

Illustrative end-state catalog (~24):

```
core_ping / core_clarify
athlete_resolve
athlete_get_profile
athlete_search_roster
wearable_get_metrics
wearable_get_activities
wearable_compare_athletes
tennis_search_matches
tennis_get_match_stats
tennis_get_player_trends
training_get
training_upsert_session          # write, confirm if destructive policies say so
tournament_get
analytics_query
memory_search
memory_upsert
memory_delete                    # destructive + confirm
comms_draft                      # no send
comms_send                       # external_side_effect + confirm
admin_upsert_athlete             # write + confirm
admin_archive_athlete            # destructive + confirm
org_get_policies
research_search_papers           # if in scope
tool_search                      # meta: semantic retrieval over catalog
```

### 9.2 Multilingual selection strategy (replaces keyword router)

**Do not** maintain EN/ES/CA/ZH keyword maps.

**Recommended pipeline:**

```
user_message (any language)
    → multilingual embed (e.g. multilingual-E5 / equivalent)
    → vector search over tool cards
         tool cards include: name, EN description, translated glosses or
         example utterances in ES/CA/ZH, domain tags, enums
    → hybrid optional BM25 on metric/entity tokens
    → top_K (5–10) ∪ always_on_core (athlete_resolve, tool_search, memory_search, …)
    → bind full schemas for that set only
    → model selects & calls
```

Fallbacks:

- If retrieval confidence low → expose `tool_search` to the model (Anthropic-style meta-tool) rather than dumping the full catalog.
- Multi-agent optional later: supervisor picks domain specialist; specialist has ≤10 tools.

This is language-agnostic, eval-driven, and aligned with HumanMCP/Semantic Tool Discovery results.

### 9.3 Standard tool result envelope

Every Python tool returns the same JSON shape (Pydantic model → serialized):

```json
{
  "ok": true,
  "status": "ok | empty | partial | error",
  "data": {},
  "error": null,
  "meta": {
    "tool": "wearable_get_metrics",
    "request_id": "req_…",
    "athlete_id": "…",
    "units": {},
    "truncated": false,
    "returned": 0,
    "total_estimate": null,
    "next_page": null,
    "hint": null,
    "took_ms": 42
  }
}
```

On failure:

```json
{
  "ok": false,
  "status": "error",
  "data": null,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Unknown metric 'heart_rate_v'.",
    "recovery_hint": "Use one of the metrics enum values.",
    "valid_values": ["hrv", "rhr", "sleep_score", "readiness", "strain"]
  },
  "meta": { "tool": "wearable_get_metrics", "request_id": "req_…" }
}
```

#### Worked example

User (Catalan): *“Com ha estat l’HRV de la Maria l’última setmana?”*

1. Retriever loads `athlete_resolve`, `wearable_get_metrics`, …
2. Model calls `athlete_resolve(query="Maria")` → `{ athlete_id, display_name }`.
3. Model calls:

```json
{
  "athlete_id": "ath_8f3c…",
  "metrics": ["hrv"],
  "start": "2026-07-26",
  "end": "2026-08-02",
  "granularity": "day",
  "response_format": "concise"
}
```

4. Tool returns:

```json
{
  "ok": true,
  "status": "ok",
  "data": {
    "athlete": { "id": "ath_8f3c…", "name": "Maria García" },
    "series": [
      {
        "metric": "hrv",
        "label": "HRV (rMSSD)",
        "unit": "ms",
        "points": [
          { "date": "2026-07-26", "value": 58 },
          { "date": "2026-07-27", "value": 61 },
          { "date": "2026-07-28", "value": 55 },
          { "date": "2026-07-29", "value": 64 },
          { "date": "2026-07-30", "value": 62 },
          { "date": "2026-07-31", "value": 59 },
          { "date": "2026-08-01", "value": 66 }
        ],
        "summary": { "mean": 60.7, "min": 55, "max": 66, "unit": "ms" }
      }
    ]
  },
  "error": null,
  "meta": {
    "tool": "wearable_get_metrics",
    "request_id": "req_9c2a",
    "source": "clickhouse",
    "truncated": false,
    "returned": 7,
    "hint": null,
    "took_ms": 118
  }
}
```

Empty-week variant: `status: "empty"`, `data.series: []`, `meta.hint: "No HRV samples in range. Try widening dates or verify wearable sync."`

### 9.4 Should we adopt code-execution-over-tools?

**Recommendation: not as the primary architecture for v1 of the Python tool service. Adopt consolidation + multilingual tool retrieval first. Revisit programmatic/code execution for specific heavy workflows.**

| Factor | Implication for us |
|---|---|
| Data lives in **Postgres + ClickHouse** | Tools should be **curated query templates** with authZ, not free-form model SQL in a sandbox. |
| Catalog size ~121 → target ~24 | Below Anthropic’s “thousands of MCP tools” pain point after consolidation; definition tax becomes manageable with retrieval. |
| Multilingual UX | Solved by **embedding retrieval**, not by code APIs. |
| Large intermediate payloads | Wearable dumps / match event logs can still bloat context — use **pagination, concise format, server-side aggregation** inside tools; add Programmatic Tool Calling later for multi-athlete batch analytics. |
| Security | Sandbox + DB credentials + model-written code is a large ops/security surface vs parameterized tools. |
| Team skill fit | Python tool handlers + Pydantic schemas align with the new service; code-exec MCP is an additional runtime. |

**When to adopt later:**

- Multi-athlete cohort comparisons that would otherwise pull N full series into context.
- Join-and-filter workflows across tennis + wearable extracts.
- Building reusable “skills” (save aggregated pipelines) as in Anthropic’s post.

**v1 pattern:** parameterized tools → ClickHouse/Postgres; semantic `tool_search`; strict envelopes; confirmation on writes.  
**v2 pattern:** optional sandboxed Programmatic Tool Calling that can invoke the **same** curated tools, never raw SQL.

---

## 10. Implementation Checklist

1. Define Pydantic `ToolResult` envelope + error taxonomy; enforce in a single decorator/middleware.
2. Annotate every tool: `readOnlyHint` / `destructiveHint` / `idempotentHint` / `openWorldHint`.
3. Split read/write; confirmation tokens for destructive/external.
4. Consolidate to 20–28 tools; freeze namespaced naming (`domain_verb_noun`).
5. Build multilingual tool cards + embedding index; kill English keyword router.
6. Always-load core ≤12; retrieve the rest; hard-cap schemas in prompt.
7. Eval harness: EN/ES/CA/ZH tasks; track selection accuracy, arg accuracy, tokens, latency (Anthropic loop).
8. Iterate descriptions with agent-on-agent optimization against held-out set.
9. Defer code-exec sandbox until consolidation + retrieval plateau.

---

## Sources

### Anthropic (primary)

- https://www.anthropic.com/engineering/writing-tools-for-agents (2025-09-11)
- https://www.anthropic.com/engineering/code-execution-with-mcp (2025-11-04)
- https://www.anthropic.com/engineering/advanced-tool-use (2025-11-24)
- https://raw.githubusercontent.com/anthropics/claude-plugins-official/main/plugins/mcp-server-dev/skills/build-mcp-server/references/tool-design.md

### OpenAI

- https://developers.openai.com/api/docs/guides/function-calling

### Measurements & papers

- https://doi.org/10.48550/arxiv.2602.23367 — HumanMCP
- https://arxiv.org/html/2603.20313 — Semantic Tool Discovery for MCP
- https://arxiv.gg/abs/2605.24660 — How Many Tools Should an LLM Agent See? (BoR)
- https://clawrxiv.io/abs/2604.01955 — Scaling Laws of Tool-Use Accuracy with Context Length
- https://achan2013.medium.com/how-tool-complexity-impacts-ai-agents-selection-accuracy-a3b6280ddce5 — ComplexFuncBench / NFCL discussion

### Benchmarks

- https://gorilla.cs.berkeley.edu/leaderboard — BFCL V4
- https://agentsdirectory.dev/benchmarks/bfcl — BFCL V4 ranking snapshot
- https://llm-stats.com/benchmarks/bfcl-v4 — secondary BFCL aggregator
- https://taubench.com/ — τ / τ² / τ³ live leaderboard
- https://github.com/sierra-research/tau2-bench — τ²/τ³ codebase

### MCP annotations / permissioning

- https://developers.outreach.io/mcp-server/tool-annotations
- https://dreaming.press/posts/mcp-tool-annotations-explained.html
- https://mcpblog.dev/blog/2026-03-13-mcp-tool-annotations
- https://stacklok.com/blog/enforcing-mcp-tool-annotation-policies-with-cedar/

### Secondary explainers (used sparingly)

- https://ai-tldr.dev/learn/ai-agents/tool-use/how-to-design-agent-tools/
- https://particula.tech/blog/code-execution-mcp-token-reduction-pattern
- https://archestra.ai/blog/mcp-tool-naming-conventions
