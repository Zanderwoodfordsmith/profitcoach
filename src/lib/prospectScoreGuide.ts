/** Coach-facing copy for impact, urgency, and ease levels. */

export type ProspectDimensionKey = "impact" | "urgency" | "ease";

export type ProspectScoreGuideSection = {
  label: string;
  body: string;
};

const IMPACT_LEVELS: Record<number, string> = {
  3: "One of the few fixes that would actually change the business. They would feel it in profit, time, or control.",
  2: "A real improvement, but the business still works if this waits behind something bigger.",
  1: "Useful, but they would barely notice it next to the other gaps.",
};

const URGENCY_LEVELS: Record<number, string> = {
  4: "Waiting has a cost this month. Cash, a client, a person, or the owner is already paying for the delay.",
  3: "Not on fire, but it should not sit for a quarter. The cost of waiting is already visible.",
  2: "It belongs in the plan. Nothing breaks if it waits a few weeks.",
  1: "It can sit. Leaving it does not cost much right now.",
};

const EASE_LEVELS: Record<number, string> = {
  3: "They can start this week. The people, the information, and the decision are already there.",
  2: "Doable, but it needs time, a person, or a decision they have not made yet.",
  1: "A heavy lift. It needs a new skill, a hire, or a real change in how the work gets done.",
};

const DIMENSION_GUIDE: Record<
  ProspectDimensionKey,
  { meaning: string; howToExplain: string; levels: Record<number, string> }
> = {
  impact: {
    meaning:
      "How much difference this playbook would make for this client — in profit, in their time, or in how much they still have to hold the business together.",
    howToExplain:
      "“If we only fixed this, would the business feel different? High means yes, clearly. Medium means it helps. Low means it is nice, not necessary.”",
    levels: IMPACT_LEVELS,
  },
  urgency: {
    meaning: "How soon it matters if they leave it, and what the wait would cost.",
    howToExplain:
      "“If we left this for 90 days, what would it cost you? If you would feel it this month, that is urgent. If nothing much happens, it is low.”",
    levels: URGENCY_LEVELS,
  },
  ease: {
    meaning:
      "How doable this is with the people, information, and decisions they already have — and how heavy the lift is.",
    howToExplain:
      "“Could you start this in the next two weeks without a new hire or a big project? If yes, it is easy. If it needs a push, it is medium. If it needs a new person or a new way of working, it is hard.”",
    levels: EASE_LEVELS,
  },
};

const IMPACT_LABELS: Record<number, string> = { 3: "High", 2: "Medium", 1: "Low" };
const URGENCY_LABELS: Record<number, string> = {
  4: "Urgent",
  3: "High",
  2: "Normal",
  1: "Low",
};
const EASE_LABELS: Record<number, string> = { 3: "Easy", 2: "Medium", 1: "Hard" };

const LEVEL_LABELS: Record<ProspectDimensionKey, Record<number, string>> = {
  impact: IMPACT_LABELS,
  urgency: URGENCY_LABELS,
  ease: EASE_LABELS,
};

const LEVEL_ORDER: Record<ProspectDimensionKey, number[]> = {
  impact: [3, 2, 1],
  urgency: [4, 3, 2, 1],
  ease: [3, 2, 1],
};

export function prospectLevelExplanation(
  dimension: ProspectDimensionKey,
  level: number
): string | null {
  return DIMENSION_GUIDE[dimension].levels[level] ?? null;
}

export function prospectDimensionGuideSections(
  dimension: ProspectDimensionKey
): ProspectScoreGuideSection[] {
  const guide = DIMENSION_GUIDE[dimension];
  const labels = LEVEL_LABELS[dimension];
  return [
    { label: "What it means", body: guide.meaning },
    ...LEVEL_ORDER[dimension].map((level) => ({
      label: labels[level] ?? String(level),
      body: guide.levels[level] ?? "",
    })),
    { label: "How to explain it", body: guide.howToExplain },
  ];
}
