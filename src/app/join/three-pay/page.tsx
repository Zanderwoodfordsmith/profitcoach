import type { Metadata } from "next";

import { JoinHybridCheckoutPage } from "@/components/join/JoinHybridCheckoutPage";
import { PROGRAMME_JOIN_OFFERS } from "@/config/programmeJoinOffers";
import { getStripePublishableKey } from "@/lib/stripePublishableKey";

export const metadata: Metadata = {
  title: "Join — 3-pay plan | Profit Coach",
  description: "Business Coach Academy — 3 payments of £3,300 (total £9,900).",
  robots: { index: false, follow: false },
};

export default function JoinThreePayPage() {
  return (
    <JoinHybridCheckoutPage
      offer={PROGRAMME_JOIN_OFFERS["three-pay"]}
      publishableKey={getStripePublishableKey()}
    />
  );
}
