# 74 — Internationalization System & Agent-Generated Content

**Status:** Read-only research dossier  
**Date:** 2026-08-02  
**App root:** `PeakPerformanceData/peak_performance_data`  
**Scope:** End-to-end localization architecture (next-intl), message-file organization, key drift across locales, how AI chat locale works today, DB precedents for multilingual dynamic content, and a concrete storage/render recommendation for multi-agent coaching insights.  
**No product code was modified.** This file is the only write.

**Related dossiers:** `03-insight-schema.md` (Insight contract; monolingual `claim`), `17-supabase-ai-schema.md` (`insights` migration unapplied), `29-ui-surfaces.md` (insight UI inventory; note: InsightCard/CoachInbox now exist on disk), `62-multilingual-agents.md` (external multilingual agent research).

---

## 1. Executive verdict

The product UI is a mature **next-intl v4** setup with four locales (`en`, `es`, `ca`, `zh`), ~6.9k leaf keys in `en.json`, route-aware message-bundle splitting (~35KB shell vs ~270–350KB full files), and user `preferred_language` persisted on `profiles`. **Agent-generated text is not part of that system.** Chat localization is prompt-only (`locale` from `useLocale()` → system prompt language block). The Insight artifact is a single monolingual `claim` string with no locale field. There is **no DB precedent for locale columns on user-visible content** beyond `profiles.preferred_language` and metadata `user_feedback.locale`.

**Key drift (measured 2026-08-02):** `en` has **6933** leaf keys; `es`/`ca` **6856**; `zh` **6859**. **77 keys present in `en` are missing from es/ca/zh** (adminDashboard + playerDashboard.hero + tennisAnalytics.pointReplay). **zh has 3 orphan keys** under `messaging.addParticipants.*` not in en/es/ca. Tooling exists (`scripts/sync-translations.js`) but is not wired into npm/CI and currently uses a **hardcoded absolute path** to another machine layout.

**Recommendation:** Store a **canonical structured insight** (locale-independent facts: category, numeric evidence, action types, confidence) plus a **`narratives` JSONB map keyed by locale** (`en`/`es`/`ca`/`zh`). Render with `useLocale()` picking the narrative; fall back `preferred_language` → `en`. Do **not** put agent prose into `messages/*.json`. Chrome (labels, confidence badges, review tabs) should move into next-intl; prose stays in DB narratives.

---

## 2. Message files (`messages/`)

### 2.1 Files and sizes

| File | Approx size | Leaf key count |
|------|-------------|----------------|
| `messages/en.json` | 347 KB | **6933** |
| `messages/es.json` | 316 KB | **6856** |
| `messages/ca.json` | 316 KB | **6856** |
| `messages/zh.json` | 271 KB | **6859** |

All four appear modified in the working tree (per conversation git status).

### 2.2 Nesting convention

- Root keys = **top-level namespaces** (94 in `en`).
- Nested objects use camelCase segment names.
- Leaf values are almost always strings (ICU MessageFormat where needed).
- Nesting depth: leaves mostly at depth **2–4**; max depth **6** (38 leaves at depth 6).
- Access pattern in code: `useTranslations('namespace.sub')` then `t('leaf')`, or bare `useTranslations()` with `t('namespace.leaf')`.

Example shape:

```json
{
  "common": { "loading": "Loading..." },
  "ai": {
    "assistant": { "title": "AI Assistant", "placeholder": "Type or speak..." }
  },
  "tennisAnalytics": {
    "progress": {
      "findings": {
        "templates": {
          "mostImproved": "{metric} improved from {early} to {recent} (+{delta}). ..."
        }
      }
    }
  }
}
```

### 2.3 Namespace organization (94 top-level)

Organized by **product surface / role**, not by technical layer. Largest namespaces by leaf count:

