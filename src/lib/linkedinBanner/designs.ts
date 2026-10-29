/**
 * The LinkedIn banners a coach picks from on the Blueprint. Each option is a
 * design (the picture and its colours) plus the words, which the coach edits on
 * the banner itself. Rules and examples: scripts/linkedin-banners/README.md.
 */

export type BannerPicture = "offer" | "score" | "wheel";

export type BannerDesign = {
  id: string;
  picture: BannerPicture;
  dark: boolean;
  /** Colour of the lit-up constraint on the wheel. */
  hot?: "red" | "orange";
};

export const BANNER_DESIGNS: BannerDesign[] = [
  { id: "offer-light", picture: "offer", dark: false },
  { id: "wheel-light", picture: "wheel", dark: false, hot: "red" },
  { id: "wheel-dark", picture: "wheel", dark: true, hot: "red" },
  { id: "offer-dark", picture: "offer", dark: true },
  { id: "wheel-dark-orange", picture: "wheel", dark: true, hot: "orange" },
  { id: "score-light", picture: "score", dark: false },
];

export function bannerDesign(id: string): BannerDesign {
  return BANNER_DESIGNS.find((d) => d.id === id) ?? BANNER_DESIGNS[0];
}

/** The words on a banner. The bold line ends with the accent, in colour. */
export type BannerWords = {
  eyebrow: string;
  light: string;
  bold: string;
  accent: string;
  cta: string;
  note: string;
};

export type BannerField = keyof BannerWords;

export const BANNER_WORD_LIMITS: Record<BannerField, number> = {
  eyebrow: 80,
  light: 60,
  bold: 60,
  accent: 40,
  cta: 40,
  note: 50,
};

export type BannerOption = { design: string; words: BannerWords };

export const MAX_BANNER_OPTIONS = 12;

const EYEBROW = "For owner-led businesses doing £1M+";
const CTA = { cta: "Get your BOSS Score", note: "Free. Takes 3 minutes." };

/** One good line per design, used for the first set and for each new version. */
const LINES: Record<string, Pick<BannerWords, "light" | "bold" | "accent">> = {
  "offer-light": { light: "Fix the right things", bold: "in the ", accent: "right order." },
  "wheel-light": { light: "Every business has", bold: "one constraint. ", accent: "Find yours." },
  "wheel-dark": { light: "Does it all still", bold: "come back to ", accent: "you?" },
  "offer-dark": { light: "Off for a month?", bold: "", accent: "What would break?" },
  "wheel-dark-orange": { light: "Find the one thing", bold: "holding you ", accent: "back." },
  "score-light": { light: "Good ideas.", bold: "", accent: "Wrong order." },
};

export function defaultBannerOption(designId: string): BannerOption {
  const design = bannerDesign(designId);
  return { design: design.id, words: { eyebrow: EYEBROW, ...LINES[design.id], ...CTA } };
}

export function defaultBannerOptions(): BannerOption[] {
  return BANNER_DESIGNS.map((d) => defaultBannerOption(d.id));
}

/** The next design to offer as "another version": one not used yet, else the next in turn. */
export function nextBannerDesign(options: BannerOption[], current: string): string {
  const unused = BANNER_DESIGNS.find((d) => !options.some((o) => o.design === d.id));
  if (unused) return unused.id;
  const at = BANNER_DESIGNS.findIndex((d) => d.id === current);
  return BANNER_DESIGNS[(at + 1) % BANNER_DESIGNS.length].id;
}

/** Keeps saved options safe: known designs, every word a short string. */
export function sanitizeBannerOptions(value: unknown): BannerOption[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const out: BannerOption[] = [];
  for (const raw of value.slice(0, MAX_BANNER_OPTIONS)) {
    if (!raw || typeof raw !== "object") continue;
    const rec = raw as Record<string, unknown>;
    if (typeof rec.design !== "string" || !BANNER_DESIGNS.some((d) => d.id === rec.design)) continue;
    const wordsIn = (rec.words && typeof rec.words === "object" ? rec.words : {}) as Record<string, unknown>;
    const words = {} as BannerWords;
    for (const field of Object.keys(BANNER_WORD_LIMITS) as BannerField[]) {
      const v = wordsIn[field];
      words[field] = typeof v === "string" ? v.replace(/\s*\n\s*/g, " ").slice(0, BANNER_WORD_LIMITS[field]) : "";
    }
    out.push({ design: rec.design, words });
  }
  return out;
}
