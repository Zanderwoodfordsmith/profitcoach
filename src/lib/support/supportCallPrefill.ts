import type { ApplyPrefill } from "@/lib/booking/bookCallPrefill";
import {
  SUPPORT_CALL_HOSTS,
  type SupportCallHostSlug,
  supportCallHostPath,
} from "@/lib/support/supportCallHosts";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export type SupportCallContactPrefill = {
  firstName?: string | null;
  lastName?: string | null;
  email?: string | null;
  phone?: string | null;
};

/** Query string for support-call pages (name / email / phone only). */
export function buildSupportCallPrefillQuery(
  input: SupportCallContactPrefill
): string {
  const params = new URLSearchParams();
  const firstName = input.firstName?.trim();
  const lastName = input.lastName?.trim();
  const email = input.email?.trim();
  const phone = input.phone?.trim();
  if (firstName) params.set("first_name", firstName);
  if (lastName) params.set("last_name", lastName);
  if (email) params.set("email", email);
  if (phone) params.set("phone", phone);
  const qs = params.toString();
  return qs ? `?${qs}` : "";
}

export function buildSupportCallBookingUrl(input: {
  baseUrl: string;
  hostSlug: SupportCallHostSlug;
  contact?: SupportCallContactPrefill;
}): string {
  const base = input.baseUrl.replace(/\/$/, "");
  const path = supportCallHostPath(input.hostSlug) ?? `/support-call-${input.hostSlug}`;
  return `${base}${path}${buildSupportCallPrefillQuery(input.contact ?? {})}`;
}

export function contactToApplyPrefill(
  contact: SupportCallContactPrefill
): ApplyPrefill {
  return {
    firstName: contact.firstName?.trim() || undefined,
    lastName: contact.lastName?.trim() || undefined,
    email: contact.email?.trim() || undefined,
    phone: contact.phone?.trim() || undefined,
  };
}

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
