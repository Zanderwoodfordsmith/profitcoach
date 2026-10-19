import { getUnipileOwnProfile, listUnipileUserPosts } from "@/lib/unipile/client";
import { resolveUnipileAccountIdForUser } from "@/lib/unipile/publishing";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { mapUnipilePost, parseArticleHtml, type HistoryArticle, type HistoryPostRow } from "./parse";

/**
 * Import a coach's own LinkedIn posts and newsletter issues.
 *
 * Posts come through their connected account (Unipile), read-only. The first
 * run walks their whole history; later runs read the newest two pages to
 * refresh the numbers. Each issue's full text comes from its public article
 * page, fetched slowly and once, because the feed only carries a preview.
 */

const FULL_PAGES = 30;
const REFRESH_PAGES = 2;
const PAGE_GAP_MS = 800;
const ARTICLE_GAP_MS = 1500;
const BROWSER_UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0 Safari/537.36";

export type ImportHistoryResult =
  | { ok: true; full: boolean; pages: number; posts: number; issues: number; bodies: number }
  | { ok: false; error: string };

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Only LinkedIn article pages, so a stored URL can never point the fetch elsewhere. */
export function isLinkedInArticleUrl(url: string): boolean {
  try {
    const u = new URL(url);
    return u.protocol === "https:" && u.hostname === "www.linkedin.com" && u.pathname.startsWith("/pulse/");
  } catch {
    return false;
  }
}

async function recordRun(userId: string, patch: Record<string, unknown>) {
  await supabaseAdmin
    .from("linkedin_history_imports")
    .upsert({ user_id: userId, last_run_at: new Date().toISOString(), ...patch }, { onConflict: "user_id" });
}

/** Fetch full text for issues that don't have it yet. Stops at the first refusal (likely a login wall). */
export async function fetchIssueBodies(userId: string, limit: number): Promise<number> {
  if (limit <= 0) return 0;
  const { data } = await supabaseAdmin
    .from("linkedin_newsletter_issues")
    .select("id, url")
    .eq("user_id", userId)
    .is("body_fetched_at", null)
    .order("published_at", { ascending: false })
    .limit(limit);
  let done = 0;
  let tried = 0;
  for (const issue of data ?? []) {
    const url = String(issue.url);
    if (!isLinkedInArticleUrl(url)) continue;
    if (tried > 0) await sleep(ARTICLE_GAP_MS);
    tried += 1;
    let html = "";
    try {
      const res = await fetch(url, { headers: { "user-agent": BROWSER_UA, accept: "text/html" }, signal: AbortSignal.timeout(20_000) });
      html = await res.text();
    } catch {
      break;
    }
    // Some live articles come back as a 404 with the full page. A login wall
    // has no article title: stop and try again on a later run.
    if (!/class="[^"]*pulse-title/.test(html)) break;
    const page = parseArticleHtml(html);
    // Marked fetched even when no text was found, so one odd page can't hold up the rest.
    const patch: Record<string, unknown> = {
      body_blocks: page.blocks.length ? page.blocks : null,
      body_chars: page.chars,
      body_fetched_at: new Date().toISOString(),
      newsletter_name: page.newsletter_name,
      newsletter_url: page.newsletter_url,
      topic: page.topic,
      headings: page.headings,
      updated_at: new Date().toISOString(),
    };
    if (page.title) patch.title = page.title;
    if (page.cover_url) patch.cover_url = page.cover_url;
    await supabaseAdmin.from("linkedin_newsletter_issues").update(patch).eq("id", issue.id);
    if (page.blocks.length) done += 1;
  }
  return done;
}

