import { NextResponse } from "next/server";
import { sendPushToUser } from "@/lib/push/webPush";
import { loadProposalByToken } from "@/lib/proposals/store";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";

/**
 * The prospect opened their proposal. Called from the page itself (scanners
 * and link previews don't run it), never from the coach's "See what they see".
 * The coach gets a push the first time.
 */
export async function POST(_request: Request, { params }: { params: Promise<{ token: string }> }) {
  const proposal = await loadProposalByToken((await params).token);
  if (!proposal) return NextResponse.json({ error: "Not found." }, { status: 404 });
  const now = new Date().toISOString();
  const first = !proposal.first_opened_at;
  await supabaseAdmin
    .from("coach_proposals")
    .update({
      open_count: proposal.open_count + 1,
      last_opened_at: now,
      ...(first ? { first_opened_at: now } : {}),
      ...(proposal.status === "draft" || proposal.status === "sent" ? { status: "opened" } : {}),
    })
    .eq("id", proposal.id);
  if (first) {
    await sendPushToUser(proposal.coach_id, {
      title: `${proposal.prospect_name} opened your proposal`,
      body: proposal.prospect_business ? `${proposal.prospect_business} is reading it now.` : "They're reading it now.",
      url: `/coach/proposals/${proposal.id}`,
      tag: `proposal-${proposal.id}`,
    }).catch(() => 0);
  }
  return NextResponse.json({ ok: true });
}
