import { resolveAnthropicModel } from "@/lib/anthropicModel";
import type { LinkedInProfileSnapshot } from "@/lib/apify/linkedinProfileTypes";
import { emptyDraft, normalizeOptimizerDraft, textForSection } from "@/lib/linkedinProfileOptimizer/draft";
import {
  applyProfileVariant,
  loadProfileWriterInputs,
  rewriteProfilePart,
  WRITE_EVERY_PART,
} from "@/lib/linkedinProfileOptimizer/rewritePart";
import { PROFILE_SECTIONS, type ProfileSectionId } from "@/lib/linkedinProfileOptimizer/types";
import { blocksToMarkdown, sanitizeBlocks } from "@/lib/practiceKnowledge/blocks";
import { buildOrder, sectionByKey } from "@/lib/practiceKnowledge/blueprint";
import { draftSection, isBuildableSection } from "@/lib/practiceKnowledge/buildSection";
import { linkedInNote } from "@/lib/practiceKnowledge/coachLinkedIn";
import { BLUEPRINT_OUTPUTS } from "@/lib/practiceKnowledge/outputs";
import { ensurePracticeKnowledge, saveBuiltSection } from "@/lib/practiceKnowledge/store";
import type { BlueprintBlock } from "@/lib/practiceKnowledge/types";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

import type { AgentToolContext, AgentToolDef, AgentToolInput, GateDecision } from "../types";
import { AgentToolError, coachOf, optStr, str } from "./util";

/**
 * The Practice Blueprint's written sections (avatar, pain points, LinkedIn
 * profile, campaign messaging…). Each is an existing AI skill with a method
 * file from the classroom; the agent runs them rather than writing its own.
 *
 * Writing makes a draft and shows it on a card (with what it says now, for a
 * rewrite). Nothing reaches the Blueprint until the person presses Save.
 */

const WRITE_TOOL = "write_blueprint_section";
/** The LinkedIn profile: written part by part by the same writer as "Write every part from my Blueprint". */
const LINKEDIN_KEY = "linkedin:rewrite";
const PART_TITLES: Record<ProfileSectionId, string> = {
  headline: "Headline",
  about: "About",
  featured: "Featured",
  experience: "Current role",
  banner: "Banner",
};

function sectionTitle(key: string): string {
  const ref = sectionByKey(key);
  return ref ? `${ref.page.title}: ${ref.section.title}` : key;
}

function sectionKey(input: AgentToolInput): string {
  const key = str(input, "section");
  if (key !== LINKEDIN_KEY && !isBuildableSection(key)) {
    throw new AgentToolError(`"${key}" is not a section we write. Use list_blueprint_sections for the keys.`);
  }
  return key;
}

function clip(text: string, max: number): string {
  return text.length > max ? `${text.slice(0, max)}\n[More on the card.]` : text;
}

