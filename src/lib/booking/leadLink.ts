import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { outreachFirstName, outreachLastName } from "@/lib/unipile/outreachNames";

/**
 * Links a booking (native or GoHighLevel) to the campaign lead it came from,
 * so coach health can show which campaigns turn into calls.
 *
 * Order: the lead's personal booking link (exact), then the booking's contact,
 * then the same name under the same coach (only when it is one person).
 */

export type LeadMatch = "link" | "contact" | "name";

function appBase(): string {
  return (process.env.APP_BASE_URL || "https://app.theprofitcoach.com").replace(/\/$/, "");
}

/** The coach's booking page with this lead built in. */
export function bookingUrlForLead(slug: string, leadId: string | null | undefined): string {
  const base = `${appBase()}/book/${encodeURIComponent(slug)}`;
  return leadId ? `${base}?lead=${encodeURIComponent(leadId)}` : base;
}

/** {{booking_link}} for a campaign message: the coach's page with this lead built in. */
export async function bookingLinkForCoachLead(coachId: string, leadId: string | null | undefined): Promise<string> {
  const { data } = await supabaseAdmin.from("coaches").select("slug").eq("id", coachId).maybeSingle();
  const slug = (data?.slug as string | null)?.trim();
  return slug ? bookingUrlForLead(slug, leadId) : "";
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function cleanLeadParam(value: string | null | undefined): string | null {
  const v = (value ?? "").trim();
  return UUID_RE.test(v) ? v.toLowerCase() : null;
}

function lastWord(v: string): string {
  const words = v.toLowerCase().split(/\s+/).filter(Boolean);
  return words[words.length - 1] ?? "";
}

/** "Dr Sarah Chen-Jones MBA 🚀" → { first: "sarah", last: "chen-jones" }. */
export function splitBookingName(name: string | null | undefined): { first: string; last: string } | null {
  const words = (name ?? "").trim().split(/\s+/).filter(Boolean);
  if (words.length < 2) return null;
  const first = outreachFirstName(words.slice(0, -1).join(" ")).toLowerCase();
  const last = lastWord(outreachLastName(words.slice(1).join(" ")));
  return first && last ? { first, last } : null;
}

function sameName(lead: { first_name: unknown; last_name: unknown }, name: { first: string; last: string }): boolean {
  return (
    outreachFirstName(lead.first_name as string | null).toLowerCase() === name.first &&
    lastWord(outreachLastName(lead.last_name as string | null)) === name.last
  );
}

function likeExact(v: string): string {
  return v.replace(/[\\%_]/g, (c) => `\\${c}`);
}

export async function findLeadForBooking(input: {
  coachId: string;
  leadId?: string | null;
  contactId?: string | null;
  prospectName?: string | null;
}): Promise<{ leadId: string; match: LeadMatch } | null> {
  const leadId = cleanLeadParam(input.leadId);
  if (leadId) {
    const { data } = await supabaseAdmin
      .from("linkedin_campaign_leads")
      .select("id")
      .eq("id", leadId)
      .eq("coach_id", input.coachId)
      .maybeSingle();
    if (data) return { leadId: data.id as string, match: "link" };
  }

  if (input.contactId) {
    const { data } = await supabaseAdmin
      .from("linkedin_campaign_leads")
      .select("id")
      .eq("coach_id", input.coachId)
      .eq("contact_id", input.contactId)
      .order("updated_at", { ascending: false })
      .limit(1);
    if (data?.[0]) return { leadId: data[0].id as string, match: "contact" };
  }

  const name = splitBookingName(input.prospectName);
  if (!name) return null;
  const { data } = await supabaseAdmin
    .from("linkedin_campaign_leads")
    .select("id, first_name, last_name, linkedin_provider_id, linkedin_url, updated_at")
    .eq("coach_id", input.coachId)
    .ilike("first_name", `%${likeExact(name.first)}%`)
    .ilike("last_name", `%${likeExact(name.last)}%`)
    .order("updated_at", { ascending: false })
    .limit(50);
  const rows = (data ?? []).filter((r) => sameName(r, name));
  if (!rows.length) return null;
  // The same person can sit in several campaigns; two different people with one name is too unsure.
  const people = new Set(rows.map((r) => (r.linkedin_provider_id as string | null) || (r.linkedin_url as string | null) || (r.id as string)));
  if (people.size > 1) return null;
  return { leadId: rows[0]!.id as string, match: "name" };
}

/** Finds and saves the lead for one booking row. Never throws. */
export async function linkBookingToLead(
  table: "bookings" | "ghl_appointments",
  rowId: string,
  input: Parameters<typeof findLeadForBooking>[0]
): Promise<{ leadId: string; match: LeadMatch } | null> {
  try {
    const found = await findLeadForBooking(input);
    if (!found) return null;
    const { error } = await supabaseAdmin
      .from(table)
      .update({ campaign_lead_id: found.leadId, lead_match: found.match })
      .eq("id", rowId);
    if (error) throw new Error(error.message);
    return found;
  } catch (err) {
    console.error("linkBookingToLead:", err instanceof Error ? err.message : err);
    return null;
  }
}

/** The campaign lead behind a conversation, for personal booking links in Ava's messages. */
export async function leadIdForConversation(conversationId: string): Promise<string | null> {
  const { data: conv } = await supabaseAdmin
    .from("messaging_conversations")
    .select("coach_id, unipile_chat_id, prospect_linkedin_provider_id")
    .eq("id", conversationId)
    .maybeSingle();
  if (!conv) return null;
  for (const [col, value] of [
    ["unipile_chat_id", conv.unipile_chat_id],
    ["linkedin_provider_id", conv.prospect_linkedin_provider_id],
  ] as const) {
    if (!value) continue;
    const { data } = await supabaseAdmin
      .from("linkedin_campaign_leads")
      .select("id")
      .eq("coach_id", conv.coach_id as string)
      .eq(col, value as string)
      .order("updated_at", { ascending: false })
      .limit(1);
    if (data?.[0]) return data[0].id as string;
  }
  return null;
}
