# Dashboard Visual Redesign Plan — Peak Performance Data

## Overview

A visual-only refactor of the parent dashboard home (with shared primitives that
propagate to player/coach homes). The goal is to replace the current
"AI-generated" card monoculture with a deliberate, hierarchical, editorial
layout that reads as a senior-designed sports product. We introduce a 3-tier
surface system (hero band / raised card / inset well), a tightened type scale
leveraging the already-installed-but-unused `Playfair_Display` + `DM_Sans`
fonts, an asymmetric 12-col editorial grid, and a reimagined readiness hero that
replaces the WHOOP-style ring trio with one dominant metric + supporting inline
stats. No data contracts change; all props stay identical.

## Key findings

1. **Fonts are already available but unused.** `src/lib/fonts.ts:1-40` exports
   `inter`, `dmSans`, `playfair`, and `barlowCondensed`. Only `inter` and
   `barlowCondensed` variables are attached to `<html>` at
   `src/app/[locale]/layout.tsx:581`. `dmSans` and `playfair` are imported
   nowhere — we can wire them in to get a real display/heading hierarchy
   without adding font payload (they're already `preload: false` /
   `display: swap`, so no perf regression beyond the lazy font fetch).

2. **The card monoculture is real and centralized.** The exact pattern
   `rounded-lg border border-border/40 bg-card p-5` (or `/30`, `/50`, `/60`
   variants) appears in: `SectionCard.tsx:79`, `GreetingCard.tsx:38`,
   `AssignedCoachCard.tsx:32`, `ChildAttendanceCard.tsx:61`,
   `FitnessTestSnapshotCard.tsx:73`, `TennisHighlightCard.tsx:114`,
   `UpcomingTournamentCard.tsx:59`, `CoachCommunicationsTeaser.tsx:45`,
   `ReadinessCard.tsx:74`. Fixing the primitives + exemplars sets the pattern.

3. **The uppercase-tracking micro-label is duplicated verbatim.**
   `text-[11px] font-semibold uppercase tracking-[0.08em]` (or `/0.05em`) is in
   `SectionCard.tsx:66`, `HeroRingTrio.tsx:218`, `AssignedCoachCard.tsx:43`,
   `ChildAttendanceCard.tsx:68`, `FitnessTestSnapshotCard.tsx:79`,
   `TennisHighlightCard.tsx:121`, `UpcomingTournamentCard.tsx:67`,
   `ReadinessCard.tsx:80`. This is the single loudest LLM tell.

4. **The WHOOP clone is `HeroRingTrio.tsx:99-177`** — three identical rings in
   `grid-cols-3` with fixed identity colors (`METRIC_TONES` at line 33-37). It
   is consumed by `ParentHome.tsx:91-97` and `PlayerHome.tsx:154-159`. The
   `embedded` variant is also used by `FocusedAthletePanel` (need to verify
   before changing the `embedded` contract).

5. **`SectionCard` is barely used.** Despite being the "unified shell", grep
   shows the home cards mostly hand-roll their own `<button>`/`<Link>` shells
   instead of using `SectionCard`. So refactoring `SectionCard` is low-risk —
   few consumers — but we should still keep its prop signature backward
   compatible.

6. **`MetricRing` is a clean building block** (`MetricRing.tsx:58-139`) with
   `lg/md/sm` sizes and tone gradients. We can reuse it for the dominant
   readiness ring in the new hero without rewriting it.

7. **i18n is namespace-scoped and 4 locales** (`en/es/ca/zh`) plus a consumer
   overlay at `messages/overlays/consumer/{en,es,ca,zh}.json`. New strings must
   be added to all 4 base locale files. The hero already has a rich
   `playerDashboard.home.hero.*` namespace we can reuse; the parent home uses
   `parent.dashboard.home.*`.

8. **`ParentDashboard.tsx:188` wraps `ParentHome` in
   `TabsContent className="space-y-4 sm:space-y-6"`** — so the outer vertical
   rhythm is partly controlled there, not in `ParentHome`. `ParentHome.tsx:79`
   adds another `spacing.sectionGap` (`space-y-6 sm:space-y-8`). We control
   rhythm inside `ParentHome`; the TabsContent gap is fine to leave.

9. **Admin dashboard (`ClubAdminDashboard.tsx:610-676`) uses a different
   pattern** — shadcn `Card` with `border-l-4` colored accents and
   `rounded-lg bg-{color}-500/[0.12]` icon tiles. This is out of scope per the
   task (parent home is the focus) but the new tokens should be compatible.

