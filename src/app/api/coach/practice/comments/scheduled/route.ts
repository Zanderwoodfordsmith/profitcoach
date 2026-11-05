import { NextResponse } from "next/server";

import { requireCoachRequest } from "@/lib/requireCoachRequest";
import { isCommentKey } from "@/lib/practiceKnowledge/pageChat";
import { COMMENT_MAX_LENGTH } from "@/lib/practiceKnowledge/sectionCommentTypes";
import { assertFutureSchedule } from "@/lib/support/scheduleTime";
import {
  cancelScheduledComment,
  commentMediaFromRequest,
  listScheduledComments,
  processDueScheduledComments,
  scheduleComment,
} from "@/lib/practiceKnowledge/commentMessaging";

const ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * BCA's scheduled messages in a coach's Blueprint chat (5 Nov). Admins only:
 * coaches never see what is waiting to be sent.
 */
async function auth(request: Request) {
  const check = await requireCoachRequest(request, { allowAdminSelf: true });
  if (check.error !== null) {
    return { error: NextResponse.json({ error: check.error }, { status: 401 }) };
  }
  if (!check.callerIsAdmin) {
    return { error: NextResponse.json({ error: "Only BCA can schedule messages." }, { status: 403 }) };
  }
  return { coachId: check.userId, callerId: check.callerId };
}

/** Posts anything now due (so it works without the cron), then lists what is still waiting. */
export async function GET(request: Request) {
  const a = await auth(request);
  if ("error" in a) return a.error;
  try {
    const flushed = await processDueScheduledComments({ coachId: a.coachId, request });
    const scheduled = await listScheduledComments(a.coachId);
    return NextResponse.json({ scheduled, posted: flushed.sent });
  } catch (err) {
    console.error("scheduled comments GET:", err instanceof Error ? err.message : "failed");
    return NextResponse.json({ error: "Could not load scheduled messages." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const a = await auth(request);
  if ("error" in a) return a.error;
  const rec = ((await request.json().catch(() => null)) ?? {}) as Record<string, unknown>;
  const sectionKey = typeof rec.section_key === "string" ? rec.section_key.trim() : "";
  const body = typeof rec.body === "string" ? rec.body.trim() : "";
  if (!isCommentKey(sectionKey)) return NextResponse.json({ error: "Unknown section." }, { status: 400 });
  if (!body) return NextResponse.json({ error: "Write something first." }, { status: 400 });
  if (body.length > COMMENT_MAX_LENGTH) return NextResponse.json({ error: "That message is too long." }, { status: 400 });
  const media = commentMediaFromRequest(rec.media);
  if ("error" in media) return NextResponse.json({ error: media.error }, { status: 400 });
  let when: Date;
  try {
    when = assertFutureSchedule(typeof rec.scheduled_for === "string" ? rec.scheduled_for : "");
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Choose a time." }, { status: 400 });
  }
  try {
    const scheduled = await scheduleComment({
      coachId: a.coachId,
      sectionKey,
      authorId: a.callerId,
      body,
      media,
      emailNotify: rec.email === true,
      scheduledFor: when,
    });
    return NextResponse.json({ scheduled });
  } catch (err) {
    console.error("scheduled comments POST:", err instanceof Error ? err.message : "failed");
    return NextResponse.json({ error: "Could not schedule the message." }, { status: 500 });
  }
}

/** Cancel one that has not gone yet. */
export async function DELETE(request: Request) {
  const a = await auth(request);
  if ("error" in a) return a.error;
  const rec = ((await request.json().catch(() => null)) ?? {}) as Record<string, unknown>;
  const id = typeof rec.id === "string" && ID.test(rec.id) ? rec.id : null;
  if (!id) return NextResponse.json({ error: "Unknown message." }, { status: 400 });
  try {
    const ok = await cancelScheduledComment(a.coachId, id);
    if (!ok) return NextResponse.json({ error: "That message has already gone." }, { status: 404 });
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("scheduled comments DELETE:", err instanceof Error ? err.message : "failed");
    return NextResponse.json({ error: "Could not cancel it." }, { status: 500 });
  }
}
