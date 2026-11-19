import { createHash } from "node:crypto";

import { fieldValue, sectionByKey, sectionReads, type FieldSpec } from "@/lib/practiceKnowledge/blueprint";
import { sourced } from "@/lib/practiceKnowledge/sourced";
import type { PracticeKnowledgePayload, PracticeKnowledgeRow } from "@/lib/practiceKnowledge/types";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

import { fillableAnswer } from "./avaWork";

/**
 * The launch chain runs on Ava's drafts (18 Nov): a step waits for the one
 * before it to be drafted, not released. So the writers read the coach's
 * Blueprint with every open draft laid over it. Nothing here is saved, and
 * the coach never sees it.
 */

type OpenDraft = {
  job_key: string;
  kind: "draft" | "answers";
  created_at: string;
  payload: {
    sections?: { key: string; blocks: unknown[]; drafted_at: string }[];
    answers?: { path: string; value: string }[];
    by?: "ava";
    linkedinParts?: Record<string, string>;
  };
};

/** An answer as it's stored: lists one item per line. Shared with saveAnswers. */
export function storedAnswer(field: FieldSpec, text: string): string | string[] {
  return field.kind === "list"
    ? text
        .split("\n")
        .map((line) => line.replace(/^[-•*]\s*/, "").trim())
        .filter(Boolean)
    : text.trim();
}

async function openDrafts(coachId: string): Promise<OpenDraft[]> {
  const { data } = await supabaseAdmin
    .from("launch_job_activity")
    .select("job_key, kind, created_at, payload")
    .eq("coach_id", coachId)
    .eq("status", "open")
    .in("kind", ["draft", "answers"])
    .order("created_at", { ascending: true });
  return (data ?? []) as OpenDraft[];
}

/** The row with these open drafts laid over it, leaving out the scopes in `except` (a step redrafting itself). */
export function overlayDrafts(row: PracticeKnowledgeRow, drafts: OpenDraft[], except: string[] = []): PracticeKnowledgeRow {
  const payload = { ...row.payload } as Record<string, Record<string, unknown>>;
  const built = { ...row.built_sections };
  for (const draft of drafts) {
    // A step redrafting itself leaves out its own written draft; answers on the same page still count.
    if (draft.kind === "draft" && except.includes(draft.job_key)) continue;
    if (draft.kind === "answers") {
      for (const a of draft.payload.answers ?? []) {
        const field = fillableAnswer(a.path);
        if (!field || !a.value?.trim()) continue;
        const [group, key] = a.path.split(".");
        payload[group] = { ...(payload[group] ?? {}), [key]: sourced(storedAnswer(field, a.value), draft.payload.by === "ava" ? "admin" : "interview") };
      }
    } else if (!draft.payload.linkedinParts) {
      for (const s of draft.payload.sections ?? []) {
        built[s.key] = { blocks: s.blocks, generated_at: s.drafted_at, model: "draft", edited_at: null } as (typeof built)[string];
      }
    }
  }
  return { ...row, payload: payload as unknown as PracticeKnowledgePayload, built_sections: built };
}

/** The coach's Blueprint as the launch chain sees it: saved work plus Ava's open drafts. */
export async function withOpenDrafts(coachId: string, row: PracticeKnowledgeRow, except: string[] = []): Promise<PracticeKnowledgeRow> {
  return overlayDrafts(row, await openDrafts(coachId), except);
}

/**
 * A fingerprint of what a draft read: these answers, plus these sections'
 * answers and the sections they need. When it changes (BCA changed an
 * earlier step), the draft is out of date and Ava writes it again.
 */
export function inputPrint(row: PracticeKnowledgeRow, opts: { sections?: string[]; paths?: string[]; built?: string[] }): string {
  const paths = new Set(opts.paths ?? []);
  const needs = new Set<string>(opts.built ?? []);
  for (const key of opts.sections ?? []) {
    for (const path of sectionReads(key)) paths.add(path);
    for (const need of sectionByKey(key)?.section.needs ?? []) if (!opts.sections?.includes(need)) needs.add(need);
  }
  const values = [...paths].sort().map((path) => [path, fieldValue(row.payload, path as FieldSpec["path"])?.value ?? null]);
  const sections = [...needs].sort().map((key) => [key, row.built_sections[key]?.blocks ?? null]);
  return createHash("sha1").update(JSON.stringify({ values, sections })).digest("hex").slice(0, 16);
}
