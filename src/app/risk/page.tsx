import type { Metadata } from "next";

import { RiskPage } from "@/components/risk/RiskPage";

export const metadata: Metadata = {
  title: "The Risk Playbook | The Profit Coach",
  description: "Twelve ways a business gets hurt, what the best business thinkers say about each one, and how to pick a way of managing them.",
  // Not ready to be found yet: a first look for Zander.
  robots: { index: false, follow: false },
};

export default function RiskPlaybookPage() {
  return <RiskPage />;
}
