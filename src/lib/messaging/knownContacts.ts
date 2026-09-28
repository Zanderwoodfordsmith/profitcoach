import { normalizePhoneE164 } from "@/lib/bird/client";
import { selectContactsWithOptionalPhone } from "@/lib/contactsSchemaSafeSelect";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import type { UnipileAppChannel } from "@/lib/unipile/providers";

export type KnownContactMatch = {
  id: string;
  full_name: string | null;
  email: string | null;
  phone: string | null;
};

type ContactRow = {
  id: string;
  full_name: string | null;
  email: string | null;
  phone: string | null;
  [key: string]: unknown;
};

/** Channels that must not pull private/personal threads into Conversations. */
export function channelRequiresKnownContact(
  channel: string | null | undefined
): boolean {
  const c = (channel || "").toLowerCase();
  return c === "email" || c === "whatsapp";
}

function normalizeEmail(raw: string | null | undefined): string | null {
  const v = raw?.trim().toLowerCase();
  return v || null;
}

/** Digits only — matches Unipile WhatsApp attendee ids (no leading +). */
export function phoneMatchKey(raw: string | null | undefined): string | null {
  const e164 = normalizePhoneE164(raw);
  if (e164) return e164.replace(/^\+/, "");
  const digits = String(raw || "").replace(/\D/g, "");
  return digits.length >= 8 ? digits : null;
}

export type KnownContactIndex = {
  byEmail: Map<string, KnownContactMatch>;
  byPhone: Map<string, KnownContactMatch>;
  /** Pool (and similar) emails that may ingest even without a contacts row. */
  extraEmails: Set<string>;
};

export function emptyKnownContactIndex(): KnownContactIndex {
  return {
    byEmail: new Map(),
    byPhone: new Map(),
    extraEmails: new Set(),
  };
}

/** CRM contact or a pool/campaign email the coach already collected. */
export function allowlistedEmail(
  index: KnownContactIndex,
  email?: string | null
): boolean {
  if (matchKnownContact(index, { email })) return true;
  const key = normalizeEmail(email);
  return Boolean(key && index.extraEmails.has(key));
}

async function loadPoolEmails(coachId: string): Promise<Set<string>> {
  const extra = new Set<string>();
  const { data: pool } = await supabaseAdmin
    .from("coach_lead_lists")
    .select("id")
    .eq("coach_id", coachId)
    .eq("kind", "pool")
    .maybeSingle();
  const poolId = (pool?.id as string | undefined) ?? null;
  if (!poolId) return extra;

  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabaseAdmin
      .from("coach_lead_list_items")
      .select("email")
      .eq("list_id", poolId)
      .not("email", "is", null)
      .range(from, from + 999);
    if (error) {
      console.error("known contacts pool emails:", error.message);
      break;
    }
    for (const row of data ?? []) {
      const email = normalizeEmail(
        typeof row.email === "string" ? row.email : null
      );
      if (email) extra.add(email);
    }
    if (!data || data.length < 1000) break;
  }
  return extra;
}

export async function loadKnownContactIndex(
  coachId: string
): Promise<KnownContactIndex> {
  const empty = emptyKnownContactIndex();
  const [{ data, error }, extraEmails] = await Promise.all([
    selectContactsWithOptionalPhone<ContactRow>(
      async (columns) =>
        supabaseAdmin.from("contacts").select(columns).eq("coach_id", coachId),
      "id, full_name, email",
      []
    ),
    loadPoolEmails(coachId),
  ]);
  if (error) {
    console.error("known contacts load:", error.message);
    return { ...empty, extraEmails };
  }

  const byEmail = new Map<string, KnownContactMatch>();
  const byPhone = new Map<string, KnownContactMatch>();
  for (const row of data) {
    const match: KnownContactMatch = {
      id: row.id,
      full_name: row.full_name,
      email: row.email,
      phone: row.phone,
    };
    const email = normalizeEmail(row.email);
    if (email && !byEmail.has(email)) byEmail.set(email, match);
    const phone = phoneMatchKey(row.phone);
    if (phone && !byPhone.has(phone)) byPhone.set(phone, match);
  }
  return { byEmail, byPhone, extraEmails };
}

export function matchKnownContact(
  index: KnownContactIndex,
  input: { email?: string | null; phone?: string | null }
): KnownContactMatch | null {
  const email = normalizeEmail(input.email);
  if (email) {
    const hit = index.byEmail.get(email);
    if (hit) return hit;
  }
  const phone = phoneMatchKey(input.phone);
  if (phone) {
    const hit = index.byPhone.get(phone);
    if (hit) return hit;
  }
  return null;
}

export async function findKnownContactForCoach(
  coachId: string,
  input: { email?: string | null; phone?: string | null }
): Promise<KnownContactMatch | null> {
  const email = normalizeEmail(input.email);
  const phone = phoneMatchKey(input.phone);
  if (!email && !phone) return null;

  if (email) {
    const { data } = await supabaseAdmin
      .from("contacts")
      .select("id, full_name, email, phone")
      .eq("coach_id", coachId)
      .ilike("email", email)
      .limit(1)
      .maybeSingle();
    if (data?.id) {
      return {
        id: data.id as string,
        full_name: (data.full_name as string | null) ?? null,
        email: (data.email as string | null) ?? null,
        phone: (data.phone as string | null) ?? null,
      };
    }
  }

  if (phone) {
    const index = await loadKnownContactIndex(coachId);
    return matchKnownContact(index, { phone });
  }

  return null;
}

/**
 * Whether this inbound/sync event may enter Conversations.
 * LinkedIn (and similar outreach) stay open; email/WhatsApp need a CRM contact.
 */
export async function allowPersonalChannelIngest(input: {
  coachId: string;
  channel: UnipileAppChannel | string;
  email?: string | null;
  phone?: string | null;
  /** Existing thread already linked to a contact stays allowed. */
  existingContactId?: string | null;
}): Promise<{ allowed: boolean; contact: KnownContactMatch | null }> {
  if (!channelRequiresKnownContact(input.channel)) {
    return { allowed: true, contact: null };
  }
  if (input.existingContactId) {
    return {
      allowed: true,
      contact: { id: input.existingContactId, full_name: null, email: null, phone: null },
    };
  }
  const contact = await findKnownContactForCoach(input.coachId, {
    email: input.email,
    phone: input.phone,
  });
  if (contact) return { allowed: true, contact };

  const email = normalizeEmail(input.email);
  if (email && (await poolHasEmail(input.coachId, email))) {
    return { allowed: true, contact: null };
  }
  return { allowed: false, contact: null };
}

async function poolHasEmail(coachId: string, email: string): Promise<boolean> {
  const { data: pool } = await supabaseAdmin
    .from("coach_lead_lists")
    .select("id")
    .eq("coach_id", coachId)
    .eq("kind", "pool")
    .maybeSingle();
  const poolId = (pool?.id as string | undefined) ?? null;
  if (!poolId) return false;
  const { data } = await supabaseAdmin
    .from("coach_lead_list_items")
    .select("id")
    .eq("list_id", poolId)
    .ilike("email", email)
    .limit(1)
    .maybeSingle();
  return Boolean(data?.id);
}