| Namespace | ~Keys | Role |
|-----------|------:|------|
| `tennisAnalytics` | 738 | Tennis match/progress UI |
| `coach` | 579 | Coach training/players/tournaments |
| `performanceTests` | 465 | Fitness / physical tests |
| `playerDashboard` | 401 | Player home |
| `coachDashboard` | 347 | Coach home |
| `settings` | 316 | Settings |
| `tournaments` | 281 | Tournaments |
| `charts` | 229 | Wearable charts |
| `tennisBench` | 210 | Public tennis-bench marketing |
| `ai` | 62 | AI assistant chrome only |

Other notable roots: `auth`, `messaging`, `landing`, `management`, `parent*`, `admin*`, `validation`, `apiErrors`, `common`, `navigation`, `sidebar`, `accessibility`.

**Agent prose is not a namespace.** The `ai` namespace holds UI chrome (titles, placeholders, confirm buttons), not generated insights.

---

## 3. Library and configuration

### 3.1 Stack

| Piece | Detail |
|-------|--------|
| Library | **`next-intl` `^4.6.1`** (`package.json`) |
| Plugin | `next-intl/plugin` in `next.config.js` → `createNextIntlPlugin()` (defaults to `src/i18n/request.ts`) |
| Routing | `src/i18n/routing.ts` — `defineRouting({ locales: ['en','es','zh','ca'], defaultLocale: 'en' })` |
| Navigation | `createNavigation(routing)` exports `Link`, `redirect`, `usePathname`, `useRouter`, `getPathname` |
| Request config | `src/i18n/request.ts` — `getRequestConfig` loads messages via `getCachedLocaleMessages(locale)` |
| Message cache | `src/i18n/messages-cache.ts` — process-level `Map` + React `cache()` to avoid double-parsing ~320KB JSON per SSR request |

### 3.2 Namespace-splitting optimization

**Why:** Full locale JSON is ~270–350KB. Serializing the entire bundle into every `NextIntlClientProvider` bloated RSC payloads and hydration.

**How:**

1. **`scripts/generate-route-namespaces.js`** walks `src/app/[locale]/` route segments, follows static/dynamic import graphs, and collects every top-level namespace from `useTranslations` / `getTranslations` calls (plus a small `MANUAL_FILE_NAMESPACES` allowlist for bare `useTranslations()`).
2. Emits **`src/i18n/route-namespaces.generated.ts`**:
   - `SHELL_NAMESPACES` — persistent chrome (NavBar, Sidebar, Footer, alerts, …) after excluding heavy namespaces (`ai`, `charts`, `settings`, …).
   - `ROUTE_NAMESPACES` — map `/coach` → `[...]`, `/player` → `[...]`, etc.
3. **`src/i18n/client-messages.ts`**:
   - Root layout: `getShellClientMessages()` → ~35KB shell (or public auth/landing union).
   - Segment layouts: `RouteMessagesProvider` → `getRouteClientMessages(messages, route)` merges shell + route namespaces.
4. **Safety:** Unknown route segments fall back to the **full** message bundle so under-generation cannot blank the UI. Overestimation only costs a few extra KB.

Regenerate after adding routes/components/namespaces:

```bash
node scripts/generate-route-namespaces.js
```

Not wired into `package.json` scripts as of this research.

### 3.3 Provider nesting

```
[locale]/layout.tsx
  NextIntlClientProvider messages={shellMessages}   // getMessages() + filter
    …shell…
    [segment]/layout.tsx
      RouteMessagesProvider route="/coach"          // nested NextIntlClientProvider
        page + client tree
```

`RouteIntlProvider` sets `getMessageFallback` to return the full key string and logs missing keys in development.

---

## 4. Locale routing (`middleware` + `[locale]`)

### 4.1 Middleware chain (`src/middleware.ts`)

