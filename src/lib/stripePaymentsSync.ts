import type { SupabaseClient } from "@supabase/supabase-js";

import { matchCsvNameToCoach, normalizeCoachName } from "@/lib/clickupCoachNameMatch";
import { paymentImportSkipReason } from "@/lib/paymentImportFilters";

type CoachInfo = {
  id: string;
  slug: string;
  full_name: string | null;
  coach_business_name: string | null;
  email: string | null;
  joined_at: string | null;
};

export type CsvPaymentStatus =
  | "succeeded"
  | "pending"
  | "failed"
  | "refunded"
  | "canceled";

type AssignmentMethod =
  | "unassigned"
  | "email_auto"
  | "manual"
  | "metadata"
  | "company_auto";

export type CoachDirectory = {
  coaches: CoachInfo[];
  coachById: Map<string, CoachInfo>;
  uniqueCoachByEmail: Map<string, CoachInfo>;
  uniqueCoachByCompany: Map<string, CoachInfo>;
  uniqueCoachByNormalizedName: Map<string, CoachInfo>;
  uniqueCoachByEmailLocal: Map<string, CoachInfo>;
};

type PaymentUpsertInput = {
  stripePaymentIntentId?: string | null;
  stripeCheckoutSessionId?: string | null;
  stripeChargeId?: string | null;
  customerEmail: string;
  amountCents: number;
  currency?: string | null;
  status: CsvPaymentStatus;
  paidAtIso: string;
  metadataCoachId?: string | null;
  notes?: string | null;
};

export type PaymentSource =
  | "stripe"
  | "stripe_stryv_us"
  | "revolut_merchant"
  | "revolut_direct";

export type CsvPaymentUpsertInput = {
  stripeChargeId?: string | null;
  importRowKey: string;
  stripeInvoiceId?: string | null;
  customerEmail: string;
  customerCompanyName?: string | null;
  amountCents: number;
  currency?: string | null;
  status: CsvPaymentStatus;
  paidAtIso: string;
  declineReason?: string | null;
  description?: string | null;
  importSource?: string | null;
  paymentSource?: PaymentSource | null;
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

function normalizeCompany(value: string | null | undefined): string | null {
  if (!value) return null;
  const normalized = value.trim().toLowerCase().replace(/\s+/g, " ");
  return normalized.length > 0 ? normalized : null;
}

function isSyntheticImportEmail(email: string): boolean {
  const e = email.trim().toLowerCase();
  return (
    e.endsWith("@import.bca.records") ||
    e.endsWith("@import.revolut") ||
    /^revolut-transfer\+/.test(e) ||
    /^coach\+/.test(e) && e.endsWith("@import.bca.records")
  );
}

/** e.g. matt_beevers@yahoo.com → mattbeevers, davidgray@sky.com → davidgray */
export function emailLocalCompactKey(email: string | null | undefined): string | null {
  const normalized = normalizeEmail(email);
  if (!normalized || isSyntheticImportEmail(normalized)) return null;
  const local = normalized.split("@")[0] ?? "";
  const compact = local.replace(/[._-]+/g, "").replace(/\d+$/, "");
  return compact.length >= 4 ? compact : null;
}

function nameToCompactKey(fullName: string | null | undefined): string | null {
  const parts = normalizeCoachName(fullName ?? "").split(" ").filter(Boolean);
  if (parts.length === 0) return null;
  const compact = parts.join("");
  return compact.length >= 4 ? compact : null;
}

/** Strip "(FORTRESS HEA)" style suffixes from Revolut / bank payer labels. */
export function paymentPayerNameKey(value: string | null | undefined): string | null {
  if (!value) return null;
  const withoutParen = value.replace(/\s*\([^)]*\)\s*/g, " ").trim();
  return normalizeCompany(withoutParen);
}

function addCompanyKey(
  map: Map<string, CoachInfo>,
  duplicates: Set<string>,
  key: string | null,
  coach: CoachInfo
) {
  if (!key) return;
  if (map.has(key)) {
    duplicates.add(key);
    map.delete(key);
    return;
  }
  if (!duplicates.has(key)) {
    map.set(key, coach);
  }
}

