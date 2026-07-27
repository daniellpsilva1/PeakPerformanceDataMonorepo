# BodyViz — Athlete Digital Twin

Interactive 3D body twin for visualizing athlete wellness data from wearable
devices. Built with React Three Fiber, TypeScript, and the PPD design system.

## Packages

| Package | Description |
|---------|-------------|
| `@bodyviz/tokens` | PPD brand colors, typography, body-system semantic colors |
| `@bodyviz/core` | DailySnapshot types, normalize(), tour state machine, readiness helper |
| `@bodyviz/data` | Zod schemas, demo fixtures, provider capability matrix |
| `@bodyviz/shaders` | GLSL shaders: fresnel shell, organ glow, pulse |
| `@bodyviz/react` | R3F components: BodyTwin, BodyCanvas, SystemSpotlight, DayScrubber, TourControls, WebGLGate, FallbackSilhouette |

## Apps

- **demo** — Vite marketing demo with navy aurora atmosphere
- **gallery** — Ladle stories for component development

## Quick Start

```bash
# Install dependencies
pnpm install

# Build all packages
pnpm turbo build

# Run tests
pnpm turbo test

# Start demo dev server
pnpm --filter demo dev

# Start gallery (Ladle)
pnpm --filter @bodyviz/gallery dev
```

## Architecture

```
ThreeJS/
├── packages/
│   ├── tokens/      # Design tokens (colors, typography, body systems)
│   ├── core/        # Data types, tour state machine, readiness logic
│   ├── data/        # Zod schemas, demo fixtures, provider capabilities
│   ├── shaders/     # GLSL shaders for body visualization
│   └── react/       # R3F components and UI controls
├── apps/
│   ├── demo/        # Interactive marketing demo
│   └── gallery/     # Ladle component gallery
├── assets/
│   └── models/      # GLB model sources (see SOURCES.md)
├── pnpm-workspace.yaml
├── turbo.json
└── tsconfig.json
```

## Tour Stops

The body twin guides viewers through 6 wellness systems:

1. **Sleep** — Brain region, sleep score & stages
2. **Recovery & Readiness** — Full body, composite readiness score
3. **HRV** — Heart region, RMSSD variability
4. **Resting Heart Rate** — Heart region, baseline cardiac rhythm
5. **Training Load** — Muscles/limbs, accumulated load
6. **Stress** — Full body, stress average (Garmin/demo only)

## Data Sources

- **Demo fixtures**: Anonymized sample data in `@bodyviz/data`
- **Production**: PPC graphs API + Hetzner OpenWearables ClickHouse warehouse
- **Never** uses stale Supabase `garmin_connect_*` tables for live data

## Accessibility

- WebGL detection with automatic SVG fallback (`FallbackSilhouette`)
- `prefers-reduced-motion` support — disables animations and uses 2D fallback
- All interactive controls are keyboard-accessible

## License

MIT
