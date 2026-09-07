import { NextResponse } from "next/server";
import { collapseConversationsByContact } from "@/lib/messaging/collapseConversationsByContact";
import { enrichConversationFilters } from "@/lib/messaging/enrichConversationFilters";
import { enrichMessagingConversationPeople } from "@/lib/messaging/enrichConversationPeople";
import { findOrCreateConversationForContact } from "@/lib/messaging/startConversation";
import { requireAdmin } from "@/lib/requireAdmin";
import { requireCoachRequest } from "@/lib/requireCoachRequest";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

/**
 * GET /api/messaging/conversations
 * Admin: all threads. Coach: own threads.
 */
export async function GET(request: Request) {
  const admin = await requireAdmin(request);
  let coachId: string | null = null;

  const impersonateId = request.headers.get("x-impersonate-coach-id")?.trim();
  if (admin.error === null) {
    // Admin inbox is org-wide unless they are viewing as a specific coach.
    coachId = impersonateId || null;
  } else {
    const coach = await requireCoachRequest(request);
    if (coach.error || !coach.userId) {
      return NextResponse.json(
        { error: coach.error || admin.error || "Not authorized." },
        { status: 401 }
      );
    }
    coachId = coach.userId;
  }

  let q = supabaseAdmin
    .from("messaging_conversations")
    .select(
      "id, coach_id, contact_id, booking_id, subject, prospect_name, prospect_email, prospect_phone, prospect_avatar_url, prospect_linkedin_url, prospect_linkedin_provider_id, prospect_business_name, last_message_at, created_at, starred, unread_count, last_preview, last_channel, last_direction, unipile_chat_id"
    )
    .is("hidden_at", null)
    .order("last_message_at", { ascending: false })
    .limit(250);

  if (coachId) q = q.eq("coach_id", coachId);

  const { data, error } = await q;
  if (error) {
    console.error("messaging conversations list:", error);
    return NextResponse.json({ error: "Could not load conversations." }, { status: 500 });
  }

  const enriched = await enrichMessagingConversationPeople(data ?? []);
  // Drop empty CRM shells when a real provider thread exists for the same person.
  const hasProviderIdentity = new Set<string>();
  for (const row of enriched) {
    if (!row.unipile_chat_id) continue;
    if (row.contact_id) hasProviderIdentity.add(`contact:${row.contact_id}`);
    const email = (row.prospect_email || "").trim().toLowerCase();
    if (email) hasProviderIdentity.add(`email:${email}`);
    const phone = String(row.prospect_phone || "").replace(/\D/g, "");
    if (phone.length >= 8) hasProviderIdentity.add(`phone:${phone}`);
  }
  const withoutShells = enriched.filter((row) => {
    if (row.unipile_chat_id || (row.last_preview || "").trim() || (row.unread_count || 0) > 0) {
      return true;
    }
    if (row.contact_id && hasProviderIdentity.has(`contact:${row.contact_id}`)) {
      return false;
    }
    const email = (row.prospect_email || "").trim().toLowerCase();
    if (email && hasProviderIdentity.has(`email:${email}`)) return false;
    const phone = String(row.prospect_phone || "").replace(/\D/g, "");
    if (phone.length >= 8 && hasProviderIdentity.has(`phone:${phone}`)) {
      return false;
    }
    return true;
  });
  // One inbox row per person — LinkedIn + WhatsApp used to look like duplicate "Pams".
  const collapsed = collapseConversationsByContact(withoutShells);
  const conversations = await enrichConversationFilters(collapsed, coachId);

  return NextResponse.json({ conversations });
}

/**
 * POST /api/messaging/conversations
 * Open an existing thread for a contact, or start a blank one.
 */
export async function POST(request: Request) {
  const admin = await requireAdmin(request);
  const impersonateId = request.headers.get("x-impersonate-coach-id")?.trim();
  let coachId: string | null = null;

  if (admin.error === null && admin.userId) {
    coachId = impersonateId || admin.userId;
  } else {
    const coach = await requireCoachRequest(request);
    if (coach.error || !coach.userId) {
      return NextResponse.json(
        { error: coach.error || admin.error || "Not authorized." },
        { status: 401 }
      );
    }
    coachId = coach.userId;
  }

  const body = (await request.json().catch(() => ({}))) as {
    contact_id?: string;
  };
  const contactId = body.contact_id?.trim() || "";
  if (
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      contactId
    )
  ) {
    return NextResponse.json({ error: "contact_id is required." }, { status: 400 });
  }

  try {
    const result = await findOrCreateConversationForContact(coachId, contactId);
    return NextResponse.json(result);
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Could not start conversation.";
    const status = message === "Contact not found." ? 404 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
