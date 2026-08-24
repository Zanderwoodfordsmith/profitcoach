/** Blog articles — types and helpers (pattern ported from bca-website). */

export type BlogCategory =
  | "Owner Performance"
  | "Strategy & Planning"
  | "Profit & Cash Flow"
  | "Revenue & Marketing"
  | "Ops, Systems & Team";

export const BLOG_CATEGORIES: readonly BlogCategory[] = [
  "Owner Performance",
  "Strategy & Planning",
  "Profit & Cash Flow",
  "Revenue & Marketing",
  "Ops, Systems & Team",
];

/** Card shape used by the blog index. */
export type BlogPost = {
  title: string;
  excerpt: string;
  href: string;
  category: BlogCategory;
  date: string;
  image: string;
};

export const ARTICLE_STATUSES = [
  "live",
  "draft",
  "review",
  "flagged",
  "archive",
] as const;
export type ArticleStatus = (typeof ARTICLE_STATUSES)[number];

export type Article = {
  id: string;
  slug: string;
  title: string;
  excerpt: string;
  body: string;
  published: boolean;
  published_at: string | null;
  editorial_status: ArticleStatus;
  categories: string[];
  created_at: string;
  updated_at: string;
};

/**
 * Blog posts currently live as static pages under src/app/blog/.
 * Rows whose slug matches are shown with a "static page live" badge —
 * the DB copy is the reviewable source, the static page is what visitors see.
 */
export const STATIC_LIVE_BLOG_SLUGS: string[] = [
  "business-is-shockingly-simple-thats-why-its-so-hard",
  "if-you-run-a-10-percent-margin-cutting-expenses-by-11-percent-doubles-your-profit",
  "indecision-is-the-most-expensive-thing-in-your-business",
  "most-business-owners-dont-have-a-strategy-they-have-a-to-do-list",
  "most-owners-dont-have-a-sales-problem-they-have-a-follow-up-problem",
  "most-owners-want-speed-they-need-control-first",
  "stop-trying-to-get-more-customers-start-trying-to-lose-fewer",
  "the-5-levels-of-business-owner-most-people-get-stuck-at-level-2",
  "the-90-day-plan-is-the-most-underrated-tool-in-business",
  "the-bottleneck-in-your-business-has-your-name-on-it",
  "the-day-the-excitement-died-is-the-day-your-business-actually-started",
  "you-dont-have-a-team-problem-you-have-a-standards-problem",
];

/** DB slugs whose static twin uses a different slug (slugify drift). */
export const DB_TO_STATIC_SLUG: Record<string, string> = {
  "if-you-run-a-10-margin-cutting-expenses-by-11-doubles-your-profit":
    "if-you-run-a-10-percent-margin-cutting-expenses-by-11-percent-doubles-your-profit",
};

/** The static live slug for a DB article, if its twin is live. */
export function staticLiveSlugFor(dbSlug: string): string | null {
  const mapped = DB_TO_STATIC_SLUG[dbSlug] ?? dbSlug;
  return STATIC_LIVE_BLOG_SLUGS.includes(mapped) ? mapped : null;
}

/** Slug rules matching the bca-website import script. */
export function slugifyTitle(title: string): string {
  return title
    .toLowerCase()
    .replace(/['’]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 120);
}

export type ArticleBlock =
  | { type: "h2" | "h3" | "h4"; text: string }
  | { type: "p"; text: string }
  | { type: "ul" | "ol"; items: string[] };

/**
 * Markdown-lite block parser: headings (##/###/####), bullet and numbered
 * lists, blank-line paragraphs. Inline formatting is handled by
 * `inlineTokens`. No markdown library (house pattern from bca-website).
 */
export function articleBodyBlocks(body: string): ArticleBlock[] {
  const blocks: ArticleBlock[] = [];
  const lines = body.split("\n");
  let paragraph: string[] = [];
  let list: { type: "ul" | "ol"; items: string[] } | null = null;

  const flushParagraph = () => {
    if (paragraph.length) {
      blocks.push({ type: "p", text: paragraph.join(" ").trim() });
      paragraph = [];
    }
  };
  const flushList = () => {
    if (list) {
      blocks.push(list);
      list = null;
    }
  };

  for (const raw of lines) {
    const line = raw.trim();
    if (!line) {
      flushParagraph();
      flushList();
      continue;
    }
    // Horizontal rules: section breaks in the source, no visual element here.
    if (/^[-*_]{3,}$/.test(line)) {
      flushParagraph();
      flushList();
      continue;
    }
    const bullet = line.match(/^[-*]\s+(.*)$/);
    const numbered = line.match(/^\d+[.)]\s+(.*)$/);
    if (bullet || numbered) {
      flushParagraph();
      const type = bullet ? "ul" : "ol";
      const item = (bullet?.[1] ?? numbered?.[1] ?? "").trim();
      if (list && list.type !== type) flushList();
      if (!list) list = { type, items: [] };
      list.items.push(item);
      continue;
    }
    flushList();
    if (line.startsWith("#### ")) {
      flushParagraph();
      blocks.push({ type: "h4", text: line.slice(5).trim() });
    } else if (line.startsWith("### ")) {
      flushParagraph();
      blocks.push({ type: "h3", text: line.slice(4).trim() });
    } else if (line.startsWith("## ")) {
      flushParagraph();
      blocks.push({ type: "h2", text: line.slice(3).trim() });
    } else {
      paragraph.push(line);
    }
  }
  flushParagraph();
  flushList();
  return blocks;
}

export type InlineToken =
  | { type: "text" | "strong" | "em"; text: string }
  | { type: "link"; text: string; href: string };

/** Inline markdown: **bold**, *italic*, _italic_, [text](url). */
export function inlineTokens(text: string): InlineToken[] {
  const tokens: InlineToken[] = [];
  const re =
    /(\*\*([^*]+)\*\*)|(\*([^*\s][^*]*)\*)|(_([^_\s][^_]*)_)|(\[([^\]]+)\]\(([^)\s]+)\))/g;
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) {
      tokens.push({ type: "text", text: text.slice(last, m.index) });
    }
    if (m[2] !== undefined) {
      tokens.push({ type: "strong", text: m[2] });
    } else if (m[4] !== undefined) {
      tokens.push({ type: "em", text: m[4] });
    } else if (m[6] !== undefined) {
      tokens.push({ type: "em", text: m[6] });
    } else if (m[8] !== undefined && m[9] !== undefined) {
      tokens.push({ type: "link", text: m[8], href: m[9] });
    }
    last = m.index + m[0].length;
  }
  if (last < text.length) {
    tokens.push({ type: "text", text: text.slice(last) });
  }
  return tokens;
}

/** Estimated reading time matching the static pages' byline. */
export function articleReadMinutes(body: string): number {
  const words = body.trim() ? body.trim().split(/\s+/).length : 0;
  return Math.max(2, Math.round(words / 200));
}
