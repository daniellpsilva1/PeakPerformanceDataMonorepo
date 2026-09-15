---
id: PPD-PORTFOLIO-SECURITY-DFD
last_reviewed: 2026-09-13
owner: daniel
related:
  - PPD-PORTFOLIO-ARCH-CONTAINERS
  - PPD-APP-ARCH-IDENTITY
  - PPD-APP-ARCH-WEARABLES
schema_version: 1
status: draft
title: Security data flow diagram
type: explanation
visibility: internal
---

# Security data flow diagram

This diagram shows trust boundaries and data classification across the platform. It is distinct from the C4 container diagram — it focuses on where data crosses trust boundaries and what controls are observed.

## Diagram

```mermaid
flowchart TB
    subgraph Public["Public Internet"]
        Browser[Browser]
        StripeWebhook[Stripe Webhooks]
        ProviderWebhook[Provider Webhooks]
    end

    subgraph AppBoundary["App Trust Boundary (Vercel)"]
        Middleware[Middleware\nsession verification]
        BFF[BFF Routes\nwithAuth/withAdminAuth/withCoachAuth]
        AirRoute[AI Agent Route\nEdge runtime]
        AdminClient[Service-Role Client\ncreateAdminClient]
        Middleware --> BFF
        BFF --> AdminClient
        AirRoute --> AdminClient
    end

    subgraph BackendBoundary["Graph Backend Boundary (Render)"]
        GraphAuth[AuthMiddleware]
        GraphAPI[Graph API\n/api/v1/graphs]
        WearablesAPI[Wearables API\n/wearables/activities]
        GraphAuth --> GraphAPI
        GraphAuth --> WearablesAPI
    end

    subgraph ExtractionBoundary["Extraction Boundary (Hetzner)"]
        ExtAPI[Provider API\n/api/v1/providers]
        NoAuth["No auth middleware\n(observed gap DG-18)"]
        Sync[Sync Service]
        NoAuth --> ExtAPI
        ExtAPI --> Sync
    end

    subgraph AgentBoundary["Python Agent Boundary"]
        AgentAuth[AuthMiddleware\nx-internal-service secret]
        AgentAPI[Insight Routes]
        AgentAuth --> AgentAPI
    end

    subgraph DataBoundary["Data Stores"]
        Supabase[(Supabase\nRLS enforced)]
        ClickHouse[(ClickHouse\nno RLS observed)]
    end

    Browser -->|session cookie| Middleware
    StripeWebhook -->|signature verify| BFF
    ProviderWebhook -->|webhook secret?| ExtAPI

    BFF -->|service-role| Supabase
    BFF -->|user-scoped| ClickHouse
    GraphAPI -->|user_id param| ClickHouse
    WearablesAPI -->|user_id param| ClickHouse
    Sync -->|tenant context| ClickHouse
    AgentAPI -->|RPC| Supabase

    AirRoute -->|INTERNAL_SERVICE_SECRET| AgentAuth
```

## Trust boundaries

| Boundary | Observed control | Required control | Gap |
|---|---|---|---|
| Public → App (BFF) | Supabase session cookie + `withAuth` | Verified session | OK |
| Public → App (webhook) | Stripe signature verification | Signature verification | OK |
| App → Graph backend | `AuthMiddleware` (details unverified) | Authenticated session | Needs verification |
| App → Extraction backend | `X-User-Id` header only (no auth middleware) | Verified identity | DG-18 |
| App → Python agent | `INTERNAL_SERVICE_SECRET` header | Shared secret | OK (if secret is rotated) |
| App → Supabase | RLS + service-role client | RLS enforcement | Needs migration audit |
| App → ClickHouse | No RLS observed | Application-level tenant check | Needs verification |
| Graph backend → ClickHouse | `user_id` parameter | Tenant isolation | Needs verification |
| Extraction → ClickHouse | `TenantContext` in sync | Tenant context | OK for writes |

## Data classification

| Data category | Store | Sensitivity | Observed protection |
|---|---|---|---|
| Auth credentials | Supabase Auth | Critical | Supabase managed |
| User profiles | Supabase `profiles` | High | RLS (needs audit) |
| Organization data | Supabase `organizations` | High | RLS (needs audit) |
| Wearable physiology | ClickHouse `openwearables_data` | High | Application-level only |
| Tennis matches | Supabase `tennis_matches` | Medium | RLS + `match-access.ts` |
| Billing records | Supabase `billing_*` | High | RLS (needs audit) |
| AI conversations | Supabase (conversation memory) | Medium | Needs audit |
| Video files | Cloudflare R2 | Medium | Access controlled |
| Genetic data | Supabase (via agent tools) | Critical | Needs audit |

## What this document does not claim

- Complete threat model (needs per-boundary threat analysis).
- RLS policy correctness (needs Supabase migration audit).
- ClickHouse tenant isolation (no RLS observed, needs application-level verification).
- Whether `AuthMiddleware` in graph backend verifies the same identity as the app session.
- Production network security (firewall, VPC, etc. — needs infrastructure evidence).
