import { parseTranscriptItems } from "@/lib/academy/transcriptCues";

export type SearchTab = "community" | "classroom" | "members";

export const DEFAULT_SEARCH_TAB: SearchTab = "classroom";

export type SearchCounts = {
  community: number;
  classroom: number;
  members: number;
};

export type SearchCommunityComment = {
  id: string;
  headline: string | null;
  author_id: string | null;
  created_at?: string | null;
  author?: {
    id: string;
    full_name: string | null;
    first_name: string | null;
    last_name: string | null;
    avatar_url: string | null;
  } | null;
};

export type SearchCommunityItem = {
  id: string;
  title: string;
  title_headline: string | null;
  body_headline: string | null;
  /** Plain post body snippet when the hit is in comments, not the post. */
  body_preview?: string | null;
  published_at: string;
  created_at: string;
  post_scope: string;
  lesson_path: string | null;
  lesson_course_id: string | null;
  lesson_id: string | null;
  like_count: number;
  comment_count: number;
  category_label: string | null;
  author: {
    id: string;
    full_name: string | null;
    first_name: string | null;
    last_name: string | null;
    avatar_url: string | null;
  } | null;
  comments: SearchCommunityComment[];
};

export type SearchClassroomItem = {
  kind: "lesson" | "resource";
  id: string;
  course_id: string | null;
  lesson_id: string | null;
  title: string;
  title_headline: string | null;
  body_headline: string | null;
  transcript_headline: string | null;
  content_match: boolean;
  transcript_match: boolean;
  section_title: string | null;
  topic: string | null;
  url: string | null;
  resource_id: string | null;
  /** Seconds into lesson when transcript cue matched; set in API when possible. */
  transcript_seconds?: number | null;
  transcript_clock?: string | null;
  /** Consolidated chapter this hit belongs to (parent lesson + ?chapter=). */
  chapter_id?: string | null;
  chapter_title?: string | null;
};

export type SearchMemberItem = {
  id: string;
  full_name: string | null;
  first_name: string | null;
  last_name: string | null;
  coach_business_name: string | null;
  avatar_url: string | null;
  role: string | null;
  slug: string | null;
  bio: string | null;
  bio_headline: string | null;
  created_at: string | null;
};

export type SearchResponse = {
  q: string;
  tab: SearchTab;
  page: number;
  pageSize: number;
  counts: SearchCounts;
  total: number;
  items: SearchCommunityItem[] | SearchClassroomItem[] | SearchMemberItem[];
};

export function isSearchTab(value: string | null | undefined): value is SearchTab {
  return value === "community" || value === "classroom" || value === "members";
}

export function parseSearchTab(value: string | null | undefined): SearchTab {
  return isSearchTab(value) ? value : DEFAULT_SEARCH_TAB;
}

export function normalizeSearchQuery(raw: string | null | undefined): string {
  return (raw ?? "").trim().replace(/\s+/g, " ").slice(0, 120);
}

/** Only allow <mark> tags from ts_headline for safe HTML snippets. */
export function sanitizeSearchHeadline(html: string | null | undefined): string | null {
  if (!html) return null;
  const stripped = html
    .replace(/<\/?(?!mark\b)[^>]*>/gi, "")
    .replace(/<mark\b[^>]*>/gi, "<mark>")
    .replace(/on\w+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, "")
    // Soften leftover markdown from lesson bodies and truncated ts_headline cuts
    .replace(/!\[[^\]]*]\([^)]*\)/g, "")
    .replace(/\[[^\]]*]\([^)]*\)/g, "")
    .replace(/[^\s[]*]\([^)]+\)/g, "")
    .replace(/https?:\/\/[^\s)]+/gi, "")
    .replace(/(?:^|\s)-{3,}(?:\s|$)/g, " ")
    .replace(/\*\*/g, "")
    .replace(/^#+\s*/gm, "")
    // Mentions: [@Name](mention:uuid) or a truncated "](mention:uuid)" fragment
    .replace(/\[@?([^\]]+)\]\(mention:[a-f0-9-]+\)/gi, "@$1")
    .replace(/\]\(mention:[a-f0-9-]+\)/gi, "")
    .replace(/mention:[a-f0-9-]+/gi, "")
    .replace(/\n+/g, " ")
    .replace(/\s+/g, " ");
  const trimmed = stripped.trim();
  return trimmed || null;
}

