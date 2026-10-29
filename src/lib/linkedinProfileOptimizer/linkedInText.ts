/**
 * LinkedIn has no formatting, so bold has to be Unicode bold letters (𝗪𝗛𝗔𝗧 𝗜 𝗗𝗢).
 * Markdown bold (**like this**) would paste as literal asterisks.
 */

const BOLD_UPPER = 0x1d5d4; // 𝗔
const BOLD_LOWER = 0x1d5ee; // 𝗮
const BOLD_DIGIT = 0x1d7ec; // 𝟬

function boldChar(ch: string): string {
  const code = ch.charCodeAt(0);
  if (code >= 65 && code <= 90) return String.fromCodePoint(BOLD_UPPER + code - 65);
  if (code >= 97 && code <= 122) return String.fromCodePoint(BOLD_LOWER + code - 97);
  if (code >= 48 && code <= 57) return String.fromCodePoint(BOLD_DIGIT + code - 48);
  return ch;
}

export function toUnicodeBold(text: string): string {
  return Array.from(text, boldChar).join("");
}

/** Turns markdown bold into Unicode bold. Everything else is left as written. */
export function linkedInText(text: string): string {
  return text.replace(/\*\*([^*\n]+?)\*\*/g, (_, inner: string) => toUnicodeBold(inner));
}
