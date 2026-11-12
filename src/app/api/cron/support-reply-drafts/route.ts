import { NextResponse } from "next/server";
import { isCronRequest } from "@/lib/cronAuth";
import { requireAdmin } from "@/lib/requireAdmin";
import { draftDueSupportReplies } from "@/lib/support/replySuggestion";

export const maxDuration = 60;

/**
 * Writes suggested replies for chats waiting on BCA, so they're ready on opening.
 * Drafts only: nothing is ever sent from here.
 * Auth: Vercel cron / CRON_SECRET, or admin session (local testing).
 */
export async function GET(request: Request) {
  if (!isCronRequest(request)) {
    const admin = await requireAdmin(request);
    if (admin.error) {
      return NextResponse.json({ error: admin.error }, { status: 401 });
    }
  }
  try {
    return NextResponse.json({ ok: true, ...(await draftDueSupportReplies()) });
  } catch (err) {
    console.error("support-reply-drafts cron:", err);
    return NextResponse.json({ error: "Could not write drafts." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  return GET(request);
}
