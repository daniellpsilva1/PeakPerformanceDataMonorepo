# 73 — Release Engineering & Change Management for LLM-Powered Systems

**Research date:** 2026-08-02  
**Scope:** Multi-agent Python system for a sports-performance platform. Behavior is determined by prompts, model choices, tool definitions, and safety policies — any of which can silently degrade quality or safety. Providers deprecate and silently update models. Today: prompts are string constants in Python, models are hardcoded strings, nothing gates a deploy. The system also runs a **nightly batch** that generates health-adjacent content across hundreds of athletes — blast radius is batch-shaped, not interactive.  
**Audience:** Platform eng + AI eng designing release discipline for a system whose behavior is not fully determined by code.

---

## Executive recommendation (TL;DR)

1. **Store agent behavior as a versioned *bundle* in git** (prompt text + pinned model ID + tool schemas + output schemas + safety policy + decoding params). That is the deployable unit. Optionally **mirror** bundles into Langfuse (or similar) for observability linkage and non-engineer review — not as the sole source of truth for production.
2. **Gate every bundle change** with: schema/tool lint → golden-trace replay → offline eval suite (safety hard-gates) → human review of the prompt/schema diff.
3. **For the nightly batch:** never flip 100% overnight. Run **shadow on full cohort → canary on 5–10% of athletes with hold-before-publish → expand over nights**. Publish only after automated safety gates; keep a one-flag kill switch that suppresses delivery and falls back to the last-good bundle or deterministic templates.
4. **Pin dated model snapshots** in the bundle; treat alias upgrades as first-class releases with the same gates.

---

## 1. Prompt versioning: code vs registry

### 1.1 The two camps

| Approach | What it is | Strengths | Weaknesses |
| --- | --- | --- | --- |
| **Prompts-in-code** | Templates live in git (Python modules, YAML/Markdown under `prompts/`), reviewed in PRs, shipped with the consuming code | Atomic deploys with parsers/tools; code review; reproducible diffs; rollback = revert commit; no runtime dependency on a prompt SaaS | Iteration requires a deploy; non-engineers need a PR path; large prompt diffs are noisy without tooling |
| **Prompt registry** | Central store (Langfuse / LangSmith Hub / Braintrust / PromptLayer / Agenta); app fetches by name + label (`prod`) at runtime | Non-engineers can iterate; promote/rollback by moving a label; A/B by label; versions linked to traces | Prompt can drift from tool/schema code; hot-edits bypass CI; “what’s in prod?” becomes a console question; another failure domain at runtime |

Practitioner framing:

