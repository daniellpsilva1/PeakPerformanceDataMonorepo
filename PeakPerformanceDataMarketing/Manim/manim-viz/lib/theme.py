"""Visual theme for PeakPerformanceData tennis visualizations."""

from manim import ManimColor

# Palette
BG = ManimColor("#0B1020")
BG_PANEL = ManimColor("#141C2F")
CLAY_BASE = ManimColor("#B85C38")
CLAY_DARK = ManimColor("#8E4528")
CLAY_LIGHT = ManimColor("#D4784E")
LINE_COURT = ManimColor("#F2E6D8")
NET_COLOR = ManimColor("#E8EDF5")
TEXT_PRIMARY = ManimColor("#F4F7FB")
TEXT_MUTED = ManimColor("#9AA8C7")
ACCENT = ManimColor("#F7B731")
HOST_COLOR = ManimColor("#4ECDC4")
GUEST_COLOR = ManimColor("#FF6B6B")

STROKE_COLORS = {
    "Serve": ManimColor("#FF4757"),
    "Forehand": ManimColor("#3742FA"),
    "Backhand": ManimColor("#FFA502"),
    "Volley": ManimColor("#2ED573"),
    "Overhead": ManimColor("#A55EEA"),
    "Smash": ManimColor("#A55EEA"),
}

PLAYER_COLORS = {"host": HOST_COLOR, "guest": GUEST_COLOR}

RESULT_ALPHA = {
    "In": 0.9,
    "Winner": 1.0,
    "Out": 0.35,
    "Net": 0.4,
}

HEAT_LOW = ManimColor("#1A4D2E")
HEAT_HIGH = ManimColor("#FF4757")

SURFACE_COLORS = {
    "clay": CLAY_BASE,
    "hard": ManimColor("#3D5A80"),
    "grass": ManimColor("#2D6A4F"),
    "carpet": ManimColor("#6C5B7B"),
}
