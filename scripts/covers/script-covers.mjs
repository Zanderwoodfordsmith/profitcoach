// Scripts covers (1536 x 864), in the Vault's glowing line-art style but on BCA light blue to
// teal gradients, with white line art. Usage: node make.mjs <repoRoot> <outDir>
import fs from "node:fs";
import path from "node:path";

const [repo, outDir] = process.argv.slice(2);
const W = 1536;
const H = 864;

let seed = 20261022;
const rand = () => {
  seed = (seed * 1664525 + 1013904223) % 4294967296;
  return seed / 4294967296;
};

function lucide(name) {
  const src = fs.readFileSync(path.join(repo, "node_modules/lucide-react/dist/esm/icons", `${name}.js`), "utf8");
  const arr = src.match(/const __iconNode = (\[[\s\S]*?\]);\n/)[1];
  const nodes = Function(`return ${arr}`)();
  return nodes
    .map(([tag, attrs]) => {
      const a = Object.entries(attrs)
        .filter(([k]) => k !== "key")
        .map(([k, v]) => `${k}="${v}"`)
        .join(" ");
      return `<${tag} ${a}></${tag}>`;
    })
    .join("");
}

/** A lucide icon drawn as glowing white line art. */
function icon(name, cx, cy, size, width = 1.6) {
  const s = size / 24;
  const g = (extra) =>
    `<g transform="translate(${(cx - 12 * s).toFixed(1)} ${(cy - 12 * s).toFixed(1)}) scale(${s.toFixed(3)})" fill="none" stroke="#ffffff" stroke-linecap="round" stroke-linejoin="round" ${extra}>${lucide(name)}</g>`;
  return g(`stroke-width="${(width * 3).toFixed(2)}" opacity="0.35" filter="url(#halo)"`) + g(`stroke-width="${width}"`);
}

/** A glowing white line. */
function line(d, width = 4, opacity = 1, dash = "") {
  const da = dash ? `stroke-dasharray="${dash}"` : "";
  return `<path d="${d}" fill="none" stroke="#ffffff" stroke-width="${width * 3}" stroke-linecap="round" opacity="${(opacity * 0.3).toFixed(2)}" filter="url(#halo)" ${da}/>
<path d="${d}" fill="none" stroke="#ffffff" stroke-width="${width}" stroke-linecap="round" stroke-linejoin="round" opacity="${opacity}" ${da}/>`;
}

function dot(x, y, r, opacity = 1) {
  return `<circle cx="${x}" cy="${y}" r="${r * 4}" fill="#ffffff" opacity="${(opacity * 0.35).toFixed(2)}" filter="url(#halo)"/><circle cx="${x}" cy="${y}" r="${r}" fill="#ffffff" opacity="${opacity}"/>`;
}

/** A frosted round badge with an icon in it. */
function badge(name, cx, cy, r, iconSize = r * 1.05) {
  return `<circle cx="${cx}" cy="${cy}" r="${r}" fill="#ffffff" fill-opacity="0.12" stroke="#ffffff" stroke-opacity="0.75" stroke-width="2.5"/>
${icon(name, cx, cy, iconSize, 1.7)}`;
}

