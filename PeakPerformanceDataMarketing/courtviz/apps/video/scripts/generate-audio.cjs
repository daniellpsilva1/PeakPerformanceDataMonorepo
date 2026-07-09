/**
 * Generates procedural audio assets for the match recap video.
 * Requires ffmpeg on PATH.
 *
 * Usage: node scripts/generate-audio.cjs
 */

const { execSync } = require("child_process");
const fs = require("fs");
const path = require("path");

const outDir = path.resolve(__dirname, "../public/audio");
fs.mkdirSync(outDir, { recursive: true });

function run(cmd, label) {
  console.log(`  → ${label}`);
  execSync(cmd, { stdio: "inherit" });
}

console.log("\n🎵 Generating courtviz audio assets...\n");

run(
  `ffmpeg -y -f lavfi -i "sine=frequency=55:duration=70" -f lavfi -i "sine=frequency=82.5:duration=70" -filter_complex "[0][1]amix=inputs=2:duration=first,volume=0.06,lowpass=f=400,afade=t=in:st=0:d=3,afade=t=out:st=65:d=5" -c:a libmp3lame -q:a 6 "${path.join(outDir, "ambient.mp3")}"`,
  "ambient.mp3",
);

run(
  `ffmpeg -y -f lavfi -i "anoisesrc=duration=0.35:color=white:seed=42" -af "lowpass=f=900,volume=0.35,afade=t=in:st=0:d=0.02,afade=t=out:st=0.15:d=0.2" -c:a libmp3lame -q:a 4 "${path.join(outDir, "whoosh.mp3")}"`,
  "whoosh.mp3",
);

run(
  `ffmpeg -y -f lavfi -i "sine=frequency=880:duration=0.08" -af "volume=0.25,afade=t=out:st=0.04:d=0.04" -c:a libmp3lame -q:a 4 "${path.join(outDir, "tick.mp3")}"`,
  "tick.mp3",
);

run(
  `ffmpeg -y -f lavfi -i "sine=frequency=220:duration=0.5" -f lavfi -i "sine=frequency=330:duration=0.5" -filter_complex "[0][1]amix=inputs=2,volume=0.2,afade=t=out:st=0.3:d=0.2" -c:a libmp3lame -q:a 4 "${path.join(outDir, "impact.mp3")}"`,
  "impact.mp3",
);

console.log(`\n✅ Audio assets written to ${outDir}\n`);
