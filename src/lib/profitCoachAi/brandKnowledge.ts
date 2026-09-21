import * as fs from "node:fs";
import * as path from "node:path";

import { supabaseAdmin } from "@/lib/supabaseAdmin";

/**
 * The brand knowledge ("verbal canon") files loaded into every Profit Coach
 * AI prompt. Repo files under content/ai-knowledge are the defaults; rows in
 * brand_knowledge_files override them (editable from Admin → Brand → Canon).
 */

export type BrandKnowledgeGroup = "core" | "skill" | "reply-copilot";

export type BrandKnowledgeFileMeta = {
  file: string;
  label: string;
  description: string;
  /** core = loaded into every prompt; skill = loaded by specific skills. */
  group: BrandKnowledgeGroup;
  /** Repo directory the default content lives in. */
  dir?: "ai-knowledge" | "legacy";
};

export const BRAND_KNOWLEDGE_FILES: BrandKnowledgeFileMeta[] = [
  {
    file: "PROFIT_COACH_AI_ROUTER.md",
    label: "AI router & identity",
    description:
      "Where the AI map lives — skills, knowledge files, Create hub. Keep short; not the canon.",
    group: "core",
  },
  {
    file: "methodology.md",
    label: "Core methodology",
    description:
      "The BOSS/Profit System canon (from Drive _brand) — loaded in every prompt.",
    group: "core",
  },
  {
    file: "icp.md",
    label: "ICP (compact)",
    description:
      "Who BOSS serves, in brief (from Drive _brand) — loaded in every prompt.",
    group: "core",
  },
  {
    file: "business-profile.md",
    label: "Business profile",
    description:
      "What BCA/Profit Coach is, offers, and claims (from Drive _brand) — loaded in every prompt.",
    group: "core",
  },
  {
    file: "brand-voice.md",
    label: "Voice",
    description:
      "How we write. Still a stub in Drive too — the writing work is genuinely open.",
    group: "core",
  },
  {
    file: "offer-stack.md",
    label: "Offer stack",
    description:
      "Offers, pricing and claims (from Drive _brand) — loaded in every prompt so copy never invents prices.",
    group: "core",
  },
  {
    file: "writing-rules.md",
    label: "Writing rules",
    description:
      "Shared writing rules across brands (from Drive _brand) — loaded in every prompt.",
    group: "core",
  },
  {
    file: "avatar-profile.md",
    label: "Avatar profile",
    description:
      "The full BOSS buyer avatar (from Drive _brand) — loaded for outward-facing copy skills.",
    group: "skill",
    dir: "ai-knowledge",
  },
  {
    file: "copywriter-knowledge.md",
    label: "Copywriter knowledge",
    description:
      "Copywriting patterns and rules (from Drive _brand) — loaded for outward-facing copy skills.",
    group: "skill",
    dir: "ai-knowledge",
  },
  {
    file: "connection-messages.md",
    label: "Connection messages playbook",
    description:
      "The connector message structure, 10-step checklist and red flags — loaded by the outreach skills.",
    group: "skill",
  },
  {
    file: "follow-up-campaigns.md",
    label: "Follow-up campaigns",
    description:
      "Follow-up sequences after the connection — loaded by the outreach skills.",
    group: "skill",
  },
  {
    file: "connector-message-feedback.csv",
    label: "Message feedback data (CSV)",
    description:
      "Real connector message feedback — what got replies. Loaded by the outreach skills.",
    group: "skill",
  },
  {
    file: "reply-copilot/ROUTER.md",
    label: "Reply copilot router",
    description:
      "Layer 1 map: classify the inbound, then follow that situation. Skills tab edits the live copy of this.",
    group: "reply-copilot",
    dir: "ai-knowledge",
  },
  {
    file: "reply-copilot/shared-rules.md",
    label: "Reply copilot shared rules",
    description:
      "Layer 3 factory: chat conduct, LVQ, scorecard path, personalisation. Loaded on every suggestion.",
    group: "reply-copilot",
    dir: "ai-knowledge",
  },
  {
    file: "reply-copilot/situations/interested.md",
    label: "Situation: interested",
    description: "Yes / tell me more → scorecard, not a calendar link.",
    group: "reply-copilot",
    dir: "ai-knowledge",
  },
  {
    file: "reply-copilot/situations/question.md",
    label: "Situation: question",
    description: "They asked how it works, price, or who it is for.",
    group: "reply-copilot",
    dir: "ai-knowledge",
  },
  {
    file: "reply-copilot/situations/not-yet.md",
    label: "Situation: not yet",
    description: "Maybe later / busy. Ask what they are focused on.",
    group: "reply-copilot",
    dir: "ai-knowledge",
  },
  {
    file: "reply-copilot/situations/thumbs-up.md",
    label: "Situation: thumbs-up",
    description: "👍 or ok only. Clarify interest vs agreement.",
    group: "reply-copilot",
    dir: "ai-knowledge",
  },
  {
    file: "reply-copilot/situations/fine-for-now.md",
    label: "Situation: fine for now",
    description: "We're good. Every level has its devil.",
    group: "reply-copilot",
    dir: "ai-knowledge",
  },
  {
    file: "reply-copilot/situations/no-thanks.md",
    label: "Situation: no thanks",
    description: "Decline. Clarify this message, profit, or never again.",
    group: "reply-copilot",
    dir: "ai-knowledge",
  },
  {
    file: "reply-copilot/situations/objection.md",
    label: "Situation: objection",
    description: "Price, time, already have someone. Acknowledge, then ask.",
    group: "reply-copilot",
    dir: "ai-knowledge",
  },
  {
    file: "reply-copilot/situations/quiet.md",
    label: "Situation: quiet",
    description: "Went silent after interest. New value, not guilt.",
    group: "reply-copilot",
    dir: "ai-knowledge",
  },
  {
    file: "reply-copilot/situations/scorecard-done.md",
    label: "Situation: scorecard done",
    description: "They completed the scorecard. Offer a 30-minute review.",
    group: "reply-copilot",
    dir: "ai-knowledge",
  },
];

const CORE_DIR = path.join(process.cwd(), "content", "ai-knowledge");
const SKILL_DIR = path.join(process.cwd(), "src", "knowledge");

function metaFor(file: string): BrandKnowledgeFileMeta | undefined {
  return BRAND_KNOWLEDGE_FILES.find((f) => f.file === file);
}

export function isBrandKnowledgeFile(file: string): boolean {
  return metaFor(file) !== undefined;
}

/** Repo default content (null when the file doesn't exist). */
export function readBrandKnowledgeRepoFile(file: string): string | null {
  const meta = metaFor(file);
  if (!meta) return null;
  const dirKind =
    meta.dir ??
    (meta.group === "core" || meta.group === "reply-copilot"
      ? "ai-knowledge"
      : "legacy");
  const dir = dirKind === "ai-knowledge" ? CORE_DIR : SKILL_DIR;
  const p = path.join(dir, file);
  if (!fs.existsSync(p)) return null;
  return fs.readFileSync(p, "utf8");
}

/** DB overrides keyed by filename. */
export async function loadBrandKnowledgeOverrides(): Promise<
  Record<string, string>
> {
  const { data, error } = await supabaseAdmin
    .from("brand_knowledge_files")
    .select("file, content");
  if (error) {
    console.error("loadBrandKnowledgeOverrides:", error.message);
    return {};
  }
  const map: Record<string, string> = {};
  for (const row of data ?? []) {
    if (typeof row.file === "string" && typeof row.content === "string") {
      map[row.file] = row.content;
    }
  }
  return map;
}
