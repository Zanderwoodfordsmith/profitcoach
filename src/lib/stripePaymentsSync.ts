import type { SupabaseClient } from "@supabase/supabase-js";

type CoachInfo = {
  id: string;
  slug: string;
  full_name: string | null;
  coach_business_name: string | null;
  email: string | null;
};

type AssignmentMethod = "unassigned" | "email_auto" | "manual" | "metadata";

type PaymentUpsertInput = {
  stripePaymentIntentId?: string | null;
  stripeCheckoutSessionId?: string | null;
  customerEmail: string;
  amountCents: number;
  currency?: string | null;
  status: "succeeded" | "pending" | "failed" | "refunded";
  paidAtIso: string;
  metadataCoachId?: string | null;
  notes?: string | null;
};

type ExistingPaymentRow = {
  id: string;
  coach_id: string | null;
  assignment_method: AssignmentMethod;
};

function normalizeEmail(value: string | null | undefined): string | null {
  if (!value) return null;
  const normalized = value.trim().toLowerCase();
  return normalized.length > 0 ? normalized : null;
}

export async function loadCoachDirectory(
  supabase: SupabaseClient
): Promise<{
  coaches: CoachInfo[];
  coachById: Map<string, CoachInfo>;
  uniqueCoachByEmail: Map<string, CoachInfo>;
}> {
  const { data: coachesData, error: coachesError } = await supabase
    .from("coaches")
    .select("id, slug, profiles!inner(full_name, coach_business_name)")
    .order("slug", { ascending: true });

  if (coachesError) {
    throw new Error("Unable to load coaches.");
  }

  const coaches: CoachInfo[] =
    coachesData?.map((row: any) => ({
      id: row.id as string,
      slug: row.slug as string,
      full_name: row.profiles?.full_name ?? null,
      coach_business_name: row.profiles?.coach_business_name ?? null,
      email: null,
    })) ?? [];

  const ids = new Set(coaches.map((coach) => coach.id));
  const userList = await supabase.auth.admin.listUsers({ page: 1, perPage: 1000 });
  if (!userList.error) {
    for (const user of userList.data.users ?? []) {
      if (!ids.has(user.id)) continue;
      const coach = coaches.find((item) => item.id === user.id);
      if (coach) {
        coach.email = normalizeEmail(user.email);
      }
    }
  }

  const coachById = new Map(coaches.map((coach) => [coach.id, coach]));
  const uniqueCoachByEmail = new Map<string, CoachInfo>();
  const duplicateEmails = new Set<string>();
  for (const coach of coaches) {
    const email = normalizeEmail(coach.email);
    if (!email) continue;
    if (uniqueCoachByEmail.has(email)) {
      duplicateEmails.add(email);
      uniqueCoachByEmail.delete(email);
      continue;
    }
    if (!duplicateEmails.has(email)) {
      uniqueCoachByEmail.set(email, coach);
    }
  }

  return { coaches, coachById, uniqueCoachByEmail };
}

async function findExistingPayment(
  supabase: SupabaseClient,
  stripePaymentIntentId: string | null,
  stripeCheckoutSessionId: string | null
): Promise<ExistingPaymentRow | null> {
  if (!stripePaymentIntentId && !stripeCheckoutSessionId) {
    return null;
  }

  const filters: string[] = [];
  if (stripePaymentIntentId) {
    filters.push(`stripe_payment_intent_id.eq.${stripePaymentIntentId}`);
  }
  if (stripeCheckoutSessionId) {
    filters.push(`stripe_checkout_session_id.eq.${stripeCheckoutSessionId}`);
  }

  const { data, error } = await supabase
    .from("coach_payments")
    .select("id, coach_id, assignment_method")
    .or(filters.join(","))
    .maybeSingle();

  if (error) {
    throw new Error("Unable to query existing payment.");
  }
  return (data as ExistingPaymentRow | null) ?? null;
}

export async function upsertCoachPaymentFromStripe(
  supabase: SupabaseClient,
  directory: {
    coachById: Map<string, CoachInfo>;
    uniqueCoachByEmail: Map<string, CoachInfo>;
  },
  input: PaymentUpsertInput
): Promise<void> {
  const email = normalizeEmail(input.customerEmail);
  if (!email) return;
  if (!Number.isFinite(input.amountCents) || input.amountCents <= 0) return;

  const paymentIntentId = input.stripePaymentIntentId?.trim() || null;
  const sessionId = input.stripeCheckoutSessionId?.trim() || null;
  const normalizedCurrency = (input.currency ?? "gbp").trim().toLowerCase();
  const paidAtIso = input.paidAtIso;

  const existing = await findExistingPayment(supabase, paymentIntentId, sessionId);

  let coachId: string | null = existing?.coach_id ?? null;
  let assignmentMethod: AssignmentMethod = existing?.assignment_method ?? "unassigned";

  const metadataCoachId = input.metadataCoachId?.trim() || null;
  const metadataCoachExists =
    metadataCoachId && directory.coachById.has(metadataCoachId) ? metadataCoachId : null;

  // Preserve manual assignment; otherwise metadata beats email auto-match.
  if (assignmentMethod !== "manual") {
    if (metadataCoachExists) {
      coachId = metadataCoachExists;
      assignmentMethod = "metadata";
    } else if (!coachId) {
      const auto = directory.uniqueCoachByEmail.get(email);
      if (auto) {
        coachId = auto.id;
        assignmentMethod = "email_auto";
      } else {
        assignmentMethod = "unassigned";
      }
    }
  }

  const payload = {
    stripe_payment_intent_id: paymentIntentId,
    stripe_checkout_session_id: sessionId,
    customer_email: email,
    amount_cents: input.amountCents,
    currency: normalizedCurrency,
    status: input.status,
    paid_at: paidAtIso,
    coach_id: coachId,
    assignment_method: assignmentMethod,
    notes: input.notes?.trim() || null,
  };

  if (existing) {
    const { error: updateError } = await supabase
      .from("coach_payments")
      .update(payload)
      .eq("id", existing.id);
    if (updateError) {
      throw new Error("Unable to update payment.");
    }
    return;
  }

  const { error: insertError } = await supabase.from("coach_payments").insert(payload);
  if (insertError) {
    throw new Error("Unable to insert payment.");
  }
}

