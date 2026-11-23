import { type FieldSpec } from "@/lib/practiceKnowledge/blueprint";
import { sourced } from "@/lib/practiceKnowledge/sourced";
import type { PracticeKnowledgePayload, PracticeKnowledgeRow } from "@/lib/practiceKnowledge/types";

import { fillableAnswer } from "./avaWork";

/**
 * Ava's open drafts laid over a coach's Blueprint. Safe for the browser: the
 * launch chain uses it on the server (drafts.ts), and admins see it in place
 * on the coach's Blueprint (job 248, 21 Nov). Nothing here is saved.
 */

export type OpenDraft = {
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
