# 53 — Sandboxed Code Execution for LLM Agents

**Date:** 2026-08-02  
**Scope:** Options, security properties, real pricing, EU/GDPR posture, concrete tool design, and a phased recommendation for a sports-performance multi-agent system (self-hosted Hetzner + Docker + Traefik; EU health-adjacent / GDPR Art. 9 data).

**Context:** Google PHIA-style research shows LLM numeric accuracy on personal health data rises sharply when the model writes and executes code (~22% → ~84%) instead of doing arithmetic in tokens. We want athlete data available as pandas DataFrames inside a sandbox, with a hard guarantee that data cannot leave, plus auditable/reproducible executions.

---

## Executive recommendation (tl;dr)

| Decision | Choice |
|---|---|
| **Recommended sandbox for our threat model + GDPR** | **Self-hosted Docker with `network_mode: none`, cgroup memory/CPU limits, read-only rootfs, seccomp, and preferably gVisor (`runsc`) as the container runtime** on the existing Hetzner host |
| **Managed fallback (if ops budget is preferred over residency control)** | **E2B Pro + shared EU cluster** with `allow_internet_access=False`, or **Modal Sandbox pinned to `eu` / `eu-west` with `block_network=True`** |
| **Do not use for Art. 9 production data** | In-process RestrictedPython alone; Pyodide/Wasm as the sole boundary; US-only managed sandboxes (e.g. Vercel Sandbox `iad1`) |
| **Phased position** | **Phase 0:** fixed metric library (no codegen). **Phase 1:** self-hosted no-network sandbox for exploratory analytics. **Phase 2:** expand allowlisted libs / templates; consider Firecracker only if moving to bare metal |

At a few thousand executions/day and ~10s wall time, managed CPU cost is typically **tens of dollars/month** in usage — but **Pro floors** (E2B $150/mo) and **region multipliers** (Modal) dominate. Self-hosting wins on GDPR and marginal cost given existing Hetzner capacity.

---

## Comparison matrix

| Option | Isolation | Cold start | Cost @ modest volume | Network isolation | Preload DataFrames | EU / GDPR | Ops effort |
|---|---|---|---|---|---|---|---|
| **E2B** | Firecracker microVM | ~80–150 ms | Hobby free+$100 credit; Pro **$150/mo** + ~$0.05/vCPU-hr | `allow_internet_access=False` | Yes (files / code interpreter) | Shared **EU cluster** (Pro+); BYOC/self-host | Low managed / high self-host |
| **Modal Sandboxes** | gVisor | Sub-second (cached) | **$0.00003942/core/s** + mem; **$30/mo free**; region **1.5–1.75×** | `block_network=True` | Yes (custom image + mounts) | `eu` / `eu-west` etc. (inputs still via US control plane — verify) | Low |
| **Daytona** | OCI/Docker (+ Kata/Sysbox options) | **~90 ms** claimed | **$0.0504/vCPU-hr**, **$0.0162/GiB-hr**; **$200** free credits; AGPL self-host | Configurable | Yes | Self-host for residency; managed regions evolving | Low managed / med self-host |
| **Northflank** | microVM (Kata/Firecracker/gVisor) | <1 s | **$0.01667/vCPU-hr**, **$0.00833/GB-hr**; BYOC available | Strong (product focus) | Yes | BYOC in EU VPC | Med |
| **Cloudflare Sandbox** | Containers in VMs + DO | Wake-on-request; snapshots improving | Workers Paid **$5/mo** + active CPU/mem/disk; egress NA/EU **$0.025/GB** | Egress proxy / credential injection | Yes (Python interpreter + files) | **`jurisdiction: eu`** (EEUR/WEUR) | Low–med (TS/Workers-centric) |
| **Vercel Sandbox** | Firecracker | Fast (not published) | Active CPU **$0.128/vCPU-hr**; mem **$0.0212/GB-hr** | Platform controls | Limited Python | **`iad1` only** — poor for EU Art. 9 | Low if already on Vercel |
| **Fly.io Sprites** | Firecracker | ~1–2 s create; ~300 ms checkpoint | **$0.07/CPU-hr**, **$0.04375/GB-hr**; idle free | Configurable | Yes (persistent FS) | Region choice via Fly | Low–med |
| **Self-host Docker (+limits)** | Namespaces/cgroups | ~100–500 ms | Host sunk cost | `network_mode: none` | Excellent | Data stays on Hetzner EU | Med |
| **gVisor** | Userspace kernel | ms–hundreds ms | Host sunk cost | + netns none | Excellent | Same host | Med–high |
| **Firecracker direct** | Hardware microVM | ~125 ms | Host sunk cost (needs KVM) | Full VM NIC control | Excellent | Same host | **High**; Hetzner Cloud often **no nested virt** |
| **nsjail** | Namespaces + seccomp | Tens of ms | Host sunk cost | `clone_newnet` | Good | Same host | Med |
| **Gramine (+SGX)** | Library OS / enclave | Slow cold | High hardware/ops | Enclave model | Awkward for pandas | Hardware-dependent | **Very high** |
| **RestrictedPython / AST** | Language rewrite | ~0 ms | Free | None (same process) | Trivial | Same process = same host | Low code / **unsafe as sole boundary** |
| **Pyodide / Wasm** | Wasm sandbox | 5–10 s first load | Free (compute elsewhere) | Can still `fetch` if JS bridge exposed | pandas/numpy **yes** (Wasm wheels) | Same host | Med; weak vs determined exfil via host bridge |

