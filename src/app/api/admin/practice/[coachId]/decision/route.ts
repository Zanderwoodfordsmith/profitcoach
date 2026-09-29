import { NextResponse } from "next/server";

import { requireAdmin } from "@/lib/requireAdmin";
import { sanitizeDecisionRecord } from "@/lib/practiceKnowledge/sanitize";
import {
  getLatestDecisionRecord,
  patchPracticeKnowledge,
  upsertDecisionRecord,
} from "@/lib/practiceKnowledge/store";

function parseCoachId(raw: string): string | null {
  const id = raw.trim();
  return /^[0-9a-f-]{36}$/i.test(id) ? id : null;
}

export async function GET(
  request: Request,
  ctx: { params: Promise<{ coachId: string }> }
) {
  const auth = await requireAdmin(request);
  if (auth.error) {
    return NextResponse.json({ error: auth.error }, { status: 401 });
  }
  const { coachId: raw } = await ctx.params;
  const coachId = parseCoachId(raw);
  if (!coachId) return NextResponse.json({ error: "Not found." }, { status: 404 });
  const decision = await getLatestDecisionRecord(coachId);
  return NextResponse.json({ decision });
}

export async function PUT(
  request: Request,
  ctx: { params: Promise<{ coachId: string }> }
) {
  const auth = await requireAdmin(request);
  if (auth.error) {
    return NextResponse.json({ error: auth.error }, { status: 401 });
  }
  const { coachId: raw } = await ctx.params;
  const coachId = parseCoachId(raw);
  if (!coachId) return NextResponse.json({ error: "Not found." }, { status: 404 });

  let body: Record<string, unknown> = {};
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
  }

  try {
    const decision = await upsertDecisionRecord({
      coachId,
      payload: sanitizeDecisionRecord(body.payload ?? body),
      lockedBy: auth.userId,
      lock: body.lock === true,
    });
    if (body.lock === true) {
      await patchPracticeKnowledge({
        coachId,
        status: "decision_recorded",
        adminReviewed: true,
      });
    }
    return NextResponse.json({ decision });
  } catch (err) {
    console.error("admin decision:", err instanceof Error ? err.message : "failed");
    return NextResponse.json({ error: "Could not save the Decision Record." }, { status: 500 });
  }
}
