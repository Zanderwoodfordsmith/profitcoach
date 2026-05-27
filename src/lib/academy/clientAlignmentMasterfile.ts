import fs from "node:fs";
import path from "node:path";

import type { ParsedAcademyResource } from "./parseResourcesMarkdown";
import { inferResourceKind } from "./parseResourcesMarkdown";
import {
  CLIENT_ALIGNMENT_SPREADSHEET_ID,
  normalizeAcademyResourceUrl,
  parseGoogleSheetUrl,
} from "./resourceUrl";

export type ClientAlignmentMasterfileManifest = {
  spreadsheetId: string;
  label: string;
  shortUrl: string;
  sectionId: string;
  topic: string;
  tabs: { gid: string; title: string; sortOrder: number }[];
};

const MANIFEST_PATH = path.join(
  process.cwd(),
  "content/academy/client-alignment-masterfile-tabs.json"
);

export function loadClientAlignmentMasterfileManifest(): ClientAlignmentMasterfileManifest {
  return JSON.parse(fs.readFileSync(MANIFEST_PATH, "utf8")) as ClientAlignmentMasterfileManifest;
}

function isClientAlignmentBaseUrl(url: string): boolean {
  const parsed = parseGoogleSheetUrl(url);
  return parsed?.spreadsheetId === CLIENT_ALIGNMENT_SPREADSHEET_ID && !parsed.gid;
}

/** Replace the generic alignment link with tab deep links from the masterfile manifest. */
export function appendClientAlignmentMasterfileTabs(
  resources: ParsedAcademyResource[],
  sourceLineStart = 9000
): ParsedAcademyResource[] {
  const manifest = loadClientAlignmentMasterfileManifest();
  const existingTabUrls = new Set(
    resources
      .map((r) => normalizeAcademyResourceUrl(r.url))
      .filter((url) => parseGoogleSheetUrl(url)?.gid)
  );

  const withoutBaseAlignment = resources.filter((r) => !isClientAlignmentBaseUrl(r.url));
  const out = [...withoutBaseAlignment];
  let line = sourceLineStart;

  for (const tab of [...manifest.tabs].sort((a, b) => a.sortOrder - b.sortOrder)) {
    const url = `https://docs.google.com/spreadsheets/d/${manifest.spreadsheetId}/edit#gid=${tab.gid}`;
    const normalizedUrl = normalizeAcademyResourceUrl(url);
    if (existingTabUrls.has(normalizedUrl)) continue;

    out.push({
      sectionId: manifest.sectionId,
      topic: manifest.topic,
      title: tab.title,
      url,
      resourceKind: inferResourceKind(url, tab.title),
      sortOrder: tab.sortOrder,
      sourceLine: line++,
    });
  }

  return out;
}

export function clientAlignmentSpreadsheetUrl(): string {
  return `https://docs.google.com/spreadsheets/d/${CLIENT_ALIGNMENT_SPREADSHEET_ID}/edit`;
}
