import { NextResponse } from "next/server";
import { requireCoachRequest } from "@/lib/requireCoachRequest";
import {
  deletePoolTableViewForOwner,
  updatePoolTableViewForOwner,
} from "@/lib/pool/poolTableViewsServer";

type RouteContext = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, context: RouteContext) {
  const auth = await requireCoachRequest(request, { allowAdminSelf: true });
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
    const payload = await updatePoolTableViewForOwner({
      ownerId: auth.userId,
      viewId: id,
      name: typeof body.name === "string" ? body.name : undefined,
      settings: body.settings,
    });
    return NextResponse.json(payload);
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Unable to update view.";
    console.error("coach pool-table-views PATCH:", err);
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function DELETE(request: Request, context: RouteContext) {
  const auth = await requireCoachRequest(request, { allowAdminSelf: true });
  if (auth.error || !auth.userId) {
    return NextResponse.json(
      { error: auth.error ?? "Unauthorized" },
      { status: 401 }
    );
  }
  const { id } = await context.params;
  try {
    const payload = await deletePoolTableViewForOwner({
      ownerId: auth.userId,
      viewId: id,
    });
    return NextResponse.json(payload);
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Unable to delete view.";
    console.error("coach pool-table-views DELETE:", err);
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
