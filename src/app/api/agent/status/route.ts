import { NextResponse } from "next/server";

import { resolveAgentActor } from "@/lib/agent/auth";
import { loadAgentCoach } from "@/lib/agent/coaches";

export const runtime = "nodejs";

/** Whether the signed-in person can use the agent, in which mode, and for whom by default. */
export async function GET(request: Request) {
  const auth = await resolveAgentActor(request);
  if (!auth.ok) {
    return NextResponse.json({ enabled: false, reason: auth.error }, { status: auth.signedIn ? 200 : auth.status });
  }
  const { actor } = auth;
  const defaultCoachId = actor.mode === "coach" ? actor.actorUserId : actor.impersonatedCoachId;
  const coach = defaultCoachId ? await loadAgentCoach(defaultCoachId) : null;
  return NextResponse.json({ enabled: true, mode: actor.mode, coach });
}
