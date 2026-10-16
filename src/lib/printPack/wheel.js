// BOSS Wheel (BOSS Pro / full diagnostic): 10 areas, each scored 1 to 10, total out of 100.
// Areas, colours and level bands come from src/lib (bossData, insightEngine thresholds).
import { C, D, SAT, F_DISPLAY, F_BODY, esc, n2, arcLabel, wedge } from "./brand.js";

const cx = 500;
const cy = 500;
const GAP = 0.018; // radians either side of each segment

export const PILLAR_OF = D.AREAS.map((a) => a.pillar);
export const PILLAR_COLOR = { foundation: C.foundation, vision: C.vision, velocity: C.velocity, value: C.value };
/** Deeper pillar shades (the "darker" steps of WHEEL_COLORS) so white text on the thick band stays readable. */
export const BAND_COLOR = { foundation: D.WHEEL_COLORS[0], vision: D.WHEEL_COLORS[2], velocity: D.WHEEL_COLORS[4], value: D.WHEEL_COLORS[7] };
export const PILLAR_LABEL = { foundation: "FOUNDATION", vision: "VISION", velocity: "VELOCITY", value: "VALUE" };
export const PILLAR_GROUPS = [["foundation", [0]], ["vision", [1, 2, 3]], ["velocity", [4, 5, 6]], ["value", [7, 8, 9]]];

/** Level bands from getOverallLevel (src/lib/insightEngine.ts). */
export function levelFor(total) {
  if (total <= 20) return { level: 1, name: "Overwhelm" };
  if (total <= 40) return { level: 2, name: "Overworked" };
  if (total <= 60) return { level: 3, name: "Organised" };
  if (total <= 80) return { level: 4, name: "Overseer" };
  return { level: 5, name: "Owner" };
}

/** Illustrative area scores (AREAS order). Sums to 58, which is Level 3, Organised. */
export const EXAMPLE_AREA_SCORES = [6, 5, 7, 4, 7, 5, 6, 7, 5, 6];

const N = D.AREAS.length;
const STEP = (2 * Math.PI) / N;
const START = -Math.PI / 2;
const segAngles = (i, gap = GAP) => [START + i * STEP + gap, START + (i + 1) * STEP - gap, START + (i + 0.5) * STEP];

/** Score area of one segment: base, fill to score, thin rings, numbers (blank) or score label (filled). */
function scoreSegment({ i, score, blank, R0, RING, fill }) {
  const [a0, a1, mid] = segAngles(i);
  const R10 = R0 + RING * 10;
  let s = `<path d="${wedge(cx, cy, R0, R10, a0, a1)}" fill="${blank ? "#ffffff" : C.mist}" stroke="${C.lineStrong}" stroke-width="1"/>`;
  if (score != null && score > 0) s += `<path d="${wedge(cx, cy, R0, R0 + RING * score, a0, a1)}" fill="${fill}"/>`;
  for (let k = 1; k < 10; k++) {
    const r = R0 + RING * k;
    const inFill = score != null && k < score;
    s += `<path d="M ${n2(cx + r * Math.cos(a0))} ${n2(cy + r * Math.sin(a0))} A ${r} ${r} 0 0 1 ${n2(cx + r * Math.cos(a1))} ${n2(cy + r * Math.sin(a1))}" fill="none" stroke="${inFill ? "#ffffff" : C.lineStrong}" stroke-opacity="${inFill ? 0.35 : 0.9}" stroke-width="${k === 5 ? 1.3 : 0.8}"/>`;
  }
  if (blank) {
    for (let k = 1; k <= 10; k++) {
      const r = R0 + RING * (k - 0.5);
      s += `<text x="${n2(cx + r * Math.cos(mid))}" y="${n2(cy + r * Math.sin(mid) + 4)}" text-anchor="middle" font-family="${F_BODY}" font-size="11" font-weight="600" fill="${C.slate}" fill-opacity="0.65">${k}</text>`;
    }
  } else if (score != null) {
    const low = score < 2.5;
    const r = low ? R0 + RING * score + 20 : R0 + RING * score - 20;
    s += `<text x="${n2(cx + r * Math.cos(mid))}" y="${n2(cy + r * Math.sin(mid) + 8)}" text-anchor="middle" font-family="${F_DISPLAY}" font-size="23" font-weight="700" fill="${low ? C.ink : "#ffffff"}">${Number.isInteger(score) ? score : score.toFixed(1)}</text>`;
  }
  return s;
}

function hubSvg(scores, R_HUB) {
  let s = `<circle cx="${cx}" cy="${cy}" r="${R_HUB}" fill="#ffffff" stroke="${C.lineStrong}" stroke-width="1"/>`;
  if (scores) {
    const total = Math.round(scores.reduce((a, b) => a + b, 0));
    const lvl = levelFor(total);
    s += `<text x="${cx}" y="${cy + 6}" text-anchor="middle" font-family="${F_DISPLAY}" font-size="62" font-weight="700" letter-spacing="-1.5" fill="${C.ink}">${total}</text>`;
    s += `<text x="${cx}" y="${cy + 32}" text-anchor="middle" font-family="${F_BODY}" font-size="14" font-weight="600" fill="${C.muted}">out of 100</text>`;
    const label = `Level ${lvl.level} · ${lvl.name}`;
    const half = (label.length * 13 * 0.55 + 14) / 2; // dot + gap + text, centred in the hub
    s += `<circle cx="${n2(cx - half + 5)}" cy="${cy + 54}" r="5" fill="${SAT[lvl.level]}"/>`;
    s += `<text x="${n2(cx - half + 14)}" y="${cy + 59}" font-family="${F_BODY}" font-size="13" font-weight="600" fill="${C.ink}">${esc(label)}</text>`;
  } else {
    s += `<text x="${cx}" y="${cy - 26}" text-anchor="middle" font-family="${F_BODY}" font-size="11" font-weight="600" letter-spacing="2.2" fill="${C.muted}">YOUR BOSS SCORE</text>`;
    s += `<line x1="${cx - 50}" y1="${cy + 22}" x2="${cx + 6}" y2="${cy + 22}" stroke="${C.ink}" stroke-width="1.5"/>`;
    s += `<text x="${cx + 12}" y="${cy + 20}" font-family="${F_DISPLAY}" font-size="24" font-weight="600" fill="${C.ink}">/100</text>`;
  }
  return s;
}

