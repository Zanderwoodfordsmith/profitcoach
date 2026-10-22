import { blocksToMarkdown } from "./blocks";
import { BLUEPRINT_GROUPS, fieldValue, sectionKey, type BlueprintLink, type FieldSpec } from "./blueprint";
import { DECISION_GROUPS, proposedDecision } from "./decisionDefaults";
import { careerLine } from "./careerRoles";
import { isClientResult, resultChange, resultKind } from "./results";
import type {
  CareerResult,
  CareerRole,
  ClientResultStory,
  DecisionRecordRow,
  PracticeKnowledgePayload,
  PracticeKnowledgeRow,
} from "./types";
import { TONE_DIMENSIONS, asVoiceTone } from "./voiceTone";

/**
 * The Practice Blueprint as one Markdown file, in document order. Written so
 * a coach can drop it into their own AI and it knows their whole practice.
 */

export function formatFieldValue(payload: PracticeKnowledgePayload, field: FieldSpec): string[] {
  const raw = fieldValue(payload, field.path)?.value;
  if (raw == null) return [];
  if (field.widget === "tone") {
    const tone = asVoiceTone(raw);
    return tone ? TONE_DIMENSIONS.map((d) => `${d.left} to ${d.right}: ${d.stops[tone[d.key] - 1]}`) : [];
  }
  switch (field.kind) {
    case "career":
      return (raw as CareerRole[]).filter((r) => r.show).map(careerLine);
    case "chips":
    case "list": {
      const items = Array.isArray(raw) ? raw : String(raw).split(/\n+/);
      return items.map(String).map((v) => v.trim()).filter(Boolean);
    }
    case "results":
      return (raw as CareerResult[]).map((r) =>
        [
          resultKind(r),
          isClientResult(r) ? [r.client_name, r.company].filter(Boolean).join(", ") : [r.role, r.company].filter(Boolean).join(", "),
          resultChange(r),
          r.timeframe,
          r.mechanism ? `by ${r.mechanism}` : "",
          r.quote ? `"${r.quote}"` : "",
          r.website,
          r.case_study_url,
        ]
          .filter(Boolean)
          .join(" · ")
      );
    case "stories":
      return (raw as ClientResultStory[]).map((c) => [c.title, c.story].filter(Boolean).join(": "));
    case "rows":
      return (raw as Record<string, string>[])
        .map((row) =>
          (field.columns ?? [])
            .map((column) => String(row[column.key] ?? "").trim())
            .filter(Boolean)
            .join(" · ")
        )
        .filter(Boolean);
    case "enum": {
      const value = String(raw);
      return [field.options?.find((o) => o.value === value)?.label ?? value];
    }
    default:
      return String(raw).trim() ? [String(raw).trim()] : [];
  }
}

function decisionsMarkdown(row: PracticeKnowledgeRow, decision: DecisionRecordRow | null): string {
  const locked = Boolean(decision?.locked_at);
  const values = decision ? decision.payload : proposedDecision(row);
  const parts: string[] = [
    locked ? "_Agreed on the Decision Call._" : "_Proposed by BCA. Agreed on the Decision Call._",
  ];
  for (const group of DECISION_GROUPS) {
    const lines = group.fields
      .filter((f) => values[f.key]?.trim())
      .map((f) => `- **${f.label}:** ${values[f.key].trim()}`);
    if (lines.length) parts.push(`### ${group.label}`, lines.join("\n"));
  }
  return parts.join("\n\n");
}

function pageMarkdown(page: BlueprintLink, row: PracticeKnowledgeRow, decision: DecisionRecordRow | null): string {
  const parts: string[] = [`## ${page.title}`, `_${page.summary}_`];
  if (page.slug === "decisions") {
    parts.push(decisionsMarkdown(row, decision));
    return parts.join("\n\n");
  }
  for (const section of page.sections) {
    const key = sectionKey(page, section);
    parts.push(`### ${section.title}`);
    if (section.source === "we_build") {
      const built = row.built_sections[key];
      parts.push(built ? blocksToMarkdown(built.blocks, 4) : "_Not written yet._");
      continue;
    }
    const lines: string[] = [];
    for (const field of section.fields ?? []) {
      const values = formatFieldValue(row.payload, field);
      if (!values.length) continue;
      lines.push(values.length === 1 ? `- **${field.label}:** ${values[0]}` : `- **${field.label}:**\n${values.map((v) => `  - ${v}`).join("\n")}`);
    }
    parts.push(lines.length ? lines.join("\n") : "_Still open._");
  }
  if (page.learn?.length) {
    parts.push(`### In the Classroom\n\n${page.learn.map((l) => `- ${l.label}`).join("\n")}`);
  }
  return parts.join("\n\n");
}

export function blueprintMarkdown(
  row: PracticeKnowledgeRow,
  opts: { coachName: string; pageSlug?: string; decision?: DecisionRecordRow | null }
): string {
  const date = new Date().toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
  const header = [
    `# The Practice Blueprint: ${opts.coachName}`,
    `_Prepared by Business Coach Academy · ${date}_`,
    "",
    "This file is your whole practice in one place: your decisions, your proof, your market, your avatar and their pain points, your offer, your messages and your plan. Give it to any AI assistant as context and it will write in your voice, to your market.",
  ].join("\n");

  const chapters: string[] = [];
  // The decisions lead the full download: everything else is written from them.
  if (!opts.pageSlug) {
    chapters.push(["# Your Decisions", decisionsMarkdown(row, opts.decision ?? null)].join("\n\n"));
  }
  BLUEPRINT_GROUPS.forEach((group) => {
    const pages = group.pages.filter(
      (p) =>
        p.slug !== "blueprint" &&
        (p.slug !== "command" || p.sections.length > 0) &&
        (!opts.pageSlug || p.slug === opts.pageSlug)
    );
    if (!pages.length) return;
    chapters.push(
      [`# ${group.label}`, `_${group.intro}_`, ...pages.map((p) => pageMarkdown(p, row, opts.decision ?? null))].join("\n\n")
    );
  });
  return `${header}\n\n---\n\n${chapters.join("\n\n---\n\n")}\n`;
}

/** A safe file name, for example "pam-woodford-practice-blueprint.md". */
export function blueprintFileName(coachName: string, pageSlug?: string): string {
  const base = coachName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "coach";
  return `${base}-${pageSlug ? `${pageSlug}-` : ""}practice-blueprint.md`;
}
