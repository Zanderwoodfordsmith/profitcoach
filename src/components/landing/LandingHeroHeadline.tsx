import {
  getLandingHeroHeadline,
  LANDING_HERO_GRADIENT,
  LANDING_HERO_HEADLINE_TRACKING,
  type LandingHeroHeadlineVariant,
} from "@/lib/landingHeroHeadline";

type LandingHeroHeadlineProps = {
  variant: LandingHeroHeadlineVariant;
  className?: string;
};

export function LandingHeroHeadline({ variant, className = "" }: LandingHeroHeadlineProps) {
  const { lead, gradient } = getLandingHeroHeadline(variant);

  return (
    <h1
      className={`text-balance font-light text-white [text-shadow:0_2px_28px_rgba(0,0,0,0.35)] ${LANDING_HERO_HEADLINE_TRACKING} ${className}`}
    >
      {lead}
      <span
        className="bg-clip-text font-semibold text-transparent"
        style={{ backgroundImage: LANDING_HERO_GRADIENT }}
      >
        {gradient}
      </span>
    </h1>
  );
}
