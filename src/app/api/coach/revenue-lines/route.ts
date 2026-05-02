import { NextResponse } from "next/server";
import { requireCoachRequest } from "@/lib/requireCoachRequest";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

function parseAmount(value: unknown): number | null {
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

function parseDate(value: unknown): string | null {
  if (typeof value !== "string" || !value.trim()) return null;
  const s = value.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
  const d = new Date(s + "T12:00:00Z");
  if (Number.isNaN(d.getTime())) return null;
  return s;
}

export async function GET(request: Request) {
  const authCheck = await requireCoachRequest(request);
  if (authCheck.error || !authCheck.userId) {
    const status = authCheck.error === "Invalid access token." ? 401 : 403;
    return NextResponse.json({ error: authCheck.error ?? "Unauthorized" }, { status });
  }

  const coachId = authCheck.userId;
  const url = new URL(request.url);
  const from = url.searchParams.get("from");
  const to = url.searchParams.get("to");

  let q = supabaseAdmin
    .from("coach_revenue_lines")
    .select(
      "id, coach_id, contact_id, amount, currency, occurred_on, source, note, created_at, updated_at"
    )
    .eq("coach_id", coachId)
    .order("occurred_on", { ascending: false })
    .order("created_at", { ascending: false });

  if (from && /^\d{4}-\d{2}-\d{2}$/.test(from)) {
    q = q.gte("occurred_on", from);
  }
  if (to && /^\d{4}-\d{2}-\d{2}$/.test(to)) {
    q = q.lte("occurred_on", to);
  }

  const { data, error } = await q.limit(500);

  if (error) {
    console.error("coach/revenue-lines GET:", error);
    return NextResponse.json({ error: "Could not load income entries." }, { status: 500 });
  }

  return NextResponse.json({ lines: data ?? [] });
}

export async function POST(request: Request) {
  const authCheck = await requireCoachRequest(request);
  if (authCheck.error || !authCheck.userId) {
    const status = authCheck.error === "Invalid access token." ? 401 : 403;
    return NextResponse.json({ error: authCheck.error ?? "Unauthorized" }, { status });
  }

  const coachId = authCheck.userId;
  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;

  const amount = parseAmount(body.amount);
  const occurredOn = parseDate(body.occurredOn ?? body.occurred_on);
  const currency =
    typeof body.currency === "string" && body.currency.trim().length === 3
      ? body.currency.trim().toUpperCase()
      : "GBP";
  const note = typeof body.note === "string" ? body.note.trim() || null : null;
  const contactId =
    body.contactId === null || body.contactId === ""
      ? null
      : typeof body.contactId === "string"
        ? body.contactId
        : null;
  const source =
    body.source === "import" || body.source === "stripe"
      ? body.source
      : "manual";

  if (!amount || !occurredOn) {
    return NextResponse.json(
      { error: "Provide a positive amount and occurredOn (YYYY-MM-DD)." },
      { status: 400 }
    );
  }

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

  const { data: inserted, error: insertError } = await supabaseAdmin
    .from("coach_revenue_lines")
    .insert({
      coach_id: coachId,
      contact_id: contactId,
      amount,
      currency,
      occurred_on: occurredOn,
      source,
      note,
    })
    .select(
      "id, coach_id, contact_id, amount, currency, occurred_on, source, note, created_at, updated_at"
    )
    .maybeSingle();

  if (insertError || !inserted) {
    console.error("coach/revenue-lines POST:", insertError);
    return NextResponse.json(
      { error: insertError?.message ?? "Unable to save income entry." },
      { status: 400 }
    );
  }

  return NextResponse.json({ line: inserted }, { status: 201 });
}
