export type MergeFieldGroup = "Prospect" | "You" | "Scorecard";

export type MergeField = {
  key: string;
  label: string;
  group: MergeFieldGroup;
  aliases?: string[];
};

/** Fields coaches can insert. Stored as {{key}}; shown as the label. */
export const MERGE_FIELD_CATALOG: MergeField[] = [
  { key: "first_name", label: "First name", group: "Prospect", aliases: ["firstName"] },
  { key: "last_name", label: "Last name", group: "Prospect", aliases: ["lastName"] },
  {
    key: "full_name",
    label: "Full name",
    group: "Prospect",
    aliases: ["fullName", "name"],
  },
  {
    key: "company",
    label: "Company",
    group: "Prospect",
    aliases: ["company_name", "companyName"],
  },
  {
    key: "title",
    label: "Title",
    group: "Prospect",
    aliases: ["headline", "job_title", "jobTitle"],
  },
  { key: "location", label: "Location", group: "Prospect", aliases: ["city"] },
  { key: "coach_name", label: "Coach name", group: "You" },
  {
    key: "assessment_url",
    label: "Assessment link",
    group: "Scorecard",
    aliases: ["scorecard_url"],
  },
  {
    key: "assessment_pro_url",
    label: "Pro assessment link",
    group: "Scorecard",
  },
  { key: "boss_score", label: "BOSS score", group: "Scorecard" },
  { key: "focus_area_1", label: "Focus area", group: "Scorecard" },
  { key: "desired_outcome", label: "Desired outcome", group: "Scorecard" },
  { key: "boss_score_report_link", label: "Report link", group: "Scorecard" },
];

const BY_KEY = new Map<string, MergeField>();
for (const field of MERGE_FIELD_CATALOG) {
  BY_KEY.set(field.key.toLowerCase(), field);
  for (const alias of field.aliases ?? []) {
    BY_KEY.set(alias.toLowerCase(), field);
  }
}

const TOKEN_RE = /\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g;

export function mergeToken(key: string): string {
  return `{{${key}}}`;
}

export function resolveMergeField(rawKey: string): MergeField | null {
  return BY_KEY.get(rawKey.trim().toLowerCase()) ?? null;
}

export type MergeSegment =
  | { kind: "text"; value: string }
  | { kind: "field"; value: string; field: MergeField }
  | { kind: "unknown"; value: string; key: string };

export function tokenizeMergeFields(text: string): MergeSegment[] {
  const segments: MergeSegment[] = [];
  TOKEN_RE.lastIndex = 0;
  let last = 0;
  let match: RegExpExecArray | null;
  while ((match = TOKEN_RE.exec(text))) {
    if (match.index > last) {
      segments.push({ kind: "text", value: text.slice(last, match.index) });
    }
    const key = match[1];
    const field = resolveMergeField(key);
    if (field) {
      segments.push({ kind: "field", value: match[0], field });
    } else {
      segments.push({ kind: "unknown", value: match[0], key });
    }
    last = match.index + match[0].length;
  }
  if (last < text.length) {
    segments.push({ kind: "text", value: text.slice(last) });
  }
  return segments;
}

export function insertMergeToken(
  text: string,
  key: string,
  start: number,
  end: number
): { next: string; caret: number } {
  const token = mergeToken(key);
  const before = text.slice(0, start);
  const after = text.slice(end);
  const lead =
    before.length > 0 && !/\s$/.test(before) && !before.endsWith("\n")
      ? " "
      : "";
  const trail = after.length > 0 && !/^\s/.test(after) ? " " : "";
  const inserted = `${lead}${token}${trail}`;
  return {
    next: `${before}${inserted}${after}`,
    caret: before.length + inserted.length,
  };
}
