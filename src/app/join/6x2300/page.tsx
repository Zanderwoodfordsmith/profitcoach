import type { Metadata } from "next";

import { JoinCheckoutElementsPage } from "@/components/join/JoinCheckoutElementsPage";
import { PROGRAMME_JOIN_OFFERS } from "@/config/programmeJoinOffers";
import { getStripePublishableKey } from "@/lib/stripePublishableKey";

export const metadata: Metadata = {
  title: "Join — Business Coach Academy | Profit Coach",
  description: "Business Coach Academy — 6 payments of $2,300 (total $13,800).",
  robots: { index: false, follow: false },
};

export default function Join6x2300Page() {
  return (
    <JoinCheckoutElementsPage
      offer={PROGRAMME_JOIN_OFFERS["six-pay-2300"]}
      publishableKey={getStripePublishableKey()}
    />
  );
}
