# 41 — Anthropic Agent Engineering & Claude Agent SDK

**Topic:** Anthropic published agent guidance, Claude Agent SDK (Python), current Claude models/pricing, health/wellness Usage Policy carve-outs, enterprise data terms  
**Scope:** External research only (web search + web fetch of primary Anthropic sources). No local codebase exploration beyond writing this file.  
**Research date:** 2026-08-02  
**Currency note:** Prioritize 2025–2026 primary sources. Model IDs, SDK versions, and pricing verified against Anthropic docs as of this date.

---

## Verdict (TL;DR)

| Question | Answer |
|---|---|
| Central Anthropic argument | **Start simple.** Prefer workflows over autonomous agents. Add complexity only when it demonstrably improves outcomes. |
| Best fit for PPD | **Composable workflows** (prompt chaining, routing, parallelization, evaluator-optimizer) + **bounded tool-using agents** for interactive chat — not a single “very complex multi-agent system.” |
| Claude Agent SDK for our backend? | **Caution.** It is Claude Code’s harness packaged as a library (filesystem/bash-native). Usable for server agents with custom MCP tools + hard denylists, but **not** the natural general-purpose backend framework. Prefer Messages API + our own loop for production sports agents. |
| Health/wellness policy | **Wellness advice is explicitly carved out** of High-Risk Healthcare. Diagnosis/therapy/medical guidance triggers HITL + disclosure. Stay non-diagnostic; disclose AI. |
| Primary model recommendation | **Sonnet 5** (or Sonnet 4.6) for most production; **Opus 5** for hard reasoning/orchestrator; **Haiku 4.5** for routing/cheap classification. Avoid Fable 5 if you need ZDR. |

---

## 1. Building effective agents — taxonomy & when not to use agents

