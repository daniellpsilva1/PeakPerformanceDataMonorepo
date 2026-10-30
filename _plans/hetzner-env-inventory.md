# Environment variable inventory — PPD Next.js app (Hetzner migration)

Generated 2026-10-24 by grepping `process.env.*` across `src/`, `next.config.js`,
`sentry.server.config.ts`, and `src/instrumentation*.ts` on branch
`infra/hetzner-migration`. **Names only — no values.**

Note: no `.env.example` exists in the repository (committed HEAD), so nothing
below is documented there — treat every variable as "not in .env.example".

## 1. Build-time `NEXT_PUBLIC_*` (inlined into the client bundle)

Passed as Docker build args (see `Dockerfile`, `.github/workflows/deploy.yml`).
Also needed at runtime for server components/middleware that read them.

| Variable | Where it comes from (GH Actions) |
|---|---|
| `NEXT_PUBLIC_API_URL` | `vars` |
| `NEXT_PUBLIC_APP_URL` | staging hardcoded to `https://staging.bcnprotennisacademy.com`; main from `vars` |
| `NEXT_PUBLIC_BODYVIZ` | `vars` (`true` to enable real BodyViz) |
| `NEXT_PUBLIC_ENABLE_AI_VOICE_ASSISTANT` | `vars` |
| `NEXT_PUBLIC_ENV` | set to branch name (`staging`/`main`) in deploy.yml |
| `NEXT_PUBLIC_POSTHOG_HOST` | `vars` |
| `NEXT_PUBLIC_POSTHOG_KEY` | `secrets` |
| `NEXT_PUBLIC_PPC_API_URL` | `vars` |
| `NEXT_PUBLIC_SENTRY_DSN` | `secrets` |
| `NEXT_PUBLIC_SENTRY_PROFILES_SAMPLE_RATE` | `vars` |
| `NEXT_PUBLIC_SENTRY_TRACES_SAMPLE_RATE` | `vars` |
| `NEXT_PUBLIC_SITE_URL` | staging hardcoded to staging URL; main from `vars` |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | `secrets` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | `secrets` |
| `NEXT_PUBLIC_SUPABASE_URL` | `secrets` |
| `NEXT_PUBLIC_TURNSTILE_SITE_KEY` | `secrets` |
| `NEXT_PUBLIC_VAPID_PUBLIC_KEY` | `secrets` |
| `NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA` | mapped to `github.sha` (name kept; used for asset versioning in `AcademyLanding`) |

## 2. Server runtime secrets (set in Coolify env — never in the image)

| Variable | Used by |
|---|---|
| `ANTHROPIC_API_KEY` | AI assistant (`ai` SDK) |
| `APP_BASE_URL` | server-side URL construction |
| `AUTHORIZED_API_KEYS` | API key auth on select routes |
| `CLOUDFLARE_ACCOUNT_ID` | R2 client config |
| `CLOUDFLARE_R2_ACCESS_KEY_ID` | R2 client |
| `CLOUDFLARE_R2_ACCOUNT_ID` | R2 client |
| `CLOUDFLARE_R2_BUCKET_NAME` | R2 client |
| `CLOUDFLARE_R2_ENDPOINT` | R2 client |
| `CLOUDFLARE_R2_SECRET_ACCESS_KEY` | R2 client |
| `CLOUDFLARE_R2_TENNIS_BUCKET` | R2 tennis bucket |
| `CRON_API_KEY` | cron-adjacent route auth |
| `CRON_SECRET` | `/api/cron/cleanup-conversations` Bearer auth (required in prod — fails closed) |
| `DEEPSEEK_API_KEY` | AI provider |
| `FEEDBACK_ALERT_FROM` | feedback email alerts |
| `FEEDBACK_ALERT_TO` | feedback email alerts |
| `GROQ_API_KEY` | AI provider |
| `INTERNAL_SERVICE_SECRET` | internal service-to-service auth |
| `OPENAI_API_KEY` | AI provider |
| `PIPELINE_IMPORT_TOKEN` | pipeline import route auth |
| `RESEND_API_KEY` | transactional email |
| `SENTRY_AUTH_TOKEN` | Sentry source-map upload at BUILD time only (optional; build works without it) |
| `SENTRY_DSN` | server-side Sentry |
| `STRIPE_SECRET_KEY` | Stripe |
| `STRIPE_WEBHOOK_SECRET` | Stripe webhook verification |
| `SUPABASE_SERVICE_ROLE_KEY` | privileged Supabase access (cron, admin ops) |
| `TENNIS_VIDEO_ACCESS_TOKEN_SECRET` | signed video-access URLs |
| `TURNSTILE_SECRET_KEY` | Turnstile verification |
| `VAPID_PRIVATE_KEY` | web-push |
| `VAPID_SUBJECT` | web-push subject |
| `VISION_API_KEY` | vision backend |
| `WASENDER_API_KEY` | WhatsApp sender |

## 3. Server runtime config (non-secret or semi-public endpoints)

| Variable | Notes |
|---|---|
| `ADMIN_WHATSAPP_NUMBER` | admin notifications |
| `AI_MODEL_EXTRACT` | model selection |
| `BODYVIZ_ALLOWED_EMAILS` | bodyviz access allow-list |
| `FEEDBACK_NOTIFICATION_CHANNELS` | e.g. email/webhook list |
| `PPD_BACKEND_URL` | ppc backend base URL |
| `PPP_AI_AGENT_URL` | ai-agent service URL |
| `SENTRY_PROFILES_SAMPLE_RATE` | server sampling |
| `SENTRY_TRACES_SAMPLE_RATE` | server sampling |
| `STRIPE_PRICE_ATHLETE_ANNUAL` | Stripe price id |
| `STRIPE_PRICE_ATHLETE_MONTHLY` | Stripe price id |
| `STRIPE_PRICE_ATHLETE_PLUS_ANNUAL` | Stripe price id |
| `STRIPE_PRICE_ATHLETE_PLUS_MONTHLY` | Stripe price id |
| `VISION_API_URL` | vision backend URL |
| `WASENDER_API_URL` | WhatsApp sender URL |
| `WEARABLE_SYNC_API_URL` | extraction backend URL |

## 4. Optional / has safe defaults

| Variable | Default if unset |
|---|---|
| `AI_CONVERSATION_RETENTION_DAYS` | `30` |
| `GARMIN_API_TIMEOUT` | code default |
| `PPD_TIMING` | off (dev-only Server-Timing header; gated by `!== 'production'` via `VERCEL_ENV` — leave unset) |
| `STT_PROVIDER` | provider default |
| `ANALYZE` | build-time only — bundle analyzer off |

## 5. Platform-provided — do not set manually

| Variable | Provider |
|---|---|
| `NODE_ENV` | build/runtime |
| `NEXT_RUNTIME` | Next.js |
| `VERCEL_ENV` | Vercel-only — unset on Hetzner (means "not production" for `PPD_TIMING` gating; harmless) |
| `COURTVIZ_ROOT` | local dev helper |

## Notes for the lead

- `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` are needed by
  `src/middleware.ts` at request time — they must be present BOTH as build args
  and as runtime env in Coolify.
- `CRON_SECRET` must be set in Coolify or the cleanup route 500s in production
  (fail-closed by design).
- `SENTRY_AUTH_TOKEN` would only be needed in the image build if we want
  source-map upload; `next.config.js` disables upload cleanly when absent.
  Left out of the Docker build args on purpose (ARGs leak via `docker history`).
