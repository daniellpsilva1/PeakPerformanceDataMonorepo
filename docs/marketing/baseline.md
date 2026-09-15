---
id: PPD-PORTFOLIO-MARKETING-BASELINE
last_reviewed: 2026-09-13
owner: daniel
related:
  - PPD-PORTFOLIO-ARCH-REPOSITORY-GRAPH
schema_version: 1
source_refs:
  - path: README.md
    repo_id: academies
    revision: 5a1731a6f4f8fa0dc7dc0d739763262c1afb06e5
  - path: README.md
    repo_id: manim
    revision: 74af23758dab981bcbb4cc09208851708589c8fe
  - path: README.md
    repo_id: remotion
    revision: 8ebd56149adbb6d17d52b4184a10628667cfb719
status: draft
title: Marketing media baselines
type: explanation
visibility: internal
---

# Marketing media baselines

This document inventories the marketing media repositories. These are content-generation tools, not production services.

## Repository inventory

| Repository | Purpose | Output |
|---|---|---|
| `AcademiesPresentation` | Sales deck for tennis academies | PowerPoint (.pptx) + HTML (Reveal.js) |
| `AI Videos` | (Empty repository) | No content |
| `Manim` | Data-driven tennis match visualizations | MP4 videos via Manim CE |
| `Remotion` | 30-second marketing video | MP4 via Remotion |

## Academies presentation

- Languages: English and Spanish
- Source: Single shared JSON content source
- Outputs: `.pptx` files and `html/index.html` (Reveal.js)
- HTML deck works offline via embedded `deck-content.js` bundle
- App redirects `/presentation/*` to the Academies Vercel deployment

## AI Videos

This repository is effectively empty (only `.git` and `.gitignore`). Lifecycle status is unconfirmed — see gap DG-24. It may be a placeholder or abandoned.

## Manim

- Current video: Quevedo vs Boluda (2025-04-09, Clay)
- Scenes: Intro, Match Flow, Shot Map, Serve Analysis, Stats Duel
- Data source: SwingVision data exported from Supabase
- Built with Manim Community Edition

## Remotion

- Composition: `PPDMarketing`
- Duration: 45 seconds (1350 frames)
- Resolution: 1920×1080 @ 30fps
- Scenes: Hook, Problem, Wearables, Tennis, Coach Intelligence, Roles
- Note: Courtviz has a frozen Remotion path (`apps/video/FROZEN.md`); new data-driven scenes should use `@courtviz/motion` instead

## What this document does not claim

- Whether `AI Videos` should be removed or repurposed (DG-24).
- Whether the Academies presentation content is current (needs content review).
- Whether Manim videos are used in production marketing (unconfirmed).
- Whether Remotion marketing video is deployed or used (unconfirmed).
- Rights/provenance for any third-party assets in these repositories (DG-22).
