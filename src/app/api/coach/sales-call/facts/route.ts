import { NextResponse } from "next/server";

import { requireCoachRequest } from "@/lib/requireCoachRequest";
import { extractFacts } from "@/lib/salesCall/ai";
import { loadSalesCallCoach } from "@/lib/salesCall/coachContext";

export const runtime = "nodejs";
export const maxDuration = 60;

const MAX_NOTES = 40_000;

/** The five facts from the coach's call notes, the next question to ask, and the read-back. */
export async function POST(request: Request) {
  const auth = await requireCoachRequest(request, { allowAdminSelf: true });
  if (auth.error || !auth.userId) return NextResponse.json({ error: auth.error }, { status: 401 });
  const body = (await request.json().catch(() => null)) as { notes?: unknown; prospect?: unknown } | null;
  const notes = typeof body?.notes === "string" ? body.notes.trim() : "";
  if (!notes) return NextResponse.json({ error: "Add some notes first." }, { status: 400 });
  if (notes.length > MAX_NOTES) return NextResponse.json({ error: "Those notes are too long. Trim them a little." }, { status: 413 });
  const prospect = typeof body?.prospect === "string" ? body.prospect.trim().slice(0, 120) : "";
  try {
    const coach = await loadSalesCallCoach(auth.userId);
    return NextResponse.json(await extractFacts({ notes, prospect, coach }));
  } catch (err) {
    console.error("sales-call facts:", err);
    return NextResponse.json({ error: err instanceof Error ? err.message : "Could not read the notes." }, { status: 502 });
  }
}
