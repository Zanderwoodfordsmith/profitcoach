// "Old way vs new way": a scribbled whiteboard (running the business from your head)
// beside the clean BOSS Wheel (running it from a score). Hand-drawn marks are procedural
// and seeded, so every build draws the same board.
import { C, F_DISPLAY, F_BODY, F_HAND, F_MARKER, esc, n2, rng, svgDoc, logo, place, gradientDef } from "./brand.js";
import { bossWheel, EXAMPLE_AREA_SCORES } from "./wheel.js";
import { qrBlock } from "./scorecard.js";

const INK = { black: "#22262b", red: "#d1342c", blue: "#1f5fbf", green: "#2b8a4f" };

function catmull(pts, closed = false) {
  const p = (i) => pts[Math.max(0, Math.min(pts.length - 1, i))];
  let d = `M ${n2(pts[0].x)} ${n2(pts[0].y)}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = p(i - 1), p1 = p(i), p2 = p(i + 1), p3 = p(i + 2);
    d += ` C ${n2(p1.x + (p2.x - p0.x) / 6)} ${n2(p1.y + (p2.y - p0.y) / 6)} ${n2(p2.x - (p3.x - p1.x) / 6)} ${n2(p2.y - (p3.y - p1.y) / 6)} ${n2(p2.x)} ${n2(p2.y)}`;
  }
  return d + (closed ? " Z" : "");
}

function makePen(seed) {
  const r = rng(seed);
  const j = (amt) => (r() - 0.5) * 2 * amt;
  const stroke = (d, color, width) =>
    `<path d="${d}" fill="none" stroke="${color}" stroke-width="${n2(width * (0.88 + r() * 0.24))}" stroke-linecap="round" stroke-linejoin="round" stroke-opacity="0.9"/>`;

  return {
    r,
    line(x1, y1, x2, y2, { color = INK.black, width = 4, bow = 0.03, jitter = 2 } = {}) {
      const ax = x1 + j(jitter), ay = y1 + j(jitter), bx = x2 + j(jitter), by = y2 + j(jitter);
      const len = Math.hypot(bx - ax, by - ay) || 1;
      const nx = -(by - ay) / len, ny = (bx - ax) / len;
      const off = j(bow * len);
      return stroke(`M ${n2(ax)} ${n2(ay)} Q ${n2((ax + bx) / 2 + nx * off)} ${n2((ay + by) / 2 + ny * off)} ${n2(bx)} ${n2(by)}`, color, width);
    },
    ellipse(cx, cy, rx, ry, { color = INK.red, width = 4.5, overshoot = 0.5, wobble = 0.07, rot = 0 } = {}) {
      const n = 30;
      const t0 = r() * Math.PI * 2;
      const total = Math.PI * 2 + overshoot;
      const phase = r() * 6;
      const cr = Math.cos((rot * Math.PI) / 180), sr = Math.sin((rot * Math.PI) / 180);
      const pts = [];
      for (let i = 0; i <= n; i++) {
        const t = t0 + (total * i) / n;
        const k = 1 + wobble * Math.sin(t * 2 + phase) + (i / n) * 0.09;
        const x = rx * k * Math.cos(t), y = ry * k * Math.sin(t);
        pts.push({ x: cx + x * cr - y * sr, y: cy + x * sr + y * cr });
      }
      return stroke(catmull(pts), color, width);
    },
    rect(x, y, w, h, opts = {}) {
      const o = 6;
      return this.line(x - o, y, x + w + o, y + j(2), opts) + this.line(x + w, y - o, x + w + j(2), y + h + o, opts) +
        this.line(x + w + o, y + h, x - o, y + h + j(2), opts) + this.line(x, y + h + o, x + j(2), y - o, opts);
    },
    arrow(x1, y1, x2, y2, { color = INK.black, width = 3.5, curve = 0.18 } = {}) {
      const len = Math.hypot(x2 - x1, y2 - y1) || 1;
      const nx = -(y2 - y1) / len, ny = (x2 - x1) / len;
      const off = (curve + j(0.08)) * len;
      const qx = (x1 + x2) / 2 + nx * off, qy = (y1 + y2) / 2 + ny * off;
      let s = stroke(`M ${n2(x1)} ${n2(y1)} Q ${n2(qx)} ${n2(qy)} ${n2(x2)} ${n2(y2)}`, color, width);
      const ang = Math.atan2(y2 - qy, x2 - qx);
      for (const da of [2.65, -2.65]) {
        const a = ang + da + j(0.12);
        s += stroke(`M ${n2(x2)} ${n2(y2)} L ${n2(x2 + 18 * Math.cos(a))} ${n2(y2 + 18 * Math.sin(a))}`, color, width);
      }
      return s;
    },
    knot(cx, cy, R, { color = INK.green, width = 3 } = {}) {
      const pts = [];
      let ox = 0, oy = 0;
      for (let t = 0; t < Math.PI * 9; t += 0.32) {
        ox += j(3); oy += j(3);
        const rr = R * (0.35 + 0.65 * Math.abs(Math.sin(t * 0.37 + r())));
        pts.push({ x: cx + ox + rr * Math.cos(t), y: cy + oy + rr * 0.8 * Math.sin(t) });
      }
      return stroke(catmull(pts), color, width);
    },
    write(x, y, str, { font = F_HAND, size = 38, color = INK.black, rot = 0, weight = 700 } = {}) {
      const a = rot + j(0.8);
      return `<text x="${n2(x)}" y="${n2(y)}" transform="rotate(${n2(a)} ${n2(x)} ${n2(y)})" font-family="${font}" font-size="${size}" font-weight="${weight}" fill="${color}" fill-opacity="0.92">${esc(str)}</text>`;
    },
    strike(x, y, w, opts = {}) {
      return this.line(x - 6, y + j(3), x + w + 6, y - 6 + j(3), { width: 4, bow: 0.01, ...opts });
    },
    tally(x, y, count, { color = INK.black } = {}) {
      let s = "";
      for (let i = 0; i < count; i++) {
        const group = Math.floor(i / 5), k = i % 5;
        const gx = x + group * 78;
        if (k < 4) s += this.line(gx + k * 13, y, gx + k * 13 + j(2), y + 46, { color, width: 3.5, bow: 0.02 });
        else s += this.line(gx - 8, y + 34, gx + 52, y + 10, { color, width: 3.5, bow: 0.02 });
      }
      return s;
    },
    sticky(x, y, w, h, rot, lines, { fill = "#ffe46b", idp }) {
      const cx = x + w / 2, cy = y + h / 2;
      let s = `<g transform="rotate(${rot} ${n2(cx)} ${n2(cy)})">`;
      s += `<rect x="${x + 4}" y="${y + 7}" width="${w}" height="${h}" fill="#000000" fill-opacity="0.13" filter="url(#${idp}-soft)"/>`;
      s += `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${fill}"/>`;
      s += `<rect x="${x}" y="${y}" width="${w}" height="${h * 0.16}" fill="#000000" fill-opacity="0.04"/>`;
      lines.forEach((l, i) => {
        s += `<text x="${n2(cx)}" y="${n2(y + h * 0.46 + i * 34)}" text-anchor="middle" font-family="${F_HAND}" font-size="32" font-weight="700" fill="${INK.black}" fill-opacity="0.88">${esc(l)}</text>`;
      });
      return s + `</g>`;
    },
  };
}

