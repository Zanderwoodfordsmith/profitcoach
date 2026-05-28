export type LandingHeroHeadlineVariant = "d" | "b";

/** Brighter hero gradient (blue → cyan → violet). */
export const LANDING_HERO_GRADIENT =
  "linear-gradient(81deg, rgb(48, 168, 238) 0.6%, rgb(108, 214, 255) 52%, rgb(220, 188, 255) 91%)";

/** Hero H1 letter-spacing — less tight than the original Figma export. */
export const LANDING_HERO_HEADLINE_TRACKING = "tracking-[-0.03em]";

export type LandingHeroHeadlineParts = {
  lead: string;
  gradient: string;
};

export function getLandingHeroHeadline(
  variant: LandingHeroHeadlineVariant
): LandingHeroHeadlineParts {
  if (variant === "b") {
    return {
      lead: "Find Exactly What To ",
      gradient: "Fix Next In Your Business",
    };
  }
  return {
    lead: "Are You Running Your Business ",
    gradient: "Or Is It Running You?",
  };
}
