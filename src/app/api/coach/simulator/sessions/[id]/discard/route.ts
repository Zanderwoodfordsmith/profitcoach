import { NextResponse } from "next/server";

import { requireCoachRequest } from "@/lib/requireCoachRequest";
import { ownSession, updateSession } from "@/lib/simulator/server";

/** "End without saving": the session is dropped, never scored, and left out of the history. Not for certification. */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const check = await requireCoachRequest(request, { allowAdminSelf: true });
  if (check.error || !check.userId) {
    return NextResponse.json({ error: check.error ?? "Unauthorized" }, { status: 401 });
  }
  const { id } = await params;
  const row = await ownSession(check, id, { write: true });
  if (!row) return NextResponse.json({ error: "Not found." }, { status: 404 });
  if (row.mode === "assessment") {
    return NextResponse.json({ error: "Certification sessions can't be dropped. End it to have it scored." }, { status: 400 });
  }
  if (row.status === "live" || row.status === "scoring") {
    await updateSession(id, { status: "abandoned", ended_at: new Date().toISOString() });
  }
  return NextResponse.json({ ok: true });
}
