/**
 * Types and helpers only, safe in the browser. The library itself is in
 * libraryData.ts (server, full) and libraryPublic.ts (browser, titles only).
 *
 * Resources library (test): every page lives in content/resources/library.json,
 * with document text as markdown files beside it. A page is a list of blocks
 * (document text, a spreadsheet's tabs, a deck, a file, a video, a reading list),
 * and child pages sit indented under their parent in the sidebar, the way the
 * source documents' tabs did.
 */

export type SheetTab = {
  gid: string;
  title: string;
  about: string;
};

export type SheetTabGroup = {
  label: string;
  /** The resource page for the session these tabs belong to. */
  page?: string;
  tabs: SheetTab[];
};

export type ResourceLink = {
  title: string;
  /** External URL, or another resource page's slug. */
  url: string;
  note?: string;
  broken?: boolean;
};

export type ResourceBlock =
  | { type: "doc"; file: string }
  | { type: "sheet"; id: string; title: string; tabGroups: SheetTabGroup[]; note?: string }
  | { type: "slides"; id: string; title: string; slides: number }
  | { type: "file"; id: string; title: string; format: "pptx" | "xlsx" | "docx" | "key" }
  | { type: "image"; src: string; title: string }
  | { type: "video"; url: string; title: string }
  | { type: "links"; title?: string; links: ResourceLink[] };

export type ResourcePage = {
  slug: string;
  title: string;
  /** One line under the title. */
  dek?: string;
  /** Classroom lesson that teaches this page on video. */
  lesson?: string;
  /** When the source was last changed (YYYY-MM-DD). */
  updated?: string;
  blocks: ResourceBlock[];
  children?: ResourcePage[];
};

export type ResourceGroup = {
  title: string;
  /** Get clients, Keep clients or Profit System. */
  section: string;
  /** One line about what's in the group, for the overview. */
  about?: string;
  /** Profit System groups only: the BOSS area number and its pillar. */
  area?: number;
  pillar?: "Vision" | "Velocity" | "Value";
  pages: ResourcePage[];
};

/** Every page in sidebar order, children straight after their parent. */
export function flattenResourcePages(pages: ResourcePage[]): ResourcePage[] {
  return pages.flatMap((page) => [page, ...flattenResourcePages(page.children ?? [])]);
}

/** A page and its group, in whichever copy of the library is passed (full on the server, slim in the browser). */
export function findResourcePageIn(
  groups: ResourceGroup[],
  slug: string
): { page: ResourcePage; group: ResourceGroup } | null {
  for (const group of groups) {
    const page = flattenResourcePages(group.pages).find((p) => p.slug === slug);
    if (page) return { page, group };
  }
  return null;
}

export function sheetUrl(id: string, gid?: string): string {
  return `https://docs.google.com/spreadsheets/d/${id}/edit${gid ? `#gid=${gid}` : ""}`;
}

/** Google's copy link: the coach gets their own file with every tab and formula. */
export function sheetCopyUrl(id: string): string {
  return `https://docs.google.com/spreadsheets/d/${id}/copy`;
}

export function slidesUrl(id: string, action: "edit" | "copy" | "embed"): string {
  return `https://docs.google.com/presentation/d/${id}/${action === "embed" ? "embed?start=false&loop=false" : action}`;
}

export function driveFileUrl(id: string, action: "view" | "preview" | "download"): string {
  return action === "download"
    ? `https://drive.google.com/uc?export=download&id=${id}`
    : `https://drive.google.com/file/d/${id}/${action}`;
}
