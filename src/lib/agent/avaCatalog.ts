import * as fs from "node:fs";
import * as path from "node:path";

import {
  BRAND_KNOWLEDGE_FILES,
  isBrandKnowledgeFile,
  readBrandKnowledgeRepoFile,
} from "@/lib/profitCoachAi/brandKnowledge";
import { ARTIFACT_LABELS, RUBRIC_FILES } from "@/lib/evals/types";
import { SECTION_SKILLS } from "@/lib/practiceKnowledge/skills";

import { CODE_REFERENCES, loadCapabilities, parseFrontmatter } from "./context";
import { getAgentTool } from "./tools";

const CONTENT_ROOT = path.join(process.cwd(), "content");

export type AvaFileKind =
  | "identity"
  | "router"
  | "capability"
  | "reference"
  | "practice-skill"
  | "brand"
  | "code";

export type AvaFileRecord = {
  id: string;
  label: string;
  description: string;
  kind: AvaFileKind;
  editable: boolean;
  sharedWithBrand: boolean;
  content: string;
  overridden: boolean;
  updated_at: string | null;
  missing: boolean;
};

export type AvaCapabilityRecord = {
  id: string;
  title: string;
  summary: string;
  tools: { name: string; description: string }[];
  references: string[];
  modes: Array<"admin" | "coach">;
  group: string;
  fileId: string;
  practiceSkillIds: string[];
};

export type AvaLayerRecord = {
  id: string;
  layer: 0 | 1 | 2 | 3 | 4;
  title: string;
  question: string;
  summary: string;
  fileIds: string[];
};

export type AvaSkillGroup = {
  id: string;
  title: string;
  hint: string;
  capabilityIds: string[];
};

export type AvaCatalog = {
  layers: AvaLayerRecord[];
  groups: AvaSkillGroup[];
  files: AvaFileRecord[];
  capabilities: AvaCapabilityRecord[];
};

const SKILL_GROUPS: AvaSkillGroup[] = [
  {
    id: "blueprint",
    title: "Blueprint",
    hint: "Fill answers, sharpen a section, write a LinkedIn newsletter, or run the classroom writing skills.",
    capabilityIds: ["practice-ready", "fill-the-gaps", "improve-section", "linkedin-marketing", "blueprint-writing"],
  },
  {
    id: "prospects",
    title: "Prospects",
    hint: "Find people and build lists.",
    capabilityIds: [
      "find-prospects",
      "sales-navigator-import",
      "google-maps-import",
      "google-search-import",
      "lists",
    ],
  },
  {
    id: "campaigns",
    title: "Campaigns",
    hint: "Create campaigns, write messages, move people.",
    capabilityIds: ["campaigns", "campaign-people", "campaign-messaging"],
  },
  {
    id: "sales",
    title: "Sales",
    hint: "The Profit System pitch they learn, then tailor to this prospect.",
    capabilityIds: ["personalised-pitch"],
  },
  {
    id: "guide",
    title: "Guide",
    hint: "Where things are in the app.",
    capabilityIds: ["guide"],
  },
  {
    id: "help",
    title: "Help",
    hint: "Pass a stuck moment to a person. Extreme cases can book Zander.",
    capabilityIds: ["escalate-to-bca"],
  },
  {
    id: "admin",
    title: "Admin",
    hint: "Give a coach access to Ava.",
    capabilityIds: ["coach-access"],
  },
];

const PRACTICE_LABELS: Record<string, string> = {
  "_shared.md": "Shared writing method",
  "story.md": "Story and bio",
  "voice.md": "Voice",
  "core-client.md": "Core client",
  "avatar.md": "Avatar",
  "pain-points.md": "Pain points",
  "prospect-criteria.md": "Prospect criteria",
  "linkedin-profile.md": "LinkedIn profile",
  "campaigns.md": "Campaigns",
  "offer.md": "Offer",
  "sales.md": "Sales and call script",
  "content.md": "Posts",
  "linkedin-newsletter.md": "LinkedIn newsletter",
  "nurture.md": "Nurture",
  "replies.md": "Replies",
  "ninety-days.md": "90-day plan",
};

const AVA_BRAND_FILES = ["writing-rules.md", "brand-voice.md"] as const;

function readRepo(rel: string): string | null {
  const full = path.resolve(CONTENT_ROOT, rel);
  if (!full.startsWith(CONTENT_ROOT + path.sep) || !fs.existsSync(full)) return null;
  return fs.readFileSync(full, "utf8").trim();
}

