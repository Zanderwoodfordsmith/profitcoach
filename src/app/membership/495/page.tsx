import type { Metadata } from "next";

import { JoinCheckoutElementsPage } from "@/components/join/JoinCheckoutElementsPage";
import { MEMBERSHIP_OFFERS } from "@/config/membershipOffers";
import { getStripePublishableKey } from "@/lib/stripePublishableKey";

export const metadata: Metadata = {
  title: "Membership — Premium | Profit Coach",
  description: "Profit Coach Premium membership — £495 per month.",
  robots: { index: false, follow: false },
};

export default function Membership495Page() {
  return (
    <JoinCheckoutElementsPage
      offer={MEMBERSHIP_OFFERS["premium-monthly"]}
      publishableKey={getStripePublishableKey()}
      checkoutPath="/api/membership/checkout/elements"
    />
  );
}
