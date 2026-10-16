// BOSS Compass (scorecard results circle). Geometry ported from
// src/components/scorecard/BossScorecardVennDiagram.tsx.
import { C, Q, PASTEL, F_DISPLAY, F_BODY, esc, n2, arcLabel } from "./brand.js";

const cx = 500;
const cy = 500;
const rC = 200;
const oC = 130;
const ANGLES = [-90, 30, 150];
const PETAL_SPAN = 60;
const SLOT_OFFSETS = [-PETAL_SPAN, 0, PETAL_SPAN];

const areaName = (id) => Q.SCORECARD_QUESTIONS.find((q) => q.id === id)?.areaName ?? id;

const PILLARS = ["vision", "velocity", "value"].map((id, i) => {
  const meta = Q.SCORECARD_PILLAR_META[id];
  const rad = (ANGLES[i] * Math.PI) / 180;
  return {
    id,
    title: meta.title,
    green: meta.green,
    red: meta.red,
    color: meta.color,
    angle: ANGLES[i],
    pos: { x: cx + oC * Math.cos(rad), y: cy + oC * Math.sin(rad) },
    areas: Q.VENN_PETAL_QUESTIONS[id].map(areaName),
  };
});

function petalPath(pi, slot, r1, r2) {
  const pillar = PILLARS[pi];
  const aCenter = pillar.angle + SLOT_OFFSETS[slot];
  const r1a = ((aCenter - PETAL_SPAN / 2) * Math.PI) / 180;
  const r2a = ((aCenter + PETAL_SPAN / 2) * Math.PI) / 180;
  let x1 = pillar.pos.x + r1 * Math.cos(r1a), y1 = pillar.pos.y + r1 * Math.sin(r1a);
  let x2 = pillar.pos.x + r2 * Math.cos(r1a), y2 = pillar.pos.y + r2 * Math.sin(r1a);
  let x3 = pillar.pos.x + r2 * Math.cos(r2a), y3 = pillar.pos.y + r2 * Math.sin(r2a);
  let x4 = pillar.pos.x + r1 * Math.cos(r2a), y4 = pillar.pos.y + r1 * Math.sin(r2a);

  // Snap the outer edges of slot 0 and 2 to the line shared with the neighbouring pillar.
  function snap(ni, isA1Edge) {
    const N = PILLARS[ni].pos;
    const mx = (pillar.pos.x + N.x) / 2 - cx;
    const my = (pillar.pos.y + N.y) / 2 - cy;
    const mLen = Math.hypot(mx, my) || 1;
    const dirX = mx / mLen, dirY = my / mLen;
    const px = pillar.pos.x - cx, py = pillar.pos.y - cy;
    const b = -2 * (dirX * px + dirY * py);
    const solve = (c) => {
      const disc = b * b - 4 * c;
      if (disc < 0) return null;
      const t = (-b + Math.sqrt(disc)) / 2;
      return { x: cx + t * dirX, y: cy + t * dirY };
    };
    const inner = solve(px * px + py * py - r1 * r1);
    const outer = solve(px * px + py * py - r2 * r2);
    if (!inner || !outer) return;
    if (isA1Edge) { x1 = inner.x; y1 = inner.y; x2 = outer.x; y2 = outer.y; }
    else { x3 = outer.x; y3 = outer.y; x4 = inner.x; y4 = inner.y; }
  }
  if (slot === 0) snap((pi + 2) % 3, true);
  if (slot === 2) snap((pi + 1) % 3, false);
  return `M ${n2(x1)} ${n2(y1)} L ${n2(x2)} ${n2(y2)} A ${r2} ${r2} 0 0 1 ${n2(x3)} ${n2(y3)} L ${n2(x4)} ${n2(y4)} A ${r1} ${r1} 0 0 0 ${n2(x1)} ${n2(y1)} Z`;
}

function lensPath(i, j) {
  const A = PILLARS[i].pos, B = PILLARS[j].pos;
  const dx = B.x - A.x, dy = B.y - A.y;
  const d = Math.hypot(dx, dy);
  const h = Math.sqrt(rC * rC - (d / 2) ** 2);
  const px = A.x + dx / 2, py = A.y + dy / 2;
  const ox = (-dy / d) * h, oy = (dx / d) * h;
  return `M ${n2(px + ox)} ${n2(py + oy)} A ${rC} ${rC} 0 0 0 ${n2(px - ox)} ${n2(py - oy)} A ${rC} ${rC} 0 0 0 ${n2(px + ox)} ${n2(py + oy)} Z`;
}

