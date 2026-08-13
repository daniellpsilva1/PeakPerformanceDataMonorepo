# 49 — Context Engineering for Multi-Agent Sports Performance AI

**Date:** 2026-08-02  
**Scope:** External research dossier on context engineering for an orchestrator + specialist multi-agent Python system (tennis academies). ~60–120 tools; multi-turn coach/athlete chat; nightly batch insights over wearable, training, tennis match, biomarker, genetics, and CGM data; multilingual output.  
**Method:** Primary sources fetched and read directly (Anthropic engineering posts, Chroma Context Rot report, Drew Breunig essays, Claude Tool Search docs, RAG-MCP paper, Du et al. 2025). Secondary synthesis only where it cites those primaries.

---

## 1. Definition and guiding principle

**Context engineering** is the practice of curating and maintaining the optimal set of tokens during LLM inference — system instructions, tool schemas, MCP/metadata, retrieved data, and message history — not merely writing a better system prompt.

Anthropic’s definition (Sep 29, 2025):

> Context engineering refers to the set of strategies for curating and maintaining the optimal set of tokens (information) during LLM inference… Context engineering is the art and science of curating what will go into the limited context window from that constantly evolving universe of possible information.

**Guiding principle (Anthropic):** find the *smallest set of high-signal tokens that maximize the likelihood of the desired outcome*. Context is a finite **attention budget** with diminishing returns — not a junk drawer to fill because the window is large.

**Sources:**
- https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents
- https://platform.claude.com/cookbook/tool-use-context-engineering-context-engineering-tools

---

## 2. Context rot — measured findings

### 2.1 Coining study: Chroma “Context Rot” (July 2025)

**Hong, Troynikov, Huber — Chroma Research, July 2025.**  
https://www.trychroma.com/research/context-rot  
Cite: `@techreport{hong2025context, title={Context Rot: How Increasing Input Tokens Impacts LLM Performance}, author={Hong, Kelly and Troynikov, Anton and Huber, Jeff}, year={2025}, month={July}, institution={Chroma}}`

**Design:** Hold task complexity constant; vary only input length. Evaluate **18 LLMs**. Tasks beyond lexical NIAH: semantic (non-lexical) needles, distractors, haystack structure, LongMemEval conversational QA (~113k tokens), repeated-words replication.

**Measured findings:**

| Finding | Detail |
| --- | --- |
| Uniform degradation | Performance declines as input length grows even on deliberately simple tasks |
| Similarity compounds length | Lower needle–question embedding similarity → steeper degradation vs length |
| Distractors amplify with length | Even one distractor hurts vs baseline; four distractors compound; impact is non-uniform across distractors |
| Model-family differences | Claude models more often abstain under ambiguity; GPT models higher hallucination rates under distractors |
| Haystack structure | Models perform *worse* on logically coherent haystacks than on sentence-shuffled haystacks (structure is not free) |
| LongMemEval | Models succeed on “focused” relevant-only inputs; degrade when given full ~113k history (retrieval + reasoning together) |
| Implication for agents | Real agent/synthesis tasks are harder than these controlled tests → expect *worse* degradation in production |

Anthropic cites this line of work: as tokens increase, accurate recall from context decreases; transformer n² attention stretches thin; training distributions favor shorter sequences.

### 2.2 Length hurts even with perfect retrieval (Du et al., Oct 2025 / EMNLP Findings)

**Du et al. — “Context Length Alone Hurts LLM Performance Despite Perfect Retrieval”**  
https://arxiv.org/abs/2510.05381 · https://aclanthology.org/2025.findings-emnlp.1264/

**Key measured findings:**

- Across 5 open/closed models (math, QA, coding): even when models **perfectly retrieve** all evidence (100% exact match), accuracy still drops **13.9%–85%** as length grows (still within claimed windows).
- Example: Llama-3.1-8B Instruct retrieves evidence correctly on 970/1000 MMLU items at 30k tokens, yet accuracy drops **24.2%** vs short context.
- Drop persists with whitespace-only padding, with evidence placed immediately before the question, and even when irrelevant tokens are **masked** so the model attends only to evidence + question.
- **Implication:** failure is not only “can’t find the needle” — *sheer length* impairs reasoning.
- Mitigation: **retrieve-then-recite** — force the model to recite evidence, then solve on a short reconstructed prompt (+ up to ~4% on GPT-4o / RULER).