/** The whiteboard on its own, 1000 x 700. */
export function whiteboard({ idp = "wb", seed = 7 } = {}) {
  const pen = makePen(seed);
  let s = `<defs>
<filter id="${idp}-soft" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="5"/></filter>
<filter id="${idp}-smudge" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="18"/></filter>
<linearGradient id="${idp}-frame" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#d9dfe6"/><stop offset="1" stop-color="#aeb8c4"/></linearGradient>
<clipPath id="${idp}-clip"><rect x="26" y="26" width="948" height="608" rx="6"/></clipPath>
<linearGradient id="${idp}-board" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ffffff"/><stop offset="1" stop-color="#f1f3f4"/></linearGradient>
</defs>`;
  // Frame, board, tray
  s += `<rect x="14" y="18" width="972" height="636" rx="16" fill="#000000" fill-opacity="0.10" filter="url(#${idp}-soft)"/>`;
  s += `<rect x="10" y="10" width="980" height="640" rx="16" fill="url(#${idp}-frame)"/>`;
  s += `<rect x="26" y="26" width="948" height="608" rx="6" fill="url(#${idp}-board)"/>`;
  // Old eraser smudges
  for (const [x, y, rx, ry] of [[640, 140, 150, 50], [300, 470, 130, 40], [830, 520, 110, 46], [180, 300, 90, 30]]) {
    s += `<ellipse cx="${x}" cy="${y}" rx="${rx}" ry="${ry}" fill="#8a96a3" fill-opacity="0.09" filter="url(#${idp}-smudge)"/>`;
  }
  s += `<g clip-path="url(#${idp}-clip)">`;

  // To do list
  s += pen.write(66, 104, "TO DO!!!", { font: F_MARKER, size: 50, rot: -3, weight: 400 });
  s += pen.line(62, 122, 300, 113, { width: 4.5 }) + pen.line(70, 134, 288, 127, { width: 4 });
  const todo = [
    ["Chase invoices", false, INK.black],
    ["Call accountant", true, INK.black],
    ["Quote for Hendersons", false, INK.blue],
    ["Fix the website", true, INK.black],
    ["Payroll Friday!!", false, INK.red],
    ["Hire someone??", false, INK.blue],
  ];
  todo.forEach(([t, struck, color], i) => {
    const y = 186 + i * 50;
    const x = 74 + pen.r() * 10;
    s += pen.write(x, y, `- ${t}`, { size: 40, color, rot: -1.5 + pen.r() * 2 });
    if (struck) s += pen.strike(x + 20, y - 12, t.length * 15.5, { color: INK.black });
  });

  // ME in the middle of everything
  s += pen.write(588, 352, "ME", { font: F_MARKER, size: 70, color: INK.black, rot: -4, weight: 400 });
  s += pen.ellipse(634, 330, 82, 56, { color: INK.red, width: 5, rot: -6 });
  s += pen.ellipse(636, 332, 92, 62, { color: INK.red, width: 3.5, rot: 4, overshoot: 0.9 });
  const boxes = [
    ["Sales", 468, 196, 104, 54],
    ["Ops", 770, 214, 84, 54],
    ["Team", 800, 420, 98, 54],
    ["Clients", 470, 432, 120, 54],
  ];
  for (const [label, x, y, w, h] of boxes) {
    s += pen.rect(x, y, w, h, { color: INK.blue, width: 3.5 });
    s += pen.write(x + 14, y + 39, label, { size: 36, color: INK.blue });
  }
  s += pen.arrow(530, 252, 590, 296, { curve: 0.2 });
  s += pen.arrow(800, 270, 708, 304, { curve: -0.25 });
  s += pen.arrow(840, 418, 712, 360, { curve: 0.15 });
  s += pen.arrow(560, 432, 600, 384, { curve: -0.3 });
  // Everything also loops back through ME
  s += pen.arrow(572, 222, 778, 236, { curve: -0.22, color: INK.black, width: 3 });
  s += pen.arrow(820, 270, 840, 412, { curve: 0.3, color: INK.black, width: 3 });
  s += pen.arrow(596, 470, 790, 452, { curve: 0.18, color: INK.black, width: 3 });

  // CASH??
  s += pen.write(760, 112, "CASH??", { font: F_MARKER, size: 46, color: INK.red, rot: 5, weight: 400 });
  s += pen.ellipse(842, 98, 104, 44, { color: INK.red, width: 4, rot: 5, overshoot: 0.7 });
  s += pen.arrow(760, 128, 668, 278, { curve: 0.3, color: INK.red, width: 3.5 });

  // Plans that keep moving
  s += pen.write(640, 586, "Q3 plan", { size: 40, rot: -2 });
  s += pen.strike(640, 572, 118);
  s += pen.write(790, 590, "Q4??", { size: 42, color: INK.red, rot: 3 });

  // Fires this week
  s += pen.write(72, 512, "Fires this week:", { size: 34, rot: -1 });
  s += pen.tally(80, 532, 13, { color: INK.red });

  // Chaos knot and stickies
  s += pen.knot(400, 330, 44);
  s += pen.sticky(334, 46, 140, 120, 6, ["Price", "rise?"], { fill: "#ffb7c9", idp });
  s += pen.sticky(330, 498, 150, 112, -7, ["Holiday?"], { fill: "#ffe46b", idp });
  s += pen.sticky(860, 300, 104, 96, 8, ["Ring", "Dave"], { fill: "#ffe46b", idp });

  s += `</g>`;
  // Tray, markers, eraser
  s += `<rect x="190" y="648" width="620" height="20" rx="6" fill="#a9b3bf"/>`;
  [["#22262b", 260], ["#d1342c", 330], ["#1f5fbf", 400]].forEach(([c, x]) => {
    s += `<rect x="${x}" y="636" width="58" height="14" rx="6" fill="${c}"/><rect x="${x + 44}" y="636" width="14" height="14" rx="5" fill="#e8ebee"/>`;
  });
  s += `<rect x="640" y="626" width="96" height="26" rx="5" fill="#3a3f46"/><rect x="640" y="626" width="96" height="9" rx="4" fill="#cfd5db"/>`;

  return { body: `<g id="${idp}">${s}</g>`, viewBox: "0 0 1000 680", w: 1000, h: 680 };
}

