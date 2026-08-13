import type { Metadata } from "next";

import { JoinHybridCheckoutPage } from "@/components/join/JoinHybridCheckoutPage";
import { PROGRAMME_JOIN_OFFERS } from "@/config/programmeJoinOffers";
import { getStripePublishableKey } from "@/lib/stripePublishableKey";

export const metadata: Metadata = {
  title: "Join — Business Coach Academy (Embedded) | Profit Coach",
  description:
    "Business Coach Academy — 3 payments of £1 with Stripe Embedded Checkout (test).",
  robots: { index: false, follow: false },
};

export default function Join3x1EmbedPage() {
  return (
    <JoinHybridCheckoutPage
      offer={PROGRAMME_JOIN_OFFERS["three-pay-1"]}
      publishableKey={getStripePublishableKey()}
    />
  );
}