export async function loadCoachDirectory(
  supabase: SupabaseClient
): Promise<CoachDirectory> {
  const { data: coachesData, error: coachesError } = await supabase
    .from("coaches")
    .select(
      "id, slug, profiles!inner(full_name, coach_business_name, disco_community_joined_on, created_at)"
    )
    .order("slug", { ascending: true });

  if (coachesError) {
    throw new Error("Unable to load coaches.");
  }

  const coaches: CoachInfo[] =
    coachesData?.map((row) => {
      const profile = Array.isArray(row.profiles) ? row.profiles[0] : row.profiles;
      return {
        id: row.id as string,
        slug: row.slug as string,
        full_name: (profile?.full_name as string | null) ?? null,
        coach_business_name: (profile?.coach_business_name as string | null) ?? null,
        email: null,
        joined_at:
          (profile?.disco_community_joined_on as string | null) ??
          (profile?.created_at as string | null) ??
          null,
      };
    }) ?? [];

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
  const uniqueCoachByCompany = new Map<string, CoachInfo>();
  const duplicateCompanies = new Set<string>();
  const uniqueCoachByNormalizedName = new Map<string, CoachInfo>();
  const duplicateNames = new Set<string>();
  const uniqueCoachByEmailLocal = new Map<string, CoachInfo>();
  const duplicateEmailLocals = new Set<string>();

  for (const coach of coaches) {
    const email = normalizeEmail(coach.email);
    if (email) {
      if (uniqueCoachByEmail.has(email)) {
        duplicateEmails.add(email);
        uniqueCoachByEmail.delete(email);
      } else if (!duplicateEmails.has(email)) {
        uniqueCoachByEmail.set(email, coach);
      }
    }

    addCompanyKey(
      uniqueCoachByCompany,
      duplicateCompanies,
      normalizeCompany(coach.coach_business_name),
      coach
    );
    addCompanyKey(
      uniqueCoachByCompany,
      duplicateCompanies,
      normalizeCompany(coach.full_name),
      coach
    );

    const nameKey = normalizeCoachName(coach.full_name ?? "");
    if (nameKey) {
      if (uniqueCoachByNormalizedName.has(nameKey)) {
        duplicateNames.add(nameKey);
        uniqueCoachByNormalizedName.delete(nameKey);
      } else if (!duplicateNames.has(nameKey)) {
        uniqueCoachByNormalizedName.set(nameKey, coach);
      }
    }

    addCompanyKey(
      uniqueCoachByEmailLocal,
      duplicateEmailLocals,
      nameToCompactKey(coach.full_name),
      coach
    );
    addCompanyKey(
      uniqueCoachByEmailLocal,
      duplicateEmailLocals,
      emailLocalCompactKey(coach.email),
      coach
    );
  }

  return {
    coaches,
    coachById,
    uniqueCoachByEmail,
    uniqueCoachByCompany,
    uniqueCoachByNormalizedName,
    uniqueCoachByEmailLocal,
  };
}

function suggestCoachByPayerLabel(
  directory: CoachDirectory,
  label: string | null | undefined
): CoachInfo | null {
  const trimmed = label?.trim();
  if (!trimmed) return null;

  const companyKey = paymentPayerNameKey(trimmed);
  if (companyKey) {
    const companyMatch = directory.uniqueCoachByCompany.get(companyKey);
    if (companyMatch) return companyMatch;

    const nameMatch = directory.uniqueCoachByNormalizedName.get(companyKey);
    if (nameMatch) return nameMatch;
  }

  const smart = matchCsvNameToCoach(
    trimmed,
    directory.coaches.map((c) => ({
      slug: c.slug,
      fullName: c.full_name ?? "",
    }))
  );
  if (!smart) return null;
  return directory.coaches.find((c) => c.slug === smart.slug) ?? null;
}

async function findExistingPaymentByColumn(
  supabase: SupabaseClient,
  column: string,
  value: string
): Promise<ExistingPaymentRow | null> {
  const { data, error } = await supabase
    .from("coach_payments")
    .select("id, coach_id, assignment_method")
    .eq(column, value)
    .maybeSingle();

  if (error) {
    throw new Error("Unable to query existing payment.");
  }
  return (data as ExistingPaymentRow | null) ?? null;
}

