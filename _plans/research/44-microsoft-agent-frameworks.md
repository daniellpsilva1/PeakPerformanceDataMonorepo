# 44 — Microsoft Agent Frameworks (AutoGen, Semantic Kernel, Magentic, MAF)

**Research date:** 2026-08-02  
**Scope:** External research only. Decision input for a Python FastAPI multi-agent sports-performance service self-hosted on Hetzner/Docker (no Azure commitment).  
**Candidates covered:** AutoGen, Semantic Kernel, Magentic-One / Magentic patterns, Microsoft Agent Framework (MAF).  
**Primary question:** Adopt MAF, steal Magentic ideas and build ourselves, or skip the Microsoft stack entirely?

---

## Executive recommendation (short)

| Dimension | Score (1–5) | Notes |
| --- | --- | --- |
| Self-hosting without Azure | **3** | Core SDK is OSS and runs anywhere; docs/samples push Foundry; Durable Extension / Cosmos pull toward Azure |
| Multi-provider freedom | **4** | OpenAI, Anthropic, Bedrock, Gemini, Ollama first-party; Foundry is default in tutorials |
| Python quality | **4** | Python at GA parity with .NET (1.0 Apr 2026); PyPI meta-package at **1.13.0** as of Aug 2026 |
| Durability | **3** | Built-in workflow checkpoints (in-memory / file / Cosmos); true Temporal-style durability via Azure Durable Task Extension |
| Maturity | **3.5** | GA since Apr 2026; orchestration packages 1.0 Jun 2026; still young production lore vs LangGraph |
| Control | **3** | Workflows give explicit graphs; Magentic remains LLM-driven and harder to constrain |

**Bottom line for Peak Performance Data:** Do **not** adopt MAF as the primary runtime unless you want .NET parity or deep Foundry later. Steal the **Magentic task-ledger / progress-ledger** pattern (reimplementable in a few hundred lines) for open-ended investigation tasks like “why has this athlete regressed over three months.” Prefer LangGraph / PydanticAI / custom orchestration for a Hetzner-hosted FastAPI service. Treat AutoGen and Semantic Kernel as **maintenance-mode predecessors** — do not start new work on them.

---

## 1. Consolidation story: AutoGen + Semantic Kernel → Microsoft Agent Framework

### 1.1 What happened (timeline)

| Date | Event |
| --- | --- |
| Pre-2025 | Two parallel Microsoft stacks: **AutoGen** (MSR multi-agent research) and **Semantic Kernel** (enterprise SDK, plugins, middleware) |
| **Oct 2025** | Microsoft announces **Microsoft Agent Framework** as the unified successor; AutoGen + SK enter maintenance for new features |
| **Feb 2026** | MAF Release Candidate; feature surface locked |
| **Apr 3, 2026** | **MAF 1.0 GA** for Python and .NET — “stable APIs, long-term support” |
| **Jun 18, 2026** | Python `agent-framework-orchestrations` **1.0.0** — sequential, concurrent, group chat, handoff, magentic all stable |
| **Aug 2026 (today)** | Meta-package `agent-framework` on PyPI at **1.13.0**; Learn docs updated Jul 2026; Go runtime in public preview |

Sources:
- https://devblogs.microsoft.com/agent-framework/microsoft-agent-framework-version-1-0/
- https://devblogs.microsoft.com/agent-framework/agent-frameworks-orchestration-patterns-reach-1-0/
- https://github.com/microsoft/autogen/discussions/7066
- https://venturebeat.com/orchestration/microsoft-retires-autogen-and-debuts-agent-framework-to-unify-and-govern
- https://pypi.org/project/agent-framework/
- https://learn.microsoft.com/en-us/agent-framework/overview/

### 1.2 Status of each predecessor — be precise

#### AutoGen

- **Status: maintenance mode** (not hard-deleted, not “deprecated” in the sense of removed packages).
- GitHub caution banner: will **not** receive new features or enhancements; **community-managed going forward**; Microsoft continues **critical bug fixes and security patches**.
- Official guidance: **new users should start with Microsoft Agent Framework**; existing users should migrate via the AutoGen → MAF migration guide.
- AutoGen is **not** the recommended path for new production work as of mid-2026.

Sources:
- https://github.com/microsoft/autogen
- https://learn.microsoft.com/en-us/agent-framework/migration-guide/from-autogen/
- https://github.com/microsoft/autogen/discussions/7066

#### Semantic Kernel

