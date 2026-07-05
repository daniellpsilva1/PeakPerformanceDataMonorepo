"""Compact UI panels — never cover the court."""

from __future__ import annotations

from manim import DOWN, LEFT, Line, ORIGIN, RIGHT, RoundedRectangle, Text, UP, VGroup, Rectangle

from lib.theme import ACCENT, BG_PANEL, GUEST_COLOR, HOST_COLOR, STROKE_COLORS, TEXT_MUTED
from lib.typography import FONT, label, title


def _panel(w: float, h: float) -> RoundedRectangle:
    return RoundedRectangle(
        width=w,
        height=h,
        corner_radius=0.1,
        fill_color=BG_PANEL,
        fill_opacity=0.94,
        stroke_color=TEXT_MUTED,
        stroke_width=1,
        stroke_opacity=0.4,
    )


def compact_scoreboard(summary: dict) -> VGroup:
    box = _panel(3.6, 1.05)
    host = label(summary["host"][:14], 17, color=HOST_COLOR)
    guest = label(summary["guest"][:14], 17, color=GUEST_COLOR)
    scores = label("  ".join(summary["set_scores"]), 19)
    block = VGroup(
        VGroup(host, guest).arrange(DOWN, aligned_edge=LEFT, buff=0.06),
        scores,
    ).arrange(DOWN, buff=0.1).move_to(box.get_center())
    cap = label("SCORE", 12, color=TEXT_MUTED).next_to(box, UP, buff=0.06).align_to(box, LEFT)
    return VGroup(box, block, cap)


def compact_legend() -> VGroup:
    box = _panel(2.5, 1.85)
    rows = VGroup()
    for stroke, color in list(STROKE_COLORS.items())[:4]:
        sw = Line(ORIGIN, RIGHT * 0.28, stroke_color=color, stroke_width=5)
        rows.add(VGroup(sw, label(stroke, 14)).arrange(RIGHT, buff=0.1))
    rows.arrange(DOWN, aligned_edge=LEFT, buff=0.08).move_to(box.get_center())
    cap = label("STROKES", 12, color=TEXT_MUTED).next_to(box, UP, buff=0.06).align_to(box, LEFT)
    return VGroup(box, rows, cap)


def _stat_row(name: str, host_v, guest_v, unit: str = "") -> VGroup:
    total = max(float(host_v) + float(guest_v), 1)
    hw = 1.6 * float(host_v) / total
    gw = 1.6 * float(guest_v) / total
    bars = VGroup(
        Rectangle(width=max(hw, 0.03), height=0.14, fill_color=HOST_COLOR, fill_opacity=0.95, stroke_width=0),
        Rectangle(width=max(gw, 0.03), height=0.14, fill_color=GUEST_COLOR, fill_opacity=0.95, stroke_width=0),
    ).arrange(RIGHT, buff=0.05)
    return VGroup(
        label(name, 15),
        bars,
        label(f"{host_v:g}{unit}  /  {guest_v:g}{unit}", 13, color=TEXT_MUTED),
    ).arrange(DOWN, aligned_edge=LEFT, buff=0.06)


def key_stats_rail(summary: dict) -> VGroup:
    box = _panel(3.9, 4.6)
    cap = title("Key stats", 20).next_to(box, UP, buff=0.08).align_to(box, LEFT)
    rows = VGroup(
        _stat_row("Points won", summary["host_points_won"], summary["guest_points_won"]),
        _stat_row("1st serve", summary["host_1st_serve_pct"], summary["guest_1st_serve_pct"], "%"),
        _stat_row("Winners", summary["host_winners"], summary["guest_winners"]),
        _stat_row("Errors", summary["host_errors"], summary["guest_errors"]),
        _stat_row("Aces", summary["host_aces"], summary["guest_aces"]),
    ).arrange(DOWN, aligned_edge=LEFT, buff=0.18).move_to(box.get_center())

    foot = label(f"Avg serve {summary['avg_serve_speed']:.0f} km/h", 13, color=ACCENT)
    foot.next_to(box, DOWN, buff=0.08)
    return VGroup(box, rows, cap, foot)
