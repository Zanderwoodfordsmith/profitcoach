// The 50 playbooks: 10 areas x 5 levels (src/lib/bossData.ts PLAYBOOKS, AREAS, LEVELS).
import { C, D, SAT, PASTEL, F_DISPLAY, F_BODY, esc, n2, arcLabel, wedge, svgDoc, logo, wrap } from "./brand.js";
import * as SC from "../bossScorecardColors";
import { areaPillarBands } from "./wheel.js";

const PILLAR_COLOR = { foundation: C.foundation, vision: C.vision, velocity: C.velocity, value: C.value };
const PILLAR_LABEL = { foundation: "FOUNDATION", vision: "VISION", velocity: "VELOCITY", value: "VALUE" };
const LEVEL_NAME = Object.fromEntries(D.LEVELS.map((l) => [l.id, l.name]));
const playbook = (area, level) => D.PLAYBOOKS.find((p) => p.area === area && p.level === level);
const DEEP = SC.BOSS_SCORE_SATURATED_DEEP;

/** Split a name into two balanced lines at a space. */
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

/**
 * Radial map: Level 1 in the middle ring, Level 5 on the outside.
 * style "open": thin pillar band, area names outside. "banded": thick colour band with the
 * area names inside it, and a lighter pillar band around that.
 */
export function playbookMap({ idp = "pm", style = "open" } = {}) {
  const banded = style === "banded";
  const cx = 600, cy = 600;
  const R_HUB = banded ? 138 : 150;
  const R0 = banded ? 152 : 166;
  const RW = banded ? 62 : 66;
  const R5 = R0 + RW * 5; // 496
  const BAND0 = R5 + 8, BAND1 = BAND0 + 12;
  const n = 10;
  const step = (2 * Math.PI) / n;
  const start = -Math.PI / 2;
  const GAP = 0.012;
  let s = "";

  for (let i = 0; i < n; i++) {
    const a0 = start + i * step + GAP;
    const a1 = start + (i + 1) * step - GAP;
    const mid = start + (i + 0.5) * step;
    const midDeg = (mid * 180) / Math.PI;
    const spanDeg = ((a1 - a0) * 180) / Math.PI;
    for (let lv = 1; lv <= 5; lv++) {
      const r0 = R0 + RW * (lv - 1), r1 = r0 + RW;
      s += `<path d="${wedge(cx, cy, r0 + 1.5, r1 - 1.5, a0, a1)}" fill="${PASTEL[lv]}" fill-opacity="${0.5 + lv * 0.08}"/>`;
      const pb = playbook(i, lv);
      const rMid = (r0 + r1) / 2;
      const size = 14;
      const arcLen = rMid * (a1 - a0);
      const fits = pb.name.length * size * 0.53 < arcLen * 0.86;
      const isLower = Math.sin(mid) > 0.05;
      const base = { cx, cy, aCenter: midDeg, span: spanDeg - 1, size, weight: 600, fill: C.ink, family: F_DISPLAY };
      if (fits) {
        s += arcLabel({ ...base, id: `${idp}-c${i}-${lv}`, r: rMid, str: pb.name });
      } else {
        const [l1, l2] = twoLines(pb.name);
        s += arcLabel({ ...base, id: `${idp}-c${i}-${lv}a`, r: isLower ? rMid - 9 : rMid + 9, str: l1 });
        s += arcLabel({ ...base, id: `${idp}-c${i}-${lv}b`, r: isLower ? rMid + 9 : rMid - 9, str: l2 });
      }
    }
    if (!banded) {
      s += `<path d="${wedge(cx, cy, BAND0, BAND1, a0, a1)}" fill="${PILLAR_COLOR[D.AREAS[i].pillar]}"/>`;
      s += arcLabel({ id: `${idp}-a${i}`, cx, cy, r: BAND1 + 22, aCenter: midDeg, span: 35, str: D.AREAS[i].name, size: 17, weight: 600, fill: C.ink });
    }
  }

  if (banded) s += areaPillarBands({ cx, cy, r0: R5 + 8, r1: R5 + 64, p0: R5 + 70, p1: R5 + 110, idp, areaSize: 17, pillarSize: 14, gap: GAP });
  const groups = banded ? [] : [["foundation", [0]], ["vision", [1, 2, 3]], ["velocity", [4, 5, 6]], ["value", [7, 8, 9]]];
  for (const [pillar, idx] of groups) {
    const a0 = ((start + idx[0] * step) * 180) / Math.PI;
    const a1 = ((start + (idx[idx.length - 1] + 1) * step) * 180) / Math.PI;
    s += arcLabel({ id: `${idp}-p-${pillar}`, cx, cy, r: BAND1 + 56, aCenter: (a0 + a1) / 2, span: a1 - a0 - 4, str: PILLAR_LABEL[pillar], size: 13, weight: 600, fill: PILLAR_COLOR[pillar], family: F_BODY, tracking: 3 });
  }

  s += `<circle cx="${cx}" cy="${cy}" r="${R_HUB}" fill="#ffffff" stroke="${C.lineStrong}" stroke-width="1"/>`;
  s += `<text x="${cx}" y="${cy + 10}" text-anchor="middle" font-family="${F_DISPLAY}" font-size="96" font-weight="700" letter-spacing="-3" fill="${C.ink}">50</text>`;
  s += `<text x="${cx}" y="${cy + 46}" text-anchor="middle" font-family="${F_DISPLAY}" font-size="24" font-weight="600" fill="${C.ink}">playbooks</text>`;
  s += `<text x="${cx}" y="${cy + 74}" text-anchor="middle" font-family="${F_BODY}" font-size="14" font-weight="500" fill="${C.muted}">10 areas · 5 levels</text>`;

  // Level key, bottom corners
  const keyX = 36, keyY = banded ? 1050 : 1012;
  s += `<text x="${keyX}" y="${keyY}" font-family="${F_BODY}" font-size="13" font-weight="600" letter-spacing="2" fill="${C.muted}">INSIDE TO OUTSIDE</text>`;
  for (let lv = 1; lv <= 5; lv++) {
    const y = keyY + 14 + lv * 24;
    s += `<rect x="${keyX}" y="${y - 13}" width="16" height="16" rx="4" fill="${PASTEL[lv]}"/>`;
    s += `<text x="${keyX + 26}" y="${y}" font-family="${F_BODY}" font-size="14" font-weight="600" fill="${C.ink}">Level ${lv}<tspan font-weight="400" fill="${C.slate}" dx="6">${esc(LEVEL_NAME[lv])}</tspan></text>`;
  }

  return { body: `<g id="${idp}">${s}</g>`, viewBox: "0 0 1200 1200", w: 1200, h: 1200 };
}

