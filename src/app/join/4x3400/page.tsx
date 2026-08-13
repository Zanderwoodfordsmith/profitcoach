import type { Metadata } from "next";

import { JoinCheckoutElementsPage } from "@/components/join/JoinCheckoutElementsPage";
import { PROGRAMME_JOIN_OFFERS } from "@/config/programmeJoinOffers";
import { getStripePublishableKey } from "@/lib/stripePublishableKey";

export const metadata: Metadata = {
  title: "Join — Business Coach Academy | Profit Coach",
  description: "Business Coach Academy — 4 payments of $3,400 (total $13,600).",
  robots: { index: false, follow: false },
};

export default function Join4x3400Page() {
  return (
    <JoinCheckoutElementsPage
      offer={PROGRAMME_JOIN_OFFERS["four-pay-3400"]}
      publishableKey={getStripePublishableKey()}
    />
  );
}
