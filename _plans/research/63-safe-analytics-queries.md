# 63 — Safe, Accurate Natural-Language Querying over Structured Data

**Date:** 2026-08-02  
**Scope:** External research on text-to-SQL vs semantic layers vs constrained query builders; security and multi-tenancy controls for LLM-generated analytics; ClickHouse specifics; verification/provenance; a concrete hybrid design for our sports-performance multi-agent system (Supabase Postgres + ClickHouse wearables; coaches asking open-ended analytical questions; hard rule: LLM never invents numbers; org isolation mandatory; Python service currently uses Supabase `service_role`).

**Context:** Coaches will ask questions like “which of my athletes had the biggest drop in first-serve percentage after their load increased in March?” We cannot pre-build a tool for every such question, but free text-to-SQL is not production-reliable and must never leak another organization’s data.

---

## Executive recommendation (tl;dr)

| Decision | Choice |
|---|---|
| **Primary query path (80%)** | **Fixed, typed specialist tools** for high-frequency sports metrics (readiness, ACWR, sleep, serve %, match evolution) — deterministic SQL in code, not LLM-authored |
| **Long-tail path (governed)** | **Constrained query builder over a thin semantic layer** — LLM emits a structured `AnalyticsQuery` (metrics / dimensions / filters / grain), never raw SQL; a compiler produces SQL |
| **Escape hatch (rare, guarded)** | **Guarded text-to-SQL** only against approved analytics views, after AST validation + mandatory tenant rewrite + dry-run explain; never against base tables |
| **Do not ship as default** | Raw warehouse text-to-SQL with `service_role` and no compile-time tenant injection |
| **Multi-tenancy guarantee** | **Compiler / AST rewrite injects `organization_id = :org` into every scope** (independent of the model) + **ClickHouse read-only profile** + **optional per-request user JWT for Supabase RLS as defense-in-depth** |

**Why this combination:** 2025–2026 evidence shows BIRD leaders ~82% EX (still ~11 pp below human); Spider 2.0 / interactive / enterprise settings drop far lower; dbt’s 2026 SL vs text-to-SQL benchmark shows silent failure for free SQL vs loud failure for semantic layers. Our “never invent numbers” rule requires deterministic metric definitions and auditable provenance — which fixed tools + a constrained semantic query API deliver, with guarded SQL only for coverage gaps.

---

## 1. Text-to-SQL in 2026: benchmarks vs production

### 1.1 BIRD leaderboard (as of mid-2026)

