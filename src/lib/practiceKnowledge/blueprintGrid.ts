import { blocksToMarkdown } from "./blocks";
import { BLUEPRINT_GROUPS, fieldFilled, fieldValue, sectionKey, type BlueprintLink, type SectionRef } from "./blueprint";
import { formatFieldValue } from "./exportMarkdown";
import type { ThreadSummary } from "./sectionCommentTypes";
import { sectionWorkflow, type WorkflowOwner, type WorkflowStatus } from "./sectionWorkflow";
import type { PracticeKnowledgeRow } from "./types";

/**
 * Admin → Coaches → Blueprint: every coach as a row, every section as a cell.
 * Columns follow the Blueprint map; each cell is that section's workflow state.
 */

export type GridPage = { slug: string; title: string; sections: SectionRef[] };

/** Pages with sections on the page, in document order. Stored-only sections are left out. */
export function gridPages(): GridPage[] {
  const pages: GridPage[] = [];
  for (const group of BLUEPRINT_GROUPS) {
    if (group.hidden) continue;
    for (const page of group.pages) {
      const sections = page.sections
        .filter((section) => section.face !== "stored")
        .map((section) => ({ group, page, section, key: sectionKey(page, section) }));
      if (sections.length) pages.push({ slug: page.slug, title: page.title, sections });
    }
  }
  return pages;
}

export type GridCell = {
  status: WorkflowStatus;
  owner: WorkflowOwner | null;
  /** False for an empty optional section: nothing to do yet. */
  tracked: boolean;
  /** When the current words were last written. */
  revision: string | null;
};

export type GridCoach = {
  coach_id: string;
  name: string;
  avatar_url: string | null;
  completeness_score: number;
  updated_at: string;
  cells: Record<string, GridCell>;
  threads: Record<string, ThreadSummary>;
};

export type GridCounts = { done: number; review: number; todo: number; tracked: number; bca: number; unread: number };

/** One coach in numbers: sections by status, how many wait on BCA, and unread comments for BCA. */
export function gridCounts(coach: Pick<GridCoach, "cells" | "threads">): GridCounts {
  return gridPageCounts(coach, Object.keys(coach.cells));
}

/** Same counts, limited to the sections on one page (for a collapsed chapter). */
export function gridPageCounts(coach: Pick<GridCoach, "cells" | "threads">, keys: string[]): GridCounts {
  const n: GridCounts = { done: 0, review: 0, todo: 0, tracked: 0, bca: 0, unread: 0 };
  const seen = new Set(keys);
  for (const key of keys) {
    const cell = coach.cells[key];
    if (!cell?.tracked) continue;
    n.tracked += 1;
    n[cell.status] += 1;
    if (cell.status !== "done" && cell.owner === "bca") n.bca += 1;
  }
  for (const [key, thread] of Object.entries(coach.threads)) {
    if (seen.has(key)) n.unread += thread.unread;
  }
  return n;
}

export function gridCells(row: PracticeKnowledgeRow): Record<string, GridCell> {
  const cells: Record<string, GridCell> = {};
  for (const page of gridPages()) {
    for (const ref of page.sections) {
      const work = sectionWorkflow(ref, row);
      cells[ref.key] = { status: work.status, owner: work.owner, tracked: work.tracked, revision: work.revision };
    }
  }
  return cells;
}

export type PreviewField = { label: string; values: string[]; filled: boolean; required: boolean };

export type SectionPreview =
  | { kind: "fields"; fields: PreviewField[] }
  | { kind: "written"; markdown: string | null; written_at: string | null; edited_at: string | null };

const VALUE_MAX = 320;
const VALUES_MAX = 8;
const MARKDOWN_MAX = 2400;

function clip(text: string, max: number): string {
  return text.length > max ? `${text.slice(0, max).trimEnd()}…` : text;
}

/** What is in one section, cut down for the hover card. */
export function sectionPreview(ref: SectionRef, row: PracticeKnowledgeRow): SectionPreview {
  if (ref.section.source === "we_build") {
    const built = row.built_sections[ref.key];
    return {
      kind: "written",
      markdown: built ? clip(blocksToMarkdown(built.blocks, 4), MARKDOWN_MAX) : null,
      written_at: built?.generated_at ?? null,
      edited_at: built?.edited_at ?? null,
    };
  }
  const fields: PreviewField[] = [];
  for (const field of ref.section.fields ?? []) {
    if (field.showIf) {
      const gate = fieldValue(row.payload, field.showIf.path)?.value;
      if (!field.showIf.in.includes(String(gate ?? ""))) continue;
    }
    const values = formatFieldValue(row.payload, field);
    fields.push({
      label: field.label,
      values: values.slice(0, VALUES_MAX).map((v) => clip(v, VALUE_MAX)),
      filled: fieldFilled(row.payload, field),
      required: Boolean(field.required),
    });
  }
  return { kind: "fields", fields };
}

export function sectionPreviews(row: PracticeKnowledgeRow): Record<string, SectionPreview> {
  const out: Record<string, SectionPreview> = {};
  for (const page of gridPages()) {
    for (const ref of page.sections) out[ref.key] = sectionPreview(ref, row);
  }
  return out;
}

/** Where the admin Blueprint opens this section for this coach. */
export function adminSectionHref(page: Pick<BlueprintLink, "slug">, key: string, coachId: string, thread = false): string {
  const params = new URLSearchParams({ coach: coachId });
  if (thread) params.set("thread", key);
  return `/admin/blueprint/coach/${page.slug}?${params.toString()}#s-${key.replace(":", "-")}`;
}

/** The coach's page in the admin Blueprint, not a single section. */
export function adminPageHref(slug: string, coachId: string): string {
  return `/admin/blueprint/coach/${slug}?${new URLSearchParams({ coach: coachId }).toString()}`;
}
