import type { Metadata } from "next";

import { JoinCheckoutElementsPage } from "@/components/join/JoinCheckoutElementsPage";
import { MEMBERSHIP_OFFERS } from "@/config/membershipOffers";
import { getStripePublishableKey } from "@/lib/stripePublishableKey";

export const metadata: Metadata = {
  title: "Membership — Core | Profit Coach",
  description: "Profit Coach Core membership — £195 per month.",
  robots: { index: false, follow: false },
};

export default function Membership195Page() {
  return (
    <JoinCheckoutElementsPage
      offer={MEMBERSHIP_OFFERS["core-monthly"]}
      publishableKey={getStripePublishableKey()}
      checkoutPath="/api/membership/checkout/elements"
    />
  );
}
