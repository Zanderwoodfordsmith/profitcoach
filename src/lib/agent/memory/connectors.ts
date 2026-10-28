import { displayItems, type AgentChatRow } from "@/lib/agent/chatStore";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

import {
  getWatermark,
  RAW_CHUNK,
  removeItems,
  replaceItems,
  saveState,
  type MemoryItem,
  type MemoryNotes,
  type MemorySource,
} from "./store";
import { writeNotes } from "./summarize";

/**
 * One connector per source. Each takes only what changed since its watermark
 * (a timestamp and row id, so rows sharing a timestamp are never skipped),
 * dates every item, keeps a link to the original, and replaces the item's old
 * rows, so running twice changes nothing.
 */

export type NotesBudget = { left: number; costUsd: number };

export type ConnectorResult = {
  source: MemorySource;
  items: number;
  notes: number;
  costUsd: number;
  /** More is waiting: run again. */
  more: boolean;
};

type Mark = { ts: string; id: string };

function parseMark(raw: string | null): Mark | null {
  if (!raw) return null;
  const at = raw.lastIndexOf("|");
  return at > 0 ? { ts: raw.slice(0, at), id: raw.slice(at + 1) } : null;
}

/** Rows after the watermark, oldest first. */
async function rowsAfter<T extends { id: string }>(opts: {
  table: string;
  select: string;
  tsColumn: string;
  mark: Mark | null;
  limit: number;
  /** Columns that must be set. */
  notNull?: string[];
  /** Only rows with tsColumn before this (e.g. chats still in use are left for later). */
  before?: string;
}): Promise<T[]> {
  let query = supabaseAdmin
    .from(opts.table)
    .select(opts.select)
    .order(opts.tsColumn, { ascending: true })
    .order("id", { ascending: true })
    .limit(opts.limit);
  if (opts.mark) {
    const ts = `"${opts.mark.ts}"`;
    query = query.or(`${opts.tsColumn}.gt.${ts},and(${opts.tsColumn}.eq.${ts},id.gt.${opts.mark.id})`);
  }
  for (const column of opts.notNull ?? []) query = query.not(column, "is", null);
  if (opts.before) query = query.lt(opts.tsColumn, opts.before);
  const { data, error } = await query;
  if (error) throw new Error(`${opts.table}: ${error.message}`);
  return (data ?? []) as unknown as T[];
}

/** Long items get Haiku notes while the budget lasts. Null means stop here and come back next run. */
async function notesFor(
  budget: NotesBudget,
  what: string,
  title: string,
  text: string
): Promise<{ notes: MemoryNotes | null; made: boolean } | null> {
  if (text.length <= RAW_CHUNK) return { notes: null, made: false };
  if (budget.left <= 0) return null;
  budget.left -= 1;
  const result = await writeNotes(what, title, text);
  budget.costUsd += result.costUsd;
  return { notes: result.notes, made: true };
}

/** Plain transcript of an Ava chat: what was said, and what Ava did. */
export function chatText(row: Pick<AgentChatRow, "api_messages" | "mode">): string {
  const who = row.mode === "coach" ? "Coach" : "BCA";
  const lines: string[] = [];
  for (const item of displayItems(row.api_messages, row.mode, new Map())) {
    if (item.type === "user") lines.push(`${who}: ${item.text}`);
    else if (item.type === "assistant") lines.push(`Ava: ${item.text}`);
    else if (item.type === "tool" && item.ok && item.note) lines.push(`[Ava did: ${item.note}]`);
  }
  return lines.join("\n\n");
}

