import {
  getOrCreateShareLink,
  listInvitationsForTemplate,
} from "@/lib/actionPlans/invitationService";
import { requireAdmin } from "@/lib/requireAdmin";
import { NextResponse } from "next/server";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const authCheck = await requireAdmin(_request);
  if (authCheck.error) {
    return NextResponse.json({ error: authCheck.error }, { status: 401 });
  }

  const { id } = await context.params;

  try {
    const invitations = await listInvitationsForTemplate(id);
    return NextResponse.json({ invitations });
  } catch (err) {
    console.error("admin/action-plans/[id]/invitations GET error:", err);
    return NextResponse.json({ error: "Server error." }, { status: 500 });
  }
}
