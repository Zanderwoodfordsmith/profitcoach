import { NextResponse } from "next/server";
import { isCronRequest } from "@/lib/cronAuth";
import { requireAdmin } from "@/lib/requireAdmin";
import { processDueSupportReplyEmails } from "@/lib/support/notifyCoachOfReply";
import { processDueScheduledSupportReplies } from "@/lib/support/scheduledReplies";

export const maxDuration = 60;

/**
 * Send due scheduled support replies, then flush reply notification emails.
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
    let scheduled: Awaited<
      ReturnType<typeof processDueScheduledSupportReplies>
    > | null = null;
    let scheduledError: string | null = null;
    try {
      scheduled = await processDueScheduledSupportReplies(15, request);
    } catch (err) {
      scheduledError =
        err instanceof Error ? err.message : "Scheduled reply cron failed.";
      console.error("support scheduled replies:", err);
    }
    const result = await processDueSupportReplyEmails(25, request);
    return NextResponse.json({
      ok: !scheduledError,
      scheduled,
      scheduledError,
      ...result,
    });
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
