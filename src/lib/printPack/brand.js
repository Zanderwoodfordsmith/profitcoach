// Shared brand primitives for the print pack: colours, fonts, logo, smiley faces, text helpers.
// Data (questions, areas, playbooks, score colours) comes straight from src/lib so it never drifts.
import { LOGO_COLOUR, LOGO_WHITE } from "./generated.js";
import * as Q from "../bossScorecardQuestions";
import * as D from "../bossData";
import * as SC from "../bossScorecardColors";

export { Q, D };

export const C = {
  ink: "#0d1f31",
  slate: "#46566b",
  muted: "#5b6b80",
  faint: "#9aa7b6",
  line: "#e3e8ef",
  lineStrong: "#cbd4df",
  mist: "#eef4fa",
  vision: Q.PILLAR_ACCENT_COLORS.vision,
  velocity: Q.PILLAR_ACCENT_COLORS.velocity,
  value: Q.PILLAR_ACCENT_COLORS.value,
  foundation: D.BOSS_FOUNDATION_COLOR,
  lensNavy: "#1f3a66",
  face: "#171717",
};
/** Brand signature gradient (PRODUCT.md), as SVG stops. */
export const BRAND_GRADIENT = [
  [0, "#051e36"],
  [0.48, "#0c5290"],
  [1, "#1a8fd4"],
];
export const SAT = SC.BOSS_SCORE_SATURATED;
export const PASTEL = SC.BOSS_SCORE_PASTEL;
export const LABELS = Q.SMILEY_LABELS;

export const F_DISPLAY = "'Inter Tight', Inter, 'Helvetica Neue', Arial, sans-serif";
export const F_BODY = "Inter, 'Helvetica Neue', Arial, sans-serif";
export const F_HAND = "'Caveat', 'Bradley Hand', 'Comic Sans MS', cursive";
export const F_MARKER = "'Permanent Marker', 'Marker Felt', 'Comic Sans MS', cursive";
export const GOOGLE_FONTS_HREF =
  "https://fonts.googleapis.com/css2?family=Inter+Tight:wght@500;600;700&family=Inter:ital,wght@0,400;0,500;0,600;1,400&family=Caveat:wght@500;700&family=Permanent+Marker&display=swap";

export const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
export const n2 = (n) => (Math.round(n * 100) / 100).toFixed(2);

export function svgDoc({ w, h, viewBox, title, body, unit = "" }) {
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${w}${unit}" height="${h}${unit}" viewBox="${viewBox}">
<title>${esc(title)}</title>
<style>@import url('${GOOGLE_FONTS_HREF.replace(/&/g, "&amp;")}');</style>
${body}
</svg>
`;
}

/** Nest one graphic's body inside another at x,y,w,h. */
export function place(graphic, x, y, w, h = w) {
  return `<svg x="${n2(x)}" y="${n2(y)}" width="${n2(w)}" height="${n2(h)}" viewBox="${graphic.viewBox}">${graphic.body}</svg>`;
}

export function gradientDef(id, { x1 = 0.37, y1 = 0, x2 = 0.63, y2 = 1 } = {}) {
  const stops = BRAND_GRADIENT.map(([o, c]) => `<stop offset="${o}" stop-color="${c}"/>`).join("");
  return `<linearGradient id="${id}" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}">${stops}</linearGradient>`;
}

// ---------- Logo ----------
const LOGO = { colour: LOGO_COLOUR, white: LOGO_WHITE };
const LOGO_VB = [137.87, 139.52, 1487.82, 222.14];
export const LOGO_ASPECT = LOGO_VB[2] / LOGO_VB[3];
export function logo(x, y, width, idp, variant = "colour") {
  const h = width / LOGO_ASPECT;
  const inner = LOGO[variant].replace(/id="([^"]+)"/g, `id="${idp}-logo-$1"`);
  return `<svg x="${n2(x)}" y="${n2(y)}" width="${n2(width)}" height="${n2(h)}" viewBox="${LOGO_VB.join(" ")}">${inner}</svg>`;
}

// ---------- Smiley faces (same mouths as SmileyRatingScale.tsx) ----------
const MOUTH = {
  1: "M 9 28 Q 20 18 31 28",
  2: "M 12 26 Q 20 22 28 26",
  3: "M 12 28 L 28 28",
  4: "M 12 27 Q 20 31 28 27",
  5: "M 9 28 Q 20 38 31 28",
};
export function face(score, cx, cy, size, color = C.face) {
  const s = size / 40;
  return `<g transform="translate(${n2(cx - 20 * s)} ${n2(cy - 20 * s)}) scale(${n2(s)})"><circle cx="14" cy="15" r="2.8" fill="${color}"/><circle cx="26" cy="15" r="2.8" fill="${color}"/><path d="${MOUTH[score]}" fill="none" stroke="${color}" stroke-width="2.5" stroke-linecap="round"/></g>`;
}

