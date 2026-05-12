"use client";

import { LandingVariantC, type LandingVariantCProps } from "@/components/landing/LandingVariantC";

export type LandingVariantDProps = Omit<LandingVariantCProps, "heroLayout">;

/** Same long-form landing as C; hero uses headline + copy left, dashboard visual right on large screens. */
export function LandingVariantD(props: LandingVariantDProps) {
  return <LandingVariantC {...props} heroLayout="split" />;
}
