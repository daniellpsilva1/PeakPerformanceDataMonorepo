# 77 — Design System & Component Conventions for Agent UI

**Status:** Read-only research dossier  
**Date:** 2026-08-02  
**App root:** `PeakPerformanceData/peak_performance_data`  
**Scope:** Document the existing design system so new multi-agent surfaces (InsightCard, coach approval queue, live tool progress, citations, confidence) compose from established primitives instead of inventing a parallel look.  
**Related dossiers:** `03-insight-schema.md` (data contract), `29-ui-surfaces.md` (where agent output lands), `61-streaming-agent-ui.md` (stream protocol).  
**No application code was modified.**

---

## Executive verdict

| Area | Finding |
|------|---------|
| UI library | **shadcn/ui** (New York, RSC, CSS variables, Lucide) under `src/components/ui/` (~75 files) |
| Tokens | HSL CSS vars in `globals.css` + vendor `ppd-variables.css`; Tailwind theme + `@/lib/design-tokens.ts` |
| Home-card shell | `rounded-lg bg-card p-5`, uppercase `text-[11px]` section titles, Lucide `h-4 w-4 text-muted-foreground/60`, focus ring `focus:ring-2 focus:ring-primary/40` |
| Best evidence-chip precedent | `FitnessTestSnapshotCard` `DeltaChip` + Garmin `InsightsStrip` + `Metric.trend` |
| Charts | **Recharts** (`recharts@^2.15.3`); sparklines in tennis progress / body dashboard / chart tooltips |
| AI chat today | `MessageBubble` + `ToolResultCard` (result-only); no pending tool UI, no citations, no InsightCard |
| Motion | Tailwind keyframes + `tailwindcss-animate` primary; **framer-motion** for landing + mobile sheets only |
| Icons | **lucide-react** |
| Project rules | No `AGENTS.md` / `.cursor/rules` in this monorepo for component style |

**Genuinely new primitives needed (see §10):** `InsightCard`, `EvidenceChip`, `ConfidenceIndicator`, `CoachApprovalQueue` (+ row), `ToolCallProgress`, `ReasoningBlock`, `CitationChip` / `CitationList`. Everything else should compose existing UI.

---

## 1. UI library setup (shadcn/ui)

### 1.1 Config (`components.json`)

```json
{
  "style": "new-york",
  "rsc": true,
  "tsx": true,
  "tailwind": {
    "config": "tailwind.config.js",
    "css": "src/app/globals.css",
    "baseColor": "neutral",
    "cssVariables": true
  },
  "iconLibrary": "lucide"
}
```

Aliases: `@/components`, `@/components/ui`, `@/lib`, `@/hooks`. Utils live primarily at `@/lib/core/utils` (`cn`); some AI files still import `@/lib/utils`.

### 1.2 Inventory of `src/components/ui/`

**shadcn / Radix primitives (typical):**  
`alert`, `alert-dialog`, `avatar`, `badge`, `button`, `calendar`, `card`, `checkbox`, `collapsible`, `command`, `dialog`, `dropdown-menu`, `form`, `input`, `label`, `popover`, `progress`, `radio-group`, `scroll-area`, `select`, `separator`, `sheet`, `skeleton`, `slider`, `switch`, `table`, `tabs`, `textarea`, `toast` / `toaster` / `use-toast`, `tooltip`, `pagination`, `sonner`.

**App-specific / composite (not stock shadcn):**  
`action-card`, `stat-card` (re-export of `Metric`), `metric`, `empty-state`, `page-header`, `page-skeleton`, `page-background`, `dashboard-skeletons`, `mobile-skeleton`, `skeleton-card`, `chart-container`, `container`, `content-reveal`, `loading-button`, `modern-form-card`, `user-card`, `BrandLogo`, `FlagIcon`, `LanguageSwitcher`, `NavBar`, `LandingNavBar`, `AccountMenu`, `BackButton`, `Footer`, `PhoneInput`, `date-*`, `color-picker`, `image-upload`, `lazy-component`, `prefetch-link`, `skip-to-content`, `suspense-boundaries`, `theme-toggle`, `toast-with-progress`, `virtualized-list`, `icons`, `button-auth`, `form-field`, `time-picker-input`.

