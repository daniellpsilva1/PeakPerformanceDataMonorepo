"""Load match bundle from disk."""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any


def default_data_path() -> Path:
    return Path(__file__).resolve().parent.parent / "data" / "match_data.json"


def load_match_data(path: Path | None = None) -> dict[str, Any]:
    data_path = path or default_data_path()
    with data_path.open(encoding="utf-8") as handle:
        return json.load(handle)
