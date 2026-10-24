import { NextResponse } from "next/server";

import { requireCoachRequest } from "@/lib/requireCoachRequest";
import { listCustomClients } from "@/lib/simulator/custom";
import {
  ASSESSMENT_SESSIONS,
  MONTHLY_MINUTES,
  PASS_MARK,
  assessmentSessions,
  latestAssessment,
  listSessions,
  minutesThisMonth,
  simulatorConfigured,
  weakSpot,
} from "@/lib/simulator/server";

/** The simulator home: past sessions and the latest certification attempt. */
export async function GET(request: Request) {
  const check = await requireCoachRequest(request, { allowAdminSelf: true });
  if (check.error || !check.userId) {
    return NextResponse.json({ error: check.error ?? "Unauthorized" }, { status: 401 });
  }
  try {
    const [sessions, assessment, customClients, weak, minutes] = await Promise.all([
      listSessions(check.userId),
      latestAssessment(check.userId),
      listCustomClients(check.userId),
      weakSpot(check.userId),
      minutesThisMonth(check.userId),
    ]);
    return NextResponse.json({
      configured: simulatorConfigured(),
      sessions,
      customClients,
      weakSpot: weak,
      minutes: { used: minutes, limit: check.callerIsAdmin ? null : MONTHLY_MINUTES },
      assessment: assessment ? { ...assessment, sessions: await assessmentSessions(assessment.id) } : null,
      passMark: PASS_MARK,
      assessmentSessions: ASSESSMENT_SESSIONS,
    });
  } catch (err) {
    console.error("simulator GET:", err instanceof Error ? err.message : "failed");
    return NextResponse.json({ error: "Could not load the simulator." }, { status: 500 });
  }
}