**Pattern:** CVA (`class-variance-authority`) for variants; Radix primitives under the hood; `data-slot` attributes on Card/Badge; many interactive primitives marked `'use client'`. Pure presentational pieces (`button`, `card`, `badge`, `skeleton`, `empty-state`, `action-card`) often omit `'use client'` and remain RSC-safe.

---

## 2. Design tokens

### 2.1 Sources of truth (layered)

1. **Fallback `:root` / `.dark` in `src/app/globals.css`** — HSL channels without `hsl()` wrapper (shadcn convention).
2. **Vendor override:** `@import "../../vendor/courtviz/integration/css/ppd-variables.css"` (Courtviz / `@ppd/tokens`).
3. **Supplementary vars** in `globals.css` (`--info`, `--level-*`, `--chart-reference/grid/axis`, sidebar aliases, elevation steps).
4. **Tailwind `theme.extend`** in `tailwind.config.js` — maps CSS vars → utility classes.
5. **TS token helpers** in `src/lib/design-tokens.ts` — class-string recipes (`surfaces`, `spacing`, `statusColors`, `chartSeries`, `levelColors`, `sectionAccents`, `iconSizes`, combined `tokens` export).

### 2.2 Color system

| Token | Role |
|-------|------|
| `--primary` | Brand blue (`221 83% 53%` light / brighter in dark) |
| `--accent` / `--success` | Green success / accent (`~161 94% 30%`) |
| `--destructive` | Red errors / danger |
| `--warning` | Amber |
| `--info` | Cyan/sky |
| `--muted` / `--muted-foreground` | Secondary surfaces & captions |
| `--card` / `--surface` / `--surface-raised` | Elevation ladder |
| `--chart-1`…`--chart-6` | Series palette |
| `--level-excellent/good/average/poor` | Benchmark / readiness bands |
| `--border`, `--ring`, `--input` | Chrome |

**Semantic Tailwind colors:** `primary`, `secondary`, `destructive`, `muted`, `accent`, `success`, `warning`, `info`, `surface`, `elevation-{0..4}`, `card`, `popover`, `chart-*`, `level-*`.

**Status class recipes (`statusColors`):** emerald / amber / red / info with `.text`, `.bg`, `.border`, `.badge`, `.solid` — used by `Badge` variants `success-subtle`, `warning-subtle`, `destructive-subtle`, `info-subtle`.

**Dark mode:** `darkMode: ["class"]`. Dark body gets a subtle radial gradient. Cards prefer **border/elevation over heavy shadows** (`dark:shadow-none`, `dark:border-white/[0.06]` in `surfaces.card*`). Prefer token classes over hard-coded emerald/orange hex when possible; home cards still use some `emerald-*` / `orange-*` Tailwind for delta chips (acceptable precedent).

### 2.3 Typography

- **Font:** Inter via `--font-inter` (`font-sans`). Mono stack for code.
- **Tailwind semantic sizes:** `display-hero`, `display-metric` (light weight), `heading-1/2/3`, `body`, `body-sm`, `label`, `caption`.
- **Home-card convention (stronger than display tokens in practice):**
  - Section title: `text-[11px] font-semibold uppercase tracking-[0.05em|0.08em] text-muted-foreground`
  - Claim / primary line: `text-base font-semibold tracking-tight` or recommendation `text-[13px] text-muted-foreground`
  - Hero metrics: `text-2xl font-light tabular-nums` (+ `.metric-value` / `.tabular-nums` utilities)
- **`typography` recipes in design-tokens:** `metric`, `h1`, `h2`, `body`, `caption`.

### 2.4 Spacing, radius, shadow

