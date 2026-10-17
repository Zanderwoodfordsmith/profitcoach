import { NextResponse } from "next/server";

import { requireCoachRequest } from "@/lib/requireCoachRequest";
import { sectionByKey } from "@/lib/practiceKnowledge/blueprint";
import { markSectionRead } from "@/lib/practiceKnowledge/sectionComments";

/** Mark one section's thread as read, for the coach or for BCA. */
export async function POST(request: Request) {
  const check = await requireCoachRequest(request, { allowAdminSelf: true });
  if (check.error !== null) {
    return NextResponse.json({ error: check.error }, { status: 401 });
  }
  const rec = ((await request.json().catch(() => null)) ?? {}) as Record<string, unknown>;
  const sectionKey = typeof rec.section_key === "string" ? rec.section_key.trim() : "";
  if (!sectionByKey(sectionKey)) {
    return NextResponse.json({ error: "Unknown section." }, { status: 400 });
  }
  try {
    const readAt = await markSectionRead(check.userId, check.callerIsAdmin ? "bca" : "coach", sectionKey);
    return NextResponse.json({ ok: true, read_at: readAt });
  } catch (err) {
    console.error("practice comments read:", err instanceof Error ? err.message : "failed");
    return NextResponse.json({ error: "Could not mark as read." }, { status: 500 });
  }
}
