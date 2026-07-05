"""Compute match analytics from raw Supabase bundle."""

from __future__ import annotations

from collections import Counter, defaultdict
from typing import Any

from lib.court import in_court_meters


def player_label(match: dict[str, Any], side: str) -> str:
    names = match.get(f"{side}_player_names") or []
    if names:
        return str(names[0])
    if side == "guest" and match.get("opponent_name"):
        return str(match["opponent_name"])
    return side.capitalize()


def stat_total(stats: list[dict], name: str, player: str, set_number: int = 0) -> float:
    total = 0.0
    for row in stats:
        if row.get("stat_name") != name or row.get("player") != player:
            continue
        if int(row.get("set_number") or 0) != set_number:
            continue
        try:
            total += float(row.get("stat_value") or 0)
        except (TypeError, ValueError):
            pass
    return total


def build_summary(data: dict[str, Any]) -> dict[str, Any]:
    match = data["match"]
    shots = data.get("shots") or []
    stats = data.get("stats") or []
    points = data.get("points") or []
    sets = data.get("sets") or []

    host = player_label(match, "host")
    guest = player_label(match, "guest")

    stroke_counts: dict[str, Counter] = {"host": Counter(), "guest": Counter()}
    bounce_cells: Counter = Counter()
    speeds: list[float] = []

    for shot in shots:
        player = shot.get("player") or "host"
        stroke = shot.get("stroke") or "Other"
        if player in stroke_counts:
            stroke_counts[player][stroke] += 1
        try:
            bx, by = float(shot["bounce_x"]), float(shot["bounce_y"])
            cell = (round(bx, 1), round(by, 1))
            bounce_cells[cell] += 1
        except (KeyError, TypeError, ValueError):
            pass
        if shot.get("speed_kmh"):
            try:
                speeds.append(float(shot["speed_kmh"]))
            except (TypeError, ValueError):
                pass

    host_won = sum(1 for p in points if p.get("point_winner") == "host")
    guest_won = sum(1 for p in points if p.get("point_winner") == "guest")

    host_1st_in = stat_total(stats, "1st Serves In", "host")
    host_1st = stat_total(stats, "1st Serves", "host")
    guest_1st_in = stat_total(stats, "1st Serves In", "guest")
    guest_1st = stat_total(stats, "1st Serves", "guest")

    set_scores = []
    for s in sorted(sets, key=lambda x: x.get("set_number", 0)):
        hs, gs = s.get("host_score"), s.get("guest_score")
        ht, gt = s.get("host_tiebreak"), s.get("guest_tiebreak")
        if ht or gt:
            set_scores.append(f"{hs}-{gs} ({ht or 0}-{gt or 0})")
        else:
            set_scores.append(f"{hs}-{gs}")

    return {
        "host": host,
        "guest": guest,
        "surface": (match.get("surface") or "hard").lower(),
        "date": match.get("match_date", ""),
        "total_shots": len(shots),
        "total_points": len(points),
        "host_points_won": host_won,
        "guest_points_won": guest_won,
        "host_1st_serve_pct": round(100 * host_1st_in / host_1st, 1) if host_1st else 0,
        "guest_1st_serve_pct": round(100 * guest_1st_in / guest_1st, 1) if guest_1st else 0,
        "host_winners": stat_total(stats, "Forehand Winners", "host") + stat_total(stats, "Backhand Winners", "host"),
        "guest_winners": stat_total(stats, "Forehand Winners", "guest") + stat_total(stats, "Backhand Winners", "guest"),
        "host_aces": stat_total(stats, "Aces", "host"),
        "guest_aces": stat_total(stats, "Aces", "guest"),
        "host_errors": stat_total(stats, "Forehand Unforced Errors", "host") + stat_total(stats, "Backhand Unforced Errors", "host"),
        "guest_errors": stat_total(stats, "Forehand Unforced Errors", "guest") + stat_total(stats, "Backhand Unforced Errors", "guest"),
        "avg_serve_speed": round(sum(s for s in speeds if s > 80) / max(1, len([s for s in speeds if s > 80])), 0),
        "max_speed": round(max(speeds) if speeds else 0, 0),
        "stroke_counts": {k: dict(v) for k, v in stroke_counts.items()},
        "set_scores": set_scores,
        "match_winner": host if host_won > guest_won else guest,
    }


def group_shots_by_point(shots: list[dict]) -> list[tuple[tuple[int, int], list[dict]]]:
    buckets: dict[tuple[int, int], list[dict]] = defaultdict(list)
    for shot in shots:
        key = (int(shot.get("set_number") or 1), int(shot.get("point_number") or 0))
        buckets[key].append(shot)
    return sorted(buckets.items(), key=lambda item: item[0])



def filter_in_bounds(shot: dict, margin: float = 0.15) -> bool:
    try:
        bx, by = float(shot["bounce_x"]), float(shot["bounce_y"])
    except (KeyError, TypeError, ValueError):
        return False
    return in_court_meters(bx, by, margin=margin)
