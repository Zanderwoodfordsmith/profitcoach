import { blocksToMarkdown, sanitizeBlocks } from "@/lib/practiceKnowledge/blocks";
import {
  BLUEPRINT_GROUPS,
  BLUEPRINT_SECTIONS,
  blueprintPage,
  fieldFilled,
  fieldValue,
  sectionByKey,
  type BlueprintLink,
  type FieldSpec,
  type SectionRef,
} from "@/lib/practiceKnowledge/blueprint";
import { formatFieldValue } from "@/lib/practiceKnowledge/exportMarkdown";
import { sanitizePayloadPatch } from "@/lib/practiceKnowledge/sanitize";
import { addSectionComment } from "@/lib/practiceKnowledge/sectionComments";
import { sectionWorkflow } from "@/lib/practiceKnowledge/sectionWorkflow";
import { ensurePracticeKnowledge, patchPracticeKnowledge, saveBuiltSection } from "@/lib/practiceKnowledge/store";
import type { PracticeKnowledgeRow } from "@/lib/practiceKnowledge/types";

import type { AgentShow, AgentToolDef, AgentToolInput } from "../types";
import { AgentToolError, bool, coachOf, num, str } from "./util";

/**
 * Ava's Blueprint tools, for coaches and admins. Facts (the coach's answers)
 * are only ever saved from the coach's own words. Written copy goes straight
 * into the section; the person reads it on the page and tells Ava to keep it,
 * change it or put it back. Nothing to click.
 */

/** About You pages, in the order coaches are asked: proof first, practical setup last. */
const ASK_ORDER = ["story", "voice", "setup"];

function where(ref: SectionRef): string {
  return `${ref.page.title} · ${ref.section.title}`;
}

/** Answer fields Ava may fill. Widgets (phone, hours, time zone, tone…) are set on the page itself. */
function answerFields(ref: SectionRef): FieldSpec[] {
  if (ref.section.source === "we_build") return [];
  return (ref.section.fields ?? []).filter((field) => !field.widget);
}

function shown(field: FieldSpec, row: PracticeKnowledgeRow): boolean {
  if (!field.showIf) return true;
  const gate = fieldValue(row.payload, field.showIf.path)?.value;
  return field.showIf.in.includes(String(gate ?? ""));
}

function fieldOwner(path: string): { ref: SectionRef; field: FieldSpec } | null {
  for (const ref of BLUEPRINT_SECTIONS) {
    const field = answerFields(ref).find((f) => f.path === path);
    if (field) return { ref, field };
  }
  return null;
}

function pageSlug(input: AgentToolInput): string | null {
  const slug = str(input, "page").toLowerCase();
  return slug && BLUEPRINT_GROUPS.some((g) => g.pages.some((p) => p.slug === slug)) ? slug : null;
}

function sectionRef(input: AgentToolInput): SectionRef {
  const key = str(input, "section");
  const ref = sectionByKey(key);
  if (!ref) throw new AgentToolError(`No section "${key}". Use blueprint_overview for the keys.`);
  return ref;
}

/** The value as the model sent it, shaped for its kind, or an error it can fix. */
function shapeValue(field: FieldSpec, raw: unknown): unknown {
  switch (field.kind) {
    case "text":
    case "longtext":
      if (typeof raw !== "string" || !raw.trim()) throw new AgentToolError(`${field.label} needs text.`);
      return raw.trim();
    case "list": {
      const items = (Array.isArray(raw) ? raw : [raw]).filter((v): v is string => typeof v === "string").map((v) => v.trim()).filter(Boolean);
      if (!items.length) throw new AgentToolError(`${field.label} needs a list of short items.`);
      return items;
    }
    case "enum": {
      const value = typeof raw === "string" ? raw.trim() : "";
      const option = field.options?.find((o) => o.value === value || o.label.toLowerCase() === value.toLowerCase());
      if (!option) {
        throw new AgentToolError(`${field.label} must be one of: ${(field.options ?? []).map((o) => o.value).join(", ")}.`);
      }
      return option.value;
    }
    default:
      if (!Array.isArray(raw) || !raw.length) throw new AgentToolError(`${field.label} needs a list of entries.`);
      return raw;
  }
}

