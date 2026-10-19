import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/requireAdmin";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";

const UUID = /^[0-9a-f-]{36}$/i;

/**
 * Ava's audit of every coach, for Admin → Coaches → Quality. Admin only, read-only.
 * No params: the latest finished audit (pillars, benchmarks, library) plus the
 * latest calibration and earlier audits for trends. ?coach=<id>: that coach's
 * scored pieces from the latest audit, with the text, checks and judge notes.
 */
export async function GET(request: Request) {
  const auth = await requireAdmin(request);
  if (auth.error) return NextResponse.json({ error: auth.error }, { status: 401 });
  const coach = new URL(request.url).searchParams.get("coach");

  if (coach) {
    if (!UUID.test(coach)) return NextResponse.json({ error: "Bad id." }, { status: 400 });
    const { data, error } = await supabaseAdmin
      .from("coach_quality_scores")
      .select("id, run_id, artifact, source_ref, source_at, text_scored, score, hard_fails, checks, judge, top_fix, scored_at, admin_verdict, admin_note")
      .eq("coach_id", coach)
      .order("scored_at", { ascending: false })
      .limit(60);
    if (error) return NextResponse.json({ error: "Could not load scores." }, { status: 500 });
    const latestRun = data?.[0]?.run_id ?? null;
    const latest = (data ?? []).filter((r) => r.run_id === latestRun);
    // The same piece from the audit before, for a trend arrow.
    const previous: Record<string, number | null> = {};
    for (const r of data ?? []) {
      if (r.run_id !== latestRun && !(r.artifact in previous)) previous[r.artifact] = r.score as number | null;
    }
    return NextResponse.json({ pieces: latest, previous });
  }

  const [audits, calibration] = await Promise.all([
    supabaseAdmin
      .from("ava_eval_runs")
      .select("id, label, summary, cost_usd, started_at, finished_at")
      .eq("kind", "coach_audit")
      .eq("status", "done")
      .order("started_at", { ascending: false })
      .limit(6),
    supabaseAdmin
      .from("ava_eval_runs")
      .select("id, label, summary, started_at")
      .eq("kind", "calibration")
      .eq("status", "done")
      .order("started_at", { ascending: false })
      .limit(1),
  ]);
  if (audits.error) return NextResponse.json({ error: "Could not load the audit." }, { status: 500 });
  const [latest, ...older] = audits.data ?? [];
  return NextResponse.json({
    audit: latest ?? null,
    history: older.map((a) => ({ id: a.id, started_at: a.started_at, benchmarks: (a.summary as { benchmarks?: unknown })?.benchmarks ?? null })),
    calibration: calibration.data?.[0] ?? null,
  });
}

const VERDICTS = new Set(["agree", "too_harsh", "too_soft"]);

/** Record BCA's call on one coach score: { id, verdict: agree | too_harsh | too_soft | null, note? }. */
export async function PATCH(request: Request) {
  const auth = await requireAdmin(request);
  if (auth.error) return NextResponse.json({ error: auth.error }, { status: 401 });
  const body = (await request.json().catch(() => null)) as { id?: unknown; verdict?: unknown; note?: unknown } | null;
  const id = typeof body?.id === "string" ? body.id : "";
  const verdict = body?.verdict === null ? null : typeof body?.verdict === "string" && VERDICTS.has(body.verdict) ? body.verdict : undefined;
  if (!UUID.test(id) || verdict === undefined) return NextResponse.json({ error: "Send an id and a verdict." }, { status: 400 });
  const note = typeof body?.note === "string" ? body.note.trim().slice(0, 1000) || null : null;
  const { error } = await supabaseAdmin
    .from("coach_quality_scores")
    .update({ admin_verdict: verdict, admin_note: note, admin_labelled_at: verdict ? new Date().toISOString() : null })
    .eq("id", id);
  if (error) return NextResponse.json({ error: "Could not save." }, { status: 500 });
  return NextResponse.json({ ok: true });
}
