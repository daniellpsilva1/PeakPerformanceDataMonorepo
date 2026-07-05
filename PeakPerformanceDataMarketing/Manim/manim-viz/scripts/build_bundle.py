#!/usr/bin/env python3
"""Build match_data.json from Supabase SQL batches (no API key required when using MCP export files)."""

from __future__ import annotations

import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "data" / "match_data.json"
PARTIAL = ROOT / "data" / "_partial_meta.json"


def parse_mcp_rows(path: Path) -> list:
    outer = json.loads(path.read_text())
    inner = outer["result"]
    m = re.search(r"<untrusted-data-[^>]+>\n(\[.*\])\n</untrusted-data", inner, re.DOTALL)
    if not m:
        raise ValueError(f"Cannot parse MCP output: {path}")
    return json.loads(m.group(1))


def main() -> None:
    if not PARTIAL.exists():
        raise SystemExit(f"Missing {PARTIAL} — run MCP metadata export first")

    meta = json.loads(PARTIAL.read_text())
    if "partial" in meta:
        meta = meta["partial"]
    elif isinstance(meta, list) and meta and "partial" in meta[0]:
        meta = meta[0]["partial"]

    shots: list = []
    shots_dir = ROOT / "data" / "shots_batches"
    if shots_dir.exists():
        for batch_file in sorted(shots_dir.glob("batch_*.json")):
            shots.extend(json.loads(batch_file.read_text()))

    if not shots:
        legacy = ROOT / "data" / "match_data.json"
        if legacy.exists():
            shots = json.loads(legacy.read_text()).get("shots", [])
        if not shots:
            raise SystemExit("No shots found. Add data/shots_batches/ or existing match_data.json")

    bundle = {
        "match": meta["match"],
        "sets": meta.get("sets") or [],
        "points": meta.get("points") or [],
        "stats": meta.get("stats") or [],
        "shots": shots,
    }
    OUT.write_text(json.dumps(bundle, indent=2), encoding="utf-8")
    print(f"Built {OUT} with {len(shots)} shots")


if __name__ == "__main__":
    main()
