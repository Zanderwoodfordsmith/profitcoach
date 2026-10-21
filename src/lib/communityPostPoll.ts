import { supabaseClient } from "@/lib/supabaseClient";
import { getSessionUser } from "@/lib/supabaseAccessToken";

export const COMMUNITY_POLL_MIN_OPTIONS = 2;
export const COMMUNITY_POLL_MAX_OPTIONS = 10;
export const COMMUNITY_POLL_OPTION_MAX_LENGTH = 120;

export type CommunityPostPoll = {
  kind: "poll";
  options: { id: string; text: string }[];
};

export type CommunityPostPollTally = {
  /** Votes per option id. */
  counts: Record<string, number>;
  total: number;
  /** Signed-in user's option id, or null if they have not voted. */
  myOptionId: string | null;
};

/** Reads `community_posts.poll` defensively; null when missing or malformed. */
export function normalizeCommunityPostPoll(raw: unknown): CommunityPostPoll | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as { kind?: unknown; options?: unknown };
  if (r.kind !== "poll" || !Array.isArray(r.options)) return null;
  const options = r.options
    .filter(
      (o): o is { id: string; text: string } =>
        Boolean(o) &&
        typeof (o as { id?: unknown }).id === "string" &&
        typeof (o as { text?: unknown }).text === "string"
    )
    .map((o) => ({ id: o.id, text: o.text }));
  if (options.length < COMMUNITY_POLL_MIN_OPTIONS) return null;
  return { kind: "poll", options };
}

/**
 * Builds the poll payload from composer drafts. Blank options are dropped.
 * Returns an error string when the poll is not valid.
 */
export function buildCommunityPostPoll(
  drafts: string[]
): CommunityPostPoll | { error: string } {
  const texts = drafts.map((t) => t.trim()).filter((t) => t.length > 0);
  if (texts.length < COMMUNITY_POLL_MIN_OPTIONS) {
    return { error: "A poll needs at least two options." };
  }
  if (texts.length > COMMUNITY_POLL_MAX_OPTIONS) {
    return { error: `A poll can have up to ${COMMUNITY_POLL_MAX_OPTIONS} options.` };
  }
  const seen = new Set<string>();
  for (const t of texts) {
    const key = t.toLowerCase();
    if (seen.has(key)) return { error: "Each poll option must be different." };
    seen.add(key);
  }
  return {
    kind: "poll",
    options: texts.map((text) => ({
      id: crypto.randomUUID(),
      text: text.slice(0, COMMUNITY_POLL_OPTION_MAX_LENGTH),
    })),
  };
}

export async function fetchCommunityPostPollTally(
  postId: string
): Promise<CommunityPostPollTally> {
  const [user, res] = await Promise.all([
    getSessionUser(),
    supabaseClient
      .from("community_post_poll_votes")
      .select("voter_id, option_id")
      .eq("post_id", postId),
  ]);
  if (res.error) throw res.error;
  const counts: Record<string, number> = {};
  let myOptionId: string | null = null;
  const rows = (res.data ?? []) as { voter_id: string; option_id: string }[];
  for (const r of rows) {
    counts[r.option_id] = (counts[r.option_id] ?? 0) + 1;
    if (user && r.voter_id === user.id) myOptionId = r.option_id;
  }
  return { counts, total: rows.length, myOptionId };
}

/** Casts or changes the signed-in user's vote (one vote per person per poll). */
export async function castCommunityPostPollVote(
  postId: string,
  optionId: string
): Promise<void> {
  const user = await getSessionUser();
  if (!user) throw new Error("Not signed in.");
  const { error } = await supabaseClient
    .from("community_post_poll_votes")
    .upsert(
      {
        post_id: postId,
        voter_id: user.id,
        option_id: optionId,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "post_id,voter_id" }
    );
  if (error) throw error;
}

export async function removeCommunityPostPollVote(postId: string): Promise<void> {
  const user = await getSessionUser();
  if (!user) throw new Error("Not signed in.");
  const { error } = await supabaseClient
    .from("community_post_poll_votes")
    .delete()
    .eq("post_id", postId)
    .eq("voter_id", user.id);
  if (error) throw error;
}
