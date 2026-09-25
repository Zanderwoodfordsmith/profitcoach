import type { Metadata } from "next";

import { JoinCheckoutElementsPage } from "@/components/join/JoinCheckoutElementsPage";
import { MEMBERSHIP_OFFERS } from "@/config/membershipOffers";
import { getStripePublishableKey } from "@/lib/stripePublishableKey";

export const metadata: Metadata = {
  title: "Membership — Core annual | Profit Coach",
  description: "Profit Coach Core membership — £1,950 per year.",
  robots: { index: false, follow: false },
};

export default function Membership1950Page() {
  return (
    <JoinCheckoutElementsPage
      offer={MEMBERSHIP_OFFERS["core-annual"]}
      publishableKey={getStripePublishableKey()}
      checkoutPath="/api/membership/checkout/elements"
    />
  );
}
