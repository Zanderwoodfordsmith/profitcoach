/**
 * Title-case a person's display name (e.g. "simon cox" → "Simon Cox").
 * Leaves slug-style tokens alone when used as fallback.
 */
export function formatPersonName(value: string | null | undefined): string {
  const trimmed = value?.trim() ?? "";
  if (!trimmed) return "";

  return trimmed
    .split(/\s+/)
    .map((word) => {
      if (!word) return word;
      const parts = word.split("-");
      return parts
        .map((part) =>
          part.length > 0
            ? part.charAt(0).toUpperCase() + part.slice(1).toLowerCase()
            : part
        )
        .join("-");
    })
    .join(" ");
}
