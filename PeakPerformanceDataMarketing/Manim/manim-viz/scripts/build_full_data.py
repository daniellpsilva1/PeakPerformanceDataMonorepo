#!/usr/bin/env python3
import json
import re
import sys
from pathlib import Path

AGENT = Path("/Users/danielsilva/.cursor/projects/Users-danielsilva-Desktop-PeakPerformanceData-PeakPerformanceDataMarketing/agent-tools")
ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "data" / "match_data.json"


def parse_rows(path: Path) -> list:
    outer = json.loads(path.read_text())
    inner = outer["result"]
    m = re.search(r"<untrusted-data-[^>]+>\n(\[.*\])\n</untrusted-data", inner, re.DOTALL)
    if not m:
        raise ValueError(f"Bad MCP file: {path}")
    return json.loads(m.group(1))


def main() -> None:
    partial = parse_rows(AGENT / "ccc3e241-182b-4552-a8ab-9a7b4bf3cf4d.txt")[0]["partial"]
    shots = []
    for name in [
        "8252128d-b2cb-40f8-9a0c-7e1c9d6bd9cb.txt",
        "1e42ea3c-7ead-4331-b57c-504943a558ed.txt",
        "b73c94d1-a2c4-4048-8f78-e1fd78d0cda3.txt",
    ]:
        shots.extend(parse_rows(AGENT / name))

    bundle = {
        "match": partial["match"],
        "sets": partial["sets"],
        "points": partial["points"],
        "stats": partial["stats"],
        "shots": shots,
    }
    OUT.write_text(json.dumps(bundle, indent=2), encoding="utf-8")
    print(f"Wrote {len(shots)} shots, {len(partial['points'])} points → {OUT}")


if __name__ == "__main__":
    main()