### 2.3 Operational takeaway for our system

Do **not** preload week-of wearable rows, full match play-by-play, or 100 tool schemas “because we have 200k context.” Target working contexts in the **low tens of thousands of tokens** for reasoning turns. Prefer short, high-signal assemblies + JIT fetch + sub-agent isolation over stuffing.

---

## 3. Four failure modes — original articulations

**Primary source:** Drew Breunig, *How Long Contexts Fail* (2025-06-22)  
https://www.dbreunig.com/2025/06/22/how-contexts-fail-and-how-to-fix-them.html  

**Companion mitigations:** *How to Fix Your Context* (2025-06-26)  
https://www.dbreunig.com/2025/06/26/how-to-fix-your-context.html  

**O’Reilly Radar republication:** https://www.oreilly.com/radar/working-with-contexts/

| Mode | Definition (Breunig) | Sports-platform example | Primary mitigations |
| --- | --- | --- | --- |
| **Context poisoning** | Hallucination/error enters context and is repeatedly referenced as ground truth | Agent invents “Maria slept 4h Tuesday”; later tools and summary treat it as fact | Validate tool outputs against schema; never write unverified claims into durable memory; quarantine untrusted summaries |
| **Context distraction** | Context grows so long the model over-focuses on history vs training | After 80k tokens of tool dumps, agent repeats last week’s training advice instead of synthesizing new readiness drivers | Compact early; clear stale tool results; keep under distraction ceilings (~32k smaller models; ~100k anecdotal Gemini Pokémon agent) |
| **Context confusion** | Superfluous content (esp. too many tools) influences a low-quality response | 90 tools loaded; model calls `get_cgm_trends` for a readiness question because description overlaps | Tool loadout / search; hierarchical namespaces; ≤~15–25 tools in active window |
| **Context clash** | Accrued info/tools conflict with other parts of context | Early turn guessed “overtraining”; later HRV data contradicts, but early wrong answer still in history | Isolate specialists; prune wrong hypotheses; recite current evidence before final answer; single source of truth for athlete state |

**Empirical anchors Breunig cites:**

- Gemini 2.5 Pokémon agent: beyond ~**100k** tokens, tendency to *repeat past actions* vs novel plans (context distraction).
- Databricks: correctness falling around **~32k** for Llama 3.1 405B (earlier for smaller models).
- Berkeley Function-Calling Leaderboard: models worse with more tools; all models sometimes call irrelevant tools.
- “Less is More” / GeoEngine: Llama 3.1 8B fails with **46** tools, succeeds with **19**.
- Microsoft/Salesforce sharding study: multi-turn sharded prompts → average **~39%** drop; o3 98.1 → 64.1 — early wrong answers poison later turns (**clash**).

---

## 4. Compaction, tool clearing, and what to preserve

### 4.1 Compaction (Anthropic)

**Definition:** When conversation nears a limit (or a softer distraction threshold), summarize contents and **reinitiate a new window** with the summary + minimal continuation state.

Claude Code pattern:

1. Pass message history to the model to summarize.
2. Preserve: architectural/domain decisions, unresolved questions, key facts, implementation/state details.
3. Discard: redundant tool outputs, chit-chat, superseded intermediate dumps.
4. Continue with compressed context + **recently accessed artifacts** (Claude Code: five most recently accessed files).

**Tuning advice:** Maximize recall first (don’t lose critical state), then improve precision (drop superfluity). Over-aggressive compaction loses subtle facts that matter later.

### 4.2 Tool-result clearing (lighter than full compaction)

Replace old `tool_result` payloads with short placeholders while keeping `tool_use` records. Rationale: once deep in history, raw results are re-fetchable; the model rarely needs the full blob again.

Claude Cookbook framing:

| Technique | Operates on | When | Survivability |
| --- | --- | --- | --- |
| Compaction | Whole window → summary | Approaching limit / distraction | Continues in new window |
| Tool-result clearing | Surgical replace of old results | Token threshold mid-session | Same thread, leaner |
| Memory / notes | External files | Cross-session / long-horizon | Outside window |

