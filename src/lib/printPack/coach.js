// Per-coach assets: everything carries the coach's own QR code to their scorecard link.
import QRCode from "qrcode";
import { C, D, SAT, PASTEL, F_DISPLAY, F_BODY, esc, n2, svgDoc, logo, place, gradientDef, wrap, arcLabel } from "./brand.js";
import { compass, EXAMPLE_SCORES } from "./compass.js";
import { qrBlock } from "./scorecard.js";
import { bossWheelBanded, EXAMPLE_AREA_SCORES } from "./wheel.js";
import { LEVEL_DESCRIPTIONS } from "../bossScorecardCopy";
import * as SC from "../bossScorecardColors";


export const SITE_ORIGIN = "https://www.theprofitcoach.com";

/**
 * input: { name, business?, slug, avatarDataUri? }
 * link "assessment": /assessment/{slug}, straight into the questions (buildPersonalisedAssessmentLink without contact params).
 * link "score":      /score/{slug}, the landing page that explains the scorecard first (src/app/score/[coachSlug]).
 */
export async function makeCoach(input, { link = "assessment" } = {}) {
  const url = `${SITE_ORIGIN}/${link === "score" ? "score" : "assessment"}/${encodeURIComponent(input.slug)}`;
  // The code carries a tag so a scan shows as "via QR code"; the printed address stays clean.
  const raw = await QRCode.toString(`${url}?utm_source=qr&utm_medium=print&utm_campaign=print-pack`, { type: "svg", margin: 0, errorCorrectionLevel: "M", color: { dark: C.ink, light: "#0000" } });
  const viewBox = raw.match(/viewBox="([^"]+)"/)[1];
  const body = raw.replace(/^[\s\S]*?<svg[^>]*>/, "").replace(/<\/svg>\s*$/, "");
  return { ...input, link, url, displayUrl: url.replace(/^https:\/\/www\./, ""), qr: { viewBox, body } };
}

function avatar(x, y, size, coach, idp) {
  if (!coach.avatarDataUri) return "";
  const r = size / 2;
  return `<defs><clipPath id="${idp}-av"><circle cx="${n2(x + r)}" cy="${n2(y + r)}" r="${n2(r)}"/></clipPath></defs>` +
    `<image href="${coach.avatarDataUri}" x="${n2(x)}" y="${n2(y)}" width="${n2(size)}" height="${n2(size)}" preserveAspectRatio="xMidYMid slice" clip-path="url(#${idp}-av)"/>` +
    `<circle cx="${n2(x + r)}" cy="${n2(y + r)}" r="${n2(r)}" fill="none" stroke="#ffffff" stroke-width="4"/>`;
}

/** 1080 x 1080 social post: "What's your BOSS Score?" with the coach's QR. */
export function socialSquare(coach, { idp = "sq" } = {}) {
  const W = 1080, H = 1080;
  let s = `<rect width="${W}" height="${H}" fill="#ffffff"/>`;
  s += logo(80, 78, 290, idp);
  s += `<text x="80" y="256" font-family="${F_DISPLAY}" font-size="80" font-weight="600" letter-spacing="-2" fill="${C.ink}">What's your</text>`;
  s += `<text x="80" y="344" font-family="${F_DISPLAY}" font-size="80" font-weight="600" letter-spacing="-2" fill="${C.vision}">BOSS Score?</text>`;
  s += `<text x="80" y="410" font-family="${F_BODY}" font-size="28" fill="${C.slate}">13 questions. Free. Get your BOSS Compass</text>`;
  s += `<text x="80" y="448" font-family="${F_BODY}" font-size="28" fill="${C.slate}">and your three priority areas.</text>`;
  s += place(compass({ style: "rings", scores: EXAMPLE_SCORES, idp: `${idp}-c` }), 560, 470, 500);
  s += `<rect x="72" y="532" width="236" height="236" rx="22" fill="#ffffff" stroke="${C.line}" stroke-width="2"/>`;
  s += qrBlock(80, 540, 220, coach);
  s += `<text x="80" y="806" font-family="${F_BODY}" font-size="22" font-weight="600" letter-spacing="2" fill="${C.muted}">SCAN TO START</text>`;
  const avSize = coach.avatarDataUri ? 84 : 0;
  s += avatar(80, 868, avSize, coach, idp);
  const tx = 80 + (avSize ? avSize + 20 : 0);
  s += `<text x="${tx}" y="902" font-family="${F_DISPLAY}" font-size="${coach.name.length > 20 ? 25 : 28}" font-weight="600" fill="${C.ink}">${esc(coach.name)}</text>`;
  if (coach.business) s += `<text x="${tx}" y="938" font-family="${F_BODY}" font-size="22" fill="${C.slate}">${esc(coach.business)}</text>`;
  s += `<text x="80" y="1014" font-family="${F_BODY}" font-size="22" font-weight="600" fill="${C.vision}">${esc(coach.displayUrl)}</text>`;
  return svgDoc({ w: W, h: H, viewBox: `0 0 ${W} ${H}`, title: `BOSS Score social post for ${coach.name}`, body: s });
}

