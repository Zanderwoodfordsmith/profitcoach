import type {
  ChatOutcome,
  ChatReview,
  ChatWho,
  FixKind,
  MarkSource,
  MarkVerdict,
  ReviewChatRow,
  ReviewDigest,
  ReviewMark,
} from "@/lib/ava/chatReviewLabels";
import { isSystemCoachSlug } from "@/lib/primaryCoachConstants";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

import { loadChatActions } from "./actions";
import { APP_EVENT_TAG, WORKING_STATE_TAG, displayItems, loadChatForAdmin, type StoredMessage } from "./chatStore";
import { getCapability } from "./context";
import type { AgentDisplayItem, AgentMode } from "./types";

/**
 * Reading Ava's chats (job 225): every chat in one list for BCA, one chat
 * with its marks and the AI's read, and the marks themselves (BCA's Good /
 * Off with a note, or the coach's thumbs).
 */

type OverviewRow = {
  id: string;
  mode: AgentMode;
  actor_user_id: string;
  coach_id: string | null;
  title: string;
  created_at: string;
  updated_at: string;
  skills: string[] | null;
  person_turns: number;
  first_page: string | null;
};

type ReviewRow = {
  chat_id: string;
  turns: number;
  wanted: string;
  outcome: ChatOutcome;
  verdict: MarkVerdict;
  problems: string[];
  off_turns: number[];
  summary: string;
  fix: string | null;
  fix_kind: FixKind | null;
  reviewed_at: string;
};

const REVIEW_SELECT = "chat_id, turns, wanted, outcome, verdict, problems, off_turns, summary, fix, fix_kind, reviewed_at";

export async function chatOverview(limit = 500): Promise<OverviewRow[]> {
  const { data, error } = await supabaseAdmin.rpc("ava_chat_overview", { p_limit: limit });
  if (error) throw new Error(error.message);
  return (data ?? []) as OverviewRow[];
}

type Person = { name: string; avatarUrl: string | null; slug: string | null };

async function loadPeople(ids: string[]): Promise<Map<string, Person>> {
  const out = new Map<string, Person>();
  const unique = [...new Set(ids)];
  for (let i = 0; i < unique.length; i += 100) {
    const batch = unique.slice(i, i + 100);
    const [{ data: profiles, error }, { data: coaches }] = await Promise.all([
      supabaseAdmin.from("profiles").select("id, full_name, coach_business_name, avatar_url").in("id", batch),
      supabaseAdmin.from("coaches").select("id, slug").in("id", batch),
    ]);
    if (error) throw new Error(error.message);
    const slugs = new Map((coaches ?? []).map((c) => [c.id as string, (c.slug as string | null) ?? null]));
    for (const p of profiles ?? []) {
      out.set(p.id as string, {
        name: (p.full_name as string | null)?.trim() || (p.coach_business_name as string | null)?.trim() || "Unnamed",
        avatarUrl: (p.avatar_url as string | null) ?? null,
        slug: slugs.get(p.id as string) ?? null,
      });
    }
  }
  return out;
}

/** A coach chat from one of BCA's own accounts (Zander Demo, Pam's coach login) is a test. */
function whoHad(row: OverviewRow, people: Map<string, Person>): ChatWho {
  if (row.mode === "admin") return "bca";
  return isSystemCoachSlug(people.get(row.actor_user_id)?.slug) ? "test" : "coach";
}

function skillTitle(id: string, mode: AgentMode): string {
  return getCapability(id, mode)?.title ?? getCapability(id, mode === "admin" ? "coach" : "admin")?.title ?? id;
}

/** What each chat cost, from ai_usage (one row per turn). */
async function costByChat(since: string): Promise<Map<string, number>> {
  const out = new Map<string, number>();
  const pageSize = 1000;
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await supabaseAdmin
      .from("ai_usage")
      .select("chat_id, cost_usd")
      .eq("surface", "ava")
      .gte("created_at", since)
      .not("chat_id", "is", null)
      .order("created_at", { ascending: true })
      .range(from, from + pageSize - 1);
    if (error) throw new Error(error.message);
    for (const r of data ?? []) {
      const id = r.chat_id as string;
      out.set(id, (out.get(id) ?? 0) + (Number(r.cost_usd) || 0));
    }
    if (!data || data.length < pageSize) break;
  }
  return out;
}

async function allRows<T>(table: string, select: string): Promise<T[]> {
  const out: T[] = [];
  const pageSize = 1000;
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await supabaseAdmin
      .from(table)
      .select(select)
      .range(from, from + pageSize - 1);
    if (error) throw new Error(error.message);
    out.push(...((data ?? []) as T[]));
    if (!data || data.length < pageSize) break;
  }
  return out;
}

