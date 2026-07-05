"""Court heatmap from bounce coordinates."""

from __future__ import annotations

from collections import defaultdict

import numpy as np
from manim import Rectangle, VGroup
from manim.utils.color import interpolate_color

from lib.court import (
    COURT_LENGTH,
    COURT_WIDTH,
    HALF_LENGTH,
    HALF_WIDTH,
    SCALE,
    court_to_manim,
    in_court_meters,
)
from lib.theme import GUEST_COLOR, HEAT_HIGH, HEAT_LOW, HOST_COLOR


def build_bounce_heatmap(
    shots: list[dict],
    shift: np.ndarray,
    grid_cols: int = 18,
    grid_rows: int = 40,
) -> VGroup:
    """Density grid overlaid on the court — the primary visual."""
    cell_w = (COURT_WIDTH * SCALE) / grid_cols
    cell_h = (COURT_LENGTH * SCALE) / grid_rows
    half_w = HALF_WIDTH * SCALE
    half_l = HALF_LENGTH * SCALE

    counts: dict[tuple[int, int], int] = defaultdict(int)
    host_counts: dict[tuple[int, int], int] = defaultdict(int)
    guest_counts: dict[tuple[int, int], int] = defaultdict(int)

    for shot in shots:
        try:
            bx, by = float(shot["bounce_x"]), float(shot["bounce_y"])
        except (KeyError, TypeError, ValueError):
            continue
        if not in_court_meters(bx, by):
            continue

        pos = court_to_manim(bx, by)
        col = int((pos[0] + half_w) / (2 * half_w) * grid_cols)
        row = int((pos[1] + half_l) / (2 * half_l) * grid_rows)
        col = min(max(col, 0), grid_cols - 1)
        row = min(max(row, 0), grid_rows - 1)
        key = (col, row)
        counts[key] += 1
        if shot.get("player") == "guest":
            guest_counts[key] += 1
        else:
            host_counts[key] += 1

    if not counts:
        return VGroup()

    peak = max(counts.values())
    cells = VGroup()

    for (col, row), count in counts.items():
        cx = -half_w + (col + 0.5) * cell_w
        cy = -half_l + (row + 0.5) * cell_h
        center = np.array([cx, cy, 0.0]) + shift

        t = count / peak
        # Blend host/guest tint into heat color
        host_share = host_counts[(col, row)] / count
        base = interpolate_color(HEAT_LOW, HEAT_HIGH, t)
        if host_share > 0.55:
            tint = HOST_COLOR
        elif host_share < 0.45:
            tint = GUEST_COLOR
        else:
            tint = None

        cell = Rectangle(
            width=cell_w * 0.92,
            height=cell_h * 0.92,
            fill_color=base,
            fill_opacity=0.25 + 0.7 * t,
            stroke_width=0,
        ).move_to(center)
        cells.add(cell)

    return cells
