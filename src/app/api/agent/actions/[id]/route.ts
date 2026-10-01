import { NextResponse } from "next/server";

import { ActionDecisionError, decideAction } from "@/lib/agent/actions";
import { resolveAgentActor } from "@/lib/agent/auth";

export const runtime = "nodejs";
export const maxDuration = 120;

type Ctx = { params: Promise<{ id: string }> };

/** Confirm (run) or cancel a confirmation card. Body: { decision }. */
export async function POST(request: Request, ctx: Ctx) {
  const auth = await resolveAgentActor(request);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const { id } = await ctx.params;
  const body = (await request.json().catch(() => ({}))) as { decision?: unknown };
  if (body.decision !== "confirm" && body.decision !== "cancel") {
    return NextResponse.json({ error: 'decision must be "confirm" or "cancel".' }, { status: 400 });
  }
  try {
    const { action } = await decideAction({ actionId: id, actor: auth.actor, decision: body.decision });
    return NextResponse.json({ action });
  } catch (err) {
    if (err instanceof ActionDecisionError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error("agent action decision:", err);
    return NextResponse.json({ error: "Could not run that." }, { status: 500 });
  }
}
