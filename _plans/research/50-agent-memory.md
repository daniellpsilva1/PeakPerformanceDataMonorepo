# Agent Memory System Architectures

**Research date:** 2026-08-02  
**Scope:** Multi-agent sports-performance platform (self-hosted EU; Supabase Postgres + pgvector; hundreds of athletes, tens of coaches). Current state: flat `ai_memories` table, 1536-dim HNSW, types preference/fact/workflow/correction/summary, top-k 5 at similarity 0.7. Known gaps: wrong-message extraction, silent embedding no-ops, no dedup/contradiction/decay/compaction, no athlete-scoped retrieval.  
**Method:** External research only (arxiv, vendor docs, GitHub, 2025–2026 audits). No local codebase exploration.

---

## 1. Executive verdict

**Build a typed, bi-temporal memory layer on Supabase Postgres + pgvector. Do not adopt Zep Cloud, Mem0 Platform, or Letta as the memory backend.** Steal their *patterns* (sleep-time consolidation, ADD/UPDATE/INVALIDATE ops, `valid_from`/`valid_to`, hybrid retrieval + rerank) and implement them in our stack.

At our scale (hundreds of athletes, tens of coaches, EU self-host), a full graph DB or hosted memory SaaS adds ops and residency risk without solving the domain problems we already know we have (athlete scoping, contradiction on evolving physiology, GDPR erasure of derived summaries). Mem0 OSS on pgvector is the closest buyable library, but its 2026 v3 ADD-only pipeline *abandons* contradiction resolution — the opposite of what athlete baselines need.

---

## 2. Conceptual taxonomy (credible framing)

### 2.1 Cognitive science → agent systems

The working / episodic / semantic / procedural split is not a blog invention. It comes from cognitive psychology (Tulving on episodic vs semantic; Squire on procedural) and was formalized for language agents in **CoALA** (Sumers, Yao, Narasimhan, Griffiths — Princeton, 2023/2024):

| Type | Cognitive meaning | Agent implementation |
|------|-------------------|----------------------|
| **Working** | Active contents of attention | Context window + scratchpad / run state |
| **Episodic** | Time-anchored experiences | Conversation turns, tool traces, “episodes” with timestamps |
| **Semantic** | Atemporal / declarative facts | Extracted preferences, athlete facts, entity knowledge |
| **Procedural** | How to act | System prompts, playbooks, skills, learned workflows |