export function plainTextFromHeadline(html: string | null | undefined): string {
  if (!html) return "";
  return html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

const QUERY_LEAD_STOPWORDS = new Set([
  "a",
  "an",
  "are",
  "do",
  "does",
  "how",
  "is",
  "the",
  "what",
  "when",
  "who",
  "why",
]);

const QUERY_TOKEN_STOPWORDS = new Set([
  ...QUERY_LEAD_STOPWORDS,
  "and",
  "for",
  "from",
  "have",
  "into",
  "that",
  "this",
  "with",
  "you",
  "your",
]);

function significantQueryTokens(query: string): string[] {
  return query
    .toLowerCase()
    .split(/[^a-z0-9£$]+/)
    .filter((t) => t.length >= 3 && !QUERY_TOKEN_STOPWORDS.has(t));
}

function queryPhraseCandidates(query: string): string[] {
  const words = query
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean);
  if (words.length === 0) return [];
  const out: string[] = [];
  const full = words.join(" ");
  if (full.length >= 8) out.push(full);
  let start = 0;
  while (
    start < words.length - 1 &&
    QUERY_LEAD_STOPWORDS.has(words[start])
  ) {
    start += 1;
  }
  const trimmed = words.slice(start).join(" ");
  if (trimmed.length >= 8 && trimmed !== full) out.push(trimmed);
  return out;
}

function cueForJoinedIndex(
  parts: Array<{ start: number; cue: { seconds: number; label: string } }>,
  index: number
): { seconds: number; clock: string } | null {
  for (let i = parts.length - 1; i >= 0; i--) {
    if (parts[i].start <= index) {
      return { seconds: parts[i].cue.seconds, clock: parts[i].cue.label };
    }
  }
  return null;
}

/**
 * Find the cue where the query phrase actually occurs. Do not score the first
 * cue against filler words from the start of a ts_headline snippet.
 */
export function findTranscriptCueSeconds(
  transcriptText: string | null | undefined,
  headline: string | null | undefined,
  query: string
): { seconds: number; clock: string } | null {
  if (!transcriptText?.trim()) return null;
  const items = parseTranscriptItems(transcriptText);
  const cues = items.filter((i) => i.type === "cue");
  if (cues.length === 0) return null;

  const parts: Array<{ start: number; cue: (typeof cues)[number] }> = [];
  let offset = 0;
  const joined = cues
    .map((cue) => {
      parts.push({ start: offset, cue });
      const chunk = `${cue.text.toLowerCase()} `;
      offset += chunk.length;
      return chunk;
    })
    .join("");

  for (const phrase of queryPhraseCandidates(query)) {
    const idx = joined.indexOf(phrase);
    if (idx >= 0) return cueForJoinedIndex(parts, idx);
  }

  const hay = plainTextFromHeadline(headline)
    .toLowerCase()
    .replace(/\[\d{1,2}:\d{2}(?::\d{2})?\]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  const hayCore = hay.length > 48 ? hay.slice(-48) : hay;
  if (hayCore.length >= 18) {
    const idx = joined.indexOf(hayCore);
    if (idx >= 0) return cueForJoinedIndex(parts, idx);
  }

  const tokens = significantQueryTokens(query);
  if (tokens.length >= 2) {
    for (let i = 0; i < cues.length; i++) {
      const windowText = [cues[i], cues[i + 1], cues[i + 2]]
        .filter(Boolean)
        .map((c) => c.text.toLowerCase())
        .join(" ");
      if (tokens.every((t) => windowText.includes(t))) {
        return { seconds: cues[i].seconds, clock: cues[i].label };
      }
    }
  }

  return null;
}

export const TRANSCRIPT_SEEK_LEAD_SECONDS = 10;

/** Playback start so the match is not the first frame. */
export function seekSecondsForTranscriptHit(matchSeconds: number): number {
  return Math.max(0, Math.floor(matchSeconds) - TRANSCRIPT_SEEK_LEAD_SECONDS);
}

export function formatCourseBreadcrumb(courseId: string | null | undefined): string {
  if (!courseId) return "Classroom";
  return courseId
    .split(/[-_]/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

export function memberDisplayName(m: {
  full_name?: string | null;
  first_name?: string | null;
  last_name?: string | null;
  coach_business_name?: string | null;
}): string {
  const n =
    m.full_name?.trim() ||
    [m.first_name, m.last_name].filter(Boolean).join(" ").trim() ||
    m.coach_business_name?.trim();
  return n || "Member";
}