function fileRecord(
  spec: Omit<AvaFileRecord, "content" | "overridden" | "updated_at" | "missing"> & {
    repo: string | null;
  },
  overrides: Record<string, string>,
  updatedAt: Record<string, string>
): AvaFileRecord {
  const override = overrides[spec.id];
  return {
    id: spec.id,
    label: spec.label,
    description: spec.description,
    kind: spec.kind,
    editable: spec.editable,
    sharedWithBrand: spec.sharedWithBrand,
    content: override ?? spec.repo ?? "",
    overridden: override !== undefined,
    updated_at: updatedAt[spec.id] ?? null,
    missing: spec.repo === null && override === undefined,
  };
}

function practiceSkillIds(): string[] {
  const names = new Set<string>(["_shared.md"]);
  for (const skill of Object.values(SECTION_SKILLS)) names.add(skill.file);
  return [...names].sort().map((name) => `practice-skills/${name}`);
}

function groupForCapability(id: string, frontmatterGroup: string | null): string {
  for (const group of SKILL_GROUPS) {
    if (group.capabilityIds.includes(id)) return group.id;
  }
  return frontmatterGroup || "guide";
}

export function isAvaEditableFile(id: string): boolean {
  if (id.startsWith("code:")) return false;
  if (id.startsWith("agent/")) return true;
  if (id.startsWith("practice-skills/") && id.endsWith(".md") && !id.includes("README")) return true;
  if (id.startsWith("ai-knowledge/")) {
    const file = id.slice("ai-knowledge/".length);
    return isBrandKnowledgeFile(file);
  }
  return false;
}

export function brandFileFromAvaId(id: string): string | null {
  if (!id.startsWith("ai-knowledge/")) return null;
  const file = id.slice("ai-knowledge/".length);
  return isBrandKnowledgeFile(file) ? file : null;
}