10. **No tests target these components.** `grep` found no `*.test.tsx` under
    `src/components/dashboard/home/`. Verification will be via `pnpm lint` +
    `pnpm build` + visual review.

11. **Alphabetical ordering is enforced** (per global rules + the repo's husky
    pre-commit). All new imports/props/variables must be alphabetically sorted.

## Phases

### Phase 0 — Foundations: fonts, type scale, surface tokens

**Purpose:** Wire up the unused fonts and establish the new token vocabulary
that all later phases consume.

- `src/app/[locale]/layout.tsx:581` — change the `className` from
  `${inter.variable} ${barlowCondensed.variable} font-sans antialiased` to also
  include `${dmSans.variable} ${playfair.variable}` so the CSS vars
  `--font-dmsans` and `--font-playfair` are available app-wide. Keep
  `font-sans` (Inter) as the body default.
- `tailwind.config.js:27-58` — extend `fontFamily` with:
  - `display: ['var(--font-playfair)', 'Georgia', 'serif']` (editorial display
    for hero numerals/headlines — gives the "sports publication" feel)
  - `sans: [...existing Inter stack...]` (unchanged, body)
  - `data: ['var(--font-dmsans)', 'Inter', 'system-ui', 'sans-serif']` (for
    data-dense numerals/tables — DM Sans has a slightly more technical feel
    than Inter for stats)
  - Keep `condensed` and `mono` as-is.
- `tailwind.config.js:59-73` — extend `fontSize` with a proper hierarchy. Add:
  - `display-xl`: `['2.75rem', { lineHeight: '1.05', letterSpacing: '-0.025em', fontWeight: '600' }]` (hero readiness number, uses display font)
  - `display-lg`: `['2rem', { lineHeight: '1.1', letterSpacing: '-0.02em', fontWeight: '600' }]` (hero headline)
  - `heading-1`: keep but bump to `['1.625rem', { lineHeight: '1.2', letterSpacing: '-0.015em', fontWeight: '600' }]` (real size jump from h2)
  - `heading-2`: `['1.25rem', { lineHeight: '1.3', letterSpacing: '-0.01em', fontWeight: '600' }]`
  - `heading-3`: `['1rem', { lineHeight: '1.4', fontWeight: '600' }]` (was 0.9375rem — too close to body)
  - `body`: keep `['0.875rem', { lineHeight: '1.6', fontWeight: '400' }]`
  - `eyebrow`: `['0.6875rem', { lineHeight: '1', letterSpacing: '0.12em', fontWeight: '600' }]` (the ONE place uppercase tracking is sanctioned — hero eyebrow only)
  - Remove nothing (avoid breaking existing `text-heading-1` etc. usages elsewhere).
- `src/lib/design-tokens.ts:16-22` — replace the thin `typography` object with
  a full hierarchy. New shape (keep `metric`, `h1`, `h2`, `body`, `caption` keys
  for backward compat, add new ones):
  - `displayHero`: `'font-display text-display-xl'`
  - `displayMetric`: `'font-display text-display-lg tabular-nums'`
  - `h1`: `'text-heading-1 tracking-tight'`
  - `h2`: `'text-heading-2 tracking-tight'`
  - `h3`: `'text-heading-3 tracking-tight'`
  - `body`: `'text-body'`
  - `bodySm`: `'text-body-sm'`
  - `eyebrow`: `'text-eyebrow uppercase text-muted-foreground'` (sanctioned uppercase)
  - `caption`: `'text-caption text-muted-foreground'`
  - `metric`: keep existing key for compat, point to new display classes.
  - Add usage comments above each key explaining when to use it.
