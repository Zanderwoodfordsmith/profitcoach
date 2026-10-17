import { NextResponse } from "next/server";
import { HABIT_TARGETS, loadHabitWeek, logHabit } from "@/lib/dailyHabit";
import { listIntentSignals, refreshIntentSignals } from "@/lib/intentSignals";
import { requireShareCoach } from "@/lib/shareLinks/requireShareCoach";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";

/** The coach's Today view: 1-10-10 habit for the week plus intent signals to message. */
export async function GET(request: Request) {
  const auth = await requireShareCoach(request);
  if (auth.error || !auth.coachId) return NextResponse.json({ error: auth.error }, { status: 401 });

  let refreshError: string | null = null;
  if (new URL(request.url).searchParams.get("refresh") === "1") {
    const out = await refreshIntentSignals(auth.coachId);
    refreshError = out.error;
  }
  try {
    const [habit, signals] = await Promise.all([loadHabitWeek(auth.coachId), listIntentSignals(auth.coachId)]);
    return NextResponse.json({ targets: HABIT_TARGETS, habit, signals, refreshError });
  } catch (err) {
    console.error("today:", err instanceof Error ? err.message : err);
    return NextResponse.json({ error: "Could not load today." }, { status: 500 });
  }
}

/** Body: { log: "comments" | "posts", delta } or { signalId, status: "messaged" | "dismissed" }. */
export async function PATCH(request: Request) {
  const auth = await requireShareCoach(request);
  if (auth.error || !auth.coachId) return NextResponse.json({ error: auth.error }, { status: 401 });
  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;

  if (body.log === "comments" || body.log === "posts") {
    const delta = Number(body.delta);
    if (!Number.isFinite(delta) || Math.abs(delta) > 50) {
      return NextResponse.json({ error: "Bad amount." }, { status: 400 });
    }
    try {
      await logHabit(auth.coachId, body.log, delta);
    } catch {
      return NextResponse.json({ error: "Could not save." }, { status: 500 });
    }
    return NextResponse.json({ ok: true });
  }

  const signalId = typeof body.signalId === "string" ? body.signalId : "";
  const status = body.status === "messaged" || body.status === "dismissed" ? body.status : null;
  if (!/^[0-9a-f-]{36}$/i.test(signalId) || !status) {
    return NextResponse.json({ error: "Nothing to update." }, { status: 400 });
  }
  const { error } = await supabaseAdmin
    .from("coach_intent_signals")
    .update({ status, updated_at: new Date().toISOString() })
    .eq("id", signalId)
    .eq("coach_id", auth.coachId);
  if (error) return NextResponse.json({ error: "Could not save." }, { status: 500 });
  return NextResponse.json({ ok: true });
}
