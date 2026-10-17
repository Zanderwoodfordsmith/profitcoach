import { blocksToMarkdown } from "./blocks";
import { summarizeKnowledgeForPrompt } from "./prompts";
import { foldRetiredAnswers, listValue } from "./sourced";
import { findPracticeKnowledge } from "./store";
import type { PracticeKnowledgeRow } from "./types";

/**
 * The Practice Blueprint as one prompt section, for every AI tool that writes
 * for a coach. The Blueprint is the source of truth: where it disagrees with
 * the older coach brain or a scraped profile, the Blueprint wins.
 *
 * Holds the coach's own answers (who they help, their words, voice, offer,
 * proof) plus the written guides other tools lean on. The postal address is
 * never included.
 */

/** Written sections worth passing on, in the order a writer needs them. */
const WRITTEN = [
  { key: "voice:sound", title: "Voice guide" },
  { key: "market:avatar", title: "The walkthrough (their ideal client)" },
  { key: "market:pains", title: "Pain points" },
  { key: "offer:lines", title: "Their offer in three lengths" },
  { key: "offer:direction", title: "The offer" },
  { key: "story:bio", title: "Short bio" },
] as const;

const MAX_CHARS = 14_000;

export function blueprintContextFromRow(row: PracticeKnowledgeRow): string {
  const facts = summarizeKnowledgeForPrompt(row.payload).trim();
  const written = WRITTEN.map(({ key, title }) => {
    const built = row.built_sections[key];
    return built?.blocks?.length ? `### ${title}\n\n${blocksToMarkdown(built.blocks, 4)}` : "";
  }).filter(Boolean);
  if (!facts && !written.length) return "";
  const body = [
    "## Practice Blueprint (source of truth)",
    "This is what the coach has agreed about their practice. Follow it over anything else below that disagrees, including their old profile text. Write in the voice and tone it describes.",
    facts ? `### What they told us\n\n${facts}` : "",
    ...written,
  ]
    .filter(Boolean)
    .join("\n\n");
  return body.length <= MAX_CHARS ? body : `${body.slice(0, MAX_CHARS)}\n…`;
}

/** Empty string when the coach has no Blueprint yet, so callers can append it unconditionally. */
export async function loadBlueprintContext(coachId: string): Promise<string> {
  try {
    const row = await findPracticeKnowledge(coachId);
    return row ? blueprintContextFromRow(row) : "";
  } catch {
    return "";
  }
}

/** Just who the coach helps, for prospect search and fit scoring. Short on purpose. */
export function blueprintIdealClientFromRow(row: PracticeKnowledgeRow): string {
  const p = foldRetiredAnswers(row.payload);
  const line = (label: string, items: string[]) => (items.length ? `${label}: ${items.join("; ")}` : "");
  const lines = [
    line("Industries where they have credibility", listValue(p.market.industries_credibility)),
    line("Who signs off", listValue(p.market.buyer_roles)),
    line("Will not take", listValue(p.market.avoid)),
    line("Who they are", listValue(p.client.characteristics)),
    line("Pain", listValue(p.client.pains_now)),
    line("The moment they act", listValue(p.client.buying_triggers)),
  ].filter(Boolean);
  const walkthrough = row.built_sections["market:avatar"]?.blocks?.find((b) => b.type === "lede");
  if (walkthrough && walkthrough.type === "lede") lines.unshift(`Persona: ${walkthrough.text}`);
  return lines.join("\n").slice(0, 3000);
}

export async function loadBlueprintIdealClient(coachId: string): Promise<string> {
  try {
    const row = await findPracticeKnowledge(coachId);
    return row ? blueprintIdealClientFromRow(row) : "";
  } catch {
    return "";
  }
}
