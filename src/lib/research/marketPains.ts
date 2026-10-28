import { createHash } from "node:crypto";

import Anthropic from "@anthropic-ai/sdk";
import { ApifyClient } from "apify-client";

/**
 * Pains research, v1: what owners in one market say about running their
 * business, in their own words, ranked by how many separate owners say it.
 *
 * Google (UK, last two years) → fetch the pages → Claude labels each poster
 * and copies pain quotes → code drops any quote that is not word for word in
 * the page → one grouping call that returns ids only → code counts separate
 * owners, weighted for recency. No Reddit, LinkedIn or YouTube (their terms).
 * Roadmap card 162. No database writes.
 */

const SEARCH_ACTOR = "apify/google-search-scraper";
const QUERY_MODEL = process.env.RESEARCH_QUERY_MODEL?.trim() || "claude-haiku-5-5";
const EXTRACT_MODEL = process.env.RESEARCH_EXTRACT_MODEL?.trim() || "claude-sonnet-5-5";
const GROUP_MODEL = process.env.RESEARCH_GROUP_MODEL?.trim() || "claude-opus-5-5";

/** $ per million tokens: input, output. */
const PRICES: Record<string, [number, number]> = {
  "claude-haiku-5-5": [0.1, 0.5],
  "claude-sonnet-5-5": [2, 10],
  "claude-opus-5-5": [4, 20],
};

const MAX_PAGES = 45;
const PAGE_CHARS = 16_000;
const FETCH_TIMEOUT_MS = 12_000;
const EXTRACT_CONCURRENCY = 6;
const TOP_PAINS = 10;
const WEAK_BELOW = 3;
/** Posts older than this are left out: we want what owners say now. */
const MAX_AGE_MONTHS = 36;

/** Sites we never use: their terms rule it out, or the posters are the wrong people. */
const BLOCKED_HOSTS = [
  "reddit.com",
  "linkedin.com",
  "youtube.com",
  "youtu.be",
  "facebook.com",
  "instagram.com",
  "tiktok.com",
  "twitter.com",
  "x.com",
  "mumsnet.com",
  "quora.com",
  "pinterest.",
  "amazon.",
  "glassdoor.",
  "indeed.",
];

const DISCUSSION_PATH = /\/(threads?|forums?|topic|topics|community|discussion|discussions|comments?|viewtopic|showthread|t)\/|viewtopic\.php|showthread\.php|\/questions?\//i;

export type MarketInput = {
  /** The market in plain words, e.g. "UK owner-led independent gyms and fitness facilities". */
  market: string;
  /** Who the buyer is, e.g. "owner or MD, £1m-£5m turnover, 10-50 staff". */
  buyer?: string;
  /** Extra trade words the coach gave. */
  terms?: string[];
};

export type Speaker = "owner" | "manager_or_employee" | "customer" | "supplier_or_consultant" | "unknown";

export type PainMention = {
  id: string;
  label: string;
  quote: string;
  trigger: string | null;
  tried: string | null;
  wants: string | null;
  speaker: Speaker;
  size_evidence: string | null;
  uk_evidence: string | null;
  author_key: string;
  url: string;
  domain: string;
  date: string | null;
};

export type RankedPain = {
  name: string;
  score: number;
  owners: number;
  owners_last_12_months: number;
  sources: number;
  mentions: number;
  weak: boolean;
  quotes: { quote: string; url: string; date: string | null; speaker: Speaker; size: string | null }[];
  triggers: string[];
  tried: string[];
  wants: string[];
  phrases: { phrase: string; owners: number }[];
};

export type ResearchCost = { apify_usd: number; anthropic_usd: number; total_usd: number; tokens: Record<string, { input: number; output: number }> };

export type MarketPainsResult = {
  market: MarketInput;
  ran_at: string;
  seconds: number;
  queries: string[];
  questions_people_ask: string[];
  pages: { found: number; fetched: number; with_pains: number };
  sources: { pages: string[]; forums: string[]; trade_press: string[]; suppliers: string[]; review_pages: string[] };
  page_log: { url: string; posts: number; pains: number; kept: number; speakers: string }[];
  mentions: { extracted: number; quote_failed: number; kept: number; dropped_speaker: number; dropped_uk: number; dropped_size: number; dropped_old: number };
  /** Every owner quote that passed, so ranking and cross-market work can rerun without new searches. */
  kept_mentions: PainMention[];
  pains: RankedPain[];
  cost: ResearchCost;
  log: string[];
};

// ---------------------------------------------------------------- helpers

/** Same text on both sides of the quote check: whitespace, curly quotes and dashes made plain. */
export function normaliseForMatch(text: string): string {
  return text
    .replace(/[‘’‚‛′]/g, "'")
    .replace(/[“”„‟″]/g, '"')
    .replace(/[‐-―−]/g, "-")
    .replace(/…/g, "...")
    .replace(/ /g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

/** True when the quote is word for word in the source (after normalising). */
export function quoteIsExact(quote: string, source: string): boolean {
  const q = normaliseForMatch(quote);
  if (q.length < 12) return false;
  return normaliseForMatch(source).includes(q);
}

/** Months between a date and now; null when there is no usable date. */
export function monthsAgo(date: string | null, now = Date.now()): number | null {
  if (!date) return null;
  const t = Date.parse(date.length === 7 ? `${date}-15` : date);
  if (!Number.isFinite(t)) return null;
  return (now - t) / (30.44 * 86_400_000);
}

/** Last 12 months count fully, 12 to 24 months half, older or undated less. */
export function recencyWeight(date: string | null, now = Date.now()): number {
  const m = monthsAgo(date, now);
  if (m === null) return 0.5;
  if (m <= 12) return 1;
  if (m <= 24) return 0.5;
  return 0.25;
}

export function fitWeight(m: Pick<PainMention, "speaker" | "size_evidence">): number {
  if (m.speaker === "owner") return m.size_evidence ? 1 : 0.8;
  return 0.5;
}

function hostOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    return "";
  }
}