---

## 1. Managed agent sandboxes

### 1.1 E2B

**Architecture.** E2B runs each sandbox in a **Firecracker microVM** (AWS Lambda–style): dedicated guest kernel, small VMM (~50k LoC Rust lineage), hardware virtualization boundary. Product layers: generic Sandbox SDK + **Code Interpreter** (Jupyter-like `run_code` / stateful REPL).

**SDK (Python sketch):**
```python
from e2b_code_interpreter import Sandbox

sbx = Sandbox.create(allow_internet_access=False, timeout=60)
sbx.files.write("/data/hrv.parquet", parquet_bytes)
result = sbx.run_code("""
import pandas as pd
df = pd.read_parquet('/data/hrv.parquet')
print(df['rmssd'].mean())
""")
sbx.kill()
```

**Cold start.** Same-region ~**80–150 ms** (third-party / vendor-cited); pause/resume available (~4 s/GiB pause, ~1 s resume).

**Pricing (as of 2026, e2b.dev/pricing):**

| Plan | Base | Limits |
|---|---|---|
| Hobby | Free + **$100** one-time credits | 1 h session, 20 concurrent, 10 GiB disk |
| Pro | **$150/mo** + usage | 24 h session, 100 concurrent (buy up to 1,100), 20 GiB |
| Ultimate | Custom | BYOC, custom limits |

Usage (per second while running):

| Resource | Rate |
|---|---|
| 1 vCPU | **$0.000014/s** (~$0.0504/hr) |
| 2 vCPU (default) | **$0.000028/s** |
| Memory | **$0.0000045/GiB/s** (512 MiB–8 GiB) |

**Worked cost (our volume):** 3,000 exec/day × 10 s × (1 vCPU + 1 GiB) ≈  
`3000 × 10 × (0.000014 + 0.0000045) ≈ $0.56/day ≈ $17/mo` usage.  
With Pro for EU: **~$167/mo**. Hobby may cover early usage credits but **EU cluster requires Pro+**.

**Self-hosting.** Apache-2.0 infra; Terraform / Nomad / Consul; Firecracker nodes need nested virt or bare metal. BYOC on AWS/GCP (Azure WIP). Self-host floor often **>$1k/mo** cloud infra — not a cost win at our volume; it is a **control/residency** play. Hetzner Cloud typically **does not expose nested KVM**; bare-metal (Robot) is the realistic Firecracker path.