/** 1584 x 396 LinkedIn banner. The left 520px stays quiet: LinkedIn puts the profile photo there. */
export function linkedinBanner(coach, { idp = "li", text = null } = {}) {
  const W = 1584, H = 396;
  let s = `<defs><clipPath id="${idp}-clip"><rect width="${W}" height="${H}"/></clipPath>
<linearGradient id="${idp}-bg" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#f6f8fb"/><stop offset="1" stop-color="#eef4fa"/></linearGradient></defs>`;
  s += `<g clip-path="url(#${idp}-clip)"><rect width="${W}" height="${H}" fill="url(#${idp}-bg)"/>`;
  s += place(compass({ style: "rings", scores: EXAMPLE_SCORES, idp: `${idp}-c` }), 1170, -64, 520);
  s += `</g>`;
  // No QR here: people see a LinkedIn banner on the device they would scan with. The link does the job.
  const words = bannerWords(text);
  if (words) s += customWords(words, { x: 560, headingY: 132, size: 52, subYs: [184, 218], subSize: 24, maxW: 540 });
  else {
    s += `<text x="560" y="132" font-family="${F_DISPLAY}" font-size="52" font-weight="600" letter-spacing="-1.2" fill="${C.ink}">What's your <tspan fill="${C.vision}">BOSS Score?</tspan></text>`;
    s += `<text x="560" y="184" font-family="${F_BODY}" font-size="24" fill="${C.slate}">Take my free scorecard. Get your BOSS Compass</text>`;
    s += `<text x="560" y="218" font-family="${F_BODY}" font-size="24" fill="${C.slate}">and your three priority areas.</text>`;
  }
  s += `<text x="560" y="282" font-family="${F_BODY}" font-size="26" font-weight="600" fill="${C.vision}">${esc(coach.displayUrl)}</text>`;
  s += logo(560, 318, 200, idp);
  return svgDoc({ w: W, h: H, viewBox: `0 0 ${W} ${H}`, title: `LinkedIn banner for ${coach.name}`, body: s });
}

// ---------------------------------------------------------------------------------------------
// More coach assets. Copy reuses what the live landing page already promises:
// "It only takes 3 minutes", "One score out of 100 and your owner level",
// "Your top focus areas and what to work on first" (src/app/landing, src/lib/bossScorecardCopy.ts).
// ---------------------------------------------------------------------------------------------

const DEEP = SC.BOSS_SCORE_SATURATED_DEEP;
const LEVEL_NAME = Object.fromEntries(D.LEVELS.map((l) => [l.id, l.name]));
const LEVEL_KEY = { 1: "Overwhelmed", 2: "Overworked", 3: "Organised", 4: "Overseer", 5: "Owner" };