- **Status: maintenance / v1.x support window** — framed by Microsoft as “think of MAF as Semantic Kernel v2.0.”
- Commitment (from Product Lead Shawn Henry): continue critical bugs, security issues, and some remaining SK features to GA; **majority of new features go to MAF**; support while substantial usage remains, **and for at least one year after MAF leaves Preview and is GA** (MAF GA was Apr 2026 → support commitment through at least **Apr 2027**).
- Not abruptly deprecated; existing SK apps keep running with no planned breaking changes during the window.
- New agent-focused projects should use MAF.

Sources:
- https://devblogs.microsoft.com/agent-framework/semantic-kernel-and-microsoft-agent-framework/
- https://learn.microsoft.com/en-us/agent-framework/overview/
- https://learn.microsoft.com/en-us/agent-framework/migration-guide/from-semantic-kernel/

#### Magentic-One

- Originally a **research system** (Nov 2024 MSR paper) implemented on AutoGen.
- The **orchestration pattern** (manager + task ledger + progress ledger) was productized into MAF as the **Magentic** orchestration builder (`MagenticBuilder` / `StandardMagenticManager`).
- Magentic-One-the-paper is not a separate product you install; Magentic-the-pattern is a first-class MAF orchestration at 1.0.

Sources:
- https://www.microsoft.com/en-us/research/articles/magentic-one-a-generalist-multi-agent-system-for-solving-complex-tasks/
- https://www.microsoft.com/en-us/research/wp-content/uploads/2024/11/Magentic-One.pdf
- https://devblogs.microsoft.com/agent-framework/agent-frameworks-orchestration-patterns-reach-1-0/

### 1.3 Migration path

| From | To | Notes |
| --- | --- | --- |
| AutoGen `AssistantAgent` | MAF `Agent` | Renamed params; model client + tools + `run` stay familiar |
| AutoGen tools / schemas | `@tool` / first-class tools | Less boilerplate |
| AutoGen `RoundRobinGroupChat` | `GroupChatBuilder` | Concept mapping is close |
| SK `ChatCompletionAgent` / Kernel plugins | MAF `Agent` + tools / middleware | Migration guides + migration assistants analyze code and generate plans |
| Magentic-One (AutoGen ext) | `MagenticBuilder` | Same ledger ideas, workflow-backed |

Official guides:
- https://learn.microsoft.com/en-us/agent-framework/migration-guide/from-autogen/
- https://learn.microsoft.com/en-us/agent-framework/migration-guide/from-semantic-kernel/

SAP’s production migration write-up (AutoGen → MAF `agent_framework==1.9.0`) reports one-to-one concept mapping and cleaner LLM adapters: https://community.sap.com/t5/technology-blog-posts-by-sap/migrating-from-microsoft-autogen-to-microsoft-agent-framework-maf-with-sap/ba-p/14425286

### 1.4 What is *not* deprecated

- Packages remain installable; APIs are stable for existing apps.
- “Deprecated” in practice means **no new feature investment / do not start greenfield** — not “uninstall tomorrow.”

---

## 2. Microsoft Agent Framework — current state

### 2.1 Versions (as of 2026-08-02)

| Artifact | Version | Status |
| --- | --- | --- |
| MAF core (Python + .NET) | **1.0 GA** (2026-04-03) | Production-ready, LTS commitment |
| PyPI `agent-framework` meta-package | **1.13.0** | Pins `agent-framework-core==1.13.0` |
| PyPI `agent-framework-orchestrations` | **1.0.0** (2026-06-18) | Stable orchestration builders |
| .NET `Microsoft.Agents.AI` | 1.x (reports cite ~1.13.0 mid-2026) | GA parity claimed |
| Go Agent Framework | Public preview | Not feature-complete vs Python/.NET |

Install:
```bash
pip install agent-framework          # full meta-package
pip install agent-framework-core     # lighter: OpenAI/Azure OpenAI + workflows/orchestrations
```

Python requirement: **≥ 3.10**.

Sources:
- https://devblogs.microsoft.com/agent-framework/microsoft-agent-framework-version-1-0/
- https://pypi.org/project/agent-framework/
- https://pypi.org/project/agent-framework-orchestrations/

### 2.2 Python vs .NET quality

