# Research Dossier 26 — `ppd_vision` Maturity (Scoping)

**Scope:** Honest assessment of whether `PeakPerformanceData/ppd_vision` is a realistic near-term data source for a multi-agent system, or a distraction.

**Primary sources:**

| Path | Role |
|------|------|
| `PeakPerformanceData/ppd_vision/README.md` | Stated purpose / local run |
| `PeakPerformanceData/ppd_vision/pipeline/orchestrator.py` | End-to-end pipeline wiring |
| `PeakPerformanceData/ppd_vision/api/routes/analysis.py` | Upload / status / results API |
| `PeakPerformanceData/ppd_vision/api/main.py` | FastAPI app (`version="0.1.0"`) |
| `PeakPerformanceData/ppd_vision/config/settings.py` | Models, device, upload limits |
| `PeakPerformanceData/ppd_vision/db/migrations/001_initial_schema.sql` | Output schema |
| `PeakPerformanceData/ppd_vision/db/migrations/003_add_phase7_columns.sql` | Line-call / shot frame columns |
| `PeakPerformanceData/ppd_vision/requirements.txt` | Deps |
| `PeakPerformanceData/ppd_vision/docker/docker-compose.yml` | Deploy target |
| `PeakPerformanceData/ppd_vision/scripts/download_models.sh` | Weight acquisition |
| `PeakPerformanceData/peak_performance_data/src/lib/api/vision-client.ts` | Frontend client (unused) |
| `PeakPerformanceData/peak_performance_data/src/app/api/vision-proxy/[...path]/route.ts` | Proxy stub |
| `PeakPerformanceData/swingvision-pipeline/README.md` | Production CV path today |
| `PeakPerformanceDataMarketing/courtviz/README.md` | Viz library (not CV) |

**Date of analysis:** 2026-08-02  
**Constraint:** Read-only; no models run.

---

## 1. What it actually does today

**Intent:** Tennis match video → structured tracking events via a FastAPI microservice.

**Input:** Uploaded **video files** only (`.mp4`, `.mov`, `.mkv`, `.avi`) via `POST /vision/analyze`. No live streams, no camera SDK, no YouTube ingest.

**Pipeline order** (`pipeline/orchestrator.py`):

1. **Court detection** — ResNet50 keypoint model (`pipeline/court_detection/detector.py`, yastrebksv-style); first frame → 14 keypoints + homography (pixel → court meters).
2. **Ball tracking** — TrackNetV4 (TensorFlow/Keras, `pipeline/ball_tracking/tracknet.py`) on rolling 3-frame windows + Kalman + cubic-spline interpolation.
3. **Player tracking** — YOLOv8n + ByteTrack (`pipeline/player_tracking/detector.py`) + side-based role assignment (`identifier.py`).
4. **Bounce detection** — Physics heuristics (Y-velocity reversal ∩ height minimum) + optional ITF line call via homography (`pipeline/bounce_detection/detector.py`).
5. **Shot classification** — **Disabled in MVP.** Orchestrator hardcodes `shot_events: []` with comment *"graceful degradation — disabled in MVP"*. Pose (MediaPipe BlazePose) and CNN-LSTM shot classifier exist as modules but are **not called** from the orchestrator.

**Outputs returned / persisted:**

| Artifact | Content |
|----------|---------|
| `ball_positions` | Per-frame pixel `(x,y)`, optional `court_x/court_y`, confidence, interpolated flag |
| `bounce_events` | Frame, court coords, line_call / distance, timestamp |
| `player_positions` | Per-frame court coords for player 1/2 |
| `shot_events` | Always empty today |
| Job meta | `fps`, `total_frames`, status/progress |

**Not produced:** Rally/point segmentation, serve classification in production path, spin RPM, radar-grade ball speed, doubles ReID, mini-map video renders.

---

## 2. Output format & downstream consumers

**Persistence:** Own PostgreSQL schema (`analysis_jobs`, `ball_positions`, `bounce_events`, `player_positions`, `shot_events`) — not Supabase tennis tables.

**API surface:**

- `GET /vision/health`
- `POST /vision/analyze` → `{job_id, status}`
- `GET /vision/status/{job_id}`
- `GET /vision/results/{job_id}` → full result payload

**Monorepo consumption:**

| Consumer | Status |
|----------|--------|
| `peak_performance_data` UI | **None.** `vision-client.ts` and `vision-proxy` exist; **zero imports** of `submitVideoForAnalysis` / `getAnalysisResults` / `getVisionHealth` outside those files. |
| `swingvision-pipeline` | **None.** No references. |
| `ppd_backend` / AI agent / ClickHouse | **None.** |
| `courtviz` | Consumes **SwingVision / Supabase** match data, not `ppd_vision`. |

