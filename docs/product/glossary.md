---
id: PPD-PORTFOLIO-PRODUCT-GLOSSARY
last_reviewed: 2026-09-13
owner: daniel
schema_version: 1
status: draft
title: Product glossary
type: reference
visibility: internal
---

# Product glossary

Terms used across the PeakPerformanceData platform. Engineering docs remain English; product-facing UI supports four locales.

## Identity and tenancy

| Term | Definition |
|---|---|
| Tenant | An organization context isolating data and access |
| Personal org | An auto-provisioned organization with `is_personal: true` for B2C users |
| Club admin | A user with `is_club_admin: true` on their profile; organization-level admin |
| Admin | A user with `profiles.role === 'admin'`; global admin (distinct from club_admin) |
| Coach assignment | An active record in `coach_player_assignments` linking a coach to a player |
| Parent-child relationship | A record in `parent_child_relationships` linking a parent to a child |

## Wearables

| Term | Definition |
|---|---|
| OpenWearables (OW) | Unified wearable data abstraction layer used by the extraction backend |
| Provider | A wearable data source: Garmin, Polar, Whoop, or Suunto |
| Sync | The process of pulling data from a provider via OW into ClickHouse |
| TenantContext | The `(app_id, org_id, user_id)` tuple passed to sync operations |
| ow_user_id | The OpenWearables-side user identifier mapped from the app user |

## Tennis

| Term | Definition |
|---|---|
| Scorekeeper | The client-side tennis scoring state machine |
| Outbox | A localStorage FIFO queue for offline point-event persistence |
| PointEvent | A client-generated point record with a unique ID for idempotency |
| Match status | One of: `in_progress`, `paused`, `completed`, `abandoned` |
| Courtviz adapter | The snake_case → camelCase mapper in `courtviz-adapter.ts` |

## Billing

| Term | Definition |
|---|---|
| Entitlement | The user's plan, status, and period end resolved via `get_subject_entitlement` RPC |
| Subscription tier | One of: `free`, `athlete`, `athletePlus` |
| Entitlement source | One of: `personal`, `org`, `none` |
| Webhook idempotency | Stripe event IDs claimed in `stripe_webhook_events` before processing |

## AI

| Term | Definition |
|---|---|
| Specialist tool | A non-diagnostic data tool called by the AI agent (labs, CGM, genetics, tennis) |
| INTERNAL_SERVICE_SECRET | Shared secret for app → Python agent authentication |
| Knowledge contract | The default-deny contract defining what runtime agents may know and do |

## Visualization

| Term | Definition |
|---|---|
| BodyViz | The 3D body twin library (`@bodyviz/*` packages) |
| Courtviz | The tennis court visualization library (`@courtviz/*` and `@ppd/*` packages) |
| Vendor pin | The app's nested checkout of a visualization library at a specific revision |
| Frozen path | The archived Remotion match-recap path in Courtviz (`apps/video/FROZEN.md`) |

## Video

| Term | Definition |
|---|---|
| SwingVision | iPhone-based tennis video analysis service |
| RIFE | Frame interpolation enhancement step in the video pipeline |
| R2 | Cloudflare R2 object storage for video files |
| Vision service | Separate video analysis service with its own PostgreSQL database |