**EU regions.** Shared **EU cluster for Pro+** — contact support to enable ([EU region FAQ](https://www.e2b.dev/docs/faq/eu-region)). Network can be fully denied via `allow_internet_access=False`.

**Sources:**  
- https://e2b.dev/pricing  
- https://www.e2b.dev/docs/billing  
- https://www.e2b.dev/docs/faq/eu-region  
- https://www.e2b.dev/docs/byoc  
- https://e2b.dev/docs/sandbox/internet-access  
- https://www.agenticwire.news/article/e2b-vs-modal-agent-sandbox-cost-comparison  

---

### 1.2 Modal Sandboxes

**Architecture.** Container sandboxes on **gVisor** (userspace kernel / Sentry). Not a full microVM; strong syscall mediation (~68 host syscalls). Sub-second scheduling on cached images; GPU sandboxes available (not needed here).

**Pricing (modal.com/products/sandboxes, 2026):**

| Resource | Rate |
|---|---|
| Physical core (≈2 vCPU) | **$0.00003942 / core / sec** (min 0.125 cores) |
| Memory | **$0.00000667 / GiB / sec** |
| Free compute | **$30 / month** |

Region pinning: multipliers **1.5×** (broad, e.g. `eu`) / **1.75×** (narrow, e.g. `eu-west`) per Modal region-selection docs. Sandboxes billed `max(request, actual)` per second; default lifetime ~5 min, configurable up to 24 h.

**Worked cost:** 0.5 physical core + 1 GiB for 10 s:  
`(0.5×0.00003942 + 0.00000667)×10 ≈ $0.000264` each → ~**$24/mo** at 3k/day before region multiplier → **~$36–42/mo** in EU. Often fits under free credits at low volume.

**Cold starts.** Sub-second for pre-cached images.

**Network.** Default: outbound open, inbound closed. For us: **`block_network=True`** (mandatory for Art. 9). Also supports CIDR/domain allowlists.

**EU / GDPR caveat.** Compute can pin to `eu` / `eu-west`, but some comparisons note **control-plane / I/O routing via us-east-1**. For Art. 9 special-category data, treat Modal as needing a **DPA + transfer assessment**, not as automatic “data never leaves EU.” Prefer self-host if legal wants zero third-country processing.

**Sources:**  
- https://modal.com/products/sandboxes  
- https://modal.com/docs/guide/sandbox-resources  
- https://modal.com/docs/guide/sandbox-networking  
- https://modal.com/docs/guide/security  
- https://frontend.modal.com/docs/guide/region-selection.md  

---

### 1.3 Daytona

**Positioning (2025–2026).** Pivoted from generic dev environments to **AI agent sandboxes**. Claims **sub-90 ms** creation; OCI/Docker-compatible; snapshots/forking; GPU sandboxes; Computer Use (desktop automation). Open source (**AGPL-3.0**) + managed cloud. Series A (~$24M, early 2026).

**Pricing (daytona.io / secondary reports, 2026):**

| Item | Rate |
|---|---|
| Free credits | **$200** (no CC) |
| vCPU | **$0.0504 / hr** |
| Memory | **$0.0162 / GiB / hr** |
| Storage | **$0.000108 / GiB / hr** (first 5 GiB free) |
| Self-host | Free (AGPL) |
| Startup credits | up to **$50k** |

Default 1 vCPU / 1 GiB ≈ **$0.067/hr** wall-clock. Per-second billing with auto-stop → similar order to E2B usage without the $150 floor.

**EU.** Managed residency less clearly documented than E2B’s EU cluster FAQ; **self-host AGPL** is the GDPR-clean path on Hetzner.

**Sources:**  
- https://www.daytona.io/ (pricing)  
- https://rywalker.com/research/daytona  
- https://makerstack.co/reviews/daytona-review/  

---

### 1.4 Northflank sandboxes

**Architecture.** Secure multi-tenant sandboxes with selectable isolation (**Kata / Firecracker / gVisor**). BYOC into customer VPC (AWS/GCP/Azure/on-prem). Strong fit when sandboxes must sit beside existing DBs/APIs.

**Pricing (northflank.com, Apr 2026 comparisons):**

| Resource | PaaS rate |
|---|---|
| CPU | **$0.01667 / vCPU-hr** |
| RAM | **$0.00833 / GB-hr** |
| Storage | ~**$0.15 / GB-month** |
| H100 | **$2.74/hr** all-in (irrelevant here) |

Cheapest published PaaS CPU among major agent-sandbox vendors; BYOC shifts compute to your cloud bill + management fee.

**EU / GDPR.** BYOC into an **EU VPC / Hetzner-adjacent** design is the compliance story. Verify whether their control plane still sees payloads.

**Sources:**  
- https://northflank.com/pricing  
- https://northflank.com/product/sandboxes  
- https://northflank.com/blog/ai-sandbox-pricing  
- https://northflank.com/blog/best-code-execution-sandbox-for-ai-agents  

---

### 1.5 Cloudflare Sandbox SDK / Workers Containers

**Architecture (GA Apr 2026).** Three layers:

1. **Workers** — app logic / SDK  
2. **Durable Objects** — sticky sandbox identity & lifecycle  
3. **Containers** — isolated Ubuntu Linux; docs describe **VM-based isolation** per sandbox  

SDK: `@cloudflare/sandbox` — `exec`, `writeFile`, persistent **Python/JS/TS code contexts** (Jupyter-like), PTY, preview URLs, filesystem watch, backup/restore; snapshots rolling out. Credential injection via **egress proxy** (agent never sees secrets).

**Pricing (Containers, updated Apr 2026; Sandbox bills on Containers + Workers + DO):**

| Meter | Workers Paid |
|---|---|
| Plan floor | **$5/mo** |
| Memory | 25 GiB-hr included + **$0.0000025 / GiB-s** |
| CPU | 375 vCPU-min included + **$0.000020 / vCPU-s** |
| Disk | 200 GB-hr included + **$0.00000007 / GB-s** |
| Egress NA & Europe | **$0.025/GB** (1 TB included) |

**Active-CPU pricing** — idle wait (e.g. waiting on LLM) does not burn CPU meter. Good for agent loops; less decisive for short pure-pandas jobs.

**EU data handling.** Apr 2026: placement constraints — `jurisdiction: "eu"` → EEUR + WEUR; or explicit `regions: ["WEUR","EEUR"]`. Still audit **R2 snapshots, logs, Workers Logs** for residency.

**Fit for us.** Excellent TypeScript ergonomics; Python via container interpreter. Slightly awkward if the agent runtime is Python-first on Hetzner (extra hop Worker↔origin). Strong if we already use Cloudflare at the edge.

**Sources:**  
- https://developers.cloudflare.com/sandbox/concepts/architecture/  
- https://developers.cloudflare.com/sandbox/platform/pricing/  
- https://developers.cloudflare.com/containers/pricing/  
- https://developers.cloudflare.com/containers/platform-details/placement/  
- https://blog.cloudflare.com/sandbox-ga/  
- https://developers.cloudflare.com/changelog/post/2026-04-13-containers-sandbox-ga/  
- https://developers.cloudflare.com/changelog/post/2026-04-05-regional-placement/  

---

### 1.6 Other 2026 entrants

**Vercel Sandbox** — Firecracker; Active CPU **$0.128/vCPU-hr**, provisioned memory **$0.0212/GB-hr**, creations **$0.60/1M**. **Region: `iad1` only** as of mid-2026 → **reject for EU Art. 9 athlete data**.  
https://vercel.com/docs/sandbox/pricing · https://vercel.com/sandbox  

**Fly.io Sprites** (Jan 2026+) — persistent Firecracker Linux VMs; **$0.07/CPU-hr**, **$0.04375/GB-hr**; no charge when idle; checkpoints ~300 ms. Useful for long-lived agent desktops; heavier than our ephemeral metric jobs.  
https://rywalker.com/research/sprites  

**Blaxel / others** — emerging residency-focused sandboxes; evaluate only if EU microVM + DPA is required and self-host is rejected.

---

## 2. Self-hosted isolation options

Assumption: Hetzner + Docker + Traefik already exist. **Hetzner Cloud VMs often lack nested virtualization (`/dev/kvm`)**; Firecracker/Kata-FC then need **dedicated/Robot bare metal**. gVisor and nsjail work on ordinary VMs.

### 2.1 Plain Docker: resource limits + no network

**Properties.**

| Property | Assessment |
|---|---|
| Startup | ~100–500 ms with warm image |
| Cost | Marginal ≈ electricity; image cache on host |
| Memory | `--memory=1g` / cgroup v2 |
| Network | **`network_mode: none`** — strongest practical anti-exfil |
| Filesystem | Read-only root + tmpfs `/tmp` + bind-mount `/data:ro` |
| Security | **Namespace isolation only** — container escape = host compromise. Sufficient against *accidental* LLM bugs; weaker against sophisticated escapes if prompt injection becomes a full exploit chain |

**Ops effort.** Low–medium (compose service, Traefik internal-only, image rebuild CI). Matches existing stack.

**Verdict.** Minimum viable for our threat model **if** network is off, rootfs RO, no Docker socket mount, no host secrets in env, and results returned only via stdout/JSON file the orchestrator reads.

### 2.2 gVisor (`runsc`)

**Mechanism.** Userspace kernel intercepts syscalls; guest never talks directly to host kernel. Used by GKE Sandbox / Cloud Run; Modal’s managed sandboxes.

| Property | Assessment |
|---|---|
| Isolation | Stronger than plain Docker; weaker than Firecracker hardware boundary |
| Startup | Container-like (ms–hundreds ms) |
| Compatibility | Most of Linux; rare syscall gaps |
| Perf | CPU-bound pandas/numpy usually fine; syscall-heavy I/O slower |
| Ops | Install `runsc`, set Docker runtime; test pandas/numpy/pyarrow |

**Verdict.** **Best upgrade path on Hetzner Cloud** without bare metal. Recommended default hardening for Phase 1.

### 2.3 Firecracker directly

**Mechanism.** KVM microVM + jailer; dedicated kernel; ~125 ms boot; <5 MiB overhead beyond guest.

| Property | Assessment |
|---|---|
| Isolation | Best practical open-source boundary |
| Ops | High: kernels, rootfs images, jailer, networking, pool warmers |
| Hetzner | Prefer **dedicated**; Cloud nested-virt unreliable |

**Verdict.** Overkill at a few thousand short jobs/day unless legal mandates microVM or we already run a Firecracker fleet (E2B self-host / Daytona / custom).

### 2.4 Gramine (library OS / SGX)

Runs unmodified apps in a library OS; with Intel SGX, protects against a malicious host. Poor fit: pandas stack size, enclave memory limits, attestation ops, hardware SKUs. **Not recommended** for this workload.

### 2.5 nsjail

Google’s process jail: namespaces, cgroups, rlimits, **seccomp-bpf (Kafel)**. Used in CTF/code-exec patterns (e.g. Python Discord snekbox; Retool custom code).

| Property | Assessment |
|---|---|
| Startup | Very fast (process spawn) |
| Isolation | Strong process-level; not a separate kernel |
| Network | `clone_newnet` + no lo |
| Ops | Medium: protobuf configs, privileged or user-ns setup |

**Verdict.** Excellent for **ephemeral `python -c` / script** runners inside an already-isolated Docker host (defense in depth: Docker+gVisor outer, nsjail inner — often unnecessary). Good middle ground if avoiding full container-per-exec.

---

## 3. In-process restricted Python

### Why it is generally unsafe against a determined adversary

Python’s object model is reflective. Historical escapes (e.g. **CVE-2023-37271** in RestrictedPython via generator `gi_frame` → stack walk → unrestricted builtins) show that AST allowlists break when any path reaches interpreter internals. `pickle`, C extensions, format-string tricks, and subclass hooks repeatedly defeat “safe eval.”

**Conclusion:** RestrictedPython / homemade AST sandboxes are **not a security boundary** for untrusted users uploading code.

### Our threat model nuance: trusted-ish LLM author

Threats:

1. **Prompt injection** → model emits exfil / filesystem / subprocess code  
2. **Buggy code** → OOM, infinite loops, huge allocations  
3. Not: skilled human crafting novel escapes daily

Projects like **AnswerDotAI/safepyrun** argue RestrictedPython + audit hooks are “safe-ish” for clumsy LLM collaborators: block writes, subprocess, and network by effect.

**Honest assessment for Art. 9 health data:**

| Risk | In-process acceptable? |
|---|---|
| Accidental `rm` / bad write | Mitigated by allowlists / RO data |
| Accidental infinite loop | Needs timeout in another process |
| Prompt-injected `requests.post(attacker, data=df)` | **Fails open** if network libs exist in-process |
| Prompt-injected escape to steal env secrets / other tenants | **Fails open** — same address space as agent |
| Resource exhaustion of agent pod | **Fails open** without cgroups |

**Verdict.** In-process is acceptable only for **non-sensitive scratch math** or behind a second OS sandbox. For athlete DataFrames, **require process/VM isolation + no network**. Do not treat RestrictedPython as sufficient for production health data.

**Sources:**  
- https://github.com/advisories/ghsa-wqc8-x2pr-7jqh  
- https://www.robertxiao.ca/research/cve-2023-37271/  
- https://github.com/AnswerDotAI/safepyrun  
- https://restrictedpython.readthedocs.io/  

---

## 4. WebAssembly / Pyodide

**What works.** Pyodide = CPython → Wasm. **NumPy, pandas, SciPy, Matplotlib, scikit-learn** ship as Wasm wheels. Pure-Python packages via `micropip`. Good numeric fidelity for many analyses.

**Limits.**

- Cold load **5–10 s** typical for full scientific stack  
- No threading/multiprocessing/sockets (native)  
- Memory capped by Wasm linear memory (practical: hundreds of MB–low GB)  
- Security: Wasm isolates from the *host OS*, but if hosted under Node/Workers with a **JS bridge**, code can still **`fetch` / exfil** unless the host strips those APIs  
- Not a multi-tenant kernel boundary against the orchestrator process if poorly wired  

**Verdict.** Attractive for **browser-side** demos; for server-side agent tools, prefer Docker/gVisor. Could be a Phase-1 experiment for tiny frames if the host exposes **zero network JS APIs** and data is injected as bytes only.

**Sources:**  
- https://pyodide.org/  
- https://pyodide.org/en/stable/usage/wasm-constraints.html  
- https://utilitykit.tools/blog/running-python-in-the-browser-pyodide  

---

## 5. Concrete tool design (recommended)

### 5.1 Tool signature

```python
class ExecuteAthleteCodeArgs(BaseModel):
    code: str = Field(..., max_length=20_000, description="Python analysis code; must assign `result`")
    dataset_ids: list[Literal[
        "wearables_daily",
        "hrv_samples",
        "tennis_matches",
        "tennis_shots",
        "training_sessions",
        "readiness"
    ]] = Field(..., min_length=1, max_length=6)
    athlete_id: str  # resolved/authorized by orchestrator, never trusted from model alone
    timeout_s: int = Field(default=15, ge=1, le=30)
    # Optional: seed for any stochastic ops (default none; prefer deterministic)

class ExecuteAthleteCodeResult(BaseModel):
    ok: bool
    result: Any | None          # JSON-serializable only
    stdout: str                 # truncated
    stderr: str                 # truncated
    error_type: str | None
    error_message: str | None
    execution_id: str           # UUID for audit citation
    duration_ms: int
    code_sha256: str
    datasets_loaded: list[str]
    row_counts: dict[str, int]
```

**Agent-facing contract:**

> Write Python that reads preloaded DataFrames from the `data` dict (keys = `dataset_ids`). Assign a JSON-serializable value to `result`. Do not import anything outside the allowlist. No network, no filesystem writes outside `/tmp`.

### 5.2 Data injection

1. **Orchestrator** (trusted) authorizes `athlete_id` / role (coach/parent/player).  
2. Loads only needed columns/rows from ClickHouse/Postgres → **parquet bytes** in memory.  
3. Starts sandbox container with:
   - `network_mode: none`
   - `--memory=1g --cpus=1 --pids-limit=256`
   - read-only rootfs; `tmpfs` size 64–128 MB on `/tmp`
   - bind-mount `/sandbox/data:ro` containing `*.parquet` + `manifest.json`  
4. Entrypoint loads parquet into `data: dict[str, pd.DataFrame]` and execs user code in a fresh process.  
5. Captures `result` via `json.dumps` with a strict encoder (numpy/pandas → Python scalars/lists). Reject non-serializable objects.

**Guarantee data cannot leave:** no NIC; no credentials in env; stdout size-capped (e.g. 64 KB); result payload capped (e.g. 32 KB); no cloud object-store credentials inside sandbox.

### 5.3 Allowlisted libraries

```text
# Always available
pandas
numpy
pyarrow          # parquet only
math, statistics
datetime, zoneinfo
collections, itertools, functools
json, re, decimal
typing

# Explicitly forbidden
requests, httpx, urllib, aiohttp, socket
subprocess, multiprocessing, os.system
pathlib write / open write
pickle, marshal, cloudpickle
ctypes, cffi
```

Optional Phase 2: `scipy.stats`, `sklearn` metrics (preinstalled in image — never `pip install` at runtime).

### 5.4 Limits

| Limit | Value |
|---|---|
| Wall timeout | **15 s** default, **30 s** hard max |
| Memory | **1 GiB** |
| CPU | **1.0** |
| PIDs | **256** |
| stdout/stderr | 64 KiB each |
| `result` JSON | 32 KiB |
| Code length | 20k chars |
| Concurrent sandboxes / host | sized to RAM (e.g. 4–8) |
| Image | pinned digest; rebuild via CI |

### 5.5 Return path to the model

Return structured JSON only (never raw huge tables):

```json
{
  "ok": true,
  "result": {"mean_rmssd": 48.2, "n_days": 28},
  "stdout": "",
  "stderr": "",
  "execution_id": "9f3c…",
  "duration_ms": 412,
  "code_sha256": "sha256:…",
  "datasets_loaded": ["hrv_samples"],
  "row_counts": {"hrv_samples": 28}
}
```

On failure: `ok=false` with `error_type` (`Timeout`, `MemoryError`, `SyntaxError`, `ImportError`, `ResultNotSerializable`, …) and a short message. Model may retry once with fixed code; orchestrator rate-limits retries.

### 5.6 Audit / reproducibility

Persist one row per execution (immutable):

| Field | Purpose |
|---|---|
| `execution_id` | Citation key in insight text |
| `athlete_id`, `actor_user_id`, `conversation_id` | Who/why |
| `code` + `code_sha256` | Exact program |
| `dataset_ids` + `query_fingerprint` + `row_counts` + `data_sha256` | Input snapshot identity |
| `image_digest` | Runtime reproducibility |
| `started_at`, `duration_ms`, `exit_status` | Ops |
| `result_json`, `stdout`, `stderr` | Output |
| `model_id`, `tool_call_id` | LLM provenance |

Insight citation format:  
`Computed by execution_id=9f3c… (code_sha256=ab12…, data_sha256=cd34…).`

Optional: store parquet snapshot in encrypted EU object storage for full replay (retention policy TBD; default **30–90 days**).

### 5.7 Reference runner (Docker Compose sketch)

```yaml
# internal only — not published via Traefik public entrypoint
services:
  athlete-code-sandbox:
    image: registry.example/ppd-athlete-sandbox@sha256:…
    runtime: runsc   # gVisor when available
    network_mode: none
    read_only: true
    mem_limit: 1g
    cpus: 1
    pids_limit: 256
    security_opt:
      - no-new-privileges:true
    tmpfs:
      - /tmp:size=128m,mode=1777
    # orchestrator copies data in via docker create/cp or a short-lived volume
```

Orchestrator never shares the Docker socket with the model.

---

## 6. Alternative: fixed metric library (no codegen)

### Design

Ship a versioned Python package of deterministic functions, e.g.:

```python
metrics.hrv.rmssd_trend(df, window_days=28) -> MetricResult
metrics.tennis.serve_speed_p95(df) -> MetricResult
```

The LLM **selects tools + parameters**; it never authors Python. Each function returns `{value, unit, n, method_id, version}`.

### Comparison

| Dimension | Sandboxed codegen | Fixed metrics |
|---|---|---|
| **Safety** | Good with no-net + cgroups; residual escape risk | **Best** — no arbitrary code |
| **Exfil risk** | Low if network denied | Lowest |
| **Cost** | Sandbox CPU + image ops | Negligible |
| **Capability** | High — novel slices, joins, ad-hoc plots-as-numbers | Bounded to catalog |
| **Numeric accuracy** | PHIA-style gains for open-ended Qs | Excellent for covered Qs; fails outside catalog |
| **Auditability** | Store code + data hash | Store `method_id@version` + params — simplest |
| **Maintenance** | Image + allowlist + abuse monitoring | Growing catalog + tests per metric |
| **Latency** | Cold start + exec (0.2–2 s typical) | In-process ms |

### Phased position (recommended)

| Phase | What | When |
|---|---|---|
| **Phase 0 — Ship now** | Fixed metric library for readiness, HRV trends, tennis aggregates, training load. Agent calls typed tools only. | MVP |
| **Phase 1 — Sandbox for exploration** | Self-hosted gVisor/Docker no-network tool for questions not covered by Phase 0. Log every execution. Cap concurrency. | After metric catalog covers ~80% of production questions |
| **Phase 2 — Harden / scale** | Warm pool; stricter result schemas; optional E2B EU or Daytona self-host if multi-tenant density needs microVMs; never send Art. 9 payloads to US-only regions | Scale / compliance review |

**Why not sandbox-first?** At modest volume the capability win is real, but Art. 9 + prompt-injection exfil makes a **no-network OS sandbox** mandatory before codegen touches production athlete frames. A fixed library delivers safer PHIA-like accuracy for the common path without inventing a code-execution product on day one.

**Why not skip sandbox forever?** Coaches ask long-tail questions (“HRV on days after 3+ hour clay matches when sleep < 7h”). Catalog maintenance will lag. Phase 1 sandbox is the escape hatch that preserves auditability.

---

## 7. Cost sketch (3,000 exec/day × 10 s × 1 vCPU × 1 GiB)

| Backend | Approx monthly |
|---|---|
| E2B Hobby usage only | ~$17 (then credits); EU needs Pro |
| E2B Pro + EU | **~$167** ($150 + usage) |
| Modal EU (~1.5×) | **~$35–45** (often ≤ $30 free at lower volume) |
| Daytona managed | ~$17–25 usage |
| Northflank PaaS | ~$5–10 usage (cheapest metered CPU) |
| Cloudflare | Often within $5 Workers Paid allotment at this duty cycle |
| Self-host Hetzner | **~$0 incremental** (capacity already paid) |

---

## 8. Final recommendation for Peak Performance Data

1. **Do not** put athlete DataFrames into US-only sandboxes (Vercel `iad1`) or any managed sandbox with open egress.  
2. **Prefer self-hosted Docker + `network_mode: none` + gVisor** on the existing EU Hetzner box — aligns with GDPR Art. 9, threat model (prompt-injection exfil + resource exhaustion), modest volume, and current ops.  
3. **Phase 0 fixed metrics** for production insights; **Phase 1 sandbox tool** for exploratory analytics with full audit rows and insight citations via `execution_id`.  
4. Keep **E2B Pro EU** or **Modal `eu` + `block_network`** as a managed escape hatch only after legal signs off on subprocessors / transfer; Daytona/Northflank BYOC are alternatives if we outgrow DIY orchestration.  
5. Treat RestrictedPython/Pyodide as **dev aids or extra filters**, never the sole boundary for health-adjacent frames.

---

## Source index

| Topic | URL |
|---|---|
| E2B pricing | https://e2b.dev/pricing |
| E2B billing | https://www.e2b.dev/docs/billing |
| E2B EU region | https://www.e2b.dev/docs/faq/eu-region |
| E2B BYOC | https://www.e2b.dev/docs/byoc |
| E2B network | https://e2b.dev/docs/sandbox/internet-access |
| E2B vs Modal costs | https://www.agenticwire.news/article/e2b-vs-modal-agent-sandbox-cost-comparison |
| Modal sandboxes | https://modal.com/products/sandboxes |
| Modal sandbox resources | https://modal.com/docs/guide/sandbox-resources |
| Modal networking | https://modal.com/docs/guide/sandbox-networking |
| Modal security | https://modal.com/docs/guide/security |
| Daytona research | https://rywalker.com/research/daytona |
| Northflank pricing | https://northflank.com/pricing |
| Northflank sandbox comparison | https://northflank.com/blog/best-code-execution-sandbox-for-ai-agents |
| Cloudflare Sandbox architecture | https://developers.cloudflare.com/sandbox/concepts/architecture/ |
| Cloudflare Containers pricing | https://developers.cloudflare.com/containers/pricing/ |
| Cloudflare placement / EU | https://developers.cloudflare.com/containers/platform-details/placement/ |
| Cloudflare Sandbox GA | https://blog.cloudflare.com/sandbox-ga/ |
| Vercel Sandbox pricing | https://vercel.com/docs/sandbox/pricing |
| gVisor vs Firecracker | https://northflank.com/blog/firecracker-vs-gvisor |
| nsjail | https://github.com/google/nsjail |
| RestrictedPython CVE | https://github.com/advisories/ghsa-wqc8-x2pr-7jqh |
| safepyrun threat model | https://github.com/AnswerDotAI/safepyrun |
| Pyodide | https://pyodide.org/ |
| Pyodide constraints | https://pyodide.org/en/stable/usage/wasm-constraints.html |
| AI sandbox residency (industry) | https://blaxel.ai/blog/ai-sandbox-data-residency-controls-regulated-industries |

---

*Pricing and region features move quickly; re-verify vendor pages before contracting. Legal review required before any third-party subprocesses GDPR Art. 9 athlete data.*