/** The section, the new blocks and what is there now, or an error the model can fix. */
async function checkCopy(input: AgentToolInput, coachId: string) {
  const ref = sectionRef(input);
  if (ref.section.source !== "we_build") {
    throw new AgentToolError(`${where(ref)} holds the coach's own answers. Ava never rewrites those; use save_answer with their words.`);
  }
  const existing = (await ensurePracticeKnowledge(coachId)).built_sections[ref.key];
  if (!existing && !ref.key.startsWith("content:")) {
    throw new AgentToolError(`${where(ref)} is not written yet. BCA writes it first; then you can improve it.`);
  }
  const blocks = sanitizeBlocks(input.blocks);
  if (!blocks.length) throw new AgentToolError("The new version is empty. Send blocks in the blueprint block format.");
  return { ref, blocks, existing };
}

/** Where a Blueprint page lives for this viewer, with the section anchor the page scrolls to. */
function blueprintHref(mode: "admin" | "coach", page: BlueprintLink, ref: SectionRef | null): string {
  const base = mode === "admin" ? "/admin/blueprint/coach" : "/coach/blueprint";
  const anchor = ref ? `#s-${ref.key.replace(":", "-")}` : "";
  return `${base}${page.href.slice("/coach/blueprint".length)}${anchor}`;
}