/** Background: a light blue to teal sweep, soft light, a faint dot grid and sparkles. */
function background(from, via, to, lightX, lightY) {
  const grid = [];
  for (let x = 24; x < W; x += 48) for (let y = 24; y < H; y += 48) grid.push(`<circle cx="${x}" cy="${y}" r="1.4" fill="#ffffff" opacity="0.10"/>`);
  const sparkles = Array.from({ length: 60 }, () => {
    const x = rand() * W;
    const y = rand() * H;
    return `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${(0.8 + rand() * 1.8).toFixed(2)}" fill="#ffffff" opacity="${(0.2 + rand() * 0.5).toFixed(2)}"/>`;
  }).join("");
  return `<defs>
  <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
    <stop offset="0" stop-color="${from}"/><stop offset="0.55" stop-color="${via}"/><stop offset="1" stop-color="${to}"/>
  </linearGradient>
  <radialGradient id="light" cx="${lightX}" cy="${lightY}" r="0.55">
    <stop offset="0" stop-color="#ffffff" stop-opacity="0.38"/><stop offset="1" stop-color="#ffffff" stop-opacity="0"/>
  </radialGradient>
  <radialGradient id="vignette" cx="0.5" cy="0.5" r="0.8">
    <stop offset="0.6" stop-color="#062a4a" stop-opacity="0"/><stop offset="1" stop-color="#062a4a" stop-opacity="0.35"/>
  </radialGradient>
  <filter id="halo" x="-100%" y="-100%" width="300%" height="300%"><feGaussianBlur stdDeviation="8"/></filter>
  <filter id="big" x="-60%" y="-60%" width="220%" height="220%"><feGaussianBlur stdDeviation="40"/></filter>
</defs>
<rect width="${W}" height="${H}" fill="url(#bg)"/>
<rect width="${W}" height="${H}" fill="url(#light)"/>
${grid.join("")}
${sparkles}
<rect width="${W}" height="${H}" fill="url(#vignette)"/>`;
}

const CX = W / 2;
const CY = H / 2;

