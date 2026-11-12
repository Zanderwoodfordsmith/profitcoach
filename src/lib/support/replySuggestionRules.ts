/**
 * The decisions behind suggested Support replies, kept free of the database and
 * the AI call so they can be tested on their own.
 */

export type SuggestionConfidence = "high" | "medium" | "low";

export type SuggestionMessage = {
  created_at: string;
  created_by: string | null;
  author_role: string | null;
};

/**
 * The coach message a draft should answer, or null when none is needed: the chat
 * is done, BCA has the last word, or BCA itself started it and nobody has replied.
 */
export function suggestionTargetAt(input: {
  ticket: {
    status: string;
    source: string | null;
    created_at: string;
    created_by: string | null;
  };
  replies: SuggestionMessage[];
}): string | null {
  const { ticket, replies } = input;
  if (ticket.status === "resolved") return null;
  const last = replies[replies.length - 1];
  if (!last) return ticket.source === "admin_created" ? null : ticket.created_at;
  const fromStaff = last.author_role === "admin" && last.created_by !== ticket.created_by;
  return fromStaff ? null : last.created_at;
}

/** A gap for staff to fill: `[what I changed]`, but not a `[label](url)` link. */
const PLACEHOLDER = /\[[^\]]+\](?!\()/;

/** Ava can't be sure of a draft that still has a gap in it, whatever she says. */
export function settleConfidence(
  confidence: SuggestionConfidence,
  body: string
): SuggestionConfidence {
  return PLACEHOLDER.test(body) ? "low" : confidence;
}

function wordCounts(text: string): Map<string, number> {
  const counts = new Map<string, number>();
  for (const word of text.toLowerCase().match(/[\p{L}\p{N}']+/gu) ?? []) {
    counts.set(word, (counts.get(word) ?? 0) + 1);
  }
  return counts;
}

/** How much BCA changed before sending: 0 is sent as written, 1 is all new. */
export function changedShare(draft: string, sent: string): number {
  const a = wordCounts(draft);
  const b = wordCounts(sent);
  const total = (m: Map<string, number>) => [...m.values()].reduce((sum, n) => sum + n, 0);
  const size = total(a) + total(b);
  if (size === 0) return 0;
  let shared = 0;
  for (const [word, count] of a) shared += Math.min(count, b.get(word) ?? 0);
  return Number((1 - (2 * shared) / size).toFixed(3));
}