- Microsoft claims **feature parity for GA-marked APIs** across Python and .NET.
- Historical SK/AutoGen reality: .NET often led enterprise features; AutoGen was Python-first for research. MAF explicitly aimed to end that split.
- Python surface is real and primary for multi-agent samples (`MagenticBuilder`, orchestration builders, checkpoint storage protocol).
- Caveats from community: some provider adapters and edge cases still feel .NET-heritage (Durable Task concepts); Go is clearly second-class (preview).
- For a FastAPI team, Python is **first-class enough** — not a .NET-only product.

Sources:
- https://devblogs.microsoft.com/agent-framework/semantic-kernel-and-microsoft-agent-framework/
- https://github.com/microsoft/agent-framework
- https://datarekha.com/blog/microsoft-agent-framework-production/

### 2.3 Core primitives

From Learn overview (Jul 2026):

1. **Agents** — LLM + tools + MCP; providers via chat clients; sessions for multi-turn state.
2. **Harness** — opinionated long-running agent (planning/todos, context compaction, file access, tool approval, observability).
3. **Workflows** — graph of executors/agents; type-safe routing; checkpointing; HITL request ports.
4. **Building blocks** — model clients, agent session, context providers (memory), middleware, MCP clients.
5. **Orchestration builders** (on top of workflows) — Sequential, Concurrent, GroupChat, Handoff, Magentic.
6. **Protocols** — MCP for tools; A2A for cross-runtime agents (A2A 1.0 “coming soon” in Apr 2026 1.0 blog).
7. **Declarative YAML** — agents/workflows as version-controlled config.

Sources:
- https://learn.microsoft.com/en-us/agent-framework/overview/
- https://devblogs.microsoft.com/agent-framework/microsoft-agent-framework-version-1-0/

### 2.4 Maturity assessment

**Strengths**
- Explicit 1.0 GA + LTS language from Microsoft Product.
- Same teams that built AutoGen/SK; migration guides and assistants exist.
- Orchestration patterns stabilized as their own 1.0 package.
- OpenTelemetry GenAI conventions built in.
- Multi-provider connectors beyond Azure.

**Weaknesses**
- Only ~4 months past GA (Apr → Aug 2026); production battle scars are thinner than LangGraph.
- Docs and samples still default to **Foundry / AzureCliCredential** even for “hello world.”
- Durable story forks: lightweight checkpoints vs Azure Durable Task Extension.
- Magentic inherits AutoGen’s open-endedness — powerful, expensive, hard to SLA.

---

## 3. Multi-agent orchestration patterns

All five are stable in Python and .NET as of orchestration 1.0 (Jun 2026). Builders return ordinary workflows (stream, checkpoint, compose).

Source: https://devblogs.microsoft.com/agent-framework/agent-frameworks-orchestration-patterns-reach-1-0/

### 3.1 Sequential

- **What:** Fixed pipeline — agent A → B → C; each sees prior output.
- **When:** Deterministic stages (draft → review → format; ingest metrics → score → narrate).
- **Control:** Highest. Prefer for SLAs and audits.
- **Sports fit:** Nightly insight generation pipeline; not for exploratory “why did X regress?”

### 3.2 Concurrent

- **What:** Fan-out / fan-in — several agents in parallel, then merge.
- **When:** Independent sub-analyses (HRV trends || load || match stats) then synthesize.
- **Control:** High on topology; merge logic must be explicit.
- **Sports fit:** Parallel specialist queries for a dashboard briefing.

### 3.3 Group chat

- **What:** Moderated multi-agent conversation; a manager/selector chooses who speaks next (evolved from AutoGen GroupChat).
- **When:** Debate, critique, multi-perspective reasoning where turn order is dynamic but not full Magentic planning.
- **Control:** Medium — conversation can wander; need turn limits.
- **Sports fit:** Coach + physiologist + analyst personas discussing a case (with hard caps).

### 3.4 Handoff

- **What:** Routed specialist team — control transfers to a specialist based on rules/classification, then may return.
- **When:** Clear ownership domains (triage → tennis specialist → wearables specialist).
- **Control:** Medium-high if routing rules are explicit; drops if LLM does free-form handoff.
- **Sports fit:** Intent router to domain agents (training vs tennis analytics vs recovery).

### 3.5 Magentic (detailed — see §4)

- **What:** LLM manager maintains **task ledger** + **progress ledger**; plans, assigns, detects stalls, replans.
- **When:** Open-ended investigation where the path is unknown a priori.
- **Control:** Lowest of the five — guardrails are `max_round_count`, `max_stall_count`, `max_reset_count`, optional HITL plan review / stall intervention.
- **Sports fit:** “Why has this athlete regressed over three months?” — exactly Magentic’s sweet spot.

