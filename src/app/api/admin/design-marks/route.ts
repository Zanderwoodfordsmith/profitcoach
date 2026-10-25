import { NextResponse } from "next/server";

import { requireAdmin } from "@/lib/requireAdmin";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

/** Admin → Brand → Design: Zander's marks on each family of live pieces. */
export async function GET(request: Request) {
  const check = await requireAdmin(request);
  if (check.error) {
    return NextResponse.json({ error: check.error }, { status: check.error === "Server error." ? 500 : 401 });
  }

  const { data, error } = await supabaseAdmin
    .from("design_marks")
    .select("piece_id, mark, note, updated_at");
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data ?? []);
}

/** Saves one mark. No mark and no note clears it. */
export async function PUT(request: Request) {
  const check = await requireAdmin(request);
  if (check.error) {
    return NextResponse.json({ error: check.error }, { status: check.error === "Server error." ? 500 : 401 });
  }

  const body = (await request.json().catch(() => ({}))) as {
    pieceId?: unknown;
    kind?: unknown;
    label?: unknown;
    mark?: unknown;
    note?: unknown;
  };
  const pieceId = typeof body.pieceId === "string" ? body.pieceId.trim() : "";
  const kind = typeof body.kind === "string" ? body.kind.trim() : "";
  const label = typeof body.label === "string" ? body.label.trim() : "";
  const mark = body.mark === "fits" || body.mark === "no" ? body.mark : null;
  const note = typeof body.note === "string" ? body.note.trim().slice(0, 2000) || null : null;
  if (!pieceId || !kind || !label) {
    return NextResponse.json({ error: "pieceId, kind and label are required." }, { status: 400 });
  }

  if (!mark && !note) {
    const { error } = await supabaseAdmin.from("design_marks").delete().eq("piece_id", pieceId);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  const { error } = await supabaseAdmin.from("design_marks").upsert({
    piece_id: pieceId,
    kind,
    label,
    mark,
    note,
    marked_by: check.userId,
    updated_at: new Date().toISOString(),
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