- **Treat prompts like code** when they are load-bearing contracts (Champlin Enterprises; Learn AI Visually “prompt-as-code”). A central registry *module* in the repo with explicit SemVer still counts as in-code.
- **Treat prompts as config** when product/domain experts must iterate without eng bandwidth (PromptLayer’s CMS pitch; Neosage “prompt lifecycle”).
- Hybrid that has emerged in 2025–2026: **git is source of truth; CI syncs to a registry** for playground, labels, and trace linkage ([futurecraft.pro](https://futurecraft.pro/blog/prompt-engineering-system/), [Agenta versioning guide](https://agenta.ai/blog/prompt-versioning-guide)).

### 1.2 Tool comparison (2025–2026)

| Tool | Primary pitch | Versioning model | Self-host | Best fit |
| --- | --- | --- | --- | --- |
| **Langfuse** | OSS observability + prompts | Hash/versions + labels; OTel-native | Yes (MIT) | Data residency, eng-owned, escape hatch |
| **LangSmith Hub** | LangChain ecosystem tracing + prompt hub | Git-style commits, tags | No (managed) | Already on LangChain/LangGraph |
| **Braintrust** | Eval-first; playground replays prod traces | Versions tied to experiments/evals | Hybrid | CI gates and “change → measure → ship” |
| **PromptLayer** | Prompt CMS for cross-functional teams | Named versions, release labels, visual editor | No | PMs/domain experts edit prompts |
| **Agenta** | OSS prompt mgmt + playground | Branching, environments, snippets; CI webhooks back to git | Yes (MIT) | Open-source registry with eng loop |

Sources: [Metacto comparison](https://www.metacto.com/blogs/prompt-management-tools-comparison), [PromptLayer vs LangSmith vs Braintrust (2026)](https://www.promptlayer.com/blog/promptlayer-vs-langsmith-vs-braintrust-which-llm-ops-platform-to-pick/), [Awesome Agents 2026](https://awesomeagents.ai/tools/best-ai-prompt-management-tools-2026/), [dreaming.press Langfuse vs LangSmith vs Braintrust](https://dreaming.press/posts/2026-06-26-langfuse-vs-langsmith-vs-braintrust.html).

**Decision rule from practitioners:** pick the platform for the *workflow you actually have* — CMS (PromptLayer), LangChain-native (LangSmith), eval-first (Braintrust), self-host/portability (Langfuse/Agenta). None of them replace the need for a **bundle** that couples prompts to schemas/tools (next section).

### 1.3 Hybrid patterns that work

1. **Git-authored bundles + registry mirror.** PR merges → CI validates → publish immutable version to Langfuse/Braintrust with label `staging`; promote `prod` label only after canary. App may still load from local package for latency/reliability, or fetch by version hash with a local fallback.
2. **Registry for playground, git for production.** Non-engineers experiment in UI; eng ports winning prompt into a PR that updates the bundle (Agenta “CI webhook creates PR” path).
3. **Feature-flag pointer, not hot-edit text.** Flag service (LaunchDarkly AI Configs / AgentControl) points at a **bundle version ID**, not free-form prompt text ([LaunchDarkly AI Configs GA](https://launchdarkly.com/blog/ai-configs-ga-runtime-control-prompts-models/)). Changing the pointer is the release; the blob was already reviewed.

### 1.4 Arguments for prompts-in-code (strongest for us)

- Prompt changes that assume new tool args or JSON fields **must** ship with code, or you get silent tool-call failures ([Learn AI Visually](https://learnaivisually.com/tracks/agent-engineering/deployment-rollout)).
- Health-adjacent systems need **auditability**: “what exact instructions produced this athlete insight?” → commit SHA + bundle hash in every row.
- Nightly batch + multi-agent Python: runtime fetch of prompts adds little agility and adds a dependency when you most need determinism.
- Hot-edit consoles destroy rollback and cross-env parity ([Learn AI Visually](https://learnaivisually.com/tracks/agent-engineering/deployment-rollout); [MLOps Community on ChatGPT sycophancy](https://mlops.community/blog/when-prompt-deployment-goes-wrong-mlops-lessons-from-chatgpts-sycophantic-rollback)).

### 1.5 Arguments for a registry (when to adopt later)

- Domain experts (sports scientists, coaches) need to tune tone/safety phrasing weekly without eng queue.
- You want side-by-side playground on real traces without local setup (Braintrust’s strength).
- Multi-service consumers of the same prompt need a single labeled version.

**For our platform today:** start **prompts-in-code as bundles**. Add Langfuse (or Braintrust) as **observability + optional mirror**, not as the production authoring plane, until non-engineer iteration is a real bottleneck.

---

## 2. Coupling prompts to schemas and tools (the bundle)

### 2.1 Why this is the strongest argument for in-code (or at least atomic artifacts)

Agent behavior is a function of **all** of:

1. Prompt / system instructions / few-shots  
2. Model snapshot ID + decoding params  
3. Tool definitions (JSON Schema / function specs)  
4. Structured output / response schema  
5. Safety / guardrail policy  

Changing any one alone causes the classic “agent broke for no reason” incidents ([Learn AI Visually](https://learnaivisually.com/tracks/agent-engineering/deployment-rollout)):

| Independent change | Failure mode |
| --- | --- |
| Prompt mentions new tool args; schema unchanged | Tool validation fails at boundary |
| Model alias advances; prompt unchanged | Verbosity, hedging, refusal shifts; JSON adherence drifts |
| Tool field renamed; prompt/few-shots unchanged | Model emits old field names forever |
| Output schema tightened; prompt unchanged | Parse failures spike |

Arize AX formalizes this as a **Prompt Object**: template + model + invocation params + tools + response format — promotion must be atomic ([Arize Prompt Object](https://arize.com/docs/ax/concepts/prompts/prompt-object)). DZone’s “signed release” pattern packages prompts, tool schemas, router rules, and guardrails as one signed manifest ([DZone supply chain for tools/prompts](https://dzone.com/articles/supply-chain-security-for-prompts-and-tools-signal)). Incident-response guides say: pin model + prompt + tool schema as one versioned artifact so rollback is one revert ([isimplifyme agent IR](https://isimplifyme.com/blog/agent-incident-response)).

### 2.2 Recommended unit: `AgentBundle`

```text
bundles/nightly-insights/v1.4.0/
├── manifest.yaml          # version, owner, risk_class, eval_suite_id
├── prompts/
│   ├── orchestrator.md
│   ├── health_specialist.md
│   └── critic.md
├── model.yaml             # provider, pinned snapshot IDs, temperature, max_tokens
├── tools/
│   ├── registry.json      # tool names + JSON Schema (or refs into code)
│   └── allowlist.yaml     # which tools this agent may call
├── schemas/
│   └── insight_output.schema.json
├── safety/
│   └── policy.yaml        # medical/claims rules, refusal patterns, disclaimers
└── fixtures/
    └── golden_trace_ids.txt
```

Rules:

- **One SemVer for the directory**, not per file.  
- Runtime loads by `bundle_version` (or `prod` → version map in config).  
- Every LLM call / batch row logs `bundle_version`, `model_id`, `prompt_hash`, `tool_schema_hash`.  
- Tool *implementations* still live in code; the bundle pins the **contract** the model sees. Contract and implementation ship in the same PR when they diverge.

### 2.3 Agenta’s dependency note

Multi-step agents have **prompt→schema→downstream prompt** dependencies. Deploying one prompt without its consumers is a class of bug. Environments (`staging`/`prod`) should promote **chains** together ([Agenta](https://agenta.ai/blog/prompt-versioning-guide)).

---

## 3. Deployment safety for behavior changes

Standard 2026 progression ([Atlan A/B framework](https://atlan.com/know/ab-testing-llm-applications/), [AI/TLDR](https://ai-tldr.dev/learn/production-llmops/testing-deployment/llm-model-upgrade-rollout/), [tianpan.co](https://tianpan.co/blog/2026-04-09-llm-gradual-rollout-shadow-canary-ab-testing), [FutureAGI](https://futureagi.com/blog/llm-eval-shadow-traffic-canary-2026/)):

```text
Offline eval → Shadow → Canary → A/B (optional) → Full → CI locks the winner
```

### 3.1 Shadow mode

- Duplicate real inputs to candidate; **serve only baseline**.  
- Score with LLM-as-judge + structural diffs (length, schema validity, tool-call sequence).  
- Cost: ~2× inference during the window; justified for high-stakes (health-adjacent) changes.  
- Limitation: cannot measure user reaction — only output quality vs baseline.  
- Batch-friendly: replay last N nights of athlete inputs through candidate before any publish.

### 3.2 Canary (percentage or cohort)

- Serve candidate to a **sticky** slice (hash of `athlete_id` or `org_id`).  
- Typical interactive ramp: 1% → 5% → 20% → 50% → 100% with bake times ([Learn AI Visually](https://learnaivisually.com/tracks/agent-engineering/deployment-rollout); [tianpan.co](https://tianpan.co/blog/2026-04-09-llm-gradual-rollout-shadow-canary-ab-testing)).  
- High-stakes: start 0.1–1%.  
- Metrics: latency, cost/request, refusal rate, output-length distribution, schema fail rate, online judge score, user feedback — **vs trailing 7-day baseline**, not a frozen absolute ([FutureAGI](https://futureagi.com/blog/llm-eval-shadow-traffic-canary-2026/)).  
- **Auto-rollback** on pre-registered thresholds is expected; manual-only is a maturity gap.

**Canary ≠ A/B:** canary asks “is it safe?”; A/B asks “is it better?” ([AI/TLDR](https://ai-tldr.dev/learn/production-llmops/testing-deployment/llm-model-upgrade-rollout/)).

### 3.3 A/B with statistical rigor

- Isolate **one** layer per experiment (prompt *or* model *or* params) ([Atlan](https://atlan.com/know/ab-testing-llm-applications/)).  
- Non-determinism: even T=0 can vary ~15% across runs — inflate sample sizes; ~200 conversions/variant is a floor, not a target.  
- Pre-register primary metric + MDE + power analysis.  
- For batch systems, A/B unit is usually **athlete-night** or **org**, not request.

### 3.4 Automatic rollback triggers (LLM-specific)

Examples used in production guides:

| Signal | Example trigger |
| --- | --- |
| Schema / parse failure rate | Absolute > 2% or +1.5pp vs control |
| Refusal rate | +5pp absolute vs control window |
| p99 latency | +40% vs control |
| Cost / request | +30% vs budget baseline |
| Online judge safety score | Below pre-registered floor for N consecutive windows |
| Tool-call error rate | 2× control |

On trip: set canary weight → 0% (or `active_bundle` → previous), page humans *after* bleed stops ([tianpan.co](https://tianpan.co/blog/2026-04-09-llm-gradual-rollout-shadow-canary-ab-testing), [FutureAGI](https://futureagi.com/blog/llm-eval-shadow-traffic-canary-2026/)).

---

## 4. Model version pinning & silent drift

### 4.1 Alias vs snapshot (provider practices as of 2026)

| Provider | Pinning practice | Alias risk | Deprecation notice (typical) |
| --- | --- | --- | --- |
| **Anthropic** | Dated IDs e.g. `claude-sonnet-4-5-20250929`; lifecycle Active → Legacy → Deprecated → Retired | Convenience aliases can move; pin full ID for prod | **≥ 60 days** before retirement for public models ([official deprecations](https://platform.claude.com/docs/en/about-claude/model-deprecations)) |
| **OpenAI** | Dated snapshots e.g. `gpt-4o-2024-08-06`; floating aliases update without notice | Alias keeps working but **behavior shifts**; pin for reproducibility | Snapshots eventually retire (e.g. GPT-5/o3 snapshot retirements announced mid-2026 for Dec 2026 — pin-or-break vs alias-or-drift tradeoff) ([PrivateDevOps summary](https://privatedevops.com/news/openai-retires-gpt-5-o3-snapshots-december-2026); [OpenLegion](https://www.openlegion.ai/en/learn/ai-agent-versioning)) |
| **Google (Gemini / Vertex)** | Stable versioned IDs vs `latest` / auto-updated aliases | `latest` hot-swapped; Vertex recommends explicit stable versions for prod | Often **≥ 6 months** for GA; preview/`latest` can be ~2 weeks ([lifecycle calendar](https://hidekazu-konishi.com/entry/ai_model_deprecation_and_lifecycle_calendar.html)) |

**Production rule:** pin dated snapshots in the bundle; run floating aliases only in staging with a nightly eval canary against the pin. Treat every pin bump as a release.

Note: Anthropic’s `anthropic-version` API header pins **API schema**, not model weights — pin both independently ([OpenLegion](https://www.openlegion.ai/en/learn/ai-agent-versioning)).

Anthropic 2026 cadence note: recent retirements often sit near the **60-day minimum** (e.g. Opus/Sonnet 4 retired 2026-06-15 after 2026-04-14 notice) ([Anthropic docs](https://platform.claude.com/docs/en/about-claude/model-deprecations), [TheRouter cadence playbook](https://therouter.ai/blog/anthropic-model-deprecation-cadence-migration-guide/)). Calendar-watch deprecations; do not assume year-long pins.

### 4.2 Detecting silent behavior drift under an alias

1. Log `model` ID returned by the API + any `system_fingerprint` (OpenAI) per call.  
2. Run a **fixed golden prompt set** on a schedule (hourly/daily) against the production pin; alert on distribution shifts (length, refusal, JSON validity) with no deploy on your side ([llmbook §42.4](https://llmbook.apartsin.com/part-9-llm-evaluation-observability/module-42-evaluation-foundations/section-42.4.html)).  
3. Staging on floating alias vs prod pin; promote only after evals pass for N days ([EzAI pinning guide](https://ezaiapi.com/blog/ai-model-version-pinning-production)).

### 4.3 Real incidents

| Incident | What happened | Lesson |
| --- | --- | --- |
| **OpenAI GPT-4o sycophancy (Apr 2025)** | Update made ChatGPT overly flattering/validating; safety concerns (mental health, risky behavior). Partial system-prompt mitigations then **full model rollback** over ~24h ([OpenAI postmortem](https://openai.com/index/expanding-on-sycophancy/), [TechCrunch](https://techcrunch.com/2025/04/29/openai-explains-why-chatgpt-became-too-sycophantic/), [Ars](https://arstechnica.com/ai/2025/04/openai-rolls-back-update-that-made-chatgpt-a-sycophantic-mess/)) | Short-term thumbs-up A/B ≠ long-term safety; staged rollout + longitudinal metrics matter; prompt/model changes are safety-critical |
| **MLOps read of same incident** | Social media became the pager; insufficient progressive rollout ([MLOps Community](https://mlops.community/blog/when-prompt-deployment-goes-wrong-mlops-lessons-from-chatgpt-sycophantic-rollback)) | Treat prompt/model deploys with MLOps discipline |
| **Alias vs pin retirement (2026 narrative)** | Pinned snapshots fail loudly on retirement; aliases keep working but **silently** change behavior ([PrivateDevOps](https://privatedevops.com/news/openai-retires-gpt-5-o3-snapshots-december-2026)) | Prefer loud break + calendar over silent drift for health systems |
| **DriftEval (2025 preprint)** | Multi-month tracking of GPT/Claude showed measurable semantic/stylistic/behavioral drift; detection ~2.3 weeks before user reports ([Zenodo](https://doi.org/10.5281/zenodo.17852481)) | Continuous behavioral monitoring is not optional |

---

## 5. Regression detection in production (no ground truth)

This is the hard problem. What actually works, ranked by ROI:

### 5.1 Layer 1 — Structural signals (100% of traffic, synchronous, cheap)

These catch a large fraction of “silent” failures ([tianpan continuous eval](https://tianpan.co/blog/2026-05-04-continuous-production-eval-statistical-quality-monitoring-llm-traffic), [VentureBeat](https://venturebeat.com/infrastructure/monitoring-llm-behavior-drift-retries-and-refusal-patterns)):

- Schema / JSON parse success rate  
- Required-field presence  
- Output token length (mean + distribution)  
- Tool-call success / validation error rate  
- Tool-call frequency (calls per task)  
- Latency p50/p95/p99  
- Cost per task  

**Alert style:** vs **7-day rolling baseline**, e.g. >2σ or absolute floor (schema success < 98%).

### 5.2 Layer 2 — Behavioral proxies (100% or sampled, async)

- **Refusal rate** (regex / classifier) — often the first signal of safety-filter or prompt drift ([DEV drift article](https://dev.to/tiamatenity/llm-drift-detection-know-when-your-model-stops-behaving-432e))  
- Hedging language frequency  
- Retry / regeneration rate  
- User feedback rate (thumbs-down, “report”, coach override)  
- Empty / truncated output rate  

### 5.3 Layer 3 — Online evaluators (sampled 5–15%)

- LLM-as-judge on a **pinned rubric** (safety, medical overclaim, numeric faithfulness to tool evidence, language).  
- Compare to trailing baseline; page on e.g. >3pp drop in pass rate ([Medium agent eval chapter](https://medium.com/@vinodkrane/chapter-8-agent-evaluation-for-llms-how-to-test-tools-trajectories-and-llm-as-judge-788f6f3e0d52)).  
- **Calibrate** judge against human labels before using as a gate (see research note 55).

### 5.4 Layer 4 — Distribution / embedding drift

- Embedding centroid distance or KL divergence on output embeddings ([DriftEval](https://doi.org/10.5281/zenodo.17852481), [llmbook](https://llmbook.apartsin.com/part-9-llm-evaluation-observability/module-42-evaluation-foundations/section-42.4.html)).  
- Useful for slow drift; noisier; adopt after Layers 1–3 are solid.

### 5.5 Layer 5 — Golden-set replay (scheduled)

- Fixed, versioned inputs run against current prod bundle on a timer.  
- Isolates **provider-side** change when your code didn’t deploy.

**What does *not* work alone:** waiting for user complaints; accuracy on a stale offline set; a single aggregate “quality score” without strata (intent, language, org).

**Honest summary:** Layers 1–2 catch ~80% of operational regressions early; subtle semantic harm needs Layer 3 + human review loops; batch health content needs **pre-publish** Layer 3 on the canary cohort, not only post-hoc.

---

## 6. Golden traces / snapshot testing for agents

### 6.1 Pattern

1. Capture production (or staging) traces: prompts, model, tools, tool results, outputs.  
2. Pin a stratified set (~50 well-chosen beats 500 frozen) ([tianpan snapshot trace test](https://tianpan.co/blog/2026-05-09-snapshot-trace-test-production-regression-suite)).  
3. On every PR: **replay** with recorded tool/LLM responses (deterministic, cheap) — catches prompt/tool wiring regressions.  
4. Nightly: **live** re-run against current model — catches provider drift.  
5. Assert in tiers: structural/tool trajectory → distribution bands (latency/tokens) → LLM-as-judge semantics.

### 6.2 Tooling (2025–2026)

| Tool | Role |
| --- | --- |
| **AgentSnap** | Record golden runs; CI replay vs live nightly; diffs on prompts, call counts, tool sequences ([GitHub](https://github.com/iamfaham/AgentSnap)) |
| **TraceOps** | VCR-like SDK intercept for OpenAI/Anthropic/LangGraph; GapAnalyzer for CI ([GitHub](https://github.com/ioteverythin/TraceOps)) |
| **agentverify** | pytest plugin: trajectory assertions (tools, args, cost, safety) on replay ([GitHub](https://github.com/simukappu/agentverify)) |
| **Braintrust playground** | Load prod trace, try alternate prompt/model, score side-by-side |
| **Langfuse / LangSmith datasets** | Export failing prod traces → regression datasets |

**For us:** start with a thin internal fixture format (JSONL traces) + pytest trajectory asserts; adopt AgentSnap/TraceOps if SDK interception fits the stack. Refresh golden set monthly from canary failures and human-flagged harms.

---

## 7. Configuration as data & feature flags

### 7.1 What belongs in config (not code redeploy)

- Active `bundle_version` pointer (`prod`, `canary`)  
- Model pin overrides (emergency)  
- Temperature / max_tokens (within allowed bands)  
- Feature flags for agent capabilities: e.g. `enable_wearable_tools`, `enable_medical_disclaimer_v2`, `enable_critic_agent`  
- Per-organization staged rollout: org allowlist / percentage  

### 7.2 What must stay in the reviewed bundle

- Prompt text that changes safety posture  
- Tool schemas and allowlists  
- Output schemas  
- Hard safety policy rules  

LaunchDarkly’s AI Configs / AgentControl productizes runtime prompt+model variations with targeting and rollback ([LaunchDarkly](https://launchdarkly.com/blog/ai-configs-ga-runtime-control-prompts-models/)). Safer pattern for health-adjacent: **flag selects bundle version ID**; fallback config is a local last-good bundle if the flag service is down ([AI Configs best practices](https://launchdarkly.com/docs/tutorials/ai-configs-best-practices)).

### 7.3 Org-scoped staged rollout

```text
internal dogfood orgs → 1 pilot academy → 10% orgs → 50% → all
```

Sticky by `organization_id`. Disable a capability flag per org without global outage ([Agent Patterns kill switch](https://www.agentpatterns.tech/en/governance/kill-switch) — tenant stop).

---

## 8. Incident response for AI systems

### 8.1 Kill switches (must be outside the model)

A prompt saying “stop” is not a kill switch. Enforcement points ([Agent Patterns](https://www.agentpatterns.tech/en/governance/kill-switch), [Claw EA](https://www.clawea.com/controls/kill-switch)):

| Control | Effect |
| --- | --- |
| Global kill | Stop new agent/batch runs |
| Tenant / org kill | Isolate one academy |
| Writes disabled | Read-only / no publish to athletes |
| Tool disable list | Block dangerous tools |
| Model egress deny | Stop calling providers |
| Bundle pin override | Force `last_known_good` |

Checks: O(1), cache TTL ≤ 1–2s, duplicated in runtime **and** tool gateway; audit every activation.

### 8.2 Instant fallbacks

1. Flip `active_bundle` → previous SemVer (or `deterministic_template` mode).  
2. For batch: **suppress delivery** of tonight’s insights; keep draft rows for forensics.  
3. Compensating actions for already-published harmful content: hide/unpublish API, notify coaches, optional athlete notification template. Redeploy alone does not undo published text ([isimplifyme](https://isimplifyme.com/blog/agent-incident-response)).

### 8.3 Batch-specific risk (health-adjacent × hundreds of athletes)

Interactive systems fail one user at a time. A nightly batch can:

- Publish harmful medical-adjacent advice to **the entire roster overnight**  
- Give you **one statistical sample per day** for canary math  
- Delay feedback until morning coach review  

Therefore:

- **Never** default to publish-on-generate for a new bundle.  
- Separate **generate** from **publish**; canary publish is a second gate.  
- Prefer **athlete-subset canaries across nights** over percentage-of-requests.  
- Pre-publish safety scan on 100% of canary outputs (rules + judge).  
- Hold window (e.g. 1–2 hours) for automated + spot human review before fan-out.

Align IR phases with NIST SP 800-61r3 (Apr 2025) adapted for AI: Prepare → Detect/Analyze → Contain/Eradicate/Recover → Post-incident ([AccuroAI](https://accuroai.co/blog/9-second-database-delete-ai-agent-incident-response)).

---

## 9. Designed release process for our platform

### 9.1 Where prompts live and how they are versioned

**Recommendation: Git-native AgentBundles (source of truth) + optional Langfuse mirror.**

| Item | Decision |
| --- | --- |
| Storage | `bundles/<agent>/<semver>/` in the Python monorepo package |
| Versioning | SemVer of the **bundle**; `manifest.yaml` lists hashes of prompts/schemas |
| Review | PR required; prompt/schema diffs reviewed by eng + domain (sports science) for risk_class ≥ `health` |
| Runtime load | Import/load from installed package by version; `ACTIVE_BUNDLE` from env/flag service |
| Observability | Log bundle version on every span; sync metadata to Langfuse for filtering |
| Non-engineer path | Issue / PR template or staging playground that produces a PR — not live hot-edit |
| Escape hatch | Flag override to prior bundle version without redeploying app code (config deploy only) |

Rationale: tool/schema coupling + health auditability + batch determinism outweigh registry iteration speed at our stage. Revisit PromptLayer/Agenta UI if sports scientists need weekly tone edits.

### 9.2 Pre-ship checklist (prompt or model change)

A change ships only if **all** pass:

1. **Bundle completeness** — prompt, model pin, tools, output schema, safety policy updated together; manifest SemVer bumped.  
2. **Static gates** — JSON Schema validate; tool allowlist consistent with prompt; forbidden-claim lint; no floating model aliases in `prod` pin.  
3. **Golden-trace replay (CI)** — trajectory/tool assertions green on pinned fixtures.  
4. **Offline eval suite** — safety hard-gates (no invented physiology, no medical diagnosis language, evidence grounding); quality soft metrics within threshold vs baseline bundle.  
5. **Shadow batch** — candidate vs control on ≥1 prior night of real athlete inputs; judge + structural deltas within bounds.  
6. **Human review** — eng + domain sign-off for `risk_class: health`.  
7. **Rollback plan** — previous bundle version ID recorded; kill-switch owner named; publish suppression tested in staging this month.  
8. **Deprecation check** — model pin not within 30 days of known retirement without migration PR open.

### 9.3 Canary strategy for a nightly batch (one shot per day)

Interactive 1%→5% ramps do not transfer. **Unit of canary = athlete (or org) × night.**

#### Proposed multi-night rollout

| Night | Action | Who is exposed |
| --- | --- | --- |
| **N−1 (preflight)** | Shadow: run candidate on **100%** of athletes; **publish 0%**. Score vs control outputs | Nobody (drafts only) |
| **N0** | Canary **generate + publish** for stratified **5–10%** of athletes (sticky hash). Rest stay on last-good bundle. Hold publish 60–120 min after generate for automated safety scan; spot-check 20 random canary insights | Canary cohort only |
| **N1** | If gates pass: expand to **25–30%** | Expanded cohort |
| **N2** | Expand to **50%** | Half fleet |
| **N3** | **100%** | All |
| **Any night** | Gate fail → auto-suppress canary publish; force `last_known_good`; page on-call | — |

Stratify canary cohort by: org size, language (EN/ES/CA/ZH), data richness (wearables vs not), prior complaint rate — avoid sampling only “easy” athletes.

#### Why this math works

- Shadow night gives full distribution signal without athlete exposure (critical for health-adjacent).  
- 5–10% on night 0 limits blast radius to tens of athletes, not hundreds.  
- Multi-night expansion compensates for **n=1 sample per day**.  
- Hold-before-publish turns the batch into a two-phase commit: generate → verify → deliver.

#### Optional same-night dual generate

For high-risk changes: generate both bundles for canary athletes; publish only control until judge prefers/equals candidate — then flip. Cost ↑; risk ↓.

### 9.4 Kill switch & rollback design

**Controls (feature-flag / Redis / config table — not in the prompt):**

| Flag | Effect | Target RTO |
| --- | --- | --- |
| `ai.batch.kill` | Stop scheduling/starting new batch runs | < 60s |
| `ai.batch.publish` | Allow/deny writing insights to user-visible store | < 60s |
| `ai.active_bundle` | Bundle SemVer for generate | < 60s |
| `ai.fallback_mode` | `bundle` \| `deterministic_templates` \| `off` | < 60s |
| `ai.org_kill.<org_id>` | Per-academy stop | < 60s |
| `ai.tools.allowlist_override` | Empty or reduced tool set | < 60s |

**Rollback path:**

1. Set `ai.batch.publish=false` (stop the bleed).  
2. Set `ai.active_bundle` → last-known-good.  
3. Optionally `ai.fallback_mode=deterministic_templates` for critical cards (readiness copy from rules, not LLM).  
4. Unpublish / hide insights created under bad `bundle_version` (SQL/API by version tag).  
5. Preserve raw traces + drafts for forensics (do not delete).  
6. Page humans; open incident channel.

Drill monthly: staging game day timing kill → suppress → unpublish ([isimplifyme](https://isimplifyme.com/blog/agent-incident-response)).

### 9.5 Monitoring signals & alert thresholds

Baselines = trailing 7 successful nights on the active bundle (or control cohort during canary). Tune after 2 weeks of data; numbers below are **starting points**.

| Signal | Coverage | Warn | Page / auto-suppress publish |
| --- | --- | --- | --- |
| Schema / parse success | 100% | < 99% or −1pp vs baseline | < 97% or −3pp |
| Tool-call error rate | 100% | > 1.5× baseline | > 2× or > 5% absolute |
| Refusal / safety-filter rate | 100% | > +2pp | > +5pp |
| Output length (median tokens) | 100% | > ±25% vs baseline | > ±50% |
| Cost / athlete-night | 100% | > +25% | > +50% |
| Online safety judge fail rate | 100% canary / 10% prod sample | > +2pp | > +3pp or any **critical** medical-claim fail |
| Numeric faithfulness fail | Sampled + canary 100% | > 1% | > 2% or any invented vital |
| Coach / user report rate | Prod | > 2× baseline | Spike > 5× in 24h |
| Golden-set scheduled replay | Daily | Soft metric drop > 3% | Safety hard-gate fail |
| Provider fingerprint / model ID change | 100% | Any unexpected model ID | Unexpected ID in prod |

Canary-specific: compare canary cohort to control cohort **same night**, not only to historical baseline.

### 9.6 Incident runbook outline: “the agent said something harmful”

**Severity:** SEV-1 if medical advice / diagnosis / dangerous training instruction / eating-disorder content / self-harm; SEV-2 if tone/wrong athlete/wrong language; SEV-3 if cosmetic.

#### 0. Detect

- Online judge critical fail, coach report, user report, or schema anomaly cluster.

#### 1. Contain (0–5 min) — do not wait for root cause

1. `ai.batch.publish=false`  
2. `ai.org_kill` for affected orgs if scoped; else global publish kill  
3. `ai.active_bundle` → last-known-good  
4. Freeze further model/prompt deploys  

#### 2. Scope (5–20 min)

1. Query all insights with bad `bundle_version` / time window / judge fail tag  
2. Count athletes/orgs affected; classify harm type  
3. Snapshot traces (prompts, tools, outputs, model IDs) to incident bucket  

#### 3. Remediate user-visible harm (20–60 min)

1. Unpublish / hide affected insights  
2. If SEV-1: notify academy coaches (and legal/compliance if required); use approved messaging — do not auto-DM athletes with more AI text  
3. Replace with deterministic safe placeholder or withhold until human review  

#### 4. Eradicate

1. Identify root cause: bundle change, provider drift, tool data bug, prompt injection, bad retrieved context  
2. Fix via new bundle PR **or** confirm rollback sufficient  
3. Add failing case to golden set + offline safety suite (blocking)  

#### 5. Recover

1. Re-enable publish only after: safety suite green + shadow on affected cohort + explicit SEV owner approval  
2. Canary 5% for one night before full batch  

#### 6. Post-incident (≤ 5 business days)

1. Blameless write-up: timeline, detection gap, blast radius, why gates missed it  
2. Update thresholds / hold window / rubric  
3. Tabletop lesson for on-call  

**Batch appendix:** if the harmful content was generated but **not yet published**, celebrate the hold gate — still open a SEV-2 to learn why generate produced it; do not skip adding the golden case.

---

## 10. Source index

### Prompt management & versioning
- https://www.metacto.com/blogs/prompt-management-tools-comparison  
- https://www.promptlayer.com/blog/promptlayer-vs-langsmith-vs-braintrust-which-llm-ops-platform-to-pick/  
- https://awesomeagents.ai/tools/best-ai-prompt-management-tools-2026/  
- https://dreaming.press/posts/2026-06-26-langfuse-vs-langsmith-vs-braintrust.html  
- https://futurecraft.pro/blog/prompt-engineering-system/  
- https://champlinenterprises.com/blog/prompt-versioning-in-production  
- https://blog.neosage.io/p/the-prompt-lifecycle-every-ai-engineer  
- https://www.promptlayer.com/prompt-management/  
- https://agenta.ai/blog/prompt-versioning-guide  
- https://masterprompting.net/learn/advanced/prompt-versioning-management  
- https://pristren.com/blog/prompt-versioning-guide/  

### Bundles / prompt–schema–tool coupling
- https://arize.com/docs/ax/concepts/prompts/prompt-object  
- https://learnaivisually.com/tracks/agent-engineering/deployment-rollout  
- https://dzone.com/articles/supply-chain-security-for-prompts-and-tools-signal  
- https://isimplifyme.com/blog/agent-incident-response  

### Shadow / canary / A/B
- https://atlan.com/know/ab-testing-llm-applications/  
- https://ai-tldr.dev/learn/production-llmops/testing-deployment/llm-model-upgrade-rollout/  
- https://ai-tldr.dev/learn/production-llmops/testing-deployment/shadow-mode-llm-testing/  
- https://tianpan.co/blog/2026-04-09-llm-gradual-rollout-shadow-canary-ab-testing  
- https://futureagi.com/blog/llm-eval-shadow-traffic-canary-2026/  

### Model pinning & deprecation
- https://platform.claude.com/docs/en/about-claude/model-deprecations  
- https://www.openlegion.ai/en/learn/ai-agent-versioning  
- https://usingclaude.com/en/api/models/claude-api-model-ids-versioning  
- https://ezaiapi.com/blog/ai-model-version-pinning-production  
- https://hidekazu-konishi.com/entry/ai_model_deprecation_and_lifecycle_calendar.html  
- https://privatedevops.com/news/openai-retires-gpt-5-o3-snapshots-december-2026  
- https://therouter.ai/blog/anthropic-model-deprecation-cadence-migration-guide/  
- https://endoflife.date/claude  

### Incidents
- https://openai.com/index/expanding-on-sycophancy/  
- https://techcrunch.com/2025/04/29/openai-explains-why-chatgpt-became-too-sycophantic/  
- https://arstechnica.com/ai/2025/04/openai-rolls-back-update-that-made-chatgpt-a-sycophantic-mess/  
- https://mlops.community/blog/when-prompt-deployment-goes-wrong-mlops-lessons-from-chatgpts-sycophantic-rollback  

### Production monitoring & drift
- https://tianpan.co/blog/2026-05-04-continuous-production-eval-statistical-quality-monitoring-llm-traffic  
- https://venturebeat.com/infrastructure/monitoring-llm-behavior-drift-retries-and-refusal-patterns  
- https://dev.to/tiamatenity/llm-drift-detection-know-when-your-model-stops-behaving-432e  
- https://llmbook.apartsin.com/part-9-llm-evaluation-observability/module-42-evaluation-foundations/section-42.4.html  
- https://doi.org/10.5281/zenodo.17852481  

### Golden traces / snapshot testing
- https://tianpan.co/blog/2026-05-09-snapshot-trace-test-production-regression-suite  
- https://github.com/iamfaham/AgentSnap  
- https://github.com/ioteverythin/TraceOps  
- https://github.com/simukappu/agentverify  

### Config / flags
- https://launchdarkly.com/blog/ai-configs-ga-runtime-control-prompts-models/  
- https://launchdarkly.com/docs/home/agentcontrol/quickstart  
- https://launchdarkly.com/docs/tutorials/ai-configs-best-practices  

### Kill switches & IR
- https://www.agentpatterns.tech/en/governance/kill-switch  
- https://www.clawea.com/controls/kill-switch  
- https://accuroai.co/blog/9-second-database-delete-ai-agent-incident-response  
- https://isimplifyme.com/blog/agent-incident-response  
- https://blog.cyberadvisors.com/agentic-ai-risk-assessment-10-questions-it-leaders-should-ask-before-deployment  

---

## 11. Open questions for implementation planning

1. Which observability backend do we already commit to (Langfuse vs Braintrust vs OTel-only)? Mirror strategy depends on it.  
2. Is publish already separable from generate in the nightly job, or does that need a schema/API change first?  
3. Who is the domain reviewer for `risk_class: health` bundles (named role, not “the team”)?  
4. Do we need EU data residency for prompt/trace storage (pushes hard to Langfuse self-host)?  

---

*End of dossier 73.*
