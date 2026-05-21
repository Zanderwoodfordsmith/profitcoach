import { inviteCoachesToActionPlan, resolvePushCoachIds } from "@/lib/actionPlans/invitationService";
import type { PushMode } from "@/lib/actionPlans/types";
import { requireAdmin } from "@/lib/requireAdmin";
import { NextResponse } from "next/server";

function parsePushBody(body: unknown): {
  mode: PushMode;
  coachIds?: string[];
  groupIds?: string[];
} | null {
  if (!body || typeof body !== "object") return null;
  const mode = (body as { mode?: unknown }).mode;
  if (mode !== "all" && mode !== "coaches" && mode !== "groups") return null;
  const coachIds = (body as { coachIds?: unknown }).coachIds;
  const groupIds = (body as { groupIds?: unknown }).groupIds;
  return {
    mode,
    coachIds: Array.isArray(coachIds)
      ? coachIds.filter((id): id is string => typeof id === "string")
      : undefined,
    groupIds: Array.isArray(groupIds)
      ? groupIds.filter((id): id is string => typeof id === "string")
      : undefined,
  };
}

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const authCheck = await requireAdmin(request);
  if (authCheck.error || !authCheck.userId) {
    return NextResponse.json({ error: authCheck.error ?? "Unauthorized" }, { status: 401 });
  }

  const { id } = await context.params;

  try {
    const body = await request.json();
    const parsed = parsePushBody(body);
    if (!parsed) {
      return NextResponse.json({ error: "Invalid payload." }, { status: 400 });
    }

    const coachIds = await resolvePushCoachIds(parsed);
    if (!coachIds.length) {
      return NextResponse.json({ error: "No coaches selected." }, { status: 400 });
    }

    const result = await inviteCoachesToActionPlan({
      templateId: id,
      coachIds,
      invitedBy: authCheck.userId,
    });

    return NextResponse.json({
      result,
      recipientCount: coachIds.length,
      mode: "invite",
    });
  } catch (err) {
    console.error("admin/action-plans/[id]/push POST error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Server error." },
      { status: 500 },
    );
  }
}
