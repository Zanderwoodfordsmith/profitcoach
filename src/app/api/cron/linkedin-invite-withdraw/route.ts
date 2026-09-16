import { NextResponse } from "next/server";
import { isCronRequest } from "@/lib/cronAuth";
import { requireAdmin } from "@/lib/requireAdmin";
import { processDueInviteWithdrawals } from "@/lib/unipile/invitations";

export const maxDuration = 60;

/**
 * Auto-withdraw pending LinkedIn invites per coach policy.
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
    const result = await processDueInviteWithdrawals();
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Invite withdraw cron failed.";
    console.error("linkedin-invite-withdraw cron:", err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  return GET(request);
}