function centrePath() {
  const pts = [[0, 1], [1, 2], [0, 2]].map(([i, j]) => {
    const A = PILLARS[i].pos, B = PILLARS[j].pos;
    const dx = B.x - A.x, dy = B.y - A.y;
    const d = Math.hypot(dx, dy);
    const h = Math.sqrt(rC * rC - (d / 2) ** 2);
    const mx = A.x + dx / 2, my = A.y + dy / 2;
    const ox = (-dy / d) * h, oy = (dx / d) * h;
    const c1 = { x: mx + ox, y: my + oy }, c2 = { x: mx - ox, y: my - oy };
    return (c1.x - cx) ** 2 + (c1.y - cy) ** 2 < (c2.x - cx) ** 2 + (c2.y - cy) ** 2 ? c1 : c2;
  });
  const [P1, P2, P3] = pts.sort((a, b) => Math.atan2(a.y - cy, a.x - cx) - Math.atan2(b.y - cy, b.x - cx));
  return `M ${n2(P1.x)} ${n2(P1.y)} A ${rC} ${rC} 0 0 1 ${n2(P2.x)} ${n2(P2.y)} A ${rC} ${rC} 0 0 1 ${n2(P3.x)} ${n2(P3.y)} A ${rC} ${rC} 0 0 1 ${n2(P1.x)} ${n2(P1.y)} Z`;
}

function splitTitle(title) {
  const amp = title.indexOf(" & ");
  if (amp === -1) {
    const w = title.split(" ");
    if (w.length <= 2) return [title, ""];
    const mid = Math.ceil(w.length / 2);
    return [w.slice(0, mid).join(" "), w.slice(mid).join(" ")];
  }
  const a = title.slice(0, amp), b = title.slice(amp + 3);
  return a.length <= b.length ? [`${a} &`, b] : [a, `& ${b}`];
}

/** Illustrative scores so every colour on the scale shows. Petals follow VENN order; lens = money, time, team. */
export const EXAMPLE_SCORES = { petals: [4, 2, 3, 5, 3, 1, 2, 4, 3], lens: [2, 3, 4] };

/**
 * style "classic": matches the app (labels inside the petals).
 * style "rings":   each petal is a 1 to 5 scale with thin grey rings and numbers; labels sit outside.
 * scores:          optional { petals: [9 x 1-5], lens: [money, time, team] }.
 * petalNumbers:    "app" (1-9 as the app), "sheet" (question numbers 2-10) or "none". Classic only.
 */
