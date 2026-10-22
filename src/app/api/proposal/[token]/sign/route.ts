import { NextResponse } from "next/server";
import { resolveAccountIdForChannel } from "@/lib/messaging/startConversation";
import { proposalUrl } from "@/lib/proposals/send";
import { loadProposalByToken } from "@/lib/proposals/store";
import { sendPushToUser } from "@/lib/push/webPush";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { getSupportMailboxAccount } from "@/lib/support/mailbox";
import { sendUnipileEmail } from "@/lib/unipile/client";

export const runtime = "nodejs";

const APP_BASE = (process.env.APP_BASE_URL || "https://app.theprofitcoach.com").replace(/\/$/, "");

/**
 * The prospect accepts: they type their name and tick the box. We keep the
 * words they saw at that moment, lock the proposal, and send both sides a copy.
 */
export async function POST(request: Request, { params }: { params: Promise<{ token: string }> }) {
  const proposal = await loadProposalByToken((await params).token);
  if (!proposal) return NextResponse.json({ error: "This proposal isn't available." }, { status: 404 });
  if (proposal.status === "signed") return NextResponse.json({ error: "This proposal is already signed." }, { status: 409 });

  const body = (await request.json().catch(() => null)) as { name?: string; agree?: boolean } | null;
  const name = body?.name?.trim().replace(/\s+/g, " ").slice(0, 120) ?? "";
  if (name.length < 2) return NextResponse.json({ error: "Type your full name to sign." }, { status: 400 });
  if (body?.agree !== true) return NextResponse.json({ error: "Tick the box to say you accept." }, { status: 400 });

  const now = new Date().toISOString();
  const snapshot = {
    sections: proposal.sections.filter((s) => !s.hidden && s.body.trim()),
    prospect_name: proposal.prospect_name,
    prospect_business: proposal.prospect_business,
    signed_from: request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null,
    user_agent: request.headers.get("user-agent")?.slice(0, 300) ?? null,
  };
  const { data, error } = await supabaseAdmin
    .from("coach_proposals")
    .update({ status: "signed", signed_at: now, signed_name: name, signed_snapshot: snapshot, updated_at: now })
    .eq("id", proposal.id)
    .neq("status", "signed")
    .select("id")
    .maybeSingle();
  if (error || !data) return NextResponse.json({ error: "Could not save your signature. Please try again." }, { status: 500 });

  const url = proposalUrl(proposal.share_token);
  const what = proposal.prospect_business || proposal.prospect_name;
  const when = new Date(now).toLocaleString("en-GB", { dateStyle: "long", timeStyle: "short", timeZone: "Europe/London" });
  const [{ data: coachProfile }, { data: coachUser }, coachMailbox] = await Promise.all([
    supabaseAdmin.from("profiles").select("full_name").eq("id", proposal.coach_id).maybeSingle(),
    supabaseAdmin.auth.admin.getUserById(proposal.coach_id),
    resolveAccountIdForChannel(proposal.coach_id, "email").catch(() => null),
  ]);
  const coachName = (coachProfile?.full_name as string | null)?.trim() || "your coach";
  const sent = { prospect: false, coach: false };

  // The prospect's copy comes from the coach's own email.
  const prospectEmail = proposal.prospect_email ?? proposal.sent_to;
  if (prospectEmail && coachMailbox) {
    const res = await sendUnipileEmail({
      account_id: coachMailbox,
      to: [{ identifier: prospectEmail, display_name: proposal.prospect_name }],
      subject: `Your signed proposal${proposal.prospect_business ? ` for ${proposal.prospect_business}` : ""}`,
      body: [
        `Hi ${proposal.prospect_name.split(" ")[0]},`,
        `Thank you. You signed the proposal on ${when}. Here's your copy to keep:`,
        url,
        `I'll be in touch shortly with your welcome pack and your first sessions.`,
        coachName.split(" ")[0],
      ].join("\n\n"),
    }).catch(() => ({ ok: false as const }));
    sent.prospect = res.ok;
  }

  // The coach hears straight away: push, and an email to themselves.
  await sendPushToUser(proposal.coach_id, {
    title: `${name} signed your proposal`,
    body: `${what} said yes.`,
    url: `/coach/proposals/${proposal.id}`,
    tag: `proposal-${proposal.id}`,
  }).catch(() => 0);
  const coachEmail = coachUser.user?.email?.trim();
  const fromAccount = coachMailbox ?? (await getSupportMailboxAccount().catch(() => null))?.unipile_account_id ?? null;
  if (coachEmail && fromAccount) {
    const res = await sendUnipileEmail({
      account_id: fromAccount,
      to: [{ identifier: coachEmail }],
      subject: `Signed: ${what}`,
      body: [
        `${name} signed the proposal for ${what} on ${when}.`,
        `Their copy: ${url}`,
        sent.prospect ? `They've been emailed a copy from your email.` : `Send them the link above so they have a copy.`,
        `See it in Proposals: ${APP_BASE}/coach/proposals/${proposal.id}`,
      ].join("\n\n"),
    }).catch(() => ({ ok: false as const }));
    sent.coach = res.ok;
  }

  return NextResponse.json({ ok: true, signed_at: now, signed_name: name, emailed: sent });
}
