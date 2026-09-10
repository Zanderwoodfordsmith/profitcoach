import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/requireAdmin";
import {
  loadSupportCallContactPrefill,
  type SupportCallContactPrefill,
} from "@/lib/support/supportCallPrefill";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";

/**
 * Name / email / phone for support-call booking templates on a ticket.
 * Prefers linked profile Auth email + phone; falls back to ticket contact fields.
 */
export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdmin(request);
  if (auth.error) {
    return NextResponse.json({ error: auth.error }, { status: 401 });
  }

  const { id: ticketId } = await context.params;
  if (!ticketId) {
    return NextResponse.json({ error: "Missing ticket id." }, { status: 400 });
  }

  const { data: ticket, error } = await supabaseAdmin
    .from("community_feedback_reports")
    .select("id, created_by, contact_email, submitter_name")
    .eq("id", ticketId)
    .maybeSingle();

  if (error || !ticket) {
    return NextResponse.json({ error: "Ticket not found." }, { status: 404 });
  }

  const fromProfile = ticket.created_by
    ? await loadSupportCallContactPrefill(ticket.created_by as string)
    : {};

  let firstName = fromProfile.firstName ?? null;
  let lastName = fromProfile.lastName ?? null;
  if ((!firstName || !lastName) && ticket.submitter_name?.trim()) {
    const parts = String(ticket.submitter_name).trim().split(/\s+/);
    firstName = firstName || parts[0] || null;
    lastName = lastName || parts.slice(1).join(" ") || null;
  }

  const contact: SupportCallContactPrefill = {
    firstName,
    lastName,
    email:
      fromProfile.email?.trim() ||
      (ticket.contact_email as string | null)?.trim()?.toLowerCase() ||
      null,
    phone: fromProfile.phone?.trim() || null,
  };

  return NextResponse.json({ contact });
}