function hash(text: string): string {
  return createHash("sha1").update(text).digest("hex").slice(0, 12);
}

function decodeEntities(text: string): string {
  const named: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ", pound: "£", hellip: "…", rsquo: "’", lsquo: "‘", ldquo: "“", rdquo: "”", ndash: "–", mdash: "—" };
  return text
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&([a-z]+);/gi, (m, n) => named[n.toLowerCase()] ?? m);
}

/** Readable text from a page: scripts, styles and menus out, blocks on their own lines. */
export function htmlToText(html: string): string {
  return decodeEntities(
    html
      .replace(/<!--[\s\S]*?-->/g, " ")
      .replace(/<(script|style|noscript|svg|nav|footer|header|form|iframe)[\s\S]*?<\/\1>/gi, " ")
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<\/(p|div|li|h[1-6]|article|section|blockquote|tr|dd|dt)>/gi, "\n")
      .replace(/<[^>]+>/g, " ")
  )
    .replace(/[ \t\f\v]+/g, " ")
    .replace(/\n\s*\n+/g, "\n")
    .trim();
}

async function pool<T, R>(items: T[], limit: number, fn: (item: T, i: number) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, async () => {
      while (next < items.length) {
        const i = next++;
        out[i] = await fn(items[i]!, i);
      }
    })
  );
  return out;
}

// ---------------------------------------------------------------- Claude

export class Costs {
  tokens: Record<string, { input: number; output: number }> = {};
  apify = 0;
  searches = 0;
  add(model: string, usage: Anthropic.Messages.Usage) {
    const t = (this.tokens[model] ??= { input: 0, output: 0 });
    t.input += (usage.input_tokens ?? 0) + (usage.cache_read_input_tokens ?? 0) + (usage.cache_creation_input_tokens ?? 0);
    t.output += usage.output_tokens ?? 0;
  }
  summary(): ResearchCost {
    let anthropic = 0;
    for (const [model, t] of Object.entries(this.tokens)) {
      const [i, o] = PRICES[model] ?? [5, 25];
      anthropic += (t.input * i + t.output * o) / 1_000_000;
    }
    anthropic += this.searches * 0.01;
    const round = (n: number) => Math.round(n * 1000) / 1000;
    return { apify_usd: round(this.apify), anthropic_usd: round(anthropic), total_usd: round(this.apify + anthropic), tokens: this.tokens };
  }
}

async function askJson<T>(
  client: Anthropic,
  costs: Costs,
  opts: { model: string; system: string; user: string; schema: Record<string, unknown>; maxTokens: number; effort?: "low" | "medium" | "high" }
): Promise<T> {
  const response = await client.messages.create({
    model: opts.model,
    max_tokens: opts.maxTokens,
    system: opts.system,
    output_config: { effort: opts.effort ?? "low", format: { type: "json_schema", schema: opts.schema } },
    messages: [{ role: "user", content: opts.user }],
  } as Anthropic.Messages.MessageCreateParamsNonStreaming);
  costs.add(opts.model, response.usage);
  if (response.stop_reason === "max_tokens") throw new Error(`${opts.model} ran out of room.`);
  const text = response.content
    .filter((b): b is Anthropic.Messages.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("");
  return JSON.parse(text) as T;
}

// ---------------------------------------------------------------- 1. queries

type QueryPlan = { industry_nouns: string[]; pain_cues: string[]; forums: string[]; trade_press: string[]; suppliers: string[]; review_pages: string[]; pages: string[] };

const QUERY_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["industry_nouns", "pain_cues"],
  properties: {
    industry_nouns: { type: "array", items: { type: "string" } },
    pain_cues: { type: "array", items: { type: "string" } },
  },
};

async function planWords(client: Anthropic, costs: Costs, input: MarketInput): Promise<Pick<QueryPlan, "industry_nouns" | "pain_cues">> {
  return askJson(client, costs, {
    model: QUERY_MODEL,
    maxTokens: 1500,
    system:
      "You plan Google searches that find UK business owners talking candidly about running their business in one market. Answer in JSON only.",
    user: [
      `Market: ${input.market}`,
      input.buyer ? `Buyer: ${input.buyer}` : "",
      input.terms?.length ? `Trade words from the coach: ${input.terms.join(", ")}` : "",
      "",
      "Give:",
      "- industry_nouns: 6 to 8 short words a UK owner in this market uses for their own business or trade (e.g. 'gym', 'PT studio', 'padel club'). 1 to 3 words each, most common first.",
      "- pain_cues: 6 to 8 short words owners use when something is wrong (e.g. 'cash flow', 'staff', 'margins', 'struggling', 'advice'). 1 or 2 words each.",
    ]
      .filter(Boolean)
      .join("\n"),
    schema: QUERY_SCHEMA,
  });
}

