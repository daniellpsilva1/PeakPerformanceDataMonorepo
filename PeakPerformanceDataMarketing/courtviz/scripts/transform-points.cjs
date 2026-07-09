const fs = require("fs");

const raw = fs.readFileSync(
  "/var/folders/ls/ml2815m51pb9t80grr7hbtmh0000gn/T/windsurf/mcp_output_c1c935b6ab115b29.txt",
  "utf-8",
);

// The file is a JSON object with a "result" key containing the text
const outer = JSON.parse(raw);
const text = outer.result;

// Extract the JSON array from the untrusted-data section
const startIdx = text.indexOf("[{");
const endIdx = text.lastIndexOf("}]");
if (startIdx === -1 || endIdx === -1) {
  console.error("No JSON array found in result text");
  process.exit(1);
}

const jsonStr = text.substring(startIdx, endIdx + 2);
const rows = JSON.parse(jsonStr);

const transformed = rows.map((r) => ({
  id: r.id,
  matchId: r.match_id,
  setNumber: r.set_number,
  gameNumber: r.game_number,
  pointNumber: r.point_number,
  pointWinner: r.point_winner,
  rallyLength: r.rally_length,
  endedBy: r.ended_by,
  breakPoint: r.break_point,
  setPoint: r.set_point,
  matchPoint: r.match_point,
  deuce: r.deuce,
  tiebreak: r.tiebreak,
  superTiebreak: r.super_tiebreak,
  serverSide: r.server_side,
  serveAttempt: r.serve_attempt,
  durationSec: r.duration_sec,
  videoTimeSec: r.video_time_sec,
}));

const out = JSON.stringify(transformed, null, 2);
const outPath =
  "/Users/danielsilva/Desktop/PeakPerformanceDataMonorepo/PeakPerformanceDataMarketing/DataViz/data/points_boluda.json";
fs.writeFileSync(outPath, out);
console.log(`Wrote ${transformed.length} points to ${outPath}`);
