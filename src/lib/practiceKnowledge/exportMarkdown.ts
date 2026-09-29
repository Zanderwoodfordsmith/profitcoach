import { blocksToMarkdown } from "./blocks";
import {
  BLUEPRINT_GROUPS,
  fieldValue,
  SECTION_SOURCES,
  type BlueprintLink,
  type FieldSpec,
} from "./blueprint";
import { guidePage, type GuidePage } from "./clientSessions";
import { STANDARD_SECTIONS } from "./standard";
import type { CareerResult, ClientResultStory, PracticeKnowledgePayload, PracticeKnowledgeRow } from "./types";

/**
 * The Practice Blueprint as one Markdown file, in document order. Written so
 * a coach can drop it into their own AI and it knows their whole practice.
 */

export function formatFieldValue(payload: PracticeKnowledgePayload, field: FieldSpec): string[] {
  const raw = fieldValue(payload, field.path)?.value;
  if (raw == null) return [];
  switch (field.kind) {
    case "list":
      return (raw as string[]).map(String).filter((v) => v.trim());
    case "results":
      return (raw as CareerResult[]).map((r) =>
        [
          [r.role, r.company].filter(Boolean).join(", "),
          r.metric_from || r.metric_to ? `${r.metric_from || "?"} to ${r.metric_to || "?"}` : "",
          r.timeframe,
          r.mechanism ? `by ${r.mechanism}` : "",
        ]
          .filter(Boolean)
          .join(" · ")
      );
    case "stories":
      return (raw as ClientResultStory[]).map((c) => [c.title, c.story].filter(Boolean).join(": "));
    case "enum": {
      const value = String(raw);
      return [field.options?.find((o) => o.value === value)?.label ?? value];
    }
    default:
      return String(raw).trim() ? [String(raw).trim()] : [];
  }
}

function guideMarkdown(guide: GuidePage): string {
  const parts: string[] = [];
  for (const card of guide.cards) {
    parts.push(`### ${card.title}${card.time ? ` (${card.time})` : ""}`);
    if (card.lede) parts.push(card.lede);
    for (const section of card.sections) {
      parts.push(`#### ${section.heading}`);
      for (const p of section.paragraphs ?? []) parts.push(p);
      if (section.bullets?.length) parts.push(section.bullets.map((b) => `- ${b}`).join("\n"));
      if (section.rows?.length) {
        parts.push(
          ["| Item | Detail | Ask |", "| --- | --- | --- |", ...section.rows.map((r) => `| ${r.name} | ${r.detail} | ${r.ask} |`)].join("\n")
        );
      }
      if (section.links?.length) parts.push(section.links.map((l) => `- [${l.label}](${l.href})`).join("\n"));
    }
  }
  return parts.join("\n\n");
}

function pageMarkdown(page: BlueprintLink, row: PracticeKnowledgeRow): string {
  const parts: string[] = [`## ${page.title}`, `_${page.summary}_`];
  const guide = guidePage(page.slug);
  if (guide) {
    parts.push(guideMarkdown(guide));
    return parts.join("\n\n");
  }
  for (const section of page.sections) {
    const key = `${page.slug}:${section.id}`;
    parts.push(`### ${section.title}`);
    if (section.source === "imported" || section.source === "from_you") {
      const lines: string[] = [];
      for (const field of section.fields ?? []) {
        const values = formatFieldValue(row.payload, field);
        if (!values.length) continue;
        lines.push(values.length === 1 ? `- **${field.label}:** ${values[0]}` : `- **${field.label}:**\n${values.map((v) => `  - ${v}`).join("\n")}`);
      }
      parts.push(lines.length ? lines.join("\n") : "_Still open._");
    } else if (section.source === "we_build") {
      const built = row.built_sections[key];
      parts.push(built ? blocksToMarkdown(built.blocks, 4) : "_Not written yet._");
    } else if (section.source === "standard") {
      const blocks = STANDARD_SECTIONS[key];
      if (blocks) parts.push(blocksToMarkdown(blocks, 4));
    } else {
      parts.push(`_${SECTION_SOURCES.live.hint}_`);
    }
  }
  return parts.join("\n\n");
}

export function blueprintMarkdown(
  row: PracticeKnowledgeRow,
  opts: { coachName: string; pageSlug?: string }
): string {
  const date = new Date().toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
  const header = [
    `# The Practice Blueprint: ${opts.coachName}`,
    `_Prepared by Business Coach Academy · ${date}_`,
    "",
    "This file is your whole practice in one place: your proof, your market, your avatar and their pain points, your offer, your messages and your plan. Give it to any AI assistant as context and it will write in your voice, to your market.",
  ].join("\n");

  const chapters: string[] = [];
  BLUEPRINT_GROUPS.forEach((group) => {
    const pages = group.pages.filter(
      (p) => p.slug !== "command" && p.slug !== "blueprint" && (!opts.pageSlug || p.slug === opts.pageSlug)
    );
    if (!pages.length) return;
    chapters.push(
      [`# ${group.label}`, `_${group.intro}_`, ...pages.map((p) => pageMarkdown(p, row))].join("\n\n")
    );
  });
  return `${header}\n\n---\n\n${chapters.join("\n\n---\n\n")}\n`;
}

/** A safe file name, for example "pam-woodford-practice-blueprint.md". */
export function blueprintFileName(coachName: string, pageSlug?: string): string {
  const base = coachName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "coach";
  return `${base}-${pageSlug ? `${pageSlug}-` : ""}practice-blueprint.md`;
}
