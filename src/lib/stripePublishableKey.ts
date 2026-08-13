/**
 * Stripe.js publishable key (safe for the browser).
 * Prefer NEXT_PUBLIC_ so it is available on the client without a round-trip.
 */
export function getStripePublishableKey(): string {
  return (
    process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY?.trim() ||
    process.env.STRIPE_PUBLISHABLE_KEY?.trim() ||
    ""
  );
}
