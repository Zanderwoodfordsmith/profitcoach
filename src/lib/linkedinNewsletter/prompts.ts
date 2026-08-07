import type { NewsletterBrainBundle } from "./loadBrainContext";
import type {
  NewsletterEditionKind,
  NewsletterFixedBlocks,
  NewsletterFormat,
  NewsletterLengthMode,
  Overview537,
} from "./types";
import { lengthGuidance } from "./types";

export const OVERVIEW_537_SYSTEM = `You are Pam Woodford's LinkedIn newsletter strategist for Business Coach Academy coaches.
Given the coach's AI brain (ICP, pains, hooks, vocabulary, proof) and a lead topic, produce ONE overview newsletter plan in the classic 5-3-7 structure.

Rules:
- One topic only. Practical, owner language, no fluff.
- Exactly 5 strategies, 3 critical mistakes, 7 checklist items.
- Each item is a short, concrete line a busy owner can act on.
- Strategies should map to real profit levers for THIS coach's niche when brain data exists.
- Mistakes should be costly, common, and specific — not generic "don't give up".
- Checklist items are doable this week.
- Also suggest 3–6 newsletter NAME options (say-what-it-is-on-the-tin, niche + profit/outcome).
- Return ONLY valid JSON matching the schema.`;

export function buildOverview537User(opts: {
  leadTopic: string;
  brain: NewsletterBrainBundle;
  newsletterNameHint?: string | null;
}): string {
  return [
    `Lead topic / pain: ${opts.leadTopic}`,
    opts.newsletterNameHint
      ? `Existing newsletter name hint: ${opts.newsletterNameHint}`
      : "Newsletter not named yet — propose names.",
    "",
    "## Coach AI brain (from First Campaign / marketing messaging)",
    opts.brain.brainText,
    "",
    "## Extra avatar hooks",
    opts.brain.avatarHooks.length
      ? opts.brain.avatarHooks.map((h) => `- ${h}`).join("\n")
      : "(none)",
    "",
    "## Pain lines",
    opts.brain.painLines.length
      ? opts.brain.painLines.map((p) => `- ${p}`).join("\n")
      : "(none)",
    "",
    "## LinkedIn snapshot",
    opts.brain.linkedInSummary.slice(0, 2000),
    "",
    "Return JSON:",
    `{
  "lead_topic": string,
  "strategies": string[5],
  "mistakes": string[3],
  "checklist": string[7],
  "name_ideas": string[],
  "series_tagline": string
}`,
  ].join("\n");
}

export const EDITION_DRAFT_SYSTEM = `You write LinkedIn newsletter EDITION drafts for BCA coaches, for copy/paste into LinkedIn's newsletter editor.

You NEVER regenerate blindly when revising — when given an existing body and an instruction, patch that artifact in place.

House rules (Pam / Profit Patter):
- One topic per edition.
- Short sentences and short paragraphs; break with emoji subheads and ________ dividers.
- No more than ~20 lines between image placeholders. Insert [IMAGE: pull quote or relevant visual] markers where images should go.
- Say "workshop" or "event", never "webinar".
- Soft CTA most weeks; hard offer at most every 3–4 issues.
- Use the coach's industry vocabulary and pain language from the brain.
- Include SEO title + SEO description (under 160 chars for description).
- Also write a short LinkedIn FEED promo post (hook + why read + soft subscribe CTA) in promo_post.

Formatting for paste into LinkedIn:
- Use markdown: **bold**, headings with ##, numbered lists, bullet lists.
- Keep emoji subheads Pam-style where using pam formats.
- End with subscribe/share + short bio block if fixed_blocks provided (do not invent a fake bio).

Return ONLY valid JSON.`;

function formatInstructions(format: NewsletterFormat): string {
  switch (format) {
    case "pam_537_overview":
      return `Use Pam's overview structure:
Hi + (use fixed intro if provided) + "This week we're looking at…"
💥 Headline
👀 Sub-headline sections
✅ 5 Strategies You Can Do Right Now (expand each of the 5 briefly)
⚠️ 3 Critical Mistakes to Avoid
🧰 More Tools / useful resource
🧾 7-Point Checklist
🤝 Soft CTA / workshop if fixed CTA exists
✍️ Bio (from fixed_blocks)
👉 Subscribe and Share
💬 Over to You (engagement question)`;
    case "pam_deep_dive":
      return `Deep dive on ONE item from the cascade. Interrupt → Engage → Educate → Offer arc.
Include one clear action step and Over to You question. Still image-spaced.`;
    case "quick_insight":
    case "timely_pov":
      return `Quick insight / timely point of view. One clear takeaway. Scannable. Soft CTA.`;
    case "in_depth":
      return `In-depth guide or case study. Still skimmable with bold subheads and bullets. Truly valuable — no padding.`;
    case "breezy_story":
      return `Breezy structure:
1) Quick personal story or POV
2) Teach ONE clear takeaway
3) Link/resource placeholder [RESOURCE LINK]
4) Soft CTA (comment/reply). Hard sell only if asked.`;
    case "curated_roundup":
      return `Curated roundup style (Adam Graham-like): short welcome thread, 5–7 items each with your take + "Find out more", optional AI/prompt-of-the-week block, reply invitation.`;
    default:
      return "Clear, scannable newsletter edition.";
  }
}

