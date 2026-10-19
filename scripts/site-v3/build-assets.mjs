// Builds the generated assets for the Scrollcraft site (scrollcraft/builds/profit-coach-site-v4):
//   playbook-wheel-data.js   the interactive 50-playbook wheel (same geometry and colours as the print pack's banded map)
//   assets/downloads/*       the free framework PDFs plus WebP thumbnails
//
//   node --no-warnings --import ./scripts/print-pack/ts-resolve.mjs scripts/site-v3/build-assets.mjs [--skip-downloads]
//
// Needs Playwright (for the PDFs) and ffmpeg with libwebp on PATH or in ~/.local/bin (for the thumbnails).
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";
import { C, D, PASTEL, SAT, esc, n2, wedge, arcLabel, svgDoc } from "../../src/lib/printPack/brand.js";
import { BAND_COLOR, PILLAR_GROUPS, PILLAR_LABEL, PILLAR_OF } from "../../src/lib/printPack/wheel.js";
import { scorecardSheet } from "../../src/lib/printPack/scorecard.js";
import { nineStepPost } from "../../src/lib/printPack/roadmap.js";
import { oldNewPortrait } from "../../src/lib/printPack/oldnew.js";
import { playbookMap, playbookGridPoster } from "../../src/lib/printPack/playbooks.js";

const QRCode = createRequire(import.meta.url)("qrcode");
const root = process.cwd();
const site = path.join(root, "scrollcraft/builds/profit-coach-site-v4");
const skipDownloads = process.argv.includes("--skip-downloads");

// ------------------------------------------------------------------ wheel --

/** First sentence or two of "What this is", in house style (no dashes). */
function summary(text) {
  const clean = String(text || "")
    .replace(/\s*[—–]\s*/g, ", ")
    .replace(/\*\*/g, "")
    .replace(/\s+/g, " ")
    .trim();
  const parts = clean.split(/(?<=[.!?])\s+/);
  let out = parts.shift() || "";
  while (out.length < 110 && parts.length) out += ` ${parts.shift()}`;
  return out;
}

function twoLines(name) {
  const words = name.split(" ");
  if (words.length < 2) return [name];
  let best = null;
  for (let i = 1; i < words.length; i++) {
    const a = words.slice(0, i).join(" "), b = words.slice(i).join(" ");
    const score = Math.max(a.length, b.length);
    if (!best || score < best.score) best = { a, b, score };
  }
  return [best.a, best.b];
}

// Screen version of the print map: a smaller hub and deeper rings, so the names stay readable at ~750px wide.
const LABEL_SIZE = [0, 17, 18, 19, 19.5, 20];

function playbookWheel() {
  const cx = 600, cy = 600;
  const R_HUB = 112, R0 = 120, RW = 72, R5 = R0 + RW * 5;
  const n = 10, step = (2 * Math.PI) / n, start = -Math.PI / 2, GAP = 0.012;
  const CHAR = 0.53; // average glyph width as a share of the font size
  const books = [];
  let cells = "", bands = "";

  for (let i = 0; i < n; i++) {
    const a0 = start + i * step + GAP, a1 = start + (i + 1) * step - GAP;
    const mid = start + (i + 0.5) * step, midDeg = (mid * 180) / Math.PI;
    const spanDeg = ((a1 - a0) * 180) / Math.PI;
    for (let lv = 1; lv <= 5; lv++) {
      const pb = D.PLAYBOOKS.find((p) => p.area === i && p.level === lv);
      const json = JSON.parse(fs.readFileSync(path.join(root, "content/playbooks", `${pb.ref}.json`), "utf8"));
      books.push({ ref: pb.ref, area: i, level: lv, name: pb.name, summary: summary(json.whatThisIs) });
      const r0 = R0 + RW * (lv - 1), r1 = r0 + RW, rMid = (r0 + r1) / 2;
      const room = rMid * (a1 - a0) * 0.88;
      const isLower = Math.sin(mid) > 0.05;
      const lines = pb.name.length * LABEL_SIZE[lv] * CHAR < room ? [pb.name] : twoLines(pb.name);
      const oneLine = lines.length === 1; // a single long word shrinks to fit instead of splitting
      const longest = Math.max(...lines.map((l) => l.length));
      const size = Math.min(LABEL_SIZE[lv], room / (longest * CHAR));
      const base = { cx, cy, aCenter: midDeg, span: spanDeg - 1, size: Math.round(size * 10) / 10, weight: 600, fill: C.ink };
      const off = size * 0.62;
      let label = "";
      if (oneLine) label = arcLabel({ ...base, id: `pbw-c${i}-${lv}`, r: rMid, str: pb.name });
      else {
        label = arcLabel({ ...base, id: `pbw-c${i}-${lv}a`, r: isLower ? rMid - off : rMid + off, str: lines[0] }) +
          arcLabel({ ...base, id: `pbw-c${i}-${lv}b`, r: isLower ? rMid + off : rMid - off, str: lines[1] });
      }
      cells += `<g class="pbw-cell" data-ref="${pb.ref}" data-area="${i}" data-level="${lv}" style="--pastel:${PASTEL[lv]};--sat:${SAT[lv]}">` +
        `<path class="pbw-fill" d="${wedge(cx, cy, r0 + 1.5, r1 - 1.5, a0, a1)}"/>${label}</g>`;
    }
    // Area band: thick pillar colour with the area name in white. Clicking it opens that area.
    bands += `<g class="pbw-area" data-area="${i}"><path d="${wedge(cx, cy, R5 + 6, R5 + 60, a0, a1)}" fill="${BAND_COLOR[PILLAR_OF[i]]}"/>` +
      arcLabel({ id: `pbw-ab${i}`, cx, cy, r: R5 + 33, aCenter: midDeg, span: 35, str: D.AREAS[i].name, size: 20, weight: 600, fill: "#ffffff" }) + `</g>`;
  }

  let pillars = "";
  for (const [pillar, idx] of PILLAR_GROUPS) {
    const a0 = start + idx[0] * step + GAP, a1 = start + (idx[idx.length - 1] + 1) * step - GAP;
    pillars += `<path d="${wedge(cx, cy, R5 + 66, R5 + 104, a0, a1)}" fill="${BAND_COLOR[pillar]}" fill-opacity="0.14"/>`;
    const d0 = (a0 * 180) / Math.PI, d1 = (a1 * 180) / Math.PI;
    pillars += arcLabel({ id: `pbw-pb-${pillar}`, cx, cy, r: R5 + 85, aCenter: (d0 + d1) / 2, span: d1 - d0 - 2, str: PILLAR_LABEL[pillar], size: 16, weight: 700, fill: BAND_COLOR[pillar], tracking: 3.5 });
  }

  const hub = `<g class="pbw-hub"><circle cx="${cx}" cy="${cy}" r="${R_HUB}"/>` +
    `<text class="pbw-hub__n" x="${cx}" y="${cy + 14}" text-anchor="middle">50</text>` +
    `<text class="pbw-hub__a" x="${cx}" y="${cy + 48}" text-anchor="middle">playbooks</text></g>`;

  const svg = `<svg class="pbw-svg" viewBox="0 0 1200 1200" aria-hidden="true" focusable="false">` +
    `<g class="pbw-pillars">${pillars}</g><g class="pbw-bands">${bands}</g><g class="pbw-cells">${cells}</g>${hub}</svg>`;

  const data = {
    areas: D.AREAS.map((a, i) => ({ name: a.name, pillar: PILLAR_LABEL[PILLAR_OF[i]].toLowerCase(), color: BAND_COLOR[PILLAR_OF[i]] })),
    levels: [...D.LEVELS].sort((a, b) => a.id - b.id).map((l) => ({ level: l.id, name: l.name, color: SAT[l.id], pastel: PASTEL[l.id] })),
    books,
    svg,
  };
  return `/* Generated by scripts/site-v3/build-assets.mjs from src/lib/bossData.ts, content/playbooks and the print pack. Do not edit. */\nwindow.PC_PLAYBOOK_WHEEL = ${JSON.stringify(data)};\n`;
}

