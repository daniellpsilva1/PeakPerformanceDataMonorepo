const fs = require("fs");
const path = require("path");

const dataDir = path.resolve(__dirname, "../../DataViz/data");
const outDir = path.resolve(__dirname, "../packages/data/src/fixtures");

fs.mkdirSync(outDir, { recursive: true });

// Transform and copy shots
const shots = JSON.parse(
  fs.readFileSync(path.join(dataDir, "shots_boluda.json"), "utf-8"),
);
const transformedShots = shots.map((s) => ({
  matchId: "f6cd7d61-fc69-4dfc-8336-2c90a4ced93a",
  setNumber: s.set_number,
  gameNumber: s.game_number,
  pointNumber: s.point_number,
  shotNumber: s.shot_number,
  player: s.player,
  stroke: s.stroke,
  type: s.type,
  spin: s.spin,
  result: s.result,
  speedKmh: s.speed_kmh != null ? parseFloat(s.speed_kmh) : null,
  bounceX: s.bounce_x != null ? parseFloat(s.bounce_x) : null,
  bounceY: s.bounce_y != null ? parseFloat(s.bounce_y) : null,
  bounceZone: s.bounce_zone,
  bounceSide: s.bounce_side,
  bounceDepth: s.bounce_depth,
  hitX: s.hit_x != null ? parseFloat(s.hit_x) : null,
  hitY: s.hit_y != null ? parseFloat(s.hit_y) : null,
  hitZ: s.hit_z != null ? parseFloat(s.hit_z) : null,
  hitZone: s.hit_zone,
  hitSide: s.hit_side,
  hitDepth: s.hit_depth,
  isTerminal: s.is_terminal,
  direction: s.direction,
  placementZone: s.placement_zone,
  shotAttribution: s.shot_attribution,
  startTime: s.start_time,
  videoTimeSec:
    s.video_time_sec != null ? parseFloat(s.video_time_sec) : null,
}));
fs.writeFileSync(
  path.join(outDir, "shots_boluda.json"),
  JSON.stringify(transformedShots),
);
console.log("Shots:", transformedShots.length);

// Copy points (already camelCase)
const points = JSON.parse(
  fs.readFileSync(path.join(dataDir, "points_boluda.json"), "utf-8"),
);
fs.writeFileSync(
  path.join(outDir, "points_boluda.json"),
  JSON.stringify(points),
);
console.log("Points:", points.length);

// Transform and copy sets
const sets = JSON.parse(
  fs.readFileSync(path.join(dataDir, "sets_boluda.json"), "utf-8"),
);
const transformedSets = sets.map((s) => ({
  matchId: "f6cd7d61-fc69-4dfc-8336-2c90a4ced93a",
  setNumber: s.set_number,
  hostScore: s.host_score,
  guestScore: s.guest_score,
  hostTiebreakScore: s.host_tiebreak ?? null,
  guestTiebreakScore: s.guest_tiebreak ?? null,
}));
fs.writeFileSync(
  path.join(outDir, "sets_boluda.json"),
  JSON.stringify(transformedSets),
);
console.log("Sets:", transformedSets.length);

// Transform and copy match meta
const meta = JSON.parse(
  fs.readFileSync(path.join(dataDir, "match_boluda_meta.json"), "utf-8"),
);
const match = {
  id: meta.id,
  hostPlayerNames: meta.host_player_names,
  guestPlayerNames: meta.guest_player_names,
  surface: meta.surface,
  matchDate: meta.match_date,
};
fs.writeFileSync(
  path.join(outDir, "match_boluda.json"),
  JSON.stringify(match),
);
console.log("Match:", match.id);
