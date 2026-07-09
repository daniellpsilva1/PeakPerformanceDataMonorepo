/**
 * Static SVG export — renders courtviz visualizations to standalone .svg files.
 *
 * Usage:
 *   node scripts/export-static.cjs                  # exports all posters
 *   node scripts/export-static.cjs --only=hexbin    # exports specific poster
 *
 * Outputs to: apps/demo/public/exports/
 *
 * Requirements: pnpm --filter @courtviz/react build && pnpm --filter @courtviz/data build
 */

const fs = require("fs");
const path = require("path");

// Resolve modules from the demo workspace (where react, @courtviz/* are installed)
const demoNodeModules = path.resolve(__dirname, "..", "apps", "demo", "node_modules");
const rootNodeModules = path.resolve(__dirname, "..", "node_modules");
const oldPaths = module.paths || [];
module.paths = [demoNodeModules, rootNodeModules, ...oldPaths];

const React = require("react");
const { renderToStaticMarkup } = require("react-dom/server");

const { Court, HexbinLayer, DotLayer, ServeLayer, RayLayer, MomentumChart, ColorBar } = require("@courtviz/react");
const { createCourtScales } = require("@courtviz/core");
const { sprawlball, ppdDark } = require("@courtviz/themes");
const { enrichedShots, momentumPoints, hostName, guestName, surface } = require("@courtviz/data");

const outDir = path.resolve(__dirname, "..", "apps", "demo", "public", "exports");
fs.mkdirSync(outDir, { recursive: true });

function saveSvg(markup, filename) {
  const filepath = path.join(outDir, filename);
  fs.writeFileSync(filepath, markup, "utf-8");
  console.log(`  ✓ ${filename} (${(markup.length / 1024).toFixed(1)} KB)`);
}

function renderElement(element, width, height) {
  const markup = `<?xml version="1.0" encoding="UTF-8"?>\n${renderToStaticMarkup(element)}`;
  return markup;
}

// ---------------------------------------------------------------------------
// Poster 1: Host Hexbin — shot frequency + efficiency
// ---------------------------------------------------------------------------

function exportHostHexbin() {
  const theme = sprawlball;
  const scales = createCourtScales({ half: "near", height: 600, margin: 1.5, width: 600 });
  const hostShots = enrichedShots.filter((s) => s.player === "host" && s.stroke !== "Serve");

  const element = React.createElement(
    "svg",
    { height: 700, width: 600, xmlns: "http://www.w3.org/2000/svg" },
    React.createElement(Court, { half: "near", height: 600, surface: "clay", theme, width: 600 },
      React.createElement(HexbinLayer, {
        colorScale: "efficiency",
        gridSize: 35,
        player: "host",
        scales,
        shots: hostShots,
        theme,
      })
    ),
    React.createElement("g", { transform: "translate(200, 640)" },
      React.createElement(ColorBar, { min: "Cold", max: "Hot", theme, width: 200 })
    ),
    React.createElement("text", {
      fill: theme.ink, fontFamily: theme.fonts.condensedFont, fontSize: 18, fontWeight: "bold",
      textAnchor: "middle", x: 300, y: 690,
    }, `${hostName} — Shot Frequency & Efficiency`)
  );

  saveSvg(renderElement(element, 600, 700), "hexbin-host.svg");
}

// ---------------------------------------------------------------------------
// Poster 2: Guest Hexbin
// ---------------------------------------------------------------------------

function exportGuestHexbin() {
  const theme = sprawlball;
  const scales = createCourtScales({ half: "near", height: 600, margin: 1.5, width: 600 });
  const guestShots = enrichedShots.filter((s) => s.player === "guest" && s.stroke !== "Serve");

  const element = React.createElement(
    "svg",
    { height: 700, width: 600, xmlns: "http://www.w3.org/2000/svg" },
    React.createElement(Court, { half: "near", height: 600, surface: "clay", theme, width: 600 },
      React.createElement(HexbinLayer, {
        colorScale: "efficiency",
        gridSize: 35,
        player: "guest",
        scales,
        shots: guestShots,
        theme,
      })
    ),
    React.createElement("g", { transform: "translate(200, 640)" },
      React.createElement(ColorBar, { min: "Cold", max: "Hot", theme, width: 200 })
    ),
    React.createElement("text", {
      fill: theme.ink, fontFamily: theme.fonts.condensedFont, fontSize: 18, fontWeight: "bold",
      textAnchor: "middle", x: 300, y: 690,
    }, `${guestName} — Shot Frequency & Efficiency`)
  );

  saveSvg(renderElement(element, 600, 700), "hexbin-guest.svg");
}

// ---------------------------------------------------------------------------
// Poster 3: Dot Density — all shots colored by stroke
// ---------------------------------------------------------------------------

function exportDotDensity() {
  const theme = sprawlball;
  const scales = createCourtScales({ half: "full", height: 800, margin: 1.5, width: 600 });

  const element = React.createElement(
    "svg",
    { height: 860, width: 600, xmlns: "http://www.w3.org/2000/svg" },
    React.createElement(Court, { half: "full", height: 800, surface: "clay", theme, width: 600 },
      React.createElement(DotLayer, {
        alpha: 0.5,
        colorBy: "stroke",
        scales,
        shots: enrichedShots,
        size: 4,
        theme,
      })
    ),
    React.createElement("text", {
      fill: theme.ink, fontFamily: theme.fonts.condensedFont, fontSize: 18, fontWeight: "bold",
      textAnchor: "middle", x: 300, y: 850,
    }, "Shot Bounce Locations — All Strokes")
  );

  saveSvg(renderElement(element, 600, 860), "dotdensity.svg");
}

