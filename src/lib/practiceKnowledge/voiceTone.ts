/**
 * The coach's tone on five sliders, 1 to 5. The writers never see the numbers:
 * each stop is a plain instruction, because "formal: 2" means little to a model.
 * The playful ends stay gentle. These coaches write to business owners.
 */

export const TONE_DIMENSIONS = [
  {
    key: "respect",
    left: "Respectful",
    right: "Irreverent",
    stops: ["Very respectful", "Respectful", "Balanced", "A little cheeky", "Irreverent"],
    say: [
      "Deferential and polite throughout. Never pokes fun at anything.",
      "Polite and considerate. Questions ideas gently.",
      "Respectful, and willing to say plainly when something is nonsense.",
      "A little cheeky about industry habits and clichés, never about the reader.",
      "Happy to poke fun at the way the industry does things and at received wisdom. Never at the reader or their business.",
    ],
  },
  {
    key: "humour",
    left: "Serious",
    right: "Funny",
    stops: ["Serious", "Mostly serious", "A touch of humour", "Light", "Playful"],
    say: [
      "No jokes. Every line is about the point.",
      "Serious, with the odd dry aside.",
      "Mostly serious, with a light line now and then where it fits.",
      "Warm and light. Humour in most messages, never at the expense of the point.",
      "Playful, with humour throughout. Never jokes about the owner's problems or money.",
    ],
  },
  {
    key: "formality",
    left: "Formal",
    right: "Casual",
    stops: ["Formal", "Quite formal", "Balanced", "Quite casual", "Casual"],
    say: [
      "Formal. Full sentences, no contractions, no slang.",
      "Professional. Few contractions, complete sentences.",
      "Plain and professional. Contractions are fine.",
      "Conversational. Contractions, first names, short sentences, no corporate phrases.",
      "Casual, like a message to someone they know. Short lines, everyday words.",
    ],
  },
  {
    key: "energy",
    left: "Matter-of-fact",
    right: "Enthusiastic",
    stops: ["Matter-of-fact", "Calm", "Balanced", "Upbeat", "Enthusiastic"],
    say: [
      "Matter-of-fact. States things and moves on. No exclamation marks.",
      "Calm and measured. Lets the facts carry it.",
      "Even, with warmth where it is earned.",
      "Upbeat and positive. Energy without hype.",
      "Enthusiastic and energetic. Shows excitement, still without hype or exclamation marks in every line.",
    ],
  },
  {
    key: "confidence",
    left: "Modest",
    right: "Bold",
    stops: ["Modest", "Understated", "Assured", "Confident", "Bold"],
    say: [
      "Modest. Suggests rather than claims, and lets proof speak.",
      "Understated. Claims little, backs everything up.",
      "Assured. States what they know plainly.",
      "Confident. Clear opinions and direct claims, backed by proof.",
      "Bold. Strong opinions, direct challenges, no hedging. Never a claim the proof cannot carry.",
    ],
  },
] as const;

export type ToneKey = (typeof TONE_DIMENSIONS)[number]["key"];
export type VoiceTone = Record<ToneKey, number>;

export const TONE_MIDDLE: VoiceTone = { respect: 3, humour: 3, formality: 3, energy: 3, confidence: 3 };

function stop(value: unknown): number | null {
  const n = Math.round(Number(value));
  return Number.isFinite(n) && n >= 1 && n <= 5 ? n : null;
}

/** A tone from stored or model output, or null when nothing usable is there. */
export function asVoiceTone(raw: unknown): VoiceTone | null {
  if (!raw || typeof raw !== "object") return null;
  const rec = raw as Record<string, unknown>;
  let any = false;
  const out = { ...TONE_MIDDLE };
  for (const d of TONE_DIMENSIONS) {
    const v = stop(rec[d.key]);
    if (v != null) {
      out[d.key] = v;
      any = true;
    }
  }
  return any ? out : null;
}

/** The tone as instructions for the writers, one line per slider. */
export function toneInstructions(tone: VoiceTone): string[] {
  return TONE_DIMENSIONS.map((d) => `${d.left} to ${d.right}: ${d.say[tone[d.key] - 1]}`);
}
