import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { getOkLinkedInAccount } from "@/lib/unipile/outreachAccounts";
import {
  getUnipileOwnProfile,
  listReceivedInvitations,
  listUnipilePostComments,
  listUnipilePostReactions,
  listUnipileUserPosts,
} from "@/lib/unipile/client";

/**
 * Intent signals (Matt Lakajev's "intent leads"): people who showed interest
 * without being messaged. They commented on or reacted to the coach's recent
 * posts, or sent the coach a connection request. Each gets a short opener about
 * the thing they did. Nothing is sent from here; the coach sends.
 *
 * LinkedIn profile viewers are not available through Unipile, so they are not
 * collected (the coach can still see them on LinkedIn).
 */

export type IntentKind = "post_comment" | "post_reaction" | "invite_received";

type Signal = {
  kind: IntentKind;
  provider_id: string;
  name: string | null;
  headline: string | null;
  profile_url: string | null;
  context: string | null;
  signal_at: string | null;
};

const POSTS_TO_SCAN = 5;
const MAX_AGE_DAYS = 21;

function str(v: unknown): string | null {
  return typeof v === "string" && v.trim() ? v.trim() : null;
}

function obj(v: unknown): Record<string, unknown> {
  return v && typeof v === "object" ? (v as Record<string, unknown>) : {};
}

function firstName(name: string | null): string {
  return (name || "").split(/\s+/)[0] || "there";
}

function postSnippet(post: Record<string, unknown>): string {
  const text = str(post.text) || "";
  const firstLine = text.split("\n").find((l) => l.trim()) || text;
  return firstLine.length > 70 ? `${firstLine.slice(0, 67).trim()}...` : firstLine;
}

/** Plain, short openers about what they did. Coaches edit before sending. */
export function openerFor(signal: Pick<Signal, "kind" | "name" | "context">): string {
  const hi = `Hi ${firstName(signal.name)}`;
  const topic = signal.context ? `"${signal.context}"` : "my recent post";
  switch (signal.kind) {
    case "post_comment":
      return `${hi}, thanks for commenting on ${topic}. Is that something you're working on in your own business at the moment?`;
    case "post_reaction":
      return `${hi}, saw you liked ${topic}. Curious, is that a live issue for you right now or more of a "one day"?`;
    case "invite_received":
      return `${hi}, thanks for connecting. What made you reach out? Always keen to know what people are working on.`;
  }
}

function personFrom(raw: Record<string, unknown>): { id: string | null; name: string | null; headline: string | null; url: string | null } {
  const a = obj(raw.author_details ?? raw.author ?? raw.inviter ?? raw.sender ?? raw);
  const id =
    str(a.id) || str(a.provider_id) || str(a.inviter_id) || str(a.member_id) || str(a.public_identifier) || str(a.inviter_public_identifier);
  const name =
    str(a.name) ||
    str(a.inviter_name) ||
    [str(a.first_name), str(a.last_name)].filter(Boolean).join(" ") ||
    null;
  const headline = str(a.headline) || str(a.inviter_description) || str(a.occupation);
  const pub = str(a.public_identifier) || str(a.inviter_public_identifier);
  const url = str(a.profile_url) || (pub ? `https://www.linkedin.com/in/${pub}` : null);
  return { id, name, headline, url };
}

