#!/usr/bin/env python3
"""Generate animated SprawlBall-style figures (frame-by-frame → ffmpeg)."""
import os
import sys

BASE = os.path.dirname(os.path.abspath(__file__))
os.chdir(BASE)
sys.path.insert(0, BASE)

FIGURES = os.path.join(BASE, "figures")
VIDEOS = os.path.join(BASE, "videos")
os.makedirs(VIDEOS, exist_ok=True)

from tennisviz import style, court, data, hexmap, annotate, animate
import matplotlib.pyplot as plt
import numpy as np

md = data.load_match()
print(f"Loaded: {md.host_name} vs {md.guest_name} ({md.match_date}) — {len(md.shots)} shots")

all_shots = court.normalize_shots_df(md.shots.dropna(subset=["bounce_x", "bounce_y", "hit_y"]))
host = all_shots[all_shots["player"] == "host"]
host_in = host[(host["result"] == "In") & (host["stroke"] != "Serve")].copy()
host_in = host_in.sort_values(["set_number", "game_number", "point_number", "shot_number"]).reset_index(drop=True)

# ===========================================================================
# Animation 1: Hexmap — hexagons grow as shots stream in chronologically
# ===========================================================================
N_FRAMES = 120
FPS = 30

def draw_hexmap_frame(frame_idx, fig, ax, shots_df, gridsize, surface, total_frames):
    """Draw one frame of the animated hexmap."""
    ax.clear()
    court.draw_court(ax, surface=surface, half=True)
    court.setup_court_axes(ax, half=True, margin=0.8)

    # Progress: how many shots to show
    t = animate.progress(frame_idx, total_frames, ease=animate.ease_out)
    n_shots = max(1, int(t * len(shots_df)))
    visible = shots_df.iloc[:n_shots]

    if len(visible) >= 2:
        cmap, norm = style.efficiency_cmap(vmin=40, vmax=120)
        hexmap.hexbin_dual_encoded(
            ax, visible["bounce_x_norm"].values, visible["bounce_y_norm"].values,
            values=visible["speed_kmh"].values, gridsize=gridsize,
            extent=(-style.DOUBLES_HALF, style.DOUBLES_HALF, 0, style.NET_Y),
            cmap=cmap, norm=norm, min_count=2, zorder=5,
        )

    # Counter
    ax.text(0.02, 0.98, f"{n_shots} SHOTS", transform=ax.transAxes,
            fontsize=14, fontweight="bold", fontfamily=style.CONDENSED_FONT,
            color=style.INK, va="top", ha="left")

    style.add_header(fig, f"{md.host_name} Shot Chart",
                     f"Groundstroke bounces · vs {md.guest_name} · {md.match_date}")

print("Rendering hexmap animation...")
out_path = os.path.join(VIDEOS, "01_hexmap_animated.mp4")
animate.render_animation(
    draw_hexmap_frame,
    n_frames=N_FRAMES,
    output_path=out_path,
    fps=FPS,
    figsize=(10, 8),
    dpi=150,
    shots_df=host_in,
    gridsize=6,
    surface=md.surface,
    total_frames=N_FRAMES,
)
print(f"Done: {out_path}")

# ===========================================================================
# Animation 2: Dot density — shots appear one by one chronologically
# ===========================================================================
N_FRAMES_DOT = 150

def draw_dotdensity_frame(frame_idx, fig, ax, shots_df, total_frames):
    """Draw one frame of the animated dot density map."""
    ax.clear()
    court.draw_court(ax, surface=md.surface, half=False)
    court.setup_court_axes(ax, half=False)

    t = animate.progress(frame_idx, total_frames, ease=animate.ease_out)
    n_shots = max(1, int(t * len(shots_df)))
    visible = shots_df.iloc[:n_shots]

    stroke_colors = {
        "Forehand": "#E8742C",
        "Backhand": "#2B6CB0",
        "Volley": "#38A169",
        "Serve": "#805AD5",
        "Overhead": "#D53F8C",
    }

    for stroke, color in stroke_colors.items():
        mask = visible["stroke"] == stroke
        subset = visible[mask]
        if subset.empty:
            continue
        ax.scatter(subset["bounce_x_norm"], subset["bounce_y_norm"],
                   c=color, s=25, alpha=0.5, edgecolors="none", zorder=5,
                   label=f"{stroke} ({len(subset)})")

    ax.plot([-style.DOUBLES_HALF - 0.3, style.DOUBLES_HALF + 0.3],
            [style.NET_Y, style.NET_Y], color=style.INK, lw=2, zorder=6)

    # Counter
    ax.text(0.02, 0.98, f"{n_shots} SHOTS", transform=ax.transAxes,
            fontsize=14, fontweight="bold", fontfamily=style.CONDENSED_FONT,
            color=style.INK, va="top", ha="left")

    style.add_header(fig, "All Shots Dot Density",
                     f"{md.host_name} vs {md.guest_name} · {md.match_date}")

print("\nRendering dot density animation...")
out_path2 = os.path.join(VIDEOS, "03_dotdensity_animated.mp4")
animate.render_animation(
    draw_dotdensity_frame,
    n_frames=N_FRAMES_DOT,
    output_path=out_path2,
    fps=FPS,
    figsize=(12, 14),
    dpi=150,
    shots_df=all_shots.sort_values(["set_number", "game_number", "point_number", "shot_number"]).reset_index(drop=True),
    total_frames=N_FRAMES_DOT,
)
print(f"Done: {out_path2}")

print("\nAll animations generated.")
