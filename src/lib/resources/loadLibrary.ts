import { readFile } from "node:fs/promises";
import path from "node:path";

import { flattenResourcePages, type ResourceBlock } from "./library";
import { RESOURCE_GROUPS, findResourcePage } from "./libraryData";

async function readDoc(file: string): Promise<string> {
  return readFile(path.join(process.cwd(), "content/resources", file), "utf8");
}

/** Markdown for each doc block on a page, keyed by file. */
async function readPageDocs(blocks: ResourceBlock[]): Promise<Record<string, string>> {
  const out: Record<string, string> = {};
  for (const block of blocks) {
    if (block.type === "doc") out[block.file] = await readDoc(block.file);
  }
  return out;
}

function blockText(block: ResourceBlock, docs: Record<string, string>): string {
  switch (block.type) {
    case "doc":
      return docs[block.file] ?? "";
    case "sheet":
      return [block.title, ...block.tabGroups.flatMap((g) => [g.label, ...g.tabs.map((t) => `${t.title}. ${t.about}`)])].join(" ");
    case "links":
      return [block.title ?? "", ...block.links.map((l) => l.title)].join(" ");
    default:
      return block.title;
  }
}

/** Plain text of every page, for the sidebar search to look inside. */
export async function loadResourceSearchText(): Promise<Record<string, string>> {
  const out: Record<string, string> = {};
  for (const group of RESOURCE_GROUPS) {
    for (const page of flattenResourcePages(group.pages)) {
      const docs = await readPageDocs(page.blocks);
      out[page.slug] = [page.dek ?? "", ...page.blocks.map((b) => blockText(b, docs))]
        .join(" ")
        .replace(/!\[[^\]]*\]\([^)]*\)/g, " ")
        .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
        .replace(/<br>/g, " ")
        .replace(/[#*|`>_]+/g, " ")
        .replace(/-{3,}/g, " ")
        .replace(/\s+/g, " ")
        .trim();
    }
  }
  return out;
}

export async function loadResourcePage(slug: string) {
  const found = findResourcePage(slug);
  if (!found) return null;
  return { ...found, docs: await readPageDocs(found.page.blocks) };
}
