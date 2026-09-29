import { NextResponse } from "next/server";

import { requireCoachRequest } from "@/lib/requireCoachRequest";
import {
  COACH_WRITABLE_STATUSES,
  sanitizePayloadPatch,
  sanitizeStatus,
} from "@/lib/practiceKnowledge/sanitize";
import { hydratePracticeFromProfile } from "@/lib/practiceKnowledge/hydrate";
import {
  getLatestDecisionRecord,
  listIntakeAssets,
  patchPracticeKnowledge,
  syncPracticeToBrain,
} from "@/lib/practiceKnowledge/store";

async function auth(request: Request) {
  const check = await requireCoachRequest(request, { allowAdminSelf: true });
  if (check.error || !check.userId) {
    return { error: NextResponse.json({ error: check.error ?? "Unauthorized" }, { status: 401 }) };
  }
  return { coachId: check.userId };
}

export async function GET(request: Request) {
  const a = await auth(request);
  if ("error" in a) return a.error;
  try {
    const [knowledge, assets, decision] = await Promise.all([
      hydratePracticeFromProfile(a.coachId),
      listIntakeAssets(a.coachId),
      getLatestDecisionRecord(a.coachId),
    ]);
    return NextResponse.json({ knowledge, assets, decision });
  } catch (err) {
    console.error("practice GET:", err instanceof Error ? err.message : "failed");
    return NextResponse.json({ error: "Could not load practice knowledge." }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  const a = await auth(request);
  if ("error" in a) return a.error;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
  }
  const rec = body && typeof body === "object" ? (body as Record<string, unknown>) : {};
  const payloadPatch = sanitizePayloadPatch(rec.payload, "coach_edit");
  const status = sanitizeStatus(rec.status);
  if (status && !COACH_WRITABLE_STATUSES.includes(status)) {
    return NextResponse.json({ error: "That status is admin-only." }, { status: 403 });
  }

  try {
    const knowledge = await patchPracticeKnowledge({
      coachId: a.coachId,
      payloadPatch,
      status: status ?? undefined,
      formCompleted: rec.form_completed === true,
      coachReviewed: rec.coach_reviewed === true || status === "coach_reviewed",
    });
    if (rec.sync_brain === true || status === "coach_reviewed") {
      await syncPracticeToBrain(a.coachId);
    }
    return NextResponse.json({ knowledge });
  } catch (err) {
    console.error("practice PATCH:", err instanceof Error ? err.message : "failed");
    return NextResponse.json({ error: "Could not save practice knowledge." }, { status: 500 });
  }
}