/** Avatar + name + business. Returns the svg; text sits to the right of the photo. */
function coachLine(coach, x, y, { idp, size = 72, dark = false, nameSize = 26 } = {}) {
  const av = coach.avatarDataUri ? size : 0;
  let s = avatar(x, y, av, coach, idp);
  const tx = x + (av ? av + 18 : 0);
  const fitName = coach.name.length > 20 ? nameSize - 2 : nameSize;
  s += `<text x="${n2(tx)}" y="${n2(y + size * 0.46)}" font-family="${F_DISPLAY}" font-size="${fitName}" font-weight="600" fill="${dark ? "#ffffff" : C.ink}">${esc(coach.name)}</text>`;
  if (coach.business) s += `<text x="${n2(tx)}" y="${n2(y + size * 0.46 + nameSize * 1.15)}" font-family="${F_BODY}" font-size="${Math.round(nameSize * 0.8)}" fill="${dark ? "#ffffff" : C.slate}"${dark ? ` fill-opacity="0.8"` : ""}>${esc(coach.business)}</text>`;
  return s;
}

const urlText = (coach, x, y, size, color = C.vision) =>
  `<text x="${n2(x)}" y="${n2(y)}" font-family="${F_BODY}" font-size="${size}" font-weight="600" fill="${color}">${esc(coach.displayUrl)}</text>`;

/** 1080 x 1080: "What would your business score?" Empty dial in the five level colours, for people to guess. */
export function socialGuess(coach, { idp = "sg" } = {}) {
  const W = 1080, H = 1080;
  let s = `<rect width="${W}" height="${H}" fill="#ffffff"/>`;
  s += logo(80, 76, 260, idp);
  s += `<text x="80" y="236" font-family="${F_DISPLAY}" font-size="74" font-weight="600" letter-spacing="-1.8" fill="${C.ink}">What would your</text>`;
  s += `<text x="80" y="318" font-family="${F_DISPLAY}" font-size="74" font-weight="600" letter-spacing="-1.8" fill="${C.vision}">business score?</text>`;
  s += `<text x="80" y="376" font-family="${F_BODY}" font-size="28" fill="${C.slate}">Take a guess. Then find out in 3 minutes.</text>`;
  const gx = 540, gy = 664, R = 184, SW = 36;
  for (let k = 1; k <= 5; k++) {
    const a0 = -90 + (k - 1) * 72 + 1.2, a1 = -90 + k * 72 - 1.2;
    const p = (a) => `${n2(gx + R * Math.cos((a * Math.PI) / 180))} ${n2(gy + R * Math.sin((a * Math.PI) / 180))}`;
    s += `<path d="M ${p(a0)} A ${R} ${R} 0 0 1 ${p(a1)}" fill="none" stroke="${SAT[k]}" stroke-width="${SW}"/>`;
    s += arcLabel({ id: `${idp}-lv${k}`, cx: gx, cy: gy, r: R + SW / 2 + 24, aCenter: (a0 + a1) / 2, span: 70, str: LEVEL_NAME[k], size: 18, weight: 600, fill: DEEP[k], family: F_BODY });
    if (k > 1) {
      const a = ((-90 + (k - 1) * 72) * Math.PI) / 180, rr = R - SW / 2 - 20;
      s += `<text x="${n2(gx + rr * Math.cos(a))}" y="${n2(gy + rr * Math.sin(a) + 6)}" text-anchor="middle" font-family="${F_BODY}" font-size="16" font-weight="600" fill="${C.muted}">${(k - 1) * 20}</text>`;
    }
  }
  s += `<text x="${gx}" y="${gy + 46}" text-anchor="middle" font-family="${F_DISPLAY}" font-size="150" font-weight="700" fill="${C.ink}">?</text>`;
  s += `<text x="${gx}" y="${gy + 90}" text-anchor="middle" font-family="${F_BODY}" font-size="22" font-weight="600" fill="${C.muted}">out of 100</text>`;
  s += coachLine(coach, 80, 920, { idp, size: 76 });
  s += urlText(coach, 80, 1040, 22);
  s += qrBlock(866, 866, 150, coach);
  return svgDoc({ w: W, h: H, viewBox: `0 0 ${W} ${H}`, title: `What would your business score? (${coach.name})`, body: s });
}