/** Every chat for the Chats list, newest first. */
export async function listReviewChats(): Promise<ReviewChatRow[]> {
  const rows = await chatOverview();
  if (!rows.length) return [];
  const oldest = rows.reduce((min, r) => (r.created_at < min ? r.created_at : min), rows[0]!.created_at);
  const [people, costs, actions, marks, reviews] = await Promise.all([
    loadPeople(rows.flatMap((r) => [r.actor_user_id, ...(r.coach_id ? [r.coach_id] : [])])),
    costByChat(oldest),
    allRows<{ chat_id: string | null; status: string }>("ai_agent_actions", "chat_id, status"),
    allRows<{ chat_id: string; source: MarkSource; verdict: MarkVerdict }>("ava_reply_marks", "chat_id, source, verdict"),
    allRows<ReviewRow>("ava_chat_reviews", REVIEW_SELECT),
  ]);

  const actionCount = new Map<string, ReviewChatRow["actions"]>();
  for (const a of actions) {
    if (!a.chat_id) continue;
    const c = actionCount.get(a.chat_id) ?? { done: 0, cancelled: 0, pending: 0 };
    if (a.status === "done") c.done += 1;
    else if (a.status === "cancelled") c.cancelled += 1;
    else if (a.status === "pending") c.pending += 1;
    actionCount.set(a.chat_id, c);
  }
  const markCount = new Map<string, { bca: { good: number; off: number }; coach: { good: number; off: number } }>();
  for (const m of marks) {
    const c = markCount.get(m.chat_id) ?? { bca: { good: 0, off: 0 }, coach: { good: 0, off: 0 } };
    c[m.source][m.verdict] += 1;
    markCount.set(m.chat_id, c);
  }
  const reviewBy = new Map(reviews.map((r) => [r.chat_id, r]));

  return rows.map((row) => {
    const coachId = row.mode === "coach" ? row.actor_user_id : row.coach_id;
    const coach = coachId ? people.get(coachId) : null;
    const review = reviewBy.get(row.id);
    const m = markCount.get(row.id);
    return {
      id: row.id,
      who: whoHad(row, people),
      title: row.title,
      coach: coachId && coach ? { id: coachId, name: coach.name, avatarUrl: coach.avatarUrl } : null,
      person: { id: row.actor_user_id, name: people.get(row.actor_user_id)?.name ?? "Unknown" },
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      skills: (row.skills ?? []).map((id) => skillTitle(id, row.mode)),
      turns: row.person_turns,
      firstPage: row.first_page,
      costUsd: Number((costs.get(row.id) ?? 0).toFixed(4)),
      actions: actionCount.get(row.id) ?? { done: 0, cancelled: 0, pending: 0 },
      bca: m?.bca ?? { good: 0, off: 0 },
      coachThumbs: m?.coach ?? { good: 0, off: 0 },
      review: review
        ? {
            outcome: review.outcome,
            verdict: review.verdict,
            problems: review.problems ?? [],
            stale: review.turns < row.person_turns,
          }
        : null,
    };
  });
}

function reviewView(r: ReviewRow): ChatReview {
  return {
    turns: r.turns,
    wanted: r.wanted,
    outcome: r.outcome,
    verdict: r.verdict,
    problems: r.problems ?? [],
    offTurns: r.off_turns ?? [],
    summary: r.summary,
    fix: r.fix,
    fixKind: r.fix_kind,
    reviewedAt: r.reviewed_at,
  };
}

/** The page the person had open for each of their messages (turn 1, 2, …), from the working state Ava was given. */
export function pagesByTurn(messages: StoredMessage[]): Record<number, string> {
  const out: Record<number, string> = {};
  let turn = 0;
  for (const m of messages) {
    if (m.role !== "user" || !Array.isArray(m.content)) continue;
    const blocks = m.content as Array<{ type?: string; text?: string }>;
    const texts = blocks.filter((b) => b.type === "text").map((b) => b.text ?? "");
    const typed = texts.some((t) => !t.startsWith(`<${WORKING_STATE_TAG}>`) && !t.startsWith(`<${APP_EVENT_TAG}>`));
    if (!typed) continue;
    turn += 1;
    const state = texts.find((t) => t.startsWith(`<${WORKING_STATE_TAG}>`));
    const page = state?.match(/Page open: ([^\n]+)/)?.[1]?.trim();
    if (page && page !== "unknown") out[turn] = page;
  }
  return out;
}

export type ReviewChatDetail = {
  id: string;
  title: string;
  mode: AgentMode;
  who: ChatWho;
  coach: { id: string; name: string; slug: string | null } | null;
  person: { id: string; name: string };
  createdAt: string;
  updatedAt: string;
  items: AgentDisplayItem[];
  pages: Record<number, string>;
  marks: ReviewMark[];
  review: ChatReview | null;
  costUsd: number;
};

