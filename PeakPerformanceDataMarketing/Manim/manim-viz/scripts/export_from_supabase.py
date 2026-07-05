#!/usr/bin/env python3
"""Export complete match bundle from Supabase into data/match_data.json."""

from __future__ import annotations

import json
import os
import sys
from pathlib import Path

from dotenv import load_dotenv
from supabase import create_client

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "data" / "match_data.json"

SHOT_FIELDS = (
    "hit_x, hit_y, bounce_x, bounce_y, speed_kmh, stroke, player, result, "
    "point_number, shot_number, set_number, spin, placement_zone, bounce_zone"
)


def fetch_bundle(client, match_id: str) -> dict:
    match = client.table("tennis_matches").select("*").eq("id", match_id).single().execute().data
    shots = (
        client.table("tennis_match_shots")
        .select(SHOT_FIELDS)
        .eq("match_id", match_id)
        .not_.is_("hit_x", "null")
        .not_.is_("bounce_x", "null")
        .order("set_number")
        .order("point_number")
        .order("shot_number")
        .execute()
        .data
    )
    sets = (
        client.table("tennis_match_sets")
        .select("*")
        .eq("match_id", match_id)
        .order("set_number")
        .execute()
        .data
    )
    points = (
        client.table("tennis_match_points")
        .select(
            "set_number, point_number, point_winner, rally_length, break_point, "
            "host_game_score, guest_game_score, serve_state, match_point, set_point"
        )
        .eq("match_id", match_id)
        .order("set_number")
        .order("point_number")
        .execute()
        .data
    )
    stats = (
        client.table("tennis_match_stats")
        .select("stat_name, player, set_number, stat_value")
        .eq("match_id", match_id)
        .execute()
        .data
    )
    return {"match": match, "shots": shots, "sets": sets, "points": points, "stats": stats}


def main() -> None:
    load_dotenv(ROOT / ".env")
    match_id = os.environ.get("MATCH_ID", "f6cd7d61-fc69-4dfc-8336-2c90a4ced93a")
    url, key = os.environ.get("SUPABASE_URL"), os.environ.get("SUPABASE_KEY")
    if not url or not key:
        print("Missing SUPABASE_URL / SUPABASE_KEY in .env", file=sys.stderr)
        sys.exit(1)

    payload = fetch_bundle(create_client(url, key), match_id)
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(payload, indent=2, default=str), encoding="utf-8")
    print(
        f"Exported {len(payload['shots'])} shots, {len(payload['points'])} points, "
        f"{len(payload['sets'])} sets → {OUT}"
    )


if __name__ == "__main__":
    main()
