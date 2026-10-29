// Renders a coach's LinkedIn Featured and post images (1200x627 and 1080x1080, saved at 2x)
// in the LinkedIn banner skill's look: Figtree two-weight headline, plain navy eyebrow,
// pill button, BCA light ground, the BOSS wheel with the constraint in red.
// Usage: node scripts/linkedin-featured/render.mjs <outDir>
import { chromium } from "playwright";
import { mkdirSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";

const OUT = resolve(process.argv[2] || "tmp/linkedin-featured");
mkdirSync(OUT, { recursive: true });
const FONT = `data:font/ttf;base64,${readFileSync(join(process.env.HOME, "Library/Fonts/Figtree[wght].ttf")).toString("base64")}`;
const C = { ink: "#0F172A", slate: "#64748B", navy: "#0C5290", sky: "#1A8FD4", blue: "#42A1EE", teal: "#1CA0C2", foundation: "#4C667A", ground: "#F6F8FB", line: "#E2E8F0", red: "#EF4444", redDeep: "#DC2626" };

// One coach for now. Every line here comes from their Blueprint.
const COACH = {
  name: "Peter Buglass",
  title: "Chartered Director",
  business: "Director School",
  website: "directorschool.co.uk",
  scoreUrl: "theprofitcoach.com/score/directorschool",
  eyebrow: "For manufacturing owners, £1m to £20m",
  photo: "https://qpqqwuxjzwwclebqcrfj.supabase.co//storage/v1/object/public/avatars/1f10eb8c-542b-4f47-90ce-30ca02a0e740/avatar.png",
};

function wedge(cx, cy, r0, r1, a0, a1) {
  const p = (r, a) => `${(cx + r * Math.cos(a)).toFixed(1)} ${(cy + r * Math.sin(a)).toFixed(1)}`;
  const large = a1 - a0 > Math.PI ? 1 : 0;
  if (r0 === 0) return `M ${cx} ${cy} L ${p(r1, a0)} A ${r1} ${r1} 0 ${large} 1 ${p(r1, a1)} Z`;
  return `M ${p(r0, a0)} L ${p(r1, a0)} A ${r1} ${r1} 0 ${large} 1 ${p(r1, a1)} L ${p(r0, a1)} A ${r0} ${r0} 0 ${large} 0 ${p(r0, a0)} Z`;
}
const AREA = [C.foundation, C.navy, C.navy, C.navy, C.blue, C.blue, C.blue, C.teal, C.teal, C.teal];
const SCORES = [0.55, 0.72, 0.46, 0.6, 0.82, 0.5, 0.66, 0.4, 0.76, 0.58];
// The clean BOSS wheel: all areas muted, the weakest one red and labelled.
function wheel(size, focus = 7) {
  const r = size / 2, R = r * 0.86, step = (Math.PI * 2) / 10, start = -Math.PI / 2 - step / 2;
  let s = "";
  for (let i = 0; i < 10; i++) {
    const a0 = start + i * step, a1 = a0 + step;
    s += `<path d="${wedge(r, r, 0, R, a0, a1)}" fill="${AREA[i]}" opacity="0.1" stroke="${C.ground}" stroke-width="3"/>`;
    s += `<path d="${wedge(r, r, 0, R * SCORES[i], a0, a1)}" fill="${i === focus ? C.red : "#CBD5E1"}" stroke="${C.ground}" stroke-width="3"/>`;
  }
  for (const [g0, g1, col] of [[0, 1, C.foundation], [1, 4, C.navy], [4, 7, C.blue], [7, 10, C.teal]]) {
    s += `<path d="${wedge(r, r, R * 1.05, R * 1.14, start + g0 * step + 0.02, start + g1 * step - 0.02)}" fill="${col}" opacity="0.35"/>`;
  }
  const a = start + (focus + 0.5) * step, tip = R * SCORES[focus] + 26;
  const x = r + tip * Math.cos(a), y = r + tip * Math.sin(a), w = 176;
  s += `<rect x="${(x - w).toFixed(1)}" y="${(y - 4).toFixed(1)}" width="${w}" height="40" rx="20" fill="${C.redDeep}"/>`;
  s += `<text x="${(x - w / 2).toFixed(1)}" y="${(y + 22).toFixed(1)}" text-anchor="middle" font-family="Figtree" font-weight="700" font-size="18" fill="#fff">Your constraint</text>`;
  return `<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" style="overflow:visible">${s}</svg>`;
}

const accent = (t) => t.replace(/\*(.+?)\*/g, `<span style="color:${C.sky}">$1</span>`);
const css = (w, h) => `
@font-face { font-family: Figtree; src: url("${FONT}"); font-weight: 300 900; }
* { box-sizing: border-box; margin: 0; padding: 0; }
html, body { width: ${w}px; height: ${h}px; overflow: hidden; }
body { font-family: Figtree, sans-serif; background: ${C.ground}; position: relative; -webkit-font-smoothing: antialiased; color: ${C.ink}; }
.eyebrow { font-size: 22px; font-weight: 600; color: ${C.navy}; margin-bottom: 18px; }
.h-light { font-weight: 300; line-height: 1.06; letter-spacing: -0.015em; color: ${C.slate}; white-space: nowrap; }
.h-bold { font-weight: 700; line-height: 1.06; letter-spacing: -0.02em; color: ${C.ink}; white-space: nowrap; }
.body { font-size: 24px; line-height: 1.45; color: ${C.slate}; margin-top: 22px; }
.pill { display: inline-flex; align-items: center; gap: 10px; margin-top: 32px; padding: 15px 30px; border-radius: 999px; font-size: 22px; font-weight: 600; background: ${C.navy}; color: #fff; }
.note { font-size: 20px; font-weight: 500; color: ${C.slate}; margin-top: 14px; }
.by { display: flex; align-items: center; gap: 16px; }
.by img { width: 64px; height: 64px; border-radius: 50%; object-fit: cover; }
.name { font-size: 22px; font-weight: 700; }
.sub { font-size: 18px; font-weight: 500; color: ${C.slate}; margin-top: 2px; }
.bar { position: absolute; left: 0; right: 0; bottom: 0; height: 64px; background: #fff; border-top: 1px solid ${C.line}; display: flex; align-items: center; justify-content: space-between; padding: 0 72px; font-size: 19px; font-weight: 600; color: ${C.ink}; }
.bar span { color: ${C.slate}; font-weight: 500; }
`;

// Liked headlines for the BOSS Score card: light line(s), then a bold line with one *blue* word.
const HEADLINES = {
  oneThing: { light: ["Find the one thing"], bold: "holding you *back.*" },
  constraint: { light: ["Every business has", "one constraint."], bold: "Find *yours.*" },
};

const scoreCopy = (size, { free, headline = HEADLINES.oneThing }) => `
  <div class="eyebrow">${COACH.eyebrow}</div>
  ${headline.light.map((l) => `<div class="h-light" style="font-size:${size}px">${l}</div>`).join("")}
  <div class="h-bold" style="font-size:${size}px">${headline.bold}</div>
  <div class="pill">${free ? "Get your free BOSS Score" : "Get your BOSS Score"} <span style="font-weight:400">→</span></div>
  <div class="note">${free ? "13 quick questions. About 3 minutes." : "Free. 13 quick questions."}</div>`;

function cards(photo) {
  const byline = (sub) => `<div class="by"><img src="${photo}"><div><div class="name">${COACH.name}</div><div class="sub">${sub}</div></div></div>`;
  const W = 1200, H = 627;
  return [
    { name: "1a BOSS Score - with coach", w: W, h: H, body: `
      <div style="position:absolute; left:72px; top:96px">${scoreCopy(70, { free: true })}</div>
      <div style="position:absolute; right:40px; top:94px">${wheel(440)}</div>
      <div style="position:absolute; left:72px; bottom:44px">${byline(COACH.scoreUrl)}</div>` },
    { name: "1b BOSS Score - bar at the bottom", w: W, h: H, body: `
      <div style="position:absolute; left:72px; top:50%; transform:translateY(-58%)">${scoreCopy(70, { free: true })}</div>
      <div style="position:absolute; right:40px; top:64px">${wheel(420)}</div>
      <div class="bar">${COACH.name}<span>${COACH.scoreUrl}</span></div>` },
    { name: "1c BOSS Score - clean", w: W, h: H, body: `
      <div style="position:absolute; left:72px; top:50%; transform:translateY(-50%)">${scoreCopy(72, { free: true })}</div>
      <div style="position:absolute; right:40px; top:94px">${wheel(440)}</div>` },
    { name: "1d BOSS Score - square post", w: 1080, h: 1080, body: `
      <div style="position:absolute; left:84px; top:96px">${scoreCopy(76, { free: true })}</div>
      <div style="position:absolute; left:50%; transform:translateX(-50%); top:500px">${wheel(500)}</div>` },
    { name: "1e BOSS Score - one constraint, clean", w: W, h: H, body: `
      <div style="position:absolute; left:72px; top:50%; transform:translateY(-50%)">${scoreCopy(66, { free: true, headline: HEADLINES.constraint })}</div>
      <div style="position:absolute; right:40px; top:94px">${wheel(440)}</div>` },
    { name: "1f BOSS Score - one constraint, square post", w: 1080, h: 1080, body: `
      <div style="position:absolute; left:84px; top:84px">${scoreCopy(72, { free: true, headline: HEADLINES.constraint })}</div>
      <div style="position:absolute; left:50%; transform:translateX(-50%); top:560px">${wheel(450)}</div>` },
    { name: "3a Director School - centred", w: W, h: H, body: `
      <div style="position:absolute; left:72px; top:50%; transform:translateY(-50%)">
        <div class="eyebrow">${COACH.business}</div>
        <div class="h-light" style="font-size:64px">Grow profit,</div>
        <div class="h-bold" style="font-size:64px">not just *turnover.*</div>
        <div class="body" style="max-width:700px">Advice for UK manufacturing owners, £1m to £20m.<br>40 years starting, running and turning round businesses.</div>
        <div style="margin-top:34px"><div class="name">${COACH.name}</div><div class="sub">${COACH.title} · ${COACH.website}</div></div>
      </div>
      <img src="${photo}" style="position:absolute; right:72px; top:50%; transform:translateY(-50%); width:320px; height:320px; border-radius:50%; object-fit:cover; border:6px solid #fff; box-shadow:0 10px 30px rgba(15,23,42,.10)">` },
    { name: "3b Director School - photo card", w: W, h: H, body: `
      <div style="position:absolute; left:72px; top:50%; transform:translateY(-50%)">
        <div class="eyebrow">${COACH.business}</div>
        <div class="h-light" style="font-size:64px">Grow profit,</div>
        <div class="h-bold" style="font-size:64px">not just *turnover.*</div>
        <div class="body" style="max-width:640px; font-size:23px">Advice for UK manufacturing owners, £1m to £20m.<br>40 years starting, running and turning round businesses.</div>
      </div>
      <div style="position:absolute; right:64px; top:64px; width:410px; height:499px; border-radius:24px; overflow:hidden; background:#fff; box-shadow:0 12px 36px rgba(15,23,42,.10)">
        <img src="${photo}" style="display:block; width:410px; height:389px; object-fit:cover; object-position:50% 30%">
        <div style="height:100px; padding:18px 24px"><div class="name">${COACH.name}</div><div class="sub">${COACH.title}</div><div class="sub">${COACH.website}</div></div>
      </div>` },
  ];
}

const photoBuf = Buffer.from(await (await fetch(COACH.photo)).arrayBuffer());
const photo = `data:image/png;base64,${photoBuf.toString("base64")}`;
const browser = await chromium.launch();
for (const card of cards(photo)) {
  const page = await browser.newPage({ viewport: { width: card.w, height: card.h }, deviceScaleFactor: 2 });
  await page.setContent(`<!doctype html><html><head><style>${css(card.w, card.h)}</style></head><body>${accent(card.body)}</body></html>`);
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: join(OUT, `${card.name}.png`) });
  await page.close();
  console.log("rendered", card.name);
}
await browser.close();
