import type { Metadata } from "next";

import { JoinCheckoutElementsPage } from "@/components/join/JoinCheckoutElementsPage";
import { MEMBERSHIP_OFFERS } from "@/config/membershipOffers";
import { getStripePublishableKey } from "@/lib/stripePublishableKey";

export const metadata: Metadata = {
  title: "Membership — Premium annual | Profit Coach",
  description: "Profit Coach Premium membership — £4,950 per year.",
  robots: { index: false, follow: false },
};

export default function Membership4950Page() {
  return (
    <JoinCheckoutElementsPage
      offer={MEMBERSHIP_OFFERS["premium-annual"]}
      publishableKey={getStripePublishableKey()}
      checkoutPath="/api/membership/checkout/elements"
    />
  );
}