/** Claude searches the web for where these owners actually post in public, and what they buy. */
export async function discoverSources(client: Anthropic, costs: Costs, input: MarketInput, log: string[]): Promise<Pick<QueryPlan, "forums" | "trade_press" | "suppliers" | "review_pages" | "pages">> {
  const messages: Anthropic.MessageParam[] = [
    {
      role: "user",
      content: `Market: ${input.market}${input.buyer ? `\nBuyer: ${input.buyer}` : ""}

Run several web searches (use different angles: forums, trade press interviews, reviews, the market's own words for its problems) to find, for UK owners of businesses in this market:
0. pages: up to 25 full URLs of pages where UK owners or managing directors in this market describe, in their own words, problems in running their business: forum threads, trade press articles that quote named owners, interviews, review pages. Not adviser or consultant blogs, vendor marketing, or news with no owner quotes. Last two years where possible.
1. forums: public UK forums or communities (not Facebook, LinkedIn, Reddit, YouTube or Mumsnet) where these owners post about running their business. Domains only. Check they exist and are active. Up to 6.
2. trade_press: UK trade publications for this market whose articles quote owners. Domains only. Up to 4.
3. suppliers: 3 to 5 software products or suppliers these businesses buy (e.g. booking or membership software, ERP, POS). Brand names only.
4. review_pages: up to 5 full URLs of review pages for those suppliers (Trustpilot, Capterra or G2) where the reviewers are UK business owners in this market. Only URLs you found in search results.

List URLs and domains from your search results. If unsure whether a page quotes owners, include it: every page is read and checked afterwards.

Finish with one line of JSON only: {"pages": [...], "forums": [...], "trade_press": [...], "suppliers": [...], "review_pages": [...]}`,
    },
  ];
  const tool = {
    // The basic variant: results come back as plain blocks we can read the links from.
    type: "web_search_20250305",
    name: "web_search",
    max_uses: 10,
    user_location: { type: "approximate", country: "GB" },
    blocked_domains: ["reddit.com", "facebook.com", "linkedin.com", "youtube.com", "mumsnet.com", "instagram.com", "tiktok.com"],
  };
  let text = "";
  const seenUrls: string[] = [];
  for (let turn = 0; turn < 3; turn++) {
    const response = await client.messages.create({
      model: EXTRACT_MODEL,
      max_tokens: 12000,
      output_config: { effort: "medium" },
      tools: [tool],
      messages,
    } as unknown as Anthropic.Messages.MessageCreateParamsNonStreaming);
    costs.add(EXTRACT_MODEL, response.usage);
    costs.searches += (response.usage as { server_tool_use?: { web_search_requests?: number } }).server_tool_use?.web_search_requests ?? 0;
    text = response.content
      .filter((b): b is Anthropic.Messages.TextBlock => b.type === "text")
      .map((b) => b.text)
      .join("");
    for (const block of response.content as unknown as { type: string; content?: unknown }[]) {
      if (block.type !== "web_search_tool_result" || !Array.isArray(block.content)) continue;
      for (const r of block.content as { url?: string }[]) if (r.url) seenUrls.push(r.url);
    }
    if (process.env.RESEARCH_DEBUG) console.error("discovery", response.stop_reason, JSON.stringify(response.usage.server_tool_use ?? {}), text.slice(-1500));
    if (response.stop_reason !== "pause_turn") break;
    messages.push({ role: "assistant", content: response.content });
  }
  const start = text.lastIndexOf('{"pages"') >= 0 ? text.lastIndexOf('{"pages"') : text.lastIndexOf("{");
  try {
    const parsed = JSON.parse(start >= 0 ? text.slice(start, text.lastIndexOf("}") + 1) : "{}") as Partial<QueryPlan>;
    // Claude's picks first, then every other link its searches turned up.
    const pages = [...(parsed.pages ?? []), ...seenUrls].filter((u, i, all) => all.indexOf(u) === i);
    return { pages, forums: parsed.forums ?? [], trade_press: parsed.trade_press ?? [], suppliers: parsed.suppliers ?? [], review_pages: parsed.review_pages ?? [] };
  } catch {
    log.push("discovery: could not read the JSON, going on without it");
    return { pages: [...new Set(seenUrls)], forums: [], trade_press: [], suppliers: [], review_pages: [] };
  }
}

const REGIONAL_PRESS = ["insidermedia.com", "bdaily.co.uk", "thebusinessdesk.com"];

const NO_SOCIAL = "-site:facebook.com -site:instagram.com -site:reddit.com -site:linkedin.com -site:youtube.com -site:tiktok.com";

function cleanHost(d: string): string {
  return hostOf(d.includes("://") ? d : `https://${d}`);
}

