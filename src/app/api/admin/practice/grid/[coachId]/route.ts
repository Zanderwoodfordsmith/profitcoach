import { NextResponse } from "next/server";

import { parseCoachIdHeader } from "@/lib/coachId";
import { requireAdmin } from "@/lib/requireAdmin";
import { sectionPreviews } from "@/lib/practiceKnowledge/blueprintGrid";
import { listSectionComments } from "@/lib/practiceKnowledge/sectionComments";
import { findPracticeKnowledge } from "@/lib/practiceKnowledge/store";

/** One coach's sections, cut down for the overview's hover cards, with their comments. */
export async function GET(request: Request, context: { params: Promise<{ coachId: string }> }) {
  const auth = await requireAdmin(request);
  if (auth.error) {
    const status = auth.error === "Server error." ? 500 : 401;
    return NextResponse.json({ error: auth.error }, { status });
  }
  const coachId = parseCoachIdHeader((await context.params).coachId);
  if (!coachId) return NextResponse.json({ error: "Unknown coach." }, { status: 400 });

  try {
    const [row, comments] = await Promise.all([findPracticeKnowledge(coachId), listSectionComments(coachId)]);
    if (!row) return NextResponse.json({ error: "No Blueprint for this coach." }, { status: 404 });
    return NextResponse.json({ previews: sectionPreviews(row), comments });
  } catch (err) {
    console.error("admin blueprint grid coach:", err instanceof Error ? err.message : "failed");
    return NextResponse.json({ error: "Could not load this coach's Blueprint." }, { status: 500 });
  }
}