---

## 4. Magentic-One / Magentic pattern — precise specification

This is the highest-value transferable idea even if you never install MAF.

### 4.1 Origin

**Magentic-One** (Microsoft Research AI Frontiers, Nov 2024): generalist multi-agent system. Lead **Orchestrator** + specialists (originally WebSurfer, FileSurfer, Coder, ComputerTerminal). Built on AutoGen; now productized as MAF Magentic orchestration.

Paper PDF: https://www.microsoft.com/en-us/research/wp-content/uploads/2024/11/Magentic-One.pdf  
Article: https://www.microsoft.com/en-us/research/articles/magentic-one-a-generalist-multi-agent-system-for-solving-complex-tasks/

### 4.2 Architecture: two nested loops

```
┌──────────────── OUTER LOOP (Task Ledger) ────────────────┐
│  Populate facts / lookups / derivations / guesses          │
│  Draft NL plan assigned to named agents                    │
│  On stall threshold: reflect → update ledger → replan      │
│  On replan: CLEAR agent contexts / reset specialist state  │
│                                                            │
│   ┌────────── INNER LOOP (Progress Ledger) ──────────┐     │
│   │  Each round, Orchestrator answers 5 questions      │     │
│   │  Select next agent + instruction                   │     │
│   │  Agent acts → transcript grows                     │     │
│   │  Stall counter++ if looping or no progress         │     │
│   │  If stall > threshold → break to outer loop        │     │
│   └────────────────────────────────────────────────────┘     │
│  Until task complete OR max attempts / time                │
│  Final: synthesize answer or best educated guess           │
└────────────────────────────────────────────────────────────┘
```

### 4.3 Task Ledger (outer-loop memory)

Short-term structured memory for the whole task. Pre-populated then revised:

| Field | Purpose |
| --- | --- |
| **Given or verified facts** | Known truths from the user prompt or confirmed tool results |
| **Facts to look up** | Need external retrieval (DB queries, web, files) |
| **Facts to derive** | Need computation / reasoning (e.g., load-monotony ratios, trend slopes) |
| **Educated guesses** | Soft hypotheses from model knowledge — used cautiously when stuck or out of time; updated as evidence arrives |
| **Task plan** | Natural-language step-by-step plan with agent assignments — acts as CoT *hint*, not a hard program |

Important paper details:
- Plan is **not** strictly enforced; Orchestrator and agents may deviate.
- On each outer-loop replan, **all agents clear contexts and reset state** (prevents poisoned history from a failed approach).
- Educated guesses reduce over-reliance on closed-book hallucination by isolating them as “guesses.”

### 4.4 Progress Ledger (inner-loop control)

Each inner-loop iteration, the Orchestrator answers **five questions** (verbatim from the paper):

1. **Is the request fully satisfied (i.e., task complete)?**
2. **Is the team looping or repeating itself?**
3. **Is forward progress being made?**
4. **Which agent should speak next?**
5. **What instruction or question should be asked of this team member?**

Inputs to those answers: task ledger + current conversation transcript.

**Stall counter:**
- Increment when loop detected or no forward progress.
- Paper default threshold: **≤ 2** before breaking to outer loop (MAF exposes `max_stall_count`, samples use 3).
- On break: reflection/self-refinement — what went wrong, what was learned, what to do differently → update task ledger → new plan → new inner loop.

**Termination:**
- Task marked complete, or
- Parameterized max rounds / max resets / max time,
- Then Orchestrator reviews full transcript + ledgers and emits final answer or best guess.

### 4.5 MAF productization (`MagenticBuilder`)

```python
from agent_framework.orchestrations import MagenticBuilder

workflow = MagenticBuilder(
    participants=[researcher, coder],
    manager_agent=manager,
    max_round_count=10,
    max_stall_count=3,
    max_reset_count=2,
).build()
```

Fluent API also supports:
- `.with_standard_manager(...)` / custom `MagenticManagerBase`
- `.with_plan_review(enable=True)` — HITL approve/revise plan before run
- `.with_human_input_on_stall(enable=True)` — pause instead of auto-replan
- `.with_checkpointing(storage)` — persist ledgers + conversation

HITL decisions include: APPROVE, REVISE, CONTINUE, REPLAN, GUIDANCE.

API docs: https://learn.microsoft.com/en-us/python/api/agent-framework-core/agent_framework.magenticbuilder