/** 1080 x 1350: the five levels as a climb, with the scorecard's own one-line descriptions. */
export function socialLevels(coach, { idp = "sl" } = {}) {
  const W = 1080, H = 1350;
  let s = `<rect width="${W}" height="${H}" fill="#ffffff"/>`;
  s += logo(80, 76, 260, idp);
  s += `<text x="80" y="226" font-family="${F_DISPLAY}" font-size="72" font-weight="600" letter-spacing="-1.8" fill="${C.ink}">Which level is</text>`;
  s += `<text x="80" y="306" font-family="${F_DISPLAY}" font-size="72" font-weight="600" letter-spacing="-1.8" fill="${C.vision}">your business at?</text>`;
  const top = 368, rowH = 128, gap = 12, x = 80, w = 920, blockW = 124;
  for (let r = 0; r < 5; r++) {
    const lv = 5 - r;
    const y = top + r * (rowH + gap);
    s += `<rect x="${x}" y="${y}" width="${w}" height="${rowH}" rx="20" fill="${PASTEL[lv]}" fill-opacity="0.4"/>`;
    s += `<rect x="${x}" y="${y}" width="${blockW}" height="${rowH}" rx="20" fill="${SAT[lv]}"/><rect x="${x + blockW - 20}" y="${y}" width="20" height="${rowH}" fill="${SAT[lv]}"/>`;
    s += `<text x="${x + blockW / 2}" y="${y + 46}" text-anchor="middle" font-family="${F_BODY}" font-size="15" font-weight="600" letter-spacing="2" fill="${C.face}" fill-opacity="0.7">LEVEL</text>`;
    s += `<text x="${x + blockW / 2}" y="${y + 100}" text-anchor="middle" font-family="${F_DISPLAY}" font-size="54" font-weight="700" fill="${C.face}">${lv}</text>`;
    s += `<text x="${x + blockW + 30}" y="${y + 50}" font-family="${F_DISPLAY}" font-size="34" font-weight="600" fill="${C.ink}">${esc(LEVEL_NAME[lv])}</text>`;
    wrap(LEVEL_DESCRIPTIONS[LEVEL_KEY[lv]], 22, w - blockW - 60, 0.46).forEach((line, li) => {
      s += `<text x="${x + blockW + 30}" y="${y + 86 + li * 28}" font-family="${F_BODY}" font-size="22" fill="${C.slate}">${esc(line)}</text>`;
    });
  }
  s += `<text x="80" y="1110" font-family="${F_DISPLAY}" font-size="36" font-weight="600" letter-spacing="-0.6" fill="${C.ink}">Find yours in 3 minutes.</text>`;
  s += `<text x="80" y="1148" font-family="${F_BODY}" font-size="23" fill="${C.slate}">Free BOSS Scorecard. Instant results.</text>`;
  s += coachLine(coach, 80, 1180, { idp, size: 70, nameSize: 25 });
  s += urlText(coach, 80, 1300, 22);
  s += qrBlock(850, 1086, 150, coach);
  return svgDoc({ w: W, h: H, viewBox: `0 0 ${W} ${H}`, title: `Which level is your business at? (${coach.name})`, body: s });
}

/** 1080 x 1920 story. Key content stays inside the middle band that Instagram's top and bottom bars leave clear. */
export function story(coach, { idp = "st" } = {}) {
  const W = 1080, H = 1920;
  let s = `<defs>${gradientDef(`${idp}-g`)}</defs><rect width="${W}" height="${H}" fill="url(#${idp}-g)"/>`;
  s += logo(80, 220, 300, idp, "white");
  ["Are you running", "your business,", "or is it running you?"].forEach((t, i) => {
    s += `<text x="80" y="${420 + i * 98}" font-family="${F_DISPLAY}" font-size="86" font-weight="600" letter-spacing="-2" fill="#ffffff">${t}</text>`;
  });
  s += `<rect x="80" y="690" width="920" height="690" rx="36" fill="#ffffff"/>`;
  s += place(compass({ style: "rings", scores: EXAMPLE_SCORES, idp: `${idp}-c` }), 215, 700, 650);
  ["Your score out of 100", "Your owner level", "The three areas to fix first"].forEach((t, i) => {
    const y = 1462 + i * 58;
    s += `<circle cx="92" cy="${y - 11}" r="7" fill="#7fc8f5"/>`;
    s += `<text x="114" y="${y}" font-family="${F_BODY}" font-size="32" font-weight="500" fill="#ffffff">${t}</text>`;
  });
  s += qrBlock(770, 1418, 230, coach, { onDark: true });
  s += coachLine(coach, 80, 1650, { idp, size: 76, dark: true });
  s += urlText(coach, 80, 1782, 26, "#ffffff");
  return svgDoc({ w: W, h: H, viewBox: `0 0 ${W} ${H}`, title: `BOSS Score story (${coach.name})`, body: s });
}

