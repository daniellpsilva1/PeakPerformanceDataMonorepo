"""Data loading and caching for tennis match visualizations.

Loads shot/match/stats data from local JSON cache (exported from Supabase).
Provides pandas DataFrames ready for visualization.
"""

from __future__ import annotations

import json
import os
from dataclasses import dataclass, field

import numpy as np
import pandas as pd

DATA_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "data")


@dataclass
class MatchData:
    """Container for a single match's data."""
    match: dict
    sets: list[dict]
    shots: pd.DataFrame
    stats: pd.DataFrame

    @property
    def host_name(self) -> str:
        names = self.match.get("host_player_names") or []
        return names[0] if names else "Host"

    @property
    def guest_name(self) -> str:
        names = self.match.get("guest_player_names") or []
        return names[0] if names else "Guest"

    @property
    def surface(self) -> str:
        return self.match.get("surface") or "hard"

    @property
    def match_date(self) -> str:
        return self.match.get("match_date", "")

    @property
    def score_string(self) -> str:
        parts = []
        for s in self.sets:
            parts.append(f"{s['host_score']}-{s['guest_score']}")
        return ", ".join(parts)


def load_match(match_id: str = "f6cd7d61-fc69-4dfc-8336-2c90a4ced93a",
               data_dir: str | None = None) -> MatchData:
    """Load a match from local JSON cache.

    Expects files named: match_{slug}_meta.json, sets_{slug}.json,
    shots_{slug}.json, stats_{slug}.json in data_dir.
    """
    d = data_dir or DATA_DIR

    # Try known slug patterns
    slug = _id_to_slug(match_id, d)

    with open(os.path.join(d, f"match_{slug}_meta.json"), encoding="utf-8") as f:
        match = json.load(f)
    with open(os.path.join(d, f"sets_{slug}.json"), encoding="utf-8") as f:
        sets = json.load(f)
    with open(os.path.join(d, f"shots_{slug}.json"), encoding="utf-8") as f:
        shots_raw = json.load(f)
    with open(os.path.join(d, f"stats_{slug}.json"), encoding="utf-8") as f:
        stats_raw = json.load(f)

    shots = pd.DataFrame(shots_raw)
    stats = pd.DataFrame(stats_raw)

    # Type conversion
    numeric_cols = ["bounce_x", "bounce_y", "hit_x", "hit_y", "hit_z", "speed_kmh"]
    for col in numeric_cols:
        if col in shots.columns:
            shots[col] = pd.to_numeric(shots[col], errors="coerce")

    return MatchData(match=match, sets=sets, shots=shots, stats=stats)


def _id_to_slug(match_id: str, data_dir: str) -> str:
    """Map a match UUID to a file slug by checking for known patterns."""
    # Known mappings
    known = {
        "f6cd7d61-fc69-4dfc-8336-2c90a4ced93a": "boluda",
    }
    if match_id in known:
        return known[match_id]
    # Try using the ID directly
    if os.path.exists(os.path.join(data_dir, f"shots_{match_id}.json")):
        return match_id
    raise FileNotFoundError(f"No cached data for match {match_id} in {data_dir}")


def filter_shots(shots: pd.DataFrame, player: str | None = None,
                 stroke: str | None = None, shot_type: str | None = None,
                 result: str | None = None, set_number: int | None = None,
                 terminal_only: bool = False) -> pd.DataFrame:
    """Filter shots DataFrame by common criteria."""
    df = shots.copy()
    if player:
        df = df[df["player"] == player]
    if stroke:
        df = df[df["stroke"] == stroke]
    if shot_type:
        df = df[df["type"] == shot_type]
    if result:
        df = df[df["result"] == result]
    if set_number is not None:
        df = df[df["set_number"] == set_number]
    if terminal_only:
        df = df[df.get("is_terminal", False) == True]
    return df


def get_serves(shots: pd.DataFrame, player: str, serve_type: str | None = None) -> pd.DataFrame:
    """Get serve shots for a player. serve_type: 'first_serve', 'second_serve', or None for all."""
    df = shots[(shots["player"] == player) & (shots["stroke"] == "Serve")]
    if serve_type:
        df = df[df["type"] == serve_type]
    return df


def get_player_shots(shots: pd.DataFrame, player: str, in_play_only: bool = True) -> pd.DataFrame:
    """Get all non-serve shots for a player."""
    df = shots[(shots["player"] == player) & (shots["stroke"] != "Serve")]
    if in_play_only:
        df = df[df["result"] == "In"]
    return df


def compute_zone_win_rates(shots: pd.DataFrame, player: str,
                           zone_col: str = "bounce_zone") -> pd.DataFrame:
    """Compute win rate per bounce zone for a player's shots.

    A shot is 'won' if it's terminal and the point was won by the shot's player.
    Since we don't have point-level winner in shots, we approximate using
    result='In' + is_terminal=True as winners, result in ('Out','Net') as errors.
    """
    df = shots[shots["player"] == player].copy()
    df["won"] = (df["result"] == "In") & (df.get("is_terminal", False) == True)
    df["error"] = df["result"].isin(["Out", "Net"])

    grouped = df.groupby(zone_col).agg(
        total=("result", "count"),
        won=("won", "sum"),
        errors=("error", "sum"),
    ).reset_index()
    grouped["win_rate"] = grouped["won"] / grouped["total"].clip(lower=1)
    return grouped


def get_stat(stats: pd.DataFrame, player: str, stat_name: str,
             set_number: int = 0) -> float | None:
    """Get a specific stat value for a player."""
    row = stats[(stats["player"] == player) &
                (stats["set_number"] == set_number) &
                (stats["stat_name"] == stat_name)]
    if row.empty:
        return None
    return float(row.iloc[0]["stat_value"])