- `src/lib/design-tokens.ts:67-87` — replace `surfaces` with a 3-tier system +
  usage comments. New keys:
  - `heroBand`: `'relative overflow-hidden'` (full-bleed, NO card chrome — sits
    on page bg; the hero provides its own background treatment). Document:
    "Use for the single dominant moment at the top of a view. No border, no
    rounded corners — let it breathe on the page background."
  - `raised`: `'bg-card rounded-2xl shadow-sm dark:shadow-none dark:border dark:border-white/[0.06]'` (primary content cards, larger radius, NO border in light mode — rely on shadow). Document: "Primary content. Larger radius + subtle shadow conveys weight without a border."
  - `raisedTight`: same but `rounded-lg` (for data-dense cards where 2xl feels bloated).
  - `well`: `'bg-muted/60 dark:bg-muted/40 rounded-xl'` (borderless inset well
    for secondary data — NO border, sits on a slightly recessed bg). Document:
    "Secondary data that supports a primary card. No border — the bg contrast
    creates the inset feel."
  - `plain`: `'bg-card rounded-lg'` (tertiary/teaser content, no border no
    shadow — minimal mass). Document: "Tertiary teasers. Lowest visual weight."
  - `interactive` variants: `raisedInteractive`, `plainInteractive` — add
    `hover:shadow-md transition-all duration-normal` and dark hover bg.
  - Keep `page`, `sunken`, `overlay` keys.
  - **Keep** `card`, `cardElevated`, `cardSubtle`, `cardInteractive`,
    `cardGlass` as-is — the Phase 0.5 audit found 32 consumers in
    `src/components/tennis-analytics/*` (e.g. `tennisProgressCharts.tsx:1014`,
    `TennisAnalyticsContent.tsx:849`). Removing them is out of scope and would
    break tennis-analytics. The new `raised`/`well`/`plain` tiers sit alongside
    them; new home cards use the new tiers, tennis-analytics keeps using
    `surfaces.card`. Migrating tennis-analytics is a future task.
- `src/lib/design-tokens.ts:28-61` — extend `spacing` with editorial rhythm
  tokens:
  - `sectionGapHero`: `'space-y-8 sm:space-y-10 lg:space-y-12'` (bigger gap
    after hero)
  - `sectionGapEditorial`: `'space-y-6 sm:space-y-8'` (standard)
  - `sectionGapTight`: `'space-y-3 sm:space-y-4'` (grouped secondary cards)
  - `editorialGrid`: `'grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8'`
  - `colSpan7`: `'lg:col-span-7'`, `colSpan5`: `'lg:col-span-5'`,
    `colSpan8`: `'lg:col-span-8'`, `colSpan4`: `'lg:col-span-4'`,
    `colSpan12`: `'lg:col-span-12'`
  - Keep existing keys for compat.
- `src/lib/design-tokens.ts:186-237` — strip the `bg-gradient-to-br from-chart-X/5 to-transparent` from every `sectionAccents.*.container`. Replace with a restrained flat tint: `border-chart-X/15 bg-chart-X/[0.03]` (no gradient). Keep `bar`, `header`, `ring`, `stroke` keys.

**Phase 0.5 — Audit token consumers (DONE).** Ran
`grep -rn "surfaces\.card" src` — found 32 consumers in
`src/components/tennis-analytics/*`. **Decision: keep `surfaces.card*` keys
as-is; do NOT remove.** New `raised`/`well`/`plain` tiers are additive. No
migration of tennis-analytics in this pass.

### Phase 1 — New primitives: `Surface`, `Eyebrow`, `SectionTitle`, `ReadinessHero`

**Purpose:** Build the small primitive set that embodies the new hierarchy.
Keep `SectionCard` as a backward-compat wrapper.

- New file `src/components/dashboard/home/primitives/Surface.tsx` — a thin
  wrapper exposing the 3 tiers as a discriminated union:
  - Props (alphabetical): `as?: ElementType`, `children`, `className?`,
    `href?: string`, `interactive?: boolean`, `onClick?: () => void`,
    `tier: 'hero' | 'plain' | 'raised' | 'raisedTight' | 'well'`.
  - Maps `tier` → `surfaces.*` token. Renders `<section>` / `<Link>` / `<button>`
    based on `href`/`onClick` (mirror `SectionCard.tsx:83-113` logic).
  - No built-in title/icon — those are separate primitives. This forces
    callers to be intentional about ornament.
- New file `src/components/dashboard/home/primitives/Eyebrow.tsx` — the ONE
  sanctioned uppercase-tracking label. Props: `children`, `className?`. Renders
  `<p className={cn(typography.eyebrow, className)}>`. Document: "Reserve for
  the hero eyebrow and at most one place per view. Do not use as a default
  card title."
- New file `src/components/dashboard/home/primitives/SectionTitle.tsx` —
  sentence-case section title. Props: `children`, `className?`, `level?: 2|3`,
  `rightSlot?: ReactNode`. Renders `<h2|h3 className={cn(typography.h2|h3,
  'text-foreground')}>`. No icon by default. Optional `rightSlot` for
  badges/counts. This replaces the uppercase micro-label pattern.
