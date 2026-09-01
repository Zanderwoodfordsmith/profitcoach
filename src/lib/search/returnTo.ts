import { safeAppReturnTo } from "@/lib/bossGridNavigation";

const SEARCH_RETURN_KEY = "pc-search-return";

export function pathWithQuery(
  pathname: string,
  searchParams: { toString(): string }
): string {
  const qs = searchParams.toString();
  return qs ? `${pathname}?${qs}` : pathname;
}

function isSearchPath(path: string, searchBase: string): boolean {
  return path === searchBase || path.startsWith(`${searchBase}?`);
}

/** Remember the in-app page that led to search (lesson, community, etc.). */
export function rememberSearchReturn(path: string, searchBase: string): void {
  const safe = safeAppReturnTo(path);
  if (!safe || isSearchPath(safe, searchBase)) return;
  try {
    sessionStorage.setItem(SEARCH_RETURN_KEY, safe);
  } catch {
    /* private mode / quota */
  }
}

/** Consume the stored origin. Same admin/coach prefix only. */
export function takeSearchReturn(
  prefix: "/admin" | "/coach",
  searchBase: string
): string | null {
  let raw: string | null = null;
  try {
    raw = sessionStorage.getItem(SEARCH_RETURN_KEY);
    sessionStorage.removeItem(SEARCH_RETURN_KEY);
  } catch {
    return null;
  }
  const safe = safeAppReturnTo(raw);
  if (!safe || isSearchPath(safe, searchBase)) return null;
  if (safe !== prefix && !safe.startsWith(`${prefix}/`)) return null;
  return safe;
}