export function buildQueries(plan: QueryPlan): string[] {
  const nouns = plan.industry_nouns.map((s) => s.trim()).filter(Boolean).slice(0, 8);
  const cues = plan.pain_cues.map((s) => s.trim()).filter(Boolean).slice(0, 8);
  const forums = plan.forums.map(cleanHost).filter((d) => d && !BLOCKED_HOSTS.some((b) => d.includes(b)) && !d.includes("ukbusinessforums")).slice(0, 6);
  const press = plan.trade_press.map(cleanHost).filter(Boolean).slice(0, 4);
  const suppliers = plan.suppliers.map((s) => s.trim()).filter(Boolean).slice(0, 4);
  const cue = (i: number) => cues[i % Math.max(1, cues.length)] ?? "advice";
  const q = new Set<string>();
  // UK Business Forums: broad, the page itself is checked for pains later.
  nouns.slice(0, 4).forEach((n) => q.add(`site:ukbusinessforums.co.uk ${n}`));
  // The market's own forums.
  forums.forEach((f, i) => {
    q.add(`site:${f} ${nouns[i % Math.max(1, nouns.length)] ?? ""} ${cue(i)}`.replace(/\s+/g, " ").trim());
    q.add(`site:${f} owner ${cue(i + 2)}`);
  });
  // Trade press quoting owners.
  press.forEach((p, i) => q.add(`site:${p} ${nouns[i % Math.max(1, nouns.length)] ?? ""} owner "${cue(i)}"`));
  // UK regional business press: managing directors of firms this size, quoted on what is hurting.
  REGIONAL_PRESS.forEach((p, i) => q.add(`site:${p} ${nouns[i % Math.max(1, nouns.length)] ?? ""} "managing director" ${cue(i)}`));
  // Reviews of what they buy.
  suppliers.slice(0, 2).forEach((s) => q.add(`${s} ${nouns[0] ?? ""} software review owner UK`));
  // Open web, social sites left out.
  nouns.slice(0, 5).forEach((n, i) => q.add(`${n} owner ${cue(i)} forum UK ${NO_SOCIAL}`));
  nouns.slice(0, 3).forEach((n, i) => q.add(`"my ${n}" ${cue(i + 1)} UK ${NO_SOCIAL}`));
  return [...q].slice(0, 32);
}

// ---------------------------------------------------------------- 2. search

type SearchHit = { url: string; title: string; description: string; date: string | null; query: string };

async function search(queries: string[], costs: Costs, log: string[]): Promise<{ hits: SearchHit[]; questions: string[] }> {
  const token = process.env.APIFY_TOKEN?.trim();
  if (!token) throw new Error("APIFY_TOKEN is not set.");
  const client = new ApifyClient({ token });
  const run = await client.actor(SEARCH_ACTOR).call(
    {
      queries: queries.join("\n"),
      maxPagesPerQuery: 1,
      countryCode: "gb",
      languageCode: "en",
      searchLanguage: "en",
      quickDateRange: "y2",
      mobileResults: false,
      includeUnfilteredResults: false,
      saveHtml: false,
      saveHtmlToKeyValueStore: false,
      focusOnPaidAds: false,
      maximumLeadsEnrichmentRecords: 0,
    },
    { waitSecs: 600 }
  );
  const usage = Number((run as unknown as { usageTotalUsd?: number }).usageTotalUsd ?? 0);
  costs.apify += Number.isFinite(usage) && usage > 0 ? usage : queries.length * 0.0018;
  const { items } = await client.dataset(run.defaultDatasetId).listItems({ limit: 500 });
  const hits: SearchHit[] = [];
  const questions = new Set<string>();
  for (const raw of items as Record<string, unknown>[]) {
    const query = String((raw.searchQuery as { term?: string } | undefined)?.term ?? "");
    for (const r of (raw.organicResults as Record<string, unknown>[] | undefined) ?? []) {
      const url = String(r.url ?? "");
      if (!url) continue;
      hits.push({
        url,
        title: String(r.title ?? ""),
        description: String(r.description ?? ""),
        date: typeof r.date === "string" ? r.date : null,
        query,
      });
    }
    for (const p of (raw.peopleAlsoAsk as { question?: string }[] | undefined) ?? []) {
      if (p.question) questions.add(p.question.trim());
    }
  }
  log.push(`search: ${queries.length} queries, ${hits.length} results, $${costs.apify.toFixed(3)} Apify`);
  return { hits, questions: [...questions] };
}

/** Discussion threads first, then pages on the suggested forums, then the rest. Blocked sites out. */
/** Listing and profile pages hold no posts of their own. */
const LISTING_PATH = /\/(whats-new|search|members|tags|tag|login|register|account|find-new)\b|\/forums\/?$|\/forums\/[^/]+\/?$/i;