/**
 * Thick coloured band with the area names in white, then a lighter outer band carrying the pillar names.
 * Works around any centre (the playbook map reuses it).
 */
export function areaPillarBands({ cx: x = cx, cy: y = cy, r0, r1, p0, p1, idp, areaSize = 17, pillarSize = 14, gap = GAP }) {
  let s = "";
  for (let i = 0; i < N; i++) {
    const a0 = START + i * STEP + gap, a1 = START + (i + 1) * STEP - gap;
    const pillar = PILLAR_OF[i];
    s += `<path d="${wedge(x, y, r0, r1, a0, a1)}" fill="${BAND_COLOR[pillar]}"/>`;
    const midDeg = ((START + (i + 0.5) * STEP) * 180) / Math.PI;
    s += arcLabel({ id: `${idp}-ab${i}`, cx: x, cy: y, r: (r0 + r1) / 2, aCenter: midDeg, span: 35, str: D.AREAS[i].name, size: areaSize, weight: 600, fill: "#ffffff" });
  }
  for (const [pillar, idx] of PILLAR_GROUPS) {
    const a0 = START + idx[0] * STEP + gap;
    const a1 = START + (idx[idx.length - 1] + 1) * STEP - gap;
    s += `<path d="${wedge(x, y, p0, p1, a0, a1)}" fill="${BAND_COLOR[pillar]}" fill-opacity="0.14"/>`;
    const d0 = (a0 * 180) / Math.PI, d1 = (a1 * 180) / Math.PI;
    s += arcLabel({ id: `${idp}-pb-${pillar}`, cx: x, cy: y, r: (p0 + p1) / 2, aCenter: (d0 + d1) / 2, span: d1 - d0 - 2, str: PILLAR_LABEL[pillar], size: pillarSize, weight: 700, fill: BAND_COLOR[pillar], family: F_BODY, tracking: 3.5 });
  }
  return s;
}

/**
 * Open style (thin pillar band, names outside).
 * scores: null for a blank print wheel (rings + numbers to colour in), or 10 numbers 0-10.
 * palette: "area" = app WHEEL_COLORS (darker/main/lighter inside each pillar), "pillar" = one colour per pillar.
 */
export function bossWheel({ scores = null, idp, palette = "area", hub = true }) {
  const R0 = 112, RING = 26;
  const BAND0 = R0 + RING * 10 + 10, BAND1 = BAND0 + 12;
  const fillColor = (i) => (palette === "pillar" ? PILLAR_COLOR[PILLAR_OF[i]] : D.WHEEL_COLORS[i]);
  let s = "";
  for (let i = 0; i < N; i++) {
    const [a0, a1, mid] = segAngles(i);
    s += scoreSegment({ i, score: scores?.[i] ?? null, blank: !scores, R0, RING, fill: fillColor(i) });
    s += `<path d="${wedge(cx, cy, BAND0, BAND1, a0, a1)}" fill="${PILLAR_COLOR[PILLAR_OF[i]]}"/>`;
    s += arcLabel({ id: `${idp}-a${i}`, cx, cy, r: BAND1 + 22, aCenter: (mid * 180) / Math.PI, span: 35, str: D.AREAS[i].name, size: 16.5, weight: 600, fill: C.ink });
  }
  for (const [pillar, idx] of PILLAR_GROUPS) {
    const a0 = ((START + idx[0] * STEP) * 180) / Math.PI;
    const a1 = ((START + (idx[idx.length - 1] + 1) * STEP) * 180) / Math.PI;
    s += arcLabel({ id: `${idp}-p-${pillar}`, cx, cy, r: BAND1 + 54, aCenter: (a0 + a1) / 2, span: a1 - a0 - 4, str: PILLAR_LABEL[pillar], size: 12.5, weight: 600, fill: PILLAR_COLOR[pillar], family: F_BODY, tracking: 3 });
  }
  if (hub) s += hubSvg(scores, 96);
  return { body: `<g id="${idp}-wheel">${s}</g>`, viewBox: "0 0 1000 1000", w: 1000, h: 1000 };
}

/** Banded style: thick colour band with area names inside it, lighter pillar band around that. */
export function bossWheelBanded({ scores = null, idp, hub = true }) {
  const R0 = 110, RING = 25; // score 10 at 360
  const r0 = 368, r1 = 428, p0 = 434, p1 = 476;
  let s = "";
  for (let i = 0; i < N; i++) s += scoreSegment({ i, score: scores?.[i] ?? null, blank: !scores, R0, RING, fill: D.WHEEL_COLORS[i] });
  s += areaPillarBands({ r0, r1, p0, p1, idp });
  if (hub) s += hubSvg(scores, 94);
  return { body: `<g id="${idp}-wheel">${s}</g>`, viewBox: "14 14 972 972", w: 972, h: 972 };
}
