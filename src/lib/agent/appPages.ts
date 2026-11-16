import * as fs from "node:fs";
import * as path from "node:path";

/**
 * Every coach page, written from the code by scripts/ava-app-map.ts (job 226).
 * Ava reads the short index (app-pages.md); this is the same map as data, for
 * link_to_page and page_details.
 */

export type AppPage = {
  path: string;
  adminPath: string | null;
  coachVisible: boolean;
  title: string;
  where: string;
  summary: string;
  tabs: { label: string; path: string | null }[];
  controls: string[];
  notes: string;
};

const FILE = path.join(process.cwd(), "content", "agent", "references", "app-pages.json");

let cache: AppPage[] | null = null;

export function appPages(): AppPage[] {
  if (cache) return cache;
  try {
    const parsed = JSON.parse(fs.readFileSync(FILE, "utf8")) as { pages?: AppPage[] };
    cache = (parsed.pages ?? []).filter((p) => p.coachVisible);
  } catch {
    cache = [];
  }
  return cache;
}

/** "/coach/campaigns/[id]" matches "/coach/campaigns/abc". */
function matches(pattern: string, actual: string): boolean {
  const a = pattern.split("/");
  const b = actual.split("/");
  return a.length === b.length && a.every((seg, i) => seg.startsWith("[") || seg === b[i]);
}

/** The page a path belongs to, ignoring ?tab=… and the /admin prefix. */
export function findAppPage(rawPath: string): AppPage | null {
  const bare = rawPath.trim().split("?")[0].replace(/\/+$/, "").replace(/^\/admin(?=\/|$)/, "/coach");
  const pages = appPages();
  return pages.find((p) => p.path === bare) ?? pages.find((p) => matches(p.path, bare)) ?? null;
}

/**
 * A path Ava may link to: a mapped page or one of its tabs. Dynamic pages need
 * the real id filled in. Admins get the admin copy of the page when there is one.
 */
export function linkForPath(mode: "admin" | "coach", rawPath: string): string | null {
  const wanted = rawPath.trim();
  if (!wanted.startsWith("/coach") && !wanted.startsWith("/admin")) return null;
  if (wanted.includes("[")) return null;
  const page = findAppPage(wanted);
  if (!page) return null;
  const [bare, query] = wanted.replace(/^\/admin(?=\/|$)/, "/coach").split("?");
  if (query) {
    const tabOk = page.tabs.some((t) => t.path === `${bare}?${query}`);
    if (!tabOk) return null;
  }
  const suffix = query ? `?${query}` : "";
  if (mode === "admin") {
    if (!page.adminPath) return null;
    return bare.replace(/^\/coach/, "/admin") + suffix;
  }
  return bare + suffix;
}
