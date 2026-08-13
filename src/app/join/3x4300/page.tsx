import type { Metadata } from "next";

import { JoinCheckoutElementsPage } from "@/components/join/JoinCheckoutElementsPage";
import { PROGRAMME_JOIN_OFFERS } from "@/config/programmeJoinOffers";
import { getStripePublishableKey } from "@/lib/stripePublishableKey";

export const metadata: Metadata = {
  title: "Join — Business Coach Academy | Profit Coach",
  description: "Business Coach Academy — 3 payments of $4,300 (total $12,900).",
  robots: { index: false, follow: false },
};

export default function Join3x4300Page() {
  return (
    <JoinCheckoutElementsPage
      offer={PROGRAMME_JOIN_OFFERS["three-pay-4300"]}
      publishableKey={getStripePublishableKey()}
    />
  );
}
