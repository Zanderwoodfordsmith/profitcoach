import { NextResponse } from "next/server";
import {
  importProspectRowsForCoach,
  MAX_PROSPECT_IMPORT_ROWS,
} from "@/lib/prospects/importProspectRows";
import { requireCoachRequest } from "@/lib/requireCoachRequest";

export async function POST(request: Request) {
  const authCheck = await requireCoachRequest(request);
  if (authCheck.error) {
    return NextResponse.json({ error: authCheck.error }, { status: 401 });
  }

  let body: { rows?: unknown };
  try {
    body = (await request.json()) as { rows?: unknown };
  } catch {
    return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
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
    const result = await importProspectRowsForCoach({
      coachId: authCheck.userId!,
      rows: body.rows,
    });
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unable to import prospects.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