**Primary source:** [Building effective agents](https://www.anthropic.com/engineering/building-effective-agents) (published **2024-12-19**; still Anthropic’s canonical taxonomy as of mid-2026).

### 1.1 Workflows vs agents

Anthropic’s architectural distinction:

> **Workflows** are systems where LLMs and tools are orchestrated through predefined code paths.  
> **Agents**, on the other hand, are systems where LLMs dynamically direct their own processes and tool usage, maintaining control over how they accomplish tasks.

They call both “agentic systems.”

### 1.2 Central argument: when NOT to use an agent

Quoted guidance:

> When building applications with LLMs, we recommend finding the **simplest solution possible**, and only increasing complexity when needed. **This might mean not building agentic systems at all.** Agentic systems often trade latency and cost for better task performance, and you should consider when this tradeoff makes sense.

> For many applications, however, **optimizing single LLM calls with retrieval and in-context examples is usually enough**.

> Success in the LLM space isn't about building the most sophisticated system. It's about building the **right system** for your needs. **Start with simple prompts, optimize them with comprehensive evaluation, and add multi-step agentic systems only when simpler solutions fall short.**

> …you should consider adding complexity **only when it demonstrably improves outcomes**.

Framework caution:

> …they often create extra layers of abstraction that can obscure the underlying prompts and responses… They can also make it tempting to add complexity when a simpler setup would suffice.  
> We suggest that developers **start by using LLM APIs directly**.

Three implementation principles:

1. Maintain simplicity in agent design.  
2. Prioritize transparency (show planning steps).  
3. Carefully craft the agent–computer interface (ACI) via tool docs and testing.

### 1.3 The six patterns (accurate taxonomy)

| # | Pattern | Definition (Anthropic) | When to use |
|---|---|---|---|
| 0 | **Augmented LLM** (building block) | LLM + retrieval, tools, memory | Foundation for all patterns |
| 1 | **Prompt chaining** | Sequence of LLM calls; each processes prior output; optional programmatic gates | Task cleanly decomposes into fixed subtasks; trade latency for accuracy |
| 2 | **Routing** | Classify input → specialized follow-up | Distinct categories better handled separately; classification is accurate |
| 3 | **Parallelization** | Concurrent LLM work + programmatic aggregation. Variants: **sectioning** (independent subtasks) and **voting** (same task, diverse attempts) | Speed via split work, or higher confidence via multiple perspectives |
| 4 | **Orchestrator–workers** | Central LLM dynamically breaks down tasks, delegates to workers, synthesizes | Subtasks **not** predictable in advance (unlike fixed parallelization) |
| 5 | **Evaluator–optimizer** | Generator LLM + evaluator LLM in a feedback loop | Clear evaluation criteria; iterative refinement has measurable value |
| 6 | **Autonomous agents** | LLM using tools in a loop from environmental feedback; may pause for human input; stopping conditions | Open-ended problems; hard to hardcode a path; trust in decision-making required |

**Agent caveats from Anthropic:**

> The autonomous nature of agents means **higher costs**, and the **potential for compounding errors**. We recommend extensive testing in sandboxed environments, along with the appropriate guardrails.

---

## 2. Context engineering guidance

**Primary source:** [Effective context engineering for AI agents](https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents) (published **2025-09-29**).

### 2.1 Guiding principle

> …good context engineering means finding the **smallest possible set of high-signal tokens** that maximize the likelihood of some desired outcome.

Repeated in conclusion:

> …the guiding principle remains the same: find the **smallest set of high-signal tokens** that maximize the likelihood of your desired outcome.

Context is a **finite attention budget** (“context rot” as windows grow). Treat context as precious with diminishing returns.

### 2.2 Anatomy of effective context

- **System prompts:** Clear, direct language at the “right altitude” — not brittle if-else hardcoded logic, not vague high-level guidance. Organize with sections/XML/Markdown. Minimal set that fully outlines expected behavior (minimal ≠ short).
- **Tools:** Self-contained, robust to error, clear intended use; minimal overlap. Bloated tool sets are a common failure mode.
- **Examples:** Diverse *canonical* few-shots — not a laundry list of edge cases.
- **Overall:** Informative yet tight.

### 2.3 Just-in-time context retrieval

> Rather than pre-processing all relevant data up front, agents built with the “just in time” approach maintain **lightweight identifiers** (file paths, stored queries, web links, etc.) and use these references to **dynamically load data into context at runtime using tools**.

Enables progressive disclosure. Hybrid OK: some data up front for speed + autonomous exploration. Closing advice: **“do the simplest thing that works.”**

### 2.4 Compaction

> Compaction is the practice of taking a conversation nearing the context window limit, **summarizing its contents, and reinitiating a new context window with the summary**.

Tune for recall first, then precision. Lightest form: clearing old tool results.

**API note (2026):** Server-side compaction is available as beta (`compact-2026-01-12`, type `compact_20260112`), default trigger ~150k input tokens (min 50k). Docs: [Compaction](https://platform.claude.com/docs/en/build-with-claude/compaction).

### 2.5 Sub-agent context isolation

> …specialized sub-agents can handle focused tasks with **clean context windows**. The main agent coordinates with a high-level plan while subagents perform deep technical work… Each subagent might explore extensively, using tens of thousands of tokens or more, but returns only a **condensed, distilled summary** (often 1,000–2,000 tokens).

Also discussed: structured note-taking / agentic memory outside the window.

### 2.6 Choice heuristic

| Technique | Best for |
|---|---|
| Compaction | Conversational flow / long back-and-forth |
| Note-taking | Iterative work with clear milestones |
| Multi-agent | Complex research/analysis with parallel exploration |

---

## 3. Writing tools for agents — design best practices

**Primary sources:**
- [Writing effective tools for agents — with agents](https://www.anthropic.com/engineering/writing-tools-for-agents) (published **2025-09-11**)
- Appendix 2 of [Building effective agents](https://www.anthropic.com/engineering/building-effective-agents) (“Prompt Engineering your Tools”)

### 3.1 Core mindset

Tools are a contract between **deterministic systems and non-deterministic agents** — design for agents, not just API wrappers.

> Agents are only as effective as the tools we give them.

Invest in ACI like HCI:

> Put yourself in the model’s shoes… A good tool definition often includes example usage, edge cases, input format requirements, and clear boundaries from other tools.

### 3.2 Naming & descriptions

- **Namespace** tools (e.g. `asana_search`, `jira_search`; resource-level `asana_projects_search`).
- Unambiguous parameter names: `user_id` not `user`.
- Describe as you would to a new hire; make implicit domain knowledge explicit.
- Prompt-engineer descriptions — they live in context and steer tool choice.

### 3.3 Choosing what *not* to implement

> More tools don’t always lead to better outcomes.

Prefer few high-impact workflow tools over thin CRUD wrappers:

- `schedule_event` over `list_users` + `list_events` + `create_event`
- `search_logs` over `read_logs`
- `get_customer_context` over many get/list tools

### 3.4 Token efficiency & return format

- Return **high-signal** fields (`name`, not `uuid` / `mime_type` when avoidable).
- Prefer natural-language identifiers over opaque IDs when possible.
- Offer `response_format`: `concise` vs `detailed`.
- Pagination, filtering, range selection, truncation with sensible defaults.
- Claude Code default tool-response cap cited: **25,000 tokens**.

### 3.5 Error messages

Steer with actionable errors (not opaque codes/tracebacks). Truncation messages should tell the agent how to refine (filters, pagination).

### 3.6 Evaluating tools

1. Prototype tools (local MCP / API).  
2. Build **realistic multi-step eval tasks** (not toy sandboxes).  
3. Run simple agentic loops; collect accuracy, latency, tool-call counts, token use, errors.  
4. Use agents to analyze transcripts and refactor tools.  
5. Hold out a test set to avoid overfitting.

---

## 4. Claude Agent SDK (Python)

### 4.1 Current version (as of 2026-08-02)

| Item | Value | Source |
|---|---|---|
| PyPI package | `claude-agent-sdk` | https://pypi.org/project/claude-agent-sdk/ |
| Latest version researched | **0.2.128** | PyPI / GitHub releases |
| Bundled Claude Code CLI (in 0.2.128) | **2.1.220** | CHANGELOG |
| Python requirement | **≥ 3.10** | PyPI |
| Predecessor | `claude-code-sdk` (frozen ~0.0.25); renamed to Agent SDK | Anthropic migration docs / changelog |

Docs hub: [Agent SDK overview](https://code.claude.com/docs/en/agent-sdk/overview) · [Python reference](https://code.claude.com/docs/en/agent-sdk/python)

### 4.2 What it actually is (honest assessment)

Anthropic’s own framing:

> Build production AI agents with **Claude Code as a library**  
> An agent is an application that completes a task by planning its own steps and calling tools that **read files, run commands, or edit code**.  
> The Agent SDK gives you the same tools, agent loop, and context management that **power Claude Code**…

Comparison table in docs:

| Need | Use |
|---|---|
| Agent loop without implementing it yourself | **Agent SDK** |
| Direct API + you implement tool loop | **Client SDK** (Messages API) |
| Hosted long-running agents | **Managed Agents** |

**Verdict for PPD:** The Agent SDK is a **coding-agent harness generalized for other domains**, not a greenfield “backend agent framework” like LangGraph/CrewAI purpose-built for multi-domain orchestration. Evidence:

1. Default tool surface is Read/Edit/Write/Bash/Glob/Grep/Web — coding primitives.  
2. Quickstart narrative is “find and fix bugs.”  
3. Permission modes (`acceptEdits`, `plan`, filesystem deny rules) assume a workspace.  
4. Rename from Code SDK signals broader intent, and MCP/`@tool` custom tools *do* allow non-coding domains — but you must **strip or deny** coding tools and bring your own data tools.

**Appropriate if:** You want Anthropic’s loop, compaction, hooks, subagents, and permissions out of the box, and your “workspace” can be a sandboxed job directory + MCP tools into ClickHouse/Supabase.  
**Not appropriate as default if:** You need a pure request/response Flask/FastAPI sports agent with domain tools only, strict latency SLOs, and no filesystem/bash — use the **Messages API Client SDK** + your own loop.

Building-effective-agents still lists Claude Agent SDK as a framework option while warning abstractions can obscure prompts — consistent with “use carefully, understand the harness.”

### 4.3 Core loop

From [How the agent loop works](https://code.claude.com/docs/en/agent-sdk/agent-loop):

1. Receive prompt (+ system, tools, history) → `SystemMessage` init  
2. Model evaluates → text and/or tool calls → `AssistantMessage`  
3. SDK executes tools → results as `UserMessage`  
4. Repeat until no tool calls  
5. `ResultMessage` with text, usage, cost, session ID  

Controls: `max_turns`, `max_budget_usd`. Automatic compaction supported.

Python entrypoints: `query()` (one-shot session) and `ClaudeSDKClient` (multi-turn session).

### 4.4 Tool definition (custom)

Custom tools via `@tool` + in-process MCP:

```python
from claude_agent_sdk import tool, create_sdk_mcp_server, ClaudeAgentOptions

@tool("add", "Add two numbers", {"a": float, "b": float})
async def add(args):
    return {"content": [{"type": "text", "text": f"Sum: {args['a'] + args['b']}"}]}

calculator = create_sdk_mcp_server(name="calculator", tools=[add])
options = ClaudeAgentOptions(
    mcp_servers={"calc": calculator},
    allowed_tools=["mcp__calc__add"],
)
```

Tools appear as `mcp__{server}__{tool}`.

### 4.5 Subagents

From [Subagents](https://code.claude.com/docs/en/agent-sdk/subagents):

- Programmatic `agents={name: AgentDefinition(...)}` with `description`, `prompt`, `tools`, optional `model`  
- Filesystem agents in `.claude/agents/`  
- Built-in `general-purpose` via Agent tool  
- Benefits: context isolation, parallelization, specialized prompts, tool restrictions  
- Subagents inherit parent permission mode (with caveats for `bypassPermissions`)

### 4.6 Hooks

From [Hooks](https://code.claude.com/docs/en/agent-sdk/hooks):

Lifecycle callbacks (`PreToolUse`, `PostToolUse`, session start/stop, etc.) to block, log, transform, or require approval. Matchers filter by tool name. Critical for production guardrails (deny Bash/`Write` to secrets, inject authz).

### 4.7 Permissions

From [Permissions](https://code.claude.com/docs/en/agent-sdk/permissions):

Evaluation order: hooks → deny rules → ask rules → permission mode → allow rules → `canUseTool` callback.

Modes: `default`, `dontAsk`, `acceptEdits`, `bypassPermissions`, `plan`, `auto`.

For headless backends: prefer **`dontAsk` + explicit `allowed_tools`** (MCP domain tools only) + **`disallowed_tools`** for Bash/Write/Edit, or PreToolUse hooks that hard-deny.

### 4.8 MCP integration

From [MCP in Agent SDK](https://code.claude.com/docs/en/agent-sdk/mcp):

- External MCP servers via `mcp_servers` config  
- In-process SDK MCP via `create_sdk_mcp_server`  
- `strict_mcp_config` to ignore project/user/plugin MCP sources  
- Fits PPD if we expose wearable/tennis/training tools as MCP — still sitting inside a Claude Code–shaped runtime

---

## 5. Current Claude model lineup (mid-2026)

**Primary source:** [Models overview](https://platform.claude.com/docs/en/about-claude/models/overview) · [Pricing](https://platform.claude.com/docs/en/about-claude/pricing)  
Retrieved 2026-08-02.

### 5.1 Current / recommended IDs

| Model | Claude API ID | Context | Max output | Thinking | Latency | Knowledge cutoff (reliable) |
|---|---|---|---|---|---|---|
| **Claude Fable 5** | `claude-fable-5` | **1M** | 128k | Adaptive (always on) | Slower | Jan 2026 |
| **Claude Opus 5** | `claude-opus-5` | **1M** | 128k | Adaptive | Moderate | May 2026 |
| **Claude Sonnet 5** | `claude-sonnet-5` | **1M** | 128k | Adaptive | Fast | Jan 2026 |
| **Claude Haiku 4.5** | `claude-haiku-4-5-20251001` (alias `claude-haiku-4-5`) | **200k** | 64k | Extended thinking (`thinking.type: "enabled"`) | Fastest | Feb 2025 |

Still available (prior gen): `claude-opus-4-8`, `claude-opus-4-7`, `claude-opus-4-6`, `claude-sonnet-4-6`, `claude-sonnet-4-5-20250929`, `claude-opus-4-5-20251101`.  
`claude-opus-4-1-20250805` **deprecated**, retire **2026-08-05**.

Note: From 4.6 generation onward, dateless IDs are **pinned snapshots**, not evergreen aliases.

**Claude Mythos 5** (`claude-mythos-5`): limited availability (Project Glasswing); same pricing/specs class as Fable 5; not for general wellness product use.

### 5.2 Pricing table (USD / MTok) — Claude API

| Model | Input | Output | 5m cache write | 1h cache write | Cache hit | Batch in | Batch out |
|---|---:|---:|---:|---:|---:|---:|---:|
| Fable 5 / Mythos 5 | $10 | $50 | $12.50 | $20 | $1 | $5 | $25 |
| Opus 5 / 4.8 / 4.7 / 4.6 / 4.5 | $5 | $25 | $6.25 | $10 | $0.50 | $2.50 | $12.50 |
| **Sonnet 5 (through 2026-08-31)** | **$2** | **$10** | $2.50 | $4 | $0.20 | **$1** | **$5** |
| Sonnet 5 (from 2026-09-01) | $3 | $15 | $3.75 | $6 | $0.30 | $1.50 | $7.50 |
| Sonnet 4.6 / 4.5 | $3 | $15 | $3.75 | $6 | $0.30 | $1.50 | $7.50 |
| Haiku 4.5 | $1 | $5 | $1.25 | $2 | $0.10 | $0.50 | $2.50 |

Sources: https://platform.claude.com/docs/en/about-claude/pricing

### 5.3 Prompt caching mechanics

Multipliers vs base input:

| Operation | Multiplier | Duration |
|---|---|---|
| 5-minute cache write | **1.25×** | 5 min |
| 1-hour cache write | **2×** | 1 h |
| Cache read (hit) | **0.1×** (90% off) | Same as write TTL |

Enable via automatic top-level `cache_control` or explicit breakpoints. Stacks with Batch and data-residency multipliers.  
**PPD implication:** Cache system prompts + tool schemas + stable athlete profile cards on interactive chat.

### 5.4 Batch API

> The Batch API allows asynchronous processing of large volumes of requests with a **50% discount** on both input and output tokens.

Ideal for **nightly athlete briefs** and **coach roster digests**. Not for interactive chat. Not compatible with Fast mode.

### 5.5 Extended / adaptive thinking

- **Haiku 4.5 / older Sonnet–Opus:** classic extended thinking (`thinking.type: "enabled"`).  
- **Sonnet 5, Opus 5, Fable 5, Opus 4.8/4.7/4.6, Sonnet 4.6:** **adaptive thinking** (Fable always on).  
- Effort parameter defaults to `high` on Opus 5 / Opus 4.8 (API & Claude Code); use `xhigh` for hardest agentic work.

### 5.6 Tool-use reliability (what Anthropic claims / implies)

Anthropic does not publish a single “tool-use reliability %” for production APIs. Documented signals:

- Tool-use is first-class; models “excel” at agentic tool use (models overview).  
- Tool design quality dominates reliability (writing-tools post; SWE-bench improvements from description tweaks).  
- Opus tier positioned for high-autonomy agentic coding; Sonnet for production agentic tool use at better cost.  
- Agent SDK inherits Claude Code’s mature tool loop (compaction, permissions, hooks).

**Practical PPD stance:** Claude remains a strong primary for careful refusal / wellness boundaries + tool use, but reliability is **tool-design- and eval-dependent**, not automatic.

### 5.7 Other pricing notes

- Claude 4.6+ / Fable: **1M context at standard rates** (no long-context surcharge).  
- US-only inference (`inference_geo: "us"`): **1.1×** on Claude 4.6+.  
- Fast mode (Opus 5 / 4.8 preview): $10 / $50 — stacks with caching.  
- Tokenizer: Claude 4.7+ ~**30% more tokens** for same text vs earlier tokenizer.

---

## 6. Usage Policy — health & wellness (primary text)

**Primary source:** [Anthropic Usage Policy](https://www.anthropic.com/legal/aup) (fetched 2026-08-02).

### 6.1 High-Risk Healthcare definition + wellness carve-out

Under **High-Risk Use Case Requirements**, Anthropic requires for listed categories:

1. **Human-in-the-loop:** qualified professional review before dissemination/finalization when providing advice/recommendations/subjective decisions affecting individuals.  
2. **Disclosure:** if outputs go directly to individuals/consumers, disclose AI involvement at least at the **beginning of each session**.

Quoted High-Risk list entry for healthcare:

> **Healthcare:** Use cases related to healthcare decisions, medical diagnosis, patient care, therapy, mental health, or other medical guidance. **Wellness advice (e.g., advice on sleep, stress, nutrition, exercise, etc.) does not fall under this category**

This is the precise carve-out for a sports-performance wellness product.

### 6.2 Additional chatbot / agent rules (still apply)

> All consumer-facing chatbots, including any external-facing or interactive AI agent, must disclose to users that they are interacting with AI rather than a human. This disclosure must be provided at a minimum at the beginning of each chat session.

> Agentic use cases must still comply with the Usage Policy.

### 6.3 Universal standards that constrain sports products

Relevant prohibitions even for “wellness”:

- **Do Not Create or Spread Misinformation** — includes providing false/misleading information related to **medical, health or science issues**.  
- **Do Not Create Psychologically or Emotionally Harmful Content** — includes facilitating/glamorizing disordered eating and **unhealthy or compulsive exercise**; promoting unattainable body image; critiquing body shape/size.  
- **Do Not Compromise Privacy** — health data / biometric misuse without permission.  
- Emotional recognition systems generally restricted except medical/safety reasons.

### 6.4 Health-policy verdict for Peak Performance Data

| Activity | Policy status |
|---|---|
| Sleep/recovery/load/nutrition/exercise coaching framed as **wellness** | **Permitted** under wellness carve-out (not High-Risk Healthcare by Anthropic’s text) |
| Interactive chatbot / agent | Must **disclose AI** at session start |
| Medical diagnosis, therapy, treatment decisions, clinical lab interpretation as care | **High-Risk Healthcare** → HITL by qualified professional + disclosure |
| CGM / biomarker / genetics insights phrased as clinical diagnosis or treatment | Treat as High-Risk; keep **strictly non-diagnostic**, educational/performance framing; escalate to clinician language |
| Compulsive-exercise / disordered-eating patterns | Universal prohibition — hard-refuse / redirect |
| False health claims | Universal prohibition |

**Product implication:** Stay non-diagnostic in prompts, tools, and UI. Prefer “training readiness / performance insight” language. For lab/CGM/genetics event triggers, use evaluator gates + clinician/coach HITL before athlete-facing clinical-sounding claims. Disclosure banners on all consumer chat.

Anthropic also markets [Claude for Healthcare](https://www.anthropic.com/news/healthcare-life-sciences) (HIPAA-ready) separately — that is for *medical* deployments with BAA, not a substitute for the AUP wellness carve-out.

---

## 7. Enterprise terms — ZDR, DPA, EU, training

### 7.1 Training on inputs

**Primary source:** [How do you use personal data in model training?](https://privacy.claude.com/en/articles/7996885-how-do-you-use-personal-data-in-model-training) (updated **2026-03-16**):

> **We will not use your chats or coding sessions to train our models**, unless you choose to participate in our Development Partner Program.

> If you explicitly report materials to us (e.g. via our thumbs up/down feedback mechanisms), or by otherwise explicitly opting in to training, then we may use those materials to train our models.

Also from [API and data retention](https://platform.claude.com/docs/en/manage-claude/api-and-data-retention):

> Retained data is **never used for model training without your express permission**.

### 7.2 DPA

**Primary source:** [How do I view and sign your DPA?](https://privacy.claude.com/en/articles/7996862-how-do-i-view-and-sign-your-data-processing-addendum-dpa) (updated **2026-03-16**):

> Anthropic’s DPA with Standard Contractual Clauses (SCCs) is **automatically incorporated into our Commercial Terms of Service**… When you accept Anthropic’s Commercial Terms of Service, you also accept our DPA.

Commercial products (Claude API, Claude for Work). Consumer Free/Pro are different.

### 7.3 Zero data retention (ZDR)

**Primary sources:**
- [API and data retention](https://platform.claude.com/docs/en/manage-claude/api-and-data-retention)
- [ZDR product scope](https://privacy.claude.com/en/articles/8956058-i-have-a-zero-data-retention-agreement-with-anthropic-what-products-does-it-apply-to) (updated **2026-06-09**)

Key quotes:

> Under a ZDR arrangement, Anthropic **does not store customer prompts or responses at rest after the API response is returned**. To request ZDR… contact the Anthropic sales team. ZDR is enabled **per organization**.

> Anthropic still retains **User Safety classifier results** in order to enforce our Usage Policy.

**Critical for model choice:**

> **Claude Fable 5 and Claude Mythos 5:** These models require **30-day data retention** and are **not available under ZDR**.

ZDR covers Messages / Token Counting (eligible features), Claude Code via commercial API keys / Enterprise with ZDR. Does **not** cover Console/Workbench, Managed Agents transcripts, consumer products, etc.

### 7.4 Default retention (non-ZDR)

**Primary source:** [How long do you store my organization’s data?](https://privacy.claude.com/en/articles/7996866-how-long-do-you-store-my-organization-s-data) (updated **2026-07-01**):

> For Anthropic API users, we automatically delete inputs and outputs on our backend **within 30 days** of receipt or generation, except: longer-retention services under your control; ZDR agreements; Usage Policy enforcement; legal compliance.

Flagged UP violations: inputs/outputs up to **2 years**; classifier scores up to **7 years**. Feedback: up to **5 years**.

*(Some secondary blogs claimed a Sept 2025 reduction to 7 days; Anthropic’s Privacy Center article dated July 1, 2026 still states **30 days**. Prefer the primary Privacy Center text.)*

### 7.5 EU data handling

From [Data residency](https://platform.claude.com/docs/en/manage-claude/data-residency):

- **`inference_geo`:** `"global"` (default) or `"us"` only — **no EU inference_geo** on first-party API as of this research.  
- **Workspace geo:** currently **`"us"` only**; set at workspace creation, immutable.  
- US-only inference: **1.1×** pricing for Claude 4.6+.  
- For stronger EU residency posture: partner clouds (e.g. **Amazon Bedrock regional endpoints** such as Frankfurt) where the cloud provider is processor — verify Bedrock/Vertex DPA separately.  
- DPA + SCCs cover EU–US transfers for commercial API.

**Honest EU summary for PPD academies:** Commercial API + DPA/SCCs + no training by default is the baseline. **True EU-at-rest inference is not currently a first-party Anthropic workspace option** (workspace geo = US only). Use Bedrock EU regions or negotiate with sales if residency is a hard requirement. Request **ZDR** for sensitive athlete health-adjacent payloads; avoid Fable 5 if ZDR is required.

---

## 8. Application to Peak Performance Data

### 8.1 Pattern mapping for our use cases

| Use case | Recommended Anthropic pattern | Why | Complexity justified? |
|---|---|---|---|
| **Nightly athlete brief** | **Prompt chaining** (+ light **evaluator–optimizer** gate) · Batch API | Fixed pipeline: fetch metrics → draft → policy/safety check → persist. Subtasks known a priori. | **Low–medium.** Not an autonomous agent. Batch 50% discount. |
| **Coach roster digest** | **Parallelization (sectioning)** → optional chain to synthesize | Per-athlete briefs in parallel, then roll-up. Predictable fan-out. | **Medium.** Orchestrator–workers only if roster composition/queries vary wildly. |
| **Interactive chat** | **Routing** → **bounded autonomous agent** (tool loop) | Intent/domain routing (wearables vs tennis vs training vs biomarkers) to specialized prompts/tool subsets; agent only within that tool surface. | **Medium.** Full open-ended multi-agent overkill for most turns. |
| **Event-triggered lab insight** | **Prompt chaining** + **evaluator–optimizer** (+ HITL if clinical-adjacent) | Structured extract → wellness-safe narrative → safety/claims evaluator. Deterministic trigger. | **Low–medium.** Autonomous agent unjustified; HITL if crossing into medical guidance. |

Optional later: **orchestrator–workers** when a single coach query truly needs parallel deep dives (e.g. “compare recovery vs match load vs CGM for three athletes with unknown relevant sources”) — measure lift first.

### 8.2 Where Anthropic argues AGAINST the “very complex agentic system”

Stakeholder desire for a sophisticated multi-agent graph conflicts with Anthropic’s repeated guidance:

1. **Simplest solution first** — many apps need only one LLM call + retrieval.  
2. **Workflows for well-defined tasks** — our nightly/event jobs *are* well-defined.  
3. **Agents only when path is unpredictable** — chat qualifies; batch briefs do not.  
4. **Complexity only when evals prove lift** — no multi-agent tax without metrics.  
5. **Frameworks tempt complexity** — Agent SDK / multi-agent frameworks can obscure prompts; prefer clear ACI + evals.  
6. **Context engineering** favors small high-signal contexts and JIT retrieval over stuffing every specialist’s world into one mega-agent.

**What complexity *is* justified for PPD:**

- Strong **tool design** (namespaced, token-efficient, eval-driven) for wearables, tennis, training, biomarkers.  
- **Routing** by domain + role (athlete/coach/parent) and locale.  
- **Policy layer** (wellness boundaries, no diagnosis, no compulsive-exercise coaching, AI disclosure).  
- **Evaluator** for claims safety on lab/CGM/genetics outputs.  
- **JIT retrieval** of athlete cards / match summaries rather than dumping full histories.  
- Sub-agents **only** when isolation/parallel research pays off and evals show it.

**What is not justified up front:** A permanent swarm of specialist agents with free-form orchestration for every nightly brief and chat turn.

### 8.3 Recommended stack stance (research-only recommendation)

| Layer | Recommendation |
|---|---|
| Primary model | Claude **Sonnet 5** (intro pricing until 2026-08-31) or **Sonnet 4.6**; Opus 5 for hard orchestrator/eval |
| Batch jobs | Messages **Batch API** + prompt chaining |
| Interactive agent runtime | Prefer **anthropic** Client SDK + our tool loop; consider Agent SDK only if we deliberately adopt its harness with coding tools denied |
| Context | Small system prompts; prompt caching; JIT tools; compaction for long chats |
| Compliance | Commercial API + DPA; request ZDR; avoid Fable under ZDR; AI disclosure; wellness framing |

---

## 9. Source index

| # | Source | URL | Date / notes |
|---|---|---|---|
| 1 | Building effective agents | https://www.anthropic.com/engineering/building-effective-agents | 2024-12-19 |
| 2 | Effective context engineering | https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents | 2025-09-29 |
| 3 | Writing tools for agents | https://www.anthropic.com/engineering/writing-tools-for-agents | 2025-09-11 |
| 4 | Usage Policy (AUP) | https://www.anthropic.com/legal/aup | Fetched 2026-08-02 |
| 5 | Models overview | https://platform.claude.com/docs/en/about-claude/models/overview | Fetched 2026-08-02 |
| 6 | Pricing | https://platform.claude.com/docs/en/about-claude/pricing | Fetched 2026-08-02 |
| 7 | Agent SDK overview | https://code.claude.com/docs/en/agent-sdk/overview | Fetched 2026-08-02 |
| 8 | Agent loop | https://code.claude.com/docs/en/agent-sdk/agent-loop | Fetched 2026-08-02 |
| 9 | Subagents | https://code.claude.com/docs/en/agent-sdk/subagents | Fetched 2026-08-02 |
| 10 | Hooks | https://code.claude.com/docs/en/agent-sdk/hooks | Fetched 2026-08-02 |
| 11 | Permissions | https://code.claude.com/docs/en/agent-sdk/permissions | Fetched 2026-08-02 |
| 12 | MCP (Agent SDK) | https://code.claude.com/docs/en/agent-sdk/mcp | Fetched 2026-08-02 |
| 13 | Python Agent SDK reference | https://code.claude.com/docs/en/agent-sdk/python | Fetched 2026-08-02 |
| 14 | PyPI claude-agent-sdk | https://pypi.org/project/claude-agent-sdk/ | **0.2.128** |
| 15 | Compaction API | https://platform.claude.com/docs/en/build-with-claude/compaction | Beta `compact-2026-01-12` |
| 16 | API & data retention / ZDR | https://platform.claude.com/docs/en/manage-claude/api-and-data-retention | Fetched 2026-08-02 |
| 17 | Org data retention | https://privacy.claude.com/en/articles/7996866-how-long-do-you-store-my-organization-s-data | 2026-07-01 |
| 18 | ZDR product scope | https://privacy.claude.com/en/articles/8956058-i-have-a-zero-data-retention-agreement-with-anthropic-what-products-does-it-apply-to | 2026-06-09 |
| 19 | DPA | https://privacy.claude.com/en/articles/7996862-how-do-i-view-and-sign-your-data-processing-addendum-dpa | 2026-03-16 |
| 20 | Training data (commercial) | https://privacy.claude.com/en/articles/7996885-how-do-you-use-personal-data-in-model-training | 2026-03-16 |
| 21 | Data residency | https://platform.claude.com/docs/en/manage-claude/data-residency | Fetched 2026-08-02 |
| 22 | Healthcare / life sciences product news | https://www.anthropic.com/news/healthcare-life-sciences | Context only |

---

## 10. Open items / verify before contracting

1. Confirm ZDR eligibility with Anthropic sales for EU academy + consumer athlete data; confirm Covered Models / Fable exclusion.  
2. If EU residency is mandatory, compare first-party API (US workspace geo) vs Bedrock `eu-central-1` pricing and DPA chain.  
3. Re-check Sonnet 5 intro pricing sunset (**2026-08-31**) before cost modeling.  
4. Pin exact model IDs in production configs; re-fetch Models API at deploy time.  
5. Decide Agent SDK vs Client SDK with a spike that measures latency, tool reliability, and ops complexity under `dontAsk` + MCP-only tools.
