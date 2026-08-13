# 48 — Model Context Protocol: Current State, Architecture, and Security

**Research date:** 2026-08-02  
**Scope:** Whether Peak Performance should structure its internal multi-agent tool layer around MCP, expose a public/partner MCP server, and/or consume third-party MCP servers.  
**Method:** Official specification and SDK docs via web fetch; security research and ecosystem guidance from 2025–2026 sources. No local codebase exploration.

---

## 1. Current specification revision

**Current MCP specification revision: `2026-07-28`.**

- Spec index: https://modelcontextprotocol.io/specification/2026-07-28  
- Changelog vs previous revision `2025-11-25`: https://modelcontextprotocol.io/specification/2026-07-28/changelog  
- Release announcement: https://blog.modelcontextprotocol.io/posts/2026-07-28/

### 1.1 Revision timeline (2025–2026)

| Revision | Role |
|---|---|
| `2025-03-26` | Introduced remote HTTP patterns; HTTP+SSE began deprecation path |
| `2025-06-18` | Authorization solidification (OAuth 2.1, PRM, resource indicators) |
| `2025-11-25` | Previous stable; Streamable HTTP with sessions; elicitation/tasks evolution |
| **`2026-07-28`** | **Current stable — largest revision since launch; stateless core** |

### 1.2 What changed in `2026-07-28` (high signal)

1. **Stateless protocol core** — Removed `initialize` / `notifications/initialized` handshake. Every request carries protocol version, client capabilities, and (SHOULD) client identity in `_meta`. New optional `server/discover` RPC for capability probing (SEP-2575).
2. **No protocol-level sessions** — Removed `Mcp-Session-Id`. Cross-call state uses explicit server-minted handles passed as ordinary tool arguments (SEP-2567).
3. **Multi Round-Trip Requests (MRTR)** — Replaces server-initiated `elicitation/create`, `sampling/createMessage`, and `roots/list` over held-open streams. Server returns `resultType: "input_required"`; client retries with `inputResponses` (SEP-2322).
4. **Header-based routing** — Streamable HTTP POSTs require `Mcp-Method` and `Mcp-Name` (SEP-2243).
5. **Cacheable lists** — `tools/list`, `prompts/list`, `resources/list`, `resources/read` carry `ttlMs` and `cacheScope` (SEP-2549). Deterministic tool order recommended for prompt-cache stability.
6. **Subscriptions** — HTTP GET stream and `resources/subscribe` replaced by `subscriptions/listen` (opt-in long-lived POST response).
7. **Tasks** — Moved out of core into extension `io.modelcontextprotocol/tasks`.
8. **Auth hardening** — RFC 9207 `iss` validation; DCR formally deprecated in favor of Client ID Metadata Documents (CIMD); client credentials bound to issuer.
9. **Deprecations (12-month minimum window)** — Roots, Sampling, Logging; HTTP+SSE transport; DCR as preferred registration mechanism.

### 1.3 Transports — what is current

| Transport | Status (as of 2026-07-28) |
|---|---|
| **stdio** | **Current** — local subprocess; credentials from environment; no OAuth transport flow |
| **Streamable HTTP** | **Current** — primary remote transport; now fully request/response / stateless at protocol layer |
| **HTTP+SSE** (legacy dual-endpoint) | **Deprecated** since `2025-03-26`; reclassified under feature lifecycle in `2026-07-28`. Migrate to Streamable HTTP |

Sources:  
https://modelcontextprotocol.io/specification/2026-07-28/changelog  
https://modelcontextprotocol.io/specification/2026-07-28/basic/transports/streamable-http  
https://blog.modelcontextprotocol.io/posts/2026-07-28/

---

## 2. Core concepts

MCP uses JSON-RPC 2.0 between **Hosts** (LLM apps), **Clients** (connectors in the host), and **Servers** (context/capability providers).

### 2.1 Tools

Model-controlled callable functions. Discovered via `tools/list`, invoked via `tools/call`. Each tool has `name`, `description`, `inputSchema` (JSON Schema), optional `outputSchema`, `title`, `icons`, and `annotations`.

