import { PUBLIC_APP_ORIGIN } from "@/lib/appBaseUrl";

export type PageLinkOption = {
  path: string;
  label: string;
  group: string;
  description?: string;
};

/**
 * The search being typed after `@@`, or null. Needs a space or line start before
 * it, so `name@@x` stays text, and `@@@` isn't a search. Stays on one line.
 */
export function activePageLinkQuery(
  text: string,
  caret: number
): { start: number; query: string } | null {
  const before = text.slice(0, caret);
  const start = before.lastIndexOf("@@");
  if (start === -1) return null;
  const previous = before[start - 1];
  if (previous !== undefined && !/[\s(]/.test(previous)) return null;
  const query = before.slice(start + 2);
  if (query.includes("\n") || query.length > 40) return null;
  return { start, query };
}

/** Pages matching every typed word; names that start with the search come first. */
export function matchPageLinks(
  pages: PageLinkOption[],
  query: string,
  limit = 8
): PageLinkOption[] {
  const q = query.trim().toLowerCase();
  const words = q.split(/\s+/).filter(Boolean);
  const hits = pages.filter((page) => {
    const hay = `${page.label} ${page.group} ${page.description ?? ""}`.toLowerCase();
    return words.every((word) => hay.includes(word));
  });
  const rank = (page: PageLinkOption) =>
    q && page.label.toLowerCase().startsWith(q) ? 0 : 1;
  return [...hits].sort((a, b) => rank(a) - rank(b)).slice(0, limit);
}

/**
 * Swaps `@@search` for a link. Always the live address, because the message goes
 * to a real coach even when it's typed on a local server.
 */
export function insertPageLink(
  text: string,
  range: { start: number; end: number },
  page: Pick<PageLinkOption, "label" | "path">
): { next: string; caret: number } {
  const label = page.label.replace(/[[\]()]/g, "").trim();
  const insert = `[${label}](${PUBLIC_APP_ORIGIN}${page.path}) `;
  return {
    next: text.slice(0, range.start) + insert + text.slice(range.end),
    caret: range.start + insert.length,
  };
}
