import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/requireAdmin";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { DISPOSITIONS, NEXT_STEPS } from "@/lib/ava/replyTriage";

export const runtime = "nodejs";

/**
 * Admin review of Ava's reply triage. Lists positive and neutral replies with
 * Ava's call, and lets an admin record the right call. Read and label only.
 */
export async function GET(request: Request) {
  const auth = await requireAdmin(request);
  if (auth.error) return NextResponse.json({ error: auth.error }, { status: 401 });

  const url = new URL(request.url);
  const view = url.searchParams.get("view") === "labelled" ? "labelled" : url.searchParams.get("view") === "all" ? "all" : "todo";
  const dispositions = (url.searchParams.get("disposition") || "interested,neutral")
    .split(",")
    .filter((d) => (DISPOSITIONS as readonly string[]).includes(d));

  let query = supabaseAdmin
    .from("ava_reply_triage")
    .select(
      "id, coach_id, conversation_id, channel, inbound_text, inbound_at, disposition, situation, next_step, confidence, reason, draft, alert_sent_at, alert_channels, mode, status, sent_text, admin_disposition, admin_next_step, admin_note, admin_labelled_at, created_at"
    )
    .in("disposition", dispositions.length ? dispositions : ["interested", "neutral"])
    .order("inbound_at", { ascending: false, nullsFirst: false })
    .limit(200);
  if (view === "todo") query = query.is("admin_labelled_at", null);
  if (view === "labelled") query = query.not("admin_labelled_at", "is", null);
  const { data: rows, error } = await query;
  if (error) {
    console.error("ava replies list:", error.message);
    return NextResponse.json({ error: "Could not load replies." }, { status: 500 });
  }

  const ids = [...new Set((rows ?? []).map((r) => r.coach_id as string))];
  const convIds = [...new Set((rows ?? []).map((r) => r.conversation_id as string))];
  const [{ data: profiles }, { data: convs }] = await Promise.all([
    ids.length ? supabaseAdmin.from("profiles").select("id, full_name").in("id", ids) : Promise.resolve({ data: [] }),
    convIds.length
      ? supabaseAdmin.from("messaging_conversations").select("id, prospect_name, prospect_business_name").in("id", convIds)
      : Promise.resolve({ data: [] }),
  ]);
  const coachName = new Map((profiles ?? []).map((p) => [p.id as string, (p.full_name as string) || ""]));
  const conv = new Map((convs ?? []).map((c) => [c.id as string, c]));

  // Accuracy over everything labelled so far (not just this page).
  const { data: labelled } = await supabaseAdmin
    .from("ava_reply_triage")
    .select("disposition, next_step, admin_disposition, admin_next_step")
    .not("admin_labelled_at", "is", null)
    .limit(5000);
  const total = labelled?.length ?? 0;
  const dispositionAgree = (labelled ?? []).filter((r) => r.admin_disposition === r.disposition).length;
  const stepAgree = (labelled ?? []).filter((r) => r.admin_next_step === r.next_step).length;
  const calendarCalls = (labelled ?? []).filter((r) => r.next_step === "calendar");
  const calendarRight = calendarCalls.filter((r) => r.admin_next_step === "calendar").length;

  return NextResponse.json({
    rows: (rows ?? []).map((r) => ({
      ...r,
      coach_name: coachName.get(r.coach_id as string) || "",
      prospect_name: (conv.get(r.conversation_id as string)?.prospect_name as string) || "",
      prospect_business: (conv.get(r.conversation_id as string)?.prospect_business_name as string) || "",
    })),
    stats: {
      labelled: total,
      dispositionAgree,
      stepAgree,
      calendarCalls: calendarCalls.length,
      calendarRight,
    },
  });
}

export async function PATCH(request: Request) {
  const auth = await requireAdmin(request);
  if (auth.error || !auth.userId) return NextResponse.json({ error: auth.error }, { status: 401 });

  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const id = typeof body.id === "string" ? body.id : "";
  const disposition = typeof body.disposition === "string" ? body.disposition : "";
  const nextStep = typeof body.next_step === "string" ? body.next_step : "";
  const note = typeof body.note === "string" ? body.note.trim().slice(0, 1000) : null;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return NextResponse.json({ error: "Missing reply." }, { status: 400 });
  if (!(DISPOSITIONS as readonly string[]).includes(disposition) || !(NEXT_STEPS as readonly string[]).includes(nextStep)) {
    return NextResponse.json({ error: "Pick a type and a next step." }, { status: 400 });
  }

  const { error } = await supabaseAdmin
    .from("ava_reply_triage")
    .update({
      admin_disposition: disposition,
      admin_next_step: nextStep,
      admin_note: note || null,
      admin_labelled_by: auth.userId,
      admin_labelled_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);
  if (error) {
    console.error("ava replies label:", error.message);
    return NextResponse.json({ error: "Could not save." }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
