import { NextResponse } from "next/server";

import { requireCoachRequest } from "@/lib/requireCoachRequest";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { reviseClient, rowToClient, type CustomRow } from "@/lib/simulator/custom";

export const maxDuration = 120;

async function ownRow(coachId: string, id: string): Promise<CustomRow | null> {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const { data } = await supabaseAdmin.from("sim_custom_clients").select("*").eq("id", id).eq("coach_id", coachId).maybeSingle();
  return (data as CustomRow | null) ?? null;
}

/**
 * Change a custom client: { change } asks the AI to revise it, { confirm }
 * makes it ready to practise with, { shared } shares it with other coaches.
 */
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const check = await requireCoachRequest(request, { allowAdminSelf: true });
  if (check.error || !check.userId) {
    return NextResponse.json({ error: check.error ?? "Unauthorized" }, { status: 401 });
  }
  const { id } = await params;
  const row = await ownRow(check.userId, id);
  if (!row) return NextResponse.json({ error: "Not found." }, { status: 404 });
  const body = (await request.json().catch(() => null)) as { change?: unknown; confirm?: unknown; shared?: unknown; isReal?: unknown } | null;

  const patch: Partial<CustomRow> = { updated_at: new Date().toISOString() };
  try {
    if (typeof body?.change === "string" && body.change.trim()) {
      patch.client = await reviseClient({ client: row.client, situation: row.situation, change: body.change.trim().slice(0, 2000) });
    }
    if (body?.confirm === true) patch.status = "ready";
    if (typeof body?.shared === "boolean") patch.shared = body.shared;
    if (typeof body?.isReal === "boolean") patch.is_real = body.isReal;
    const { data, error } = await supabaseAdmin.from("sim_custom_clients").update(patch).eq("id", id).select("*").single();
    if (error || !data) throw new Error(error?.message ?? "update failed");
    return NextResponse.json({ client: rowToClient(data as CustomRow, check.userId, null) });
  } catch (err) {
    console.error("simulator custom update:", err instanceof Error ? err.message : "failed");
    return NextResponse.json({ error: "Couldn't change the client. Try again." }, { status: 502 });
  }
}

/** Delete a custom client. Past sessions with them keep their transcript and report. */
export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const check = await requireCoachRequest(request, { allowAdminSelf: true });
  if (check.error || !check.userId) {
    return NextResponse.json({ error: check.error ?? "Unauthorized" }, { status: 401 });
  }
  const { id } = await params;
  const row = await ownRow(check.userId, id);
  if (!row) return NextResponse.json({ error: "Not found." }, { status: 404 });
  await supabaseAdmin.from("sim_custom_clients").delete().eq("id", id);
  return NextResponse.json({ ok: true });
}
