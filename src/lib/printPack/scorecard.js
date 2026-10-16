// A4 scorecard sheet, colour scale strip and pull-up banner. All accept an optional coach
// ({ name, business, url, qr }) so each coach can get their own QR code and details.
import {
  C, SAT, PASTEL, LABELS, F_DISPLAY, F_BODY, esc, n2, svgDoc, logo, face, wrap, place, gradientDef,
  scorecardRows, GROUP_COLOR, GROUP_NAME,
} from "./brand.js";
import { compass, EXAMPLE_SCORES } from "./compass.js";

const LABEL_LINES = { 1: ["Don't", "Ask"], 2: ["Needs", "Work"], 3: ["It's", "ok"], 4: ["Really", "Good"], 5: ["100%", "Ideal"] };

/** QR block: real code when the coach has one, dashed placeholder otherwise. */
export function qrBlock(x, y, size, coach, { onDark = false } = {}) {
  if (coach?.qr) {
    const pad = size * 0.07;
    return `<rect x="${n2(x)}" y="${n2(y)}" width="${n2(size)}" height="${n2(size)}" rx="${n2(size * 0.07)}" fill="#ffffff"/>` +
      `<svg x="${n2(x + pad)}" y="${n2(y + pad)}" width="${n2(size - 2 * pad)}" height="${n2(size - 2 * pad)}" viewBox="${coach.qr.viewBox}" shape-rendering="crispEdges">${coach.qr.body}</svg>`;
  }
  return `<rect x="${n2(x)}" y="${n2(y)}" width="${n2(size)}" height="${n2(size)}" rx="${n2(size * 0.07)}" fill="${onDark ? "#ffffff" : "none"}" stroke="${onDark ? "none" : C.faint}" stroke-width="2" stroke-dasharray="10 8"/>` +
    `<text x="${n2(x + size / 2)}" y="${n2(y + size / 2 + size * 0.04)}" text-anchor="middle" font-family="${F_BODY}" font-size="${n2(size * 0.115)}" font-weight="600" fill="${C.faint}">QR code</text>`;
}

export function scaleStrip({ x, y, w, h, idp, labelSize = 30, showNumbers = true, radius = 22 }) {
  const seg = w / 5;
  let s = `<defs><clipPath id="${idp}-clip"><rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${radius}"/></clipPath></defs><g clip-path="url(#${idp}-clip)">`;
  for (let k = 1; k <= 5; k++) s += `<rect x="${n2(x + (k - 1) * seg)}" y="${y}" width="${n2(seg + 0.5)}" height="${h}" fill="${SAT[k]}"/>`;
  s += `</g>`;
  for (let k = 1; k <= 5; k++) {
    const mx = x + (k - 0.5) * seg;
    s += face(k, mx, y + h * 0.36, h * 0.42);
    s += `<text x="${n2(mx)}" y="${n2(y + h * 0.8)}" text-anchor="middle" font-family="${F_DISPLAY}" font-size="${labelSize}" font-weight="600" fill="${C.face}">${esc(LABELS[k])}</text>`;
    if (showNumbers) {
      s += `<text x="${n2(x + (k - 1) * seg + h * 0.12)}" y="${n2(y + h * 0.2)}" font-family="${F_BODY}" font-size="${n2(labelSize * 0.62)}" font-weight="600" fill="${C.face}" fill-opacity="0.55">${k}</text>`;
    }
  }
  return s;
}

export function colourScaleFile() {
  return svgDoc({ w: 1800, h: 300, viewBox: "0 0 1800 300", title: "BOSS Score colour scale", body: scaleStrip({ x: 0, y: 0, w: 1800, h: 300, idp: "cs", labelSize: 40 }) });
}