export async function importLinkedInHistory(
  userId: string,
  options: { full?: boolean; maxBodies?: number } = {}
): Promise<ImportHistoryResult> {
  const accountId = await resolveUnipileAccountIdForUser(userId);
  if (!accountId) {
    await recordRun(userId, { last_error: "LinkedIn is not connected." });
    return { ok: false, error: "Connect LinkedIn first." };
  }

  const me = await getUnipileOwnProfile(accountId);
  const providerId = typeof me.data?.provider_id === "string" ? me.data.provider_id : null;
  if (!me.ok || !providerId) {
    const error = me.error || "Could not read the LinkedIn profile.";
    await recordRun(userId, { last_error: error });
    return { ok: false, error };
  }
  const owner = {
    providerId,
    name: [me.data?.first_name, me.data?.last_name].filter((v) => typeof v === "string" && v.trim()).join(" "),
  };

  const { data: state } = await supabaseAdmin.from("linkedin_history_imports").select("full_import_at").eq("user_id", userId).maybeSingle();
  const full = options.full || !state?.full_import_at;
  const maxPages = full ? FULL_PAGES : REFRESH_PAGES;

  const rows = new Map<string, HistoryPostRow>();
  const articles = new Map<string, HistoryArticle & { impressions: number; reactions: number; comments: number; reposts: number }>();
  let cursor: string | null = null;
  let pages = 0;
  let complete = false;
  for (; pages < maxPages; pages++) {
    if (pages > 0) await sleep(PAGE_GAP_MS);
    const res = await listUnipileUserPosts({ identifier: providerId, account_id: accountId, limit: 100, cursor });
    if (!res.ok) {
      if (pages === 0) {
        const error = res.error || "Could not read LinkedIn posts.";
        await recordRun(userId, { last_error: error });
        return { ok: false, error };
      }
      break;
    }
    for (const item of res.data?.items ?? []) {
      const mapped = mapUnipilePost(item, owner);
      if (!mapped) continue;
      rows.set(mapped.row.post_id, mapped.row);
      const a = mapped.article;
      if (!a) continue;
      const prev = articles.get(a.article_id);
      const r = mapped.row;
      articles.set(a.article_id, {
        ...(prev ?? a),
        published_at: prev && prev.published_at < a.published_at ? prev.published_at : a.published_at,
        impressions: (prev?.impressions ?? 0) + r.impressions,
        reactions: (prev?.reactions ?? 0) + r.reactions,
        comments: (prev?.comments ?? 0) + r.comments,
        reposts: (prev?.reposts ?? 0) + r.reposts,
      });
    }
    cursor = res.data?.cursor ?? null;
    // The end of history is an empty page that still carries a cursor.
    if (!cursor || !res.data?.items?.length) {
      complete = true;
      pages += 1;
      break;
    }
  }

  const now = new Date().toISOString();
  const postRows = [...rows.values()].map((r) => ({ ...r, user_id: userId, updated_at: now }));
  for (let i = 0; i < postRows.length; i += 200) {
    const { error } = await supabaseAdmin.from("linkedin_post_history").upsert(postRows.slice(i, i + 200), { onConflict: "user_id,post_id" });
    if (error) {
      await recordRun(userId, { last_error: error.message });
      return { ok: false, error: error.message };
    }
  }

  // The feed's cover link expires within weeks, so covers come from the article page instead.
  const issueRows = [...articles.values()].map((a) => ({
    user_id: userId,
    article_id: a.article_id,
    url: a.url,
    title: a.title,
    published_at: a.published_at,
    excerpt: a.excerpt,
    impressions: a.impressions,
    reactions: a.reactions,
    comments: a.comments,
    reposts: a.reposts,
    updated_at: now,
  }));
  if (issueRows.length) {
    const { error } = await supabaseAdmin.from("linkedin_newsletter_issues").upsert(issueRows, { onConflict: "user_id,article_id" });
    if (error) {
      await recordRun(userId, { last_error: error.message });
      return { ok: false, error: error.message };
    }
  }

  const bodies = await fetchIssueBodies(userId, options.maxBodies ?? 10);

  const [{ count: postCount }, { count: issueCount }, { data: latest }] = await Promise.all([
    supabaseAdmin.from("linkedin_post_history").select("id", { count: "exact", head: true }).eq("user_id", userId),
    supabaseAdmin.from("linkedin_newsletter_issues").select("id", { count: "exact", head: true }).eq("user_id", userId),
    supabaseAdmin.from("linkedin_post_history").select("posted_at").eq("user_id", userId).order("posted_at", { ascending: false }).limit(1).maybeSingle(),
  ]);
  await recordRun(userId, {
    last_ok_at: now,
    last_error: null,
    posts: postCount ?? 0,
    issues: issueCount ?? 0,
    last_post_at: (latest?.posted_at as string | undefined) ?? null,
    ...(full && (complete || pages >= maxPages) ? { full_import_at: now } : {}),
  });

  return { ok: true, full, pages, posts: rows.size, issues: articles.size, bodies };
}

/** Coaches with a connected LinkedIn, stalest import first. */
export async function coachesDueForHistoryImport(staleHours: number, limit: number): Promise<string[]> {
  const { data: accounts } = await supabaseAdmin
    .from("linkedin_outreach_accounts")
    .select("coach_id")
    .eq("status", "OK")
    .ilike("provider", "linkedin");
  const ids = [...new Set((accounts ?? []).map((a) => a.coach_id as string).filter(Boolean))];
  if (!ids.length) return [];
  const { data: runs } = await supabaseAdmin.from("linkedin_history_imports").select("user_id, last_run_at").in("user_id", ids);
  const lastRun = new Map((runs ?? []).map((r) => [r.user_id as string, r.last_run_at ? Date.parse(r.last_run_at as string) : 0]));
  const cutoff = Date.now() - staleHours * 3_600_000;
  return ids
    .filter((id) => (lastRun.get(id) ?? 0) < cutoff)
    .sort((a, b) => (lastRun.get(a) ?? 0) - (lastRun.get(b) ?? 0))
    .slice(0, limit);
}
