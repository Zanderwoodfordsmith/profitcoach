import type { Metadata } from "next";

import { JoinCheckoutElementsPage } from "@/components/join/JoinCheckoutElementsPage";
import { PROGRAMME_JOIN_OFFERS } from "@/config/programmeJoinOffers";
import { getStripePublishableKey } from "@/lib/stripePublishableKey";

export const metadata: Metadata = {
  title: "Join — 2-pay plan | Profit Coach",
  description: "Business Coach Academy — 2-pay plan.",
  robots: { index: false, follow: false },
};

export default function JoinTwoPayPage() {
  return (
    <JoinCheckoutElementsPage
      offer={PROGRAMME_JOIN_OFFERS["two-pay"]}
      publishableKey={getStripePublishableKey()}
    />
  );
}