function bannerFrame(idp, bg) {
  return `<defs><clipPath id="${idp}-clip"><rect width="1584" height="396"/></clipPath>${bg}</defs>`;
}

/** The coach's own banner words: first line is the heading, the next one or two go under it. Null keeps the design's own. */
function bannerWords(text) {
  const lines = String(text ?? "").split("\n").map((l) => l.trim()).filter(Boolean);
  return lines.length ? { heading: lines[0], sub: lines.slice(1, 3) } : null;
}

/** Shrinks a line until it fits the width, roughly. Measured off the default banners: headings run about 0.45 em a character, body text 0.48. */
function fitSize(str, maxW, size, min, perChar) {
  return Math.max(min, Math.min(size, Math.floor(maxW / (Math.max(1, str.length) * perChar))));
}

/** Splits a heading into two lines at the space nearest the middle. */
function splitInTwo(str) {
  const mid = str.length / 2;
  let at = -1;
  for (let i = 0; i < str.length; i++) if (str[i] === " " && (at < 0 || Math.abs(i - mid) < Math.abs(at - mid))) at = i;
  return at < 0 ? [str] : [str.slice(0, at), str.slice(at + 1)];
}

/**
 * The heading at y. Too long for one line at a good size, it takes two lines:
 * growing down (returns how far, so the lines under it can move) or up into the space above.
 */
function headingBlock(str, { x, y, size, maxW, dark = false, grow = "down" }) {
  const line = (t, ty, fs) =>
    `<text x="${x}" y="${n2(ty)}" font-family="${F_DISPLAY}" font-size="${fs}" font-weight="600" letter-spacing="-1" fill="${dark ? "#ffffff" : C.ink}">${esc(t)}</text>`;
  const one = fitSize(str, maxW, size, 30, 0.45);
  const parts = splitInTwo(str);
  if (one >= size * 0.8 || parts.length < 2) return { svg: line(str, y, one), extra: 0 };
  const fs = Math.min(Math.round(size * 0.85), ...parts.map((t) => fitSize(t, maxW, size, 26, 0.45)));
  const gap = Math.round(fs * 1.15);
  const [y1, y2] = grow === "up" ? [y - gap, y] : [y, y + gap];
  return { svg: line(parts[0], y1, fs) + line(parts[1], y2, fs), extra: grow === "up" ? 0 : gap };
}

function headingLine(str, opts) {
  return headingBlock(str, opts).svg;
}

function subLine(str, { x, y, size = 23, maxW, dark = false }) {
  return `<text x="${x}" y="${y}" font-family="${F_BODY}" font-size="${fitSize(str, maxW, size, 18, 0.48)}" fill="${dark ? "#ffffff" : C.slate}"${dark ? ` fill-opacity="0.85"` : ""}>${esc(str)}</text>`;
}

/** The heading, then up to one line under it per y given, all at one size. A two-line heading leaves room for one line under it. */
function customWords(words, { x, headingY, size, subYs, subSize = 23, maxW, dark = false }) {
  const head = headingBlock(words.heading, { x, y: headingY, size, maxW, dark });
  let s = head.svg;
  const ys = head.extra ? subYs.slice(0, 1).map((y) => y + head.extra) : subYs;
  const lines = words.sub.slice(0, ys.length);
  const shared = Math.min(subSize, ...lines.map((line) => fitSize(line, maxW, subSize, 18, 0.48)));
  lines.forEach((line, i) => {
    s += subLine(line, { x, y: ys[i], size: shared, maxW, dark });
  });
  return s;
}

