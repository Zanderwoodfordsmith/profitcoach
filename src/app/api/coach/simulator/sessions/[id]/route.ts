import { NextResponse } from "next/server";

import { requireCoachRequest } from "@/lib/requireCoachRequest";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { resolveClient } from "@/lib/simulator/custom";
import { SESSION_SUMMARY_COLUMNS, alignTimes, lastScoredWith, ownSession } from "@/lib/simulator/server";

/**
 * One session with its report, the client (custom ones included) and any
 * moment replays made from it. Admins can read any session, to review
 * certification; any coach can read one shared with the community.
 */
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const check = await requireCoachRequest(request, { allowAdminSelf: true });
  if (check.error || !check.userId) {
    return NextResponse.json({ error: check.error ?? "Unauthorized" }, { status: 401 });
  }
  const { id } = await params;
  const found = await ownSession(check, id);
  if (!found) return NextResponse.json({ error: "Not found." }, { status: 404 });
  const row = await alignTimes(found).catch(() => found);
  const mine = row.coach_id === check.userId;

  const [{ data: coach }, latest, client, { data: replays }] = await Promise.all([
    supabaseAdmin.from("profiles").select("full_name").eq("id", row.coach_id).maybeSingle(),
    mine ? lastScoredWith(row.coach_id, row.client_id) : Promise.resolve(null),
    resolveClient(row.client_id, { userId: row.coach_id, callerIsAdmin: true }),
    supabaseAdmin.from("sim_sessions").select(SESSION_SUMMARY_COLUMNS + ", report").eq("replay_of", row.id).order("started_at"),
  ]);
  // A shared session hides its score if the coach chose to.
  const session = !mine && !check.callerIsAdmin && !row.share_score ? { ...row, score: null, reviewed_score: null } : row;
  return NextResponse.json({
    session,
    client,
    coachName: (coach?.full_name as string | null) ?? null,
    mine,
    // "Continue with David" follows on from the latest scored session only.
    canFollowUp: latest?.id === row.id,
    replays: replays ?? [],
  });
}