export function compass({ style = "classic", scores = null, idp, petalNumbers = "sheet" }) {
  const rings = style === "rings";
  const PETAL_INNER = rC;
  const BAND = rings ? 135 : 88;
  const PETAL_OUTER = rC + BAND;
  const STEP = BAND / 5;
  let s = "";

  PILLARS.forEach((p, pi) => {
    for (let slot = 0; slot < 3; slot++) {
      const score = scores?.petals[pi * 3 + slot] ?? null;
      if (rings) {
        for (let k = 1; k <= 5; k++) {
          const filled = score != null && k <= score;
          s += `<path d="${petalPath(pi, slot, PETAL_INNER + (k - 1) * STEP, PETAL_INNER + k * STEP)}" fill="${filled ? PASTEL[score] : "#ffffff"}" stroke="${C.lineStrong}" stroke-width="0.8"/>`;
        }
        s += `<path d="${petalPath(pi, slot, PETAL_INNER, PETAL_OUTER)}" fill="none" stroke="rgba(31,58,102,0.28)" stroke-width="1.2"/>`;
      } else {
        s += `<path d="${petalPath(pi, slot, PETAL_INNER, PETAL_OUTER)}" fill="${score != null ? PASTEL[score] : "#ffffff"}" stroke="rgba(31,58,102,0.22)" stroke-width="1"/>`;
      }
    }
  });

  PILLARS.forEach((p) => {
    s += `<circle cx="${n2(p.pos.x)}" cy="${n2(p.pos.y)}" r="${rC}" fill="${p.color}" stroke="#ffffff" stroke-width="2"/>`;
  });

  const lensPairs = [[0, 1], [1, 2], [0, 2]];
  const lensLabels = ["MONEY", "TIME", "TEAM"];
  lensPairs.forEach(([i, j], k) => {
    const ls = scores?.lens[k] ?? null;
    s += `<path d="${lensPath(i, j)}" fill="${ls != null ? PASTEL[ls] : C.lensNavy}" stroke="rgba(22,45,80,0.65)" stroke-width="1"/>`;
  });
  s += `<path d="${centrePath()}" fill="#ffffff" stroke="rgba(31,58,102,0.12)" stroke-width="1"/>`;
  PILLARS.forEach((p) => {
    s += `<circle cx="${n2(p.pos.x)}" cy="${n2(p.pos.y)}" r="${rC}" fill="none" stroke="#ffffff" stroke-width="2"/>`;
  });

  lensPairs.forEach(([i, j], k) => {
    const A = PILLARS[i].pos, B = PILLARS[j].pos;
    const mx = (A.x + B.x) / 2, my = (A.y + B.y) / 2;
    const len = Math.hypot(cx - mx, cy - my) || 1;
    const x = mx - ((cx - mx) / len) * 66, y = my - ((cy - my) / len) * 66;
    const filled = scores?.lens[k] != null;
    s += `<text x="${n2(x)}" y="${n2(y + 5)}" text-anchor="middle" font-family="${F_DISPLAY}" font-size="15" font-weight="700" letter-spacing="1.4" fill="${filled ? C.ink : "#ffffff"}">${lensLabels[k]}</text>`;
  });

  PILLARS.forEach((p, pi) => {
    for (let slot = 0; slot < 3; slot++) {
      const aCenter = p.angle + SLOT_OFFSETS[slot];
      const title = p.areas[slot];
      const id = `${idp}-pl-${pi}-${slot}`;
      const lbl = (extra) => arcLabel({ cx: p.pos.x, cy: p.pos.y, aCenter, ...extra });
      if (rings) {
        s += lbl({ id, r: PETAL_OUTER + 20, span: PETAL_SPAN - 2, str: title, size: 16 });
        for (let k = 1; k <= 5; k++) {
          const r = PETAL_INNER + (k - 0.5) * STEP;
          const a = (aCenter * Math.PI) / 180;
          s += `<text x="${n2(p.pos.x + r * Math.cos(a))}" y="${n2(p.pos.y + r * Math.sin(a) + 4)}" text-anchor="middle" font-family="${F_BODY}" font-size="11" font-weight="600" fill="${C.slate}" fill-opacity="0.7">${k}</text>`;
        }
      } else {
        const [l1, l2] = splitTitle(title);
        const isLower = Math.sin((aCenter * Math.PI) / 180) > 0.05;
        const mid = (PETAL_INNER + PETAL_OUTER) / 2;
        const base = { span: PETAL_SPAN - 6, size: 16, fill: C.lensNavy };
        if (!l2) {
          s += lbl({ ...base, id, r: mid + 2, str: l1 });
        } else {
          s += lbl({ ...base, id: `${id}a`, r: isLower ? mid - 8 : mid + 10, str: l1 });
          s += lbl({ ...base, id: `${id}b`, r: isLower ? mid + 10 : mid - 8, str: l2 });
        }
        if (petalNumbers !== "none") {
          const num = petalNumbers === "app" ? pi * 3 + slot + 1 : pi * 3 + slot + 2;
          s += lbl({ id: `${id}n`, r: isLower ? PETAL_INNER + 12 : PETAL_OUTER - 14, span: 20, str: String(num), size: 10, fill: C.lensNavy, family: F_BODY, opacity: 0.5 });
        }
      }
    }
  });

  PILLARS.forEach((p) => {
    const dx = p.pos.x - cx, dy = p.pos.y - cy;
    const len = Math.hypot(dx, dy);
    const tx = p.pos.x + (dx / len) * rC * 0.4, ty = p.pos.y + (dy / len) * rC * 0.4;
    s += `<text x="${n2(tx)}" y="${n2(ty - 8)}" text-anchor="middle" font-family="${F_DISPLAY}" font-size="26" font-weight="600" letter-spacing="3.6" fill="#ffffff">${p.title}</text>`;
    s += `<text x="${n2(tx)}" y="${n2(ty + 20)}" text-anchor="middle" font-family="${F_BODY}" font-size="16" font-style="italic" fill="#ffffff">${esc(p.green)}</text>`;
    s += `<text x="${n2(tx)}" y="${n2(ty + 41)}" text-anchor="middle" font-family="${F_BODY}" font-size="13" fill="#ffffff" fill-opacity="0.8">not ${esc(p.red)}</text>`;
  });

  s += `<text x="${cx}" y="${cy - 28}" text-anchor="middle" font-family="${F_BODY}" font-size="10.5" font-weight="600" letter-spacing="2.2" fill="${C.lensNavy}" fill-opacity="0.6">THE GOAL</text>`;
  s += `<text x="${cx}" y="${cy}" text-anchor="middle" font-family="${F_DISPLAY}" font-size="22" font-weight="600" fill="${C.lensNavy}">Your Ideal</text>`;
  s += `<text x="${cx}" y="${cy + 26}" text-anchor="middle" font-family="${F_DISPLAY}" font-size="22" font-weight="600" fill="${C.lensNavy}">Business</text>`;

  return { body: `<g id="${idp}-compass">${s}</g>`, viewBox: rings ? "10 -22 980 980" : "80 48 840 840", w: rings ? 980 : 840, h: rings ? 980 : 840 };
}
