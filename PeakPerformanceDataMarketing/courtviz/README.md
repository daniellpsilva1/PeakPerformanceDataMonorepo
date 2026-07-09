# courtviz

A professional tennis data visualization library for React.

Inspired by [The SprawlBall](https://www.basketballanalyticsbook.com/) and [Hoop Atlas](https://hoopatlas.com/) — bringing the same editorial-quality visual language to tennis.

## Features

- **Framework-agnostic core**: Court geometry, coordinate normalization, and stats computation in pure TypeScript
- **React SVG components**: `<Court>` with full/half views, 3 surfaces, portrait/landscape orientation
- **Three themes**: SprawlBall (warm paper), PPD Dark (app), Broadcast (high-contrast video)
- **Dual-encoded hexbins**: Size = frequency, color = efficiency (win rate vs. corpus baseline)
- **True point-winner attribution**: Shots↔points join replaces the old `is_terminal` approximation
- **Supabase integration**: Direct loading from SwingVision match data
- **Static + animated + interactive**: Single codebase powers editorial graphics, Remotion videos, and Next.js components

## Packages

| Package | Description |
|---------|-------------|
| `@courtviz/core` | Court geometry, scales, normalization, hexbin, stats |
| `@courtviz/data` | Zod schemas, Supabase loader, shots↔points join |
| `@courtviz/themes` | Design tokens (SprawlBall-inspired palettes, typography) |
| `@courtviz/react` | React SVG components (`<Court>`) |
| `@courtviz/render` | Server-side SVG/PNG export |

## Quick Start

```bash
pnpm install
pnpm build
pnpm test
```

### Gallery (Ladle)

```bash
pnpm --filter @courtviz/gallery dev
```

### Usage

```tsx
import { Court } from "@courtviz/react";
import { sprawlball } from "@courtviz/themes";

<Court surface="clay" theme={sprawlball} width={1080} height={1080} />
```

## Architecture

```
courtviz/
├── packages/
│   ├── core/       # Geometry, scales, stats (no React dependency)
│   ├── data/       # Zod schemas, Supabase loader, shots↔points join
│   ├── themes/     # Design tokens
│   ├── react/      # SVG components
│   └── render/     # SSR to SVG/PNG
├── apps/
│   └── gallery/    # Ladle component gallery
└── fixtures/       # Anonymized match data for testing
```

## License

MIT