Official leaderboard ([bird-bench.github.io](https://bird-bench.github.io/)):

| Rank signal | System | Test EX (%) | Notes |
|---|---|---|---|
| Human | Data engineers + DB students | **92.96** | Dev / human bar |
| #1 overall | AskData + GPT-4o (AT&T CDO, Dec 2025) | **81.95** | Multi-step pipeline + oracle knowledge |
| #2 | Agentar-Scale-SQL (Ant Group, Sep 2025) | **81.67** | |
| #3 | Sber Text2SQL (Jun 2026) | **81.33** | |
| Single frontier model (example) | GPT-5.5-xhigh (Apr 2026) | **~72.55** | Without full agent orchestration |

Sources: [BIRD-bench](https://bird-bench.github.io/), [Beancount research log (2026-06)](https://beancount.io/bean-labs/research-logs/2026/06/06/bird-benchmark-text-to-sql-real-database-gap), [Masood analysis of top BIRD systems](https://medium.com/@adnanmasood/pushing-towards-human-level-text-to-sql-an-analysis-of-top-systems-on-bird-benchmark-666efd211a2d).

Original BIRD paper: GPT-4 ~54.9% EX *with* curated external knowledge evidence; ~34.9% without — a **~20 pp** dependence on per-question hints that real deployments do not get for free ([Li et al., NeurIPS 2023/2024](https://bird-bench.github.io/)).

### 1.2 The enterprise / production cliff

| Benchmark / setting | Typical reported accuracy | Implication |
|---|---|---|
| Spider 1.0 (clean, small schemas) | ~85–91% EX for strong systems | Overstates readiness |
| BIRD (dirty real DBs, 33.4 GB) | Leaders ~80–82% EX; human ~93% | Still ~1 in 5 wrong; gaps closed via elaborate agents, not raw models |
| Spider 2.0 (enterprise workflows; ICLR 2025 Oral) | Early agents **~21%** success (o1-preview era); Lite still hard (Oracle reported **72%** EX@1 on Lite with specialized SOMA-SQL — still not “solved”) | Large schemas (hundreds–thousands of columns), dialects, multi-step workflows |
| BIRD-Interact / LiveSQLBench (interactive, colloquial) | Frontier alone often **teens to mid-30s** success; LiveSQLBench colloquial Gemini-2.5-pro ~28–36% (per BIRD news) | Ambiguity and missing business context dominate |
| dbt 2026 ACME Insurance SL vs SQL (modeled) | Text-to-SQL **84–90%**; Semantic Layer **98–100%** on in-scope questions | Failure mode differs: SQL fails *silently* |

Sources: [Spider 2.0 arXiv:2411.07763](https://arxiv.org/abs/2411.07763), [ICLR 2025 PDF](https://proceedings.iclr.cc/paper_files/paper/2025/file/46c10f6c8ea5aa6f267bcdabcb123f97-Paper-Conference.pdf), [dbt Semantic Layer vs Text-to-SQL 2026](https://docs.getdbt.com/blog/semantic-layer-vs-text-to-sql-2026), [Particula summary](https://particula.tech/blog/text-to-sql-accuracy-benchmarks-semantic-layer), [Colrows accuracy cliff](https://colrows.com/blogs/text-to-sql-accuracy-cliff/), [Towards Data Science on Spider 2.0](https://towardsdatascience.com/why-90-accuracy-in-text-to-sql-is-100-useless/).

### 1.3 Why benchmarks overstate production readiness

Credible critiques converge on five points:

1. **Oracle / hand-written evidence.** BIRD supplies per-question “evidence” sentences. Production agents must retrieve or invent that knowledge; removing evidence historically cost ~20 pp ([Beancount BIRD log](https://beancount.io/bean-labs/research-logs/2026/06/06/bird-benchmark-text-to-sql-real-database-gap)).
2. **Annotation noise.** Audits found wrong gold SQL; rankings *shift* when cleaned — leaderboards partly reward fitting artifacts, not true capability ([Beancount BIRD log](https://beancount.io/bean-labs/research-logs/2026/06/06/bird-benchmark-text-to-sql-real-database-gap)).
3. **Schema scale & ambiguity.** Enterprise warehouses have 1k+ columns, synonym collisions (“load”, “session”, “readiness”), and metric definitions that live outside DDL ([Spider 2.0](https://arxiv.org/abs/2411.07763), [Omni: Why text-to-SQL fails](https://omni.co/blog/why-text-to-sql-fails)).
4. **Silent logical errors.** Wrong join grain / wrong metric definition still *executes* and returns a plausible number — the failure mode that violates our “never invent numbers” rule ([dbt 2026 blog](https://docs.getdbt.com/blog/semantic-layer-vs-text-to-sql-2026)).
5. **Leaderboard systems ≠ product.** Top EX scores come from multi-agent cascades, self-consistency sampling, schema linking, and repair loops — latency/cost unsuitable as a default for every coach chat turn.

**Honest takeaway for us:** treat raw text-to-SQL as **~60–80% on curated sports schemas at best**, with a non-trivial silent-error rate. That is unacceptable for coach-facing KPIs without a governed layer and verification.

---

## 2. Semantic-layer approach

### 2.1 What it is

Define **metrics, dimensions, entities, joins, and (often) access policies** once. The LLM’s job shrinks to: *select the right metric(s) + dimensions + filters + time grain*. A **deterministic compiler** (MetricFlow, Cube, Malloy compiler, or our own) emits SQL.

| Product | Strength for agents | Caveat |
|---|---|---|
| **dbt Semantic Layer (MetricFlow)** | Strong if dbt already owns transforms; 2026 benchmark shows near-perfect in-scope accuracy | Coverage = modeling investment; hop limits historically blocked some questions until models added |
| **Cube** | Explicitly positioned for AI agents (2026); REST/GraphQL/SQL/MCP; **compile-time RLS**; pre-aggregations; Brex Spaces cited as production | Another runtime to operate; Cube Core OSS vs Cube Cloud |
| **Malloy** | Structural prevention of fan-out / grain bugs; semantic query language | Smaller ecosystem; still need serving + tenancy story |
| **Warehouse-native** (Snowflake Semantic Views, Databricks Metric Views) | Convenient if single warehouse | We span **Postgres + ClickHouse** — decoupled layer fits better |

Sources: [dbt 2026 SL vs SQL](https://docs.getdbt.com/blog/semantic-layer-vs-text-to-sql-2026), [Cube: Semantic Layer for AI Agents (2026)](https://cube.dev/articles/semantic-layer-for-ai-agents-2026), [Cube: How to Add AI Analytics (2026)](https://cube.dev/articles/how-to-add-ai-analytics-to-your-product), [Knowi semantic layer comparison 2026](https://www.knowi.com/blog/semantic-layer-tools/), [Omni comparison table](https://omni.co/blog/why-text-to-sql-fails), [IngestThis enterprise SL](https://ingestthis.com/posts/2026/2026-05-24-semantic-layers-text-to-sql).

### 2.2 Does it materially improve correctness and safety?

**Yes, when the question is in-scope — and the failure mode is the real win.**

- dbt 2026 (modeled ACME Insurance): Sonnet 4.6 **90% → 98.2%**, GPT-5.3-codex **84.1% → 100%** when routing through Semantic Layer vs free SQL ([dbt blog](https://docs.getdbt.com/blog/semantic-layer-vs-text-to-sql-2026)).
- Critical production property: **SL fails loudly** (“can’t answer / unknown metric”); text-to-SQL fails with a **plausible wrong number**.
- Cube/Omni: join paths, grain, and metric math leave the prompt; **RLS at compile time** so the agent cannot construct a cross-tenant query ([Cube 2026](https://cube.dev/articles/semantic-layer-for-ai-agents-2026)).
- Frontiers Iceberg agent study (2026): semantic + typed filter path → **100% vs 67%** text-to-SQL baseline and **0% SQL injection** vs prior ~99% attack success on unconstrained SQL ([Frontiers](https://www.frontiersin.org/journals/big-data/articles/10.3389/fdata.2026.1785710/full)).
- Paired arXiv study (2026): even a *soft* markdown semantic document (not a compiler) reduces hallucination vs raw schema in ClickHouse experiments ([arXiv:2604.25149](https://arxiv.org/pdf/2604.25149)) — hard enforcement is still better.

**Production reports (directional):** Brex Spaces built on Cube for embedded AI financial analyst; Cube claims 400+ companies using the layer for BI + agents ([Cube 2026](https://cube.dev/articles/semantic-layer-for-ai-agents-2026)). IngestThis summarizes enterprise deployments moving from ~40% raw to **85–95%** with governed metrics ([IngestThis](https://ingestthis.com/posts/2026/2026-05-24-semantic-layers-text-to-sql)). Treat vendor percentages cautiously; the architectural claim (deterministic compile + loud OOS) is the durable part.

**Trade-off:** coverage only for modeled metrics. That is acceptable if we (a) model the coach KPI surface deliberately and (b) keep an escape hatch with stricter gates.

---

## 3. Constrained query-builder approach

### 3.1 Pattern

Expose a **parameterized analytics API** the LLM fills:

```json
{
  "metrics": ["first_serve_pct", "acwr"],
  "dimensions": ["athlete_id"],
  "filters": [
    {"field": "date", "op": "between", "value": ["2026-03-01", "2026-03-31"]},
    {"field": "surface", "op": "eq", "value": "clay"}
  ],
  "time": {"field": "match_date", "grain": "week", "range": ["2026-01-01", "2026-03-31"]},
  "order_by": [{"metric": "first_serve_pct", "dir": "asc"}],
  "limit": 50
}
```

This is exactly Cube’s REST query shape (`measures`, `dimensions`, `filters`, `timeDimensions`, `limit`) — see [Cube query format](https://docs.cube.dev/reference/core-data-apis/rest-api/query-format).

### 3.2 Accuracy & safety vs free SQL

| Property | Free SQL | Constrained builder |
|---|---|---|
| Join / grain correctness | Model invents | Pre-validated graph |
| Metric definition drift | High | Single certified formula |
| Injection / DDL | Must sanitize strings | Structured JSON → compiler; no SQL string from model |
| Cross-tenant leak | Easy if model omits filter | Tenant forced at compile |
| Expressiveness | Full SQL | Limited to catalog |
| Silent wrong answers | Common | Rare if catalog is correct |
| Eval / unit tests | Hard | Easy (golden `AnalyticsQuery` → golden SQL/result) |

**Assessment:** For our domain, a constrained builder is the **sweet spot between fixed tools and free SQL**. It is essentially a semantic layer with a JSON DSL. Prefer this over “LLM writes ClickHouse SQL” for coach chat.

---

## 4. Security patterns for LLM-generated SQL

Defense in depth — never rely on the model to “be careful.”

### Layer A — Identity & connection

- **Postgres:** dedicated `analytics_readonly` role; `GRANT SELECT` on analytics views only; no INSERT/UPDATE/DELETE/DDL; optional `SET ROLE` / transaction `READ ONLY`.
- **ClickHouse:** settings profile `readonly=1`, `max_execution_time`, `max_memory_usage`, `max_result_rows`, quotas; mark critical settings `READONLY` so the session cannot raise them ([ClickHouse constraints](https://github.com/ClickHouse/ClickHouse/blob/master/docs/en/operations/settings/constraints-on-settings.md), [OneUptime profiles/quotas](https://oneuptime.com/blog/post/2026-03-31-clickhouse-user-profiles-quotas/view), [max_memory_usage docs](https://clickhouse.com/docs/reference/settings/session-settings/max-memory-usage)).
- Prefer **server-side parameterized queries** (`{param:Type}` in ClickHouse, `$1` / prepared statements in Postgres). Never string-concatenate user text into SQL.

### Layer B — Statement policy (AST)

Parse with **sqlglot** (or dialect-aware equivalent). Reject unless:

1. Single statement (no `;` chaining).
2. Root is `SELECT` / `WITH … SELECT` only.
3. Deep scan finds **no** `Insert/Update/Delete/Merge/Create/Drop/Alter/Truncate/Command/Into/Lock` ([Airflow sql_validation](https://airflow.apache.org/docs/apache-airflow-providers-common-ai/stable/_modules/airflow/providers/common/ai/utils/sql_validation.html), [readonly-sql-guard](https://pypi.org/project/readonly-sql-guard/), [Seal zero-trust SQL](https://seal-ql.vercel.app/docs/zero-trust-sql)).
4. Tables ⊆ allowlist of analytics views (`analytics.*`).
5. No `SELECT *` on unbounded fact tables without LIMIT (rewrite to inject LIMIT).
6. Forbidden functions (file/network UDFs, `system.*` in ClickHouse) denylisted.

### Layer C — Mandatory tenant predicate (critical)

**Do not trust the model to include `organization_id`.** Inject it via AST rewrite into **every query scope** that touches tenant-scoped tables (AskTable / sqlglot Scope pattern: [AskTable SQL Permission Guard](https://www.asktable.com/en-US/blog/2026-03-05/asktable-sql-permission-guard-sqlglot), [sqlglot gateway writeup](https://medium.com/@balajibal/from-regex-to-deterministic-control-building-a-sql-gateway-with-sqlglot-8f0aee90d7e0)).

Algorithm sketch:

1. Resolve `organization_id` from authenticated coach session (server-side), never from LLM tool args alone.
2. Parse SQL → walk scopes (main SELECT, subqueries, CTEs, UNION arms).
3. For each scope that references a tenant table, `AND` `alias.organization_id = :org_id` (or rewrite to a security barrier view).
4. Reject if rewrite fails or if a referenced table has no tenancy mapping.
5. Execute only the rewritten SQL with bound parameters.

For the **constrained builder**, injection is even simpler: the compiler always adds `organization_id` to the WHERE of every generated query; the LLM cannot omit a field that is not in the schema.

### Layer D — Resource guards

- Statement timeout (e.g. 5–15s coach interactive; longer for batch).
- `LIMIT` clamp (e.g. max 500 rows to agent; aggregate tools for “all athletes”).
- ClickHouse: `max_memory_usage` ~2–4 GiB for agent user; `max_bytes_to_read`; per-user quotas ([OneUptime memory](https://oneuptime.com/blog/post/2026-03-31-clickhouse-max-memory-usage/view)).
- Concurrent query budget per org / per coach.

### Layer E — Audit

Log: `request_id`, `user_id`, `organization_id`, tool name, structured query or rewritten SQL, EXPLAIN/cost estimate, row count, latency, policy decisions (allow/deny/reason).

---

## 5. Supabase RLS as defense-in-depth (vs `service_role`)

### 5.1 How RLS works with a user JWT

Postgres policies use `auth.uid()` / `auth.jwt()` from the JWT claims PostgREST/Supabase inject into the request. Multi-tenant SaaS patterns put `tenant_id` / `org_id` in JWT `app_metadata` and policy:

```sql
CREATE POLICY tenant_isolation ON athletes
  FOR SELECT TO authenticated
  USING (
    organization_id = ((SELECT auth.jwt()) -> 'app_metadata' ->> 'organization_id')::uuid
  );
```

Sources: [Supabase multi-tenancy (Choi)](https://wonsukchoi.co/en/blog/supabase-multi-tenancy-production), [DEV: Mastering Supabase Auth + RLS](https://dev.to/publiflow/mastering-supabase-auth-and-row-level-security-for-multi-tenant-saas-34bf), [2026 production guide](https://tomodahinata.com/en/blog/supabase-production-guide-nextjs-rls-realtime-edge-functions).

### 5.2 Server-side / agent practicality (Python)

**Yes, practical** — create a per-request client with the **anon/publishable key** + user `Authorization: Bearer <access_token>`:

```python
from supabase import create_client, ClientOptions

def user_scoped_client(access_token: str):
    return create_client(
        SUPABASE_URL,
        SUPABASE_ANON_KEY,
        options=ClientOptions(
            headers={"Authorization": f"Bearer {access_token}"},
            persist_session=False,
        ),
    )
```

This pattern is how Edge Functions expose `ctx.supabase` (RLS-scoped) vs `ctx.supabaseAdmin` (service role) — see [`@supabase/server` blog](https://supabase.com/blog/introducing-supabase-server), [Functions auth docs](https://supabase.com/docs/guides/functions/auth), and Python discussions ([supabase-py#915](https://github.com/supabase/supabase-py/issues/915), [PR #766](https://github.com/supabase-community/supabase-py/pull/766)).

**Caveats for agents:**

| Issue | Mitigation |
|---|---|
| Long-running agent may outlive JWT | Short tools: require fresh token from BFF; or refresh with refresh_token only in secure server store |
| Coach may switch orgs; claims stale | Prefer request-time org claim validation against membership table; re-issue JWT on switch |
| Direct SQL via `psycopg` / SQLAlchemy bypasses PostgREST JWT plumbing | Must `SET LOCAL request.jwt.claims` / use Supabase pooler with JWT, **or** rely on AST tenant inject + DB role (don’t assume RLS “just works” on raw SQL connections) |
| Service role still needed for privileged jobs | Nightly batch, embeddings, cross-org admin — never for coach chat tools |
| RLS performance | Wrap `auth.jwt()` in `(SELECT …)` subquery; index `organization_id` |

**Recommendation:** For coach-facing analytics tools:

1. **Primary:** application-layer tenant inject (compiler/AST) — works for both Supabase PostgREST *and* ClickHouse.
2. **Secondary:** per-request user JWT client for PostgREST/table APIs so RLS is a second fence.
3. **Never:** default agent path on bare `service_role` without mandatory org filter in code.

---

## 6. ClickHouse-specific concerns

Wearables (HR, HRV, sleep, workouts, soon CGM) are high-cardinality timeseries — runaway queries are a cost/DoS risk.

| Control | Concrete setting (starting point) |
|---|---|
| Read-only user | `readonly=1` profile for `agent_analytics` |
| Memory | `max_memory_usage=2G`–`4G` READONLY; `max_memory_usage_for_user` for concurrency |
| Time | `max_execution_time=15` (interactive) |
| Result size | `max_result_rows=10000`, `max_result_bytes=64M` |
| Scan budget | `max_bytes_to_read` / quotas on rows read per hour |
| Parameterization | `query_parameters` / `{org_id:UUID}` — never f-string SQL |
| Table allowlist | Only `analytics.*` / marts with `organization_id` column; no `system.*` |
| Tenant | Same AST inject or compiler WHERE on `organization_id` (ClickHouse has no Postgres RLS) |

Sources: [ClickHouse max_memory_usage](https://clickhouse.com/docs/reference/settings/session-settings/max-memory-usage), [OneUptime profiles](https://oneuptime.com/blog/post/2026-03-31-clickhouse-user-profiles-quotas/view), [Pulse memory tiers](https://pulse.support/kb/clickhouse-memory-configuration-settings).

**Safe pattern:** agent never writes ClickHouse SQL against raw event tables; it hits **daily/hourly rollup marts** (sleep_daily, hrv_daily, workout_daily, glucose_daily) that already encode grain.

---

## 7. Verification & auditable provenance

### 7.1 Minimum product contract

Every insight tool result must return:

```python
{
  "data": [...],                    # numbers the LLM may cite
  "provenance": {
    "tool": "run_analytics_query",
    "query": { ... },               # structured AnalyticsQuery OR rewritten SQL
    "compiled_sql": "SELECT ...",   # exact SQL executed
    "parameters": {"organization_id": "...", ...},
    "metric_defs": [                # versioned definitions used
      {"name": "first_serve_pct", "version": "2026.03.1", "sql_expr": "..."}
    ],
    "row_count": 12,
    "executed_at": "2026-08-02T14:01:00Z",
    "store": "clickhouse|postgres",
  },
  "confidence": "high|medium|low",  # from verification steps
}
```

The LLM is instructed to **only cite numbers present in `data`**, and the UI can show “how we computed this” from `provenance`.

### 7.2 Self-consistency / verification techniques (2025–2026)

| Technique | Idea | Cost | Use for us |
|---|---|---|---|
| **Return + explain** | Second pass: “explain this query in business terms”; flag mismatch with user question | Low | Default on guarded SQL |
| **Self-consistency (N samples)** | Generate N queries; majority vote on execution results ([CSC-SQL](https://arxiv.org/html/2505.13271v1)) | N× | Escape hatch only |
| **VET** | Executable reasoning trace + dual-track execution consistency + question reconstruction ([ACL 2026 Findings](https://aclanthology.org/2026.findings-acl.1544.pdf)) | High | Research-grade; optional for high-stakes |
| **DPC** | Cross-check SQL vs Python/pandas on a tiny distinguishing DB ([ACL 2026](https://aclanthology.org/2026.acl-long.313.pdf)) | Med–high | Fits our sandboxed code path (dossier 53) for disputed answers |
| **Semantic layer advantage** | If structured query validates against catalog, skip multi-sample | Free | Prefer |

**Practical default:** constrained query → compile → execute → attach provenance. Escalate to dual generation or SQL↔pandas check only when confidence is low or the user challenges the number.

---

## 8. Hybrid approaches in production

Industry consensus in 2026: **don’t bet the product on free text-to-SQL alone.**

| Example | Pattern |
|---|---|
| **dbt recommendation** | Prefer Semantic Layer for KPIs; fall back to text-to-SQL for ad hoc after checking SL coverage ([dbt 2026](https://docs.getdbt.com/blog/semantic-layer-vs-text-to-sql-2026)) |
| **Cube / Brex Spaces** | Agent selects governed metrics over MCP/REST; never raw tables ([Cube](https://cube.dev/articles/how-to-add-ai-analytics-to-your-product)) |
| **Frontiers Iceberg agent** | Typed filter API for ~85% single-table; hybrid SQL path for joins with semantic formulas ([Frontiers](https://www.frontiersin.org/journals/big-data/articles/10.3389/fdata.2026.1785710/full)) |
| **Vanna 2.0** | Tool registry + identity-first multi-tenant agent; `RunSqlTool` behind permissions + memory of verified Q→SQL pairs ([Vanna why](https://vanna.ai/docs/why-we-built-this), [TeachMeIDEA prod guide](https://teachmeidea.com/vanna-2-text-to-sql-postgres/)) |
| **Defog** | SQL executed in customer env; keyword/malicious filters; analytics focus ([Defog](https://defog.ai/product)) |
| **Seal** | Zero-trust SQL boundary: regex → SQLGlot validate/sanitize → execute ([Seal docs](https://seal-ql.vercel.app/docs/zero-trust-sql)) |

**80/20 for sports coaching:** fixed tools for the coach dashboard questions we already know; constrained semantic query for compositional analytics; guarded SQL only when the catalog cannot express the join.

---

## 9. Recommended architecture for Peak Performance

### 9.1 Routing policy

```
Coach question
    │
    ├─(1) Tool router → fixed specialist tools
    │       e.g. get_readiness_snapshot, get_acwr_series,
    │            get_serve_stats, compare_load_vs_serve
    │
    ├─(2) Else → run_analytics_query(AnalyticsQuery)
    │       validates metrics/dims against catalog
    │       compiles SQL with mandatory org predicate
    │
    └─(3) Else (rare) → guarded_text_to_sql
            only analytics views; AST + tenant rewrite;
            dual-check or explain; higher latency budget
```

Justification vs evidence:

- Fixed tools maximize **determinism** for the questions that drive product trust.
- Constrained SL path matches dbt/Cube findings: LLM selects, compiler guarantees metric math and tenancy.
- Guarded SQL acknowledges Spider 2.0 reality: some long-tail questions need SQL, but never without gates.

### 9.2 Safety controls (layered checklist)

1. **Authn:** coach JWT verified at BFF → Python agent receives `user_id`, `organization_id`, `role` as **server context**, not model-controlled tool fields.
2. **Authz:** coach may only query athletes in org (membership check before execute).
3. **Catalog allowlist:** metrics/dimensions/views versioned in code or YAML.
4. **Compile-time tenant inject** (mandatory).
5. **Read-only DB roles** + timeouts + row/memory limits (Postgres + ClickHouse).
6. **AST policy** for any free SQL string.
7. **Result envelope** with provenance; LLM citation rule.
8. **Optional RLS** via user-scoped Supabase client for PostgREST paths.
9. **Eval harness:** golden questions with expected SQL/result hashes (see dossier 10 / 55).

### 9.3 Multi-tenancy guarantee — code sketch

Tenant filter is applied **after** the model proposes a query and **before** execution. The model cannot opt out.

```python
# analytics/tenant_rewrite.py
from __future__ import annotations
import sqlglot
from sqlglot import exp

TENANT_TABLES = {
    "athletes": "organization_id",
    "matches": "organization_id",
    "training_sessions": "organization_id",
    "shot_stats": "organization_id",
    "sleep_daily": "organization_id",
    "hrv_daily": "organization_id",
    "workout_daily": "organization_id",
    "readiness_daily": "organization_id",
}

def inject_tenant(sql: str, organization_id: str, dialect: str = "postgres") -> str:
    """Guarantee organization_id predicate on every tenant-scoped scope."""
    tree = sqlglot.parse_one(sql, read=dialect)
    if not isinstance(tree, (exp.Select, exp.Union)):
        # WITH ... SELECT unwrap
        if isinstance(tree, exp.With):
            tree = tree.this
        if not isinstance(tree, (exp.Select, exp.Union)):
            raise PermissionError("Only SELECT queries are allowed")

    def _rewrite_select(node: exp.Select) -> None:
        for table in node.find_all(exp.Table):
            name = table.name
            col = TENANT_TABLES.get(name)
            if not col:
                continue
            alias = table.alias_or_name
            predicate = exp.EQ(
                this=exp.column(col, table=alias),
                expression=exp.Literal.string(organization_id),
            )
            node.where(predicate, copy=False)

    for select in tree.find_all(exp.Select):
        _rewrite_select(select)

    # Fail closed: at least one tenant table must have been touched,
    # or the query must only hit non-tenant reference dims (explicit allow).
    return tree.sql(dialect=dialect)


# analytics/compiler.py
from pydantic import BaseModel, Field

class Filter(BaseModel):
    field: str
    op: str  # eq|in|between|gte|lte
    value: object

class AnalyticsQuery(BaseModel):
    metrics: list[str]
    dimensions: list[str] = []
    filters: list[Filter] = []
    time_grain: str | None = None  # day|week|month
    date_from: str | None = None
    date_to: str | None = None
    limit: int = Field(default=100, le=500)

METRIC_SQL = {
    "readiness": "avg(readiness_score)",
    "acwr": "avg(acwr)",
    "first_serve_pct": (
        "100.0 * sum(first_serves_in)::float / nullif(sum(first_serve_attempts), 0)"
    ),
    "sleep_duration_h": "avg(sleep_hours)",
}

DIM_COLS = {
    "athlete": "athlete_id",
    "date": "date",
    "session": "session_id",
    "match": "match_id",
    "surface": "surface",
}

def compile_analytics_query(q: AnalyticsQuery, organization_id: str, dialect: str) -> str:
    """LLM never sees organization_id as optional — compiler always adds it."""
    for m in q.metrics:
        if m not in METRIC_SQL:
            raise ValueError(f"Unknown metric: {m}")
    select_parts = [f"{METRIC_SQL[m]} AS {m}" for m in q.metrics]
    group_cols = [DIM_COLS[d] for d in q.dimensions if d in DIM_COLS]
    select_parts = group_cols + select_parts if group_cols else select_parts

    # Choose fact mart from metrics (simplified)
    from_table = "analytics.athlete_daily_facts"

    where = [f"organization_id = %(organization_id)s"]
    params = {"organization_id": organization_id}
    if q.date_from:
        where.append("date >= %(date_from)s")
        params["date_from"] = q.date_from
    if q.date_to:
        where.append("date <= %(date_to)s")
        params["date_to"] = q.date_to
    # ... map filters similarly with bound params ...

    sql = (
        f"SELECT {', '.join(select_parts)} FROM {from_table} "
        f"WHERE {' AND '.join(where)} "
        + (f"GROUP BY {', '.join(group_cols)} " if group_cols else "")
        + f"LIMIT {int(q.limit)}"
    )
    # params passed separately to driver.execute(sql, params)
    return sql


# agent tool
def run_analytics_query(q: AnalyticsQuery, ctx: RequestContext) -> dict:
    # ctx.organization_id from verified JWT — ignore any org_id in LLM args
    sql = compile_analytics_query(q, ctx.organization_id, dialect="postgres")
    rows = postgres_readonly.execute(sql, {"organization_id": ctx.organization_id, ...})
    return {
        "data": rows,
        "provenance": {
            "tool": "run_analytics_query",
            "query": q.model_dump(),
            "compiled_sql": sql,
            "parameters": {"organization_id": ctx.organization_id},
            "metric_defs": [
                {"name": m, "expr": METRIC_SQL[m], "version": "2026.08.1"}
                for m in q.metrics
            ],
        },
    }
```

**Guarantee properties:**

- `organization_id` comes from `RequestContext` after JWT verification, not from the LLM.
- Compiler always emits the predicate; free-SQL path runs `inject_tenant` and **fails closed**.
- ClickHouse path uses the same compiler with ClickHouse dialect + read-only user.
- Even if the model invents `filters: []` or omits org, the WHERE still contains the tenant key.

### 9.4 Semantic-layer schema sketch (domain)

**Entities:** `organization`, `athlete`, `session` (training), `match`, `shot` (optional grain), `day` (wearable day).

**Dimensions**

| Dimension | Grain / notes |
|---|---|
| `athlete` | athlete_id, name (display) |
| `date` | calendar date |
| `week` / `month` | time grains over `date` |
| `session` | training_session_id, session_type |
| `match` | match_id, opponent, result |
| `surface` | hard / clay / grass / carpet |
| `competition_level` | optional |

**Metrics (certified)**

| Metric | Definition (sketch) | Store |
|---|---|---|
| `readiness` | Daily readiness score (platform formula vX) | CH rollup / Postgres cache |
| `acwr` | Acute:chronic workload ratio (7d / 28d external load) | CH + training load |
| `sleep_duration_h` | Total sleep hours per night | CH `sleep_daily` |
| `sleep_efficiency` | Sleep efficiency % | CH |
| `hrv_rmssd` | Nightly or morning RMSSD | CH `hrv_daily` |
| `training_load` | Session RPE×duration or TRIMP | Postgres / CH |
| `first_serve_pct` | first_serves_in / first_serve_attempts × 100 | Postgres tennis shots |
| `second_serve_pct` | analog | Postgres |
| `break_points_saved_pct` | saved / faced | Postgres |
| `rally_length_avg` | mean shots per point | Postgres |
| `glucose_tir` | % time in range (future CGM) | CH |

**Time grains:** `hour` (workouts/HR segments, careful), `day` (default wearable), `week`, `month`, `match` (event grain), `session`.

**Join rules (declarative):**  
`athlete_daily_facts` is the preferred wide mart joining readiness/ACWR/sleep at `athlete_id + date`. Tennis metrics join `matches`/`shots` at match grain then roll to day/week. Forbid joining shot-level to sleep-night without an explicit grain bridge (prevents fan-out).

**YAML sketch:**

```yaml
# semantic/sports_metrics.yml
version: 2026.08.1
entities:
  athlete:
    primary_key: athlete_id
    tenant_key: organization_id
metrics:
  first_serve_pct:
    type: ratio
    numerator: sum(first_serves_in)
    denominator: sum(first_serve_attempts)
    multiply: 100
    compatible_dimensions: [athlete, date, week, match, surface]
  acwr:
    type: derived
    expr: acute_load_7d / nullif(chronic_load_28d, 0)
    compatible_dimensions: [athlete, date, week]
  readiness:
    type: average
    column: readiness_score
    compatible_dimensions: [athlete, date, week]
  sleep_duration_h:
    type: average
    column: sleep_hours
    compatible_dimensions: [athlete, date, week]
```

### 9.5 Feeding an insight with verifiable provenance

```text
1. Tool returns { data, provenance }
2. Insight agent may ONLY populate Insight.claims[].value from data[*]
3. Insight.evidence[] stores provenance.compiled_sql + metric_defs + row hashes
4. UI "Verify" expands evidence; coach sees query + metric definition version
5. Nightly eval: re-run provenance.compiled_sql; alert on drift vs stored result hash
```

This aligns with the hard rule: **numbers come from executed queries, never from model arithmetic** (pair with sandboxed code execution in dossier 53 when transforms need pandas).

---

## 10. Comparison matrix (for our stack)

| Approach | Accuracy | Tenancy safety | Coverage | Ops cost | Fit |
|---|---|---|---|---|---|
| Fixed tools only | Highest | Highest (hand-written SQL) | Low (long tail fails) | Low | Required for top KPIs |
| Constrained query builder / thin SL | Very high in-scope | Highest if compile-time org | Medium–high | Medium (catalog ownership) | **Primary long-tail** |
| Full Cube/dbt SL product | Very high in-scope | High (compile-time RLS) | Medium | Higher (another service) | Consider if catalog grows large |
| Guarded text-to-SQL | Medium | High *only with* AST inject + RO roles | Highest | Medium | Escape hatch |
| Raw text-to-SQL + service_role | Low–medium | **Unsafe** | Highest | Low until incident | **Reject** |

---

## 11. Implementation phases

| Phase | Deliverable |
|---|---|
| **P0** | RequestContext with verified `organization_id`; ban service_role on coach chat path for reads; fixed tools for readiness/ACWR/serve/sleep |
| **P1** | `AnalyticsQuery` + compiler + ClickHouse/Postgres readonly users + provenance envelope |
| **P2** | sqlglot gateway for escape-hatch SQL; tenant AST inject + allowlisted views |
| **P3** | Optional user-JWT Supabase client for RLS; dual-check / explain for low-confidence; expand semantic YAML; eval harness golden set |
| **P4** | Consider Cube/MetricFlow only if catalog + consumers (BI + agents) justify the runtime |

---

## 12. Source index

### Benchmarks & accuracy gap
- https://bird-bench.github.io/
- https://beancount.io/bean-labs/research-logs/2026/06/06/bird-benchmark-text-to-sql-real-database-gap
- https://arxiv.org/abs/2411.07763 (Spider 2.0)
- https://proceedings.iclr.cc/paper_files/paper/2025/file/46c10f6c8ea5aa6f267bcdabcb123f97-Paper-Conference.pdf
- https://towardsdatascience.com/why-90-accuracy-in-text-to-sql-is-100-useless/
- https://colrows.com/blogs/text-to-sql-accuracy-cliff/
- https://particula.tech/blog/text-to-sql-accuracy-benchmarks-semantic-layer
- https://medium.com/@adnanmasood/pushing-towards-human-level-text-to-sql-an-analysis-of-top-systems-on-bird-benchmark-666efd211a2d
- https://arxiv.org/html/2603.20004v1 (ReViSQL)

### Semantic layer & constrained queries
- https://docs.getdbt.com/blog/semantic-layer-vs-text-to-sql-2026
- https://cube.dev/articles/semantic-layer-for-ai-agents-2026
- https://cube.dev/articles/how-to-add-ai-analytics-to-your-product
- https://docs.cube.dev/reference/core-data-apis/rest-api/query-format
- https://omni.co/blog/why-text-to-sql-fails
- https://ingestthis.com/posts/2026/2026-05-24-semantic-layers-text-to-sql
- https://www.knowi.com/blog/semantic-layer-tools/
- https://arxiv.org/pdf/2604.25149
- https://www.frontiersin.org/journals/big-data/articles/10.3389/fdata.2026.1785710/full

### SQL security / AST
- https://medium.com/@balajibal/from-regex-to-deterministic-control-building-a-sql-gateway-with-sqlglot-8f0aee90d7e0
- https://www.asktable.com/en-US/blog/2026-03-05/asktable-sql-permission-guard-sqlglot
- https://seal-ql.vercel.app/docs/zero-trust-sql
- https://pypi.org/project/readonly-sql-guard/
- https://airflow.apache.org/docs/apache-airflow-providers-common-ai/stable/_modules/airflow/providers/common/ai/utils/sql_validation.html

### Supabase RLS / JWT
- https://supabase.com/blog/introducing-supabase-server
- https://supabase.com/docs/guides/functions/auth
- https://wonsukchoi.co/en/blog/supabase-multi-tenancy-production
- https://dev.to/publiflow/mastering-supabase-auth-and-row-level-security-for-multi-tenant-saas-34bf
- https://github.com/supabase/supabase-py/issues/915
- https://github.com/supabase-community/supabase-py/pull/766

### ClickHouse controls
- https://clickhouse.com/docs/reference/settings/session-settings/max-memory-usage
- https://oneuptime.com/blog/post/2026-03-31-clickhouse-user-profiles-quotas/view
- https://oneuptime.com/blog/post/2026-03-31-clickhouse-max-memory-usage/view
- https://github.com/ClickHouse/ClickHouse/blob/master/docs/en/operations/settings/constraints-on-settings.md

### Verification & hybrid production
- https://aclanthology.org/2026.findings-acl.1544.pdf (VET)
- https://arxiv.org/html/2505.13271v1 (CSC-SQL)
- https://aclanthology.org/2026.acl-long.313.pdf (DPC)
- https://vanna.ai/docs/why-we-built-this
- https://teachmeidea.com/vanna-2-text-to-sql-postgres/
- https://defog.ai/product

---

## 13. Open questions for the product team

1. Do we standardize on a **homegrown YAML semantic catalog + compiler** first, or adopt **Cube Core** early for MCP/BI reuse?
2. Is coach chat always synchronous with a short timeout (favor constrained queries), with heavy SQL moved to async jobs?
3. Should athlete-level PII columns be **member-level blocked** in the catalog (Cube-style) so agents never select names for wrong roles?
4. For ClickHouse, do all orgs share a cluster with `organization_id` filters, or do we eventually shard by tenant?
