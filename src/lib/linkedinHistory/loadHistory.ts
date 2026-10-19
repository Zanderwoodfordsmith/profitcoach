import { issueHeading, newsletterTitle, stripStandingFacts } from "@/lib/practiceKnowledge/newsletters";
import type { BlueprintBlock, BuiltSection, PracticeKnowledgePayload } from "@/lib/practiceKnowledge/types";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { pickIssueTopics, summarizeHistory, type HistoryKind, type HistorySummary } from "./parse";

/** Calendar and Insights only need the last two years; the summary counts everything. */
const POSTS_WINDOW_DAYS = 730;
const TEXT_CLIP = 280;

export type HistoryPostItem = {
  id: string;
  posted_at: string;
  kind: HistoryKind;
  text: string;
  share_url: string | null;
  article_id: string | null;
  impressions: number;
  reactions: number;
  comments: number;
  reposts: number;
};

export type NewsletterIssueItem = {
  id: string;
  article_id: string;
  title: string;
  url: string;
  published_at: string;
  newsletter_name: string | null;
  topic: string | null;
  cover_url: string | null;
  excerpt: string | null;
  has_body: boolean;
  impressions: number;
  reactions: number;
  comments: number;
};

/** An issue BCA wrote in the Blueprint that hasn't gone out yet. */
export type NewsletterDraftItem = {
  key: string;
  title: string;
  blocks: BlueprintBlock[];
  post: BlueprintBlock[] | null;
  written_at: string;
};

export type NewsletterSettings = {
  name: string | null;
  description: string | null;
  audience: string | null;
  cadence: string | null;
  cta: string | null;
};

export type LinkedInHistoryPayload = {
  connected: boolean;
  last_import: { last_ok_at: string | null; last_run_at: string | null; last_error: string | null; full: boolean; days_since_ok: number | null } | null;
  summary: HistorySummary;
  posts: HistoryPostItem[];
  /** Their own posts from the last 90 days that reached most people. */
  best_posts: HistoryPostItem[];
  issues: NewsletterIssueItem[];
  drafts: NewsletterDraftItem[];
  newsletter: NewsletterSettings;
};

async function allRows<T>(build: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>): Promise<T[]> {
  const out: T[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await build(from, from + 999);
    if (error) throw new Error(error.message);
    out.push(...(data ?? []));
    if (!data || data.length < 1000) break;
  }
  return out;
}

const DRAFT_KEY = /^content:(newsletter|analogy|kpis|nl-[a-z0-9]{6,12})$/;

/** BCA's issues open with "Subject: …" inside the message; that line is the headline. */
function draftSubject(blocks: BlueprintBlock[]): string | null {
  for (const block of blocks) {
    if (block.type !== "message") continue;
    const line = block.body.split("\n").find((l) => /^subject:/i.test(l.trim()));
    if (line) return line.trim().replace(/^subject:\s*/i, "").slice(0, 120) || null;
  }
  return null;
}

function draftsFrom(built: Record<string, BuiltSection> | null | undefined): NewsletterDraftItem[] {
  if (!built) return [];
  return Object.entries(built)
    .filter(([key, section]) => DRAFT_KEY.test(key) && section?.blocks?.length)
    .map(([key, section]) => {
      const blocks = stripStandingFacts(section.blocks);
      const title =
        draftSubject(section.blocks) ?? (key.startsWith("content:nl-") ? newsletterTitle(section.blocks, "Issue") : issueHeading(section.blocks, "Next issue"));
      const postKey = key === "content:newsletter" ? "content:post" : key.startsWith("content:nl-") ? `${key}-post` : null;
      const post = postKey ? built[postKey]?.blocks ?? null : null;
      return { key, title, blocks, post: post?.length ? post : null, written_at: section.edited_at || section.generated_at };
    })
    .sort((a, b) => (a.key === "content:newsletter" ? -1 : b.key === "content:newsletter" ? 1 : a.written_at.localeCompare(b.written_at)));
}

