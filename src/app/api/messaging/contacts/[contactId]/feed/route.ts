import { NextResponse } from "next/server";
import { loadProspectActivity } from "@/lib/messaging/loadProspectActivity";
import { requireAdmin } from "@/lib/requireAdmin";
import { requireCoachRequest } from "@/lib/requireCoachRequest";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

async function resolveAccess(request: Request): Promise<
  | { error: string; status: number; coachId: null }
  | { error: null; coachId: string | null }
> {
  const admin = await requireAdmin(request);
  if (admin.error === null && admin.userId) {
    return { error: null, coachId: null };
  }
  const coach = await requireCoachRequest(request);
  if (coach.error || !coach.userId) {
    return {
      error: coach.error || admin.error || "Not authorized.",
      status: 401,
      coachId: null,
    };
  }
  return { error: null, coachId: coach.userId };
}

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

  const access = await resolveAccess(request);
  if (access.error) {
    return NextResponse.json({ error: access.error }, { status: access.status });
  }

  let contactQuery = supabaseAdmin
    .from("contacts")
    .select("id, coach_id, full_name, email, phone, type")
    .eq("id", contactId)
    .eq("type", "prospect")
    .limit(1);
  if (access.coachId) {
    contactQuery = contactQuery.eq("coach_id", access.coachId);
  }
  const { data: contacts } = await contactQuery;
  const contact = contacts?.[0];
  if (!contact) {
    return NextResponse.json({ error: "Prospect not found." }, { status: 404 });
  }

  const coachId = (contact.coach_id as string | null) ?? access.coachId;

  let convQuery = supabaseAdmin
    .from("messaging_conversations")
    .select(
      "id, subject, prospect_name, prospect_email, prospect_phone, last_message_at, starred, unread_count, last_preview, last_channel, booking_id, contact_id"
    )
    .eq("contact_id", contactId)
    .order("last_message_at", { ascending: false });
  if (access.coachId) {
    convQuery = convQuery.eq("coach_id", access.coachId);
  }
  const { data: conversations } = await convQuery;
  const conversationIds = (conversations ?? []).map((c) => c.id as string);

  let messages: unknown[] = [];
  if (conversationIds.length) {
    const { data: messageRows } = await supabaseAdmin
      .from("messaging_messages")
      .select(
        "id, conversation_id, channel, direction, status, subject, body_text, from_address, to_address, provider_error, created_at"
      )
      .in("conversation_id", conversationIds)
      .order("created_at", { ascending: true });
    messages = messageRows ?? [];
  }

  const activity = await loadProspectActivity(contactId, {
    coachId: coachId ?? undefined,
  });

  return NextResponse.json({
    conversations: conversations ?? [],
    messages,
    activity,
  });
}
