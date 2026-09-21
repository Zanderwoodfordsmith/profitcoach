export type MergeFieldGroup = "Prospect" | "You" | "Scorecard";

export type MergeField = {
  key: string;
  label: string;
  group: MergeFieldGroup;
  /** What this fills in. */
  hint: string;
  /** What it looks like once filled. */
  example: string;
  aliases?: string[];
};

/** Fields coaches can insert. Stored as {{key}}; shown as the label. */
export const MERGE_FIELD_CATALOG: MergeField[] = [
  {
    key: "first_name",
    label: "First name",
    group: "Prospect",
    hint: "Their first name",
    example: "Sarah",
    aliases: ["firstName"],
  },
  {
    key: "last_name",
    label: "Last name",
    group: "Prospect",
    hint: "Their last name",
    example: "Chen",
    aliases: ["lastName"],
  },
  {
    key: "full_name",
    label: "Full name",
    group: "Prospect",
    hint: "First and last name",
    example: "Sarah Chen",
    aliases: ["fullName", "name"],
  },
  {
    key: "company",
    label: "Company",
    group: "Prospect",
    hint: "The business they work at",
    example: "Northwind Accounting",
    aliases: ["company_name", "companyName"],
  },
  {
    key: "title",
    label: "Title",
    group: "Prospect",
    hint: "Their job title on LinkedIn",
    example: "Managing Director",
    aliases: ["headline", "job_title", "jobTitle"],
  },
  {
    key: "location",
    label: "Location",
    group: "Prospect",
    hint: "City or region from their profile",
    example: "Manchester",
    aliases: ["city"],
  },
  {
    key: "coach_name",
    label: "Coach name",
    group: "You",
    hint: "Your name, as they see it",
    example: "Zander",
  },
  {
    key: "assessment_url",
    label: "Assessment link",
    group: "Scorecard",
    hint: "Link for them to take the BOSS Scorecard",
    example: "…/assessment/your-name",
    aliases: ["scorecard_url"],
  },
  {
    key: "assessment_pro_url",
    label: "Pro assessment link",
    group: "Scorecard",
    hint: "Link for them to take the Pro scorecard",
    example: "…/assessment/your-name/pro",
  },
  {
    key: "boss_score",
    label: "BOSS score",
    group: "Scorecard",
    hint: "Their score out of 100, after they finish",
    example: "62",
  },
  {
    key: "focus_area_1",
    label: "Focus area",
    group: "Scorecard",
    hint: "The weakest area on their scorecard",
    example: "Profit & Cash",
  },
  {
    key: "desired_outcome",
    label: "Desired outcome",
    group: "Scorecard",
    hint: "What they said they want most",
    example: "More time and freedom",
  },
  {
    key: "boss_score_report_link",
    label: "Report link",
    group: "Scorecard",
    hint: "Link to their completed scorecard results",
    example: "…/assessment/your-name/report",
  },
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
