import * as fs from "node:fs";
import * as path from "node:path";

import { COMMUNITY_COPILOT_ROUTER_FILE, OUTREACH_RESEARCH_FILE } from "@/lib/communityCopilot";
import { LINKEDIN_METHOD_FILE } from "@/lib/linkedinProfileOptimizer/loadRewriteSystem";
import { PROFILE_SECTIONS } from "@/lib/linkedinProfileOptimizer/types";
import {
  REPLY_COPILOT_ROUTER_FILE,
  REPLY_COPILOT_SHARED_RULES_FILE,
  REPLY_COPILOT_SITUATION_FILES,
} from "@/lib/messaging/replyCopilotKnowledge";
import { flowGraph } from "@/lib/practiceKnowledge/flow";
import { SECTION_SKILLS, skillSystemPrompt } from "@/lib/practiceKnowledge/skills";
import { BRAND_KNOWLEDGE_FILES } from "@/lib/profitCoachAi/brandKnowledge";
import { PROFIT_COACH_OUTPUTS } from "@/lib/profitCoachAi/registry";
import { SUPPORT_COPILOT_PLAYBOOK_FILE, SUPPORT_COPILOT_ROUTER_FILE } from "@/lib/support/supportCopilot";

/**
 * Admin → Ava → Knowledge: every knowledge file, grouped by when it is read,
 * with what reads it. Built from the same lists the prompts are built from
 * (capability frontmatter, the Blueprint flow, the Create hub registry), so
 * "Not used by anything" stays true. Server only.
 */

export type AvaUserKind = "ava" | "writer" | "create" | "feature";

export type AvaFileUser = { kind: AvaUserKind; id: string; label: string; href: string };

export type AvaKnowledgeGroup = "every" | "skill" | "unused";

export type AvaKnowledgeRow = {
  id: string;
  label: string;
  group: AvaKnowledgeGroup;
  chars: number;
  tokens: number;
  /** When it was last saved here, or null when the repo file is live. */
  editedAt: string | null;
  /** The repo file's own date, when there is one. */
  repoAt: string | null;
  usedBy: AvaFileUser[];
  editable: boolean;
  missing: boolean;
};

export type AvaCreateSkill = {
  id: string;
  label: string;
  href: string;
  /** id is null for files outside the Knowledge list (playbooks). */
  files: { id: string | null; label: string }[];
};

/** Ava's files that load in every chat, in Brain order. */
export const AVA_ALWAYS_FILES = ["agent/AGENT.md", "agent/ROUTER.md", "agent/VOICE.md"] as const;

const CREATE_ROUTER = "ai-knowledge/PROFIT_COACH_AI_ROUTER.md";

const CONTENT_ROOT = path.join(process.cwd(), "content");

/** Folders whose Markdown is knowledge (capability CONTEXT.md files are skills, so not here). */
const KNOWLEDGE_DIRS = ["ai-knowledge", "agent/references", "practice-skills"] as const;