1. **`handleIntl`** (`src/middleware/intl.ts`) runs `createMiddleware(routing)` first — locale prefix redirects (`/` → `/en`) and rewrites.
2. CORS, crawler OG rewrites (pass `locale=` query), then auth/brand/authorization on non-API paths.
3. Helpers:
   - `getPathnameWithoutLocale(pathname)` — strips `/en|/es|/zh|/ca` prefix for path matching.
   - `getCurrentLocale(pathname)` — first segment if in `routing.locales`, else `defaultLocale`.
4. Sets `x-middleware-pathname` to the **locale-stripped** path for layout message filtering.

API routes (`/api/*`) skip auth middleware; they do **not** get a locale from the URL. Chat locale arrives in the JSON body instead.

### 4.2 App Router segment

All localized pages live under `src/app/[locale]/…`. Invalid locales → `notFound()` from the locale layout. `<html lang={locale}>` is set from the segment.

---

## 5. Consuming translations

### 5.1 Client components

```ts
'use client'
import { useTranslations, useLocale, useFormatter } from 'next-intl'

const t = useTranslations('coach.players')
const locale = useLocale()
const format = useFormatter()

t('title')
t('countLabel', { count: 3 })
format.dateTime(date, { dateStyle: 'medium' })
```

Requires a `NextIntlClientProvider` ancestor (root shell and/or `RouteMessagesProvider`).

### 5.2 Server components / Route Handlers that render UI

```ts
import { getTranslations, getLocale, getMessages } from 'next-intl/server'

const t = await getTranslations('performanceTests')
const locale = await getLocale()
```

`getMessages()` powers the root layout provider. Segment providers use `getRequestLocaleMessages(locale)` from the module cache.

### 5.3 Rich text

`t.rich('key', { name: (chunks) => <strong>{chunks}</strong> })` — used e.g. in invitations and tennis import copy.

---

## 6. Dynamic values, plurals, dates, numbers

### 6.1 ICU in message files

- **Interpolation:** `{name}`, `{count}`, `{metric}`, etc. (~394 strings with `{vars}` in `en`).
- **Plurals:** ICU `{count, plural, one {…} other {…}}` (~32 strings in `en`). Example: `messaging.participantsCount`.
- Chinese often uses non-plural forms (e.g. `{count} 位参与者`) — valid; ICU categories differ by locale.

### 6.2 Dates

| Mechanism | Where | Notes |
|-----------|-------|-------|
| `useFormatter().dateTime` | e.g. coach players page | next-intl / Intl wrapper |
| `date-fns` + `getDateLocale()` | `src/lib/utils/dateFormat.ts` | Maps `en→enUS`, `es→es`, `ca→ca`, `zh→zhCN` |
| `Intl.DateTimeFormat` | Some tennis progress UI | Occasionally **hardcoded `'en-GB'`** (locale leak) |
| `formatRelative` | `dateFormat.ts` | **"Today"/"Yesterday" hardcoded English** — gap |

### 6.3 Numbers

Primarily `Intl.NumberFormat(locale, …)` in chart tooltips (`GraphContainerRecharts`). Not centralized via `useFormatter().number` everywhere.

### 6.4 Language preference persistence

- URL locale is source of truth for UI (`/es/...`).
- `LanguageSwitcher` does full navigation to `/${newLocale}${pathname}`; optional `PATCH /api/user/language` → `profiles.preferred_language` + auth user metadata.
- Valid codes: `en | es | ca | zh`.
- Also set at claim-account / invitation setup.
- `localStorage['preferred-language']` for session persistence.

---

## 7. Translation tooling and key drift

### 7.1 Tooling

| Tool | Role | Status |
|------|------|--------|
| `scripts/sync-translations.js` | Diff `en` → ca/es/zh; insert **English placeholders** for missing keys; rewrite locale files | Exists; **not in npm scripts / CI**; hardcoded `MESSAGES_DIR` to `/Users/danielsilva/Desktop/PeakPerformanceData/...` (wrong monorepo root) |
| `scripts/generate-route-namespaces.js` | Bundle-size namespace map | Manual run |
| CI check for missing keys | — | **None found** |

