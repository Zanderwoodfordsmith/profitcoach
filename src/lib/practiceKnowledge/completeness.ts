import type { PracticeKnowledgePayload } from "./types";
import { isUsableResult } from "./results";
import { isFilledSourced, listValue } from "./sourced";

export const MISSING_FIELD_LABELS: Record<string, string> = {
  "identity.linkedin_url": "LinkedIn URL",
  "working_times.prospect_call_hours": "Hours they will take calls",
  "market.industries_worked": "Industries they have worked in",
  "market.avoid": "Who they will not work with",
  "proof.career_results": "A career or client result with a number",
  "proof.superpowers": "Superpowers",
  "proof.uniqueness": "What makes them unique",
  "proof.problems_asked": "Problems people ask them to solve",
};

export function labelMissingField(field: string): string {
  return MISSING_FIELD_LABELS[field] ?? field.replaceAll("_", " ");
}

export const COMPLETENESS_FIELDS = [
  "identity.linkedin_url",
  "working_times.prospect_call_hours",
  "market.industries_worked",
  "market.avoid",
  "proof.career_results",
  "proof.superpowers",
  "proof.uniqueness",
  "proof.problems_asked",
] as const;

export type CompletenessField = (typeof COMPLETENESS_FIELDS)[number];

export function computeCompleteness(payload: PracticeKnowledgePayload): {
  score: number;
  missing_fields: string[];
} {
  const missing: string[] = [];

  if (!isFilledSourced(payload.identity.linkedin_url)) {
    missing.push("identity.linkedin_url");
  }
  if (!isFilledSourced(payload.working_times.prospect_call_hours)) {
    missing.push("working_times.prospect_call_hours");
  }
  if (listValue(payload.market.industries_worked).length === 0) {
    missing.push("market.industries_worked");
  }
  if (listValue(payload.market.avoid).length === 0) {
    missing.push("market.avoid");
  }

  const results = payload.proof.career_results?.value ?? [];
  if (!results.some(isUsableResult)) {
    missing.push("proof.career_results");
  }
  if (!isFilledSourced(payload.proof.superpowers)) {
    missing.push("proof.superpowers");
  }
  if (!isFilledSourced(payload.proof.uniqueness)) {
    missing.push("proof.uniqueness");
  }
  if (listValue(payload.proof.problems_asked).length === 0) {
    missing.push("proof.problems_asked");
  }

  const total = COMPLETENESS_FIELDS.length;
  const filled = total - missing.length;
  return {
    score: Math.round((filled / total) * 100),
    missing_fields: missing,
  };
}

export function sectionCompleteness(payload: PracticeKnowledgePayload): {
  form: boolean;
  career: boolean;
  uniqueness: boolean;
  market: boolean;
  practice: boolean;
} {
  return {
    form: isFilledSourced(payload.practice.delivery_model),
    career: !computeCompleteness(payload).missing_fields.includes(
      "proof.career_results"
    ),
    uniqueness:
      isFilledSourced(payload.proof.superpowers) &&
      isFilledSourced(payload.proof.uniqueness),
    market:
      listValue(payload.market.industries_worked).length > 0 ||
      listValue(payload.market.industries_understand).length > 0 ||
      listValue(payload.market.industries_credibility).length > 0,
    practice: isFilledSourced(payload.practice.delivery_model),
  };
}