/** A4 portrait, 1 unit = 0.1 mm. */
export function scorecardSheet({ idp = "sc", coach = null, outcomeNumbering = "sequential" } = {}) {
  const W = 2100, H = 2970, M = 150;
  const colW = 128;
  const ansX = W - M - colW * 5;
  const textX = M + 96;
  const textW = ansX - textX - 40;
  let s = `<rect width="${W}" height="${H}" fill="#ffffff"/>`;

  s += logo(M, M, 470, idp);
  s += `<text x="${M}" y="${M + 250}" font-family="${F_DISPLAY}" font-size="112" font-weight="600" letter-spacing="-2.2" fill="${C.ink}">BOSS Scorecard</text>`;
  s += `<text x="${M}" y="${M + 322}" font-family="${F_BODY}" font-size="34" fill="${C.slate}">Circle one answer for each question. Go with your first instinct.</text>`;
  const fieldX = W - M - 560;
  ["Name", "Business", "Date"].forEach((label, i) => {
    const fy = M + 18 + i * 66;
    s += `<text x="${fieldX}" y="${fy + 30}" font-family="${F_BODY}" font-size="24" font-weight="600" fill="${C.muted}">${label}</text>`;
    s += `<line x1="${fieldX + 130}" y1="${fy + 36}" x2="${W - M}" y2="${fy + 36}" stroke="${C.lineStrong}" stroke-width="2"/>`;
  });

  const headTop = M + 400;
  const headH = 210;
  const rowTop = headTop + headH;
  const AREA = 30, QS = 26, QLH = 34;
  const rows = scorecardRows({ outcomeNumbering }).map((r) => {
    const lines = wrap(r.q, QS, textW, 0.5);
    return { ...r, lines, h: 26 + AREA + 10 + lines.length * QLH + 18 };
  });
  const tableBottom = rows.reduce((y, r) => y + r.h, rowTop);

  s += `<defs><clipPath id="${idp}-cols"><rect x="${ansX}" y="${headTop}" width="${colW * 5}" height="${tableBottom - headTop}" rx="22"/></clipPath></defs><g clip-path="url(#${idp}-cols)">`;
  for (let k = 1; k <= 5; k++) {
    const x = ansX + (k - 1) * colW;
    s += `<rect x="${x}" y="${headTop}" width="${colW + 0.5}" height="${headH}" fill="${SAT[k]}"/>`;
    s += `<rect x="${x}" y="${rowTop}" width="${colW + 0.5}" height="${tableBottom - rowTop}" fill="${PASTEL[k]}" fill-opacity="0.32"/>`;
  }
  s += `</g>`;
  for (let k = 1; k <= 5; k++) {
    const mx = ansX + (k - 0.5) * colW;
    s += face(k, mx, headTop + 66, 76);
    LABEL_LINES[k].forEach((t, li) => {
      s += `<text x="${n2(mx)}" y="${headTop + 142 + li * 32}" text-anchor="middle" font-family="${F_DISPLAY}" font-size="26" font-weight="600" fill="${C.face}">${esc(t)}</text>`;
    });
  }
  s += `<text x="${textX}" y="${headTop + headH - 30}" font-family="${F_BODY}" font-size="24" font-weight="600" letter-spacing="2.4" fill="${C.muted}">AREA AND QUESTION</text>`;
  s += `<line x1="${M}" y1="${rowTop}" x2="${ansX}" y2="${rowTop}" stroke="${C.ink}" stroke-width="2"/>`;

  let y = rowTop;
  rows.forEach((r, i) => {
    const groupBreak = i > 0 && rows[i - 1].group !== r.group;
    if (i > 0) s += `<line x1="${M}" y1="${y}" x2="${W - M}" y2="${y}" stroke="${groupBreak ? C.lineStrong : C.line}" stroke-width="${groupBreak ? 2.5 : 1.5}"/>`;
    const color = GROUP_COLOR[r.group];
    const top = y + 26;
    s += `<rect x="${M}" y="${top - 2}" width="68" height="42" rx="21" fill="${color}"/>`;
    s += `<text x="${M + 34}" y="${top + 27}" text-anchor="middle" font-family="${F_DISPLAY}" font-size="${r.n.length > 2 ? 22 : 24}" font-weight="600" fill="#ffffff">${r.n}</text>`;
    s += `<text x="${textX}" y="${top + AREA - 2}" font-family="${F_DISPLAY}" font-size="${AREA}" font-weight="600" fill="${C.ink}">${esc(r.area)}<tspan font-family="${F_BODY}" font-size="20" font-weight="600" letter-spacing="1.6" fill="${color}" dx="16">${GROUP_NAME[r.group].toUpperCase()}</tspan></text>`;
    r.lines.forEach((line, li) => {
      s += `<text x="${textX}" y="${top + AREA + 10 + (li + 1) * QLH - 6}" font-family="${F_BODY}" font-size="${QS}" fill="${C.slate}">${esc(line)}</text>`;
    });
    const midY = y + r.h / 2;
    for (let k = 1; k <= 5; k++) {
      const mx = ansX + (k - 0.5) * colW;
      s += `<circle cx="${n2(mx)}" cy="${n2(midY)}" r="27" fill="#ffffff" stroke="${SAT[k]}" stroke-width="3"/>`;
      s += `<text x="${n2(mx)}" y="${n2(midY + 8)}" text-anchor="middle" font-family="${F_BODY}" font-size="22" font-weight="600" fill="${C.faint}">${k}</text>`;
    }
    y += r.h;
  });
  s += `<line x1="${M}" y1="${tableBottom}" x2="${ansX}" y2="${tableBottom}" stroke="${C.ink}" stroke-width="2"/>`;

  // Footer
  const qr = 200;
  const fy = Math.max(tableBottom + 60, H - M - qr);
  s += qrBlock(W - M - qr, fy, qr, coach);
  s += `<text x="${M}" y="${fy + 44}" font-family="${F_DISPLAY}" font-size="40" font-weight="600" fill="${C.ink}">See your results as a BOSS Compass.</text>`;
  s += `<text x="${M}" y="${fy + 92}" font-family="${F_BODY}" font-size="27" fill="${C.slate}">Scan to take the scorecard online and get your three priority areas.</text>`;
  if (coach) {
    s += `<text x="${M}" y="${fy + 150}" font-family="${F_BODY}" font-size="25" font-weight="600" fill="${C.ink}">Your coach<tspan font-weight="400" fill="${C.slate}" dx="18">${esc(coach.name)}${coach.business ? `  ·  ${esc(coach.business)}` : ""}</tspan></text>`;
    s += `<text x="${M}" y="${fy + 190}" font-family="${F_BODY}" font-size="25" font-weight="600" fill="${C.vision}">${esc(coach.displayUrl)}</text>`;
  } else {
    s += `<text x="${M}" y="${fy + 160}" font-family="${F_BODY}" font-size="25" font-weight="600" fill="${C.ink}">Your coach<tspan font-weight="400" fill="${C.muted}" dx="18">Name  ·  phone  ·  email</tspan></text>`;
  }

  return svgDoc({ w: 210, h: 297, unit: "mm", viewBox: `0 0 ${W} ${H}`, title: coach ? `BOSS Scorecard (A4) for ${coach.name}` : "BOSS Scorecard (A4)", body: s });
}

