// Builds the BOSS print pack as SVG masters, in the same layout as the Drive folder:
//   <outDir>/1. Scorecard/BOSS Compass - classic.svg ... 6. <First name>'s set/...
//
//   node --no-warnings --import ./scripts/print-pack/ts-resolve.mjs scripts/print-pack/build.mjs <outDir> [coach.json]
//   node scripts/print-pack/render.mjs <outDir> --pdf      (adds .png and .pdf next to each .svg)
//
// coach.json (optional): { "name": "...", "firstName": "...", "business": "...", "slug": "...", "avatarUrl": "https://..." }
// The graphics themselves live in src/lib/printPack (catalog.js lists them), shared with the coach Toolkit.
import fs from "node:fs";
import path from "node:path";
import { GENERIC, PERSONAL } from "../../src/lib/printPack/catalog.js";
import { makeCoach } from "../../src/lib/printPack/coach.js";

const [outDir, coachFile] = process.argv.slice(2);
if (!outDir) {
  console.error("Usage: build.mjs <outDir> [coach.json]");
  process.exit(1);
}

const files = {};
for (const item of GENERIC) files[`${item.section}/${item.title}.svg`] = item.render({});

if (coachFile) {
  const input = JSON.parse(fs.readFileSync(coachFile, "utf8"));
  if (input.avatarUrl) {
    const res = await fetch(input.avatarUrl);
    if (res.ok) {
      const type = res.headers.get("content-type") || "image/jpeg";
      input.avatarDataUri = `data:${type};base64,${Buffer.from(await res.arrayBuffer()).toString("base64")}`;
    }
  }
  const coach = await makeCoach(input, { link: "score" });
  const first = input.firstName || input.name.split(" ")[0];
  for (const item of PERSONAL) files[`6. ${first}'s set/${item.title} - ${first}.svg`] = item.render({ coach });
  console.log(`coach link: ${coach.url}`);
}

for (const [rel, svg] of Object.entries(files)) {
  const out = path.join(outDir, rel);
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, svg);
}
console.log(`${Object.keys(files).length} SVG files -> ${outDir}`);
