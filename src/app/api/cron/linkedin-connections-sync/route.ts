import { NextResponse } from "next/server";
import { isCronRequest } from "@/lib/cronAuth";
import { requireAdmin } from "@/lib/requireAdmin";
import { syncStaleCoachConnections } from "@/lib/unipile/connectionsSync";

export const maxDuration = 300;

/**
 * Re-read each coach's LinkedIn connections about once a day, so Lead Lists
 * shows who is connected and since when. Read only on LinkedIn.
 * Auth: Vercel cron / CRON_SECRET, or admin session (for local testing).
 */
export async function GET(request: Request) {
  const cron = isCronRequest(request);
  if (!cron) {
    const admin = await requireAdmin(request);
    if (admin.error) {
      return NextResponse.json({ error: admin.error }, { status: 401 });
    }
  }

  try {
    const result = await syncStaleCoachConnections();
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Connections sync failed.";
    console.error("linkedin-connections-sync cron:", err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  return GET(request);
}
