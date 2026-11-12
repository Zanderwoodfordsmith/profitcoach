import { supabaseAdmin } from "@/lib/supabaseAdmin";
import type { InvoiceDetails } from "@/lib/invoices/coachInvoice";

export type LoadedInvoiceDetails = {
  coachName: string | null;
  /**
   * Only what they saved for invoices. The profile's business name can be a
   * coaching brand rather than the company that should be billed.
   */
  businessName: string | null;
  details: InvoiceDetails | null;
};

export async function loadInvoiceDetails(coachId: string): Promise<LoadedInvoiceDetails> {
  const [saved, profile] = await Promise.all([
    supabaseAdmin
      .from("coach_invoice_details")
      .select("business_name, address, company_number, vat_number")
      .eq("coach_id", coachId)
      .maybeSingle(),
    supabaseAdmin
      .from("profiles")
      .select("full_name, first_name, last_name")
      .eq("id", coachId)
      .maybeSingle(),
  ]);
  if (saved.error) throw new Error(saved.error.message);

  const p = profile.data;
  const details = (saved.data as InvoiceDetails | null) ?? null;
  return {
    coachName:
      p?.full_name?.trim() ||
      [p?.first_name, p?.last_name].filter(Boolean).join(" ").trim() ||
      null,
    businessName: details?.business_name ?? null,
    details,
  };
}
