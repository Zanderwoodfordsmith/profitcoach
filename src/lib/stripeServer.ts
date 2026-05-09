import Stripe from "stripe";

const stripeSecretKey = process.env.STRIPE_SECRET_KEY ?? "";

if (!stripeSecretKey) {
  // eslint-disable-next-line no-console
  console.warn("Missing STRIPE_SECRET_KEY. Stripe sync endpoints will fail until configured.");
}

export const stripeServer = new Stripe(stripeSecretKey || "sk_test_placeholder", {
  apiVersion: "2026-04-22.dahlia",
});