- Refactor `src/components/dashboard/home/primitives/SectionCard.tsx:52-114` —
  re-implement as a thin wrapper over `Surface` (tier defaults to `raised`) +
  `SectionTitle`. Keep the existing prop signature (`children`, `className`,
  `href`, `icon`, `onCtaClick`, `rightSlot`, `title`) intact so existing
  consumers don't break. Internally: drop the `text-[11px] uppercase
  tracking-[0.08em]` at line 66 → use `SectionTitle`. Drop the leading icon by
  default (only render `Icon` if explicitly passed — caller's choice). Change
  shell at line 78-81 from `rounded-lg border border-border/40 bg-card p-5` to
  `Surface tier="raised"` with `p-5 sm:p-6`.
- New file `src/components/dashboard/home/primitives/ReadinessHero.tsx` — the
  WHOOP-trio replacement. Props (alphabetical, **identical data contract to
  `HeroRingTrio`**): `acwr`, `className`, `connectHref`, `hasConnectedWearable`,
  `loadHref`, `readiness`, `size`, `trainingSessionCount`, `variant`.
  Layout (desktop, `lg+`): a 12-col grid.
  - Left 7 cols: a single dominant `MetricRing` (size `lg`, tone from
    readiness level) showing the readiness score as a `display-xl` numeral
    beside it (not inside the ring — the ring is the visual, the numeral is
    editorial type). Eyebrow above: "Today" (sanctioned uppercase). Below the
    numeral: the readiness level label in sentence-case (`h3`), then the
    coaching tip in `body` color `text-foreground/70`.
  - Right 5 cols: two stacked inset `well` tiles — Sleep and Load. Each well
    shows: sentence-case label (`SectionTitle` level 3), the value in
    `displayMetric` (smaller than the hero numeral — hierarchy), and a one-line
    context (sleep quality / load zone). No rings on the secondary metrics —
    they support, not compete.
  - Mobile: stacks vertically — hero numeral first, then the two wells in a
    2-col row.
  - Empty state: if no readiness score, the hero numeral area shows an
    editorial empty state (see Phase 4) with the connect CTA inline — not a
    dashed ring.
  - Keep `getSleepQualityKey` and the load-zone/coaching-tip logic from
    `HeroRingTrio.tsx:60-97` (extract to a shared util or inline — same
    behavior).
  - `variant: 'embedded'` keeps the same meaning (no outer chrome) but the
    layout still applies. **Verify `FocusedAthletePanel` consumer before
    shipping** (open question).
- Update `src/components/dashboard/home/primitives/MetricRing.tsx:128` — the
  in-ring label still uses `uppercase tracking-[0.06em]`. Since the new hero
  pulls the numeral OUT of the ring, the ring's internal label becomes
  optional. Keep `MetricRing` as-is for now (it's reused elsewhere) but the new
  `ReadinessHero` will pass `label={undefined}` and render labels externally.

### Phase 2 — Rework `ParentHome` layout with editorial rhythm

**Purpose:** Apply the 12-col grid + varied surface treatments + hierarchy.

- `src/components/dashboard/home/ParentHome.tsx:78-122` — replace the flat
  `spacing.sectionGap` stack with an editorial composition. New structure
  (desktop `lg+`, stacks on mobile):
  1. **Hero band (full-bleed, `col-span-12`, `tier: hero`):** Merge
     `GreetingCard` + `ReadinessHero` into one full-bleed hero band. The
     greeting sits as the eyebrow + headline at the top-left of the band; the
     readiness hero is the dominant content. No card chrome — the band uses
     `bg-background` with a subtle top hairline `border-t border-border/30` for
     editorial framing. This is the single dominant moment.
  2. **Child switcher (col-span-12, no surface — it's a chip row, already
     borderless at `ChildSwitcherCard.tsx:59`):** keep as-is, just adjust
     spacing. Sits directly under the hero with a `sectionGapTight`.
  3. **Secondary row (col-span-7 + col-span-5):**
     - Left 7: `AssignedCoachCard` (refactored, `tier: raised`) — the coach is
       the human anchor of the parent view, give it weight.
     - Right 5: `ChildAttendanceCard` (refactored, `tier: raisedTight`) —
       data-dense, tighter radius.
  4. **Tertiary row (col-span-12, internal 7/5 split):**
     - Left 7: `TennisHighlightCard` + `FitnessTestSnapshotCard` stacked with
       `sectionGapTight`, both `tier: plain` (lowest weight — these are
       teasers).
     - Right 5: `CoachCommunicationsTeaser` (`tier: well` — inset, supports
       the coach narrative from the secondary row).
  5. **Footer band (col-span-12):** `UpcomingTournamentCard` (`tier: plain`,
     full width, single line) — quiet, calendar-like.
  - Wrap the selected-child block in `spacing.editorialGrid` and use
    `colSpan*` tokens. Mobile collapses to `space-y-6`.
  - The empty state (`!selectedChild`) gets the new editorial empty state
    (Phase 4).
- Keep the `ParentHome` prop signature (`ParentHomeProps` at lines 33-43)
  **completely unchanged**. This is a visual refactor only.

### Phase 3 — Exemplar card refactors

**Purpose:** Rework the 3 exemplar cards (Greeting, AssignedCoach,
ChildAttendance) + the 2 supporting data cards (FitnessTest, TennisHighlight)
to embody the new system. The remaining cards (CoachCommunicationsTeaser,
UpcomingTournamentCard, ChildSwitcherCard) get lighter touch-ups.

- `src/components/dashboard/home/cards/GreetingCard.tsx:37-58` — refactor to
  the hero-band style. Remove the `rounded-lg border border-border/30 bg-card
  p-6 shadow-sm` shell (line 38) → render as a borderless band. New structure:
  - Eyebrow: localized greeting ("Good morning") in `typography.eyebrow` +
    `text-muted-foreground` — this is the ONE sanctioned uppercase place
    (actually the greeting is sentence-case, so use `bodySm` + `text-muted-
    foreground` instead; reserve eyebrow for "Today" in the hero). **Decision:
    greeting stays sentence-case, eyebrow is reserved for the readiness
    "Today" label.**
  - Headline: `{greeting}, {firstName}` in `typography.h1` (real size jump).
  - Next-action line: keep the icon here (it IS functional — indicates action
    type) but make it `text-muted-foreground` not `text-muted-foreground/60`,
    and use `typography.body` not `text-[13px]`.
  - Remove `shadow-sm` and border. The hero band relies on whitespace + type
    scale for hierarchy.
  - Keep `rightSlot` prop.
- `src/components/dashboard/home/cards/AssignedCoachCard.tsx:30-58` — refactor:
  - Shell: `tier: raised` via `Surface` (replace the hand-rolled button at line
    31-34). `rounded-2xl`, shadow, no border in light mode.
  - Remove the uppercase label at line 43-46 (`text-[11px] font-semibold
    uppercase tracking-[0.05em]`) → replace with a sentence-case `SectionTitle`
    "Coach" (or just drop the title — the avatar + name are self-evident;
    **decision: drop the title, let the coach name be the `h3`**).
  - Remove the `UserRound` icon at line 44 (decorative).
  - Keep the `MessageSquare` icon on the CTA (functional — indicates "message").
  - Coach name in `typography.h3`, child name in `typography.caption`.
  - Avatar stays `h-10 w-10`.
- `src/components/dashboard/home/cards/ChildAttendanceCard.tsx:59-99` —
  refactor (data-dense exemplar):
  - Shell: `tier: raisedTight` via `Surface` (button variant).
    `rounded-lg`, shadow, no border in light mode.
  - Remove `CalendarCheck` icon at line 67 (decorative) and the uppercase
    label at line 68 → replace with `SectionTitle` level 3 "Attendance"
    (sentence-case). Keep the `ChevronRight` (functional — indicates drill-in).
  - Big rate number: bump from `text-2xl font-light` (line 74) to
    `typography.displayMetric` (display font, `text-display-lg`) — this is the
    card's hero numeral. Keep the tone color logic (lines 44-48).
  - Progress bar: keep, but use `rounded-full bg-muted/60` for the track
    (softer).
  - Bucket row (lines 87-97): remove the `text-[10px] uppercase tracking-wider`
    at line 91 → use `typography.caption` sentence-case. Keep the 3-col grid.
- `src/components/dashboard/home/cards/FitnessTestSnapshotCard.tsx:71-107` —
  refactor (second data-dense exemplar):
  - Shell: `tier: plain` (tertiary teaser — lowest weight, no border no
    shadow, just `bg-card rounded-lg`).
  - Remove `Dumbbell` icon (line 78, decorative) + uppercase label (line 79) →
    `SectionTitle` level 3 "Fitness test" (sentence-case). Keep `ChevronRight`.
  - Overall score: `typography.displayMetric` (display font). Keep `/ 100`
    suffix in `caption`.
  - DeltaChip (lines 110-132): keep the chip treatment (it's a deliberate
    colored badge, not the AI-generic pattern). Just bump the label from
    `text-muted-foreground/80` to `text-muted-foreground`.
- `src/components/dashboard/home/cards/TennisHighlightCard.tsx:112-145` —
  lighter touch:
  - Shell: `tier: plain`.
  - Remove `Trophy` icon (line 120, decorative) + uppercase label (line 121) →
    `SectionTitle` level 3 "Latest match".
  - Opponent name: `typography.h3` (was `text-base font-semibold`).
- `src/components/dashboard/home/cards/CoachCommunicationsTeaser.tsx:44-69` —
  lighter touch:
  - Shell: `tier: well` (inset, borderless, `bg-muted/60`).
  - Remove `MessageSquare` icon (line 48, decorative) → `SectionTitle` level 3
    "Coach communications" (sentence-case). Keep the "View all" button.
  - Observation rows: keep, but coach name in `typography.bodySm font-medium`,
    content in `typography.bodySm text-muted-foreground`.
- `src/components/dashboard/home/cards/UpcomingTournamentCard.tsx:57-84` —
  lighter touch:
  - Shell: `tier: plain`.
  - Remove the `h-10 w-10 rounded-lg bg-purple-500/10` icon tile (lines 63-65)
    — this is the "Lucide-icon-in-a-rounded-square" tell. Replace with a
    date-forward layout: the formatted date in `typography.displayMetric`
    (small) as the lead element, tournament name in `h3` below, category +
    days-until badge inline.
  - Remove uppercase label (line 67) → `SectionTitle` level 3.
- `src/components/dashboard/home/cards/ChildSwitcherCard.tsx` — no structural
  change (it's already a borderless chip row at line 59). Just verify the
  empty-state card (line 45) uses `tier: raised` instead of the dashed-border
  pattern. **Decision: keep the dashed border for the empty state — it's a
  deliberate "add" affordance, not the AI-generic pattern.**

### Phase 4 — Editorial empty states

**Purpose:** Give empty states personality for a tennis academy product.

- New file `src/components/dashboard/home/primitives/EmptyState.tsx` — a
  reusable editorial empty state. Props (alphabetical): `action?`,
  `actionLabel?`, `children`, `className?`, `tone?: 'neutral' | 'prompt'`.
  Layout: a `tier: well` container with a short, human, on-brand headline
  (`typography.h3`) + a guiding sentence (`typography.body text-muted-
  foreground`) + an optional inline CTA link. No big illustration, no emoji —
  just type + whitespace.
- `src/components/dashboard/home/ParentHome.tsx:119-121` — replace the generic
  `text-center text-sm text-muted-foreground` pick-child prompt with
  `EmptyState`. Copy (needs i18n): headline "No player selected yet", body
  "Pick a child above to see their training, matches, and readiness." + CTA
  inline if `linkedChildren.length > 0` else a "Link a child" CTA.
- `ReadinessHero` empty state (when `!hasReadinessScore`): instead of a dashed
  ring, show the hero band with the eyebrow "Today", a muted `display-xl`
  em-dash, and a one-line body "Connect a wearable to track recovery" + the
  connect CTA inline. Keeps the hero's visual weight even when empty — the
  band doesn't collapse.
- Add new i18n keys to all 4 locale files (`messages/{en,es,ca,zh}.json`) under
  `parent.dashboard.home.emptyState`:
  - `noSelectionTitle`, `noSelectionBody`, `noSelectionCta`
  - And under `playerDashboard.home.hero.readiness`: `heroEmptyHeadline`,
    `heroEmptyBody` (reuse existing `emptyCta`).
  - Translations for `es`/`ca`/`zh` must be provided (I can draft these; native
    review recommended — see open questions).

### Phase 5 — Verification & docs

**Purpose:** Lint, build, visual check, and write the design-decisions note.

- Run `pnpm lint` and `pnpm build` from
  `PeakPerformanceData/peak_performance_data/`. Fix any alphabetical-order
  lint failures (imports/props/variables) introduced by new files.
- Run `pnpm tsc --noEmit` (or the repo's typecheck script — verify in
  `package.json`) to confirm no type errors from the `Surface` discriminated
  union.
- Visual review: start the dev server, navigate to `/parent` (and `/player`),
  confirm dark mode + light mode + mobile + desktop. Check the hero band,
  the 7/5 split, the inset wells, and the empty states.
- Append a `## Design decisions` note to `src/lib/design-tokens.ts` (top
  comment block) OR create `src/components/dashboard/home/primitives/README.md`
  documenting: the 3-tier surface system + when to use each, the sanctioned
  uppercase-eyebrow rule, the editorial grid (7/5 asymmetry), the display-font
  hierarchy, and "patterns to apply to the rest of the app."

