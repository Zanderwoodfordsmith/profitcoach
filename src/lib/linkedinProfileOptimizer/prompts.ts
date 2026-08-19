import type { LinkedInProfileSnapshot } from "@/lib/apify/linkedinProfileTypes";
import type { CoachAiContext } from "@/lib/profitCoachAi/types";
import type { ProfileOptimizerDraft } from "./types";
import type { ProfileSectionId } from "./types";
import { experienceDraftAt } from "./draft";

/** Locked in code so a bad admin edit cannot break the rewrite parser. */
export const PROFILE_REWRITE_JSON_CONTRACT = `Return ONE JSON object only, no markdown:
{"recommendedIndex":0,"variants":[{"label":"Short label","text":"..."}]}
Mark the recommended variant with recommendedIndex (0-based).
Keep labels to 1–3 words (Direct, Proof-led, Specific, Warm).`;

/** Admin-editable voice. Saved in linkedin_optimizer_prompt; empty row uses this. */
export const PROFILE_REWRITE_DEFAULT_VOICE = `You rewrite a BCA coach's LinkedIn profile so the right business owners recognise themselves and want to talk.

Rules:
- Write copy the coach can paste into LinkedIn. Never invent client results, numbers, or proof — use only what the brain / current profile supplies. If proof is missing, write without fake metrics.
- Owner language, not coach-speak. Not “Business Coach | Helping leaders transform”.
- Headline: who they help + the outcome. Scannable. 3–5 variants. LinkedIn max 220 characters.
- About: written TO the ideal client (you/your), not a CV. Pain in their words → mechanism (BOSS as a system, not therapy) → proof from the brain → clear next step (connect, newsletter, or a call). Short paragraphs. 2–3 variants.
- Experience: current role framed as client outcomes, not job history. 2–3 variants of the description (and title if the current title is generic).
- Banner: words only (who + result). Do not describe image layouts in detail. 3 short lines they can put on a banner.
- Featured: what to pin on the profile (newsletter, a proof post, a lead magnet / case). 2–3 variants. Each variant.text is a short numbered list of what to feature and why — not image generation.`;

export const PROFILE_REWRITE_SYSTEM = `${PROFILE_REWRITE_DEFAULT_VOICE}

${PROFILE_REWRITE_JSON_CONTRACT}`;

export function composeRewriteSystem(adminVoice: string | null): string {
  const voice = adminVoice?.trim() || PROFILE_REWRITE_DEFAULT_VOICE;
  return `${voice}\n\n${PROFILE_REWRITE_JSON_CONTRACT}`;
}

function clip(value: string, max: number): string {
  return value.length <= max ? value : `${value.slice(0, max)}…`;
}

function formatBrain(brain: CoachAiContext | null): string {
  if (!brain) return "(empty)";
  const results = brain.client_results ?? [];
  const lines = [
    `ideal_client: ${clip((brain.ideal_client ?? "").trim() || "(empty)", 800)}`,
    `pain_language: ${clip((brain.pain_language ?? "").trim() || "(empty)", 800)}`,
    `superpowers: ${clip((brain.superpowers ?? "").trim() || "(empty)", 800)}`,
  ];
  if (results.length === 0) {
    lines.push("client_results: (none — do not invent)");
  } else {
    lines.push(
      "client_results:",
      ...results.slice(0, 6).map((r, i) => {
        const t = (r.title ?? "").trim();
        const s = clip((r.story ?? "").trim(), 400);
        return `  ${i + 1}. ${t || "Untitled"}${s ? ` — ${s}` : ""}`;
      })
    );
  }
  return lines.join("\n");
}

function currentSectionText(
  section: ProfileSectionId,
  snapshot: LinkedInProfileSnapshot,
  draft: ProfileOptimizerDraft,
  experienceIndex: number
): string {
  if (section === "headline") {
    return draft.headline?.trim() || snapshot.headline || "(empty)";
  }
  if (section === "about") {
    return draft.about?.trim() || snapshot.about || "(empty)";
  }
  if (section === "banner") {
    return draft.bannerCopy?.trim() || "(no banner copy yet)";
  }
  if (section === "featured") {
    const notes = draft.featuredNotes?.trim();
    const items = snapshot.featured ?? [];
    const live =
      items.length > 0
        ? items
            .map((item, i) => {
              const line = [item.title, item.subtitle, item.url]
                .filter(Boolean)
                .join(" — ");
              return `  ${i + 1}. ${line || "(untitled)"}`;
            })
            .join("\n")
        : "(none imported — scrape often misses Featured)";
    return `Currently pinned:\n${live}${notes ? `\n\nDraft pin advice:\n${notes}` : ""}`;
  }
  const exp = snapshot.experiences[experienceIndex];
  const row = experienceDraftAt(draft, experienceIndex);
  if (!exp && !row) return "(no experience row)";
  const title = row?.title?.trim() || exp?.title || "(no title)";
  const company = exp?.company || "(no company)";
  const description =
    row?.description?.trim() || exp?.description || "(no description)";
  return `Title: ${title}\nCompany: ${company}\nDescription: ${description}`;
}

export function buildRewriteUser(opts: {
  section: ProfileSectionId;
  snapshot: LinkedInProfileSnapshot;
  draft: ProfileOptimizerDraft;
  brain: CoachAiContext | null;
  linkedInSummary: string;
  instruction: string | null;
  experienceIndex: number;
}): string {
  const sectionGuide: Record<ProfileSectionId, string> = {
    headline: "Rewrite the HEADLINE only. Each variant.text is the full headline.",
    about: "Rewrite the ABOUT section only. Each variant.text is the full About.",
    experience:
      "Rewrite the CURRENT ROLE (title + description). Each variant.text should be the description, optionally starting with a suggested title on the first line then a blank line then the description.",
    banner:
      "Write BANNER COPY only (who they help + the result). Each variant.text is one short line or two.",
    featured:
      "Write FEATURED pin advice only. Each variant.text is a short numbered list of 2–4 items to pin (newsletter, proof, lead magnet) and one line why. Do not invent URLs.",
  };

  const extra = opts.instruction
    ? `\nCoach direction (honour this):\n${opts.instruction}`
    : "";

  return `Section to rewrite: ${opts.section}
${sectionGuide[opts.section]}

Current ${opts.section} copy:
${currentSectionText(opts.section, opts.snapshot, opts.draft, opts.experienceIndex)}

Profile summary:
${opts.linkedInSummary}

Coach brain:
${formatBrain(opts.brain)}
${extra}`;
}
