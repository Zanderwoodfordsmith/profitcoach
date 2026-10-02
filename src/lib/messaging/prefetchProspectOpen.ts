"use client";

import { getCoachAuthHeaders } from "@/lib/coachAuthHeaders";
import { readThreadCache, writeThreadCache } from "@/lib/messaging/threadCache";
import { THREAD_MESSAGE_PAGE_SIZE } from "@/lib/messaging/threadWindow";

const FRESH_MS = 60_000;

export type PrefetchedConversation = {
  id: string;
  contact_id?: string | null;
  subject?: string | null;
  prospect_name?: string | null;
  prospect_email?: string | null;
  prospect_phone?: string | null;
  prospect_avatar_url?: string | null;
  prospect_linkedin_url?: string | null;
  prospect_business_name?: string | null;
  last_message_at?: string | null;
  starred?: boolean;
  unread_count?: number;
  last_preview?: string | null;
  last_channel?: string | null;
  last_direction?: string | null;
};

type ThreadMessage = { id: string; created_at: string } & Record<string, unknown>;

export type PrefetchedThreadPage = {
  ok: boolean;
  status: number;
  error?: string;
  conversation?: PrefetchedConversation | null;
  messages: ThreadMessage[];
  has_older: boolean;
  scheduled: unknown[];
};

export type ProspectFeedPayload = {
  activity?: unknown[];
  messages?: unknown[];
  conversations?: unknown[];
  calls?: unknown[];
  error?: string;
};

type CacheEntry<T> = { at: number; data: T };

const conversations = new Map<string, CacheEntry<PrefetchedConversation>>();
const conversationInflight = new Map<string, Promise<PrefetchedConversation | null>>();
const threadInflight = new Map<string, Promise<PrefetchedThreadPage>>();
const threadRecent = new Map<string, CacheEntry<PrefetchedThreadPage>>();
const feeds = new Map<string, CacheEntry<ProspectFeedPayload>>();
const feedInflight = new Map<string, Promise<ProspectFeedPayload | null>>();

function scopeKey(contactId: string, impersonate?: string | null) {
  return `${(impersonate || "").trim() || "_"}:${contactId.trim()}`;
}

export function clearProspectOpenCaches() {
  conversations.clear();
  conversationInflight.clear();
  threadInflight.clear();
  threadRecent.clear();
  feeds.clear();
  feedInflight.clear();
}

export function peekProspectConversation(
  contactId: string,
  impersonate?: string | null
): PrefetchedConversation | null {
  const entry = conversations.get(scopeKey(contactId, impersonate));
  if (!entry) return null;
  if (Date.now() - entry.at > FRESH_MS) return null;
  return entry.data;
}

export function rememberProspectConversation(
  contactId: string,
  conversation: PrefetchedConversation,
  impersonate?: string | null
) {
  const id = contactId.trim();
  if (!id || !conversation.id) return;
  conversations.set(scopeKey(id, impersonate), {
    at: Date.now(),
    data: { ...conversation, contact_id: conversation.contact_id ?? id },
  });
}

export function peekRecentThreadPage(
  conversationId: string
): PrefetchedThreadPage | null {
  const id = conversationId.trim();
  if (!id) return null;
  const entry = threadRecent.get(id);
  if (!entry) return null;
  if (Date.now() - entry.at > FRESH_MS) return null;
  if (!entry.data.ok) return null;
  return entry.data;
}

function threadMessages(value: unknown): ThreadMessage[] {
  if (!Array.isArray(value)) return [];
  return value.filter(
    (row): row is ThreadMessage =>
      Boolean(
        row &&
          typeof row === "object" &&
          typeof (row as { id?: unknown }).id === "string" &&
          typeof (row as { created_at?: unknown }).created_at === "string"
      )
  );
}

export function fetchThreadPage(
  conversationId: string,
  headers: Record<string, string>,
  opts?: { fresh?: boolean }
): Promise<PrefetchedThreadPage> {
  const id = conversationId.trim();
  const existing = threadInflight.get(id);
  if (existing) return existing;
  if (!opts?.fresh) {
    const recent = peekRecentThreadPage(id);
    if (recent) return Promise.resolve(recent);
  }

  const request = (async (): Promise<PrefetchedThreadPage> => {
    const res = await fetch(
      `/api/messaging/conversations/${encodeURIComponent(id)}?limit=${THREAD_MESSAGE_PAGE_SIZE}`,
      { headers }
    );
    const body = (await res.json().catch(() => ({}))) as {
      error?: string;
      conversation?: PrefetchedConversation | null;
      messages?: unknown;
      has_older?: boolean;
      scheduled?: unknown;
    };
    const page: PrefetchedThreadPage = {
      ok: res.ok,
      status: res.status,
      error: body.error,
      conversation: body.conversation ?? null,
      messages: threadMessages(body.messages),
      has_older: Boolean(body.has_older),
      scheduled: Array.isArray(body.scheduled) ? body.scheduled : [],
    };
    if (page.ok) {
      writeThreadCache(id, page.messages, page.has_older, "replace");
      threadRecent.set(id, { at: Date.now(), data: page });
    }
    return page;
  })().catch((err) => {
    const page: PrefetchedThreadPage = {
      ok: false,
      status: 0,
      error: err instanceof Error ? err.message : "Thread load failed.",
      messages: [],
      has_older: false,
      scheduled: [],
    };
    return page;
  });

  threadInflight.set(id, request);
  void request.finally(() => {
    if (threadInflight.get(id) === request) threadInflight.delete(id);
  });
  return request;
}

