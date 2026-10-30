# Plan: Move the PPD Next.js app off Vercel onto Hetzner (Coolify) and add Supabase-to-R2 backups

Status: draft for owner approval (owner: daniel). Written 2026-10-23.
Scope: `PeakPerformanceData/peak_performance_data` (Next.js 15.5, pnpm 9.15.0) plus infrastructure around it.
Nothing in this plan has been executed. Commands and code below are drafts and have not been run.

## 0. Why, and what we measured

- Cold starts are Vercel serverless instance provisioning, not Supabase (Supabase gateway measured 3-133ms in earlier traces). An always-on Node process has no cold start.
- User has no live users, so a fast hard cutover is acceptable. Vercel stays only as a short rollback target.
- Supabase stays (Free plan for now). Backups are replaced by our own nightly dump to Cloudflare R2.

### Fleet inspected over SSH on 2026-10-23 (read-only commands only)

| SSH alias | Hostname | Location | Spec | State | Latency to Supabase London* |
|---|---|---|---|---|---|
| `ds-wearables-extract` | Wearables-Data-Extraction (116.202.100.150) | Falkenstein, DE | 4 vCPU, 7.6 GB RAM, 75 GB disk (33% used) | up 35 weeks. Docker: traefik, ppc-api, ppc-redis, ppd-api, ppd-scheduler, open-wearables stack (backend, celery worker/beat, postgres:18, redis:8) | about 22 ms |
| `ds-wearables-process` | Wearables-Data-Processing (89.167.47.236) | Helsinki, FI | 2 vCPU, 3.7 GB RAM, 38 GB disk (38% used) | up 35 weeks. Docker: only `ppc-api` | about 36 ms |
| `r4e` | Run4ExcellenceApp (46.225.78.85) | Nuremberg, DE | 2 vCPU, 3.7 GB RAM, 38 GB disk | up 31 weeks. Docker: flaresolverr, nocodb, nocodb-db. **Disk 99% full (546 MB free); 13 GB in /root/db_backups** | about 17 ms |
| `ds-catapult` | 46.62.216.60 | unknown | unknown | **Unreachable**: SSH timed out, ping 100% loss, TCP 22 timed out | n/a |

*Measured as TCP connect time to `aws-0-eu-west-2.pooler.supabase.com:6543` (AWS London), 6 samples each, the real database path. ICMP/HTTPS to `<ref>.supabase.co` goes through Cloudflare and does not measure the database location, so it was discarded.

Vercel `lhr1` to Supabase London is about 1-2 ms. Moving the app to Hetzner adds the numbers above to every sequential database query. A route making 6 sequential queries pays about 130 ms extra from Falkenstein and about 215 ms from Helsinki.

## 1. Decisions needed before buying (blocking)

| # | Decision | Recommendation | Why |
|---|---|---|---|
| D1 | Server location | **Falkenstein (fsn1) or Nuremberg (nbg1), not Helsinki** | Saves about 14 ms per query vs Helsinki. The console URL currently has `location=hel1`; change it. Hetzner private networks work across fsn1/nbg1/hel1 (same eu-central zone; verify in console), so the web box can still reach the wearable servers privately. |
| D2 | Server size | CX23 (2 vCPU / 4 GB) is enough to start if builds run in GitHub Actions. Choose CX33 (4 vCPU / 8 GB, about EUR 10.44 incl. VAT) if you want headroom for Coolify + 2 more apps. | Cost-Optimized plans show "Limited availability". Rescaling later reprices to the current rate card. |
| D3 | OS image | **Ubuntu 24.04 LTS**, not 26.04 | Matches the other three servers. Verify Coolify's supported OS list before choosing 26.04. |
| D4 | Supabase region | Stay in London for now | A move to Frankfurt would cut Hetzner-DE latency to about 5-10 ms but requires a new project, data migration, auth user migration (password hashes), and new keys. Revisit only if measurements in section 8 show DB round-trips dominate. |
| D5 | `/presentation/*` rewrites | Keep that one small static project (`ppd-academies-presentation`) on Vercel Hobby, or move it to Cloudflare Pages | `vercel.json` rewrites to `ppd-academies-presentation-daniellpsbs-projects.vercel.app`. "Cut Vercel" fully means moving it too. It is static and free; Cloudflare Pages is the clean option. |
| D6 | Which box hosts backups | `ds-wearables-process` (Helsinki, 862 MB used of 3.7 GB, only one container) | Different failure domain from the new web box and from the main Falkenstein box. |
| D7 | `ds-catapult` and `r4e` | Out of scope except two flags (section 12) | Catapult is unreachable; r4e is almost out of disk. |

