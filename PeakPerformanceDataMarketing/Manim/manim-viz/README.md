# Animated Shot Map

Self-explaining Manim Community visualization of tennis shot trajectories from **PeakPerformanceData** (Supabase).

**Bundled match:** Kaitlin Quevedo vs Ángela Boluda — clay, 2025-04-09 (**909 shots**, 136 points, full stats).

## Setup

```bash
cd Manim/manim-viz
python3.12 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
brew install ffmpeg pkg-config cairo   # macOS deps
```

## Render

```bash
./render.sh ql    # fast 480p preview
./render.sh qm    # 720p (recommended)
./render.sh qh    # 1080p
```

Uses `python3.12 -m manim` (works after folder move).

## Data pipeline

```bash
# Live Supabase export (requires .env)
python scripts/export_from_supabase.py

# Or rebuild from MCP SQL batch exports
python scripts/build_full_data.py
```

## Scene acts

| Act | What it explains |
|-----|------------------|
| Intro | Who played, when, surface, data volume |
| Legend | How to read arrows, colors, players |
| Court | Regulation court + scoreboard |
| Rallies | Shot-by-shot ball paths |
| Heatmap | Where balls landed (full match) |
| Dashboard | Stats, stroke mix, momentum flow |

## Why Manim Community?

Best fit for data-driven sports graphics: stable install, rich animation primitives, and straightforward chart/overlay composition.
