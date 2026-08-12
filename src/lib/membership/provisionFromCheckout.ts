import { randomUUID } from "node:crypto";
import type Stripe from "stripe";
import type { User } from "@supabase/supabase-js";

import { findAuthUserIdByEmail } from "@/lib/auth/findAuthUserIdByEmail";
import { allocateCoachSlug } from "@/lib/coachSlug";
import { createCoachProfileAndRow } from "@/lib/createCoachAccountRecords";
import { notifyProgrammeJoinGhl } from "@/lib/membership/notifyProgrammeJoinGhl";
import {
  linkStripeCustomerToCoach,
  syncCoachMembershipFromSubscription,
} from "@/lib/membership/syncFromStripe";
import { splitFullName } from "@/lib/splitFullName";
import { stripeServer } from "@/lib/stripeServer";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

function coalesceEmail(...values: Array<string | null | undefined>): string | null {
  for (const value of values) {
    const trimmed = value?.trim().toLowerCase();
    if (trimmed) return trimmed;
  }
  return null;
}

function coalesceName(...values: Array<string | null | undefined>): string {
  for (const value of values) {
    const trimmed = value?.trim();
    if (trimmed) return trimmed;
  }
  return "Coach";
}

async function findOrCreateAuthUser(input: {
  email: string;
  fullName: string;
}): Promise<{ user: User; created: boolean }> {
  const password = `${randomUUID()}${randomUUID().slice(0, 8)}Aa1!`;

  const { data, error } = await supabaseAdmin.auth.admin.createUser({
    email: input.email,
    password,
    email_confirm: true,
    user_metadata: {
      full_name: input.fullName,
      provisioned_via: "stripe_checkout",
    },
  });

  if (data.user && !error) {
    return { user: data.user, created: true };
  }

  const message = (error?.message ?? "").toLowerCase();
  const alreadyExists =
    message.includes("already") ||
    message.includes("registered") ||
    message.includes("exists");

  if (!alreadyExists) {
    throw new Error(error?.message ?? "Unable to create user account.");
  }

  const existingId = await findAuthUserIdByEmail(input.email);
  if (!existingId) {
    throw new Error("Unable to load existing account for this email.");
  }

  const { data: existingData, error: existingError } =
    await supabaseAdmin.auth.admin.getUserById(existingId);

  if (existingError || !existingData.user) {
    throw new Error(
      existingError?.message ?? "Unable to load existing account for this email."
    );
  }

  return { user: existingData.user, created: false };
}

async function ensureCoachRecords(input: {
  userId: string;
  fullName: string;
  createdAuthUser: boolean;
}): Promise<{ slug: string; createdCoach: boolean }> {
  const { data: existingCoach } = await supabaseAdmin
    .from("coaches")
    .select("id, slug")
    .eq("id", input.userId)
    .maybeSingle();

  if (existingCoach?.id) {
    const slug = (existingCoach.slug as string | null)?.trim();
    if (slug) return { slug, createdCoach: false };
  }

  const { data: existingProfile } = await supabaseAdmin
    .from("profiles")
    .select("id, full_name, role")
    .eq("id", input.userId)
    .maybeSingle();

  const slug = await allocateCoachSlug(supabaseAdmin, input.fullName);
  const { first_name, last_name } = splitFullName(input.fullName);

  if (!existingProfile?.id) {
    const coachError = await createCoachProfileAndRow({
      userId: input.userId,
      fullName: input.fullName,
      firstName: first_name,
      lastName: last_name,
      businessName: null,
      slug,
    });
    if (coachError) throw new Error(coachError);
    return { slug, createdCoach: true };
  }

  if (!existingCoach?.id) {
    const { error: coachInsertError } = await supabaseAdmin.from("coaches").insert({
      id: input.userId,
      slug,
      access_tier: "programme",
      recurring_payment_status: "first_6_months",
    });
    if (coachInsertError) {
      if (coachInsertError.code === "23505") {
        const retrySlug = await allocateCoachSlug(supabaseAdmin, input.fullName);
        const { error: retryError } = await supabaseAdmin.from("coaches").insert({
          id: input.userId,
          slug: retrySlug,
          access_tier: "programme",
          recurring_payment_status: "first_6_months",
        });
        if (retryError) throw new Error(retryError.message);
        return { slug: retrySlug, createdCoach: true };
      }
      throw new Error(coachInsertError.message);
    }
  }

  if (existingProfile.role !== "coach" && existingProfile.role !== "admin") {
    await supabaseAdmin
      .from("profiles")
      .update({ role: "coach" })
      .eq("id", input.userId);
  }

  if (
    input.createdAuthUser ||
    !(existingProfile.full_name as string | null)?.trim()
  ) {
    await supabaseAdmin
      .from("profiles")
      .update({
        full_name: input.fullName,
        first_name,
        last_name,
      })
      .eq("id", input.userId);
  }

  const { data: coachAfter } = await supabaseAdmin
    .from("coaches")
    .select("slug")
    .eq("id", input.userId)
    .maybeSingle();

  return {
    slug: ((coachAfter?.slug as string | null) ?? slug).trim(),
    createdCoach: !existingCoach?.id,
  };
}

