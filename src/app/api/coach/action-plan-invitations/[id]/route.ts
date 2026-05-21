import {
  acceptInvitation,
  declineInvitation,
  loadInvitationPreview,
} from "@/lib/actionPlans/invitationService";
import { requireCoachForActions } from "@/lib/actionPlans/requireCoachForActions";
import { NextResponse } from "next/server";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const authCheck = await requireCoachForActions(_request);
  if (authCheck.error || !authCheck.userId) {
    return NextResponse.json({ error: authCheck.error ?? "Unauthorized" }, { status: 401 });
  }

  const { id } = await context.params;

  try {
    const preview = await loadInvitationPreview(id, authCheck.userId);
    return NextResponse.json(preview);
  } catch (err) {
    console.error("coach/action-plan-invitations/[id] GET error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Server error." },
      { status: 404 },
    );
  }
}

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const authCheck = await requireCoachForActions(request);
  if (authCheck.error || !authCheck.userId) {
    return NextResponse.json({ error: authCheck.error ?? "Unauthorized" }, { status: 401 });
  }

  const { id } = await context.params;

  try {
    const body = await request.json();
    const action = body.action;
    if (action === "accept") {
      const result = await acceptInvitation({
        invitationId: id,
        coachId: authCheck.userId,
      });
      return NextResponse.json({ ok: true, ...result });
    }
    if (action === "decline") {
      await declineInvitation({ invitationId: id, coachId: authCheck.userId });
      return NextResponse.json({ ok: true });
    }
    return NextResponse.json({ error: "Invalid action." }, { status: 400 });
  } catch (err) {
    console.error("coach/action-plan-invitations/[id] POST error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Server error." },
      { status: 400 },
    );
  }
}
