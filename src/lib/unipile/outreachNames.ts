import { stripBusinessLegalSuffix } from "@/lib/prospectDisplayFormat";

/**
 * Tidies names before they go into a campaign message, so "Hi {{first_name}}"
 * never reads "Hi Mr", "Hi John Smith," or "Hi JOHN".
 */

const TITLE_RE = /^(mr|mrs|miss|ms|mx|dr|prof|professor|sir|dame|rev|revd)\.?$/i;

/** Everything after a comma, bracket, pipe, slash or spaced dash is a note or letters. */
const TRAILING_NOTE_RE = /\s*(?:[,(\[|/•·]|\s[-–—]\s).*$/;

function stripDecorative(text: string): string {
  return text
    .replace(/\p{Extended_Pictographic}/gu, "")
    .replace(/[︎️‍⃣]/g, "")
    .replace(/[\u{1F3FB}-\u{1F3FF}]/gu, "")
    .replace(/\s+/g, " ")
    .trim();
}

/** "JOHN" / "john" → "John"; mixed case (McKenzie) and short caps (AJ) stay as typed. */
function fixCase(word: string): string {
  const lower = word.toLocaleLowerCase();
  const upper = word.toLocaleUpperCase();
  const allLower = word === lower;
  const allUpper = word === upper && word.length > 2;
  if (!allLower && !allUpper) return word;
  return lower
    .split("-")
    .map((part) => part.charAt(0).toLocaleUpperCase() + part.slice(1))
    .join("-");
}

/** The one word to greet them by: no title, surname, letters or emoji. */
export function outreachFirstName(value: string | null | undefined): string {
  const cleaned = stripDecorative(value ?? "").replace(TRAILING_NOTE_RE, "");
  const words = cleaned.split(/\s+/).filter(Boolean);
  const first = words.find((word) => !TITLE_RE.test(word));
  return first ? fixCase(first.replace(/[.,;:!]+$/, "")) : "";
}

/** Letters after a name: B.Eng, MIET, GIFireE, BSc, Hons. */
function looksLikeLetters(word: string): boolean {
  return (
    word.includes(".") ||
    /^[A-Z]{2,6}$/.test(word) ||
    /^[A-Z][A-Za-z]*[A-Z][A-Za-z]*$/.test(word) ||
    /^(hons|bsc|msc|ba|ma|phd|beng|meng|ceng|llb|mba)$/i.test(word)
  );
}

/** Surname without letters, notes or emoji. */
export function outreachLastName(value: string | null | undefined): string {
  const cleaned = stripDecorative(value ?? "").replace(TRAILING_NOTE_RE, "");
  const words = cleaned.split(/\s+/).filter(Boolean);
  const allCaps = cleaned === cleaned.toLocaleUpperCase();
  while (words.length > 1 && !allCaps && looksLikeLetters(words[words.length - 1]!)) {
    words.pop();
  }
  return words.map(fixCase).join(" ");
}

const SMALL_WORDS = new Set(["and", "of", "the", "for", "to", "in", "at"]);

/** "DATALEC PRECISION INSTALLATIONS" → "Datalec Precision Installations"; short words like AJP stay caps. */
function calmShouting(name: string): string {
  const words = name.split(" ");
  const hasLetters = /\p{L}/u.test(name);
  if (words.length < 2 || !hasLetters || name !== name.toLocaleUpperCase()) {
    return name;
  }
  return words
    .map((word, i) => {
      const lower = word.toLocaleLowerCase();
      if (i > 0 && SMALL_WORDS.has(lower)) return lower;
      if (word.length <= 3) return word;
      return fixCase(word);
    })
    .join(" ");
}

/** Business name without Ltd / Limited / PLC / LLP / Inc, emoji or shouting. */
export function outreachCompanyName(value: string | null | undefined): string {
  const cleaned = stripDecorative(value ?? "");
  return cleaned ? calmShouting(stripBusinessLegalSuffix(cleaned)) : "";
}
