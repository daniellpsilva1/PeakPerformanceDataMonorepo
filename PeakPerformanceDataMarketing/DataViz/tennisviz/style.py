"""SprawlBall-inspired visual style for tennis data visualizations.

Palette, fonts, and figure templates that reproduce the editorial data-graphic
language of Kirk Goldsberry's *SprawlBall*.
"""

from __future__ import annotations

import matplotlib as mpl
import matplotlib.font_manager as fm
import matplotlib.pyplot as plt
import numpy as np

# ---------------------------------------------------------------------------
# Court dimensions (ITF, meters)
# ---------------------------------------------------------------------------
SINGLES_WIDTH = 8.23
DOUBLES_WIDTH = 10.97
COURT_LENGTH = 23.77
NET_Y = COURT_LENGTH / 2  # 11.885
SERVICE_LINE_NEAR = NET_Y - 5.485  # 6.40
SERVICE_LINE_FAR = NET_Y + 5.485  # 17.37
BASELINE_NEAR = 0.0
BASELINE_FAR = COURT_LENGTH
SINGLES_HALF = SINGLES_WIDTH / 2  # 4.115
DOUBLES_HALF = DOUBLES_WIDTH / 2  # 5.485
CENTER_MARK = 0.60  # small marks on baseline & center service line

# ---------------------------------------------------------------------------
# Palette (SprawlBall diverging: deep blue → light → orange → dark red)
# ---------------------------------------------------------------------------
BG_COLOR = "#F5F0E8"       # warm off-white page
COURT_CLAY = "#C97B4E"     # clay orange
COURT_CLAY_LIGHT = "#E0A87E"
COURT_HARD = "#2E5A88"     # hard court blue
COURT_GRASS = "#6B9E5A"    # grass green
COURT_LINE = "#FFFFFF"
COURT_LINE_DARK = "#2B2B2B"
INK = "#1A1A1A"            # near-black for text
ACCENT_ORANGE = "#E8742C"
ACCENT_BLUE = "#2B6CB0"

# Diverging palette for efficiency encoding (blue = below avg, red = above)
DIV_LOW = "#2B4D8C"        # deep blue (bad)
DIV_MID = "#F5F0E8"        # neutral (average)
DIV_MID_LIGHT = "#E8DCC8"  # warm neutral
DIV_HIGH = "#E8742C"       # orange (good)
DIV_PEAK = "#8B1A1A"       # dark red (elite)

# Dot-density rainbow (for speed coloring)
SPEED_CMAP = "turbo"

# Categorical colors for two players
PLAYER_HOST = "#E8742C"    # orange
PLAYER_GUEST = "#2B6CB0"   # blue

# ---------------------------------------------------------------------------
# Fonts — use Oswald (condensed) if available, else fallback
# ---------------------------------------------------------------------------
_CONDENSED_CANDIDATES = ["Oswald", "Bebas Neue", "Arial Narrow", "DejaVu Sans Condensed"]
_BODY_CANDIDATES = ["Inter", "Helvetica Neue", "Arial", "DejaVu Sans"]


def _find_font(candidates: list[str]) -> str:
    available = {f.name for f in fm.fontManager.ttflist}
    for c in candidates:
        if c in available:
            return c
    return candidates[-1]


CONDENSED_FONT = _find_font(_CONDENSED_CANDIDATES)
BODY_FONT = _find_font(_BODY_CANDIDATES)


def apply_style():
    """Apply the SprawlBall-inspired rcParams globally."""
    mpl.rcParams.update({
        "figure.facecolor": BG_COLOR,
        "axes.facecolor": BG_COLOR,
        "savefig.facecolor": BG_COLOR,
        "font.family": BODY_FONT,
        "font.size": 11,
        "text.color": INK,
        "axes.labelcolor": INK,
        "axes.edgecolor": INK,
        "xtick.color": INK,
        "ytick.color": INK,
        "axes.spines.top": False,
        "axes.spines.right": False,
        "axes.spines.left": False,
        "axes.spines.bottom": False,
        "axes.grid": False,
        "figure.dpi": 150,
        "savefig.dpi": 300,
    })


# ---------------------------------------------------------------------------
# Colormap helpers
# ---------------------------------------------------------------------------
def efficiency_cmap(vmin: float = -0.15, vmax: float = 0.15):
    """Diverging colormap: blue (below avg) → neutral → orange → red (above avg).

    Returns a LinearSegmentedColormap normalized to [vmin, vmax].
    """
    from matplotlib.colors import LinearSegmentedColormap, Normalize

    colors = [DIV_LOW, "#6B8FCB", DIV_MID_LIGHT, DIV_HIGH, DIV_PEAK]
    cmap = LinearSegmentedColormap.from_list("efficiency", colors, N=256)
    norm = Normalize(vmin=vmin, vmax=vmax)
    return cmap, norm


def get_player_color(player: str) -> str:
    return PLAYER_HOST if player == "host" else PLAYER_GUEST


def get_surface_color(surface: str | None) -> str:
    if surface == "clay":
        return COURT_CLAY
    if surface == "grass":
        return COURT_GRASS
    return COURT_HARD


# ---------------------------------------------------------------------------
# Figure helpers
# ---------------------------------------------------------------------------
def make_figure(width: float = 12, height: float = 8, aspect: str = "auto") -> plt.Figure:
    """Create a styled figure with the SprawlBall background."""
    apply_style()
    fig, ax = plt.subplots(figsize=(width, height))
    fig.patch.set_facecolor(BG_COLOR)
    ax.set_facecolor(BG_COLOR)
    return fig, ax


def add_header(fig, title: str, subtitle: str = "", x: float = 0.06, y: float = 0.96):
    """Add a condensed-slab header in the SprawlBall editorial style."""
    fig.text(x, y, title.upper(),
             fontsize=22, fontweight="bold", fontfamily=CONDENSED_FONT,
             color=INK, va="top", ha="left")
    if subtitle:
        fig.text(x, y - 0.04, subtitle,
                 fontsize=11, fontfamily=BODY_FONT,
                 color="#555555", va="top", ha="left")


def add_source_note(fig, text: str, x: float = 0.06, y: float = 0.02):
    fig.text(x, y, text, fontsize=8, fontfamily=BODY_FONT,
             color="#888888", va="bottom", ha="left", style="italic")
