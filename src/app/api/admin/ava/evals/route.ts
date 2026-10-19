import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/requireAdmin";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";

const UUID = /^[0-9a-f-]{36}$/i;

/**
 * Ava's eval runs for Admin → Ava → Evals. Admin only, read-only.
 * No params: the latest runs. ?run=<id>: one run's results (no trajectories).
 * ?result=<id>: one result with its full trajectory (prompts, outputs, judge).
 */
export async function GET(request: Request) {
  const auth = await requireAdmin(request);
  if (auth.error) return NextResponse.json({ error: auth.error }, { status: 401 });
  const url = new URL(request.url);
  const run = url.searchParams.get("run");
  const result = url.searchParams.get("result");

  if (result) {
    if (!UUID.test(result)) return NextResponse.json({ error: "Bad id." }, { status: 400 });
    const { data, error } = await supabaseAdmin.from("ava_eval_results").select("*").eq("id", result).maybeSingle();
    if (error) return NextResponse.json({ error: "Could not load that result." }, { status: 500 });
    if (!data) return NextResponse.json({ error: "Not found." }, { status: 404 });
    return NextResponse.json({ result: data });
  }

  if (run) {
    if (!UUID.test(run)) return NextResponse.json({ error: "Bad id." }, { status: 400 });
    const [{ data: runRow }, { data: results, error }] = await Promise.all([
      supabaseAdmin.from("ava_eval_runs").select("*").eq("id", run).maybeSingle(),
      supabaseAdmin
        .from("ava_eval_results")
        .select("id, skill, case_id, rep, status, score, passed, hard_fails, checks, judge, metrics, output, cost_usd, error, admin_verdict, admin_note")
        .eq("run_id", run)
        .order("skill")
        .order("case_id"),
    ]);
    if (error) return NextResponse.json({ error: "Could not load results." }, { status: 500 });
    if (!runRow) return NextResponse.json({ error: "Not found." }, { status: 404 });
    return NextResponse.json({ run: runRow, results: results ?? [] });
  }

  const [{ data, error }, verdicts] = await Promise.all([
    supabaseAdmin
      .from("ava_eval_runs")
      .select("id, kind, label, skills, git_sha, config, summary, cost_usd, status, started_at, finished_at")
      .order("started_at", { ascending: false })
      .limit(40),
    judgeAgreement(),
  ]);
  if (error) return NextResponse.json({ error: "Could not load runs." }, { status: 500 });
  return NextResponse.json({ runs: data ?? [], verdicts });
}

const VERDICTS = new Set(["agree", "too_harsh", "too_soft"]);

/** How often BCA agreed with the judge, across Ava's evals and the coach audit. */
async function judgeAgreement(): Promise<Record<string, number>> {
  const [a, b] = await Promise.all([
    supabaseAdmin.from("ava_eval_results").select("admin_verdict").not("admin_verdict", "is", null).limit(5000),
    supabaseAdmin.from("coach_quality_scores").select("admin_verdict").not("admin_verdict", "is", null).limit(5000),
  ]);
  const out: Record<string, number> = { agree: 0, too_harsh: 0, too_soft: 0 };
  for (const r of [...(a.data ?? []), ...(b.data ?? [])]) out[r.admin_verdict as string] = (out[r.admin_verdict as string] ?? 0) + 1;
  return out;
}

/** Record BCA's call on one scored piece: { id, verdict: agree | too_harsh | too_soft | null, note? }. */
export async function PATCH(request: Request) {
  const auth = await requireAdmin(request);
  if (auth.error) return NextResponse.json({ error: auth.error }, { status: 401 });
  const body = (await request.json().catch(() => null)) as { id?: unknown; verdict?: unknown; note?: unknown } | null;
  const id = typeof body?.id === "string" ? body.id : "";
  const verdict = body?.verdict === null ? null : typeof body?.verdict === "string" && VERDICTS.has(body.verdict) ? body.verdict : undefined;
  if (!UUID.test(id) || verdict === undefined) return NextResponse.json({ error: "Send an id and a verdict." }, { status: 400 });
  const note = typeof body?.note === "string" ? body.note.trim().slice(0, 1000) || null : null;
  const { error } = await supabaseAdmin
    .from("ava_eval_results")
    .update({ admin_verdict: verdict, admin_note: note, admin_labelled_at: verdict ? new Date().toISOString() : null })
    .eq("id", id);
  if (error) return NextResponse.json({ error: "Could not save." }, { status: 500 });
  return NextResponse.json({ ok: true });
}