## Open questions (RESOLVED via interrogation)

1. **`HeroRingTrio` `embedded` variant consumers.** **VERIFIED:**
   `FocusedAthletePanel.tsx:211` uses `<HeroRingTrio size="md"
   variant="embedded" ... />`. Also `PlayerHome.tsx:154` uses the standalone
   `lg` variant. **DECISION: keep `HeroRingTrio` as a thin alias that renders
   `ReadinessHero` with the same props**, so all three consumers
   (ParentHome, PlayerHome, FocusedAthletePanel) get the new look without
   touching their layouts. The `size="md" variant="embedded"` case renders a
   compact version of the new layout (dominant numeral + 2 inline stats,
   no wells).
2. **PlayerHome/CoachHome scope.** **DECISION: alias, all inherit.** No
   layout changes to PlayerHome/CoachHome — they get the new hero via the
   `HeroRingTrio` alias for free.
3. **Translations.** **DECISION: draft all 4 locales (en/es/ca/zh), flag for
   native review.**
4. **Display font.** **DECISION: Playfair + Barlow.** Playfair serif for hero
   headlines/eyebrows (sports-publication feel), Barlow Condensed for big
   metric numerals (scoreboard/athletic feel). Both already wired in
   `src/lib/fonts.ts`.
5. **Admin dashboard.** **DECISION: out of scope.** New tokens are compatible
   but not applied to `ClubAdminDashboard.tsx`.
