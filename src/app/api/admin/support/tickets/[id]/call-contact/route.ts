import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/requireAdmin";
import { loadTicketSupportCallContact } from "@/lib/support/supportCallPrefill";
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

  const contact = await loadTicketSupportCallContact({
    created_by: (ticket.created_by as string | null) ?? null,
    contact_email: (ticket.contact_email as string | null) ?? null,
    submitter_name: (ticket.submitter_name as string | null) ?? null,
  });

  return NextResponse.json({ contact });
}
