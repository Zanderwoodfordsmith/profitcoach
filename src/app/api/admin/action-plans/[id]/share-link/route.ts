import { getOrCreateShareLink } from "@/lib/actionPlans/invitationService";
import { requireAdmin } from "@/lib/requireAdmin";
import { NextResponse } from "next/server";

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const authCheck = await requireAdmin(request);
  if (authCheck.error || !authCheck.userId) {
    return NextResponse.json({ error: authCheck.error ?? "Unauthorized" }, { status: 401 });
  }

  const { id } = await context.params;

  try {
    const link = await getOrCreateShareLink({
      templateId: id,
      createdBy: authCheck.userId,
    });
    const origin = new URL(request.url).origin;
    return NextResponse.json({
      token: link.token,
      coachPath: link.urlPath,
      adminPath: `/admin/signature/actions?plan=${link.token}`,
      coachUrl: `${origin}${link.urlPath}`,
      adminUrl: `${origin}/admin/signature/actions?plan=${link.token}`,
    });
  } catch (err) {
    console.error("admin/action-plans/[id]/share-link GET error:", err);
    return NextResponse.json({ error: "Server error." }, { status: 500 });
  }
}

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  return GET(request, context);
}