export function pickPages(hits: SearchHit[], preferred: string[], max = MAX_PAGES, perDomain = 10): SearchHit[] {
  const seen = new Set<string>();
  const scored: { hit: SearchHit; score: number }[] = [];
  for (const hit of hits) {
    const host = hostOf(hit.url);
    if (!host || BLOCKED_HOSTS.some((b) => host.includes(b))) continue;
    if (/\.(pdf|docx?|xlsx?)($|\?)/i.test(hit.url)) continue;
    if (LISTING_PATH.test(new URL(hit.url).pathname)) continue;
    if (host.includes("ukbusinessforums") && !/\/threads\//.test(hit.url)) continue;
    const key = hit.url.replace(/[#?].*$/, "").replace(/\/page-\d+\/?$/, "");
    if (seen.has(key)) continue;
    seen.add(key);
    let score = 1;
    if (DISCUSSION_PATH.test(hit.url) || /forum|community/i.test(host)) score += 3;
    if (preferred.some((p) => host.endsWith(p))) score += 2;
    if (host.endsWith(".uk")) score += 1;
    scored.push({ hit, score });
  }
  const perHost = new Map<string, number>();
  return scored
    .sort((a, b) => b.score - a.score)
    .filter(({ hit }) => {
      const host = hostOf(hit.url);
      const n = perHost.get(host) ?? 0;
      perHost.set(host, n + 1);
      return n < perDomain;
    })
    .slice(0, max)
    .map((s) => s.hit);
}

// ---------------------------------------------------------------- 3. fetch

async function fetchText(url: string): Promise<string | null> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      signal: ctrl.signal,
      redirect: "follow",
      headers: {
        "user-agent": "Mozilla/5.0 (compatible; BCA-research/1.0; +https://theprofitcoach.com)",
        accept: "text/html,application/xhtml+xml",
        "accept-language": "en-GB,en;q=0.9",
      },
    });
    if (!res.ok || !(res.headers.get("content-type") ?? "").includes("html")) return null;
    const text = htmlToText(await res.text());
    return text.length > 400 ? text : null;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/** For pages that turn plain fetching away (Trustpilot, Capterra): Claude's web fetch tool, which hands back the page text. */
async function fetchViaClaude(client: Anthropic, costs: Costs, url: string): Promise<string | null> {
  try {
    const response = await client.messages.create({
      model: EXTRACT_MODEL,
      max_tokens: 200,
      output_config: { effort: "low" },
      tools: [{ type: "web_fetch_20250910", name: "web_fetch", max_uses: 1, max_content_tokens: 10_000 }],
      messages: [{ role: "user", content: `Fetch ${url} with the web_fetch tool, then reply with the single word done.` }],
    } as unknown as Anthropic.Messages.MessageCreateParamsNonStreaming);
    costs.add(EXTRACT_MODEL, response.usage);
    for (const block of response.content as unknown as { type: string; content?: { type?: string; content?: { source?: { type?: string; data?: string } } } }[]) {
      if (block.type !== "web_fetch_tool_result") continue;
      const source = block.content?.content?.source;
      if (source?.type === "text" && source.data && source.data.length > 400) return source.data;
    }
    return null;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------- 4. extract

type ExtractedPost = {
  author: string | null;
  date: string | null;
  speaker: Speaker;
  uk_evidence: string | null;
  size_evidence: string | null;
  industry_match: "yes" | "partly" | "no";
  size_fit: "fits" | "too_small" | "too_big" | "unknown";
  pains: { label: string; quote: string; trigger: string | null; tried: string | null; wants: string | null }[];
};

const NULLABLE_STRING = { anyOf: [{ type: "string" }, { type: "null" }] };

const EXTRACT_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["posts"],
  properties: {
    posts: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["author", "date", "speaker", "uk_evidence", "size_evidence", "industry_match", "size_fit", "pains"],
        properties: {
          author: NULLABLE_STRING,
          date: NULLABLE_STRING,
          speaker: { type: "string", enum: ["owner", "manager_or_employee", "customer", "supplier_or_consultant", "unknown"] },
          uk_evidence: NULLABLE_STRING,
          size_evidence: NULLABLE_STRING,
          industry_match: { type: "string", enum: ["yes", "partly", "no"] },
          size_fit: { type: "string", enum: ["fits", "too_small", "too_big", "unknown"] },
          pains: {
            type: "array",
            items: {
              type: "object",
              additionalProperties: false,
              required: ["label", "quote", "trigger", "tried", "wants"],
              properties: {
                label: { type: "string" },
                quote: { type: "string" },
                trigger: NULLABLE_STRING,
                tried: NULLABLE_STRING,
                wants: NULLABLE_STRING,
              },
            },
          },
        },
      },
    },
  },
};

const EXTRACT_SYSTEM = `You read one web page (a forum thread, an article or reviews) and pull out the problems business owners describe in running their business.

Every post, review or quoted person is a separate entry, one per person: a page with 20 reviews from 20 people gives up to 20 entries, never one entry for the whole page. For every one that describes a business problem, give:
- author: the username or name exactly as shown, or null.
- date: the post's own date as YYYY-MM-DD or YYYY-MM, or null if the page does not show it. Never use today's date.
- speaker: owner (owns or runs the business: "my business", "my staff", "I run a"; a reviewer of a supplier who says they own or run a business in the market also counts as owner), manager_or_employee, customer, supplier_or_consultant (sells to these businesses, including consultants, marketers and coaches advertising themselves), or unknown.
- uk_evidence: a few words from the post or page showing it is UK (£, HMRC, VAT, a UK town, council, NI), or null.
- size_evidence: a few words showing the business size (staff numbers, turnover, sites, managers), or null.
- industry_match: does this business belong to the target market: yes, partly or no.
- size_fit: against the buyer described, is this business the right size: fits, too_small (a sole trader, a start-up or pre-start, a side business, or clearly far smaller), too_big (a large corporate or plc), or unknown.
- pains: each distinct problem, with
  - label: the problem in 2 to 6 plain words.
  - quote: copied EXACTLY, character for character, from the page text: one to three consecutive sentences, 8 to 50 words. Do not fix spelling, grammar or punctuation. Do not join sentences from different places. Do not add or remove words. If no sentence states the problem clearly, leave the pain out.
  - trigger: what just happened that made it a problem, in a few words, or null.
  - tried: what they already tried, in a few words, or null.
  - wants: what they want instead, in a few words, or null.

Leave out posts with no business problem, adverts, signatures, menus and cookie notices. If the page has nothing useful, return {"posts": []}.`;

export async function extractPage(
  client: Anthropic,
  costs: Costs,
  market: MarketInput,
  page: SearchHit,
  text: string
): Promise<ExtractedPost[]> {
  const out = await askJson<{ posts: ExtractedPost[] }>(client, costs, {
    model: EXTRACT_MODEL,
    maxTokens: 6000,
    system: EXTRACT_SYSTEM,
    user: `Target market: ${market.market}${market.buyer ? `\nBuyer: ${market.buyer}` : ""}\nPage: ${page.url}\nTitle: ${page.title}\n\n<page>\n${text.slice(0, PAGE_CHARS)}\n</page>`,
    schema: EXTRACT_SCHEMA,
  });
  return out.posts ?? [];
}

