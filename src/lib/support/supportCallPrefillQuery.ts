import type { ApplyPrefill } from "@/lib/booking/bookCallPrefill";
import {
  type SupportCallHostSlug,
  supportCallHostPath,
} from "@/lib/support/supportCallHosts";

/**
 * Support-call link and prefill helpers, safe for the browser. The server
 * lookups that fill them live in supportCallPrefill.ts (which re-exports these).
 */

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
