# Bugfix Log

One line per fix. Most recent first.

## Session: Continuous QA/Security Remediation

- Add shared UUID validation utility at src/lib/validations/uuid.ts for reuse across admin and dashboard routes.
- Enable Sentry client maskAllText and add beforeSend PII filtering in sentry.client.config.ts.
- Add Sentry server beforeSend secret/PII filtering in sentry.server.config.ts.
- Restrict organizations public SELECT RLS policy to approved brand columns via secure view (20260815_organizations_brand_lookup_public.sql).
- Fix AI conversation memory access control: loadConversationContext now filters by user_id in addition to session_id.
- Fix AI proxy events route to inject session-derived identity, overriding client-supplied user_id/organization_id.
- Fix AI proxy feedback route to inject session-derived organization_id and user_id into forwarded payload.
- Fix AI proxy insights/[insightId]/review route to inject session-derived user_id and validate insightId.
- Fix AI proxy labs/trend route to inject session-derived user_id, overriding client-supplied query params.
- Fix coach athletes-matrix route to verify coach/club_admin/admin role before returning readiness data.
- Add audio file size (25MB) and MIME type validation to transcribe route.
- Add genetic upload file size (10MB), extension, and MIME type validation to genetics upload route.
- Add file_type allowlist validation to genetics upload route.
- Fix splash route SSRF: validate logoUrl against allowlist of trusted hosts before fetching.
- Reduce invitation GET endpoint exposure: remove inviter email from unauthenticated response, add masked email field.
- Add /messages to protectedPaths in middleware routes.ts.
- Add UUID format validation to admin update-user-role route.
- Add role enum validation to admin update-user-role route.
- Add UUID format validation to admin fetch-status route.
- Replace inline admin client construction with centralized createAdminClient in admin get-user-emails route.
- Add UUID format validation for each user ID in admin get-user-emails route.
- Make invited_by.email optional in accept-invitation page type to match reduced API response.