const OWNER_WORDS = /\b(my|our) (business|company|firm|staff|team|gym|shop|factory|club|venue|restaurant|franchise|store|customers|clients|members)\b|\bI (own|run|started|set up)\b/i;

// ---------------------------------------------------------------- 5. group

type Group = { name: string; ids: string[] };

const GROUP_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["groups"],
  properties: {
    groups: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["name", "ids"],
        properties: { name: { type: "string" }, ids: { type: "array", items: { type: "string" } } },
      },
    },
  },
};

async function groupMentions(client: Anthropic, costs: Costs, market: MarketInput, mentions: PainMention[]): Promise<Group[]> {
  const lines = mentions.map((m) => `${m.id} | ${m.label} | ${m.quote.slice(0, 90).replace(/\s+/g, " ")}`).join("\n");
  const out = await askJson<{ groups: Group[] }>(client, costs, {
    model: GROUP_MODEL,
    maxTokens: 8000,
    effort: "medium",
    system:
      "You group business owners' problems into themes. Return ids only, never rewrite quotes. Answer in JSON only.",
    user: `Market: ${market.market}

Below, one problem per line: id | short label | start of the owner's quote.

Group them into 8 to 15 themes, each a distinct problem an owner would recognise. Name each theme in plain owner words, 3 to 8 words, using words that appear in its quotes where you can. Put every id in exactly one theme. Put ids that fit nowhere in a theme named "Other".

${lines}`,
    schema: GROUP_SCHEMA,
  });
  // Every id exactly once: unknown ids out, missing ids to Other.
  const known = new Set(mentions.map((m) => m.id));
  const used = new Set<string>();
  const groups: Group[] = [];
  for (const g of out.groups ?? []) {
    const ids = g.ids.filter((id) => known.has(id) && !used.has(id));
    ids.forEach((id) => used.add(id));
    if (ids.length) groups.push({ name: g.name.trim(), ids });
  }
  const missing = [...known].filter((id) => !used.has(id));
  if (missing.length) {
    const other = groups.find((g) => /^other$/i.test(g.name));
    if (other) other.ids.push(...missing);
    else groups.push({ name: "Other", ids: missing });
  }
  return groups;
}

// ---------------------------------------------------------------- 6. rank

const STOP = new Set(
  "a an the and or but of to in on at for with by from is are was were be been being it its this that these those i we you they he she my our your their me us them so if as do does did have has had not no just very really can could would should will about what when how all any some more most than then there here up out into over also get got".split(
    " "
  )
);

function words(text: string): string[] {
  return normaliseForMatch(text)
    .replace(/[^a-z0-9£'\s-]/g, " ")
    .split(/\s+/)
    .filter(Boolean);
}

/** 2 to 4 word phrases said by 2+ separate owners in this group and rarer elsewhere. Counted, never written. */
export function ownerPhrases(group: PainMention[], others: PainMention[], max = 8): { phrase: string; owners: number }[] {
  const grams = (m: PainMention) => {
    const w = words(m.quote);
    const out = new Set<string>();
    for (let n = 2; n <= 4; n++) {
      for (let i = 0; i + n <= w.length; i++) {
        const g = w.slice(i, i + n);
        if (STOP.has(g[0]!) || STOP.has(g[n - 1]!)) continue;
        if (g.every((x) => STOP.has(x))) continue;
        out.add(g.join(" "));
      }
    }
    return out;
  };
  const inGroup = new Map<string, Set<string>>();
  for (const m of group) for (const g of grams(m)) (inGroup.get(g) ?? inGroup.set(g, new Set()).get(g)!).add(m.author_key);
  const outside = new Map<string, number>();
  for (const m of others) for (const g of grams(m)) outside.set(g, (outside.get(g) ?? 0) + 1);
  return [...inGroup.entries()]
    .filter(([g, authors]) => authors.size >= 2 && (outside.get(g) ?? 0) < authors.size)
    .map(([phrase, authors]) => ({ phrase, owners: authors.size }))
    .sort((a, b) => b.owners - a.owners || b.phrase.split(" ").length - a.phrase.split(" ").length)
    .slice(0, max);
}

function topDistinct(values: (string | null)[], max: number): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const v of values) {
    const t = v?.trim();
    if (!t) continue;
    const k = t.toLowerCase();
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(t);
    if (out.length >= max) break;
  }
  return out;
}

