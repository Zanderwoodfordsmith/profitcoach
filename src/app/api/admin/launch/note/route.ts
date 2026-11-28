import { NextResponse } from "next/server";

import { requireAdmin } from "@/lib/requireAdmin";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";

/**
 * Save BCA's next-step note and working order for a coach (Admin → Coaches →
 * Launch view, 28 Nov). Admin only. Send note and/or order (null clears it),
 * or orders: [{ coach_id, order }] to save a dragged order in one go.
 */
export async function PATCH(request: Request) {
  const auth = await requireAdmin(request);
  if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.error === "Server error." ? 500 : 401 });

  const body = (await request.json().catch(() => null)) as { coach_id?: unknown; note?: unknown; order?: unknown; orders?: unknown } | null;

  // Drag and drop: a whole new order at once.
  if (Array.isArray(body?.orders)) {
    const orders = (body.orders as { coach_id?: unknown; order?: unknown }[]).filter(
      (o) => typeof o.coach_id === "string" && Number.isInteger(o.order) && Number(o.order) >= 1 && Number(o.order) <= 999
    );
    if (!orders.length || orders.length > 300) return NextResponse.json({ error: "Nothing to reorder." }, { status: 400 });
    const results = await Promise.all(
      orders.map((o) => supabaseAdmin.from("coaches").update({ launch_order: Number(o.order) }).eq("id", o.coach_id as string))
    );
    const failed = results.find((r) => r.error);
    if (failed?.error) {
      console.error("launch order:", failed.error.message);
      return NextResponse.json({ error: "Could not save the new order." }, { status: 500 });
    }
    return NextResponse.json({ ok: true });
  }

  const coachId = typeof body?.coach_id === "string" ? body.coach_id : "";
  if (!coachId) return NextResponse.json({ error: "Which coach?" }, { status: 400 });

  const update: Record<string, unknown> = {};
  if (body && "note" in body) {
    if (body.note !== null && typeof body.note !== "string") return NextResponse.json({ error: "The note must be text." }, { status: 400 });
    const note = typeof body.note === "string" ? body.note.trim().slice(0, 600) : "";
    update.launch_note = note || null;
    update.launch_note_updated_at = new Date().toISOString();
  }
  if (body && "order" in body) {
    const n = body.order === null || body.order === "" ? null : Number(body.order);
    if (n !== null && (!Number.isInteger(n) || n < 1 || n > 999)) return NextResponse.json({ error: "Order is a whole number from 1." }, { status: 400 });
    update.launch_order = n;
  }
  if (!Object.keys(update).length) return NextResponse.json({ error: "Nothing to save." }, { status: 400 });

  const { error } = await supabaseAdmin.from("coaches").update(update).eq("id", coachId);
  if (error) {
    console.error("launch note:", error.message);
    return NextResponse.json({ error: "Could not save that." }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