- Spec **SHOULD** keep a human in the loop with ability to deny invocations.
- Tool annotations **MUST** be treated as untrusted unless the server is trusted.
- Servers **SHOULD** return tools in deterministic order.
- Tool sets **MAY** vary by authorization (scopes) but **MUST NOT** vary by connection/session state.

Source: https://modelcontextprotocol.io/specification/2026-07-28/server/tools

### 2.2 Resources

Application-driven context (files, schemas, domain data) identified by URI. Methods: `resources/list`, `resources/read`, `resources/templates/list`. Change notifications via `subscriptions/listen` + `resourceSubscriptions`.

Source: https://modelcontextprotocol.io/specification/2026-07-28/server/resources

### 2.3 Prompts

Server-provided prompt templates / workflows the host can offer to users (slash-commands style). Listed via `prompts/list`, retrieved via `prompts/get`. Same list-caching and `listChanged` patterns as tools/resources.

### 2.4 Sampling (deprecated)

Previously allowed servers to request LLM completions from the host (`sampling/createMessage`). **Deprecated in `2026-07-28`** — new implementations should call LLM provider APIs directly. Still functional during the ≥12-month deprecation window; under MRTR if still used.

### 2.5 Roots (deprecated)

Previously let servers discover filesystem/workspace roots the client allows. **Deprecated in `2026-07-28`** — prefer tool parameters, resource URIs, or server configuration.

### 2.6 Elicitation (critical for human-in-the-loop)

Elicitation lets a **server ask the user for input mid-operation**, while the **client** owns the UI and consent.

**Modes:**
- **Form mode** — structured data via restricted flat JSON Schema (primitives only). Data returns through the MCP client. **MUST NOT** be used for passwords, API keys, tokens, or payment credentials.
- **URL mode** — redirect user to an external URL for sensitive flows; secrets never pass through the MCP client. Client **MUST** show target domain and get consent before navigation.

**Wire pattern under `2026-07-28` (MRTR):**
1. Client calls `tools/call` (or `resources/read`, etc.).
2. Server cannot finish — returns `resultType: "input_required"` with `inputRequests` containing an `elicitation/create` request (and optional `requestState`).
3. Client presents UI; user accepts/declines.
4. Client **retries the original method** with `inputResponses` (+ `requestState` if provided). New JSON-RPC `id` required.
5. Server completes with `resultType: "complete"`.

This maps cleanly to our need for **human approval before high-risk tool actions** (e.g., write training plans, export PHI-adjacent biomarker/genetics data, mutate schedules): the tool handler returns `input_required` with a form elicitation (“Approve export of athlete X CGM last 7 days?”), the product UI collects consent outside the model’s control, then the call retries.

Clients declare capability in `_meta.io.modelcontextprotocol/clientCapabilities.elicitation` (`form` and/or `url`).

Source: https://modelcontextprotocol.io/specification/2026-07-28/client/elicitation  
MRTR: https://modelcontextprotocol.io/specification/2026-07-28/basic/patterns/mrtr

---

## 3. Authorization specification

Authorization is **OPTIONAL** at the protocol level, but HTTP remote servers are strongly expected to implement it. STDIO servers **SHOULD NOT** use the OAuth HTTP flow; they take credentials from the environment.

**Authoritative docs:**  
https://modelcontextprotocol.io/specification/2026-07-28/basic/authorization  
https://modelcontextprotocol.io/specification/2026-07-28/basic/authorization/security-considerations  
Tutorial: https://modelcontextprotocol.io/docs/2026-07-28/tutorials/security/authorization

### 3.1 Roles

| Role | OAuth mapping |
|---|---|
| MCP server | OAuth 2.1 **resource server** |
| MCP client | OAuth 2.1 **client** |
| Authorization server | Issues tokens (co-located or separate IdP) |

### 3.2 What a compliant HTTP MCP server must implement

