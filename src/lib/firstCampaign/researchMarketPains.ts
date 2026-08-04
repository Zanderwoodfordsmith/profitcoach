/**
 * Market language research for Ideal Client Profile pains.
 * Reddit public search first; optional Apify actor fallback.
 */

import { ApifyClient } from "apify-client";
import { generateCampaignJson } from "@/lib/firstCampaign/generateJson";

export type ResearchSnippet = {
  title: string;
  body: string;
  url: string;
  source: string;
  score?: number;
};

export type ResearchQuote = {
  text: string;
  sourceLabel: string;
  url?: string;
};

export type ResearchPainsResult = {
  quotes: ResearchQuote[];
  snippetsUsed: number;
  providers: string[];
  queries: string[];
};

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function asString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function asNumber(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

export function buildResearchQueries(input: {
  industry: string;
  roleTitles: string[];
  geography?: string;
}): string[] {
  const industry = input.industry.trim() || "business owner";
  const role = (input.roleTitles[0] ?? "owner").trim();
  const geo = input.geography?.trim();
  const geoBit = geo ? ` ${geo}` : "";

  return [
    `"${industry}" (${role} OR founder OR "managing director" OR owner) (frustrated OR struggling OR overwhelmed OR "no time")`,
    `"${industry}" (busy OR profit OR cashflow OR "cash flow" OR margins) (owner OR founder)`,
    `${industry}${geoBit} owner "I feel" OR "I'm stuck" OR "everything comes back to me"`,
  ].slice(0, 3);
}

async function searchRedditJson(query: string): Promise<ResearchSnippet[]> {
  const url = new URL("https://www.reddit.com/search.json");
  url.searchParams.set("q", query);
  url.searchParams.set("sort", "relevance");
  url.searchParams.set("t", "year");
  url.searchParams.set("limit", "20");
  url.searchParams.set("type", "link");

  const res = await fetch(url.toString(), {
    headers: {
      Accept: "application/json",
      "User-Agent": "ProfitCoachApp/1.0 (ideal-client-language-research)",
    },
    signal: AbortSignal.timeout(20_000),
  });

  if (!res.ok) {
    throw new Error(`Reddit search failed (${res.status}).`);
  }

  const json = (await res.json()) as unknown;
  const listing = asRecord(json);
  const data = asRecord(listing?.data);
  const children = Array.isArray(data?.children) ? data.children : [];

  const out: ResearchSnippet[] = [];
  for (const child of children) {
    const rec = asRecord(child);
    const post = asRecord(rec?.data);
    if (!post) continue;
    const title = asString(post.title) ?? "";
    const body = asString(post.selftext) ?? "";
    if (!title && body.length < 40) continue;
    const permalink = asString(post.permalink);
    const subreddit = asString(post.subreddit) ?? "reddit";
    out.push({
      title,
      body: body.slice(0, 1800),
      url: permalink
        ? `https://www.reddit.com${permalink}`
        : asString(post.url) ?? "https://www.reddit.com",
      source: `Reddit · r/${subreddit}`,
      score: asNumber(post.score),
    });
  }
  return out;
}

/** Flexible parse for common Apify Reddit actor item shapes. */
function snippetsFromApifyItems(items: unknown[]): ResearchSnippet[] {
  const out: ResearchSnippet[] = [];
  for (const item of items) {
    const rec = asRecord(item);
    if (!rec) continue;
    const title =
      asString(rec.title) ??
      asString(rec.postTitle) ??
      asString(rec.name) ??
      "";
    const body =
      asString(rec.selftext) ??
      asString(rec.body) ??
      asString(rec.text) ??
      asString(rec.content) ??
      asString(rec.commentBody) ??
      "";
    if (!title && body.length < 40) continue;
    const subreddit =
      asString(rec.subreddit) ??
      asString(rec.communityName) ??
      asString(rec.subredditName) ??
      "reddit";
    const url =
      asString(rec.url) ??
      asString(rec.postUrl) ??
      asString(rec.link) ??
      (asString(rec.permalink)
        ? `https://www.reddit.com${asString(rec.permalink)}`
        : "https://www.reddit.com");
    out.push({
      title,
      body: body.slice(0, 1800),
      url,
      source: `Reddit · r/${subreddit.replace(/^r\//i, "")}`,
      score: asNumber(rec.score) ?? asNumber(rec.ups),
    });
  }
  return out;
}

async function searchRedditViaApify(query: string): Promise<ResearchSnippet[]> {
  const token = process.env.APIFY_TOKEN?.trim();
  if (!token) {
    throw new Error("APIFY_TOKEN not configured.");
  }

  const actorId =
    process.env.APIFY_REDDIT_SEARCH_ACTOR?.trim() ||
    "codingfrontend/reddit-search-scraper";
  const client = new ApifyClient({ token });

  const run = await client.actor(actorId).call(
    {
      searchQuery: query,
      sortBy: "relevance",
      topTime: "year",
      maxItems: 15,
      deepScraping: false,
      includeComments: true,
      // alternate schemas some actors use:
      keyword: query,
      max_posts: 15,
      max_comments: 5,
      sort_by: "relevance",
      time_filter: "year",
    },
    { waitSecs: 120 }
  );

  if (!run?.defaultDatasetId) {
    throw new Error("Apify Reddit run finished without a dataset.");
  }

  const { items } = await client.dataset(run.defaultDatasetId).listItems({
    limit: 40,
  });
  return snippetsFromApifyItems(items);
}

async function collectSnippets(queries: string[]): Promise<{
  snippets: ResearchSnippet[];
  providers: string[];
}> {
  const snippets: ResearchSnippet[] = [];
  const providers = new Set<string>();
  const seen = new Set<string>();

  function pushAll(batch: ResearchSnippet[], provider: string) {
    for (const s of batch) {
      const key = s.url || `${s.title}:${s.body.slice(0, 80)}`;
      if (seen.has(key)) continue;
      seen.add(key);
      snippets.push(s);
    }
    if (batch.length) providers.add(provider);
  }

  for (const query of queries) {
    try {
      const batch = await searchRedditJson(query);
      pushAll(batch, "reddit_json");
    } catch {
      // fall through to Apify for this query
      try {
        const batch = await searchRedditViaApify(query);
        pushAll(batch, "apify_reddit");
      } catch {
        // continue other queries
      }
    }
    if (snippets.length >= 28) break;
  }

  // If JSON returned nothing usable, one Apify attempt on the primary query
  if (snippets.length < 4 && process.env.APIFY_TOKEN?.trim()) {
    try {
      const batch = await searchRedditViaApify(queries[0]!);
      pushAll(batch, "apify_reddit");
    } catch {
      // leave empty — caller handles
    }
  }

  return { snippets: snippets.slice(0, 36), providers: Array.from(providers) };
}

const EXTRACT_SYSTEM = `You extract Ideal Client pain language from real forum/search snippets for a business coach.

Return ONLY valid JSON:
{
  "quotes": [
    {
      "text": "first-person pain in their words (short, punchy, quotable)",
      "sourceLabel": "Reddit · r/something",
      "url": "https://..."
    }
  ]
}

Rules:
- Prefer first-person voice ("I…", "We're…", "My team…").
- Keep industry / trade nouns when present.
- 6–10 quotes max. Drop spam, jokes, US-politics noise, and anything not about running a business.
- Do NOT invent quotes. Every text must be grounded in a provided snippet (paraphrase lightly for clarity only).
- UK spelling when the market is UK.
- If snippets are thin, return fewer high-quality quotes rather than padding.`;

export async function researchMarketPains(input: {
  industry: string;
  roleTitles: string[];
  geography?: string;
  teamSize?: string;
}): Promise<ResearchPainsResult> {
  const queries = buildResearchQueries(input);
  const { snippets, providers } = await collectSnippets(queries);

  if (snippets.length === 0) {
    return { quotes: [], snippetsUsed: 0, providers, queries };
  }

  const compact = snippets.map((s, i) => ({
    i,
    source: s.source,
    url: s.url,
    title: s.title.slice(0, 180),
    body: s.body.slice(0, 900),
    score: s.score,
  }));

  const { data } = await generateCampaignJson<{ quotes?: ResearchQuote[] }>({
    system: EXTRACT_SYSTEM,
    user: `Target market:
- Industry: ${input.industry}
- Titles: ${(input.roleTitles ?? []).join(", ") || "Owner / Founder"}
- Geography: ${input.geography ?? "United Kingdom"}
- Team size: ${input.teamSize ?? "unknown"}

Snippets:
${JSON.stringify(compact, null, 2)}

Extract pains-in-their-words quotes for this Ideal Client Profile.`,
    maxTokens: 2048,
  });

  const quotes = (data?.quotes ?? [])
    .map((q) => ({
      text: String(q.text ?? "").trim(),
      sourceLabel: String(q.sourceLabel ?? "Reddit").trim(),
      url: q.url ? String(q.url).trim() : undefined,
    }))
    .filter((q) => q.text.length >= 12)
    .slice(0, 10);

  return {
    quotes,
    snippetsUsed: snippets.length,
    providers,
    queries,
  };
}
