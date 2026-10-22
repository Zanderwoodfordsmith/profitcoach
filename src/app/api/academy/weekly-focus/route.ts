import { NextResponse } from "next/server";

import { findWeeklyFocusById, loadWeeklyFocusCatalog } from "@/lib/academy/weeklyFocus";
import { requireCoachRequest } from "@/lib/requireCoachRequest";

/** A week's lesson text and audio, for signed-in members only (the page sends titles). */
export async function GET(request: Request) {
  const auth = await requireCoachRequest(request, { allowAdminSelf: true });
  if (auth.error) return NextResponse.json({ error: auth.error }, { status: 401 });
  const weekId = new URL(request.url).searchParams.get("weekId") ?? "";
  const week = findWeeklyFocusById(loadWeeklyFocusCatalog(), weekId);
  if (!week) return NextResponse.json({ error: "Week not found." }, { status: 404 });
  return NextResponse.json(
    { bodyMarkdown: week.bodyMarkdown ?? null, audioUrl: week.audioUrl ?? null },
    { headers: { "Cache-Control": "private, no-store" } }
  );
}
