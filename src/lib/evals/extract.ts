import { campaignMessages, handoffForSection } from "@/lib/practiceKnowledge/campaignHandoff";
import type { BlueprintBlock, BuiltSection } from "@/lib/practiceKnowledge/types";

/**
 * Pull the pieces we score out of what Ava wrote: the connection note and
 * follow-ups from a campaign section, nurture messages, and each reply in the
 * replies section with the prospect line it answers.
 */

/** "Message 1 (2 weeks after the last):" when the timing is known, so rhythm can be judged. */
export function numbered(messages: string[], timings?: (string | null)[]): string {
  return messages.map((m, i) => `Message ${i + 1}${timings?.[i] ? ` (${timings[i]})` : ""}:\n${m.trim()}`).join("\n\n");
}

/** The timing note Ava gives each message in a sequence ("Send 2 weeks after the last one."). */
export function sequenceTimings(key: string, section: BuiltSection): (string | null)[] {
  const handoff = handoffForSection(key);
  if (!handoff) return [];
  const out: (string | null)[] = [];
  let inside = false;
  for (const b of section.blocks) {
    if (b.type === "heading") inside = handoff.headings.some((word) => b.text.toLowerCase().includes(word));
    else if (inside && b.type === "message") out.push(b.note?.trim() || null);
  }
  return out;
}

/** Live campaign steps: the wait before each message, in plain words. */
export function stepTimings(steps: { step_type: string; wait_hours?: number | null; body?: string | null }[]): (string | null)[] {
  const out: (string | null)[] = [];
  let wait = 0;
  for (const st of steps) {
    if (st.step_type === "wait") wait += Number(st.wait_hours ?? 0);
    else if (st.step_type === "message" && (st.body ?? "").trim()) {
      out.push(wait ? (wait >= 48 ? `${Math.round(wait / 24)} days after the last` : `${wait} hours after the last`) : null);
      wait = 0;
    }
  }
  return out;
}

/** Connection campaign: the first message block under the sequence is the note. */
export function connectionPieces(section: BuiltSection): { note: string | null; followups: string[] } {
  const handoff = handoffForSection("campaigns:messaging");
  const messages = handoff ? campaignMessages(handoff, section) : [];
  const [note, ...followups] = messages;
  return { note: note ?? null, followups };
}

export function sequenceMessages(key: string, section: BuiltSection): string[] {
  const handoff = handoffForSection(key);
  return handoff ? campaignMessages(handoff, section) : section.blocks.filter((b) => b.type === "message").map((b) => (b as { body: string }).body);
}

export type LabelledReply = { label: string; prospectSays: string; body: string };

/** Replies section: message blocks labelled "They say: ...". */
export function labelledReplies(blocks: BlueprintBlock[]): LabelledReply[] {
  const out: LabelledReply[] = [];
  for (const b of blocks) {
    if (b.type !== "message") continue;
    const says = b.label.match(/they say:?\s*(.+)$/i)?.[1]?.trim();
    out.push({ label: b.label, prospectSays: says ?? b.label, body: b.body });
  }
  return out;
}