// ---------------------------------------------------------------------------
// Poster 4: Serve Placement
// ---------------------------------------------------------------------------

function exportServe() {
  const theme = sprawlball;
  const scales = createCourtScales({ half: "near", height: 600, margin: 1.5, width: 600 });

  const element = React.createElement(
    "svg",
    { height: 660, width: 600, xmlns: "http://www.w3.org/2000/svg" },
    React.createElement(Court, { half: "near", height: 600, surface: "clay", theme, width: 600 },
      React.createElement(ServeLayer, {
        player: "host",
        scales,
        serveType: "both",
        shots: enrichedShots,
        theme,
      })
    ),
    React.createElement("text", {
      fill: theme.ink, fontFamily: theme.fonts.condensedFont, fontSize: 18, fontWeight: "bold",
      textAnchor: "middle", x: 300, y: 650,
    }, `${hostName} — Serve Placement`)
  );

  saveSvg(renderElement(element, 600, 660), "serve-host.svg");
}

// ---------------------------------------------------------------------------
// Poster 5: Shot Trajectories (Rays)
// ---------------------------------------------------------------------------

function exportRays() {
  const theme = sprawlball;
  const scales = createCourtScales({ half: "full", height: 800, margin: 1.5, width: 600 });
  const hostShots = enrichedShots.filter((s) => s.player === "host" && s.stroke !== "Serve");

  const element = React.createElement(
    "svg",
    { height: 860, width: 600, xmlns: "http://www.w3.org/2000/svg" },
    React.createElement(Court, { half: "full", height: 800, surface: "clay", theme, width: 600 },
      React.createElement(RayLayer, {
        alpha: 0.25,
        player: "host",
        scales,
        shots: hostShots,
        theme,
      })
    ),
    React.createElement("text", {
      fill: theme.ink, fontFamily: theme.fonts.condensedFont, fontSize: 18, fontWeight: "bold",
      textAnchor: "middle", x: 300, y: 850,
    }, `${hostName} — Shot Trajectories`)
  );

  saveSvg(renderElement(element, 600, 860), "rays-host.svg");
}

// ---------------------------------------------------------------------------
// Poster 6: Momentum Chart
// ---------------------------------------------------------------------------

function exportMomentum() {
  const theme = sprawlball;

  const element = React.createElement(
    "svg",
    { height: 350, width: 900, xmlns: "http://www.w3.org/2000/svg" },
    React.createElement("rect", { fill: theme.background, height: 350, width: 900, x: 0, y: 0 }),
    React.createElement(MomentumChart, {
      height: 280,
      hostPlayer: "host",
      points: momentumPoints,
      theme,
      width: 900,
    }),
    React.createElement("text", {
      fill: theme.ink, fontFamily: theme.fonts.condensedFont, fontSize: 18, fontWeight: "bold",
      textAnchor: "middle", x: 450, y: 330,
    }, `Momentum — ${hostName} vs ${guestName}`)
  );

  saveSvg(renderElement(element, 900, 350), "momentum.svg");
}

// ---------------------------------------------------------------------------
// Poster 7: PPD Dark theme hexbin
// ---------------------------------------------------------------------------

function exportDarkHexbin() {
  const theme = ppdDark;
  const scales = createCourtScales({ half: "near", height: 600, margin: 1.5, width: 600 });
  const hostShots = enrichedShots.filter((s) => s.player === "host" && s.stroke !== "Serve");

  const element = React.createElement(
    "svg",
    { height: 700, width: 600, xmlns: "http://www.w3.org/2000/svg" },
    React.createElement("rect", { fill: theme.background, height: 700, width: 600, x: 0, y: 0 }),
    React.createElement(Court, { half: "near", height: 600, surface: "clay", theme, width: 600 },
      React.createElement(HexbinLayer, {
        colorScale: "efficiency",
        gridSize: 35,
        player: "host",
        scales,
        shots: hostShots,
        theme,
      })
    ),
    React.createElement("g", { transform: "translate(200, 640)" },
      React.createElement(ColorBar, { min: "Cold", max: "Hot", theme, width: 200 })
    ),
    React.createElement("text", {
      fill: theme.ink, fontFamily: theme.fonts.condensedFont, fontSize: 18, fontWeight: "bold",
      textAnchor: "middle", x: 300, y: 690,
    }, `${hostName} — PPD Dark Theme`)
  );

  saveSvg(renderElement(element, 600, 700), "hexbin-dark.svg");
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

const exporters = {
  "hexbin-host": exportHostHexbin,
  "hexbin-guest": exportGuestHexbin,
  "hexbin-dark": exportDarkHexbin,
  "dotdensity": exportDotDensity,
  "serve-host": exportServe,
  "rays-host": exportRays,
  "momentum": exportMomentum,
};

const onlyArg = process.argv.find((a) => a.startsWith("--only="));
const names = onlyArg ? onlyArg.split("=")[1].split(",") : Object.keys(exporters);

console.log(`\n🎨 courtviz static export — ${names.length} poster(s)\n`);

for (const name of names) {
  const fn = exporters[name];
  if (!fn) {
    console.error(`  ✗ Unknown poster: ${name}`);
    console.error(`    Available: ${Object.keys(exporters).join(", ")}`);
    process.exit(1);
  }
  fn();
}

console.log(`\n✅ Exported ${names.length} SVG(s) to ${outDir}\n`);
