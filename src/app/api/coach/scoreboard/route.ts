import { NextResponse } from "next/server";

import { requireCoachRequest } from "@/lib/requireCoachRequest";
import { loadScoreboardData } from "@/lib/scoreboardData";

/** Scoreboard V2: the coach's own numbers from their data, and where each came from. Read-only. */
export async function GET(request: Request) {
  const check = await requireCoachRequest(request, { allowAdminSelf: true });
  if (check.error !== null) {
    return NextResponse.json({ error: check.error }, { status: 401 });
  }
  try {
    return NextResponse.json(await loadScoreboardData(check.userId));
  } catch (err) {
    console.error("scoreboard numbers:", err instanceof Error ? err.message : "failed");
    return NextResponse.json({ error: "Could not load your numbers." }, { status: 500 });
  }
}
