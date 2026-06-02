/** Normalize folder/file names and lesson titles for fuzzy academy import matching. */

const UUID_SUFFIX =
  /[-_]?[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const DURATION_SUFFIX = /\s*\(?\d+(\.\d+)?\s*m(in(ute)?s?)?\)?\s*$/i;

/**
 * Trailing parenthesised duration in hours/minutes, e.g. `(1h 5m)`, `(1h 45m)`,
 * `(2m)`, `(19m)`. These come from the Google Docs tab titles in the source docs
 * and must be stripped before matching against legacy-hub lesson titles.
 */
const DURATION_PAREN_SUFFIX =
  /\s*\(\s*(?:\d+\s*h(?:r|rs|our|ours)?\s*)?(?:\d+(?:\.\d+)?\s*m(?:in(?:ute)?s?)?\s*)?\)\s*$/i;

/** Course folder name → legacy-hub `course_id`. */
export const COURSE_FOLDER_ALIASES: Record<string, string> = {
  kickstart: "kickstart",
  "kick start": "kickstart",
  "1 kickstart": "kickstart",
  "1. kickstart": "kickstart",
  "coach action plan": "coach-action-plan",
  "2 coach action plan": "coach-action-plan",
  "2. coach action plan": "coach-action-plan",
  "going pro": "going-pro",
  "3 going pro": "going-pro",
  "3. going pro": "going-pro",
  "coach certification": "profit-coach-certification",
  "profit coach certification": "profit-coach-certification",
  "4 coach certification": "profit-coach-certification",
  "4. coach certification": "profit-coach-certification",
  "client aquisition": "client-acquisition",
  "client acquisition": "client-acquisition",
  "5 client aquisition": "client-acquisition",
  "5. client aquisition": "client-acquisition",
  "5 client acquisition": "client-acquisition",
  "5. client acquisition": "client-acquisition",
  "client delivery": "client-delivery",
  "6 client delivery": "client-delivery",
  "6. client delivery": "client-delivery",
  "profit system": "profit-brand-framework",
  "profit brand framework": "profit-brand-framework",
  "profit brand": "profit-brand-framework",
  "7 profit system": "profit-brand-framework",
  "7. profit system": "profit-brand-framework",
};

export function normalizeMatchText(input: string): string {
  let s = input
    .normalize("NFKC")
    .toLowerCase()
    .replace(/\.(mp4|mov|webm|m4v|txt|md|docx|srt|vtt)$/gi, "")
    .replace(/_/g, " ")
    .replace(/-/g, " ")
    .replace(/[''`]/g, "")
    .replace(/£/g, "gbp")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  s = s.replace(UUID_SUFFIX, "").trim();
  s = s.replace(DURATION_PAREN_SUFFIX, "").trim();
  s = s.replace(DURATION_SUFFIX, "").trim();
  s = s.replace(/\b20\d{2}\b/g, "").replace(/\s+/g, " ").trim();
  s = s.replace(/\biii\b/g, "3").replace(/\bii\b/g, "2").replace(/\biv\b/g, "4");

  return s;
}

/** Drive export shorthand → words that appear in lesson titles. */
const STEM_TOKEN_EXPANSIONS: Record<string, string> = {
  bca: "business coach academy",
  pro: "professional",
};

/** Expand abbreviations in file stems (not lesson titles). */
export function expandStemForMatching(normalizedStem: string): string {
  let s = normalizedStem;
  for (const [abbr, expansion] of Object.entries(STEM_TOKEN_EXPANSIONS)) {
    s = s.replace(new RegExp(`\\b${abbr}\\b`, "g"), expansion);
  }
  return s.replace(/\s+/g, " ").trim();
}

/** Tokens for overlap scoring (drop very short words). */
export function matchTokens(normalized: string): Set<string> {
  const tokens = new Set<string>();
  for (const t of normalized.split(" ")) {
    if (t.length >= 2) tokens.add(t);
  }
  return tokens;
}

/** Dice coefficient on token sets (0–1). */
export function tokenSimilarity(a: string, b: string): number {
  const ta = matchTokens(normalizeMatchText(a));
  const tb = matchTokens(normalizeMatchText(b));
  if (ta.size === 0 || tb.size === 0) return 0;
  let inter = 0;
  for (const t of ta) {
    if (tb.has(t)) inter += 1;
  }
  return (2 * inter) / (ta.size + tb.size);
}

/**
 * How many stem tokens appear in the lesson title (0–1).
 * Handles abbreviated Drive names vs full lesson titles.
 */
export function stemCoverageInTitle(stem: string, lessonTitle: string): number {
  const stemNorm = expandStemForMatching(normalizeMatchText(stem));
  const titleNorm = normalizeMatchText(lessonTitle);
  const stemToks = [...matchTokens(stemNorm)].filter((t) => t.length >= 3);
  if (stemToks.length === 0) return 0;
  let hit = 0;
  for (const t of stemToks) {
    if (titleNorm.includes(t)) hit += 1;
  }
  return hit / stemToks.length;
}

/** Best of dice + stem-in-title coverage (file stems use expansion). */
export function lessonTitleMatchScore(stem: string, lessonTitle: string): number {
  const expandedStem = expandStemForMatching(normalizeMatchText(stem));
  const dice = Math.max(
    tokenSimilarity(stem, lessonTitle),
    tokenSimilarity(expandedStem, lessonTitle)
  );
  const coverage = stemCoverageInTitle(stem, lessonTitle);
  return Math.max(dice, coverage);
}

/**
 * Score how well one title is a (truncated) prefix of the other (0–1).
 *
 * The source docs come from Google Docs tabs whose labels are capped at ~50
 * characters, so a long lesson title like "Refining Your Ideal Profile" can
 * arrive as "Refining Your Ideal Pro". When the shorter normalized title is a
 * prefix of the longer one we treat it as a strong match.
 */
export function lessonTitlePrefixScore(a: string, b: string): number {
  const na = normalizeMatchText(a);
  const nb = normalizeMatchText(b);
  if (!na || !nb) return 0;
  const [shorter, longer] = na.length <= nb.length ? [na, nb] : [nb, na];
  if (!longer.startsWith(shorter)) return 0;
  // Require a meaningful prefix so short generic titles don't over-match.
  if (shorter.length < 12) return shorter === longer ? 1 : 0;
  // Truncated prefix of a longer title: near-certain match.
  return shorter === longer ? 1 : 0.95;
}

/** Resolve a course folder name to `course_id`, or null. */
export function resolveCourseIdFromFolderName(folderName: string): string | null {
  const norm = normalizeMatchText(folderName.replace(/^\d+\.\s*/, ""));
  if (COURSE_FOLDER_ALIASES[norm]) return COURSE_FOLDER_ALIASES[norm];
  for (const [alias, id] of Object.entries(COURSE_FOLDER_ALIASES)) {
    if (norm.includes(alias) || alias.includes(norm)) return id;
  }
  return null;
}
