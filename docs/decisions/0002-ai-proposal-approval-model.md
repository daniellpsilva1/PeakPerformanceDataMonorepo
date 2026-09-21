---
id: PPD-PORTFOLIO-ADR-0002
last_reviewed: 2026-09-20
owner: daniel
related:
  - docs/agents/runtime-knowledge-contract.md
  - docs/audits/remediation-backlog.md
  - PeakPerformanceData/peak_performance_data/docs/architecture/ai-agent.md
schema_version: 1
status: accepted
title: ADR-0002 — AI proposal/approval model and per-task model routing
type: adr
visibility: internal
---

# ADR-0002 — AI proposal/approval model and per-task model routing

## Decision status

Accepted — approved by owner 2026-09-20. The three gated migrations were applied
to the production project and generated types updated the same day. Model
routing keeps the pre-change defaults (DeepSeek primary, Groq fallback); the
bake-off is deferred — the eval runner (`pnpm eval:ai`) remains available.

## Context

The app's AI assistant could call ~115 tools, including write tools that executed immediately when invoked. Source inspection (2026-09-19, app `f4c9b736`) found:

- The server-held pending-action layer (`src/lib/ai/pending-actions.ts`) and `ConfirmationDialog.tsx` were dead code — never imported or rendered.
- `confirmActionTool` only produced text asking the model to wait; nothing enforced approval before a write.
- Several tools accepted an LLM-supplied `confirmed: boolean`, which is not proof of user consent.
- Athlete names were resolved inconsistently (`ilike .single()`, silent first match, or exact match), none accent-insensitive or coach-context aware — the "wrong Martin" problem.
- Coaches received org-wide athlete tools because `assignedPlayerIds` was never wired.
- The agent ran on the Edge runtime with a 30-second cap that cannot host multi-step extraction + review pipelines.

The runtime-agent knowledge contract requires per-action approval for data modification and tenant-bound actions. The product direction (voice-first, dictate → review → save) makes the approval boundary the central safety mechanism.

## Options considered

1. **Prompt-level confirmation** — ask the model to confirm before calling write tools. Rejected: unenforced; the model can be manipulated by transcript/chat content and `confirmed` params are self-attested.
2. **AI SDK 5 `needsApproval` tool flow** — native approval parts in the stream. Rejected for v1: the app pins `ai@4.3.19`; the upgrade touches 32 tool files and the chat UI. Kept as a later option (WP-02b in the implementation plan).
3. **Server-held proposals** — the model (and a dedicated capture pipeline) only *proposes* typed actions; a durable `ai_proposals` row is reviewed in a card UI and executed by a single approve route that reauthorizes every referenced entity. Selected.

## Decision

1. **The model proposes; the server executes.** No write tool is exposed to the model for covered intents (sessions, session participants, reports, observations, attendance, PSE, messages). Chat exposes `proposeActions` + `resolveAthletes`; capture mode bypasses chat entirely (`/api/ai-agent/capture` → extract → resolve → propose). Not-yet-covered writes (goals, plans, injuries, invitations, memories, group messages) remain registered pending executor coverage — tracked in the remediation backlog.
2. **Proposals are durable and bound** — `ai_proposals` rows carry user, organization, actions (with resolved athlete ids and disambiguation candidates), idempotency key, expiry (24h), and status. In-memory pending state was removed.
3. **Approval reauthorizes** — the approve route reloads role/roster and rejects any action whose athlete ids are outside the caller's authorized set; PATCH edits may only swap ids to offered candidates; `pending → executing` is an atomic transition; execution results are recorded per action.
4. **Entity resolution is deterministic** — mentions are matched only inside the caller's authorized roster, accent-insensitively, with context ranking (page/session/recency/group) and explicit ambiguity (candidates → chip picker). The model never selects ids.
5. **Model routing is per-task and provider-agnostic** — `src/lib/ai/models.ts` resolves `provider:model` specs per task (`chat`, `extract`, `classify`, `summarize`) from `AI_MODEL_*` env vars with defaults preserving the pre-change behavior (DeepSeek primary, Groq fallback). Per owner decision 2026-09-20, the current defaults are retained; the bake-off (`pnpm eval:ai` → `docs/evidence/ai-model-bakeoff-<date>.md`) is deferred but remains the mechanism for any future provider change. Provider selection must satisfy the DPA/EU-processing requirement in RG-11.
6. **Runtime** — the agent and transcription routes run on the Node runtime (`maxDuration` 120/60) instead of Edge.
7. **STT is provider-abstracted** — `src/lib/ai/stt` with Groq Whisper v1, primed with up to ~25 ranked authorized-roster names plus locale tennis vocabulary. Audio bytes are not stored in v1 (transcript only, 90-day retention target).

## Consequences

- Every covered write is reviewable, auditable (`ai_audit_logs` proposal events), idempotent, and fails closed.
- The gated migrations (`20260920_ai_proposals`, `20260920_ai_voice_captures`, `20260920_group_training_session_participants`) were applied to production 2026-09-20; generated types include the new tables and the untyped-client casts were removed.
- Uncovered write tools still execute immediately — a documented residual gap until their executors land.
- AI SDK 4→5 upgrade remains optional; native `toolApproval` can later replace the bespoke card without changing the server contract.

## Evidence

- Golden utterance set: `PeakPerformanceData/peak_performance_data/tests/fixtures/ai/golden-utterances.json` (45 cases).
- Deterministic suites: `tests/lib/ai/resolution/` (144), `tests/lib/ai/proposals/` (23), `tests/api/ai-agent/` + `tests/api/transcribe/` (76), `tests/components/ai/` (20).
- Gaps recorded: RG-08 (confirmation enforcement — resolved by this ADR's implementation), RG-09 (name resolution — resolved), RG-10 (coach scope — resolved), RG-11 (model DPA — open), RG-15 (PSE column drift — open).
