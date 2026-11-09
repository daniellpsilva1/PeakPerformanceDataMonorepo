# UI Megaplan — Competitive Benchmarks

Research backing the mobile-first redesign patterns used in the 120-task megaplan
(`~/.devin/plans/plan-0864ac9f7fc97e88.md`). Each pattern lists the source product,
the concrete behaviour, and where it maps in this codebase. Written 2026-11-06.

## Overview / coach home — Whoop, Oura, Apple Health

1. **Score-first, three-tier progressive disclosure (Whoop).** The overview shows
   only the numbers that answer "what should I do today" (Recovery %, Strain,
   Sleep), each tile a doorway to a trend view, then raw data behind it. Density
   increases only on demand.
   → `SquadStatusStrip` is the tier-1 strip (readiness, reporting, at-risk,
   coverage as compact tiles); cards below are the tier-2 doors into detail pages.
2. **"One big thing" daily focus (Oura Today tab).** A single attention callout
   outranks summary tiles; semantic colour marks state before the user reads.
   → `AttentionListCard` sits directly under the status strip, max 3 rows with
   reason chips (`Active injury`, `High training load`) and a See-all path.
3. **Meaning over metrics (Apple Health critique).** App-store review analysis of
   health apps shows the dominant complaint is "data without interpretation" —
   competitors that boil charts down to one number win.
   → Tiles carry a status line (`1 no device`) and the no-wearables state is a
   single "Connect wearables" card + operational counts rather than four zeros.

## Physio charts (`/charts`) — Whoop, Oura, Apple Health

1. **Single question per screen (Whoop tier-2).** A trend view answers "am I
   getting better or worse" — one chart per question, never a dashboard wall.
   → Group tabs (Recovery/Sleep/Training) with a labelled pill range control
   ("1 mo/3 mo/1 yr/All" replacing cryptic `1M/3M` Select values).
2. **Three-level visualisation (Oura).** Rings/bars for glance, focused metric
   cards for vitals + short-term pattern, exploratory views for long-term detail.
   → Metric cards show unit + latest value + delta + sparkline in the header;
   secondary metrics collapsed behind a "More metrics" disclosure.
3. **Personal-baseline framing.** "Within your range" beats population averages;
   empty states push connection, not blank charts.
   → No-provider state renders a clear "Connect a wearable" CTA instead of
   empty chart chrome.

## Training / reports — TeamBuildr, Hudl-style coach tools

1. **Calendar is the workspace (TeamBuildr).** Coaches live in week view; the
   primary action (build/add session) is always reachable from the header, one
   tap away, never buried under tabs.
   → "Add Session" moved into the `PageHeader` title row (`?action=new` deep
   link kept); week strip shows weekday+date chips with today highlight.
2. **Fewer clicks to program (TeamBuildr BUILD).** Drag/copy/undo speed comes
   from dense rows and multi-select, not more screens.
   → Search + filter + view toggle collapsed into one `ToolbarRow`; sort lives
   inside the filter sheet.
3. **Session notes pushed in one action (coach command-centre pattern).** The
   report list is a work queue: status chip (Draft/Published), date grouping,
   overflow menu for secondary actions.
   → `ReportRow` shows player + type + status + date; duplicate titles get
   session/time context; `mobileActionBar` removed in favour of a header action.

## Tennis analytics — SwingVision

1. **Record is the hero action.** SwingVision centres the tab bar on Record and
   keeps Stats one tap behind; import is secondary chrome.
   → `Score live match` primary + `Import match` outline sit side-by-side in the
   header; the old MoreVertical import menu is gone.
2. **Result-first match rows.** Match cards read W/L + score before meta
   (surface, date, points) — outcome scans before detail.
   → Result chip, score line, and one meta row per card; per-card overflow only
   for secondary actions (delete etc.).
3. **Insight cards over stat dumps.** Priorities ("top 3 things to fix") precede
   recommendations and raw shot stats.
   → Insights tab leads with key-takeaway PriorityCards, then Recommendations;
   dense prose reduced in favour of metric + target visuals.

## Lists & settings — Linear, Notion

1. **Rows carry only the decision (Linear/Notion list view).** ~32px rows: title,
   one status, one detail — everything else belongs to the detail screen. Same
   slot layout on every row so the eye scans a column, not each item.
   → Players/messages/reports rows: avatar/name + status chip/dot + one meta +
   chevron; hover-only actions replaced with always-visible overflow menus.
2. **Sticky group headers with counts (Linear display options).** Grouped lists
   keep the header pinned and show the group count.
   → Report list groups by month with sticky headers; players header carries
   the count in the subtitle.
3. **Settings as flat rows with chevrons (Notion).** Settings are a grouped list
   of labelled rows — status text left, single compact action right — not a grid
   of cards or paired outline buttons.
   → `SettingsRow`/`SettingsGroup` primitives; Support & Feedback collapsed to
   one chevron row; Apple/Google rows reuse `auth/provider-icons.tsx` marks;
   theme picked via visual light/dark/system selector inside Preferences.

## Cross-cutting rules adopted

- **Semantic colour carries state** (Oura/Whoop) — `StatusDot` + status chips,
  never raw hex classes (enforced by `check-mobile-ui-rules.mjs`).
- **Skeletons match loaded dimensions** (Linear) — loading states reserve the
  exact row/card height (TodaysCourtCard skeleton, lazy dashboard cards).
- **Density via icon-over-label** once vocabulary is learned (Linear) — compact
  segmented controls, icon-only overflow triggers with 44px targets.
