// The Profit System roadmap: Owner Performance as the foundation, then the 9 steps across
// Vision, Velocity and Value. Replaces the old BCA "9 Step Roadmap" pop-up banner.
// Step names come from bossData AREAS; "from -> to" lines and pillar taglines are read
// from src/lib/profitSystemCopy.ts (shared with profitSystemData) so they never drift.
import { C, D, F_DISPLAY, F_BODY, esc, n2, svgDoc, logo, place, gradientDef, wrap } from "./brand.js";
import { icon, AREA_ICON } from "./icons.js";
import { bossWheelBanded, EXAMPLE_AREA_SCORES, BAND_COLOR } from "./wheel.js";
import { qrBlock } from "./scorecard.js";
import { AREA_TRANSFORMATIONS, PILLAR_TAGLINES } from "../profitSystemCopy";

const TRANSFORM = { ...AREA_TRANSFORMATIONS };
const TAGLINE = PILLAR_TAGLINES;
// Owner Performance has no transformation line in the app data yet. New copy, flagged for approval.
TRANSFORM[0] = { from: "Reacting all day", to: "Leading on purpose" };

const PILLAR_TINT = { foundation: "#eef2f6", vision: "#e8f0f8", velocity: "#eaf4fd", value: "#e7f5f9" };
const STEPS = D.AREAS.map((a) => ({ id: a.id, name: a.name, pillar: a.pillar, ...TRANSFORM[a.id] }));

/** One roadmap row: number badge, ribbon with icon, name and from -> to line. */
function stepRow(step, x, y, w, h) {
  const dark = BAND_COLOR[step.pillar];
  const badgeW = h * 1.18;
  const tip = h * 0.32;
  let s = "";
  // Ribbon with a pointed end, echoing the original banner
  s += `<path d="M ${n2(x + badgeW - 12)} ${n2(y)} H ${n2(x + w - tip)} L ${n2(x + w)} ${n2(y + h / 2)} L ${n2(x + w - tip)} ${n2(y + h)} H ${n2(x + badgeW - 12)} Z" fill="${PILLAR_TINT[step.pillar]}"/>`;
  s += `<rect x="${n2(x)}" y="${n2(y)}" width="${n2(badgeW)}" height="${n2(h)}" rx="${n2(h * 0.16)}" fill="${dark}"/>`;
  const isFoundation = step.id === 0;
  s += `<text x="${n2(x + badgeW / 2)}" y="${n2(y + h * 0.3)}" text-anchor="middle" font-family="${F_BODY}" font-size="${n2(h * 0.14)}" font-weight="600" letter-spacing="${n2(h * 0.025)}" fill="#ffffff" fill-opacity="0.75">${isFoundation ? "BASE" : "STEP"}</text>`;
  s += `<text x="${n2(x + badgeW / 2)}" y="${n2(y + h * 0.78)}" text-anchor="middle" font-family="${F_DISPLAY}" font-size="${n2(h * 0.46)}" font-weight="700" fill="#ffffff">${isFoundation ? "0" : String(step.id).padStart(2, "0")}</text>`;
  const ix = x + badgeW + h * 0.22;
  s += icon(AREA_ICON[step.id], ix, y + h * 0.28, h * 0.44, dark, 1.8);
  const tx = ix + h * 0.66;
  s += `<text x="${n2(tx)}" y="${n2(y + h * 0.45)}" font-family="${F_DISPLAY}" font-size="${n2(h * 0.3)}" font-weight="600" fill="${C.ink}">${esc(step.name)}</text>`;
  // from (muted) -> to (bold), with a drawn arrow
  const fs1 = h * 0.21;
  const fromW = step.from.length * fs1 * 0.58;
  const ay = y + h * 0.77;
  s += `<text x="${n2(tx)}" y="${n2(ay)}" font-family="${F_BODY}" font-size="${n2(fs1)}" fill="${C.muted}">${esc(step.from)}</text>`;
  const ax = tx + fromW + fs1 * 0.5;
  s += `<path d="M ${n2(ax)} ${n2(ay - fs1 * 0.33)} H ${n2(ax + fs1 * 1.1)} M ${n2(ax + fs1 * 0.75)} ${n2(ay - fs1 * 0.62)} L ${n2(ax + fs1 * 1.1)} ${n2(ay - fs1 * 0.33)} L ${n2(ax + fs1 * 0.75)} ${n2(ay - fs1 * 0.04)}" fill="none" stroke="${dark}" stroke-width="${n2(fs1 * 0.11)}" stroke-linecap="round" stroke-linejoin="round"/>`;
  s += `<text x="${n2(ax + fs1 * 1.5)}" y="${n2(ay)}" font-family="${F_BODY}" font-size="${n2(fs1)}" font-weight="600" fill="${dark}">${esc(step.to)}</text>`;
  return s;
}

