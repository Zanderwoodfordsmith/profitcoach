import { NextResponse } from "next/server";
import { requireOutreachCoach } from "@/lib/unipile/requireOutreachCoach";
import {
  getInviteWithdrawPolicy,
  listPendingInvitesForCoach,
  saveInviteWithdrawPolicy,
  withdrawInvitation,
  withdrawOldestInvitations,
} from "@/lib/unipile/invitations";
import {
  PENDING_LIST_MAX,
  remainingAutoQuota,
  selectInvitesToWithdraw,
  utcDateYmd,
  inviteSentAt,
} from "@/lib/unipile/inviteWithdraw";

/** LinkedIn paging via Unipile is slow; stay under the platform kill that returns HTML. */
export const maxDuration = 60;

export async function GET(request: Request) {
  let coachId: string | null = null;
  try {
    const auth = await requireOutreachCoach(request);
    if (auth.error || !auth.coachId) {
      return NextResponse.json({ error: auth.error }, { status: 401 });
    }
    coachId = auth.coachId;
    const url = new URL(request.url);
    const full = url.searchParams.get("full") === "1";
    const data = await listPendingInvitesForCoach(coachId, {
      // Total always counts the full pending pile; maxItems only limits returned rows.
      maxItems: full ? PENDING_LIST_MAX : 1,
      deadlineAt: Date.now() + 45_000,
    });
    const quota = remainingAutoQuota(data.withdraw, utcDateYmd());
    const wouldWithdraw = selectInvitesToWithdraw(
      data.invitations.map((invite) => ({
        id: invite.id,
        sentAt: inviteSentAt(invite.parsed_datetime || invite.date),
      })),
      data.withdraw,
      quota
    ).length;
    return NextResponse.json({
      ...data,
      withdraw: { ...data.withdraw, wouldWithdraw },
    });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Could not list invitations.";
    if (coachId) {
      try {
        const withdraw = await getInviteWithdrawPolicy(coachId);
        return NextResponse.json({
          invitations: [],
          total: 0,
          has_more: false,
          withdraw,
          error: message,
        });
      } catch {
        /* still return JSON below */
      }
    }
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const auth = await requireOutreachCoach(request);
  if (auth.error || !auth.coachId) {
    return NextResponse.json({ error: auth.error }, { status: 401 });
  }
  const body = (await request.json().catch(() => ({}))) as {
    action?: string;
    invitation_id?: string;
    count?: number;
    mode?: string;
    value?: number;
  };

  try {
    if (body.action === "save_policy") {
      const withdraw = await saveInviteWithdrawPolicy(auth.coachId, {
        mode: body.mode,
        value: body.value,
      });
      return NextResponse.json({ ok: true, withdraw });
    }
    if (body.action === "withdraw" && body.invitation_id) {
      await withdrawInvitation(auth.coachId, body.invitation_id.trim());
      const data = await listPendingInvitesForCoach(auth.coachId, {
        maxItems: PENDING_LIST_MAX,
        deadlineAt: Date.now() + 45_000,
      });
      return NextResponse.json({ ok: true, ...data });
    }
    if (body.action === "withdraw_oldest") {
      const result = await withdrawOldestInvitations(
        auth.coachId,
        Number(body.count ?? 10)
      );
      const data = await listPendingInvitesForCoach(auth.coachId, {
        maxItems: PENDING_LIST_MAX,
        deadlineAt: Date.now() + 45_000,
      });
      return NextResponse.json({ ok: true, ...result, ...data });
    }
    return NextResponse.json({ error: "Unknown action." }, { status: 400 });
  } catch (err) {
    return NextResponse.json(
      {
        error:
          err instanceof Error ? err.message : "Could not withdraw invitation.",
      },
      { status: 500 }
    );
  }
}
