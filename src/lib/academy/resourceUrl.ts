import type { ParsedAcademyResource } from "./parseResourcesMarkdown";

const GOOGLE_DOC_ID_RE = /\/document\/d\/([^/]+)/;
const GOOGLE_SHEET_ID_RE = /\/spreadsheets\/d\/([^/]+)/;
const CLIENT_ALIGNMENT_SHORT_URL = /businesscoachacademy\.com\/alignment\/?$/i;

export const CLIENT_ALIGNMENT_SPREADSHEET_ID = "1UN1pfF5N2soXAlItrFjznI0oJOwN9owc9ZvtFxiO9NY";

export type ParsedGoogleSheetUrl = {
  spreadsheetId: string;
  gid: string | null;
  fileUrl: string;
  tabUrl: string;
};

export type ParsedGoogleDocUrl = {
  docId: string;
  tabId: string | null;
  /** URL to the whole doc (no tab). */
  fileUrl: string;
  /** Same as input when a tab is present. */
  tabUrl: string;
};

const KNOWN_GOOGLE_DOC_LABELS: Record<string, string> = {
  "1wIsjR5J33GTndnJkYuP9t0J4abM5Dah743RWvmm0_CQ": "Client Onboarding Coaching Sessions",
};

const KNOWN_GOOGLE_SHEET_LABELS: Record<string, string> = {
  [CLIENT_ALIGNMENT_SPREADSHEET_ID]: "Profit Coach Client Masterfile",
};

/** Resolve short links to the canonical spreadsheet URL before import/display. */
export function resolveAcademyResourceUrl(url: string): string {
  const trimmed = url.trim();
  try {
    const parsed = new URL(trimmed);
    if (CLIENT_ALIGNMENT_SHORT_URL.test(`${parsed.hostname}${parsed.pathname}`)) {
      return `https://docs.google.com/spreadsheets/d/${CLIENT_ALIGNMENT_SPREADSHEET_ID}/edit`;
    }
  } catch {
    if (CLIENT_ALIGNMENT_SHORT_URL.test(trimmed)) {
      return `https://docs.google.com/spreadsheets/d/${CLIENT_ALIGNMENT_SPREADSHEET_ID}/edit`;
    }
  }
  return trimmed;
}

export function parseGoogleSheetUrl(url: string): ParsedGoogleSheetUrl | null {
  const trimmed = resolveAcademyResourceUrl(url);
  try {
    const parsed = new URL(trimmed);
    if (!parsed.hostname.includes("docs.google.com")) return null;
    const match = parsed.pathname.match(GOOGLE_SHEET_ID_RE);
    if (!match) return null;

    const spreadsheetId = match[1]!;
    const gid = parsed.hash.match(/gid=(\d+)/)?.[1] ?? parsed.searchParams.get("gid");
    const fileUrl = `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit`;

    return {
      spreadsheetId,
      gid,
      fileUrl,
      tabUrl: gid ? `${fileUrl}#gid=${gid}` : fileUrl,
    };
  } catch {
    return null;
  }
}

export function getGoogleSheetId(url: string): string | null {
  return parseGoogleSheetUrl(url)?.spreadsheetId ?? null;
}

export function getGoogleSheetGid(url: string): string | null {
  return parseGoogleSheetUrl(url)?.gid ?? null;
}

export function googleSheetBundleLabel(spreadsheetId: string, fallbackCount: number): string {
  return (
    KNOWN_GOOGLE_SHEET_LABELS[spreadsheetId] ??
    `Shared Google Sheet (${fallbackCount} tabs)`
  );
}

export function multiTabBundleLabel(fileKey: string, fallbackCount: number): string {
  if (fileKey.startsWith("doc:")) {
    return googleDocBundleLabel(fileKey.slice(4), fallbackCount);
  }
  if (fileKey.startsWith("sheet:")) {
    return googleSheetBundleLabel(fileKey.slice(6), fallbackCount);
  }
  return `Shared file (${fallbackCount} links)`;
}

export function getMultiTabBundleKey(
  url: string
): { bundleKey: string; fileUrl: string } | null {
  const doc = parseGoogleDocUrl(url);
  if (doc?.tabId) {
    return { bundleKey: `doc:${doc.docId}`, fileUrl: doc.fileUrl };
  }
  const sheet = parseGoogleSheetUrl(url);
  if (sheet?.gid) {
    return { bundleKey: `sheet:${sheet.spreadsheetId}`, fileUrl: sheet.fileUrl };
  }
  return null;
}

export function parseGoogleDocUrl(url: string): ParsedGoogleDocUrl | null {
  const trimmed = url.trim();
  try {
    const parsed = new URL(trimmed);
    if (!parsed.hostname.includes("docs.google.com")) return null;
    const match = parsed.pathname.match(GOOGLE_DOC_ID_RE);
    if (!match) return null;

    const docId = match[1]!;
    const tabId = parsed.searchParams.get("tab");
    parsed.hash = "";
    parsed.search = "";
    const fileUrl = `${parsed.origin}${parsed.pathname}${parsed.search}`;

    return {
      docId,
      tabId,
      fileUrl,
      tabUrl: tabId ? `${fileUrl}?tab=${tabId}` : fileUrl,
    };
  } catch {
    return null;
  }
}