| Concern | Convention |
|---------|------------|
| Page padding | `spacing.page` → `px-4 sm:px-6 lg:px-8 py-5 sm:py-6 lg:py-8` |
| Card padding (home) | `p-5` (SectionCard / readiness / tennis / fitness) |
| Card padding (shadcn Card) | `CardContent`: `px-3 py-4 sm:px-6 sm:py-6` |
| Radius | `--radius: 0.5rem` → `rounded-lg` default; `rounded-md` / `rounded-full` for badges/chips |
| Shadows | `shadow-sm` / `shadow-card` light; **none in dark** for cards |
| Transitions | `duration-fast` 150 / `normal` 200 / `slow` 300 |

### 2.5 Breakpoints

`xs: 400px`, `sm: 640`, `md: 768`, `lg: 1024`, `xl: 1280`, `2xl: 1536`. Mobile chrome switches at **`md`** (`BottomNav` is `md:hidden`; `ResponsiveDialog` uses `< 768`).

---

## 3. Card patterns (shared conventions for InsightCard)

### 3.1 Three layers of “card”

| Layer | Component | When to use |
|-------|-----------|-------------|
| shadcn `Card` (+ Header/Title/Content) | `ui/card.tsx` | Forms, dialogs, tool results, elevated action tiles |
| `ActionCard` | Gradient top accent + icon tile + CTA button | Marketing / entry actions (`variant="elevated"`) |
| Home dashboard shell | Inline shell **or** `SectionCard` | Dense product cards on player/coach home |

**Home shell (dominant for insights):**

```txt
rounded-lg bg-card p-5
border border-transparent (or border-border/40 for SectionCard)
hover:border-border/50 hover:shadow-sm transition-all duration-normal
dark:hover:border-border/30
focus:outline-none focus:ring-2 focus:ring-primary/40
```

**Header row anatomy (Readiness / Tennis / Fitness / SectionCard):**

1. Left: Lucide icon `h-4 w-4 text-muted-foreground/60` + uppercase section title  
2. Right: optional `Badge`, chevron, or `rightSlot`  
3. Body: metric / claim  
4. Footer strip: chips behind `border-t border-border/30` + `flex flex-wrap gap-1.5`

**Honesty / empty rules already in home cards:**

- Return `null` when there is no real data (no fabricated scores).  
- Suppress percentiles / nonsense when denominators missing.  
- Stale data → `Badge variant="secondary"` (Readiness).  
- Lazy-below-fold fetch may show `animate-pulse` placeholder inside the shell (TennisHighlightCard).

### 3.2 `ActionCard` (different job)

Top `h-1` gradient `from-primary via-primary/80 to-accent`, icon box `h-10 w-10 rounded-lg bg-primary/10`, full-width `Button`. **Do not** use this chrome for agent insight claims — too promotional. Reserve for “Open coach inbox” CTAs if needed.

### 3.3 `SectionCard` (best structural primitive)

Props: `title`, `icon`, `rightSlot`, `href` | `onCtaClick`, `children`, `className`.  
Use as the **outer shell** for InsightCard when the card is a dashboard section; for queue rows, a tighter custom shell matching home cards is fine.

### 3.4 Severity / outcome coloring precedents

- Tennis insights: `InsightChip` with `level-poor` / `chart-4` / `muted` / `level-excellent` tinted borders.  
- Match outcome: `Badge` `success-subtle` / `destructive-subtle`.  
- Tool results: green/red tinted `Card` backgrounds.

Map agent categories / review urgency onto **Badge subtle variants + level/chart tokens**, not new purple glows.

---

## 4. Data visualization conventions

### 4.1 Library

- **Recharts** everywhere for charts (`ResponsiveContainer`, `Line`, `Area`, `Pie`, etc.).  
- Lazy-loading wrappers (`LazyChart`, tennis detail code-split) to keep first paint light.  
- Colors via `chartVar()` / `chartSeries` / `levelColors` from `@/lib/design-tokens`.

### 4.2 Sparklines

| Location | Pattern |
|----------|---------|
| `tennisProgressCharts.Sparkline` | Compact area/line for KPI tiles |
| `PlayerBodyDashboard` MiniSparkline | Inline SVG |
| `EnhancedTooltip` MiniSparkline | Last ~10 points in chart hover |
| `StrengthsFocusCard` MetricSparkline | `aria-hidden` decorative |

