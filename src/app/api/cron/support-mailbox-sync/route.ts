import { NextResponse } from "next/server";
import { isCronRequest } from "@/lib/cronAuth";
import { requireAdmin } from "@/lib/requireAdmin";
import { syncSupportMailboxInbound } from "@/lib/support/mailbox";
import { backfillSupportWhatsAppFiles } from "@/lib/support/whatsapp";

export const maxDuration = 60;

/**
 * Poll Unipile support mailbox → community_feedback tickets, then catch up
 * WhatsApp files that did not copy in when they arrived.
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
    // WhatsApp voice notes and photos the webhook couldn't fetch yet
    // (WhatsApp is often still uploading them): try again for two hours.
    const whatsappFiles = await backfillSupportWhatsAppFiles({
      sinceIso: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
      limit: 3,
    }).catch((err) => {
      console.error("support-mailbox-sync whatsapp files:", err);
      return null;
    });
    return NextResponse.json({ ok: true, ...result, whatsappFiles });
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