async function findExistingPayment(
  supabase: SupabaseClient,
  keys: {
    stripePaymentIntentId: string | null;
    stripeCheckoutSessionId: string | null;
    stripeChargeId: string | null;
    importRowKey: string | null;
  }
): Promise<ExistingPaymentRow | null> {
  if (keys.stripeChargeId) {
    const byCharge = await findExistingPaymentByColumn(
      supabase,
      "stripe_charge_id",
      keys.stripeChargeId
    );
    if (byCharge) return byCharge;
  }

  if (keys.importRowKey) {
    const byImportKey = await findExistingPaymentByColumn(
      supabase,
      "import_row_key",
      keys.importRowKey
    );
    if (byImportKey) return byImportKey;
  }

  if (keys.stripePaymentIntentId) {
    const byIntent = await findExistingPaymentByColumn(
      supabase,
      "stripe_payment_intent_id",
      keys.stripePaymentIntentId
    );
    if (byIntent) return byIntent;
  }

  if (keys.stripeCheckoutSessionId) {
    const bySession = await findExistingPaymentByColumn(
      supabase,
      "stripe_checkout_session_id",
      keys.stripeCheckoutSessionId
    );
    if (bySession) return bySession;
  }

  return null;
}

function resolveCoachAssignment(
  directory: CoachDirectory,
  existing: ExistingPaymentRow | null,
  input: {
    email: string;
    companyName: string | null;
    metadataCoachId: string | null;
  }
): { coachId: string | null; assignmentMethod: AssignmentMethod } {
  let coachId: string | null = existing?.coach_id ?? null;
  let assignmentMethod: AssignmentMethod = existing?.assignment_method ?? "unassigned";

  const metadataCoachId = input.metadataCoachId?.trim() || null;
  const metadataCoachExists =
    metadataCoachId && directory.coachById.has(metadataCoachId) ? metadataCoachId : null;

  if (assignmentMethod !== "manual") {
    if (metadataCoachExists) {
      coachId = metadataCoachExists;
      assignmentMethod = "metadata";
    } else if (!coachId) {
      const emailMatch = directory.uniqueCoachByEmail.get(input.email);
      if (emailMatch) {
        coachId = emailMatch.id;
        assignmentMethod = "email_auto";
      } else {
        const companyKey = normalizeCompany(input.companyName);
        const companyMatch = companyKey
          ? directory.uniqueCoachByCompany.get(companyKey)
          : undefined;
        if (companyMatch) {
          coachId = companyMatch.id;
          assignmentMethod = "company_auto";
        } else {
          const nameMatch = suggestCoachByPayerLabel(
            directory,
            input.companyName
          );
          if (nameMatch) {
            coachId = nameMatch.id;
            assignmentMethod = "company_auto";
          } else {
            const localKey = emailLocalCompactKey(input.email);
            const localMatch = localKey
              ? directory.uniqueCoachByEmailLocal.get(localKey)
              : undefined;
            if (localMatch) {
              coachId = localMatch.id;
              assignmentMethod = "email_auto";
            } else {
              assignmentMethod = "unassigned";
            }
          }
        }
      }
    }
  }

  return { coachId, assignmentMethod };
}