6. **`dmSans` font payload.** **DECISION: wire it in** — `display: swap` +
   `preload: false` means no layout shift; lazy fetch is acceptable.
7. **Empty states.** **DECISION: type-only editorial** — headline + guiding
   sentence + inline text CTA. No illustration, no emoji.
8. **Hero band background.** **DECISION: plain bg + hairline** —
   `bg-background` with `border-t border-border/30`. No card chrome, no
   gradient wash.
9. **Greeting + Hero.** **DECISION: merge into one band** in ParentHome.
   GreetingCard component is **kept** (shared by PlayerHome/CoachHome) but
   rendered chromeless as the top portion of the hero band in ParentHome.
10. **Secondary row.** **DECISION: Coach 7 / Attendance 5** (coach is the
    human anchor).
11. **Tertiary row.** **DECISION: Tennis+Fitness 7 / Comms 5** (comms
    supports the coach narrative).
12. **Verification.** **DECISION: lint + build + typecheck + visual review.**

## Risks and edge cases

- **Token removal breakage.** Removing `surfaces.card*` could break consumers
  outside `src/components/dashboard/home/`. Mitigation: Phase 0.5 audit + keep
  aliases if needed.
- **`HeroRingTrio` consumers beyond home.** If `FocusedAthletePanel` or
  `RosterHero` depend on the 3-ring layout, the new `ReadinessHero` layout
  (1 dominant + 2 wells) may not fit their container. Mitigation: keep
  `HeroRingTrio` as an alias during this pass; migrate other consumers later.
