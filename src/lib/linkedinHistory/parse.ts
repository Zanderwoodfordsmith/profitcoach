import type { BlueprintBlock } from "@/lib/practiceKnowledge/types";

/**
 * Pure helpers for importing a coach's LinkedIn history: Unipile post items
 * to rows, a public LinkedIn article page to blocks, and the posting summary
 * used by Insights and coach health.
 */

export type HistoryKind = "post" | "repost" | "newsletter" | "article";

export type HistoryPostRow = {
  post_id: string;
  social_id: string | null;
  posted_at: string;
  kind: HistoryKind;
  text: string;
  share_url: string | null;
  article_id: string | null;
  attachments: Array<{ type: string; url: string | null }>;
  impressions: number;
  reactions: number;
  comments: number;
  reposts: number;
};

export type HistoryArticle = {
  article_id: string;
  url: string;
  title: string;
  published_at: string;
  cover_url: string | null;
  excerpt: string | null;
};

export type HistoryOwner = { providerId: string | null; name: string };

function letters(s: string): string {
  return s.toLowerCase().replace(/[^a-z]/g, "");
}

function num(v: unknown): number {
  return typeof v === "number" && Number.isFinite(v) ? Math.max(0, Math.round(v)) : 0;
}

function str(v: unknown): string | null {
  return typeof v === "string" && v.trim() ? v.trim() : null;
}

/** Drop tracking params so the same article shared twice has one URL. */
export function canonicalArticleUrl(url: string): string {
  return url.split("?")[0]!.replace(/\/$/, "");
}

function isOwner(author: Record<string, unknown> | undefined, owner: HistoryOwner): boolean {
  if (!author) return false;
  if (owner.providerId && author.id === owner.providerId) return true;
  const name = str(author.name);
  return Boolean(name && owner.name && letters(name) === letters(owner.name));
}

/**
 * One Unipile post item to a history row, plus the article it shares when the
 * coach wrote that article. Null for posts the coach didn't write or share.
 */
export function mapUnipilePost(
  item: Record<string, unknown>,
  owner: HistoryOwner
): { row: HistoryPostRow; article: HistoryArticle | null } | null {
  const postId = str(item.id);
  const postedAt = str(item.parsed_datetime);
  if (!postId || !postedAt || Number.isNaN(Date.parse(postedAt))) return null;
  const author = item.author as Record<string, unknown> | undefined;
  const repost = item.is_repost === true;
  if (!repost && !isOwner(author, owner)) return null;

  const rawArticle = item.article as Record<string, unknown> | undefined;
  const articleUrl = str(rawArticle?.url);
  const articleAuthor = str(rawArticle?.author);
  const ownArticle = Boolean(
    rawArticle && articleUrl && /linkedin\.com\/pulse\//i.test(articleUrl) && articleAuthor && owner.name && letters(articleAuthor) === letters(owner.name)
  );
  const article: HistoryArticle | null =
    ownArticle && rawArticle && articleUrl
      ? {
          article_id: str(rawArticle.id) ?? canonicalArticleUrl(articleUrl),
          url: canonicalArticleUrl(articleUrl),
          title: str(rawArticle.title)?.replace(/\s+/g, " ") ?? "",
          published_at: str(rawArticle.published_at) ?? postedAt,
          cover_url: str(rawArticle.picture_url),
          excerpt: str(rawArticle.excerpt),
        }
      : null;

  const attachments = Array.isArray(item.attachments)
    ? (item.attachments as Array<Record<string, unknown>>)
        .filter((a) => a && typeof a === "object")
        .map((a) => ({ type: str(a.type) ?? "file", url: str(a.url) }))
    : [];

  return {
    row: {
      post_id: postId,
      social_id: str(item.social_id),
      posted_at: new Date(postedAt).toISOString(),
      kind: repost ? "repost" : article ? "newsletter" : "post",
      text: typeof item.text === "string" ? item.text : "",
      share_url: str(item.share_url)?.split("?")[0] ?? null,
      article_id: article?.article_id ?? null,
      attachments,
      impressions: num(item.impressions_counter),
      reactions: num(item.reaction_counter),
      comments: num(item.comment_counter),
      reposts: num(item.repost_counter),
    },
    article,
  };
}

const ENTITIES: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " " };

export function decodeEntities(s: string): string {
  return s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (whole, code: string) => {
    if (code[0] === "#") {
      const n = code[1]?.toLowerCase() === "x" ? parseInt(code.slice(2), 16) : parseInt(code.slice(1), 10);
      return Number.isFinite(n) ? String.fromCodePoint(n) : whole;
    }
    return ENTITIES[code.toLowerCase()] ?? whole;
  });
}

