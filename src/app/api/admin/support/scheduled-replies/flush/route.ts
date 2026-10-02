import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/requireAdmin";
import { processDueScheduledSupportReplies } from "@/lib/support/scheduledReplies";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * Send support replies whose scheduled time has passed.
 * The live site also does this from the minute cron. The open inbox calls
 * this so a local dev session sends on time without that cron.
 */
export async function POST(request: Request) {
  const auth = await requireAdmin(request);
  if (auth.error) {
    return NextResponse.json({ error: auth.error }, { status: 401 });
  }

  try {
    const result = await processDueScheduledSupportReplies(15, request);
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Could not send scheduled replies.";
    console.error("support scheduled flush:", err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
