import {
  BLUEPRINT_SECTIONS,
  blueprintPage,
  buildOrder,
  fieldFilled,
  fieldValue,
  sectionByKey,
  sectionReads,
  type FieldSpec,
  type SectionRef,
} from "@/lib/practiceKnowledge/blueprint";
import { sectionWorkflow } from "@/lib/practiceKnowledge/sectionWorkflow";
import type { PracticeKnowledgeRow } from "@/lib/practiceKnowledge/types";

import { launchThread, threadForSectionRef } from "./threads";

/**
 * What Ava can do on one launch job (job 172), worked out from the Blueprint,
 * never set by hand. A job is "Ava ready" when it has written sections still
 * to do and every answer and earlier section they read is there. Client-safe:
 * the job page and the admin lists use the same rule.
 */

/** Something a writer reads that isn't there yet, and the job where it gets filled in. */
export type AvaMissing = {
  /** "answer:market.avoid" or "section:market:pains". */
  id: string;
  label: string;
  kind: "answer" | "section";
  /** The answer's path, for answers. */
  path?: string;
  /** The job it belongs to, so the list can say where to fill it in. */
  jobKey: string | null;
  /** The Blueprint part ("page:id") where it's filled in or written, to link to. */
  sectionKey: string;
  /** How Ava asks the coach for it, when it's an answer she asks for. */
  ask?: string;
  /** The coach fills it in (About You), rather than BCA. */
  coach: boolean;
};

export type AvaWork = {
  /** Written sections in this job that still need writing, in the order they can be written. */
  toWrite: string[];
  missing: AvaMissing[];
  /** There is something to write and nothing missing. */
  ready: boolean;
};

/** Where each answer is filled in: the box the coach can see, when it shows in more than one place. */
const FIELD_HOME = new Map<string, { field: FieldSpec; ref: SectionRef }>();
const shown = (field: FieldSpec, ref: SectionRef) => !field.hidden && ref.section.face !== "stored";
for (const ref of BLUEPRINT_SECTIONS) {
  for (const field of ref.section.fields ?? []) {
    const home = FIELD_HOME.get(field.path);
    if (!home || (!shown(home.field, home.ref) && shown(field, ref))) FIELD_HOME.set(field.path, { field, ref });
  }
}

/** Ava writes the sections BCA writes from a contract. The LinkedIn profile has its own editor, so not yet. */
export function isAvaSection(ref: SectionRef): boolean {
  return ref.section.source === "we_build" && Boolean(ref.section.uses);
}

/**
 * What Ava works on: a launch job ("lead-list") or a Blueprint page
 * ("page:market"). Pages are the default since 3 Nov: each page is a task.
 */
export function pageScope(slug: string): string {
  return `page:${slug}`;
}

/** The page a scope is, or null for a job. */
export function scopePage(scope: string): string | null {
  return scope.startsWith("page:") && blueprintPage(scope.slice(5)) ? scope.slice(5) : null;
}

export function isScope(scope: string): boolean {
  return Boolean(scopePage(scope) || launchThread(scope));
}

export function scopeLabel(scope: string): string {
  const slug = scopePage(scope);
  return slug ? (blueprintPage(slug)?.title ?? slug) : (launchThread(scope)?.label ?? scope);
}

/** Every section Ava could write for this job or page, in writing order (stored ones too: others read them). */
export function avaSectionsFor(scope: string): string[] {
  const slug = scopePage(scope);
  return buildOrder().filter((key) => {
    const ref = sectionByKey(key);
    if (!ref || !isAvaSection(ref)) return false;
    return slug ? ref.page.slug === slug : threadForSectionRef(ref) === scope;
  });
}

/** A section is there once it's written (a written one) or its required answers are in (an input). */
function sectionThere(key: string, row: PracticeKnowledgeRow): boolean {
  const ref = sectionByKey(key);
  if (!ref) return true;
  if (ref.section.source === "we_build") return Boolean(row.built_sections[key]);
  return (ref.section.fields ?? []).filter((f) => f.required).every((f) => fieldFilled(row.payload, f));
}

export function avaWorkFor(jobKey: string, row: PracticeKnowledgeRow | null): AvaWork {
  if (!row) return { toWrite: [], missing: [], ready: false };
  const toWrite = avaSectionsFor(jobKey).filter((key) => {
    const ref = sectionByKey(key)!;
    return sectionWorkflow(ref, row).status === "todo";
  });
  const writing = new Set(toWrite);
  const missing = new Map<string, AvaMissing>();
  for (const key of toWrite) {
    const section = sectionByKey(key)!.section;
    for (const path of section.uses?.fields ?? []) {
      const home = FIELD_HOME.get(path);
      if (!home?.field.required || fieldFilled(row.payload, home.field)) continue;
      missing.set(`answer:${path}`, {
        id: `answer:${path}`,
        label: home.field.label,
        kind: "answer",
        path,
        jobKey: threadForSectionRef(home.ref) ?? null,
        sectionKey: home.ref.key,
        ask: home.field.ask,
        coach: Boolean(home.ref.group.yours),
      });
    }
    for (const need of section.needs ?? []) {
      // Written in this same run, so it's no blocker.
      if (writing.has(need) || sectionThere(need, row)) continue;
      const ref = sectionByKey(need);
      if (!ref) continue;
      missing.set(`section:${need}`, {
        id: `section:${need}`,
        label: ref.section.title,
        kind: "section",
        jobKey: threadForSectionRef(ref) ?? null,
        sectionKey: need,
        coach: Boolean(ref.group.yours),
      });
    }
  }
  const list = [...missing.values()];
  return { toWrite, missing: list, ready: toWrite.length > 0 && list.length === 0 };
}

/** "Pain points (Ideal client)": a missing thing and where it's filled in, when that's another job or page. */
export function missingLabel(item: AvaMissing, scope: string): string {
  const slug = scopePage(scope);
  if (slug) {
    const page = sectionByKey(item.sectionKey)?.page;
    return !page || page.slug === slug ? item.label : `${item.label} (${page.title})`;
  }
  if (!item.jobKey || item.jobKey === scope) return item.label;
  return `${item.label} (${launchThread(item.jobKey)?.label ?? item.jobKey})`;
}

/** What changed since `since`, by name. Empty when nothing did. */
export function changedSince(key: string, row: PracticeKnowledgeRow, since: string): string[] {
  const out = new Set<string>();
  for (const path of sectionReads(key)) {
    const stamp = fieldValue(row.payload, path as FieldSpec["path"])?.updated_at;
    if (stamp && stamp > since) out.add(FIELD_HOME.get(path)?.field.label ?? path);
  }
  for (const need of sectionByKey(key)?.section.needs ?? []) {
    const built = row.built_sections[need];
    const stamp = built ? (built.edited_at && built.edited_at > built.generated_at ? built.edited_at : built.generated_at) : null;
    if (stamp && stamp > since) out.add(sectionByKey(need)?.section.title ?? need);
  }
  return [...out];
}

/** Answers Ava may fill in from a coach's chat reply: plain text ones. */
export function fillableAnswer(path: string): FieldSpec | null {
  const field = FIELD_HOME.get(path)?.field;
  if (!field) return null;
  return field.kind === "text" || field.kind === "longtext" || field.kind === "list" ? field : null;
}
