"""To-scale tennis court rendering for matplotlib.

Coordinate system (meters, matches SwingVision data):
  - x: lateral, negative = ad side (left), positive = deuce side (right)
  - y: along court length, 0 = near baseline, 11.885 = net, 23.77 = far baseline
  - Host plays from far end (y≈23.77), Guest from near end (y≈0)
"""

from __future__ import annotations

import matplotlib.patches as mpatches
import matplotlib.pyplot as plt
import numpy as np

from . import style


def draw_court(ax, surface: str = "clay", half: bool = False,
               show_singles: bool = True, linewidth: float = 1.5,
               alpha: float = 0.9) -> list[mpatches.Patch]:
    """Draw a to-scale tennis court on the given axes.

    Args:
        ax: matplotlib axes
        surface: 'clay', 'hard', or 'grass'
        half: if True, draw only the near half (service box + baseline)
        show_singles: if True, draw singles sidelines
        linewidth: line width for court markings
        alpha: fill transparency

    Returns list of patches for legend/reference.
    """
    fill_color = style.get_surface_color(surface)
    line_color = style.COURT_LINE if surface != "hard" else style.COURT_LINE
    line_color_dark = style.COURT_LINE_DARK

    patches = []

    if half:
        y_min, y_max = style.BASELINE_NEAR, style.NET_Y
    else:
        y_min, y_max = style.BASELINE_NEAR, style.BASELINE_FAR

    # Court fill (doubles width)
    court = mpatches.FancyBboxPatch(
        (-style.DOUBLES_HALF, y_min),
        style.DOUBLES_WIDTH, y_max - y_min,
        boxstyle="square,pad=0", facecolor=fill_color,
        edgecolor="none", alpha=alpha, zorder=0,
    )
    ax.add_patch(court)
    patches.append(court)

    # Doubles sidelines
    for x in [-style.DOUBLES_HALF, style.DOUBLES_HALF]:
        ax.plot([x, x], [y_min, y_max], color=line_color, lw=linewidth, zorder=2)

    # Singles sidelines
    if show_singles:
        for x in [-style.SINGLES_HALF, style.SINGLES_HALF]:
            ax.plot([x, x], [y_min, y_max], color=line_color, lw=linewidth, zorder=2)

    # Baselines
    ax.plot([-style.DOUBLES_HALF, style.DOUBLES_HALF], [y_min, y_min],
            color=line_color, lw=linewidth, zorder=2)
    if not half:
        ax.plot([-style.DOUBLES_HALF, style.DOUBLES_HALF], [y_max, y_max],
                color=line_color, lw=linewidth, zorder=2)

    # Net
    ax.plot([-style.DOUBLES_HALF - 0.3, style.DOUBLES_HALF + 0.3],
            [style.NET_Y, style.NET_Y],
            color=line_color_dark, lw=linewidth * 1.5, zorder=2, linestyle="-")

    # Service lines (near and far)
    for y_sl in [style.SERVICE_LINE_NEAR, style.SERVICE_LINE_FAR]:
        if half and y_sl > y_max:
            continue
        ax.plot([-style.SINGLES_HALF, style.SINGLES_HALF], [y_sl, y_sl],
                color=line_color, lw=linewidth, zorder=2)

    # Center service line
    ax.plot([0, 0], [style.SERVICE_LINE_NEAR, style.SERVICE_LINE_FAR],
            color=line_color, lw=linewidth, zorder=2)

    # Center marks on baselines
    for y_bl in [style.BASELINE_NEAR, style.BASELINE_FAR]:
        if half and y_bl > y_max:
            continue
        ax.plot([-style.CENTER_MARK / 2, style.CENTER_MARK / 2], [y_bl, y_bl],
                color=line_color, lw=linewidth, zorder=2)

    # Service box center marks (at net on center line)
    ax.plot([0, 0], [style.NET_Y - 0.05, style.NET_Y + 0.05],
            color=line_color_dark, lw=linewidth * 0.8, zorder=2)

    return patches


def setup_court_axes(ax, half: bool = False, margin: float = 1.5):
    """Set equal aspect and axis limits for a court plot."""
    if half:
        ax.set_xlim(-style.DOUBLES_HALF - margin, style.DOUBLES_HALF + margin)
        ax.set_ylim(-margin, style.NET_Y + margin)
    else:
        ax.set_xlim(-style.DOUBLES_HALF - margin, style.DOUBLES_HALF + margin)
        ax.set_ylim(-margin, style.COURT_LENGTH + margin)
    ax.set_aspect("equal")
    ax.axis("off")


def normalize_to_half_court(x, y, hit_y=None) -> tuple[np.ndarray, np.ndarray]:
    """Normalize shot bounce coordinates so all land on the near half-court.

    Uses hit_y to determine which end the player was at when hitting:
    - If hit_y > NET_Y (far end): mirror bounce coords (y' = COURT_LENGTH - y, x' = -x)
    - If hit_y <= NET_Y (near end): keep as-is

    Args:
        x: bounce_x values (array-like or scalar)
        y: bounce_y values (array-like or scalar)
        hit_y: hit_y values for each shot. If None, assumes all from far end.

    Returns (normalized_x, normalized_y) as numpy arrays.
    """
    x = np.asarray(x, dtype=float)
    y = np.asarray(y, dtype=float)
    if hit_y is None:
        hit_y = np.full_like(y, style.COURT_LENGTH)
    else:
        hit_y = np.asarray(hit_y, dtype=float)

    # Mask for shots hit from NEAR end (need mirroring to far→near)
    near_mask = hit_y <= style.NET_Y
    x_norm = x.copy()
    y_norm = y.copy()
    x_norm[near_mask] = -x[near_mask]
    y_norm[near_mask] = style.COURT_LENGTH - y[near_mask]

    return x_norm, y_norm


def normalize_shots_df(df) -> "pd.DataFrame":
    """Add normalized bounce/hit columns to a shots DataFrame.

    Adds columns:
    - bounce_x_norm, bounce_y_norm: bounces normalized to near half
    - hit_x_norm, hit_y_norm: hit positions normalized to near half
    - is_far: bool, True if player was at far end for this shot
    """
    import pandas as pd

    df = df.copy()
    df["is_far"] = df["hit_y"] > style.NET_Y

    df["bounce_x_norm"] = df["bounce_x"]
    df["bounce_y_norm"] = df["bounce_y"]
    df["hit_x_norm"] = df["hit_x"]
    df["hit_y_norm"] = df["hit_y"]

    near = ~df["is_far"]
    df.loc[near, "bounce_x_norm"] = -df.loc[near, "bounce_x"]
    df.loc[near, "bounce_y_norm"] = style.COURT_LENGTH - df.loc[near, "bounce_y"]
    df.loc[near, "hit_x_norm"] = -df.loc[near, "hit_x"]
    df.loc[near, "hit_y_norm"] = style.COURT_LENGTH - df.loc[near, "hit_y"]

    return df
