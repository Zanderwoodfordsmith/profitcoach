/**
 * Owner-language copy for the Profit System graphics. Kept free of React and path
 * aliases so both the app (profitSystemData) and the print pack (src/lib/printPack,
 * scripts/print-pack) read the same words.
 */

export type PillarKeyCopy = "vision" | "velocity" | "value";

export const PILLAR_TAGLINES: Record<PillarKeyCopy, string> = {
  vision: "Clarity about the future",
  velocity: "Speed of profit & growth",
  value: "Long-term value of the business",
};

/** Area id (1-9) -> transformation, "from" side and "to" side. */
export const AREA_TRANSFORMATIONS: Record<number, { from: string; to: string }> = {
  1: { from: "Foggy future", to: "Clear direction" },
  2: { from: "Busy tactics", to: "Deliberate strategy" },
  3: { from: "Endless to-dos", to: "90-day rhythm" },
  4: { from: "Tight cash", to: "Reliable margin" },
  5: { from: "Feast or famine", to: "Predictable demand" },
  6: { from: "Owner-dependent", to: "Runs without you" },
  7: { from: "Gut feel", to: "Numbers you trust" },
  8: { from: "Daily heroics", to: "Repeatable systems" },
  9: { from: "Doing it all", to: "Team runs the machine" },
};
