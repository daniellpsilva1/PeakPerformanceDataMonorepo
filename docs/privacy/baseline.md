---
id: PPD-PORTFOLIO-PRIVACY-BASELINE
last_reviewed: 2026-09-13
owner: daniel
related:
  - PPD-PORTFOLIO-SECURITY-DFD
  - PPD-PORTFOLIO-ARCH-SYSTEM-CONTEXT
schema_version: 1
status: draft
title: Privacy baseline
type: reference
visibility: internal
---

# Privacy baseline

This document records the privacy-relevant data categories in the platform and their observed handling. It is a baseline for privacy review, not a legal compliance document.

## Data categories

| Category | Store | Source | Sensitivity | Observed handling |
|---|---|---|---|---|
| Auth credentials | Supabase Auth | User registration | Critical | Supabase managed |
| Email | Supabase `profiles` | Registration | High | RLS (needs audit) |
| Full name | Supabase `profiles` | Registration | Medium | RLS (needs audit) |
| Organization membership | Supabase | Org creation/invitation | Medium | RLS (needs audit) |
| Wearable physiology | ClickHouse | Provider sync | High | Application-level only |
| Tennis match data | Supabase | Scorekeeper/Vision | Medium | RLS + match-access |
| Billing records | Supabase | Stripe webhook | High | RLS (needs audit) |
| AI conversations | Supabase | AI agent | Medium | Needs audit |
| Genetic data | Supabase (via agent) | User upload | Critical | Needs audit |
| Video files | Cloudflare R2 | SwingVision/Vision | Medium | Access controlled |
| IP addresses | Vercel/Hetzner logs | HTTP requests | Medium | Provider-managed |

## Data subject rights

| Right | Mechanism | Status |
|---|---|---|
| Access | User can view own data via app | Implemented |
| Rectification | User can edit profile | Implemented |
| Erasure | Account deletion | Unconfirmed |
| Portability | Data export | Unconfirmed |
| Objection | Opt-out of data processing | Unconfirmed |

## Data retention

| Data | Retention policy | Status |
|---|---|---|
| Wearable timeseries | Unconfirmed | Needs policy |
| Tennis matches | Unconfirmed | Needs policy |
| AI conversations | `cleanup-conversations` cron (daily 3am) | Configured |
| Video files | R2 lifecycle policy | Configured (needs review) |
| Billing records | Unconfirmed | Needs policy |
| Logs | Provider-managed (Vercel/Hetzner) | Needs policy |

## Cross-border transfers

| Transfer | Mechanism | Status |
|---|---|---|
| EU (Vercel lhr1) | Vercel DPA | Configured (region moved from iad1, 2026-10) |
| EU → Hetzner (extraction + graph backend) | Hetzner Falkenstein, Germany (eu-central) | Verified — owner-provided console screenshot, 2026-10-09 |

> **Correction (2026-10-09):** Vercel functions and all edge routes now run in `lhr1` (London, eu-west), not iad1 — intra-EU. The previous "EU → US (Render)" row is removed: Render is no longer used for the graph backend (owner statement 2026-10-09) — it runs on Hetzner Falkenstein (see row above). Note: the app's `NEXT_PUBLIC_API_URL` env still points at `peakperformancedatav2.onrender.com`; whether that legacy backend is live is unverified.
> A second Hetzner server "Wearables-Data-Processing" (CX23, 89.167.47.236, Helsinki, eu-central) exists; what runs on it is unverified.

## What this document does not claim

- Legal compliance (this is an engineering baseline, not legal advice).
- That RLS policies are correct (needs migration audit).
- That data retention policies are enforced (most are unconfirmed).
- That data subject rights are fully implemented (several are unconfirmed).
- That cross-border transfer mechanisms are compliant (needs legal review).
