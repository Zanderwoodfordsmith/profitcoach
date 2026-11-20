import { BLUEPRINT_SECTIONS, fieldFilled, fieldValue } from "./blueprint";
import type { PracticeKnowledgeRow } from "./types";

export type AboutYouProgress = {
  state: "not_started" | "started" | "done";
  /** Required About You questions still empty. */
  left: number;
};

/**
 * How far the coach is with About You, for the top bar (20 Nov). Done means
 * every required question is answered; the optional ones (favourite film,
 * income goal) never hold anyone back. Started means the coach typed at least
 * one answer: what we imported from LinkedIn or the signup form doesn't count.
 */
export function aboutYouProgress(row: PracticeKnowledgeRow | null): AboutYouProgress {
  let left = 0;
  let typed = false;
  for (const ref of BLUEPRINT_SECTIONS) {
    if (!ref.group.yours || ref.section.face === "stored") continue;
    for (const field of ref.section.fields ?? []) {
      if (!field.ask) continue;
      const filled = row ? fieldFilled(row.payload, field) : false;
      if (field.required && !filled) left += 1;
      const source = row ? String(fieldValue(row.payload, field.path)?.source ?? "") : "";
      if (filled && (source === "coach_edit" || source === "interview")) typed = true;
    }
  }
  if (left === 0) return { state: "done", left };
  return { state: typed ? "started" : "not_started", left };
}
