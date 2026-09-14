import { NextResponse } from "next/server";
import {
  importProspectRowsForCoach,
  MAX_PROSPECT_IMPORT_ROWS,
  resolveImportCoachId,
} from "@/lib/prospects/importProspectRows";
import { requireAdmin } from "@/lib/requireAdmin";

export async function POST(request: Request) {
  const authCheck = await requireAdmin(request);
  if (authCheck.error) {
    return NextResponse.json({ error: authCheck.error }, { status: 401 });
  }

  let body: { coachId?: unknown; rows?: unknown };
  try {
    body = (await request.json()) as { coachId?: unknown; rows?: unknown };
  } catch {
    return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
  }

  const coachIdRaw = typeof body.coachId === "string" ? body.coachId.trim() : "";
  if (!coachIdRaw) {
    return NextResponse.json({ error: "Please select a coach for this import." }, { status: 400 });
  }
  if (!Array.isArray(body.rows)) {
    return NextResponse.json({ error: "rows must be an array." }, { status: 400 });
  }
  if (body.rows.length > MAX_PROSPECT_IMPORT_ROWS) {
    return NextResponse.json(
      { error: `You can import at most ${MAX_PROSPECT_IMPORT_ROWS} prospects at a time.` },
      { status: 400 }
    );
  }

  try {
    const coach = await resolveImportCoachId(coachIdRaw);
    const result = await importProspectRowsForCoach({
      coachId: coach.coachId,
      rows: body.rows,
    });
    return NextResponse.json({ ok: true, coachSlug: coach.coachSlug, ...result });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unable to import prospects.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
