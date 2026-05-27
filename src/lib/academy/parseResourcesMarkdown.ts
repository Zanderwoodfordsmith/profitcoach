import { normalizeMatchText } from "./normalizeMatchText";
import { resolveAcademyResourceUrl } from "./resourceUrl";

export type AcademyResourceArea = "coach-delivery" | "profit-system";

export type ParsedAcademyResourceSection = {
  id: string;
  area: AcademyResourceArea;
  parentId: string | null;
  title: string;
  sortOrder: number;
};

export type AcademyResourceKind =
  | "document"
  | "spreadsheet"
  | "presentation"
  | "video"
  | "pdf"
  | "book"
  | "template"
  | "link";

export type ParsedAcademyResource = {
  sectionId: string;
  topic: string | null;
  title: string;
  url: string;
  resourceKind: AcademyResourceKind;
  sortOrder: number;
  sourceLine: number;
};

export type ParsedAcademyResourcesMarkdown = {
  sections: ParsedAcademyResourceSection[];
  resources: ParsedAcademyResource[];
};

const LINK_RE = /\[([^\]]+)\]\(([^)]+)\)/g;

function stripMarkdownEmphasis(text: string): string {
  return text.replace(/\*\*/g, "").replace(/\\/g, "").trim();
}

function slugify(text: string): string {
  return normalizeMatchText(stripMarkdownEmphasis(text)).replace(/\s+/g, "-");
}

function sectionIdFor(area: AcademyResourceArea, title: string, parentId: string | null): string {
  const slug = slugify(title);
  if (parentId) return `${parentId}/${slug}`;
  if (area === "profit-system" && slug === "profit-system") return area;
  return `${area}/${slug}`;
}