1. **OAuth 2.1** — PKCE (`S256` when capable) for public clients; short-lived access tokens; secure token storage practices.
2. **Protected Resource Metadata (RFC 9728) — MUST** — Serve PRM documenting at least one `authorization_servers` entry. On `401`, return `WWW-Authenticate` with `resource_metadata` (and ideally `scope`).
3. **Resource Indicators (RFC 8707) — clients MUST send `resource`** — Tokens must be audience-bound to the MCP server’s canonical URI. Servers **MUST** reject tokens not issued for themselves (**no token passthrough**).
4. **Authorization Server Metadata** — AS provides RFC 8414 and/or OIDC Discovery; clients MUST support both.
5. **Client registration** — Prefer **Client ID Metadata Documents (CIMD)**; DCR (RFC 7591) is **deprecated** but MAY remain for backward compatibility; pre-registration always allowed.
6. **RFC 9207 issuer validation** — AS SHOULD return `iss`; clients MUST validate when present / when advertised.
7. **Least-privilege scopes** — Prefer per-capability scopes; support step-up authorization via `WWW-Authenticate` `scope` challenges.
8. **Use battle-tested libraries** — Do not hand-roll JWT validation.

### 3.3 Flow (condensed)

Unauthenticated request → `401` + PRM URL → fetch PRM → discover AS metadata → register/obtain client_id (CIMD / pre-reg / DCR) → authorization code + PKCE + `resource` → token → Bearer calls to MCP endpoint.

---

## 4. Python SDK landscape: official SDK vs FastMCP

### 4.1 Relationship (the confusion, resolved)

| Artifact | What it is |
|---|---|
| **Official MCP Python SDK** (`pip install mcp`) | Spec-faithful Tier-1 SDK. v2.0.0 supports `2026-07-28` and older revisions from one server. High-level class renamed: **`FastMCP` → `MCPServer`** (`from mcp.server import MCPServer`). Maintained at https://github.com/modelcontextprotocol/python-sdk — docs: https://py.sdk.modelcontextprotocol.io/ |
| **Standalone FastMCP** (`pip install fastmcp`, Prefect / Jeremiah Lowin) | Separate production framework that **builds on** the official SDK. Decorator DX plus composition, middleware, auth providers, proxying, clients, testing. Docs: https://gofastmcp.com/ — FastMCP 1.0 was absorbed into the official SDK in 2024; FastMCP 2+/4.x continued independently and is **not** the same object as SDK `MCPServer`. |

**Practical rule:**  
- Need protocol correctness / thin embedding → **official `MCPServer`**.  
- Need production MCP product surface (auth plugins, gateways, tool transforms) → **standalone FastMCP** (still depends on SDK v2).  
- Do **not** import `mcp.server.fastmcp` on SDK v2 — that path is gone.

Sources:  
https://github.com/modelcontextprotocol/python-sdk/releases/tag/v2.0.0  
https://gofastmcp.com/getting-started/welcome  
https://gofastmcp.com/getting-started/upgrading/from-mcp-sdk-v2

### 4.2 Defining tools (official SDK)

```python
from mcp.server import MCPServer

mcp = MCPServer("PPD Tools")

@mcp.tool()
def get_hrv_trend(athlete_id: str, days: int = 14) -> dict:
    """Return HRV trend summary for an athlete."""
    return {"athlete_id": athlete_id, "days": days, "trend": "stable"}
```

Type hints → JSON Schema; docstring → description; return value serialized. Same pattern for `@mcp.resource()` and `@mcp.prompt()`.

### 4.3 Mounting inside an existing FastAPI / Starlette app

Official pattern (`streamable_http_app`):

```python
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager
from fastapi import FastAPI
from mcp.server import MCPServer

mcp = MCPServer("PPD")

@mcp.tool()
def ping() -> str:
    """Health ping."""
    return "ok"

mcp_asgi = mcp.streamable_http_app()  # creates session_manager

@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncIterator[None]:
    async with mcp.session_manager.run():
        yield

app = FastAPI(lifespan=lifespan)
app.mount("/", mcp_asgi)  # endpoint at /mcp by default
```

**Critical:** Mounted sub-app lifespans do not run. Host **must** enter `mcp.session_manager.run()`. Production hostnames need `TransportSecuritySettings` allowlists (default is localhost-only DNS-rebinding protection).

Standalone FastMCP equivalent: `mcp.http_app()` + pass lifespan into FastAPI, then `app.mount(...)`.

Sources:  
https://py.sdk.modelcontextprotocol.io/run/asgi/  
https://gofastmcp.com/v2/integrations/fastapi

