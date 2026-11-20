/**
 * Card text that never stops mid-word: the whole text if it fits, else its first sentence, else cut at the last
 * whole word with "…". The CSS line clamps stay as a backstop only.
 */
export function shortText(text: string, max: number) {
  const t = text.trim();
  if (t.length <= max) return t;
  // A full stop only ends a sentence when a space follows, so "£10.5m" stays whole
  const first = t.match(/^.+?[.!?](?=\s|$)/)?.[0];
  if (first && first.length <= max) return first;
  const cut = t.slice(0, max - 1);
  return cut.slice(0, cut.lastIndexOf(" ")).replace(/[\s,;:]+$/, "") + "…";
}
