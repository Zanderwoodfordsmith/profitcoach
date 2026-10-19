import { NextResponse } from "next/server";
import { NEXT_STEP_LABELS, type NextStep } from "@/lib/ava/replyTriage";
import { resolveMessagingAccess } from "@/lib/messaging/resolveMessagingAccess";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";

/** Ava's latest read of this conversation: her suggestion and draft, if still open. */
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const access = await resolveMessagingAccess(request);
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status });
  const { data } = await supabaseAdmin
    .from("ava_reply_triage")
    .select("id, next_step, disposition, reason, draft, status, sent_text, created_at")
    .eq("conversation_id", id)
    .eq("coach_id", access.coachId)
    .gte("created_at", new Date(Date.now() - 7 * 86400000).toISOString())
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!data || (data.status !== "open" && data.status !== "autopilot_scheduled")) return NextResponse.json({ ava: null });
  return NextResponse.json({
    ava: {
      id: data.id,
      suggestion: NEXT_STEP_LABELS[data.next_step as NextStep] ?? null,
      reason: data.reason,
      draft: data.status === "autopilot_scheduled" ? null : data.draft,
      autopilotText: data.status === "autopilot_scheduled" ? data.sent_text : null,
    },
  });
}

/** Body: { id, action: "used" | "dismissed" } — the coach used or dismissed Ava's draft. */
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const access = await resolveMessagingAccess(request);
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status });
  const body = (await request.json().catch(() => ({}))) as { id?: unknown; action?: unknown };
  const triageId = typeof body.id === "string" ? body.id : "";
  const status = body.action === "used" ? "sent" : body.action === "dismissed" ? "dismissed" : null;
  if (!/^[0-9a-f-]{36}$/i.test(triageId) || !status) return NextResponse.json({ error: "Nothing to update." }, { status: 400 });
  await supabaseAdmin
    .from("ava_reply_triage")
    .update({ status, updated_at: new Date().toISOString() })
    .eq("id", triageId)
    .eq("conversation_id", id)
    .eq("coach_id", access.coachId)
    .eq("status", "open");
  return NextResponse.json({ ok: true });
}