export function buildEditionDraftUser(opts: {
  seriesName: string;
  leadTopic: string | null;
  overview: Overview537;
  kind: NewsletterEditionKind;
  kindIndex: number | null;
  title: string;
  tagline: string | null;
  format: NewsletterFormat;
  lengthMode: NewsletterLengthMode;
  fixedBlocks: NewsletterFixedBlocks;
  brain: NewsletterBrainBundle;
  existingBody?: string | null;
  reviseInstruction?: string | null;
}): string {
  const focusLine = (() => {
    if (opts.kind === "strategy" && opts.kindIndex) {
      return `Focus strategy #${opts.kindIndex}: ${opts.overview.strategies[opts.kindIndex - 1] ?? opts.title}`;
    }
    if (opts.kind === "mistake" && opts.kindIndex) {
      return `Focus mistake #${opts.kindIndex}: ${opts.overview.mistakes[opts.kindIndex - 1] ?? opts.title}`;
    }
    if (opts.kind === "checklist" && opts.kindIndex) {
      return `Focus checklist #${opts.kindIndex}: ${opts.overview.checklist[opts.kindIndex - 1] ?? opts.title}`;
    }
    if (opts.kind === "overview_537") {
      return `Full overview of lead topic with all 5-3-7 items.`;
    }
    return `Topic: ${opts.title}`;
  })();

  return [
    `Newsletter: ${opts.seriesName}`,
    `Lead topic for series: ${opts.leadTopic ?? "(unset)"}`,
    `Edition title: ${opts.title}`,
    `Tagline: ${opts.tagline ?? ""}`,
    `Kind: ${opts.kind}`,
    focusLine,
    `Format: ${opts.format}`,
    lengthGuidance(opts.lengthMode),
    "",
    "## Format instructions",
    formatInstructions(opts.format),
    "",
    "## Overview 5-3-7 (series)",
    JSON.stringify(opts.overview, null, 2),
    "",
    "## Fixed blocks (keep verbatim where present)",
    JSON.stringify(opts.fixedBlocks, null, 2),
    "",
    "## Coach AI brain",
    opts.brain.brainText,
    "",
    opts.existingBody?.trim()
      ? [
          "## Existing artifact (edit this — do not start from scratch unless asked)",
          opts.existingBody.trim(),
          "",
          opts.reviseInstruction?.trim()
            ? `## Revision instruction\n${opts.reviseInstruction.trim()}`
            : "## Revision instruction\nRefresh lightly while preserving structure and voice.",
        ].join("\n")
      : "## Existing artifact\n(none — write a fresh draft)",
    "",
    "Return JSON:",
    `{
  "title": string,
  "tagline": string,
  "seo_title": string,
  "seo_description": string,
  "body_markdown": string,
  "promo_post": string,
  "cover_headline": string,
  "cover_tagline": string,
  "word_count_estimate": number
}`,
  ].join("\n");
}

export const NAME_IDEAS_SYSTEM = `Suggest LinkedIn newsletter names for a BCA coach.
Rules from Pam: say what it is on the tin — niche + profit/outcome (e.g. "Law Firm Profit Newsletter").
Avoid vague clever names. Return ONLY JSON: { "ideas": string[], "taglines": string[] }`;

export function buildNameIdeasUser(brain: NewsletterBrainBundle): string {
  return [
    "Suggest 8 newsletter names and 5 taglines.",
    "",
    brain.brainText,
    "",
    `Industry hint: ${brain.industryLabel ?? "unknown"}`,
  ].join("\n");
}

export const TOPIC_IDEAS_SYSTEM = `Suggest LinkedIn newsletter topics that build authority and attract leads for this coach.
Prefer: client questions, myths/mistakes, deepen top content angles, timely POV.
Return ONLY JSON: { "topics": Array<{ "title": string, "angle": string, "why": string }> }`;