/** One chat as the reader shows it: everything Ava did, the page per message, marks and the AI's read. */
export async function loadReviewChat(chatId: string): Promise<ReviewChatDetail | null> {
  const chat = await loadChatForAdmin(chatId);
  if (!chat) return null;
  const coachId = chat.mode === "coach" ? chat.actor_user_id : chat.coach_id;
  const [actions, people, marks, review, usage] = await Promise.all([
    loadChatActions(chat.id),
    loadPeople([chat.actor_user_id, ...(coachId ? [coachId] : [])]),
    loadMarks(chat.id),
    supabaseAdmin.from("ava_chat_reviews").select(REVIEW_SELECT).eq("chat_id", chat.id).maybeSingle(),
    supabaseAdmin.from("ai_usage").select("cost_usd").eq("chat_id", chat.id),
  ]);
  const coach = coachId ? people.get(coachId) : null;
  const actor = people.get(chat.actor_user_id);
  const who: ChatWho = chat.mode === "admin" ? "bca" : isSystemCoachSlug(actor?.slug) ? "test" : "coach";
  const { data: created } = await supabaseAdmin.from("ai_agent_chats").select("created_at").eq("id", chat.id).maybeSingle();
  return {
    id: chat.id,
    title: chat.title,
    mode: chat.mode,
    who,
    coach: coachId && coach ? { id: coachId, name: coach.name, slug: coach.slug } : null,
    person: { id: chat.actor_user_id, name: actor?.name ?? "Unknown" },
    createdAt: (created?.created_at as string | undefined) ?? chat.updated_at,
    updatedAt: chat.updated_at,
    items: displayItems(chat.api_messages, chat.mode, actions),
    pages: pagesByTurn(chat.api_messages),
    marks,
    review: review.data ? reviewView(review.data as ReviewRow) : null,
    costUsd: Number(((usage.data ?? []).reduce((sum, r) => sum + (Number(r.cost_usd) || 0), 0)).toFixed(4)),
  };
}

export async function loadMarks(chatId: string, source?: MarkSource): Promise<ReviewMark[]> {
  let query = supabaseAdmin
    .from("ava_reply_marks")
    .select("turn, source, verdict, fix, note, marked_by, updated_at")
    .eq("chat_id", chatId)
    .order("turn", { ascending: true });
  if (source) query = query.eq("source", source);
  const { data, error } = await query;
  if (error) throw new Error(error.message);
  const rows = data ?? [];
  const names = await loadPeople(rows.map((r) => r.marked_by as string | null).filter((id): id is string => Boolean(id)));
  return rows.map((r) => ({
    turn: r.turn as number,
    source: r.source as MarkSource,
    verdict: r.verdict as MarkVerdict,
    fix: (r.fix as FixKind | null) ?? null,
    note: (r.note as string | null) ?? null,
    by: r.marked_by ? (names.get(r.marked_by as string)?.name ?? null) : null,
    updatedAt: r.updated_at as string,
  }));
}

/** Mark one reply, or clear the mark (verdict null). One mark per reply per side; the latest wins. */
export async function saveMark(opts: {
  chatId: string;
  turn: number;
  source: MarkSource;
  verdict: MarkVerdict | null;
  fix?: FixKind | null;
  note?: string | null;
  userId: string;
}): Promise<void> {
  if (opts.verdict === null) {
    const { error } = await supabaseAdmin
      .from("ava_reply_marks")
      .delete()
      .eq("chat_id", opts.chatId)
      .eq("turn", opts.turn)
      .eq("source", opts.source);
    if (error) throw new Error(error.message);
    return;
  }
  const note = opts.note?.trim().slice(0, 2000) || null;
  const { error } = await supabaseAdmin.from("ava_reply_marks").upsert(
    {
      chat_id: opts.chatId,
      turn: opts.turn,
      source: opts.source,
      verdict: opts.verdict,
      // A Good reply needs no fix.
      fix: opts.verdict === "off" ? (opts.fix ?? null) : null,
      note,
      marked_by: opts.userId,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "chat_id,turn,source" }
  );
  if (error) throw new Error(error.message);
}

/**
 * How often the AI's read matches BCA's marks, over chats that have both.
 * BCA's call on a chat is Off if any reply is marked Off, else Good.
 */
export function agreement(rows: ReviewChatRow[]): { compared: number; agreed: number } {
  let compared = 0;
  let agreed = 0;
  for (const row of rows) {
    if (!row.review || row.review.stale || row.bca.good + row.bca.off === 0) continue;
    compared += 1;
    const bca: MarkVerdict = row.bca.off > 0 ? "off" : "good";
    if (bca === row.review.verdict) agreed += 1;
  }
  return { compared, agreed };
}

export async function latestDigest(): Promise<ReviewDigest | null> {
  const { data, error } = await supabaseAdmin
    .from("ava_review_digests")
    .select("id, created_at, chats, items")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return null;
  return {
    id: data.id as string,
    createdAt: data.created_at as string,
    chats: data.chats as number,
    items: (data.items as ReviewDigest["items"]) ?? [],
  };
}
