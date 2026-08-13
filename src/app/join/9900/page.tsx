import type { Metadata } from "next";

import { JoinCheckoutElementsPage } from "@/components/join/JoinCheckoutElementsPage";
import { PROGRAMME_JOIN_OFFERS } from "@/config/programmeJoinOffers";
import { getStripePublishableKey } from "@/lib/stripePublishableKey";

export const metadata: Metadata = {
  title: "Join — Business Coach Academy | Profit Coach",
  description: "Business Coach Academy — one payment of £9,900.",
  robots: { index: false, follow: false },
};

export default function Join9900Page() {
  return (
    <JoinCheckoutElementsPage
      offer={PROGRAMME_JOIN_OFFERS["pay-in-full-9900"]}
      publishableKey={getStripePublishableKey()}
    />
  );
}
