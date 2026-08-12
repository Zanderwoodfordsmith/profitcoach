import type Stripe from "stripe";

import {
  programmeJoinPaymentCount,
  recurringIntervalSeconds,
} from "@/config/programmeJoin";
import { stripeServer } from "@/lib/stripeServer";

/**
 * Payment Links can't set cancel_at at create time the way Checkout can.
 * After a programme-join subscription starts (Checkout or Payment Link),
 * schedule cancel so only N invoices charge.
 */
export async function ensureProgrammeJoinLimitedPayments(
  subscription: Stripe.Subscription
): Promise<Stripe.Subscription> {
  if (subscription.cancel_at || subscription.cancel_at_period_end) {
    return subscription;
  }

  const item = subscription.items.data[0];
  const price = item?.price;
  const priceMeta = price?.metadata ?? {};
  const subMeta = subscription.metadata ?? {};

  const payments =
    programmeJoinPaymentCount(priceMeta) ??
    programmeJoinPaymentCount(subMeta);

  if (!payments || payments <= 1) {
    return subscription;
  }

  const isProgrammeJoin =
    priceMeta.product === "programme_join" ||
    subMeta.product === "programme_join" ||
    Boolean(programmeJoinPaymentCount(priceMeta));

  if (!isProgrammeJoin) {
    return subscription;
  }

  const interval = price?.recurring?.interval ?? "month";
  const intervalCount = price?.recurring?.interval_count ?? 1;
  const start =
    typeof subscription.start_date === "number"
      ? subscription.start_date
      : Math.floor(Date.now() / 1000);

  const cancelAt =
    start +
    recurringIntervalSeconds(interval, intervalCount) * (payments - 1) +
    2 * 24 * 60 * 60;

  const updated = await stripeServer.subscriptions.update(subscription.id, {
    cancel_at: cancelAt,
    metadata: {
      ...subMeta,
      product: "programme_join",
      access_tier: "programme",
      programme_join_payments: String(payments),
    },
  });

  return updated;
}
