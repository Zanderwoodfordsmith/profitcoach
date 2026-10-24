import { NextResponse } from "next/server";

import { requireCoachRequest } from "@/lib/requireCoachRequest";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { latestAssessment } from "@/lib/simulator/server";

/** Start a certification attempt, or carry on with the one already open. */
export async function POST(request: Request) {
  const check = await requireCoachRequest(request, { allowAdminSelf: true });
  if (check.error || !check.userId) {
    return NextResponse.json({ error: check.error ?? "Unauthorized" }, { status: 401 });
  }
  const current = await latestAssessment(check.userId);
  if (current?.status === "in_progress") return NextResponse.json({ assessment: current });
  if (current?.status === "submitted") {
    return NextResponse.json({ error: "Your last attempt is waiting for review." }, { status: 400 });
  }
  const { data, error } = await supabaseAdmin
    .from("sim_assessments")
    .insert({ coach_id: check.userId })
    .select("*")
    .single();
  if (error || !data) {
    console.error("simulator assessment:", error?.message);
    return NextResponse.json({ error: "Could not start certification." }, { status: 500 });
  }
  return NextResponse.json({ assessment: data });
}