/** Generic run: fetch, turn rows into items (with notes), save, move the watermark. */
async function runConnector<T extends { id: string }>(opts: {
  source: MemorySource;
  budget: NotesBudget;
  /** Haiku notes for long items. Off for the coach's own writing, which keyword search finds as it is. */
  notes?: boolean;
  fetch: (mark: Mark | null) => Promise<T[]>;
  batch: number;
  tsOf: (row: T) => string;
  toItem: (row: T) => { item: Omit<MemoryItem, "notes">; what: string } | null;
}): Promise<ConnectorResult> {
  const mark = parseMark(await getWatermark(opts.source));
  const rows = await opts.fetch(mark);
  const items: MemoryItem[] = [];
  const empty: string[] = [];
  let last: T | null = null;
  let notes = 0;
  let stopped = false;
  const costBefore = opts.budget.costUsd;
  for (const row of rows) {
    const built = opts.toItem(row);
    if (!built) {
      empty.push(row.id);
      last = row;
      continue;
    }
    const made =
      opts.notes === false
        ? { notes: null, made: false }
        : await notesFor(opts.budget, built.what, built.item.title, built.item.text);
    if (!made) {
      stopped = true;
      break;
    }
    if (made.made) notes += 1;
    items.push({ ...built.item, notes: made.notes });
    last = row;
  }
  await replaceItems(opts.source, items);
  await removeItems(opts.source, empty);
  await saveState(opts.source, last ? { watermark: `${opts.tsOf(last)}|${last.id}` } : {});
  return {
    source: opts.source,
    items: items.length,
    notes,
    costUsd: opts.budget.costUsd - costBefore,
    more: stopped || rows.length === opts.batch,
  };
}

const day = (ts: string | null | undefined) => (ts ? String(ts).slice(0, 10) : "");

/** Ava chats about a coach, once they have been quiet for 15 minutes. */
export function ingestAvaChats(budget: NotesBudget): Promise<ConnectorResult> {
  type ChatRow = Pick<AgentChatRow, "id" | "mode" | "coach_id" | "title" | "api_messages" | "updated_at">;
  const batch = 25;
  return runConnector<ChatRow>({
    source: "ava_chat",
    budget,
    batch,
    fetch: (mark) =>
      rowsAfter<ChatRow>({
        table: "ai_agent_chats",
        select: "id, mode, coach_id, title, api_messages, updated_at",
        tsColumn: "updated_at",
        mark,
        limit: batch,
        notNull: ["coach_id"],
        before: new Date(Date.now() - 15 * 60_000).toISOString(),
      }),
    tsOf: (row) => row.updated_at,
    toItem: (row) => {
      const text = chatText(row);
      if (!row.coach_id || text.length < 80) return null;
      return {
        what: row.mode === "coach" ? "A coach's chat with Ava, BCA's AI assistant" : "A BCA admin's chat with Ava about a coach",
        item: {
          coachId: row.coach_id,
          // BCA's own chats about a coach stay with BCA.
          audience: row.mode === "coach" ? "coach" : "admin",
          source: "ava_chat",
          sourceId: row.id,
          ts: row.updated_at,
          title: `Ava chat: ${row.title}`,
          text,
          metadata: { mode: row.mode },
        },
      };
    },
  });
}

/** BCA's sales call with the coach before they joined (Practice Blueprint source). BCA only. */
export function ingestSalesCalls(budget: NotesBudget): Promise<ConnectorResult> {
  type Row = { id: string; coach_id: string; title: string; called_at: string | null; body: string; ingested_at: string };
  const batch = 20;
  return runConnector<Row>({
    source: "sales_call",
    budget,
    batch,
    fetch: (mark) =>
      rowsAfter<Row>({
        table: "practice_source_transcripts",
        select: "id, coach_id, title, called_at, body, ingested_at",
        tsColumn: "ingested_at",
        mark,
        limit: batch,
      }),
    tsOf: (row) => row.ingested_at,
    toItem: (row) =>
      row.body.trim()
        ? {
            what: "Transcript of BCA's sales call with this coach before they joined",
            item: {
              coachId: row.coach_id,
              audience: "admin",
              source: "sales_call",
              sourceId: row.id,
              ts: row.called_at ?? row.ingested_at,
              title: row.title || `BCA sales call ${day(row.called_at)}`,
              text: row.body,
            },
          }
        : null,
  });
}

