"""Shot map + bounce heatmap — court-first, high-resolution layout."""

from __future__ import annotations

import sys
from pathlib import Path

import numpy as np
from manim import (
    AnimationGroup,
    Create,
    FadeIn,
    FadeOut,
    LaggedStart,
    Line,
    Scene,
    VGroup,
    DOWN,
    LEFT,
    RIGHT,
    UP,
    UL,
    UR,
    DR,
    ORIGIN,
)

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

from lib.analytics import build_summary, group_shots_by_point  # noqa: E402
from lib.components import compact_legend, compact_scoreboard, key_stats_rail  # noqa: E402
from lib.court import (  # noqa: E402
    build_tennis_court,
    clip_to_court_meters,
    court_to_manim,
    in_court_meters,
    player_zone_labels,
)
from lib.data import load_match_data  # noqa: E402
from lib.heatmap import build_bounce_heatmap  # noqa: E402
from lib.theme import BG, PLAYER_COLORS, RESULT_ALPHA, STROKE_COLORS  # noqa: E402
from lib.typography import label, title  # noqa: E402

# Court sits in the right portion of frame; stats on the left
COURT_SHIFT = RIGHT * 2.05
MAX_RALLY_ANIM = 3
RALLY_SHOT_CAP = 8


class ShotMapScene(Scene):
    def setup(self) -> None:
        self.camera.background_color = BG

    def construct(self) -> None:
        data = load_match_data()
        summary = build_summary(data)
        shots = [s for s in data["shots"] if _shot_on_court(s)]
        rallies = group_shots_by_point(shots)

        court = build_tennis_court(summary["surface"]).move_to(COURT_SHIFT)
        names = player_zone_labels(summary["host"], summary["guest"]).shift(COURT_SHIFT)
        heatmap = build_bounce_heatmap(shots, COURT_SHIFT)

        header = self._header(summary)
        board = compact_scoreboard(summary).to_corner(UR, buff=0.35)
        legend = compact_legend().to_corner(DR, buff=0.35)
        rail = key_stats_rail(summary).to_corner(UL, buff=0.4)

        # ── 1. Court + header (immediate context) ───────────────────
        self.play(
            FadeIn(header, shift=DOWN * 0.15),
            Create(court),
            FadeIn(names),
            FadeIn(board, shift=LEFT * 0.2),
            run_time=1.4,
        )
        self.wait(0.3)

        # ── 2. HEATMAP — primary visual ─────────────────────────────
        heat_title = label("Bounce heatmap — every landing spot", 22).next_to(header, DOWN, buff=0.15)
        heat_sub = label(
            f"{len(shots)} in-court bounces  ·  brighter = more traffic",
            16,
            color="#9AA8C7",
        ).next_to(heat_title, DOWN, buff=0.08)
        self.play(FadeIn(heat_title), FadeIn(heat_sub))

        if len(heatmap) > 0:
            self.play(
                LaggedStart(*[FadeIn(c, scale=0.6) for c in heatmap], lag_ratio=0.012),
                run_time=4.0,
            )
        self.wait(0.6)

        # ── 3. Sample rally traces (clipped, subtle) ────────────────
        trace_note = label("Sample rally traces (hit → bounce)", 18).to_edge(DOWN, buff=0.55)
        self.play(FadeIn(trace_note), FadeIn(legend, shift=UP * 0.1))

        traces = VGroup()
        for _, rally_shots in rallies[:MAX_RALLY_ANIM]:
            for shot in rally_shots[:RALLY_SHOT_CAP]:
                seg = self._trace_segment(shot, COURT_SHIFT)
                if seg:
                    traces.add(seg)

        if len(traces) > 0:
            self.play(
                LaggedStart(*[Create(t) for t in traces], lag_ratio=0.08),
                run_time=2.5,
            )
        self.wait(0.5)

        # Keep heatmap bright; dim traces
        self.play(traces.animate.set_opacity(0.35), FadeOut(trace_note), run_time=0.4)

        # ── 4. Stats rail — court stays visible ─────────────────────
        self.play(FadeIn(rail, shift=RIGHT * 0.2), run_time=1.0)

        insight = label(
            f"{summary['match_winner']} · {summary['host_points_won']}-{summary['guest_points_won']} points"
            f" · 1st serve {summary['host_1st_serve_pct']:.0f}% vs {summary['guest_1st_serve_pct']:.0f}%",
            18,
            color="#F7B731",
        ).to_edge(DOWN, buff=0.35)
        self.play(FadeIn(insight, shift=UP * 0.1))
        self.wait(3)

    def _header(self, summary: dict) -> VGroup:
        t = title(f"{summary['host']}  vs  {summary['guest']}", 34)
        sub = label(
            f"{summary['date']}  ·  {summary['surface'].title()}  ·  {summary['total_shots']} shots",
            20,
            color="#9AA8C7",
        )
        return VGroup(t, sub).arrange(DOWN, buff=0.12).to_edge(UP, buff=0.35)

    def _trace_segment(self, shot: dict, shift: np.ndarray):
        try:
            hx, hy = float(shot["hit_x"]), float(shot["hit_y"])
            bx, by = float(shot["bounce_x"]), float(shot["bounce_y"])
        except (KeyError, TypeError, ValueError):
            return None

        if not (in_court_meters(hx, hy, margin=0.8) and in_court_meters(bx, by)):
            return None

        hx, hy = clip_to_court_meters(hx, hy)
        bx, by = clip_to_court_meters(bx, by)
        start = court_to_manim(hx, hy) + shift
        end = court_to_manim(bx, by) + shift

        if np.linalg.norm(end - start) < 0.05:
            return None

        stroke = shot.get("stroke") or "Forehand"
        result = shot.get("result") or "In"
        color = STROKE_COLORS.get(stroke, "#CCCCCC")
        alpha = RESULT_ALPHA.get(result, 0.85)

        line = Line(start, end, stroke_color=color, stroke_width=3.5, stroke_opacity=alpha)
        return line


def _shot_on_court(shot: dict) -> bool:
    try:
        bx, by = float(shot["bounce_x"]), float(shot["bounce_y"])
    except (KeyError, TypeError, ValueError):
        return False
    return in_court_meters(bx, by)
