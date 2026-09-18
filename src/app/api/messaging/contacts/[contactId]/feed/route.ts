import { NextResponse } from "next/server";
import { loadProspectRecord } from "@/lib/messaging/loadProspectActivity";
import { resolveMessagingAccess } from "@/lib/messaging/resolveMessagingAccess";
import { THREAD_MESSAGE_MAX_LIMIT } from "@/lib/messaging/threadWindow";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

/**
 * GET /api/messaging/contacts/[contactId]/feed
 * Activity timeline + messaging messages for a prospect.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ contactId: string }> }
) {
  const { contactId: rawId } = await params;
  const contactId = rawId?.trim();
  if (!contactId) {
    return NextResponse.json({ error: "Missing contact id." }, { status: 400 });
  }

  const access = await resolveMessagingAccess(request);
  if (!access.ok) {
    return NextResponse.json({ error: access.error }, { status: access.status });
  }

  const { data: contacts } = await supabaseAdmin
    .from("contacts")
    .select("id, coach_id, full_name, email, phone, type")
    .eq("id", contactId)
    .eq("coach_id", access.coachId)
    .in("type", ["prospect", "client"])
    .limit(1);
  const contact = contacts?.[0];
  if (!contact) {
    return NextResponse.json({ error: "Contact not found." }, { status: 404 });
  }

  const { data: conversations } = await supabaseAdmin
    .from("messaging_conversations")
    .select(
      "id, subject, prospect_name, prospect_email, prospect_phone, last_message_at, starred, unread_count, last_preview, last_channel, booking_id, contact_id"
    )
    .eq("contact_id", contactId)
    .eq("coach_id", access.coachId)
    .order("last_message_at", { ascending: false });
  const conversationIds = (conversations ?? []).map((c) => c.id as string);

  let messages: unknown[] = [];
  if (conversationIds.length) {
    const { data: messageRows } = await supabaseAdmin
      .from("messaging_messages")
      .select(
        "id, conversation_id, channel, direction, status, subject, body_text, from_address, to_address, provider_error, metadata, created_at"
      )
      .in("conversation_id", conversationIds)
      .eq("coach_id", access.coachId)
      .order("created_at", { ascending: false })
      .limit(THREAD_MESSAGE_MAX_LIMIT);
    messages = [...(messageRows ?? [])].reverse();
  }

  const record = await loadProspectRecord(contactId, {
    coachId: access.coachId,
  });

  return NextResponse.json({
    conversations: conversations ?? [],
    messages,
    activity: record.activity,
    campaigns: record.campaigns,
    calls: record.calls,
  });
}