function clean(s: string): string {
  return decodeEntities(s.replace(/<[^>]+>/g, "")).replace(/\s+/g, " ").trim();
}

export type ParsedArticlePage = {
  title: string | null;
  cover_url: string | null;
  newsletter_name: string | null;
  newsletter_url: string | null;
  /** The first section heading: what this issue is about when every issue shares a title. */
  topic: string | null;
  /** Every heading in order, so a coach's recurring template headings can be told apart from the topic. */
  headings: string[];
  blocks: BlueprintBlock[];
  chars: number;
};

/** Index just past the </div> that closes the <div> opening at `openAt`. */
function divEnd(html: string, openAt: number): number {
  const re = /<div\b|<\/div>/gi;
  re.lastIndex = openAt;
  let depth = 0;
  for (let m = re.exec(html); m; m = re.exec(html)) {
    depth += m[0][1] === "/" ? -1 : 1;
    if (depth === 0) return m.index + m[0].length;
  }
  return html.length;
}

/** Drop every <div class="{className} …"> block, nested divs and all. */
function withoutDivs(html: string, className: string): string {
  let out = html;
  for (let at = out.search(new RegExp(`<div class="${className}\\b`, "i")); at >= 0; at = out.search(new RegExp(`<div class="${className}\\b`, "i"))) {
    out = out.slice(0, at) + out.slice(divEnd(out, at));
  }
  return out;
}

/**
 * A public LinkedIn article page (linkedin.com/pulse/…) to headings,
 * paragraphs and lists. Inline images are left out; the cover is kept.
 */
export function parseArticleHtml(html: string): ParsedArticlePage {
  const meta = (prop: string) => {
    const m = html.match(new RegExp(`<meta[^>]+property="${prop}"[^>]+content="([^"]*)"`, "i"));
    return m ? decodeEntities(m[1]!).trim() || null : null;
  };
  const h1 = html.match(/<h1[^>]*class="[^"]*pulse-title[^"]*"[^>]*>([\s\S]*?)<\/h1>/i);
  const publisher = html.match(/<a[^>]+href="(https:\/\/www\.linkedin\.com\/newsletters\/[^"]+)"[^>]*>\s*<span class="sr-only">([\s\S]*?)<\/span>/i);

  const marker = html.indexOf('data-test-id="article-content-blocks"');
  let parts: string[];
  if (marker >= 0) {
    const start = html.indexOf(">", marker) + 1;
    const end = html.indexOf("</article>", start);
    const region = html.slice(start, end > start ? end : undefined);
    // Only the author's text blocks and section headings. LinkedIn drops a
    // "Recommended by LinkedIn" box of other people's articles in between.
    parts = region.match(/<h2[^>]*data-test-id="pulse-publishing-h1"[^>]*>[\s\S]*?<\/h2>|<div[^>]*data-test-id="publishing-text-block"[^>]*>[\s\S]*?<\/div>/gi) ?? [];
  } else {
    // Older articles: one content div holding the whole piece.
    const open = html.search(/<div class="article-main__content[^"]*">/i);
    if (open >= 0) {
      const inner = html.slice(html.indexOf(">", open) + 1, divEnd(html, open) - "</div>".length);
      parts = [withoutDivs(inner, "inline-articles")];
    } else {
      parts = [];
    }
  }
  const sections = [...parts.join("\n").matchAll(/<h2\b[^>]*>([\s\S]*?)<\/h2>/gi)].map((m) => clean(m[1]!));

  const marked = parts
    .join("\n")
    .replace(/<figure[\s\S]*?<\/figure>/gi, "\n")
    .replace(/<(h[1-4])\b[^>]*>([\s\S]*?)<\/\1>/gi, (_m, _t, inner: string) => `\n\u0001H${clean(inner)}\n`)
    .replace(/<ol\b[^>]*>/gi, "\n\u0001OL\n")
    .replace(/<\/ol>/gi, "\n\u0001/OL\n")
    .replace(/<li\b[^>]*>([\s\S]*?)<\/li>/gi, (_m, inner: string) => `\n\u0001LI${clean(inner)}\n`)
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/?(p|ul|div|blockquote|section)\b[^>]*>/gi, "\n");

  const blocks: BlueprintBlock[] = [];
  let ordered = false;
  let list: string[] | null = null;
  const flush = () => {
    if (list?.length) blocks.push(ordered ? { type: "numbered", items: list } : { type: "bullets", items: list });
    list = null;
  };
  for (const raw of marked.split("\n")) {
    if (raw === "\u0001OL" || raw === "\u0001/OL") {
      flush();
      ordered = raw === "\u0001OL";
      continue;
    }
    if (raw.startsWith("\u0001LI")) {
      const item = raw.slice(3).trim();
      if (item) (list ??= []).push(item);
      continue;
    }
    if (raw.startsWith("\u0001H")) {
      flush();
      const text = raw.slice(2).trim();
      if (text) blocks.push({ type: "heading", text });
      continue;
    }
    const text = clean(raw);
    if (!text) continue;
    flush();
    blocks.push({ type: "paragraph", text });
  }
  flush();

  const chars = blocks.reduce((n, b) => n + ("text" in b ? b.text.length : "items" in b ? (b.items as string[]).join(" ").length : 0), 0);
  return {
    title: h1 ? clean(h1[1]!) || null : meta("og:title"),
    cover_url: meta("og:image"),
    newsletter_name: publisher ? clean(publisher[2]!) || null : null,
    newsletter_url: publisher ? publisher[1]!.split("?")[0]! : null,
    topic: sections.find((text) => text && !/^welcome to\b/i.test(text)) || blocks.find((b) => b.type === "heading")?.text || null,
    headings: blocks.flatMap((b) => (b.type === "heading" ? [b.text] : [])).slice(0, 12),
    blocks,
    chars,
  };
}

