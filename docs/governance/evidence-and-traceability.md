---
id: PPD-PORTFOLIO-GOV-EVIDENCE
last_reviewed: 2026-09-13
owner: daniel
schema_version: 1
status: draft
title: Evidence and traceability
type: reference
visibility: internal
---

# Evidence and traceability

This document defines how claims in documentation are linked to verifiable source evidence.

## Four states of assurance

Every test, check, or control must be classified into one of four states. These are not interchangeable.

| State | Meaning |
|---|---|
| Declared | A script, test, or control exists in source |
| Prerequisites validated | Dependencies, environment, and fixtures are understood |
| Executed | A specific run has an outcome and evidence |
| Enforced | A verified delivery control requires the result |

A pipeline file only establishes declaration. A successful local test does not establish branch enforcement. A test is adequate only relative to a stated acceptance criterion and reviewed assertions.

## Source references

Managed documents cite source evidence using structured references. See `documentation-standard.md` for the format.

A source reference with a `revision` pinning to a specific commit is stronger than one referencing a branch name. The documentation checker validates that referenced paths exist at the declared revision when the checkout is available.

## Evidence records

Evidence for test runs, releases, and operational actions is stored as structured records. An evidence record includes:

- Command or manual procedure identifier.
- Environment class (local, CI, staging, production).
- Input fixture identifier.
- Source revisions at time of execution.
- Result: `passed`, `failed`, `not_run`, `blocked`, `not_applicable`.
- Timestamp and tool versions.
- Sanitized artifact reference or content digest.
- Limitations and caveats.

An N/A result requires a reason. An executed failure is different from an observed static concern.

## Requirement traceability

Requirements are linked to implementation, tests, and evidence through structured records:

- `implementation_state`: `proposed`, `observed`, `verified`, `gap`, `not_applicable`.
- `source_refs`: where the requirement is implemented.
- `test_refs`: where the requirement is tested.
- `evidence_refs`: execution records proving the test passed.
- `gaps`: known missing coverage.

## What this is not

- A documentation check is not a security audit.
- A green structural check is not proof that a system is secure, deployed, or correct.
- A rendered diagram is not a verified architecture.
- A test file is not a passing test.
- A forwarded token is not a verified identity.