// ---------- Text ----------
/** Greedy wrap using an average glyph width (Inter is ~0.5em per character on mixed text). */
export function wrap(text, fontSize, maxWidth, factor = 0.5) {
  const maxChars = Math.floor(maxWidth / (fontSize * factor));
  const lines = [];
  let cur = "";
  for (const w of text.split(/\s+/)) {
    const next = cur ? `${cur} ${w}` : w;
    if (next.length > maxChars && cur) {
      lines.push(cur);
      cur = w;
    } else cur = next;
  }
  if (cur) lines.push(cur);
  return lines;
}

export function text(x, y, str, { size, weight = 400, fill = C.ink, family = F_BODY, anchor = "start", tracking = 0, opacity = 1, italic = false, extra = "" } = {}) {
  return `<text x="${n2(x)}" y="${n2(y)}"${anchor !== "start" ? ` text-anchor="${anchor}"` : ""} font-family="${family}" font-size="${size}" font-weight="${weight}"${italic ? ` font-style="italic"` : ""}${tracking ? ` letter-spacing="${tracking}"` : ""} fill="${fill}"${opacity < 1 ? ` fill-opacity="${opacity}"` : ""}${extra}>${esc(str)}</text>`;
}

/** Arc path for textPath around (cx,cy); reversed on the lower half so text reads upright. */
export function arcPath(cx, cy, r, a1deg, a2deg, isLower) {
  const a1 = (a1deg * Math.PI) / 180;
  const a2 = (a2deg * Math.PI) / 180;
  const p1 = { x: cx + r * Math.cos(a1), y: cy + r * Math.sin(a1) };
  const p2 = { x: cx + r * Math.cos(a2), y: cy + r * Math.sin(a2) };
  const large = Math.abs(a2deg - a1deg) > 180 ? 1 : 0;
  return isLower
    ? `M ${n2(p2.x)} ${n2(p2.y)} A ${r} ${r} 0 ${large} 0 ${n2(p1.x)} ${n2(p1.y)}`
    : `M ${n2(p1.x)} ${n2(p1.y)} A ${r} ${r} 0 ${large} 1 ${n2(p2.x)} ${n2(p2.y)}`;
}

/** Curved label visually centred on radius r. Angles in degrees, 0 = 3 o'clock, clockwise. */
export function arcLabel({ id, cx, cy, r, aCenter, span, str, size, weight = 600, fill = C.ink, family = F_DISPLAY, tracking = 0, opacity = 1 }) {
  const isLower = Math.sin((aCenter * Math.PI) / 180) > 0.05;
  const rb = isLower ? r + size * 0.36 : r - size * 0.36;
  return `<path id="${id}" d="${arcPath(cx, cy, rb, aCenter - span / 2, aCenter + span / 2, isLower)}" fill="none"/>` +
    `<text font-family="${family}" font-size="${size}" font-weight="${weight}" fill="${fill}"${tracking ? ` letter-spacing="${tracking}"` : ""}${opacity < 1 ? ` fill-opacity="${opacity}"` : ""}><textPath xlink:href="#${id}" href="#${id}" startOffset="50%" text-anchor="middle">${esc(str)}</textPath></text>`;
}

/** Annular wedge between radii r0..r1 and angles a0..a1 (radians). */
export function wedge(cx, cy, r0, r1, a0, a1) {
  const p = (r, a) => `${n2(cx + r * Math.cos(a))} ${n2(cy + r * Math.sin(a))}`;
  const large = a1 - a0 > Math.PI ? 1 : 0;
  if (r0 <= 0) return `M ${n2(cx)} ${n2(cy)} L ${p(r1, a0)} A ${r1} ${r1} 0 ${large} 1 ${p(r1, a1)} Z`;
  return `M ${p(r1, a0)} A ${r1} ${r1} 0 ${large} 1 ${p(r1, a1)} L ${p(r0, a1)} A ${r0} ${r0} 0 ${large} 0 ${p(r0, a0)} Z`;
}

/** Small deterministic RNG so hand-drawn pieces look the same on every build. */
export function rng(seed = 1) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ---------- Scorecard data, shaped for print ----------
/** Group per question, following the compass (VENN_PETAL_QUESTIONS) so colours match the circle. */
export function scorecardRows({ outcomeNumbering = "sequential" } = {}) {
  const groupOf = (id) => {
    if (id === "q1") return "foundation";
    for (const [pillar, ids] of Object.entries(Q.VENN_PETAL_QUESTIONS)) if (ids.includes(id)) return pillar;
    return "outcome";
  };
  let outcomeIdx = 0;
  return Q.SCORECARD_QUESTIONS.map((q) => {
    let n = String(q.step);
    if (q.outcomesGroup) {
      n = outcomeNumbering === "sequential" ? String(11 + outcomeIdx) : q.id.slice(1);
      outcomeIdx += 1;
    }
    return { id: q.id, n, area: q.areaName, group: groupOf(q.id), q: q.question };
  });
}
export const GROUP_COLOR = {
  foundation: C.foundation,
  vision: C.vision,
  velocity: C.velocity,
  value: C.value,
  outcome: C.lensNavy,
};
export const GROUP_NAME = {
  foundation: "Owner",
  vision: "Vision",
  velocity: "Velocity",
  value: "Value",
  outcome: "Outcomes",
};
