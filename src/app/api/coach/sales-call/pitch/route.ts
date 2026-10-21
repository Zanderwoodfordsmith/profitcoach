import { NextResponse } from "next/server";

import { requireCoachRequest } from "@/lib/requireCoachRequest";
import { type Facts, writePhasedPitch, writePitch } from "@/lib/salesCall/ai";
import { loadSalesCallCoach } from "@/lib/salesCall/coachContext";
import { FACTS } from "@/lib/salesCall/script";

export const runtime = "nodejs";
export const maxDuration = 120;

const MAX_NOTES = 40_000;

/** The pitch, nine steps or three phases, written for this owner from the call notes. */
export async function POST(request: Request) {
  const auth = await requireCoachRequest(request, { allowAdminSelf: true });
  if (auth.error || !auth.userId) return NextResponse.json({ error: auth.error }, { status: 401 });
  const body = (await request.json().catch(() => null)) as { notes?: unknown; prospect?: unknown; facts?: unknown; kind?: unknown; angle?: unknown } | null;
  const notes = typeof body?.notes === "string" ? body.notes.trim() : "";
  if (!notes) return NextResponse.json({ error: "Add some notes first." }, { status: 400 });
  if (notes.length > MAX_NOTES) return NextResponse.json({ error: "Those notes are too long. Trim them a little." }, { status: 413 });
  const prospect = typeof body?.prospect === "string" ? body.prospect.trim().slice(0, 120) : "";
  const rawFacts = (body?.facts && typeof body.facts === "object" ? body.facts : {}) as Record<string, unknown>;
  const facts = Object.fromEntries(
    FACTS.map((f) => [f.key, typeof rawFacts[f.key] === "string" ? (rawFacts[f.key] as string).slice(0, 600) : ""])
  ) as Facts;
  try {
    const coach = await loadSalesCallCoach(auth.userId);
    const angle = typeof body?.angle === "string" ? body.angle : undefined;
    const input = { notes, prospect, facts, coach, angle };
    return NextResponse.json(body?.kind === "phases" ? await writePhasedPitch(input) : await writePitch(input));
  } catch (err) {
    console.error("sales-call pitch:", err);
    return NextResponse.json({ error: err instanceof Error ? err.message : "Could not write the pitch." }, { status: 502 });
  }
}
