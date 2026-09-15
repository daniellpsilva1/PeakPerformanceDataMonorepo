---
id: PPD-PORTFOLIO-AUDIT-REMEDIATION-BACKLOG
last_reviewed: 2026-09-13
owner: daniel
related:
  - docs/audits/documentation-baseline.md
  - docs/quality/verification-matrix.md
schema_version: 1
status: draft
title: Remediation backlog
type: reference
visibility: internal
---

# Remediation backlog

This backlog tracks runtime, assurance, and code-level gaps discovered during documentation work. These items are **not** documentation deliverables and are not resolved as part of the documentation rollout. They require separate owner approval and engineering work.

## How to read this backlog

Each item has:

- **ID:** `RG-NN` (remediation gap)
- **Source:** Where the gap was discovered
- **Risk:** Low / Medium / High
- **Status:** Open / Acknowledged / In progress / Resolved
- **Owner action required:** What the owner needs to decide or authorize

## Open items

### RG-01: Strava env vars in backend render.yaml

- **Source:** `docs/audits/documentation-baseline.md` (DG-05)
- **Risk:** Medium
- **Status:** Open
- **Description:** `render.yaml` declares Strava-related env vars, but the wearable integration has migrated to OpenWearables. It is unclear whether Strava is still active or these are stale.
- **Owner action required:** Confirm whether Strava is still integrated. If not, authorize removal of stale env vars from `render.yaml`.

### RG-02: ACWR band labeling disagreement

- **Source:** `docs/audits/documentation-baseline.md` (DG-23)
- **Risk:** Medium
- **Status:** Open
- **Description:** Research documents question the validity of ACWR "safe zones," while application code labels ranges "optimal" or "danger." This is a scientific claim disagreement, not a documentation issue.
- **Owner action required:** Decide whether to update code labels, update research claims, or document the disagreement as accepted.

### RG-03: Legacy extraction lifecycle

- **Source:** `docs/audits/documentation-baseline.md` (DG-02)
- **Risk:** Medium
- **Status:** Open
- **Description:** The legacy extraction repository's role is unclear. It may be retired, in maintenance, or still serving a fallback.
- **Owner action required:** Confirm lifecycle status and authorize disposition (retire, maintain, or document as active).

### RG-04: SQL security CI is non-blocking

- **Source:** `docs/audits/documentation-baseline.md` (DG-19)
- **Risk:** High
- **Status:** Open
- **Description:** The SQL security CI job is explicitly non-blocking and notes an incomplete local schema. It should not be presented as proven security coverage.
- **Owner action required:** Decide whether to promote to blocking, complete the local schema, or document the limitation as accepted.

### RG-05: Playwright dependency not confirmed for Courtviz/BodyViz galleries

- **Source:** `docs/quality/verification-matrix.md`
- **Risk:** Low
- **Status:** Open
- **Description:** Courtviz and BodyViz declare `pnpm gallery` commands that require Playwright, but Playwright is not confirmed as a declared dependency in their manifests.
- **Owner action required:** Confirm whether Playwright is installed and the gallery command runs, or mark the command as unverified.

### RG-06: Database migration drift check methodology

- **Source:** `docs/audits/documentation-baseline.md` (DG-20)
- **Risk:** Medium
- **Status:** Open
- **Description:** The existing drift check compares full migration filenames with database version IDs, while Supabase's CLI treats version and name separately. Output may not be reliable.
- **Owner action required:** Validate the drift check methodology or replace with a Supabase CLI-based check.

### RG-07: AI Videos repository purpose

- **Source:** `docs/audits/documentation-baseline.md` (DG-24)
- **Risk:** Low
- **Status:** Open
- **Description:** The AI Videos repository's purpose and relationship to other marketing repos is unclear.
- **Owner action required:** Confirm purpose and intended use, or mark as deprecated.

## What this backlog does not claim

- That any item has been resolved (all are open).
- That this backlog is exhaustive (new gaps may be discovered).
- That documentation work will resolve these items (it will not).