/** LinkedIn banner, light: the benefit up front. */
export function linkedinBannerScore(coach, { idp = "li2", text = null } = {}) {
  let s = bannerFrame(idp, `<linearGradient id="${idp}-bg" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#f6f8fb"/><stop offset="1" stop-color="#eef4fa"/></linearGradient>`);
  s += `<g clip-path="url(#${idp}-clip)"><rect width="1584" height="396" fill="url(#${idp}-bg)"/>`;
  s += place(compass({ style: "classic", scores: EXAMPLE_SCORES, idp: `${idp}-c` }), 1290, -36, 468);
  s += `</g>`;
  const words = bannerWords(text);
  if (words) s += customWords(words, { x: 560, headingY: 128, size: 44, subYs: [178, 210], maxW: 640 });
  else {
    s += `<text x="560" y="128" font-family="${F_DISPLAY}" font-size="44" font-weight="600" letter-spacing="-1" fill="${C.ink}">What would your <tspan fill="${C.vision}">business score?</tspan></text>`;
    s += `<text x="560" y="178" font-family="${F_BODY}" font-size="23" fill="${C.slate}">Score it out of 100 in 3 minutes. See your owner</text>`;
    s += `<text x="560" y="210" font-family="${F_BODY}" font-size="23" fill="${C.slate}">level and the three areas to fix first.</text>`;
  }
  s += urlText(coach, 560, 272, 26);
  s += logo(560, 306, 190, idp);
  return svgDoc({ w: 1584, h: 396, viewBox: "0 0 1584 396", title: `LinkedIn banner, score (${coach.name})`, body: s });
}

/** LinkedIn banner, brand gradient: the landing page's own headline. */
export function linkedinBannerDark(coach, { idp = "li3", text = null } = {}) {
  let s = bannerFrame(idp, gradientDef(`${idp}-bg`, { x1: 0, y1: 0.1, x2: 1, y2: 0.9 }));
  s += `<g clip-path="url(#${idp}-clip)"><rect width="1584" height="396" fill="url(#${idp}-bg)"/>`;
  s += `<circle cx="1440" cy="198" r="236" fill="#ffffff"/>`;
  s += place(compass({ style: "classic", scores: EXAMPLE_SCORES, idp: `${idp}-c` }), 1232, -10, 416);
  s += `</g>`;
  const words = bannerWords(text);
  if (words) s += customWords(words, { x: 540, headingY: 136, size: 42, subYs: [186, 220], subSize: 22, maxW: 560, dark: true });
  else {
    s += `<text x="540" y="116" font-family="${F_DISPLAY}" font-size="42" font-weight="600" letter-spacing="-0.9" fill="#ffffff">Are you running your business,</text>`;
    s += `<text x="540" y="168" font-family="${F_DISPLAY}" font-size="42" font-weight="600" letter-spacing="-0.9" fill="#ffffff">or is it running you?</text>`;
    s += `<text x="540" y="220" font-family="${F_BODY}" font-size="22" fill="#ffffff" fill-opacity="0.85">Find out in 3 minutes with my free BOSS Scorecard.</text>`;
  }
  s += urlText(coach, 540, 278, 26, "#9fd6fa");
  s += logo(540, 310, 190, idp, "white");
  return svgDoc({ w: 1584, h: 396, viewBox: "0 0 1584 396", title: `LinkedIn banner, dark (${coach.name})`, body: s });
}

