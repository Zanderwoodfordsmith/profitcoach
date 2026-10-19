import { resolveMergeField } from "@/lib/unipile/mergeFields";

/** LinkedIn's limit for the note on a connection request. */
export const CONNECTION_NOTE_MAX = 300;

/** Characters each field is counted as, since the real value differs per person. */
const FIELD_LENGTH: Record<string, number> = {
  first_name: 10,
  last_name: 12,
  full_name: 23,
  company: 30,
  title: 30,
  location: 15,
  coach_name: 10,
  profile_hook: 120,
  assessment_url: 50,
  assessment_pro_url: 54,
  boss_score_report_link: 57,
  boss_score: 2,
  focus_area_1: 18,
  desired_outcome: 30,
};
const OTHER_FIELD_LENGTH = 20;

/** Scorecard fields: links that cut acceptance, or results that are blank before they take it. */
const SCORECARD_LINK_KEYS = new Set([
  "assessment_url",
  "assessment_pro_url",
  "boss_score_report_link",
]);

const TOKEN_RE = /\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g;
/** A template's "[who you help, e.g. ...]" bits, which must never reach a prospect. */
const FILL_IN_RE = /\[[^[\]\n]{2,160}\]/g;

export function templateFillIns(text: string): string[] {
  return text.match(FILL_IN_RE) ?? [];
}

/** How long the note will be once filled in, counting each field at a typical length. */
export function connectionNoteLength(body: string): number {
  const text = body.trim();
  let length = 0;
  let last = 0;
  for (const match of text.matchAll(TOKEN_RE)) {
    length += (match.index ?? 0) - last;
    const key = resolveMergeField(match[1])?.key ?? match[1];
    length += FIELD_LENGTH[key] ?? OTHER_FIELD_LENGTH;
    last = (match.index ?? 0) + match[0].length;
  }
  return length + (text.length - last);
}

export type ConnectionNoteCheck = {
  length: number;
  max: number;
  over: number;
  /** Labels of scorecard fields in the note, in order. */
  scorecardLinks: string[];
  scorecardResults: string[];
  /** Template bits still in [brackets]. */
  fillIns: number;
};

export function checkConnectionNote(
  body: string,
  max = CONNECTION_NOTE_MAX
): ConnectionNoteCheck {
  const length = connectionNoteLength(body);
  const scorecardLinks: string[] = [];
  const scorecardResults: string[] = [];
  for (const match of body.matchAll(TOKEN_RE)) {
    const field = resolveMergeField(match[1]);
    if (field?.group !== "Scorecard") continue;
    const list = SCORECARD_LINK_KEYS.has(field.key)
      ? scorecardLinks
      : scorecardResults;
    if (!list.includes(field.label)) list.push(field.label);
  }
  return {
    length,
    max,
    over: Math.max(0, length - max),
    scorecardLinks,
    scorecardResults,
    fillIns: templateFillIns(body).length,
  };
}