https://platform.claude.com/cookbook/tool-use-context-engineering-context-engineering-tools

### 4.3 What our agents must preserve on compact

**Always keep:**

- Athlete identity + IDs (stable UUIDs, never ambiguous names alone)
- User intent and open questions
- Locale / language for output
- Verified numeric findings with **source + as-of timestamp** (e.g., “HRV 7d avg −18% vs baseline; source: `get_hrv_trends`; as_of: 2026-08-02”)
- Decisions already communicated to coach
- Contradictions / uncertainty flags
- Active hypotheses still under investigation

**Safe to drop / clear:**

- Raw row dumps, full JSON tool payloads older than last N tool rounds
- Failed tool retries once a successful fetch exists
- Intermediate specialist prose once orchestrator has absorbed the distilled summary
- Duplicate readiness scores from earlier turns if a fresher one exists

---

## 5. Sub-agent isolation as context management (not just parallelism)

Anthropic’s multi-agent research system reframes sub-agents primarily as **context compression and quarantine**:

> The essence of search is compression… Subagents facilitate compression by operating in parallel with their own context windows… Each subagent also provides separation of concerns—distinct tools, prompts, and exploration trajectories… Each subagent might explore extensively, using tens of thousands of tokens… but returns only a condensed, distilled summary (often 1,000–2,000 tokens).

https://www.anthropic.com/engineering/built-multi-agent-research-system  
Breunig’s term: **Context Quarantine** — isolate contexts in dedicated threads.

**For our design (load-bearing):**

| Agent | Context role | Returns to orchestrator |
| --- | --- | --- |
| Orchestrator | High-level plan, synthesis, coach-facing answer | Final answer |
| Wearable / readiness specialist | Sleep, HRV, strain, recovery — dirty tool loops | ≤1.5–2k token brief |
| Training load specialist | Sessions, ACWR, compliance | ≤1.5–2k brief |
| Tennis match specialist | Match stats, serve, rally patterns | ≤1.5–2k brief |
| Biomarker / genetics / CGM specialists | Lab panels, polygenic notes, glucose | ≤1–2k brief each |

**Why this framing matters:** We spawn specialists to *keep poison, distraction, and clash out of the lead window*, not merely to parallelize. A wearable specialist may burn 40k tokens of CGM/HRV dumps; the orchestrator should see only the distilled causal claims.

**Caveats from Anthropic:** Multi-agent ~15× chat token cost; needs high-value tasks; poor fit when all agents must share identical mutable state every step. Nightly batch and multi-domain “why is readiness down?” queries *are* high-value and breadth-first → good fit.

---

## 6. Just-in-time vs preload

Anthropic: shift from embedding-based pre-retrieval stuffing toward **just-in-time** — keep lightweight identifiers (paths, queries, athlete IDs, date ranges) and load via tools at runtime. Progressive disclosure: discover layer by layer.

**Hybrid (recommended for us):**

| Preload (always / session start) | JIT (tools / specialists) |
| --- | --- |
| Compact athlete card (identity, sport, role, locale) | Daily wearable series, sleep stages |
| Last 7d readiness headline metrics | Full training session logs |
| Known data availability flags (has CGM? genetics?) | Match point-level / shot stats |
| Active injuries / flags from notes | Biomarker panels, genetics reports |
| Coach question + language | Prior AI insights archive search |

Claude Code hybrid analogy: `CLAUDE.md` preloaded; `glob`/`grep` for JIT exploration.

**Trade-off:** JIT is slower (extra tool rounds) but resists staleness and context rot. Preload only what is needed for *routing and first-pass reasoning*.

---

## 7. Structured note-taking / external memory

Anthropic: agent writes notes **outside** the window; pulls them back later. Examples: Claude Code todos; Pokémon agent maps/tallies surviving context resets; Memory tool (Sonnet 4.5+) file-based persistence.

Breunig: **Context Offloading** — scratchpad / think tool; up to **54%** gain on specialized-agent benchmarks when paired with domain prompts.

