import { supabaseAdmin } from "@/lib/supabaseAdmin";
import {
  loadBrandKnowledgeOverrides,
  type BrandKnowledgeFileMeta,
} from "@/lib/profitCoachAi/brandKnowledge";

/** In-memory overrides for this process. Refresh at the start of each Ava turn. */
const cache = new Map<string, string>();

/** Who may open each Ava skill (Admin → Ava → Skills). No entry = the frontmatter default. */
export type SkillAccess = "everyone" | "agent" | "admin" | "off";

export const SKILL_ACCESS_VALUES: SkillAccess[] = ["everyone", "agent", "admin", "off"];

const skillAccess = new Map<string, SkillAccess>();

export function peekSkillAccess(skillId: string): SkillAccess | undefined {
  return skillAccess.get(skillId);
}

function isSkillAccess(value: unknown): value is SkillAccess {
  return typeof value === "string" && (SKILL_ACCESS_VALUES as string[]).includes(value);
}

export function peekAgentOverride(relPath: string): string | undefined {
  return cache.get(relPath);
}

export function peekAllAgentOverrides(): Record<string, string> {
  return Object.fromEntries(cache);
}

/** Evals only: try an edited file (a skill, a rubric) in this process before anyone saves it. */
export function setAgentOverrideForEval(relPath: string, content: string): void {
  cache.set(relPath, content);
}

/**
 * Load admin edits. Agent files live in agent_context_files (path under content/).
 * Brand files Ava also reads (ai-knowledge/…) come from brand_knowledge_files.
 */
export async function refreshAgentContextOverrides(): Promise<void> {
  const access = refreshSkillAccess();
  cache.clear();
  const { data, error } = await supabaseAdmin
    .from("agent_context_files")
    .select("file, content");
  if (error) {
    console.error("refreshAgentContextOverrides:", error.message);
  } else {
    for (const row of data ?? []) {
      if (typeof row.file === "string" && typeof row.content === "string") {
        cache.set(row.file, row.content);
      }
    }
  }
  const brand = await loadBrandKnowledgeOverrides();
  for (const [file, content] of Object.entries(brand)) {
    cache.set(`ai-knowledge/${file}`, content);
  }
  await access;
}

/** On a failed read, keep the last settings rather than fall back to defaults, so an Off skill stays off. */
async function refreshSkillAccess(): Promise<void> {
  const { data, error } = await supabaseAdmin.from("ava_skill_settings").select("skill_id, access");
  if (error) {
    console.error("refreshSkillAccess:", error.message);
    return;
  }
  skillAccess.clear();
  for (const row of data ?? []) {
    if (typeof row.skill_id === "string" && isSkillAccess(row.access)) {
      skillAccess.set(row.skill_id, row.access);
    }
  }
}

export function brandPath(meta: BrandKnowledgeFileMeta): string {
  return `ai-knowledge/${meta.file}`;
}
