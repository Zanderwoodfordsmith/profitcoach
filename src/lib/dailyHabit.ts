import { supabaseAdmin } from "@/lib/supabaseAdmin";

/**
 * The 1-10-10 daily habit (Matt Lakajev's keystone habit): each weekday,
 * 1 LinkedIn post, 10 comments on other people's posts, 10 real conversations.
 *
 * Counted, not guessed:
 * - posts: published through the app today, plus any the coach logs by hand
 * - conversations: LinkedIn threads where the coach wrote today in reply to the
 *   prospect, plus intent-signal openers marked as sent today. Automated
 *   campaign steps do not count.
 * - comments: logged by the coach (LinkedIn does not expose them to us)
 */

export const HABIT_TARGETS = { posts: 1, comments: 10, conversations: 10 } as const;

export type HabitDay = {
  day: string;
  posts: number;
  comments: number;
  conversations: number;
  postsLogged: number;
};

/** Calendar day in the coach's time zone, YYYY-MM-DD. */
export function dayInZone(date: Date, timeZone: string): string {
  try {
    return new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(date);
  } catch {
    return date.toISOString().slice(0, 10);
  }
}

async function coachZone(coachId: string): Promise<string> {
  const { data } = await supabaseAdmin.from("profiles").select("timezone").eq("id", coachId).maybeSingle();
  return (typeof data?.timezone === "string" && data.timezone.trim()) || "Europe/London";
}

export async function loadHabitWeek(coachId: string): Promise<{ today: string; days: HabitDay[] }> {
  const zone = await coachZone(coachId);
  const now = new Date();
  const days: string[] = [];
  for (let i = 6; i >= 0; i -= 1) days.push(dayInZone(new Date(now.getTime() - i * 86400000), zone));
  const today = days[days.length - 1];
  const since = new Date(now.getTime() - 8 * 86400000).toISOString();

  const [{ data: logged }, { data: posts }, { data: outbound }, { data: openers }] = await Promise.all([
    supabaseAdmin.from("coach_daily_habits").select("day, comments_logged, posts_logged").eq("coach_id", coachId).in("day", days),
    supabaseAdmin
      .from("linkedin_scheduled_posts")
      .select("published_at")
      .eq("user_id", coachId)
      .eq("status", "published")
      .gte("published_at", since),
    supabaseAdmin
      .from("messaging_messages")
      .select("conversation_id, created_at")
      .eq("coach_id", coachId)
      .eq("channel", "linkedin")
      .eq("direction", "outbound")
      .gte("created_at", since)
      .limit(2000),
    supabaseAdmin
      .from("coach_intent_signals")
      .select("updated_at")
      .eq("coach_id", coachId)
      .eq("status", "messaged")
      .gte("updated_at", since),
  ]);

  // An outbound counts as a conversation only if the prospect wrote first in that thread.
  const convIds = [...new Set((outbound ?? []).map((m) => m.conversation_id as string))];
  const firstInbound = new Map<string, string>();
  for (let i = 0; i < convIds.length; i += 200) {
    const { data } = await supabaseAdmin
      .from("messaging_messages")
      .select("conversation_id, created_at")
      .in("conversation_id", convIds.slice(i, i + 200))
      .eq("direction", "inbound")
      .order("created_at", { ascending: true });
    for (const row of data ?? []) {
      const id = row.conversation_id as string;
      if (!firstInbound.has(id)) firstInbound.set(id, row.created_at as string);
    }
  }
  const convByDay = new Map<string, Set<string>>();
  for (const m of outbound ?? []) {
    const first = firstInbound.get(m.conversation_id as string);
    if (!first || first > (m.created_at as string)) continue;
    const d = dayInZone(new Date(m.created_at as string), zone);
    const set = convByDay.get(d) ?? new Set<string>();
    set.add(m.conversation_id as string);
    convByDay.set(d, set);
  }
  const openerByDay = new Map<string, number>();
  for (const o of openers ?? []) {
    const d = dayInZone(new Date(o.updated_at as string), zone);
    openerByDay.set(d, (openerByDay.get(d) ?? 0) + 1);
  }
  const postByDay = new Map<string, number>();
  for (const p of posts ?? []) {
    if (!p.published_at) continue;
    const d = dayInZone(new Date(p.published_at as string), zone);
    postByDay.set(d, (postByDay.get(d) ?? 0) + 1);
  }
  const logByDay = new Map((logged ?? []).map((r) => [r.day as string, r]));

  return {
    today,
    days: days.map((day) => {
      const log = logByDay.get(day);
      const postsLogged = Number(log?.posts_logged ?? 0);
      return {
        day,
        posts: (postByDay.get(day) ?? 0) + postsLogged,
        postsLogged,
        comments: Number(log?.comments_logged ?? 0),
        conversations: (convByDay.get(day)?.size ?? 0) + (openerByDay.get(day) ?? 0),
      };
    }),
  };
}

/** Add (or remove) manually logged comments or posts for today. */
export async function logHabit(coachId: string, field: "comments" | "posts", delta: number): Promise<void> {
  const zone = await coachZone(coachId);
  const day = dayInZone(new Date(), zone);
  const column = field === "comments" ? "comments_logged" : "posts_logged";
  const { data } = await supabaseAdmin
    .from("coach_daily_habits")
    .select("comments_logged, posts_logged")
    .eq("coach_id", coachId)
    .eq("day", day)
    .maybeSingle();
  const current = Number((data as Record<string, unknown> | null)?.[column] ?? 0);
  const next = Math.max(0, Math.min(field === "comments" ? 500 : 50, current + Math.round(delta)));
  const { error } = await supabaseAdmin
    .from("coach_daily_habits")
    .upsert({ coach_id: coachId, day, [column]: next, updated_at: new Date().toISOString() }, { onConflict: "coach_id,day" });
  if (error) throw new Error(error.message);
}