function dateOf(raw: Record<string, unknown>): string | null {
  const v = str(raw.parsed_datetime) || str(raw.date) || str(raw.created_at) || str(raw.sent_at);
  if (!v) return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

/** Opening Today re-checks LinkedIn at most this often (the button can force it). */
const REFRESH_EVERY_MS = 15 * 60 * 1000;

/** Pull fresh signals from LinkedIn for one coach and store new ones. */
export async function refreshIntentSignals(
  coachId: string,
  options?: { force?: boolean }
): Promise<{ added: number; error: string | null }> {
  const account = await getOkLinkedInAccount(coachId);
  const accountId = account?.unipile_account_id?.trim();
  if (!accountId) return { added: 0, error: "Connect LinkedIn in Settings first." };

  const { data: stamp } = await supabaseAdmin
    .from("linkedin_outreach_accounts")
    .select("id, intent_signals_refreshed_at")
    .eq("coach_id", coachId)
    .eq("unipile_account_id", accountId)
    .limit(1)
    .maybeSingle();
  const last = stamp?.intent_signals_refreshed_at ? new Date(stamp.intent_signals_refreshed_at as string).getTime() : 0;
  if (!options?.force && Date.now() - last < REFRESH_EVERY_MS) return { added: 0, error: null };
  if (stamp?.id) {
    await supabaseAdmin
      .from("linkedin_outreach_accounts")
      .update({ intent_signals_refreshed_at: new Date().toISOString() })
      .eq("id", stamp.id);
  }

  const me = await getUnipileOwnProfile(accountId);
  const myId = str(obj(me.data).provider_id) || str(obj(me.data).public_identifier);
  const signals: Signal[] = [];
  const cutoff = Date.now() - MAX_AGE_DAYS * 86400000;

  if (myId) {
    const posts = await listUnipileUserPosts({ identifier: myId, account_id: accountId, limit: POSTS_TO_SCAN });
    for (const post of (posts.ok ? posts.data?.items ?? [] : []).slice(0, POSTS_TO_SCAN)) {
      const postId = str(post.social_id) || str(post.id);
      if (!postId) continue;
      const context = postSnippet(post) || null;
      const [comments, reactions] = await Promise.all([
        listUnipilePostComments({ post_id: postId, account_id: accountId, limit: 50 }),
        listUnipilePostReactions({ post_id: postId, account_id: accountId, limit: 50 }),
      ]);
      for (const c of comments.ok ? comments.data?.items ?? [] : []) {
        const p = personFrom(c);
        if (!p.id || p.id === myId) continue;
        signals.push({ kind: "post_comment", provider_id: p.id, name: p.name, headline: p.headline, profile_url: p.url, context, signal_at: dateOf(c) });
      }
      for (const r of reactions.ok ? reactions.data?.items ?? [] : []) {
        const p = personFrom(r);
        if (!p.id || p.id === myId) continue;
        signals.push({ kind: "post_reaction", provider_id: p.id, name: p.name, headline: p.headline, profile_url: p.url, context, signal_at: dateOf(r) ?? dateOf(post) });
      }
    }
  }

  const invites = await listReceivedInvitations({ account_id: accountId, limit: 100 });
  for (const inv of invites.ok ? invites.data?.items ?? [] : []) {
    const p = personFrom(inv);
    if (!p.id) continue;
    signals.push({
      kind: "invite_received",
      provider_id: p.id,
      name: p.name,
      headline: p.headline,
      profile_url: p.url,
      context: str(inv.invitation_text) || str(inv.message),
      signal_at: dateOf(inv),
    });
  }

  const fresh = signals.filter((s) => !s.signal_at || new Date(s.signal_at).getTime() >= cutoff);
  // A comment beats a reaction for the same person.
  const best = new Map<string, Signal>();
  const rank: Record<IntentKind, number> = { invite_received: 3, post_comment: 2, post_reaction: 1 };
  for (const s of fresh) {
    const prev = best.get(s.provider_id);
    if (!prev || rank[s.kind] > rank[prev.kind]) best.set(s.provider_id, s);
  }
  if (!best.size) return { added: 0, error: null };

  const rows = [...best.values()].map((s) => ({
    coach_id: coachId,
    kind: s.kind,
    provider_id: s.provider_id,
    name: s.name,
    headline: s.headline,
    profile_url: s.profile_url,
    context: s.context,
    signal_at: s.signal_at,
    opener: openerFor(s),
  }));
  const { data, error } = await supabaseAdmin
    .from("coach_intent_signals")
    .upsert(rows, { onConflict: "coach_id,kind,provider_id", ignoreDuplicates: true })
    .select("id");
  if (error) return { added: 0, error: "Could not save signals." };
  return { added: data?.length ?? 0, error: null };
}

export async function listIntentSignals(coachId: string) {
  const { data, error } = await supabaseAdmin
    .from("coach_intent_signals")
    .select("id, kind, name, headline, profile_url, context, signal_at, opener, status, created_at")
    .eq("coach_id", coachId)
    .eq("status", "new")
    .order("signal_at", { ascending: false, nullsFirst: false })
    .limit(100);
  if (error) throw new Error(error.message);
  return data ?? [];
}