**Our external memory files (suggested):**

```
memory/
  athletes/{athlete_id}/profile.md          # durable facts (coach-confirmed)
  athletes/{athlete_id}/working_notes.md    # session scratch (hypotheses, TODOs)
  athletes/{athlete_id}/insight_log.md      # prior nightly insights (pointers + hashes)
  runs/{batch_id}/{athlete_id}.md           # per-run artifact for nightly
```

**Rules:**

1. Only **verified** facts go to `profile.md` (tool-backed or coach-confirmed).
2. Hypotheses go to `working_notes.md` with status: `open | supported | rejected`.
3. On compact, write notes *before* summarizing so critical state survives even if summary is lossy.
4. Never treat model-invented numbers as profile facts (anti-poisoning).

---

## 8. Token budgeting — production allocation patterns

There is no single industry standard percentage table; production practice converges on:

1. **Tools + system first** (stable prefix for caching).
2. **Retrieved / dynamic data next.**
3. **Conversation history with compaction.**
4. **Reserved headroom for output + thinking.**

Anthropic prompt caching render order: **`tools` → `system` → `messages`**. Any byte change earlier invalidates everything after. Cache reads ~0.1× input price; writes 1.25× (5-min TTL) or 2× (1-hour TTL).

https://www.anthropic.com/news/prompt-caching  
https://docs.anthropic.com/en/docs/build-with-claude/prompt-caching (conceptual; see also https://github.com/anthropics/skills/blob/main/skills/claude-api/shared/prompt-caching.md)

**Soft ceilings to respect:**

- Prefer reasoning working set **≪ 100k** (distraction anecdotes).
- Tool definitions alone: Anthropic cites ~**55k** for a typical multi-MCP setup → bad; Tool Search cuts ~**85%**.
- Trigger compaction / clearing well before hard window (e.g., at **40–60%** of model window for agentic loops).

---

## 9. Large tool catalogs (60–120 tools) — failure and mitigations

### 9.1 Why this is load-bearing

- Anthropic Tool Search docs: selection accuracy degrades beyond **~30–50** tools; multiserver defs can burn **~55k** tokens before any work.
- RAG-MCP (Gan & Sun, May 2025): https://arxiv.org/abs/2505.03275 — naïve full catalog ≈ **13.62%** selection accuracy vs **43.13%** with retrieval; prompt tokens ~**2134 → 1084**; success high under ~30 candidates; failures dominate beyond ~100.
- Breunig / Less is More: 46 tools fail, 19 succeed on same model/benchmark.

### 9.2 Mitigation stack (layered)

| Layer | Mechanism | Use in our system |
| --- | --- | --- |
| **1. Hierarchical namespaces** | Domains: `wearable.*`, `training.*`, `tennis.*`, `biomarker.*`, `genetics.*`, `cgm.*`, `memory.*`, `meta.*` | Catalog organization + search facets |
| **2. Orchestrator tool filtering** | Intent router exposes only relevant namespaces (e.g., readiness Q → wearable + training + memory) | First cut: 120 → ~25–40 candidates |
| **3. Progressive disclosure / Tool Search** | Always-load 3–8 core tools; `defer_loading` / search for the rest | Claude Tool Search: https://platform.claude.com/docs/en/agents-and-tools/tool-use/tool-search-tool |
| **4. Specialist loadouts** | Each specialist gets a hand-curated 8–15 tools | Context quarantine + confusion control |
| **5. Token-efficient tools** | Return summaries + pointers, not full tables; pagination (`head`/`tail` pattern) | Anti-distraction |

**Anthropic Tool Search mechanics (2025–2026):** Mark tools `defer_loading: true`; keep search tool + 3–5 hot tools non-deferred; API searches catalog and injects up to ~5 matching defs. Reported: ~77k → ~8.7k tokens (~85% reduction) for 50+ MCP tools.

**Recommended default for our 60–120 tools:**

1. **Namespace filter by intent** (deterministic router — no LLM needed for first cut).
2. **Always-load core tools** (~6–8): athlete summary, readiness snapshot, sleep summary, training load summary, note read/write, spawn_specialist, (optional) tool_search.
3. **Defer / search** the long-tail schemas.
4. **Specialists** get fixed small loadouts (never the full 120).
5. Keep tool list **byte-stable and sorted** for prompt cache.