fs.writeFileSync(path.join(site, "playbook-wheel-data.js"), playbookWheel());
console.log("wrote playbook-wheel-data.js");

// -------------------------------------------------------------- downloads --
// Brand versions of the owner downloads: the QR goes to /score and the coach line points to the directory.

if (!skipDownloads) {
  const url = "https://www.theprofitcoach.com/score";
  const raw = await QRCode.toString(url, { type: "svg", margin: 0, errorCorrectionLevel: "M", color: { dark: C.ink, light: "#0000" } });
  const qr = { viewBox: raw.match(/viewBox="([^"]+)"/)[1], body: raw.replace(/^[\s\S]*?<svg[^>]*>/, "").replace(/<\/svg>\s*$/, "") };
  const brand = { name: "Find a certified Profit Coach", business: "theprofitcoach.com/directory", url, displayUrl: "theprofitcoach.com/score", qr };
  const map = playbookMap({ idp: "pmb", style: "banded" });
  const files = {
    "50-playbooks-map": svgDoc({ w: map.w, h: map.h, viewBox: map.viewBox, title: "The 50 playbooks of the Profit System", body: `<rect width="1200" height="1200" fill="#ffffff"/>${map.body}` }),
    "50-playbooks-poster-a3": playbookGridPoster({ idp: "pg" }),
    "profit-system-9-steps": nineStepPost({ idp: "np", coach: brand }),
    "old-way-new-way": oldNewPortrait({ idp: "onp" }),
    "boss-scorecard-a4": scorecardSheet({ idp: "sc", coach: brand }),
  };

  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "site-v3-downloads-"));
  for (const [name, svg] of Object.entries(files)) fs.writeFileSync(path.join(tmp, `${name}.svg`), svg);
  execFileSync(process.execPath, [path.join(root, "scripts/print-pack/render.mjs"), tmp, "--pdf"], { stdio: "inherit" });

  const out = path.join(site, "assets/downloads");
  fs.mkdirSync(out, { recursive: true });
  const ffmpeg = [path.join(os.homedir(), ".local/bin/ffmpeg"), "ffmpeg"].find((p) => p === "ffmpeg" || fs.existsSync(p));
  for (const name of Object.keys(files)) {
    fs.copyFileSync(path.join(tmp, `${name}.pdf`), path.join(out, `${name}.pdf`));
    execFileSync(ffmpeg, ["-y", "-loglevel", "error", "-i", path.join(tmp, `${name}.png`), "-vf", "scale=760:-2", "-c:v", "libwebp", "-quality", "82", path.join(out, `${name}.webp`)]);
    console.log("download", name);
  }
}
