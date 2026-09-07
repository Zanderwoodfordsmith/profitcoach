import { NextResponse } from "next/server";
import { requireCoachRequest } from "@/lib/requireCoachRequest";
import { syncContactWhatsAppStatus } from "@/lib/unipile/checkWhatsAppOn";

type RouteContext = { params: Promise<{ id: string }> };

/**
 * Verify whether the contact's phone is registered on WhatsApp (Unipile).
 * Coach-scoped; results cached on contacts.whatsapp_on.
 */
export async function POST(request: Request, context: RouteContext) {
  const authCheck = await requireCoachRequest(request);
  if (authCheck.error || !authCheck.userId) {
    const status = authCheck.error === "Invalid access token." ? 401 : 403;
    return NextResponse.json(
      { error: authCheck.error ?? "Unauthorized" },
      { status }
    );
  }

  const { id: contactId } = await context.params;
  if (!contactId?.trim()) {
    return NextResponse.json({ error: "Missing contact id." }, { status: 400 });
  }

  let force = false;
  try {
    const body = (await request.json()) as { force?: boolean };
    force = Boolean(body?.force);
  } catch {
    /* empty body is fine */
  }

  const status = await syncContactWhatsAppStatus({
    coachId: authCheck.userId,
    contactId: contactId.trim(),
    force,
  });

  if (status.error === "Prospect not found.") {
    return NextResponse.json({ error: status.error }, { status: 404 });
  }

  return NextResponse.json({
    has_whatsapp: status.on === true,
    whatsapp_on: status.on,
    checked_at: status.checkedAt,
    source: status.source,
    ...(status.error ? { warning: status.error } : {}),
  });
}
