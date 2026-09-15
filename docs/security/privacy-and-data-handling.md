---
id: PPD-PORTFOLIO-SECURITY-PRIVACY
last_reviewed: 2026-09-13
owner: daniel
related:
  - docs/security/threat-model.md
  - docs/audits/remediation-backlog.md
schema_version: 1
status: draft
title: Privacy and data handling baseline
type: reference
visibility: internal
---

# Privacy and data handling baseline

This document records the portfolio's privacy baseline. It is a documentation artifact, not a legal compliance certification.

## Data categories handled

| Category | Examples | Repositories | Sensitivity |
|---|---|---|---|
| Identity | User IDs, org IDs, app IDs | app, backend, extraction | High |
| Health/wearable | Heart rate, sleep, activity, recovery | extraction, backend, app | High (special category) |
| Tennis performance | Match scores, strokes, court position | app, courtviz, bodyviz | Medium |
| Billing | Stripe customer IDs, subscription state | app | High |
| Video | Swing clips, match footage | swingvision, vision | Medium |
| AI interactions | Prompts, tool calls, responses | app, agent | Medium |

## Principles

1. **Default-deny knowledge for runtime agents.** Agents receive only explicitly approved knowledge. See `docs/agents/runtime-knowledge-contract.md`.
2. **Tenant isolation.** Data access is scoped by `app_id`, `org_id`, `user_id`. See `docs/architecture/security-dfd.md`.
3. **No raw datasets in documentation.** Documentation references schema and structure, not actual user data.
4. **No secrets in documentation.** Documentation references env var names, not values.
5. **Health data is special category.** Wearable/health data receives heightened access controls and is not exposed to runtime agents without explicit approval.

## Known gaps

| Gap | Source | Risk | Status |
|---|---|---|---|
| Extraction service has no auth middleware (DG-18) | `docs/audits/documentation-baseline.md` | High | Open (RG) |
| SQL security CI is non-blocking (DG-19) | `docs/audits/documentation-baseline.md` | High | Open (RG) |
| RLS policy coverage unverified | `docs/audits/documentation-baseline.md` | High | Open (RG) |

## What this baseline does not claim

- That GDPR/HIPAA compliance has been certified (it has not).
- That all data flows have been audited (only documented flows have been cataloged).
- That the gaps above have been remediated (they are tracked for separate engineering work).
- That this baseline constitutes legal advice (it does not).
