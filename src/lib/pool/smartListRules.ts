import {
  poolRowMatchesFitFilter,
  poolRowMatchesHeadcountFilter,
  poolRowMatchesPostcodeFilter,
  poolRowMatchesCityFilter,
  poolRowMatchesIndustryFilter,
  type PoolPerson,
} from "@/lib/pool/poolPeople";
import {
  isPoolOutreachStatus,
  outreachDaysSince,
} from "@/lib/pool/outreachStatus";

/**
 * Smart lists (job 301): a Lead Lists tab that fills itself from rules.
 * People who match join; people who stop matching drop off. Nobody is added
 * or removed by hand. Rules live in the tab's saved view settings.
 *
 * Shape: "Match all / any of these", each item a rule or a group (one level
 * deep) with its own all / any. "all" = AND, "any" = OR.
 */

export type SmartMatch = "all" | "any";

export type SmartRuleField =
  | "tag"
  | "status"
  | "campaign"
  | "added"
  | "fit"
  | "headcount"
  | "industry"
  | "place"
  | "postcode"
  | "contact"
  | "linkedin"
  | "source";

/** Status "for more / less than N days". "any" = no time limit. */
export type SmartWhen = "any" | "more" | "less";

export type SmartRule = {
  kind: "rule";
  id: string;
  field: SmartRuleField;
  op: string;
  value: string;
  when: SmartWhen;
  days: number | null;
};

export type SmartGroup = {
  kind: "group";
  id: string;
  match: SmartMatch;
  rules: SmartRule[];
};

export type SmartItem = SmartRule | SmartGroup;

export type PoolSmartRules = {
  match: SmartMatch;
  items: SmartItem[];
};

type ValueKind =
  | "tag"
  | "status"
  | "campaign"
  | "fit"
  | "headcount"
  | "contact"
  | "source"
  | "text"
  | "days"
  | "none";

export const SMART_RULE_FIELDS: Array<{
  key: SmartRuleField;
  label: string;
  ops: Array<{ key: string; label: string }>;
  value: ValueKind;
  placeholder?: string;
}> = [
  {
    key: "tag",
    label: "Tag",
    ops: [
      { key: "has", label: "has" },
      { key: "not_has", label: "doesn't have" },
    ],
    value: "tag",
  },
  {
    key: "status",
    label: "Status",
    ops: [
      { key: "is", label: "is" },
      { key: "is_not", label: "isn't" },
    ],
    value: "status",
  },
  {
    key: "campaign",
    label: "Campaign",
    ops: [
      { key: "in", label: "is in" },
      { key: "not_in", label: "isn't in" },
    ],
    value: "campaign",
  },
  {
    key: "added",
    label: "Date added",
    ops: [
      { key: "more", label: "more than" },
      { key: "less", label: "less than" },
    ],
    value: "days",
  },
  {
    key: "fit",
    label: "Fit",
    ops: [
      { key: "is", label: "is" },
      { key: "is_not", label: "isn't" },
    ],
    value: "fit",
  },
  {
    key: "headcount",
    label: "Company size",
    ops: [
      { key: "is", label: "is" },
      { key: "is_not", label: "isn't" },
    ],
    value: "headcount",
  },
  {
    key: "industry",
    label: "Industry",
    ops: [
      { key: "contains", label: "contains" },
      { key: "not_contains", label: "doesn't contain" },
    ],
    value: "text",
    placeholder: "Plumber",
  },
  {
    key: "place",
    label: "City or area",
    ops: [
      { key: "contains", label: "contains" },
      { key: "not_contains", label: "doesn't contain" },
    ],
    value: "text",
    placeholder: "Manchester",
  },
  {
    key: "postcode",
    label: "Postcode",
    ops: [
      { key: "starts", label: "starts with" },
      { key: "not_starts", label: "doesn't start with" },
    ],
    value: "text",
    placeholder: "M1 or SW1A",
  },
  {
    key: "contact",
    label: "Contact",
    ops: [
      { key: "has", label: "has" },
      { key: "not_has", label: "doesn't have" },
    ],
    value: "contact",
  },
  {
    key: "linkedin",
    label: "LinkedIn profile",
    ops: [
      { key: "has", label: "has one" },
      { key: "not_has", label: "doesn't have one" },
    ],
    value: "none",
  },
  {
    key: "source",
    label: "Source",
    ops: [
      { key: "is", label: "is" },
      { key: "is_not", label: "isn't" },
    ],
    value: "source",
  },
];

