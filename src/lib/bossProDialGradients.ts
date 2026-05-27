import { BOSS_FOUNDATION_COLOR } from "./bossData";

/** Unfilled ring track on Boss Pro dials. */
export const BOSS_PRO_RING_TRACK = "#eef2f6";

/** Boss Pro hero dial — dark navy → light brand sky (start → end of arc). */
export const BOSS_PRO_HERO_RING_GRADIENT = {
  stops: [
    { offset: "0%", color: "#073157" },
    { offset: "45%", color: "#0c5290" },
    { offset: "100%", color: "#62b9f7" },
  ],
} as const;

/** Matches Boss Score / Boss Pro wordmark — dark blue → light blue. */
export const BOSS_PRO_HERO_SCORE_TEXT_GRADIENT =
  "linear-gradient(92deg, #0a5291 0%, #36adf4 48%, #62b9f7 100%)";

export type BossPillarDialKey = "foundation" | "vision" | "velocity" | "value";

export type BossPillarDialGradient = {
  /** Label accent (mid-tone). */
  accent: string;
  stops: readonly { offset: string; color: string }[];
};

/** Per-pillar dark → light ring gradients (brand-aligned). */
export const BOSS_PILLAR_DIAL_GRADIENTS: Record<BossPillarDialKey, BossPillarDialGradient> = {
  foundation: {
    accent: BOSS_FOUNDATION_COLOR,
    stops: [
      { offset: "0%", color: "#2f4050" },
      { offset: "50%", color: "#4C667A" },
      { offset: "100%", color: "#c5d0da" },
    ],
  },
  vision: {
    accent: "#0c5290",
    stops: [
      { offset: "0%", color: "#0a5280" },
      { offset: "50%", color: "#0c5290" },
      { offset: "100%", color: "#62b9f7" },
    ],
  },
  velocity: {
    accent: "#42a1ee",
    stops: [
      { offset: "0%", color: "#42a1ee" },
      { offset: "55%", color: "#6bc0f6" },
      { offset: "100%", color: "#94cff7" },
    ],
  },
  value: {
    accent: "#1ca0c2",
    stops: [
      { offset: "0%", color: "#127a8f" },
      { offset: "50%", color: "#1ca0c2" },
      { offset: "100%", color: "#5dcce3" },
    ],
  },
};
