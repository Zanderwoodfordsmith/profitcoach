/** Capitalize the first letter of each word; lowercase the rest. */
function capitalizeWord(word: string): string {
  for (let i = 0; i < word.length; ) {
    const codePoint = word.codePointAt(i)!;
    const ch = String.fromCodePoint(codePoint);
    const charLen = ch.length;
    if (/^\p{L}$/u.test(ch)) {
      return (
        word.slice(0, i) +
        ch.toLocaleUpperCase() +
        word.slice(i + charLen).toLocaleLowerCase()
      );
    }
    i += charLen;
  }
  return word;
}

function formatWords(text: string): string {
  return text
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map(capitalizeWord)
    .join(" ");
}

/** Display / save format for person names (first, last, full). */
export function formatProspectPersonName(
  text: string | null | undefined
): string {
  if (!text?.trim()) return "";
  return formatWords(text);
}

/** Display / save format for title, business, and similar labels. */
export function formatProspectLabel(
  text: string | null | undefined
): string | null {
  if (!text?.trim()) return null;
  return formatWords(text);
}

export function normalizeProspectPersonName(
  text: string | null | undefined
): string | null {
  const formatted = formatProspectPersonName(text);
  return formatted || null;
}

export function normalizeProspectLabel(
  text: string | null | undefined
): string | null {
  return formatProspectLabel(text);
}
