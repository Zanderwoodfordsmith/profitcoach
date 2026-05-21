import {
  listPendingInvitationsForCoach,
  loadInvitationPreview,
  resolveInvitationFromShareToken,
} from "@/lib/actionPlans/invitationService";
import { requireCoachForActions } from "@/lib/actionPlans/requireCoachForActions";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const authCheck = await requireCoachForActions(request);
  if (authCheck.error || !authCheck.userId) {
    return NextResponse.json({ error: authCheck.error ?? "Unauthorized" }, { status: 401 });
  }

  try {
    const invitations = await listPendingInvitationsForCoach(authCheck.userId);
    return NextResponse.json({ invitations });
  } catch (err) {
    console.error("coach/action-plan-invitations GET error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Server error." },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  const authCheck = await requireCoachForActions(request);
  if (authCheck.error || !authCheck.userId) {
    return NextResponse.json({ error: authCheck.error ?? "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const token = typeof body.token === "string" ? body.token.trim() : "";
    if (!token) {
      return NextResponse.json({ error: "Token is required." }, { status: 400 });
    }

    const resolved = await resolveInvitationFromShareToken({
      token,
      coachId: authCheck.userId,
    });
    const preview = await loadInvitationPreview(resolved.invitationId, authCheck.userId);
    return NextResponse.json({
      ...preview,
      created: resolved.created,
    });
  } catch (err) {
    console.error("coach/action-plan-invitations POST from-link error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Server error." },
      { status: 400 },
    );
  }
}
