import type { Metadata } from "next";

import { ProfitPublicPage } from "@/components/profitLevers/public/ProfitPublicPage";

export const metadata: Metadata = {
  title: "Profit levers | The Profit Coach",
  description: "Put in last year's numbers and see what small gains on each one are worth.",
  // Not ready to be found yet: a first look for Zander.
  robots: { index: false, follow: false },
};

export default function ProfitLeversPublicPage() {
  return <ProfitPublicPage />;
}