const covers = {
  // A paper plane leaving trails that fan out to owners.
  "reach-out": () => {
    const px = 470;
    const py = 470;
    const targets = [
      [1060, 200, "building-2"],
      [1180, 420, "store"],
      [1090, 650, "factory"],
    ];
    const trails = targets
      .map(([x, y], i) => line(`M ${px + 70} ${py - 20} C ${px + 260} ${py - 120 + i * 60}, ${x - 280} ${y + 10}, ${x - 70} ${y}`, 3, 0.85, "2 16"))
      .join("");
    const ends = targets.map(([x, y, n]) => badge(n, x, y, 62)).join("");
    return `${background("#0c5290", "#1a8fd4", "#2dd4c4", 0.35, 0.45)}
<circle cx="${px}" cy="${py}" r="210" fill="#ffffff" opacity="0.10" filter="url(#big)"/>
${trails}${ends}
${icon("send", px, py, 230, 1.5)}`;
  },

  // A phone ringing: rings spreading out, and a lead arriving.
  "new-lead": () => {
    const rings = [150, 215, 285, 360]
      .map((r, i) => `<circle cx="${CX}" cy="${CY}" r="${r}" fill="none" stroke="#ffffff" stroke-width="${3 - i * 0.5}" opacity="${0.6 - i * 0.13}"/>`)
      .join("");
    return `${background("#0f4c81", "#1483c8", "#22b8c9", 0.5, 0.45)}
<circle cx="${CX}" cy="${CY}" r="230" fill="#ffffff" opacity="0.12" filter="url(#big)"/>
${rings}
<circle cx="${CX}" cy="${CY}" r="115" fill="#ffffff" fill-opacity="0.14" stroke="#ffffff" stroke-width="3"/>
${icon("phone-incoming", CX, CY, 130, 1.6)}
${badge("user-round", CX + 270, CY - 200, 52)}
${line(`M ${CX + 222} ${CY - 170} Q ${CX + 170} ${CY - 120} ${CX + 120} ${CY - 92}`, 3, 0.8, "2 14")}
${dot(CX - 330, CY + 120, 5, 0.9)}${dot(CX + 360, CY + 150, 4, 0.8)}`;
  },

  // The score: a ten-segment wheel with a needle pointing at the one constraint.
  review: () => {
    const r1 = 250;
    const r0 = 150;
    const segs = Array.from({ length: 10 }, (_, i) => {
      const gap = 0.05;
      const a0 = -Math.PI / 2 + (i * 2 * Math.PI) / 10 + gap;
      const a1 = -Math.PI / 2 + ((i + 1) * 2 * Math.PI) / 10 - gap;
      const fill = [0.9, 0.55, 0.75, 0.35, 0.8, 0.6, 0.18, 0.7, 0.5, 0.65][i];
      const rf = r0 + (r1 - r0) * fill;
      const arc = (r, a, b) => `${(CX + r * Math.cos(a)).toFixed(1)} ${(CY + r * Math.sin(a)).toFixed(1)}`;
      const outline = `M ${arc(r0, a0)} L ${arc(r1, a0)} A ${r1} ${r1} 0 0 1 ${arc(r1, a1)} L ${arc(r0, a1)} A ${r0} ${r0} 0 0 0 ${arc(r0, a0)} Z`;
      const filled = `M ${arc(r0, a0)} L ${arc(rf, a0)} A ${rf} ${rf} 0 0 1 ${arc(rf, a1)} L ${arc(r0, a1)} A ${r0} ${r0} 0 0 0 ${arc(r0, a0)} Z`;
      const weak = i === 6;
      return `<path d="${filled}" fill="#ffffff" opacity="${weak ? 0.15 : 0.32}"/>
<path d="${outline}" fill="none" stroke="#ffffff" stroke-width="${weak ? 4 : 2.2}" opacity="${weak ? 1 : 0.75}"/>
${weak ? `<path d="${outline}" fill="none" stroke="#ffffff" stroke-width="14" opacity="0.35" filter="url(#halo)"/>` : ""}`;
    }).join("");
    const na = -Math.PI / 2 + (6.5 * 2 * Math.PI) / 10;
    const nx = CX + 205 * Math.cos(na);
    const ny = CY + 205 * Math.sin(na);
    return `${background("#0a3d6e", "#0c5290", "#14a3b8", 0.5, 0.5)}
<circle cx="${CX}" cy="${CY}" r="300" fill="#ffffff" opacity="0.12" filter="url(#big)"/>
${segs}
<circle cx="${CX}" cy="${CY}" r="${r1 + 32}" fill="none" stroke="#ffffff" stroke-width="1.5" opacity="0.4" stroke-dasharray="3 12"/>
${line(`M ${CX} ${CY} L ${nx.toFixed(1)} ${ny.toFixed(1)}`, 5, 1)}
<circle cx="${CX}" cy="${CY}" r="58" fill="#0c5290" fill-opacity="0.5" stroke="#ffffff" stroke-width="3"/>
${icon("gauge", CX, CY, 62, 1.8)}
${dot(nx.toFixed(1), ny.toFixed(1), 7, 1)}`;
  },

  // A winding road through milestones to a flag.
  roadmap: () => {
    const road = "M 240 760 C 420 760, 420 560, 640 560 S 900 380, 1060 380 S 1260 220, 1300 170";
    const stops = [
      [460, 668],
      [760, 520],
      [1060, 380],
    ];
    return `${background("#0c5290", "#1673b8", "#1fb5b0", 0.6, 0.35)}
<path d="${road}" fill="none" stroke="#ffffff" stroke-width="70" opacity="0.10" stroke-linecap="round"/>
${line(road, 5, 0.95)}
<path d="${road}" fill="none" stroke="#ffffff" stroke-width="2" opacity="0.55" stroke-dasharray="14 18"/>
${stops.map(([x, y], i) => `<circle cx="${x}" cy="${y}" r="34" fill="${["#1a64a6", "#1f78b4", "#2189b3"][i]}" stroke="#ffffff" stroke-width="3"/><text x="${x}" y="${y + 10}" text-anchor="middle" font-family="Helvetica, Arial" font-size="28" font-weight="600" fill="#ffffff">${i + 1}</text>`).join("")}
<circle cx="1300" cy="150" r="140" fill="#ffffff" opacity="0.18" filter="url(#big)"/>
${icon("flag", 1318, 120, 120, 1.6)}
${icon("map", 300, 220, 110, 1.4)}
${dot(1300, 170, 6, 1)}`;
  },

  // A calendar with a missed day moved to a new one.
  "no-shows": () => {
    const x0 = CX - 250;
    const y0 = CY - 190;
    const cw = 100;
    const ch = 78;
    const cells = [];
    for (let r = 0; r < 4; r += 1)
      for (let c = 0; c < 5; c += 1) {
        const x = x0 + c * cw;
        const y = y0 + 110 + r * ch;
        cells.push(`<rect x="${x + 8}" y="${y + 8}" width="${cw - 16}" height="${ch - 16}" rx="12" fill="#ffffff" fill-opacity="0.08" stroke="#ffffff" stroke-opacity="0.35" stroke-width="1.5"/>`);
      }
    const from = [x0 + cw * 1 + cw / 2, y0 + 110 + ch * 1 + ch / 2];
    const to = [x0 + cw * 3 + cw / 2, y0 + 110 + ch * 2 + ch / 2];
    return `${background("#0f4c81", "#1a8fd4", "#2dd4c4", 0.45, 0.4)}
<circle cx="${CX}" cy="${CY}" r="300" fill="#ffffff" opacity="0.10" filter="url(#big)"/>
<rect x="${x0 - 20}" y="${y0}" width="${cw * 5 + 40}" height="${110 + ch * 4 + 20}" rx="34" fill="#ffffff" fill-opacity="0.10" stroke="#ffffff" stroke-width="3"/>
${line(`M ${x0 - 20} ${y0 + 90} L ${x0 + cw * 5 + 20} ${y0 + 90}`, 2.5, 0.7)}
${line(`M ${x0 + 110} ${y0 - 26} L ${x0 + 110} ${y0 + 34}`, 6, 1)}${line(`M ${x0 + cw * 5 - 110} ${y0 - 26} L ${x0 + cw * 5 - 110} ${y0 + 34}`, 6, 1)}
${cells.join("")}
<circle cx="${from[0]}" cy="${from[1]}" r="24" fill="none" stroke="#ffffff" stroke-width="2.5" stroke-dasharray="4 7" opacity="0.8"/>
${line(`M ${from[0] + 26} ${from[1] - 10} C ${from[0] + 110} ${from[1] - 90}, ${to[0] - 40} ${to[1] - 120}, ${to[0]} ${to[1] - 34}`, 3.5, 1)}
${line(`M ${to[0] - 14} ${to[1] - 50} L ${to[0]} ${to[1] - 32} L ${to[0] + 18} ${to[1] - 48}`, 3.5, 1)}
<circle cx="${to[0]}" cy="${to[1]}" r="26" fill="#ffffff" opacity="0.95"/>
<circle cx="${to[0]}" cy="${to[1]}" r="60" fill="#ffffff" opacity="0.35" filter="url(#halo)"/>
${badge("clock", x0 + cw * 5 + 70, y0 + 10, 64)}`;
  },

  // Two speech bubbles: their question, your calm answer.
  objections: () => {
    const bubble = (x, y, w, h, tail) =>
      `M ${x + 40} ${y} H ${x + w - 40} Q ${x + w} ${y} ${x + w} ${y + 40} V ${y + h - 40} Q ${x + w} ${y + h} ${x + w - 40} ${y + h} ${tail} H ${x + 40} Q ${x} ${y + h} ${x} ${y + h - 40} V ${y + 40} Q ${x} ${y} ${x + 40} ${y} Z`;
    const a = bubble(360, 220, 420, 250, `H 520 L 470 540 L 470 ${220 + 250}`);
    const b = bubble(760, 400, 420, 250, `H 1060 L 1060 720 L 1010 650`);
    return `${background("#0a3d6e", "#1483c8", "#2dd4c4", 0.5, 0.45)}
<circle cx="${CX}" cy="${CY}" r="320" fill="#ffffff" opacity="0.10" filter="url(#big)"/>
<path d="${a}" fill="#ffffff" fill-opacity="0.10"/>${line(a, 3.5, 0.95)}
<path d="${b}" fill="#ffffff" fill-opacity="0.18"/>${line(b, 3.5, 0.95)}
${icon("circle-question-mark", 570, 345, 120, 1.6)}
${icon("circle-check", 970, 525, 120, 1.6)}
${dot(300, 650, 5, 0.8)}${dot(1260, 250, 5, 0.8)}`;
  },
};

fs.mkdirSync(outDir, { recursive: true });
for (const [name, draw] of Object.entries(covers)) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">${draw()}</svg>`;
  fs.writeFileSync(path.join(outDir, `${name}.html`), `<!doctype html><html><head><meta charset="utf-8"><style>html,body{margin:0}</style></head><body>${svg}</body></html>`);
}
console.log("ok", Object.keys(covers).join(" "));
