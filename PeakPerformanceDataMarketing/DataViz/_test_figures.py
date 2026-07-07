#!/usr/bin/env python3
"""Generate all SprawlBall-style figures for the Boluda match."""
import os
import sys

BASE = os.path.dirname(os.path.abspath(__file__))
os.chdir(BASE)
sys.path.insert(0, BASE)

FIGURES = os.path.join(BASE, "figures")
os.makedirs(FIGURES, exist_ok=True)

from tennisviz import style, court, data, hexmap, annotate
import matplotlib.pyplot as plt
import matplotlib.patches as mpatches
import numpy as np

md = data.load_match()
print(f"Loaded: {md.host_name} vs {md.guest_name} ({md.match_date}) — {len(md.shots)} shots")

# Normalize all shots once
all_shots = court.normalize_shots_df(md.shots.dropna(subset=["bounce_x", "bounce_y", "hit_y"]))
host = all_shots[all_shots["player"] == "host"]
guest = all_shots[all_shots["player"] == "guest"]

# ===========================================================================
# Figure 1: Bounce Hexmap — Kaitlin's shot placement (half court, frequency)
# ===========================================================================
host_in = host[host["result"] == "In"]
host_in = host_in[host_in["stroke"] != "Serve"]  # groundstrokes only

fig, ax = style.make_figure(10, 8)
court.draw_court(ax, surface=md.surface, half=True)
court.setup_court_axes(ax, half=True, margin=0.8)

# Use speed as color encoding, size as frequency
cmap, norm = style.efficiency_cmap(vmin=40, vmax=120)
poly = hexmap.hexbin_dual_encoded(
    ax, host_in["bounce_x_norm"].values, host_in["bounce_y_norm"].values,
    values=host_in["speed_kmh"].values, gridsize=6,
    extent=(-style.DOUBLES_HALF, style.DOUBLES_HALF, 0, style.NET_Y),
    cmap=cmap, norm=norm, min_count=2, zorder=5,
)
cbar = fig.colorbar(poly, ax=ax, fraction=0.03, pad=0.02)
cbar.set_label("Avg Speed (km/h)", fontsize=10, fontfamily=style.BODY_FONT)
cbar.ax.tick_params(labelsize=9)

style.add_header(fig, f"{md.host_name} Shot Chart",
                 f"Groundstroke bounce locations · vs {md.guest_name} · {md.match_date} · "
                 f"Size = frequency, Color = avg speed")
fig.savefig(os.path.join(FIGURES, "01_bounce_hexmap_host.png"), dpi=200,
            bbox_inches="tight", facecolor=style.BG_COLOR)
print("Saved 01_bounce_hexmap_host.png")
plt.close(fig)

# ===========================================================================
# Figure 2: Serve Placement Map — 1st vs 2nd serve, both players
# ===========================================================================
fig, axes = plt.subplots(1, 2, figsize=(14, 8))
fig.patch.set_facecolor(style.BG_COLOR)

for idx, (serve_type, serve_label) in enumerate([
    ("first_serve", "1ST SERVE"),
    ("second_serve", "2ND SERVE"),
]):
    ax = axes[idx]
    ax.set_facecolor(style.BG_COLOR)
    court.draw_court(ax, surface=md.surface, half=True)
    court.setup_court_axes(ax, half=True, margin=0.8)

    for player, color, name in [
        ("host", style.PLAYER_HOST, md.host_name),
        ("guest", style.PLAYER_GUEST, md.guest_name),
    ]:
        serves = data.get_serves(md.shots, player, serve_type)
        serves = serves[serves["result"] == "In"]
        serves = serves.dropna(subset=["bounce_x", "bounce_y", "hit_y"])
        if serves.empty:
            continue
        bx, by = court.normalize_to_half_court(
            serves["bounce_x"].values,
            serves["bounce_y"].values,
            serves["hit_y"].values,
        )
        ax.scatter(bx, by, c=color, s=80, alpha=0.75, edgecolors="white",
                   linewidths=0.8, zorder=5, label=f"{name} ({len(bx)})")

    ax.set_title(serve_label, fontsize=18, fontweight="bold",
                 fontfamily=style.CONDENSED_FONT, color=style.INK, pad=12)

style.add_header(fig, "Serve Placement",
                 f"{md.host_name} vs {md.guest_name} · {md.match_date} · "
                 f"Orange = {md.host_name}, Blue = {md.guest_name}")
axes[0].legend(loc="lower left", fontsize=10, framealpha=0.8)
fig.tight_layout(rect=[0, 0, 1, 0.92])
fig.savefig(os.path.join(FIGURES, "02_serve_placement.png"), dpi=200,
            bbox_inches="tight", facecolor=style.BG_COLOR)
print("Saved 02_serve_placement.png")
plt.close(fig)

# ===========================================================================
# Figure 3: All-Shots Dot Density — full court, colored by stroke type
# ===========================================================================
fig, ax = style.make_figure(12, 14)
court.draw_court(ax, surface=md.surface, half=False)
court.setup_court_axes(ax, half=False)

stroke_colors = {
    "Forehand": "#E8742C",
    "Backhand": "#2B6CB0",
    "Volley": "#38A169",
    "Serve": "#805AD5",
    "Overhead": "#D53F8C",
    "Feed": "#718096",
}