/** LinkedIn banner: the five levels as chips. */
export function linkedinBannerLevels(coach, { idp = "li4", text = null } = {}) {
  let s = bannerFrame(idp, `<linearGradient id="${idp}-bg" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#ffffff"/><stop offset="1" stop-color="#eef4fa"/></linearGradient>`);
  s += `<g clip-path="url(#${idp}-clip)"><rect width="1584" height="396" fill="url(#${idp}-bg)"/>`;
  s += place(bossWheelBanded({ scores: EXAMPLE_AREA_SCORES, idp: `${idp}-w` }), 1336, -40, 476);
  s += `</g>`;
  const words = bannerWords(text);
  if (words) s += headingLine(words.heading, { x: 560, y: 118, size: 44, maxW: 680, grow: "up" });
  else s += `<text x="560" y="118" font-family="${F_DISPLAY}" font-size="44" font-weight="600" letter-spacing="-1" fill="${C.ink}">Which level is your <tspan fill="${C.vision}">business at?</tspan></text>`;
  for (let k = 1; k <= 5; k++) {
    const x = 560 + (k - 1) * 150;
    s += `<rect x="${x}" y="150" width="140" height="54" rx="27" fill="${SAT[k]}"/>`;
    s += `<text x="${x + 70}" y="184" text-anchor="middle" font-family="${F_DISPLAY}" font-size="19" font-weight="600" fill="${C.face}">${LEVEL_NAME[k]}</text>`;
  }
  if (words?.sub[0]) s += subLine(words.sub[0], { x: 560, y: 252, maxW: 680 });
  else s += `<text x="560" y="252" font-family="${F_BODY}" font-size="23" fill="${C.slate}">Find yours in 3 minutes with my free BOSS Scorecard.</text>`;
  s += urlText(coach, 560, 306, 26);
  s += logo(560, 336, 170, idp);
  return svgDoc({ w: 1584, h: 396, viewBox: "0 0 1584 396", title: `LinkedIn banner, levels (${coach.name})`, body: s });
}

/** 1920 x 1080 Zoom / Teams background. The middle stays clear for the person on camera. */
export function zoomBackground(coach, { idp = "zb" } = {}) {
  const W = 1920, H = 1080;
  let s = `<defs><linearGradient id="${idp}-bg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#f7f9fc"/><stop offset="1" stop-color="#e6eff8"/></linearGradient></defs>`;
  s += `<rect width="${W}" height="${H}" fill="url(#${idp}-bg)"/>`;
  s += logo(80, 72, 320, idp);
  s += place(bossWheelBanded({ scores: EXAMPLE_AREA_SCORES, idp: `${idp}-w` }), 1296, 236, 580);
  s += `<rect x="64" y="806" width="560" height="214" rx="24" fill="#ffffff"/>`;
  s += qrBlock(82, 824, 178, coach);
  s += `<text x="286" y="874" font-family="${F_DISPLAY}" font-size="32" font-weight="600" letter-spacing="-0.6" fill="${C.ink}">What's your</text>`;
  s += `<text x="286" y="912" font-family="${F_DISPLAY}" font-size="32" font-weight="600" letter-spacing="-0.6" fill="${C.vision}">BOSS Score?</text>`;
  s += `<text x="286" y="952" font-family="${F_BODY}" font-size="18" fill="${C.slate}">Scan for my free scorecard.</text>`;
  s += urlText(coach, 286, 986, 17);
  return svgDoc({ w: W, h: H, viewBox: `0 0 ${W} ${H}`, title: `Zoom background (${coach.name})`, body: s });
}

/** 600 x 150 email signature banner (export at 2x). */
export function emailSignature(coach, { idp = "es" } = {}) {
  const W = 600, H = 150;
  let s = `<rect width="${W}" height="${H}" rx="14" fill="#f6f8fb"/>`;
  s += place(compass({ style: "classic", scores: EXAMPLE_SCORES, idp: `${idp}-c` }), 10, 8, 134);
  s += `<text x="160" y="52" font-family="${F_DISPLAY}" font-size="22" font-weight="600" letter-spacing="-0.3" fill="${C.ink}">What would your business score?</text>`;
  s += `<text x="160" y="80" font-family="${F_BODY}" font-size="14" fill="${C.slate}">Take my free BOSS Scorecard. 3 minutes, instant results.</text>`;
  s += urlText(coach, 160, 112, 15);
  return svgDoc({ w: W, h: H, viewBox: `0 0 ${W} ${H}`, title: `Email signature banner (${coach.name})`, body: s });
}