async function loadOptimizerRow(coachId: string) {
  const { data, error } = await supabaseAdmin
    .from("coach_linkedin_profiles")
    .select("snapshot, optimizer_draft")
    .eq("coach_id", coachId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return {
    exists: Boolean(data),
    snapshot: (data?.snapshot as LinkedInProfileSnapshot | null) ?? null,
    draft: normalizeOptimizerDraft(data?.optimizer_draft),
  };
}

/** The draft frozen on the last card for this section in this chat, so "change it" builds on it. */
async function lastDraftInput(chatId: string, key: string): Promise<AgentToolInput | null> {
  if (!chatId) return null;
  const { data } = await supabaseAdmin
    .from("ai_agent_actions")
    .select("input")
    .eq("chat_id", chatId)
    .eq("tool", WRITE_TOOL)
    .eq("input->>section", key)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return (data?.input as AgentToolInput | null) ?? null;
}

/** Profile parts as Markdown, in the order they sit on LinkedIn. */
function partsMarkdown(parts: Partial<Record<ProfileSectionId, string>>): string {
  return WRITE_EVERY_PART.filter((part) => parts[part]?.trim())
    .map((part) => `#### ${PART_TITLES[part]}\n\n${parts[part]!.trim()}`)
    .join("\n\n");
}

function frozenParts(input: AgentToolInput): Partial<Record<ProfileSectionId, string>> {
  const raw = input._parts;
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  const out: Partial<Record<ProfileSectionId, string>> = {};
  for (const [part, text] of Object.entries(raw as Record<string, unknown>)) {
    if ((PROFILE_SECTIONS as readonly string[]).includes(part) && typeof text === "string" && text.trim()) {
      out[part as ProfileSectionId] = text.trim();
    }
  }
  return out;
}

async function linkedInDraft(input: AgentToolInput, ctx: AgentToolContext): Promise<GateDecision> {
  const coach = coachOf(ctx);
  const changes = optStr(input, "changes");
  const inputs = await loadProfileWriterInputs(coach.id, { linkedinUrl: optStr(input, "linkedin_url") });
  const snapshot = inputs.snapshot;
  if (!snapshot) {
    return {
      error: `${linkedInNote(inputs.linkedin)} The profile is rewritten from their LinkedIn, so nothing was written. When you have the address, call ${WRITE_TOOL} again with linkedin_url.`,
    };
  }
  // A change builds on the last draft in this chat, not on what is saved.
  const last = changes ? frozenParts((await lastDraftInput(ctx.chatId, LINKEDIN_KEY)) ?? {}) : {};
  let base = inputs.draft;
  for (const [part, text] of Object.entries(last)) base = applyProfileVariant(base, part as ProfileSectionId, text);

  const written = await Promise.all(
    WRITE_EVERY_PART.map(async (part) => {
      const variants = await rewriteProfilePart({ ...inputs, snapshot }, { section: part, instruction: changes, draft: base });
      return [part, (variants.find((v) => v.recommended) ?? variants[0])?.text ?? ""] as const;
    })
  );
  const parts: Partial<Record<ProfileSectionId, string>> = {};
  for (const [part, text] of written) if (text.trim()) parts[part] = text.trim();
  if (!Object.keys(parts).length) throw new AgentToolError("The profile writer came back empty. Try again.");

  const now: Partial<Record<ProfileSectionId, string>> = {};
  for (const part of WRITE_EVERY_PART) now[part] = textForSection(part, snapshot, inputs.draft);
  const preview = partsMarkdown(parts);
  const missed = WRITE_EVERY_PART.filter((part) => !parts[part]).map((part) => PART_TITLES[part]);
  return {
    confirm: true,
    draft: true,
    title: `New LinkedIn profile for ${coach.name}`,
    details: [
      { label: "Section", value: sectionTitle(LINKEDIN_KEY) },
      { label: "Written from", value: `Their Blueprint and ${inputs.linkedin.used ?? "their LinkedIn"}` },
      ...(missed.length ? [{ label: "Not written", value: missed.join(", ") }] : []),
    ],
    preview,
    before: partsMarkdown(now) || undefined,
    input: { ...input, _parts: parts },
    forModel: {
      draft_preview: clip(preview, 3_000),
      linkedin: linkedInNote(inputs.linkedin),
      same_writer_as: "Write every part from my Blueprint, on the LinkedIn page",
    },
  };
}

async function sectionDraft(key: string, input: AgentToolInput, ctx: AgentToolContext): Promise<GateDecision> {
  const coach = coachOf(ctx);
  const changes = optStr(input, "changes");
  const existing = (await ensurePracticeKnowledge(coach.id)).built_sections[key];
  const last = changes ? sanitizeBlocks((await lastDraftInput(ctx.chatId, key))?._draft) : [];
  const { blocks, linkedin } = await draftSection(coach.id, key, {
    changes,
    base: last.length ? last : (existing?.blocks ?? null),
    linkedinUrl: optStr(input, "linkedin_url"),
  });
  const preview = blocksToMarkdown(blocks);
  return {
    confirm: true,
    draft: true,
    title: existing ? `New version of "${sectionTitle(key)}"` : `Draft of "${sectionTitle(key)}"`,
    details: [
      { label: "Section", value: sectionTitle(key) },
      ...(linkedin ? [{ label: "LinkedIn", value: linkedin.used ? `Used ${linkedin.used}` : "None found" }] : []),
    ],
    warning: existing?.edited_at && existing.model !== "ava" ? "This section was edited by hand. Saving replaces those edits." : undefined,
    preview,
    before: existing ? blocksToMarkdown(existing.blocks) : undefined,
    input: { ...input, _draft: blocks },
    forModel: {
      draft_preview: clip(preview, 3_000),
      rewrite: Boolean(existing),
      ...(linkedin ? { linkedin: linkedInNote(linkedin) } : {}),
    },
  };
}

/** Writes the draft and puts it on a card. At Save the draft is already frozen on the card, so it is only checked. */
async function writeGate(input: AgentToolInput, ctx: AgentToolContext): Promise<GateDecision> {
  const key = sectionKey(input);
  if (key === LINKEDIN_KEY ? Object.keys(frozenParts(input)).length : Array.isArray(input._draft)) {
    return { confirm: true, title: sectionTitle(key), details: [] };
  }
  return key === LINKEDIN_KEY ? linkedInDraft(input, ctx) : sectionDraft(key, input, ctx);
}

async function saveLinkedIn(coachId: string, parts: Partial<Record<ProfileSectionId, string>>) {
  const row = await loadOptimizerRow(coachId);
  if (!row.exists) throw new AgentToolError("Their LinkedIn import is gone, so there is nowhere to save the profile. Import it again.");
  let next = row.draft;
  for (const [part, text] of Object.entries(parts)) next = applyProfileVariant(next, part as ProfileSectionId, text);
  // A new version is back to Review on the page until it is copied across.
  const partStatus = { ...(next.partStatus ?? {}) };
  const copiedAt = { ...(next.copiedAt ?? {}) };
  for (const part of Object.keys(parts) as ProfileSectionId[]) {
    delete partStatus[part];
    delete copiedAt[part];
  }
  const now = new Date().toISOString();
  next = { ...next, partStatus, copiedAt, updatedAt: now };
  const { error } = await supabaseAdmin
    .from("coach_linkedin_profiles")
    .update({ optimizer_draft: next, updated_at: now })
    .eq("coach_id", coachId);
  if (error) throw new Error(error.message);
}

async function saveSection(coachId: string, key: string, blocks: BlueprintBlock[]): Promise<boolean> {
  const existing = (await ensurePracticeKnowledge(coachId)).built_sections[key];
  const now = new Date().toISOString();
  await saveBuiltSection({
    coachId,
    key,
    section: {
      blocks,
      generated_at: now,
      model: resolveAnthropicModel(),
      edited_at: null,
      // Kept so undo_copy can put the old one back.
      previous: existing
        ? {
            blocks: existing.blocks,
            generated_at: existing.generated_at,
            model: existing.model,
            edited_at: existing.edited_at ?? null,
            replaced_at: now,
          }
        : null,
    },
  });
  return Boolean(existing);
}

const LINKEDIN_OUTPUT = BLUEPRINT_OUTPUTS.find((output) => output.section === LINKEDIN_KEY);

export const blueprintTools: AgentToolDef[] = [
  {
    name: "list_blueprint_sections",
    modes: ["admin"],
    label: "Checking the blueprint",
    needsCoach: true,
    description:
      "The Practice Blueprint sections we write for the active coach, in build order (each one builds on the ones before it): key, title, whether it is written, when, and whether it was edited by hand. The LinkedIn profile (linkedin:rewrite) is last.",
    input_schema: { type: "object", properties: {} },
    run: async (_input, ctx) => {
      const coach = coachOf(ctx);
      const [built, linkedin] = await Promise.all([
        ensurePracticeKnowledge(coach.id).then((row) => row.built_sections),
        loadOptimizerRow(coach.id),
      ]);
      return {
        sections: [
          ...buildOrder()
            .filter(isBuildableSection)
            .map((key) => ({
              key,
              title: sectionTitle(key),
              written: Boolean(built[key]),
              written_on: built[key]?.generated_at ? String(built[key]!.generated_at).slice(0, 10) : null,
              edited_by_hand: Boolean(built[key]?.edited_at),
              needs: sectionByKey(key)?.section.needs ?? [],
            })),
          {
            key: LINKEDIN_KEY,
            title: sectionTitle(LINKEDIN_KEY),
            written: !emptyDraft(linkedin.draft),
            written_on: linkedin.draft.updatedAt ? String(linkedin.draft.updatedAt).slice(0, 10) : null,
            linkedin_imported: Boolean(linkedin.snapshot),
            parts: WRITE_EVERY_PART.map((part) => PART_TITLES[part]),
            needs: LINKEDIN_OUTPUT?.needs ?? [],
          },
        ],
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
      if (key === LINKEDIN_KEY) {
        const row = await loadOptimizerRow(coach.id);
        if (!row.snapshot) return { section: key, title: sectionTitle(key), written: false, linkedin_imported: false };
        const parts: Partial<Record<ProfileSectionId, string>> = {};
        for (const part of WRITE_EVERY_PART) parts[part] = textForSection(part, row.snapshot, row.draft);
        return { section: key, title: sectionTitle(key), written: !emptyDraft(row.draft), text: partsMarkdown(parts) };
      }
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
    name: WRITE_TOOL,
    modes: ["admin"],
    label: "Writing a draft",
    needsCoach: true,
    description:
      "Write a draft of one blueprint section with its AI skill, from everything we know about the coach (first time or rewrite). Takes 20 to 60 seconds. The draft is shown on a card with Save to Blueprint and Change it (with what it says now, for a rewrite); nothing is saved until they press Save. For changes to a draft, call it again with changes. Writers that read LinkedIn import it first from wherever we have their address.",
    input_schema: {
      type: "object",
      properties: {
        section: { type: "string", description: 'Key such as "market:pains", or "linkedin:rewrite" for the LinkedIn profile' },
        changes: {
          type: "string",
          description: "What the person asked to change in the last draft, in their words. Leave out for a first draft.",
        },
        linkedin_url: {
          type: "string",
          description: "Their LinkedIn address, only when the tool said none could be found and the person gave it",
        },
      },
      required: ["section"],
    },
    gate: writeGate,
    run: async (input, ctx) => {
      const coach = coachOf(ctx);
      const key = sectionKey(input);
      if (key === LINKEDIN_KEY) {
        const parts = frozenParts(input);
        if (!Object.keys(parts).length) throw new AgentToolError("There is no draft to save. Write it again.");
        await saveLinkedIn(coach.id, parts);
        return {
          saved: true,
          section: key,
          parts: Object.keys(parts).map((part) => PART_TITLES[part as ProfileSectionId]),
          _note: `Saved to ${sectionTitle(key)}`,
        };
      }
      const blocks = sanitizeBlocks(input._draft);
      if (!blocks.length) throw new AgentToolError("There is no draft to save. Write it again.");
      const replaced = await saveSection(coach.id, key, blocks);
      return { saved: true, section: key, title: sectionTitle(key), can_undo: replaced, _note: `Saved to ${sectionTitle(key)}` };
    },
  },
];