### 4.6 Mapping to “athlete regression over 3 months”

| Magentic role | PPD analogue |
| --- | --- |
| Orchestrator / Manager | Investigation manager (strong reasoning model) |
| Task ledger facts | Athlete ID, date window, known injuries, coach notes |
| Facts to look up | Wearables series, training load, match results, sleep/HRV |
| Facts to derive | Acute:chronic workload, performance deltas, phase markers |
| Educated guesses | “Likely overreach” / “illness” as hypotheses, not conclusions |
| Specialists | Wearables agent, tennis analytics agent, training agent, medical/notes agent |
| Progress ledger | Each round: did we get new evidence? who’s next? |
| Stall → replan | e.g., switch from “volume” hypothesis to “technique / opponent strength” |
| Final synthesis | Causal narrative + evidence table + confidence |

This is where Magentic earns its keep vs a fixed sequential pipeline.

### 4.7 Reimplementation sketch (steal the idea, ~few hundred lines)

You do **not** need MAF to use this pattern. Minimal custom loop:

```python
# Pseudocode — transferable pattern, not MAF code
@dataclass
class TaskLedger:
    verified_facts: list[str]
    facts_to_lookup: list[str]
    facts_to_derive: list[str]
    educated_guesses: list[str]
    plan: str  # NL steps + agent names

@dataclass
class ProgressLedger:
    is_complete: bool
    is_looping: bool
    is_progressing: bool
    next_agent: str
    instruction: str

async def magentic_investigate(task: str, agents: dict[str, Agent], *, max_rounds=12, max_stall=3, max_resets=2):
    ledger = await manager.populate_task_ledger(task, agents)
    stall, resets, transcript = 0, 0, []
    while resets <= max_resets:
        for _ in range(max_rounds):
            progress = await manager.fill_progress_ledger(ledger, transcript)
            if progress.is_complete:
                return await manager.finalize(ledger, transcript)
            if progress.is_looping or not progress.is_progressing:
                stall += 1
                if stall > max_stall:
                    break
            else:
                stall = 0
            result = await agents[progress.next_agent].run(progress.instruction, transcript)
            transcript.append(result)
            # optionally update verified_facts from tool outputs
        # outer loop: reflect + replan + reset agent contexts
        ledger = await manager.reflect_and_replan(ledger, transcript)
        for a in agents.values():
            a.reset_context()
        resets += 1
        stall = 0
    return await manager.finalize(ledger, transcript, best_guess=True)
```

Add: structured JSON schemas for both ledgers (Pydantic), hard tool allowlists per specialist, token budgets, and mandatory citation of tool results in the final answer.

---

## 5. Workflows, checkpointing, durable execution, HITL

### 5.1 Workflow checkpoints (built into MAF, self-hostable)

Workflows run in **supersteps**. Checkpoint at end of each superstep captures: executor states, pending messages, pending requests/responses, shared state.

Python `CheckpointStorage` implementations:

| Provider | Package | Durability | Fit |
| --- | --- | --- | --- |
| `InMemoryCheckpointStorage` | `agent-framework` | Process only | Tests / demos |
| `FileCheckpointStorage` | `agent-framework` | Local disk | Single-node Docker |
| `CosmosCheckpointStorage` | `agent-framework-azure-cosmos` | Azure Cosmos DB | Distributed Azure |

Resume via consistent `thread_id`. Magentic checkpoints include conversation + task/progress ledgers.

Source: https://learn.microsoft.com/en-us/agent-framework/workflows/checkpoints

**For Hetzner:** File storage works for single-replica; for multi-replica you’d implement `CheckpointStorage` against Postgres/Redis yourself (protocol is swappable) — Cosmos is the Microsoft-blessed production store.

### 5.2 Durable Task Extension (stronger durability — Azure-leaning)

Separate from workflow checkpoint storage:
- **Durable Extension** = Temporal / Durable Functions lineage: crash recovery across workers, long timers, distributed scale.
- Hosting: Azure Functions **or** bring-your-own-compute worker talking to **Durable Task Scheduler** (Azure-managed backend in the docs).
- Docs explicitly distinguish: standard checkpoint storage resumes a run in the Agent Framework runtime; Durable Extension checkpoints across distributed durable workers.

Source: https://learn.microsoft.com/en-us/agent-framework/integrations/durable-extension  
Source: https://learn.microsoft.com/en-us/azure/durable-task/sdks/durable-agents-microsoft-agent-framework

