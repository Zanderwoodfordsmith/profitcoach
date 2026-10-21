import type { CoachSite, CoachSiteFact } from "@/lib/coachSite/types";
import { listValue, textValue } from "@/lib/practiceKnowledge/sourced";
import type { PracticeKnowledgeRow } from "@/lib/practiceKnowledge/types";

/** The coach's own lines for the explainer. Everything else is fixed copy in copy.ts. */
export type ExplainerCoach = {
  site: CoachSite;
  /** "Price and terms" as the coach wrote it. */
  fee: string | null;
  /** The headline number and its unit, when the fee starts with one ("£1,950" + "a month"). */
  price: { amount: string; unit: string } | null;
  paymentTerms: string | null;
  guarantee: string | null;
  /** How sessions run, from "How you deliver"; empty means the BCA format. */
  rhythm: string | null;
  helpWith: string[];
  /** Coach facts without anything about the fee, so a no-price copy never leaks it. */
  facts: CoachSiteFact[];
  website: string | null;
};

/**
 * "How you deliver" answers "how much time does it take?" only when it says how
 * often. Older answers folded in from retired fields ("Coaching and consulting")
 * do not, so those fall back to the BCA format in copy.ts.
 */
function describesTiming(text: string): string | null {
  return /\b(session|week|fortnight|month|hour|minute|day)s?\b|weekly|monthly/i.test(text) ? text : null;
}

const MONTHLY =/^(£\s?[\d,]+(?:\.\d{2})?)\s*(?:per|a|\/)\s*month\b/i;

export function explainerFromBlueprint(site: CoachSite, row: PracticeKnowledgeRow | null): ExplainerCoach {
  const practice = row?.payload.practice;
  const fee = textValue(practice?.min_fee) || null;
  const match = fee?.match(MONTHLY);
  return {
    site,
    fee,
    price: match ? { amount: match[1].replace(/\s/g, ""), unit: "a month" } : null,
    paymentTerms: textValue(practice?.payment_terms) || null,
    guarantee: textValue(practice?.guarantee_terms) || null,
    rhythm: describesTiming(textValue(practice?.session_rhythm)),
    helpWith: listValue(practice?.help_with).slice(0, 4),
    facts: site.facts.filter((fact) => !/\b(fee|price|cost)\b/i.test(fact.label)),
    website: textValue(row?.payload.identity.website) || null,
  };
}
