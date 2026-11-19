import { supabaseAdmin } from "@/lib/supabaseAdmin";
import type { SearchProspectItem } from "@/lib/search/types";

const LIMIT = 5;

/**
 * Words safe to drop into a PostgREST or() filter: commas, brackets, quotes
 * and wildcards would break or widen it. "Jason Dod" → ["Jason", "Dod"].
 */
function searchWords(q: string): string[] {
  return q
    .replace(/[^\p{L}\p{N}@.'\- ]+/gu, " ")
    .split(/\s+/)
    .filter((w) => w.length > 0)
    .slice(0, 4);
}

function contactName(row: {
  full_name: string | null;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
}): string {
  return (
    row.full_name?.trim() ||
    [row.first_name, row.last_name].filter(Boolean).join(" ").trim() ||
    row.email?.trim() ||
    "Unnamed"
  );
}

/**
 * One coach's prospects and clients by name, business or email, then inbox
 * threads with no contact behind them (most LinkedIn chats). Every word must
 * match somewhere, so "Jason Dod" finds Jason Dodd.
 */
export async function searchCoachProspects(
  coachId: string,
  q: string
): Promise<SearchProspectItem[]> {
  const words = searchWords(q);
  if (words.length === 0) return [];

  let contacts = supabaseAdmin
    .from("contacts")
    .select("id, type, full_name, first_name, last_name, email, business_name, photo_url, prospect_status")
    .eq("coach_id", coachId);
  let threads = supabaseAdmin
    .from("messaging_conversations")
    .select("id, prospect_name, prospect_business_name, prospect_avatar_url, last_channel")
    .eq("coach_id", coachId)
    .is("contact_id", null)
    .is("hidden_at", null);
  for (const w of words) {
    contacts = contacts.or(
      `full_name.ilike.%${w}%,business_name.ilike.%${w}%,email.ilike.%${w}%`
    );
    threads = threads.or(
      `prospect_name.ilike.%${w}%,prospect_business_name.ilike.%${w}%`
    );
  }

  const [contactRes, threadRes] = await Promise.all([
    contacts.order("created_at", { ascending: false }).limit(LIMIT),
    threads.order("last_message_at", { ascending: false }).limit(LIMIT * 2),
  ]);
  if (contactRes.error) console.error("[search] prospects", contactRes.error);
  if (threadRes.error) console.error("[search] prospect threads", threadRes.error);

  const items: SearchProspectItem[] = (contactRes.data ?? []).map((row) => ({
    id: row.id as string,
    kind: row.type === "client" ? "client" : "prospect",
    name: contactName(row),
    business: (row.business_name as string | null) ?? null,
    avatar_url: (row.photo_url as string | null) ?? null,
    status: (row.prospect_status as string | null) ?? null,
    channel: null,
  }));

  // The same person can have several synced threads; show the latest once.
  const seen = new Set(items.map((i) => i.name.toLowerCase()));
  for (const row of threadRes.data ?? []) {
    if (items.length >= LIMIT) break;
    const name = (row.prospect_name as string | null)?.trim();
    if (!name || seen.has(name.toLowerCase())) continue;
    seen.add(name.toLowerCase());
    items.push({
      id: row.id as string,
      kind: "conversation",
      name,
      business: (row.prospect_business_name as string | null) ?? null,
      avatar_url: (row.prospect_avatar_url as string | null) ?? null,
      status: null,
      channel: (row.last_channel as string | null) ?? null,
    });
  }

  return items;
}
