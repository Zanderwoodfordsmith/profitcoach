import { campaignMessages, handoffForSection } from "@/lib/practiceKnowledge/campaignHandoff";
import type { BlueprintBlock, BuiltSection } from "@/lib/practiceKnowledge/types";

/**
 * Pull the pieces we score out of what Ava wrote: the connection note and
 * follow-ups from a campaign section, nurture messages, and each reply in the
 * replies section with the prospect line it answers.
 */

export function numbered(messages: string[]): string {
  return messages.map((m, i) => `Message ${i + 1}:\n${m.trim()}`).join("\n\n");
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
