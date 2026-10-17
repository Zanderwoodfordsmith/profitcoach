import { BLUEPRINT_SECTIONS, fieldFilled, fieldValue, type SectionRef } from "./blueprint";
import { CAMPAIGN_HANDOFFS } from "./campaignHandoff";
import { sourced } from "./sourced";
import type { PracticeKnowledgePayload, PracticeKnowledgeRow } from "./types";

/**
 * One status per section. The picture on the row says who it is waiting on.
 * To do: someone still has to produce it.
 * Review: it exists, and this version has not been signed off.
 * Done: signed off against the current version. A later edit returns it to Review.
 */
export type WorkflowStatus = "todo" | "review" | "done";
export type WorkflowOwner = "coach" | "bca";

export type SectionWorkflow = {
  status: WorkflowStatus;
  /** Who has to act. None once it is Done. */
  owner: WorkflowOwner | null;
  /** Shown in the three tabs. Empty optional sections are left out. */
  tracked: boolean;
  /** When the current words were last written. */
  revision: string | null;
  /** Signed off before, and this version is newer. */
  changed: boolean;
  /** Fields inside the section that moved after the sign-off. */
  changedFields: string[];
};

/** Written sections a coach can sign off, which then wait for BCA before they can be sent. */
const BCA_GATE = new Set(["linkedin:rewrite", ...CAMPAIGN_HANDOFFS.map((h) => h.section)]);

function stampAt(payload: PracticeKnowledgePayload, key: string, which: "coach" | "bca"): string | null {
  const map =
    which === "coach"
      ? payload.review.approved_sections?.value
      : payload.review.bca_approved_sections?.value;
  const at = map?.[key];
  return at || null;
}

function latest(a: string | null | undefined, b: string | null | undefined): string | null {
  const left = a || null;
  const right = b || null;
  if (!left) return right;
  if (!right) return left;
  return left > right ? left : right;
}

function sectionRevision(ref: SectionRef, row: PracticeKnowledgeRow): string | null {
  if (ref.section.source === "we_build") {
    const built = row.built_sections[ref.key];
    if (!built) return null;
    return latest(built.generated_at, built.edited_at);
  }
  let rev: string | null = null;
  for (const field of ref.section.fields ?? []) {
    if (!fieldFilled(row.payload, field)) continue;
    rev = latest(rev, fieldValue(row.payload, field.path)?.updated_at);
  }
  return rev;
}

function changeAskedAfter(row: PracticeKnowledgeRow, key: string, revision: string | null): boolean {
  const notes = (row.payload.review.notes?.value ?? []).filter((note) => note.section === key);
  const last = notes[notes.length - 1];
  if (!last) return false;
  return !revision || last.at > revision;
}

/** The coach wrote these answers, so the first complete version counts as signed off. */
function coachWrote(ref: SectionRef, payload: PracticeKnowledgePayload): boolean {
  const filled = (ref.section.fields ?? []).filter((field) => fieldFilled(payload, field));
  if (!filled.length) return false;
  return filled.every((field) => {
    const source = fieldValue(payload, field.path)?.source;
    return source === "coach_edit" || source === "interview";
  });
}

function fromYouComplete(ref: SectionRef, payload: PracticeKnowledgePayload): boolean {
  const fields = ref.section.fields ?? [];
  const required = fields.filter((field) => field.required);
  if (required.length) return required.every((field) => fieldFilled(payload, field));
  return fields.some((field) => fieldFilled(payload, field));
}

function changedFields(ref: SectionRef, row: PracticeKnowledgeRow, coachAt: string | null): string[] {
  if (!coachAt || ref.section.source === "we_build") return [];
  return (ref.section.fields ?? [])
    .filter((field) => {
      const at = fieldValue(row.payload, field.path)?.updated_at;
      return Boolean(at && at > coachAt && fieldFilled(row.payload, field));
    })
    .map((field) => field.path);
}

function chosenStatus(payload: PracticeKnowledgePayload, key: string): { status: WorkflowStatus; at: string } | null {
  const raw = payload.review.section_status?.value?.[key];
  if (!raw) return null;
  const split = raw.indexOf("|");
  if (split < 1) return null;
  const status = raw.slice(0, split);
  const at = raw.slice(split + 1);
  if ((status !== "todo" && status !== "review" && status !== "done") || !at) return null;
  return { status, at };
}

