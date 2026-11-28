import { addCampaignPeopleToPool, type CampaignPersonForPool } from "@/lib/leadLists/audienceLists";
import { createDefaultPoolTableViewSettings } from "@/lib/pool/poolTableViews";
import { createPoolTableViewForOwner } from "@/lib/pool/poolTableViewsServer";
import { SMART_LIST_TEMPLATES } from "@/lib/pool/smartListRules";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

/**
 * Prospects set up at launch (job 320, 28 Nov): every coach gets the
 * ready-made smart lists (Connections, Connected owners, VIP, Referral) and
 * their LinkedIn connections imported once. Nothing is sent and nobody is
 * tagged. Safe to run again: it adds only what's missing.
 */

const MAX_CONNECTIONS = 10_000;

/** LinkedIn names can hold null bytes or half an emoji, which Postgres refuses. */
export function cleanText(value: string | null | undefined): string | null {
  if (value == null) return null;
  const out = value
    .replace(/\u0000/g, "")
    .replace(/[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/g, "")
    .trim();
  return out || null;
}

/** Cut to a length without splitting an emoji in half. */
function cut(text: string, max = 200): string {
  return Array.from(text).slice(0, max).join("");
}

/** "Managing Director at Acme Ltd" → title and company. */
export function splitHeadline(headline: string | null): { title: string | null; company: string | null } {
  const text = (headline ?? "").trim();
  if (!text) return { title: null, company: null };
  const first = text.split(/\s[|•·]\s/)[0]!.trim();
  const at = first.match(/^(.*?)\s+(?:at|@)\s+(.+)$/i);
  if (at) return { title: cut(at[1]!.trim()) || null, company: cut(at[2]!.trim()) || null };
  return { title: cut(first), company: null };
}

/** Make any ready-made smart list the coach doesn't have yet (by template, or the same name). */
export async function ensureTemplateSmartLists(coachId: string): Promise<string[]> {
  const { data, error } = await supabaseAdmin
    .from("prospect_table_views")
    .select("name, settings")
    .eq("owner_id", coachId)
    .eq("surface", "pool");
  if (error) throw new Error(error.message);
  const names = new Set((data ?? []).map((v) => String(v.name ?? "").trim().toLowerCase()));
  const templates = new Set(
    (data ?? []).map((v) => (v.settings as { smartTemplate?: unknown } | null)?.smartTemplate).filter((t): t is string => typeof t === "string")
  );
  const made: string[] = [];
  for (const t of SMART_LIST_TEMPLATES) {
    if (templates.has(t.key) || names.has(t.name.toLowerCase())) continue;
    await createPoolTableViewForOwner({
      ownerId: coachId,
      name: t.name,
      settings: { ...createDefaultPoolTableViewSettings(), smartRules: t.rules(), smartTemplate: t.key },
    });
    made.push(t.name);
  }
  return made;
}

/** Bring their LinkedIn connections (from the connections sync) into Prospects, once. */
export async function importConnectionsOnce(coachId: string): Promise<number | null> {
  const { data: coach } = await supabaseAdmin.from("coaches").select("connections_imported_at").eq("id", coachId).maybeSingle();
  if (coach?.connections_imported_at) return null;

  const people: CampaignPersonForPool[] = [];
  for (let from = 0; from < MAX_CONNECTIONS; from += 1000) {
    const { data, error } = await supabaseAdmin
      .from("coach_network_connections")
      .select("public_identifier, first_name, last_name, headline, profile_url")
      .eq("coach_id", coachId)
      .order("connected_at", { ascending: false })
      .range(from, from + 999);
    if (error) throw new Error(error.message);
    for (const row of data ?? []) {
      const url =
        (row.profile_url as string | null)?.trim() ||
        (row.public_identifier ? `https://www.linkedin.com/in/${row.public_identifier as string}/` : "");
      if (!url) continue;
      const { title, company } = splitHeadline(cleanText(row.headline as string | null));
      people.push({
        linkedin_url: cleanText(url) ?? url,
        first_name: cleanText(row.first_name as string | null),
        last_name: cleanText(row.last_name as string | null),
        title,
        company,
        contact_id: null,
      });
    }
    if (!data || data.length < 1000) break;
  }
  // Nothing synced yet (LinkedIn not connected, or the sync hasn't reached them): try again next time.
  if (!people.length) return 0;

  const { added } = await addCampaignPeopleToPool(coachId, people, { source: "connections", matchReason: "Your LinkedIn connection" });
  await supabaseAdmin.from("coaches").update({ connections_imported_at: new Date().toISOString() }).eq("id", coachId);
  return added;
}

export async function ensureProspectsSetup(coachId: string): Promise<{ lists: string[]; connectionsAdded: number | null }> {
  const lists = await ensureTemplateSmartLists(coachId);
  const connectionsAdded = await importConnectionsOnce(coachId);
  return { lists, connectionsAdded };
}