export async function loadLinkedInHistory(userId: string): Promise<LinkedInHistoryPayload> {
  const since = new Date(Date.now() - POSTS_WINDOW_DAYS * 86_400_000).toISOString();
  const [all, recent, issues, run, account, knowledge] = await Promise.all([
    allRows<{ posted_at: string; impressions: number; reactions: number }>((f, t) =>
      supabaseAdmin.from("linkedin_post_history").select("posted_at, impressions, reactions").eq("user_id", userId).range(f, t)
    ),
    supabaseAdmin
      .from("linkedin_post_history")
      .select("id, posted_at, kind, text, share_url, article_id, impressions, reactions, comments, reposts")
      .eq("user_id", userId)
      .gte("posted_at", since)
      .order("posted_at", { ascending: false })
      .limit(1000),
    supabaseAdmin
      .from("linkedin_newsletter_issues")
      .select("id, article_id, title, url, published_at, newsletter_name, topic, headings, cover_url, excerpt, body_chars, impressions, reactions, comments")
      .eq("user_id", userId)
      .order("published_at", { ascending: false }),
    supabaseAdmin.from("linkedin_history_imports").select("last_ok_at, last_run_at, last_error, full_import_at").eq("user_id", userId).maybeSingle(),
    supabaseAdmin.from("linkedin_outreach_accounts").select("id").eq("coach_id", userId).eq("status", "OK").ilike("provider", "linkedin").limit(1),
    supabaseAdmin.from("coach_practice_knowledge").select("payload, built_sections").eq("coach_id", userId).maybeSingle(),
  ]);

  const topics = pickIssueTopics(
    (issues.data ?? []).map((r) => ({
      id: r.id as string,
      title: (r.title as string) || "",
      topic: (r.topic as string | null) ?? null,
      headings: Array.isArray(r.headings) ? (r.headings as string[]) : null,
    }))
  );
  const issueItems: NewsletterIssueItem[] = (issues.data ?? []).map((r) => ({
    id: r.id as string,
    article_id: r.article_id as string,
    title: (r.title as string) || "Untitled issue",
    url: r.url as string,
    published_at: r.published_at as string,
    newsletter_name: (r.newsletter_name as string | null) ?? null,
    topic: topics.get(r.id as string) || null,
    cover_url: (r.cover_url as string | null) ?? null,
    excerpt: (r.excerpt as string | null) ?? null,
    has_body: Number(r.body_chars ?? 0) > 0,
    impressions: Number(r.impressions ?? 0),
    reactions: Number(r.reactions ?? 0),
    comments: Number(r.comments ?? 0),
  }));

  const posts: HistoryPostItem[] = (recent.data ?? []).map((r) => ({
      id: r.id as string,
      posted_at: r.posted_at as string,
      kind: r.kind as HistoryKind,
      text: String(r.text ?? "").slice(0, TEXT_CLIP),
      share_url: (r.share_url as string | null) ?? null,
      article_id: (r.article_id as string | null) ?? null,
      impressions: Number(r.impressions ?? 0),
      reactions: Number(r.reactions ?? 0),
      comments: Number(r.comments ?? 0),
      reposts: Number(r.reposts ?? 0),
    }));

  const practice = (knowledge.data?.payload as PracticeKnowledgePayload | null)?.practice;
  const runRow = run.data;

  return {
    connected: Boolean(account.data?.length),
    last_import: runRow
      ? {
          last_ok_at: (runRow.last_ok_at as string | null) ?? null,
          last_run_at: (runRow.last_run_at as string | null) ?? null,
          last_error: (runRow.last_error as string | null) ?? null,
          full: Boolean(runRow.full_import_at),
          days_since_ok: runRow.last_ok_at ? Math.floor((Date.now() - Date.parse(runRow.last_ok_at as string)) / 86_400_000) : null,
        }
      : null,
    summary: summarizeHistory(all, issueItems),
    posts,
    best_posts: posts
      .filter((p) => Date.parse(p.posted_at) >= Date.now() - 90 * 86_400_000 && p.kind !== "repost")
      .sort((a, b) => b.impressions - a.impressions || b.reactions - a.reactions)
      .slice(0, 10),
    issues: issueItems,
    drafts: draftsFrom(knowledge.data?.built_sections as Record<string, BuiltSection> | null),
    newsletter: {
      name: practice?.newsletter_name?.value ?? null,
      description: practice?.newsletter_description?.value ?? null,
      audience: practice?.newsletter_audience?.value ?? null,
      cadence: practice?.newsletter_cadence?.value ?? null,
      cta: practice?.newsletter_cta?.value ?? null,
    },
  };
}

export async function loadIssueBody(userId: string, issueId: string): Promise<BlueprintBlock[] | null> {
  const { data } = await supabaseAdmin
    .from("linkedin_newsletter_issues")
    .select("body_blocks")
    .eq("user_id", userId)
    .eq("id", issueId)
    .maybeSingle();
  return Array.isArray(data?.body_blocks) ? (data.body_blocks as BlueprintBlock[]) : null;
}