For evidence chips: **prefer chip + trend icon over embedding a sparkline** unless the chip expands. Sparklines are secondary decoration (`aria-hidden`).

### 4.3 Trend indicators (closest to evidence chips)

1. **`FitnessTestSnapshotCard` → `DeltaChip`** (best match)  
   - Pill: `rounded-full px-2 py-0.5 text-[11px] font-medium tabular-nums`  
   - Positive: `bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400`  
   - Negative: orange equivalents  
   - Content: muted label + semibold value + `TrendingUp`/`TrendingDown` + signed delta  

2. **`Metric` (`ui/metric.tsx`)**  
   - `trend: { direction: 'up'|'down'|'neutral', value: string }` with `ArrowUp`/`ArrowDown`/`Minus`  
   - Colors: `text-success` / `text-destructive` / `text-muted-foreground`  

3. **Garmin `InsightsStrip`**  
   - `rounded-full border border-border bg-muted px-2.5 py-1 text-[11px]`  
   - Label muted + value `metric-value` with accent color  
   - Show 3 + “+N More” `Popover` overflow  

4. **Chart `InsightBadge`**  
   - SVG overlays for PR / streak / anomaly — not for card chips.

**Recommendation for agent `EvidenceChip`:** promote a shared chip modeled on `DeltaChip` + `InsightsStrip` (label, value, optional unit, optional trend enum `up|down|stable`, optional accent). Cap visible chips at 3 with Popover overflow.

---

## 5. Loading, empty, and error states

| State | Convention |
|-------|------------|
| Loading | `Skeleton` (+ shimmer); route `loading.tsx`; domain skeletons (`dashboard-skeletons`, `LoadingStates`, `page-skeleton`) |
| Empty | `EmptyState` variants: `no-data`, `no-results`, `onboarding`, `success`, `error`; presets include **`EmptyStateAllCaughtUp`** (perfect for empty approval queue) |
| Error | `EmptyStateError` / `variant="error"`; page-level `error.tsx` with `AlertCircle` + retry; AI modal shows `AlertCircle` banner |
| Inline pending | `animate-pulse` block inside card (TennisHighlight) or `Loader2` on buttons |
| Toasts | `sonner` + legacy toast stack |

**Agent-specific today:** `ToolResultCard` only renders when `state === 'result'`; pending tool invocations are dropped. Offline: `OfflineBanner`.

There is **no** `data-load-error` component in the main Next app (that name lives in swingvision-pipeline). Use `EmptyState` / error banners instead.

---

## 6. Mobile & responsive conventions

- **Bottom nav:** `BottomNav` / `LazyBottomNav` — fixed, `md:hidden`, `pb-safe`, center **AI FAB** (`Bot` icon) opening `VoiceAssistantModal`.  
- **Touch:** `.touch-target` min 44×44; buttons already `min-w-[44px]`; `tap-highlight-none`; haptic-style scale on nav taps.  
- **Safe areas:** `.safe-area-inset-*`, `.pb-safe`, bottom spacing for nav height.  
- **Keyboard:** hide bottom nav when keyboard visible.  
- **Dialogs:** `ResponsiveDialog` → centered dialog desktop / framer-motion bottom sheet mobile (dynamically imported so desktop skips framer-motion).  
- **Layouts:** `grid-responsive`, `spacing.gridCols*`, home cards stack single-column then `sm:` grids for metric tiles.  
- **Courtside implication:** Approval queue and InsightCard actions must be thumb-reachable (full-width or large buttons), chips wrap (`flex-wrap`), avoid hover-only affordances, keep copy short (`line-clamp-*`).

AI entry point for coaches on phone is already the **FAB**, not a dedicated nav tab — coach inbox may need a badge on Quick Actions or alerts, not a fifth tab.

---

## 7. Animation conventions

| Mechanism | Usage |
|-----------|--------|
| Tailwind `animate-*` | `fade-in`, `fade-in-up`, `scale-in`, `shimmer`, `pulse-gentle`, `mic-pulse`, `toast-slide-in`, etc. |
| `tailwindcss-animate` | Accordion / shadcn defaults |
| `framer-motion` | Landing (`PlatformLanding`, `HeroVideoShowcase`); `MobileSheetContent` via `ResponsiveDialog` |
| CSS transitions | `duration-normal` border/shadow on cards; ring fills `duration-700` |