export function sectionWorkflow(ref: SectionRef, row: PracticeKnowledgeRow): SectionWorkflow {
  const { section, key } = ref;
  const revision = sectionRevision(ref, row);
  const choice = chosenStatus(row.payload, key);
  const coachAt = stampAt(row.payload, key, "coach");
  const fieldsChanged = changedFields(ref, row, coachAt);
  const changed = Boolean(coachAt && revision && revision > coachAt);

  const notes = (row.payload.review.notes?.value ?? []).filter((note) => note.section === key);
  const lastNote = notes[notes.length - 1];
  if (
    section.source === "we_build" &&
    lastNote &&
    (!revision || lastNote.at > revision) &&
    (!choice || lastNote.at > choice.at)
  ) {
    return { status: "todo", owner: "bca", tracked: true, revision, changed: false, changedFields: [] };
  }

  if (choice && (!revision || choice.at >= revision)) {
    const owner: WorkflowOwner | null =
      choice.status === "done" ? null : choice.status === "todo" && section.source === "we_build" ? "bca" : "coach";
    return {
      status: choice.status,
      owner: choice.status === "done" ? null : owner,
      tracked: true,
      revision,
      changed: false,
      changedFields: [],
    };
  }

  if (section.source === "we_build") {
    if (!row.built_sections[key] || changeAskedAfter(row, key, revision)) {
      return { status: "todo", owner: "bca", tracked: true, revision, changed: false, changedFields: [] };
    }
    return signed(ref, row, revision, coachAt, changed, fieldsChanged);
  }

  const required = (section.fields ?? []).filter((field) => field.required);
  const anyFilled = (section.fields ?? []).some((field) => fieldFilled(row.payload, field));
  const tracked = required.length > 0 || anyFilled;
  if (!tracked) {
    return { status: "done", owner: null, tracked: false, revision: null, changed: false, changedFields: [] };
  }
  if (required.length && !required.every((field) => fieldFilled(row.payload, field))) {
    return { status: "todo", owner: "coach", tracked: true, revision, changed: false, changedFields: [] };
  }
  return signed(ref, row, revision, coachAt, changed, fieldsChanged);
}

function signed(
  ref: SectionRef,
  row: PracticeKnowledgeRow,
  revision: string | null,
  coachAt: string | null,
  changed: boolean,
  fieldsChanged: string[]
): SectionWorkflow {
  const base = { tracked: true, revision, changed, changedFields: fieldsChanged };
  if (!revision) {
    const owner: WorkflowOwner = ref.section.source === "we_build" ? "bca" : "coach";
    return { status: "todo", owner, ...base, changed: false, changedFields: [] };
  }
  const implicit =
    ref.section.source === "from_you" && !coachAt && coachWrote(ref, row.payload);
  const coachSigned = implicit || Boolean(coachAt && coachAt >= revision);
  if (!coachSigned) {
    return { status: "review", owner: "coach", ...base };
  }
  if (BCA_GATE.has(ref.key)) {
    const bcaAt = stampAt(row.payload, ref.key, "bca");
    if (!bcaAt || bcaAt < revision) {
      return { status: "review", owner: "bca", ...base, changed: false, changedFields: [] };
    }
  }
  return { status: "done", owner: null, ...base, changed: false, changedFields: [] };
}

export function workflowQueue(row: PracticeKnowledgeRow): { ref: SectionRef; work: SectionWorkflow }[] {
  return BLUEPRINT_SECTIONS.filter((ref) => ref.section.face !== "stored")
    .map((ref) => ({ ref, work: sectionWorkflow(ref, row) }))
    .filter((item) => item.work.tracked);
}

/**
 * The first time a coach finishes a From you section, that version is Done.
 * A later edit of an already-finished section leaves the old sign-off in place,
 * so the section returns to Review.
 */
export function signOffFreshAnswers(
  prev: PracticeKnowledgePayload,
  next: PracticeKnowledgePayload
): PracticeKnowledgePayload {
  const stamps = { ...(next.review.approved_sections?.value ?? {}) };
  let changed = false;
  const prevRow = { payload: prev, built_sections: {} } as PracticeKnowledgeRow;
  const nextRow = { payload: next, built_sections: {} } as PracticeKnowledgeRow;

  for (const ref of BLUEPRINT_SECTIONS) {
    if (ref.section.source !== "from_you" || stamps[ref.key]) continue;
    if (!fromYouComplete(ref, next) || !coachWrote(ref, next)) continue;
    const nextRev = sectionRevision(ref, nextRow);
    if (!nextRev) continue;
    if (!fromYouComplete(ref, prev)) {
      stamps[ref.key] = nextRev;
      changed = true;
      continue;
    }
    const prevRev = sectionRevision(ref, prevRow);
    if (prevRev && nextRev > prevRev) {
      stamps[ref.key] = prevRev;
      changed = true;
    }
  }

  if (!changed) return next;
  return {
    ...next,
    review: {
      ...next.review,
      approved_sections: sourced(
        stamps,
        next.review.approved_sections?.source ?? "coach_edit",
        next.review.approved_sections?.updated_at
      ),
    },
  };
}