---

## 5. Tool result structure

From https://modelcontextprotocol.io/specification/2026-07-28/server/tools:

### 5.1 Unstructured `content` (array of blocks)

- `text` — string  
- `image` / `audio` — base64 + mimeType  
- `resource_link` — URI (+ name/description/mimeType); client may fetch/subscribe later; **not required** to appear in `resources/list`  
- `resource` — embedded resource payload  

Blocks may carry annotations: `audience`, `priority`, `lastModified`.

### 5.2 Structured content + output schemas

- Optional `outputSchema` on the tool definition (JSON Schema 2020-12 keywords allowed as of SEP-2106).  
- Result field `structuredContent`: any JSON value conforming to `outputSchema`.  
- Servers **MUST** conform when schema present; clients **SHOULD** validate.  
- For compatibility, also return serialized JSON in a `text` content block.  
- `structuredContent` is **server result data**, unrelated to LLM “structured outputs.”  
- Errors: successful JSON-RPC with `isError: true` (not a transport failure).

### 5.3 MRTR result typing

Every result has required `resultType`: `"complete"` | `"input_required"`. Older servers omitting the field are treated as `"complete"`.

---

## 6. Security — attack classes, official guidance, disclosures

### 6.1 Official Security Best Practices

**Document:** https://modelcontextprotocol.io/specification/2026-07-28/basic/security_best_practices  
(also mirrored under docs tutorials paths)

Documented attack classes and mitigations:

| Attack | Summary | Mitigation (official) |
|---|---|---|
| **Confused deputy** | MCP proxy with static third-party client_id + dynamic clients + sticky consent cookies skips consent | Per-client MCP-level consent **before** third-party auth; bind consent to `client_id`; exact `redirect_uri`; CSRF/`state` only after consent |
| **Token passthrough** | Accepting/forwarding tokens not audience-bound to this MCP server | **MUST NOT** accept tokens not issued for this server; validate `aud`/`resource` |
| **SSRF** | Malicious PRM/AS metadata URLs hit internal IPs / cloud metadata | HTTPS; block private ranges; validate redirects; egress proxies |
| **State handle hijacking** (replaces classic session hijacking post-`2026-07-28`) | Guessed/stolen server-minted handles used as if authenticated | Never treat handle as auth; bind handle to verified user; unguessable IDs; expiry |
| **Local server compromise** | Malicious stdio startup commands / packages | Full command disclosure + consent; sandbox; prefer stdio isolation |
| **OAuth URL injection** | `javascript:` / shell-injected authorization URLs | Allow only http(s); never shell-open URLs; CSP |
| **Scope minimization failures** | Over-broad scopes | Least privilege; step-up; don’t dump all scopes by default |
| **CIMD / mix-up** | Issuer confusion, credential reuse across AS | RFC 9207 `iss`; bind credentials to issuer; validate metadata `issuer` |

**Session hijacking (legacy):** On `2025-11-25` and earlier, `Mcp-Session-Id` theft was a first-class concern. On `2026-07-28`, protocol sessions are gone; the analogous risk is **state handle hijacking**.

### 6.2 Prompt injection / tool poisoning / rug pulls (ecosystem + research)

These are **architectural LLM trust issues**, not simple CVEs in the JSON-RPC framing:

1. **Prompt injection via tool descriptions** — Malicious instructions in `description` / schema docs are ingested by the model but often invisible in UI (Invariant Labs “Tool Poisoning,” Apr 2025; Microsoft guidance on indirect injection + rug pulls).  
   - https://invariantlabs.ai/blog/mcp-security-notification-tool-poisoning-attacks  
   - https://developer.microsoft.com/blog/protecting-against-indirect-injection-attacks-mcp  
   - OWASP community page: https://github.com/OWASP/www-community/blob/master/pages/attacks/MCP_Tool_Poisoning.md  

2. **Prompt injection via tool results** — Untrusted retrieved content (issues, notes, wearables free-text) instructs the model to call privileged tools. Classic example: **GitHub MCP toxic agent flow** (Invariant Labs) — malicious public issue → agent leaks private repo data via legitimate tools.  
   - https://invariantlabs.ai/blog/mcp-github-vulnerability  

