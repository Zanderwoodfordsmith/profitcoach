"use client";

import { MarketingNav } from "./MarketingNav";

/**
 * Legacy alias kept so existing pages (blog posts, directory, article views)
 * pick up the standard marketing nav without touching every import.
 * New pages should import MarketingNav directly.
 */
export function ProfitCoachTopMenu() {
  return <MarketingNav variant="solid" />;
}
