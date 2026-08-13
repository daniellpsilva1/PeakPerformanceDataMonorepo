# Research Dossier 60 — Human-in-the-Loop Design for Production Agent Systems

**Topic:** HITL taxonomy, framework pause/resume primitives, autonomy graduation, approval fatigue, reversibility, reviewer economics, trust calibration, EU AI Act Art. 14 / GDPR Art. 22, B2C compensating controls, and a concrete design for a tennis-academy multi-agent platform (61 mutating tools) with a coach-gated B2B mode and a coach-less B2C mode.

**Research date:** 2026-08-02  
**Method:** External web research only (2025–2026 prioritized). No local codebase exploration beyond this file.

---

## 1. Executive takeaways

1. **HITL is a multi-pattern control architecture**, not a single approve button. Canonical patterns include approval-and-gate, edit-then-approve, elicitation, review-after-the-fact (human-on-the-loop), and escalation-on-timeout/exception ([IJFIST 2025](https://doi.org/10.15662/ijfist.2025.0801002); [OpenLegion 2026](https://www.openlegion.ai/en/learn/human-in-the-loop-ai-agents); [Agent Native 2026](https://www.agentnative.dev/patterns/human-in-the-loop-approval-flow-pattern)).
2. **Durable pause is a storage problem.** LangGraph / PydanticAI / OpenAI Agents SDK can wait days *only if* state is persisted outside the process. Temporal (and similar durable engines) make multi-day waits, timers, and escalation first-class ([LangGraph interrupts](https://docs.langchain.com/oss/python/langgraph/interrupts); [Temporal Approval pattern](https://docs.temporal.io/design-patterns/approval); [Dreaming Press durable interrupts](https://dreaming.press/posts/human-approval-survive-agent-restart-durable-interrupts.html)).
3. **Autonomy must be a runtime parameter**, graduated per action type by measured reliability — never by the agent’s own judgment ([Autonomy Slider](https://www.agentpatternscatalog.org/patterns/autonomy-slider/); [Progressive Autonomy](https://agentpatterns.ai/human/progressive-autonomy-model-evolution/); [AI UX Autonomy Spectrum](https://www.aiuxdesign.guide/patterns/autonomy-spectrum)).
4. **Approval fatigue is the dominant production failure mode.** Volume + high prior reliability → rubber-stamping; EU AI Act Art. 14 explicitly names automation bias ([Tian Pan 2026](https://tianpan.co/blog/2026-06-25-approval-fatigue-how-human-in-the-loop-gates-decay-into-rubber-stamps); [BCG 2025](https://www.bcg.com/publications/2025/wont-get-gen-ai-right-if-human-oversight-wrong); Art. 14(4)(b)).
5. **For our product:** coach gate for anything that reaches an athlete or changes training; observational insights may auto-publish; B2C must *remove* coach-dependent capabilities and compensate with a narrower action space, reversibility windows, and wellness-boundary disclaimers — not a fake “self-approval” loop.

---

## 2. Taxonomy of HITL interactions

Sources converge on five interaction types (labels vary; semantics are stable).

| Pattern | What the human does | When to use | Production notes |
|---------|---------------------|-------------|------------------|
| **Approve / reject** | Binary go/no-go on a locked proposal | Irreversible or high-stakes side effects (send message, money move, destructive DB write) | Proposal must be **payload-locked** (HMAC / content hash) so resume cannot execute a mutated payload ([Agent Native](https://www.agentnative.dev/patterns/human-in-the-loop-approval-flow-pattern)) |
| **Edit-then-approve** | Human corrects args / text, then binds the exact payload | Nearly-right drafts (training plan tweak, message wording) | On resume, execute **human-bound args**; do not let the model re-infer ([Solana Garden HITL guide](https://solana.garden/guides/llm-agent-human-in-the-loop-escalation-approval-workflow-systems-explained/); PydanticAI `ToolApproved(override_args=...)`) |
| **Provide input / elicitation** | Supply missing facts, preferences, or credentials mid-run | Ambiguous goals, missing athlete context, sensitive auth | Distinct from approval: the agent *cannot proceed* without data. MCP standardizes this as `elicitation/create` ([MCP elicitation 2025-11-25](https://modelcontextprotocol.io/specification/2025-11-25/client/elicitation); [MCP 2026-07-28 MRTR](https://blog.modelcontextprotocol.io/posts/2026-07-28-release-candidate/)) |
| **Review-after-the-fact** (human-*on*-the-loop) | Audit / undo after action commits | Reversible, low-blast-radius actions with compensation window | Elementum’s HITL / HOTL / HOOTL framing ([Elementum](https://www.elementum.ai/blog/human-in-the-loop-agentic-ai)); OpenLegion “post-execution review” ([OpenLegion](https://www.openlegion.ai/en/learn/human-in-the-loop-ai-agents)) |
| **Escalation** | Hand off to another role, seniority, or channel when primary fails | Timeout, low confidence, policy conflict, minor athletes → parent | Timeout policies: auto-reject (safe default for irreversible), escalate to secondary, rarely auto-approve for reversible low stakes ([OpenLegion](https://www.openlegion.ai/en/learn/human-in-the-loop-ai-agents); [Temporal approval](https://docs.temporal.io/design-patterns/approval)) |

**Enterprise pattern paper (2025)** adds a useful routing lens: map *irreversibility, error cost, regulatory exposure, frequency, latency budget* → pattern choice, and warn that “one gate that everything hits” is the dominant deployment mistake ([IJFIST](https://doi.org/10.15662/ijfist.2025.0801002)).

**Lifecycle states for an approval run** (production checklist): `running` → `pending_review` (checkpoint held, side-effects blocked) → `approved|denied|edited|needs_info` → `resumed` → `expired|delegated` ([Solana Garden](https://solana.garden/guides/llm-agent-human-in-the-loop-escalation-approval-workflow-systems-explained/)).

---

## 3. Framework support: pauses that survive restart and multi-day waits

Comparison criterion: **Can the pause outlive a process death and wait ≥7 days without spinning compute?**

| Framework | Pause primitive | Survival across restart | Multi-day wait | Built-in timeout / escalation | Fit for our product |
|-----------|-----------------|-------------------------|----------------|-------------------------------|---------------------|
| **LangGraph** | `interrupt(payload)` inside a node; resume with `Command(resume=...)` on same `thread_id` | Yes **iff** durable checkpointer (Postgres/Redis). `InMemorySaver` loses pending approvals on restart ([docs](https://docs.langchain.com/oss/python/langgraph/interrupts); [durable interrupts how-to](https://dreaming.press/posts/human-approval-survive-agent-restart-durable-interrupts.html)) | Indefinite wait supported by checkpoint; **no built-in timeout** — you add external scheduler / cron / Temporal ([Handover tutorial](https://thehandover.xyz/blog/langgraph-human-in-the-loop-tutorial)) | Must build yourself | Good graph orchestration; pair with durable checkpointer + external SLA timers |
| **PydanticAI** | `requires_approval=True` or raise `ApprovalRequired`; run ends with `DeferredToolRequests`; resume via `DeferredToolResults` + message history ([docs](https://pydantic.dev/docs/ai/tools-toolsets/deferred-tools/)) | Persist message history + deferred request IDs yourself; `HandleDeferredToolCalls` for inline handlers ([capability docs](https://pydantic.dev/docs/ai/capabilities/handle-deferred-tool-calls/)) | Survives if you store deferred IDs + history in DB; framework does not own the wait | App-owned | Excellent tool-level approve/deny/override_args model for our 61 mutating tools |
| **OpenAI Agents SDK** (v0.8+, Feb 2026) | `@tool(needs_approval=True\|callable)`; run returns `interruptions`; `state.approve` / `state.reject`; resume `Runner.run(agent, state)` ([docs](https://openai.github.io/openai-agents-python/human_in_the_loop/)) | `RunState.to_string()` / `to_json()` → store → `from_string` / `from_json` later ([JS guide](https://openai.github.io/openai-agents-js/guides/human-in-the-loop/); [deep dive](https://www.paperclipped.de/en/blog/openai-agents-sdk-hitl-codex-tool/)) | Designed for long-running approvals via serialized state; version agent defs alongside state | App-owned timers | Cleanest “pause before this tool” API; serialize state into our approval queue |
| **MCP elicitation** | Server returns `elicitation/create` (form or URL mode); 2026-07-28 moves to MRTR `InputRequiredResult` + `requestState` so any server instance can resume without holding SSE ([spec 2025-11-25](https://modelcontextprotocol.io/specification/2025-11-25/client/elicitation); [RC blog](https://blog.modelcontextprotocol.io/posts/2026-07-28-release-candidate/)) | Client/server persist `requestState`; URL mode keeps secrets out of the model | Multi-day possible if client stores pending elicitation; not a workflow engine | Client UX dependent | Use for coach/parent *input* (clarify injury status), not as sole approval engine for DB writes |
| **Temporal signals** | Workflow `wait_condition` / `Await` on signal + durable timer; Signal carries approve/reject + metadata ([Approval pattern](https://docs.temporal.io/design-patterns/approval); [Durable AI HITL tutorial](https://learn.temporal.io/tutorials/ai/building-durable-ai-applications/human-in-the-loop/); [Reliable document approvals](https://docs.temporal.io/guides/reliable-document-approvals)) | **Native.** Event history survives worker death; wait consumes **zero compute** | First-class: `timeout=timedelta(days=7)`, reminders, escalate on timer fire | **Built-in** | Best backbone for 7-day coach SLAs, parent escalation, expiry |

**Recommendation for us:** Orchestrate agent reasoning in LangGraph / PydanticAI / Agents SDK, but **own the approval lifecycle in a durable workflow** (Temporal or equivalent: Postgres outbox + scheduled jobs). Persist: locked proposal hash, risk class, reviewer role, SLA timers, escalation graph. Never keep an LLM worker blocked on a coach who is offline for two days.

---

## 4. Autonomy slider & graduating action types

### 4.1 Levels (industry consensus)

Common ladder ([Autonomy Spectrum](https://www.aiuxdesign.guide/patterns/autonomy-spectrum); [Smashing Magazine Feb 2026](https://www.smashingmagazine.com/2026/02/designing-agentic-ai-practical-ux-patterns/); [AgentPatterns Progressive Autonomy](https://agentpatterns.ai/human/progressive-autonomy-model-evolution/)):

| Level | Name | Agent behavior | Human role |
|------:|------|----------------|------------|
| 0 | Suggest-only | Drafts insights / plans; no side effects | Decision-maker |
| 1 | Act-with-approval | Prepares tool calls; blocked until approve/edit | Approver |
| 2 | Act-and-notify | Executes reversible actions; async audit / undo window | Monitor |
| 3 | Fully autonomous (bounded) | Executes within policy sandbox; sampled audit | Auditor |

**Hard rule:** Autonomy is decided by a **runtime parameter / policy engine**, not by the agent’s reasoning ([Autonomy Slider](https://www.agentpatternscatalog.org/patterns/autonomy-slider/)). Pair with kill switch and per-action risk tiers.

### 4.2 Real graduation metrics

From progressive-autonomy writeups and production guidance:

| Metric | Promote when… | Demote when… |
|--------|---------------|--------------|
| **Approval rate** (of proposals that reach a human) | Consistently >95% *and* QC shows reviews are meaningful | Near-100% with <5s median review time (rubber-stamp signal) |
| **Edit rate** | Declining edits of substance | Rising substantive edits |
| **Defect escape rate** | Flat or down after autonomy increase | Any uptick in athlete-harm / parent complaint / data corruption |
| **Audit disagreement** (shadow review of auto-approved sample) | <5% disagreement | ≥5% or any critical miss |
| **Intervention / undo rate** | Low and stable | Spike after promote |
| **Override capacity health** | Reviewer load stays inside budget (see §7) | Queue backlog → compressed review times |

Elementum recommends targeting roughly **10–15% of cases** still requiring human review once reliability data accumulates — enough to keep humans calibrated, not so many that they burn out ([Elementum](https://www.elementum.ai/blog/human-in-the-loop-agentic-ai)).

**Graduate by action type, not globally.** Example: auto-publish “sleep trend observational card” at L2 long before auto-sending a parent message about injury risk.

---

## 5. Approval fatigue

### 5.1 Mechanism

Approval fatigue is **cognitive economics**, not laziness: when reading every proposal costs more than the expected value of catching an error (because 95/100 were fine), reviewers skim → pattern-match → reflex-approve ([Tian Pan Jun 2026](https://tianpan.co/blog/2026-06-25-approval-fatigue-how-human-in-the-loop-gates-decay-into-rubber-stamps)). Related constructs: **automation bias** (over-trust AI) and **automation complacency** (stop scanning). Clinical CDS literature reports acceptance of *bad* AI advice in roughly the **6–11%** range; time pressure increases severity ([Tian Pan](https://tianpan.co/blog/2026-06-25-approval-fatigue-how-human-in-the-loop-gates-decay-into-rubber-stamps); [AI & SOCIETY 2025 review](https://link.springer.com/article/10.1007/s00146-025-02422-7)).

Uniform “approve everything” gating **trains the clickthrough reflex** and creates a security hole: a dangerous tool call buried in hundreds of routine confirms gets the same dialog ([Tian Pan](https://tianpan.co/blog/2026-06-25-approval-fatigue-how-human-in-the-loop-gates-decay-into-rubber-stamps)). MIT Technology Review (Apr 2026) popularized “HITL theater” for oversight that cannot meaningfully audit ([cited in Kognitos](https://www.kognitos.com/blog/human-in-the-loop-bottleneck-ai-governance/)). Texas Tech / arXiv (2026) formalizes override capacity as scarce and congestible ([arXiv:2606.08919](https://doi.org/10.48550/arxiv.2606.08919)).

### 5.2 Mitigations (map to coach reviewing ~40 athletes)

| Mitigation | How it works | Our application |
|------------|--------------|-----------------|
| **Risk-based routing** | Only escalate high-risk / low-confidence; sample the rest | Auto-publish observational insights; queue training changes & messages |
| **Batching** | One morning digest per athlete / per risk band | “Morning Board”: 40 athletes → ~8–15 actionable cards, not 40×N tool popups |
| **Show diffs, not novels** | Highlight Δ load, Δ message vs last approved, metric deltas | Diff training load; redline message text; sparkline evidence |
| **Confidence-based auto-approval** | Thresholds per risk tier; never sole control for irreversible | Auto L0–L1 observational if calibrated confidence high *and* policy allows |
| **Friction by design** | Approve disabled until evidence expanded; min dwell on Tier-3 | High-risk cards require expand + optional one-line reason |
| **Approval-rate health metrics** | Flag reviewers / queues >95–99% approve | Coach dashboard: reject%, edit%, median seconds |
| **Gold / canary items** | Inject known-wrong proposals periodically | BCG QC technique ([BCG 2025](https://www.bcg.com/publications/2025/wont-get-gen-ai-right-if-human-oversight-wrong)) — use sparingly |
| **Structured justification on reject** | Cheap reject path; expensive silent approve on critical | One-tap reject reasons: “wrong athlete”, “unsafe load”, “tone”, “needs parent” |
| **Do not gate read-only tools** | Prevents training the approve reflex on noise | Of 61 mutating tools, never add faux approvals on reads |

**Target for coaches:** full morning review of 40 athletes in **≤5 minutes** (see §10.2) → average **≤7.5 seconds** per athlete if everything is batched; only escalated cards get 20–40s.

---

## 6. Reversibility as an alternative to approval

**Thesis:** Approval validates *intent before* commit; reversibility bounds *cost after* a wrong commit. High-autonomy fleets need **executable reversal contracts**, not only gates ([ContextOS 2026](https://contextosai.com/blog/reversibility-is-the-missing-safety-primitive); [Unwind effect classes](https://github.com/AMOORCHING/Unwind); [arXiv streaming agents](https://arxiv.org/html/2604.23283v1)).

### 6.1 Action classes

| Class | Meaning | Oversight default |
|-------|---------|-------------------|
| Idempotent / read | Safe retry | No gate |
| Reversible | Exact inverse exists (`delete_draft`, `restore_plan_version`) | Prefer **act-and-notify + undo** |
| Compensable | Semantic undo (saga), not bit-identical | Act-and-notify with compensation window; saga ledger |
| Append-only / irreversible | Email/SMS sent, public post, genetic disclosure | **Hard gate** before send |
| Destructive | Hard delete, permanent privacy leak | Hard gate + dual control if extreme |

### 6.2 When reversibility beats a gate

Prefer undo when **all** hold:

1. Compensation completes within a short window (e.g., 24–72h) before downstream harm.
2. Blast radius is bounded (one athlete’s draft plan, not a broadcast to parents).
3. Latency of waiting for coach would destroy value (same-day training adjustments that can still be rolled back before session).
4. Reviewer capacity is the binding constraint (fatigue risk).

Prefer a **gate** when any hold: message already visible to a minor/parent; medical/biomarker interpretation that could induce behavior change; irreversible DB delete; genetics; legal/consent implications.

**Messages to athletes/parents are effectively irreversible** once delivered (recall is unreliable). Treat as append-only → always pre-approve in B2B.

---

## 7. Economics: when reviewer time kills the agent’s net win

### 7.1 Unit economics

Standard formulation ([aicost.ai HITL calculator](https://aicost.ai/tools/hitl-review-cost); [Decode the Future ROI](https://decodethefuture.org/en/ai-agent-roi-calculator/); [Masood / digital labor budgets](https://medium.com/@adnanmasood/future-of-work-with-ai-agents-as-co-workers-autonomy-economics-and-industry-transformation-c5576a0bc6c9)):

```
C_hitl = N_actions × P_escalate × minutes_per_review × loaded_hourly_rate / 60
C_agent = C_model + C_tools + C_hitl + C_rework + C_incidents_expected
Net win per outcome = C_human_baseline − C_agent
```

HITL labor is often the **largest omitted line** in agentic TCO ([aicost.ai](https://aicost.ai/tools/hitl-review-cost)). Tokens are rarely the dominant cost early; integration, eval, governance, and review dominate.

### 7.2 Capacity rules of thumb (2026)

- Routine review UX target: **10–30 seconds** per item with good context packing; **<5s** usually means rubber-stamp; **>5 min** for routine means the UI failed ([Kognitos](https://www.kognitos.com/blog/human-in-the-loop-bottleneck-ai-governance/)).
- Meaningful-review rate (reviews that catch real errors) is often **<5%** when flat HITL is applied — the rest is overhead ([Kognitos](https://www.kognitos.com/blog/human-in-the-loop-bottleneck-ai-governance/)).
- Break-even intuition for a coach: if the agent saves **15 minutes/day** of planning but demands **20 minutes/day** of approvals, it is a net loss *even if accuracy is perfect*.

### 7.3 Worked sketch (our academy)

Assumptions (illustrative): coach loaded cost €60/hour; 40 athletes; agent proposes 2.0 gated items/athlete/day without batching = 80 reviews × 45s = **60 min/day** → €60/day just for review. With risk routing + batching → **15 gated cards × 20s = 5 min/day** → €5/day. Same agent quality; 12× better economics. **Batching and tiering are product features, not polish.**

---

## 8. Trust calibration: confidence, evidence, speed

### 8.1 What research shows

- **Miscalibrated confidence** impairs appropriate reliance; users struggle to detect miscalibration ([Zhou et al., arXiv 2024/2025](https://arxiv.org/html/2402.07632v4)).
- Telling users “this model is miscalibrated” can **increase under-reliance** without improving decision efficacy ([same](https://arxiv.org/html/2402.07632v4)).
- When human and AI knowledge are misaligned, showing calibrated confidence can **worsen** reliance vs advice-only ([2025 hybrid DM study](https://doi.org/10.1007/978-3-032-08317-3_11)).
- Explanations alone often fail to fix automation bias; **user engagement / verification effort** matters more ([AI & SOCIETY review](https://link.springer.com/article/10.1007/s00146-025-02422-7)).
- Contrastive / hybrid explanations help more than dense feature dumps for reducing over-reliance in some studies ([JCHCI 2026](https://doi.org/10.54216/jchci.110205)).

### 8.2 Reviewer UI principles for coaches

1. **Lead with the decision and the diff**, not a confidence percentage.
2. Show **evidence chips**: source metrics (ACWR, HRV z-score, match load), time range, athlete ID confirmation.
3. Use confidence only if **empirically calibrated per action type**; otherwise show ordinal uncertainty: `High / Medium / Low` tied to known failure modes (“missing last 3 sessions”).
4. Prefer **contrastive rationale**: “Recommend −20% volume *because* ACWR 1.6 and match yesterday; alternative keep volume if coach judges match intensity low.”
5. Never use green “94% confident” as a substitute for evidence (Kognitos: confidence ≠ audit trail).
6. Track **time-to-decision** and **agreement with shadow experts** to detect over- and under-reliance at the product level.

---

## 9. Regulatory angle

### 9.1 EU AI Act Article 14 — Human oversight

**Entry into application for high-risk requirements:** 2 August 2026 ([artificialintelligenceact.eu Art. 14](https://artificialintelligenceact.eu/article/14/); Art. 113).

Article 14 requires high-risk systems to be designed so natural persons can **effectively** oversee them. Oversight must be commensurate with risk, autonomy, and context, via provider-built and/or deployer-implemented measures.

Concretely, overseers must be enabled to ([official text summary](https://ai-act-service-desk.ec.europa.eu/en/ai-act/article-14); [Legalithm](https://www.legalithm.com/en/ai-act-guide/article-14-human-oversight)):

| Capability (Art. 14(4)) | Concrete meaning for us |
|-------------------------|-------------------------|
| (a) Understand capacities & limitations; monitor anomalies | Coach UI shows model/action limits; anomaly flags on tool misuse |
| (b) Remain aware of **automation bias** / over-reliance | Fatigue mitigations §5; canaries; training for coaches |
| (c) Correctly interpret outputs | Diffs, evidence, contrastive rationale — not raw JSON |
| (d) Disregard, override, or **reverse** outputs | Reject + undo paths; versioned training plans |
| (e) Stop / safe interrupt | Kill switch for agent runs per academy / athlete |

**“Effective oversight” ≠ a named human on an org chart.** Regulators and practitioners treat rubber-stamping as non-compliant theater ([Tian Pan](https://tianpan.co/blog/2026-06-25-approval-fatigue-how-human-in-the-loop-gates-decay-into-rubber-stamps); [Kognitos](https://www.kognitos.com/blog/human-in-the-loop-bottleneck-ai-governance/); deployer duties Art. 26: competent, trained persons with authority and support — [DLA Piper](https://intelligence.dlapiper.com/artificial-intelligence/?c=EU&t=11-human-oversight)).

**Classification note:** Whether our sports-performance agent is “high-risk” under Annex III is a legal determination (education/vocational training, employment, health-adjacent products may be in scope depending on claims and context). Design *as if* Art. 14 applies for training-affecting and minor-related flows; document the risk assessment.

### 9.2 GDPR Article 22 — Automated decision-making

Art. 22 restricts **solely automated** decisions that produce **legal or similarly significant** effects, with exceptions (contract, law, explicit consent) and safeguards (human intervention, contest, express views) ([ICO guidance](https://ico.org.uk/for-organisations/uk-gdpr-guidance-and-resources/individual-rights/individual-rights/rights-related-to-automated-decision-making-including-profiling/); [GDPR Local overview](https://gdprlocal.com/automated-decision-making-gdpr/); health-focused analysis [Med Law Rev / PMC](https://pmc.ncbi.nlm.nih.gov/articles/PMC11347939/)). Special-category (health) data triggers Art. 22(4) extra conditions.

**Could coaching recommendations trigger Art. 22?**

| Scenario | Likely Art. 22 posture |
|----------|------------------------|
| Observational dashboard (“HRV down vs your baseline”) with no automatic consequence | Usually **outside** — informative, human decides |
| Auto-applied training plan that materially changes load for a minor without human review | **Risk of “similarly significant effect”** on health/development → treat as in-scope; keep meaningful coach (or parent) intervention |
| Auto message to parent recommending medical care | High risk; avoid solely automated |
| B2C consumer tips framed as wellness, user always confirms before plan changes | Lower risk if user retains meaningful control; still need transparency + contest path |

**UK note (2026):** DUAA 2025 replaced UK Art. 22 with a safeguards regime (Arts. 22A–D) effective Feb 2026 — solely automated significant decisions allowed for most data if safeguards exist; special category still stricter ([Bratby Law](https://bratby.law/practice-areas/data-protection/ai-automated-decision-making/)). EU GDPR Art. 22 remains the stricter baseline for EU athletes.

**Product rule:** For any automated action that *changes training* or *notifies a parent about health*, ensure a **named human intervention path** (coach in B2B; explicit user confirmation + support escalation in B2C) and log it.

---

## 10. B2C / consumer health without a coach reviewer

Consumer wearables and wellness apps operate without clinician/coach review by **narrowing claims and action space**, not by inventing a fake reviewer.

### 10.1 Compensating controls observed in market / guidance

From FDA general wellness policy evolution (WHOOP BPI warning letter Jul 2025 → revised wellness guidance early 2026) ([CNBC](https://www.cnbc.com/2025/07/15/whoop-fda-blood-pressure-feature-wearables.html); [FDA Law Blog](https://www.thefdalawblog.com/2025/07/blood-pressure-rising-fda-warning-letter-takes-an-aggressive-approach-on-general-wellness-product/); [Covington Jan 2026](https://www.cov.com/en/news-and-insights/insights/2026/01/fda-issues-revised-guidance-on-general-wellness-products); [MedTech Dive](https://www.medtechdive.com/news/fda-exempts-wearable-ai-features-guidance/809099/); [JMIR 2026](https://www.jmir.org/2026/1/e90882)):

| Control | Practice |
|---------|----------|
| **Wellness framing** | No diagnosis, treatment, or disease management claims |
| **No clinical-action prompts** | Avoid alerts that direct medical management |
| **No “medical-grade” claims** | Especially for BP / glucose-like metrics |
| **Disclaimers** | Necessary but **not sufficient alone** if product design implies diagnosis (FDA to WHOOP) |
| **User as decision-maker** | Insights suggest; user confirms plan changes |
| **Escalation to human support** | “Talk to a clinician / our support” — not an AI that pretends to be a doctor |
| **Narrower tools** | Prefer read + draft; remove academy messaging, roster writes, parent channels |

### 10.2 Implication

In B2C, the **consumer is not a trained overseer** under Art. 14. Do not dump the coach queue on them. Replace the gate with: smaller tool surface, mandatory confirm for mutations, reversible drafts, hard blocks on medical/genetic actions, and human support escalation.

---

## 11. Concrete system design for Peak Performance

### 11.1 Risk classification & required oversight

Risk score dimensions: **blast radius** (self / athlete / parent / cohort), **reversibility**, **minor involved?**, **health sensitivity**, **external messaging**.

| Class | Examples | Oversight level (B2B) | Autonomy ceiling | Timeout default (7-day max wait) |
|-------|----------|----------------------|------------------|----------------------------------|
| **R0 — Observational insight** | Sleep/HRV trend cards, match summary stats, descriptive tennis bench facts | **Auto-publish** + sampled audit (1–5%) | L2 act-and-notify | N/A (publish immediately) |
| **R1 — Soft recommendation (no auto-apply)** | “Consider lighter day”; educational tip | Auto-publish labeled as suggestion; coach digest optional | L1–L2 | Optional 48h coach mute |
| **R2 — Training-load recommendation (applies to plan)** | Change session volume/intensity, deload prescription written to DB | **Coach approve / edit-then-approve** before write | L1 until metrics graduate | Escalate 48h → head coach; expire 7d → **auto-reject** (don’t silently apply) |
| **R3 — Message to athlete** | Push/in-app/chat to player | Coach approve; edit-then-approve for tone; parent CC rules if minor | L1 hard | Escalate 24h → secondary coach; expire 72h → reject |
| **R4 — Message to parent** | Progress, concern, logistics | Coach approve; for health-concern language, **dual awareness** (coach + optional welfare lead) | L1 hard | Escalate 12–24h; expire 48h → reject (do not send stale concern) |
| **R5 — Database write (non-training)** | Profile fields, schedule metadata, tags | Policy: low-risk fields act-and-notify+undo; identity/consent fields gated | L1–L2 by field | 7d expire → reject |
| **R6 — Biomarkers / clinical-adjacent** | Interpreting glucose, BP estimates, injury likelihood as actionable care advice | **Hard block auto**; coach + explicit “not medical advice” framing; prefer escalate to clinician outside product | L0 suggest-only | No auto-approve ever |
| **R7 — Genetics / hereditary risk** | Any polygenic or ancestry-linked performance/health claim | **Capability removed or dual-control legal hold**; never auto; never B2C | L0 or disabled | Manual compliance review only |

**Minors:** R3/R4 inherit parent-visibility policy from academy settings. Health-concern R4 may require parent notification *after* coach approval, never agent→parent direct without coach.

**61 mutating tools:** At registration, every tool declares `{risk_class, reversibility, compensator?, audience}`. Runtime policy engine maps `(class, tenant_mode, athlete.is_minor, autonomy_level[action])` → `{allow, queue, block}`. Agent cannot self-upgrade class.

---

### 11.2 Coach approval queue UX

**Goal:** Daily review of **40 athletes in ≤5 minutes** for the routine board; deep review only on escalations.

**Layout — “Morning Board”**

1. **Priority rail (top):** R4 parent messages, R6 biomarker flags, SLA <4h, rejected-by-expiry risk.
2. **Athlete strips (batched):** One row per athlete with traffic light: green (R0 only overnight), amber (R1–R2 pending), red (R3–R4).
3. **Card content (≤1 screen):**  
   - Proposed action title (verb + object)  
   - **Diff** (plan Δ% volume, message redline)  
   - 3 evidence chips + “why / why not” contrastive line  
   - Uncertainty ordinal + missing-data warnings  
   - Actions: `Approve` · `Edit` · `Reject` · `Snooze 24h` · `Needs info`
4. **Bulk actions:** “Approve all R2 with Δ load ≤10% and High evidence” (policy-bounded bulk).
5. **Done state:** Count of pending / expired / edited; approval-rate health for the coach.

**Time budget math**

| Bucket | Count (typ.) | Time each | Total |
|--------|--------------|-----------|-------|
| Green athletes (open only if curious) | ~25 | 0s | 0 |
| Amber R2 cards | ~10 | 15–20s | ~3 min |
| Red R3/R4 | ~2–3 | 30–40s | ~2 min |
| **Total** | | | **~5 min** |

If amber+red >15, the agent is over-escalating — tune thresholds, don’t ask coaches to work harder.

---

### 11.3 Durable workflow: 7-day pause, escalation, expiry

```
┌─────────────┐    policy     ┌──────────────────┐
│ Agent run   │──R2–R5───────►│ ApprovalWorkflow │  (Temporal / equivalent)
│ (tools)     │               │ id = proposal_id │
└─────────────┘               └────────┬─────────┘
                                       │
                          persist locked_payload + hash
                                       │
                    ┌──────────────────┼──────────────────┐
                    ▼                  ▼                  ▼
              Notify coach       Timer T1 (e.g. 48h)  Timer T_expire (≤7d)
              (push/email)       → escalate role-2     → AUTO-REJECT
                    │                  │                  │
                    ▼                  ▼                  ▼
              Signal: approve | edit | reject | needs_info
                    │
                    ▼
              Verify hash == locked_payload
                    │
          ┌─────────┴─────────┐
          ▼                   ▼
     Execute tool        Inject denial /
     (idempotent key)    replan branch
```

**Rules**

- Side-effecting tools **do not run** until workflow reaches `approved` with hash check.
- `needs_info` re-opens elicitation (MCP form or in-app) without closing the workflow.
- **Default on expiry for R2–R5: reject** (fail closed). Never auto-apply stale training changes after a week.
- Parent escalation is a **branch**, not a replacement for coach on R3/R4 in B2B.
- Idempotency keys on every mutating tool; compensators registered for R5 reversible writes.
- Full audit: proposal, evidence snapshot, reviewer id, decision, latency, execution result (Art. 14 / accountability).

**Framework mapping:** PydanticAI/OpenAI SDK pause → serialize deferred/`RunState` into workflow input; on signal, resume agent **or** execute bound tool directly without re-generation (prefer direct execute for edit-then-approve).

---

### 11.4 B2C variant: controls that replace the coach gate

| B2B control | B2C replacement |
|-------------|-----------------|
| Coach approve queue | **User confirmation** for any plan mutation; default draft-only |
| Coach edit-then-approve | Inline editor owned by user before “Save to my plan” |
| Parent messaging | **Removed** (no coach–parent channel). Optional guardian account with separate consent |
| Auto R0 insights | Keep, with wellness disclaimers |
| R2 training writes | Allowed only after explicit user confirm; 24–72h undo |
| R3 athlete messages from “coach voice” | **Removed** — agent speaks as product assistant to the user only |
| R6 biomarkers | Suggest-only wellness language; **no clinical-action alerts**; block disease claims |
| R7 genetics | **Removed entirely** |
| Escalation to coach | Escalation to **human support** + “consult a clinician” for red-flag symptoms (scripted, not diagnostic) |
| Art. 22 mitigation | User is decision-maker; log confirms; provide contest / delete-plan |

**Capabilities that must be removed in consumer mode**

1. Any tool that messages a third party (coach, parent, other athletes).  
2. Academy roster / multi-athlete writes.  
3. Autonomic application of training plans without confirm.  
4. Injury diagnosis, return-to-play clearance, medication, or genetics.  
5. “Coach approved” social proof copy (misleading).  
6. Bulk cohort interventions.

**Keep:** personal observational insights, user-confirmed plan drafts, wearable sync read tools, undoable self-edits, support ticket escalation.

---

### 11.5 Metrics to graduate action types toward autonomy

Track **per `tool_name` × `risk_class` × `tenant_mode`**:

| Metric | Definition | Graduation gate (example) |
|--------|------------|---------------------------|
| `proposal_accept_rate` | Approves / (approves+rejects+edits) | ≥0.95 for 4 weeks |
| `substantive_edit_rate` | Edits changing meaning / >10% load Δ | ≤0.10 |
| `defect_escape_rate` | Post-hoc bad outcomes / executed | ≤ baseline human error; zero critical |
| `undo_rate` | Undos within window / L2 executions | ≤0.05 before promoting L2→L3 |
| `median_review_seconds` | Coach time on class | Stable 10–30s; investigate <5s |
| `canary_catch_rate` | Injected faults caught | ≥0.80 |
| `shadow_disagreement` | Expert vs auto-policy on sample | ≤0.05 |
| `sla_expiry_rate` | Expired rejects / proposals | ≤0.05 (else coaches overloaded or SLAs wrong) |
| `automation_bias_index` | Composite: high accept + low review time + low canary catch | Must stay below alert threshold |
| `net_coach_minutes_saved` | Baseline planning time − review time | >0 sustained |

**Promotion protocol:** Propose L-bump in policy PR → shadow mode 2 weeks → partial traffic → full. Instant demote kill switch on defect spike.

---

## 12. Source index (URLs)

### HITL patterns & taxonomy
- https://www.openlegion.ai/en/learn/human-in-the-loop-ai-agents  
- https://www.agentnative.dev/patterns/human-in-the-loop-approval-flow-pattern  
- https://www.elementum.ai/blog/human-in-the-loop-agentic-ai  
- https://doi.org/10.15662/ijfist.2025.0801002  
- https://solana.garden/guides/llm-agent-human-in-the-loop-escalation-approval-workflow-systems-explained/  

### Frameworks
- https://docs.langchain.com/oss/python/langgraph/interrupts  
- https://dreaming.press/posts/human-approval-survive-agent-restart-durable-interrupts.html  
- https://thehandover.xyz/blog/langgraph-human-in-the-loop-tutorial  
- https://pydantic.dev/docs/ai/tools-toolsets/deferred-tools/  
- https://pydantic.dev/docs/ai/capabilities/handle-deferred-tool-calls/  
- https://openai.github.io/openai-agents-python/human_in_the_loop/  
- https://openai.github.io/openai-agents-js/guides/human-in-the-loop/  
- https://developers.openai.com/api/docs/guides/agents/guardrails-approvals  
- https://www.paperclipped.de/en/blog/openai-agents-sdk-hitl-codex-tool/  
- https://modelcontextprotocol.io/specification/2025-11-25/client/elicitation  
- https://blog.modelcontextprotocol.io/posts/2026-07-28-release-candidate/  
- https://docs.temporal.io/design-patterns/approval  
- https://learn.temporal.io/tutorials/ai/building-durable-ai-applications/human-in-the-loop/  
- https://docs.temporal.io/guides/reliable-document-approvals  

### Autonomy slider
- https://www.agentpatternscatalog.org/patterns/autonomy-slider/  
- https://www.aiuxdesign.guide/patterns/autonomy-spectrum  
- https://www.smashingmagazine.com/2026/02/designing-agentic-ai-practical-ux-patterns/  
- https://agentpatterns.ai/human/progressive-autonomy-model-evolution/  

### Approval fatigue & economics
- https://tianpan.co/blog/2026-06-25-approval-fatigue-how-human-in-the-loop-gates-decay-into-rubber-stamps  
- https://www.bcg.com/publications/2025/wont-get-gen-ai-right-if-human-oversight-wrong  
- https://scadea.com/hitl-as-a-governance-control-automation-bias-and-review-architecture/  
- https://link.springer.com/article/10.1007/s00146-025-02422-7  
- https://www.kognitos.com/blog/human-in-the-loop-bottleneck-ai-governance/  
- https://doi.org/10.48550/arxiv.2606.08919  
- https://aicost.ai/tools/hitl-review-cost  
- https://decodethefuture.org/en/ai-agent-roi-calculator/  

### Reversibility
- https://contextosai.com/blog/reversibility-is-the-missing-safety-primitive  
- https://arxiv.org/html/2604.23283v1  
- https://solana.garden/guides/llm-agent-compensating-transactions-saga-rollbacks-explained/  
- https://github.com/AMOORCHING/Unwind  

### Trust calibration
- https://arxiv.org/html/2402.07632v4  
- https://doi.org/10.1145/3613904.3642671  
- https://dl.acm.org/doi/10.1145/3706598.3713336  
- https://doi.org/10.1007/978-3-032-08317-3_11  
- https://doi.org/10.54216/jchci.110205  

### Regulation
- https://artificialintelligenceact.eu/article/14/  
- https://ai-act-service-desk.ec.europa.eu/en/ai-act/article-14  
- https://www.legalithm.com/en/ai-act-guide/article-14-human-oversight  
- https://intelligence.dlapiper.com/artificial-intelligence/?c=EU&t=11-human-oversight  
- https://ico.org.uk/for-organisations/uk-gdpr-guidance-and-resources/individual-rights/individual-rights/rights-related-to-automated-decision-making-including-profiling/  
- https://gdprlocal.com/automated-decision-making-gdpr/  
- https://pmc.ncbi.nlm.nih.gov/articles/PMC11347939/  
- https://bratby.law/practice-areas/data-protection/ai-automated-decision-making/  

### Consumer / wellness without clinician
- https://www.cnbc.com/2025/07/15/whoop-fda-blood-pressure-feature-wearables.html  
- https://www.thefdalawblog.com/2025/07/blood-pressure-rising-fda-warning-letter-takes-an-aggressive-approach-on-general-wellness-product/  
- https://www.cov.com/en/news-and-insights/insights/2026/01/fda-issues-revised-guidance-on-general-wellness-products  
- https://www.medtechdive.com/news/fda-exempts-wearable-ai-features-guidance/809099/  
- https://www.jmir.org/2026/1/e90882  

---

## 13. Open decisions for product/legal

1. Formal EU AI Act Annex III classification opinion for academy vs consumer SKUs.  
2. Whether injury / RTP suggestions are always R6 (recommended: yes).  
3. Parent dual-control policy for minors by jurisdiction.  
4. Choice of durable workflow engine (Temporal vs Postgres+scheduler) given current infra.  
5. Canary injection ethics/consent with academy customers.

---

*End of dossier 60.*