async function stampCoachIdOnStripe(input: {
  session: Stripe.Checkout.Session;
  coachId: string;
  customerId: string | null;
}): Promise<void> {
  const { session, coachId, customerId } = input;
  const existingMeta = session.metadata ?? {};
  if (existingMeta.coach_id !== coachId) {
    try {
      await stripeServer.checkout.sessions.update(session.id, {
        metadata: { ...existingMeta, coach_id: coachId },
      });
    } catch (error) {
      console.warn("provisionFromCheckout: session metadata update failed:", error);
    }
  }

  if (customerId) {
    try {
      await stripeServer.customers.update(customerId, {
        metadata: { coach_id: coachId },
      });
    } catch (error) {
      console.warn("provisionFromCheckout: customer metadata update failed:", error);
    }
  }

  if (session.subscription) {
    const subscriptionId =
      typeof session.subscription === "string"
        ? session.subscription
        : session.subscription.id;
    try {
      await stripeServer.subscriptions.update(subscriptionId, {
        metadata: { coach_id: coachId },
      });
    } catch (error) {
      console.warn(
        "provisionFromCheckout: subscription metadata update failed:",
        error
      );
    }
  }
}

export type ProvisionFromCheckoutResult = {
  coachId: string;
  email: string;
  fullName: string;
  slug: string;
  createdAccount: boolean;
  /** One-time token hash for supabase.auth.verifyOtp — only when includeLoginToken. */
  tokenHash: string | null;
};

/**
 * Idempotent: paid Checkout Session → coach auth/profile + Stripe links.
 * Optionally mints a magic-link token hash so the success page can log them in.
 */
