import { generateCampaignJson } from "@/lib/firstCampaign/generateJson";
import { loadCoachLinkedInSummary } from "@/lib/firstCampaign/loadCoachContext";
import { loadCoachAiContextRow } from "@/lib/profitCoachAi/loadCoachPromptContext";

export type DraftNoteKind = "connector" | "dm";

export type DraftNoteVariant = {
  label: string;
  body: string;
};

export type DraftNoteProfile = {
  fullName: string;
  firstName?: string | null;
  jobTitle?: string | null;
  businessName?: string | null;
  headline?: string | null;
  location?: string | null;
  about?: string | null;
  linkedinUrl?: string | null;
};

const SYSTEM = `You write short LinkedIn outreach for BCA (Business Coach Academy) coaches.

Return ONLY valid JSON:
{
  "variants": [
    { "label": "short label", "body": "message text ready to paste" }
  ]
}

Rules:
- Exactly 2 variants.
- kind=connector: connection request note, under ~275 characters when possible. CTA is interest only — never sell coaching.
- kind=dm: short DM (2–5 short paragraphs max) for someone already connected or messaging.
- Personalise from the prospect fields (name, title, company, headline, about). Use real details; do not invent employers or results.
- Use the coach brain / LinkedIn proof when provided; otherwise use editable placeholders in [brackets].
- Prefer concrete industry language over generic "grow your business".
- Do not use markdown fences.`;

export async function draftLinkedInNotesForProspect(opts: {
  coachId: string;
  kind: DraftNoteKind;
  profile: DraftNoteProfile;
}): Promise<{ variants: DraftNoteVariant[] }> {
  const [brain, linkedIn] = await Promise.all([
    loadCoachAiContextRow(opts.coachId),
    loadCoachLinkedInSummary(opts.coachId),
  ]);

  const firstName =
    opts.profile.firstName?.trim() ||
    opts.profile.fullName.trim().split(/\s+/)[0] ||
    "there";

  const user = `kind: ${opts.kind}

Prospect:
${JSON.stringify(
  {
    fullName: opts.profile.fullName,
    firstName,
    jobTitle: opts.profile.jobTitle ?? null,
    businessName: opts.profile.businessName ?? null,
    headline: opts.profile.headline ?? null,
    location: opts.profile.location ?? null,
    about: opts.profile.about?.slice(0, 1200) ?? null,
    linkedinUrl: opts.profile.linkedinUrl ?? null,
  },
  null,
  2
)}

Coach brain (may be partial):
${JSON.stringify(brain ?? {}, null, 2)}

Coach LinkedIn / proof summary:
${linkedIn.summary || "(none)"}

Write 2 ${opts.kind} variants addressed to ${firstName}.`;

  const { data, error } = await generateCampaignJson<{
    variants?: DraftNoteVariant[];
  }>({
    system: SYSTEM,
    user,
    maxTokens: 2048,
  });

  if (error || !data?.variants?.length) {
    throw new Error(error || "Could not draft notes.");
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

  if (variants.length === 0) {
    throw new Error("Model returned empty drafts.");
  }

  return { variants };
}