/** A3 landscape grid poster, 1 unit = 0.1 mm (4200 x 2970). Level 5 at the top, like a climb. */
export function playbookGridPoster({ idp = "pg" } = {}) {
  const W = 4200, H = 2970, M = 200;
  const rowHeadW = 470;
  const gridX = M + rowHeadW;
  const gap = 14;
  const colW = (W - M - gridX - gap * 9) / 10;
  const top = 760;
  const colHeadH = 210;
  const rowH = (H - M - top - colHeadH - gap * 5) / 5;
  let s = `<rect width="${W}" height="${H}" fill="#ffffff"/>`;

  s += logo(M, M - 10, 520, idp);
  s += `<text x="${M}" y="${M + 330}" font-family="${F_DISPLAY}" font-size="150" font-weight="600" letter-spacing="-3.5" fill="${C.ink}">50 playbooks. One for every stage.</text>`;
  s += `<text x="${M}" y="${M + 425}" font-family="${F_BODY}" font-size="44" fill="${C.slate}">Ten areas of the business, five levels of ownership. Your BOSS Score shows which ones come first.</text>`;

  // Pillar bars + column heads
  const colX = (i) => gridX + i * (colW + gap);
  const groups = [["foundation", [0]], ["vision", [1, 2, 3]], ["velocity", [4, 5, 6]], ["value", [7, 8, 9]]];
  for (const [pillar, idx] of groups) {
    const x0 = colX(idx[0]), x1 = colX(idx[idx.length - 1]) + colW;
    s += `<rect x="${n2(x0)}" y="${top}" width="${n2(x1 - x0)}" height="10" rx="5" fill="${PILLAR_COLOR[pillar]}"/>`;
    s += `<text x="${n2(x0)}" y="${top + 56}" font-family="${F_BODY}" font-size="26" font-weight="600" letter-spacing="4" fill="${PILLAR_COLOR[pillar]}">${PILLAR_LABEL[pillar]}</text>`;
  }
  D.AREAS.forEach((a, i) => {
    const lines = wrap(a.name, 34, colW - 10, 0.52);
    lines.forEach((l, li) => {
      s += `<text x="${n2(colX(i))}" y="${top + 112 + li * 40}" font-family="${F_DISPLAY}" font-size="34" font-weight="600" fill="${C.ink}">${esc(l)}</text>`;
    });
  });

  // Rows: Level 5 at the top
  for (let r = 0; r < 5; r++) {
    const lv = 5 - r;
    const y = top + colHeadH + r * (rowH + gap);
    s += `<rect x="${M}" y="${n2(y)}" width="${rowHeadW - 30}" height="${n2(rowH)}" rx="22" fill="${SAT[lv]}"/>`;
    s += `<text x="${M + 34}" y="${n2(y + 70)}" font-family="${F_BODY}" font-size="28" font-weight="600" letter-spacing="3" fill="${C.face}" fill-opacity="0.7">LEVEL ${lv}</text>`;
    s += `<text x="${M + 34}" y="${n2(y + 142)}" font-family="${F_DISPLAY}" font-size="62" font-weight="600" letter-spacing="-1" fill="${C.face}">${esc(LEVEL_NAME[lv])}</text>`;
    for (let i = 0; i < 10; i++) {
      const pb = playbook(i, lv);
      const x = colX(i);
      s += `<rect x="${n2(x)}" y="${n2(y)}" width="${n2(colW)}" height="${n2(rowH)}" rx="22" fill="${PASTEL[lv]}" fill-opacity="0.42"/>`;
      s += `<text x="${n2(x + 28)}" y="${n2(y + 62)}" font-family="${F_BODY}" font-size="28" font-weight="600" fill="${DEEP[lv]}">${pb.ref}</text>`;
      const lines = wrap(pb.name, 40, colW - 56, 0.52);
      lines.forEach((l, li) => {
        s += `<text x="${n2(x + 28)}" y="${n2(y + rowH - 40 - (lines.length - 1 - li) * 46)}" font-family="${F_DISPLAY}" font-size="40" font-weight="600" letter-spacing="-0.4" fill="${C.ink}">${esc(l)}</text>`;
      });
    }
  }

  return svgDoc({ w: 420, h: 297, unit: "mm", viewBox: `0 0 ${W} ${H}`, title: "50 playbooks grid (A3 landscape)", body: s });
}
