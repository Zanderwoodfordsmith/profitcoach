import { getAppBaseUrl } from "@/lib/appBaseUrl";
import { linkStripeCustomerToCoach } from "@/lib/membership/syncFromStripe";
import { stripeServer } from "@/lib/stripeServer";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export async function createMembershipCheckoutSession(input: {
  coachId: string;
  priceId: string;
  request: Request;
}): Promise<{ url: string }> {
  const { coachId, priceId, request } = input;

  const [{ data: coach }, { data: profile }, { data: authUser }] = await Promise.all([
    supabaseAdmin
      .from("coaches")
      .select("stripe_customer_id, stripe_subscription_id")
      .eq("id", coachId)
      .maybeSingle(),
    supabaseAdmin.from("profiles").select("full_name").eq("id", coachId).maybeSingle(),
    supabaseAdmin.auth.admin.getUserById(coachId),
  ]);

  const email = authUser?.user?.email?.trim();
  if (!coach || !email) {
    throw new Error("Coach or profile email not found.");
  }

  const fullName = profile?.full_name ?? undefined;

  let customerId = coach.stripe_customer_id as string | null;

  if (!customerId) {
    const customer = await stripeServer.customers.create({
      email,
      name: fullName,
      metadata: { coach_id: coachId },
    });
    customerId = customer.id;
    await linkStripeCustomerToCoach(supabaseAdmin, coachId, customerId);
  }

  const baseUrl = getAppBaseUrl(request);

  if (coach.stripe_subscription_id) {
    try {
      const subscription = await stripeServer.subscriptions.retrieve(
        coach.stripe_subscription_id as string
      );

      if (
        subscription.status === "active" ||
        subscription.status === "trialing" ||
        subscription.status === "past_due"
      ) {
        const itemId = subscription.items.data[0]?.id;
        if (!itemId) throw new Error("Subscription has no items.");

        await stripeServer.subscriptions.update(subscription.id, {
          items: [{ id: itemId, price: priceId }],
          proration_behavior: "create_prorations",
          metadata: { coach_id: coachId },
        });

        return { url: `${baseUrl}/coach/membership?updated=1` };
      }
    } catch (error) {
      console.warn("membership checkout: could not update existing subscription, starting checkout:", error);
    }
  }

  const session = await stripeServer.checkout.sessions.create({
    mode: "subscription",
    customer: customerId,
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: `${baseUrl}/coach/membership?success=1`,
    cancel_url: `${baseUrl}/coach/membership?canceled=1`,
    subscription_data: {
      metadata: { coach_id: coachId },
    },
    metadata: { coach_id: coachId },
    allow_promotion_codes: true,
  });

  if (!session.url) {
    throw new Error("Checkout session missing URL.");
  }

  return { url: session.url };
}

export async function createMembershipPortalSession(input: {
  coachId: string;
  request: Request;
}): Promise<{ url: string }> {
  const { coachId, request } = input;

  const { data: coach } = await supabaseAdmin
    .from("coaches")
    .select("stripe_customer_id")
    .eq("id", coachId)
    .maybeSingle();

  if (!coach?.stripe_customer_id) {
    throw new Error("No Stripe customer linked.");
  }

  const baseUrl = getAppBaseUrl(request);
  const session = await stripeServer.billingPortal.sessions.create({
    customer: coach.stripe_customer_id as string,
    return_url: `${baseUrl}/coach/membership`,
  });

  return { url: session.url };
}