**Verdict on integration:** Scaffolded client + proxy only. Nothing productized consumes vision outputs.

---

## 3. How it is run / deployed

| Mode | Evidence |
|------|----------|
| Local CLI-ish | `uvicorn api.main:app --port 8000` (README) |
| Service | FastAPI + background tasks (in-process, not Celery/RQ) |
| Notebook | None |
| Docker | `docker/Dockerfile` on `nvidia/cuda:12.1.0-cudnn8-runtime`; compose reserves 1 NVIDIA GPU; Traefik host `vision.wearablesync.app` |
| CI | **None** (no `.github/workflows`) |
| Models on disk | `models/` contains only `.gitkeep` — **no weights** |

Git history (submodule): Phases 1–8 committed through **2026-03-13** (`Add Phase 8 Docker and Traefik deployment`). README still documents only the health endpoint and a hardcoded Hetzner DB IP (`5.75.241.108`). Deploy *config* exists; there is no evidence in-repo of a live, validated production workload feeding the product.

---

## 4. Dependencies & hardware

**Stack:** FastAPI, asyncpg/psycopg2, PyTorch + torchvision, TensorFlow, Ultralytics YOLOv8, MediaPipe, OpenCV, onnxruntime, filterpy, scipy/sklearn.

**Hardware:**

- Settings: `device` = `auto` → CUDA → MPS → CPU (`config/settings.py`).
- Production compose **requires NVIDIA GPU**.
- Dev story mentions M1 MPS; TrackNet path is TensorFlow (CUDA-oriented in prod).
- Upload cap: 2 GB. Orchestrator streams frames (claims ~4 GB peak RAM).

**Weights acquisition** (`scripts/download_models.sh`): only YOLOv8n automatable; court detector (Google Drive) and TrackNetV4 (upstream repo) are **manual**. Shot classifier weights are referenced in settings but **not** in the download script.

---

## 5. Maturity signals (code-adjacent)

| Signal | Finding |
|--------|---------|
| TODOs / stubs | Shot path explicitly disabled; pose/shot modules orphaned from orchestrator |
| Hardcoded infra | README + `.env.example` bake Hetzner IP `5.75.241.108` |
| Weights | Absent from tree |
| Tests | ~1.2k LOC unit tests for Kalman/interpolation/bounce math/API auth shape; **no** end-to-end video golden runs without weights |
| Version | `0.1.0` |
| Product UI | Phase 9 planned in memory-bank guide; not shipped |
| Guide honesty | Implementation guide §15: court detect **~30–40% fail** on amateur; TrackNet **~70–80%** detect on phone video — both need fine-tuning weeks |

This is a **complete scaffold of Phases 1–8**, not a battle-tested data product.

---

## 6. Overlap vs SwingVision vs courtviz

```
Video ──► swingvision-pipeline (enhance + iPhone farm)
              └──► SwingVision (commercial) ──► share URL / export
                        └──► PPD Supabase tennis_* ──► product + courtviz

Video ──► ppd_vision (aspirational in-house) ──► own Postgres
              └──► (no product consumer)
```

| | `ppd_vision` | SwingVision (+ `swingvision-pipeline`) | `courtviz` |
|--|--------------|----------------------------------------|------------|
| Role | In-house CV microservice | Commercial analysis + ops pipeline | React viz / storytelling |
| Maturity | Scaffold / MVP-disabled shots | **Production path today** | Production viz consuming SV data |
| Outputs | Ball/player tracks, bounces | Full match analytics, share URL into PPD | Hexbins, trajectories, replay UI |
| Agent-relevant? | Not yet | **Yes — existing structured match data** | Presentation only |

**Overlap:** Same aspiration as SwingVision (court coords, ball path, bounces, shots).  
**Difference:** SwingVision already feeds the monorepo; `ppd_vision` does not. `courtviz` is not a competitor — it is the rendering layer for data SwingVision already produces.

---

## 7. Blunt verdict

### **(c) Out of scope** for the multi-agent system being planned now.

**Not (a):** No weights in tree, shot/pose path unwired, no product or agent consumer, no CI, no proven amateur-video accuracy. It is not a usable data source today.

**Not worth treating as (b) for this planning cycle:** Finishing it to agent-grade reliability is easily a **3–6+ month** engineering program (weights + amateur fine-tunes + wire pose/shots + Phase 9 UI + validation + ops). That work **duplicates** SwingVision, which already supplies the structured tennis events agents would want.

**Recommendation:** Plan multi-agent tools against **SwingVision / Supabase tennis data** (and wearables). Revisit `ppd_vision` only if there is an explicit strategic goal to exit SwingVision — treat that as a separate CV product bet, not an agent dependency.
