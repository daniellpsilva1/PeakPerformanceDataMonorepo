---
id: PPD-PORTFOLIO-PRODUCT-OVERVIEW
last_reviewed: 2026-09-13
owner: daniel
schema_version: 1
status: draft
title: Product overview
type: overview
visibility: internal
---

# Product overview

PeakPerformanceData is a multi-tenant sports performance platform serving tennis academies and individual athletes. It unifies wearable physiology data, tennis match analytics, AI-driven insights, and 3D body visualization into a single product.

## Personas

| Persona | Description | Primary value |
|---|---|---|
| Player | Athlete viewing own performance data, tennis scoring, body twin | Self-tracking, improvement |
| Coach | Managing assigned players, viewing analytics, tennis coaching | Player development, team oversight |
| Parent | Viewing linked child's data and tennis matches | Visibility into child's progress |
| Club Admin | Managing organization, members, and academy settings | Organization management, billing |

## Product modes

| Mode | Description |
|---|---|
| B2B Academy | Organization with admin, coaches, players, parents |
| B2C Personal | Individual user with personal organization (`is_personal: true`) |

## Core capabilities

| Capability | Repositories | Status |
|---|---|---|
| Wearable data ingestion | app, extraction | Active (Garmin, Polar, Whoop, Suunto) |
| Performance graphs | app, backend | Active |
| Tennis scoring (live + offline) | app | Active |
| Tennis video analysis | swingvision, vision | Active |
| AI insights (non-diagnostic) | app, agent | Active |
| 3D body twin | app, bodyviz | Feature-flagged (`NEXT_PUBLIC_BODYVIZ`) |
| Billing/subscriptions | app | Active (Stripe) |
| Court visualization | app, courtviz | Active |

## What this document does not claim

- That all capabilities are production-verified (needs operational evidence).
- That the persona list is exhaustive (needs product review).
- That B2C personal mode is fully equivalent to B2B (needs feature parity audit).