**Primary source:** [Cognitive Architectures for Language Agents (CoALA)](https://arxiv.org/abs/2309.02427) — organizes agents by memory modules, internal/external action space, and decision loop. Soar-style working vs long-term (procedural / semantic / episodic) is the explicit ancestor.

**2025–2026 surveys that treat this taxonomy as standard:**
- [Memory for Autonomous LLM Agents (arxiv:2603.07670)](https://arxiv.org/abs/2603.07670) — episodic / semantic / procedural + working; notes consolidation from episodic→semantic is rarely automatic.
- [Rethinking Memory Mechanisms of Foundation Agents (arxiv:2602.06052)](https://arxiv.org/html/2602.06052v3) — substrate × cognitive mechanism × subject (user-centric vs agent-centric).
- [Memory in the Age of AI Agents (arxiv:2512.13564)](https://arxiv.org/abs/2512.13564) — field survey; four-type model is a starting point, not final.
- Secondary synthesis: [Atlan — Types of AI Agent Memory](https://atlan.com/know/types-of-ai-agent-memory/), [Zylos Research 2026-04](https://zylos.ai/research/2026-04-05-ai-agent-memory-architectures-persistent-knowledge/).

### 2.2 Mapping to sports performance

| Type | PPD example |
|------|-------------|
| Working | Current coach chat + last tool results + selected athlete card |
| Episodic | “2026-03-12 session: coach corrected HRV interpretation for Athlete X” |
| Semantic | “Coach prefers Spanish summaries”; “Athlete X baseline HRV ~72ms (as of 2026-06)” |
| Procedural | “When discussing readiness, always cite last 7 nights sleep + HRV before recommending load” |

---

## 3. MemGPT / Letta

### 3.1 Origins

**MemGPT** (Packer et al., 2023) treated the LLM context like virtual memory: core (in-context) vs archival (external retrieval), with the agent calling tools to page memories in/out. Project rebranded to **Letta**.

Paper: [MemGPT: Towards LLMs as Operating Systems](https://arxiv.org/abs/2310.08560)

### 3.2 OS-inspired hierarchy (current Letta model)

| Tier | Role | Location |
|------|------|----------|
| **Core / memory blocks** | Always-visible labeled strings (persona, human, custom) | Pinned in system prompt; agent- or sleep-time editable |
| **Recall** | Conversation history (evicted tail still queryable) | Message store + retrieval tools |
| **Archival** | Long-term facts | External vector / structured store |

**Memory blocks** are first-class typed objects: character-limited, attachable/detachable, shareable across agents. Docs: [Letta — Stateful Agents](https://docs.letta.com/guides/agents/memory)

### 3.3 Self-editing memory

Agents (or a sleep-time peer) call memory tools (`core_memory_append`, `rethink_memory`, archival search/insert) to rewrite their own context. This is the “agent manages its own OS memory” idea — powerful, but couples memory correctness to tool-calling reliability on the hot path.

### 3.4 Sleep-time compute

**Idea:** Offload memory consolidation to a background agent while the primary agent serves the user.

- Primary agent: talk + tools + recall/archival search; **no** core-memory edit tools.
- Sleep-time agent: reads transcript / files, rewrites shared blocks, consolidates archival.
- Paper: [Sleep-time Compute: Beyond Inference Scaling at Test-time](https://arxiv.org/abs/2504.13171) — claims ~5× less test-time compute for same accuracy; ~2.5× lower avg cost when context is reused.
- Product: [Letta blog — Sleep-time Compute](https://www.letta.com/blog/sleep-time-compute/)

This is the most transferable Letta idea for us: **extract/consolidate asynchronously after the turn**, not inside the coach-facing latency budget.

### 3.5 Project state in 2026

- GitHub [`letta-ai/letta`](https://github.com/letta-ai/letta/) notes **legacy V1 API server**; active development moved to Letta Agent / App Server / Agent SDK (`letta-code`, Constellation cloud, local App Server).
- Positioning: full **stateful agent platform**, not a drop-in memory library for an existing FastAPI + Next.js stack.
- Adoption cost for us: replace or dual-run our agent runtime, accept Letta’s persistence model, or use only the conceptual pattern.

**Takeaway:** Steal sleep-time + memory blocks (coach profile / athlete card as pinned blocks). Do not migrate the whole agent host to Letta unless we later want their product as the runtime.

---

## 4. Zep + Graphiti (temporal knowledge graphs)

### 4.1 Architecture

**Graphiti** (open source) is Zep’s temporal context-graph engine. **Zep** is the managed “Context Lake” product on top.

- Ingest **episodes** (message / text / JSON) with reference timestamp `t_ref`.
- Extract entities + relational **edges** (facts).
- **Bi-temporal model** on edges:
  - **Event/valid time (`T`)**: `t_valid`, `t_invalid` — when the fact was true in the world.
  - **Transaction time (`T'`)**: when the system learned / invalidated the fact.
- New contradictory edges with overlapping validity → set `t_invalid` of the old edge to the new edge’s `t_valid`. History is preserved, current state is a point-in-time query.
- Retrieval: hybrid semantic + BM25/full-text + graph traversal; claims sub-200ms without LLM rerank.

Paper: [Zep: A Temporal Knowledge Graph Architecture for Agent Memory](https://arxiv.org/abs/2501.13956)  
Docs: [Graphiti overview](https://help.getzep.com/graphiti/getting-started/overview) · [GitHub getzep/graphiti](https://github.com/getzep/graphiti)

### 4.2 Why bi-temporality matters for athletes

| Fact | Needs |
|------|-------|
| “Baseline HRV ≈ 72ms” | Invalidate when re-baselined after illness |
| “Injured — left knee” | `valid_from` injury date, `valid_to` clearance date |
| “Coach prefers RPE-first briefings” | Stable preference; rare invalidate |
| “Agent concluded readiness low on 2026-05-01” | Episodic conclusion with provenance; may be superseded |

A pure vector store of undated sentences cannot answer “what was true *then*” vs “what is true *now*.” Graphiti’s four timestamps are the right *data model*, even if we implement them in Postgres rather than Neo4j.

### 4.3 Benchmark claims (skeptical reading)

From the Zep paper and marketing:

| Claim | Number | Caveat |
|-------|--------|--------|
| DMR vs MemGPT | 94.8% vs 93.4% | DMR conversations ~60 messages — fit modern context windows; tiny absolute gap |
| LongMemEval (gpt-4o) | 71.2% vs full-context 60.2%; ~90% latency cut | Vendor-evaluated; network latency handicaps Zep in their own writeup; full-context is a weak strawman for LongMemEval-S as windows grow |
| Marketing LoCoMo / LongMemEval | 94.7% / 90.2%, ~155–162ms retrieval | Later marketing numbers; not independently audited; LoCoMo ceiling ~93.6% with clean keys (see §8) |

DMR barely beats full conversation on gpt-4-turbo (94.8 vs 94.4) — the interesting win is **latency and selective context**, not magic accuracy. Temporal categories show larger lifts (preference, temporal reasoning), which *is* relevant to us.

### 4.4 Ops / EU

- Graphiti requires **Neo4j ≥5.26** (or FalkorDB / Neptune) + LLM for extraction — second database, second ops surface.
- Zep Cloud: US-centric hosting; third-party reports (Apr 2026) note **no published EU region / weak Art.17 story** for the managed product. Self-host Graphiti = you own Neo4j + GDPR.
- BYOC exists for enterprise Zep; still a graph stack we do not otherwise need.

**Takeaway:** Adopt **bi-temporal edge semantics** in Postgres. Do not adopt Neo4j/Zep unless we later need multi-hop entity graphs at scale we do not have.

---

## 5. Mem0

### 5.1 Architecture (paper + OSS)

Paper (ECAI 2025): [Mem0: Building Production-Ready AI Agents with Scalable Long-Term Memory](https://arxiv.org/abs/2504.19413)

**Classic (paper / pre-v3) pipeline:**
1. **Extract** from message pair `(m_{t-1}, m_t)` + conversation summary `S` + last `m` messages → candidate facts via LLM.
2. **Update:** retrieve top-`s` similar memories; LLM tool-call chooses **ADD / UPDATE / DELETE / NOOP**.
3. Optional **Mem0g**: Neo4j graph of entity–relation triples with soft invalidation.

Defaults in paper: `m=10`, `s=10`, GPT-4o-mini, dense embeddings.

### 5.2 2026 algorithm (v3) — important regression for us

[OSS v2→v3 migration](https://docs.mem0.ai/migration/oss-v2-to-v3) · [mem0.ai/research](https://mem0.ai/research) · [State of AI Agent Memory 2026](https://mem0.ai/blog/state-of-ai-agent-memory-2026)

v3 changes:
- **Single-pass ADD-only** extraction (one LLM call; no UPDATE/DELETE).
- Memories accumulate; exact-hash dedup only.
- Multi-signal retrieval: semantic + BM25 + entity fusion.
- Temporal ranking of dated instances.
- Claimed scores: LoCoMo **92.5**, LongMemEval **94.4**, BEAM 1M **64.1** / 10M **48.6**, ~7K tokens/query.

**Skepticism:**
- Platform scores ≠ OSS scores (Mem0 states proprietary optimizations).
- ADD-only **sidesteps contradiction** — they trade update correctness for extraction latency/recall. For dietary prefs that rarely flip, fine; for injury/HRV baselines, **wrong**.
- Paper’s earlier ADD/UPDATE/DELETE design is closer to what we need than v3.
- Benchmark wins vs full-context are partly token/latency wins; LoCoMo judge noise makes 90+ scores hard to interpret (§8).

### 5.3 Hosting

| Option | Data residency | Notes |
|--------|----------------|-------|
| Mem0 Platform | US (expandable claimed) | Fast; GDPR transfer risk for EU athlete PII |
| Mem0 OSS | Your infra; pgvector supported | You still own extraction quality, contradiction, GDPR |

Docs: [Platform vs OSS](https://docs.mem0.ai/platform/platform-vs-oss)

**Takeaway:** Study the **paper’s extract+update tool-call design**. Do not depend on Platform. OSS as a library is optional; we can reimplement a thinner, sports-typed version on tables we control.

---

## 6. Generative Agents memory stream

**Paper:** Park et al., 2023 — [Generative Agents: Interactive Simulacra of Human Behavior](https://arxiv.org/abs/2304.03442) · [ACM UIST](https://dl.acm.org/doi/10.1145/3586183.3606763)

### Design
1. Append every observation to a **memory stream** (natural language + timestamp).
2. Retrieve by composite score (equal weights α=β=γ=1 in the paper after min-max normalize):
   - **Recency:** exponential decay since last retrieval (decay 0.995 per sandbox hour).
   - **Importance / poignancy:** LLM rates 1–10.
   - **Relevance:** cosine similarity of embeddings to query.
3. **Reflection:** periodically synthesize higher-level insights from retrieved memories (episodic→semantic consolidation).

### Still good practice in 2026?

**Partially.**
- The three-signal idea (recency × importance × relevance) remains a common retrieval prior; LangMem docs explicitly say recall should combine similarity with importance and “strength” (recent/frequent use).
- Equal weights were a research default; production systems should **learn or domain-tune** weights (authors noted RL). Hand-tuned forks (e.g. relevance-heavy) exist.
- Critiques: retrieval memory is a “memo,” not weight-based learning ([Contextual Agentic Memory is a Memo, Not True Memory, arxiv:2604.27707](https://arxiv.org/abs/2604.27707)) — agents accumulate notes without gaining competence. Acceptable for our product (we want auditable facts, not fine-tuned weights).
- Importance scoring every write is **expensive and noisy** at scale; prefer type-based priors (injury > idle chat) + optional LLM importance on sleep-time only.

**For PPD:** Use a **scored hybrid** (similarity + recency decay + type prior + access frequency), not LLM poignancy on every insert. Keep the reflection/consolidation idea as a nightly job.

---

## 7. LangMem and framework memory

### LangMem (LangChain)
Docs: [langmem intro](https://langchain-ai.github.io/langmem/) · [conceptual guide](https://langchain-ai.github.io/langmem/concepts/conceptual_guide/)

- Semantic (collections + profiles), episodic (structured episodes), procedural (prompt optimizers).
- **Hot path:** agent tools `create_manage_memory_tool` / `create_search_memory_tool`.
- **Background:** `create_memory_store_manager` + ReflectionExecutor (sleep-time analogue).
- Enrichment reconciles insert vs consolidate vs delete; namespaces e.g. `(org, user_id, agent)`.
- Storage: LangGraph `BaseStore` (Postgres store available); core managers are storage-agnostic.
- Status mid-2026: still positioned as LangChain’s long-term memory option post-1.0; package remains pre-1.0 (slow PyPI cadence reported). Third-party LOCOMO latency numbers for LangMem hot-path are poor vs Mem0/Zep — treat as SDK, not SOTA retrieval engine.

### LangGraph
- **Checkpointer:** thread/session working memory (not long-term semantic memory).
- **BaseStore:** cross-thread namespaced KV + optional vector index — good persistence primitive if we adopt LangGraph orchestration.
- Do not confuse checkpoint history with athlete semantic memory.

### Others (brief)
- OpenAI ChatGPT “memory” — closed, not self-hostable.
- Reflexion / Voyager — episodic critiques / skill libraries; procedural inspiration only.

**Takeaway:** If we stay on LangGraph for orchestration, LangMem’s **background manager pattern** is worth copying. Prefer our own schema over LangMem’s opaque store if we need bi-temporality and GDPR lineage.

---

## 8. Hard problems — how systems handle them

| Problem | Generative Agents | Letta | Zep/Graphiti | Mem0 (paper) | Mem0 v3 | LangMem |
|---------|-------------------|-------|--------------|--------------|---------|---------|
| **Dedup** | Implicit via retrieval | Sleep-time rewrite | Entity resolution + edge merge | Semantic near-dup via UPDATE/NOOP | MD5 exact + accumulate | Enrichment consolidate |
| **Contradiction / update** | Reflection may supersede; no hard invalidate | Agent/sleep-time rewrite blocks | Bi-temporal `t_invalid` | LLM DELETE/UPDATE | **Not handled** (ADD-only) | LLM delete/update in manager |
| **Forgetting / decay** | Recency in retrieval | Compaction / eviction of messages | Point-in-time; old edges retained | Soft via non-retrieval | Temporal rank only | Strength / importance hints |
| **Consolidation** | Reflection trees | Sleep-time agent | Community summaries (product) | Summary context for extract | Hierarchical extract claims | Background store manager |
| **Provenance** | Weak (stream text) | Messages persisted | Episode → edge lineage | Source message pair | Weaker if ADD-only | Optional metadata |

**Sports implication:** Contradiction and provenance are non-negotiable (injury status, baselines, coach corrections). Prefer Graphiti-style invalidation + Mem0-paper UPDATE ops + Letta sleep-time scheduling.

---

## 9. Evaluation: LoCoMo and 2026 successors

| Benchmark | What it tests | Status 2026 |
|-----------|---------------|-------------|
| **LoCoMo** (ACL 2024) | Multi-session conversational QA | Saturated; vendor scores ~90+ |
| **LongMemEval** (ICLR 2025) | Knowledge update, temporal, multi-session | Still used; LongMemEval-S often fits in modern windows |
| **BEAM** | 1M / 10M token scale; contradiction, abstention | Best “context won’t save you” stress test |
| **LoCoMo-Plus** (2025) | Adds “cognitive” cue–trigger inference | Inherits LoCoMo GT bugs |

### Criticisms (take seriously)
- [Penfield Labs audit, Apr 2026](https://penfieldlabs.substack.com/p/we-audited-locomo-64-of-the-answer): **6.4%** score-corrupting GT errors; theoretical ceiling ~93.6%; `gpt-4o-mini` judge accepted **~63%** of intentionally wrong topical answers.
- [locomo-audit AUDIT_REPORT](https://github.com/dial481/locomo-audit/blob/main/AUDIT_REPORT.md)
- [AgentOS — benchmark transparency](https://agentos.sh/blog/memory-benchmark-transparency-audit/): LongMemEval-S often measures compression vs 115K context, not true long-term memory; LongMemEval-M (~1.5M) restores discrimination.
- No standardized ingestion/answer/judge pipeline across vendors → table comparisons are marketing.

**For PPD:** Build a **domain eval set** (coach preference retention, athlete fact update, injury contradiction, cross-athlete isolation, GDPR delete verification). Use LoCoMo only as a regression canary, not a KPI.

---

## 10. Privacy and GDPR — deleting memories that were baked into summaries

### Legal / technical reality (2025–2026)
- Embeddings are increasingly treated as **personal data** if invertible to source text ([EDPB Opinion 28/2024](https://www.edpb.europa.eu/) direction; practitioner writeups e.g. [Your Embeddings Are PII](https://tianpan.co/blog/2026-07-02-your-embeddings-are-pii)).
- Art. 17 requires **verifiable, irreversible** erasure — not “hide from search.”
- [Ghost Vectors (arxiv:2606.18497)](https://arxiv.org/abs/2606.18497): HNSW soft-deletes leave reconstructible vectors on disk (Chroma/FAISS/Weaviate tested). Soft-delete ≠ erasure. Mitigation: physical index rebuild / compaction, or **cryptographic shredding** (per-subject AES key destroyed on erasure).
- Derived artifacts (summaries, reflections, community reports, cached prompts) that **contain** the subject’s data must be rewritten or deleted — lineage is mandatory.

### Practical erasure playbook for agent memory
1. **Provenance graph:** every memory row links `source_message_ids[]`, `source_athlete_id`, `derived_from_memory_ids[]`.
2. On erasure request for subject S:
   - Delete/anonymize raw messages attributable to S.
   - Delete semantic memories with `subject_id = S` or athlete scope S.
   - Find summaries/reflections whose provenance set intersects S → **re-run consolidation excluding S** or delete the summary.
   - Tombstone then **VACUUM / rebuild** pgvector HNSW (or encrypt embeddings with subject key and destroy key).
   - Purge Redis/CDN caches, LLM provider logs retention policy, backups via normal backup rotation + crypto shred if needed.
3. Prefer **retrieval memory over fine-tuning** on user PII so Art.17 does not require machine unlearning.
4. Issue a deletion certificate (timestamp, counts, operator) for audits.

Summaries are the hard case: **never treat a summary as source-of-truth without provenance**. If provenance is lost, delete the summary on any subject erasure that *might* have contributed.

---

## 11. Recommended architecture for PPD (Supabase + pgvector)

### 11.1 Build vs buy (explicit)

| Option | Verdict | Why |
|--------|---------|-----|
| **Zep Cloud** | No | US residency / processor risk; we need athlete-scoped sports types; graph ops overhead |
| **Graphiti self-host** | No (for now) | Neo4j + extraction workers for hundreds of athletes is overkill; steal bi-temporal model only |
| **Mem0 Platform** | No | US platform; v3 ADD-only fights our update needs |
| **Mem0 OSS** | Maybe as reference | Can run on pgvector EU, but we’d fight the library for types/bi-temporality/GDPR lineage |
| **Letta** | No as memory product | Full agent OS; adopt sleep-time *pattern* only |
| **LangMem** | Pattern/SDK only | Fine if LangGraph-native; not a bi-temporal store |
| **Build on pgvector** | **Yes** | Already in stack; EU data stays put; scale is tiny for HNSW; we need custom scopes and Art.17 |

**Verdict: Build on pgvector ourselves.** Optionally vendor *extraction prompts* and sleep-time scheduling ideas; do not outsource the store.

### 11.2 Memory types (sports domain)

| `memory_kind` | Cognitive tier | Example |
|---------------|----------------|---------|
| `preference` | Semantic | Coach wants bullet readiness notes in Catalan |
| `athlete_fact` | Semantic (temporal) | Athlete 42 dominant hand right; resting HR ~48 |
| `baseline` | Semantic (temporal) | HRV baseline 72ms computed 2026-06-01 |
| `clinical_status` | Semantic (temporal) | Left knee meniscus — modified training |
| `correction` | Semantic / procedural | Coach: “Do not call HRV ‘stress’ for this athlete” |
| `workflow` | Procedural | Always pull last match load before tournament advice |
| `agent_conclusion` | Episodic→semantic | “2026-05-01: readiness low due to 2 short sleeps” |
| `episode_summary` | Episodic | Compacted summary of chat thread T |
| `org_policy` | Procedural | Club never shares parent-facing injury detail without coach flag |

### 11.3 Tables (DDL sketch)

```sql
-- Extensions
CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Immutable-ish event log (episodic raw)
CREATE TABLE ai_memory_events (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id          uuid NOT NULL,
  user_id         uuid,              -- actor (coach/player/parent)
  athlete_id      uuid,              -- subject of discussion (nullable for org-level)
  conversation_id uuid,
  message_ids     uuid[] NOT NULL DEFAULT '{}',
  event_type      text NOT NULL,     -- 'utterance','tool_result','reflection_job'
  content         text NOT NULL,
  role            text,              -- user|assistant|tool|system
  occurred_at     timestamptz NOT NULL DEFAULT now(),
  ingested_at     timestamptz NOT NULL DEFAULT now(),
  metadata        jsonb NOT NULL DEFAULT '{}',
  deleted_at      timestamptz
);

CREATE INDEX ai_memory_events_scope_idx
  ON ai_memory_events (org_id, athlete_id, occurred_at DESC)
  WHERE deleted_at IS NULL;

-- Semantic / procedural memories (current + historical via validity)
CREATE TABLE ai_memories (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id             uuid NOT NULL,
  user_id            uuid,           -- owner of preference (coach), nullable
  athlete_id         uuid,           -- NULL = org/coach-global
  memory_kind        text NOT NULL,
  subject_key        text,           -- stable key for upsert, e.g. 'baseline:hrv'
  content            text NOT NULL,  -- canonical natural-language fact
  content_hash       text NOT NULL,  -- sha256(normalized content)
  embedding          vector(1536),
  importance         real NOT NULL DEFAULT 0.5,  -- prior or sleep-time score
  confidence         real NOT NULL DEFAULT 0.8,
  -- Bi-temporal (Graphiti-inspired)
  valid_from         timestamptz NOT NULL DEFAULT now(),
  valid_to           timestamptz,    -- NULL = currently valid
  recorded_at        timestamptz NOT NULL DEFAULT now(),
  invalidated_at     timestamptz,    -- when we learned it was false
  invalidated_by     uuid REFERENCES ai_memories(id),
  -- Provenance
  source_event_ids   uuid[] NOT NULL DEFAULT '{}',
  derived_from       uuid[] NOT NULL DEFAULT '{}',
  created_by         text NOT NULL DEFAULT 'extractor_v1',
  -- Lifecycle
  access_count       int NOT NULL DEFAULT 0,
  last_accessed_at   timestamptz,
  decay_half_life_days int,          -- null = no decay (preferences)
  status             text NOT NULL DEFAULT 'active'
                       CHECK (status IN ('active','superseded','deleted','pending_review')),
  metadata           jsonb NOT NULL DEFAULT '{}',
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now()
);

-- Current facts only (hot path)
CREATE INDEX ai_memories_active_scope_idx
  ON ai_memories (org_id, athlete_id, memory_kind)
  WHERE status = 'active' AND valid_to IS NULL AND deleted_at IS NULL;
-- note: use status; add deleted_at column if soft-delete preferred:
-- ALTER: deleted_at timestamptz

ALTER TABLE ai_memories ADD COLUMN IF NOT EXISTS deleted_at timestamptz;

CREATE INDEX ai_memories_trgm_idx
  ON ai_memories USING gin (content gin_trgm_ops);

CREATE INDEX ai_memories_hnsw_idx
  ON ai_memories USING hnsw (embedding vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);

-- Dedup / subject uniqueness for current rows
CREATE UNIQUE INDEX ai_memories_subject_live_uidx
  ON ai_memories (org_id, COALESCE(athlete_id, '00000000-0000-0000-0000-000000000000'::uuid),
                  COALESCE(user_id, '00000000-0000-0000-0000-000000000000'::uuid),
                  memory_kind, subject_key)
  WHERE status = 'active' AND valid_to IS NULL AND deleted_at IS NULL
    AND subject_key IS NOT NULL;

-- Optional Letta-style pinned blocks (working/core memory)
CREATE TABLE ai_memory_blocks (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id       uuid NOT NULL,
  user_id      uuid,
  athlete_id   uuid,
  label        text NOT NULL,   -- 'coach_profile','athlete_card','agent_persona'
  content      text NOT NULL DEFAULT '',
  max_chars    int NOT NULL DEFAULT 2000,
  version      int NOT NULL DEFAULT 1,
  updated_at   timestamptz NOT NULL DEFAULT now(),
  UNIQUE (org_id, user_id, athlete_id, label)
);

-- Erasure audit
CREATE TABLE ai_memory_erasure_log (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id        uuid NOT NULL,
  subject_type  text NOT NULL,  -- 'user'|'athlete'
  subject_id    uuid NOT NULL,
  memories_removed int NOT NULL,
  events_removed   int NOT NULL,
  summaries_rewritten int NOT NULL,
  index_compacted  boolean NOT NULL DEFAULT false,
  certificate   jsonb NOT NULL,
  created_at    timestamptz NOT NULL DEFAULT now()
);
```

RLS: mirror existing org membership; coaches only read/write memories for athletes they can access; never return rows for other athletes in the same org without explicit multi-athlete intent.

### 11.4 Write path

```
Coach/player message lands
  → persist ai_memory_events (always; correct message ids)
  → enqueue sleep-time job (debounce 30–120s idle OR end-of-turn)
Sleep-time worker (stronger/cheaper model, e.g. GPT-4.1-mini / Claude Haiku / self-host):
  1. Load last N events + current active memories for (org, user, athlete)
  2. LLM extract structured candidates:
       {kind, subject_key, content, valid_from?, supersedes?}
     CRITICAL: extract from user+assistant pair with explicit athlete_id from session context
  3. For each candidate:
       - embed (fail hard if API key missing — never silent no-op)
       - near-dup: cosine > 0.92 OR same subject_key → UPDATE or NOOP
       - contradiction: same subject_key or LLM flag → set valid_to/invalidated_at on old; INSERT new
       - else ADD
  4. Optionally refresh ai_memory_blocks.athlete_card / coach_profile
Nightly job:
  - compact episode_summary per conversation
  - decay: status=superseded if unused AND past half-life (not for preference/workflow)
  - re-embed only if content changed
```

**Extraction model:** small/fast structured-output model for sleep-time; never block the chat path. Hot-path write only for explicit `correction` (“remember that…”) via tool.

**Fix current bugs in design:**
- Bind `athlete_id` from session router, not from free-text guess alone.
- Embedding provider errors → dead-letter queue + metric, not empty vector.
- Always store `message_ids` used for extraction.

### 11.5 Read path

```
Query q, scopes: org_id + user_id + athlete_id?
  1. Load pinned blocks (coach_profile, athlete_card) — always in working memory
  2. SQL filter FIRST:
       org_id = ? AND status = 'active' AND valid_to IS NULL AND deleted_at IS NULL
       AND (athlete_id IS NULL OR athlete_id = ? OR ? IS NULL for org-only)
       AND (user_id IS NULL OR user_id = ? OR memory_kind IN org-visible kinds)
  3. Hybrid candidates:
       - vector top-50 (HNSW, cosine)
       - keyword/trigram top-50
  4. Fuse (RRF or weighted)
  5. Score:
       final = 0.55*sim + 0.20*recency + 0.15*importance + 0.10*type_prior
       recency = exp(-λ * days_since(coalesce(last_accessed_at, recorded_at)))
  6. Optional cross-encoder / LLM rerank top-20 → top-5..8
  7. Bump access_count / last_accessed_at
  8. Inject into agent context with provenance footnotes
```

**Athlete isolation:** default filter `athlete_id = current OR athlete_id IS NULL` (org/coach prefs). Multi-athlete comparison queries must pass an explicit allow-list.

### 11.6 Conflict resolution

1. Prefer `subject_key` discipline (`baseline:hrv`, `status:injury`, `pref:language`).
2. On conflict: close old row (`valid_to = new.valid_from`, `status = 'superseded'`, `invalidated_by = new.id`); insert new active row.
3. If LLM uncertain → `pending_review` and surface to coach UI.
4. Corrections from coach outrank agent_conclusion of same key.

### 11.7 Decay and compaction

| Kind | Half-life | Compaction |
|------|-----------|------------|
| preference, workflow, correction | none | Manual / explicit update |
| athlete_fact, baseline, clinical_status | none (use invalidation) | Supersede only |
| agent_conclusion | 30–90 days | Roll into episode_summary |
| episode_summary | 180 days | Hierarchical merge |

Decay affects **retrieval score** before hard delete. Hard delete only after GDPR or retention policy.

### 11.8 GDPR deletion story

Procedure `erase_memory_subject(org_id, subject_type, subject_id)`:
1. Soft-delete matching events + memories.
2. Select summaries where `source_event_ids || derived_from` intersect erased ids → re-extract or delete.
3. Clear blocks mentioning subject; rebuild athlete_card from remaining facts or empty.
4. `UPDATE ... SET embedding = NULL` then physical delete; schedule `REINDEX INDEX CONCURRENTLY ai_memories_hnsw_idx` (or periodic rebuild) so HNSW does not keep ghost vectors.
5. Optional: encrypt `embedding` with per-athlete key; destroy key on erasure (crypto shred).
6. Write `ai_memory_erasure_log` certificate.

---

## 12. Implementation phasing

1. **Schema + athlete filter + hard fail on embeddings** (fixes bleeding issues).
2. **Sleep-time extractor** with ADD/UPDATE/INVALIDATE + `subject_key`.
3. **Hybrid retrieval + scoring**; pinned blocks for coach/athlete.
4. **Nightly compaction + decay scoring**.
5. **Erasure procedure + index rebuild runbook**.
6. Domain eval harness (10–20 scripted dialogues) before chasing LoCoMo.

---

## 13. Source index

### Taxonomy / surveys
- https://arxiv.org/abs/2309.02427 — CoALA
- https://arxiv.org/abs/2603.07670 — Memory for Autonomous LLM Agents
- https://arxiv.org/html/2602.06052v3 — Foundation agent memory survey
- https://arxiv.org/abs/2512.13564 — Memory in the Age of AI Agents
- https://atlan.com/know/types-of-ai-agent-memory/
- https://zylos.ai/research/2026-04-05-ai-agent-memory-architectures-persistent-knowledge/

### Generative Agents
- https://arxiv.org/abs/2304.03442
- https://dl.acm.org/doi/10.1145/3586183.3606763
- https://arxiv.org/abs/2604.27707 — “memo not true memory” critique

### MemGPT / Letta
- https://arxiv.org/abs/2310.08560 — MemGPT
- https://arxiv.org/abs/2504.13171 — Sleep-time Compute
- https://www.letta.com/blog/sleep-time-compute/
- https://docs.letta.com/guides/agents/memory
- https://github.com/letta-ai/letta/

### Zep / Graphiti
- https://arxiv.org/abs/2501.13956
- https://github.com/getzep/graphiti
- https://help.getzep.com/graphiti/getting-started/overview
- https://www.getzep.com/platform/graphiti/

### Mem0
- https://arxiv.org/abs/2504.19413
- https://mem0.ai/research
- https://mem0.ai/blog/state-of-ai-agent-memory-2026
- https://docs.mem0.ai/migration/oss-v2-to-v3
- https://docs.mem0.ai/platform/platform-vs-oss
- https://github.com/mem0ai/mem0

### LangMem / LangGraph
- https://langchain-ai.github.io/langmem/
- https://langchain-ai.github.io/langmem/concepts/conceptual_guide/
- https://langchain-ai.github.io/langmem/background_quickstart/

### Benchmarks & audits
- https://arxiv.org/abs/2402.17753 — LoCoMo
- https://arxiv.org/abs/2410.10813 — LongMemEval
- https://github.com/mohammadtavakoli78/BEAM
- https://penfieldlabs.substack.com/p/we-audited-locomo-64-of-the-answer
- https://github.com/dial481/locomo-audit/blob/main/AUDIT_REPORT.md
- https://agentos.sh/blog/memory-benchmark-transparency-audit/
- https://dreaming.press/posts/locomo-vs-longmemeval-vs-beam-agent-memory.html

### GDPR / embeddings
- https://arxiv.org/abs/2606.18497 — Ghost Vectors
- https://tianpan.co/blog/2026-07-02-your-embeddings-are-pii
- https://tianpan.co/blog/2026-07-05-the-user-you-cannot-delete-right-to-be-forgotten-in-ai

---

## 14. One-page recommendation

Stay on **Supabase Postgres + pgvector**. Model memories as **bi-temporal, typed, provenance-linked rows** with athlete/org/user scopes; extract on a **sleep-time** worker with ADD/UPDATE/INVALIDATE; retrieve with **filter-then-hybrid-then-rerank**; pin coach/athlete **memory blocks** into working context. Reject Zep/Mem0/Letta as stores under EU self-host + our scale; copy their best ideas. Measure success with a sports-domain eval, not vendor LoCoMo leaderboards.
