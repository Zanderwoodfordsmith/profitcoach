import Anthropic from "@anthropic-ai/sdk";

import { resolveAnthropicModel } from "@/lib/anthropicModel";

import { handoffForSection } from "./campaignHandoff";
import type { BlueprintBlock } from "./types";

/**
 * The connection note must fit LinkedIn's 300 characters, and the classroom
 * aims for 275 so long first names still fit. Writers miscount characters (the
 * Oct 2026 evals saw 311 and 319), and the campaign handoff cuts at 300, which
 * would chop "Is this of interest?" mid-word. So after the connection campaign
 * is written, an over-long note gets one focused rewrite to fit.
 */

export const NOTE_TARGET = 275;

/** Index of the connection note: the first message under the sequence heading. */
export function connectionNoteIndex(blocks: BlueprintBlock[]): number {
  const handoff = handoffForSection("campaigns:messaging");
  if (!handoff) return -1;
  let inside = false;
  for (let i = 0; i < blocks.length; i++) {
    const b = blocks[i]!;
    if (b.type === "heading") inside = handoff.headings.some((word) => b.text.toLowerCase().includes(word));
    else if (inside && b.type === "message") return i;
  }
  return -1;
}

const SYSTEM = `You shorten LinkedIn connection notes for business coaches. Rewrite the note to at most 265 characters, counting every character including spaces.

Keep, in this order: the greeting with {first_name}; the specific callout; the question hook; "I ask because"; every number, money amount and timeframe exactly as written; the mechanism in fewer words; and the closing interest question. Keep {tokens} and [square brackets] exactly as they are. Cut filler words first. Never add a fact, a number or a claim. Never use the em dash character.

Return only the note, nothing else.`;

/** True when the shorter note kept every number and token the original had. */
export function keepsFacts(before: string, after: string): boolean {
  const pieces = (t: string) => t.match(/\{[^}]+\}|\[[^\]]+\]|[£$€]?\d[\d,.]*\s?(?:k|m|bn|%)?/gi) ?? [];
  const now = after.toLowerCase();
  return pieces(before).every((p) => now.includes(p.toLowerCase()));
}

export async function fitConnectionNote(key: string, blocks: BlueprintBlock[]): Promise<BlueprintBlock[]> {
  if (key !== "campaigns:messaging") return blocks;
  const i = connectionNoteIndex(blocks);
  const block = i >= 0 ? blocks[i] : null;
  if (!block || block.type !== "message" || block.body.length <= NOTE_TARGET) return blocks;
  const apiKey = process.env.ANTHROPIC_API_KEY?.trim();
  if (!apiKey) return blocks;
  const anthropic = new Anthropic({ apiKey });
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const response = await anthropic.messages.create({
        model: resolveAnthropicModel(),
        max_tokens: 400,
        system: SYSTEM,
        messages: [{ role: "user", content: `This note is ${block.body.length} characters:\n\n${block.body}` }],
      });
      const shorter = response.content
        .filter((b): b is Anthropic.Messages.TextBlock => b.type === "text")
        .map((b) => b.text)
        .join("")
        .trim()
        .replace(/^"|"$/g, "");
      if (shorter && shorter.length <= NOTE_TARGET && keepsFacts(block.body, shorter)) {
        const note = block.note ? block.note.replace(/\b\d+ characters\b/i, `${shorter.length} characters`) : `${shorter.length} characters.`;
        const next = [...blocks];
        next[i] = { ...block, body: shorter, note };
        return next;
      }
    } catch (err) {
      console.error("fit connection note:", err instanceof Error ? err.message : "failed");
      return blocks;
    }
  }
  return blocks;
}
