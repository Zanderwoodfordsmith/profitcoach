import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/requireAdmin";
import {
  deleteCoachTableViewForAdmin,
  updateCoachTableViewForAdmin,
} from "@/lib/admin/coachTableViewsServer";
import type { CoachTableViewSettings } from "@/lib/admin/coachTableViews";

type RouteContext = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, context: RouteContext) {
  const authCheck = await requireAdmin(request);
  if (authCheck.error || !authCheck.userId) {
    return NextResponse.json(
      { error: authCheck.error ?? "Unauthorized" },
      { status: 401 }
    );
  }

  const { id } = await context.params;

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
  }

  try {
    const payload = await updateCoachTableViewForAdmin({
      userId: authCheck.userId,
      viewId: id,
      name: typeof body.name === "string" ? body.name : undefined,
      settings:
        body.settings && typeof body.settings === "object"
          ? (body.settings as CoachTableViewSettings)
          : undefined,
      isPrivate:
        typeof body.isPrivate === "boolean" ? body.isPrivate : undefined,
    });
    return NextResponse.json(payload);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unable to update view.";
    console.error("coach-table-views PATCH:", err);
    const status = message.includes("Not authorized") ? 403 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}

export async function DELETE(request: Request, context: RouteContext) {
  const authCheck = await requireAdmin(request);
  if (authCheck.error || !authCheck.userId) {
    return NextResponse.json(
      { error: authCheck.error ?? "Unauthorized" },
      { status: 401 }
    );
  }

  const { id } = await context.params;

  try {
    const payload = await deleteCoachTableViewForAdmin(authCheck.userId, id);
    return NextResponse.json(payload);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unable to delete view.";
    console.error("coach-table-views DELETE:", err);
    const status = message.includes("Not authorized") ? 403 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
