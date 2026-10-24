import { NextResponse } from "next/server";

import { requireCoachRequest } from "@/lib/requireCoachRequest";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { ownCallSession } from "@/lib/callSimulator/server";

/** One session with its report. Admins can read any session. */
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const check = await requireCoachRequest(request, { allowAdminSelf: true });
  if (check.error || !check.userId) {
    return NextResponse.json({ error: check.error ?? "Unauthorized" }, { status: 401 });
  }
  const { id } = await params;
  const row = await ownCallSession(check, id);
  if (!row) return NextResponse.json({ error: "Not found." }, { status: 404 });
  const { data: coach } = await supabaseAdmin.from("profiles").select("full_name").eq("id", row.coach_id).maybeSingle();
  return NextResponse.json({ session: row, coachName: (coach?.full_name as string | null) ?? null, mine: row.coach_id === check.userId });
}