## 2. Target architecture

```
Browser -> Cloudflare (DNS, proxy, cache /_next/static, WAF, TLS)
        -> web box (Hetzner fsn1/nbg1): Traefik (Coolify) -> Next.js standalone container
        -> Supabase London (auth, Postgres, storage)  [Free plan]
        -> api.wearablesync.app (Falkenstein extraction server)  [existing]
        -> Cloudflare R2 (videos, backups)  [existing]
GitHub Actions -> builds image -> GHCR -> Coolify webhook -> deploy
ds-wearables-process -> nightly pg_dump of Supabase -> age-encrypt -> R2 bucket ppd-backups
```

Roles stay separate: web (new), wearable extraction (existing), wearable processing and backups (existing). Future apps (WhatsApp coach, supplement tracker) add containers on the web box or a new role-based server; see section 13.

## 3. Phase A: Backups first (do this before any migration, about 1 hour)

Goal: nightly encrypted logical dump of Supabase to R2 with retention, a dead-man's-switch alert, and one verified restore.

1. **Cloudflare R2**: create bucket `ppd-backups` (private). Create an R2 API token scoped to that bucket with Object Read and Write. Add a lifecycle rule: delete objects under `supabase/daily/` after 35 days. Keep `supabase/monthly/` with no expiry.
2. **Encryption key**: on your Mac run `age-keygen -o ppd-backup.key`. Store the private key in a password manager and a second offline location. Put only the public key (`age1...`) on the server. Without the private key the backups are unrecoverable.
3. **Supabase connection**: use the **session pooler** (port 5432 on `aws-0-eu-west-2.pooler.supabase.com`, user `postgres.<project-ref>`). The direct `db.<ref>.supabase.co` host is IPv6-only on Free plans. Get the database password from Supabase dashboard (Connect). Confirm server version with `select version();` and use a `pg_dump` client of the same or newer major version.
4. **Server setup** on `ds-wearables-process`:
   - `apt install -y age rclone` (Docker is already present, used for `pg_dump`).
   - `/root/.backup.env` (chmod 600) with `PGPASSWORD`, `PGUSER`, `PGHOST`, `AGE_RECIPIENT`, `HEALTHCHECK_URL`, plus an rclone remote `r2` configured via `rclone config` (S3, provider Cloudflare, endpoint `https://<accountid>.r2.cloudflarestorage.com`).
5. **Script** `/usr/local/bin/ppd-backup.sh` (draft):

```bash
#!/usr/bin/env bash
set -euo pipefail
source /root/.backup.env
STAMP=$(date -u +%Y%m%dT%H%M%SZ)
OUT=/var/backups/ppd/supabase-$STAMP.dump.age
mkdir -p /var/backups/ppd
docker run --rm -e PGPASSWORD="$PGPASSWORD" postgres:17-alpine \
  pg_dump "host=$PGHOST port=5432 user=$PGUSER dbname=postgres sslmode=require" \
  -Fc --no-owner --no-acl \
  | age -r "$AGE_RECIPIENT" -o "$OUT"
rclone copyto "$OUT" "r2:ppd-backups/supabase/daily/$(basename "$OUT")"
if [ "$(date -u +%d)" = "01" ]; then
  rclone copyto "$OUT" "r2:ppd-backups/supabase/monthly/$(basename "$OUT")"
fi
find /var/backups/ppd -type f -mtime +3 -delete
curl -fsS -m 10 "$HEALTHCHECK_URL" >/dev/null
```

