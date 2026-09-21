import {
  magnetForPlaybookId,
  feedsMagnetId,
  isSupersededPlaybookId,
  type LeadMagnetId,
  type LeadMagnetSequenceSlot,
} from "@/lib/leadMagnets/catalog";

export type MergeFieldGroup = "Prospect" | "You" | "Scorecard";

/** Which sequence the insert chips are for. */
export type MergeFieldPickerKind =
  | "outreach"
  | "magnet_started"
  | "magnet_completed"
  | "custom";

export type MergeFieldPickerContext = {
  kind: MergeFieldPickerKind;
  magnetId?: LeadMagnetId | null;
};

export const DEFAULT_MERGE_FIELD_PICKER: MergeFieldPickerContext = {
  kind: "custom",
};

export type MergeField = {
  key: string;
  label: string;
  group: MergeFieldGroup;
  /** What this fills in. */
  hint: string;
  /** What it looks like once filled. */
  example: string;
  aliases?: string[];
  /** Offered as an insert chip. Omitted = always, when the picker context allows. */
  insertable?: boolean;
};

const IDENTITY_KEYS = new Set([
  "first_name",
  "last_name",
  "full_name",
  "company",
  "title",
  "location",
  "coach_name",
]);

const RESULT_KEYS = new Set([
  "boss_score",
  "focus_area_1",
  "desired_outcome",
  "boss_score_report_link",
]);

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
    key: "type_of_owner",
    label: "Type of owner",
    group: "You",
    hint: "Who you work with, e.g. scaffolding owners",
    example: "scaffolding owners",
    insertable: false,
  },
  {
    key: "market_observation",
    label: "Market observation",
    group: "You",
    hint: "The thing you hear a lot from this market",
    example:
      "Most owners tell me revenue is fine, but they still can't take a week off.",
    insertable: false,
  },
  {
    key: "assessment_url",
    label: "Boss assessment link",
    group: "Scorecard",
    hint: "Link for them to take the Boss Scorecard",
    example: "…/assessment/your-name",
    aliases: ["scorecard_url", "scorecard_link"],
  },
  {
    key: "assessment_pro_url",
    label: "Boss Pro assessment link",
    group: "Scorecard",
    hint: "Link for them to take Boss Score Pro",
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
    label: "Boss report link",
    group: "Scorecard",
    hint: "Link to their completed Boss scorecard results",
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

function isResultField(key: string) {
  return RESULT_KEYS.has(key);
}

export function isInsertableMergeField(
  field: MergeField,
  picker: MergeFieldPickerContext
): boolean {
  if (field.insertable === false) return false;
  if (IDENTITY_KEYS.has(field.key)) return true;

  if (field.key === "assessment_url") {
    if (picker.kind === "magnet_completed") return false;
    if (picker.kind === "magnet_started") {
      return picker.magnetId !== "boss-score-pro";
    }
    return true;
  }
  if (field.key === "assessment_pro_url") {
    if (picker.kind === "magnet_completed") return false;
    if (picker.kind === "magnet_started") {
      return picker.magnetId === "boss-score-pro";
    }
    return true;
  }
  if (isResultField(field.key)) {
    return picker.kind === "magnet_completed" || picker.kind === "custom";
  }
  return false;
}

export function insertableMergeFields(
  picker: MergeFieldPickerContext = DEFAULT_MERGE_FIELD_PICKER
): MergeField[] {
  return MERGE_FIELD_CATALOG.filter((field) =>
    isInsertableMergeField(field, picker)
  );
}

export function mergeFieldPickerHint(
  field: MergeField,
  picker: MergeFieldPickerContext
): string {
  if (picker.kind === "custom" && isResultField(field.key)) {
    return `${field.hint}. Only fills in if they’ve completed the Boss Scorecard.`;
  }
  return field.hint;
}

export function mergeFieldPickerShowsResultWarning(
  picker: MergeFieldPickerContext
): boolean {
  return picker.kind === "custom";
}

export function mergeFieldPickerForMagnet(
  magnetId: LeadMagnetId,
  slot: LeadMagnetSequenceSlot
): MergeFieldPickerContext {
  return {
    kind: slot === "completed" ? "magnet_completed" : "magnet_started",
    magnetId,
  };
}

export function mergeFieldPickerForPlaybook(
  playbookId: string | null | undefined
): MergeFieldPickerContext {
  const magnet = magnetForPlaybookId(playbookId);
  if (magnet) {
    const sequence = magnet.sequences.find(
      (item) => item.playbookId === playbookId
    );
    return mergeFieldPickerForMagnet(
      magnet.id,
      sequence?.slot === "completed" ? "completed" : "started"
    );
  }
  if (feedsMagnetId(playbookId) || isSupersededPlaybookId(playbookId)) {
    return { kind: "outreach" };
  }
  return { kind: "custom" };
}

export function mergeFieldPickerForLibraryKind(
  kind: "connector" | "reactivation" | "nurture" | "positive_reply"
): MergeFieldPickerContext {
  if (kind === "positive_reply") return { kind: "custom" };
  return { kind: "outreach" };
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
