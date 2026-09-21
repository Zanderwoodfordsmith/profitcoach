export type MessagingComposeChannel =
  | "email"
  | "sms"
  | "linkedin"
  | "whatsapp"
  | "instagram"
  | "messenger";

export type MessagingComposeDraft = {
  conversationId: string;
  body: string;
  channel?: MessagingComposeChannel;
  subject?: string;
  updatedAt?: string;
};

export type MessagingComposeDraftStore = {
  lastId: string | null;
  drafts: Record<string, MessagingComposeDraft>;
};

const STORAGE_KEY = "pc:messaging-compose-drafts";
const LEGACY_STORAGE_KEY = "pc:messaging-compose-draft";
const MAX_DRAFTS = 80;

const CHANNELS = new Set<MessagingComposeChannel>([
  "email",
  "sms",
  "linkedin",
  "whatsapp",
  "instagram",
  "messenger",
]);

function asChannel(value: unknown): MessagingComposeChannel | undefined {
  if (typeof value !== "string") return undefined;
  return CHANNELS.has(value as MessagingComposeChannel)
    ? (value as MessagingComposeChannel)
    : undefined;
}

export function emptyComposeDraftStore(): MessagingComposeDraftStore {
  return { lastId: null, drafts: {} };
}

export function parseComposeDraftStore(
  raw: string | null | undefined
): MessagingComposeDraftStore {
  if (!raw?.trim()) return emptyComposeDraftStore();
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object") return emptyComposeDraftStore();
    const rec = parsed as Record<string, unknown>;

    // Legacy: a single draft object.
    if (typeof rec.conversationId === "string" && typeof rec.body === "string") {
      const draft = normalizeDraft({
        conversationId: rec.conversationId,
        body: rec.body,
        channel: asChannel(rec.channel),
        subject: typeof rec.subject === "string" ? rec.subject : undefined,
      });
      if (!draft) return emptyComposeDraftStore();
      return { lastId: draft.conversationId, drafts: { [draft.conversationId]: draft } };
    }

    const draftsIn =
      rec.drafts && typeof rec.drafts === "object" && !Array.isArray(rec.drafts)
        ? (rec.drafts as Record<string, unknown>)
        : {};
    const drafts: Record<string, MessagingComposeDraft> = {};
    for (const [id, value] of Object.entries(draftsIn)) {
      if (!value || typeof value !== "object") continue;
      const row = value as Record<string, unknown>;
      const draft = normalizeDraft({
        conversationId: typeof row.conversationId === "string" ? row.conversationId : id,
        body: typeof row.body === "string" ? row.body : "",
        channel: asChannel(row.channel),
        subject: typeof row.subject === "string" ? row.subject : undefined,
        updatedAt: typeof row.updatedAt === "string" ? row.updatedAt : undefined,
      });
      if (draft) drafts[draft.conversationId] = draft;
    }
    const lastId =
      typeof rec.lastId === "string" && drafts[rec.lastId] ? rec.lastId : null;
    return pruneDraftStore({ lastId, drafts });
  } catch {
    return emptyComposeDraftStore();
  }
}

function normalizeDraft(
  draft: MessagingComposeDraft
): MessagingComposeDraft | null {
  const conversationId = draft.conversationId.trim();
  const body = draft.body;
  if (!conversationId) return null;
  // LinkedIn headlines are stored as conversation.subject and were being
  // auto-saved as "Re: …" drafts with no body — yellow Draft chips on chats
  // the coach never typed in. A draft is typed message text, not a subject.
  if (!body.trim()) return null;
  return {
    conversationId,
    body,
    channel: draft.channel,
    subject: draft.subject?.trim() ? draft.subject : undefined,
    updatedAt: draft.updatedAt || new Date().toISOString(),
  };
}

export function upsertDraftInStore(
  store: MessagingComposeDraftStore,
  draft: MessagingComposeDraft
): MessagingComposeDraftStore {
  const next = normalizeDraft(draft);
  if (!next) {
    return removeDraftFromStore(store, draft.conversationId);
  }
  return pruneDraftStore({
    lastId: next.conversationId,
    drafts: { ...store.drafts, [next.conversationId]: next },
  });
}

export function removeDraftFromStore(
  store: MessagingComposeDraftStore,
  conversationId: string
): MessagingComposeDraftStore {
  const id = conversationId.trim();
  if (!id || !store.drafts[id]) {
    return store.lastId === id ? { ...store, lastId: null } : store;
  }
  const drafts = { ...store.drafts };
  delete drafts[id];
  return {
    lastId: store.lastId === id ? null : store.lastId,
    drafts,
  };
}

