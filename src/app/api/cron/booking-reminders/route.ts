import { NextResponse } from "next/server";
import { isCronRequest } from "@/lib/cronAuth";
import { requireAdmin } from "@/lib/requireAdmin";
import { processDueBookingReminders } from "@/lib/messaging/bookingConfirmations";

export const maxDuration = 60;

/**
 * Send booking reminder sequence (Unipile email + Bird SMS) for due bookings.
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
    const result = await processDueBookingReminders(25);
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Booking reminder tick failed.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  return GET(request);
}
