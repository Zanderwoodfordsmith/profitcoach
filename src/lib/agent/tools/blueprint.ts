import { blocksToMarkdown } from "@/lib/practiceKnowledge/blocks";
import { buildOrder, sectionByKey } from "@/lib/practiceKnowledge/blueprint";
import { buildSection, isBuildableSection } from "@/lib/practiceKnowledge/buildSection";
import { ensurePracticeKnowledge } from "@/lib/practiceKnowledge/store";

import type { AgentToolContext, AgentToolDef, AgentToolInput, GateDecision } from "../types";
import { AgentToolError, coachOf, str } from "./util";

/**
 * The Practice Blueprint's written sections (avatar, pain points, LinkedIn
 * rewrite, campaign messaging…). Each is an existing AI skill with a method
 * file from the classroom; the agent runs them rather than writing its own.
 */

function sectionTitle(key: string): string {
  const ref = sectionByKey(key);
  return ref ? `${ref.page.title}: ${ref.section.title}` : key;
}

function sectionKey(input: AgentToolInput): string {
  const key = str(input, "section");
  if (!isBuildableSection(key)) {
    throw new AgentToolError(`"${key}" is not a section we write. Use list_blueprint_sections for the keys.`);
  }
  return key;
}

async function writeGate(input: AgentToolInput, ctx: AgentToolContext): Promise<GateDecision> {
  const coach = coachOf(ctx);
  const key = sectionKey(input);
  const existing = (await ensurePracticeKnowledge(coach.id)).built_sections[key];
  if (!existing) return { confirm: false };
  return {
    confirm: true,
    title: `Rewrite "${sectionTitle(key)}" for ${coach.name}`,
    details: [
      { label: "Section", value: sectionTitle(key) },
      { label: "Written", value: String(existing.generated_at ?? "").slice(0, 10) || "before" },
    ],
    warning: existing.edited_at
      ? "This section was edited by hand. Rewriting replaces those edits."
      : "The current version is replaced.",
  };
}

export const blueprintTools: AgentToolDef[] = [
  {
    name: "list_blueprint_sections",
    modes: ["admin"],
    label: "Checking the blueprint",
    needsCoach: true,
    description:
      "The Practice Blueprint sections we write for the active coach, in build order (each one builds on the ones before it): key, title, whether it is written, when, and whether it was edited by hand.",
    input_schema: { type: "object", properties: {} },
    run: async (_input, ctx) => {
      const coach = coachOf(ctx);
      const built = (await ensurePracticeKnowledge(coach.id)).built_sections;
      return {
        sections: buildOrder()
          .filter(isBuildableSection)
          .map((key) => ({
            key,
            title: sectionTitle(key),
            written: Boolean(built[key]),
            written_on: built[key]?.generated_at ? String(built[key]!.generated_at).slice(0, 10) : null,
            edited_by_hand: Boolean(built[key]?.edited_at),
            needs: sectionByKey(key)?.section.needs ?? [],
          })),
      };
    },
  },
  {
    name: "read_blueprint_section",
    modes: ["admin"],
    label: "Reading the blueprint section",
    needsCoach: true,
    description: "The written text of one blueprint section, as Markdown.",
    input_schema: {
      type: "object",
      properties: { section: { type: "string", description: 'Key such as "market:pains"' } },
      required: ["section"],
    },
    run: async (input, ctx) => {
      const coach = coachOf(ctx);
      const key = sectionKey(input);
      const section = (await ensurePracticeKnowledge(coach.id)).built_sections[key];
      if (!section) return { section: key, title: sectionTitle(key), written: false };
      const text = blocksToMarkdown(section.blocks);
      return {
        section: key,
        title: sectionTitle(key),
        written: true,
        text: text.length > 9_000 ? `${text.slice(0, 9_000)}\n[Truncated.]` : text,
      };
    },
  },
  {
    name: "write_blueprint_section",
    modes: ["admin"],
    label: "Writing the blueprint section",
    needsCoach: true,
    description:
      "Write (or rewrite) one blueprint section with its AI skill, from everything we know about the coach. Takes 20 to 60 seconds. Asks for confirmation when it would replace a section that is already written.",
    input_schema: {
      type: "object",
      properties: { section: { type: "string", description: 'Key such as "market:pains"' } },
      required: ["section"],
    },
    gate: writeGate,
    run: async (input, ctx) => {
      const coach = coachOf(ctx);
      const key = sectionKey(input);
      const row = await buildSection(coach.id, key);
      const section = row.built_sections[key];
      const text = section ? blocksToMarkdown(section.blocks) : "";
      return {
        section: key,
        title: sectionTitle(key),
        written: Boolean(section),
        preview: text.length > 3_000 ? `${text.slice(0, 3_000)}\n[More in the blueprint.]` : text,
      };
    },
  },
];
