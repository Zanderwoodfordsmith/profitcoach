import { supabaseAdmin } from "@/lib/supabaseAdmin";

/** Unipile message-payload: 1 = reacted, 2 = reacted to owner message. */
const REACTION_EVENT_TYPES = new Set([1, 2]);

export type MessageReaction = {
  value: string;
  sender_id?: string;
  is_sender?: boolean;
};

export type ParsedUnipileMessageFlags = {
  isEvent: boolean;
  eventType: number | null;
  hidden: boolean;
  parentId: string | null;
  reactions: MessageReaction[];
  text: string;
};

function truthyFlag(v: unknown): boolean {
  return v === true || v === 1 || v === "1" || v === "true";
}

function asEventType(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string" && v.trim() && Number.isFinite(Number(v))) {
    return Number(v);
  }
  return null;
}

/** Pull emoji-ish tokens from free text (reaction events often are just the emoji). */
export function extractReactionEmoji(text: string | null | undefined): string {
  const t = (text || "").trim();
  if (!t) return "👍";
  const reacted = t.match(
    /reacted\s+([\p{Extended_Pictographic}\p{Emoji_Presentation}\p{Emoji}\uFE0F]+)/iu
  );
  if (reacted?.[1]) return reacted[1];
  const emojis = t.match(
    /[\p{Extended_Pictographic}\p{Emoji_Presentation}\p{Emoji}\uFE0F]/gu
  );
  if (emojis?.length) return emojis.slice(0, 3).join("");
  // Strip long ids / noise and see if anything short remains.
  const stripped = t
    .replace(/[A-Za-z0-9_.:-]{8,}/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (stripped && stripped.length <= 8) return stripped;
  return "👍";
}

export function formatReactionPreview(
  emoji: string | null | undefined,
  opts?: { isSender?: boolean }
): string {
  const e = (emoji || "👍").trim() || "👍";
  return opts?.isSender ? `You reacted ${e}` : `Reacted ${e}`;
}

/** WhatsApp LIDs / Unipile placeholders like `{{5514…@lid}}`. */
const PROVIDER_HANDLE_RE =
  /\{\{[^}]+\}\}|[A-Za-z0-9._+-]+@lid\b|<[^|>]*@lid>/i;

function hasReactionEmoji(text: string): boolean {
  return /[\p{Extended_Pictographic}\p{Emoji_Presentation}\p{Emoji}\uFE0F]/u.test(
    text
  );
}

/** Clean list-preview strings that already stored raw reaction event junk. */
export function displayConversationPreview(
  preview: string | null | undefined
): string {
  const t = (preview || "").replace(/\s+/g, " ").trim();
  if (!t) return "";
  // Already cleaned — keep (but never keep provider handles).
  if (
    (/^you reacted /i.test(t) || /^reacted /i.test(t)) &&
    !PROVIDER_HANDLE_RE.test(t)
  ) {
    return t;
  }
  if (looksLikeReactionEventText(t)) {
    const isSender = /^you reacted /i.test(t);
    return formatReactionPreview(extractReactionEmoji(t), { isSender });
  }
  return t;
}

/**
 * Heuristic for legacy rows stored as normal bubbles
 * (e.g. `{{5514…@lid}} reacted ❤️`, emoji + id, “reacted … to …”).
 */
export function looksLikeReactionEventText(text: string | null | undefined): boolean {
  const t = (text || "").replace(/\s+/g, " ").trim();
  if (!t) return false;

  // "{{id@lid}} reacted ❤️" / "Someone reacted ❤️ to your message"
  if (/\breacted\b/i.test(t) && (hasReactionEmoji(t) || PROVIDER_HANDLE_RE.test(t))) {
    return true;
  }
  if (/reacted\s+.+\s+to/i.test(t)) return true;

  // Pure emoji (1–6 grapheme-ish chars, no letters/digits)
  if (
    /^[\p{Extended_Pictographic}\p{Emoji_Presentation}\p{Emoji}\uFE0F\s]+$/u.test(
      t
    ) &&
    t.replace(/\s/g, "").length <= 12
  ) {
    return true;
  }
  // Emoji + long opaque id (common Unipile/WhatsApp event body)
  if (
    /^[\p{Extended_Pictographic}\p{Emoji_Presentation}\p{Emoji}\uFE0F]+\s*[A-Za-z0-9_.:@-]{6,}$/u.test(
      t
    )
  ) {
    return true;
  }
  return false;
}