const FIELD_BY_KEY = new Map(SMART_RULE_FIELDS.map((field) => [field.key, field]));

export function smartRuleFieldMeta(field: SmartRuleField) {
  return FIELD_BY_KEY.get(field) ?? SMART_RULE_FIELDS[0]!;
}

/** Value meaning "in any campaign" for the campaign rule. */
export const SMART_ANY_CAMPAIGN = "any";

const MAX_ITEMS = 30;
const MAX_GROUP_RULES = 20;
const MAX_DAYS = 3650;

export function newSmartId(): string {
  return `r${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36).slice(-4)}`;
}

export function createSmartRule(field: SmartRuleField = "tag"): SmartRule {
  const meta = smartRuleFieldMeta(field);
  return {
    kind: "rule",
    id: newSmartId(),
    field,
    op: meta.ops[0]!.key,
    value: field === "campaign" ? SMART_ANY_CAMPAIGN : "",
    when: "any",
    days: null,
  };
}

export function createSmartGroup(): SmartGroup {
  return { kind: "group", id: newSmartId(), match: "any", rules: [createSmartRule()] };
}

export function createEmptySmartRules(): PoolSmartRules {
  return { match: "all", items: [createSmartRule()] };
}

function normalizeDays(value: unknown): number | null {
  const n = typeof value === "number" ? value : typeof value === "string" ? Number(value) : NaN;
  if (!Number.isFinite(n)) return null;
  return Math.min(MAX_DAYS, Math.max(0, Math.round(n)));
}

/** Fixed fallback ids: normalising the same rules twice must give the same result. */
function normalizeRule(raw: unknown, fallbackId: string): SmartRule | null {
  if (!raw || typeof raw !== "object") return null;
  const source = raw as Partial<SmartRule>;
  const meta = FIELD_BY_KEY.get(source.field as SmartRuleField);
  if (!meta) return null;
  const op = meta.ops.some((option) => option.key === source.op)
    ? (source.op as string)
    : meta.ops[0]!.key;
  const when: SmartWhen =
    source.when === "more" || source.when === "less" ? source.when : "any";
  return {
    kind: "rule",
    id: typeof source.id === "string" && source.id ? source.id.slice(0, 40) : fallbackId,
    field: meta.key,
    op,
    value: typeof source.value === "string" ? source.value.trim().slice(0, 120) : "",
    when,
    days: normalizeDays(source.days),
  };
}

function normalizeMatch(value: unknown): SmartMatch {
  return value === "any" ? "any" : "all";
}

/** Null when there are no rules saved (an ordinary tab, not a smart list). */
export function normalizeSmartRules(raw: unknown): PoolSmartRules | null {
  if (!raw || typeof raw !== "object") return null;
  const source = raw as { match?: unknown; items?: unknown };
  if (!Array.isArray(source.items)) return null;
  const items: SmartItem[] = [];
  source.items.slice(0, MAX_ITEMS).forEach((item, index) => {
    if (item && typeof item === "object" && (item as SmartGroup).kind === "group") {
      const group = item as Partial<SmartGroup>;
      const groupId =
        typeof group.id === "string" && group.id ? group.id.slice(0, 40) : `g${index}`;
      const rules = (Array.isArray(group.rules) ? group.rules : [])
        .slice(0, MAX_GROUP_RULES)
        .map((rule, ruleIndex) => normalizeRule(rule, `${groupId}-${ruleIndex}`))
        .filter((rule): rule is SmartRule => rule !== null);
      items.push({ kind: "group", id: groupId, match: normalizeMatch(group.match), rules });
      return;
    }
    const rule = normalizeRule(item, `r${index}`);
    if (rule) items.push(rule);
  });
  return { match: normalizeMatch(source.match), items };
}

