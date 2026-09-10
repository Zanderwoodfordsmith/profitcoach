/** Wrap or insert markdown around the current textarea selection. */
export function applyTextareaWrap(
  value: string,
  selectionStart: number,
  selectionEnd: number,
  before: string,
  after: string,
  placeholder = ""
): { next: string; selectStart: number; selectEnd: number } {
  const start = Math.max(0, Math.min(selectionStart, value.length));
  const end = Math.max(start, Math.min(selectionEnd, value.length));
  const selected = value.slice(start, end);

  if (selected) {
    const next =
      value.slice(0, start) + before + selected + after + value.slice(end);
    return {
      next,
      selectStart: start + before.length,
      selectEnd: start + before.length + selected.length,
    };
  }

  const insert = before + placeholder + after;
  const next = value.slice(0, start) + insert + value.slice(end);
  const selectStart = start + before.length;
  return {
    next,
    selectStart,
    selectEnd: selectStart + placeholder.length,
  };
}

/** Insert `[label](url)` markdown. Returns null if the user cancels the URL prompt. */
export function applyMarkdownLink(
  value: string,
  selectionStart: number,
  selectionEnd: number,
  promptUrl: (defaultUrl: string) => string | null = (d) =>
    typeof window !== "undefined" ? window.prompt("Link URL", d) : null
): { next: string; selectStart: number; selectEnd: number } | null {
  const start = Math.max(0, Math.min(selectionStart, value.length));
  const end = Math.max(start, Math.min(selectionEnd, value.length));
  const selected = value.slice(start, end);
  const label = selected || "link text";

  const raw = promptUrl("https://");
  if (raw == null) return null;
  const href = raw.trim() || "https://";

  const insert = `[${label}](${href})`;
  const next = value.slice(0, start) + insert + value.slice(end);

  if (selected) {
    const urlStart = start + 1 + label.length + 2;
    return {
      next,
      selectStart: urlStart,
      selectEnd: urlStart + href.length,
    };
  }

  return {
    next,
    selectStart: start + 1,
    selectEnd: start + 1 + label.length,
  };
}
