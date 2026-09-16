import { NextResponse } from "next/server";
import { isCronRequest } from "@/lib/cronAuth";
import { requireAdmin } from "@/lib/requireAdmin";
import { processDueSupportReplyEmails } from "@/lib/support/notifyCoachOfReply";

export const maxDuration = 60;

/**
 * Flush debounced support-reply notification emails.
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
    const result = await processDueSupportReplyEmails(25, request);
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    const message =
      err instanceof Error
        ? err.message
        : "Support reply notify cron failed.";
    console.error("support-reply-notify cron:", err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  return GET(request);
}