---

## 10. Concrete context budget — coach chat

**Scenario:** Coach asks: *“Why is Maria's readiness down this week?”*  
**Assume:** Claude-class ~200k window; target **working input ≤ ~28–35k** before tools loop; reserve **4–8k** for output (+ thinking if enabled).

### 10.1 Budget table (orchestrator, turn 1 after routing)

| Slice | Contents | Approx tokens | Cache? |
| --- | --- | --- | --- |
| **A. Tool schemas (active)** | Always-load 6–8 tools + any searched (≤5) + `spawn_specialist` | 3,000–6,000 | Yes (stable catalog prefix) |
| **B. System prompt** | Role, safety, multilingual rules, domain heuristics, tool guidance, output schema | 2,500–4,000 | Yes |
| **C. Athlete card (preloaded)** | See §10.2 | 800–1,200 | Per-athlete segment (optional 2nd breakpoint) |
| **D. Session memory pointers** | Paths + last insight headlines | 200–400 | Soft |
| **E. Conversation history** | Compacted summary + last 4–6 raw turns | 1,500–4,000 | No (grows) |
| **F. Current user message** | Question + locale + athlete_id | 50–150 | No |
| **G. Headroom for tool results this turn** | JIT fetches / specialist returns | 8,000–12,000 | No |
| **H. Output reserve** | Coach-facing answer | 2,000–4,000 | — |
| **Total working target** | | **~20k–32k** input-ish | |

*If using full 100+ tool schemas without search: add ~40–70k — reject this design.*

### 10.2 System prompt sections (orchestrator)

Use Markdown/XML sections (Anthropic recommendation):

1. `<role>` — sports performance orchestrator for tennis academies; coaches/athletes/parents; no medical diagnosis; escalate clinical red flags.
2. `<altitude_heuristics>` — causal readiness reasoning; prefer measured deltas vs baselines; separate correlation vs mechanism.
3. `<data_domains>` — wearable, training, tennis, biomarkers, genetics, CGM — when each is relevant.
4. `<tool_guidance>` — prefer summary tools first; spawn specialists for deep dives; never invent metrics; cite tool + date.
5. `<multilingual>` — answer in user’s locale; keep metric units consistent; preserve proper names.
6. `<memory_rules>` — what may be written to profile vs working notes.
7. `<output_contract>` — structured sections: Verdict → Drivers (ranked) → Evidence → Uncertainties → Suggested actions.
8. `<examples>` — 2–3 *canonical* readiness explanations (not an edge-case laundry list).

### 10.3 Tools exposed on this turn (example loadout)

**Always loaded (~6–8):**

1. `athlete.get_card`
2. `wearable.get_readiness_snapshot` (7–14d)
3. `wearable.get_sleep_summary`
4. `training.get_load_summary`
5. `memory.read_notes` / `memory.write_notes`
6. `meta.spawn_specialist`
7. `meta.tool_search` (or server-side Tool Search)

**Deferred / discoverable:** CGM series, genetics report, biomarker panels, tennis match detail, raw HRV nightly series, calendar conflicts, etc.

**Specialist spawn plan for this question:**

1. `wearable_readiness` — sleep debt, HRV, RHR, strain, illness flags  
2. `training_load` — ACWR, hard sessions, travel  
3. Optionally `tennis_match` if competition week  
4. Optionally `cgm` / `biomarker` only if card flags data present and hypothesis warrants

### 10.4 Athlete summary preloaded (~900 tokens)

```text
athlete_id: ath_maria_…
name: Maria …
sport: tennis; academy_role: player
locale: en; units: metric
age_band: U18
data_availability: wearable=yes, training=yes, tennis_matches=yes, cgm=no, genetics=yes, biomarkers=partial
baselines: readiness_28d_avg=72; hrv_28d_avg=68ms; sleep_28d_avg=7.6h
this_week_headlines:
  readiness_7d_avg=58 (Δ −14 vs 28d)
  hrv_7d_avg=55ms (Δ −19%)
  sleep_7d_avg=6.4h
  training_load_7d: high (ACWR 1.45)
active_flags: mild DOMS note 2026-07-30 (coach-entered)
last_insight_ptr: memory/athletes/ath_maria…/insight_log.md#2026-07-26
```

