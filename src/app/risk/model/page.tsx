import type { Metadata } from "next";

import { RiskModel } from "@/components/risk/RiskModel";

export const metadata: Metadata = {
  title: "Risk model draft | The Profit Coach",
  robots: { index: false, follow: false },
};

export default function RiskModelPage() {
  return <RiskModel />;
}
