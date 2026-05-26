/** Boss Pro (50-question) assessment intro screen. */
export const BOSS_PRO_INTRO = {
  titleAssessment: "Full diagnostic",
  subtitle:
    "Score how your business runs across 50 questions in the five BOSS levels and get a score out of 100.",
  instruction: "Tap No, Partially, or Yes for each question.",
  ratingLegend: [
    { label: "No", hint: "Not in place" },
    { label: "Partially", hint: "Partly in place" },
    { label: "Yes", hint: "Fully in place" },
  ] as const,
  whatYouGetDetailsLabel: "What you'll get",
  whatYouGetBullets: [
    "A score out of 100 across all five BOSS levels.",
    "A clear picture of what's working and where you're stuck.",
    "Level-by-level breakdown to prioritise what to fix first.",
    "A foundation for deeper coaching on your business operating system.",
  ],
  startCta: "Start assessment",
} as const;