3. **Rug-pull tool redefinition** — User approves a benign tool; server later changes description/behavior (`listChanged`). Mitigate with **hash pinning** of name+description+schemas; quarantine on drift; require re-consent.

4. **Cross-server tool shadowing** — Malicious server tools with similar names/descriptions steer the model away from trusted tools when multiple servers share context.

### 6.3 Notable 2025–2026 vulnerability disclosures

| Item | Notes | Source |
|---|---|---|
| Invariant tool poisoning (2025) | Metadata injection class | invariantlabs.ai |
| GitHub MCP toxic flow (2025) | Untrusted content + over-scoped PAT | invariantlabs.ai/blog/mcp-github-vulnerability |
| CVE-2025-49596 MCP Inspector | High; patched | CSA research note May 2026 |
| CVE-2025-54136 Cursor “MCPoison” | High; patched v1.3 | CSA / NVD ecosystem tracking |
| OX Security STDIO / supply-chain research (2026) | Architectural command-execution exposure via stdio adapters across SDKs; Anthropic characterized as expected/default; many downstream CVEs (e.g. CVE-2026-30623 LiteLLM critical) | https://www.ox.security/blog/the-mother-of-all-ai-supply-chains-critical-systemic-vulnerability-at-the-core-of-the-mcp/ — VentureBeat coverage May 2026 |
| CVE-2026-33032 nginx-ui MCP | Unauthenticated command execution via MCP endpoint | authzed timeline |
| CSA “MCP Security Crisis” note (2026-05-04) | Aggregates ≥7 high/critical CVEs across Inspector, LiteLLM, Cursor, LibreChat, Windsurf, etc. | https://labs.cloudsecurityalliance.org/research/csa-research-note-mcp-security-crisis-20260504-csa-styled/ |

**Takeaway for us:** First-party in-process tools avoid remote MCP supply-chain risk. The residual risk that **always** remains is **model-mediated misuse** of tools (injection via data or metadata) — must be mitigated with server-side authz, allowlists, output schemas, and HITL — not system prompts alone.

---

## 7. Performance: token cost of large tool catalogs

With **60–120 tools**, naive “inject every schema every turn” is expensive and accuracy-degrading.

### 7.1 Magnitude

Ecosystem measurements (Claude Code / MCP Tool Search reporting, Jan 2026):

- ~5 common MCP servers / ~58 tools ≈ **~55k tokens** of definitions before the user speaks  
- Extreme cases reported ~**134k** tokens  
- Progressive/search loading reported reductions of **~95–99%** initial tool tokens  

Sources:  
https://kuanhaohuang.com/mcp-tool-search-claude-code/  
https://thenewstack.io/how-to-reduce-mcp-token-bloat/

### 7.2 Official client best practices (`2026-07-28` docs)

https://modelcontextprotocol.io/docs/2026-07-28/develop/clients/client-best-practices

**Progressive discovery (recommended when tools occupy ~1–5%+ of context):**
1. Host still fetches `tools/list`, but does **not** dump all schemas into the model.  
2. Expose meta-tools: `search_tools` → short names/descriptions; `get_tool_details` → full schema.  
3. Execute only loaded tools.  
4. Strategies: keyword (BM25), embeddings, subagent, hybrid; or provider-native tool search (Anthropic Tool Search, OpenAI tool search).  
5. Cache definitions host-side; honor `ttlMs` / `cacheScope` and `list_changed`.  
6. Watch **prompt-cache invalidation** when mutating the tools array mid-conversation — prefer append-only or a stable `call_tool({name, args})` meta-tool.

**Programmatic tool calling / code mode:** Model writes sandboxed code that calls typed stubs; intermediate data stays out of the LLM context; only summaries return. Requires broker authz per call.

**Rule of thumb from practitioners:** keep ~**10–15 tools** visible to the model at once (The New Stack / Posta).

### 7.3 Implication for PPD (60–120 first-party tools)

We should **not** expose the full catalog to every agent turn. Domain routers / specialist agents / search_tools over an internal registry are mandatory regardless of whether the wire format is MCP.

---

## 8. Decision answers for Peak Performance

