import { NextResponse } from "next/server";

import { requireAdmin } from "@/lib/requireAdmin";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { MONTHLY_MINUTES, SESSION_SUMMARY_COLUMNS, minutesByCoach, type SimSessionSummary } from "@/lib/simulator/server";
import type { SimAssessmentRow } from "@/lib/simulator/types";

/** Admin: every certification attempt with its sessions, plus recent practice across coaches. */
export async function GET(request: Request) {
  const check = await requireAdmin(request);
  if (check.error) return NextResponse.json({ error: check.error }, { status: 401 });

  const [{ data: assessments }, { data: recent }] = await Promise.all([
    supabaseAdmin.from("sim_assessments").select("*").order("created_at", { ascending: false }).limit(100),
    supabaseAdmin
      .from("sim_sessions")
      .select(SESSION_SUMMARY_COLUMNS)
      .eq("status", "scored")
      .order("started_at", { ascending: false })
      .limit(60),
  ]);
  const attempts = (assessments as SimAssessmentRow[] | null) ?? [];
  const ids = attempts.map((a) => a.id);
  const { data: attemptSessions } = ids.length
    ? await supabaseAdmin.from("sim_sessions").select(SESSION_SUMMARY_COLUMNS).in("assessment_id", ids).neq("status", "abandoned")
    : { data: [] };
  const sessions = (recent as SimSessionSummary[] | null) ?? [];
  const usage = await minutesByCoach();
  const coachIds = Array.from(new Set([...attempts.map((a) => a.coach_id), ...sessions.map((s) => s.coach_id), ...usage.map((u) => u.coach_id)]));
  const { data: coaches } = coachIds.length
    ? await supabaseAdmin.from("profiles").select("id, full_name, avatar_url").in("id", coachIds)
    : { data: [] };

  return NextResponse.json({
    assessments: attempts.map((a) => ({
      ...a,
      sessions: ((attemptSessions as SimSessionSummary[] | null) ?? []).filter((s) => s.assessment_id === a.id),
    })),
    recent: sessions,
    usage,
    monthlyMinutes: MONTHLY_MINUTES,
    coaches: coaches ?? [],
  });
}