6. **Schedule**: `15 2 * * * /usr/local/bin/ppd-backup.sh >> /var/log/ppd-backup.log 2>&1` (root crontab).
7. **Dead-man's switch**: create a free check at healthchecks.io (period 1 day, grace 2 hours), email/Telegram alert, put its ping URL in `HEALTHCHECK_URL`.
8. **Restore test (required)**: download one dump from R2, `age -d -i ppd-backup.key`, `pg_restore` into a throwaway `postgres:17` container, compare table row counts against the live project. Record the result in `docs/audits/` evidence.
9. **Known gap**: logical dumps do not include Supabase Storage object files. Check whether any Supabase Storage buckets hold data you cannot regenerate; if so add an `rclone sync` job for them. Tennis videos already live in R2.
10. **Also back up server-local state** (same pattern, separate script, later): open-wearables `postgres:18` and ClickHouse on `ds-wearables-extract`. Currently no backup evidence was found for these; add to backlog.

## 4. Phase B: Provision and harden the web server (about 1 hour)

1. In the Hetzner console (project PeakPerformanceData): CX23 or CX33, location per D1, Ubuntu 24.04, IPv4 + IPv6, add your SSH public key, enable **Backups** (20% surcharge), attach a **Cloud Firewall** allowing inbound 80/443 only (plus 22 temporarily from your IP).
2. SSH in, then:
   - Create a non-root sudo user; disable root SSH and password auth (`/etc/ssh/sshd_config.d/`).
   - `apt update && apt -y upgrade`; enable `unattended-upgrades`.
   - Install Tailscale, `tailscale up --ssh`; then remove public port 22 from the firewall.
   - Add a 2 GB swapfile as protection against OOM during rare spikes.
3. Optional hardening: `fail2ban` is unnecessary once SSH is Tailscale-only.

## 5. Phase C: Coolify (about 30 minutes)

1. Install Coolify with the official script from coolify.io/docs (read the script before piping to bash).
2. Reach the dashboard on port 8000 only through Tailscale (do not expose 8000 publicly); set the instance domain later if wanted.
3. Create the first admin user immediately.
4. Add GHCR as a registry (read-only PAT).
5. Coolify instance backup: enable the scheduled backup to R2 (S3 target) and save `APP_KEY` from `/data/coolify/source/.env` in the password manager. Docs state restores need it.
6. Add Cloudflare origin certs or use Let's Encrypt via Traefik (HTTP-01 works with the Cloudflare proxy in "Full (strict)" once the cert is issued; if issuance fails, temporarily DNS-only).

## 6. Phase D: Containerize the app (about half a day, the real work)

Already true: `next.config.js` has `output: 'standalone'`. Needed:

1. **Dockerfile** (draft, multi-stage). It must reproduce `vercel.json` `installCommand`, which builds vendored libs first:
   - `bash scripts/ensure-vendor-stubs.sh`
   - `pnpm run build:courtviz` and `pnpm run build:bodyviz`
   - `pnpm install --frozen-lockfile`, then `pnpm run build`
   - Final stage copies `.next/standalone`, `.next/static`, `public`; runs `node server.js` as a non-root user; `ENV PORT=3000 HOSTNAME=0.0.0.0`.
   - The `vendor/` checkouts are git submodules: use `actions/checkout` with `submodules: recursive` and a token that can read them.
   - Confirm the Node major version from `package.json`/`.nvmrc` and the sharp requirement for `next/image` (standalone needs `sharp` installed in production deps).
