import { createHash } from "node:crypto";

import { fieldValue, sectionByKey, sectionReads, type FieldSpec } from "@/lib/practiceKnowledge/blueprint";
import type { PracticeKnowledgeRow } from "@/lib/practiceKnowledge/types";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

import { overlayDrafts, storedAnswer, type OpenDraft } from "./draftOverlay";

export { overlayDrafts, storedAnswer };

/**
 * The launch chain runs on Ava's drafts (18 Nov): a step waits for the one
 * before it to be drafted, not released. So the writers read the coach's
 * Blueprint with every open draft laid over it. Nothing here is saved, and
 * the coach never sees it.
 */


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
