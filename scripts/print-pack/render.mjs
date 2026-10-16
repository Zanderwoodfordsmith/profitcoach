// Renders the SVG masters to PNG (and PDF with --pdf) using Playwright's Chromium,
// with the brand fonts loaded from Google Fonts so text matches the masters.
//
//   node scripts/print-pack/render.mjs <outDir> [--pdf] [--only <substring>]
// Writes <name>.png (and <name>.pdf) next to each <name>.svg, matching the Drive layout.
import fs from "node:fs";
import path from "node:path";
import { chromium } from "playwright";

const args = process.argv.slice(2);
const outDir = args[0];
const pdf = args.includes("--pdf");
const only = args.includes("--only") ? args[args.indexOf("--only") + 1] : null;
const svgDir = outDir;
const FONTS =
  "https://fonts.googleapis.com/css2?family=Inter+Tight:wght@500;600;700&family=Inter:ital,wght@0,400;0,500;0,600;1,400&family=Caveat:wght@500;700&family=Permanent+Marker&display=swap";

/** PNG width in px. Physical sizes render at 300 dpi; social sizes at their native size x2. */
function pngWidth(svg, vb) {
  const mm = svg.match(/width="([\d.]+)mm"/);
  if (mm) return Math.min(Math.round((Number(mm[1]) / 25.4) * 300), 5000);
  if (vb[2] >= 1500 && vb[3] <= 1500) return vb[2]; // landscape social, native
  return Math.max(2400, vb[2] * 2);
}

const walk = (d) => fs.readdirSync(d, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)]));
const svgs = walk(svgDir).filter((f) => f.endsWith(".svg") && (!only || f.includes(only)));

const browser = await chromium.launch();
for (const file of svgs) {
  const rel = path.relative(svgDir, file).replace(/\.svg$/, "");
  const svg = fs.readFileSync(file, "utf8").replace(/<\?xml[^>]*>/, "");
  const vb = svg.match(/viewBox="([^"]+)"/)[1].split(/\s+/).map(Number);
  const wpx = pngWidth(svg, vb);
  const hpx = Math.round((wpx * vb[3]) / vb[2]);
  const html = `<!doctype html><html><head><link href="${FONTS}" rel="stylesheet"><style>html,body{margin:0}svg{display:block;width:${wpx}px;height:${hpx}px}</style></head><body>${svg}</body></html>`;
  const page = await browser.newPage({ viewport: { width: wpx, height: hpx } });
  await page.setContent(html, { waitUntil: "networkidle" });
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(300);
  const png = path.join(outDir, `${rel}.png`);
  // Squares (compass, wheel, map) get a transparent background so they drop onto any layout.
  const transparent = !/width="[\d.]+mm"/.test(svg) && !/<rect width="\d+" height="\d+" fill="#ffffff"\/>/.test(svg);
  await page.screenshot({ path: png, omitBackground: transparent });
  if (pdf) {
    const m = svg.match(/width="([\d.]+)mm" height="([\d.]+)mm"/);
    const [w, h] = m ? [`${m[1]}mm`, `${m[2]}mm`] : [`${(vb[2] / 96) * 25.4}mm`, `${(vb[3] / 96) * 25.4}mm`];
    await page.addStyleTag({ content: `@page{size:${w} ${h};margin:0} svg{width:${w} !important;height:${h} !important}` });
    const out = path.join(outDir, `${rel}.pdf`);
    await page.pdf({ path: out, width: w, height: h, printBackground: true, pageRanges: "1" });
  }
  await page.close();
  console.log("rendered", rel);
}
await browser.close();