/** Full-width brand gradient footer: white logo left, tagline right. Belongs to the whole piece, not one side. */
function taglineBand(W, H, bandH, idp, { size = 38, logoW = 300, pad = 110 } = {}) {
  const y = H - bandH;
  return `<defs>${gradientDef(`${idp}-band`, { x1: 0, y1: 0.5, x2: 1, y2: 0.5 })}</defs>` +
    `<rect x="0" y="${y}" width="${W}" height="${bandH}" fill="url(#${idp}-band)"/>` +
    logo(pad, y + bandH / 2 - logoW / 13.4, logoW, `${idp}-f`, "white") +
    `<text x="${W - pad}" y="${n2(y + bandH / 2 + size * 0.36)}" text-anchor="end" font-family="${F_DISPLAY}" font-size="${size}" font-weight="600" letter-spacing="-0.4" fill="#ffffff">Less chaos. More profit. Real freedom.</text>`;
}

function sideLabel(x, y, title, sub, anchor = "start") {
  return `<text x="${x}" y="${y}" text-anchor="${anchor}" font-family="${F_DISPLAY}" font-size="46" font-weight="600" letter-spacing="-0.8" fill="${C.ink}">${esc(title)}</text>` +
    `<text x="${x}" y="${y + 44}" text-anchor="${anchor}" font-family="${F_BODY}" font-size="26" fill="${C.slate}">${esc(sub)}</text>`;
}

