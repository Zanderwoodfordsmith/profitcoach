import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/requireAdmin";
import {
  createCoachTableViewForAdmin,
  listCoachTableViewsForAdmin,
} from "@/lib/admin/coachTableViewsServer";
import type { CoachTableViewSettings } from "@/lib/admin/coachTableViews";

export async function GET(request: Request) {
  const authCheck = await requireAdmin(request);
  if (authCheck.error || !authCheck.userId) {
    return NextResponse.json(
      { error: authCheck.error ?? "Unauthorized" },
      { status: 401 }
    );
  }

  try {
    const payload = await listCoachTableViewsForAdmin(authCheck.userId);
    return NextResponse.json(payload);
  } catch (err) {
    console.error("coach-table-views GET:", err);
    return NextResponse.json({ error: "Unable to load views." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const authCheck = await requireAdmin(request);
  if (authCheck.error || !authCheck.userId) {
    return NextResponse.json(
      { error: authCheck.error ?? "Unauthorized" },
      { status: 401 }
    );
  }

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
  }

  const name = typeof body.name === "string" ? body.name : "";
  const settings = body.settings as CoachTableViewSettings | undefined;
  if (!settings || typeof settings !== "object") {
    return NextResponse.json({ error: "Invalid view settings." }, { status: 400 });
  }

  try {
    const payload = await createCoachTableViewForAdmin({
      userId: authCheck.userId,
      name,
      settings,
      isPrivate: body.isPrivate === true,
      makeActive: body.makeActive === true,
    });
    return NextResponse.json(payload);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unable to create view.";
    console.error("coach-table-views POST:", err);
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