### Q1 — Should the internal tool layer be MCP servers, or plain Python with an MCP adapter later?

**Recommendation: Plain Python tool functions + a thin registry now; optional MCP adapter later (not MCP-as-internal-IPC).**

**Reasoning:**
1. All tools are **first-party and in-process**. MCP’s value (transport interoperability, OAuth resource-server posture, third-party client discovery) does not pay for itself on every internal call.  
2. MCP adds **JSON-RPC serialization, schema wrapping, content-block envelopes, and capability negotiation** even when client and server share an address space — latency and complexity without a consumer that needs the protocol.  
3. Our real problems — **authz against Supabase roles, ClickHouse tenancy, HITL approvals, tool filtering for 60–120 tools** — live in application code either way. Elicitation/MRTR is a useful *pattern*; we can implement approval gates in-process today and map them to MCP elicitation if we expose MCP later.  
4. Keep tool definitions **MCP-shaped** (name, description, JSON Schema in/out, annotations, deterministic ordering) so an adapter can wrap `@registry.tool` → `MCPServer.tool` without rewrites.  
5. Prefer **in-memory SDK Client↔Server** only for integration tests of the adapter — not as the hot path for production agent loops.

**When to promote a domain to a real MCP server early:** if a separate service boundary already exists (e.g., tennis analytics microservice) and multiple hosts must call it over HTTP.

### Q2 — Should we expose a public/partner MCP server?

**Recommendation: Not as a broad public server initially. Consider a tightly scoped partner MCP later (coach/clinic integrations), behind full OAuth and a curated tool subset.**

**If/when we expose one, required posture:**
1. **Streamable HTTP** only (`2026-07-28`), not legacy SSE.  
2. **OAuth 2.1 resource server**: PRM (RFC 9728), audience-bound tokens (RFC 8707), PKCE, CIMD or pre-registered clients (avoid open DCR), RFC 9207 `iss` checks.  
3. **Scopes mapped to product roles** (coach vs athlete vs parent) and **per-athlete authorization** enforced in every tool — never “token valid ⇒ all athletes.”  
4. **Curated surface** — expose ~10–20 read-mostly tools (readiness, training summaries, tennis match digests), not genetics write paths or raw CGM dumps by default.  
5. **Elicitation / HITL** for exports and any mutation; URL-mode for connecting wearables/secrets.  
6. **Rate limits, audit logs, egress controls**, deterministic tool lists, `outputSchema` + structuredContent for machine clients.  
7. **Gateway** (WAF routing on `Mcp-Method`/`Mcp-Name`, abuse detection).  
8. Legal/compliance: treat MCP as another API surface for PHI-adjacent sports/health data — same BAA/DPA constraints as REST.

**Do not** expose an unauthenticated or API-key-only MCP on the public internet.

### Q3 — Should our agent consume third-party MCP servers?

**Recommendation: Default no. Allow only a hard allowlist of vetted servers under a strict security posture; never mix untrusted MCP servers into the same tool context as privileged first-party health tools.**

**If we do consume any third-party MCP:**
1. **Allowlist** servers by origin + package hash; no user-driven arbitrary MCP install in production.  
2. **Pin tool metadata** (hash name/description/schemas); quarantine on `list_changed` drift; require re-approval.  
3. **Isolate contexts** — separate agent/tool sandbox from first-party privileged tools (no cross-server data flow unless broker-mediated and reviewed).  
4. **Treat all tool results as untrusted** — structured schema validation; never let retrieved text authorize actions; server-side authz on our tools ignores model instructions.  
5. **Least-privilege credentials** to the third party; no token passthrough into our APIs.  
6. **SSRF protections** on any OAuth discovery our client performs.  
7. **stdio third-party servers** — treat as code execution: sandbox, consent, no production use of unvetted npx/pip packages (OX Security 2026 findings).  
8. Prefer **vendor REST/official SDKs** we control over community MCP wrappers for anything touching athlete identity.

For a sports-performance platform with wearables, biomarkers, genetics, and CGM, the blast radius of a toxic agent flow is unacceptable without isolation — GitHub-style injection demos apply equally to “malicious note in a training log” or “poisoned third-party nutrition MCP.”