/** A rule counts once it says enough to test (a half-filled row is ignored). */
export function smartRuleIsComplete(rule: SmartRule): boolean {
  const meta = smartRuleFieldMeta(rule.field);
  if (meta.value === "none") return true;
  if (meta.value === "days") return rule.days != null;
  if (!rule.value.trim()) return false;
  if (rule.field === "status" && rule.op === "is" && rule.when !== "any") {
    return rule.days != null;
  }
  return true;
}

export function countSmartRules(rules: PoolSmartRules | null): number {
  if (!rules) return 0;
  let count = 0;
  for (const item of rules.items) {
    if (item.kind === "group") count += item.rules.filter(smartRuleIsComplete).length;
    else if (smartRuleIsComplete(item)) count += 1;
  }
  return count;
}

const DAY_MS = 24 * 60 * 60 * 1000;

function daysTest(age: number | null, when: "more" | "less", days: number): boolean {
  if (age == null) return false;
  return when === "more" ? age > days : age < days;
}

function testRule(row: PoolPerson, rule: SmartRule, now: number): boolean {
  const negate = rule.op.startsWith("not_") || rule.op === "is_not";
  const value = rule.value.trim();
  let hit: boolean;
  switch (rule.field) {
    case "tag": {
      const key = value.toLowerCase();
      hit = (row.tags ?? []).some((tag) => tag.toLowerCase() === key);
      break;
    }
    case "status": {
      const status = row.outreach_status ?? "none";
      const want = isPoolOutreachStatus(value) ? value : "none";
      hit = status === want;
      if (hit && !negate && rule.when !== "any" && want !== "none" && rule.days != null) {
        hit = daysTest(outreachDaysSince(row.outreach_status_at, now), rule.when, rule.days);
      }
      break;
    }
    case "campaign":
      hit =
        value === SMART_ANY_CAMPAIGN
          ? row.in_campaign
          : (row.campaign_ids ?? []).includes(value);
      break;
    case "added": {
      const t = row.created_at ? Date.parse(row.created_at) : NaN;
      const age = Number.isNaN(t) ? null : Math.floor((now - t) / DAY_MS);
      // "more than / less than N days ago": the op is the comparison, never negated.
      return daysTest(age, rule.op === "less" ? "less" : "more", rule.days ?? 0);
    }
    case "fit":
      hit = poolRowMatchesFitFilter(row, value as "good" | "ok" | "bad" | "none");
      break;
    case "headcount":
      hit = poolRowMatchesHeadcountFilter(row, [value]);
      break;
    case "industry":
      hit = poolRowMatchesIndustryFilter(row, value);
      break;
    case "place":
      hit = poolRowMatchesCityFilter(row, value);
      break;
    case "postcode":
      hit = poolRowMatchesPostcodeFilter(row, value);
      break;
    case "contact":
      hit =
        value === "phone"
          ? Boolean(row.phone?.trim())
          : Boolean(row.email?.trim());
      break;
    case "linkedin":
      hit = Boolean(row.linkedin_url?.trim());
      break;
    case "source":
      hit = row.source === value;
      break;
    default:
      return true;
  }
  return negate ? !hit : hit;
}

function combine(results: boolean[], match: SmartMatch): boolean {
  if (results.length === 0) return true;
  return match === "any" ? results.some(Boolean) : results.every(Boolean);
}

/** Whether a person belongs on the smart list. Empty or half-filled rules let everyone in. */
export function poolRowMatchesSmartRules(
  row: PoolPerson,
  rules: PoolSmartRules | null,
  now = Date.now()
): boolean {
  if (!rules) return true;
  const results: boolean[] = [];
  for (const item of rules.items) {
    if (item.kind === "group") {
      const complete = item.rules.filter(smartRuleIsComplete);
      if (!complete.length) continue;
      results.push(combine(complete.map((rule) => testRule(row, rule, now)), item.match));
    } else if (smartRuleIsComplete(item)) {
      results.push(testRule(row, item, now));
    }
  }
  return combine(results, rules.match);
}
