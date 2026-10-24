import { NextResponse } from "next/server";

import { requireCoachRequest } from "@/lib/requireCoachRequest";
import { listCallSessions } from "@/lib/callSimulator/server";
import { simulatorConfigured } from "@/lib/simulator/server";

/** The call simulator home: past sessions. */
export async function GET(request: Request) {
  const check = await requireCoachRequest(request, { allowAdminSelf: true });
  if (check.error || !check.userId) {
    return NextResponse.json({ error: check.error ?? "Unauthorized" }, { status: 401 });
  }
  try {
    return NextResponse.json({ configured: simulatorConfigured(), sessions: await listCallSessions(check.userId) });
  } catch (err) {
    console.error("call simulator GET:", err instanceof Error ? err.message : "failed");
    return NextResponse.json({ error: "Could not load the call simulator." }, { status: 500 });
  }
}
