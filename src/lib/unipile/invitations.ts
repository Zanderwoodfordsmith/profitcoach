import { supabaseAdmin } from "@/lib/supabaseAdmin";
import {
  cancelSentInvitation,
  listSentInvitations,
  type UnipileSentInvitation,
} from "@/lib/unipile/client";

export type PendingInviteRow = UnipileSentInvitation & {
  campaign_lead_id?: string | null;
  campaign_id?: string | null;
};

async function requireAccount(coachId: string, outreachAccountId?: string | null) {
  let q = supabaseAdmin
    .from("linkedin_outreach_accounts")
    .select("id, unipile_account_id, status")
    .eq("coach_id", coachId)
    .eq("status", "OK");
  if (outreachAccountId) q = q.eq("id", outreachAccountId);
  const { data, error } = await q.order("created_at", { ascending: false }).limit(1).maybeSingle();
  if (error) throw new Error(error.message);
  if (!data?.unipile_account_id) {
    throw new Error("No connected LinkedIn account.");
  }
  return data as { id: string; unipile_account_id: string; status: string };
}

export async function listPendingInvitesForCoach(
  coachId: string
): Promise<{ account_id: string; invitations: PendingInviteRow[]; total: number }> {
  const account = await requireAccount(coachId);
  const listed = await listSentInvitations({
    account_id: account.unipile_account_id,
    limit: 100,
  });
  if (!listed.ok) {
    throw new Error(listed.error || "Could not list pending invitations.");
  }

  const items = listed.data?.items ?? [];
  const invitationIds = items.map((i) => i.id).filter(Boolean);

  const leadByInvite = new Map<
    string,
    { id: string; campaign_id: string }
  >();
  if (invitationIds.length) {
    const { data: leads } = await supabaseAdmin
      .from("linkedin_campaign_leads")
      .select("id, campaign_id, invitation_id")
      .eq("coach_id", coachId)
      .in("invitation_id", invitationIds);
    for (const lead of leads ?? []) {
      if (lead.invitation_id) {
        leadByInvite.set(lead.invitation_id as string, {
          id: lead.id as string,
          campaign_id: lead.campaign_id as string,
        });
      }
    }
  }

  const invitations: PendingInviteRow[] = items.map((item) => {
    const match = leadByInvite.get(item.id);
    return {
      ...item,
      campaign_lead_id: match?.id ?? null,
      campaign_id: match?.campaign_id ?? null,
    };
  });

  // Oldest first so bulk withdraw clears the longest-pending first
  invitations.sort((a, b) => {
    const ta = new Date(a.parsed_datetime || a.date || 0).getTime();
    const tb = new Date(b.parsed_datetime || b.date || 0).getTime();
    return ta - tb;
  });

  return {
    account_id: account.id,
    invitations,
    total: invitations.length,
  };
}

async function markLeadInviteWithdrawn(coachId: string, invitationId: string) {
  await supabaseAdmin
    .from("linkedin_campaign_leads")
    .update({
      status: "skipped",
      last_error: "Connection request withdrawn",
      next_action_at: null,
    })
    .eq("coach_id", coachId)
    .eq("invitation_id", invitationId)
    .eq("status", "invited");
}

export async function withdrawInvitation(
  coachId: string,
  invitationId: string
) {
  const account = await requireAccount(coachId);
  const res = await cancelSentInvitation({
    account_id: account.unipile_account_id,
    invitation_id: invitationId,
  });
  if (!res.ok && res.status !== 404) {
    throw new Error(res.error || "Could not withdraw invitation.");
  }
  await markLeadInviteWithdrawn(coachId, invitationId);
  return { ok: true };
}

/** Withdraw the oldest pending invites (LinkedIn pending-invite hygiene). */
export async function withdrawOldestInvitations(
  coachId: string,
  count: number
) {
  const limit = Math.min(50, Math.max(1, Math.floor(count)));
  const { invitations } = await listPendingInvitesForCoach(coachId);
  const targets = invitations.slice(0, limit);
  let withdrawn = 0;
  const errors: string[] = [];
  for (const invite of targets) {
    try {
      await withdrawInvitation(coachId, invite.id);
      withdrawn += 1;
    } catch (err) {
      errors.push(
        err instanceof Error ? err.message : `Failed ${invite.id}`
      );
    }
  }
  return { withdrawn, attempted: targets.length, errors };
}
