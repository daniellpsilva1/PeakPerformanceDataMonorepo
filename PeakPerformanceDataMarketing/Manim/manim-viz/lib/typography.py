"""Consistent sans-serif text helpers."""

from __future__ import annotations

from manim import BOLD, Text

FONT = "Arial"


def label(text: str, size: int = 24, color=None, weight=None) -> Text:
    kw = {"font": FONT, "font_size": size}
    if color is not None:
        kw["color"] = color
    if weight is not None:
        kw["weight"] = weight
    return Text(text, **kw)


def title(text: str, size: int = 36, color=None) -> Text:
    return label(text, size, color=color, weight=BOLD)
