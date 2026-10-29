// Renders LinkedIn banner drafts (1584x396, saved at 2x) from HTML templates.
// Usage: node scripts/linkedin-banners/render.mjs <outDir>
import { chromium } from "playwright";
import { mkdirSync, readFileSync } from "node:fs";
import { resolve, join } from "node:path";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { createElement } = require("react");
const { renderToStaticMarkup } = require("react-dom/server");
const lucide = require("lucide-react");
const icon = (name, size, color) => renderToStaticMarkup(createElement(lucide[name], { size, color, strokeWidth: 2 }));

const ROOT = resolve(import.meta.dirname, "../..");
const OUT = resolve(process.argv[2] || join(ROOT, "tmp/linkedin-banners"));
const W = 1584;
const H = 396;

const MIME = { png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", webp: "image/webp", ttf: "font/ttf" };
// Inline as data URIs: pages loaded with setContent can't read file:// URLs.
const dataUri = (abs) => `data:${MIME[abs.split(".").pop()]};base64,${readFileSync(abs).toString("base64")}`;
const file = (p) => dataUri(join(ROOT, p));
const svgInline = (p) => readFileSync(join(ROOT, p), "utf8");
const FONT = dataUri(join(process.env.HOME, "Library/Fonts/Figtree[wght].ttf"));

const C = {
  ink: "#0F172A",
  slate: "#64748B",
  navy: "#0C5290",
  deep: "#051E36",
  sky: "#1A8FD4",
  blue: "#42A1EE",
  teal: "#1CA0C2",
  foundation: "#4C667A",
  ground: "#F6F8FB",
};
const GRADIENT = `linear-gradient(100deg, ${C.deep} 0%, ${C.navy} 55%, ${C.sky} 100%)`;

// LinkedIn's profile photo covers roughly x 40-440, y 200-396 (desktop and
// mobile). Copy starts at x 470 and the bottom-left stays empty.
const SAFE_X = 470;

const base = `
@font-face { font-family: Figtree; src: url("${FONT}"); font-weight: 300 900; }
* { box-sizing: border-box; margin: 0; padding: 0; }
html, body { width: ${W}px; height: ${H}px; overflow: hidden; }
body { font-family: Figtree, sans-serif; position: relative; -webkit-font-smoothing: antialiased; }
.logo { position: absolute; top: 22px; left: 34px; }
.logo svg { height: 64px; width: auto; display: block; }
.copy { position: absolute; left: ${SAFE_X + 30}px; top: 50%; transform: translateY(-50%); }
.eyebrow { font-size: 22px; font-weight: 600; letter-spacing: 0; margin-bottom: 12px; }
.h-light { font-size: 54px; font-weight: 300; line-height: 1.06; letter-spacing: -0.015em; white-space: nowrap; }
.h-bold { font-size: 54px; font-weight: 700; line-height: 1.06; letter-spacing: -0.02em; white-space: nowrap; }
.pill { display: inline-flex; align-items: center; gap: 10px; margin-top: 22px; padding: 12px 24px; border-radius: 999px; font-size: 18px; font-weight: 600; }
.pill .arrow { font-weight: 400; }
.note { display: inline-block; margin-left: 16px; font-size: 18px; font-weight: 500; }
`;

const logo = (white) =>
  `<div class="logo">${svgInline(white ? "public/brand/profit-coach-logo-white.svg" : "public/profit-coach-logo.svg")}</div>`;

// ---------- graphics ----------

function wedge(cx, cy, r0, r1, a0, a1) {
  const p = (r, a) => `${(cx + r * Math.cos(a)).toFixed(1)} ${(cy + r * Math.sin(a)).toFixed(1)}`;
  const large = a1 - a0 > Math.PI ? 1 : 0;
  if (r0 === 0) return `M ${cx} ${cy} L ${p(r1, a0)} A ${r1} ${r1} 0 ${large} 1 ${p(r1, a1)} Z`;
  return `M ${p(r0, a0)} L ${p(r1, a0)} A ${r1} ${r1} 0 ${large} 1 ${p(r1, a1)} L ${p(r0, a1)} A ${r0} ${r0} 0 ${large} 0 ${p(r0, a0)} Z`;
}

const AREA_COLOURS = [C.foundation, C.navy, C.navy, C.navy, C.blue, C.blue, C.blue, C.teal, C.teal, C.teal];
const SAMPLE_SCORES = [0.55, 0.72, 0.46, 0.6, 0.82, 0.5, 0.66, 0.4, 0.76, 0.58];

// Warning colours for the constraint wedge and its label
const HOT = { red: "#E5484D", orange: "#F97316" };

function bossWheel({ size, ghost = false, dark = false, focus, hot }) {
  const gap = C.ground;
  const r = size / 2;
  const R = r * 0.86;
  const step = (Math.PI * 2) / 10;
  const start = -Math.PI / 2 - step / 2;
  let paths = "";
  for (let i = 0; i < 10; i++) {
    const inset = dark ? 0.012 : 0;
    const a0 = start + i * step + inset;
    const a1 = a0 + step - 2 * inset;
    if (ghost) {
      paths += `<path d="${wedge(r, r, 0, R, a0, a1)}" fill="none" stroke="rgba(255,255,255,0.14)" stroke-width="1.5"/>`;
      paths += `<path d="${wedge(r, r, 0, R * SAMPLE_SCORES[i], a0, a1)}" fill="rgba(255,255,255,${0.05 + i * 0.008})"/>`;
    } else {
      const muted = focus !== undefined && i !== focus;
      const fill = muted ? (dark ? "rgba(255,255,255,0.2)" : "#CBD5E1") : i === focus ? (hot ? HOT[hot] : dark ? "#7CD3F7" : C.sky) : AREA_COLOURS[i];
      // On the gradient, open gaps instead of strokes (the colour behind changes)
      const edge = dark ? "" : `stroke="${gap}" stroke-width="3"`;
      paths += `<path d="${wedge(r, r, 0, R, a0, a1)}" fill="${dark ? "#ffffff" : AREA_COLOURS[i]}" opacity="${dark ? 0.06 : 0.1}" ${edge}/>`;
      paths += `<path d="${wedge(r, r, 0, R * SAMPLE_SCORES[i], a0, a1)}" fill="${fill}" ${edge}/>`;
    }
  }
  // Pillar ring: Foundation, Vision, Velocity, Value
  const groups = [
    [0, 1, C.foundation],
    [1, 4, C.navy],
    [4, 7, C.blue],
    [7, 10, C.teal],
  ];
  for (const [g0, g1, col] of groups) {
    const a0 = start + g0 * step + 0.02;
    const a1 = start + g1 * step - 0.02;
    paths += `<path d="${wedge(r, r, R * 1.05, R * 1.14, a0, a1)}" fill="${ghost ? "rgba(255,255,255,0.16)" : col}" opacity="${focus !== undefined ? 0.35 : 1}"/>`;
  }
  if (focus !== undefined) {
    // Label the weakest area, just past the tip of its wedge
    const a = start + (focus + 0.5) * step;
    const tip = R * SAMPLE_SCORES[focus] + 26;
    const x = r + tip * Math.cos(a);
    const y = r + tip * Math.sin(a);
    const w = 168;
    paths += `<rect x="${(x - w).toFixed(1)}" y="${(y - 4).toFixed(1)}" width="${w}" height="38" rx="19" fill="${hot ? HOT[hot] : dark ? "#fff" : C.ink}"/>`;
    paths += `<text x="${(x - w / 2).toFixed(1)}" y="${(y + 20).toFixed(1)}" text-anchor="middle" font-family="Figtree" font-weight="700" font-size="17" fill="${dark && !hot ? C.navy : "#fff"}">Your constraint</text>`;
  }
  return `<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">${paths}</svg>`;
}

function hexagon(cx, cy, r) {
  const pts = [];
  for (let i = 0; i < 6; i++) {
    const a = (Math.PI / 3) * i - Math.PI / 2;
    pts.push(`${(cx + r * Math.cos(a)).toFixed(1)},${(cy + r * Math.sin(a)).toFixed(1)}`);
  }
  return pts.join(" ");
}

// The three pillars, with the same icons the app uses
const PILLARS = [
  { label: "Vision", verb: "Clarify vision", tagline: "Clarity about the future", col: C.navy, icon: "Eye" },
  { label: "Velocity", verb: "Control velocity", tagline: "Speed of profit and growth", col: C.blue, icon: "Gauge" },
  { label: "Value", verb: "Create value", tagline: "Long-term value of the business", col: C.teal, icon: "Gem" },
];

// Three solid hexagons in a honeycomb, icon and name inside
function pillarHoneycomb({ verbs = false } = {}) {
  const r = 90;
  const w = r * Math.sqrt(3);
  const gap = 8;
  const pos = [
    { x: w / 2 + (w + gap) / 2, y: r },
    { x: w / 2, y: r + 1.5 * r + gap * 0.87 },
    { x: w / 2 + w + gap, y: r + 1.5 * r + gap * 0.87 },
  ];
  const order = [PILLARS[0], PILLARS[2], PILLARS[1]]; // Vision on top, Value left, Velocity right
  const width = 2 * w + gap;
  const height = pos[1].y + r;
  let s = `<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" style="position:absolute;inset:0">`;
  order.forEach((p, i) => (s += `<polygon points="${hexagon(pos[i].x, pos[i].y, r)}" fill="${p.col}"/>`));
  s += `</svg>`;
  order.forEach((p, i) => {
    s += `<div style="position:absolute;left:${pos[i].x - 80}px;top:${pos[i].y - 42}px;width:160px;text-align:center;color:#fff">
      <div style="display:flex;justify-content:center">${icon(p.icon, 34, "#fff")}</div>
      <div style="margin-top:6px;font-size:${verbs ? 18 : 22}px;font-weight:700;line-height:1.1">${verbs ? p.verb : p.label}</div>
    </div>`;
  });
  return `<div style="position:relative;width:${width}px;height:${height}px">${s}</div>`;
}

// The coach's three phases: score, review call, plan
const PHASES = [
  { label: "Score", tagline: "10 areas, scored out of 100", col: C.navy, colDark: "#093f70", icon: "ChartPie" },
  { label: "Review", tagline: "Find the one thing holding you back", col: C.blue, colDark: "#2b86d3", icon: "Target" },
  { label: "Plan", tagline: "The right few fixes, in order", col: C.teal, colDark: "#14829f", icon: "Map" },
];
// The three phases of the coaching offer (content/agent/references/phased-pitch.md)
const OFFER = [
  { label: "Get clear", when: "Month 1", tagline: "Score it and find the real cause", col: C.navy, colDark: "#093f70", icon: "Search" },
  { label: "Fix what matters", when: "Months 2 and 3", tagline: "The right few fixes, done properly", col: C.blue, colDark: "#2b86d3", icon: "Wrench" },
  { label: "Make it last", when: "From month 4", tagline: "Score again every 90 days", col: C.teal, colDark: "#14829f", icon: "ShieldCheck" },
];
const PILLAR_DARK = ["#093f70", "#2b86d3", "#14829f"];

// Three white step cards, centred icon. "strip": coloured top bar with "1 Vision".
// "app": like the roadmap cards in the app (number badge, coloured bar at the bottom).
function stepCards(items, { style = "strip" } = {}) {
  const w = 168;
  const gap = 14;
  const h = 200;
  let s = "";
  items.forEach((p, i) => {
    const colDark = p.colDark || PILLAR_DARK[i];
    const card = `position:absolute;left:${i * (w + gap)}px;top:0;width:${w}px;height:${h}px;border-radius:14px;overflow:hidden;background:#fff;border:1px solid #E2E8F0;box-shadow:0 18px 40px -20px rgba(12,82,144,.55);text-align:center`;
    if (style === "app") {
      s += `<div style="${card};display:flex;flex-direction:column">
        <span style="position:absolute;right:10px;top:10px;width:30px;height:30px;border-radius:9px;background:${p.col};color:#fff;font-size:16px;font-weight:800;display:flex;align-items:center;justify-content:center">${i + 1}</span>
        <div style="flex:1;padding:24px 14px 0">
          <div style="display:flex;justify-content:center">${icon(p.icon, 44, p.col)}</div>
          <div style="margin-top:12px;font-size:${p.when ? 17 : 20}px;font-weight:800;color:${p.col};white-space:nowrap">${p.label}</div>
          ${p.when ? `<div style="margin-top:2px;font-size:14px;font-weight:600;color:${C.slate}">${p.when}</div>` : ""}
        </div>
        <div style="background:${colDark};color:#fff;padding:10px 12px;font-size:14px;font-weight:600;line-height:1.25;min-height:56px;display:flex;align-items:center;justify-content:center">${p.tagline}</div>
      </div>`;
    } else {
      s += `<div style="${card}">
        <div style="height:46px;background:${p.col};display:flex;align-items:center;justify-content:center;gap:10px;color:#fff">
          <span style="font-size:22px;font-weight:800">${i + 1}</span><span style="font-size:${p.label.length > 10 ? 16 : 19}px;font-weight:700;white-space:nowrap">${p.label}</span>
        </div>
        <div style="padding:18px 14px 0">
          <div style="display:flex;justify-content:center">${icon(p.icon, 46, p.col)}</div>
          <div style="margin-top:12px;font-size:17px;font-weight:700;line-height:1.22;color:${C.ink}">${p.tagline}</div>
        </div>
      </div>`;
    }
  });
  return `<div style="position:relative;width:${3 * w + 2 * gap}px;height:${h}px">${s}</div>`;
}

// Three hexagons in a row joined like a roadmap, verb labels underneath
function pillarRow({ dark = false } = {}) {
  const r = 58;
  const col = 176;
  let s = `<div style="position:absolute;left:${col / 2}px;right:${col / 2}px;top:${r}px;height:3px;background:linear-gradient(90deg, ${C.navy}, ${C.blue}, ${C.teal})"></div>`;
  PILLARS.forEach((p, i) => {
    s += `<div style="position:absolute;left:${i * col}px;top:0;width:${col}px;text-align:center">
      <svg width="${r * 2}" height="${r * 2}" viewBox="0 0 ${r * 2} ${r * 2}" style="display:block;margin:0 auto"><polygon points="${hexagon(r, r, r)}" fill="${p.col}"/></svg>
      <div style="position:absolute;left:0;right:0;top:${r - 20}px;display:flex;justify-content:center">${icon(p.icon, 40, "#fff")}</div>
      <div style="margin-top:14px;font-size:14px;font-weight:700;color:${dark ? "rgba(255,255,255,.7)" : C.slate}">Step ${i + 1}</div>
      <div style="margin-top:2px;font-size:21px;font-weight:700;color:${dark ? "#fff" : C.ink};white-space:nowrap">${p.verb}</div>
    </div>`;
  });
  return `<div style="position:relative;width:${col * 3}px;height:200px">${s}</div>`;
}

const LEVELS = ["Overwhelm", "Overworked", "Organised", "Overseer", "Owner"];
const LEVEL_COLOURS = ["#7CC4F5", "#42A1EE", "#1A7BC9", C.navy, C.teal];

function levelBars({ dark = false } = {}) {
  const bw = 64;
  const gap = 26;
  let s = "";
  LEVELS.forEach((name, i) => {
    const h = 46 + i * 44;
    const x = i * (bw + gap);
    s += `<div style="position:absolute;left:${x}px;bottom:34px;width:${bw}px;height:${h}px;border-radius:10px 10px 4px 4px;background:${LEVEL_COLOURS[i]};${dark ? "box-shadow:0 0 40px -6px " + LEVEL_COLOURS[i] : ""}"></div>`;
    s += `<div style="position:absolute;left:${x - 12}px;bottom:0;width:${bw + 24}px;text-align:center;font-size:14px;font-weight:600;color:${dark ? "rgba(255,255,255,.8)" : C.slate}">${name}</div>`;
    s += `<div style="position:absolute;left:${x}px;bottom:${34 + h + 8}px;width:${bw}px;text-align:center;font-size:13px;font-weight:700;color:${dark ? "#fff" : C.ink}">${i + 1}</div>`;
  });
  return `<div style="position:relative;width:${5 * bw + 4 * gap}px;height:290px">${s}</div>`;
}

// ---------- templates ----------

const accent = (text, dark) =>
  text.replace(
    /\*(.+?)\*/g,
    (_, w) =>
      `<span style="background:linear-gradient(90deg, ${dark ? "#7CD3F7, #5EEAD4" : `${C.sky}, ${C.teal}`});-webkit-background-clip:text;color:transparent">${w}</span>`,
  );

const copyBlock = (v, { dark }) => `
  <div class="copy">
    ${v.eyebrow ? `<div class="eyebrow" style="color:${dark ? "#8FD0FF" : C.navy}">${v.eyebrow}</div>` : ""}
    <div class="h-light" style="color:${dark ? "rgba(255,255,255,.78)" : C.slate}">${v.light}</div>
    <div class="h-bold" style="color:${dark ? "#fff" : C.ink}">${accent(v.bold, dark)}</div>
    ${
      v.cta
        ? `<div class="pill" style="background:${dark ? "#fff" : C.navy};color:${dark ? C.navy : "#fff"}">${v.cta} <span class="arrow">→</span></div>${
            v.note ? `<span class="note" style="color:${dark ? "rgba(255,255,255,.7)" : C.slate}">${v.note}</span>` : ""
          }`
        : ""
    }
  </div>`;

const ground = (v) => (v.dark ? GRADIENT : C.ground);

const TEMPLATES = {
  // Brand gradient, faint BOSS wheel, words only
  quiet: (v) => `
    <body style="background:${GRADIENT}">
      <div style="position:absolute;right:-170px;top:50%;transform:translateY(-50%)">${bossWheel({ size: 720, ghost: true })}</div>
      ${logo(true)}
      ${copyBlock(v, { dark: true })}
    </body>`,

  // BCA light ground, the BOSS wheel in colour on the right
  wheel: (v) => `
    <body style="background:${ground(v)}">
      <div class="graphic" style="position:absolute;right:-150px;top:50%;transform:translateY(-50%)">${bossWheel({ size: 560, dark: v.dark, focus: v.focus, hot: v.hot })}</div>
      ${logo(v.dark)}
      ${copyBlock(v, { dark: v.dark })}
    </body>`,

  // Dark, "your score: ?/100" card
  score: (v) => `
    <body style="background:${GRADIENT}">
      ${logo(true)}
      ${copyBlock(v, { dark: true })}
      <div class="graphic" style="position:absolute;right:70px;top:50%;transform:translateY(-50%);width:400px;padding:26px 30px;border-radius:24px;background:rgba(255,255,255,.08);border:1px solid rgba(255,255,255,.2);backdrop-filter:blur(8px)">
        <div style="display:flex;justify-content:space-between;align-items:baseline;color:#fff">
          <div style="font-size:16px;font-weight:600;opacity:.8">Your BOSS Score</div>
          <div><span style="font-size:64px;font-weight:700;line-height:1">?</span><span style="font-size:22px;opacity:.7">/100</span></div>
        </div>
        <div style="display:flex;gap:8px;align-items:flex-end;height:110px;margin-top:14px">
          ${SAMPLE_SCORES.map((s, i) => `<div style="flex:1;height:${Math.round(s * 100)}%;border-radius:6px 6px 2px 2px;background:${AREA_COLOURS[i] === C.navy ? "#7CC4F5" : AREA_COLOURS[i] === C.foundation ? "#B9C7D3" : AREA_COLOURS[i]}"></div>`).join("")}
        </div>
        <div style="margin-top:10px;font-size:13px;color:rgba(255,255,255,.65)">10 areas of your business, scored</div>
      </div>
    </body>`,

  // The 5 Levels as rising bars
  levels: (v) => `
    <body style="background:${ground(v)}">
      ${logo(v.dark)}
      ${copyBlock(v, { dark: v.dark })}
      <div class="graphic" style="position:absolute;right:50px;bottom:44px">${levelBars({ dark: v.dark })}</div>
    </body>`,

  // Real stage photo on the right, navy on the left
  stage: (v) => `
    <body style="background:${C.deep}">
      <img src="${file(v.photo)}" style="position:absolute;right:0;top:0;height:100%;width:56%;object-fit:cover;object-position:${v.photoPos || "center"}"/>
      <div style="position:absolute;inset:0;background:linear-gradient(90deg, ${C.deep} 0%, ${C.deep} 40%, rgba(5,30,54,.85) 55%, rgba(5,30,54,0) 80%)"></div>
      ${logo(true)}
      ${copyBlock(v, { dark: true })}
    </body>`,

  // Light ground, the three pillars as a solid honeycomb
  honeycomb: (v) => `
    <body style="background:${ground(v)}">
      <div class="graphic" style="position:absolute;right:40px;top:50%;transform:translateY(-50%)">${pillarHoneycomb({ verbs: v.verbs })}</div>
      ${logo(v.dark)}
      ${copyBlock(v, { dark: v.dark })}
    </body>`,

  // Light ground, the three pillars as a three-step roadmap
  roadmap: (v) => `
    <body style="background:${ground(v)}">
      <div class="graphic" style="position:absolute;right:50px;top:50%;transform:translateY(-50%)">${pillarRow({ dark: v.dark })}</div>
      ${logo(v.dark)}
      ${copyBlock(v, { dark: v.dark })}
    </body>`,

  // White step cards: the three pillars, or the three phases (v.phases)
  cards: (v) => `
    <body style="background:${ground(v)}">
      <div class="graphic" style="position:absolute;right:40px;top:50%;transform:translateY(-50%)">${stepCards({ phases: PHASES, offer: OFFER }[v.steps] ?? PILLARS, { style: v.cardStyle })}</div>
      ${logo(v.dark)}
      ${copyBlock(v, { dark: v.dark })}
    </body>`,
};

// ---------- the drafts ----------

// No coach name, photo or credentials: the profile photo and name sit right below the banner.
const ANY = "For owner-led businesses doing £1M+";
const CTA = "Get your BOSS Score";
const NOTE = "Free. Takes 3 minutes.";
const FIXES = { light: "The right few fixes,", bold: "in the *right order.*" };
const CONSTRAINT = { light: "Every business has", bold: "one constraint. *Find yours.*" };
const HOLDING = { light: "Find the one thing", bold: "holding you *back.*" };
const FIX_RIGHT = { light: "Fix the right things", bold: "in the *right order.*" };
const IS_IT_YOU = { light: "Are you the one", bold: "holding it *back?*" };
const WAITS = { light: "Does every decision", bold: "still wait for *you?*" };
const AWAY = { light: "Off for a month?", bold: "*What would break?*" };
const WRONG_ORDER = { light: "Good ideas.", bold: "*Wrong order.*" };

const COMES_BACK = { light: "Does it all still", bold: "come back to *you?*" };

// The bank: the versions Zander picked (29 Oct 2026). Earlier rounds are on the Desktop.
const base6 = { eyebrow: ANY, cta: CTA, note: NOTE };
const DRAFTS = [
  { name: "01 Offer phases - Fix the right things", t: "cards", steps: "offer", cardStyle: "app", ...base6, ...FIX_RIGHT },
  { name: "02 Offer phases dark - Off for a month", t: "cards", steps: "offer", cardStyle: "app", dark: true, ...base6, ...AWAY },
  { name: "03 Wheel red - One constraint", t: "wheel", focus: 7, hot: "red", ...base6, ...CONSTRAINT },
  { name: "04 Wheel red dark - One constraint", t: "wheel", focus: 7, hot: "red", dark: true, ...base6, ...CONSTRAINT },
  { name: "05 Wheel orange dark - One constraint", t: "wheel", focus: 7, hot: "orange", dark: true, ...base6, ...CONSTRAINT },
  { name: "06 Wheel red dark - Does it all come back to you", t: "wheel", focus: 7, hot: "red", dark: true, ...base6, ...COMES_BACK },
  { name: "07 Wheel red - Are you the one holding it back", t: "wheel", focus: 7, hot: "red", ...base6, ...IS_IT_YOU },
  { name: "08 Score phases - Good ideas, wrong order", t: "cards", steps: "phases", cardStyle: "app", ...base6, ...WRONG_ORDER },
];

mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 2 });
const only = process.argv[3];
for (const d of DRAFTS) {
  if (only && !d.name.startsWith(only)) continue;
  const html = `<!doctype html><html><head><meta charset="utf-8"><style>${base}</style></head>${TEMPLATES[d.t](d)}</html>`;
  await page.setContent(html, { waitUntil: "load" });
  await page.evaluate(() => document.fonts.ready);
  const clash = await page.evaluate(() => {
    const words = document.querySelector(".copy")?.getBoundingClientRect();
    const art = document.querySelector(".graphic")?.getBoundingClientRect();
    return words && art && words.right > art.left - 24 && words.bottom > art.top && words.top < art.bottom;
  });
  if (clash) console.warn("  ! words run into the graphic:", d.name);
  await page.screenshot({ path: join(OUT, `${d.name}.png`) });
  console.log("rendered", d.name);
}
await browser.close();
