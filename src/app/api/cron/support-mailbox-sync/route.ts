import { NextResponse } from "next/server";
import { isCronRequest } from "@/lib/cronAuth";
import { requireAdmin } from "@/lib/requireAdmin";
import { syncSupportMailboxInbound } from "@/lib/support/mailbox";

export const maxDuration = 60;

/**
 * Poll Unipile support mailbox → community_feedback tickets.
 * Auth: Vercel cron / CRON_SECRET, or admin session (local testing).
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
    const result = await syncSupportMailboxInbound(25);
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Support mailbox sync failed.";
    console.error("support-mailbox-sync cron:", err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  return GET(request);
}
