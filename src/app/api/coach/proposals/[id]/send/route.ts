import { NextResponse } from "next/server";
import { resolveAccountIdForChannel } from "@/lib/messaging/startConversation";
import { proposalUrl } from "@/lib/proposals/send";
import { loadCoachProposal, toProposal } from "@/lib/proposals/store";
import { PROPOSAL_COLUMNS } from "@/lib/proposals/types";
import { requireCoachRequest } from "@/lib/requireCoachRequest";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { sendUnipileEmail } from "@/lib/unipile/client";

export const runtime = "nodejs";

/**
 * Send the proposal. "email" goes from the coach's own connected mailbox, so
 * replies come back to them. "link" marks it sent when the coach shares the
 * link themselves (LinkedIn, WhatsApp, their own email).
 */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireCoachRequest(request, { allowAdminSelf: true });
  if (auth.error) return NextResponse.json({ error: auth.error }, { status: 401 });
  const proposal = await loadCoachProposal(auth.userId, (await params).id);
  if (!proposal) return NextResponse.json({ error: "Proposal not found." }, { status: 404 });
  if (proposal.status === "signed") return NextResponse.json({ error: "This proposal is already signed." }, { status: 409 });

  const body = (await request.json().catch(() => null)) as { mode?: string; to?: string; subject?: string; message?: string } | null;
  const url = proposalUrl(proposal.share_token);
  let sentTo: string | null = null;

  if (body?.mode === "email") {
    const to = body.to?.trim().toLowerCase() ?? "";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)) return NextResponse.json({ error: "Add their email address." }, { status: 400 });
    let message = body.message?.trim() ?? "";
    if (!message) return NextResponse.json({ error: "Write a short message to go with it." }, { status: 400 });
    // The link is the point of the email: make sure it's in there.
    if (!message.includes(url)) message = `${message}\n\n${url}`;
    const accountId = await resolveAccountIdForChannel(auth.userId, "email");
    if (!accountId) {
      return NextResponse.json(
        { error: "Connect your email in Settings to send from here, or copy the link and send it yourself." },
        { status: 400 }
      );
    }
    const sent = await sendUnipileEmail({
      account_id: accountId,
      to: [{ identifier: to, display_name: proposal.prospect_name }],
      subject: body.subject?.trim() || "Your proposal",
      body: message,
    });
    if (!sent.ok) {
      console.error("proposal send:", sent.error);
      return NextResponse.json({ error: "Your email didn't send. Try again, or copy the link instead." }, { status: 502 });
    }
    sentTo = to;
  } else if (body?.mode !== "link") {
    return NextResponse.json({ error: "Choose email or link." }, { status: 400 });
  }

  const now = new Date().toISOString();
  const { data, error } = await supabaseAdmin
    .from("coach_proposals")
    .update({
      sent_at: now,
      sent_to: sentTo ?? proposal.sent_to,
      ...(proposal.status === "draft" ? { status: "sent" } : {}),
      ...(sentTo && !proposal.prospect_email ? { prospect_email: sentTo } : {}),
      updated_at: now,
    })
    .eq("id", proposal.id)
    .select(PROPOSAL_COLUMNS)
    .single();
  if (error) return NextResponse.json({ error: "Sent, but couldn't update the proposal." }, { status: 500 });
  return NextResponse.json({ proposal: toProposal(data), url });
}