- **Dark mode contrast.** The new `well` tier (`bg-muted/60`) and borderless
  `raised` tier rely on subtle bg/shadow differences. In dark mode shadows
  vanish (`dark:shadow-none`), so the `raised` tier needs the
  `dark:border dark:border-white/[0.06]` fallback to remain visible. Verified
  in the token spec above.
- **i18n missing keys.** If new keys aren't added to all 4 locales, next-intl
  throws at render. Mitigation: add to all 4 in Phase 4.
- **Alphabetical lint failures.** New files with multiple imports/props are
  prone to ordering lint failures. Mitigation: enforce alphabetical order in
  every new file; run `pnpm lint` before declaring done.
- **Layout shift on mobile.** The 7/5 split collapses to single-column on
  mobile. The hero band's 7-col numeral + 5-col wells must stack cleanly.
  Mitigation: use `grid-cols-1 lg:grid-cols-12` so mobile is always 1-col.
- **`GreetingCard` is shared by player/coach/parent.** Refactoring it changes
  all three views. Mitigation: the refactor is visual-only and prop-compatible;
  player/coach homes inherit the improvement.
- **No tests.** Verification relies on lint/build/visual. Mitigation: explicit
  visual review step in Phase 5.

---

## Design-Decisions Note

This note explains the patterns established by the redesign and how to apply
them to the rest of the application.

### When to use each surface tier