export async function upsertCoachPaymentFromStripe(
  supabase: SupabaseClient,
  directory: CoachDirectory,
  input: PaymentUpsertInput
): Promise<void> {
  const email = normalizeEmail(input.customerEmail);
  if (!email) return;
  if (!Number.isFinite(input.amountCents) || input.amountCents <= 0) return;

  const normalizedCurrencyEarly = (input.currency ?? "gbp").trim().toLowerCase();
  if (paymentImportSkipReason(email, input.amountCents, normalizedCurrencyEarly)) {
    return;
  }

  const paymentIntentId = input.stripePaymentIntentId?.trim() || null;
  const sessionId = input.stripeCheckoutSessionId?.trim() || null;
  const chargeId = input.stripeChargeId?.trim() || null;
  const normalizedCurrency = (input.currency ?? "gbp").trim().toLowerCase();

  const existing = await findExistingPayment(supabase, {
    stripePaymentIntentId: paymentIntentId,
    stripeCheckoutSessionId: sessionId,
    stripeChargeId: chargeId,
    importRowKey: chargeId ? `charge:${chargeId}` : null,
  });

  const { coachId, assignmentMethod } = resolveCoachAssignment(directory, existing, {
    email,
    companyName: null,
    metadataCoachId: input.metadataCoachId ?? null,
  });

  const payload = {
    stripe_payment_intent_id: paymentIntentId,
    stripe_checkout_session_id: sessionId,
    stripe_charge_id: chargeId,
    import_row_key: chargeId ? `charge:${chargeId}` : null,
    customer_email: email,
    amount_cents: input.amountCents,
    currency: normalizedCurrency,
    status: input.status,
    paid_at: input.paidAtIso,
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

export async function upsertCoachPaymentFromCsv(
  supabase: SupabaseClient,
  directory: CoachDirectory,
  input: CsvPaymentUpsertInput
): Promise<{ coachId: string | null; created: boolean }> {
  const email = normalizeEmail(input.customerEmail);
  if (!email) {
    throw new Error("Customer email is required.");
  }
  if (!Number.isFinite(input.amountCents) || input.amountCents <= 0) {
    throw new Error("Amount must be greater than zero.");
  }

  const chargeId = input.stripeChargeId?.trim() || null;
  const importRowKey = input.importRowKey.trim();
  const normalizedCurrency = (input.currency ?? "gbp").trim().toLowerCase();

  if (paymentImportSkipReason(email, input.amountCents, normalizedCurrency)) {
    return { coachId: null, created: false };
  }

  const chargeImportRowKey = chargeId ? `charge:${chargeId}` : null;
  const existing = await findExistingPayment(supabase, {
    stripePaymentIntentId: null,
    stripeCheckoutSessionId: null,
    stripeChargeId: chargeId,
    importRowKey: chargeImportRowKey ?? importRowKey,
  });

  const { coachId, assignmentMethod } = resolveCoachAssignment(directory, existing, {
    email,
    companyName: input.customerCompanyName ?? null,
    metadataCoachId: null,
  });

  const resolvedImportRowKey = chargeImportRowKey ?? importRowKey;

  const payload = {
    stripe_charge_id: chargeId,
    import_row_key: resolvedImportRowKey,
    stripe_invoice_id: input.stripeInvoiceId?.trim() || null,
    customer_email: email,
    customer_company_name: input.customerCompanyName?.trim() || null,
    amount_cents: input.amountCents,
    currency: normalizedCurrency,
    status: input.status,
    paid_at: input.paidAtIso,
    decline_reason: input.declineReason?.trim() || null,
    description: input.description?.trim() || null,
    import_source: input.importSource?.trim() || "stripe_csv",
    payment_source: input.paymentSource?.trim() || "stripe",
    coach_id: coachId,
    assignment_method: assignmentMethod,
    notes: null,
  };

  if (existing) {
    const { error: updateError } = await supabase
      .from("coach_payments")
      .update(payload)
      .eq("id", existing.id);
    if (updateError) {
      throw new Error("Unable to update payment.");
    }
    return { coachId, created: false };
  }

  const { error: insertError } = await supabase.from("coach_payments").insert(payload);
  if (insertError) {
    const isDuplicate =
      insertError.code === "23505" ||
      /duplicate key|unique constraint/i.test(insertError.message ?? "");
    if (isDuplicate) {
      const duplicate = await findExistingPayment(supabase, {
        stripePaymentIntentId: null,
        stripeCheckoutSessionId: null,
        stripeChargeId: chargeId,
        importRowKey: resolvedImportRowKey,
      });
      if (duplicate) {
        const { error: updateError } = await supabase
          .from("coach_payments")
          .update(payload)
          .eq("id", duplicate.id);
        if (updateError) {
          throw new Error("Unable to update payment after duplicate insert.");
        }
        return { coachId, created: false };
      }
    }
    throw new Error("Unable to insert payment.");
  }

  return { coachId, created: true };
}

export function suggestCoachForPayment(
  directory: CoachDirectory,
  customerEmail: string,
  customerCompanyName: string | null
): CoachInfo | null {
  const email = normalizeEmail(customerEmail);
  if (!email) return null;

  const emailMatch = directory.uniqueCoachByEmail.get(email);
  if (emailMatch) return emailMatch;

  const localKey = emailLocalCompactKey(email);
  if (localKey) {
    const localMatch = directory.uniqueCoachByEmailLocal.get(localKey);
    if (localMatch) return localMatch;
  }

  const companyKey = normalizeCompany(customerCompanyName);
  if (companyKey) {
    const companyMatch = directory.uniqueCoachByCompany.get(companyKey);
    if (companyMatch) return companyMatch;
    const nameMatch = directory.uniqueCoachByNormalizedName.get(companyKey);
    if (nameMatch) return nameMatch;
  }

  return suggestCoachByPayerLabel(directory, customerCompanyName);
}