export function getGoogleDocFileId(url: string): string | null {
  return parseGoogleDocUrl(url)?.docId ?? null;
}

export function getGoogleDocTabId(url: string): string | null {
  return parseGoogleDocUrl(url)?.tabId ?? null;
}

export function googleDocBundleLabel(docId: string, fallbackCount: number): string {
  return (
    KNOWN_GOOGLE_DOC_LABELS[docId] ??
    `Shared Google Doc (${fallbackCount} sections)`
  );
}

/** Dedupe key — tab/gid-specific so each deep link stays distinct. */
export function normalizeAcademyResourceUrl(url: string): string {
  const trimmed = resolveAcademyResourceUrl(url);
  try {
    const googleDoc = parseGoogleDocUrl(trimmed);
    if (googleDoc) {
      return googleDoc.tabId ? googleDoc.tabUrl : googleDoc.fileUrl;
    }

    const googleSheet = parseGoogleSheetUrl(trimmed);
    if (googleSheet) {
      return googleSheet.gid ? googleSheet.tabUrl : googleSheet.fileUrl;
    }

    const parsed = new URL(trimmed);
    parsed.hash = "";

    if (parsed.hostname.includes("drive.google.com") && parsed.pathname.includes("/file/d/")) {
      const match = parsed.pathname.match(/\/file\/d\/([^/]+)/);
      if (match) {
        return `https://drive.google.com/file/d/${match[1]}/view`;
      }
    }

    parsed.search = "";
    return `${parsed.origin}${parsed.pathname}`;
  } catch {
    return trimmed;
  }
}

export type ResourceAppearance = {
  topic: string | null;
  title: string;
  sectionId: string;
  sourceLine: number;
};

export type DedupedAcademyResource = ParsedAcademyResource & {
  normalizedUrl: string;
};

function isSessionTopicTitle(title: string): boolean {
  return /^session\s+\d+/i.test(title.trim());
}

/** Prefer shared names (alignment, masterfile) over session-specific labels for dupes. */
export function pickCanonicalResourceTitle(candidates: string[]): string {
  const unique = [...new Set(candidates.map((t) => t.trim()).filter(Boolean))];
  if (unique.length === 0) return "Link";

  const alignment = unique.find((t) => /alignment/i.test(t));
  if (alignment) return alignment;

  const masterfile = unique.find((t) => /masterfile|master file/i.test(t));
  if (masterfile) return masterfile;

  const nonSession = unique.filter((t) => !isSessionTopicTitle(t));
  const pool = nonSession.length > 0 ? nonSession : unique;
  return pool.sort((a, b) => b.length - a.length)[0]!;
}

export function compareTopicGroupOrder(
  a: { topic: string | null; firstSourceLine: number },
  b: { topic: string | null; firstSourceLine: number }
): number {
  const sessionA = a.topic?.match(/^session\s+(\d+)/i);
  const sessionB = b.topic?.match(/^session\s+(\d+)/i);

  if (sessionA && sessionB) {
    return Number.parseInt(sessionA[1]!, 10) - Number.parseInt(sessionB[1]!, 10);
  }
  if (sessionA) return -1;
  if (sessionB) return 1;
  return a.firstSourceLine - b.firstSourceLine;
}

export function dedupeParsedResources(resources: ParsedAcademyResource[]): {
  resources: DedupedAcademyResource[];
  appearancesByUrl: Map<string, ResourceAppearance[]>;
  removedCount: number;
} {
  const byUrl = new Map<
    string,
    {
      resource: DedupedAcademyResource;
      titleCandidates: string[];
      appearances: ResourceAppearance[];
    }
  >();

  for (const resource of resources) {
    const normalizedUrl = normalizeAcademyResourceUrl(resource.url);
    const appearance: ResourceAppearance = {
      topic: resource.topic,
      title: resource.title,
      sectionId: resource.sectionId,
      sourceLine: resource.sourceLine,
    };

    const existing = byUrl.get(normalizedUrl);
    if (!existing) {
      byUrl.set(normalizedUrl, {
        resource: { ...resource, normalizedUrl },
        titleCandidates: [resource.title],
        appearances: [appearance],
      });
      continue;
    }

    existing.titleCandidates.push(resource.title);
    existing.appearances.push(appearance);

    if (resource.sourceLine < existing.resource.sourceLine) {
      existing.resource = {
        ...resource,
        normalizedUrl,
        title: existing.resource.title,
      };
    }
  }

  const deduped: DedupedAcademyResource[] = [];
  const appearancesByUrl = new Map<string, ResourceAppearance[]>();

  for (const [normalizedUrl, entry] of byUrl) {
    entry.resource.title = pickCanonicalResourceTitle(entry.titleCandidates);
    deduped.push(entry.resource);
    appearancesByUrl.set(normalizedUrl, entry.appearances);
  }

  deduped.sort((a, b) => a.sourceLine - b.sourceLine || a.title.localeCompare(b.title));

  return {
    resources: deduped,
    appearancesByUrl,
    removedCount: resources.length - deduped.length,
  };
}