**For streaming agent UI:** prefer Tailwind (`animate-pulse` / `animate-fade-in` / `Loader2` spin) inside chat. Do **not** pull framer-motion into the chat path; keep parity with VoiceAssistantModal’s lightweight CSS delays.

---

## 8. Accessibility — present vs absent

**Present:**

- `SkipToContent`  
- `sr-only` labels (menus, language, AI FAB `aria-label`)  
- `focus-visible:ring-*` on Button/Badge; home cards `focus:ring-2 focus:ring-primary/40`  
- `role="navigation"` on BottomNav; dialogs `aria-modal`  
- `prefers-contrast: high` tweaks in globals  
- Some `aria-pressed` / `aria-label` on interactive controls  
- Decorative sparklines often `aria-hidden`

**Gaps / risks for agent UI:**

- `MessageBubble` uses `dangerouslySetInnerHTML` for markdown (no citation links / no a11y tree for tool steps).  
- No live region (`aria-live`) for streaming tokens or tool progress.  
- Confidence must not rely on color alone (pair Badge text with icon).  
- Tool progress list should be a list with status text, not only spinners.  
- Approval actions need clear dialog confirm for destructive reject (reuse `AlertDialog` / `ConfirmationDialog` patterns).

---

## 9. Icons, file conventions, project rules

### 9.1 Icons

**lucide-react** exclusively for UI icons. Sizes: `iconSizes` xs→2xl; home headers `h-4 w-4`; chips `h-3 w-3`; FAB `h-6 w-6`.

### 9.2 File / component conventions

| Rule | Practice |
|------|----------|
| Naming | PascalCase component files (`ReadinessCard.tsx`); kebab folders (`tennis-analytics/`, `dashboard/home/cards/`) |
| Colocation | Feature folders under `src/components/{domain}/`; shared primitives in `ui/` or `dashboard/home/primitives/` |
| AI cluster | `src/components/ai/` with barrel `index.ts` |
| Client boundary | Interactive / hooks / i18n `useTranslations` → `'use client'` at top; prefer RSC pages that compose client islands |
| Memo | Widespread `memo()` on dashboard cards |
| i18n | `next-intl` `useTranslations('…')` — all user-visible AI strings under `ai` / role namespaces |
| Routing | `@/i18n/routing` `Link` / `useRouter` |

### 9.3 Project rules files

- No `AGENTS.md` at monorepo or app root.  
- No `.cursor/rules` for this app.  
- Windsurf plans exist under `PeakPerformanceData/.windsurf/plans/` (tennis analytics) — not component style law.  
- Practical style law is **code + `design-tokens.ts` + home card patterns**.

---

## 10. Specification sketch — new AI surfaces (existing vocabulary)

Data contract reminder (`03-insight-schema.md`):  
`claim`, `category`, `confidence: high|medium|low`, `evidence[]` `{ metric, source, value?, unit?, trend?, timestamp? }`, `actions[]`, `requires_coach_review`.

### 10.1 `InsightCard`

**Anatomy (top → bottom):**

```
┌ SectionCard / home shell ─────────────────────────────┐
│ [Category icon] CATEGORY          [ConfidenceIndicator]│
│                                                        │
│ Claim — text-base font-semibold tracking-tight         │
│                                                        │
│ ┌ EvidenceChip ┐ ┌ EvidenceChip ┐ ┌ +N More Popover ┐ │
│ border-t strip                                             │
│ Athlete name · relative time (caption)                     │
│ [Approve] [Edit/Reject] [View source]   ← if review mode │
│ or [Primary action Button] + secondary outline          │
└────────────────────────────────────────────────────────┘
```

**Compose from:**

