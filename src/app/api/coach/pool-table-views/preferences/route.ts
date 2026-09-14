import { NextResponse } from "next/server";
import { requireCoachRequest } from "@/lib/requireCoachRequest";
import { updatePoolTableViewPreferencesForOwner } from "@/lib/pool/poolTableViewsServer";

export async function PATCH(request: Request) {
  const auth = await requireCoachRequest(request, { allowAdminSelf: true });
  if (auth.error || !auth.userId) {
    return NextResponse.json(
      { error: auth.error ?? "Unauthorized" },
      { status: 401 }
    );
  }
  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
  }
  try {
    const viewOrder = Array.isArray(body.viewOrder)
      ? body.viewOrder.filter((id): id is string => typeof id === "string")
      : undefined;
    const payload = await updatePoolTableViewPreferencesForOwner({
      ownerId: auth.userId,
      activeViewId:
        typeof body.activeViewId === "string" ? body.activeViewId : undefined,
      autosave: typeof body.autosave === "boolean" ? body.autosave : undefined,
      viewOrder,
    });
    return NextResponse.json(payload);
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Unable to save preferences.";
    console.error("coach pool-table-views preferences PATCH:", err);
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