2. **Build-time vs runtime env**: every `NEXT_PUBLIC_*` variable is inlined at build, so pass them as Docker build args in CI. Server secrets are set in Coolify at runtime. Inventory from `.env.example`, `.env.production` (do not commit or log values) and the Vercel project env list.
3. **`.dockerignore`**: `node_modules`, `.next`, `.next-*`, `artifacts`, `test-results`, `.env*`, `firebase-debug.log`.
4. **GitHub Actions** workflow (draft outline): checkout with submodules, `docker/setup-buildx-action`, login to GHCR, `docker/build-push-action` with build args and GHA layer cache, then `curl` Coolify's deploy webhook (secret in GitHub). Tag images by commit SHA, keep `latest`.
5. **Healthcheck**: add a cheap `GET /api/health` (no DB) for Coolify and monitoring if one does not already exist; confirm before adding. This is application code and needs your approval.
6. **Vercel-specific code to handle** (found by grep):
   - `vercel.json` cron `cleanup-conversations` at `0 3 * * *` calling `/api/cron/cleanup-conversations`, which requires `Authorization` with `CRON_SECRET` (fail-closed). Replacement: a Coolify Scheduled Task or host crontab running `curl -fsS -H "Authorization: Bearer $CRON_SECRET" https://<domain>/api/cron/cleanup-conversations`. Verify the exact header the route expects before wiring.
   - `@vercel/speed-insights` (`src/components/layouts/LazyLayoutExtras.tsx`): works only on Vercel. Remove it (Sentry and the existing `WebVitalsReporter` remain).
   - `process.env.VERCEL_ENV` in `src/lib/perf/server-timing.ts`: harmless; unset means "not production" so server-timing could turn on when `PPD_TIMING=1`. Leave `PPD_TIMING` unset.
   - `vercel.json` redirects/rewrites: port `/strava-auth-callback` redirect and `/presentation/*` rewrites into `next.config.js` `redirects()`/`rewrites()` (or per D5).
   - `regions: ["lhr1"]` and `preferredRegion = 'lhr1'` exports are ignored off Vercel; leave them for now, clean up after cutover.
   - `fluid`: remove with `vercel.json`.
   - PWA service worker (`next.config.js`): keep. Cloudflare must not cache HTML or API responses (see section 7).
7. **Local proof before CI**: `docker build` and `docker run` on the Mac with a test env, hit `/login`, `/api/...` smoke routes. Application builds are normally off-limits for documentation work, so this step is an explicit approved implementation step.

## 7. Phase E: Staging deploy and measurement (about 2 hours)

1. Coolify: new Project, Application from Docker image (GHCR), domain `staging.<yourdomain>`, port 3000, healthcheck path, resource limits (for example memory 1.5 GB), restart policy `unless-stopped`.
2. Cloudflare DNS: `staging` A/AAAA to the server, proxied (orange cloud), SSL mode Full (strict).
3. Cloudflare cache rules: cache `/_next/static/*` (immutable), `/images/*` and other static assets; **bypass cache** for everything else (HTML, `/api/*`, `/_next/image` unless tested). Disable Rocket Loader, Auto Minify and any HTML rewriting.
4. Supabase Auth (dashboard, Auth, URL Configuration): add the staging URL to Site URL / Redirect URLs allow-list for testing. Same for any OAuth provider redirect lists used in staging.
5. Smoke test: signup, login (all roles: coach, player, parent, club admin), `/coach`, wearable fetch via `api.wearablesync.app`, Stripe test mode, file upload to R2, AI assistant.
6. **Measure** with the existing harnesses (`preview-timeline.mjs`, `ctx-browser-vs-curl.mjs`, `parallel-ctx.mjs`) pointed at staging, idle and burst:
   - Baselines on Vercel Node preview: click-to-dashboard about 4.6-5.3 s, click-to-network-idle about 7.7-8.5 s, `/coach` document about 2.1-2.7 s after idle.
   - Target on Hetzner: no idle penalty; dashboard well under 3 s; `/coach` TTFB under 1 s warm and cold alike.
   - Also run `ping`/TCP timing from the web box to the Supabase pooler and compare with section 0. If sequential-query latency dominates, apply D4 or reduce sequential queries.
   - Move the hardcoded Vercel protection-bypass token out of the harness and rotate it (still open from earlier work).

