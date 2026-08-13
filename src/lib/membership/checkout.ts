import type { MembershipPlanKey } from "@/config/membershipPlans";
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

/** Checkout for logged-out visitors; Stripe collects email and webhooks link by profile email. */
export async function createGuestMembershipCheckoutSession(input: {
  priceId: string;
  planKey: MembershipPlanKey;
  request: Request;
}): Promise<{ url: string }> {
  const baseUrl = getAppBaseUrl(input.request);

  const session = await stripeServer.checkout.sessions.create({
    mode: "subscription",
    line_items: [{ price: input.priceId, quantity: 1 }],
    success_url: `${baseUrl}/welcome?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${baseUrl}/membership?canceled=1`,
    billing_address_collection: "auto",
    customer_creation: "always",
    subscription_data: {
      metadata: { plan_key: input.planKey },
    },
    metadata: { plan_key: input.planKey },
    allow_promotion_codes: true,
  });

  if (!session.url) {
    throw new Error("Checkout session missing URL.");
  }

  return { url: session.url };
}

/**
 * Programme join Checkout (one-time or limited recurring e.g. 2 × £1).
 * Success returns to /welcome so we can provision + sign them in.
 *
 * - hosted (default): redirect to Stripe-hosted Checkout (`url`)
 * - embedded: full Stripe Checkout iframe on our page (`clientSecret`)
 * - elements: Payment Element on our custom form (`clientSecret`)
 */
export async function createGuestProgrammeJoinCheckoutSession(input: {
  priceId: string;
  request: Request;
  uiMode?: "hosted" | "embedded" | "elements";
  /** Shown next to the pay button inside hosted/embedded Checkout. */
  customSubmitMessage?: string;
  customerName?: string;
  customerPhone?: string;
}): Promise<{ url: string } | { clientSecret: string; sessionId: string }> {
  const baseUrl = getAppBaseUrl(input.request);
  const uiMode = input.uiMode ?? "hosted";
  const { programmeJoinPaymentCount } = await import("@/config/programmeJoin");

  const price = await stripeServer.prices.retrieve(input.priceId);
  const joinMeta = {
    product: "programme_join",
    access_tier: "programme",
  };

  const customerName = input.customerName?.trim() || undefined;
  const customerPhone = input.customerPhone?.trim() || undefined;

  const returnOrHosted =
    uiMode === "embedded" || uiMode === "elements"
      ? ({
          ui_mode:
            uiMode === "embedded"
              ? ("embedded_page" as const)
              : ("elements" as const),
          return_url: `${baseUrl}/welcome?session_id={CHECKOUT_SESSION_ID}`,
        } as const)
      : ({
          success_url: `${baseUrl}/welcome?session_id={CHECKOUT_SESSION_ID}`,
          cancel_url: `${baseUrl}/join/canceled`,
        } as const);

  // Elements: collect email/name in our UI (confirm()).
  // Use billing_address_collection: "auto" like hosted/embedded Checkout —
  // "required" forces a full street address via Address Element.
  // Do NOT set customer_email — confirm() would reject updating it.
  const stripeCollect =
    uiMode === "elements"
      ? {
          billing_address_collection: "auto" as const,
        }
      : {
          billing_address_collection: "auto" as const,
          phone_number_collection: { enabled: true },
          name_collection: {
            individual: { enabled: true, optional: false },
            business: { enabled: true, optional: true },
          },
          ...(input.customSubmitMessage?.trim()
            ? {
                custom_text: {
                  submit: {
                    message: input.customSubmitMessage.trim().slice(0, 1200),
                  },
                },
              }
            : {}),
        };

  if (price.type === "recurring") {
    const payments = programmeJoinPaymentCount(price.metadata) ?? 1;
    const joinMetaWithPlan = {
      ...joinMeta,
      programme_join_payments: String(payments),
      ...(customerName ? { customer_name: customerName } : {}),
      ...(customerPhone ? { customer_phone: customerPhone } : {}),
    };

    // Do not set subscription_data.cancel_at — embedded/elements reject it.
    // Webhook + provision call ensureProgrammeJoinLimitedPayments after pay.
    const session = await stripeServer.checkout.sessions.create({
      mode: "subscription",
      line_items: [{ price: input.priceId, quantity: 1 }],
      ...returnOrHosted,
      ...stripeCollect,
      metadata: joinMetaWithPlan,
      subscription_data: {
        metadata: joinMetaWithPlan,
      },
      allow_promotion_codes: false,
    });

    if (uiMode === "embedded" || uiMode === "elements") {
      if (!session.client_secret) {
        throw new Error("Checkout session missing client_secret.");
      }
      return { clientSecret: session.client_secret, sessionId: session.id };
    }

    if (!session.url) {
      throw new Error("Checkout session missing URL.");
    }

    return { url: session.url };
  }

  const session = await stripeServer.checkout.sessions.create({
    mode: "payment",
    line_items: [{ price: input.priceId, quantity: 1 }],
    ...returnOrHosted,
    ...stripeCollect,
    ...(uiMode !== "elements" ? { customer_creation: "always" as const } : {}),
    metadata: {
      ...joinMeta,
      ...(customerName ? { customer_name: customerName } : {}),
      ...(customerPhone ? { customer_phone: customerPhone } : {}),
    },
    payment_intent_data: {
      metadata: joinMeta,
    },
    allow_promotion_codes: false,
  });

  if (uiMode === "embedded" || uiMode === "elements") {
    if (!session.client_secret) {
      throw new Error("Checkout session missing client_secret.");
    }
    return { clientSecret: session.client_secret, sessionId: session.id };
  }

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
