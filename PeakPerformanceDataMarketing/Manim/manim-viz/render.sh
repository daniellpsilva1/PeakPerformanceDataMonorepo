#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"
QUALITY="${1:-qh}"
.venv/bin/python3.12 -m manim -"${QUALITY}" scenes/shot_map.py ShotMapScene -o