## 8. Phase F: External integrations checklist (do before cutover)

| Item | Action |
|---|---|
| Supabase Auth | Site URL and Redirect URLs include the production domain (unchanged if the domain stays the same) |
| Stripe | Webhook endpoint URL unchanged if domain unchanged; confirm `stripe_webhook_events` idempotency still works; verify signing secret in Coolify |
| OAuth providers (Strava `/api/strava-callback`, Garmin, others) | Callback URLs are domain-based; verify nothing references `*.vercel.app` |
| CORS allow-lists on the backends (`api.wearablesync.app`, extraction, ppc) | Add any new origin; same-domain production needs no change |
| Backend firewall | If the extraction/ppc backends allow-list Vercel egress IPs, replace with the web box IP |
| `INTERNAL_SERVICE_SECRET`, `CRON_SECRET`, Supabase keys, Stripe, LLM keys | Set in Coolify; compare variable names against the Vercel env export so none are missed |
| Sentry | Add the new environment/release tag; source map upload happens in CI (add `SENTRY_AUTH_TOKEN` as a GitHub secret if used) |
| Email (auth emails, provider SMTP) | Unchanged (Supabase) but verify SPF/DKIM untouched |
| Firebase | `firebase-debug.log` exists locally; confirm whether Firebase is used by the app at runtime and which domains it authorizes |

## 9. Phase G: Cutover (about 30 minutes, aggressive, no users)

1. Lower DNS TTL to 60 s a day before (Cloudflare proxied records are already effectively instant).
2. Final deploy of `main` to Hetzner and run the smoke checklist on `staging`.
3. In Coolify add the production domain to the app. In Cloudflare change the production record from Vercel to the Hetzner server (proxied).
4. Verify: login, dashboard, Stripe webhook test event, cron task manually, backup job still green.
5. Rollback (if broken): point the Cloudflare record back to Vercel (leave the Vercel project intact for 7 days). Do not delete anything before day 7.

## 10. Phase H: Remove Vercel (day 7+)

1. Delete or archive the Vercel projects `peak-performance-data` (old) and `peak-performance-data-v2` after one week of clean operation and a final env-var export stored offline.
2. In the repo (after approval): remove `vercel.json`, `deploy.sh` (Vercel script), `@vercel/speed-insights`, `fluid`; move redirects/rewrites to `next.config.js`; update `AGENTS.md` (header says "Vercel", and the invariant about `preferredRegion` and Edge-vs-Node measurements needs a note that it was measured on Vercel).
3. Close the stray preview deployments and revoke the Vercel CLI tokens used by the measurement harnesses.
4. Decide on D5 (presentation project).

## 11. Operations after cutover

- **Deploys**: push to `main` triggers GitHub Actions then Coolify webhook. Rollback: redeploy the previous image tag in Coolify.
- **Monitoring**: UptimeRobot or Better Stack free tier on `/api/health` and the login page; healthchecks.io for backup and cron jobs; Coolify notifications to email/Telegram; Sentry already present.
- **Patching**: unattended security upgrades; monthly `apt full-upgrade` and Coolify update window; reboot when the kernel updates.
- **Backups**: Supabase nightly dump (Phase A), Coolify instance backup, Hetzner server backups. Do a restore drill quarterly.
- **Capacity**: alert at 80% disk and 85% memory; check `docker system df` monthly and prune.

## 12. Flags found during the audit (not part of the migration, need your attention)

