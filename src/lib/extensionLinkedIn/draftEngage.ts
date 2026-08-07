import { generateCampaignJson } from "@/lib/firstCampaign/generateJson";
import { loadCoachLinkedInSummary } from "@/lib/firstCampaign/loadCoachContext";
import { loadCoachAiContextRow } from "@/lib/profitCoachAi/loadCoachPromptContext";
import type { DraftNoteVariant } from "@/lib/extensionLinkedIn/draftNote";

export type EngageKind = "comment" | "reply";

export type EngageContext = {
  /** Post text or latest message thread snippet */
  text: string;
  authorName?: string | null;
  authorHeadline?: string | null;
  /** Prior messages in a DM (oldest→newest), optional */
  thread?: string | null;
};

const SYSTEM = `You help BCA (Business Coach Academy) coaches engage on LinkedIn in a human voice.

Return ONLY valid JSON:
{
  "variants": [
    { "label": "short label", "body": "text ready to paste" }
  ]
}

Rules:
- Exactly 2 variants.
- kind=comment: short feed comment (1–3 sentences). Add a real observation or question. No "Great share!" / "Thanks for posting!" fluff. No hard sell. No emojis unless the post is very casual.
- kind=reply: short DM reply that moves the conversation forward. Soft CTA toward a useful next step when natural (interest / call), never pushy. Match the other person's tone.
- Sound like a peer operator, not a LinkedIn influencer.
- Use coach brain / proof when relevant; do not invent client results.
- No markdown fences.`;

export async function draftLinkedInEngage(opts: {
  coachId: string;
  kind: EngageKind;
  context: EngageContext;
}): Promise<{ variants: DraftNoteVariant[] }> {
  const text = opts.context.text?.trim();
  if (!text) {
    throw new Error(
      opts.kind === "comment"
        ? "No post text found."
        : "No message text found."
    );
  }

  const [brain, linkedIn] = await Promise.all([
    loadCoachAiContextRow(opts.coachId),
    loadCoachLinkedInSummary(opts.coachId),
  ]);

  const user = `kind: ${opts.kind}

Author / other person:
${JSON.stringify(
  {
    name: opts.context.authorName ?? null,
    headline: opts.context.authorHeadline ?? null,
  },
  null,
  2
)}

${opts.kind === "comment" ? "Post text" : "Latest message / focus"}:
"""
${text.slice(0, 4000)}
"""

${
  opts.context.thread?.trim()
    ? `Thread context:\n"""\n${opts.context.thread.trim().slice(0, 4000)}\n"""`
    : ""
}

Coach brain (may be partial):
${JSON.stringify(brain ?? {}, null, 2)}

Coach LinkedIn / proof:
${linkedIn.summary || "(none)"}

Write 2 ${opts.kind} variants.`;

  const { data, error } = await generateCampaignJson<{
    variants?: DraftNoteVariant[];
  }>({
    system: SYSTEM,
    user,
    maxTokens: 1536,
  });

  if (error || !data?.variants?.length) {
    throw new Error(error || "Could not draft engagement.");
  }

  const variants = data.variants
    .filter(
      (v) =>
        v &&
        typeof v.label === "string" &&
        typeof v.body === "string" &&
        v.body.trim()
    )
    .slice(0, 2)
    .map((v) => ({
      label: v.label.trim() || "Variant",
      body: v.body.trim(),
    }));

  if (!variants.length) {
    throw new Error("Model returned empty drafts.");
  }

  return { variants };
}
