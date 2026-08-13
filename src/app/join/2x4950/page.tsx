import type { Metadata } from "next";

import { JoinCheckoutElementsPage } from "@/components/join/JoinCheckoutElementsPage";
import { PROGRAMME_JOIN_OFFERS } from "@/config/programmeJoinOffers";
import { getStripePublishableKey } from "@/lib/stripePublishableKey";

export const metadata: Metadata = {
  title: "Join — Business Coach Academy | Profit Coach",
  description: "Business Coach Academy — 2 payments of £4,950 (total £9,900).",
  robots: { index: false, follow: false },
};

export default function Join2x4950Page() {
  return (
    <JoinCheckoutElementsPage
      offer={PROGRAMME_JOIN_OFFERS["two-pay-4950"]}
      publishableKey={getStripePublishableKey()}
    />
  );
}
