import { NextResponse } from "next/server";
import { isCronRequest } from "@/lib/cronAuth";
import { requireAdmin } from "@/lib/requireAdmin";
import { processDueScheduledMessages } from "@/lib/messaging/scheduledMessages";

export const maxDuration = 60;

/**
 * Cron: send due scheduled inbox messages.
 * Auth: Vercel cron / CRON_SECRET, or admin session (local testing).
 */
export async function GET(request: Request) {
  return run(request);
}

export async function POST(request: Request) {
  return run(request);
}

async function run(request: Request) {
  const cron = isCronRequest(request);
  if (!cron) {
    const admin = await requireAdmin(request);
    if (admin.error) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  try {
    const result = await processDueScheduledMessages(25);
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    console.error("messaging scheduled cron:", err);
    return NextResponse.json(
      {
        error:
          err instanceof Error ? err.message : "Scheduled message cron failed.",
      },
      { status: 500 }
    );
  }
}
