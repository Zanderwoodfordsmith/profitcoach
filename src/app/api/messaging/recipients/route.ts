import { NextResponse } from "next/server";
import { selectContactsWithOptionalPhone } from "@/lib/contactsSchemaSafeSelect";
import { requireAdmin } from "@/lib/requireAdmin";
import { requireCoachRequest } from "@/lib/requireCoachRequest";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

function escapeIlike(value: string): string {
  return value.replace(/[%_,]/g, " ").replace(/\s+/g, " ").trim();
}

/**
 * GET /api/messaging/recipients?q=
 * Search the current coach's people to start a conversation.
 */
export async function GET(request: Request) {
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

  const q = escapeIlike(new URL(request.url).searchParams.get("q") ?? "").slice(
    0,
    80
  );

  const { data, error } = await selectContactsWithOptionalPhone<{
    id: string;
    full_name: string | null;
    email: string | null;
    phone: string | null;
    business_name: string | null;
    linkedin_url: string | null;
    photo_url: string | null;
    type: string | null;
  }>(
    async (columns) => {
      let query = supabaseAdmin
        .from("contacts")
        .select(columns)
        .eq("coach_id", coachId)
        .order("created_at", { ascending: false })
        .limit(20);
      if (q) {
        const parts = [
          `full_name.ilike.%${q}%`,
          `email.ilike.%${q}%`,
          `business_name.ilike.%${q}%`,
        ];
        if (columns.includes("phone")) parts.push(`phone.ilike.%${q}%`);
        query = query.or(parts.join(","));
      }
      return query;
    },
    "id, full_name, email, business_name, type",
    ["linkedin_url", "photo_url"]
  );
  if (error) {
    console.error("messaging recipients:", error);
    return NextResponse.json({ error: "Could not search people." }, { status: 500 });
  }

  const contacts = data ?? [];
  const ids = contacts.map((row) => row.id as string);
  const conversationByContact = new Map<string, string>();
  if (ids.length) {
    const { data: convs } = await supabaseAdmin
      .from("messaging_conversations")
      .select("id, contact_id, last_message_at")
      .eq("coach_id", coachId)
      .in("contact_id", ids)
      .order("last_message_at", { ascending: false });
    for (const row of convs ?? []) {
      const contactId = row.contact_id as string | null;
      if (contactId && !conversationByContact.has(contactId)) {
        conversationByContact.set(contactId, row.id as string);
      }
    }
  }

  return NextResponse.json({
    recipients: contacts.map((row) => ({
      id: row.id,
      full_name: row.full_name,
      email: row.email,
      phone: row.phone,
      business_name: row.business_name,
      linkedin_url: row.linkedin_url,
      photo_url: row.photo_url,
      type: row.type,
      conversation_id: conversationByContact.get(row.id as string) ?? null,
    })),
  });
}