### 10.5 Fetched just-in-time

| Fetch | Why JIT |
| --- | --- |
| Nightly HRV/sleep stage series | Large; only if explaining the −14 readiness |
| Session-by-session RPE / duration | Training specialist |
| Match schedule + match stats | Only if competition hypothesized |
| Genetics / labs | Only if chronic pattern or coach asks |
| Prior chat verbatim | Prefer compacted memory pointers |

### 10.6 Conversation history compaction policy

| Stage | Action |
| --- | --- |
| Turns 1–4 | Keep raw |
| After each specialist return | Clear bulky tool_results older than last 2 rounds; keep citations in notes |
| At ~20k cumulative messages | Compact: intent, findings table, open questions, rejected hypotheses |
| On compact | Flush `working_notes.md` first |
| Never compact away | Athlete IDs, numeric evidence with sources, coach corrections |

**Compaction template fields:** `intent`, `locale`, `athlete_ids`, `evidence[]`, `hypotheses[]`, `rejected[]`, `actions_proposed[]`, `coach_corrections[]`.

### 10.7 End-state context for final coach answer

Orchestrator should hold roughly:

- System + tools (~6–10k cached)
- Athlete card (~1k)
- 2–3 specialist briefs (~3–6k total)
- Compact history (~1–2k)
- Question (~0.1k)

Then produce ranked causal answer with citations — **retrieve-then-recite** style: list evidence bullets first, then verdict (Du et al. mitigation adapted to chat).

---

## 11. Nightly batch context strategy (×500 same-shaped runs)

**Shape:** Same insight template for each athlete: readiness / training / tennis / flags → structured insight record.

### 11.1 Maximize prompt cache hits

Render order: **identical tools → identical system → varying messages**.

| Component | Identical across 500 runs? | Notes |
| --- | --- | --- |
| Full tool catalog / deferred defs | **Yes** — sort by name; freeze for the batch version | Tools sit at prefix position 0 |
| System prompt (batch insight persona) | **Yes** — no timestamps, no “today is…” inside system | Put date in user message |
| Output JSON schema / few-shot examples | **Yes** | Part of system or static first user preamble |
| Specialist prompts | **Yes** per specialist type | Separate cache per agent type |
| Athlete card + metrics | **No** — per-athlete user message | After cache breakpoint |
| Locale | Prefer batching by locale so system stays identical; else put locale in user message | Avoid splitting cache |

**Cache breakpoints:**

1. After tools + system (+ static few-shots).  
2. Optional: not on athlete content.

**TTL:** Use **1-hour** ephemeral cache for overnight batch (5-minute TTL dies mid-job). Keep requests flowing so the prefix stays warm; process athletes in a tight loop / Message Batches API with shared prefix.

**Anti-patterns that bust cache:**

- Injecting `run_id`, `utcnow()`, or athlete name into system prompt
- Reordering tools between requests
- Hot-swapping tool subsets per athlete (prefer defer_loading / search with **same** tools array every time)
- Nondeterministic JSON key order in tool defs

### 11.2 Per-athlete message (uncached variable tail)

```text
batch_date: 2026-08-02
athlete_card: {…}
domain_snapshots: { readiness, sleep, load, tennis_week }  # capped summaries, not raw rows
memory_ptrs: […]
task: Generate nightly insight per schema v3. Emit locale=en.
```

Target variable tail: **1.5–4k tokens**. Deep dives via tools/specialists only on anomaly triggers (readiness Δ > threshold).

### 11.3 Batch-specific context engineering

1. **Two-phase:** (A) cheap anomaly screen with tiny context; (B) deep specialist path only for flagged athletes (~10–20%).  
2. **No chat history** — start clean each athlete (avoids clash/poison carryover).  
3. **Write insight to external store** + short pointer in `insight_log.md`; don’t accumulate prior insights in-prompt beyond last 1–2 headlines.  
4. **Sub-agents for flagged athletes only** — quarantine heavy domains.  
5. **Idempotent tool results** — same query → same summary shape for eval stability.

