# PeakPerformanceData

Monorepo containing all PeakPerformanceData projects, organized as Git submodules.

## Structure

```
PeakPerformanceData/
├── PeakPerformanceData/                  # Core projects
│   ├── peak_performance_data             # Main frontend app
│   ├── ppd_backend                       # Backend API
│   ├── ppd_extraction_backend            # Data extraction backend
│   ├── ppd_legacy_extraction_backend     # Legacy extraction backend (Garmin)
│   └── ppd_vision                        # Vision / video analysis
│
├── PeakPerformanceDataMarketing/         # Marketing & content projects
│   ├── AcademiesPresentation             # Academies sales deck
│   ├── AI Videos                         # AI-generated video assets
│   ├── Manim                             # Manim data visualizations
│   └── Remotion                          # Remotion video compositions
│
├── .gitmodules                           # Submodule configuration
└── README.md
```

## Submodules

| Submodule | GitHub Remote |
|---|---|
| `PeakPerformanceData/peak_performance_data` | https://github.com/daniellpsilva1/PeakPerformanceDataV2.git |
| `PeakPerformanceData/ppd_backend` | https://github.com/daniellpsilva1/PPD_Backend.git |
| `PeakPerformanceData/ppd_extraction_backend` | https://github.com/daniellpsilva1/PPD_Extraction_Backend.git |
| `PeakPerformanceData/ppd_legacy_extraction_backend` | https://github.com/daniellpsilva1/ppd_legacy_extraction_backend.git |
| `PeakPerformanceData/ppd_vision` | https://github.com/daniellpsilva1/ppd_vision.git |
| `PeakPerformanceDataMarketing/AcademiesPresentation` | https://github.com/daniellpsilva1/ppd-academies-presentation.git |
| `PeakPerformanceDataMarketing/AI Videos` | https://github.com/daniellpsilva1/ppd-ai-videos.git |
| `PeakPerformanceDataMarketing/Manim` | https://github.com/daniellpsilva1/ppd-manim.git |
| `PeakPerformanceDataMarketing/Remotion` | https://github.com/daniellpsilva1/ppd-remotion.git |

## How to clone

### Clone everything at once (recommended)

```bash
git clone --recursive https://github.com/daniellpsilva1/PeakPerformanceDataMonorepo.git
```

The `--recursive` flag automatically checks out all submodules.

### Clone first, then fetch submodules

```bash
git clone https://github.com/daniellpsilva1/PeakPerformanceDataMonorepo.git
cd PeakPerformanceData
git submodule update --init --recursive
```

### Clone with a specific branch for all submodules

```bash
git clone --recursive https://github.com/daniellpsilva1/PeakPerformanceDataMonorepo.git
cd PeakPerformanceData
git submodule foreach 'git checkout main'
```

## Working with submodules

### Pull latest changes in all submodules

```bash
git submodule update --remote --merge
```

### Make changes inside a submodule

```bash
cd PeakPerformanceData/peak_performance_data
# make your changes...
git add -A
git commit -m "Add new feature"
git push origin main

# back in the parent repo, record the new submodule commit
cd ../..
git add PeakPerformanceData/peak_performance_data
git commit -m "Update peak_performance_data submodule"
git push
```

### Add a new submodule

```bash
git submodule add https://github.com/daniellpsilva1/<repo>.git <path>
git commit -m "Add <name> submodule"
```

## Prerequisites

- [Git](https://git-scm.com/) 2.25+
- Access to all submodule GitHub repositories
- Project-specific dependencies (Node.js, Python, etc.) — see each submodule's own README