/** The coach's own Zoom calls with prospects and clients (from bookings). */
export function ingestZoomCalls(budget: NotesBudget): Promise<ConnectorResult> {
  type Row = {
    id: string;
    coach_id: string;
    kind: string | null;
    prospect_name: string | null;
    starts_at: string;
    updated_at: string;
    zoom_transcript_text: string | null;
  };
  const batch = 20;
  return runConnector<Row>({
    source: "zoom_call",
    budget,
    batch,
    fetch: (mark) =>
      rowsAfter<Row>({
        table: "bookings",
        select: "id, coach_id, kind, prospect_name, starts_at, updated_at, zoom_transcript_text",
        tsColumn: "updated_at",
        mark,
        limit: batch,
        notNull: ["zoom_transcript_text"],
      }),
    tsOf: (row) => row.updated_at,
    toItem: (row) =>
      row.zoom_transcript_text?.trim()
        ? {
            what: "Transcript of the coach's call with a prospect or client",
            item: {
              coachId: row.coach_id,
              audience: "coach",
              source: "zoom_call",
              sourceId: row.id,
              ts: row.starts_at,
              title: `Call with ${row.prospect_name || "a prospect"}, ${day(row.starts_at)}`,
              text: row.zoom_transcript_text,
              metadata: { kind: row.kind },
            },
          }
        : null,
  });
}

/** The coach's LinkedIn posts (short: stored whole, no notes). */
export function ingestLinkedInPosts(budget: NotesBudget): Promise<ConnectorResult> {
  type Row = {
    id: string;
    user_id: string;
    kind: string;
    posted_at: string;
    text: string;
    share_url: string | null;
    reactions: number;
    comments: number;
    impressions: number;
    updated_at: string;
  };
  const batch = 1_000;
  return runConnector<Row>({
    source: "linkedin_post",
    budget,
    notes: false,
    batch,
    fetch: (mark) =>
      rowsAfter<Row>({
        table: "linkedin_post_history",
        select: "id, user_id, kind, posted_at, text, share_url, reactions, comments, impressions, updated_at",
        tsColumn: "updated_at",
        mark,
        limit: batch,
      }),
    tsOf: (row) => row.updated_at,
    toItem: (row) =>
      row.text.trim()
        ? {
            what: "A LinkedIn post by the coach",
            item: {
              coachId: row.user_id,
              audience: "coach",
              source: "linkedin_post",
              sourceId: row.id,
              ts: row.posted_at,
              title: `LinkedIn ${row.kind}, ${day(row.posted_at)}`,
              text: row.text,
              url: row.share_url,
              metadata: { reactions: row.reactions, comments: row.comments, impressions: row.impressions },
            },
          }
        : null,
  });
}

/** The coach's LinkedIn newsletter issues (their own writing: raw text, no notes). */
export function ingestNewsletters(budget: NotesBudget): Promise<ConnectorResult> {
  type Row = {
    id: string;
    user_id: string;
    title: string | null;
    url: string | null;
    published_at: string | null;
    imported_at: string;
    excerpt: string | null;
    body_blocks: Array<{ text?: unknown }> | null;
    updated_at: string;
  };
  const batch = 100;
  return runConnector<Row>({
    source: "newsletter",
    budget,
    notes: false,
    batch,
    fetch: (mark) =>
      rowsAfter<Row>({
        table: "linkedin_newsletter_issues",
        select: "id, user_id, title, url, published_at, imported_at, excerpt, body_blocks, updated_at",
        tsColumn: "updated_at",
        mark,
        limit: batch,
      }),
    tsOf: (row) => row.updated_at,
    toItem: (row) => {
      const body = (row.body_blocks ?? [])
        .map((block) => (typeof block?.text === "string" ? block.text : ""))
        .filter(Boolean)
        .join("\n\n");
      const text = body || row.excerpt || "";
      if (!text.trim()) return null;
      return {
        what: "A LinkedIn newsletter issue by the coach",
        item: {
          coachId: row.user_id,
          audience: "coach",
          source: "newsletter",
          sourceId: row.id,
          ts: row.published_at ?? row.imported_at,
          title: `Newsletter: ${row.title || "untitled"}`,
          text,
          url: row.url,
        },
      };
    },
  });
}