| Piece | Existing |
|-------|----------|
| Shell | `SectionCard` **or** home-card class string from Readiness/Fitness |
| Category | Lucide map + uppercase title (SectionCard `icon`/`title`) |
| Claim | plain `<p>` / CardTitle-scale text |
| Evidence row | **new** `EvidenceChip` (see below) + `Popover` overflow like `InsightsStrip` |
| Confidence | **new** `ConfidenceIndicator` |
| Status / review | `Badge` (`warning-subtle` pending, `success-subtle` approved, `destructive-subtle` rejected) |
| Actions | `Button` (`default` / `outline` / `ghost`); confirm with `AlertDialog` or existing `ConfirmationDialog` |
| Empty self-gate | parent returns `null` or list uses `EmptyState` |

**New:** `InsightCard` (domain component under `src/components/ai/` or `src/components/insights/`).  
**New supporting:** `EvidenceChip` (extractable to `ui/` if reused).

Do **not** use `ActionCard` gradient chrome. Do **not** invent percentage confidence meters.

---

### 10.2 Coach approval queue

**View model:** list of insights where `requires_coach_review && coach_review_status === 'pending'` (exact enum per schema/DB).

**Layout:**

```
PageHeader (title + pending count Badge)
Filter chips: All | High urgency | By athlete   ← Tabs or Badge toggles
ScrollArea / virtualized-list for long queues
  → InsightCard (review variant) per row
EmptyStateAllCaughtUp when zero
SkeletonText / card skeletons while loading
```

**Compose from:**

| Piece | Existing |
|-------|----------|
| Page chrome | `page-header`, `spacing.page`, `container` |
| Count badge | `Badge` |
| Filters | `Tabs` or pill `Button variant="outline"` / `Badge` |
| List | `ScrollArea` or `virtualized-list` |
| Row | `InsightCard` review mode |
| Empty | `EmptyStateAllCaughtUp` |
| Confirm reject | `AlertDialog` / `ConfirmationDialog` |
| Entry from coach home | `QuickActionsPanel` badge pattern (pending count) |

**New:** `CoachApprovalQueue` (page client) + optional `CoachApprovalRow` if card chrome differs.  
Wire into coach nav via Quick Action / alerts — not a new BottomNav tab unless product insists.

**Mobile:** sticky approve/reject bar or large full-width buttons under each card; `ResponsiveDialog` for detail if claim expands.

---

### 10.3 In-chat streaming states

Today: user/assistant bubbles (`bg-primary` / `bg-muted`), avatar circles, `ToolResultCard` only on completed tools. Markdown via lightweight HTML.

**Target states (compose into `MessageBubble` parts):**

| State | Visual | Compose / new |
|-------|--------|----------------|
| **Tool running** | Muted row: `Loader2` spin + tool display name + optional short args | **New** `ToolCallProgress` (`state="running"`); icon map from `ToolResultCard.TOOL_ICONS` |
| **Tool complete** | Existing success/error tinted card | Extend `ToolResultCard`; keep green/red surfaces |
| **Reasoning** | Collapsed `Collapsible` “Thinking” with `text-caption text-muted-foreground`; `animate-fade-in` | **New** `ReasoningBlock` wrapping `Collapsible` |
| **Citation** | Inline chips or footnote list linking to evidence/source | **New** `CitationChip` / `CitationList` (styled like `InsightsStrip` chips; tap → chart/match route or Popover with source) |
| **Streaming text** | Existing bubble; add `aria-live="polite"` on assistant column | Enhance `MessageBubble` |
| **Structured insight in chat** | Embed compact `InsightCard` | Reuse card |

**Motion:** `Loader2` + `animate-pulse` on pending row; complete → `animate-fade-in`. No framer-motion in modal chat.

**Protocol note:** full part streaming depends on AI SDK upgrade (`61-streaming-agent-ui.md`); UI can still accept a local `parts[]` shape ahead of the wire cutover.

---

### 10.4 Confidence indicator (honest, not over-precise)

Schema already uses **ordinal** `high | medium | low` — UI must not invent `87%`.

**Spec:**

