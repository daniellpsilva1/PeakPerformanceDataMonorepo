# Manim — Tennis Match Visualizations

Animated analytics for **PeakPerformanceData** tennis matches, powered by [Manim Community](https://www.manim.community/).

## Project layout

```
Manim/
└── manim-viz/
    ├── data/match_data.json      # Full match bundle (909 shots)
    ├── lib/                      # Court, theme, components, analytics
    ├── scenes/shot_map.py        # Self-explaining shot map scene
    ├── scripts/                  # Data export & bundle builders
    └── render.sh                 # One-command render
```

## Quick start

```bash
cd Manim/manim-viz
source .venv/bin/activate   # or: .venv/bin/python3.12 -m manim ...

# Render 720p and open video
./render.sh qm
```

Output: `media/videos/shot_map/720p30/ShotMapScene.mp4`

## What the visualization shows

The **ShotMapScene** is a multi-act, self-explaining video:

1. **Intro** — players, date, surface, shot count
2. **Reading guide** — legend (stroke colors, host/guest, arrow meaning)
3. **Court + scoreboard** — clay court with player zones and set scores
4. **Live rallies** — animated shot trajectories (hit → bounce)
5. **Heatmap** — all 909 bounce locations across the match
6. **Dashboard** — points won, serve %, winners, errors, stroke mix, match-flow chart

## Sample match

**Kaitlin Quevedo vs Ángela Boluda** — clay, 2025-04-09  
Score: 6-1, 7-6 (7-2) · 909 shots · 136 points

## Refresh data from Supabase

```bash
cp .env.example .env   # SUPABASE_URL, SUPABASE_KEY, MATCH_ID
python scripts/export_from_supabase.py
./render.sh qm
```

## Customize

| Setting | File | Default |
|---------|------|---------|
| Rallies animated | `scenes/shot_map.py` → `MAX_RALLY_ANIM` | 6 |
| Heatmap sample size | `HEATMAP_SAMPLE` | 420 |
| Match ID | `.env` → `MATCH_ID` | Kaitlin vs Ángela match |
