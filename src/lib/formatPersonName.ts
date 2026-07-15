/** Civility titles stripped from person names. Dr is intentionally kept. */
const STRIP_LEADING_HONORIFIC_RE = /^(mr|mrs|miss|ms)\.?$/i;

function stripLeadingHonorifics(words: string[]): string[] {
  let i = 0;
  while (i < words.length && STRIP_LEADING_HONORIFIC_RE.test(words[i]!)) {
    i += 1;
  }
  return words.slice(i);
}

function titleCaseWord(word: string): string {
  if (!word) return word;
  return word
    .split("-")
    .map((part) =>
      part.length > 0
        ? part.charAt(0).toUpperCase() + part.slice(1).toLowerCase()
        : part
    )
    .join("-");
}

/**
 * Title-case a person's display name (e.g. "simon cox" → "Simon Cox").
 * Drops leading Mr / Mrs / Miss / Ms; keeps Dr.
 */
export function formatPersonName(value: string | null | undefined): string {
  const trimmed = value?.trim() ?? "";
  if (!trimmed) return "";

  return stripLeadingHonorifics(trimmed.split(/\s+/).filter(Boolean))
    .map(titleCaseWord)
    .join(" ");
}
