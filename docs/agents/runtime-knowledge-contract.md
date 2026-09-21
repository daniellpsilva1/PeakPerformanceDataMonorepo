---
id: PPD-PORTFOLIO-AGENT-KNOWLEDGE-CONTRACT
last_reviewed: 2026-09-20
owner: daniel
related:
  - AGENTS.md
  - docs/governance/documentation-standard.md
schema_version: 1
status: draft
title: Runtime-agent knowledge contract
type: reference
visibility: internal
---

# Runtime-agent knowledge contract

This document defines the contract for what runtime/application agents (the in-app AI agent, not coding agents) may know and do. It is **default-deny**: agents may only access what is explicitly listed here.

## Contract principles

1. **Default-deny:** Anything not explicitly allowed is denied.
2. **Contract-only:** Agent knowledge comes from this contract, not from free-form documentation retrieval.
3. **No autonomous approval:** Agents draft and suggest; only the owner approves.
4. **No side effects:** Agents may not modify data, trigger deployments, or change configuration without explicit per-action approval. Per ADR-0002, covered writes execute only through durable `ai_proposals` rows approved by the user in the review card; the model never executes them directly.
5. **Tenant-bound:** Agent actions are bound to the authenticated user's tenant context.
6. **No medical claims:** Agents present values and zones only; they never diagnose or interpret medically.

## Allowed knowledge

### User context

| Field | Source | Available to agent |
|---|---|---|
| User ID | Verified session | Yes |
| Organization ID | `profiles.organization_id` | Yes |
| Role | `profiles.role` | Yes |
| Subscription tier | `get_subject_entitlement` RPC | Yes |
| Full name | `profiles.full_name` | Yes |

### Specialist tools

| Tool | Data source | Constraints |
|---|---|---|
| Lab panels | Supabase RPC | Present values and zones only; no diagnosis |
| Biomarker trends | Supabase RPC | Present trends; no medical interpretation |
| CGM scores | Supabase RPC | Present scores; no medical advice |
| Genetic traits | Supabase RPC | Present traits; no deterministic health predictions |
| Tennis matches | Supabase RPC | Read-only match data |
| Tennis evolution | Supabase RPC | Read-only trend data |

### External services

| Service | Access | Constraints |
|---|---|---|
| DeepSeek / Groq | LLM inference | Via server-side route only; no direct client access |
| Python AI agent | Internal HTTP | `INTERNAL_SERVICE_SECRET` header; server-side only |

## Denied knowledge

| Category | Denied |
|---|---|
| Other users' data | Yes — tenant-bound |
| Other organizations' data | Yes — tenant-bound |
| Billing records (other than own entitlement) | Yes |
| Auth credentials | Yes |
| API keys / secrets | Yes |
| Infrastructure configuration | Yes |
| Database connection strings | Yes |
| Source code | Yes (runtime agents are not coding agents) |

## Denied actions

| Action | Denied |
|---|---|
| Data modification without an approved proposal | Yes — covered intents only via `ai_proposals` + approve route (ADR-0002); uncovered write tools remain a documented residual gap (RG-08) |
| Deployment triggers | Yes |
| Configuration changes | Yes |
| User impersonation | Yes |
| Cross-tenant queries | Yes |
| Medical diagnosis | Yes |
| Unsafe genetic interpretation | Yes |

## Verification

| Requirement | Verification method | Status |
|---|---|---|
| Agent identity from session, not request body | Source inspection | Verified in `route.ts` |
| Role-based athlete binding | Source inspection | Verified in `toolRouter.ts` |
| Covered writes require approval | Deterministic tests | Verified — `tests/api/ai-agent/proposals.test.ts` (unauthorized/expired/foreign/double-approve) |
| Athlete resolution is roster-bound + disambiguated | Deterministic tests | Verified — `tests/lib/ai/resolution/` |
| No medical diagnosis | Tool descriptions | Verified in `specialistTools.ts` |
| Tenant isolation in specialist tools | Per-tool review | Needs verification |
| End-to-end model safety | Evaluation harness | Partial — golden-set eval runner added (`pnpm eval:ai`); live bake-off pending |

## What this contract does not claim

- That the contract is enforced by technical controls beyond source inspection (needs test verification).
- That all specialist tools enforce tenant isolation (needs per-tool review).
- That the evaluation harness is sufficient for model safety (DG-17).
- That this contract covers all possible agent behaviors (it covers observed behaviors only).
- Runtime-agent integration beyond this contract is explicitly out of scope for the documentation system.
