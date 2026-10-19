import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { isDecisionMakerHeadline } from "@/lib/referrals/headline";
import { listUnipileRelations, type UnipileRelation } from "@/lib/unipile/client";
import { getOkLinkedInAccount } from "@/lib/unipile/outreachAccounts";

/**
 * Referral network (Inguro-style). We read a coach's LinkedIn connections,
 * the coach marks the ones who would recognise their name, and members whose
 * campaign lists include those people can see who could introduce them.
 * Admin only for now (Tools and links → Referrals); coaches cannot reach it.
 *
 * Reading connections is a list call on the coach's own account. Nothing is
 * posted or sent to LinkedIn from here.
 */

export type NetworkRating = "unknown" | "known";

export type DeckCard = {
  publicIdentifier: string;
  name: string;
  headline: string | null;
  profileUrl: string | null;
  photoUrl: string | null;
  connectedAt: string | null;
  decisionMaker: boolean;
  onOtherLists: number;
};

export type NetworkSummary = {
  linkedinConnected: boolean;
  syncedAt: string | null;
  total: number;
  known: number;
  unknown: number;
  unrated: number;
};

export type Introducer = {
  coachId: string;
  name: string;
  avatarUrl: string | null;
  people: Array<{
    publicIdentifier: string;
    name: string;
    headline: string | null;
    profileUrl: string | null;
    photoUrl: string | null;
    leadStatus: string | null;
  }>;
};

export type NetworkCoach = {
  coachId: string;
  name: string;
  /** Connections to rate (own campaign accepts left out). 0 = network not loaded. */
  total: number;
  known: number;
};

const PAGE_SIZE = 1000;
const MAX_PAGES = 40;
const PAGE_PAUSE_MS = 1500;
const UPSERT_CHUNK = 500;

function fullName(first: string | null, last: string | null): string {
  return [first, last].filter(Boolean).join(" ").trim() || "LinkedIn member";
}

async function ownCampaignIdentifiers(coachId: string): Promise<Set<string>> {
  const ids = new Set<string>();
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabaseAdmin
      .from("linkedin_campaign_leads")
      .select("pid:metadata->>public_identifier")
      .eq("coach_id", coachId)
      .range(from, from + 999);
    if (error) throw new Error(error.message);
    for (const row of (data ?? []) as Array<{ pid: string | null }>) {
      if (row.pid) ids.add(row.pid);
    }
    if (!data || data.length < 1000) break;
  }
  return ids;
}

function toRow(
  coachId: string,
  rel: UnipileRelation,
  ownCampaign: Set<string>,
  syncedAt: string
) {
  const pid = rel.public_identifier?.trim();
  if (!pid) return null;
  return {
    coach_id: coachId,
    public_identifier: pid,
    member_id: rel.member_id ?? null,
    first_name: rel.first_name ?? null,
    last_name: rel.last_name ?? null,
    headline: rel.headline ?? null,
    profile_url: rel.public_profile_url ?? `https://www.linkedin.com/in/${pid}/`,
    photo_url: rel.profile_picture_url ?? null,
    connected_at: rel.created_at ? new Date(rel.created_at).toISOString() : null,
    from_campaign: ownCampaign.has(pid),
    decision_maker: isDecisionMakerHeadline(rel.headline),
    synced_at: syncedAt,
  };
}

/**
 * Read every connection on the coach's LinkedIn and store it. Ratings are kept
 * (the upsert leaves them alone); people no longer connected are removed.
 */
export async function syncCoachNetwork(
  coachId: string
): Promise<{ ok: true; total: number } | { ok: false; error: string }> {
  const account = await getOkLinkedInAccount(coachId);
  const accountId = account?.unipile_account_id?.trim();
  if (!accountId) return { ok: false, error: "Connect LinkedIn first." };

  const syncedAt = new Date().toISOString();
  const ownCampaign = await ownCampaignIdentifiers(coachId);
  let cursor: string | null = null;
  let total = 0;

  for (let page = 0; page < MAX_PAGES; page++) {
    if (page > 0) await new Promise((r) => setTimeout(r, PAGE_PAUSE_MS));
    const res = await listUnipileRelations({ account_id: accountId, limit: PAGE_SIZE, cursor });
    if (!res.ok) return { ok: false, error: res.error || "Could not read LinkedIn connections." };

    const items = res.data?.items ?? [];
    const rows = items
      .map((rel) => toRow(coachId, rel, ownCampaign, syncedAt))
      .filter((row): row is NonNullable<typeof row> => row !== null);
    for (let i = 0; i < rows.length; i += UPSERT_CHUNK) {
      const { error } = await supabaseAdmin
        .from("coach_network_connections")
        .upsert(rows.slice(i, i + UPSERT_CHUNK), { onConflict: "coach_id,public_identifier" });
      if (error) return { ok: false, error: error.message };
    }
    total += rows.length;

    cursor = res.data?.cursor ?? null;
    if (!cursor || items.length === 0) break;
  }

  const { error: pruneError } = await supabaseAdmin
    .from("coach_network_connections")
    .delete()
    .eq("coach_id", coachId)
    .lt("synced_at", syncedAt);
  if (pruneError) return { ok: false, error: pruneError.message };

  return { ok: true, total };
}

