import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/requireAdmin";
import { processDueScheduledMessages } from "@/lib/messaging/scheduledMessages";

export const maxDuration = 60;

function isCronRequest(request: Request): boolean {
  if (request.headers.get("x-vercel-cron") === "1") return true;
  const auth = request.headers.get("authorization") || "";
  const bearer = auth.startsWith("Bearer ") ? auth.slice(7).trim() : "";
  const secrets = [
    process.env.CRON_SECRET?.trim(),
    process.env.LINKEDIN_CRON_SECRET?.trim(),
  ].filter(Boolean) as string[];
  return !!bearer && secrets.includes(bearer);
}

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
