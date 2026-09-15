---
id: PPD-PORTFOLIO-OPS-INCIDENT-PROCESS
last_reviewed: 2026-09-13
owner: daniel
related:
  - docs/operations/reliability.md
  - docs/operations/runbooks-index.md
  - docs/templates/postmortem.md
schema_version: 1
status: draft
title: Incident process
type: how-to
visibility: internal
---

# Incident process

This document defines the target incident response process. It is a proposed standard, not a claim that this process is currently in operation.

## Severity levels

| Level | Definition | Examples |
|---|---|---|
| SEV-1 | Critical: user data loss, security breach, total outage | Data leak, auth bypass, all services down |
| SEV-2 | Major: significant feature broken, partial outage | Billing failure, wearable sync down for all users |
| SEV-3 | Minor: degraded functionality, workaround exists | Single provider sync failing, UI rendering issue |
| SEV-4 | Low: cosmetic, no user impact | Typo, minor styling |

## Response process (proposed)

1. **Detect:** Alert from monitoring, user report, or CI failure.
2. **Triage:** Assign severity, assign incident commander.
3. **Mitigate:** Reduce impact (rollback, feature flag, hotfix).
4. **Resolve:** Fix root cause.
5. **Postmortem:** Write incident report using `docs/templates/postmortem.md`.
6. **Action items:** Track remediation items in `docs/audits/remediation-backlog.md`.

## Current state

No formal incident process is documented as operational. This document defines the target process.

## What this document does not claim

- That this process is currently followed (it is a proposed standard).
- That on-call rotation exists (it has not been documented).
- That monitoring alerts are configured (this has not been verified).
- That past incidents have postmortems (none have been documented in this system).
