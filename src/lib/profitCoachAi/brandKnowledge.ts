import * as fs from "node:fs";
import * as path from "node:path";

import { supabaseAdmin } from "@/lib/supabaseAdmin";

/**
 * The brand knowledge ("verbal canon") files loaded into every Profit Coach
 * AI prompt. Repo files under content/ai-knowledge are the defaults; rows in
 * brand_knowledge_files override them (editable from Admin → Brand → Canon).
 */

export type BrandKnowledgeGroup = "core" | "skill";

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
  const dir =
    (meta.dir ?? (meta.group === "core" ? "ai-knowledge" : "legacy")) ===
    "ai-knowledge"
      ? CORE_DIR
      : SKILL_DIR;
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
