import { NextResponse } from "next/server";

import { requireCoachRequest } from "@/lib/requireCoachRequest";
import { sectionByKey } from "@/lib/practiceKnowledge/blueprint";
import { COMMENT_MAX_LENGTH } from "@/lib/practiceKnowledge/sectionCommentTypes";
import {
  addSectionComment,
  assignSectionComment,
  deleteSectionComment,
  editSectionComment,
  findSectionComment,
  listCommentPeople,
  listCommentReads,
  listSectionComments,
} from "@/lib/practiceKnowledge/sectionComments";

const COMMENT_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Section comment threads on a coach's Blueprint.
 * The coach writes as the coach. An admin, including one acting as the coach, writes as BCA.
 */
async function auth(request: Request) {
  const check = await requireCoachRequest(request, { allowAdminSelf: true });
  if (check.error !== null) {
    return { error: NextResponse.json({ error: check.error }, { status: 401 }) };
  }
  return {
    coachId: check.userId,
    callerId: check.callerId,
    side: check.callerIsAdmin ? ("bca" as const) : ("coach" as const),
  };
}

export async function GET(request: Request) {
  const a = await auth(request);
  if ("error" in a) return a.error;
  try {
    const [comments, reads, people] = await Promise.all([
      listSectionComments(a.coachId),
      listCommentReads(a.coachId, a.side),
      listCommentPeople(a.coachId),
    ]);
    return NextResponse.json({ side: a.side, viewer_id: a.callerId, comments, reads, people });
  } catch (err) {
    console.error("practice comments GET:", err instanceof Error ? err.message : "failed");
    return NextResponse.json({ error: "Could not load comments." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const a = await auth(request);
  if ("error" in a) return a.error;

  const rec = ((await request.json().catch(() => null)) ?? {}) as Record<string, unknown>;
  const sectionKey = typeof rec.section_key === "string" ? rec.section_key.trim() : "";
  const body = typeof rec.body === "string" ? rec.body.trim() : "";
  if (!sectionByKey(sectionKey)) {
    return NextResponse.json({ error: "Unknown section." }, { status: 400 });
  }
  if (!body) return NextResponse.json({ error: "Write something first." }, { status: 400 });
  if (body.length > COMMENT_MAX_LENGTH) {
    return NextResponse.json({ error: "That comment is too long." }, { status: 400 });
  }

  try {
    const comment = await addSectionComment({
      coachId: a.coachId,
      sectionKey,
      authorId: a.callerId,
      side: a.side,
      body,
    });
    return NextResponse.json({ comment });
  } catch (err) {
    console.error("practice comments POST:", err instanceof Error ? err.message : "failed");
    return NextResponse.json({ error: "Could not save the comment." }, { status: 500 });
  }
}

function commentIdOf(rec: Record<string, unknown>): string | null {
  const id = typeof rec.id === "string" ? rec.id.trim() : "";
  return COMMENT_ID.test(id) ? id : null;
}

/** Change your own wording, or hand the comment to the coach or someone at BCA. */
export async function PATCH(request: Request) {
  const a = await auth(request);
  if ("error" in a) return a.error;

  const rec = ((await request.json().catch(() => null)) ?? {}) as Record<string, unknown>;
  const id = commentIdOf(rec);
  if (!id) return NextResponse.json({ error: "Unknown comment." }, { status: 400 });

  const hasBody = typeof rec.body === "string";
  const hasAssignee = "assignee_id" in rec;
  if (hasBody === hasAssignee) {
    return NextResponse.json({ error: "Change the wording or the assignee." }, { status: 400 });
  }

  try {
    const existing = await findSectionComment(a.coachId, id);
    if (!existing) return NextResponse.json({ error: "That comment is gone." }, { status: 404 });

    if (hasBody) {
      const body = (rec.body as string).trim();
      if (existing.author_id !== a.callerId || existing.author_side === "ava") {
        return NextResponse.json({ error: "You can only edit your own comments." }, { status: 403 });
      }
      if (!body) return NextResponse.json({ error: "Write something first." }, { status: 400 });
      if (body.length > COMMENT_MAX_LENGTH) {
        return NextResponse.json({ error: "That comment is too long." }, { status: 400 });
      }
      const comment = await editSectionComment(a.coachId, id, body);
      if (!comment) return NextResponse.json({ error: "That comment is gone." }, { status: 404 });
      return NextResponse.json({ comment });
    }

    const assigneeId = rec.assignee_id === null ? null : typeof rec.assignee_id === "string" ? rec.assignee_id.trim() : "";
    if (assigneeId === "") return NextResponse.json({ error: "Choose someone on this blueprint." }, { status: 400 });
    if (assigneeId !== null) {
      const people = await listCommentPeople(a.coachId);
      if (!people.some((person) => person.id === assigneeId)) {
        return NextResponse.json({ error: "Choose someone on this blueprint." }, { status: 400 });
      }
    }
    const comment = await assignSectionComment(a.coachId, id, assigneeId);
    if (!comment) return NextResponse.json({ error: "That comment is gone." }, { status: 404 });
    return NextResponse.json({ comment });
  } catch (err) {
    console.error("practice comments PATCH:", err instanceof Error ? err.message : "failed");
    return NextResponse.json({ error: "Could not update the comment." }, { status: 500 });
  }
}

/** Remove a comment you wrote. */
export async function DELETE(request: Request) {
  const a = await auth(request);
  if ("error" in a) return a.error;

  const rec = ((await request.json().catch(() => null)) ?? {}) as Record<string, unknown>;
  const id = commentIdOf(rec);
  if (!id) return NextResponse.json({ error: "Unknown comment." }, { status: 400 });

  try {
    const existing = await findSectionComment(a.coachId, id);
    if (!existing) return NextResponse.json({ error: "That comment is gone." }, { status: 404 });
    if (existing.author_id !== a.callerId || existing.author_side === "ava") {
      return NextResponse.json({ error: "You can only delete your own comments." }, { status: 403 });
    }
    const removed = await deleteSectionComment(a.coachId, id);
    if (!removed) return NextResponse.json({ error: "That comment is gone." }, { status: 404 });
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("practice comments DELETE:", err instanceof Error ? err.message : "failed");
    return NextResponse.json({ error: "Could not delete the comment." }, { status: 500 });
  }
}