There is **no** read-only drift reporter in-repo (sync mutates files).

### 7.2 Measured drift (2026-08-02)

**In `en` but missing from `es`, `ca`, and `zh` (77 keys):**

| Area | Count | Examples |
|------|------:|----------|
| `adminDashboard.attendance.*` | 5 | `cancellationRate`, `topReasons`, … |
| `adminDashboard.coaches.*` | 29 | table headers, pending actions, … |
| `adminDashboard.errors.*` | 4 | `unableToLoad*` |
| `adminDashboard.executive.*` | 21 | `sessionsThisMonth`, `courtUtilization`, … |
| `playerDashboard.hero.*` | 12 | `ready`, `rest`, `vo2maxLabel`, … |
| `tennisAnalytics.pointReplay.*` | 6 | `title`, `emptyTitle`, host/guest fallbacks |

**In `zh` but missing from `en` (and es/ca) — 3 orphan keys:**

- `messaging.addParticipants.alreadyInConversation`
- `messaging.addParticipants.defaultTitle`
- `messaging.addParticipants.description`

`es` and `ca` have **zero** keys absent from `en` (they are strict subsets aside from the shared 77-gap).

**Implication:** New English UI strings recently landed without a sync pass. Agent work should not assume locale files are complete; chrome for insight UI must be added to all four files (or sync fixed and run).

---

## 8. Precedents for multilingual *dynamic* content

### 8.1 Database

Searched migrations / `database.types.ts` for locale columns, `*_en`/`*_es` content columns, translation tables:

| Precedent | What it stores | Multilingual content? |
|-----------|----------------|------------------------|
| `profiles.preferred_language` | User preference (`en\|es\|ca\|zh`) | Preference only |
| `user_feedback.locale` | Locale at feedback submit time | Metadata, not translated body |
| `ai_conversations.messages` | Chat JSONB as spoken | Single-language transcript per turn; no parallel locales |
| `insights.claim` (migration `20260727_insight_store.sql`, **not applied live**) | Single `TEXT` claim | **Monolingual**; no locale column |
| `coach_reviews.edited_claim` | Coach edit of claim | Monolingual |
| `preference_memory` | Includes `language` preference type | Preference extraction, unused for rendering |

**No table stores parallel locale variants of product/DB content** (no `translations` table, no `title_i18n` JSONB pattern in production schema).

### 8.2 Structured facts + message-file narratives (best in-app precedent)

`src/lib/tennis/progress-insights.ts` emits **locale-agnostic findings**:

```ts
{ severity, template: 'findings.templates.mostImproved', values: { metric, early, recent, delta } }
```

`TennisProgressContent` renders with next-intl:

```ts
t(finding.template, { ...finding.values, metric: metricLabel(t, key) })
```

This is the correct pattern for **finite, deterministic** narratives. It does **not** scale to open-ended LLM coaching prose (combinatorial explosion of templates).

### 8.3 Chart / tennis “insights”

Rule-based or metadata-driven chips use `t('charts.insights.*')` / `t('tennisAnalytics.insights.*')` for labels; numeric values stay untranslated. Unrelated to the agentic `Insight` schema.

---

## 9. How AI responses are localized today

### 9.1 Interactive chat path

```
Client (useAIAgent)
  useLocale() → body.locale
       ↓
POST /api/ai-agent  (edge)
  const { locale, messages, sessionId } = await req.json()
  systemPrompt = getSystemPrompt(userName, locale, orgName, userRole)
       ↓
LLM stream → assistant content (opaque string in user language)
```

**Files:**

- `src/hooks/ai/useAIAgent.ts` — `body: { locale, … }`
- `src/app/api/ai-agent/route.ts` — reads `locale`, injects into system prompt (~L163)
- `src/lib/ai/prompts/systemPrompt.ts` — `languageBlock(locale)`:

```
## Language
- Respond in the same language the user speaks
- Supported: Portuguese (PT), English (EN), Spanish (ES), Chinese (ZH)
- Current locale: ${locale}
```

**Gaps vs product locales:**

1. Prompt lists **Portuguese**, not **Catalan** (`ca` is a first-class UI locale).
2. No glossary injection; no structured locale field on stored messages.
3. `preferred_language` is **not** read by the AI route — only the request `locale` (URL).
4. Speech recognition maps `ca→ca-ES` / Whisper `ca` (`useSpeechRecognition.ts`); chat prompt still omits Catalan in the “Supported” list.
5. Secondary routes (e.g. `wearable-query`) do not take locale — they return data, not prose.

### 9.2 Nightly / structured insights path

Python `Insight` (`ppp_ai_agent/schemas/insight.py`) has a single `claim: str` — no locale. Persistence projects that string into `insights.claim`. UI (`InsightCard`) renders `insight.claim` as plain text. **No generation of four locale variants today.**

### 9.3 UI chrome for agent surfaces

`InsightCard` / `CoachInbox` hardcode English chrome (“Approved”, “Pending Review”, “just now”, confidence labels). They do **not** call `useTranslations`. Chat chrome uses the `ai` namespace.

---

## 10. What the UI needs to render a locale-variant insight

Given current `InsightData`:

```ts
claim: string  // single language
```

To support four locales without message files:

1. **Data shape** must expose narratives (or a resolved claim for the active locale) from the BFF.
2. **Picker:** `const locale = useLocale()`; choose `narratives[locale] ?? narratives[preferred] ?? narratives.en ?? claim`.
3. **Chrome i18n:** Move CoachInbox tabs, review badges, relative time, confidence labels into `messages` (e.g. `ai.insights.*`).
4. **Evidence chips:** Keep metric **values/units** as numbers; localize metric **display names** via existing chart/tennis label namespaces where possible, or store stable metric keys + translate in UI.
5. **Actions:** Either translate `description` per locale in `narratives`, or store `action_type` enums + static message keys for known CTAs (hybrid).
6. **Coach edit:** Editing one locale’s claim must not silently desync others — either edit all locales, mark others stale, or edit canonical + regenerate.

---

## 11. Recommendation: store & render agent insights across four locales

Aligned with `62-multilingual-agents.md` (“canonical structured facts + locale renderings”) and the tennis progress-findings pattern.

### 11.1 Design principles

1. **Never** put open-ended agent prose in `messages/*.json`.
2. **Canonical structured payload** is the source of truth for evidence, routing, eval, and safety.
3. **Narratives are projections** — generated (and safety-checked) per locale, stored beside the canonical row.
4. **UI locale** (`useLocale`) selects narrative; batch jobs use athlete/coach `preferred_language` as primary generation target and may lazily fill others.
5. **Fallback chain:** active locale → `en` → any available narrative → show structured chips only.

### 11.2 Proposed schema (evolution of `insights`)

Keep existing columns for identity/routing; extend:

```sql
-- Additive columns on insights (conceptual)
canonical_locale TEXT NOT NULL DEFAULT 'en',  -- locale used for reasoning / first draft
claim TEXT NOT NULL,                          -- keep: primary narrative (canonical_locale) for backward compat
narratives JSONB NOT NULL DEFAULT '{}',
-- narratives shape:
-- {
--   "en": { "claim": "...", "actions": [{ "action_type": "adjust_load", "description": "..." }], "summary": "..." },
--   "es": { "claim": "...", "actions": [...] },
--   "ca": { ... },
--   "zh": { ... }
-- }
narrative_status JSONB NOT NULL DEFAULT '{}',
-- { "es": "ready"|"stale"|"pending"|"failed", ... }
schema_version INT NOT NULL DEFAULT 1
```

**Canonical (locale-independent) fields stay as today:**

- `category`, `confidence`, `evidence[]` (numeric `value`/`unit`/`trend` + stable `metric` key + `source`), `requires_coach_review`, `source`, `trigger`, ids, timestamps.