export function normalizeReactions(raw: unknown): MessageReaction[] {
  if (!Array.isArray(raw)) return [];
  const out: MessageReaction[] = [];
  const seen = new Set<string>();
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const r = item as Record<string, unknown>;
    const value = String(r.value || r.reaction || r.emoji || "").trim();
    if (!value) continue;
    const sender_id = String(r.sender_id || r.senderId || "").trim() || undefined;
    const is_sender = truthyFlag(r.is_sender ?? r.isSender);
    const key = `${value}::${sender_id || (is_sender ? "self" : "other")}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ value, sender_id, is_sender });
  }
  return out;
}

export function parseUnipileMessageFlags(
  msg: Record<string, unknown>
): ParsedUnipileMessageFlags {
  const text = String(msg.text || msg.body || msg.message || "").trim();
  const eventType = asEventType(msg.event_type ?? msg.eventType);
  const isEvent = truthyFlag(msg.is_event ?? msg.isEvent);
  const hidden = truthyFlag(msg.hidden);
  const parentId =
    String(msg.parent || msg.parent_id || msg.parentId || "").trim() || null;
  return {
    isEvent,
    eventType,
    hidden,
    parentId,
    reactions: normalizeReactions(msg.reactions),
    text,
  };
}

export function isUnipileReactionEvent(
  flags: ParsedUnipileMessageFlags
): boolean {
  if (flags.isEvent && flags.eventType != null) {
    return REACTION_EVENT_TYPES.has(flags.eventType);
  }
  // WhatsApp often delivers "{{…@lid}} reacted ❤️" without reliable flags.
  if (looksLikeReactionEventText(flags.text)) return true;
  return false;
}

export function isStoredReactionEventMessage(input: {
  body_text?: string | null;
  metadata?: Record<string, unknown> | null;
}): boolean {
  const meta = input.metadata || {};
  if (meta.kind === "reaction_event") return true;
  if (
    truthyFlag(meta.is_event) &&
    REACTION_EVENT_TYPES.has(asEventType(meta.event_type) ?? -1)
  ) {
    return true;
  }
  return looksLikeReactionEventText(input.body_text);
}

export function reactionsFromMessageMetadata(
  metadata: Record<string, unknown> | null | undefined
): MessageReaction[] {
  return normalizeReactions(metadata?.reactions);
}

export function mergeReactions(
  existing: MessageReaction[],
  incoming: MessageReaction[]
): MessageReaction[] {
  return normalizeReactions([...existing, ...incoming]);
}

/** Attach a reaction onto the parent message row (by Unipile message id). */
export async function applyReactionToParentMessage(input: {
  conversationId: string;
  parentUnipileMessageId: string;
  reaction: MessageReaction;
}): Promise<boolean> {
  const parentId = input.parentUnipileMessageId.trim();
  if (!parentId) return false;

  const { data: parent } = await supabaseAdmin
    .from("messaging_messages")
    .select("id, metadata")
    .eq("conversation_id", input.conversationId)
    .eq("unipile_message_id", parentId)
    .maybeSingle();

  if (!parent?.id) return false;

  const meta = (parent.metadata as Record<string, unknown> | null) || {};
  const next = mergeReactions(normalizeReactions(meta.reactions), [
    input.reaction,
  ]);
  await supabaseAdmin
    .from("messaging_messages")
    .update({ metadata: { ...meta, reactions: next } })
    .eq("id", parent.id);
  return true;
}

/** Patch reactions onto an existing message when Unipile returns reactions[]. */
export async function patchMessageReactionsByUnipileId(input: {
  conversationId: string;
  unipileMessageId: string;
  reactions: MessageReaction[];
}): Promise<void> {
  if (!input.reactions.length) return;
  const { data: row } = await supabaseAdmin
    .from("messaging_messages")
    .select("id, metadata")
    .eq("conversation_id", input.conversationId)
    .eq("unipile_message_id", input.unipileMessageId)
    .maybeSingle();
  if (!row?.id) return;
  const meta = (row.metadata as Record<string, unknown> | null) || {};
  const next = mergeReactions(normalizeReactions(meta.reactions), input.reactions);
  // Avoid no-op writes when already in sync.
  const prev = normalizeReactions(meta.reactions);
  if (
    prev.length === next.length &&
    prev.every(
      (p, i) =>
        p.value === next[i]?.value &&
        p.sender_id === next[i]?.sender_id &&
        Boolean(p.is_sender) === Boolean(next[i]?.is_sender)
    )
  ) {
    return;
  }
  await supabaseAdmin
    .from("messaging_messages")
    .update({ metadata: { ...meta, reactions: next } })
    .eq("id", row.id);
}

export function reactionChipsSummary(reactions: MessageReaction[]): string {
  if (!reactions.length) return "";
  const counts = new Map<string, number>();
  for (const r of reactions) {
    counts.set(r.value, (counts.get(r.value) || 0) + 1);
  }
  return [...counts.entries()]
    .map(([emoji, n]) => (n > 1 ? `${emoji}${n}` : emoji))
    .join(" ");
}