function pillarLabel(pillar, x, y, size) {
  const name = pillar.toUpperCase();
  return `<text x="${n2(x)}" y="${n2(y)}" font-family="${F_BODY}" font-size="${size}" font-weight="700" letter-spacing="${n2(size * 0.18)}" fill="${BAND_COLOR[pillar]}">${name}<tspan font-weight="500" letter-spacing="0" fill="${C.slate}" dx="${n2(size * 0.7)}">${esc(TAGLINE[pillar] ?? "")}</tspan></text>`;
}

/** Rows for foundation + 9 steps with pillar labels between groups. Returns { svg, bottom }. */
function stepList(x, y, w, rowH, gap, labelH, { labels = true } = {}) {
  let s = "", cy = y, last = null;
  for (const step of STEPS) {
    if (labels && step.pillar !== last && step.pillar !== "foundation") {
      s += pillarLabel(step.pillar, x, cy + labelH * 0.62, labelH * 0.42);
      cy += labelH;
    } else if (labels && step.pillar === "foundation") {
      s += `<text x="${n2(x)}" y="${n2(cy + labelH * 0.62)}" font-family="${F_BODY}" font-size="${n2(labelH * 0.42)}" font-weight="700" letter-spacing="${n2(labelH * 0.076)}" fill="${BAND_COLOR.foundation}">FOUNDATION<tspan font-weight="500" letter-spacing="0" fill="${C.slate}" dx="${n2(labelH * 0.3)}">You, the owner</tspan></text>`;
      cy += labelH;
    }
    last = step.pillar;
    s += stepRow(step, x, cy, w, rowH);
    cy += rowH + gap;
  }
  return { svg: s, bottom: cy };
}

/** 850 x 2000 mm pull-up banner (1 unit = 1 mm). */
export function nineStepBanner({ idp = "ns", coach = null } = {}) {
  const W = 850, H = 2000;
  let s = `<defs>${gradientDef(`${idp}-g`)}<clipPath id="${idp}-clip"><rect width="${W}" height="${H}"/></clipPath></defs>`;
  s += `<g clip-path="url(#${idp}-clip)"><rect width="${W}" height="${H}" fill="#ffffff"/>`;
  s += `<rect width="${W}" height="500" fill="url(#${idp}-g)"/>`;
  s += `<circle cx="690" cy="300" r="262" fill="#ffffff"/>`;
  s += place(bossWheelBanded({ scores: EXAMPLE_AREA_SCORES, idp: `${idp}-w` }), 438, 48, 504);
  s += `</g>`;
  s += logo(60, 70, 300, idp, "white");
  s += `<text x="60" y="250" font-family="${F_DISPLAY}" font-size="78" font-weight="600" letter-spacing="-1.8" fill="#ffffff">The Profit</text>`;
  s += `<text x="60" y="334" font-family="${F_DISPLAY}" font-size="78" font-weight="600" letter-spacing="-1.8" fill="#ffffff">System</text>`;
  s += `<text x="60" y="398" font-family="${F_BODY}" font-size="27" fill="#ffffff" fill-opacity="0.85">Nine steps. Three pillars.</text>`;
  s += `<text x="60" y="434" font-family="${F_BODY}" font-size="27" fill="#ffffff" fill-opacity="0.85">Built on you, the owner.</text>`;
  const list = stepList(60, 548, 730, 84, 10, 48, { idp });
  s += list.svg;
  // Footer
  const fy = 1760;
  s += `<line x1="60" y1="${fy - 24}" x2="790" y2="${fy - 24}" stroke="${C.line}" stroke-width="2"/>`;
  s += `<text x="60" y="${fy + 40}" font-family="${F_DISPLAY}" font-size="40" font-weight="600" letter-spacing="-0.6" fill="${C.ink}">Where is your business</text>`;
  s += `<text x="60" y="${fy + 88}" font-family="${F_DISPLAY}" font-size="40" font-weight="600" letter-spacing="-0.6" fill="${C.ink}">on the nine steps?</text>`;
  s += `<text x="60" y="${fy + 134}" font-family="${F_BODY}" font-size="24" fill="${C.slate}">Take the free BOSS Scorecard to find out.</text>`;
  if (coach) {
    s += `<text x="60" y="${fy + 180}" font-family="${F_BODY}" font-size="22" font-weight="600" fill="${C.ink}">${esc(coach.name)}</text>`;
    s += `<text x="60" y="${fy + 212}" font-family="${F_BODY}" font-size="22" font-weight="600" fill="${C.vision}">${esc(coach.displayUrl)}</text>`;
  } else {
    s += `<text x="60" y="${fy + 180}" font-family="${F_BODY}" font-size="22" font-weight="600" fill="${C.muted}">Your coach  ·  Name  ·  link</text>`;
  }
  s += qrBlock(610, fy - 4, 180, coach);
  return svgDoc({ w: W, h: H, unit: "mm", viewBox: `0 0 ${W} ${H}`, title: coach ? `Profit System 9 steps banner (${coach.name})` : "Profit System 9 steps pull-up banner", body: s });
}