**Pydantic (`Insight`) additions:**

```python
canonical_locale: Literal["en","es","ca","zh"] = "en"
narratives: dict[str, InsightNarrative] = {}  # claim + localized action descriptions
# claim remains required = narratives[canonical_locale].claim for wire compat
```

Optional later: separate `insight_narratives(insight_id, locale, claim, actions, updated_at)` if JSONB maps become awkward for partial updates / RLS — not required for v1.

### 11.3 Generation flow

```
Specialist reasoning (prefer English CoT / structured tool results)
        ↓
Canonical Insight (evidence numbers + category + action_types)
        ↓
Narrative renderer (LLM) × locales needed
  - Always generate preferred_language of athlete (and coach if review)
  - Optionally generate remaining locales async
  - Inject domain glossary for ca/zh (see dossier 62)
  - Safety gate per locale (refusal / medical claim parity)
        ↓
Persist claim + narratives JSONB
```

Chat-triggered insights: generate **active UI locale** immediately; enqueue others. Nightly batch: generate athlete `preferred_language` + `en` minimum.

**Do not** machine-translate an English claim blindly into ca/es/zh without claim-level checks (safety parity gap documented in dossier 62).

### 11.4 Rendering flow

```
BFF GET /api/ai-agent/insights
  → returns full narratives map (or server-resolved claim for ?locale=)
Client InsightCard
  locale = useLocale()
  text = narratives[locale]?.claim ?? narratives.en?.claim ?? insight.claim
  actions = narratives[locale]?.actions ?? insight.actions
  evidence chips: format numbers with Intl / useFormatter; label metrics via t() when key known
```

Server Components can resolve the same way with `getLocale()`.

### 11.5 UI components to change

| Component / surface | Change |
|---------------------|--------|
| `src/components/insights/InsightCard.tsx` | Resolve claim/actions from `narratives`; i18n chrome via `useTranslations('ai.insights')`; locale-aware relative time |
| `src/components/insights/CoachInbox.tsx` | Translate tabs/empty states; pass locale into fetch if BFF resolves server-side |
| `src/components/insights/InsightStrip.tsx` | Same claim resolution |
| `src/app/[locale]/coach/insights/page.tsx` | Ensure route namespaces include `ai` (already on `/coach` map) |
| `src/app/api/ai-agent/insights/route.ts` | Optional `locale` query; do not strip narratives |
| Chat FAB / AI modal | Keep streaming as opaque text; if structured insight cards appear in chat, reuse InsightCard resolver |
| `messages/{en,es,ca,zh}.json` | Add `ai.insights.*` chrome keys only — not claims |
| Python `schemas/insight.py` + `store_insight` | Persist narratives; set `canonical_locale` |
| Nightly batch / specialists | Multi-locale narrative step + `preferred_language` lookup |

### 11.6 What not to do

- Do not add thousands of insight strings to JSON message files.
- Do not rely solely on “respond in user language” for **stored** cards (another user/locale may open them later — coach vs athlete language mismatch).
- Do not store only English and MT at read time in the UI (latency + safety).
- Do not leave InsightCard chrome English-only while narratives are localized.

### 11.7 Sync / ops notes for the static i18n system

Before shipping insight chrome keys:

1. Fix `sync-translations.js` `MESSAGES_DIR` to the monorepo path (or `__dirname`-relative).
2. Add a **CI drift check** (fail if leaf-key sets differ) — prefer read-only check over silent English placeholders.
3. Backfill the current **77 missing keys** into es/ca/zh.
4. Remove or promote the **3 zh orphan** messaging keys into `en` as SSoT.
5. Fix system prompt Supported list: **add Catalan, drop or clarify Portuguese** to match product locales.
6. Consider reading `preferred_language` in nightly generation even when no UI locale exists.

---

## 12. File index (absolute paths)

