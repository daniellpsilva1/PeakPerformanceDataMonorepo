"""Editorial annotation helpers — callout circles, arrows, zone labels.

Inspired by SprawlBall's hand-drawn-style annotations: circles highlighting
hot zones, arrows pointing to key areas, ALL-CAPS labels with percentages.
"""

from __future__ import annotations

import matplotlib.patches as mpatches
import matplotlib.pyplot as plt
import numpy as np

from . import style


def callout_circle(ax, x, y, radius=0.8, color=None, lw=2.5, alpha=0.8, zorder=10):
    """Draw a SprawlBall-style highlight circle around a point."""
    if color is None:
        color = style.ACCENT_ORANGE
    circle = mpatches.Circle((x, y), radius, fill=False, edgecolor=color,
                             lw=lw, alpha=alpha, zorder=zorder, linestyle="-")
    ax.add_patch(circle)
    return circle


def callout_label(ax, x, y, text, offset=(1.0, 1.0), fontsize=10,
                  color=None, bold=True, ha="left", zorder=11):
    """Place an ALL-CAPS editorial label near a point with a leader line."""
    if color is None:
        color = style.INK
    ox, oy = offset
    weight = "bold" if bold else "normal"
    ax.annotate(
        text.upper(), xy=(x, y), xytext=(x + ox, y + oy),
        fontsize=fontsize, fontweight=weight, fontfamily=style.CONDENSED_FONT,
        color=color, ha=ha, va="center", zorder=zorder,
        arrowprops=dict(arrowstyle="-", color=color, lw=1.0, alpha=0.6),
    )


def zone_percentage(ax, x, y, pct, fontsize=11, color="white", zorder=10):
    """Place a percentage label directly on the court at (x, y)."""
    ax.text(x, y, f"{pct:.0f}%", fontsize=fontsize, fontweight="bold",
            fontfamily=style.CONDENSED_FONT, color=color,
            ha="center", va="center", zorder=zorder,
            path_effects=[],
            bbox=dict(boxstyle="round,pad=0.2", facecolor=style.INK,
                      edgecolor="none", alpha=0.7))


def arrow(ax, x1, y1, x2, y2, color=None, lw=2, zorder=9, style_arrow="->"):
    """Draw an annotation arrow."""
    if color is None:
        color = style.ACCENT_ORANGE
    ax.annotate("", xy=(x2, y2), xytext=(x1, y1),
                arrowprops=dict(arrowstyle=style_arrow, color=color, lw=lw),
                zorder=zorder)


def player_label(ax, x, y, name, color, fontsize=13, ha="center", zorder=12):
    """Bold player name label in condensed font."""
    ax.text(x, y, name.upper(), fontsize=fontsize, fontweight="bold",
            fontfamily=style.CONDENSED_FONT, color=color,
            ha=ha, va="center", zorder=zorder)
