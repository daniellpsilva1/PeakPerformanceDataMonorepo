"""Dual-encoded hexbin map — the flagship SprawlBall-style chart.

Hexagon size = shot frequency, hexagon color = efficiency (win rate vs. average).
"""

from __future__ import annotations

import matplotlib.patches as mpatches
import matplotlib.pyplot as plt
import numpy as np
from matplotlib.collections import PolyCollection
from matplotlib.colors import Normalize

from . import style
from .court import draw_court, setup_court_axes


def hexbin_dual_encoded(
    ax,
    x: np.ndarray,
    y: np.ndarray,
    values: np.ndarray | None = None,
    gridsize: int = 8,
    extent: tuple[float, float, float, float] | None = None,
    size_scale: float = 1.0,
    cmap=None,
    norm=None,
    min_count: int = 2,
    **poly_kwargs,
) -> PolyCollection:
    """Draw a dual-encoded hexbin: size=frequency, color=value.

    Args:
        ax: matplotlib axes
        x, y: coordinates
        values: per-point values to aggregate (e.g. win indicator). If None,
                color encodes count (frequency only).
        gridsize: number of hexagons across the x range
        extent: (xmin, xmax, ymin, ymax) override for binning region
        size_scale: multiplier for hexagon size
        cmap: colormap for value encoding
        norm: Normalize for value encoding
        min_count: minimum points per hex to display

    Returns the PolyCollection.
    """
    x = np.asarray(x, dtype=float)
    y = np.asarray(y, dtype=float)

    if extent is None:
        xmin, xmax = x.min(), x.max()
        ymin, ymax = y.min(), y.max()
        # Add padding
        pad_x = (xmax - xmin) * 0.05
        pad_y = (ymax - ymin) * 0.05
        extent = (xmin - pad_x, xmax + pad_x, ymin - pad_y, ymax + pad_y)

    xmin, xmax, ymin, ymax = extent

    # Hexagon geometry
    dx = (xmax - xmin) / gridsize
    dy = dx * np.sqrt(3) / 2  # pointy-top hexagons

    # Generate hex centers
    centers = []
    cols = gridsize
    rows = int(np.ceil((ymax - ymin) / dy))

    for row in range(rows):
        for col in range(cols):
            cx = xmin + dx * (col + 0.5)
            cy = ymin + dy * (row + 0.5)
            # Offset alternate rows
            if row % 2 == 1:
                cx += dx / 2
            centers.append((cx, cy))

    centers = np.array(centers)

    # Assign points to hexagons
    hex_indices = []
    for px, py in zip(x, y):
        # Find closest hex center
        dists = np.sqrt((centers[:, 0] - px) ** 2 + (centers[:, 1] - py) ** 2)
        hex_indices.append(np.argmin(dists))

    hex_indices = np.array(hex_indices)

    # Aggregate
    hex_verts = []
    hex_values = []
    hex_counts = []
    max_count = 0

    for i, (cx, cy) in enumerate(centers):
        mask = hex_indices == i
        count = mask.sum()
        if count < min_count:
            continue

        if values is not None:
            val = np.mean(values[mask])
        else:
            val = count

        # Hexagon vertices (pointy-top)
        angles = np.linspace(0, 2 * np.pi, 7)[:-1] + np.pi / 2
        r = dx / 2 * size_scale * np.sqrt(count / max_count if max_count > 0 else 1)
        if count > max_count:
            max_count = count
        verts = np.column_stack([cx + r * np.cos(angles), cy + r * np.sin(angles)])

        hex_verts.append(verts)
        hex_values.append(val)
        hex_counts.append(count)

    # Recompute sizes with final max_count
    hex_verts = []
    for i, (cx, cy) in enumerate(centers):
        mask = hex_indices == i
        count = mask.sum()
        if count < min_count:
            continue
        if values is not None:
            val = np.mean(values[mask])
        else:
            val = count
        r = dx / 2 * size_scale * np.sqrt(count / max(max_count, 1))
        angles = np.linspace(0, 2 * np.pi, 7)[:-1] + np.pi / 2
        verts = np.column_stack([cx + r * np.cos(angles), cy + r * np.sin(angles)])
        hex_verts.append(verts)
        hex_values.append(val)
        hex_counts.append(count)

    if not hex_verts:
        return ax.add_collection(PolyCollection([], **poly_kwargs))

    if cmap is None:
        cmap, norm = style.efficiency_cmap()

    poly = PolyCollection(hex_verts, array=np.array(hex_values),
                          cmap=cmap, norm=norm, edgecolors="white",
                          linewidths=0.5, **poly_kwargs)
    ax.add_collection(poly)
    return poly


def draw_hexmap(
    shots_df,
    player: str = "host",
    value_col: str = "win",
    gridsize: int = 6,
    surface: str = "clay",
    ax=None,
    half: bool = False,
    title: str = "",
    subtitle: str = "",
    figsize: tuple[float, float] = (10, 12),
) -> plt.Figure:
    """Draw a full SprawlBall-style hexmap for a player's shots.

    Args:
        shots_df: DataFrame with bounce_x, bounce_y, and value_col
        player: 'host' or 'guest'
        value_col: column name for color encoding, or 'win' for auto win-rate
        gridsize: hex grid resolution
        surface: court surface
        ax: existing axes (if None, creates figure)
        half: draw half court only
    """
    from .data import get_player_shots

    style.apply_style()

    if ax is None:
        fig, ax = style.make_figure(figsize[0], figsize[1])
    else:
        fig = ax.figure

    # Draw court
    draw_court(ax, surface=surface, half=half)
    setup_court_axes(ax, half=half)

    # Get data — use normalized columns if available
    df = shots_df.copy()
    x_col = "bounce_x_norm" if "bounce_x_norm" in df.columns else "bounce_x"
    y_col = "bounce_y_norm" if "bounce_y_norm" in df.columns else "bounce_y"
    if x_col not in df.columns:
        return fig

    # Filter to in-play shots with valid bounce coords
    df = df.dropna(subset=[x_col, y_col])
    df = df[df["result"] == "In"]

    x = df[x_col].values
    y = df[y_col].values

    # Compute values for color encoding
    if value_col == "win":
        # Approximate: terminal + In = won, terminal + Out/Net = lost
        values = ((df["result"] == "In") & (df.get("is_terminal", False) == True)).astype(float).values
    elif value_col in df.columns:
        values = df[value_col].values
    else:
        values = None

    # Set extent to court area
    if half:
        extent = (-style.DOUBLES_HALF, style.DOUBLES_HALF, 0, style.NET_Y)
    else:
        extent = (-style.DOUBLES_HALF, style.DOUBLES_HALF, 0, style.COURT_LENGTH)

    cmap, norm = style.efficiency_cmap(vmin=0.0, vmax=1.0)

    poly = hexbin_dual_encoded(
        ax, x, y, values=values, gridsize=gridsize,
        extent=extent, cmap=cmap, norm=norm,
        min_count=2, zorder=5,
    )

    # Colorbar
    if values is not None:
        cbar = fig.colorbar(poly, ax=ax, fraction=0.03, pad=0.02)
        cbar.set_label("Win Rate", fontsize=10, fontfamily=style.BODY_FONT)
        cbar.ax.tick_params(labelsize=9)

    if title:
        style.add_header(fig, title, subtitle)

    return fig
