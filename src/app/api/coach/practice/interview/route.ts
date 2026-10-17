import { NextResponse } from "next/server";

import { requireCoachRequest } from "@/lib/requireCoachRequest";
import { runIntakeTurn } from "@/lib/practiceKnowledge/runIntakeTurn";
import {
  ensurePracticeKnowledge,
  getLatestIntakeSession,
} from "@/lib/practiceKnowledge/store";

export const maxDuration = 60;

export async function GET(request: Request) {
  const check = await requireCoachRequest(request, { allowAdminSelf: true });
  if (check.error || !check.userId) {
    return NextResponse.json({ error: check.error ?? "Unauthorized" }, { status: 401 });
  }
  try {
    const [knowledge, session] = await Promise.all([
      ensurePracticeKnowledge(check.userId),
      getLatestIntakeSession(check.userId),
    ]);
    return NextResponse.json({ knowledge, session });
  } catch (err) {
    console.error("practice interview GET:", err instanceof Error ? err.message : "failed");
    return NextResponse.json({ error: "Could not load interview." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const check = await requireCoachRequest(request, { allowAdminSelf: true });
  if (check.error || !check.userId) {
    return NextResponse.json({ error: check.error ?? "Unauthorized" }, { status: 401 });
  }

  let body: { message?: string; start?: boolean } = {};
  try {
    body = (await request.json()) as { message?: string; start?: boolean };
  } catch {
    return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
  }

  try {
    const result = await runIntakeTurn({
      coachId: check.userId,
      message: body.message,
      start: body.start,
      medium: "text",
    });
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }
    return NextResponse.json({
      knowledge: result.knowledge,
      session: result.session,
      assistant_message: result.assistant_message,
      done: result.done,
    });
  } catch (err) {
    console.error("practice interview POST:", err instanceof Error ? err.message : "failed");
    return NextResponse.json({ error: "Could not continue the interview." }, { status: 500 });
  }
}
