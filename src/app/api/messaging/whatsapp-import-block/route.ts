import { NextResponse } from "next/server";
import { resolveMessagingAccess } from "@/lib/messaging/resolveMessagingAccess";
import { blockWhatsAppConversations } from "@/lib/messaging/whatsappImport";

/**
 * POST /api/messaging/whatsapp-import-block
 * Body: { conversation_ids: string[] }
 * Removes stored WhatsApp messages for those chats and blocks future import.
 */
export async function POST(request: Request) {
  const access = await resolveMessagingAccess(request);
  if (!access.ok) {
    return NextResponse.json({ error: access.error }, { status: access.status });
  }

  let body: { conversation_ids?: unknown };
  try {
    body = (await request.json()) as { conversation_ids?: unknown };
  } catch {
    return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
  }

  const conversationIds = Array.isArray(body.conversation_ids)
    ? body.conversation_ids.filter((id): id is string => typeof id === "string")
    : [];
  if (!conversationIds.length || conversationIds.length > 100) {
    return NextResponse.json(
      { error: "Choose between 1 and 100 WhatsApp chats." },
      { status: 400 }
    );
  }

  try {
    const result = await blockWhatsAppConversations({
      coachId: access.coachId,
      conversationIds,
    });
    return NextResponse.json({ ok: true, blocked: result.blocked });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Could not update import.";
    console.error("whatsapp import block:", message);
    return NextResponse.json(
      { error: "Could not stop importing that chat." },
      { status: 500 }
    );
  }
}
