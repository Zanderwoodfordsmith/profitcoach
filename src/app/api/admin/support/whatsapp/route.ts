import { NextResponse } from "next/server";
import { getAppBaseUrl } from "@/lib/appBaseUrl";
import { requireAdmin } from "@/lib/requireAdmin";
import { isUnipileConfigured } from "@/lib/unipile/client";
import {
  claimSupportWhatsAppFromUnipile,
  createSupportWhatsAppConnectLink,
  disconnectSupportWhatsApp,
  listSupportWhatsAppLines,
  refreshSupportWhatsAppLineStatus,
  SUPPORT_WHATSAPP_HISTORY_DAYS,
  supportWhatsAppLeadLine,
  supportWhatsAppLineForAdmin,
  supportWhatsAppRoute,
  supportWhatsAppRouteForCoach,
  syncSupportWhatsAppLine,
  type SupportWhatsAppLine,
} from "@/lib/support/whatsapp";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * GET: your linked WhatsApp (and a quick catch-up of coach chats, since
 * localhost gets no webhooks). With ?report_id= : which phone a WhatsApp
 * reply on that chat would go from.
 * POST: connect | claim | disconnect.
 */

function view(line: SupportWhatsAppLine | null) {
  return line
    ? {
        status: line.status,
        phone: line.phone,
        last_synced_at: line.last_synced_at,
      }
    : null;
}

function sinceFor(line: SupportWhatsAppLine): string {
  const back = SUPPORT_WHATSAPP_HISTORY_DAYS * 24 * 60 * 60 * 1000;
  if (!line.last_synced_at) return new Date(Date.now() - back).toISOString();
  // A little overlap so nothing falls between two passes.
  return new Date(Date.parse(line.last_synced_at) - 10 * 60 * 1000).toISOString();
}

export async function GET(request: Request) {
  const auth = await requireAdmin(request);
  if (auth.error || !auth.userId) {
    return NextResponse.json({ error: auth.error }, { status: 401 });
  }
  const params = new URL(request.url).searchParams;
  const reportId = params.get("report_id")?.trim();
  // New ticket: no ticket yet, so ask by coach.
  const coachId = params.get("coach_id")?.trim();
  // Who the reply is sent as (the "send as" picker), so it goes from their phone.
  const as = params.get("as")?.trim();
  const asId = as && /^[0-9a-f-]{36}$/i.test(as) ? as : auth.userId;
  try {
    if (reportId || coachId) {
      const route = reportId
        ? await supportWhatsAppRoute({ reportId, adminId: asId })
        : await supportWhatsAppRouteForCoach({ coachId: coachId!, adminId: asId });
      if (!route.ok) return NextResponse.json({ available: false, reason: route.reason });
      // The line a first WhatsApp reply starts with, shown faintly in the box.
      const lead = reportId ? await supportWhatsAppLeadLine(reportId) : null;
      return NextResponse.json({ available: true, from: route.fromName, lead });
    }

    let line = await supportWhatsAppLineForAdmin(auth.userId);
    let sync: { chats: number; messages: number } | null = null;
    if (line && isUnipileConfigured()) {
      line = await refreshSupportWhatsAppLineStatus(line);
    }
    // Catch up every linked phone (webhooks cover production; this covers localhost and gaps).
    if (isUnipileConfigured()) {
      const deadlineAt = Date.now() + 40_000;
      for (const each of await listSupportWhatsAppLines()) {
        if (each.status !== "OK") continue;
        const done = await syncSupportWhatsAppLine(each, { sinceIso: sinceFor(each), deadlineAt }).catch(
          (err) => {
            console.warn("support whatsapp sync:", err);
            return null;
          }
        );
        if (done && each.admin_id === auth.userId) sync = done;
      }
      if (line) line = (await supportWhatsAppLineForAdmin(auth.userId)) ?? line;
    }
    return NextResponse.json({ configured: isUnipileConfigured(), line: view(line), sync });
  } catch (err) {
    console.error("support whatsapp GET:", err);
    return NextResponse.json({ error: "Could not load WhatsApp." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const auth = await requireAdmin(request);
  if (auth.error || !auth.userId) {
    return NextResponse.json({ error: auth.error }, { status: 401 });
  }
  const body = ((await request.json().catch(() => null)) ?? {}) as { action?: string };
  try {
    if (body.action === "connect") {
      const link = await createSupportWhatsAppConnectLink(auth.userId, getAppBaseUrl(request));
      return NextResponse.json(link);
    }
    if (body.action === "claim") {
      const existing = await supportWhatsAppLineForAdmin(auth.userId);
      const line = existing ?? (await claimSupportWhatsAppFromUnipile(auth.userId));
      if (!line) {
        return NextResponse.json({ error: "No newly linked WhatsApp found yet. Try again in a minute." }, { status: 404 });
      }
      return NextResponse.json({ ok: true, line: view(line) });
    }
    if (body.action === "disconnect") {
      await disconnectSupportWhatsApp(auth.userId);
      return NextResponse.json({ ok: true });
    }
    return NextResponse.json({ error: "action must be connect, claim or disconnect." }, { status: 400 });
  } catch (err) {
    console.error("support whatsapp POST:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Something went wrong." },
      { status: 500 }
    );
  }
}