/** Read straight from the repo file, so an edit saved here would never reach them. */
const REPO_ONLY = new Set<string>([
  "agent/references/phased-pitch.md",
  LINKEDIN_METHOD_FILE.replace(/^content\//, ""),
  ...PROFILE_SECTIONS.map((s) => `practice-skills/linkedin-profile/${s}.md`),
]);

export function isRepoOnlyKnowledge(id: string): boolean {
  return REPO_ONLY.has(id);
}

function walk(rel: string): string[] {
  const full = path.join(CONTENT_ROOT, rel);
  if (!fs.existsSync(full)) return [];
  const out: string[] = [];
  for (const entry of fs.readdirSync(full, { withFileTypes: true })) {
    const child = `${rel}/${entry.name}`;
    if (entry.isDirectory()) out.push(...walk(child));
    else if (entry.name.endsWith(".md") && entry.name !== "README.md") out.push(child);
  }
  return out;
}

/** Every knowledge file on disk, as ids under content/. */
export function knowledgeFileIds(): string[] {
  return KNOWLEDGE_DIRS.flatMap((dir) => walk(dir)).sort();
}

export function repoFileDate(id: string): string | null {
  if (id.startsWith("code:")) return null;
  const full = path.join(CONTENT_ROOT, id);
  try {
    return fs.statSync(full).mtime.toISOString();
  } catch {
    return null;
  }
}

function brandLabel(file: string): string {
  return BRAND_KNOWLEDGE_FILES.find((f) => f.file === file)?.label ?? file.replace(/\.md$/, "");
}

/** Other AI features that read knowledge files, each from the module that loads them. */
function featureReaders(): { user: AvaFileUser; files: string[] }[] {
  return [
    {
      user: {
        kind: "feature",
        id: "inbox-replies",
        label: "Inbox reply drafts",
        href: "/admin/brand?tab=brain&brainTab=skills&open=reply_copilot",
      },
      files: [REPLY_COPILOT_ROUTER_FILE, REPLY_COPILOT_SHARED_RULES_FILE, ...Object.values(REPLY_COPILOT_SITUATION_FILES)].map(
        (f) => `ai-knowledge/${f}`
      ),
    },
    {
      user: { kind: "feature", id: "support-replies", label: "Support reply drafts", href: "/admin/support" },
      files: [SUPPORT_COPILOT_ROUTER_FILE, SUPPORT_COPILOT_PLAYBOOK_FILE].map((f) => `ai-knowledge/${f}`),
    },
    {
      user: { kind: "feature", id: "community-replies", label: "Community reply drafts", href: "/admin/community" },
      files: [COMMUNITY_COPILOT_ROUTER_FILE, OUTREACH_RESEARCH_FILE, SUPPORT_COPILOT_PLAYBOOK_FILE].map((f) => `ai-knowledge/${f}`),
    },
    {
      // src/lib/salesCall/ai.ts reads these three from content/agent/references.
      user: { kind: "feature", id: "sales-call", label: "Sales call pitch", href: "/admin/script" },
      files: ["profit-system-pitch.md", "pitch-examples.md", "phased-pitch.md"].map((f) => `agent/references/${f}`),
    },
  ];
}

/** Each Blueprint writer and the files its prompt is built from, and the files every writer reads. */
function writerReaders(): { shared: string[]; writers: { user: AvaFileUser; files: string[] }[] } {
  const graph = flowGraph();
  const shared = graph.shared.filter((s) => s.startsWith("content/")).map((s) => s.slice("content/".length));
  const out: { user: AvaFileUser; files: string[] }[] = [];
  for (const node of graph.nodes) {
    const method = node.writer?.method;
    if (!method?.startsWith("content/")) continue;
    const files = new Set<string>([method.slice("content/".length)]);
    const skill = node.sectionKey ? SECTION_SKILLS[node.sectionKey] : undefined;
    if (skill && node.sectionKey) {
      shared.forEach((f) => files.add(f));
      for (const part of skill.parts ?? []) files.add(`practice-skills/${part}`);
      if (skillSystemPrompt(node.sectionKey)?.includes("# Copywriting method")) {
        files.add("ai-knowledge/copywriting-method.md");
      }
    }
    if (method === LINKEDIN_METHOD_FILE) {
      PROFILE_SECTIONS.forEach((s) => files.add(`practice-skills/linkedin-profile/${s}.md`));
      files.add("ai-knowledge/copywriting-method.md");
    }
    out.push({
      user: { kind: "writer", id: node.id, label: node.label, href: "/admin/ava?tab=flow" },
      files: [...files],
    });
  }
  return { shared, writers: out };
}

export function createHubSkills(): AvaCreateSkill[] {
  return PROFIT_COACH_OUTPUTS.map((output) => ({
    id: output.id,
    label: output.label,
    href: `/admin/brand?tab=brain&brainTab=skills&open=${encodeURIComponent(output.id)}`,
    files: [
      { id: CREATE_ROUTER, label: brandLabel("PROFIT_COACH_AI_ROUTER.md") },
      ...output.brandFiles.map((f) => ({ id: `ai-knowledge/${f}`, label: brandLabel(f) })),
      ...output.knowledgeRefs.map((ref) => {
        if (ref.type === "ai-knowledge") return { id: `ai-knowledge/${ref.file}`, label: brandLabel(ref.file) };
        if (ref.type === "practice-skill") return { id: `practice-skills/${ref.file}`, label: ref.file.replace(/\.md$/, "") };
        if (ref.type === "legacy-knowledge") return { id: null, label: ref.file };
        return { id: null, label: `Playbook: ${path.basename(ref.path).replace(/\.md$/, "")}` };
      }),
    ],
  }));
}

/**
 * Who reads each file. A file every Blueprint writer reads (the flow's shared
 * list) or every Create hub skill reads gets one chip instead of dozens.
 */
export function knowledgeUsers(
  capabilities: { id: string; title: string; references: string[]; practiceSkillIds: string[] }[]
): Map<string, AvaFileUser[]> {
  const users = new Map<string, AvaFileUser[]>();
  const add = (file: string, user: AvaFileUser) => {
    const list = users.get(file) ?? [];
    if (!list.some((u) => u.kind === user.kind && u.id === user.id)) list.push(user);
    users.set(file, list);
  };

  for (const id of AVA_ALWAYS_FILES) {
    add(id, { kind: "ava", id: "every-chat", label: "Every Ava chat", href: "/admin/ava?tab=brain" });
  }

  for (const cap of capabilities) {
    const user: AvaFileUser = {
      kind: "ava",
      id: cap.id,
      label: cap.title,
      href: `/admin/ava?tab=skills&open=${encodeURIComponent(cap.id)}`,
    };
    for (const ref of [...cap.references, ...cap.practiceSkillIds]) add(ref, user);
  }

  const { shared, writers } = writerReaders();
  const sharedWriterFiles = new Set(shared);
  const everyWriter: AvaFileUser = { kind: "writer", id: "every-writer", label: "Every Blueprint writer", href: "/admin/ava?tab=flow" };
  for (const { user, files } of writers) {
    for (const file of files) add(file, sharedWriterFiles.has(file) ? everyWriter : user);
  }

  const hub = createHubSkills();
  const everyCreate: AvaFileUser = {
    kind: "create",
    id: "every-create",
    label: "Every Create hub skill",
    href: "/admin/brand?tab=brain&brainTab=skills",
  };
  const hubCount = new Map<string, number>();
  for (const skill of hub) for (const f of skill.files) if (f.id) hubCount.set(f.id, (hubCount.get(f.id) ?? 0) + 1);
  for (const skill of hub) {
    const user: AvaFileUser = { kind: "create", id: skill.id, label: skill.label, href: skill.href };
    for (const f of skill.files) {
      if (!f.id) continue;
      add(f.id, hubCount.get(f.id) === hub.length ? everyCreate : user);
    }
  }

  for (const { user, files } of featureReaders()) for (const file of files) add(file, user);

  return users;
}