/** Pull-up banner concept, 850 x 2000 mm (1 unit = 1 mm). */
export function banner({ idp = "bn", coach = null } = {}) {
  const W = 850, H = 2000;
  let s = `<defs>${gradientDef(`${idp}-grad`)}</defs><rect width="${W}" height="${H}" fill="#ffffff"/>`;
  s += logo((W - 440) / 2, 110, 440, idp);
  s += `<text x="${W / 2}" y="330" text-anchor="middle" font-family="${F_DISPLAY}" font-size="92" font-weight="600" letter-spacing="-1.8" fill="${C.ink}">What's your</text>`;
  s += `<text x="${W / 2}" y="432" text-anchor="middle" font-family="${F_DISPLAY}" font-size="92" font-weight="600" letter-spacing="-1.8" fill="${C.vision}">BOSS Score?</text>`;
  s += `<text x="${W / 2}" y="510" text-anchor="middle" font-family="${F_BODY}" font-size="30" fill="${C.slate}">Rate your business on Vision, Velocity and Value.</text>`;
  s += `<text x="${W / 2}" y="552" text-anchor="middle" font-family="${F_BODY}" font-size="30" fill="${C.slate}">See what it gives you in Money, Time and Team.</text>`;
  s += place(compass({ style: "rings", scores: EXAMPLE_SCORES, idp: `${idp}-c` }), 35, 590, 780);
  s += scaleStrip({ x: 60, y: 1400, w: 730, h: 140, idp: `${idp}-strip`, labelSize: 22, showNumbers: false, radius: 18 });
  s += `<rect x="0" y="1610" width="${W}" height="${H - 1610}" fill="url(#${idp}-grad)"/>`;
  s += `<text x="60" y="1712" font-family="${F_DISPLAY}" font-size="56" font-weight="600" letter-spacing="-1" fill="#ffffff">Take the free</text>`;
  s += `<text x="60" y="1772" font-family="${F_DISPLAY}" font-size="56" font-weight="600" letter-spacing="-1" fill="#ffffff">scorecard.</text>`;
  s += `<text x="60" y="1830" font-family="${F_BODY}" font-size="25" fill="#ffffff" fill-opacity="0.85">Scan the code. Get your BOSS Compass</text>`;
  s += `<text x="60" y="1864" font-family="${F_BODY}" font-size="25" fill="#ffffff" fill-opacity="0.85">and your three priority areas.</text>`;
  s += `<text x="60" y="1938" font-family="${F_BODY}" font-size="24" font-weight="600" fill="#ffffff">Your coach<tspan font-weight="400" fill-opacity="0.8" dx="14">${coach ? esc(coach.name) : "Name  ·  phone"}</tspan></text>`;
  s += qrBlock(W - 60 - 200, 1676, 200, coach, { onDark: true });
  return svgDoc({ w: 850, h: 2000, unit: "mm", viewBox: `0 0 ${W} ${H}`, title: "BOSS Score pull-up banner (850 x 2000 mm)", body: s });
}