export function pruneDraftStore(
  store: MessagingComposeDraftStore
): MessagingComposeDraftStore {
  const entries = Object.values(store.drafts);
  if (entries.length <= MAX_DRAFTS) return store;
  const keep = [...entries]
    .sort((a, b) =>
      (b.updatedAt || "").localeCompare(a.updatedAt || "")
    )
    .slice(0, MAX_DRAFTS);
  const drafts: Record<string, MessagingComposeDraft> = {};
  for (const draft of keep) drafts[draft.conversationId] = draft;
  return {
    lastId: store.lastId && drafts[store.lastId] ? store.lastId : null,
    drafts,
  };
}

function readStore(): MessagingComposeDraftStore {
  if (typeof window === "undefined") return emptyComposeDraftStore();
  try {
    const current = window.localStorage.getItem(STORAGE_KEY);
    if (current) return parseComposeDraftStore(current);
    const legacy =
      window.localStorage.getItem(LEGACY_STORAGE_KEY) ||
      (typeof sessionStorage !== "undefined"
        ? sessionStorage.getItem(LEGACY_STORAGE_KEY)
        : null);
    const parsed = parseComposeDraftStore(legacy);
    if (Object.keys(parsed.drafts).length) {
      writeStore(parsed);
      try {
        window.localStorage.removeItem(LEGACY_STORAGE_KEY);
        sessionStorage.removeItem(LEGACY_STORAGE_KEY);
      } catch {
        /* ignore */
      }
    }
    return parsed;
  } catch {
    return emptyComposeDraftStore();
  }
}

function writeStore(store: MessagingComposeDraftStore): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
  } catch {
    /* private mode / quota */
  }
}

export function setMessagingComposeDraft(draft: MessagingComposeDraft): void {
  const store = upsertDraftInStore(readStore(), draft);
  writeStore(store);
}

export function getMessagingComposeDraft(
  conversationId: string
): MessagingComposeDraft | null {
  const id = conversationId.trim();
  if (!id) return null;
  return readStore().drafts[id] ?? null;
}

export function peekMessagingComposeDraft(): MessagingComposeDraft | null {
  const store = readStore();
  if (store.lastId && store.drafts[store.lastId]) return store.drafts[store.lastId];
  const first = Object.values(store.drafts)[0];
  return first ?? null;
}

/** Kept for callers that used to one-shot a draft — now loads without deleting. */
export function consumeMessagingComposeDraft(
  conversationId?: string
): MessagingComposeDraft | null {
  if (conversationId) return getMessagingComposeDraft(conversationId);
  return peekMessagingComposeDraft();
}

export function clearMessagingComposeDraft(conversationId: string): void {
  writeStore(removeDraftFromStore(readStore(), conversationId));
}

export function messagingComposeDraftIds(): string[] {
  return Object.keys(readStore().drafts);
}

export type MessagingComposeDraftSummary = {
  preview: string;
  channel?: MessagingComposeChannel;
};

export function composeDraftPreview(
  draft: Pick<MessagingComposeDraft, "body" | "subject">,
  max = 72
): string {
  const text = draft.body.trim() || draft.subject?.trim() || "";
  if (text.length <= max) return text;
  return `${text.slice(0, Math.max(1, max - 1))}…`;
}

export function messagingComposeDraftSummaries(): Record<
  string,
  MessagingComposeDraftSummary
> {
  const out: Record<string, MessagingComposeDraftSummary> = {};
  for (const [id, draft] of Object.entries(readStore().drafts)) {
    out[id] = {
      preview: composeDraftPreview(draft),
      channel: draft.channel,
    };
  }
  return out;
}

/** Keep the original draft channel until the coach edits the text. */
export function nextComposeDraftChannel(input: {
  existing: MessagingComposeDraft | null;
  body: string;
  subject?: string;
  channel?: MessagingComposeChannel | "comment";
}): MessagingComposeChannel | undefined {
  const nextChannel =
    input.channel && input.channel !== "comment" ? input.channel : undefined;
  if (input.channel === "comment") return input.existing?.channel;
  if (!input.existing?.channel) return nextChannel;
  const bodyChanged = input.existing.body !== input.body;
  const subjectChanged = (input.existing.subject || "") !== (input.subject || "");
  if (bodyChanged || subjectChanged) return nextChannel;
  return input.existing.channel;
}

export function hasMessagingComposeDraft(conversationId: string): boolean {
  return Boolean(readStore().drafts[conversationId.trim()]);
}

/** Drop subject-only leftovers (LinkedIn headlines saved as Re: drafts). */
export function pruneMessagingComposeDrafts(): void {
  writeStore(readStore());
}

/** Prefill only for email. LinkedIn stores job titles in `subject`. */
export function autoEmailReplySubject(
  channel: string | null | undefined,
  conversationSubject: string | null | undefined
): string {
  if ((channel || "").trim().toLowerCase() !== "email") return "";
  const subject = (conversationSubject || "").trim();
  if (!subject) return "";
  return /^re:\s/i.test(subject) ? subject : `Re: ${subject}`;
}