export type HistorySummary = {
  total_posts: number;
  posts_30d: number;
  posts_90d: number;
  last_post_days: number | null;
  issues_total: number;
  issues_90d: number;
  last_issue_days: number | null;
  median_impressions_90d: number | null;
  median_reactions_90d: number | null;
};

function median(xs: number[]): number | null {
  if (!xs.length) return null;
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m]! : Math.round((s[m - 1]! + s[m]!) / 2);
}

const DAY = 86_400_000;

/** Posting rhythm and reach. Impressions only count posts LinkedIn still reports them for. */
export function summarizeHistory(
  posts: Array<Pick<HistoryPostRow, "posted_at" | "impressions" | "reactions">>,
  issues: Array<{ published_at: string }>,
  now = Date.now()
): HistorySummary {
  const age = (iso: string) => (now - Date.parse(iso)) / DAY;
  const recent90 = posts.filter((p) => age(p.posted_at) <= 90);
  const lastPost = posts.reduce<number | null>((min, p) => (min == null ? age(p.posted_at) : Math.min(min, age(p.posted_at))), null);
  const lastIssue = issues.reduce<number | null>((min, i) => (min == null ? age(i.published_at) : Math.min(min, age(i.published_at))), null);
  return {
    total_posts: posts.length,
    posts_30d: posts.filter((p) => age(p.posted_at) <= 30).length,
    posts_90d: recent90.length,
    last_post_days: lastPost == null ? null : Math.max(0, Math.floor(lastPost)),
    issues_total: issues.length,
    issues_90d: issues.filter((i) => age(i.published_at) <= 90).length,
    last_issue_days: lastIssue == null ? null : Math.max(0, Math.floor(lastIssue)),
    median_impressions_90d: median(recent90.filter((p) => p.impressions > 0).map((p) => p.impressions)),
    median_reactions_90d: median(recent90.map((p) => p.reactions)),
  };
}

/** "Welcome to …" and label headings like "Recommended Viewing:" say nothing about the issue. */
const GENERIC_HEADING = /^(?:\W*\s*)?welcome to\b|:$/i;

function headingKey(text: string): string {
  return text.toLowerCase().replace(/[^a-z]/g, "");
}

/**
 * What each issue is about. Coaches reuse section headings ("5 Practical
 * Strategies…") across issues, so take the first heading this issue doesn't
 * share with two or more others, then its first section heading, then its title.
 */
export function pickIssueTopics(issues: Array<{ id: string; title: string; topic: string | null; headings: string[] | null }>): Map<string, string> {
  const seen = new Map<string, number>();
  for (const issue of issues) {
    for (const key of new Set((issue.headings ?? []).map(headingKey))) seen.set(key, (seen.get(key) ?? 0) + 1);
  }
  const out = new Map<string, string>();
  for (const issue of issues) {
    const own = (issue.headings ?? []).find((h) => {
      const key = headingKey(h);
      return key.length > 8 && (seen.get(key) ?? 0) < 3 && !GENERIC_HEADING.test(h.trim());
    });
    const topic = issue.topic && !GENERIC_HEADING.test(issue.topic.trim()) ? issue.topic : null;
    out.set(issue.id, (own || topic || issue.title).trim());
  }
  return out;
}
