import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/requireAdmin";
import {
  processDueSupportReplyEmails,
  queueSupportReplyEmailNotify,
  resolveSupportNotifyRecipient,
} from "@/lib/support/notifyCoachOfReply";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";
export const maxDuration = 60;

type Body = {
  replyBody?: string;
};

/**
 * Send a staff-reply notification email immediately. Cron retries failures.
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

  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const replyBody = body.replyBody?.trim() ?? "";
  if (!replyBody) {
    return NextResponse.json(
      { error: "replyBody is required." },
      { status: 400 }
    );
  }
  if (replyBody.length > 8000) {
    return NextResponse.json({ error: "Reply is too long." }, { status: 400 });
  }

  const { data: ticket, error } = await supabaseAdmin
    .from("community_feedback_reports")
    .select(
      "id, ticket_number, title, created_by, contact_email, submitter_name, source, member_notify_email"
    )
    .eq("id", ticketId)
    .maybeSingle();

  if (error || !ticket) {
    return NextResponse.json({ error: "Ticket not found." }, { status: 404 });
  }

  const recipient = await resolveSupportNotifyRecipient({
    created_by: ticket.created_by,
    contact_email: ticket.contact_email,
    submitter_name: ticket.submitter_name,
  });

  if (!recipient) {
    return NextResponse.json(
      { error: "No email address on this ticket to notify." },
      { status: 400 }
    );
  }

  const queued = await queueSupportReplyEmailNotify(ticket.id);
  if (!queued.ok) {
    return NextResponse.json(
      { error: queued.error || "Could not queue email." },
      { status: 502 }
    );
  }

  const flushed = await processDueSupportReplyEmails(1, request, ticket.id);
  const thisError = flushed.errors.find((e) =>
    e.startsWith(`${ticket.id}:`)
  );
  if (thisError) {
    return NextResponse.json({
      ok: true,
      queued: true,
      sent: false,
      emailed: recipient.email,
      isMember: recipient.isMember,
      sendAfter: queued.sendAfter,
      memberPrefersEmail: ticket.member_notify_email !== false,
      error: thisError.slice(ticket.id.length + 2),
    });
  }

  return NextResponse.json({
    ok: true,
    queued: false,
    sent: flushed.sent > 0,
    emailed: recipient.email,
    isMember: recipient.isMember,
    memberPrefersEmail: ticket.member_notify_email !== false,
  });
}