export async function provisionCoachFromCheckoutSession(input: {
  sessionId: string;
  includeLoginToken?: boolean;
}): Promise<ProvisionFromCheckoutResult> {
  const session = await stripeServer.checkout.sessions.retrieve(input.sessionId, {
    expand: ["subscription", "customer"],
  });

  if (session.status !== "complete") {
    throw new Error("Checkout is not complete yet.");
  }
  if (session.payment_status !== "paid" && session.payment_status !== "no_payment_required") {
    throw new Error("Payment is not complete yet.");
  }

  const email = coalesceEmail(
    session.customer_details?.email,
    session.customer_email
  );
  if (!email) {
    throw new Error("Checkout session has no customer email.");
  }

  const fullName = coalesceName(
    session.customer_details?.name,
    session.metadata?.full_name,
    email.split("@")[0]
  );

  const metadataCoachId =
    typeof session.metadata?.coach_id === "string"
      ? session.metadata.coach_id.trim()
      : "";

  let user: User;
  let createdAccount = false;

  if (metadataCoachId) {
    const existing = await supabaseAdmin.auth.admin.getUserById(metadataCoachId);
    if (existing.data.user) {
      user = existing.data.user;
    } else {
      const created = await findOrCreateAuthUser({ email, fullName });
      user = created.user;
      createdAccount = created.created;
    }
  } else {
    const created = await findOrCreateAuthUser({ email, fullName });
    user = created.user;
    createdAccount = created.created;
  }

  const { slug, createdCoach } = await ensureCoachRecords({
    userId: user.id,
    fullName,
    createdAuthUser: createdAccount,
  });
  createdAccount = createdAccount || createdCoach;

  const customerId =
    typeof session.customer === "string"
      ? session.customer
      : session.customer && !session.customer.deleted
        ? session.customer.id
        : null;

  if (customerId) {
    await linkStripeCustomerToCoach(supabaseAdmin, user.id, customerId);
  }

  const isProgrammeJoinCheckout =
    session.metadata?.product === "programme_join" ||
    (typeof session.subscription === "object" &&
      session.subscription &&
      "metadata" in session.subscription &&
      session.subscription.metadata?.product === "programme_join");

  if (session.mode === "subscription" && session.subscription) {
    let subscription =
      typeof session.subscription === "string"
        ? await stripeServer.subscriptions.retrieve(session.subscription)
        : session.subscription;

    try {
      const { ensureProgrammeJoinLimitedPayments } = await import(
        "@/lib/membership/ensureProgrammeJoinLimitedPayments"
      );
      subscription = await ensureProgrammeJoinLimitedPayments(subscription);
    } catch (error) {
      console.warn(
        "provisionFromCheckout: limited payment plan cancel_at failed:",
        error
      );
    }

    await syncCoachMembershipFromSubscription(
      supabaseAdmin,
      subscription,
      email
    );

    // Programme join payment plans are not mapped membership prices — force programme tier.
    if (
      isProgrammeJoinCheckout ||
      subscription.metadata?.product === "programme_join"
    ) {
      const { data: coachRow } = await supabaseAdmin
        .from("coaches")
        .select("access_tier, access_tier_locked")
        .eq("id", user.id)
        .maybeSingle();

      const locked = Boolean(coachRow?.access_tier_locked);
      const tier = (coachRow?.access_tier as string | null) ?? null;
      if (
        !locked &&
        tier !== "do_not_contact" &&
        tier !== "early_exit"
      ) {
        await supabaseAdmin
          .from("coaches")
          .update({
            access_tier: "programme",
            recurring_payment_status: "first_6_months",
          })
          .eq("id", user.id);
      }
    }
  } else if (session.mode === "payment" && isProgrammeJoinCheckout) {
    // One-time programme enrolment — keep / restore programme access.
    const { data: coachRow } = await supabaseAdmin
      .from("coaches")
      .select("access_tier, access_tier_locked")
      .eq("id", user.id)
      .maybeSingle();

    const locked = Boolean(coachRow?.access_tier_locked);
    const tier = (coachRow?.access_tier as string | null) ?? null;
    if (
      !locked &&
      tier !== "do_not_contact" &&
      tier !== "early_exit"
    ) {
      await supabaseAdmin
        .from("coaches")
        .update({
          access_tier: "programme",
          recurring_payment_status: "first_6_months",
        })
        .eq("id", user.id);
    }
  }

  await stampCoachIdOnStripe({
    session,
    coachId: user.id,
    customerId,
  });

  const isProgrammeJoin = session.metadata?.product === "programme_join";
  const alreadyNotifiedGhl =
    typeof session.metadata?.ghl_programme_join_notified === "string" &&
    session.metadata.ghl_programme_join_notified.trim().length > 0;

  if (isProgrammeJoin && !alreadyNotifiedGhl) {
    const phone =
      session.customer_details?.phone?.trim() ||
      (typeof session.customer === "object" &&
      session.customer &&
      !session.customer.deleted
        ? session.customer.phone?.trim() || null
        : null) ||
      null;

    const notify = await notifyProgrammeJoinGhl({
      email,
      fullName,
      phone,
      coachId: user.id,
      slug,
      stripeSessionId: session.id,
    });

    if (notify.ok) {
      try {
        await stripeServer.checkout.sessions.update(session.id, {
          metadata: {
            ...(session.metadata ?? {}),
            coach_id: user.id,
            ghl_programme_join_notified: new Date().toISOString(),
          },
        });
      } catch (error) {
        console.warn(
          "provisionFromCheckout: ghl notify metadata stamp failed:",
          error
        );
      }
    }
  }

  let tokenHash: string | null = null;
  if (input.includeLoginToken) {
    const { data: linkData, error: linkError } =
      await supabaseAdmin.auth.admin.generateLink({
        type: "magiclink",
        email,
      });
    if (linkError || !linkData.properties?.hashed_token) {
      throw new Error(
        linkError?.message ?? "Unable to create a one-click login token."
      );
    }
    tokenHash = linkData.properties.hashed_token;
  }

  return {
    coachId: user.id,
    email,
    fullName,
    slug,
    createdAccount,
    tokenHash,
  };
}