---

## 9. Recommended architecture sketch for PPD

```
┌─────────────────────────────────────────────────────────┐
│  Agent host (Python)                                    │
│  - progressive tool search / specialist routing         │
│  - HITL approval service (elicitation-compatible API)   │
└───────────────────┬─────────────────────────────────────┘
                    │ in-process calls
┌───────────────────▼─────────────────────────────────────┐
│  Tool registry (plain Python)                           │
│  - 60–120 first-party tools                             │
│  - JSON Schema in/out, authz hooks, output validation   │
└─────────┬───────────────────────────────┬───────────────┘
          │                               │ optional adapter
          ▼                               ▼
   Supabase / ClickHouse /         MCPServer / FastMCP
   domain services                 Streamable HTTP + OAuth
                                   (partner subset only)
```

---

## 10. Source index

### Official MCP
- Spec `2026-07-28`: https://modelcontextprotocol.io/specification/2026-07-28  
- Changelog: https://modelcontextprotocol.io/specification/2026-07-28/changelog  
- Blog release: https://blog.modelcontextprotocol.io/posts/2026-07-28/  
- Tools: https://modelcontextprotocol.io/specification/2026-07-28/server/tools  
- Resources: https://modelcontextprotocol.io/specification/2026-07-28/server/resources  
- Elicitation: https://modelcontextprotocol.io/specification/2026-07-28/client/elicitation  
- Authorization: https://modelcontextprotocol.io/specification/2026-07-28/basic/authorization  
- Auth security considerations: https://modelcontextprotocol.io/specification/2026-07-28/basic/authorization/security-considerations  
- Security best practices: https://modelcontextprotocol.io/specification/2026-07-28/basic/security_best_practices  
- Client best practices (progressive discovery): https://modelcontextprotocol.io/docs/2026-07-28/develop/clients/client-best-practices  
- Streamable HTTP: https://modelcontextprotocol.io/specification/2026-07-28/basic/transports/streamable-http  

### Python SDKs
- Official SDK docs: https://py.sdk.modelcontextprotocol.io/  
- Mount ASGI/FastAPI: https://py.sdk.modelcontextprotocol.io/run/asgi/  
- SDK v2 release: https://github.com/modelcontextprotocol/python-sdk/releases/tag/v2.0.0  
- FastMCP: https://gofastmcp.com/getting-started/welcome  
- FastMCP ↔ SDK relationship: https://gofastmcp.com/getting-started/upgrading/from-mcp-sdk-v2  
- FastMCP + FastAPI: https://gofastmcp.com/v2/integrations/fastapi  

### Security research & ecosystem
- Invariant tool poisoning: https://invariantlabs.ai/blog/mcp-security-notification-tool-poisoning-attacks  
- Invariant GitHub MCP: https://invariantlabs.ai/blog/mcp-github-vulnerability  
- Microsoft indirect injection: https://developer.microsoft.com/blog/protecting-against-indirect-injection-attacks-mcp  
- OWASP MCP Tool Poisoning: https://github.com/OWASP/www-community/blob/master/pages/attacks/MCP_Tool_Poisoning.md  
- OX Security MCP supply chain: https://www.ox.security/blog/the-mother-of-all-ai-supply-chains-critical-systemic-vulnerability-at-the-core-of-the-mcp/  
- VentureBeat OX coverage: https://venturebeat.com/security/mcp-stdio-flaw-200000-ai-agent-servers-exposed-ox-security-audit  
- CSA MCP security note (2026-05): https://labs.cloudsecurityalliance.org/research/csa-research-note-mcp-security-crisis-20260504-csa-styled/  
- Authzed MCP breach timeline: https://authzed.com/blog/timeline-mcp-breaches  
- Token bloat / progressive disclosure: https://thenewstack.io/how-to-reduce-mcp-token-bloat/  
- Claude Code tool search: https://kuanhaohuang.com/mcp-tool-search-claude-code/  
- Descope auth summary: https://www.descope.com/blog/post/mcp-auth-spec  
- Stack Overflow auth explainer (2026-01): https://stackoverflow.blog/2026/01/21/is-that-allowed-authentication-and-authorization-in-model-context-protocol/