for stroke, color in stroke_colors.items():
    mask = (all_shots["stroke"] == stroke) & (all_shots["result"] == "In")
    subset = all_shots[mask]
    if subset.empty:
        continue
    ax.scatter(subset["bounce_x_norm"], subset["bounce_y_norm"],
               c=color, s=25, alpha=0.5, edgecolors="none", zorder=5,
               label=f"{stroke} ({len(subset)})")

# Draw net line emphasis
ax.plot([-style.DOUBLES_HALF - 0.3, style.DOUBLES_HALF + 0.3],
        [style.NET_Y, style.NET_Y], color=style.INK, lw=2, zorder=6, linestyle="-")

# Legend
handles, labels = ax.get_legend_handles_labels()
ax.legend(handles, labels, loc="upper right", fontsize=10, framealpha=0.9,
          title="Stroke Type", title_fontsize=11)

style.add_header(fig, "All Shots Dot Density",
                 f"{md.host_name} vs {md.guest_name} · {md.match_date} · "
                 f"Every bounce plotted · Colored by stroke type")
fig.savefig(os.path.join(FIGURES, "03_dot_density.png"), dpi=200,
            bbox_inches="tight", facecolor=style.BG_COLOR)
print("Saved 03_dot_density.png")
plt.close(fig)

# ===========================================================================
# Figure 4: Winner / Error Terminal Map — outcomes on half court
# ===========================================================================
fig, axes = plt.subplots(1, 2, figsize=(14, 8))
fig.patch.set_facecolor(style.BG_COLOR)

outcomes = [
    ("out", "OUT", "#E53E3E", lambda df: df[df["result"] == "Out"]),
    ("net", "NET", "#3182CE", lambda df: df[df["result"] == "Net"]),
]

for idx, (key, label, color, filter_fn) in enumerate(outcomes):
    ax = axes[idx]
    ax.set_facecolor(style.BG_COLOR)
    court.draw_court(ax, surface=md.surface, half=True)
    court.setup_court_axes(ax, half=True, margin=0.8)

    for player, pcolor, name in [
        ("host", style.PLAYER_HOST, md.host_name),
        ("guest", style.PLAYER_GUEST, md.guest_name),
    ]:
        player_shots = all_shots[all_shots["player"] == player]
        subset = filter_fn(player_shots)
        subset = subset.dropna(subset=["bounce_x_norm", "bounce_y_norm"])
        if subset.empty:
            continue
        ax.scatter(subset["bounce_x_norm"], subset["bounce_y_norm"],
                   c=pcolor, s=100, alpha=0.7, edgecolors="white",
                   linewidths=0.8, zorder=5, label=f"{name} ({len(subset)})")

    ax.set_title(label, fontsize=18, fontweight="bold",
                 fontfamily=style.CONDENSED_FONT, color=style.INK, pad=12)
    ax.legend(loc="lower left", fontsize=10, framealpha=0.8)

style.add_header(fig, "Terminal Shots",
                 f"{md.host_name} vs {md.guest_name} · {md.match_date} · "
                 f"Where points ended")
fig.tight_layout(rect=[0, 0, 1, 0.92])
fig.savefig(os.path.join(FIGURES, "04_terminal_map.png"), dpi=200,
            bbox_inches="tight", facecolor=style.BG_COLOR)
print("Saved 04_terminal_map.png")
plt.close(fig)

# ===========================================================================
# Figure 5: Ray Plot — shot direction vectors from hit to bounce
# ===========================================================================
fig, ax = style.make_figure(10, 14)
court.draw_court(ax, surface=md.surface, half=False)
court.setup_court_axes(ax, half=False)

# Plot rays: hit position → bounce position for host groundstrokes
host_gs = host[(host["stroke"].isin(["Forehand", "Backhand"])) & (host["result"] == "In")]
host_gs = host_gs.dropna(subset=["hit_x_norm", "hit_y_norm", "bounce_x_norm", "bounce_y_norm"])

for _, row in host_gs.iterrows():
    color = "#E8742C" if row["stroke"] == "Forehand" else "#2B6CB0"
    ax.annotate("",
                xy=(row["bounce_x_norm"], row["bounce_y_norm"]),
                xytext=(row["hit_x_norm"], row["hit_y_norm"]),
                arrowprops=dict(arrowstyle="->", color=color, lw=0.8, alpha=0.3),
                zorder=4)

# Draw hit positions as small dots
fh = host_gs[host_gs["stroke"] == "Forehand"]
bh = host_gs[host_gs["stroke"] == "Backhand"]
ax.scatter(fh["hit_x_norm"], fh["hit_y_norm"], c="#E8742C", s=10, alpha=0.5, zorder=5, label="Forehand")
ax.scatter(bh["hit_x_norm"], bh["hit_y_norm"], c="#2B6CB0", s=10, alpha=0.5, zorder=5, label="Backhand")

ax.plot([-style.DOUBLES_HALF - 0.3, style.DOUBLES_HALF + 0.3],
        [style.NET_Y, style.NET_Y], color=style.INK, lw=2, zorder=6)
ax.legend(loc="upper right", fontsize=10, framealpha=0.9)

style.add_header(fig, f"{md.host_name} Shot Trajectories",
                 f"Groundstroke rays: hit-to-bounce · vs {md.guest_name} · {md.match_date} · "
                 f"Orange = Forehand, Blue = Backhand")
fig.savefig(os.path.join(FIGURES, "05_ray_plot.png"), dpi=200,
            bbox_inches="tight", facecolor=style.BG_COLOR)
print("Saved 05_ray_plot.png")
plt.close(fig)

print("\nAll 5 figures generated.")
