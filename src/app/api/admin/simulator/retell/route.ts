import { NextResponse } from "next/server";

import { requireAdmin } from "@/lib/requireAdmin";
import type { RetellCallSummary } from "@/lib/simulator/retell";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

/** Admin: every imported Retell practice call, with its area scores for the averages. */
export async function GET(request: Request) {
  const check = await requireAdmin(request);
  if (check.error) return NextResponse.json({ error: check.error }, { status: 401 });

  const { data, error } = await supabaseAdmin
    .from("retell_practice_calls")
    .select("call_id, client_id, difficulty, started_at, duration_seconds, coach_id, coach_name_heard, score, stages:report->stages, power:report->power")
    .order("started_at", { ascending: false })
    .limit(2000);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  type Area = { label: string; score: number };
  const calls: RetellCallSummary[] = (data ?? []).map((r) => {
    const { stages, power, ...rest } = r as unknown as Omit<RetellCallSummary, "areas"> & { stages: Area[] | null; power: Area[] | null };
    return { ...rest, areas: [...(stages ?? []), ...(power ?? [])].map((a) => ({ label: a.label, score: a.score })) };
  });
  const coachIds = Array.from(new Set(calls.map((c) => c.coach_id).filter((id): id is string => Boolean(id))));
  const { data: coaches } = coachIds.length
    ? await supabaseAdmin.from("profiles").select("id, full_name").in("id", coachIds)
    : { data: [] };

  return NextResponse.json({ calls, coaches: coaches ?? [] });
}