export function buildAvaCatalog(opts: {
  overrides: Record<string, string>;
  updatedAt: Record<string, string>;
}): AvaCatalog {
  const { overrides, updatedAt } = opts;
  const files: AvaFileRecord[] = [];

  files.push(
    fileRecord(
      {
        id: "agent/AGENT.md",
        label: "Identity",
        description: "Who she is, how she talks, whose facts she may use. Always loaded.",
        kind: "identity",
        editable: true,
        sharedWithBrand: false,
        repo: readRepo("agent/AGENT.md"),
      },
      overrides,
      updatedAt
    ),
    fileRecord(
      {
        id: "agent/ROUTER.md",
        label: "Router",
        description: "Which skill to open for a request. Always loaded.",
        kind: "router",
        editable: true,
        sharedWithBrand: false,
        repo: readRepo("agent/ROUTER.md"),
      },
      overrides,
      updatedAt
    )
  );

  const capabilities: AvaCapabilityRecord[] = loadCapabilities().map((cap) => {
    const fileId = `agent/capabilities/${cap.id}/CONTEXT.md`;
    const repo = readRepo(`agent/capabilities/${cap.id}/CONTEXT.md`);
    const live = parseFrontmatter(overrides[fileId] ?? repo ?? "");
    const title = typeof live.meta.title === "string" && live.meta.title ? live.meta.title : cap.title;
    const summary =
      typeof live.meta.summary === "string" && live.meta.summary ? live.meta.summary : cap.summary;
    files.push(
      fileRecord(
        {
          id: fileId,
          label: title,
          description: summary,
          kind: "capability",
          editable: true,
          sharedWithBrand: false,
          repo,
        },
        overrides,
        updatedAt
      )
    );
    return {
      id: cap.id,
      title,
      summary,
      tools: cap.tools.map((name) => ({
        name,
        description: getAgentTool(name)?.description ?? "",
      })),
      references: cap.references,
      modes: cap.modes,
      group: groupForCapability(cap.id, cap.group),
      fileId,
      practiceSkillIds:
        cap.id === "blueprint-writing"
          ? practiceSkillIds().filter((id) => id !== "practice-skills/_shared.md")
          : cap.id === "linkedin-marketing"
            ? ["practice-skills/linkedin-newsletter.md", "practice-skills/nurture.md"]
            : cap.id === "personalised-pitch"
              ? ["practice-skills/sales.md"]
              : [],
    };
  });

  const referenceSpecs: { id: string; label: string; description: string }[] = [
    {
      id: "agent/references/blueprint-quality.md",
      label: "Blueprint quality",
      description: "The bar Ava holds answers to when filling gaps or improving a section.",
    },
    {
      id: "agent/references/app-map.md",
      label: "App map",
      description: "Where things live in the product, for the guide skill.",
    },
    {
      id: "agent/references/list-kpis.md",
      label: "List KPIs",
      description: "What a good prospect list looks like.",
    },
    {
      id: "agent/references/campaign-types.md",
      label: "Campaign types",
      description: "The campaign kinds Ava can set up.",
    },
    {
      id: "agent/references/profit-system-pitch.md",
      label: "Profit System pitch",
      description: "The learnable core: pillars, nine steps, and the script they practise.",
    },
    {
      id: "agent/references/pitch-examples.md",
      label: "Pitch patterns",
      description: "Five Golden Thread examples. Shape, not a script to recite.",
    },
    ...Object.entries(RUBRIC_FILES).map(([kind, file]) => ({
      id: `agent/evals/rubrics/${file}`,
      label: `Quality bar: ${ARTIFACT_LABELS[kind as keyof typeof ARTIFACT_LABELS]}`,
      description: "The rubric Ava's evals and the coach audit score this against. Edit the criteria, anchors or weights here.",
    })),
  ];
  for (const spec of referenceSpecs) {
    files.push(
      fileRecord(
        {
          ...spec,
          kind: "reference",
          editable: true,
          sharedWithBrand: false,
          repo: readRepo(spec.id),
        },
        overrides,
        updatedAt
      )
    );
  }

  for (const id of practiceSkillIds()) {
    const name = path.basename(id);
    files.push(
      fileRecord(
        {
          id,
          label: PRACTICE_LABELS[name] ?? name.replace(/\.md$/, ""),
          description:
            name === "_shared.md"
              ? "Loaded with every Blueprint writing skill."
              : "Classroom method Ava uses when she writes this Blueprint section.",
          kind: "practice-skill",
          editable: true,
          sharedWithBrand: false,
          repo: readRepo(id),
        },
        overrides,
        updatedAt
      )
    );
  }

  for (const name of AVA_BRAND_FILES) {
    const meta = BRAND_KNOWLEDGE_FILES.find((f) => f.file === name);
    files.push(
      fileRecord(
        {
          id: `ai-knowledge/${name}`,
          label: meta?.label ?? name,
          description: `${meta?.description ?? "Brand canon."} Shared with Brand → Core brain.`,
          kind: "brand",
          editable: true,
          sharedWithBrand: true,
          repo: readBrandKnowledgeRepoFile(name),
        },
        overrides,
        updatedAt
      )
    );
  }

  for (const [codeId, entry] of Object.entries(CODE_REFERENCES)) {
    files.push({
      id: `code:${codeId}`,
      label: entry.name,
      description: "Lives in code, not a Markdown file. Read-only here.",
      kind: "code",
      editable: false,
      sharedWithBrand: false,
      content: entry.text(),
      overridden: false,
      updated_at: null,
      missing: false,
    });
  }

  const layers: AvaLayerRecord[] = [
    {
      id: "identity",
      layer: 0,
      title: "Identity",
      question: "Where am I?",
      summary: "Always on. Who Ava is, how she talks, and the rules she will not break.",
      fileIds: ["agent/AGENT.md"],
    },
    {
      id: "router",
      layer: 1,
      title: "Router",
      question: "Where do I go?",
      summary: "Always on. The table that picks a skill for the job.",
      fileIds: ["agent/ROUTER.md"],
    },
    {
      id: "skills",
      layer: 2,
      title: "Skills",
      question: "What do I do?",
      summary: "Loaded when she opens a capability. Each file is the contract for that job.",
      fileIds: capabilities.map((cap) => cap.fileId),
    },
    {
      id: "knowledge",
      layer: 3,
      title: "Knowledge",
      question: "What rules apply?",
      summary: "Pulled in with a skill: quality bars, writing rules, classroom method, playbooks.",
      fileIds: files
        .filter((f) => f.kind === "reference" || f.kind === "practice-skill" || f.kind === "brand" || f.kind === "code")
        .map((f) => f.id),
    },
    {
      id: "working",
      layer: 4,
      title: "This coach",
      question: "What am I working with?",
      summary: "Per conversation: the coach's Blueprint, the page they are on, and the chat. Not a file you edit here.",
      fileIds: [],
    },
  ];

  return { layers, groups: SKILL_GROUPS, files, capabilities };
}

