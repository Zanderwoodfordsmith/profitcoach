import { NextResponse } from "next/server";

import { requireCoachRequest } from "@/lib/requireCoachRequest";
import { listCallSessions } from "@/lib/callSimulator/server";
import { MONTHLY_MINUTES, minutesThisMonth, simulatorConfigured } from "@/lib/simulator/server";

/** The call simulator home: past sessions. */
export async function GET(request: Request) {
  const check = await requireCoachRequest(request, { allowAdminSelf: true });
  if (check.error || !check.userId) {
    return NextResponse.json({ error: check.error ?? "Unauthorized" }, { status: 401 });
  }
  try {
    const [sessions, used] = await Promise.all([listCallSessions(check.userId), minutesThisMonth(check.userId)]);
    // One allowance for both simulators: they share the ElevenLabs minutes.
    return NextResponse.json({ configured: simulatorConfigured(), sessions, minutes: { used, limit: check.callerIsAdmin ? null : MONTHLY_MINUTES } });
  } catch (err) {
    console.error("call simulator GET:", err instanceof Error ? err.message : "failed");
    return NextResponse.json({ error: "Could not load the call simulator." }, { status: 500 });
  }
}
