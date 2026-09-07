import { phoneMatchKey } from "@/lib/messaging/knownContacts";
import { resolveAccountIdForChannel } from "@/lib/messaging/startConversation";
import { resolveUnipileUser } from "@/lib/unipile/client";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

/** Re-query Unipile at most this often for the same phone digits. */
export const WHATSAPP_CHECK_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export type WhatsAppOnStatus = {
  on: boolean | null;
  checkedAt: string | null;
  phoneDigits: string | null;
  source: "cache" | "unipile" | "thread" | "cleared" | "skipped";
  error?: string;
};

function whatsappPublicId(digits: string): string {
  return `${digits}@s.whatsapp.net`;
}

function cacheIsFresh(
  checkedAt: string | null | undefined,
  ttlMs = WHATSAPP_CHECK_TTL_MS
): boolean {
  if (!checkedAt) return false;
  const t = new Date(checkedAt).getTime();
  if (!Number.isFinite(t)) return false;
  return Date.now() - t < ttlMs;
}

/**
 * Ask Unipile whether a phone is registered on WhatsApp.
 * Uses GET /users/{phone}@s.whatsapp.net — 200 = on, 404 = not on.
 */
export async function checkWhatsAppNumberOnUnipile(input: {
  accountId: string;
  phone: string;
}): Promise<{ on: boolean | null; providerId: string | null; error?: string }> {
  const digits = phoneMatchKey(input.phone);
  if (!digits) {
    return { on: null, providerId: null, error: "Invalid phone number." };
  }

  const result = await resolveUnipileUser(
    whatsappPublicId(digits),
    input.accountId
  );

  if (result.ok && result.data) {
    const id =
      (typeof result.data.id === "string" && result.data.id) ||
      (typeof result.data.provider_id === "string" && result.data.provider_id) ||
      null;
    return { on: true, providerId: id };
  }

  if (result.status === 404) {
    return { on: false, providerId: null };
  }

  return {
    on: null,
    providerId: null,
    error: result.error || `WhatsApp check failed (${result.status}).`,
  };
}

/**
 * Ensure contacts.whatsapp_on matches the current phone.
 * AuthZ: caller must already have verified coach owns the contact.
 */
export async function syncContactWhatsAppStatus(input: {
  coachId: string;
  contactId: string;
  /** Skip TTL cache and call Unipile again. */
  force?: boolean;
  /** Prefer this phone (e.g. just-saved) over the DB value. */
  phoneOverride?: string | null;
}): Promise<WhatsAppOnStatus> {
  const { data: contact, error } = await supabaseAdmin
    .from("contacts")
    .select(
      "id, coach_id, phone, whatsapp_on, whatsapp_checked_at, whatsapp_checked_phone"
    )
    .eq("id", input.contactId)
    .maybeSingle();

  if (error) {
    // Columns may be missing pre-migration — fail soft.
    if (
      error.code === "42703" ||
      error.code === "PGRST204" ||
      /whatsapp_/i.test(error.message || "")
    ) {
      return {
        on: null,
        checkedAt: null,
        phoneDigits: null,
        source: "skipped",
        error: "WhatsApp status columns not available yet.",
      };
    }
    return {
      on: null,
      checkedAt: null,
      phoneDigits: null,
      source: "skipped",
      error: "Unable to load contact.",
    };
  }

  if (!contact || contact.coach_id !== input.coachId) {
    return {
      on: null,
      checkedAt: null,
      phoneDigits: null,
      source: "skipped",
      error: "Prospect not found.",
    };
  }

  const phoneRaw =
    input.phoneOverride !== undefined
      ? input.phoneOverride
      : ((contact.phone as string | null) ?? null);
  const digits = phoneMatchKey(phoneRaw);

  if (!digits) {
    await supabaseAdmin
      .from("contacts")
      .update({
        whatsapp_on: null,
        whatsapp_checked_at: null,
        whatsapp_checked_phone: null,
      })
      .eq("id", input.contactId)
      .eq("coach_id", input.coachId);
    return {
      on: null,
      checkedAt: null,
      phoneDigits: null,
      source: "cleared",
    };
  }

  const cachedPhone = phoneMatchKey(
    (contact.whatsapp_checked_phone as string | null) ?? null
  );
  const cachedOn =
    typeof contact.whatsapp_on === "boolean" ? contact.whatsapp_on : null;
  const checkedAt = (contact.whatsapp_checked_at as string | null) ?? null;

  if (
    !input.force &&
    cachedPhone === digits &&
    cachedOn !== null &&
    cacheIsFresh(checkedAt)
  ) {
    return {
      on: cachedOn,
      checkedAt,
      phoneDigits: digits,
      source: "cache",
    };
  }

  // Already messaging them on WhatsApp ⇒ treat as on without another Unipile hit.
  const { data: waThread } = await supabaseAdmin
    .from("messaging_conversations")
    .select("id")
    .eq("coach_id", input.coachId)
    .eq("contact_id", input.contactId)
    .eq("last_channel", "whatsapp")
    .limit(1)
    .maybeSingle();

  if (waThread?.id && !input.force) {
    const now = new Date().toISOString();
    await supabaseAdmin
      .from("contacts")
      .update({
        whatsapp_on: true,
        whatsapp_checked_at: now,
        whatsapp_checked_phone: digits,
      })
      .eq("id", input.contactId)
      .eq("coach_id", input.coachId);
    return {
      on: true,
      checkedAt: now,
      phoneDigits: digits,
      source: "thread",
    };
  }

  const accountId = await resolveAccountIdForChannel(input.coachId, "whatsapp");
  if (!accountId) {
    return {
      on: cachedPhone === digits ? cachedOn : null,
      checkedAt: cachedPhone === digits ? checkedAt : null,
      phoneDigits: digits,
      source: "skipped",
      error: "Connect WhatsApp in Settings → Integrations first.",
    };
  }

  const checked = await checkWhatsAppNumberOnUnipile({
    accountId,
    phone: digits,
  });

  if (checked.on === null) {
    return {
      on: cachedPhone === digits ? cachedOn : null,
      checkedAt: cachedPhone === digits ? checkedAt : null,
      phoneDigits: digits,
      source: "skipped",
      error: checked.error,
    };
  }

  const now = new Date().toISOString();
  await supabaseAdmin
    .from("contacts")
    .update({
      whatsapp_on: checked.on,
      whatsapp_checked_at: now,
      whatsapp_checked_phone: digits,
    })
    .eq("id", input.contactId)
    .eq("coach_id", input.coachId);

  return {
    on: checked.on,
    checkedAt: now,
    phoneDigits: digits,
    source: "unipile",
  };
}

/** Best-effort: mark on=true after a successful WhatsApp sync/send. */
export async function markContactWhatsAppOn(input: {
  coachId: string;
  contactId: string;
  phone?: string | null;
}): Promise<void> {
  const digits = phoneMatchKey(input.phone);
  const patch: Record<string, unknown> = {
    whatsapp_on: true,
    whatsapp_checked_at: new Date().toISOString(),
  };
  if (digits) patch.whatsapp_checked_phone = digits;
  await supabaseAdmin
    .from("contacts")
    .update(patch)
    .eq("id", input.contactId)
    .eq("coach_id", input.coachId);
}