/** 1080 x 1350 social post version of the nine steps. */
export function nineStepPost({ idp = "np", coach = null } = {}) {
  const W = 1080, H = 1350;
  let s = `<rect width="${W}" height="${H}" fill="#ffffff"/>`;
  s += logo(70, 62, 250, idp);
  s += `<text x="70" y="196" font-family="${F_DISPLAY}" font-size="64" font-weight="600" letter-spacing="-1.6" fill="${C.ink}">The <tspan fill="${C.vision}">Profit System</tspan></text>`;
  s += `<text x="70" y="244" font-family="${F_BODY}" font-size="26" fill="${C.slate}">Nine steps. Three pillars. Built on you, the owner.</text>`;
  const list = stepList(70, 276, 940, 70, 8, 38, { idp });
  s += list.svg;
  if (coach) {
    s += `<text x="70" y="1290" font-family="${F_DISPLAY}" font-size="28" font-weight="600" fill="${C.ink}">Where is your business? <tspan fill="${C.vision}">${esc(coach.displayUrl)}</tspan></text>`;
  } else {
    s += `<text x="70" y="1290" font-family="${F_DISPLAY}" font-size="28" font-weight="600" fill="${C.ink}">Where is your business? Take the free BOSS Scorecard.</text>`;
  }
  return svgDoc({ w: W, h: H, viewBox: `0 0 ${W} ${H}`, title: coach ? `Profit System 9 steps post (${coach.name})` : "Profit System 9 steps post", body: s });
}

/**
 * Event pull-up (850 x 2000 mm): a winding road from you (Owner Performance) through
 * the nine steps to Level 5, Owner. Replaces the old "Event Name / Roadmap" banner.
 */