**Honest take for PPD:** Use MAF file/Postgres checkpoints or **don’t use MAF durability at all** and put long jobs on your own queue (Celery/Arq/Temporal self-hosted). The “production durability” story quietly steers to Azure.

### 5.3 Human-in-the-loop

- Workflow **request ports** for approvals.
- Magentic: plan review, stall intervention, function/tool approval (`FunctionApprovalRequestContent`).
- Pause/resume via checkpoints + streaming response APIs.
- Preview: AG-UI / CopilotKit / ChatKit adapters for frontend HITL.

---

## 6. Observability

- Native OpenTelemetry: traces, logs, metrics.
- Follows **OpenTelemetry GenAI Semantic Conventions** (https://opentelemetry.io/docs/specs/semconv/gen-ai/).
- Python: `opentelemetry-api` always; SDK + `configure_otel_providers()` for exporters; optional `microsoft-opentelemetry` / Azure Monitor.
- Workflows emit their own spans; tool calls and LLM turns appear in distributed traces.
- Env knobs for sensitive content capture (`ENABLE_INSTRUMENTATION`, sensitive-data flags in samples).
- Azure AI Foundry dashboards are the **first-party UX**, but OTLP → Grafana/Jaeger/Honeycomb on Hetzner works without Azure.

Sources:
- https://learn.microsoft.com/en-us/agent-framework/agents/observability
- https://github.com/microsoft/agent-framework/blob/main/python/samples/02-agents/observability/README.md
- https://devblogs.microsoft.com/foundry/introducing-microsoft-agent-framework-the-open-source-engine-for-agentic-ai-apps/

---

## 7. Azure dependency — what works self-hosted vs what pulls Foundry

### 7.1 Works fully without an Azure account

| Capability | Self-hosted? |
| --- | --- |
| Core `Agent` + `OpenAIChatClient` / Anthropic / Ollama | Yes |
| Workflows + orchestration builders | Yes |
| Magentic / Sequential / Concurrent / Handoff / GroupChat | Yes |
| Middleware, sessions, MCP clients | Yes |
| OpenTelemetry → any OTLP backend | Yes |
| File / in-memory checkpoints | Yes |
| Docker on Hetzner | Yes (it’s just Python packages) |

### 7.2 Silently / structurally pulls toward Azure AI Foundry

| Capability | Pull |
| --- | --- |
| Default docs/samples | `FoundryChatClient` + `AzureCliCredential` in 1.0 announcement “hello world” |
| Managed memory / Foundry Agent Service | Azure |
| Cosmos checkpoint storage | Azure |
| Durable Task Extension / Durable Task Scheduler | Azure-managed backend |
| Foundry evaluations, hosted tools, Foundry observability dashboards | Azure |
| Copilot Studio connector | Microsoft cloud |
| Marketing / “enterprise readiness” narrative | Foundry-first |

Microsoft’s own framing: OSS SDK that “maps cleanly” to Foundry for production. You *can* stay off Azure; you will swim against the current of samples, memory backends, and durable hosting.

Sources:
- https://devblogs.microsoft.com/agent-framework/microsoft-agent-framework-version-1-0/
- https://devblogs.microsoft.com/foundry/introducing-microsoft-agent-framework-the-open-source-engine-for-agentic-ai-apps/
- https://learn.microsoft.com/en-us/agent-framework/integrations/durable-extension

---

## 8. Model support beyond Azure OpenAI

First-party connectors (1.0 announcement + Jul 2026 providers docs):

| Provider | Notes |
| --- | --- |
| Microsoft Foundry | Default in samples |
| Azure OpenAI | Full features |
| OpenAI | Direct API |
| Anthropic Claude | Tools, structured outputs (Python); extended thinking |
| Amazon Bedrock | Listed in 1.0 blog |
| Google Gemini | Listed in 1.0 blog / Go provider table |
| Ollama | Local OSS models |
| Foundry Local | Python local Foundry models |
| GitHub Copilot SDK / Claude Code SDK | Preview harness integrations |
| Custom | Implement `BaseAgent` / chat client |

Provider feature matrix: https://learn.microsoft.com/en-us/agent-framework/agents/providers/

**For PPD:** Multi-provider is real. Risk is cultural (examples assume Foundry), not technical lock-in at the chat-client layer.

---

## 9. Honest criticism — AutoGen production reputation & what engineers say

### 9.1 AutoGen historical reputation (confirmed)

Recurring themes from engineers and Microsoft’s own messaging:

1. **Research-flavored scaffolding, not a product** — “framework, not a product; be prepared to build everything yourself” (state, cost control, idempotent tools, telemetry).
2. **Hard to control** — non-deterministic multi-agent dialogues; loops; max-round knobs are blunt instruments.
3. **Cost/latency** — serial LLM chatter; 30–70% cost/latency penalties vs hand-rolled orchestration without caching/concurrency (Stackinsight eval).
4. **Microsoft Research disclaimer** — AutoGen Studio blog: “primarily a developer tool to enable rapid prototyping and research. It is not a production ready tool.”
5. **State desync** — isolated agent memories causing conflicting actions under load (Galileo production write-up).
6. **Medium / community** — “I’m steering clear of AutoGen in customer-facing apps”; GPT-4-class models required for reliability made economics hard.

Sources:
- https://communities.stackinsight.net/community/aitr-autogen/hot-take-autogen-is-a-framework-not-a-product-be-prepared-to-build-everything-yourself/
- https://www.microsoft.com/en-us/research/blog/introducing-autogen-studio-a-low-code-interface-for-building-multi-agent-workflows/
- https://galileo.ai/blog/autogen-framework-multi-agents
- https://pub.aimind.so/autogen-isnt-practical-for-real-world-applications-yet-5b8c6dc97641
- https://github.com/microsoft/autogen/discussions/7870

### 9.2 Does MAF fix that?

**Partially.**

| AutoGen pain | MAF response | Residual risk |
| --- | --- | --- |
| No durable state | Workflows + checkpoints + Durable Extension | Durable Extension → Azure; file checkpoints are single-node |
| Weak observability | OTel GenAI conventions | You still must wire exporters / redaction |
| Uncontrolled group chat | Explicit Sequential/Concurrent/Handoff + Magentic with stall caps | Magentic is still LLM-governed |
| Research → prod gap | Enterprise middleware, sessions, migration story | Ecosystem gravity toward Foundry |
| Cost spirals | Workflows push deterministic nodes for repeatable logic | Magentic investigations remain expensive |

Production commentary after MAF (datarekha, ~six months in): the Workflow vs Agent split is the right idea (durable deterministic shell, non-deterministic agent nodes); API still leaks Durable Task heritage and feels heavier than LangGraph.

Source: https://datarekha.com/blog/microsoft-agent-framework-production/

LangChain’s competitive framing (biased but directionally useful): comparison is now **LangGraph vs MAF**, not LangChain vs AutoGen; AutoGen maintenance mode made AutoGen a migration source, not a peer.

Source: https://www.langchain.com/resources/langchain-vs-autogen

---

## 10. Transferable ideas (even if we do not adopt MAF)

1. **Magentic dual-ledger orchestration** (§4) — highest value; reimplement for athlete investigations.
2. **Stall counter + forced replan + context reset** — prevents infinite tool loops; reset on replan avoids poisoned history.
3. **Educated guesses as a first-class ledger field** — separate hypotheses from verified facts in prompts/state.
4. **Workflow vs Agent split** — durable deterministic graph for pipelines; LLM agents only at ambiguous nodes.
5. **Orchestration pattern menu** — pick Sequential/Concurrent/Handoff/GroupChat/Magentic by task shape instead of one chat forever.
6. **Tool-centric specialists over role-theater** — paper’s insight: WebSurfer/FileSurfer/Coder beat “researcher/critic/CEO” role prompts for reuse (adapt to WearablesSurfer / MatchStats / TrainingLoad).
7. **HITL at plan and stall boundaries** — not only at final answer.
8. **OTel GenAI semantic conventions** — adopt regardless of framework.
9. **Middleware pipeline** — cross-cutting authz, PII redaction, cost caps outside prompts.
10. **Superstep checkpointing** — snapshot after each fan-in barrier for long jobs.

---

## 11. Scoring for Peak Performance Data

| Criterion | Score | Rationale |
| --- | --- | --- |
| **Self-hosting without Azure** | **3 / 5** | OSS Python runs on Hetzner; production durability/memory samples push Cosmos + Durable Task + Foundry |
| **Multi-provider freedom** | **4 / 5** | OpenAI/Anthropic/Bedrock/Gemini/Ollama supported; Foundry-biased docs |
| **Python quality** | **4 / 5** | GA parity with .NET; active PyPI releases through 1.13.0; FastAPI-friendly async |
| **Durability** | **3 / 5** | Good enough file/custom checkpoint protocol; best-in-class path is Azure Durable Extension |
| **Maturity** | **3.5 / 5** | 1.0 GA Apr 2026; orchestration 1.0 Jun 2026; thinner prod lore than LangGraph; AutoGen scars linger culturally |
| **Control** | **3 / 5** | Excellent when you stay on Sequential/Concurrent/Handoff workflows; Magentic trades control for open-endedness (needed for regression investigations, with guardrails) |

**Composite:** ~**3.4 / 5** as a primary framework for a non-Azure FastAPI shop.  
**As a pattern library:** Magentic ledgers score **5 / 5** — steal them.

### Decision matrix for PPD

| Option | Verdict |
| --- | --- |
| Greenfield on AutoGen | **No** — maintenance mode |
| Greenfield on Semantic Kernel | **No** — maintenance / SK v1 support window only |
| Adopt MAF as runtime | **Weak maybe** — only if .NET sharing or Foundry later is strategic |
| Reimplement Magentic ledgers in-house | **Yes — recommended** for open-ended sports investigations |
| Use MAF ideas + LangGraph/PydanticAI/custom | **Preferred** for Hetzner self-host |

---

## 12. Source index

### Official Microsoft
- https://devblogs.microsoft.com/agent-framework/microsoft-agent-framework-version-1-0/
- https://devblogs.microsoft.com/agent-framework/agent-frameworks-orchestration-patterns-reach-1-0/
- https://devblogs.microsoft.com/agent-framework/semantic-kernel-and-microsoft-agent-framework/
- https://devblogs.microsoft.com/foundry/introducing-microsoft-agent-framework-the-open-source-engine-for-agentic-ai-apps/
- https://learn.microsoft.com/en-us/agent-framework/overview/
- https://learn.microsoft.com/en-us/agent-framework/migration-guide/from-autogen/
- https://learn.microsoft.com/en-us/agent-framework/migration-guide/from-semantic-kernel/
- https://learn.microsoft.com/en-us/agent-framework/workflows/checkpoints
- https://learn.microsoft.com/en-us/agent-framework/agents/observability
- https://learn.microsoft.com/en-us/agent-framework/agents/providers/
- https://learn.microsoft.com/en-us/agent-framework/integrations/durable-extension
- https://learn.microsoft.com/en-us/azure/durable-task/sdks/durable-agents-microsoft-agent-framework
- https://learn.microsoft.com/en-us/python/api/agent-framework-core/agent_framework.magenticbuilder
- https://github.com/microsoft/agent-framework
- https://github.com/microsoft/autogen
- https://github.com/microsoft/autogen/discussions/7066
- https://pypi.org/project/agent-framework/
- https://pypi.org/project/agent-framework-orchestrations/

### Magentic-One research
- https://www.microsoft.com/en-us/research/articles/magentic-one-a-generalist-multi-agent-system-for-solving-complex-tasks/
- https://www.microsoft.com/en-us/research/wp-content/uploads/2024/11/Magentic-One.pdf
- https://microsoft.github.io/autogen/0.4.5/_modules/autogen_ext/teams/magentic_one.html

### Production / criticism / competitive
- https://venturebeat.com/orchestration/microsoft-retires-autogen-and-debuts-agent-framework-to-unify-and-govern
- https://www.langchain.com/resources/langchain-vs-autogen
- https://www.langchain.com/resources/ai-agent-frameworks
- https://datarekha.com/blog/microsoft-agent-framework-production/
- https://community.sap.com/t5/technology-blog-posts-by-sap/migrating-from-microsoft-autogen-to-microsoft-agent-framework-maf-with-sap/ba-p/14425286
- https://communities.stackinsight.net/community/aitr-autogen/hot-take-autogen-is-a-framework-not-a-product-be-prepared-to-build-everything-yourself/
- https://galileo.ai/blog/autogen-framework-multi-agents
- https://pub.aimind.so/autogen-isnt-practical-for-real-world-applications-yet-5b8c6dc97641
- https://www.microsoft.com/en-us/research/blog/introducing-autogen-studio-a-low-code-interface-for-building-multi-agent-workflows/
- https://opentelemetry.io/docs/specs/semconv/gen-ai/

---

*Dossier written 2026-08-02. Versions cited: MAF 1.0 GA (2026-04-03), `agent-framework` 1.13.0, `agent-framework-orchestrations` 1.0.0, Magentic-One paper Nov 2024.*