1. **`r4e` disk is 99% full** (546 MB free, 13 GB in `/root/db_backups`, 2 GB in `/var/log`, 15 GB in `/var/lib`). It can start failing writes at any time. I made no changes. Suggested: confirm what `db_backups` contains, move it to R2 or a Hetzner Storage Box, rotate logs. This server runs nocodb, which appears to be a separate project.
2. **`ds-catapult` (46.62.216.60) is unreachable** on SSH and ICMP. Check the Hetzner console (power state, firewall, IP change). A `MCPClickhouseCatapultSH` server exists in your tooling, so something probably depends on it.
3. **No backup evidence** for `postgres:18` (open-wearables) and ClickHouse on `ds-wearables-extract`.
4. `docs/architecture/deployment.md` describes `ds-wearables-process` as "unverified purpose". Observed today: it runs one `ppc-api` container only. Update the doc after migration (see below).

## 13. Reusable pattern for future apps (WhatsApp AI coach, supplement tracker)

- One **Supabase project per product** (separate users and blast radius). Free allows 2 active projects; Pro costs about $25 plus about $10 per extra project.
- One **Coolify** manages all servers over SSH. New server only when the security domain or resource profile differs (for example the WhatsApp worker plus Redis queue is a candidate for its own box).
- Per app: a repo with Dockerfile + GitHub Actions + Coolify app, a subdomain behind Cloudflare, secrets in Coolify.
- WhatsApp coach must follow: webhook receiver verifies signature, enqueues, returns 200 within seconds; a worker processes asynchronously; WhatsApp message ID is the idempotency key.
- Heavy data science and wearable processing stay on the Hetzner role servers, not in the web box.

## 14. Documentation and governance updates (required by repo standard)

- New ADR in `docs/decisions/`: "Self-host web app on Hetzner via Coolify; Supabase stays; R2 backups".
- Update `docs/architecture/deployment.md` (Vercel section replaced; Hetzner web box and backup box added; observed server facts above with 2026-10-23 evidence) and `docs/architecture/containers.md`.
- Add backup runbook to `docs/operations/runbooks-index.md`; add restore-drill evidence file under `docs/audits/`.
- Add the section 12 items to `docs/audits/remediation-backlog.md`.
- Run `node .devin/docs-tooling/src/cli.mjs check --repo .` and `catalog --repo . --check` (note: a catalog digest mismatch for `PPD-PORTFOLIO-AUDIT-REMEDIATION-BACKLOG` already existed).

## 15. Execution order and effort

| Order | Phase | Who | Approx. effort |
|---|---|---|---|
| 1 | Decisions D1-D7 | owner | 15 min |
| 2 | A: backups + restore test | owner credentials (R2, Supabase DB password), agent assists | 1 h |
| 3 | B+C: server, hardening, Coolify | owner buys server; agent assists over SSH | 1.5 h |
| 4 | D: Dockerfile, CI, code changes (cron, speed-insights, redirects) | agent implements, owner approves | 3-5 h |
| 5 | E: staging and measurement | agent | 2 h |
| 6 | F+G: integrations check and cutover | owner + agent | 1 h |
| 7 | H: Vercel removal, docs | agent after day 7 | 1-2 h |

Realistic total: 1-2 working days to cutover, plus the one-week soak before deleting Vercel.

## 16. Risks

- Single web node: a server failure means downtime until redeploy. Mitigation: Hetzner backups, one-click redeploy from GHCR to a fresh box (about 30 minutes), Cloudflare in front. A second node and load balancer can come later.
- Added query latency from Hetzner to London (section 0). Mitigation: Falkenstein/Nuremberg, fewer sequential queries, or a Frankfurt Supabase later.
- Supabase Free has no PITR and pauses on inactivity: nightly dumps give up to 24 h of data-loss exposure. Upgrade to Pro when real users arrive.
- Self-hosting moves patching and security to you. Mitigation: Tailscale-only SSH, firewall, unattended upgrades, Cloudflare proxy.
- Build complexity from the vendored `courtviz`/`bodyviz` submodules (pinned at different revisions). Do not normalize their versions during the move.
- Hetzner Cost-Optimized plans have limited availability and rescales reprice. If CX23 is out of stock, use CPX or Arm equivalents only after checking price in the console.
