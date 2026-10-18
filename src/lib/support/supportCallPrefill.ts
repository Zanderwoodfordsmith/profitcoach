import type { SupportCallContactPrefill } from "@/lib/support/supportCallPrefillQuery";
import {
  SUPPORT_CALL_HOSTS,
  type SupportCallHostSlug,
} from "@/lib/support/supportCallHosts";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export {
  buildSupportCallBookingUrl,
  buildSupportCallPrefillQuery,
  contactToApplyPrefill,
  type SupportCallContactPrefill,
} from "@/lib/support/supportCallPrefillQuery";

/**
 * Map ticket assignee → support-call host. Defaults to Zander when unknown.
 */
export async function resolveSupportCallHostSlug(
  assignedTo: string | null | undefined
): Promise<SupportCallHostSlug> {
  const id = assignedTo?.trim();
  if (!id) return "zander";

  const { data: coach } = await supabaseAdmin
    .from("coaches")
    .select("slug")
    .eq("id", id)
    .maybeSingle();

  const slug = (coach?.slug as string | null)?.trim().toLowerCase();
  if (SUPPORT_CALL_HOSTS.some((h) => h.slug === slug)) {
    return slug as SupportCallHostSlug;
  }

  return "zander";
}

/** Load name / email / phone for a member profile (auth email preferred). */
export async function loadSupportCallContactPrefill(
  userId: string | null | undefined
): Promise<SupportCallContactPrefill> {
  if (!userId?.trim()) return {};

  const [{ data: profile }, auth] = await Promise.all([
    supabaseAdmin
      .from("profiles")
      .select("first_name, last_name, full_name, phone")
      .eq("id", userId)
      .maybeSingle(),
    supabaseAdmin.auth.admin.getUserById(userId).catch(() => null),
  ]);

  const email = auth?.data?.user?.email?.trim().toLowerCase() || null;
  let firstName = profile?.first_name?.trim() || null;
  let lastName = profile?.last_name?.trim() || null;
  if ((!firstName || !lastName) && profile?.full_name?.trim()) {
    const parts = profile.full_name.trim().split(/\s+/);
    firstName = firstName || parts[0] || null;
    lastName = lastName || parts.slice(1).join(" ") || null;
  }

  return {
    firstName,
    lastName,
    email,
    phone: profile?.phone?.trim() || null,
  };
}

/**
 * Name / email / phone for a ticket's support-call link. Prefers the linked
 * profile (Auth email + phone); falls back to the ticket's contact fields.
 */
export async function loadTicketSupportCallContact(ticket: {
  created_by: string | null;
  contact_email: string | null;
  submitter_name: string | null;
}): Promise<SupportCallContactPrefill> {
  const fromProfile = ticket.created_by
    ? await loadSupportCallContactPrefill(ticket.created_by)
    : {};

  let firstName = fromProfile.firstName ?? null;
  let lastName = fromProfile.lastName ?? null;
  if ((!firstName || !lastName) && ticket.submitter_name?.trim()) {
    const parts = ticket.submitter_name.trim().split(/\s+/);
    firstName = firstName || parts[0] || null;
    lastName = lastName || parts.slice(1).join(" ") || null;
  }

  return {
    firstName,
    lastName,
    email:
      fromProfile.email?.trim() ||
      ticket.contact_email?.trim()?.toLowerCase() ||
      null,
    phone: fromProfile.phone?.trim() || null,
  };
}