export function prefetchProspectThread(
  conversationId: string,
  impersonate?: string | null
) {
  const id = conversationId.trim();
  if (!id || peekRecentThreadPage(id) || threadInflight.has(id)) return;
  if (readThreadCache(id)) return;
  void (async () => {
    const headers = await getCoachAuthHeaders(impersonate);
    if (!headers) return;
    await fetchThreadPage(id, headers);
  })();
}

async function ensureConversation(
  contactId: string,
  impersonate?: string | null
): Promise<PrefetchedConversation | null> {
  const id = contactId.trim();
  if (!id) return null;
  const cached = peekProspectConversation(id, impersonate);
  if (cached) return cached;
  const key = scopeKey(id, impersonate);
  const existing = conversationInflight.get(key);
  if (existing) return existing;

  const request = (async () => {
    const headers = await getCoachAuthHeaders(impersonate);
    if (!headers) return null;
    const res = await fetch(
      `/api/messaging/conversations?contact_id=${encodeURIComponent(id)}`,
      { headers }
    );
    if (!res.ok) return null;
    const body = (await res.json().catch(() => ({}))) as {
      conversation?: PrefetchedConversation;
    };
    const conversation = body.conversation;
    if (!conversation?.id) return null;
    rememberProspectConversation(id, conversation, impersonate);
    return peekProspectConversation(id, impersonate);
  })().catch(() => null);

  conversationInflight.set(key, request);
  void request.finally(() => {
    if (conversationInflight.get(key) === request) conversationInflight.delete(key);
  });
  return request;
}

export function peekProspectFeed<T extends ProspectFeedPayload>(
  contactId: string,
  impersonate?: string | null
): T | null {
  const entry = feeds.get(scopeKey(contactId, impersonate));
  if (!entry) return null;
  if (Date.now() - entry.at > FRESH_MS) return null;
  return entry.data as T;
}

export function loadProspectFeed(
  contactId: string,
  impersonate?: string | null
): Promise<ProspectFeedPayload | null> {
  const id = contactId.trim();
  if (!id) return Promise.resolve(null);
  const cached = peekProspectFeed(id, impersonate);
  if (cached) return Promise.resolve(cached);
  const key = scopeKey(id, impersonate);
  const existing = feedInflight.get(key);
  if (existing) return existing;

  const request = (async () => {
    const headers = await getCoachAuthHeaders(impersonate);
    if (!headers) return null;
    const res = await fetch(
      `/api/messaging/contacts/${encodeURIComponent(id)}/feed`,
      { headers, cache: "no-store" }
    );
    const body = (await res.json().catch(() => ({}))) as ProspectFeedPayload;
    if (!res.ok) return null;
    feeds.set(key, { at: Date.now(), data: body });
    return body;
  })().catch(() => null);

  feedInflight.set(key, request);
  void request.finally(() => {
    if (feedInflight.get(key) === request) feedInflight.delete(key);
  });
  return request;
}

/** Lookup an existing thread and warm its messages plus the record feed. */
export function prefetchProspectOpen(
  contactId: string,
  impersonate?: string | null
) {
  const id = contactId.trim();
  if (!id) return;
  void ensureConversation(id, impersonate).then((conversation) => {
    if (conversation?.id) prefetchProspectThread(conversation.id, impersonate);
  });
  void loadProspectFeed(id, impersonate);
}

let hoverTimer = 0;
let hoverKey = "";

/** Wait until the pointer rests so scanning the table does not prefetch every row. */
export function schedulePrefetchProspectOpen(
  contactId: string,
  impersonate?: string | null
) {
  const id = contactId.trim();
  if (!id || typeof window === "undefined") return;
  hoverKey = id;
  window.clearTimeout(hoverTimer);
  hoverTimer = window.setTimeout(() => {
    if (hoverKey === id) prefetchProspectOpen(id, impersonate);
  }, 120);
}
