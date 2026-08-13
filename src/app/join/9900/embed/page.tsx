import type { Metadata } from "next";

import { JoinHybridCheckoutPage } from "@/components/join/JoinHybridCheckoutPage";
import { PROGRAMME_JOIN_OFFERS } from "@/config/programmeJoinOffers";
import { getStripePublishableKey } from "@/lib/stripePublishableKey";

export const metadata: Metadata = {
  title: "Join — Business Coach Academy (Embedded) | Profit Coach",
  description:
    "Business Coach Academy — one payment of £9,900 with Stripe Embedded Checkout.",
  robots: { index: false, follow: false },
};

export default function Join9900EmbedPage() {
  return (
    <JoinHybridCheckoutPage
      offer={PROGRAMME_JOIN_OFFERS["pay-in-full-9900"]}
      publishableKey={getStripePublishableKey()}
    />
  );
}