export function eventRoadmapBanner({ idp = "er", coach = null, eventName = null } = {}) {
  const W = 850, H = 2000;
  let s = `<defs>${gradientDef(`${idp}-g`)}<clipPath id="${idp}-clip"><rect width="${W}" height="${H}"/></clipPath></defs>`;
  s += `<rect width="${W}" height="${H}" fill="#ffffff"/>`;
  // Header
  s += `<g clip-path="url(#${idp}-clip)"><path d="M 0 0 H ${W} V 470 L 0 560 Z" fill="url(#${idp}-g)"/></g>`;
  s += logo(60, 66, 300, idp, "white");
  const ev = eventName ?? "Event name";
  s += `<text x="60" y="246" font-family="${F_DISPLAY}" font-size="${ev.length > 18 ? 58 : 76}" font-weight="600" letter-spacing="-1.6" fill="#ffffff"${eventName ? "" : ` fill-opacity="0.55"`}>${esc(ev)}</text>`;
  s += `<text x="60" y="314" font-family="${F_BODY}" font-size="28" fill="#ffffff" fill-opacity="0.85">${coach ? esc(`with ${coach.name}`) : "Date  ·  Venue"}</text>`;
  s += `<text x="60" y="640" font-family="${F_BODY}" font-size="22" font-weight="700" letter-spacing="4" fill="${C.vision}">THE PROFIT SYSTEM</text>`;
  s += `<text x="60" y="712" font-family="${F_DISPLAY}" font-size="66" font-weight="600" letter-spacing="-1.6" fill="${C.ink}">Your roadmap</text>`;

  // Winding road: three rows (one per pillar), turning at the ends
  const xL = 170, xR = 680, R = 140;
  const rows = [880, 1160, 1440];
  const road = `M 70 ${rows[0]} H ${xR} A ${R} ${R} 0 0 1 ${xR} ${rows[1]} H ${xL} A ${R} ${R} 0 0 0 ${xL} ${rows[2]} H 780`;
  s += `<path d="${road}" fill="none" stroke="#e3e8ef" stroke-width="34" stroke-linecap="round" stroke-linejoin="round"/>`;
  s += `<path d="${road}" fill="none" stroke="#ffffff" stroke-width="3" stroke-dasharray="14 14"/>`;
  // Start (you) and finish (Level 5)
  s += `<circle cx="70" cy="${rows[0]}" r="44" fill="${BAND_COLOR.foundation}"/>`;
  s += icon(AREA_ICON[0], 50, rows[0] - 20, 40, "#ffffff", 2);
  s += `<text x="70" y="${rows[0] - 66}" text-anchor="middle" font-family="${F_BODY}" font-size="20" font-weight="700" letter-spacing="2" fill="${BAND_COLOR.foundation}">START</text>`;
  s += `<text x="70" y="${rows[0] + 76}" text-anchor="middle" font-family="${F_DISPLAY}" font-size="20" font-weight="600" fill="${C.ink}">You</text>`;
  s += `<circle cx="780" cy="${rows[2]}" r="44" fill="#238BF7"/>`;
  s += icon("flag", 760, rows[2] - 20, 40, "#ffffff", 2);
  s += `<text x="780" y="${rows[2] + 76}" text-anchor="middle" font-family="${F_DISPLAY}" font-size="20" font-weight="600" fill="${C.ink}">Owner</text>`;
  s += `<text x="780" y="${rows[2] + 100}" text-anchor="middle" font-family="${F_BODY}" font-size="16" fill="${C.slate}">Level 5</text>`;

  const xs = [[230, 425, 620], [620, 425, 230], [230, 425, 620]];
  STEPS.filter((st) => st.id > 0).forEach((st, i) => {
    const r = Math.floor(i / 3), c = i % 3;
    const nx = xs[r][c], ny = rows[r];
    const dark = BAND_COLOR[st.pillar];
    s += `<circle cx="${nx}" cy="${ny}" r="56" fill="#ffffff" stroke="${dark}" stroke-width="7"/>`;
    s += icon(AREA_ICON[st.id], nx - 22, ny - 22, 44, dark, 2);
    s += `<circle cx="${nx + 42}" cy="${ny - 42}" r="19" fill="${dark}"/>`;
    s += `<text x="${nx + 42}" y="${ny - 35}" text-anchor="middle" font-family="${F_DISPLAY}" font-size="20" font-weight="700" fill="#ffffff">${st.id}</text>`;
    wrap(st.name, 21, 170, 0.5).forEach((line, li) => {
      s += `<text x="${nx}" y="${ny + 88 + li * 25}" text-anchor="middle" font-family="${F_DISPLAY}" font-size="21" font-weight="600" fill="${C.ink}">${esc(line)}</text>`;
    });
  });
  // Pillar tags at row ends
  // Pillar tag where each row starts (rows run left, right, left)
  ["vision", "velocity", "value"].forEach((p, r) => {
    const right = r === 1;
    s += `<text x="${right ? 676 : 174}" y="${rows[r] - 82}" text-anchor="${right ? "end" : "start"}" font-family="${F_BODY}" font-size="18" font-weight="700" letter-spacing="3" fill="${BAND_COLOR[p]}">${p.toUpperCase()}</text>`;
  });

  // Footer
  const fy = 1690;
  s += `<rect x="40" y="${fy}" width="770" height="250" rx="28" fill="#f6f8fb"/>`;
  s += `<text x="80" y="${fy + 78}" font-family="${F_DISPLAY}" font-size="38" font-weight="600" letter-spacing="-0.6" fill="${C.ink}">Where are you on</text>`;
  s += `<text x="80" y="${fy + 124}" font-family="${F_DISPLAY}" font-size="38" font-weight="600" letter-spacing="-0.6" fill="${C.ink}">the road?</text>`;
  s += `<text x="80" y="${fy + 168}" font-family="${F_BODY}" font-size="22" fill="${C.slate}">Scan for the free BOSS Scorecard.</text>`;
  s += `<text x="80" y="${fy + 208}" font-family="${F_BODY}" font-size="21" font-weight="600" fill="${coach ? C.vision : C.muted}">${coach ? esc(coach.displayUrl) : "Your link here"}</text>`;
  s += qrBlock(600, fy + 30, 190, coach);
  return svgDoc({ w: W, h: H, unit: "mm", viewBox: `0 0 ${W} ${H}`, title: coach ? `Event roadmap banner (${coach.name})` : "Event roadmap pull-up banner", body: s });
}
