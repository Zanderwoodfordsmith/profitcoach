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
};

export async function loadKnownContactIndex(
  coachId: string
): Promise<KnownContactIndex> {
  const { data, error } = await selectContactsWithOptionalPhone<ContactRow>(
    async (columns) =>
      supabaseAdmin.from("contacts").select(columns).eq("coach_id", coachId),
    "id, full_name, email",
    []
  );
  if (error) {
    console.error("known contacts load:", error.message);
    return { byEmail: new Map(), byPhone: new Map() };
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
  return { byEmail, byPhone };
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
  return { allowed: Boolean(contact), contact };
}