async function countWhere(coachId: string, rating: NetworkRating | null | "any"): Promise<number> {
  let q = supabaseAdmin
    .from("coach_network_connections")
    .select("public_identifier", { count: "exact", head: true })
    .eq("coach_id", coachId)
    .eq("from_campaign", false);
  if (rating === null) q = q.is("rating", null);
  else if (rating !== "any") q = q.eq("rating", rating);
  const { count, error } = await q;
  if (error) throw new Error(error.message);
  return count ?? 0;
}

export async function loadNetworkSummary(coachId: string): Promise<NetworkSummary> {
  const [account, total, known, unknown, unrated, latest] = await Promise.all([
    getOkLinkedInAccount(coachId),
    countWhere(coachId, "any"),
    countWhere(coachId, "known"),
    countWhere(coachId, "unknown"),
    countWhere(coachId, null),
    supabaseAdmin
      .from("coach_network_connections")
      .select("synced_at")
      .eq("coach_id", coachId)
      .order("synced_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);
  return {
    linkedinConnected: Boolean(account),
    syncedAt: (latest.data?.synced_at as string | undefined) ?? null,
    total,
    known,
    unknown,
    unrated,
  };
}

export async function loadDeck(coachId: string, limit = 50): Promise<DeckCard[]> {
  const { data, error } = await supabaseAdmin.rpc("network_deck", {
    p_coach_id: coachId,
    p_limit: limit,
  });
  if (error) throw new Error(error.message);
  return ((data ?? []) as Array<Record<string, unknown>>).map((r) => ({
    publicIdentifier: r.public_identifier as string,
    name: fullName(r.first_name as string | null, r.last_name as string | null),
    headline: (r.headline as string | null) ?? null,
    profileUrl: (r.profile_url as string | null) ?? null,
    photoUrl: (r.photo_url as string | null) ?? null,
    connectedAt: (r.connected_at as string | null) ?? null,
    decisionMaker: Boolean(r.decision_maker),
    onOtherLists: Number(r.on_other_lists ?? 0),
  }));
}

/** `null` puts the person back in the pile (undo). */
export async function rateConnection(
  coachId: string,
  publicIdentifier: string,
  rating: NetworkRating | null
): Promise<boolean> {
  const { data, error } = await supabaseAdmin
    .from("coach_network_connections")
    .update({ rating, rated_at: rating ? new Date().toISOString() : null })
    .eq("coach_id", coachId)
    .eq("public_identifier", publicIdentifier)
    .select("public_identifier");
  if (error) throw new Error(error.message);
  return (data ?? []).length > 0;
}

/** Coaches an admin can open: anyone with a network loaded, then anyone with campaigns (to see their introducers). */
export async function loadNetworkCoaches(): Promise<NetworkCoach[]> {
  const [nets, camps] = await Promise.all([
    supabaseAdmin.rpc("referral_network_coaches"),
    supabaseAdmin.from("linkedin_campaigns").select("coach_id").range(0, 4999),
  ]);
  if (nets.error) throw new Error(nets.error.message);
  if (camps.error) throw new Error(camps.error.message);

  const counts = new Map<string, { total: number; known: number }>();
  for (const r of (nets.data ?? []) as Array<{ coach_id: string; total: number; known: number }>) {
    counts.set(r.coach_id, { total: r.total, known: r.known });
  }
  const ids = new Set<string>([...counts.keys(), ...(camps.data ?? []).map((c) => c.coach_id as string)]);
  if (!ids.size) return [];

  const { data: profiles, error } = await supabaseAdmin
    .from("profiles")
    .select("id, full_name")
    .in("id", [...ids]);
  if (error) throw new Error(error.message);

  return ((profiles ?? []) as Array<{ id: string; full_name: string | null }>)
    .map((p) => ({
      coachId: p.id,
      name: p.full_name?.trim() || "Unnamed coach",
      total: counts.get(p.id)?.total ?? 0,
      known: counts.get(p.id)?.known ?? 0,
    }))
    .sort((a, b) => Number(b.total > 0) - Number(a.total > 0) || a.name.localeCompare(b.name));
}

export async function loadIntroducers(coachId: string): Promise<Introducer[]> {
  const { data, error } = await supabaseAdmin.rpc("referral_introducers", {
    p_coach_id: coachId,
  });
  if (error) throw new Error(error.message);
  const byCoach = new Map<string, Introducer>();
  for (const r of (data ?? []) as Array<Record<string, unknown>>) {
    const id = r.introducer_id as string;
    const entry =
      byCoach.get(id) ??
      ({
        coachId: id,
        name: (r.introducer_name as string | null) || "A member",
        avatarUrl: (r.introducer_avatar as string | null) ?? null,
        people: [],
      } satisfies Introducer);
    entry.people.push({
      publicIdentifier: r.public_identifier as string,
      name: fullName(r.first_name as string | null, r.last_name as string | null),
      headline: (r.headline as string | null) ?? null,
      profileUrl: (r.profile_url as string | null) ?? null,
      photoUrl: (r.photo_url as string | null) ?? null,
      leadStatus: (r.lead_status as string | null) ?? null,
    });
    byCoach.set(id, entry);
  }
  return [...byCoach.values()].sort((a, b) => b.people.length - a.people.length);
}
