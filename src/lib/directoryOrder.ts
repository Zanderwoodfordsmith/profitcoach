/**
 * Hand-picked order for browsing the public directory (Zander, 19 Oct 2026).
 * Featured coaches lead in this order; demoted ones sit at the end; everyone else keeps
 * the natural order in between. Only applies to page 1 with no search or filters.
 */
export const FEATURED_DIRECTORY_SLUGS = [
  "pam",
  "will",
  "allison-hogg",
  "hilarymcnair",
  "daniel-oosthuizen",
  "spencer-thomas",
  "rolvi",
  "3sbusiness",
  "jonathanforster",
  "grahamwithe",
];

export const DEMOTED_DIRECTORY_SLUGS = ["adam-msw", "anne"];

/** Shown across the top of the directory while browsing. Change by hand each month. */
export const COACH_OF_THE_MONTH_SLUG = "will";

export function applyDirectoryOrder<T extends { slug: string }>(list: T[]): T[] {
  const rank = (slug: string) => {
    const f = FEATURED_DIRECTORY_SLUGS.indexOf(slug);
    if (f !== -1) return f - FEATURED_DIRECTORY_SLUGS.length;
    return DEMOTED_DIRECTORY_SLUGS.includes(slug) ? 1 : 0;
  };
  return list
    .map((item, index) => ({ item, index }))
    .sort((a, b) => rank(a.item.slug) - rank(b.item.slug) || a.index - b.index)
    .map(({ item }) => item);
}
