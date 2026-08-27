/** Strip emoji and other decorative symbols from contact display text. */
function stripDecorativeChars(text: string): string {
  return text
    .replace(/\p{Extended_Pictographic}/gu, "")
    .replace(/[\uFE0E\uFE0F\u200D\u20E3]/g, "")
    .replace(/[\u{1F3FB}-\u{1F3FF}]/gu, "") // skin tone modifiers
    .replace(/\s+/g, " ")
    .trim();
}

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
  return stripDecorativeChars(text)
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

const JOB_TITLE_SHORTENINGS: Array<{ pattern: RegExp; replacement: string }> = [
  { pattern: /\bManaging Director\b/gi, replacement: "MD" },
  { pattern: /\bBusiness Owner\b/gi, replacement: "Owner" },
  { pattern: /\bCompany Owner\b/gi, replacement: "Owner" },
];

/** Display format for job titles — same casing as labels, plus compact shortenings. */
export function formatProspectJobTitle(
  text: string | null | undefined
): string | null {
  const formatted = formatProspectLabel(text);
  if (!formatted) return null;
  let out = formatted;
  for (const { pattern, replacement } of JOB_TITLE_SHORTENINGS) {
    out = out.replace(pattern, replacement);
  }
  return out;
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