export const blueprintAvaTools: AgentToolDef[] = [
  {
    name: "blueprint_overview",
    label: "Looking at the blueprint",
    needsCoach: true,
    description:
      "The coach's whole Practice Blueprint at a glance: every page and section in order, whether it holds the coach's answers or copy BCA wrote, its status (to do, review, done), who it waits on, and how many answers are still open. Pass the page they are on to have it listed first.",
    input_schema: {
      type: "object",
      properties: { page: { type: "string", description: 'Page slug they are on, e.g. "offer"' } },
    },
    run: async (input, ctx) => {
      const coach = coachOf(ctx);
      const row = await ensurePracticeKnowledge(coach.id);
      const first = pageSlug(input);
      const pages = BLUEPRINT_GROUPS.flatMap((group) => group.pages)
        .filter((page) => page.sections.some((s) => s.face !== "stored"))
        .sort((a, b) => Number(b.slug === first) - Number(a.slug === first))
        .map((page) => ({
          page: page.slug,
          title: page.title,
          sections: BLUEPRINT_SECTIONS.filter((ref) => ref.page.slug === page.slug && ref.section.face !== "stored").map((ref) => {
            const work = sectionWorkflow(ref, row);
            const open = answerFields(ref).filter((f) => shown(f, row) && !fieldFilled(row.payload, f)).length;
            return {
              key: ref.key,
              title: ref.section.title,
              holds: ref.section.source === "we_build" ? "copy BCA wrote" : "the coach's answers",
              status: work.tracked ? work.status : "optional",
              waiting_on: work.owner,
              ...(ref.section.source === "we_build" ? { written: Boolean(row.built_sections[ref.key]) } : { open_answers: open }),
            };
          }),
        }));
      return { coach: coach.name, pages };
    },
  },
  {
    name: "blueprint_questions",
    label: "Finding what is still open",
    needsCoach: true,
    description:
      "The coach's unanswered About You questions (story and proof, voice, setup), starting with the page they are on. Everything after About You is BCA's to research or agree on the Blueprint Call, so it is never asked. Each has the field path to save to, the question to ask, an example of a good answer, and why we ask.",
    input_schema: {
      type: "object",
      properties: {
        page: { type: "string", description: "Page slug to start with" },
        limit: { type: "number", description: "How many to return, default 8" },
      },
    },
    run: async (input, ctx) => {
      const coach = coachOf(ctx);
      const row = await ensurePracticeKnowledge(coach.id);
      const first = pageSlug(input);
      const rank = (slug: string) => (slug === first ? 0 : ASK_ORDER.indexOf(slug) + 1 || 99);
      const limit = Math.min(Math.max(num(input, "limit") ?? 8, 1), 20);
      const open = BLUEPRINT_SECTIONS.filter((ref) => ref.group.yours && ref.section.face !== "stored")
        .sort((a, b) => rank(a.page.slug) - rank(b.page.slug))
        .flatMap((ref) =>
          answerFields(ref)
            .filter((field) => shown(field, row) && !fieldFilled(row.payload, field))
            .sort((a, b) => Number(Boolean(b.required)) - Number(Boolean(a.required)))
            .map((field) => ({
              path: field.path,
              section: ref.key,
              where: where(ref),
              label: field.label,
              ask: field.ask ?? null,
              example: field.example ?? null,
              why: field.help ?? null,
              kind: field.kind,
              required: Boolean(field.required),
              ...(field.options ? { options: field.options } : {}),
              ...(field.columns ? { columns: field.columns.map((c) => ({ key: c.key, label: c.label })) } : {}),
            }))
        );
      return { open_total: open.length, questions: open.slice(0, limit) };
    },
  },
  {
    name: "read_section",
    label: "Reading the section",
    needsCoach: true,
    description:
      "One Blueprint section in full. For answer sections: every answer with its label, example and why we ask (structured answers come back raw too, so you can keep their shape). For written sections: the copy as Markdown and when it was written.",
    input_schema: {
      type: "object",
      properties: { section: { type: "string", description: 'Section key, e.g. "story:results"' } },
      required: ["section"],
    },
    run: async (input, ctx) => {
      const coach = coachOf(ctx);
      const ref = sectionRef(input);
      const row = await ensurePracticeKnowledge(coach.id);
      const work = sectionWorkflow(ref, row);
      const base = {
        section: ref.key,
        where: where(ref),
        about: ref.section.about ?? null,
        bca_recommends: ref.section.tip ?? null,
        status: work.tracked ? work.status : "optional",
        waiting_on: work.owner,
      };
      if (ref.section.source === "we_build") {
        const built = row.built_sections[ref.key];
        const text = built ? blocksToMarkdown(built.blocks, 4) : "";
        return {
          ...base,
          holds: "copy BCA wrote",
          written: Boolean(built),
          written_on: built?.generated_at?.slice(0, 10) ?? null,
          edited_by_hand: Boolean(built?.edited_at),
          text: text.length > 9_000 ? `${text.slice(0, 9_000)}\n[Truncated.]` : text,
        };
      }
      return {
        ...base,
        holds: "the coach's answers",
        answers: (ref.section.fields ?? [])
          .filter((field) => shown(field, row))
          .map((field) => {
            const structured = ["results", "stories", "rows"].includes(field.kind);
            return {
              path: field.path,
              label: field.label,
              kind: field.kind,
              required: Boolean(field.required),
              set_on_page_only: Boolean(field.widget),
              answer: formatFieldValue(row.payload, field),
              ...(structured && fieldFilled(row.payload, field) ? { raw: fieldValue(row.payload, field.path)?.value } : {}),
              example: field.example ?? null,
              why: field.help ?? null,
            };
          }),
      };
    },
  },
  {
    name: "save_answer",
    label: "Saving to the blueprint",
    needsCoach: true,
    description:
      "Save one of the coach's answers into their Blueprint. Only ever save what the coach said in this conversation (or wording they explicitly said yes to). Never a fact you inferred or improved on your own. Replacing an answer that is already there needs replace: true and a new answer from the coach.",
    input_schema: {
      type: "object",
      properties: {
        path: { type: "string", description: 'Field path from blueprint_questions or read_section, e.g. "proof.superpowers"' },
        value: {
          description:
            "Text for text fields, a list of strings for list fields, an option value for choices, or the raw list of entries for results, stories and rows",
        },
        coach_words: { type: "string", description: "What the coach said that this answer comes from, quoted" },
        replace: { type: "boolean", description: "True only when the coach gave a new answer for one already saved" },
      },
      required: ["path", "value", "coach_words"],
    },
    run: async (input, ctx) => {
      const coach = coachOf(ctx);
      const path = str(input, "path");
      const owner = fieldOwner(path);
      if (!owner) {
        throw new AgentToolError(`"${path}" is not an answer you can save. Use a path from blueprint_questions or read_section.`);
      }
      if (!str(input, "coach_words")) {
        throw new AgentToolError("Quote what the coach said. Answers only come from the coach.");
      }
      const row = await ensurePracticeKnowledge(coach.id);
      if (fieldFilled(row.payload, owner.field) && bool(input, "replace") !== true) {
        const current = formatFieldValue(row.payload, owner.field).join("; ");
        throw new AgentToolError(
          `${owner.field.label} already says: "${current.slice(0, 300)}". Only replace it if the coach gave a new answer, with replace: true.`
        );
      }
      const value = shapeValue(owner.field, input.value);
      const [group, key] = path.split(".");
      const patch = sanitizePayloadPatch(
        { [group]: { [key]: { value, source: "interview", updated_at: new Date().toISOString() } } },
        "interview"
      );
      const saved = (patch as Record<string, Record<string, unknown> | undefined>)[group]?.[key];
      if (!saved) throw new AgentToolError(`That answer did not fit ${owner.field.label}. Check its shape and try again.`);
      await patchPracticeKnowledge({ coachId: coach.id, payloadPatch: patch });
      return { saved: true, section: owner.ref.key, field: owner.field.label, _note: `Saved to ${where(owner.ref)}` };
    },
  },
  {
    name: "propose_copy",
    label: "Writing the new version",
    needsCoach: true,
    description:
      "Write a new version of a written Blueprint section (copy BCA wrote, never the coach's answers) straight into the section. It is live on the page at once, and the version before is kept so undo_copy can put it back. Send the whole section in the blueprint block format.",
    input_schema: {
      type: "object",
      properties: {
        section: { type: "string", description: 'Written section key, e.g. "campaigns:messaging"' },
        blocks: { type: "array", items: { type: "object" }, description: "The whole new section as blueprint blocks" },
        summary: { type: "string", description: "One line on what changed and why" },
      },
      required: ["section", "blocks", "summary"],
    },
    run: async (input, ctx) => {
      const coach = coachOf(ctx);
      const { ref, blocks, existing } = await checkCopy(input, coach.id);
      const now = new Date().toISOString();
      await saveBuiltSection({
        coachId: coach.id,
        key: ref.key,
        section: {
          blocks,
          generated_at: existing?.generated_at ?? now,
          model: "ava",
          edited_at: now,
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
      return {
        saved: true,
        section: ref.key,
        can_undo: Boolean(existing),
        ...(existing?.edited_at ? { replaced_hand_edits: true } : {}),
        _note: `Updated ${where(ref)}`,
      };
    },
  },
  {
    name: "undo_copy",
    label: "Putting it back",
    needsCoach: true,
    description:
      "Put a written section back the way it was before your last propose_copy on it. Use it when they say undo that, put it back, or they liked the old one better. One step back only.",
    input_schema: {
      type: "object",
      properties: { section: { type: "string", description: "Written section key" } },
      required: ["section"],
    },
    run: async (input, ctx) => {
      const coach = coachOf(ctx);
      const ref = sectionRef(input);
      const current = (await ensurePracticeKnowledge(coach.id)).built_sections[ref.key];
      const previous = current?.previous;
      if (!current || !previous) throw new AgentToolError(`There is no earlier version of ${where(ref)} to put back.`);
      if (current.edited_at !== previous.replaced_at) {
        throw new AgentToolError(
          `${where(ref)} was changed by hand after your edit, so putting the old version back would lose that. Ask what they want and write it with propose_copy.`
        );
      }
      await saveBuiltSection({
        coachId: coach.id,
        key: ref.key,
        section: {
          blocks: previous.blocks,
          generated_at: previous.generated_at,
          model: previous.model,
          edited_at: previous.edited_at,
        },
      });
      return { restored: true, section: ref.key, _note: `Put back ${where(ref)}` };
    },
  },
  {
    name: "clear_answer",
    label: "Clearing the answer",
    needsCoach: true,
    description:
      "Empty one of the coach's answers, only when they ask you to delete or remove it. To take one item out of a list or results, use save_answer with the rest and replace: true instead.",
    input_schema: {
      type: "object",
      properties: {
        path: { type: "string", description: 'Field path, e.g. "proof.superpowers"' },
        coach_words: { type: "string", description: "What the coach said asking for it to go, quoted" },
      },
      required: ["path", "coach_words"],
    },
    run: async (input, ctx) => {
      const coach = coachOf(ctx);
      const path = str(input, "path");
      const owner = fieldOwner(path);
      if (!owner) throw new AgentToolError(`"${path}" is not an answer you can clear.`);
      if (!str(input, "coach_words")) throw new AgentToolError("Quote what the coach said. Only they can remove an answer.");
      // An empty value only survives the sanitizer from a person's edit, which this is.
      const source = ctx.mode === "admin" ? "admin" : "coach_edit";
      const [group, key] = path.split(".");
      const patch = sanitizePayloadPatch(
        { [group]: { [key]: { value: "", source, updated_at: new Date().toISOString() } } },
        source
      );
      await patchPracticeKnowledge({ coachId: coach.id, payloadPatch: patch });
      return { cleared: true, section: owner.ref.key, field: owner.field.label, _note: `Cleared ${owner.field.label}` };
    },
  },
  {
    name: "show_section",
    label: "Opening it on the page",
    needsCoach: true,
    description:
      "Move the Blueprint beside you to a page, or to one section scrolled into view and lit up, so the person reads it there. Use it when checking with them, and again after you change something so they see the new version. Not while collecting answers: that conversation stays put.",
    input_schema: {
      type: "object",
      properties: {
        section: { type: "string", description: 'Section key, e.g. "story:results"' },
        page: { type: "string", description: 'Page slug when showing a whole page, e.g. "voice"' },
      },
    },
    run: async (input, ctx) => {
      const ref = str(input, "section") ? sectionRef(input) : null;
      const page = blueprintPage(ref?.page.slug ?? pageSlug(input) ?? "");
      if (!page) throw new AgentToolError("Send a section key, or a page slug from blueprint_overview.");
      const show: AgentShow = {
        page: page.slug,
        section: ref?.key ?? null,
        href: blueprintHref(ctx.mode, page, ref),
        label: ref ? `Open ${where(ref)}` : `Open ${page.title}`,
      };
      return { shown: true, _show: show, _note: ref ? `Showing ${where(ref)}` : `Showing ${page.title}` };
    },
  },
  {
    name: "sign_off_section",
    label: "Marking it checked",
    needsCoach: true,
    description:
      "Record that the coach has looked over a section and is happy with it as it is now. Only after they say so in this conversation: their yes is the sign-off, there is nothing for them to click. Sections waiting on BCA are not theirs to sign off.",
    input_schema: {
      type: "object",
      properties: {
        section: { type: "string", description: "Section key" },
        coach_words: { type: "string", description: "What the coach said, quoted" },
      },
      required: ["section", "coach_words"],
    },
    run: async (input, ctx) => {
      const coach = coachOf(ctx);
      const ref = sectionRef(input);
      if (!str(input, "coach_words")) throw new AgentToolError("Quote the coach saying they are happy with it.");
      const row = await ensurePracticeKnowledge(coach.id);
      const work = sectionWorkflow(ref, row);
      if (!work.tracked) throw new AgentToolError(`${where(ref)} has nothing in it to sign off.`);
      if (work.status === "done") return { signed_off: true, already: true };
      if (work.owner !== "coach" || work.status !== "review" || !work.revision) {
        throw new AgentToolError(
          work.owner === "bca"
            ? `${where(ref)} is waiting on BCA, so there is nothing for the coach to sign off yet.`
            : `${where(ref)} still has answers to fill before it can be signed off.`
        );
      }
      // Same stamp as signing off on the page: never older than the words it covers.
      const now = new Date().toISOString();
      const stamps = { ...(row.payload.review.approved_sections?.value ?? {}), [ref.key]: work.revision > now ? work.revision : now };
      const source = ctx.mode === "admin" ? "admin" : "coach_edit";
      const patch = sanitizePayloadPatch({ review: { approved_sections: { value: stamps, source, updated_at: now } } }, source);
      const after = sectionWorkflow(ref, await patchPracticeKnowledge({ coachId: coach.id, payloadPatch: patch }));
      return {
        signed_off: true,
        status: after.status,
        waiting_on: after.owner,
        _note: after.owner === "bca" ? `Signed off ${where(ref)}. BCA checks it next` : `Signed off ${where(ref)}`,
      };
    },
  },
  {
    name: "hand_to_bca",
    label: "Passing it to BCA",
    needsCoach: true,
    description:
      "Leave a note for the BCA team in a section's Comments, as Ava. Use it when something needs a person: a result that will not firm up after two tries, a decision the coach wants BCA's view on, or a disagreement with BCA's recommendation.",
    input_schema: {
      type: "object",
      properties: {
        section: { type: "string", description: "Section key the note is about" },
        note: { type: "string", description: "What BCA needs to know or decide, in two or three sentences" },
      },
      required: ["section", "note"],
    },
    run: async (input, ctx) => {
      const coach = coachOf(ctx);
      const ref = sectionRef(input);
      const note = str(input, "note").slice(0, 2_000);
      if (!note) throw new AgentToolError("Write the note for BCA.");
      await addSectionComment({ coachId: coach.id, sectionKey: ref.key, authorId: null, side: "ava", body: note });
      return { posted: true, _note: `Passed to BCA on ${where(ref)}` };
    },
  },
];
