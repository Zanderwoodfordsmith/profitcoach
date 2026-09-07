import { NextResponse } from "next/server";
import { requireOutreachCoach } from "@/lib/unipile/requireOutreachCoach";
import {
  countRemindDue,
  listRemindQueue,
  saveRemindDraft,
  sendRemindJob,
  skipRemindJob,
  snoozeRemindJob,
} from "@/lib/unipile/remindQueue";

/** Coach-send due queue (remind steps). */
export async function GET(request: Request) {
  const auth = await requireOutreachCoach(request);
  if (auth.error || !auth.coachId) {
    return NextResponse.json({ error: auth.error }, { status: 401 });
  }
  try {
    const url = new URL(request.url);
    if (url.searchParams.get("view") === "counts") {
      const counts = await countRemindDue(auth.coachId);
      return NextResponse.json({ counts });
    }
    const includeUpcoming = url.searchParams.get("upcoming") !== "0";
    const queue = await listRemindQueue(auth.coachId, { includeUpcoming });
    const counts = await countRemindDue(auth.coachId);
    return NextResponse.json({ queue, counts });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Load failed." },
      { status: 500 }
    );
  }
}

/** send | skip | snooze | draft */
export async function POST(request: Request) {
  const auth = await requireOutreachCoach(request);
  if (auth.error || !auth.coachId) {
    return NextResponse.json({ error: auth.error }, { status: 401 });
  }
  const body = (await request.json().catch(() => ({}))) as {
    action?: string;
    job_id?: string;
    body?: string;
    hours?: number;
    draft_body?: string;
  };
  if (!body.job_id?.trim()) {
    return NextResponse.json({ error: "job_id required." }, { status: 400 });
  }
  try {
    if (body.action === "send") {
      await sendRemindJob({
        coachId: auth.coachId,
        jobId: body.job_id,
        body: body.body,
      });
      return NextResponse.json({ ok: true });
    }
    if (body.action === "skip") {
      await skipRemindJob({ coachId: auth.coachId, jobId: body.job_id });
      return NextResponse.json({ ok: true });
    }
    if (body.action === "snooze") {
      const result = await snoozeRemindJob({
        coachId: auth.coachId,
        jobId: body.job_id,
        hours: body.hours,
        draftBody: body.draft_body,
      });
      return NextResponse.json(result);
    }
    if (body.action === "draft") {
      await saveRemindDraft({
        coachId: auth.coachId,
        jobId: body.job_id,
        draftBody: body.draft_body ?? body.body ?? "",
      });
      return NextResponse.json({ ok: true });
    }
    return NextResponse.json(
      { error: "action must be send, skip, snooze, or draft." },
      { status: 400 }
    );
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Update failed." },
      { status: 500 }
    );
  }
}