| Level | Badge variant | Icon | Copy (i18n) |
|-------|---------------|------|-------------|
| high | `success-subtle` | `CheckCircle2` | “High confidence” |
| medium | `warning-subtle` | `Info` | “Medium confidence” |
| low | `secondary` or `destructive-subtle` | `AlertTriangle` | “Low confidence” |

Optional: `Tooltip` with one sentence on what confidence means (model self-assessment, not clinical certainty).  
Optional: for low confidence, soft-mute primary actions or require coach review (product rule, already in schema via `requires_coach_review`).

**Compose from:** `Badge` + Lucide + `Tooltip`.  
**New:** thin `ConfidenceIndicator` wrapper so mapping stays consistent across InsightCard, queue, and chat.

**Anti-patterns:** progress bars to 2 decimals; gauge charts; greenwashing low confidence with primary blue.

---

## 11. Genuinely new vs compose-only

### 11.1 Compose-only (reuse as-is)

`SectionCard`, `Card`/`CardContent`, `Button`, `Badge`, `Popover`, `Tabs`, `ScrollArea`, `Skeleton`/`SkeletonText`, `EmptyState` (+ `EmptyStateAllCaughtUp`), `AlertDialog`, `ConfirmationDialog`, `Tooltip`, `Collapsible`, `ResponsiveDialog`, `MessageBubble` (extend), `ToolResultCard` (extend), `QuickActionsPanel` badge pattern, Lucide icons, `tokens` / `statusColors` / `levelColors`.

### 11.2 Genuinely new primitives / domain components

| New component | Why it cannot be a pure rename |
|---------------|--------------------------------|
| **`EvidenceChip`** | Combines DeltaChip + InsightsStrip + schema fields (`source`, `unit`, `trend`); should be shared |
| **`ConfidenceIndicator`** | Ordinal mapping + tooltip copy; no existing confidence UI |
| **`InsightCard`** | Agent schema surface; tennis “insights” are unrelated |
| **`CoachApprovalQueue`** (+ row if needed) | No coach inbox; EmptyStateAllCaughtUp is not enough alone |
| **`ToolCallProgress`** | Pending/running tool row does not exist (results only) |
| **`ReasoningBlock`** | No reasoning/thinking UI |
| **`CitationChip` / `CitationList`** | No citation rendering in chat |

Optional later (not required for first vertical slice): promote `EvidenceChip` into `ui/`; extract shared `InsightsStrip` from Garmin graphs; `InsightCardSkeleton`.

---

## 12. Placement & naming recommendation

```
src/components/ai/
  InsightCard.tsx
  EvidenceChip.tsx          # or ui/EvidenceChip.tsx if shared with charts
  ConfidenceIndicator.tsx
  ToolCallProgress.tsx
  ReasoningBlock.tsx
  CitationChip.tsx
  CoachApprovalQueue.tsx
  …existing MessageBubble, ToolResultCard, ConfirmationDialog
```

Page route (suggested): `src/app/[locale]/coach/insights/page.tsx` or under existing coach inbox/alerts once product picks IA — out of scope for this dossier.

Follow existing conventions: `'use client'`, `memo` where list-heavy, `useTranslations('ai')` / coach namespaces, dark-mode token classes, 44px touch targets, return `null` / EmptyState rather than fake data.

---

## 13. Consistency checklist for implementers

1. Shell matches home cards (`p-5`, `rounded-lg`, uppercase 11px title) — not ActionCard gradients.  
2. Evidence chips look like `DeltaChip` / `InsightsStrip` (11px, pill, tabular-nums).  
3. Confidence is ordinal Badge text, never a fake percent.  
4. Dark mode: borders over shadows; use `statusColors` / level tokens.  
5. Chat tool pending uses `Loader2` + muted row; complete reuses ToolResultCard colors.  
6. Mobile: wrap chips, large approve/reject, safe-area, no hover-only.  
7. a11y: `aria-live` on stream, labels on icon buttons, confirm dialogs for reject.  
8. i18n every string; Lucide only.  
9. Prefer Tailwind animation utilities over framer-motion in AI surfaces.  
10. Align props with `schemas/insight.py` / research `03`.

---

*End of dossier 77.*
