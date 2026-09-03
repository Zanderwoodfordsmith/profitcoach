import { NextResponse } from "next/server";
import { requireOutreachCoach } from "@/lib/unipile/requireOutreachCoach";
import {
  listPendingInvitesForCoach,
  withdrawInvitation,
  withdrawOldestInvitations,
} from "@/lib/unipile/invitations";

export async function GET(request: Request) {
  const auth = await requireOutreachCoach(request);
  if (auth.error || !auth.coachId) {
    return NextResponse.json({ error: auth.error }, { status: 401 });
  }
  try {
    const data = await listPendingInvitesForCoach(auth.coachId);
    return NextResponse.json(data);
  } catch (err) {
    return NextResponse.json(
      {
        error:
          err instanceof Error ? err.message : "Could not list invitations.",
      },
      { status: 500 }
    );
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
  };

  try {
    if (body.action === "withdraw" && body.invitation_id) {
      await withdrawInvitation(auth.coachId, body.invitation_id.trim());
      const data = await listPendingInvitesForCoach(auth.coachId);
      return NextResponse.json({ ok: true, ...data });
    }
    if (body.action === "withdraw_oldest") {
      const result = await withdrawOldestInvitations(
        auth.coachId,
        Number(body.count ?? 10)
      );
      const data = await listPendingInvitesForCoach(auth.coachId);
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
