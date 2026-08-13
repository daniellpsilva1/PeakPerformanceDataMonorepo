# 42 — Multi-Agent Engineering Economics: Evidence vs Fashion

**Research date:** 2026-08-02  
**Scope:** External primary sources (2025–2026 prioritized). Decision framework for sports-performance agentic workloads.  
**Verdict in one line:** Multi-agent pays when work is read-heavy, parallelizable, and value-dense; it is fashion (or actively harmful) for structured batch jobs, latency-sensitive chat, and tightly coupled write/reasoning chains.

---

## 1. Anthropic: Building a Multi-Agent Research System

**Source:** [How we built our multi-agent research system](https://www.anthropic.com/engineering/multi-agent-research-system) (Jun 13, 2025)

### Architecture
Orchestrator–worker pattern:
- **LeadResearcher** plans, saves strategy to Memory (context can hit/truncate at ~200k tokens), spawns specialized subagents, synthesizes, optionally iterates.
- **Subagents** search/fetch in parallel with independent context windows; return compressed findings (not full transcripts).
- **CitationAgent** post-processes claims → source locations.
- Lead/subagent model split in their eval: Claude Opus 4 lead + Claude Sonnet 4 workers.

### Quantified results (quoted figures)
| Metric | Figure | Notes |
|--------|--------|-------|
| Performance vs single-agent Opus 4 | **+90.2%** on internal research eval | Breadth-first research tasks |
| Token usage vs chat | Agents ≈ **4×** chat; multi-agent ≈ **15×** chat | Economic viability requires high task value |
| BrowseComp variance explained | Token usage alone **80%**; tokens + tool calls + model choice ≈ **95%** | Multi-agent works largely by spending more tokens across parallel context windows |
| Parallelization latency win | Parallel subagents + parallel tool calls cut research time **up to 90%** | vs early sequential agents |
| Tool-description self-improvement | **40%** decrease in task completion time | After a tool-testing agent rewrote bad MCP tool descriptions |

Key quote on mechanism:

> “Multi-agent systems work mainly because they help spend enough tokens to solve the problem.”

### When Anthropic says multi-agent fits / does not fit
**Fits:** “valuable tasks that involve heavy parallelization, information that exceeds single context windows, and interfacing with numerous complex tools.” Especially **breadth-first** queries with multiple independent directions (e.g., board members of all IT S&P 500 companies).

**Does not fit:** Domains requiring all agents to share the same context or with many inter-agent dependencies. Explicitly: “most coding tasks involve fewer truly parallelizable tasks than research, and LLM agents are not yet great at coordinating and delegating to other agents in real time.”

### Lessons learned / failure modes they published
1. **Think like your agents** — watch full traces; early bugs: continuing after enough results, verbose queries, wrong tools.
2. **Teach the orchestrator to delegate** — vague briefs (“research the semiconductor shortage”) → duplicate searches / wrong partitions.
3. **Scale effort to query complexity** — without rules, agents over-invest (e.g., spawning ~50 subagents for simple queries). Heuristics: simple fact → 1 agent, 3–10 tool calls; comparisons → 2–4 subagents; complex research → 10+ with clear boundaries.
4. **Tool design is critical** — bad tool descriptions send agents down wrong paths.
5. **Let agents improve themselves** — Claude 4 as prompt/tool-description engineer.
6. **Start wide, then narrow** — agents default to over-specific queries that return nothing.
7. **Guide thinking** — extended/interleaved thinking for plan + post-tool evaluation.
8. **Parallel tool calling** — essential for speed (up to 90% time cut).
9. **Eval challenges** — non-deterministic paths; start with ~20 real queries; LLM-as-judge on rubric (factuality, citations, completeness, source quality, tool efficiency); humans catch SEO-farm bias.
10. **Production reliability** — stateful errors compound; resume from checkpoints; rainbow deploys; synchronous subagent wait creates bottlenecks (lead can’t steer mid-flight; one slow subagent blocks all).
11. **Appendix patterns** — end-state eval for mutating agents; long-horizon memory/summaries; write subagent artifacts to filesystem to minimize “game of telephone.”

---

## 2. Cognition: Context-Sharing Critique and Preferred Alternative

### 2a. “Don’t Build Multi-Agents” (2025)

**Source:** [Don’t Build Multi-Agents](https://cognition.com/blog/dont-build-multi-agents)

**Core thesis:** In 2025, collaborative multi-agent systems are fragile because decision-making is dispersed and context cannot be shared thoroughly enough.

**Principle 1 — Share context, and share full agent traces, not just individual messages.**  
Task decomposition + parallel subagents creates a telephone game. Copying only the user task is insufficient: multi-turn history, prior tool calls, and interpretation nuance matter.

**Principle 2 — Actions carry implicit decisions; conflicting decisions carry bad results.**  
Classic Flappy Bird example: Subagent A builds Super-Mario-like pipes; Subagent B builds a non-game-asset bird with wrong physics — orchestrator cannot reconcile conflicting implicit style/API/edge-case choices. Even with full task context, parallel writers diverge on unstated assumptions.

**Preferred alternative:**
1. Default to a **single-threaded linear agent** with continuous context.
2. For long-horizon work: invest in a **dedicated compression/context model** that summarizes history into key details/events/decisions (Cognition fine-tuned smaller models for this) — not parallel writers.
3. Treat Claude Code–style subagents as the safe pattern: **read-only Q&A / investigation**, not parallel code writers; main agent never writes in parallel with subagents.

**On “agents debate to resolve conflicts”:** Humans can negotiate merge conflicts; “agents today are not quite able to engage in this style of long-context proactive discourse with much more reliability than you would get with a single agent.”

### 2b. Follow-up: “Multi-Agents: What’s Actually Working”

**Source:** [Multi-Agents: What’s Actually Working](https://cognition.com/blog/multi-agents-working)

Not a full reversal. Narrow pattern that works:

> Multi-agent systems work best today when **writes stay single-threaded** and additional agents **contribute intelligence rather than actions**.

Working patterns:
| Pattern | Evidence | Caveat |
|---------|----------|--------|
| Clean-context code review loop | Devin Review catches **avg 2 bugs/PR**, ~**58% severe**; works *better* when reviewer shares **no** prior coding context (avoids context rot) | Needs synthesis bridge so coder filters out-of-scope review noise |
| “Smart Friend” escalation | Cross-frontier Claude↔GPT routing produced real gains; weaker-primary→stronger-friend still open (SWE-1.5 too weak to know when to escalate) | Context transfer is hard |
| Manager → child Devins | Live for large-scope work; map-reduce-and-manage | Over-prescription, false shared-state assumptions, weak sibling communication — all needed dedicated fixes |
| Readonly search subagents | Resemble **tool calls**, not true multi-agent collaboration | Aligns with Anthropic’s research use case |

**Unstructured swarms:** “mostly a distraction.”

**Note:** Cognition observes Anthropic’s research post landed the next day and both converge: first reliable applicability is **readonly** parallel agents.

---

## 3. Empirical Studies: Single-Agent vs Multi-Agent (2025–2026)

### 3a. Google / Nature Machine Intelligence — Scaling Agent Systems

**Sources:**
- [Towards a Science of Scaling Agent Systems](https://arxiv.org/abs/2512.08296) (Dec 2025)
- Journal version: [Capable language models can outgrow the benefits of collaboration](https://www.nature.com/articles/s42256-026-01268-y) (Nature Machine Intelligence)
- [Google Research blog](https://research.google/blog/towards-a-science-of-scaling-agent-systems-when-and-why-agent-systems-work/)

**Design:** Controlled eval holding prompts, tools, and compute budgets constant; vary only coordination topology + model. Hundreds of configs (paper variants report ~180–260) across Finance-Agent, BrowseComp-Plus, PlanCraft, WorkBench, SWE-bench Verified, Terminal-Bench; five architectures (Single, Independent, Centralized, Decentralized, Hybrid); three LLM families.

**Headline numbers:**
| Finding | Figure |
|---------|--------|
| Parallelizable financial reasoning (centralized MAS vs SAS) | **+80.8%** (also reported ~+80.9% / +81%) |
| Sequential planning (PlanCraft, independent MAS) | **−70.0%** |
| Sequential planning (all MAS variants) | **−39% to −70%** |
| Overall mean MAS improvement across configs | **~0.0%** (huge variance; CI spans roughly −59% to +77%) |
| Capability-saturation threshold | Single-agent baseline ≳ **~45%** → multi-agent gains often zero/negative |
| Threshold as selection rule | Predicts sign of MAS gain in **94%** of SWE-bench Verified / Terminal-Bench validation cells |
| Error amplification | Independent **17.2×**; centralized **4.4×** |
| Architecture selection model | Best architecture in **87%** of held-out configs; CV R² ≈ **0.37–0.51** depending on version |

**Implication:** Architecture–task alignment dominates agent count. “More agents” is not a scaling law.

### 3b. Entropy perspective (2026)

**Source:** [When Does Multi-Agent Collaboration Help? An Entropy Perspective](https://doi.org/10.48550/arxiv.2602.04234)

- Single agent outperforms MAS in **~43.3%** of model×dataset cases studied.
- Uncertainty dynamics largely set in the **first round** of interaction.
- Extra debate rounds often fail to help (echo / problem drift).

### 3c. Synthesis with Anthropic + Cognition
All three camps agree more than marketing suggests:
- **Read-heavy, decomposable, parallel search/synthesis** → multi-agent can win (Anthropic +90.2%; Google Finance +80.8%).
- **Write-heavy / sequential / tightly coupled** → multi-agent hurts or is fragile (Cognition; Google PlanCraft −70%; Anthropic coding caveat).
- Cost of admission is large token multipliers; benefits are not free intelligence, they are mostly **more compute + more context capacity**.

---

## 4. Failure Taxonomy: Why Multi-Agent Systems Fail (MAST)

**Source:** [Why Do Multi-Agent LLM Systems Fail?](https://arxiv.org/html/2503.13657v2) (MAST; NeurIPS 2025 Datasets & Benchmarks spotlight; site: [berkeley.edu/mast](https://sites.google.com/berkeley.edu/mast/home))

**Method:** Grounded Theory on **7** popular MAS frameworks, **200+** traces, six expert annotators; Cohen’s κ = **0.88**; 14 failure modes → 3 categories.

| Category | Share of failures | Contents |
|----------|-------------------|----------|
| **FC1 Specification / system design** | **41.77%** | Ambiguous roles/specs, step repetition (**17.14%** alone), task-completion blindness, context loss |
| **FC2 Inter-agent misalignment** | **36.94%** | Wrong assumptions without clarifying, task derailment, information withholding, reasoning–action mismatch |
| **FC3 Task verification** | **21.30%** | Premature termination, incomplete/incorrect verification |

**Critical finding:** ChatDev only **33.33%** correct on ProgramDev despite roleplay + verifiers — verifiers often do superficial checks (compile/comments). Role-spec intervention +9.4%; extra high-level verification +15.6% — still far from reliable. Authors argue many failures need **organizational/structural** redesign, not just better base models.

**Inefficiency (outside taxonomy by design):** Agents can inflate cost/latency **10×+** via circuitous tool loops (e.g., fetching playlist songs one-by-one across 10 turns).

---

## 5. Technique Evidence: Critic, Debate, Self-Consistency / Voting

### 5a. Separate critic / evaluator agent

| Source | Result | Cost note |
|--------|--------|-----------|
| Cognition Devin Review | ~**2 bugs/PR**, **58%** severe; clean-context reviewer better than shared-context | Extra agent pass; loops can add latency |
| [Steer, Don’t Solve](https://doi.org/10.48550/arxiv.2606.21811) (2026) | Small trained critic: **+3.0 to +5.2** SWE-bench Verified points; on one agent **25.2% vs 20.8%** resolve and **cheaper** ($0.04 vs $0.11) because critic shortens trajectories; critic **30–92×** cheaper than teacher | Best when critic is trained; naive second model ≠ free quality |
| [Critique-Guided Improvement](https://arxiv.org/html/2503.16024v2) | Trained small critic beats GPT-4 as critic by **+29.16%** feedback quality; actor SOTA **+26.74%** | Training investment required |
| MAST | Verifiers help but are not enough; shallow verification is its own failure class (~13.5% incomplete+incorrect) | Rubric/checklist critics > vibe checks |
| Anthropic Research | CitationAgent + LLM-as-judge rubric for eval | Critic-as-eval ≠ always critic-in-the-loop at inference |

**Practical takeaway:** A **separate verifier** helps when (a) criteria are checkable, (b) the critic has a clean or privileged view, and (c) the primary agent synthesizes critiques against full user context. Untuned “another LLM looks at it” often fails (MAST) or burns tokens.

### 5b. Multi-agent debate on factual / reasoning tasks

| Source | Quantified gains | Limits |
|--------|------------------|--------|
| Du et al. [Improving Factuality… through Multiagent Debate](https://arxiv.org/pdf/2305.14325) | Arithmetic **67.0% → 81.8%**; GSM8K **77.0% → 85.0%** (3 agents, ~2 rounds); beats reflection on factuality | Higher compute; can converge confidently to wrong consensus |
| Kaesberg et al. ACL Findings 2025 [Voting or Consensus?](https://aclanthology.org/2025.findings-acl.606/) | Voting **+13.2%** on reasoning vs other protocols; consensus **+2.8%** on knowledge tasks; more agents help; **more discussion rounds before voting hurt** | Problem drift / echo chambers |
| L-MAD (legal, 2026) | Up to **~+8%** vs strong single-agent in some settings; more agents reduce inconsistency; more rounds → over-deliberation drift | Gains shrink for SOTA models; weak models reinforce errors |

**Practical takeaway:** Debate helps most on **closed-ended reasoning with verifiable answers**. Marginal for open-ended sports narratives; costly for chat latency. Prefer **independent samples + vote** over long conversational debate.

### 5c. Self-consistency / majority voting

**Source:** Wang et al. [Self-Consistency Improves Chain of Thought](https://arxiv.org/pdf/2203.11171)

- PaLM-540B GSM8K: CoT **56.5% → 74.4%** (**+17.9%**) with majority vote over sampled paths (often **40** samples in paper).
- Gains also on SVAMP (+11.0%), AQuA (+12.2%), StrategyQA (+6.4%).
- Authors note cost: start with **5–10** paths; returns diminish.
- 2025 efficiency work ([Difficulty-Adaptive SC](https://aclanthology.org/2025.findings-naacl.383.pdf)): up to **~65%** cost cut vs vanilla SC with minimal accuracy loss; Optimal SC (2025) claims **~6.8×** fewer samples than vanilla SC on average.

**Practical takeaway:** Self-consistency is a **compute multiplier** (roughly linear in samples). Worth it for high-stakes numeric/clinical inferences with discrete answers; rarely justified for every nightly athlete card or interactive chat turn. Prefer adaptive early-stopping if used.

---

## 6. Production Post-Mortems and Cost Reality

| Source | Honest result | Mitigation that worked |
|--------|---------------|------------------------|
| Anthropic Research eng post | **15×** tokens vs chat; early agents spawn 50 workers / endless search | Effort scaling rules, budgets, tracing, rainbow deploys, cheaper Sonnet workers |
| [The 3× Token Bill We Didn’t See Coming](https://towardsdatascience.com/the-3x-token-bill-we-didnt-see-coming/) (Jul 31, 2026) | LangGraph supervisor multi-agent **~tripled** tokens for same tasks; silent retries re-ran upstream | Task-based model routing; trim handoff context; parallelize independent branches; per-step cost attribution. Rough recovery: **~40%** token drop, **45–55%** latency drop after fixes |
| [TURION: Multi-Agent Orchestration Infrastructure](https://turion.ai/blog/multi-agent-orchestration-infrastructure-production/) | 5 agents can turn 10 calls → **~100**; one bug → **$10k** overnight | Hard caps: $/task, turns/agent, total turns, tool budget, loop detection; supervisor+specialists |
| [Agent.ceo Month-2 retrospective](https://agent.ceo/blog/two-months-production-cyborgenic) | CTO agent: GitHub rate-limit → **47 retries**, **800K tokens**, **$23** one incident | Exponential backoff (max 5), cost circuit breakers (pause at 3× daily avg), retry budgets → monthly cost **−22%** |
| Medium multi-agent memory postmortem | Staging sharp / production “forgot”; latency from re-fetching full profiles every hop | Explicit layered memory, dedup, scoped retrieval — not append-only message lists |
| Cognition | Parallel-writer swarms still don’t see meaningful adoption; readonly + single-writer patterns do | Map-reduce-and-manage; clean-context reviewers |

### Cost & latency mitigation playbook (evidence-backed)
1. **Budget circuit breakers** — max tokens/$, max subagents, max tool calls, loop detection (Anthropic + TURION + Agent.ceo).
2. **Cheaper models for workers** — Opus/Sonnet (or frontier/mid) split (Anthropic); complexity-based routing (TDS 3× bill).
3. **Trim handoffs** — pass artifacts/fields, not full traces (Anthropic filesystem pattern; TDS context trimming).
4. **Bounded parallelism** — 3–5 workers typical; scale with query complexity, not max fan-out (Anthropic).
5. **Prompt caching / shared prefixes** — system prompts and tool schemas repeated per agent; cache aggressively.
6. **Async where safe** — Anthropic notes sync wait is a bottleneck; async adds state/error complexity.
7. **Measure per-node cost before architecture praise** — TDS lesson: correctness-only reviews miss the token graph.

**Rule of thumb multipliers to budget against:**
- Tool-using single agent ≈ **4×** chat tokens (Anthropic).
- Orchestrated multi-agent research ≈ **15×** chat (Anthropic).
- Naive production graphs can land at **~3×** prior single-agent pipeline cost even without “research-scale” ambition (TDS).
- Latency: parallelization can cut wall-clock **up to ~90%** on breadth-first research (Anthropic) *or* inflate latency if sequential supervisor hops + retries dominate (TDS / memory postmortems).

---

## 7. Decision Framework: When Multi-Agent Is Justified

Refine Anthropic’s rule with Google + Cognition + MAST:

### Prefer **parallel subagents (orchestrator–worker)** when most of these are true
1. **Decomposable / parallelizable** — independent information streams (wearables vs matches vs labs) with low sequential dependence.
2. **Read-heavy, write-light** — subagents gather/summarize; one writer synthesizes (Cognition principle).
3. **Context overflow risk** — corpus or tool output exceeds one reliable context window; compression via subagent summaries helps.
4. **High task value** — outcome worth **~10–15×** token cost (or batch/offline so latency is fine).
5. **Weak single-agent baseline** — if a strong single agent already clears ~**45%+** on your eval, expect diminishing MAS returns (Google).
6. **Centralized verification** — orchestrator or critic can catch errors (error amp 4.4× vs 17.2× independent).

### Prefer **single agent + good tools** when
1. Latency-sensitive interactive UX.
2. Decisions are coupled (interpretation of HRV depends on training load depends on illness).
3. Strong model + well-designed tools already solve the task (capability saturation).
4. You need coherent narrative/plan continuity (Cognition continuous context).
5. Budget must stay near chat-like or low single-digit multiples of a structured prompt.

### Prefer **fixed deterministic pipeline** (code + light LLM at edges) when
1. Schema is stable and bounded (nightly metrics → insight cards).
2. Correctness is algorithmic / thresholdable (flags, z-scores, rule engines).
3. You run **hundreds of identical jobs** — unit economics dominate; 15× tokens × 500 athletes is a CFO problem.
4. MAST-style coordination failures would create silent wrong coaching advice.

### Cheap quality boosts (before multi-agent)
| Technique | When | Cost |
|-----------|------|------|
| Better tools + prompts + eval harness | Always first | Low |
| Rubric LLM-as-judge / checklist critic (async) | Batch QA | ~1× extra small model |
| Self-consistency (5–10 samples, adaptive stop) | Discrete high-stakes answers | ~5–10× |
| Clean-context reviewer (single-threaded write) | High-stakes long investigation | ~1–2× |
| Full multi-agent debate | Rare; closed-ended hard reasoning | Multiples of agents × rounds |

### Decision flowchart (compressed)
```
Is the job schema-stable & high-volume?
  YES → Deterministic pipeline (+ optional LLM polish)
  NO ↓
Is it interactive & latency-bound?
  YES → Single agent + tools (router, caching)
  NO ↓
Is work breadth-first, read-only, parallelizable, high value?
  YES → Orchestrator–worker multi-agent (budget caps, cheap workers)
  NO ↓
Is it deep, multi-source, coupled reasoning?
  YES → Single strong agent + tools + memory; optional clean-context critic
       (not parallel writers)
```

---

## 8. Application to Five Platform Workloads

Context: sports-performance platform — nightly insights for hundreds of athletes; coach/athlete Q&A over wearable, training, and match data; real but limited budget.

### Workload 1 — Nightly per-athlete insight generation (structured, bounded, ×500)

| Dimension | Assessment |
|-----------|------------|
| Parallelizable across athletes? | Yes (embarrassingly parallel jobs) — **not** the same as multi-agent *within* an athlete |
| Within-athlete decomposable? | Partially (sleep / load / matches) but outputs must be **one coherent card** |
| Value per run | Moderate; volume dominates cost |
| Latency | Overnight OK |
| **Verdict** | **Fixed deterministic pipeline** (+ thin LLM narration layer) |

**Justification:** Running Anthropic-scale multi-agent (**15×** tokens) × 500 athletes is economically reckless for bounded structured data. Google’s capability-saturation and MAST inefficiency findings say coordination overhead buys little when the schema is known. Compute features in code (HRV delta, ACWR, match load); use one LLM call (or template + small model) to phrase the insight; optional cheap rubric critic on a **sample** of cards, not 500 full debates.

**Anti-pattern:** Spawning sleep-agent + training-agent + match-agent per athlete nightly — MAST FC2 misalignment + TDS-style silent cost triple.

---

### Workload 2 — Coach roster digest (aggregate many athletes, prioritization)

| Dimension | Assessment |
|-----------|------------|
| Parallelizable? | Yes — per-athlete signals already computed; aggregation is ranking/synthesis |
| Coupling? | Prioritization needs **global** comparison (who needs attention today) |
| Value | High for coach time |
| Latency | Morning batch OK |
| **Verdict** | **Single agent with tools** over precomputed athlete features; optional light map-reduce |

**Justification:** Best economics: deterministic scoring of “attention needed” from nightly features, then **one** synthesis pass that reads top-K athlete summaries and produces the digest. Parallel subagents only if digest must pull raw multi-source deep dives for many athletes *and* single context overflows — even then, prefer map (cheap summarizer per athlete) → reduce (one orchestrator), i.e., Cognition’s map-reduce-and-manage with **single writer**. Full debate/voting unjustified for prioritization when scores are numeric.

---

### Workload 3 — Interactive chat Q&A (latency-sensitive)

| Dimension | Assessment |
|-----------|------------|
| Parallelizable? | Rarely for a single question |
| Latency | Critical |
| Value/turn | Variable; many shallow questions |
| **Verdict** | **Single agent with tools** (and aggressive caching / tool routing) |

**Justification:** Anthropic’s 15× and 4× multipliers destroy chat UX economics. Google shows MAS can **degrade** sequential tool use. Cognition: keep one continuous context. Use tool router, SQL/ClickHouse tools, short retrieval; escalate to “deep investigation mode” only on explicit user request (Workload 5). No critic-in-the-loop on every turn; async eval offline.

---

### Workload 4 — Event-triggered insight (new blood panel lands)

| Dimension | Assessment |
|-----------|------------|
| Parallelizable? | Mild — panel vs recent training/wearables can be fetched in parallel **as tools** |
| Structure | Semi-structured clinical/lab event |
| Latency | Minutes OK, not multi-agent research hours |
| Safety | Higher — medical-adjacent claims |
| **Verdict** | **Deterministic pipeline + single agent with tools**; optional **async checklist critic** |

**Justification:** Trigger → fetch panel + baselines + recent load → rule/algorithm flags (out-of-range, delta vs history) → one LLM explanation grounded in retrieved numbers. A separate critic that checks “every numeric claim appears in tool output” is high ROI (Cognition clean-context review; MAST verification gap) and far cheaper than multi-agent debate. Parallel subagents only if panel interpretation requires many independent literature lookups — usually a curated RAG tool beats that.

---

### Workload 5 — Deep “why has this athlete regressed over 3 months?” investigation

| Dimension | Assessment |
|-----------|------------|
| Parallelizable? | **Yes** — wearables trends, training periodization, match/tennis metrics, illness/travel, labs, subjective wellness are largely independent *reads* |
| Context size | Likely exceeds comfortable single-pass context |
| Value | High (coach trust, retention) |
| Latency | Minutes acceptable (async job / “investigate” button) |
| Coupling at the end | Synthesis must be coherent (single writer) |
| **Verdict** | **Multi-agent justified (orchestrator–worker, read-only workers)** — the one workload that matches Anthropic’s sweet spot |

**Justification:** Matches Anthropic criteria: open-ended, path-dependent, breadth-first, heavy read-only search across numerous tools/sources, high value. Aligns with Google Finance-style decomposable analysis (+80% class of tasks), not PlanCraft sequential crafting. Aligns with Cognition: readonly subagents + single-threaded synthesis/write of the final report. Add: effort scaling (don’t spawn 10 workers for a thin data athlete), Sonnet-class workers, Opus/strong lead, citation/grounding pass, budget caps, and a final checklist critic for claim→evidence binding.

**Do not:** Parallel agents each “write a section of the coaching plan” without shared decisions — Cognition Principle 2 failure mode.

---

## 9. Portfolio Recommendation (Budget-Aware)

| Workload | Architecture | Est. relative token cost vs one solid LLM call |
|----------|--------------|-----------------------------------------------|
| 1 Nightly ×500 | Deterministic + light LLM | **~0.3–1×** (mostly code) |
| 2 Roster digest | Single agent on precomputed features | **~1–2×** |
| 3 Interactive chat | Single agent + tools | **~1–4×** (Anthropic agent≈4× chat) |
| 4 Blood panel event | Pipeline + single agent + optional critic | **~1–3×** |
| 5 Deep regression investigation | Orchestrator–worker multi-agent | **~8–15×** (accept Anthropic-class multiplier only here) |

**Stakeholder message:** A “very complex agentic system” is **not** justified as the default platform architecture. Evidence from Anthropic, Cognition, Google/NMI, and MAST converges: complexity is warranted for **rare, high-value, breadth-first investigations**; fashion elsewhere burns tokens, adds MAST failure modes, and can **reduce** quality on sequential tasks. Build one excellent tool-using agent + deterministic batch pipelines first; add orchestrator–worker only behind an explicit “deep research” path with hard budget caps.

---

## 10. Source Index

| # | Source | URL |
|---|--------|-----|
| 1 | Anthropic Engineering — Multi-agent research system (Jun 2025) | https://www.anthropic.com/engineering/multi-agent-research-system |
| 2 | Cognition — Don’t Build Multi-Agents | https://cognition.com/blog/dont-build-multi-agents |
| 3 | Cognition — Multi-Agents: What’s Actually Working | https://cognition.com/blog/multi-agents-working |
| 4 | Cemri et al. — Why Do Multi-Agent LLM Systems Fail? (MAST) | https://arxiv.org/html/2503.13657v2 |
| 5 | MAST project site | https://sites.google.com/berkeley.edu/mast/home |
| 6 | Kim et al. — Towards a Science of Scaling Agent Systems | https://arxiv.org/abs/2512.08296 |
| 7 | Nature Machine Intelligence version | https://www.nature.com/articles/s42256-026-01268-y |
| 8 | Google Research blog on agent scaling | https://research.google/blog/towards-a-science-of-scaling-agent-systems-when-and-why-agent-systems-work/ |
| 9 | When Does Multi-Agent Collaboration Help? (entropy, 2026) | https://doi.org/10.48550/arxiv.2602.04234 |
| 10 | Du et al. — Multiagent Debate (factuality/reasoning) | https://arxiv.org/pdf/2305.14325 |
| 11 | Kaesberg et al. — Voting or Consensus? (ACL Findings 2025) | https://aclanthology.org/2025.findings-acl.606/ |
| 12 | Wang et al. — Self-Consistency | https://arxiv.org/pdf/2203.11171 |
| 13 | Difficulty-Adaptive Self-Consistency (NAACL Findings 2025) | https://aclanthology.org/2025.findings-naacl.383.pdf |
| 14 | Steer, Don’t Solve — small critics for code agents (2026) | https://doi.org/10.48550/arxiv.2606.21811 |
| 15 | Critique-Guided Improvement (2025) | https://arxiv.org/html/2503.16024v2 |
| 16 | TDS — The 3× Token Bill We Didn’t See Coming (Jul 2026) | https://towardsdatascience.com/the-3x-token-bill-we-didnt-see-coming/ |
| 17 | TURION — Multi-Agent Orchestration Infrastructure | https://turion.ai/blog/multi-agent-orchestration-infrastructure-production/ |
| 18 | Agent.ceo — Two Months In Production | https://agent.ceo/blog/two-months-production-cyborgenic |
| 19 | Dreaming.press synthesis (Anthropic vs Cognition) | https://dreaming.press/posts/multi-agent-vs-single-agent.html |

---

*End of dossier.*
