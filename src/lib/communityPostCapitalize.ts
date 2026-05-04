/**
 * Uppercases the first Unicode letter in `text`. Preserves leading whitespace
 * and any non-letters before the first letter (e.g. markdown `#`, `>`, `*`).
 */
export function capitalizeFirstUnicodeLetter(text: string): string {
  for (let i = 0; i < text.length; ) {
    const codePoint = text.codePointAt(i)!;
    const ch = String.fromCodePoint(codePoint);
    const charLen = ch.length;
    if (/^\p{L}$/u.test(ch)) {
      const upper = ch.toLocaleUpperCase();
      return text.slice(0, i) + upper + text.slice(i + charLen);
    }
    i += charLen;
  }
  return text;
}
