import { NextResponse } from "next/server";

import { requireAdmin } from "@/lib/requireAdmin";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { PASS_MARK, assessmentSessions } from "@/lib/simulator/server";

/**
 * Admin review of a certification attempt: change any session's score, then
 * confirm. The average uses the reviewer's scores where given.
 */
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const check = await requireAdmin(request);
  if (check.error) return NextResponse.json({ error: check.error }, { status: 401 });
  const { id } = await params;

  const body = (await request.json().catch(() => null)) as {
    scores?: Record<string, number | null>;
    note?: string;
    confirm?: boolean;
  } | null;
  const sessions = await assessmentSessions(id);
  if (!sessions.length) return NextResponse.json({ error: "Not found." }, { status: 404 });

  for (const [sessionId, value] of Object.entries(body?.scores ?? {})) {
    if (!sessions.some((s) => s.id === sessionId)) continue;
    const score = value === null ? null : Math.max(0, Math.min(50, Math.round(Number(value))));
    if (score !== null && !Number.isFinite(score)) continue;
    await supabaseAdmin.from("sim_sessions").update({ reviewed_score: score }).eq("id", sessionId);
  }

  const fresh = (await assessmentSessions(id)).filter((s) => s.status === "scored");
  const finals = fresh.map((s) => s.reviewed_score ?? s.score ?? 0);
  const average = finals.length ? Math.round((finals.reduce((a, b) => a + b, 0) / finals.length) * 10) / 10 : null;
  const patch: Record<string, unknown> = {
    average,
    passed: average === null ? null : average >= PASS_MARK,
    review_note: typeof body?.note === "string" ? body.note.trim().slice(0, 2000) || null : undefined,
  };
  if (body?.confirm) {
    patch.status = "reviewed";
    patch.reviewed_by = check.userId;
    patch.reviewed_at = new Date().toISOString();
  }
  if (patch.review_note === undefined) delete patch.review_note;
  const { data, error } = await supabaseAdmin.from("sim_assessments").update(patch).eq("id", id).select("*").single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ assessment: data });
}