/** Ranks themes by separate owners (each owner counted once, at their best weight), then picks the quotes. */
export function rankGroups(groups: Group[], mentions: PainMention[], now = Date.now()): RankedPain[] {
  const byId = new Map(mentions.map((m) => [m.id, m]));
  const ranked: RankedPain[] = [];
  for (const g of groups) {
    if (/^other$/i.test(g.name)) continue;
    const members = g.ids.map((id) => byId.get(id)!).filter(Boolean);
    const best = new Map<string, number>();
    const recent = new Set<string>();
    for (const m of members) {
      const w = recencyWeight(m.date, now) * fitWeight(m);
      best.set(m.author_key, Math.max(best.get(m.author_key) ?? 0, w));
      const age = monthsAgo(m.date, now);
      if (age !== null && age <= 12) recent.add(m.author_key);
    }
    const score = [...best.values()].reduce((a, b) => a + b, 0);
    const firstPerson = (q: string) => /\b(i|we|my|our|i'm|we're|i've|we've)\b/i.test(q);
    const wordCount = (q: string) => q.split(/\s+/).length;
    const sorted = [...members].sort((a, b) => {
      const pa = (firstPerson(a.quote) ? 2 : 0) + (wordCount(a.quote) >= 8 && wordCount(a.quote) <= 35 ? 1 : 0) + recencyWeight(a.date, now) + fitWeight(a);
      const pb = (firstPerson(b.quote) ? 2 : 0) + (wordCount(b.quote) >= 8 && wordCount(b.quote) <= 35 ? 1 : 0) + recencyWeight(b.date, now) + fitWeight(b);
      return pb - pa;
    });
    const quotes: RankedPain["quotes"] = [];
    const quotedAuthors = new Set<string>();
    const quotedDomains = new Map<string, number>();
    for (const m of sorted) {
      if (quotedAuthors.has(m.author_key)) continue;
      if ((quotedDomains.get(m.domain) ?? 0) >= 2 && sorted.some((x) => !quotedDomains.has(x.domain) && !quotedAuthors.has(x.author_key))) continue;
      quotedAuthors.add(m.author_key);
      quotedDomains.set(m.domain, (quotedDomains.get(m.domain) ?? 0) + 1);
      quotes.push({ quote: m.quote, url: m.url, date: m.date, speaker: m.speaker, size: m.size_evidence });
      if (quotes.length >= 5) break;
    }
    const others = mentions.filter((m) => !g.ids.includes(m.id));
    ranked.push({
      name: g.name,
      score: Math.round(score * 10) / 10,
      owners: best.size,
      owners_last_12_months: recent.size,
      sources: new Set(members.map((m) => m.domain)).size,
      mentions: members.length,
      weak: best.size < WEAK_BELOW,
      quotes,
      triggers: topDistinct(sorted.map((m) => m.trigger), 4),
      tried: topDistinct(sorted.map((m) => m.tried), 4),
      wants: topDistinct(sorted.map((m) => m.wants), 4),
      phrases: ownerPhrases(members, others),
    });
  }
  return ranked.sort((a, b) => b.score - a.score || b.owners - a.owners).slice(0, TOP_PAINS);
}

// ---------------------------------------------------------------- run

