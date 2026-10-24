import { NextResponse } from "next/server";

import { requireCoachRequest } from "@/lib/requireCoachRequest";
import { ownCallSession, updateCallSession } from "@/lib/callSimulator/server";

/** End without saving: the call is dropped, never scored, and left out of history. */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const check = await requireCoachRequest(request, { allowAdminSelf: true });
  if (check.error || !check.userId) {
    return NextResponse.json({ error: check.error ?? "Unauthorized" }, { status: 401 });
  }
  const { id } = await params;
  const row = await ownCallSession(check, id, { write: true });
  if (!row) return NextResponse.json({ error: "Not found." }, { status: 404 });
  if (row.status === "scored") return NextResponse.json({ error: "This call is already scored." }, { status: 400 });
  await updateCallSession(id, { status: "abandoned", ended_at: new Date().toISOString() });
  return NextResponse.json({ ok: true });
}
