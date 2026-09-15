---
id: PPD-PORTFOLIO-GOV-MAINTENANCE
last_reviewed: 2026-09-13
owner: daniel
schema_version: 1
status: draft
title: Documentation maintenance
type: reference
visibility: internal
---

# Documentation maintenance

This document defines how documentation stays current and how stale material is handled.

## Event-triggered review

The primary maintenance mechanism is event-triggered review. When source code changes, the documentation checker's impact command identifies affected documents. The change author is responsible for updating those documents or declaring a scoped no-doc-impact rationale.

## Periodic review reminders

| Category | Cadence |
|---|---|
| High-risk operations and security docs | Every 90 days |
| Broader portfolio | Every 180 days |

These are reminders to review, not task completion deadlines. A review may confirm the document is still current, update it, or mark it as needing review.

## Deprecation and supersession

Stale documents are not deleted. The process is:

1. Identify the successor document or declare retired-without-replacement.
2. Add a dated status notice at the old document's entry point.
3. Set frontmatter `status: superseded` and `superseded_by: <successor-id>`.
4. Update links and indexes to point to the successor.
5. Preserve the old document's history. Do not move or delete it without explicit approval.

A supersession cycle is invalid. If document A supersedes B and B supersedes A, this is a gap requiring resolution, not a valid state.

## Migration of historical material

Historical documents are inventoried and classified with one of these dispositions:

| Disposition | Meaning |
|---|---|
| `retain-current` | Verified useful authority; metadata normalized only when necessary |
| `promote-reviewed` | Useful content needing current source verification and a managed destination |
| `historical-reference` | Preserved as dated context |
| `superseded` | Proven replacement with direct link |
| `research-unverified` | Evidence inputs, not implementation authority |
| `restricted-review` | Content classification or rights decision required |
| `unknown` | Owner decision pending |

Do not label all old documents as obsolete. Do not infer creation dates from filesystem modification times. Do not rewrite old research results as current facts.

## Measurable quality

Track these metrics rather than page counts or diagram counts:

- Repository baseline coverage and unknown lifecycle decisions.
- Broken links, invalid metadata, and generated-index drift.
- High-risk domains with controlling docs and explicit gaps.
- Agent retrieval and planning success; wrong-version selections.
- Stale source references and unresolved contradictions.
- Time and effort spent maintaining the process, to remove unnecessary ceremony.
