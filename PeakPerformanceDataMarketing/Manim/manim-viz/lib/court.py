"""Tennis court geometry for SwingVision coordinates."""

from __future__ import annotations

import numpy as np
from manim import Line, Rectangle, RoundedRectangle, VGroup

from lib.theme import CLAY_BASE, CLAY_DARK, CLAY_LIGHT, LINE_COURT, NET_COLOR, TEXT_MUTED
from lib.typography import label

COURT_WIDTH = 10.97
COURT_LENGTH = 23.77
HALF_WIDTH = COURT_WIDTH / 2
HALF_LENGTH = COURT_LENGTH / 2
SERVICE_DEPTH = 6.40
NET_Y = HALF_LENGTH

# Sized to fill right ~55% of 16:9 frame
SCALE = 0.30

# Strict ITF singles bounds (meters, origin at net center line)
COURT_X_MIN, COURT_X_MAX = -HALF_WIDTH, HALF_WIDTH
COURT_Y_MIN, COURT_Y_MAX = 0.0, COURT_LENGTH


def court_to_manim(x: float, y: float) -> np.ndarray:
    return np.array([x * SCALE, (y - NET_Y) * SCALE, 0.0])


def in_court_meters(x: float, y: float, margin: float = 0.15) -> bool:
    return (
        COURT_X_MIN - margin <= x <= COURT_X_MAX + margin
        and COURT_Y_MIN - margin <= y <= COURT_Y_MAX + margin
    )


def clip_to_court_meters(x: float, y: float) -> tuple[float, float]:
    x = float(np.clip(x, COURT_X_MIN, COURT_X_MAX))
    y = float(np.clip(y, COURT_Y_MIN, COURT_Y_MAX))
    return x, y


def court_bounds_manim(shift: np.ndarray) -> tuple[float, float, float, float]:
    """Return xmin, xmax, ymin, ymax in manim coords."""
    half_w = HALF_WIDTH * SCALE
    half_l = HALF_LENGTH * SCALE
    return (
        shift[0] - half_w,
        shift[0] + half_w,
        shift[1] - half_l,
        shift[1] + half_l,
    )


def build_tennis_court(surface: str = "clay") -> VGroup:
    court = VGroup()
    half_w = HALF_WIDTH * SCALE
    half_l = HALF_LENGTH * SCALE
    service_depth = SERVICE_DEPTH * SCALE

    base = RoundedRectangle(
        width=COURT_WIDTH * SCALE + 0.2,
        height=COURT_LENGTH * SCALE + 0.2,
        corner_radius=0.06,
        fill_color=CLAY_DARK,
        fill_opacity=1,
        stroke_width=0,
    )
    playing = Rectangle(
        width=COURT_WIDTH * SCALE,
        height=COURT_LENGTH * SCALE,
        fill_color=CLAY_BASE,
        fill_opacity=1,
        stroke_color=LINE_COURT,
        stroke_width=3,
    )
    court.add(base, playing)

    line_kw = dict(stroke_color=LINE_COURT, stroke_width=2, stroke_opacity=0.9)
    court.add(
        Line([-half_w, 0, 0], [half_w, 0, 0], stroke_color=NET_COLOR, stroke_width=6),
        Line([-half_w, service_depth, 0], [half_w, service_depth, 0], **line_kw),
        Line([-half_w, -service_depth, 0], [half_w, -service_depth, 0], **line_kw),
        Line([0, service_depth, 0], [0, half_l, 0], **line_kw),
        Line([0, -service_depth, 0], [0, -half_l, 0], **line_kw),
    )
    return court


def player_zone_labels(host_name: str, guest_name: str) -> VGroup:
    half_l = HALF_LENGTH * SCALE
    host = label(host_name.split()[0], 20, color=TEXT_MUTED).move_to([0, -half_l - 0.38, 0])
    guest = label(guest_name.split()[0], 20, color=TEXT_MUTED).move_to([0, half_l + 0.38, 0])
    return VGroup(host, guest)


def court_clip_mask(shift: np.ndarray) -> Rectangle:
    """Invisible clip reference matching playing surface."""
    return Rectangle(
        width=COURT_WIDTH * SCALE,
        height=COURT_LENGTH * SCALE,
        stroke_width=0,
        fill_opacity=0,
    ).move_to(shift)