| Path | Role |
|------|------|
| `/Users/danielsilva/Desktop/PeakPerformanceDataMonorepo/PeakPerformanceData/peak_performance_data/messages/{en,es,ca,zh}.json` | Static UI strings |
| `/Users/danielsilva/Desktop/PeakPerformanceDataMonorepo/PeakPerformanceData/peak_performance_data/src/i18n/routing.ts` | Locales + navigation |
| `/Users/danielsilva/Desktop/PeakPerformanceDataMonorepo/PeakPerformanceData/peak_performance_data/src/i18n/request.ts` | next-intl request config |
| `/Users/danielsilva/Desktop/PeakPerformanceDataMonorepo/PeakPerformanceData/peak_performance_data/src/i18n/messages-cache.ts` | Locale JSON cache |
| `/Users/danielsilva/Desktop/PeakPerformanceDataMonorepo/PeakPerformanceData/peak_performance_data/src/i18n/client-messages.ts` | Shell/route message picking |
| `/Users/danielsilva/Desktop/PeakPerformanceDataMonorepo/PeakPerformanceData/peak_performance_data/src/i18n/route-namespaces.generated.ts` | Generated namespace map |
| `/Users/danielsilva/Desktop/PeakPerformanceDataMonorepo/PeakPerformanceData/peak_performance_data/scripts/generate-route-namespaces.js` | Namespace generator |
| `/Users/danielsilva/Desktop/PeakPerformanceDataMonorepo/PeakPerformanceData/peak_performance_data/scripts/sync-translations.js` | Key sync (placeholder EN) |
| `/Users/danielsilva/Desktop/PeakPerformanceDataMonorepo/PeakPerformanceData/peak_performance_data/src/middleware/intl.ts` | Locale middleware |
| `/Users/danielsilva/Desktop/PeakPerformanceDataMonorepo/PeakPerformanceData/peak_performance_data/src/components/providers/RouteMessagesProvider.tsx` | Per-segment provider |
| `/Users/danielsilva/Desktop/PeakPerformanceDataMonorepo/PeakPerformanceData/peak_performance_data/src/hooks/ai/useAIAgent.ts` | Client locale → API |
| `/Users/danielsilva/Desktop/PeakPerformanceDataMonorepo/PeakPerformanceData/peak_performance_data/src/lib/ai/prompts/systemPrompt.ts` | Language block |
| `/Users/danielsilva/Desktop/PeakPerformanceDataMonorepo/PeakPerformanceData/peak_performance_data/src/app/api/ai-agent/route.ts` | Chat BFF |
| `/Users/danielsilva/Desktop/PeakPerformanceDataMonorepo/PeakPerformanceData/peak_performance_data/src/app/api/user/language/route.ts` | preferred_language API |
| `/Users/danielsilva/Desktop/PeakPerformanceDataMonorepo/PeakPerformanceData/peak_performance_data/src/components/insights/InsightCard.tsx` | Renders `claim` monolingually |
| `/Users/danielsilva/Desktop/PeakPerformanceDataMonorepo/PeakPerformanceData/peak_performance_data/src/lib/tennis/progress-insights.ts` | Structured + template precedent |
| `/Users/danielsilva/Desktop/PeakPerformanceDataMonorepo/PeakPerformanceData/ppp_ai_agent/schemas/insight.py` | Agent Insight SSoT |
| `/Users/danielsilva/Desktop/PeakPerformanceDataMonorepo/PeakPerformanceData/peak_performance_data/supabase/migrations/20260727_insight_store.sql` | insights table (locale-less) |

---

## 13. Bottom line

Static UI i18n is production-grade next-intl with route-scoped bundles. Agent content is a different problem: chat is prompt-localized per request; stored insights are monolingual. Adopt **canonical structured insight + `narratives` per locale**, resolve with `useLocale()`, and localize only chrome through message files. Close the **77-key** static drift and fix Catalan in the system prompt before treating multilingual agent output as production-ready.
