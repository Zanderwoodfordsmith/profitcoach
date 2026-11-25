/**
 * Newsletter cover templates: what each one is called and which words it takes.
 * Shared by the cover window (client) and the renderer (server). Word limits
 * follow the thumbnail rule from the cover research: four big words at most.
 */

export const COVER_TEMPLATES = ["behind", "face", "cards", "xtick", "quote"] as const;
export type CoverTemplate = (typeof COVER_TEMPLATES)[number];

export const COVER_BACKGROUNDS = ["mesh", "studio", "sky", "hex", "streaks", "room"] as const;
export type CoverBackground = (typeof COVER_BACKGROUNDS)[number];

export type CoverField = {
  key: string;
  label: string;
  /** Most characters allowed. */
  max: number;
  /** Shown under the box. */
  hint?: string;
};

export const TEMPLATE_INFO: Record<CoverTemplate, { name: string; fields: CoverField[]; example: Record<string, string> }> = {
  behind: {
    name: "Word behind you",
    fields: [
      { key: "word", label: "Big word or number", max: 8, hint: "One word, up to 8 letters" },
      { key: "leftLabel", label: "Left card label", max: 14 },
      { key: "leftValue", label: "Left card number", max: 7 },
      { key: "rightLabel", label: "Right card label", max: 14 },
      { key: "rightValue", label: "Right card number", max: 7 },
    ],
    example: { word: "PROFIT?", leftLabel: "Sales", leftValue: "+40%", rightLabel: "Profit", rightValue: "−12%" },
  },
  face: {
    name: "You and a few words",
    fields: [
      { key: "small", label: "Small line", max: 28 },
      { key: "big", label: "Big words", max: 24, hint: "Up to four words" },
    ],
    example: { small: "About pricing,", big: "I was wrong." },
  },
  cards: {
    name: "Two numbers",
    fields: [
      { key: "topLabel", label: "Top card label", max: 18 },
      { key: "topValue", label: "Top card number", max: 8 },
      { key: "bottomLabel", label: "Bottom card label", max: 18 },
      { key: "bottomValue", label: "Bottom card number", max: 8 },
    ],
    example: { topLabel: "Sales", topValue: "£2.4m", bottomLabel: "Kept", bottomValue: "£148k" },
  },
  xtick: {
    name: "Before and after",
    fields: [
      { key: "before", label: "Before (crossed out)", max: 10 },
      { key: "after", label: "After (ticked)", max: 10 },
    ],
    example: { before: "70 hrs", after: "40 hrs" },
  },
  quote: {
    name: "Quiet quote",
    fields: [
      { key: "small", label: "Small line", max: 30 },
      { key: "big", label: "Big words", max: 26, hint: "Up to four words. The last word is blue." },
    ],
    example: { small: "Every business has one.", big: "Find your constraint." },
  },
};

export const BACKGROUND_INFO: Record<CoverBackground, { name: string; light: boolean; swatch: string }> = {
  mesh: { name: "Deep blue", light: false, swatch: "linear-gradient(135deg,#2F8DE0,#04223f 60%,#4338CA)" },
  studio: { name: "Spotlight", light: false, swatch: "radial-gradient(circle at 50% 0,#6fa9e0,#020a16 70%)" },
  sky: { name: "Light", light: true, swatch: "linear-gradient(135deg,#B9DCFF,#F7FAFD 55%,#DAD4FF)" },
  hex: { name: "Hexagons", light: false, swatch: "linear-gradient(135deg,#0f5aa3,#031a33)" },
  streaks: { name: "Light streaks", light: false, swatch: "linear-gradient(160deg,#020f20 30%,#3FA0FF 50%,#020f20 70%)" },
  room: { name: "Meeting room", light: false, swatch: "linear-gradient(135deg,#5b4a3a,#0b2a4a)" },
};

export type CoverSpec = {
  template: CoverTemplate;
  background: CoverBackground;
  words: Record<string, string>;
  /** Leave the coach's photo off. */
  noPhoto?: boolean;
};

/** Trims words to each field's limit and fills gaps from the example. */
export function cleanSpec(input: unknown): CoverSpec {
  const raw = (input && typeof input === "object" ? input : {}) as Partial<CoverSpec>;
  const template = COVER_TEMPLATES.includes(raw.template as CoverTemplate) ? (raw.template as CoverTemplate) : "behind";
  const background = COVER_BACKGROUNDS.includes(raw.background as CoverBackground) ? (raw.background as CoverBackground) : "mesh";
  const info = TEMPLATE_INFO[template];
  const given = raw.words && typeof raw.words === "object" ? raw.words : {};
  const words: Record<string, string> = {};
  for (const f of info.fields) {
    const v = typeof given[f.key] === "string" ? given[f.key]!.replace(/\s+/g, " ").trim() : info.example[f.key]!;
    words[f.key] = v.slice(0, f.max);
  }
  return { template, background, words, noPhoto: raw.noPhoto === true };
}
