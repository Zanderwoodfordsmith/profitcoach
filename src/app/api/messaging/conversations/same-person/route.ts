import { NextResponse } from "next/server";
import { normalizeContactEmail } from "@/lib/contacts/identity";
import { looksLikePersonName } from "@/lib/messaging/conversationDisplay";
import { mergeThreadPerson } from "@/lib/messaging/mergeThreadPerson";
import { resolveMessagingAccess } from "@/lib/messaging/resolveMessagingAccess";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function escapeIlike(value: string): string {
  return value.replace(/[%_,]/g, " ").replace(/\s+/g, " ").trim();
}

function displayName(
  name: string | null | undefined,
  email: string | null | undefined
): string | null {
  if (looksLikePersonName(name)) return name!.trim();
  return normalizeContactEmail(email) || null;
}

/**
 * GET /api/messaging/conversations/same-person?q=&conversationId=
 * People and threads this conversation could be joined with.
 */
export async function GET(request: Request) {
  const access = await resolveMessagingAccess(request);
  if (!access.ok) {
    return NextResponse.json({ error: access.error }, { status: access.status });
  }

  const url = new URL(request.url);
  const q = escapeIlike(url.searchParams.get("q") ?? "").slice(0, 80);
  const conversationId = url.searchParams.get("conversationId")?.trim() || "";
  if (q.length < 2) return NextResponse.json({ matches: [] });

  let excludeContactId: string | null = null;
  if (conversationId) {
    const { data } = await supabaseAdmin
      .from("messaging_conversations")
      .select("contact_id")
      .eq("id", conversationId)
      .eq("coach_id", access.coachId)
      .maybeSingle();
    excludeContactId = (data?.contact_id as string | null) ?? null;
  }

  const filter = [
    `full_name.ilike.%${q}%`,
    `email.ilike.%${q}%`,
    `business_name.ilike.%${q}%`,
  ].join(",");

  const [{ data: contacts }, { data: threads }] = await Promise.all([
    supabaseAdmin
      .from("contacts")
      .select("id, full_name, email, phone, business_name")
      .eq("coach_id", access.coachId)
      .or(filter)
      .limit(8),
    supabaseAdmin
      .from("messaging_conversations")
      .select(
        "id, contact_id, prospect_name, prospect_email, prospect_phone, prospect_business_name, last_channel"
      )
      .eq("coach_id", access.coachId)
      .is("hidden_at", null)
      .or(
        `prospect_name.ilike.%${q}%,prospect_email.ilike.%${q}%,prospect_business_name.ilike.%${q}%`
      )
      .limit(12),
  ]);

  const matches: Array<{
    contactId: string | null;
    conversationId: string | null;
    name: string | null;
    email: string | null;
    phone: string | null;
    channel: string | null;
    businessName: string | null;
  }> = [];

  const seenContacts = new Set<string>();
  for (const contact of contacts ?? []) {
    const id = contact.id as string;
    if (id === excludeContactId) continue;
    seenContacts.add(id);
    matches.push({
      contactId: id,
      conversationId: null,
      name: displayName(contact.full_name as string | null, contact.email as string | null),
      email: (contact.email as string | null) ?? null,
      phone: (contact.phone as string | null) ?? null,
      channel: null,
      businessName: (contact.business_name as string | null) ?? null,
    });
  }

  for (const thread of threads ?? []) {
    const id = thread.id as string;
    const contactId = (thread.contact_id as string | null) ?? null;
    if (id === conversationId) continue;
    if (contactId && (contactId === excludeContactId || seenContacts.has(contactId))) {
      continue;
    }
    matches.push({
      contactId,
      conversationId: id,
      name: displayName(
        thread.prospect_name as string | null,
        thread.prospect_email as string | null
      ),
      email: (thread.prospect_email as string | null) ?? null,
      phone: (thread.prospect_phone as string | null) ?? null,
      channel: (thread.last_channel as string | null) ?? null,
      businessName: (thread.prospect_business_name as string | null) ?? null,
    });
  }

  return NextResponse.json({ matches: matches.slice(0, 12) });
}

/**
 * POST /api/messaging/conversations/same-person
 * Join this thread with another person or thread.
 */
export async function POST(request: Request) {
  const access = await resolveMessagingAccess(request);
  if (!access.ok) {
    return NextResponse.json({ error: access.error }, { status: access.status });
  }

  const body = (await request.json().catch(() => null)) as {
    conversationId?: string;
    contactId?: string | null;
    otherConversationId?: string | null;
  } | null;
  const conversationId = body?.conversationId?.trim() || "";
  const contactId = body?.contactId?.trim() || null;
  const otherConversationId = body?.otherConversationId?.trim() || null;
  if (!UUID.test(conversationId)) {
    return NextResponse.json({ error: "conversationId is required." }, { status: 400 });
  }
  if (contactId && !UUID.test(contactId)) {
    return NextResponse.json({ error: "contactId is invalid." }, { status: 400 });
  }
  if (otherConversationId && !UUID.test(otherConversationId)) {
    return NextResponse.json(
      { error: "otherConversationId is invalid." },
      { status: 400 }
    );
  }
  if (!contactId && !otherConversationId) {
    return NextResponse.json(
      { error: "Choose a person to merge with." },
      { status: 400 }
    );
  }

  try {
    const result = await mergeThreadPerson({
      coachId: access.coachId,
      conversationId,
      contactId,
      otherConversationId,
    });
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Could not merge those threads.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