/** 1920 x 1080, for slides, LinkedIn and YouTube. */
export function oldNewLandscape({ idp = "onl", footer = "band" } = {}) {
  const W = 1920, H = 1080;
  let s = `<rect width="${W}" height="${H}" fill="#ffffff"/>`;
  s += sideLabel(110, 150, "The old way", "Running the business from your head.");
  s += place(whiteboard({ idp: `${idp}-wb` }), 84, 226, 980, 666);
  s += sideLabel(1470, 150, "The new way", "Running it from your BOSS Score.", "middle");
  s += place(bossWheel({ scores: EXAMPLE_AREA_SCORES, idp: `${idp}-w` }), 1110, 196, 720);
  if (footer === "band") {
    s += taglineBand(W, H, 130, idp);
  } else {
    s += `<text x="110" y="${H - 84}" font-family="${F_DISPLAY}" font-size="34" font-weight="600" letter-spacing="-0.4" fill="${C.ink}">Less chaos. More profit. Real freedom.</text>`;
    s += logo(W - 110 - 300, H - 128, 300, idp);
  }
  return svgDoc({ w: W, h: H, viewBox: `0 0 ${W} ${H}`, title: "Old way vs new way (1920 x 1080)", body: s });
}

/** 1080 x 1350, for LinkedIn and Instagram portrait posts. With a coach, the tagline becomes their call to action. */
export function oldNewPortrait({ idp = "onp", coach = null } = {}) {
  const W = 1080, H = 1350;
  let s = `<rect width="${W}" height="${H}" fill="#ffffff"/>`;
  s += sideLabel(80, 96, "The old way", "Running the business from your head.");
  s += place(whiteboard({ idp: `${idp}-wb` }), 70, 160, 940, 639);
  s += sideLabel(80, 870, "The new way", "Running it from your BOSS Score.");
  s += place(bossWheel({ scores: EXAMPLE_AREA_SCORES, idp: `${idp}-w` }), 560, 790, 470);
  if (coach) {
    s += `<text x="80" y="1018" font-family="${F_DISPLAY}" font-size="34" font-weight="600" letter-spacing="-0.4" fill="${C.ink}">Which one is yours?</text>`;
    s += `<text x="80" y="1056" font-family="${F_BODY}" font-size="22" fill="${C.slate}">Find your BOSS Score in 3 minutes.</text>`;
    s += qrBlock(80, 1088, 150, coach);
    s += `<text x="250" y="1140" font-family="${F_DISPLAY}" font-size="${coach.name.length > 20 ? 21 : 24}" font-weight="600" fill="${C.ink}">${esc(coach.name)}</text>`;
    if (coach.business) s += `<text x="250" y="1170" font-family="${F_BODY}" font-size="19" fill="${C.slate}">${esc(coach.business)}</text>`;
    s += logo(250, 1196, 200, idp);
    s += `<text x="80" y="1290" font-family="${F_BODY}" font-size="21" font-weight="600" fill="${C.vision}">${esc(coach.displayUrl)}</text>`;
  } else {
    s += taglineBand(W, H, 112, idp, { size: 30, logoW: 250, pad: 70 });
  }
  return svgDoc({ w: W, h: H, viewBox: `0 0 ${W} ${H}`, title: coach ? `Old way vs new way (${coach.name})` : "Old way vs new way (1080 x 1350)", body: s });
}
