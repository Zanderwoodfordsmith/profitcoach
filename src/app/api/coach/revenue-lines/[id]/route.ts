import { NextResponse } from "next/server";
import { requireCoachRequest } from "@/lib/requireCoachRequest";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

function parseAmount(value: unknown): number | null | undefined {
  if (value === undefined) return undefined;
  if (typeof value === "number" && Number.isFinite(value) && value > 0) {
    return Math.round(value * 100) / 100;
  }
  if (typeof value === "string" && value.trim()) {
    const n = Number.parseFloat(value.replace(/,/g, ""));
    if (Number.isFinite(n) && n > 0) {
      return Math.round(n * 100) / 100;
    }
  }
  return null;
}

function parseDate(value: unknown): string | null | undefined {
  if (value === undefined) return undefined;
  if (value === null) return null;
  if (typeof value !== "string" || !value.trim()) return null;
  const s = value.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
  const d = new Date(s + "T12:00:00Z");
  if (Number.isNaN(d.getTime())) return null;
  return s;
}

type RouteContext = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, context: RouteContext) {
  const authCheck = await requireCoachRequest(request);
  if (authCheck.error || !authCheck.userId) {
    const status = authCheck.error === "Invalid access token." ? 401 : 403;
    return NextResponse.json({ error: authCheck.error ?? "Unauthorized" }, { status });
  }

  const coachId = authCheck.userId;
  const { id } = await context.params;
  if (!id) {
    return NextResponse.json({ error: "Missing id." }, { status: 400 });
  }

  const { data: existing, error: loadErr } = await supabaseAdmin
    .from("coach_revenue_lines")
    .select("id, coach_id")
    .eq("id", id)
    .maybeSingle();

  if (loadErr || !existing || existing.coach_id !== coachId) {
    return NextResponse.json({ error: "Entry not found." }, { status: 404 });
  }

  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;

  const patch: Record<string, unknown> = {};

  const amount = parseAmount(body.amount);
  if (amount === null) {
    return NextResponse.json({ error: "Invalid amount." }, { status: 400 });
  }
  if (amount !== undefined) patch.amount = amount;

  const occurredOn = parseDate(body.occurredOn ?? body.occurred_on);
  if (occurredOn === null && (body.occurredOn !== undefined || body.occurred_on !== undefined)) {
    return NextResponse.json({ error: "Invalid occurredOn (use YYYY-MM-DD)." }, { status: 400 });
  }
  if (occurredOn !== undefined) patch.occurred_on = occurredOn;

  if (typeof body.currency === "string" && body.currency.trim().length === 3) {
    patch.currency = body.currency.trim().toUpperCase();
  }

  if (typeof body.note === "string") {
    patch.note = body.note.trim() || null;
  }

  if ("contactId" in body || "contact_id" in body) {
    const raw = body.contactId ?? body.contact_id;
    const contactId =
      raw === null || raw === "" ? null : typeof raw === "string" ? raw : undefined;
    if (contactId === undefined && raw !== null && raw !== "") {
      return NextResponse.json({ error: "Invalid contactId." }, { status: 400 });
    }
    if (contactId !== undefined) {
      if (contactId) {
        const { data: contact, error: cErr } = await supabaseAdmin
          .from("contacts")
          .select("id")
          .eq("id", contactId)
          .eq("coach_id", coachId)
          .maybeSingle();
        if (cErr || !contact) {
          return NextResponse.json(
            { error: "Client not found or not assigned to you." },
            { status: 400 }
          );
        }
      }
      patch.contact_id = contactId;
    }
  }

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: "No valid fields to update." }, { status: 400 });
  }

  const { data: updated, error: upErr } = await supabaseAdmin
    .from("coach_revenue_lines")
    .update(patch)
    .eq("id", id)
    .eq("coach_id", coachId)
    .select(
      "id, coach_id, contact_id, amount, currency, occurred_on, source, note, created_at, updated_at"
    )
    .maybeSingle();

  if (upErr || !updated) {
    console.error("coach/revenue-lines PATCH:", upErr);
    return NextResponse.json(
      { error: upErr?.message ?? "Unable to update entry." },
      { status: 400 }
    );
  }

  return NextResponse.json({ line: updated });
}

export async function DELETE(request: Request, context: RouteContext) {
  const authCheck = await requireCoachRequest(request);
  if (authCheck.error || !authCheck.userId) {
    const status = authCheck.error === "Invalid access token." ? 401 : 403;
    return NextResponse.json({ error: authCheck.error ?? "Unauthorized" }, { status });
  }

  const coachId = authCheck.userId;
  const { id } = await context.params;
  if (!id) {
    return NextResponse.json({ error: "Missing id." }, { status: 400 });
  }

  const { error } = await supabaseAdmin
    .from("coach_revenue_lines")
    .delete()
    .eq("id", id)
    .eq("coach_id", coachId);

  if (error) {
    console.error("coach/revenue-lines DELETE:", error);
    return NextResponse.json({ error: "Unable to delete entry." }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
