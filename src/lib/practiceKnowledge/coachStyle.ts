/**
 * The kind of coach they are, on the three scales from the Classroom lesson
 * "What is your coaching style": mentor to coach, growth to lifestyle, tough
 * love to nurturing. Stored as plain lines in voice_coaching_style, so every
 * writer that reads that answer reads the scales without knowing about them.
 */

export const COACH_STYLE_DIMENSIONS = [
  {
    key: "mentor",
    left: "Mentor",
    right: "Coach",
    title: "Mentor or coach",
    ends: [
      "You have done it yourself, and you tell owners what worked for you.",
      "You ask questions until the owner finds the answer. It sticks because they found it.",
    ],
    stops: ["Mentor", "Mostly mentor", "Both", "Mostly coach", "Coach"],
    say: [
      "Draws on their own experience and tells owners what worked.",
      "Shares what worked for them, and asks questions too.",
      "Tells owners what worked when it helps, and asks questions when it helps more.",
      "Mostly asks questions so the owner finds the answer, and shares their own view now and then.",
      "Rarely gives their own view. Asks questions until the owner finds the answer.",
    ],
  },
  {
    key: "focus",
    left: "Growth",
    right: "Lifestyle",
    title: "Growth or lifestyle",
    ends: [
      "You help owners grow: more sales, a bigger team, more profit.",
      "The business should serve the owner's life. You speak up when it starts to take over.",
    ],
    stops: ["Growth first", "Mostly growth", "Both", "Mostly lifestyle", "Life first"],
    say: [
      "Focused on growing the business above everything else.",
      "Mostly about growth, with an eye on the owner's life.",
      "Growth and the owner's life count the same.",
      "Thinks about the owner's life as much as the business.",
      "The business should serve the owner's life, not take it over.",
    ],
  },
  {
    key: "warmth",
    left: "Tough love",
    right: "Nurturing",
    title: "Tough love or nurturing",
    ends: [
      "You challenge hard and hold owners to what they said they would do.",
      "You lead with warmth and encouragement, so owners feel safe enough to be honest.",
    ],
    stops: ["Tough love", "Mostly tough love", "Both", "Mostly nurturing", "Nurturing"],
    say: [
      "Challenges hard and holds owners to what they said they would do.",
      "Pushes owners hard, and is on their side.",
      "Pushes when it is needed and encourages when it is needed.",
      "Leads with warmth and encouragement, and still challenges.",
      "Leads with warmth, encouragement and a safe place to be honest.",
    ],
  },
] as const;

export type CoachStyleKey = (typeof COACH_STYLE_DIMENSIONS)[number]["key"];
export type CoachStyle = Record<CoachStyleKey, number>;

export const COACH_STYLE_MIDDLE: CoachStyle = { mentor: 3, focus: 3, warmth: 3 };

/** One line per scale, e.g. "Mentor to Coach: 2 of 5, mostly mentor. Shares what worked for them, and asks questions too." */
export function coachStyleText(style: CoachStyle): string {
  return COACH_STYLE_DIMENSIONS.map((d) => {
    const n = style[d.key];
    return `${d.left} to ${d.right}: ${n} of 5, ${d.stops[n - 1].toLowerCase()}. ${d.say[n - 1]}`;
  }).join("\n");
}

/** The scales back from the stored text, or null when the answer was written by hand. */
export function parseCoachStyle(text: unknown): CoachStyle | null {
  const raw = String(text ?? "");
  const out = { ...COACH_STYLE_MIDDLE };
  for (const d of COACH_STYLE_DIMENSIONS) {
    const match = raw.match(new RegExp(`${d.left} to ${d.right}: ([1-5]) of 5`));
    if (!match) return null;
    out[d.key] = Number(match[1]);
  }
  return out;
}