### 11.4 Illustrative batch token economics (one deep athlete)

| Slice | Tokens | Cached read? |
| --- | --- | --- |
| Tools + system + schema examples | 12,000 | Yes (after first write) |
| Athlete tail | 2,500 | No |
| Tool/specialist loops | 8,000–20,000 | No |
| Output insight | 1,500–3,000 | — |

For 500 athletes with ~20% deep-dive: most pay **cache-read** on the 12k prefix; only ~100 pay large JIT loops.

---

## 12. Recommended architecture (synthesis)

```text
              +---------------------------+
              | Intent + namespace router  |
              | (deterministic filter)    |
              +-------------+-------------+
                            |
              +-------------v-------------+
              | Orchestrator              |
              | small tool loadout        |
              | athlete card preload      |
              | memory R/W                |
              +------+-------------+------+
                     |             |
        spawn (quarantine)   JIT summary tools
                     |
        +------------+------------+
        v            v            v
   Wearable     Training      Tennis/...
   specialist   specialist    specialist
   (8-15 tools) (8-15 tools)  (8-15 tools)
   returns <=2k returns <=2k  returns <=2k
```

**Policy stack:** Select (loadout) → Isolate (specialists) → Offload (notes) → Clear (tool results) → Compact (history) → Recite (evidence before final answer).

---

## 13. Source index (URLs)

| Topic | URL |
| --- | --- |
| Effective context engineering for AI agents (Anthropic, 2025-09-29) | https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents |
| Context engineering cookbook (compaction, clearing, memory) | https://platform.claude.com/cookbook/tool-use-context-engineering-context-engineering-tools |
| Multi-agent research system (sub-agent compression) | https://www.anthropic.com/engineering/built-multi-agent-research-system |
| Building effective agents | https://www.anthropic.com/engineering/building-effective-agents |
| Tool Search tool (defer_loading, progressive disclosure) | https://platform.claude.com/docs/en/agents-and-tools/tool-use/tool-search-tool |
| Advanced tool use | https://www.anthropic.com/engineering/advanced-tool-use |
| Prompt caching announcement | https://www.anthropic.com/news/prompt-caching |
| Prompt caching implementation notes | https://github.com/anthropics/skills/blob/main/skills/claude-api/shared/prompt-caching.md |
| Context Rot (Chroma, July 2025) | https://www.trychroma.com/research/context-rot |
| Context length alone hurts (Du et al., 2025) | https://arxiv.org/abs/2510.05381 |
| Du et al. ACL anthology | https://aclanthology.org/2025.findings-emnlp.1264/ |
| How Long Contexts Fail (Breunig) | https://www.dbreunig.com/2025/06/22/how-contexts-fail-and-how-to-fix-them.html |
| How to Fix Your Context (Breunig) | https://www.dbreunig.com/2025/06/26/how-to-fix-your-context.html |
| O’Reilly Working with Contexts | https://www.oreilly.com/radar/working-with-contexts/ |
| RAG-MCP (Gan & Sun, 2025) | https://arxiv.org/abs/2505.03275 |
| Tool Search lazy-loading pattern | https://www.agentpatternscatalog.org/patterns/tool-search-lazy-loading/ |
| Progressive disclosure (agents) | https://www.mindstudio.ai/blog/progressive-disclosure-ai-agents-context-management |
| MCP progressive disclosure | https://www.solo.io/blog/mcp-progressive-disclosure |

---

## 14. Bottom line for implementation

1. Treat context as an **attention budget**, not storage.  
2. **Never** load 60–120 full tool schemas into the orchestrator.  
3. Use **namespace filter + always-load core + Tool Search/defer + specialist loadouts**.  
4. Preload a **~1k athlete card**; JIT everything heavy.  
5. Specialists exist to **quarantine** dirty context and return ≤2k briefs.  
6. Compact/clear aggressively; persist verified state in **external notes**.  
7. Nightly batch: **byte-identical tools+system**, date/athlete only in messages, **1h prompt cache**, anomaly-gated deep dives.
