import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/requireAdmin";
import { sendSupportCreatedTicketEmail } from "@/lib/support/notifyCoachOfReply";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * Email the coach the opening message when an admin creates a ticket.
 */
export async function POST(
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

  const result = await sendSupportCreatedTicketEmail({
    ticketId,
    signatureUserId: auth.userId,
    request,
  });

  if (!result.ok) {
    const status = result.error === "Ticket not found." ? 404 : 502;
    return NextResponse.json({ error: result.error }, { status });
  }

  return NextResponse.json({
    ok: true,
    sent: Boolean(result.emailed),
    emailed: result.emailed,
    alreadySent: Boolean(result.alreadySent),
    skipped: Boolean(result.skipped),
  });
}
