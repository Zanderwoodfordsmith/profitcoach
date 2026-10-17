import { NextResponse } from "next/server";
import { processAvaFollowups } from "@/lib/ava/followups";
import { isCronRequest } from "@/lib/cronAuth";
import { requireAdmin } from "@/lib/requireAdmin";

export const maxDuration = 60;

/** Cron: settle Ava autopilot offers and send the one 48-hour nudge. */
export async function GET(request: Request) {
  if (!isCronRequest(request)) {
    const admin = await requireAdmin(request);
    if (admin.error) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    return NextResponse.json({ ok: true, ...(await processAvaFollowups()) });
  } catch (err) {
    console.error("ava followups cron:", err);
    return NextResponse.json({ error: "Ava follow-ups failed." }, { status: 500 });
  }
}