| Tier | When | Examples |
|------|------|----------|
| `hero` | The single dominant moment at the top of a view. No card chrome — sits on the page background. | Readiness hero band, greeting + readiness merged band |
| `raised` | Primary content that deserves visual weight. Larger radius (2xl) + subtle shadow. No border in light mode; hairline border in dark mode. | Assigned coach card, key metric cards |
| `raisedTight` | Data-dense primary content where 2xl feels too spacious. Tighter radius (lg). | Attendance card, stat tables |
| `well` | Secondary supporting data. Borderless inset on `bg-muted` — the bg contrast creates the inset feel. | Sleep/load supporting wells, coach communications teaser |
| `plain` | Tertiary/teaser content. Lowest visual weight — no border, no shadow, just `bg-card` + `rounded-lg`. | Tennis highlight, fitness test snapshot, tournament card |

**Rule:** pick the tier that matches the content's *importance*, not its *type*.
A hero metric gets `hero`; the coach card gets `raised`; a teaser gets `plain`.

### Typography hierarchy

The type scale now has real jumps between levels:

```
displayHero   (Playfair, 2.75rem, weight 600)  — one per view
displayMetric (Playfair, 2rem, weight 600)     — secondary numerals
h1            (Inter, 1.625rem, weight 600)    — page headline
h2            (Inter, 1.25rem, weight 600)     — section title
h3            (Inter, 1rem, weight 600)        — card title
body          (Inter, 0.875rem, weight 400)    — default text
bodySm        (Inter, 0.8125rem, weight 400)   — metadata, secondary info
eyebrow       (Inter, 0.6875rem, weight 600, uppercase, tracking 0.12em) — ONE per view
caption       (Inter, 0.6875rem, weight 400)   — timestamps, hints
```

**Font usage:**
- `font-display` (Playfair Display) — editorial numerals and hero headlines only.
  Use sparingly for the "sports publication" feel.
- `font-sans` (Inter) — everything else. Headings, body, labels.
- `font-data` (DM Sans) — reserved for future data-dense tables/stat grids.
- `font-condensed` (Barlow Condensed) — existing usage, unchanged.

**The eyebrow token is the ONE sanctioned uppercase-tracking label.** Reserve
it for the hero eyebrow and at most one place per view. Do NOT use it as a
default card title — use `SectionTitle` (sentence-case) instead.

### When icons are functional vs decorative

**Functional (keep):** icons that indicate an action type (Message, Calendar,
Trophy), a state (loading spinner, sync indicator), or a field type (email,
phone). The icon adds information the text alone doesn't convey.

**Decorative (remove):** icons that repeat what the title already says. A
`Dumbbell` icon next to "Training attendance" adds nothing — the title is
self-evident. A `UserRound` icon next to "Assigned coach" is redundant.

**Rule:** if removing the icon wouldn't change the user's understanding, it's
decorative. Remove it.

### Editorial grid rhythm

The parent home uses a 12-column grid with asymmetric splits:

```
┌─────────────────────────────────────────────┐
│  HERO BAND (col-span-12)                    │
│  Greeting eyebrow + readiness hero          │
├─────────────────────────────────────────────┤
│  Child switcher (col-span-12, borderless)   │
├──────────────────┬──────────────────────────┤
│  Coach (7)       │  Attendance (5)          │
├──────────────────┼──────────────────────────┤
│  Tennis+Fitness  │  Comms well (5)          │
│  (7, stacked)    │                          │
├──────────────────┴──────────────────────────┤
│  Tournament (col-span-12, quiet)            │
└─────────────────────────────────────────────┘
```

**How to apply to the rest of the app:**
1. Use `spacing.editorialGrid` + `spacing.colSpan7` / `colSpan5` for
   asymmetric rows. Avoid uniform 3-col or 4-col grids unless the content is
   truly equal-weight.
2. Use `spacing.sectionGapHero` after the hero, `sectionGapEditorial` between
   standard rows, `sectionGapTight` between grouped cards in the same column.
3. Let the hero span full width. Give primary content (7 cols) more room than
   secondary (5 cols). Collapse to 1-col on mobile.
4. Vary surface treatments within a row — don't make every card the same tier.
   A `raised` card next to a `well` creates visual hierarchy.

### What was NOT changed (future work)

- **Tennis analytics** (32 consumers of `surfaces.card`) — kept as-is. Future
  migration to the new tier system would eliminate the remaining monoculture.
- **ClubAdminDashboard** — out of scope for this pass.
- **12 generic gradient washes** identified by audit (charts, messaging, etc.)
  — future cleanup.
- **74 uppercase-tracking micro-labels** across tennis-analytics, physical-tests,
  and forms — future migration to `SectionTitle`.
- **353 hardcoded text sizes** in dashboard components — future migration to
  typography tokens.
