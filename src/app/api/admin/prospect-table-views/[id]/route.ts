import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/requireAdmin";
import {
  deleteProspectTableViewForOwner,
  updateProspectTableViewForOwner,
} from "@/lib/prospects/prospectTableViewsServer";

type RouteContext = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, context: RouteContext) {
  const auth = await requireAdmin(request);
  if (auth.error || !auth.userId) {
    return NextResponse.json(
      { error: auth.error ?? "Unauthorized" },
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
    const payload = await updateProspectTableViewForOwner({
      ownerId: auth.userId,
      surface: "admin",
      viewId: id,
      name: typeof body.name === "string" ? body.name : undefined,
      settings: body.settings,
    });
    return NextResponse.json(payload);
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Unable to update view.";
    console.error("admin prospect-table-views PATCH:", err);
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function DELETE(request: Request, context: RouteContext) {
  const auth = await requireAdmin(request);
  if (auth.error || !auth.userId) {
    return NextResponse.json(
      { error: auth.error ?? "Unauthorized" },
      { status: 401 }
    );
  }

  const { id } = await context.params;

  try {
    const payload = await deleteProspectTableViewForOwner({
      ownerId: auth.userId,
      surface: "admin",
      viewId: id,
    });
    return NextResponse.json(payload);
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Unable to delete view.";
    console.error("admin prospect-table-views DELETE:", err);
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