function isHeadingLine(line: string): { level: 1 | 2; title: string } | null {
  const h2 = line.match(/^##\s+\*\*(.+)\*\*\s*$/);
  if (h2) return { level: 2, title: stripMarkdownEmphasis(h2[1]!) };
  const h1 = line.match(/^#\s+\*\*(.+)\*\*\s*$/);
  if (h1) return { level: 1, title: stripMarkdownEmphasis(h1[1]!) };
  return null;
}

function isTopicLine(line: string): string | null {
  const m = line.match(/^\*\*(.+)\*\*\s*$/);
  if (!m) return null;
  return stripMarkdownEmphasis(m[1]!);
}

function cleanUrl(raw: string): string {
  return resolveAcademyResourceUrl(raw.trim().replace(/\\_/g, "_"));
}

export function inferResourceKind(url: string, title: string): AcademyResourceKind {
  const u = url.toLowerCase();
  const t = title.toLowerCase();

  if (u.includes("docs.google.com/spreadsheets") || /\bworksheet\b/.test(t)) {
    return "spreadsheet";
  }
  if (
    u.includes("docs.google.com/presentation") ||
    u.includes("my.visme.co") ||
    /\b(slides|presentation|visme)\b/.test(t)
  ) {
    return "presentation";
  }
  if (u.includes("docs.google.com/document") || /\b(sop|guide|script)\b/.test(t)) {
    return "document";
  }
  if (
    u.includes("youtu.be") ||
    u.includes("youtube.com") ||
    u.includes("ted.com/talks")
  ) {
    return "video";
  }
  if (u.includes(".pdf") || /\bpdf\b/.test(t)) {
    return "pdf";
  }
  if (/\bbook\b/.test(t) || u.includes("whothebook.com")) {
    return "book";
  }
  if (/\btemplate\b/.test(t) && u.includes("keynote")) {
    return "template";
  }
  return "link";
}

function isGenericLinkLabel(rawTitle: string): boolean {
  const title = stripMarkdownEmphasis(rawTitle).trim();
  if (!title) return true;
  if (/^https?:\/\//i.test(title)) return true;
  if (/^click here to access/i.test(title)) return true;
  if (/^open resource$/i.test(title)) return true;
  if (/^link$/i.test(title)) return true;
  return false;
}

function normalizeLinkTitle(rawTitle: string, url: string): string {
  const title = stripMarkdownEmphasis(rawTitle).trim();
  if (/^https?:\/\//i.test(title)) {
    try {
      const host = new URL(url).hostname.replace(/^www\./, "");
      return host;
    } catch {
      return "Link";
    }
  }
  return title || "Link";
}

function resolveResourceTitle(input: {
  rawLinkTitle: string;
  url: string;
  topic: string | null;
  linePrefix: string | null;
}): string {
  if (!isGenericLinkLabel(input.rawLinkTitle)) {
    return normalizeLinkTitle(input.rawLinkTitle, input.url);
  }

  if (input.topic?.trim()) {
    return input.topic.trim();
  }

  if (input.linePrefix?.trim()) {
    return input.linePrefix.trim();
  }

  return normalizeLinkTitle(input.rawLinkTitle, input.url);
}

function extractLinksFromLine(line: string): { rawTitle: string; title: string; url: string }[] {
  const links: { rawTitle: string; title: string; url: string }[] = [];
  for (const match of line.matchAll(LINK_RE)) {
    const rawTitle = match[1] ?? "";
    const url = cleanUrl(match[2] ?? "");
    if (!url) continue;
    links.push({
      rawTitle,
      title: normalizeLinkTitle(rawTitle, url),
      url,
    });
  }
  return links;
}

function prefixBeforeFirstLink(line: string): string | null {
  const idx = line.search(LINK_RE);
  if (idx <= 0) return null;
  const prefix = stripMarkdownEmphasis(line.slice(0, idx)).replace(/:\s*$/, "").trim();
  return prefix || null;
}

/** Parse the BCA resources markdown export into sections + link rows. */
export function parseAcademyResourcesMarkdown(markdown: string): ParsedAcademyResourcesMarkdown {
  const lines = markdown.split(/\r?\n/);
  const sections: ParsedAcademyResourceSection[] = [];
  const resources: ParsedAcademyResource[] = [];

  let area: AcademyResourceArea = "coach-delivery";
  let currentSectionId: string | null = null;
  let areaRootSectionId: string | null = null;
  let currentTopic: string | null = null;
  let sectionSort = 0;
  let resourceSort = 0;

  function ensureSection(input: {
    area: AcademyResourceArea;
    title: string;
    parentId: string | null;
  }): string {
    const id = sectionIdFor(input.area, input.title, input.parentId);
    if (!sections.some((s) => s.id === id)) {
      sections.push({
        id,
        area: input.area,
        parentId: input.parentId,
        title: input.title,
        sortOrder: sectionSort++,
      });
    }
    return id;
  }

  for (let i = 0; i < lines.length; i += 1) {
    const lineNumber = i + 1;
    const line = lines[i]?.trim() ?? "";
    if (!line || line === "# BCA resources links") continue;

    const heading = isHeadingLine(line);
    if (heading) {
      if (heading.level === 1) {
        if (/profit system/i.test(heading.title)) {
          area = "profit-system";
        }
        areaRootSectionId = ensureSection({
          area,
          title: heading.title,
          parentId: null,
        });
        currentSectionId = areaRootSectionId;
      } else {
        currentSectionId = ensureSection({
          area,
          title: heading.title,
          parentId: area === "profit-system" ? areaRootSectionId : null,
        });
      }
      currentTopic = null;
      resourceSort = 0;
      continue;
    }

    const topic = isTopicLine(line);
    if (topic) {
      currentTopic = topic;
      resourceSort = 0;
      continue;
    }

    const links = extractLinksFromLine(line);
    if (links.length === 0 || !currentSectionId) continue;

    const linePrefix = prefixBeforeFirstLink(line);
    for (const link of links) {
      const title = resolveResourceTitle({
        rawLinkTitle: link.rawTitle,
        url: link.url,
        topic: currentTopic,
        linePrefix: links.length === 1 ? linePrefix : null,
      });

      resources.push({
        sectionId: currentSectionId,
        topic: currentTopic,
        title,
        url: link.url,
        resourceKind: inferResourceKind(link.url, title),
        sortOrder: resourceSort++,
        sourceLine: lineNumber,
      });
    }
  }

  return { sections, resources };
}
