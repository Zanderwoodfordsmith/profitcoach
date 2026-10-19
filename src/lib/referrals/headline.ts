import {
  BASE_SEARCH_TITLE_EXCLUDES,
  BASE_SEARCH_TITLE_INCLUDES,
} from "@/lib/salesNavigator/baseSearchDefaults";

function escape(term: string): string {
  return term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/[\s-]+/g, "[\\s-]?");
}

/** Base search titles plus the ones LinkedIn headlines use in place of them. */
const DECISION_MAKER = new RegExp(
  `\\b(${[
    ...BASE_SEARCH_TITLE_INCLUDES,
    "MD",
    "chief executive",
    "proprietor",
    "chair",
    "chairman",
    "chairwoman",
    "chairperson",
    "president",
  ]
    .map(escape)
    .join("|")})\\b`,
  "i"
);

const EXCLUDE = new RegExp(`\\b(${BASE_SEARCH_TITLE_EXCLUDES.map(escape).join("|")})\\b`, "i");

/** Titles that contain a decision-maker word but are not one. */
const FALSE_FRIENDS = /\b(product owner|vice[\s-]?president|vp)\b/i;

/** Owner, founder, CEO, MD, managing partner or chair, and not a coach, consultant or recruiter. */
export function isDecisionMakerHeadline(headline: string | null | undefined): boolean {
  const text = (headline ?? "").trim();
  if (!text || EXCLUDE.test(text)) return false;
  return DECISION_MAKER.test(text.replace(FALSE_FRIENDS, ""));
}
