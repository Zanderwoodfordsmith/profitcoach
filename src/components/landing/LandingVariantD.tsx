"use client";

import { LandingVariantC, type LandingVariantCProps } from "@/components/landing/LandingVariantC";
import type { LandingHeroHeadlineVariant } from "@/lib/landingHeroHeadline";

export type LandingVariantDProps = Omit<LandingVariantCProps, "heroLayout"> & {
  headlineVariant?: LandingHeroHeadlineVariant;
};

/** Same long-form landing as C; hero uses headline + copy left, dashboard visual right on large screens. */
export function LandingVariantD({
  headlineVariant = "d",
  ...props
}: LandingVariantDProps) {
  return (
    <LandingVariantC {...props} heroLayout="split" headlineVariant={headlineVariant} />
  );
}