export async function researchMarketPains(input: MarketInput, opts: { onLog?: (line: string) => void } = {}): Promise<MarketPainsResult> {
  const started = Date.now();
  const client = new Anthropic();
  const costs = new Costs();
  const log: string[] = [];
  const say = (line: string) => {
    log.push(line);
    opts.onLog?.(line);
  };

  const [words, sources] = await Promise.all([planWords(client, costs, input), discoverSources(client, costs, input, log)]);
  const plan: QueryPlan = { ...words, ...sources };
  const queries = buildQueries(plan);
  say(`sources: ${plan.pages.length} pages; forums ${plan.forums.join(", ") || "none"}; press ${plan.trade_press.join(", ") || "none"}; suppliers ${plan.suppliers.join(", ") || "none"}; review pages ${plan.review_pages.length}`);
  say(`queries: ${queries.length}`);

  const { hits, questions } = await search(queries, costs, log);
  say(log[log.length - 1]!);
  const preferred = [...plan.forums, ...plan.trade_press, ...REGIONAL_PRESS, "ukbusinessforums.co.uk", "trustpilot.com"].map(cleanHost);

  // Pages Claude picked from its own searches go first; Google results fill the rest.
  const chosen = [...plan.pages.slice(0, 30), ...plan.review_pages.slice(0, 5)]
    .filter((url) => /^https?:\/\//.test(url) && !BLOCKED_HOSTS.some((b) => hostOf(url).includes(b)))
    .filter((url, i, all) => all.indexOf(url) === i)
    .map((url) => ({ url, title: "", description: "", date: null, query: "claude web search" }));
  const pages = [...chosen, ...pickPages(hits.filter((h) => !chosen.some((c) => c.url === h.url)), preferred, Math.max(10, MAX_PAGES - chosen.length))];
  const texts = await pool(pages, 10, (p) => fetchText(p.url));
  let viaClaude = 0;
  const blocked = pages.map((p, i) => ({ p, i })).filter(({ i }) => !texts[i]).slice(0, 12);
  await pool(blocked, 4, async ({ p, i }) => {
    texts[i] = await fetchViaClaude(client, costs, p.url);
    if (texts[i]) viaClaude += 1;
  });
  const fetched = pages.map((p, i) => ({ page: p, text: texts[i] })).filter((x): x is { page: SearchHit; text: string } => Boolean(x.text));
  say(`pages: ${chosen.length} picked by Claude's search, ${pages.length - chosen.length} from Google; ${fetched.length} fetched (${viaClaude} through Claude's web fetch)`);

  let quoteFailed = 0;
  let droppedSpeaker = 0;
  let droppedUk = 0;
  let droppedSize = 0;
  let droppedOld = 0;
  let extracted = 0;
  let withPains = 0;
  const mentions: PainMention[] = [];
  const pageLog: MarketPainsResult["page_log"] = [];
  await pool(fetched, EXTRACT_CONCURRENCY, async ({ page, text }, pageIndex) => {
    let posts: ExtractedPost[] = [];
    try {
      posts = await extractPage(client, costs, input, page, text);
    } catch (err) {
      say(`extract failed ${page.url}: ${err instanceof Error ? err.message : err}`);
      return;
    }
    const domain = hostOf(page.url);
    const ukSite = domain.endsWith(".uk") || /ukbusinessforums/.test(domain);
    let pageKept = 0;
    posts.forEach((post, postIndex) => {
      for (const pain of post.pains) {
        extracted += 1;
        if (!quoteIsExact(pain.quote, text)) {
          quoteFailed += 1;
          continue;
        }
        const ownerLike =
          (post.speaker === "owner" && post.industry_match !== "no") ||
          (post.speaker === "unknown" && post.industry_match !== "no" && OWNER_WORDS.test(pain.quote));
        if (!ownerLike) {
          droppedSpeaker += 1;
          continue;
        }
        if (!ukSite && !post.uk_evidence) {
          droppedUk += 1;
          continue;
        }
        if (post.size_fit === "too_small" || post.size_fit === "too_big") {
          droppedSize += 1;
          continue;
        }
        const postDate = post.date ?? page.date?.slice(0, 10) ?? null;
        const age = monthsAgo(postDate);
        if (age !== null && age > MAX_AGE_MONTHS) {
          droppedOld += 1;
          continue;
        }
        const author = post.author?.trim().toLowerCase();
        mentions.push({
          id: `m${mentions.length + 1}`,
          label: pain.label,
          quote: pain.quote.trim(),
          trigger: pain.trigger,
          tried: pain.tried,
          wants: pain.wants,
          speaker: post.speaker,
          size_evidence: post.size_evidence,
          uk_evidence: post.uk_evidence,
          author_key: hash(author ? `${domain}|${author}` : `${page.url}|${pageIndex}|${postIndex}`),
          url: page.url,
          domain,
          date: postDate,
        });
        pageKept += 1;
      }
    });
    if (pageKept) withPains += 1;
    const speakers = new Map<string, number>();
    for (const post of posts) speakers.set(`${post.speaker}/${post.industry_match}`, (speakers.get(`${post.speaker}/${post.industry_match}`) ?? 0) + 1);
    pageLog.push({
      url: page.url,
      posts: posts.length,
      pains: posts.reduce((n, p) => n + p.pains.length, 0),
      kept: pageKept,
      speakers: [...speakers.entries()].map(([k, n]) => `${k}:${n}`).join(" "),
    });
  });
  say(`mentions: ${extracted} extracted, ${quoteFailed} failed the exact-quote check, ${droppedSpeaker} not owners, ${droppedUk} not UK, ${droppedSize} wrong size, ${droppedOld} older than 3 years, ${mentions.length} kept`);

  const groups = mentions.length ? await groupMentions(client, costs, input, mentions) : [];
  const pains = rankGroups(groups, mentions);
  const cost = costs.summary();
  say(`done: ${pains.length} pains, $${cost.total_usd} (${Math.round((Date.now() - started) / 1000)}s)`);

  return {
    market: input,
    ran_at: new Date().toISOString(),
    seconds: Math.round((Date.now() - started) / 1000),
    queries,
    questions_people_ask: questions.slice(0, 20),
    pages: { found: hits.length, fetched: fetched.length, with_pains: withPains },
    sources: { pages: plan.pages, forums: plan.forums, trade_press: plan.trade_press, suppliers: plan.suppliers, review_pages: plan.review_pages },
    page_log: pageLog,
    mentions: { extracted, quote_failed: quoteFailed, kept: mentions.length, dropped_speaker: droppedSpeaker, dropped_uk: droppedUk, dropped_size: droppedSize, dropped_old: droppedOld },
    kept_mentions: mentions,
    pains,
    cost,
    log,
  };
}

/** The result as a page Zander can read. */
export function painsToMarkdown(r: MarketPainsResult, title: string): string {
  const out: string[] = [];
  out.push(`# ${title}`, "", `Market: ${r.market.market}`);
  if (r.market.buyer) out.push(`Buyer: ${r.market.buyer}`);
  out.push(
    "",
    `Ran ${r.ran_at.slice(0, 16).replace("T", " ")}, ${r.seconds}s, $${r.cost.total_usd} (Apify $${r.cost.apify_usd}, Claude $${r.cost.anthropic_usd}).`,
    `${r.pages.fetched} pages read, ${r.pages.with_pains} with owner pains. ${r.mentions.kept} owner quotes kept of ${r.mentions.extracted} found (${r.mentions.quote_failed} not word for word, ${r.mentions.dropped_speaker} not owners, ${r.mentions.dropped_uk} not UK, ${r.mentions.dropped_size} wrong size, ${r.mentions.dropped_old} older than 3 years).`,
    ""
  );
  r.pains.forEach((p, i) => {
    out.push(`## ${i + 1}. ${p.name}${p.weak ? " (weak evidence)" : ""}`, "");
    out.push(`${p.owners} ${p.owners === 1 ? "owner" : "owners"} (${p.owners_last_12_months} in the last year), ${p.sources} ${p.sources === 1 ? "site" : "sites"}, score ${p.score}`, "");
    for (const q of p.quotes) {
      out.push(`> "${q.quote}"`, `> ${q.date ?? "undated"}${q.size ? ` · ${q.size}` : ""} · ${q.url}`, "");
    }
    if (p.triggers.length) out.push(`- **What set it off:** ${p.triggers.join("; ")}`);
    if (p.tried.length) out.push(`- **What they tried:** ${p.tried.join("; ")}`);
    if (p.wants.length) out.push(`- **What they want:** ${p.wants.join("; ")}`);
    if (p.phrases.length) out.push(`- **Words owners use:** ${p.phrases.map((x) => `"${x.phrase}" (${x.owners})`).join(", ")}`);
    out.push("");
  });
  if (r.questions_people_ask.length) {
    out.push("## Questions people ask Google", "", ...r.questions_people_ask.map((q) => `- ${q}`), "");
  }
  return out.join("\n");
}
